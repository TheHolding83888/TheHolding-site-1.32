import assert from 'node:assert/strict';
import {
  resolveUniswapV2HistoricalTwapPrices,
  UNISWAP_V2_HISTORICAL_TWAP_SELECTORS
} from './onchain-uniswap-v2-historical-twap.mjs';

const OLAS = '0x0001A500A6B18995B03f44bb040A5fFc28E45CB0';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const PAIR = '0x09D1d767eDF8Fa23A64C51fa559E0688E526812F';
const CURRENT_BLOCK = 4096;
const HISTORICAL_BLOCK = 3996;
const CURRENT_TIMESTAMP = 101200;
const HISTORICAL_TIMESTAMP = 100000;
const Q112 = 1n << 112n;

function word(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function addressResult(address) { return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`; }
function reservesResult(reserve0, reserve1, timestamp) { return `0x${word(reserve0)}${word(reserve1)}${word(timestamp)}`; }
function uintResult(value) { return `0x${word(value)}`; }
function blockResult(number, timestamp) { return { number: `0x${number.toString(16)}`, timestamp: `0x${timestamp.toString(16)}` }; }

const reserve0 = 100n * 10n ** 18n;
const reserve1 = 1n * 10n ** 18n;
const price0Uq = (reserve1 << 112n) / reserve0; // 0.01 WETH per OLAS
const currentPrice0Cumulative = price0Uq * BigInt(CURRENT_TIMESTAMP - HISTORICAL_TIMESTAMP);

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
    autonolas: {
      assetId: 'autonolas',
      symbol: 'OLAS',
      route: {
        type: 'uniswap-v2-historical-twap-relative',
        network: 'ethereum',
        pair: PAIR,
        token: OLAS,
        quoteToken: WETH,
        tokenDecimals: 18,
        quoteTokenDecimals: 18,
        lookbackBlocks: 100,
        minTwapWindowSeconds: 900,
        maxTwapWindowSeconds: 2400,
        quoteAssetId: 'ethereum',
        feedQuote: 'ETH',
        outputQuote: 'USD',
        maxDivergencePct: 10,
        authority: 'shadow'
      }
    }
  }
};

const marketData = { prices: { autonolas: { usd: 20 } } };
const coreObservations = { ethereum: { assetId: 'ethereum', usd: 2000, status: 'shadow-ok' } };
let calls = 0;
let sawHistoricalPinnedReads = false;
let sawRetryableFailover = false;

function successfulPhase2(payload) {
  const out = [];
  for (const request of payload) {
    if (request.method === 'eth_getBlockByNumber') {
      const tag = request.params[0];
      if (tag === '0x1000') out.push({ jsonrpc: '2.0', id: request.id, result: blockResult(CURRENT_BLOCK, CURRENT_TIMESTAMP) });
      else if (tag === '0xf9c') out.push({ jsonrpc: '2.0', id: request.id, result: blockResult(HISTORICAL_BLOCK, HISTORICAL_TIMESTAMP) });
      else throw new Error(`Unexpected block tag ${tag}`);
      continue;
    }
    const [{ to, data }, tag] = request.params;
    assert.equal(to.toLowerCase(), PAIR.toLowerCase());
    assert.ok(tag === '0x1000' || tag === '0xf9c', `Pair read must be pinned, got ${tag}`);
    if (tag === '0xf9c') sawHistoricalPinnedReads = true;
    if (data === UNISWAP_V2_HISTORICAL_TWAP_SELECTORS.token0) out.push({ jsonrpc: '2.0', id: request.id, result: addressResult(OLAS) });
    else if (data === UNISWAP_V2_HISTORICAL_TWAP_SELECTORS.token1) out.push({ jsonrpc: '2.0', id: request.id, result: addressResult(WETH) });
    else if (data === UNISWAP_V2_HISTORICAL_TWAP_SELECTORS.getReserves) {
      const ts = tag === '0x1000' ? CURRENT_TIMESTAMP : HISTORICAL_TIMESTAMP;
      out.push({ jsonrpc: '2.0', id: request.id, result: reservesResult(reserve0, reserve1, ts) });
    } else if (data === UNISWAP_V2_HISTORICAL_TWAP_SELECTORS.price0CumulativeLast) {
      out.push({ jsonrpc: '2.0', id: request.id, result: uintResult(tag === '0x1000' ? currentPrice0Cumulative : 0n) });
    } else if (data === UNISWAP_V2_HISTORICAL_TWAP_SELECTORS.price1CumulativeLast) {
      out.push({ jsonrpc: '2.0', id: request.id, result: uintResult(0n) });
    } else throw new Error(`Unexpected selector ${data}`);
  }
  return out;
}

const fetchImpl = async (url, options) => {
  calls += 1;
  const payload = JSON.parse(options.body);
  if (payload.length === 1 && payload[0].method === 'eth_blockNumber') {
    assert.equal(url, 'https://first.invalid');
    return { ok: true, status: 200, async json() { return [{ jsonrpc: '2.0', id: 1, result: '0x1000' }]; } };
  }
  if (url === 'https://first.invalid') {
    const response = successfulPhase2(payload);
    const pairCall = payload.find(x => x.method === 'eth_call');
    const index = response.findIndex(x => x.id === pairCall.id);
    response[index] = { jsonrpc: '2.0', id: pairCall.id, error: { code: -32005, message: 'over rate limit' } };
    sawRetryableFailover = true;
    return { ok: true, status: 200, async json() { return response; } };
  }
  assert.equal(url, 'https://second.invalid');
  return { ok: true, status: 200, async json() { return successfulPhase2(payload); } };
};

const output = await resolveUniswapV2HistoricalTwapPrices({ registry, marketData, coreObservations, fetchImpl });
const olas = output.observations.autonolas;

assert.equal(calls, 3, 'one block phase + failed historical phase + failover historical phase');
assert.equal(sawRetryableFailover, true);
assert.equal(sawHistoricalPinnedReads, true);
assert.equal(output.coverage.assetCount, 1);
assert.equal(output.coverage.okCount, 1);
assert.equal(output.coverage.warningCount, 0);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(output.rpcEfficiency.networkCount, 1);
assert.equal(output.rpcEfficiency.routeCount, 1);
assert.equal(output.rpcEfficiency.httpBatchRequestCount, 3);
assert.equal(output.networks.ethereum.protocolReadPhases, 2);
assert.equal(output.networks.ethereum.historicalStateReads, true);
assert.equal(output.networks.ethereum.rpcFailoverAttempts, 1);
assert.equal(olas.status, 'shadow-ok');
assert.equal(olas.source, 'uniswap-v2-historical-twap-relative');
assert.equal(olas.pair.toLowerCase(), PAIR.toLowerCase());
assert.equal(olas.token0.toLowerCase(), OLAS.toLowerCase());
assert.equal(olas.token1.toLowerCase(), WETH.toLowerCase());
assert.equal(olas.baseIsToken0, true);
assert.equal(olas.blockNumber, CURRENT_BLOCK);
assert.equal(olas.historicalBlockNumber, HISTORICAL_BLOCK);
assert.equal(olas.effectiveTwapWindowSeconds, 1200);
assert.equal(olas.lookbackBlocks, 100);
assert.ok(Math.abs(olas.feedValue - 0.01) < 1e-12, `Expected 0.01 WETH/OLAS, got ${olas.feedValue}`);
assert.ok(Math.abs(olas.usd - 20) < 1e-9);
assert.equal(olas.divergencePct, 0);
assert.equal(olas.dependencyStatus, 'shadow-ok');
assert.equal(olas.productionPriceAuthority, false);
assert.match(olas.composition, /cumulative-price historical TWAP/);

console.log('Uniswap V2 historical TWAP validation PASS', {
  pair: olas.pair,
  effectiveTwapWindowSeconds: olas.effectiveTwapWindowSeconds,
  feedValue: olas.feedValue,
  usd: olas.usd,
  rpcFailoverAttempts: output.networks.ethereum.rpcFailoverAttempts,
  historicalStateReads: true,
  externalUpdaterDependency: false,
  productionPriceAuthority: false
});
