import assert from 'node:assert/strict';
import {
  resolveUniswapV3TwapPrices,
  encodeUniswapV3GetPool,
  encodeUniswapV3Observe,
  decodeUniswapV3Observe,
  arithmeticMeanTick,
  quoteRatioAtTick
} from './onchain-uniswap-v3-twap.mjs';

const YB = '0x01791f726b4103694969820be083196cc7c045ff';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const FACTORY = '0x1F98431c8aD98523631AE4a59f267346ea31F984';
const POOL = '0x6F582CF72ea9084A109bE3d04eB58477B869a38e';
const BLOCK = '0x18abcde';
const TWAP_SECONDS = 1800;
const MEAN_TICK = -105966;

function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, '0');
}
function addressResult(address) {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`;
}
function observeResult(tick0, tick1) {
  return `0x${word(64)}${word(160)}${word(2)}${word(tick0)}${word(tick1)}${word(2)}${word(0)}${word(0)}`;
}
function approx(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon * Math.max(1, Math.abs(expected)), `Expected ${actual} ≈ ${expected}`);
}

const route = {
  type: 'uniswap-v3-twap-relative',
  network: 'ethereum',
  factory: FACTORY,
  token: YB,
  quoteToken: WETH,
  fee: 10000,
  tokenDecimals: 18,
  quoteTokenDecimals: 18,
  twapWindowSeconds: TWAP_SECONDS,
  quoteAssetId: 'ethereum',
  feedQuote: 'ETH',
  outputQuote: 'USD',
  maxDivergencePct: 10,
  authority: 'shadow'
};

const registry = {
  networks: {
    ethereum: {
      chainId: 1,
      rpcFailover: [
        { id: 'rate-limited', url: 'https://eth-rate.invalid' },
        { id: 'works', url: 'https://eth-ok.invalid' }
      ]
    }
  },
  assets: {
    'yield-basis': { assetId: 'yield-basis', symbol: 'YB', route }
  }
};

const quotePerYb = quoteRatioAtTick({ tick: MEAN_TICK, token: YB, quoteToken: WETH, tokenDecimals: 18, quoteTokenDecimals: 18 });
const expectedUsd = quotePerYb * 2000;
const marketData = { prices: { 'yield-basis': { usd: expectedUsd } } };
const coreObservations = { ethereum: { assetId: 'ethereum', usd: 2000, status: 'shadow-ok' } };

assert.equal(encodeUniswapV3GetPool(route).slice(0, 10), '0x1698ee82');
assert.equal(encodeUniswapV3Observe(TWAP_SECONDS).slice(0, 10), '0x883bdbfd');
assert.equal(arithmeticMeanTick([0n, BigInt(MEAN_TICK) * BigInt(TWAP_SECONDS)], TWAP_SECONDS), MEAN_TICK);
assert.equal(arithmeticMeanTick([0n, -1907n], 18), -106, 'Negative non-divisible mean tick must round toward negative infinity');
const decodedObserve = decodeUniswapV3Observe(observeResult(123n, 456n));
assert.deepEqual(decodedObserve, [123n, 456n]);
approx(quoteRatioAtTick({ tick: MEAN_TICK, token: YB, quoteToken: WETH, tokenDecimals: 18, quoteTokenDecimals: 18 }), 0.000025014117178842097, 1e-10);

let calls = 0;
let discoveryProof = false;
let pinnedTwapProof = false;
let noSpotProof = false;

const fetchImpl = async (url, options) => {
  calls += 1;
  const payload = JSON.parse(options.body);
  const hasBlock = payload.some(x => x.method === 'eth_blockNumber');

  if (url.includes('eth-rate.invalid')) {
    const response = payload.map((req, index) => {
      if (req.method === 'eth_blockNumber') return { jsonrpc: '2.0', id: req.id, result: BLOCK };
      if (index === payload.length - 1) return { jsonrpc: '2.0', id: req.id, error: { code: -32005, message: 'over rate limit' } };
      return { jsonrpc: '2.0', id: req.id, result: '0x0' };
    });
    return { ok: true, status: 200, async json() { return response; } };
  }

  assert.ok(url.includes('eth-ok.invalid'));
  if (hasBlock) {
    assert.equal(payload.length, 2, 'Discovery phase must be one block request + one Factory.getPool');
    const getPool = payload.find(x => x.method === 'eth_call');
    assert.ok(getPool, 'Factory.getPool call missing');
    assert.equal(getPool.params?.[0]?.to.toLowerCase(), FACTORY.toLowerCase());
    assert.equal(getPool.params?.[0]?.data, encodeUniswapV3GetPool(route));
    assert.equal(getPool.params?.[1], 'latest');
    discoveryProof = true;
    return {
      ok: true,
      status: 200,
      async json() {
        return [
          { jsonrpc: '2.0', id: 1, result: BLOCK },
          { jsonrpc: '2.0', id: getPool.id, result: addressResult(POOL) }
        ];
      }
    };
  }

  assert.equal(payload.length, 4, 'TWAP phase must batch token0/token1/liquidity/observe');
  for (const req of payload) {
    assert.equal(req.method, 'eth_call');
    assert.equal(req.params?.[0]?.to.toLowerCase(), POOL.toLowerCase());
    assert.equal(req.params?.[1], BLOCK, 'Every TWAP read must pin to the discovery block');
  }
  const bySelector = new Map(payload.map(req => [req.params[0].data.slice(0, 10), req]));
  assert.ok(bySelector.has('0x0dfe1681'), 'token0() selector missing');
  assert.ok(bySelector.has('0xd21220a7'), 'token1() selector missing');
  assert.ok(bySelector.has('0x1a686502'), 'liquidity() selector missing');
  assert.ok(bySelector.has('0x883bdbfd'), 'observe() selector missing');
  assert.equal(bySelector.has('0x3850c7bd'), false, 'slot0()/spot pricing must not be used');
  assert.equal(bySelector.get('0x883bdbfd').params[0].data, encodeUniswapV3Observe(TWAP_SECONDS));
  pinnedTwapProof = true;
  noSpotProof = true;

  const tick0 = 5_000_000_000n;
  const tick1 = tick0 + BigInt(MEAN_TICK) * BigInt(TWAP_SECONDS);
  return {
    ok: true,
    status: 200,
    async json() {
      return [
        { jsonrpc: '2.0', id: bySelector.get('0x0dfe1681').id, result: addressResult(YB) },
        { jsonrpc: '2.0', id: bySelector.get('0xd21220a7').id, result: addressResult(WETH) },
        { jsonrpc: '2.0', id: bySelector.get('0x1a686502').id, result: `0x${word(123456789n)}` },
        { jsonrpc: '2.0', id: bySelector.get('0x883bdbfd').id, result: observeResult(tick0, tick1) }
      ];
    }
  };
};

const output = await resolveUniswapV3TwapPrices({ registry, marketData, coreObservations, fetchImpl });
const yb = output.observations['yield-basis'];

assert.equal(calls, 4, 'Each of the two phases must fail over once after a retryable JSON-RPC error');
assert.equal(discoveryProof, true);
assert.equal(pinnedTwapProof, true);
assert.equal(noSpotProof, true);
assert.equal(output.coverage.assetCount, 1);
assert.equal(output.coverage.okCount, 1);
assert.equal(output.coverage.warningCount, 0);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(output.rpcEfficiency.networkCount, 1);
assert.equal(output.rpcEfficiency.routeCount, 1);
assert.equal(output.rpcEfficiency.httpBatchRequestCount, 4);
assert.equal(output.networks.ethereum.protocolReadPhases, 2);
assert.equal(output.networks.ethereum.httpBatchRequestCount, 4);
assert.equal(output.networks.ethereum.rpcFailoverAttempts, 2);
assert.equal(output.networks.ethereum.uniswapV3TwapBatchCallCount, 4);
assert.equal(yb.status, 'shadow-ok');
assert.equal(yb.source, 'uniswap-v3-twap-relative');
assert.equal(yb.factory.toLowerCase(), FACTORY.toLowerCase());
assert.equal(yb.pool.toLowerCase(), POOL.toLowerCase());
assert.equal(yb.fee, 10000);
assert.equal(yb.blockTag, BLOCK);
assert.equal(yb.twapWindowSeconds, TWAP_SECONDS);
assert.equal(yb.arithmeticMeanTick, MEAN_TICK);
assert.equal(yb.activeLiquidityRaw, '123456789');
assert.equal(yb.quoteAssetId, 'ethereum');
assert.equal(yb.quoteAssetUsd, 2000);
approx(yb.feedValue, quotePerYb, 1e-10);
approx(yb.usd, expectedUsd, 1e-10);
assert.equal(yb.divergencePct, 0);
assert.equal(yb.dependencyStatus, 'shadow-ok');
assert.equal(yb.productionPriceAuthority, false);
assert.match(yb.composition, /geometric TWAP/);

console.log('Onchain Uniswap V3 TWAP validation PASS', {
  route: 'YB/WETH',
  factoryDiscovery: true,
  twapWindowSeconds: yb.twapWindowSeconds,
  sameBlockPinned: true,
  observeNotSpot: true,
  retryableRpcFailoverAttempts: output.networks.ethereum.rpcFailoverAttempts,
  ybEth: yb.feedValue,
  ybUsd: yb.usd,
  productionPriceAuthority: false
});
