import fs from 'node:fs';
import { evaluateMarketDataAuthority, selectMarketDataAuthority } from './market-data-authority-selector.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./market-data-authority-policy.json', import.meta.url), 'utf8'));
const source = JSON.parse(fs.readFileSync(new URL('./market-data-coingecko.json', import.meta.url), 'utf8'));
const rawShadow = JSON.parse(fs.readFileSync(new URL('./onchain-price-shadow.json', import.meta.url), 'utf8'));
const direct = [...(policy.pilot?.assetIds || [])];
const relative = [...(policy.relativePilot?.assetIds || [])];
const v3Relative = [...(policy.v3RelativePilot?.assetIds || [])];
const reviewed = [...(policy.reviewedPilot?.assetIds || [])];
const promoted = [...direct, ...relative, ...v3Relative, ...reviewed];

if (policy.mode !== 'bounded-production-pilot') throw new Error('Policy must be bounded production pilot');
if (policy.globalOnchainPromotionEnabled !== true) throw new Error('Onchain promotion gate must be enabled');
if (policy.semantics?.productionWriterIntegrationEnabled !== true) throw new Error('Writer integration missing');
if (policy.semantics?.coinGeckoRemainsFallbackAndSanityCheck !== true) throw new Error('CoinGecko fallback/sanity contract missing');
if (policy.defaultProductionAuthority !== 'coingecko-lane') throw new Error('CoinGecko must remain fallback default');
if (policy.semantics?.automaticPolicyMutationAllowed !== false || policy.semantics?.automaticCohortExpansionAllowed !== false) throw new Error('Automatic cohort expansion enabled');
if (promoted.length !== 26 || new Set(promoted).size !== 26) throw new Error(`Expected 26 unique explicitly reviewed canonical assets, got ${new Set(promoted).size}`);
if (Object.keys(policy.assetOverrides || {}).length !== 26) throw new Error('Every canonical asset must have an explicit authority override');
if (promoted.some(id => policy.assetOverrides?.[id]?.requestedPrimary !== 'onchain')) throw new Error('Every reviewed canonical asset must request onchain primary');

// Existing tracked Shadow is production evidence, but selector validation must stay deterministic.
// Normalize every explicit reviewed route into a healthy synthetic observation while preserving
// the exact route identity requirements used by the production materializer.
const shadow = structuredClone(rawShadow);
shadow.generatedAt = new Date().toISOString();
shadow.mode = 'shadow';
shadow.status = 'ok';
shadow.semantics = { ...(shadow.semantics || {}), productionPriceAuthority: false };
shadow.authority = { ...(shadow.authority || {}), executionAuthority: 'none' };
shadow.observations = shadow.observations || {};
for (const id of promoted) {
  const override = policy.assetOverrides[id] || {};
  const reviewedReq = policy.reviewedPilot?.routeRequirements?.[id] || null;
  const base = shadow.observations[id] || {};
  const usd = Number(source.prices?.[id]?.usd);
  if (!(usd > 0)) throw new Error(`${id}: deterministic source price unavailable`);
  shadow.observations[id] = {
    ...base,
    ...(reviewedReq || {}),
    assetId: id,
    source: override.requiredObservationSource || reviewedReq?.source || base.source,
    status: 'shadow-ok',
    usd,
    productionPriceAuthority: false,
    ...(override.requiredDependencyStatus ? { dependencyStatus: override.requiredDependencyStatus } : {}),
    ...(override.requiredQuoteAssetId ? { quoteAssetId: override.requiredQuoteAssetId } : {}),
    ...(override.requiredFeedQuote ? { feedQuote: override.requiredFeedQuote } : {}),
    ...(override.requiredOutputQuote ? { outputQuote: override.requiredOutputQuote } : {})
  };
}

const nowMs = Date.parse(shadow.generatedAt);
const healthy = evaluateMarketDataAuthority({ policy, marketData: source, shadow, nowMs });
if (healthy.coverage.assetCount !== 26) throw new Error(`Expected 26 canonical selections, got ${healthy.coverage.assetCount}`);
if (healthy.coverage.onchainSelectedCount !== 26) throw new Error(`Healthy reviewed universe must select 26 onchain assets, got ${healthy.coverage.onchainSelectedCount}`);
if (healthy.coverage.coingeckoSelectedCount !== 0 || healthy.coverage.unknownCount !== 0 || healthy.coverage.fallbackCount !== 0) throw new Error('Healthy reviewed universe unexpectedly used fallback/unknown');
for (const id of promoted) {
  const row = healthy.selections[id];
  if (row.selectedLane !== 'onchain-shadow' || row.fallbackUsed) throw new Error(`${id}: healthy route did not select onchain primary`);
  if (!(Number(row.selected.usd) > 0)) throw new Error(`${id}: healthy route price invalid`);
}

// A daily CoinGecko sanity reference can legitimately drift away from a fresh
// onchain market. Divergence remains visible telemetry but must not demote a
// structurally healthy onchain-primary route.
const directDivergent = structuredClone(shadow);
directDivergent.observations.bitcoin = {
  ...directDivergent.observations.bitcoin,
  status: 'divergent',
  usd: Number(source.prices.bitcoin.usd) * 1.12,
  divergencePct: 12
};
const directDivergenceSelection = selectMarketDataAuthority({ policy, marketData: source, shadow: directDivergent, assetId: 'bitcoin', nowMs });
if (directDivergenceSelection.selectedLane !== 'onchain-shadow' || directDivergenceSelection.fallbackUsed) throw new Error('Fresh direct onchain divergence incorrectly failed back to CoinGecko');
if (directDivergenceSelection.onchainCandidate?.crossSourceDivergenceTelemetry !== true) throw new Error('Direct divergence telemetry marker missing');

const dependencyAsset = 'convex-finance';
const dependencyDivergent = structuredClone(shadow);
dependencyDivergent.observations[dependencyAsset] = {
  ...dependencyDivergent.observations[dependencyAsset],
  status: 'dependency-warning',
  dependencyStatus: 'divergent',
  usd: Number(source.prices[dependencyAsset].usd) * 1.08,
  divergencePct: 8
};
const dependencyDivergenceSelection = selectMarketDataAuthority({ policy, marketData: source, shadow: dependencyDivergent, assetId: dependencyAsset, nowMs });
if (dependencyDivergenceSelection.selectedLane !== 'onchain-shadow' || dependencyDivergenceSelection.fallbackUsed) throw new Error('Fresh dependency-only divergence incorrectly failed back to CoinGecko');
if (dependencyDivergenceSelection.onchainCandidate?.crossSourceDivergenceTelemetry !== true) throw new Error('Dependency divergence telemetry marker missing');

// Every canonical route must still fail back only to the cached daily CoinGecko lane when its
// own onchain observation is genuinely unhealthy. This proves a route incident cannot zero the site.
for (const id of promoted) {
  const unhealthy = structuredClone(shadow);
  unhealthy.observations[id] = { ...unhealthy.observations[id], status: 'rpc-unavailable', usd: null };
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: unhealthy, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane' || fallback.fallbackUsed !== true) throw new Error(`${id}: unhealthy route did not fail back to daily CoinGecko cache`);
  if (Number(fallback.selected.usd) !== Number(source.prices[id].usd)) throw new Error(`${id}: failback changed cached CoinGecko price`);
}

// Dependency-aware routes must reject real dependency failure, not just RPC failure.
for (const id of promoted.filter(id => policy.assetOverrides?.[id]?.requiredDependencyStatus)) {
  const badDependency = structuredClone(shadow);
  badDependency.observations[id] = { ...badDependency.observations[id], status: 'dependency-warning', dependencyStatus: 'rpc-unavailable' };
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: badDependency, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane' || fallback.fallbackUsed !== true) throw new Error(`${id}: dependency failure did not fail back`);
}

const staleShadow = structuredClone(shadow);
staleShadow.generatedAt = new Date(nowMs - (Number(policy.onchainEligibility.maxShadowSnapshotAgeSeconds) + 1) * 1000).toISOString();
for (const id of promoted) {
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: staleShadow, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane') throw new Error(`${id}: stale Shadow did not fail back`);
}

const invalidDirect = structuredClone(shadow);
invalidDirect.observations.bitcoin = { ...invalidDirect.observations.bitcoin, status: 'invalid', usd: null };
const invalidFallback = selectMarketDataAuthority({ policy, marketData: source, shadow: invalidDirect, assetId: 'bitcoin', nowMs });
if (invalidFallback.selectedLane !== 'coingecko-lane' || !invalidFallback.fallbackUsed) throw new Error('Invalid onchain price did not fail back');

const missingSource = structuredClone(source);
missingSource.prices.ethereum = { ...missingSource.prices.ethereum, usd: null, status: 'unknown', source: null };
const missingShadow = structuredClone(shadow);
missingShadow.observations.ethereum = { ...missingShadow.observations.ethereum, status: 'rpc-unavailable', usd: null };
const unknown = selectMarketDataAuthority({ policy, marketData: missingSource, shadow: missingShadow, assetId: 'ethereum', nowMs });
if (unknown.selectedLane !== 'unknown' || unknown.selected.usd !== null) throw new Error('No-source case must be unknown, never zero');

console.log('Market Data 26-asset reviewed onchain-primary selector validation PASS', {
  canonicalAssetCount: healthy.coverage.assetCount,
  onchainSelectedCount: healthy.coverage.onchainSelectedCount,
  coingeckoSelectedCount: healthy.coverage.coingeckoSelectedCount,
  dailyDivergenceTelemetryOnlyProven: true,
  directDivergenceKeepsOnchainAuthority: true,
  dependencyDivergenceKeepsOnchainAuthority: true,
  perAssetDailyFailbackProven: true,
  dependencyFailureFailbackProven: true,
  staleFailbackProven: true,
  invalidFailbackProven: true,
  unknownNeverZeroProven: true,
  executionAuthority: 'none'
});
