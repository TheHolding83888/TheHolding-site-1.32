import fs from 'node:fs';
import { evaluateMarketDataAuthority, selectMarketDataAuthority } from './market-data-authority-selector.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./market-data-authority-policy.json', import.meta.url), 'utf8'));
const marketData = JSON.parse(fs.readFileSync(new URL('./market-data.json', import.meta.url), 'utf8'));
const shadow = JSON.parse(fs.readFileSync(new URL('./onchain-price-shadow.json', import.meta.url), 'utf8'));
const nowMs = Date.parse(shadow.generatedAt || marketData.generatedAt || new Date().toISOString());

if (policy.mode !== 'framework-dry-run') throw new Error('Policy mode drift');
if (policy.globalOnchainPromotionEnabled !== false) throw new Error('Global onchain promotion must remain disabled in Stage 1');
if (policy.semantics?.productionWriterIntegrationEnabled !== false) throw new Error('Stage 1 must not integrate with production writer');
if (policy.defaultProductionAuthority !== 'coingecko-lane') throw new Error('CoinGecko lane must remain default production authority in Stage 1');
if (Object.keys(policy.assetOverrides || {}).length !== 0) throw new Error('Stage 1 policy must contain zero promoted assets');

const baseline = evaluateMarketDataAuthority({ policy, marketData, shadow, nowMs });
const marketIds = Object.keys(marketData.prices || {});
if (baseline.coverage.assetCount !== marketIds.length) throw new Error('Authority evaluator coverage drift');
if (baseline.coverage.onchainSelectedCount !== 0) throw new Error('Stage 1 must select zero onchain production prices');
if (baseline.coverage.coingeckoSelectedCount !== marketIds.length) throw new Error('Stage 1 must preserve all current canonical Market Data selections');
if (baseline.coverage.unknownCount !== 0) throw new Error('Stage 1 baseline introduced unknown prices');
for (const assetId of marketIds) {
  const selected = baseline.selections[assetId];
  const canonical = marketData.prices[assetId];
  if (selected.selectedLane !== 'coingecko-lane') throw new Error(`${assetId}: baseline authority changed`);
  if (Number(selected.selected.usd) !== Number(canonical.usd)) throw new Error(`${assetId}: baseline price changed`);
  if (selected.selected.source !== canonical.source) throw new Error(`${assetId}: baseline source provenance changed`);
}

const testAsset = 'ethereum';
if (shadow.observations?.[testAsset]?.status !== 'shadow-ok') throw new Error('Validation fixture requires healthy ETH shadow observation');
const promotedPolicy = structuredClone(policy);
promotedPolicy.globalOnchainPromotionEnabled = true;
promotedPolicy.assetOverrides[testAsset] = { requestedPrimary: 'onchain' };
const promoted = selectMarketDataAuthority({ policy: promotedPolicy, marketData, shadow, assetId: testAsset, nowMs });
if (promoted.selectedLane !== 'onchain-shadow') throw new Error('Healthy promoted onchain lane was not selected');
if (promoted.fallbackUsed !== false) throw new Error('Healthy promoted onchain lane incorrectly marked fallback');

const unhealthyShadow = structuredClone(shadow);
unhealthyShadow.observations[testAsset] = { ...unhealthyShadow.observations[testAsset], status: 'rpc-unavailable', usd: null };
const fallback = selectMarketDataAuthority({ policy: promotedPolicy, marketData, shadow: unhealthyShadow, assetId: testAsset, nowMs });
if (fallback.selectedLane !== 'coingecko-lane' || fallback.fallbackUsed !== true) throw new Error('Unhealthy onchain primary did not fail over to CoinGecko lane');
if (Number(fallback.selected.usd) !== Number(marketData.prices[testAsset].usd)) throw new Error('Fallback changed canonical CoinGecko price');

const staleShadow = structuredClone(shadow);
staleShadow.generatedAt = new Date(nowMs - (Number(policy.onchainEligibility.maxShadowSnapshotAgeSeconds) + 1) * 1000).toISOString();
const staleFallback = selectMarketDataAuthority({ policy: promotedPolicy, marketData, shadow: staleShadow, assetId: testAsset, nowMs });
if (staleFallback.selectedLane !== 'coingecko-lane') throw new Error('Stale onchain snapshot did not fail over to CoinGecko lane');

const missingBothMarket = structuredClone(marketData);
missingBothMarket.prices[testAsset] = { ...missingBothMarket.prices[testAsset], usd: null, status: 'unknown', source: null };
const missingBothShadow = structuredClone(unhealthyShadow);
const unknown = selectMarketDataAuthority({ policy: promotedPolicy, marketData: missingBothMarket, shadow: missingBothShadow, assetId: testAsset, nowMs });
if (unknown.selectedLane !== 'unknown' || unknown.selected.usd !== null) throw new Error('No-source case must terminate as unknown, never zero');

const disabledPromotionPolicy = structuredClone(policy);
disabledPromotionPolicy.assetOverrides[testAsset] = { requestedPrimary: 'onchain' };
let blocked = false;
try { selectMarketDataAuthority({ policy: disabledPromotionPolicy, marketData, shadow, assetId: testAsset, nowMs }); }
catch { blocked = true; }
if (!blocked) throw new Error('Per-asset promotion bypassed disabled global gate');

console.log('Market Data authority promotion framework Stage 1 PASS', {
  assetCount: baseline.coverage.assetCount,
  productionAuthorityChanged: false,
  onchainSelectedCount: baseline.coverage.onchainSelectedCount,
  coingeckoSelectedCount: baseline.coverage.coingeckoSelectedCount,
  failoverToCoinGeckoProven: true,
  staleShadowFailoverProven: true,
  unknownNeverZeroProven: true,
  globalGateProven: true
});
