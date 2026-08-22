import assert from 'node:assert/strict';
import { resolveUniswapV3ChainlinkQuotePrices } from './onchain-uniswap-v3-chainlink-quote.mjs';
import { encodeUniswapV3GetPool, encodeUniswapV3Observe, quoteRatioAtTick } from './onchain-uniswap-v3-twap.mjs';

const TOKEN = '0xea17Df5Cf6D172224892B5477A16ACb111182478';
const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const FACTORY = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const POOL = '0x56ADADF82E3346eb8317628df5ce1f776F89014D';
const FEED = '0x51597f405303C4377E36123cBc172b13269EA163';
const BLOCK = '0x123456';
const NOW_MS = Date.UTC(2026, 7, 20, 8, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const TWAP_SECONDS = 1800;
const MEAN_TICK = -161190;

function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, '0');
}
function addressResult(address) { return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`; }
function observeResult(tick0, tick1) {
  return `0x${word(64)}${word(160)}${word(2)}${word(tick0)}${word(tick1)}${word(2)}${word(0)}${word(0)}`;
}
function chainlinkRound({ answer, updatedAt }) {
  return `0x${word(100)}${word(answer)}${word(updatedAt - 1)}${word(updatedAt)}${word(100)}`;
}
function approx(actual, expected, epsilon = 1e-10) {
  assert.ok(Math.abs(actual - expected) <= epsilon * Math.max(1, Math.abs(expected)), `Expected ${actual} ≈ ${expected}`);
}

const route = {
  type: 'uniswap-v3-twap-chainlink-quote',
  network: 'bsc',
  factory: FACTORY,
  token: TOKEN,
  quoteToken: USDC,
  fee: 2500,
  twapWindowSeconds: TWAP_SECONDS,
  quoteAssetId: 'bsc-usdc-usd',
  quoteFeed: { type: 'chainlink-v3', contract: FEED, maxAgeSeconds: 90000, quote: 'USD' },
  feedQuote: 'USDC',
  outputQuote: 'USD',
  maxDivergencePct: 10,
  authority: 'shadow'
};
const registry = {
  networks: { bsc: { chainId: 56, rpcFailover: [{ id: 'bsc-test', url: 'https://bsc-test.invalid' }] } },
  assets: { elizaos: { assetId: 'elizaos', symbol: 'ELIZA', route } }
};

const TOKEN_DECIMALS = 9;
const USDC_DECIMALS = 18;
const FEED_DECIMALS = 8;
const USDC_USD = 0.9975;
const quotePerToken = quoteRatioAtTick({ tick: MEAN_TICK, token: TOKEN, quoteToken: USDC, tokenDecimals: TOKEN_DECIMALS, quoteTokenDecimals: USDC_DECIMALS });
const expectedUsd = quotePerToken * USDC_USD;
const marketData = { prices: { elizaos: { usd: expectedUsd } } };
let calls = 0;
let sawDependency = false;
let sawDiscovery = false;
let sawObserveNoSpot = false;

const fetchImpl = async (url, options) => {
  calls += 1;
  assert.equal(url, 'https://bsc-test.invalid');
  const payload = JSON.parse(options.body);
  const methods = payload.map(x => x.method);

  if (methods.includes('eth_blockNumber') && payload.length === 5) {
    const callsByToData = new Map(payload.filter(x => x.method === 'eth_call').map(x => [`${x.params[0].to.toLowerCase()}:${x.params[0].data}`, x]));
    const tokenDecimals = callsByToData.get(`${TOKEN.toLowerCase()}:0x313ce567`);
    const quoteDecimals = callsByToData.get(`${USDC.toLowerCase()}:0x313ce567`);
    const feedDecimals = callsByToData.get(`${FEED.toLowerCase()}:0x313ce567`);
    const feedRound = callsByToData.get(`${FEED.toLowerCase()}:0xfeaf968c`);
    assert.ok(tokenDecimals && quoteDecimals && feedDecimals && feedRound, 'Dependency phase must read both token decimals and Chainlink feed');
    sawDependency = true;
    return { ok: true, status: 200, async json() { return [
      { jsonrpc: '2.0', id: 1, result: BLOCK },
      { jsonrpc: '2.0', id: tokenDecimals.id, result: `0x${word(TOKEN_DECIMALS)}` },
      { jsonrpc: '2.0', id: quoteDecimals.id, result: `0x${word(USDC_DECIMALS)}` },
      { jsonrpc: '2.0', id: feedDecimals.id, result: `0x${word(FEED_DECIMALS)}` },
      { jsonrpc: '2.0', id: feedRound.id, result: chainlinkRound({ answer: BigInt(Math.round(USDC_USD * 1e8)), updatedAt: NOW_SECONDS - 600 }) }
    ]; } };
  }

  if (methods.includes('eth_blockNumber') && payload.length === 2) {
    const getPool = payload.find(x => x.method === 'eth_call');
    assert.equal(getPool.params[0].to.toLowerCase(), FACTORY.toLowerCase());
    const standardRoute = { ...route, type: 'uniswap-v3-twap-relative', tokenDecimals: TOKEN_DECIMALS, quoteTokenDecimals: USDC_DECIMALS };
    assert.equal(getPool.params[0].data, encodeUniswapV3GetPool(standardRoute));
    sawDiscovery = true;
    return { ok: true, status: 200, async json() { return [
      { jsonrpc: '2.0', id: 1, result: BLOCK },
      { jsonrpc: '2.0', id: getPool.id, result: addressResult(POOL) }
    ]; } };
  }

  assert.equal(payload.length, 4, 'TWAP phase must read token0/token1/liquidity/observe only');
  const bySelector = new Map(payload.map(req => [req.params[0].data.slice(0, 10), req]));
  assert.equal(bySelector.has('0x3850c7bd'), false, 'slot0 spot authority forbidden');
  assert.ok(bySelector.has('0x883bdbfd'), 'observe() required');
  assert.equal(bySelector.get('0x883bdbfd').params[0].data, encodeUniswapV3Observe(TWAP_SECONDS));
  for (const req of payload) assert.equal(req.params[1], BLOCK, 'TWAP reads must pin to discovery block');
  sawObserveNoSpot = true;
  const tick0 = 9_000_000_000n;
  const tick1 = tick0 + BigInt(MEAN_TICK) * BigInt(TWAP_SECONDS);
  return { ok: true, status: 200, async json() { return [
    { jsonrpc: '2.0', id: bySelector.get('0x0dfe1681').id, result: addressResult(USDC) },
    { jsonrpc: '2.0', id: bySelector.get('0xd21220a7').id, result: addressResult(TOKEN) },
    { jsonrpc: '2.0', id: bySelector.get('0x1a686502').id, result: `0x${word(123456789n)}` },
    { jsonrpc: '2.0', id: bySelector.get('0x883bdbfd').id, result: observeResult(tick0, tick1) }
  ]; } };
};

const output = await resolveUniswapV3ChainlinkQuotePrices({ registry, marketData, fetchImpl, nowMs: NOW_MS });
const eliza = output.observations.elizaos;
assert.equal(calls, 3, 'Expected dependency + V3 discovery + V3 TWAP phases');
assert.equal(sawDependency, true);
assert.equal(sawDiscovery, true);
assert.equal(sawObserveNoSpot, true);
assert.equal(output.coverage.assetCount, 1);
assert.equal(output.coverage.okCount, 1);
assert.equal(output.coverage.warningCount, 0);
assert.equal(output.coverage.unavailableCount, 0);
assert.equal(eliza.status, 'shadow-ok');
assert.equal(eliza.source, 'uniswap-v3-twap-chainlink-quote');
assert.equal(eliza.pool.toLowerCase(), POOL.toLowerCase());
assert.equal(eliza.fee, 2500);
assert.equal(eliza.quoteAssetId, 'bsc-usdc-usd');
assert.equal(eliza.quoteFeedContract.toLowerCase(), FEED.toLowerCase());
assert.equal(eliza.quoteFeedUsd, USDC_USD);
assert.notEqual(eliza.quoteFeedUsd, 1, 'USDC must not be hardcoded to $1');
approx(eliza.feedValue, quotePerToken);
approx(eliza.usd, expectedUsd);
assert.equal(eliza.divergencePct, 0);
assert.equal(eliza.productionPriceAuthority, false);
assert.match(eliza.composition, /Chainlink USDC\/USD/);
assert.equal(output.networks.bsc.onchainTokenDecimalsRead, true);

// Failback contract: reviewed route identity must survive an unhealthy quote dependency.
const failingFetch = async (url, options) => {
  assert.equal(url, 'https://bsc-test.invalid');
  const payload = JSON.parse(options.body);
  assert.ok(payload.some(x => x.method === 'eth_blockNumber'));
  return { ok: false, status: 503, async json() { return {}; } };
};
const failedOutput = await resolveUniswapV3ChainlinkQuotePrices({ registry, marketData, fetchImpl: failingFetch, nowMs: NOW_MS });
const failedEliza = failedOutput.observations.elizaos;
assert.equal(failedEliza.status, 'quote-dependency-rpc-unavailable');
assert.equal(failedEliza.source, 'uniswap-v3-twap-chainlink-quote');
assert.equal(failedEliza.network, 'bsc');
assert.equal(failedEliza.factory.toLowerCase(), FACTORY.toLowerCase());
assert.equal(failedEliza.token.toLowerCase(), TOKEN.toLowerCase());
assert.equal(failedEliza.quoteToken.toLowerCase(), USDC.toLowerCase());
assert.equal(failedEliza.fee, 2500);
assert.equal(failedEliza.quoteAssetId, 'bsc-usdc-usd');
assert.equal(failedEliza.feedQuote, 'USDC');
assert.equal(failedEliza.outputQuote, 'USD');
assert.equal(failedEliza.productionPriceAuthority, false);

console.log('ELIZA V3 + Chainlink quote validation PASS', {
  tokenDecimalsReadOnchain: TOKEN_DECIMALS,
  quoteTokenDecimalsReadOnchain: USDC_DECIMALS,
  usdcUsd: eliza.quoteFeedUsd,
  twapWindowSeconds: eliza.twapWindowSeconds,
  observeNotSpot: true,
  failbackIdentityPreserved: true,
  stablecoinPegHardcoded: false,
  productionPriceAuthority: false
});
