import { isRetryableRpcError } from './onchain-price-resolver-core.mjs';

export const CURVE_EMA_ROUTE_TYPE = 'curve-ema-relative';
const RPC_TIMEOUT_MS = 10_000;
const COINS_SELECTOR = 'c6610657';
const PRICE_ORACLE_SELECTOR = '86fc88d3';
const UINT256_SCALE = 10n ** 18n;

function strip0x(value) { return String(value || '').replace(/^0x/, ''); }
function word(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function decodeWord(hex, index = 0) {
  const clean = strip0x(hex);
  const part = clean.slice(index * 64, index * 64 + 64);
  if (part.length !== 64) throw new Error(`ABI word ${index} missing`);
  return BigInt(`0x${part}`);
}
function decodeAddress(hex) {
  const clean = strip0x(hex);
  if (clean.length < 64) throw new Error('ABI address result missing');
  return `0x${clean.slice(24, 64)}`;
}
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function divergencePct(onchainUsd, canonicalUsd) {
  if (!(onchainUsd >= 0) || !(canonicalUsd > 0)) return null;
  return Math.abs(onchainUsd - canonicalUsd) / canonicalUsd * 100;
}
function statusRank(status) {
  if (status === 'shadow-ok') return 'ok';
  if (['divergent', 'dependency-warning'].includes(status)) return 'warning';
  return 'unavailable';
}

export function encodeCurveCoins(index) {
  const i = Number(index);
  if (!Number.isInteger(i) || i < 0) throw new Error(`Invalid Curve coin index: ${index}`);
  return `0x${COINS_SELECTOR}${word(i)}`;
}

export function encodeCurvePriceOracle() {
  return `0x${PRICE_ORACLE_SELECTOR}`;
}

async function postBatch(endpoint, payload, fetchImpl) {
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
  const retryableRows = payload.map(request => byId.get(request.id)).filter(row => row?.error && isRetryableRpcError(row.error));
  if (retryableRows.length) {
    const reasons = [...new Set(retryableRows.map(row => String(row.error?.message || 'retryable RPC error')))];
    throw new Error(`Retryable RPC endpoint error: ${reasons.join(' | ')}`);
  }
  return byId;
}

async function withFailover(network, payload, fetchImpl) {
  const attempts = [];
  for (const endpoint of network?.rpcFailover || []) {
    try {
      const byId = await postBatch(endpoint, payload, fetchImpl);
      return { byId, endpointId: endpoint.id, attempts };
    } catch (error) {
      attempts.push({ endpointId: endpoint.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  throw new Error(`All public RPC endpoints failed: ${attempts.map(x => `${x.endpointId}:${x.error}`).join(' | ')}`);
}

function routeErrorObservation(entry, network, status, error, extra = {}) {
  return {
    assetId: entry.assetId,
    symbol: entry.asset.symbol || null,
    usd: null,
    status,
    authority: 'shadow',
    source: CURVE_EMA_ROUTE_TYPE,
    network: entry.route.network,
    chainId: network?.chainId ?? null,
    pool: entry.route.pool,
    token: entry.route.token,
    quoteToken: entry.route.quoteToken,
    error,
    productionPriceAuthority: false,
    ...extra
  };
}

export async function resolveCurveEmaPrices({ registry, marketData, coreObservations, fetchImpl = fetch }) {
  const entries = Object.entries(registry.assets || {})
    .filter(([, asset]) => asset?.route?.type === CURVE_EMA_ROUTE_TYPE)
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
        observations[entry.assetId] = routeErrorObservation(entry, null, 'network-unavailable', `Network ${networkId} missing`);
        unavailableCount += 1;
      }
      continue;
    }

    const blockPayload = [{ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }];
    let blockResult;
    try {
      blockResult = await withFailover(network, blockPayload, async (...args) => {
        httpBatchRequestCount += 1;
        return fetchImpl(...args);
      });
    } catch (error) {
      for (const entry of rows) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-unavailable', error instanceof Error ? error.message : String(error));
        unavailableCount += 1;
      }
      continue;
    }

    const blockRow = blockResult.byId.get(1);
    if (blockRow?.error || !blockRow?.result) {
      for (const entry of rows) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-call-or-decode-error', blockRow?.error?.message || 'Block result missing');
        unavailableCount += 1;
      }
      continue;
    }
    const blockTag = blockRow.result;
    const blockNumber = Number(BigInt(blockTag));

    const payload = [];
    const idsByAsset = new Map();
    let nextId = 9000;
    for (const entry of rows) {
      const ids = { coin0: nextId++, coin1: nextId++, oracle: nextId++ };
      payload.push(
        { jsonrpc: '2.0', id: ids.coin0, method: 'eth_call', params: [{ to: entry.route.pool, data: encodeCurveCoins(0) }, blockTag] },
        { jsonrpc: '2.0', id: ids.coin1, method: 'eth_call', params: [{ to: entry.route.pool, data: encodeCurveCoins(1) }, blockTag] },
        { jsonrpc: '2.0', id: ids.oracle, method: 'eth_call', params: [{ to: entry.route.pool, data: encodeCurvePriceOracle() }, blockTag] }
      );
      idsByAsset.set(entry.assetId, ids);
    }

    let result;
    try {
      result = await withFailover(network, payload, async (...args) => {
        httpBatchRequestCount += 1;
        return fetchImpl(...args);
      });
    } catch (error) {
      for (const entry of rows) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-unavailable', error instanceof Error ? error.message : String(error), {
          blockNumber, blockTag, rpcEndpointId: blockResult.endpointId
        });
        unavailableCount += 1;
      }
      continue;
    }

    for (const entry of rows) {
      const ids = idsByAsset.get(entry.assetId);
      const coin0Row = result.byId.get(ids.coin0);
      const coin1Row = result.byId.get(ids.coin1);
      const oracleRow = result.byId.get(ids.oracle);
      const failed = [coin0Row, coin1Row, oracleRow].find(row => row?.error || !row?.result);
      if (failed) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-call-or-decode-error', failed?.error?.message || 'Curve EMA result missing', {
          blockNumber, blockTag, rpcEndpointId: blockResult.endpointId, oracleRpcEndpointId: result.endpointId
        });
        unavailableCount += 1;
        continue;
      }

      try {
        const coin0 = decodeAddress(coin0Row.result);
        const coin1 = decodeAddress(coin1Row.result);
        if (entry.route.oracleDirection !== 'coin0-per-coin1') throw new Error(`Unsupported Curve oracle direction: ${entry.route.oracleDirection}`);
        if (coin0.toLowerCase() !== String(entry.route.quoteToken).toLowerCase()) throw new Error(`Curve coin0 mismatch: ${coin0}`);
        if (coin1.toLowerCase() !== String(entry.route.token).toLowerCase()) throw new Error(`Curve coin1 mismatch: ${coin1}`);
        const rawOracle = decodeWord(oracleRow.result);
        if (rawOracle <= 0n) throw new Error('Curve price_oracle returned non-positive value');
        const oracleScale = BigInt(entry.route.oracleScale || UINT256_SCALE);
        if (oracleScale <= 0n) throw new Error('Curve oracle scale must be positive');
        const quotePerToken = Number(rawOracle) / Number(oracleScale);
        if (!(quotePerToken > 0) || !Number.isFinite(quotePerToken)) throw new Error('Curve EMA quote is not finite/positive');
        const dependency = coreObservations?.[entry.route.quoteAssetId];
        const quoteAssetUsd = finite(dependency?.usd);
        const usd = quoteAssetUsd === null ? null : quotePerToken * quoteAssetUsd;
        const canonicalUsd = finite(marketData?.prices?.[entry.assetId]?.usd);
        const diffPct = divergencePct(usd, canonicalUsd);
        const dependencyHealthy = dependency?.status === 'shadow-ok' && quoteAssetUsd !== null;
        const divergent = diffPct !== null && diffPct > Number(entry.route.maxDivergencePct ?? Infinity);
        const invalid = !(usd > 0);
        const status = invalid ? 'dependency-unavailable' : !dependencyHealthy ? 'dependency-warning' : divergent ? 'divergent' : 'shadow-ok';
        const rank = statusRank(status);
        if (rank === 'ok') okCount += 1; else if (rank === 'warning') warningCount += 1; else unavailableCount += 1;
        observations[entry.assetId] = {
          assetId: entry.assetId,
          symbol: entry.asset.symbol || null,
          authority: 'shadow',
          source: CURVE_EMA_ROUTE_TYPE,
          network: networkId,
          chainId: network.chainId,
          pool: entry.route.pool,
          token: entry.route.token,
          quoteToken: entry.route.quoteToken,
          coin0,
          coin1,
          oracleDirection: entry.route.oracleDirection,
          oracleScale: oracleScale.toString(),
          rawPriceOracle: rawOracle.toString(),
          rpcEndpointId: blockResult.endpointId,
          oracleRpcEndpointId: result.endpointId,
          rpcFailoverAttempts: blockResult.attempts.length + result.attempts.length,
          blockNumber,
          blockTag,
          feedValue: quotePerToken,
          feedQuote: entry.route.feedQuote || 'ETH',
          quoteAssetId: entry.route.quoteAssetId,
          quoteAssetUsd,
          outputQuote: entry.route.outputQuote || 'USD',
          composition: `Curve pool price_oracle() EMA × same-cycle ${entry.route.quoteAssetId}/USD`,
          dependencyStatus: dependency?.status || 'missing',
          usd: invalid ? null : usd,
          status,
          canonicalPriceUsd: canonicalUsd,
          divergencePct: diffPct === null ? null : Number(diffPct.toFixed(6)),
          maxDivergencePct: Number(entry.route.maxDivergencePct ?? Infinity),
          productionPriceAuthority: false
        };
      } catch (error) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-call-or-decode-error', error instanceof Error ? error.message : String(error), {
          blockNumber, blockTag, rpcEndpointId: blockResult.endpointId, oracleRpcEndpointId: result.endpointId
        });
        unavailableCount += 1;
      }
    }

    networks[networkId] = {
      chainId: network.chainId,
      rpcEndpointId: blockResult.endpointId,
      blockNumber,
      paidRpcRequired: false,
      routeCount: rows.length,
      batchCallCount: 1 + payload.length,
      httpBatchRequestCount: (blockResult.attempts.length + 1) + (result.attempts.length + 1),
      rpcFailoverAttempts: blockResult.attempts.length + result.attempts.length,
      protocolReadPhases: 2,
      curveEmaRouteCount: rows.length,
      curveEmaOracleBatchCallCount: payload.length,
      curveEmaBlockEndpointId: blockResult.endpointId,
      curveEmaOracleEndpointId: result.endpointId,
      curveEmaBlockTag: blockTag
    };
  }

  return {
    observations,
    networks,
    coverage: { assetCount: entries.length, okCount, warningCount, unavailableCount },
    rpcEfficiency: { networkCount: grouped.size, routeCount: entries.length, httpBatchRequestCount }
  };
}
