import fs from 'node:fs';
import { evaluateMarketDataAuthority, selectMarketDataAuthority } from './market-data-authority-selector.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./market-data-authority-policy.json', import.meta.url), 'utf8'));
const source = JSON.parse(fs.readFileSync(new URL('./market-data-coingecko.json', import.meta.url), 'utf8'));
const shadow = JSON.parse(fs.readFileSync(new URL('./onchain-price-shadow.json', import.meta.url), 'utf8'));
const nowMs = Date.parse(shadow.generatedAt || source.generatedAt || new Date().toISOString());
const pilot = ['bitcoin', 'ethereum', 'aerodrome-finance', 'pendle'];

if (policy.mode !== 'bounded-production-pilot') throw new Error('Policy must be bounded production pilot');
if (policy.globalOnchainPromotionEnabled !== true) throw new Error('Pilot promotion gate must be enabled');
if (policy.semantics?.productionWriterIntegrationEnabled !== true) throw new Error('Pilot writer integration missing');
if (policy.defaultProductionAuthority !== 'coingecko-lane') throw new Error('CoinGecko must remain default authority');
if (policy.semantics?.automaticPolicyMutationAllowed !== false || policy.semantics?.automaticCohortExpansionAllowed !== false) throw new Error('Automatic cohort expansion enabled');
if (JSON.stringify(policy.pilot?.assetIds) !== JSON.stringify(pilot)) throw new Error('Pilot cohort must be exactly BTC + ETH + AERO + PENDLE');
if (Number(policy.pilot?.maxPromotedAssetCount) !== 4) throw new Error('Pilot cap must be 4');
if (policy.pilot?.requiredRouteType !== 'chainlink-v3' || policy.pilot?.requiredQuote !== 'USD') throw new Error('Pilot route contract must remain direct Chainlink/USD');
if (JSON.stringify(Object.keys(policy.assetOverrides || {}).sort()) !== JSON.stringify([...pilot].sort())) throw new Error('Asset overrides exceed pilot cohort');

for (const id of pilot) {
  const obs = shadow.observations?.[id];
  const req = policy.pilot?.routeRequirements?.[id];
  if (!obs || !req) throw new Error(`${id}: route evidence missing`);
  if (obs.source !== 'chainlink-v3' || obs.network !== req.network || obs.quote !== 'USD') throw new Error(`${id}: route requirement drift`);
  if (String(obs.contract || '').toLowerCase() !== String(req.contract || '').toLowerCase()) throw new Error(`${id}: exact feed contract drift`);
}

const healthy = evaluateMarketDataAuthority({ policy, marketData: source, shadow, nowMs });
if (healthy.coverage.assetCount !== Object.keys(source.prices || {}).length) throw new Error('Authority evaluator coverage drift');
if (healthy.coverage.onchainSelectedCount !== 4) throw new Error('Healthy pilot must select exactly 4 direct-oracle assets onchain');
if (healthy.coverage.coingeckoSelectedCount !== healthy.coverage.assetCount - 4) throw new Error('Non-pilot assets must remain CoinGecko');
if (healthy.coverage.unknownCount !== 0) throw new Error('Healthy pilot introduced unknown prices');
for (const id of pilot) {
  const row = healthy.selections[id];
  if (row.selectedLane !== 'onchain-shadow' || row.fallbackUsed) throw new Error(`${id}: healthy pilot did not select onchain primary`);
  if (!(Number(row.selected.usd) > 0)) throw new Error(`${id}: invalid onchain price`);
}
for (const id of Object.keys(source.prices || {})) {
  if (!pilot.includes(id) && healthy.selections[id]?.selectedLane !== 'coingecko-lane') throw new Error(`${id}: non-pilot asset left CoinGecko lane`);
}

for (const id of pilot) {
  const unhealthyShadow = structuredClone(shadow);
  unhealthyShadow.observations[id] = { ...unhealthyShadow.observations[id], status: 'rpc-unavailable', usd: null };
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: unhealthyShadow, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane' || fallback.fallbackUsed !== true) throw new Error(`${id}: unhealthy onchain did not fail back to CoinGecko`);
  if (Number(fallback.selected.usd) !== Number(source.prices[id].usd)) throw new Error(`${id}: failback changed CoinGecko price`);
}

const staleShadow = structuredClone(shadow);
staleShadow.generatedAt = new Date(nowMs - (Number(policy.onchainEligibility.maxShadowSnapshotAgeSeconds) + 1) * 1000).toISOString();
for (const id of pilot) {
  const fallback = selectMarketDataAuthority({ policy, marketData: source, shadow: staleShadow, assetId: id, nowMs });
  if (fallback.selectedLane !== 'coingecko-lane') throw new Error(`${id}: stale shadow did not fail back`);
}

const missingSource = structuredClone(source);
missingSource.prices.ethereum = { ...missingSource.prices.ethereum, usd: null, status: 'unknown', source: null };
const missingShadow = structuredClone(shadow);
missingShadow.observations.ethereum = { ...missingShadow.observations.ethereum, status: 'rpc-unavailable', usd: null };
const unknown = selectMarketDataAuthority({ policy, marketData: missingSource, shadow: missingShadow, assetId: 'ethereum', nowMs });
if (unknown.selectedLane !== 'unknown' || unknown.selected.usd !== null) throw new Error('No-source case must be unknown, never zero');

console.log('Market Data bounded direct-oracle cohort validation PASS', {
  assetCount: healthy.coverage.assetCount,
  pilot,
  onchainSelectedCount: healthy.coverage.onchainSelectedCount,
  coingeckoSelectedCount: healthy.coverage.coingeckoSelectedCount,
  failbackToCoinGeckoProven: true,
  staleFailbackProven: true,
  unknownNeverZeroProven: true
});
