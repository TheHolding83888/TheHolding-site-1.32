import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolveUniswapV3ChainlinkQuotePrices } from './onchain-uniswap-v3-chainlink-quote.mjs';

const base = JSON.parse(fs.readFileSync(new URL('./onchain-price-source-registry.json', import.meta.url), 'utf8'));
const extensions = JSON.parse(fs.readFileSync(new URL('./onchain-price-source-registry-extensions.json', import.meta.url), 'utf8'));
const marketData = JSON.parse(fs.readFileSync(new URL('./market-data.json', import.meta.url), 'utf8'));
const routeAsset = extensions.assets?.elizaos;
assert.ok(routeAsset?.route, 'ELIZA extension route missing');
assert.equal(routeAsset.route.type, 'uniswap-v3-twap-chainlink-quote');
assert.equal(routeAsset.route.network, 'bsc');
assert.equal(routeAsset.route.twapWindowSeconds, 300);
assert.equal(routeAsset.route.twapFallbackOnError, 'OLD');
assert.deepEqual(routeAsset.route.twapFallbackWindowsSeconds, [180, 120, 60]);
assert.equal(routeAsset.route.authority, 'shadow');
assert.equal(base.semantics?.productionPriceAuthority, false);
assert.equal(base.semantics?.executionAuthority, 'none');

const isolatedRegistry = {
  ...base,
  assets: { elizaos: routeAsset },
  networks: { bsc: base.networks.bsc }
};
const output = await resolveUniswapV3ChainlinkQuotePrices({ registry: isolatedRegistry, marketData });
const row = output.observations?.elizaos;
assert.ok(row, 'ELIZA live observation missing');
assert.equal(row.source, 'uniswap-v3-twap-chainlink-quote');
assert.equal(row.status, 'shadow-ok', `ELIZA live route not healthy: ${row.status} ${row.error || ''}`);
assert.ok(Number(row.usd) > 0, 'ELIZA live USD must be positive');
assert.equal(row.productionPriceAuthority, false);
assert.equal(row.quoteDependencySource, 'chainlink-v3-quote-dependency');
assert.ok(Number(row.quoteFeedUsd) > 0, 'USDC/USD Chainlink dependency missing');
assert.ok(Number(row.quoteFeedAgeSeconds) >= 0 && Number(row.quoteFeedAgeSeconds) <= Number(routeAsset.route.quoteFeed.maxAgeSeconds), 'USDC/USD quote feed stale');
assert.equal(row.preferredTwapWindowSeconds, 300);
assert.ok([300, 180, 120, 60].includes(Number(row.twapWindowSeconds)), `Unexpected effective TWAP window: ${row.twapWindowSeconds}`);
assert.ok(Number(row.twapWindowSeconds) >= 60, 'Adaptive TWAP fell below 60s floor');
assert.equal(row.twapFallbackOnError, 'OLD');
if (row.twapFallbackUsed) {
  assert.ok(Number(row.twapWindowSeconds) < 300, 'Fallback flag set without shorter window');
  const attempted = row.twapFallbackAttemptedSeconds || [];
  assert.ok(attempted.length >= 1, 'Fallback used without attempted-window telemetry');
  assert.deepEqual(attempted, [180, 120, 60].slice(0, attempted.length), 'Fallback attempts must proceed longest-to-shortest');
  assert.equal(Number(row.twapWindowSeconds), Number(attempted.at(-1)), 'Effective fallback window must equal last successful attempt');
}
assert.equal(output.coverage.assetCount, 1);
assert.equal(output.coverage.okCount, 1);
assert.equal(output.coverage.unavailableCount, 0);

console.log('ELIZA adaptive TWAP LIVE proof PASS', {
  usd: row.usd,
  preferredTwapWindowSeconds: row.preferredTwapWindowSeconds,
  effectiveTwapWindowSeconds: row.twapWindowSeconds,
  twapFallbackUsed: row.twapFallbackUsed,
  attemptedFallbackWindows: row.twapFallbackAttemptedSeconds || [],
  quoteFeedUsd: row.quoteFeedUsd,
  quoteFeedAgeSeconds: row.quoteFeedAgeSeconds,
  divergencePct: row.divergencePct,
  productionPriceAuthority: false,
  executionAuthority: 'none'
});
