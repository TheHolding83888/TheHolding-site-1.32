import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveOnchainPrices as resolveCorePrices,
  isRetryableRpcError
} from './onchain-price-resolver-core.mjs';
import {
  UNISWAP_V3_TWAP_ROUTE_TYPE,
  resolveUniswapV3TwapPrices
} from './onchain-uniswap-v3-twap.mjs';
import {
  CURVE_EMA_ROUTE_TYPE,
  resolveCurveEmaPrices
} from './onchain-curve-ema.mjs';

export {
  decodeChainlinkRoundData,
  decodeUint256,
  decodeRpcQuantity,
  isRetryableRpcError,
  encodeVelodromeGetPool,
  encodeVelodromeQuote
} from './onchain-price-resolver-core.mjs';
export {
  UNISWAP_V3_TWAP_ROUTE_TYPE,
  encodeUniswapV3GetPool,
  encodeUniswapV3Observe,
  decodeUniswapV3Observe,
  arithmeticMeanTick,
  quoteRatioAtTick
} from './onchain-uniswap-v3-twap.mjs';
export {
  CURVE_EMA_ROUTE_TYPE,
  encodeCurveCoins,
  encodeCurvePriceOracle
} from './onchain-curve-ema.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, 'onchain-price-source-registry.json');
const MARKET_DATA_PATH = path.join(__dirname, 'market-data.json');
const OUTPUT_PATH = path.join(__dirname, 'onchain-price-shadow.json');
const RPC_TIMEOUT_MS = 10_000;
const PYTH_ROUTE_TYPE = 'pyth-core-readonly';
const PYTH_GET_PRICE_UNSAFE_SELECTOR = '96834ad3';
const UINT256_MOD = 1n << 256n;
const INT256_SIGN = 1n << 255n;

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
function divergencePct(onchainUsd, canonicalUsd) {
  if (!(onchainUsd >= 0) || !(canonicalUsd > 0)) return null;
  return Math.abs(onchainUsd - canonicalUsd) / canonicalUsd * 100;
}
function statusRank(status) {
  if (status === 'shadow-ok') return 'ok';
  if (['invalid', 'stale', 'high-confidence-interval', 'divergent'].includes(status)) return 'warning';
  return 'unavailable';
}

export function encodePythGetPriceUnsafe(priceId) {
  const clean = String(priceId || '').replace(/^0x/, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) throw new Error(`Invalid Pyth price id: ${priceId}`);
  return `0x${PYTH_GET_PRICE_UNSAFE_SELECTOR}${clean}`;
}

export function decodePythPrice(hex) {
  const rawPrice = signedInt256(word(hex, 0));
  const rawConfidence = word(hex, 1);
  const exponent = Number(signedInt256(word(hex, 2)));
  const publishTime = Number(word(hex, 3));
  if (!Number.isSafeInteger(exponent) || exponent < -30 || exponent > 30) throw new Error(`Pyth exponent out of bounds: ${exponent}`);
  if (!Number.isSafeInteger(publishTime) || publishTime < 0) throw new Error(`Pyth publishTime invalid: ${publishTime}`);
  const price = Number(rawPrice);
  const confidence = Number(rawConfidence);
  if (!Number.isFinite(price) || !Number.isFinite(confidence)) throw new Error('Pyth price/confidence not finite');
  const scale = 10 ** exponent;
  const usd = price * scale;
  const confidenceUsd = confidence * scale;
  const confidencePct = price === 0 ? null : Math.abs(confidence / price) * 100;
  return { rawPrice, rawConfidence, exponent, publishTime, usd, confidenceUsd, confidencePct };
}

async function postPythRpc(endpoint, payload, fetchImpl) {
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
  const retryableRows = payload
    .filter(request => request.id !== 1)
    .map(request => byId.get(request.id))
    .filter(row => row?.error && isRetryableRpcError(row.error));
  if (retryableRows.length) {
    const reasons = [...new Set(retryableRows.map(row => String(row.error?.message || 'retryable RPC error')))];
    throw new Error(`Retryable RPC endpoint error: ${reasons.join(' | ')}`);
  }
  const calls = payload.filter(request => request.id !== 1).map(request => byId.get(request.id));
  if (calls.length && calls.every(row => row?.error || !row?.result)) throw new Error('All Pyth calls failed on RPC endpoint');
  return byId;
}

async function withPythRpcFailover(network, payload, fetchImpl) {
  const attempts = [];
  for (const endpoint of network?.rpcFailover || []) {
    try {
      const byId = await postPythRpc(endpoint, payload, fetchImpl);
      return { byId, endpointId: endpoint.id, attempts };
    } catch (error) {
      attempts.push({ endpointId: endpoint.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  throw new Error(`All public RPC endpoints failed: ${attempts.map(x => `${x.endpointId}:${x.error}`).join(' | ')}`);
}

async function resolvePythPrices({ registry, marketData, fetchImpl, nowMs }) {
  const entries = Object.entries(registry.assets || {})
    .filter(([, asset]) => asset?.route?.type === PYTH_ROUTE_TYPE)
    .map(([assetId, asset]) => ({ assetId, asset, route: asset.route }));
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.route.network)) grouped.set(entry.route.network, []);
    grouped.get(entry.route.network).push(entry);
  }

  const observations = {};
  const networks = {};
  let okCount = 0;
  let warningCount = 0;
  let unavailableCount = 0;
  let httpBatchRequestCount = 0;

  for (const [networkId, rows] of grouped.entries()) {
    const network = registry.networks?.[networkId];
    if (!network) {
      for (const entry of rows) {
        observations[entry.assetId] = {
          assetId: entry.assetId, symbol: entry.asset.symbol || null, usd: null,
          status: 'network-unavailable', authority: 'shadow', source: PYTH_ROUTE_TYPE,
          network: networkId, contract: entry.route.contract, priceId: entry.route.priceId,
          productionPriceAuthority: false
        };
        unavailableCount += 1;
      }
      continue;
    }

    const requestMap = new Map();
    const payload = [{ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }];
    let nextId = 7000;
    for (const entry of rows) {
      const callId = nextId++;
      payload.push({
        jsonrpc: '2.0', id: callId, method: 'eth_call',
        params: [{ to: entry.route.contract, data: encodePythGetPriceUnsafe(entry.route.priceId) }, 'latest']
      });
      requestMap.set(entry.assetId, callId);
    }

    try {
      const result = await withPythRpcFailover(network, payload, async (...args) => {
        httpBatchRequestCount += 1;
        return fetchImpl(...args);
      });
      const blockNumber = Number(BigInt(result.byId.get(1).result));
      networks[networkId] = {
        chainId: network.chainId,
        rpcEndpointId: result.endpointId,
        blockNumber,
        paidRpcRequired: false,
        routeCount: rows.length,
        batchCallCount: payload.length,
        httpBatchRequestCount: result.attempts.length + 1,
        rpcFailoverAttempts: result.attempts.length,
        pythReadonlyBatch: true
      };

      for (const entry of rows) {
        const row = result.byId.get(requestMap.get(entry.assetId));
        if (row?.error || !row?.result) {
          observations[entry.assetId] = {
            assetId: entry.assetId, symbol: entry.asset.symbol || null, usd: null,
            status: 'rpc-call-or-decode-error', authority: 'shadow', source: PYTH_ROUTE_TYPE,
            network: networkId, chainId: network.chainId, contract: entry.route.contract,
            priceId: entry.route.priceId, rpcEndpointId: result.endpointId,
            rpcFailoverAttempts: result.attempts.length, blockNumber,
            error: row?.error?.message || 'Pyth result missing', productionPriceAuthority: false
          };
          unavailableCount += 1;
          continue;
        }

        try {
          const price = decodePythPrice(row.result);
          const feedAgeSeconds = Math.max(0, Math.floor(nowMs / 1000) - price.publishTime);
          const maxAgeSeconds = Number(entry.route.maxAgeSeconds || 0);
          const maxConfidencePct = Number(entry.route.maxConfidencePct ?? Infinity);
          const invalid = !(price.usd > 0) || !(price.publishTime > 0);
          const stale = !invalid && (!(maxAgeSeconds > 0) || feedAgeSeconds > maxAgeSeconds);
          const highConfidenceInterval = !invalid && price.confidencePct !== null && price.confidencePct > maxConfidencePct;
          const canonicalUsd = finite(marketData?.prices?.[entry.assetId]?.usd);
          const diffPct = divergencePct(price.usd, canonicalUsd);
          const divergent = diffPct !== null && diffPct > Number(entry.route.maxDivergencePct ?? Infinity);
          const status = invalid ? 'invalid' : stale ? 'stale' : highConfidenceInterval ? 'high-confidence-interval' : divergent ? 'divergent' : 'shadow-ok';
          const rank = statusRank(status);
          if (rank === 'ok') okCount += 1; else if (rank === 'warning') warningCount += 1; else unavailableCount += 1;
          observations[entry.assetId] = {
            assetId: entry.assetId,
            symbol: entry.asset.symbol || null,
            authority: 'shadow',
            source: PYTH_ROUTE_TYPE,
            network: networkId,
            chainId: network.chainId,
            contract: entry.route.contract,
            priceId: entry.route.priceId,
            rpcEndpointId: result.endpointId,
            rpcFailoverAttempts: result.attempts.length,
            blockNumber,
            publishTime: price.publishTime,
            feedUpdatedAt: price.publishTime > 0 ? iso(price.publishTime * 1000) : null,
            feedAgeSeconds,
            maxAgeSeconds,
            rawPrice: price.rawPrice.toString(),
            rawConfidence: price.rawConfidence.toString(),
            exponent: price.exponent,
            confidenceUsd: price.confidenceUsd,
            confidencePct: price.confidencePct === null ? null : Number(price.confidencePct.toFixed(6)),
            maxConfidencePct,
            usd: invalid ? null : price.usd,
            status,
            quote: entry.route.quote || 'USD',
            canonicalPriceUsd: canonicalUsd,
            divergencePct: diffPct === null ? null : Number(diffPct.toFixed(6)),
            productionPriceAuthority: false
          };
        } catch (error) {
          observations[entry.assetId] = {
            assetId: entry.assetId, symbol: entry.asset.symbol || null, usd: null,
            status: 'rpc-call-or-decode-error', authority: 'shadow', source: PYTH_ROUTE_TYPE,
            network: networkId, chainId: network.chainId, contract: entry.route.contract,
            priceId: entry.route.priceId, rpcEndpointId: result.endpointId,
            rpcFailoverAttempts: result.attempts.length, blockNumber,
            error: error instanceof Error ? error.message : String(error), productionPriceAuthority: false
          };
          unavailableCount += 1;
        }
      }
    } catch (error) {
      for (const entry of rows) {
        observations[entry.assetId] = {
          assetId: entry.assetId, symbol: entry.asset.symbol || null, usd: null,
          status: 'rpc-unavailable', authority: 'shadow', source: PYTH_ROUTE_TYPE,
          network: networkId, chainId: network.chainId, contract: entry.route.contract,
          priceId: entry.route.priceId,
          error: error instanceof Error ? error.message : String(error), productionPriceAuthority: false
        };
        unavailableCount += 1;
      }
    }
  }

  return {
    observations,
    networks,
    coverage: { assetCount: entries.length, okCount, warningCount, unavailableCount },
    rpcEfficiency: { networkCount: grouped.size, routeCount: entries.length, httpBatchRequestCount }
  };
}

function mergeNetworkTelemetry(coreNetworks, pythNetworks) {
  const merged = { ...coreNetworks };
  for (const [networkId, pyth] of Object.entries(pythNetworks)) {
    const core = merged[networkId];
    if (!core) { merged[networkId] = pyth; continue; }
    merged[networkId] = {
      ...core,
      routeCount: Number(core.routeCount || 0) + Number(pyth.routeCount || 0),
      batchCallCount: Number(core.batchCallCount || 0) + Number(pyth.batchCallCount || 0),
      httpBatchRequestCount: Number(core.httpBatchRequestCount || 0) + Number(pyth.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(core.rpcFailoverAttempts || 0) + Number(pyth.rpcFailoverAttempts || 0),
      pythReadonlyBatch: true,
      pythRpcEndpointId: pyth.rpcEndpointId,
      pythBlockNumber: pyth.blockNumber
    };
  }
  return merged;
}

function mergeUniswapTelemetry(baseNetworks, uniswapNetworks) {
  const merged = { ...baseNetworks };
  for (const [networkId, uniswap] of Object.entries(uniswapNetworks)) {
    const base = merged[networkId];
    if (!base) { merged[networkId] = uniswap; continue; }
    merged[networkId] = {
      ...base,
      routeCount: Number(base.routeCount || 0) + Number(uniswap.routeCount || 0),
      batchCallCount: Number(base.batchCallCount || 0) + Number(uniswap.batchCallCount || 0),
      httpBatchRequestCount: Number(base.httpBatchRequestCount || 0) + Number(uniswap.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(base.rpcFailoverAttempts || 0) + Number(uniswap.rpcFailoverAttempts || 0),
      protocolReadPhases: Math.max(Number(base.protocolReadPhases || 1), Number(uniswap.protocolReadPhases || 1)),
      uniswapV3TwapRouteCount: uniswap.uniswapV3TwapRouteCount,
      uniswapV3DiscoveryBatchCallCount: uniswap.uniswapV3DiscoveryBatchCallCount,
      uniswapV3TwapBatchCallCount: uniswap.uniswapV3TwapBatchCallCount,
      uniswapV3DiscoveryEndpointId: uniswap.uniswapV3DiscoveryEndpointId,
      uniswapV3TwapEndpointId: uniswap.uniswapV3TwapEndpointId,
      uniswapV3BlockTag: uniswap.uniswapV3BlockTag
    };
  }
  return merged;
}

function mergeCurveTelemetry(baseNetworks, curveNetworks) {
  const merged = { ...baseNetworks };
  for (const [networkId, curve] of Object.entries(curveNetworks)) {
    const base = merged[networkId];
    if (!base) { merged[networkId] = curve; continue; }
    merged[networkId] = {
      ...base,
      routeCount: Number(base.routeCount || 0) + Number(curve.routeCount || 0),
      batchCallCount: Number(base.batchCallCount || 0) + Number(curve.batchCallCount || 0),
      httpBatchRequestCount: Number(base.httpBatchRequestCount || 0) + Number(curve.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(base.rpcFailoverAttempts || 0) + Number(curve.rpcFailoverAttempts || 0),
      protocolReadPhases: Math.max(Number(base.protocolReadPhases || 1), Number(curve.protocolReadPhases || 1)),
      curveEmaRouteCount: curve.curveEmaRouteCount,
      curveEmaOracleBatchCallCount: curve.curveEmaOracleBatchCallCount,
      curveEmaBlockEndpointId: curve.curveEmaBlockEndpointId,
      curveEmaOracleEndpointId: curve.curveEmaOracleEndpointId,
      curveEmaBlockTag: curve.curveEmaBlockTag
    };
  }
  return merged;
}

export async function resolveOnchainPrices({ registry, marketData = null, fetchImpl = fetch, nowMs = Date.now() }) {
  if (!registry?.assets || !registry?.networks) throw new Error('Onchain source registry missing or invalid');
  const specializedRouteTypes = [PYTH_ROUTE_TYPE, UNISWAP_V3_TWAP_ROUTE_TYPE, CURVE_EMA_ROUTE_TYPE];
  const coreAssets = Object.fromEntries(Object.entries(registry.assets).filter(([, asset]) => !specializedRouteTypes.includes(asset?.route?.type)));
  const coreRegistry = { ...registry, assets: coreAssets };
  const core = await resolveCorePrices({ registry: coreRegistry, marketData, fetchImpl, nowMs });
  const pyth = await resolvePythPrices({ registry, marketData, fetchImpl, nowMs });
  const uniswap = await resolveUniswapV3TwapPrices({ registry, marketData, coreObservations: core.observations, fetchImpl, nowMs });
  const curve = await resolveCurveEmaPrices({ registry, marketData, coreObservations: core.observations, fetchImpl, nowMs });

  const coverage = {
    assetCount: core.coverage.assetCount + pyth.coverage.assetCount + uniswap.coverage.assetCount + curve.coverage.assetCount,
    okCount: core.coverage.okCount + pyth.coverage.okCount + uniswap.coverage.okCount + curve.coverage.okCount,
    warningCount: core.coverage.warningCount + pyth.coverage.warningCount + uniswap.coverage.warningCount + curve.coverage.warningCount,
    unavailableCount: core.coverage.unavailableCount + pyth.coverage.unavailableCount + uniswap.coverage.unavailableCount + curve.coverage.unavailableCount
  };
  const corePlusPythNetworks = mergeNetworkTelemetry(core.networks, pyth.networks);
  const corePythUniswapNetworks = mergeUniswapTelemetry(corePlusPythNetworks, uniswap.networks);
  const networks = mergeCurveTelemetry(corePythUniswapNetworks, curve.networks);
  const rpcEfficiency = {
    networkCount: new Set([...Object.keys(core.networks), ...Object.keys(pyth.networks), ...Object.keys(uniswap.networks), ...Object.keys(curve.networks)]).size,
    routeCount: core.rpcEfficiency.routeCount + pyth.rpcEfficiency.routeCount + uniswap.rpcEfficiency.routeCount + curve.rpcEfficiency.routeCount,
    httpBatchRequestCount: core.rpcEfficiency.httpBatchRequestCount + pyth.rpcEfficiency.httpBatchRequestCount + uniswap.rpcEfficiency.httpBatchRequestCount + curve.rpcEfficiency.httpBatchRequestCount
  };

  return {
    ...core,
    version: '0.8-onchain-price-shadow-curve-ema',
    engineVersion: '0.8-composite-core-plus-pyth-plus-uniswap-plus-curve-ema-resolver',
    generatedAt: iso(nowMs),
    status: coverage.unavailableCount > 0 ? 'partial' : coverage.warningCount > 0 ? 'warning' : 'ok',
    semantics: {
      ...core.semantics,
      pythCoreReadonlyRoutes: true,
      pythHermesDependency: false,
      pythPriceUpdatesSubmitted: false,
      pythPublishTimeFreshnessChecked: true,
      pythConfidenceIntervalChecked: true,
      pythUsesPublicRpcOnly: true,
      uniswapV3TwapRoutes: true,
      uniswapV3FactoryDiscovery: true,
      uniswapV3TwapReadsPinnedToDiscoveryBlock: true,
      uniswapV3UsesObserveNotSpot: true,
      curveEmaRoutes: true,
      curvePriceOracleReadsPinnedToBlock: true,
      curveUsesPriceOracleNotSpot: true,
      dexSpotPriceAuthority: false
    },
    rpcEfficiency,
    coverage,
    networks,
    observations: { ...core.observations, ...pyth.observations, ...uniswap.observations, ...curve.observations },
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
