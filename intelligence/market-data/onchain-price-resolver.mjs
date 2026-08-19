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

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function iso(value = Date.now()) { return new Date(value).toISOString(); }

function word(hex, index) {
  const clean = String(hex || '').replace(/^0x/, '');
  const start = index * 64;
  const part = clean.slice(start, start + 64);
  if (part.length !== 64) throw new Error(`ABI word ${index} missing`);
  return BigInt(`0x${part}`);
}

function signedInt256(value) {
  return value >= INT256_SIGN ? value - UINT256_MOD : value;
}

export function decodeChainlinkRoundData(hex) {
  const roundId = word(hex, 0);
  const answer = signedInt256(word(hex, 1));
  const startedAt = word(hex, 2);
  const updatedAt = word(hex, 3);
  const answeredInRound = word(hex, 4);
  return { roundId, answer, startedAt, updatedAt, answeredInRound };
}

export function decodeUint256(hex) {
  return word(hex, 0);
}

function rpcBatchForChainlink(route) {
  return [
    { jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] },
    { jsonrpc: '2.0', id: 2, method: 'eth_call', params: [{ to: route.contract, data: '0x313ce567' }, 'latest'] },
    { jsonrpc: '2.0', id: 3, method: 'eth_call', params: [{ to: route.contract, data: '0xfeaf968c' }, 'latest'] }
  ];
}

async function postRpc(endpoint, payload, fetchImpl) {
  const response = await fetchImpl(endpoint.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'accept': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS)
  });
  if (!response.ok) throw new Error(`RPC HTTP ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error('RPC batch response is not an array');
  const byId = new Map(body.map(row => [Number(row?.id), row]));
  for (const request of payload) {
    const result = byId.get(request.id);
    if (!result) throw new Error(`RPC result ${request.id} missing`);
    if (result.error) throw new Error(`RPC error ${request.id}: ${result.error.message || 'unknown'}`);
  }
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

export async function resolveOnchainPrices({ registry, marketData = null, fetchImpl = fetch, nowMs = Date.now() }) {
  if (!registry?.assets || !registry?.networks) throw new Error('Onchain source registry missing or invalid');
  const observations = {};
  const networks = {};
  let okCount = 0;
  let warningCount = 0;
  let unavailableCount = 0;

  for (const [assetId, asset] of Object.entries(registry.assets)) {
    const route = asset?.route;
    if (!route || route.type !== 'chainlink-v3') {
      observations[assetId] = { assetId, status: 'unsupported-route', usd: null, authority: 'shadow' };
      unavailableCount += 1;
      continue;
    }

    const network = registry.networks[route.network];
    if (!network) {
      observations[assetId] = { assetId, status: 'network-unavailable', usd: null, authority: 'shadow' };
      unavailableCount += 1;
      continue;
    }

    try {
      const payload = rpcBatchForChainlink(route);
      const { byId, endpointId, attempts } = await withRpcFailover(network, payload, fetchImpl);
      const blockNumber = Number(decodeUint256(byId.get(1).result));
      const decimals = Number(decodeUint256(byId.get(2).result));
      const round = decodeChainlinkRoundData(byId.get(3).result);
      const updatedAtSeconds = Number(round.updatedAt);
      const feedAgeSeconds = Math.max(0, Math.floor(nowMs / 1000) - updatedAtSeconds);
      const rawAnswer = Number(round.answer);
      const usd = Number.isFinite(rawAnswer) ? rawAnswer / 10 ** decimals : null;
      const canonicalUsd = finite(marketData?.prices?.[assetId]?.usd);
      const diffPct = divergencePct(usd, canonicalUsd);
      const stale = !(updatedAtSeconds > 0) || feedAgeSeconds > Number(route.maxAgeSeconds || 0);
      const invalid = !(usd > 0) || Number(round.answeredInRound) < Number(round.roundId);
      const divergent = diffPct !== null && diffPct > Number(route.maxDivergencePct ?? Infinity);
      const status = invalid ? 'invalid' : stale ? 'stale' : divergent ? 'divergent' : 'shadow-ok';

      if (status === 'shadow-ok') okCount += 1;
      else warningCount += 1;

      observations[assetId] = {
        assetId,
        symbol: asset.symbol || null,
        usd: invalid ? null : usd,
        status,
        authority: 'shadow',
        source: 'chainlink-v3',
        network: route.network,
        chainId: network.chainId,
        contract: route.contract,
        quote: route.quote || 'USD',
        rpcEndpointId: endpointId,
        rpcFailoverAttempts: attempts.length,
        blockNumber,
        roundId: round.roundId.toString(),
        answeredInRound: round.answeredInRound.toString(),
        feedUpdatedAt: updatedAtSeconds > 0 ? iso(updatedAtSeconds * 1000) : null,
        feedAgeSeconds,
        maxAgeSeconds: Number(route.maxAgeSeconds || 0),
        canonicalPriceUsd: canonicalUsd,
        divergencePct: diffPct === null ? null : Number(diffPct.toFixed(6)),
        maxDivergencePct: Number(route.maxDivergencePct ?? 0),
        productionPriceAuthority: false
      };
      networks[route.network] = {
        chainId: network.chainId,
        rpcEndpointId: endpointId,
        blockNumber,
        paidRpcRequired: false
      };
    } catch (error) {
      observations[assetId] = {
        assetId,
        symbol: asset.symbol || null,
        usd: null,
        status: 'rpc-unavailable',
        authority: 'shadow',
        source: route.type,
        network: route.network,
        contract: route.contract,
        error: error instanceof Error ? error.message : String(error),
        productionPriceAuthority: false
      };
      unavailableCount += 1;
    }
  }

  const assetCount = Object.keys(registry.assets).length;
  return {
    version: '0.1-onchain-price-shadow',
    engineVersion: '0.1-provider-agnostic-public-rpc-shadow-resolver',
    generatedAt: iso(nowMs),
    status: unavailableCount > 0 ? 'partial' : warningCount > 0 ? 'warning' : 'ok',
    mode: 'shadow',
    semantics: {
      onchainPrimaryTarget: true,
      productionPriceAuthority: false,
      browserRpcRequestsAllowed: false,
      publicRpcFailover: true,
      paidRpcRequired: false,
      unknownIsNotZero: true,
      coinGeckoRemainsFallbackAndSanityCheck: true
    },
    coverage: { assetCount, okCount, warningCount, unavailableCount },
    networks,
    observations,
    authority: {
      readOnly: true,
      executionAuthority: 'none',
      capitalExecution: false,
      policyMutationAuthority: false
    }
  };
}

export async function runCli() {
  const registry = readJson(REGISTRY_PATH);
  if (!registry) throw new Error('Onchain price source registry not found');
  const marketData = readJson(MARKET_DATA_PATH, null);
  const output = await resolveOnchainPrices({ registry, marketData });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log('Onchain price shadow written', {
    status: output.status,
    coverage: output.coverage,
    productionPriceAuthority: false
  });
  if (output.coverage.okCount === 0) throw new Error('No healthy onchain shadow observations');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await runCli();
}
