import assert from 'node:assert/strict';
import {
  CURVE_EMA_ROUTE_TYPE,
  encodeCurveCoins,
  encodeCurvePriceOracle,
  resolveCurveEmaPrices
} from './onchain-curve-ema.mjs';

function word(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function addressResult(address) { return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`; }

const RSUP = '0x0000000000000000000000000000000000000101';
const WETH = '0x0000000000000000000000000000000000000102';
const POOL = '0x0000000000000000000000000000000000000103';

const registry = {
  networks: {
    ethereum: {
      chainId: 1,
      rpcFailover: [
        { id: 'first-rate-limited', url: 'https://first.invalid' },
        { id: 'second-works', url: 'https://second.invalid' }
      ]
    }
  },
  assets: {
    resupply: {
      assetId: 'resupply',
      symbol: 'RSUP',
      route: {
        type: CURVE_EMA_ROUTE_TYPE,
        network: 'ethereum',
        pool: POOL,
        token: RSUP,
        quoteToken: WETH,
        oracleDirection: 'coin0-per-coin1',
        oracleScale: '1000000000000000000',
        quoteAssetId: 'ethereum',
        feedQuote: 'ETH',
        outputQuote: 'USD',
        maxDivergencePct: 10,
        authority: 'shadow'
      }
    }
  }
};

const marketData = { prices: { resupply: { usd: 2 } } };
const coreObservations = { ethereum: { assetId: 'ethereum', status: 'shadow-ok', usd: 2000 } };
let calls = 0;
let sawPinnedOraclePhase = false;

const fetchImpl = async (url, options) => {
  calls += 1;
  const payload = JSON.parse(options.body);
  if (url.includes('first.invalid')) {
    return {
      ok: true,
      status: 200,
      async json() {
        return payload.map(req => ({ jsonrpc: '2.0', id: req.id, error: { code: -32005, message: 'over rate limit' } }));
      }
    };
  }
  assert.ok(url.includes('second.invalid'));
  if (payload.length === 1 && payload[0].method === 'eth_blockNumber') {
    return { ok: true, status: 200, async json() { return [{ jsonrpc: '2.0', id: 1, result: '0x1234' }]; } };
  }
  assert.equal(payload.length, 3, 'Curve EMA phase 2 must have coin0 + coin1 + price_oracle');
  for (const req of payload) assert.equal(req.params?.[1], '0x1234', 'Curve EMA reads must pin to discovered block');
  const coin0 = payload.find(req => req.params?.[0]?.data === encodeCurveCoins(0));
  const coin1 = payload.find(req => req.params?.[0]?.data === encodeCurveCoins(1));
  const oracle = payload.find(req => req.params?.[0]?.data === encodeCurvePriceOracle());
  assert.ok(coin0 && coin1 && oracle);
  for (const req of payload) assert.equal(req.params?.[0]?.to, POOL);
  sawPinnedOraclePhase = true;
  return {
    ok: true,
    status: 200,
    async json() {
      return [
        { jsonrpc: '2.0', id: coin0.id, result: addressResult(WETH) },
        { jsonrpc: '2.0', id: coin1.id, result: addressResult(RSUP) },
        { jsonrpc: '2.0', id: oracle.id, result: `0x${word(1_000_000_000_000_000n)}` }
      ];
    }
  };
};

assert.equal(encodeCurveCoins(0), `0xc6610657${word(0)}`);
assert.equal(encodeCurveCoins(1), `0xc6610657${word(1)}`);
assert.equal(encodeCurvePriceOracle(), '0x86fc88d3');

const output = await resolveCurveEmaPrices({ registry, marketData, coreObservations, fetchImpl });
const rsup = output.observations.resupply;
assert.equal(calls, 4, 'Both block and oracle phases must fail over after retryable endpoint errors');
assert.equal(sawPinnedOraclePhase, true);
assert.equal(output.coverage.assetCount, 1);
assert.equal(output.coverage.okCount, 1);
assert.equal(output.coverage.warningCount, 0);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(output.rpcEfficiency.networkCount, 1);
assert.equal(output.rpcEfficiency.routeCount, 1);
assert.equal(output.rpcEfficiency.httpBatchRequestCount, 4);
assert.equal(output.networks.ethereum.protocolReadPhases, 2);
assert.equal(output.networks.ethereum.rpcFailoverAttempts, 2);
assert.equal(output.networks.ethereum.curveEmaRouteCount, 1);
assert.equal(output.networks.ethereum.curveEmaOracleBatchCallCount, 3);
assert.equal(output.networks.ethereum.curveEmaBlockTag, '0x1234');
assert.equal(rsup.status, 'shadow-ok');
assert.equal(rsup.source, CURVE_EMA_ROUTE_TYPE);
assert.equal(rsup.coin0.toLowerCase(), WETH.toLowerCase());
assert.equal(rsup.coin1.toLowerCase(), RSUP.toLowerCase());
assert.equal(rsup.feedValue, 0.001);
assert.equal(rsup.quoteAssetUsd, 2000);
assert.equal(rsup.usd, 2);
assert.equal(rsup.divergencePct, 0);
assert.equal(rsup.blockTag, '0x1234');
assert.equal(rsup.productionPriceAuthority, false);
assert.match(rsup.composition, /price_oracle\(\) EMA/);

console.log('Curve EMA relative price validation PASS', {
  routes: output.rpcEfficiency.routeCount,
  httpBatchRequestCount: output.rpcEfficiency.httpBatchRequestCount,
  failoverAttempts: output.networks.ethereum.rpcFailoverAttempts,
  rsupUsd: rsup.usd,
  productionPriceAuthority: false
});
