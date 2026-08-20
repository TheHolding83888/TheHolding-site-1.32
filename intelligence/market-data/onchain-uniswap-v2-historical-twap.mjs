import { isRetryableRpcError } from './onchain-price-resolver-core.mjs';

export const UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE = 'uniswap-v2-historical-twap-relative';
const RPC_TIMEOUT_MS = 10_000;
const TOKEN0_SELECTOR = '0dfe1681';
const TOKEN1_SELECTOR = 'd21220a7';
const GET_RESERVES_SELECTOR = '0902f1ac';
const PRICE0_CUMULATIVE_SELECTOR = '5909c0d5';
const PRICE1_CUMULATIVE_SELECTOR = '5a3d5493';
const Q112 = 1n << 112n;
const UINT256_MOD = 1n << 256n;
const UINT32_MOD = 1n << 32n;

function strip0x(value) { return String(value || '').replace(/^0x/, ''); }
function decodeWord(hex, index) {
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
function decodeReserves(hex) {
  const reserve0 = decodeWord(hex, 0);
  const reserve1 = decodeWord(hex, 1);
  const blockTimestampLast = Number(decodeWord(hex, 2) & (UINT32_MOD - 1n));
  return { reserve0, reserve1, blockTimestampLast };
}
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function divergencePct(onchainUsd, canonicalUsd) {
  if (!(onchainUsd >= 0) || !(canonicalUsd > 0)) return null;
  return Math.abs(onchainUsd - canonicalUsd) / canonicalUsd * 100;
}
function statusRank(status) {
  if (status === 'shadow-ok') return 'ok';
  if (['invalid', 'divergent', 'dependency-warning'].includes(status)) return 'warning';
  return 'unavailable';
}
function rpcQuantity(value) { return `0x${BigInt(value).toString(16)}`; }
function blockTimestamp(row) {
  const value = row?.result?.timestamp;
  if (typeof value !== 'string' || !/^0x[0-9a-f]+$/i.test(value)) throw new Error('Block timestamp missing');
  const n = Number(BigInt(value));
  if (!Number.isSafeInteger(n) || n <= 0) throw new Error(`Invalid block timestamp: ${value}`);
  return n;
}
function elapsedUint32(blockTimestampSeconds, reserveTimestampLast) {
  const current = BigInt(blockTimestampSeconds) & (UINT32_MOD - 1n);
  const last = BigInt(reserveTimestampLast) & (UINT32_MOD - 1n);
  return (current - last + UINT32_MOD) % UINT32_MOD;
}
function counterfactualCumulative({ cumulative, reserves, blockTimestampSeconds, baseIsToken0 }) {
  const baseReserve = baseIsToken0 ? reserves.reserve0 : reserves.reserve1;
  const quoteReserve = baseIsToken0 ? reserves.reserve1 : reserves.reserve0;
  if (baseReserve <= 0n || quoteReserve <= 0n) throw new Error('Uniswap V2 pair has zero reserve');
  const elapsed = elapsedUint32(blockTimestampSeconds, reserves.blockTimestampLast);
  const priceUq = (quoteReserve << 112n) / baseReserve;
  return (cumulative + priceUq * elapsed) % UINT256_MOD;
}
function modularDelta(current, previous) { return (current - previous + UINT256_MOD) % UINT256_MOD; }

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

function routeError(entry, network, status, error, extra = {}) {
  return {
    assetId: entry.assetId,
    symbol: entry.asset.symbol || null,
    usd: null,
    status,
    authority: 'shadow',
    source: UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE,
    network: entry.route.network,
    chainId: network?.chainId ?? null,
    pair: entry.route.pair,
    token: entry.route.token,
    quoteToken: entry.route.quoteToken,
    lookbackBlocks: entry.route.lookbackBlocks,
    minTwapWindowSeconds: entry.route.minTwapWindowSeconds,
    maxTwapWindowSeconds: entry.route.maxTwapWindowSeconds,
    error,
    productionPriceAuthority: false,
    ...extra
  };
}

export async function resolveUniswapV2HistoricalTwapPrices({ registry, marketData, coreObservations, fetchImpl = fetch }) {
  const entries = Object.entries(registry.assets || {})
    .filter(([, asset]) => asset?.route?.type === UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE)
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
        observations[entry.assetId] = routeError(entry, null, 'network-unavailable', `Network ${networkId} missing`);
        unavailableCount += 1;
      }
      continue;
    }

    const phase1Payload = [{ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }];
    let phase1;
    try {
      phase1 = await withFailover(network, phase1Payload, async (...args) => {
        httpBatchRequestCount += 1;
        return fetchImpl(...args);
      });
    } catch (error) {
      for (const entry of rows) {
        observations[entry.assetId] = routeError(entry, network, 'rpc-unavailable', error instanceof Error ? error.message : String(error));
        unavailableCount += 1;
      }
      continue;
    }

    const blockRow = phase1.byId.get(1);
    if (blockRow?.error || !blockRow?.result) {
      for (const entry of rows) {
        observations[entry.assetId] = routeError(entry, network, 'rpc-call-or-decode-error', blockRow?.error?.message || 'Block result missing', { rpcEndpointId: phase1.endpointId });
        unavailableCount += 1;
      }
      continue;
    }
    const currentBlockNumber = Number(BigInt(blockRow.result));
    if (!Number.isSafeInteger(currentBlockNumber) || currentBlockNumber <= 0) throw new Error(`Invalid current block: ${blockRow.result}`);
    const currentBlockTag = rpcQuantity(currentBlockNumber);

    const phase2Payload = [];
    let nextId = 9000;
    const currentBlockId = nextId++;
    phase2Payload.push({ jsonrpc: '2.0', id: currentBlockId, method: 'eth_getBlockByNumber', params: [currentBlockTag, false] });
    const historicalBlockIds = new Map();
    const routeIds = new Map();

    for (const entry of rows) {
      const lookbackBlocks = Number(entry.route.lookbackBlocks);
      if (!Number.isInteger(lookbackBlocks) || lookbackBlocks <= 0 || lookbackBlocks >= currentBlockNumber) {
        observations[entry.assetId] = routeError(entry, network, 'invalid-route-config', `Invalid lookbackBlocks: ${entry.route.lookbackBlocks}`, { rpcEndpointId: phase1.endpointId, blockNumber: currentBlockNumber });
        unavailableCount += 1;
        continue;
      }
      const historicalBlockNumber = currentBlockNumber - lookbackBlocks;
      const historicalBlockTag = rpcQuantity(historicalBlockNumber);
      let historicalBlockId = historicalBlockIds.get(historicalBlockTag);
      if (!historicalBlockId) {
        historicalBlockId = nextId++;
        historicalBlockIds.set(historicalBlockTag, historicalBlockId);
        phase2Payload.push({ jsonrpc: '2.0', id: historicalBlockId, method: 'eth_getBlockByNumber', params: [historicalBlockTag, false] });
      }
      const ids = {
        token0: nextId++, token1: nextId++, currentReserves: nextId++, currentPrice0: nextId++, currentPrice1: nextId++,
        historicalReserves: nextId++, historicalPrice0: nextId++, historicalPrice1: nextId++
      };
      phase2Payload.push(
        { jsonrpc: '2.0', id: ids.token0, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${TOKEN0_SELECTOR}` }, currentBlockTag] },
        { jsonrpc: '2.0', id: ids.token1, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${TOKEN1_SELECTOR}` }, currentBlockTag] },
        { jsonrpc: '2.0', id: ids.currentReserves, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${GET_RESERVES_SELECTOR}` }, currentBlockTag] },
        { jsonrpc: '2.0', id: ids.currentPrice0, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${PRICE0_CUMULATIVE_SELECTOR}` }, currentBlockTag] },
        { jsonrpc: '2.0', id: ids.currentPrice1, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${PRICE1_CUMULATIVE_SELECTOR}` }, currentBlockTag] },
        { jsonrpc: '2.0', id: ids.historicalReserves, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${GET_RESERVES_SELECTOR}` }, historicalBlockTag] },
        { jsonrpc: '2.0', id: ids.historicalPrice0, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${PRICE0_CUMULATIVE_SELECTOR}` }, historicalBlockTag] },
        { jsonrpc: '2.0', id: ids.historicalPrice1, method: 'eth_call', params: [{ to: entry.route.pair, data: `0x${PRICE1_CUMULATIVE_SELECTOR}` }, historicalBlockTag] }
      );
      routeIds.set(entry.assetId, { ids, historicalBlockId, historicalBlockNumber, historicalBlockTag });
    }

    let phase2 = null;
    let phase2HttpRequestCount = 0;
    if (phase2Payload.length > 1) {
      try {
        phase2 = await withFailover(network, phase2Payload, async (...args) => {
          httpBatchRequestCount += 1;
          phase2HttpRequestCount += 1;
          return fetchImpl(...args);
        });
      } catch (error) {
        for (const entry of rows) {
          if (observations[entry.assetId]) continue;
          observations[entry.assetId] = routeError(entry, network, 'rpc-unavailable', error instanceof Error ? error.message : String(error), {
            rpcEndpointId: phase1.endpointId, blockNumber: currentBlockNumber, blockTag: currentBlockTag
          });
          unavailableCount += 1;
        }
      }
    }

    if (phase2) {
      for (const entry of rows) {
        if (observations[entry.assetId]) continue;
        const info = routeIds.get(entry.assetId);
        if (!info) continue;
        const currentBlock = phase2.byId.get(currentBlockId);
        const historicalBlock = phase2.byId.get(info.historicalBlockId);
        const namedRows = Object.fromEntries(Object.entries(info.ids).map(([name, id]) => [name, phase2.byId.get(id)]));
        const failed = [currentBlock, historicalBlock, ...Object.values(namedRows)].find(row => row?.error || !row?.result);
        if (failed) {
          observations[entry.assetId] = routeError(entry, network, 'rpc-call-or-decode-error', failed?.error?.message || 'Historical TWAP result missing', {
            rpcEndpointId: phase1.endpointId, twapRpcEndpointId: phase2.endpointId,
            rpcFailoverAttempts: phase1.attempts.length + phase2.attempts.length,
            blockNumber: currentBlockNumber, blockTag: currentBlockTag,
            historicalBlockNumber: info.historicalBlockNumber, historicalBlockTag: info.historicalBlockTag
          });
          unavailableCount += 1;
          continue;
        }

        try {
          const token0 = decodeAddress(namedRows.token0.result);
          const token1 = decodeAddress(namedRows.token1.result);
          const expected = new Set([entry.route.token.toLowerCase(), entry.route.quoteToken.toLowerCase()]);
          const actual = new Set([token0.toLowerCase(), token1.toLowerCase()]);
          if (expected.size !== actual.size || [...expected].some(x => !actual.has(x))) throw new Error(`Pair token mismatch: ${token0}/${token1}`);
          const baseIsToken0 = token0.toLowerCase() === entry.route.token.toLowerCase();
          const currentTimestamp = blockTimestamp(currentBlock);
          const historicalTimestamp = blockTimestamp(historicalBlock);
          const effectiveWindowSeconds = currentTimestamp - historicalTimestamp;
          const minWindow = Number(entry.route.minTwapWindowSeconds);
          const maxWindow = Number(entry.route.maxTwapWindowSeconds);
          if (!Number.isInteger(effectiveWindowSeconds) || effectiveWindowSeconds <= 0) throw new Error(`Invalid historical TWAP window: ${effectiveWindowSeconds}`);
          if (!(minWindow > 0) || effectiveWindowSeconds < minWindow) throw new Error(`Historical TWAP window too short: ${effectiveWindowSeconds} < ${minWindow}`);
          if (Number.isFinite(maxWindow) && maxWindow > 0 && effectiveWindowSeconds > maxWindow) throw new Error(`Historical TWAP window too long: ${effectiveWindowSeconds} > ${maxWindow}`);

          const currentReserves = decodeReserves(namedRows.currentReserves.result);
          const historicalReserves = decodeReserves(namedRows.historicalReserves.result);
          const currentStoredCumulative = decodeWord(baseIsToken0 ? namedRows.currentPrice0.result : namedRows.currentPrice1.result, 0);
          const historicalStoredCumulative = decodeWord(baseIsToken0 ? namedRows.historicalPrice0.result : namedRows.historicalPrice1.result, 0);
          const currentCumulative = counterfactualCumulative({ cumulative: currentStoredCumulative, reserves: currentReserves, blockTimestampSeconds: currentTimestamp, baseIsToken0 });
          const historicalCumulative = counterfactualCumulative({ cumulative: historicalStoredCumulative, reserves: historicalReserves, blockTimestampSeconds: historicalTimestamp, baseIsToken0 });
          const delta = modularDelta(currentCumulative, historicalCumulative);
          const averageUq = delta / BigInt(effectiveWindowSeconds);
          if (averageUq <= 0n) throw new Error('Historical TWAP cumulative delta is zero');
          const decimalScale = 10 ** (Number(entry.route.tokenDecimals ?? 18) - Number(entry.route.quoteTokenDecimals ?? 18));
          const quotePerToken = (Number(averageUq) / 2 ** 112) * decimalScale;
          if (!(quotePerToken > 0) || !Number.isFinite(quotePerToken)) throw new Error('Historical TWAP quote is not finite/positive');

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
            source: UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE,
            network: networkId,
            chainId: network.chainId,
            pair: entry.route.pair,
            token: entry.route.token,
            quoteToken: entry.route.quoteToken,
            token0,
            token1,
            rpcEndpointId: phase1.endpointId,
            twapRpcEndpointId: phase2.endpointId,
            rpcFailoverAttempts: phase1.attempts.length + phase2.attempts.length,
            blockNumber: currentBlockNumber,
            blockTag: currentBlockTag,
            historicalBlockNumber: info.historicalBlockNumber,
            historicalBlockTag: info.historicalBlockTag,
            lookbackBlocks: Number(entry.route.lookbackBlocks),
            currentBlockTimestamp: currentTimestamp,
            historicalBlockTimestamp: historicalTimestamp,
            effectiveTwapWindowSeconds: effectiveWindowSeconds,
            minTwapWindowSeconds: minWindow,
            maxTwapWindowSeconds: Number.isFinite(maxWindow) ? maxWindow : null,
            baseIsToken0,
            currentReserve0Raw: currentReserves.reserve0.toString(),
            currentReserve1Raw: currentReserves.reserve1.toString(),
            feedValue: quotePerToken,
            feedQuote: entry.route.feedQuote || 'ETH',
            quoteAssetId: entry.route.quoteAssetId,
            quoteAssetUsd,
            outputQuote: entry.route.outputQuote || 'USD',
            composition: `Uniswap V2 cumulative-price historical TWAP (${effectiveWindowSeconds}s) × same-cycle ${entry.route.quoteAssetId}/USD`,
            dependencyStatus: dependency?.status || 'missing',
            usd: invalid ? null : usd,
            status,
            canonicalPriceUsd: canonicalUsd,
            divergencePct: diffPct === null ? null : Number(diffPct.toFixed(6)),
            maxDivergencePct: Number(entry.route.maxDivergencePct ?? Infinity),
            productionPriceAuthority: false
          };
        } catch (error) {
          observations[entry.assetId] = routeError(entry, network, 'rpc-call-or-decode-error', error instanceof Error ? error.message : String(error), {
            rpcEndpointId: phase1.endpointId, twapRpcEndpointId: phase2.endpointId,
            rpcFailoverAttempts: phase1.attempts.length + phase2.attempts.length,
            blockNumber: currentBlockNumber, blockTag: currentBlockTag,
            historicalBlockNumber: info.historicalBlockNumber, historicalBlockTag: info.historicalBlockTag
          });
          unavailableCount += 1;
        }
      }
    }

    networks[networkId] = {
      chainId: network.chainId,
      rpcEndpointId: phase1.endpointId,
      blockNumber: currentBlockNumber,
      paidRpcRequired: false,
      routeCount: rows.length,
      batchCallCount: phase1Payload.length + phase2Payload.length,
      httpBatchRequestCount: phase1.attempts.length + 1 + phase2HttpRequestCount,
      rpcFailoverAttempts: phase1.attempts.length + Math.max(0, phase2HttpRequestCount - (phase2Payload.length > 1 ? 1 : 0)),
      protocolReadPhases: phase2Payload.length > 1 ? 2 : 1,
      uniswapV2HistoricalTwapRouteCount: rows.length,
      uniswapV2HistoricalTwapBatchCallCount: phase2Payload.length,
      uniswapV2BlockEndpointId: phase1.endpointId,
      uniswapV2HistoricalTwapEndpointId: phase2?.endpointId || null,
      uniswapV2CurrentBlockTag: currentBlockTag,
      historicalStateReads: true
    };
  }

  return {
    observations,
    networks,
    coverage: { assetCount: entries.length, okCount, warningCount, unavailableCount },
    rpcEfficiency: { networkCount: grouped.size, routeCount: entries.length, httpBatchRequestCount }
  };
}

export const UNISWAP_V2_HISTORICAL_TWAP_SELECTORS = {
  token0: `0x${TOKEN0_SELECTOR}`,
  token1: `0x${TOKEN1_SELECTOR}`,
  getReserves: `0x${GET_RESERVES_SELECTOR}`,
  price0CumulativeLast: `0x${PRICE0_CUMULATIVE_SELECTOR}`,
  price1CumulativeLast: `0x${PRICE1_CUMULATIVE_SELECTOR}`
};
