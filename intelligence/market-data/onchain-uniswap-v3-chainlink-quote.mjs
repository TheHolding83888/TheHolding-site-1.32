import { isRetryableRpcError, decodeChainlinkRoundData, decodeUint256 } from './onchain-price-resolver-core.mjs';
import { resolveUniswapV3TwapPrices } from './onchain-uniswap-v3-twap.mjs';

export const UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE = 'uniswap-v3-twap-chainlink-quote';
const RPC_TIMEOUT_MS = 10_000;
const DECIMALS_SELECTOR = '0x313ce567';
const LATEST_ROUND_DATA_SELECTOR = '0xfeaf968c';

function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function statusRank(status) {
  if (status === 'shadow-ok') return 'ok';
  if (['stale-quote-feed', 'invalid-quote-feed', 'divergent', 'dependency-warning'].includes(status)) return 'warning';
  return 'unavailable';
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
  const retryable = payload.map(request => byId.get(request.id)).filter(row => row?.error && isRetryableRpcError(row.error));
  if (retryable.length) {
    const reasons = [...new Set(retryable.map(row => String(row.error?.message || 'retryable RPC error')))];
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

function dependencyError(entry, network, status, error, extra = {}) {
  return {
    assetId: entry.assetId,
    symbol: entry.asset.symbol || null,
    usd: null,
    status,
    authority: 'shadow',
    source: UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE,
    network: entry.route.network,
    chainId: network?.chainId ?? null,
    factory: entry.route.factory,
    token: entry.route.token,
    quoteToken: entry.route.quoteToken,
    quoteFeedContract: entry.route.quoteFeed?.contract || null,
    error,
    productionPriceAuthority: false,
    ...extra
  };
}

function decodeDependency(entry, rows, nowMs) {
  const tokenDecimals = Number(decodeUint256(rows.tokenDecimals.result));
  const quoteTokenDecimals = Number(decodeUint256(rows.quoteTokenDecimals.result));
  const feedDecimals = Number(decodeUint256(rows.feedDecimals.result));
  const round = decodeChainlinkRoundData(rows.feedRound.result);
  const updatedAtSeconds = Number(round.updatedAt);
  const rawAnswer = Number(round.answer);
  const feedValue = Number.isFinite(rawAnswer) ? rawAnswer / 10 ** feedDecimals : null;
  const feedAgeSeconds = Math.max(0, Math.floor(nowMs / 1000) - updatedAtSeconds);
  const maxAgeSeconds = Number(entry.route.quoteFeed?.maxAgeSeconds || 0);
  const invalidDecimals = !Number.isInteger(tokenDecimals) || tokenDecimals < 0 || tokenDecimals > 36 || !Number.isInteger(quoteTokenDecimals) || quoteTokenDecimals < 0 || quoteTokenDecimals > 36 || !Number.isInteger(feedDecimals) || feedDecimals < 0 || feedDecimals > 36;
  const invalidRound = !(feedValue > 0) || !(updatedAtSeconds > 0) || round.answeredInRound < round.roundId;
  const stale = !(maxAgeSeconds > 0) || feedAgeSeconds > maxAgeSeconds;
  return { tokenDecimals, quoteTokenDecimals, feedDecimals, round, updatedAtSeconds, feedValue, feedAgeSeconds, maxAgeSeconds, invalidDecimals, invalidRound, stale };
}

function mergeNetworkTelemetry(baseNetworks, dependencyNetworks) {
  const merged = { ...(baseNetworks || {}) };
  for (const [networkId, dependency] of Object.entries(dependencyNetworks || {})) {
    const base = merged[networkId];
    if (!base) { merged[networkId] = dependency; continue; }
    merged[networkId] = {
      ...base,
      routeCount: Number(base.routeCount || 0) + Number(dependency.routeCount || 0),
      batchCallCount: Number(base.batchCallCount || 0) + Number(dependency.batchCallCount || 0),
      httpBatchRequestCount: Number(base.httpBatchRequestCount || 0) + Number(dependency.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(base.rpcFailoverAttempts || 0) + Number(dependency.rpcFailoverAttempts || 0),
      protocolReadPhases: Math.max(Number(base.protocolReadPhases || 1), 3),
      chainlinkQuoteDependencyRouteCount: dependency.routeCount,
      chainlinkQuoteDependencyEndpointId: dependency.rpcEndpointId,
      chainlinkQuoteDependencyBlockTag: dependency.blockTag,
      onchainTokenDecimalsRead: true
    };
  }
  return merged;
}

export async function resolveUniswapV3ChainlinkQuotePrices({ registry, marketData, fetchImpl = fetch, nowMs = Date.now() }) {
  const entries = Object.entries(registry.assets || {})
    .filter(([, asset]) => asset?.route?.type === UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE)
    .map(([assetId, asset]) => ({ assetId, asset, route: asset.route }));
  const grouped = new Map();
  for (const entry of entries) {
    if (!grouped.has(entry.route.network)) grouped.set(entry.route.network, []);
    grouped.get(entry.route.network).push(entry);
  }

  const dependencyObservations = {};
  const dependencyNetworks = {};
  const eligibleAssets = {};
  const preflightFailures = {};
  let dependencyHttpRequests = 0;

  for (const [networkId, rows] of grouped.entries()) {
    const network = registry.networks?.[networkId];
    if (!network) {
      for (const entry of rows) preflightFailures[entry.assetId] = dependencyError(entry, null, 'network-unavailable', `Network ${networkId} missing`);
      continue;
    }
    const payload = [{ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }];
    const ids = new Map();
    let nextId = 12000;
    for (const entry of rows) {
      const rowIds = { tokenDecimals: nextId++, quoteTokenDecimals: nextId++, feedDecimals: nextId++, feedRound: nextId++ };
      payload.push(
        { jsonrpc: '2.0', id: rowIds.tokenDecimals, method: 'eth_call', params: [{ to: entry.route.token, data: DECIMALS_SELECTOR }, 'latest'] },
        { jsonrpc: '2.0', id: rowIds.quoteTokenDecimals, method: 'eth_call', params: [{ to: entry.route.quoteToken, data: DECIMALS_SELECTOR }, 'latest'] },
        { jsonrpc: '2.0', id: rowIds.feedDecimals, method: 'eth_call', params: [{ to: entry.route.quoteFeed.contract, data: DECIMALS_SELECTOR }, 'latest'] },
        { jsonrpc: '2.0', id: rowIds.feedRound, method: 'eth_call', params: [{ to: entry.route.quoteFeed.contract, data: LATEST_ROUND_DATA_SELECTOR }, 'latest'] }
      );
      ids.set(entry.assetId, rowIds);
    }

    try {
      const result = await withFailover(network, payload, async (...args) => { dependencyHttpRequests += 1; return fetchImpl(...args); });
      const blockRow = result.byId.get(1);
      if (blockRow?.error || !blockRow?.result) throw new Error(blockRow?.error?.message || 'Block result missing');
      const blockTag = blockRow.result;
      const blockNumber = Number(BigInt(blockTag));
      dependencyNetworks[networkId] = {
        chainId: network.chainId,
        rpcEndpointId: result.endpointId,
        blockNumber,
        blockTag,
        paidRpcRequired: false,
        routeCount: rows.length,
        batchCallCount: payload.length,
        httpBatchRequestCount: result.attempts.length + 1,
        rpcFailoverAttempts: result.attempts.length,
        chainlinkQuoteDependencyBatch: true,
        onchainTokenDecimalsRead: true
      };

      for (const entry of rows) {
        const rowIds = ids.get(entry.assetId);
        const fetched = Object.fromEntries(Object.entries(rowIds).map(([name, id]) => [name, result.byId.get(id)]));
        const failed = Object.entries(fetched).find(([, row]) => row?.error || !row?.result);
        if (failed) {
          preflightFailures[entry.assetId] = dependencyError(entry, network, 'quote-dependency-rpc-error', failed[1]?.error?.message || `${failed[0]} result missing`, { rpcEndpointId: result.endpointId, blockNumber, blockTag });
          continue;
        }
        try {
          const decoded = decodeDependency(entry, fetched, nowMs);
          if (decoded.invalidDecimals) {
            preflightFailures[entry.assetId] = dependencyError(entry, network, 'invalid-route-decimals', 'Onchain token/feed decimals invalid', { rpcEndpointId: result.endpointId, blockNumber, blockTag });
            continue;
          }
          if (decoded.invalidRound) {
            preflightFailures[entry.assetId] = dependencyError(entry, network, 'invalid-quote-feed', 'Chainlink quote feed round invalid', { rpcEndpointId: result.endpointId, blockNumber, blockTag, quoteFeedAgeSeconds: decoded.feedAgeSeconds });
            continue;
          }
          if (decoded.stale) {
            preflightFailures[entry.assetId] = dependencyError(entry, network, 'stale-quote-feed', `Chainlink quote feed stale: ${decoded.feedAgeSeconds}s > ${decoded.maxAgeSeconds}s`, { rpcEndpointId: result.endpointId, blockNumber, blockTag, quoteFeedAgeSeconds: decoded.feedAgeSeconds, quoteFeedUpdatedAt: new Date(decoded.updatedAtSeconds * 1000).toISOString() });
            continue;
          }
          const dependencyId = entry.route.quoteAssetId;
          dependencyObservations[dependencyId] = {
            assetId: dependencyId,
            symbol: entry.route.feedQuote || null,
            usd: decoded.feedValue,
            status: 'shadow-ok',
            authority: 'shadow',
            source: 'chainlink-v3-quote-dependency',
            network: networkId,
            chainId: network.chainId,
            contract: entry.route.quoteFeed.contract,
            decimals: decoded.feedDecimals,
            feedAgeSeconds: decoded.feedAgeSeconds,
            maxAgeSeconds: decoded.maxAgeSeconds,
            updatedAt: new Date(decoded.updatedAtSeconds * 1000).toISOString(),
            productionPriceAuthority: false
          };
          eligibleAssets[entry.assetId] = {
            ...entry.asset,
            route: {
              ...entry.route,
              type: 'uniswap-v3-twap-relative',
              tokenDecimals: decoded.tokenDecimals,
              quoteTokenDecimals: decoded.quoteTokenDecimals
            }
          };
        } catch (error) {
          preflightFailures[entry.assetId] = dependencyError(entry, network, 'quote-dependency-decode-error', error instanceof Error ? error.message : String(error), { rpcEndpointId: result.endpointId, blockNumber, blockTag });
        }
      }
    } catch (error) {
      for (const entry of rows) preflightFailures[entry.assetId] = dependencyError(entry, network, 'quote-dependency-rpc-unavailable', error instanceof Error ? error.message : String(error));
    }
  }

  let v3 = { observations: {}, networks: {}, coverage: { assetCount: 0, okCount: 0, warningCount: 0, unavailableCount: 0 }, rpcEfficiency: { networkCount: 0, routeCount: 0, httpBatchRequestCount: 0 } };
  if (Object.keys(eligibleAssets).length) {
    v3 = await resolveUniswapV3TwapPrices({
      registry: { ...registry, assets: eligibleAssets },
      marketData,
      coreObservations: dependencyObservations,
      fetchImpl
    });
  }

  const observations = { ...preflightFailures };
  for (const [assetId, observation] of Object.entries(v3.observations || {})) {
    const original = registry.assets?.[assetId]?.route;
    const dependency = dependencyObservations[original?.quoteAssetId];
    observations[assetId] = {
      ...observation,
      source: UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE,
      quoteFeedContract: original?.quoteFeed?.contract || null,
      quoteFeedUsd: finite(dependency?.usd),
      quoteFeedAgeSeconds: dependency?.feedAgeSeconds ?? null,
      quoteDependencySource: dependency?.source || null,
      composition: `Uniswap V3 ${original?.twapWindowSeconds}s geometric TWAP × same-cycle Chainlink ${original?.feedQuote || 'quote'}/USD`,
      productionPriceAuthority: false
    };
  }

  let okCount = 0, warningCount = 0, unavailableCount = 0;
  for (const observation of Object.values(observations)) {
    const rank = statusRank(observation.status);
    if (rank === 'ok') okCount += 1; else if (rank === 'warning') warningCount += 1; else unavailableCount += 1;
  }
  const networks = mergeNetworkTelemetry(v3.networks, dependencyNetworks);
  return {
    observations,
    networks,
    coverage: { assetCount: entries.length, okCount, warningCount, unavailableCount },
    rpcEfficiency: {
      networkCount: new Set([...Object.keys(v3.networks || {}), ...Object.keys(dependencyNetworks)]).size,
      routeCount: entries.length,
      httpBatchRequestCount: Number(v3.rpcEfficiency?.httpBatchRequestCount || 0) + dependencyHttpRequests
    }
  };
}
