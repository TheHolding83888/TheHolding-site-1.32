import fs from 'node:fs';
import { selectMarketDataAuthority } from './market-data-authority-selector.mjs';

const materializer = fs.readFileSync(new URL('./market-data-authority-materializer.mjs', import.meta.url), 'utf8');
const policy = JSON.parse(fs.readFileSync(new URL('./market-data-authority-policy.json', import.meta.url), 'utf8'));
const source = JSON.parse(fs.readFileSync(new URL('./market-data-coingecko.json', import.meta.url), 'utf8'));
const shadow = JSON.parse(fs.readFileSync(new URL('./onchain-price-shadow.json', import.meta.url), 'utf8'));

if (materializer.includes('assertEqual(observation.dependencyStatus, req.dependencyStatus')) {
  throw new Error('Materializer must not enforce runtime dependencyStatus as static route identity');
}
if (!materializer.includes('const evaluation = evaluateMarketDataAuthority({ policy, marketData: source, shadow, nowMs })')) {
  throw new Error('Materializer must delegate runtime authority health to evaluateMarketDataAuthority');
}
if (!materializer.includes("selection.selectedLane === 'onchain-shadow'") || !materializer.includes("selection.selectedLane === 'coingecko-lane'")) {
  throw new Error('Materializer must preserve selector-driven per-asset authority lanes');
}
if (!materializer.includes('function observationCarriesSelectableRouteEvidence(observation)')) {
  throw new Error('Materializer must distinguish selectable route evidence from transient unavailable observations');
}
if ((materializer.match(/if \(!observationCarriesSelectableRouteEvidence\(observation\)\) continue;/g) || []).length !== 4) {
  throw new Error('Every materializer route cohort must defer transient unhealthy rows to selector failback');
}

const nowMs = Date.parse(shadow.generatedAt);
if (!Number.isFinite(nowMs)) throw new Error('Shadow generatedAt invalid');

// Health-boundary tests must not depend on the wall-clock age of the checked-in
// daily CoinGecko snapshot. Build an explicitly fresh failback fixture for the
// cases that are intended to prove bounded failback, and separately prove that
// an over-age source is rejected.
const freshFailbackSource = structuredClone(source);
const freshObservedAt = new Date(nowMs).toISOString();
freshFailbackSource.generatedAt = freshObservedAt;
freshFailbackSource.requestedAt = freshObservedAt;
freshFailbackSource.observedAt = freshObservedAt;
for (const row of Object.values(freshFailbackSource.prices || {})) {
  row.observedAt = freshObservedAt;
}

const divergent = structuredClone(shadow);
divergent.observations['convex-finance'] = {
  ...divergent.observations['convex-finance'],
  status: 'dependency-warning',
  dependencyStatus: 'divergent',
  usd: Number(source.prices['convex-finance']?.usd) * 1.08
};
const divergenceSelection = selectMarketDataAuthority({
  policy,
  marketData: source,
  shadow: divergent,
  assetId: 'convex-finance',
  nowMs
});
if (divergenceSelection.selectedLane !== 'onchain-shadow' || divergenceSelection.fallbackUsed) {
  throw new Error('Healthy dependency divergence must remain onchain authority');
}

const failed = structuredClone(shadow);
failed.observations['convex-finance'] = {
  ...failed.observations['convex-finance'],
  status: 'dependency-warning',
  dependencyStatus: 'rpc-unavailable',
  usd: null
};
const failedSelection = selectMarketDataAuthority({
  policy,
  marketData: freshFailbackSource,
  shadow: failed,
  assetId: 'convex-finance',
  nowMs
});
if (failedSelection.selectedLane !== 'coingecko-lane' || failedSelection.fallbackUsed !== true) {
  throw new Error('Real dependency failure with a fresh daily source must perform bounded CoinGecko failback');
}

const staleFailbackSource = structuredClone(freshFailbackSource);
staleFailbackSource.prices['convex-finance'].observedAt = new Date(nowMs - (31 * 60 * 60 * 1000)).toISOString();
const staleSelection = selectMarketDataAuthority({
  policy,
  marketData: staleFailbackSource,
  shadow: failed,
  assetId: 'convex-finance',
  nowMs
});
if (staleSelection.selectedLane !== 'unknown' || staleSelection.coingeckoCandidate?.checks?.sourceFresh !== false) {
  throw new Error('CoinGecko failback older than the 30-hour safety bound must be rejected');
}

const unavailableV3 = structuredClone(shadow);
unavailableV3.observations.ovr = {
  assetId: 'ovr',
  status: 'unavailable',
  usd: null,
  source: 'uniswap-v3-twap-relative',
  network: 'ethereum',
  productionPriceAuthority: false
};
const unavailableV3Selection = selectMarketDataAuthority({
  policy,
  marketData: freshFailbackSource,
  shadow: unavailableV3,
  assetId: 'ovr',
  nowMs
});
if (unavailableV3Selection.selectedLane !== 'coingecko-lane' || unavailableV3Selection.fallbackUsed !== true) {
  throw new Error('Transient V3 route unavailability with incomplete runtime metadata must fail back per asset');
}

console.log('Market Data materializer health-boundary validation PASS', {
  divergenceTelemetryKeepsOnchain: true,
  realDependencyFailureFailsBackPerAsset: true,
  staleCoinGeckoFailbackRejected: true,
  transientUnavailableRouteMetadataFailsBackPerAsset: true,
  materializerDelegatesRuntimeHealthToSelector: true,
  executionAuthority: 'none'
});
