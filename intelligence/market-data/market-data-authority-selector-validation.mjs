import fs from 'node:fs';
import { evaluateMarketDataAuthority, selectMarketDataAuthority } from './market-data-authority-selector.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./market-data-authority-policy.json', import.meta.url), 'utf8'));
const source = JSON.parse(fs.readFileSync(new URL('./market-data-coingecko.json', import.meta.url), 'utf8'));
const shadow = JSON.parse(fs.readFileSync(new URL('./onchain-price-shadow.json', import.meta.url), 'utf8'));
const nowMs = Date.parse(shadow.generatedAt || source.generatedAt || new Date().toISOString());
const direct = ['bitcoin', 'ethereum', 'aerodrome-finance', 'pendle', 'curve-dao-token', 'frax-share', 'venice-token', 'internet-computer', 'decentraland', 'the-sandbox'];
const relative = ['convex-finance'];
const promoted = [...direct, ...relative];

if (policy.mode !== 'bounded-production-pilot') throw new Error('Policy must be bounded production pilot');
if (policy.globalOnchainPromotionEnabled !== true) throw new Error('Pilot promotion gate must be enabled');
if (policy.semantics?.productionWriterIntegrationEnabled !== true) throw new Error('Pilot writer integration missing');
if (policy.defaultProductionAuthority !== 'coingecko-lane') throw new Error('CoinGecko must remain default authority');
if (policy.semantics?.automaticPolicyMutationAllowed !== false || policy.semantics?.automaticCohortExpansionAllowed !== false) throw new Error('Automatic cohort expansion enabled');
if (JSON.stringify(policy.pilot?.assetIds) !== JSON.stringify(direct)) throw new Error('Direct cohort drift');
if (Number(policy.pilot?.maxPromotedAssetCount) !== 10) throw new Error('Direct cohort cap must be 10');
if (policy.pilot?.requiredRouteType !== 'chainlink-v3' || policy.pilot?.requiredQuote !== 'USD') throw new Error('Direct cohort must remain direct Chainlink/USD');
if (JSON.stringify(policy.relativePilot?.assetIds) !== JSON.stringify(relative)) throw new Error('Relative cohort must be exactly CVX');
if (Number(policy.relativePilot?.maxPromotedAssetCount) !== 1) throw new Error('Relative cohort cap must be 1');
if (policy.relativePilot?.requiredRouteType !== 'chainlink-v3-relative' || policy.relativePilot?.requiredFeedQuote !== 'ETH' || policy.relativePilot?.requiredQuoteAssetId !== 'ethereum' || policy.relativePilot?.requiredOutputQuote !== 'USD' || policy.relativePilot?.requiredDependencyStatus !== 'shadow-ok') throw new Error('Relative CVX route contract drift');
if (JSON.stringify(Object.keys(policy.assetOverrides || {}).sort()) !== JSON.stringify([...promoted].sort())) throw new Error('Asset overrides exceed bounded promoted cohorts');

for (const id of direct) {
  const obs = shadow.observations?.[id];
  const req = policy.pilot?.routeRequirements?.[id];
  if (!obs || !req) throw new Error(`${id}: direct route evidence missing`);
  if (obs.source !== 'chainlink-v3' || obs.network !== req.network || obs.quote !== 'USD') throw new Error(`${id}: direct route requirement drift`);
  if (String(obs.contract || '').toLowerCase() !== String(req.contract || '').toLowerCase()) throw new Error(`${id}: exact direct feed contract drift`);
}

for (const id of relative) {
  const obs = shadow.observations?.[id];
  const req = policy.relativePilot?.routeRequirements?.[id];
  if (!obs || !req) throw new Error(`${id}: relative route evidence missing`);
  if (obs.source !== 'chainlink-v3-relative' || obs.network !== req.network) throw new Error(`${id}: relative route requirement drift`);
  if (String(obs.contract || '').toLowerCase() !== String(req.contract || '').toLowerCase()) throw new Error(`${id}: exact relative feed contract drift`);
  if (obs.feedQuote !== 'ETH' || obs.quoteAssetId !== 'ethereum' || obs.outputQuote !== 'USD' || obs.dependencyStatus !== 'shadow-ok') throw new Error(`${id}: relative dependency contract drift`);
}

const healthy = evaluateMarketDataAuthority({ policy, marketData: source, shadow, nowMs });
if (healthy.coverage.assetCount !== Object.keys(source.prices || {}).length) throw new Error('Authority evaluator coverage drift');
if (healthy.coverage.onchainSelectedCount !== 11) throw new Error('Healthy bounded cohorts must select exactly 11 onchain assets');
if (healthy.coverage.coingeckoSelectedCount !== healthy.coverage.assetCount - 11) throw new Error('Non-promoted assets must remain CoinGecko');
if (healthy.coverage.unknownCount !== 0) throw new Error('Healthy cohorts introduced unknown prices');
for (const id of promoted) {
  const row = healthy.selections[id];
  if (row.selectedLane !== 'onchain-shadow' || row.fallbackUsed) throw new Error(`${id}: healthy cohort did not select onchain primary`);
  if (!(Number(row.selected.usd) > 0)) throw new Error(`${id}: invalid onchain price`);
}
for (const id of Object.keys(source.prices || {})) {
  if (!promoted.includes(id) && healthy.selections[id]?.selectedLane !== 'coingecko-lane') throw new Error(`${id}: non-promoted asset left CoinGecko lane`);
}

for (const id of direct) {
  const unhealthyShadow = structuredClone(shadow);
  unhealthyShadow.observations[id] = { ...unhealthyShadow.observations[id], status: 'rpc-unavailable', usd: null };
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: unhealthyShadow, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane' || fallback.fallbackUsed !== true) throw new Error(`${id}: unhealthy direct onchain did not fail back to CoinGecko`);
  if (Number(fallback.selected.usd) !== Number(source.prices[id].usd)) throw new Error(`${id}: direct failback changed CoinGecko price`);
}

const cvxUnhealthy = structuredClone(shadow);
cvxUnhealthy.observations['convex-finance'] = { ...cvxUnhealthy.observations['convex-finance'], status: 'rpc-unavailable', usd: null };
const cvxFeedFallback = selectMarketDataAuthority({ policy, marketData: source, shadow: cvxUnhealthy, assetId: 'convex-finance', nowMs });
if (cvxFeedFallback.selectedLane !== 'coingecko-lane' || cvxFeedFallback.fallbackUsed !== true) throw new Error('CVX feed failure did not fail back to CoinGecko');

for (const mutation of [
  { field: 'dependencyStatus', value: 'rpc-unavailable', label: 'dependency status' },
  { field: 'quoteAssetId', value: 'bitcoin', label: 'quote asset' },
  { field: 'feedQuote', value: 'USD', label: 'feed quote' },
  { field: 'outputQuote', value: 'ETH', label: 'output quote' },
  { field: 'source', value: 'chainlink-v3', label: 'source type' }
]) {
  const badShadow = structuredClone(shadow);
  badShadow.observations['convex-finance'] = { ...badShadow.observations['convex-finance'], [mutation.field]: mutation.value };
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: badShadow, assetId: 'convex-finance', nowMs });
  if (fallback.selectedLane !== 'coingecko-lane' || fallback.fallbackUsed !== true) throw new Error(`CVX ${mutation.label} drift did not fail back to CoinGecko`);
}

const staleShadow = structuredClone(shadow);
staleShadow.generatedAt = new Date(nowMs - (Number(policy.onchainEligibility.maxShadowSnapshotAgeSeconds) + 1) * 1000).toISOString();
for (const id of promoted) {
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: staleShadow, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane') throw new Error(`${id}: stale shadow did not fail back`);
}

const missingSource = structuredClone(source);
missingSource.prices.ethereum = { ...missingSource.prices.ethereum, usd: null, status: 'unknown', source: null };
const missingShadow = structuredClone(shadow);
missingShadow.observations.ethereum = { ...missingShadow.observations.ethereum, status: 'rpc-unavailable', usd: null };
const unknown = selectMarketDataAuthority({ policy, marketData: missingSource, shadow: missingShadow, assetId: 'ethereum', nowMs });
if (unknown.selectedLane !== 'unknown' || unknown.selected.usd !== null) throw new Error('No-source case must be unknown, never zero');

console.log('Market Data bounded direct + relative Chainlink cohort validation PASS', {
  assetCount: healthy.coverage.assetCount,
  direct,
  relative,
  onchainSelectedCount: healthy.coverage.onchainSelectedCount,
  coingeckoSelectedCount: healthy.coverage.coingeckoSelectedCount,
  dependencyAwareCvxFailbackProven: true,
  staleFailbackProven: true,
  unknownNeverZeroProven: true
});
