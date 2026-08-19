import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, 'onchain-price-source-registry.json');
const MARKET_DATA_PATH = path.join(__dirname, 'market-data.json');
const OUTPUT_PATH = path.join(__dirname, 'onchain-price-shadow.json');
const RPC_TIMEOUT_MS = 10_000;
const UINT256_MOD = 1n << 256n;
const INT256_SIGN = 1n << 255n;
const SUPPORTED_ROUTE_TYPES = new Set(['chainlink-v3', 'chainlink-v3-relative']);

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function iso(value = Date.now()) { return new Date(value).toISOString(); }
function word(hex, index) {
  const clean = String(hex || '').replace(/^0x/, '');
  const part = clean.slice(index * 64, index * 64 + 64);
  if (part.length !== 64) throw new Error(`ABI word ${index} missing`);
  return BigInt(`0x${part}`);
}
function signedInt256(value) { return value >= INT256_SIGN ? value - UINT256_MOD : value; }
export function decodeChainlinkRoundData(hex) {
  return { roundId: word(hex, 0), answer: signedInt256(word(hex, 1)), startedAt: word(hex, 2), updatedAt: word(hex, 3), answeredInRound: word(hex, 4) };
}
export function decodeUint256(hex) { return word(hex, 0); }
export function decodeRpcQuantity(hex) {
  if (!/^0x[0-9a-f]+$/i.test(String(hex || ''))) throw new Error('Invalid RPC quantity');
  return BigInt(hex);
}

function buildNetworkBatch(entries) {
  const payload = [{ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }];
  const requestMap = new Map();
  let nextId = 1000;
  for (const entry of entries) {
    const decimalsId = nextId++;
    const roundId = nextId++;
    payload.push({ jsonrpc: '2.0', id: decimalsId, method: 'eth_call', params: [{ to: entry.route.contract, data: '0x313ce567' }, 'latest'] });
    payload.push({ jsonrpc: '2.0', id: roundId, method: 'eth_call', params: [{ to: entry.route.contract, data: '0xfeaf968c' }, 'latest'] });
    requestMap.set(entry.assetId, { decimalsId, roundId });
  }
  return { payload, requestMap };
}

async function postRpc(endpoint, payload, fetchImpl) {
  const response = await fetchImpl(endpoint.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('RPC batch response is not an array');
  const byId = new Map(body.map(row => [Number(row?.id), row]));
  for (const request of payload) if (!byId.has(request.id)) throw new Error(`RPC result ${request.id} missing`);
  const block = byId.get(1);
  if (block?.error || !block?.result) throw new Error(`RPC block error: ${block?.error?.message || 'missing block result'}`);
  const assetCalls = payload.filter(x => x.id !== 1).map(x => byId.get(x.id));
  if (assetCalls.length && assetCalls.every(row => row?.error || !row?.result)) throw new Error('All asset calls failed on RPC endpoint');
  return byId;
}

async function withRpcFailover(network, payload, fetchImpl) {
  const attempts = [];
  for (const endpoint of network?.rpcFailover || []) {
    try {
      const byId = await postRpc(endpoint, payload, fetchImpl);
      return { byId, endpointId: endpoint.id, attempts };
    } catch (error) {
      attempts.push({ endpointId: endpoint.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  throw new Error(`All public RPC endpoints failed: ${attempts.map(x => `${x.endpointId}:${x.error}`).join(' | ')}`);
}

function divergencePct(onchainUsd, canonicalUsd) {
  if (!(onchainUsd >= 0) || !(canonicalUsd > 0)) return null;
  return Math.abs(onchainUsd - canonicalUsd) / canonicalUsd * 100;
}

function unavailableObservation(entry, status, error = null) {
  return {
    assetId: entry.assetId,
    symbol: entry.asset?.symbol || null,
    usd: null,
    status,
    authority: 'shadow',
    source: entry.route?.type || null,
    network: entry.route?.network || null,
    contract: entry.route?.contract || null,
    ...(error ? { error } : {}),
    productionPriceAuthority: false
  };
}

function decodeFeed(entry, byId, ids, nowMs) {
  const decimalsRow = byId.get(ids.decimalsId);
  const roundRow = byId.get(ids.roundId);
  if (decimalsRow?.error || roundRow?.error || !decimalsRow?.result || !roundRow?.result) {
    throw new Error(decimalsRow?.error?.message || roundRow?.error?.message || 'asset RPC result missing');
  }
  const decimals = Number(decodeUint256(decimalsRow.result));
  const round = decodeChainlinkRoundData(roundRow.result);
  const updatedAtSeconds = Number(round.updatedAt);
  const feedAgeSeconds = Math.max(0, Math.floor(nowMs / 1000) - updatedAtSeconds);
  const rawAnswer = Number(round.answer);
  const feedValue = Number.isFinite(rawAnswer) ? rawAnswer / 10 ** decimals : null;
  const stale = !(updatedAtSeconds > 0) || feedAgeSeconds > Number(entry.route.maxAgeSeconds || 0);
  const invalid = !(feedValue > 0) || round.answeredInRound < round.roundId;
  return { decimals, round, updatedAtSeconds, feedAgeSeconds, feedValue, stale, invalid };
}

function observationBase(entry, network, networkId, endpointId, attempts, blockNumber, feed) {
  return {
    assetId: entry.assetId,
    symbol: entry.asset.symbol || null,
    authority: 'shadow',
    source: entry.route.type,
    network: networkId,
    chainId: network.chainId,
    contract: entry.route.contract,
    rpcEndpointId: endpointId,
    rpcFailoverAttempts: attempts.length,
    blockNumber,
    roundId: feed.round.roundId.toString(),
    answeredInRound: feed.round.answeredInRound.toString(),
    feedUpdatedAt: feed.updatedAtSeconds > 0 ? iso(feed.updatedAtSeconds * 1000) : null,
    feedAgeSeconds: feed.feedAgeSeconds,
    maxAgeSeconds: Number(entry.route.maxAgeSeconds || 0),
    maxDivergencePct: Number(entry.route.maxDivergencePct ?? 0),
    productionPriceAuthority: false
  };
}

export async function resolveOnchainPrices({ registry, marketData = null, fetchImpl = fetch, nowMs = Date.now() }) {
  if (!registry?.assets || !registry?.networks) throw new Error('Onchain source registry missing or invalid');
  const observations = {};
  const networks = {};
  const grouped = new Map();
  const relativePending = [];
  let okCount = 0;
  let warningCount = 0;
  let unavailableCount = 0;
  let httpBatchRequestCount = 0;

  for (const [assetId, asset] of Object.entries(registry.assets)) {
    const route = asset?.route;
    const entry = { assetId, asset, route };
    if (!route || !SUPPORTED_ROUTE_TYPES.has(route.type)) {
      observations[assetId] = unavailableObservation(entry, 'unsupported-route');
      unavailableCount += 1;
      continue;
    }
    if (!registry.networks[route.network]) {
      observations[assetId] = unavailableObservation(entry, 'network-unavailable');
      unavailableCount += 1;
      continue;
    }
    if (!grouped.has(route.network)) grouped.set(route.network, []);
    grouped.get(route.network).push(entry);
  }

  for (const [networkId, entries] of grouped.entries()) {
    const network = registry.networks[networkId];
    const { payload, requestMap } = buildNetworkBatch(entries);
    try {
      const result = await withRpcFailover(network, payload, async (...args) => {
        httpBatchRequestCount += 1;
        return fetchImpl(...args);
      });
      const blockNumber = Number(decodeRpcQuantity(result.byId.get(1).result));
      networks[networkId] = {
        chainId: network.chainId,
        rpcEndpointId: result.endpointId,
        blockNumber,
        paidRpcRequired: false,
        routeCount: entries.length,
        batchCallCount: payload.length,
        httpBatchRequestCount: result.attempts.length + 1,
        rpcFailoverAttempts: result.attempts.length
      };

      for (const entry of entries) {
        const ids = requestMap.get(entry.assetId);
        let feed;
        try {
          feed = decodeFeed(entry, result.byId, ids, nowMs);
        } catch (error) {
          observations[entry.assetId] = unavailableObservation(entry, 'rpc-call-or-decode-error', error instanceof Error ? error.message : String(error));
          unavailableCount += 1;
          continue;
        }

        const base = observationBase(entry, network, networkId, result.endpointId, result.attempts, blockNumber, feed);
        if (entry.route.type === 'chainlink-v3-relative') {
          relativePending.push({ entry, feed, base });
          continue;
        }

        const usd = feed.invalid ? null : feed.feedValue;
        const canonicalUsd = finite(marketData?.prices?.[entry.assetId]?.usd);
        const diffPct = divergencePct(usd, canonicalUsd);
        const divergent = diffPct !== null && diffPct > Number(entry.route.maxDivergencePct ?? Infinity);
        const status = feed.invalid ? 'invalid' : feed.stale ? 'stale' : divergent ? 'divergent' : 'shadow-ok';
        if (status === 'shadow-ok') okCount += 1; else warningCount += 1;
        observations[entry.assetId] = {
          ...base,
          usd,
          status,
          quote: entry.route.quote || 'USD',
          canonicalPriceUsd: canonicalUsd,
          divergencePct: diffPct === null ? null : Number(diffPct.toFixed(6))
        };
      }
    } catch (error) {
      for (const entry of entries) {
        observations[entry.assetId] = unavailableObservation(entry, 'rpc-unavailable', error instanceof Error ? error.message : String(error));
        unavailableCount += 1;
      }
    }
  }

  for (const pending of relativePending) {
    const { entry, feed, base } = pending;
    const quoteAssetId = entry.route.quoteAssetId;
    const quoteObservation = observations[quoteAssetId];
    if (!quoteObservation || !(finite(quoteObservation.usd) > 0)) {
      observations[entry.assetId] = {
        ...base,
        usd: null,
        status: 'dependency-unavailable',
        feedValue: feed.invalid ? null : feed.feedValue,
        feedQuote: entry.route.feedQuote || null,
        quoteAssetId,
        quoteAssetUsd: finite(quoteObservation?.usd),
        error: `Relative-price dependency unavailable: ${quoteAssetId}`
      };
      unavailableCount += 1;
      continue;
    }

    const usd = feed.invalid ? null : feed.feedValue * Number(quoteObservation.usd);
    const canonicalUsd = finite(marketData?.prices?.[entry.assetId]?.usd);
    const diffPct = divergencePct(usd, canonicalUsd);
    const divergent = diffPct !== null && diffPct > Number(entry.route.maxDivergencePct ?? Infinity);
    const dependencyWarning = quoteObservation.status !== 'shadow-ok';
    const status = feed.invalid ? 'invalid' : feed.stale ? 'stale' : dependencyWarning ? 'dependency-warning' : divergent ? 'divergent' : 'shadow-ok';
    if (status === 'shadow-ok') okCount += 1; else warningCount += 1;
    observations[entry.assetId] = {
      ...base,
      usd,
      status,
      feedValue: feed.invalid ? null : feed.feedValue,
      feedQuote: entry.route.feedQuote || null,
      quoteAssetId,
      quoteAssetUsd: Number(quoteObservation.usd),
      outputQuote: entry.route.outputQuote || 'USD',
      composition: `${entry.asset.symbol || entry.assetId}/${entry.route.feedQuote || quoteAssetId} × ${quoteAssetId}/USD`,
      canonicalPriceUsd: canonicalUsd,
      divergencePct: diffPct === null ? null : Number(diffPct.toFixed(6)),
      dependencyStatus: quoteObservation.status
    };
  }

  const assetCount = Object.keys(registry.assets).length;
  return {
    version: '0.3-onchain-price-shadow-multinetwork-composable',
    engineVersion: '0.3-network-batched-composable-public-rpc-shadow-resolver',
    generatedAt: iso(nowMs),
    status: unavailableCount > 0 ? 'partial' : warningCount > 0 ? 'warning' : 'ok',
    mode: 'shadow',
    semantics: {
      onchainPrimaryTarget: true,
      productionPriceAuthority: false,
      browserRpcRequestsAllowed: false,
      publicRpcFailover: true,
      oneHttpBatchPerNetworkPerAttempt: true,
      duplicateBlockRequestsWithinNetwork: false,
      composableRelativePriceRoutes: true,
      relativeRoutesReuseSameCycleQuoteObservation: true,
      paidRpcRequired: false,
      unknownIsNotZero: true,
      coinGeckoRemainsFallbackAndSanityCheck: true
    },
    rpcEfficiency: {
      networkCount: grouped.size,
      routeCount: [...grouped.values()].reduce((sum, rows) => sum + rows.length, 0),
      httpBatchRequestCount
    },
    coverage: { assetCount, okCount, warningCount, unavailableCount },
    networks,
    observations,
    authority: { readOnly: true, executionAuthority: 'none', capitalExecution: false, policyMutationAuthority: false }
  };
}

export async function runCli() {
  const registry = readJson(REGISTRY_PATH);
  if (!registry) throw new Error('Onchain price source registry not found');
  const marketData = readJson(MARKET_DATA_PATH, null);
  const output = await resolveOnchainPrices({ registry, marketData });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log('Onchain price shadow written', { status: output.status, coverage: output.coverage, rpcEfficiency: output.rpcEfficiency, productionPriceAuthority: false });
  if (output.coverage.okCount === 0) throw new Error('No healthy onchain shadow observations');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
