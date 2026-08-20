import { isRetryableRpcError } from './onchain-price-resolver-core.mjs';

export const UNISWAP_V3_TWAP_ROUTE_TYPE = 'uniswap-v3-twap-relative';
const RPC_TIMEOUT_MS = 10_000;
const GET_POOL_SELECTOR = '1698ee82';
const TOKEN0_SELECTOR = '0dfe1681';
const TOKEN1_SELECTOR = 'd21220a7';
const LIQUIDITY_SELECTOR = '1a686502';
const OBSERVE_SELECTOR = '883bdbfd';
const UINT256_MOD = 1n << 256n;
const INT256_SIGN = 1n << 255n;
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

function strip0x(value) { return String(value || '').replace(/^0x/, ''); }
function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = UINT256_MOD + n;
  return n.toString(16).padStart(64, '0');
}
function addressWord(value) {
  const clean = strip0x(value).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(clean)) throw new Error(`Invalid address: ${value}`);
  return clean.padStart(64, '0');
}
function signedInt256(value) { return value >= INT256_SIGN ? value - UINT256_MOD : value; }
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

export function encodeUniswapV3GetPool(route) {
  const fee = Number(route?.fee);
  if (!Number.isInteger(fee) || fee < 0 || fee > 0xffffff) throw new Error(`Invalid Uniswap V3 fee: ${route?.fee}`);
  return `0x${GET_POOL_SELECTOR}${addressWord(route.token)}${addressWord(route.quoteToken)}${word(fee)}`;
}

export function encodeUniswapV3Observe(secondsAgo) {
  const seconds = Number(secondsAgo);
  if (!Number.isInteger(seconds) || seconds <= 0 || seconds > 0xffffffff) throw new Error(`Invalid TWAP window: ${secondsAgo}`);
  return `0x${OBSERVE_SELECTOR}${word(32)}${word(2)}${word(seconds)}${word(0)}`;
}

export function decodeUniswapV3Observe(hex) {
  const clean = strip0x(hex);
  if (clean.length < 128) throw new Error('Uniswap V3 observe result too short');
  const tickOffsetBytes = Number(decodeWord(hex, 0));
  if (!Number.isSafeInteger(tickOffsetBytes) || tickOffsetBytes < 0 || tickOffsetBytes % 32 !== 0) throw new Error('Invalid tick array offset');
  const tickOffsetWord = tickOffsetBytes / 32;
  const tickLength = Number(decodeWord(hex, tickOffsetWord));
  if (tickLength < 2) throw new Error(`Expected at least 2 tick cumulatives, got ${tickLength}`);
  const values = [];
  for (let i = 0; i < tickLength; i += 1) values.push(signedInt256(decodeWord(hex, tickOffsetWord + 1 + i)));
  return values;
}

export function arithmeticMeanTick(tickCumulatives, secondsAgo) {
  if (!Array.isArray(tickCumulatives) || tickCumulatives.length < 2) throw new Error('Need two tick cumulatives');
  const seconds = BigInt(secondsAgo);
  if (seconds <= 0n) throw new Error('TWAP window must be positive');
  const delta = BigInt(tickCumulatives[1]) - BigInt(tickCumulatives[0]);
  let mean = delta / seconds;
  if (delta < 0n && delta % seconds !== 0n) mean -= 1n;
  const numeric = Number(mean);
  if (!Number.isSafeInteger(numeric) || numeric < -887272 || numeric > 887272) throw new Error(`Mean tick out of bounds: ${mean}`);
  return numeric;
}

export function quoteRatioAtTick({ tick, token, quoteToken, tokenDecimals = 18, quoteTokenDecimals = 18 }) {
  if (!Number.isInteger(tick) || tick < -887272 || tick > 887272) throw new Error(`Tick out of bounds: ${tick}`);
  const tokenLower = String(token).toLowerCase();
  const quoteLower = String(quoteToken).toLowerCase();
  if (tokenLower === quoteLower) throw new Error('Token and quote token must differ');
  const token0IsBase = tokenLower < quoteLower;
  const rawToken1PerToken0 = Math.exp(tick * Math.log(1.0001));
  const decimalScale = 10 ** (Number(tokenDecimals) - Number(quoteTokenDecimals));
  const quotePerToken = token0IsBase
    ? rawToken1PerToken0 * decimalScale
    : (1 / rawToken1PerToken0) * decimalScale;
  if (!(quotePerToken > 0) || !Number.isFinite(quotePerToken)) throw new Error('Uniswap V3 TWAP quote is not finite/positive');
  return quotePerToken;
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
    source: UNISWAP_V3_TWAP_ROUTE_TYPE,
    network: entry.route.network,
    chainId: network?.chainId ?? null,
    factory: entry.route.factory,
    token: entry.route.token,
    quoteToken: entry.route.quoteToken,
    fee: entry.route.fee,
    twapWindowSeconds: entry.route.twapWindowSeconds,
    error,
    productionPriceAuthority: false,
    ...extra
  };
}

export async function resolveUniswapV3TwapPrices({ registry, marketData, coreObservations, fetchImpl = fetch }) {
  const entries = Object.entries(registry.assets || {})
    .filter(([, asset]) => asset?.route?.type === UNISWAP_V3_TWAP_ROUTE_TYPE)
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

    const discoveryPayload = [{ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }];
    const discoveryIds = new Map();
    let nextId = 8000;
    for (const entry of rows) {
      const id = nextId++;
      discoveryPayload.push({ jsonrpc: '2.0', id, method: 'eth_call', params: [{ to: entry.route.factory, data: encodeUniswapV3GetPool(entry.route) }, 'latest'] });
      discoveryIds.set(entry.assetId, id);
    }

    let discovery;
    try {
      discovery = await withFailover(network, discoveryPayload, async (...args) => {
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

    const blockRow = discovery.byId.get(1);
    if (blockRow?.error || !blockRow?.result) {
      for (const entry of rows) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-call-or-decode-error', blockRow?.error?.message || 'Block result missing', { rpcEndpointId: discovery.endpointId });
        unavailableCount += 1;
      }
      continue;
    }
    const blockNumber = Number(BigInt(blockRow.result));
    const blockTag = blockRow.result;

    const phase2Payload = [];
    const phase2 = new Map();
    const discovered = [];
    for (const entry of rows) {
      const row = discovery.byId.get(discoveryIds.get(entry.assetId));
      if (row?.error || !row?.result) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'pool-discovery-error', row?.error?.message || 'Pool discovery result missing', { rpcEndpointId: discovery.endpointId, blockNumber, blockTag });
        unavailableCount += 1;
        continue;
      }
      let pool;
      try { pool = decodeAddress(row.result); }
      catch (error) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'pool-discovery-error', error instanceof Error ? error.message : String(error), { rpcEndpointId: discovery.endpointId, blockNumber, blockTag });
        unavailableCount += 1;
        continue;
      }
      if (pool.toLowerCase() === ZERO_ADDRESS) {
        observations[entry.assetId] = routeErrorObservation(entry, network, 'pool-not-found', 'Uniswap V3 Factory returned zero address', { rpcEndpointId: discovery.endpointId, blockNumber, blockTag });
        unavailableCount += 1;
        continue;
      }
      const ids = { token0: nextId++, token1: nextId++, liquidity: nextId++, observe: nextId++ };
      phase2Payload.push(
        { jsonrpc: '2.0', id: ids.token0, method: 'eth_call', params: [{ to: pool, data: `0x${TOKEN0_SELECTOR}` }, blockTag] },
        { jsonrpc: '2.0', id: ids.token1, method: 'eth_call', params: [{ to: pool, data: `0x${TOKEN1_SELECTOR}` }, blockTag] },
        { jsonrpc: '2.0', id: ids.liquidity, method: 'eth_call', params: [{ to: pool, data: `0x${LIQUIDITY_SELECTOR}` }, blockTag] },
        { jsonrpc: '2.0', id: ids.observe, method: 'eth_call', params: [{ to: pool, data: encodeUniswapV3Observe(entry.route.twapWindowSeconds) }, blockTag] }
      );
      phase2.set(entry.assetId, { ids, pool });
      discovered.push(entry);
    }

    let twap = null;
    let phase2HttpRequestCount = 0;
    if (phase2Payload.length) {
      try {
        twap = await withFailover(network, phase2Payload, async (...args) => {
          httpBatchRequestCount += 1;
          phase2HttpRequestCount += 1;
          return fetchImpl(...args);
        });
      } catch (error) {
        for (const entry of discovered) {
          if (observations[entry.assetId]) continue;
          observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-unavailable', error instanceof Error ? error.message : String(error), { rpcEndpointId: discovery.endpointId, blockNumber, blockTag, pool: phase2.get(entry.assetId)?.pool });
          unavailableCount += 1;
        }
      }
    }

    if (twap) {
      for (const entry of discovered) {
        if (observations[entry.assetId]) continue;
        const info = phase2.get(entry.assetId);
        const rowsByKind = Object.fromEntries(Object.entries(info.ids).map(([kind, id]) => [kind, twap.byId.get(id)]));
        const failed = Object.entries(rowsByKind).find(([, row]) => row?.error || !row?.result);
        if (failed) {
          observations[entry.assetId] = routeErrorObservation(entry, network, 'rpc-call-or-decode-error', failed[1]?.error?.message || `${failed[0]} result missing`, {
            rpcEndpointId: discovery.endpointId, twapRpcEndpointId: twap.endpointId,
            rpcFailoverAttempts: discovery.attempts.length + twap.attempts.length,
            blockNumber, blockTag, pool: info.pool
          });
          unavailableCount += 1;
          continue;
        }
        try {
          const token0 = decodeAddress(rowsByKind.token0.result);
          const token1 = decodeAddress(rowsByKind.token1.result);
          const expected = new Set([entry.route.token.toLowerCase(), entry.route.quoteToken.toLowerCase()]);
          const actual = new Set([token0.toLowerCase(), token1.toLowerCase()]);
          if (expected.size !== actual.size || [...expected].some(x => !actual.has(x))) throw new Error(`Pool token mismatch: ${token0}/${token1}`);
          const liquidity = decodeWord(rowsByKind.liquidity.result, 0);
          if (liquidity <= 0n) throw new Error('Pool has zero active liquidity');
          const tickCumulatives = decodeUniswapV3Observe(rowsByKind.observe.result);
          const meanTick = arithmeticMeanTick(tickCumulatives, entry.route.twapWindowSeconds);
          const quotePerToken = quoteRatioAtTick({
            tick: meanTick,
            token: entry.route.token,
            quoteToken: entry.route.quoteToken,
            tokenDecimals: entry.route.tokenDecimals,
            quoteTokenDecimals: entry.route.quoteTokenDecimals
          });
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
            source: UNISWAP_V3_TWAP_ROUTE_TYPE,
            network: networkId,
            chainId: network.chainId,
            factory: entry.route.factory,
            pool: info.pool,
            token: entry.route.token,
            quoteToken: entry.route.quoteToken,
            fee: Number(entry.route.fee),
            rpcEndpointId: discovery.endpointId,
            twapRpcEndpointId: twap.endpointId,
            rpcFailoverAttempts: discovery.attempts.length + twap.attempts.length,
            blockNumber,
            blockTag,
            token0,
            token1,
            activeLiquidityRaw: liquidity.toString(),
            twapWindowSeconds: Number(entry.route.twapWindowSeconds),
            arithmeticMeanTick: meanTick,
            feedValue: quotePerToken,
            feedQuote: entry.route.feedQuote || 'ETH',
            quoteAssetId: entry.route.quoteAssetId,
            quoteAssetUsd,
            outputQuote: entry.route.outputQuote || 'USD',
            composition: `Uniswap V3 ${entry.route.twapWindowSeconds}s geometric TWAP × same-cycle ${entry.route.quoteAssetId}/USD`,
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
            rpcEndpointId: discovery.endpointId, twapRpcEndpointId: twap.endpointId,
            rpcFailoverAttempts: discovery.attempts.length + twap.attempts.length,
            blockNumber, blockTag, pool: info.pool
          });
          unavailableCount += 1;
        }
      }
    }

    networks[networkId] = {
      chainId: network.chainId,
      rpcEndpointId: discovery.endpointId,
      blockNumber,
      paidRpcRequired: false,
      routeCount: rows.length,
      batchCallCount: discoveryPayload.length,
      httpBatchRequestCount: (discovery.attempts.length + 1) + phase2HttpRequestCount,
      rpcFailoverAttempts: discovery.attempts.length + Math.max(0, phase2HttpRequestCount - (phase2Payload.length ? 1 : 0)),
      protocolReadPhases: phase2Payload.length ? 2 : 1,
      uniswapV3TwapRouteCount: rows.length,
      uniswapV3DiscoveryBatchCallCount: discoveryPayload.length,
      uniswapV3TwapBatchCallCount: phase2Payload.length,
      uniswapV3DiscoveryEndpointId: discovery.endpointId,
      uniswapV3TwapEndpointId: twap?.endpointId || null,
      uniswapV3BlockTag: blockTag
    };
  }

  return {
    observations,
    networks,
    coverage: { assetCount: entries.length, okCount, warningCount, unavailableCount },
    rpcEfficiency: { networkCount: grouped.size, routeCount: entries.length, httpBatchRequestCount }
  };
}
