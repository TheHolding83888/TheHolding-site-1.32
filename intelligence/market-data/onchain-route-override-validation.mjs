import assert from 'node:assert/strict';
import { mergeOnchainRegistryExtensions } from './onchain-price-resolver.mjs';

const base = {
  version: 'test-base',
  semantics: { productionPriceAuthority: false },
  networks: { mode: { chainId: 34443, rpcFailover: [{ id: 'mode', url: 'https://mode.invalid' }] } },
  assets: {
    mode: {
      assetId: 'mode',
      symbol: 'MODE',
      route: { type: 'pyth-core-readonly', network: 'mode', contract: '0x0000000000000000000000000000000000000001', authority: 'shadow' }
    }
  }
};
const replacement = {
  assetId: 'mode',
  symbol: 'MODE',
  route: {
    type: 'velodrome-v2-twap-relative',
    network: 'mode',
    factory: '0x31832f2a97Fd20664D76Cc421207669b55CE4BC0',
    token: '0xDfc7C877a950e49D2610114102175A06C2e3167a',
    quoteToken: '0x4200000000000000000000000000000000000006',
    stable: false,
    tokenDecimals: 18,
    quoteTokenDecimals: 18,
    amountIn: '1000000000000000000',
    granularity: 4,
    observationPeriodSeconds: 1800,
    quoteAssetId: 'ethereum',
    feedQuote: 'ETH',
    outputQuote: 'USD',
    maxDivergencePct: 10,
    authority: 'shadow'
  }
};

const extension = {
  effectiveRegistryVersion: 'test-effective',
  semantics: { boundedRouteOverridesAllowed: true },
  assets: {},
  overrides: { mode: replacement }
};
const merged = mergeOnchainRegistryExtensions(base, extension);
assert.equal(base.assets.mode.route.type, 'pyth-core-readonly', 'Base registry must remain immutable');
assert.equal(merged.assets.mode.route.type, 'velodrome-v2-twap-relative');
assert.equal(merged.assets.mode.route.factory.toLowerCase(), '0x31832f2a97fd20664d76cc421207669b55ce4bc0');
assert.equal(merged.assets.mode.route.token.toLowerCase(), '0xdfc7c877a950e49d2610114102175a06c2e3167a');
assert.equal(merged.assets.mode.route.quoteToken.toLowerCase(), '0x4200000000000000000000000000000000000006');
assert.equal(merged.semantics.boundedRouteOverridesApplied, true);
assert.throws(
  () => mergeOnchainRegistryExtensions(base, { assets: {}, overrides: { unknown: { assetId: 'unknown', route: replacement.route } } }),
  /unknown canonical assets/,
  'Unknown route override must fail closed'
);
assert.throws(
  () => mergeOnchainRegistryExtensions(base, { assets: {}, overrides: { mode: { assetId: 'wrong', route: replacement.route } } }),
  /Invalid route override contract/,
  'Override asset identity mismatch must fail closed'
);

console.log('Bounded onchain route override validation PASS', {
  baseModeRoute: base.assets.mode.route.type,
  effectiveModeRoute: merged.assets.mode.route.type,
  unknownOverrideFailsClosed: true,
  identityMismatchFailsClosed: true,
  productionPriceAuthority: false
});
