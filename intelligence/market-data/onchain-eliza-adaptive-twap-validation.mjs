import assert from 'node:assert/strict';
import { resolveUniswapV3ChainlinkQuotePrices } from './onchain-uniswap-v3-chainlink-quote.mjs';
import { encodeUniswapV3Observe } from './onchain-uniswap-v3-twap.mjs';

const TOKEN = '0xea17Df5Cf6D172224892B5477A16ACb111182478';
const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const FACTORY = '0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865';
const POOL = '0x56ADADF82E3346eb8317628df5ce1f776F89014D';
const FEED = '0x51597f405303C4377E36123cBc172b13269EA163';
const BLOCK = '0x123456';
const NOW_MS = Date.UTC(2026, 7, 20, 12, 0, 0);
const NOW_SECONDS = Math.floor(NOW_MS / 1000);
const MEAN_TICK = -161190;

function word(value) {
  let n = BigInt(value);
  if (n < 0n) n = (1n << 256n) + n;
  return n.toString(16).padStart(64, '0');
}
function addressResult(address) { return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`; }
function observeResult(seconds) {
  const tick0 = 9_000_000_000n;
  const tick1 = tick0 + BigInt(MEAN_TICK) * BigInt(seconds);
  return `0x${word(64)}${word(160)}${word(2)}${word(tick0)}${word(tick1)}${word(2)}${word(0)}${word(0)}`;
}
function chainlinkRound({ answer, updatedAt }) {
  return `0x${word(100)}${word(answer)}${word(updatedAt - 1)}${word(updatedAt)}${word(100)}`;
}
function baseRoute() {
  return {
    type: 'uniswap-v3-twap-chainlink-quote',
    network: 'bsc', factory: FACTORY, token: TOKEN, quoteToken: USDC, fee: 2500,
    twapWindowSeconds: 300, twapFallbackOnError: 'OLD', twapFallbackWindowsSeconds: [180, 120, 60],
    quoteAssetId: 'bsc-usdc-usd',
    quoteFeed: { type: 'chainlink-v3', contract: FEED, maxAgeSeconds: 90000, quote: 'USD' },
    feedQuote: 'USDC', outputQuote: 'USD', maxDivergencePct: 10, authority: 'shadow'
  };
}
function registry(route = baseRoute()) {
  return {
    networks: { bsc: { chainId: 56, rpcFailover: [{ id: 'bsc-test', url: 'https://bsc-test.invalid' }] } },
    assets: { elizaos: { assetId: 'elizaos', symbol: 'ELIZA', route } }
  };
}
function dependencyResponse(payload) {
  const calls = new Map(payload.filter(x => x.method === 'eth_call').map(x => [`${x.params[0].to.toLowerCase()}:${x.params[0].data}`, x]));
  return [
    { jsonrpc: '2.0', id: 1, result: BLOCK },
    { jsonrpc: '2.0', id: calls.get(`${TOKEN.toLowerCase()}:0x313ce567`).id, result: `0x${word(9)}` },
    { jsonrpc: '2.0', id: calls.get(`${USDC.toLowerCase()}:0x313ce567`).id, result: `0x${word(18)}` },
    { jsonrpc: '2.0', id: calls.get(`${FEED.toLowerCase()}:0x313ce567`).id, result: `0x${word(8)}` },
    { jsonrpc: '2.0', id: calls.get(`${FEED.toLowerCase()}:0xfeaf968c`).id, result: chainlinkRound({ answer: 99_990_000n, updatedAt: NOW_SECONDS - 300 }) }
  ];
}
function discoveryResponse(payload) {
  const req = payload.find(x => x.method === 'eth_call');
  return [{ jsonrpc: '2.0', id: 1, result: BLOCK }, { jsonrpc: '2.0', id: req.id, result: addressResult(POOL) }];
}
function phaseWindow(payload) {
  const observe = payload.find(x => String(x.params?.[0]?.data || '').startsWith('0x883bdbfd'));
  for (const seconds of [300, 180, 120, 60]) if (observe?.params?.[0]?.data === encodeUniswapV3Observe(seconds)) return seconds;
  throw new Error('Unexpected observe window');
}
function twapResponse(payload, windowSeconds, observeError = null) {
  const bySelector = new Map(payload.map(req => [req.params[0].data.slice(0, 10), req]));
  assert.equal(bySelector.has('0x3850c7bd'), false, 'slot0 spot authority forbidden');
  const rows = [
    { jsonrpc: '2.0', id: bySelector.get('0x0dfe1681').id, result: addressResult(USDC) },
    { jsonrpc: '2.0', id: bySelector.get('0xd21220a7').id, result: addressResult(TOKEN) },
    { jsonrpc: '2.0', id: bySelector.get('0x1a686502').id, result: `0x${word(123456789n)}` }
  ];
  const observe = bySelector.get('0x883bdbfd');
  rows.push(observeError
    ? { jsonrpc: '2.0', id: observe.id, error: { code: 3, message: observeError } }
    : { jsonrpc: '2.0', id: observe.id, result: observeResult(windowSeconds) });
  return rows;
}

async function runScenario({ preferredError, expectedWindow, expectFallback, expectedCalls }) {
  let calls = 0;
  const attempted = [];
  const fetchImpl = async (_url, options) => {
    calls += 1;
    const payload = JSON.parse(options.body);
    const methods = payload.map(x => x.method);
    if (methods.includes('eth_blockNumber') && payload.length === 5) return { ok: true, status: 200, async json() { return dependencyResponse(payload); } };
    if (methods.includes('eth_blockNumber') && payload.length === 2) return { ok: true, status: 200, async json() { return discoveryResponse(payload); } };
    const windowSeconds = phaseWindow(payload);
    attempted.push(windowSeconds);
    const error = windowSeconds === 300 ? preferredError : null;
    return { ok: true, status: 200, async json() { return twapResponse(payload, windowSeconds, error); } };
  };
  const out = await resolveUniswapV3ChainlinkQuotePrices({ registry: registry(), marketData: { prices: { elizaos: { usd: 0.0002 } } }, fetchImpl, nowMs: NOW_MS });
  const row = out.observations.elizaos;
  assert.equal(calls, expectedCalls);
  assert.equal(row.twapFallbackUsed, expectFallback);
  if (expectFallback) {
    assert.equal(row.status === 'shadow-ok' || row.status === 'divergent', true);
    assert.equal(row.twapWindowSeconds, expectedWindow);
    assert.equal(row.preferredTwapWindowSeconds, 300);
    assert.deepEqual(row.twapFallbackWindowsSeconds, [180, 120, 60]);
    assert.deepEqual(row.twapFallbackAttemptedSeconds, [180]);
    assert.equal(row.twapFallbackOnError, 'OLD');
  } else {
    assert.equal(row.status, 'rpc-call-or-decode-error');
  }
  return { row, attempted };
}

const oldFallback = await runScenario({ preferredError: 'execution reverted: OLD', expectedWindow: 180, expectFallback: true, expectedCalls: 5 });
assert.deepEqual(oldFallback.attempted, [300, 180], 'OLD must try preferred then longest allowed fallback');

const nonOld = await runScenario({ preferredError: 'execution reverted: SPL', expectedWindow: 300, expectFallback: false, expectedCalls: 3 });
assert.deepEqual(nonOld.attempted, [300], 'Non-OLD error must never shorten TWAP window');

for (const bad of [
  { ...baseRoute(), twapFallbackOnError: 'ANY' },
  { ...baseRoute(), twapFallbackWindowsSeconds: [180, 30] },
  { ...baseRoute(), twapFallbackWindowsSeconds: [120, 180] },
  { ...baseRoute(), twapFallbackWindowsSeconds: [180, 180] }
]) {
  await assert.rejects(
    resolveUniswapV3ChainlinkQuotePrices({ registry: registry(bad), marketData: { prices: {} }, fetchImpl: async () => { throw new Error('should not fetch'); }, nowMs: NOW_MS }),
    /Adaptive TWAP fallback|Invalid adaptive TWAP fallback window/
  );
}

console.log('ELIZA adaptive TWAP deterministic validation PASS', {
  preferredWindowSeconds: 300,
  fallbackWindowsSeconds: [180, 120, 60],
  minimumWindowSeconds: 60,
  fallbackOnlyOnOld: true,
  nonOldDoesNotFallback: true,
  slot0SpotAuthority: false,
  productionPriceAuthority: false
});
