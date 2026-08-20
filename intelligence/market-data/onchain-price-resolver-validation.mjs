import assert from 'node:assert/strict';
import {
  resolveOnchainPrices,
  isRetryableRpcError,
  encodeVelodromeGetPool,
  encodeVelodromeQuote,
  encodePythGetPriceUnsafe,
  decodePythPrice
} from './onchain-price-resolver.mjs';

const nowMs = Date.UTC(2026, 7, 19, 20, 30, 0);
const nowSeconds = Math.floor(nowMs / 1000);

function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, '0');
}
function chainlinkRound({ roundId, answer, startedAt, updatedAt, answeredInRound }) {
  return `0x${word(roundId)}${word(answer)}${word(startedAt)}${word(updatedAt)}${word(answeredInRound)}`;
}
function pythPrice({ price, conf, expo, publishTime }) {
  return `0x${word(price)}${word(conf)}${word(expo)}${word(publishTime)}`;
}
function addressResult(address) {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
}

const ETH = '0x0000000000000000000000000000000000000001';
const FXS = '0x0000000000000000000000000000000000000002';
const CVXETH = '0x0000000000000000000000000000000000000003';
const PENDLE = '0x0000000000000000000000000000000000000004';
const VELO_FACTORY = '0x0000000000000000000000000000000000000100';
const VELO = '0x0000000000000000000000000000000000000101';
const WETH = '0x0000000000000000000000000000000000000102';
const VELO_POOL = '0x0000000000000000000000000000000000000103';
const PYTH = '0x0000000000000000000000000000000000000200';
const MODE_PRICE_ID = '0x0386e113cc716a7c6a55decd97b19c90ce080d9f2f5255ac78a0e26889446d1e';

const registry = {
  version: 'validation',
  networks: {
    ethereum: {
      chainId: 1,
      rpcFailover: [
        { id: 'eth-first-rate-limited', url: 'https://eth-first.invalid' },
        { id: 'eth-second-works', url: 'https://eth-second.invalid' }
      ]
    },
    optimism: {
      chainId: 10,
      rpcFailover: [{ id: 'op-works', url: 'https://op.invalid' }]
    },
    mode: {
      chainId: 34443,
      rpcFailover: [{ id: 'mode-works', url: 'https://mode.invalid' }]
    }
  },
  assets: {
    ethereum: {
      assetId: 'ethereum', symbol: 'ETH',
      route: { type: 'chainlink-v3', network: 'ethereum', contract: ETH, quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    'frax-share': {
      assetId: 'frax-share', symbol: 'FXS',
      route: { type: 'chainlink-v3', network: 'ethereum', contract: FXS, quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    'convex-finance': {
      assetId: 'convex-finance', symbol: 'CVX',
      route: { type: 'chainlink-v3-relative', network: 'ethereum', contract: CVXETH, quoteAssetId: 'ethereum', feedQuote: 'ETH', outputQuote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    pendle: {
      assetId: 'pendle', symbol: 'PENDLE',
      route: { type: 'chainlink-v3', network: 'optimism', contract: PENDLE, quote: 'USD', maxAgeSeconds: 7200, maxDivergencePct: 2, authority: 'shadow' }
    },
    'velodrome-finance': {
      assetId: 'velodrome-finance', symbol: 'VELO',
      route: {
        type: 'velodrome-v2-twap-relative', network: 'optimism', factory: VELO_FACTORY,
        token: VELO, quoteToken: WETH, stable: false, tokenDecimals: 18, quoteTokenDecimals: 18,
        amountIn: '1000000000000000000', granularity: 4, observationPeriodSeconds: 1800,
        quoteAssetId: 'ethereum', feedQuote: 'ETH', outputQuote: 'USD', maxDivergencePct: 8, authority: 'shadow'
      }
    },
    mode: {
      assetId: 'mode', symbol: 'MODE',
      route: {
        type: 'pyth-core-readonly', network: 'mode', contract: PYTH, priceId: MODE_PRICE_ID,
        quote: 'USD', maxAgeSeconds: 3600, maxConfidencePct: 5, maxDivergencePct: 8, authority: 'shadow'
      }
    }
  }
};

const marketData = {
  prices: {
    ethereum: { usd: 2000 },
    'frax-share': { usd: 0.30 },
    'convex-finance': { usd: 2 },
    pendle: { usd: 1.40 },
    'velodrome-finance': { usd: 0.10 },
    mode: { usd: 0.002 }
  }
};

let calls = 0;
let sawPinnedVelodromePhase = false;
let sawPythReadonlyCall = false;
const fetchImpl = async (url, options) => {
  calls += 1;
  const payload = JSON.parse(options.body);
  const hasBlockRequest = payload.some(x => x.method === 'eth_blockNumber');

  if (url.includes('eth-first.invalid')) {
    const response = [{ jsonrpc: '2.0', id: 1, result: '0x1000' }];
    for (const req of payload.filter(x => x.method === 'eth_call')) {
      const isDecimals = req.params?.[0]?.data === '0x313ce567';
      if (isDecimals) response.push({ jsonrpc: '2.0', id: req.id, result: `0x${word(8)}` });
      else response.push({ jsonrpc: '2.0', id: req.id, result: chainlinkRound({ roundId: 100n, answer: 200000000000n, startedAt: nowSeconds - 90, updatedAt: nowSeconds - 60, answeredInRound: 100n }) });
    }
    const latestRoundCall = payload.find(x => x.method === 'eth_call' && x.params?.[0]?.data === '0xfeaf968c');
    const index = response.findIndex(row => row.id === latestRoundCall.id);
    response[index] = { jsonrpc: '2.0', id: latestRoundCall.id, error: { code: -32005, message: 'over rate limit' } };
    return { ok: true, status: 200, async json() { return response; } };
  }

  if (url.includes('eth-second.invalid')) {
    assert.equal(hasBlockRequest, true);
    const response = [{ jsonrpc: '2.0', id: 1, result: '0x1000' }];
    for (const req of payload.filter(x => x.method === 'eth_call')) {
      const to = req.params?.[0]?.to;
      const isDecimals = req.params?.[0]?.data === '0x313ce567';
      if (isDecimals) {
        response.push({ jsonrpc: '2.0', id: req.id, result: `0x${word(8)}` });
        continue;
      }
      let answer;
      let roundId;
      if (to === ETH) { answer = 200000000000n; roundId = 100n; }
      else if (to === FXS) { answer = 30000000n; roundId = 200n; }
      else if (to === CVXETH) { answer = 100000n; roundId = 300n; }
      else throw new Error(`Unexpected Ethereum feed ${to}`);
      response.push({ jsonrpc: '2.0', id: req.id, result: chainlinkRound({ roundId, answer, startedAt: nowSeconds - 90, updatedAt: nowSeconds - 60, answeredInRound: roundId }) });
    }
    return { ok: true, status: 200, async json() { return response; } };
  }

  if (url.includes('op.invalid') && hasBlockRequest) {
    const response = [{ jsonrpc: '2.0', id: 1, result: '0x2000' }];
    for (const req of payload.filter(x => x.method === 'eth_call')) {
      const to = req.params?.[0]?.to;
      const data = req.params?.[0]?.data || '';
      if (to === VELO_FACTORY) {
        assert.equal(data, encodeVelodromeGetPool(registry.assets['velodrome-finance'].route));
        response.push({ jsonrpc: '2.0', id: req.id, result: addressResult(VELO_POOL) });
      } else if (to === PENDLE && data === '0x313ce567') {
        response.push({ jsonrpc: '2.0', id: req.id, result: `0x${word(8)}` });
      } else if (to === PENDLE && data === '0xfeaf968c') {
        response.push({ jsonrpc: '2.0', id: req.id, result: chainlinkRound({ roundId: 400n, answer: 140000000n, startedAt: nowSeconds - 90, updatedAt: nowSeconds - 60, answeredInRound: 400n }) });
      } else {
        throw new Error(`Unexpected Optimism phase-1 call ${to} ${data}`);
      }
    }
    return { ok: true, status: 200, async json() { return response; } };
  }

  if (url.includes('op.invalid') && !hasBlockRequest) {
    assert.equal(payload.length, 2, 'VELO phase 2 must be one two-call batch');
    for (const req of payload) assert.equal(req.params?.[1], '0x2000', 'VELO TWAP reads must pin to discovery block');
    const obs = payload.find(x => x.params?.[0]?.data === '0xebeb31db');
    const quote = payload.find(x => x.params?.[0]?.data?.startsWith('0x9e8cc04b'));
    assert.ok(obs && quote, 'VELO phase 2 must contain observationLength + quote');
    assert.equal(quote.params[0].data, encodeVelodromeQuote(registry.assets['velodrome-finance'].route));
    sawPinnedVelodromePhase = true;
    return {
      ok: true, status: 200,
      async json() {
        return [
          { jsonrpc: '2.0', id: obs.id, result: `0x${word(20)}` },
          { jsonrpc: '2.0', id: quote.id, result: `0x${word(50_000_000_000_000n)}` }
        ];
      }
    };
  }

  if (url.includes('mode.invalid')) {
    assert.equal(hasBlockRequest, true, 'Pyth network read must share one block request with its price calls');
    assert.equal(payload.length, 2, 'MODE Pyth route must be one block call + one read-only price call');
    const call = payload.find(x => x.method === 'eth_call');
    assert.ok(call, 'MODE Pyth eth_call missing');
    assert.equal(call.params?.[0]?.to, PYTH);
    assert.equal(call.params?.[0]?.data, encodePythGetPriceUnsafe(MODE_PRICE_ID));
    assert.equal(call.params?.[0]?.data.slice(0, 10), '0x96834ad3');
    sawPythReadonlyCall = true;
    return {
      ok: true, status: 200,
      async json() {
        return [
          { jsonrpc: '2.0', id: 1, result: '0x3000' },
          { jsonrpc: '2.0', id: call.id, result: pythPrice({ price: 200000n, conf: 2000n, expo: -8n, publishTime: nowSeconds - 30 }) }
        ];
      }
    };
  }

  throw new Error(`Unexpected endpoint ${url}`);
};

assert.equal(isRetryableRpcError({ message: 'over rate limit' }), true);
assert.equal(isRetryableRpcError({ message: 'Too Many Requests' }), true);
assert.equal(isRetryableRpcError({ message: 'execution reverted' }), false);
assert.equal(encodePythGetPriceUnsafe(MODE_PRICE_ID), `0x96834ad3${MODE_PRICE_ID.slice(2)}`);
const decodedPyth = decodePythPrice(pythPrice({ price: 200000n, conf: 2000n, expo: -8n, publishTime: nowSeconds - 30 }));
assert.equal(decodedPyth.usd, 0.002);
assert.equal(decodedPyth.confidencePct, 1);

const output = await resolveOnchainPrices({ registry, marketData, fetchImpl, nowMs });
const eth = output.observations.ethereum;
const fxs = output.observations['frax-share'];
const cvx = output.observations['convex-finance'];
const pendle = output.observations.pendle;
const velo = output.observations['velodrome-finance'];
const mode = output.observations.mode;

assert.equal(calls, 5, 'Ethereum retry + Optimism discovery/TWAP + one MODE Pyth batch');
assert.equal(sawPinnedVelodromePhase, true);
assert.equal(sawPythReadonlyCall, true);
assert.equal(output.status, 'ok');
assert.equal(output.mode, 'shadow');
assert.equal(output.version, '0.7-onchain-price-shadow-uniswap-v3-twap');
assert.equal(output.semantics.productionPriceAuthority, false);
assert.equal(output.semantics.paidRpcRequired, false);
assert.equal(output.semantics.networkBatching, true);
assert.equal(output.semantics.maxOneHttpBatchPerNetworkPhasePerAttempt, true);
assert.equal(output.semantics.multiPhaseProtocolReadsAllowed, true);
assert.equal(output.semantics.protocolTwapReadsPinnedToDiscoveryBlock, true);
assert.equal(output.semantics.retryableJsonRpcErrorsTriggerEndpointFailover, true);
assert.equal(output.semantics.pythCoreReadonlyRoutes, true);
assert.equal(output.semantics.pythHermesDependency, false);
assert.equal(output.semantics.pythPriceUpdatesSubmitted, false);
assert.equal(output.semantics.pythPublishTimeFreshnessChecked, true);
assert.equal(output.semantics.pythConfidenceIntervalChecked, true);
assert.equal(output.authority.executionAuthority, 'none');
assert.equal(output.coverage.assetCount, 6);
assert.equal(output.coverage.okCount, 6);
assert.equal(output.coverage.warningCount, 0);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(output.rpcEfficiency.networkCount, 3);
assert.equal(output.rpcEfficiency.routeCount, 6);
assert.equal(output.rpcEfficiency.httpBatchRequestCount, 5);
assert.equal(output.networks.ethereum.routeCount, 3);
assert.equal(output.networks.ethereum.rpcFailoverAttempts, 1);
assert.equal(output.networks.optimism.routeCount, 2);
assert.equal(output.networks.optimism.protocolReadPhases, 2);
assert.equal(output.networks.optimism.httpBatchRequestCount, 2);
assert.equal(output.networks.optimism.protocolTwapBatchCallCount, 2);
assert.equal(output.networks.mode.routeCount, 1);
assert.equal(output.networks.mode.batchCallCount, 2);
assert.equal(output.networks.mode.pythReadonlyBatch, true);
assert.equal(eth.status, 'shadow-ok');
assert.equal(eth.usd, 2000);
assert.equal(fxs.status, 'shadow-ok');
assert.equal(fxs.usd, 0.3);
assert.equal(cvx.status, 'shadow-ok');
assert.equal(cvx.usd, 2);
assert.equal(pendle.status, 'shadow-ok');
assert.equal(pendle.usd, 1.4);
assert.equal(velo.status, 'shadow-ok');
assert.equal(velo.pool.toLowerCase(), VELO_POOL.toLowerCase());
assert.equal(velo.factory, VELO_FACTORY);
assert.equal(velo.observationLength, 20);
assert.equal(velo.granularity, 4);
assert.equal(velo.blockTag, '0x2000');
assert.equal(velo.feedValue, 0.00005);
assert.equal(velo.quoteAssetId, 'ethereum');
assert.equal(velo.quoteAssetUsd, 2000);
assert.equal(velo.usd, 0.1);
assert.equal(velo.divergencePct, 0);
assert.equal(velo.dependencyStatus, 'shadow-ok');
assert.match(velo.composition, /observation TWAP/);
assert.equal(mode.status, 'shadow-ok');
assert.equal(mode.source, 'pyth-core-readonly');
assert.equal(mode.usd, 0.002);
assert.equal(mode.exponent, -8);
assert.equal(mode.feedAgeSeconds, 30);
assert.equal(mode.confidencePct, 1);
assert.equal(mode.divergencePct, 0);
assert.equal(mode.priceId, MODE_PRICE_ID);
assert.equal(mode.productionPriceAuthority, false);

console.log('Onchain Price Resolver Pyth Core readonly validation PASS', {
  routes: output.rpcEfficiency.routeCount,
  networks: output.rpcEfficiency.networkCount,
  httpBatchRequestCount: output.rpcEfficiency.httpBatchRequestCount,
  ethereumFailoverAttempts: output.networks.ethereum.rpcFailoverAttempts,
  optimismProtocolReadPhases: output.networks.optimism.protocolReadPhases,
  veloUsd: velo.usd,
  modeUsd: mode.usd,
  modeConfidencePct: mode.confidencePct,
  pythHermesDependency: output.semantics.pythHermesDependency,
  productionPriceAuthority: false
});