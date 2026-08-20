import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateMarketDataAuthority } from './market-data-authority-selector.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PATHS = {
  policy: path.join(__dirname, 'market-data-authority-policy.json'),
  source: path.join(__dirname, 'market-data-coingecko.json'),
  shadow: path.join(__dirname, 'onchain-price-shadow.json'),
  output: path.join(__dirname, 'market-data.json')
};
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const policy = readJson(PATHS.policy);
const source = readJson(PATHS.source);
const rawShadow = readJson(PATHS.shadow);
const forceCoinGeckoFailback = String(process.env.MARKET_DATA_FORCE_COINGECKO_FAILBACK || '').toLowerCase() === 'true';
const shadow = forceCoinGeckoFailback ? structuredClone(rawShadow) : rawShadow;
const nowMs = Date.now();

if (policy.mode !== 'bounded-production-pilot') throw new Error('Authority materializer requires bounded-production-pilot mode');
if (policy.defaultProductionAuthority !== 'coingecko-lane') throw new Error('Default authority must remain CoinGecko lane');
if (policy.semantics?.productionWriterIntegrationEnabled !== true) throw new Error('Production writer integration is not enabled');
if (policy.semantics?.automaticPolicyMutationAllowed !== false || policy.semantics?.automaticCohortExpansionAllowed !== false) throw new Error('Automatic authority expansion is forbidden');
if (policy.semantics?.executionAuthority !== 'none') throw new Error('Execution authority drift');

const directIds = [...(policy.pilot?.assetIds || [])];
const relativeIds = [...(policy.relativePilot?.assetIds || [])];
const promotedIds = [...directIds, ...relativeIds];
const overrideIds = Object.keys(policy.assetOverrides || {});
const exactDirect = ['bitcoin', 'ethereum', 'aerodrome-finance', 'pendle', 'curve-dao-token', 'frax-share', 'venice-token', 'internet-computer', 'decentraland', 'the-sandbox'];
const exactRelative = ['convex-finance'];
if (JSON.stringify(directIds) !== JSON.stringify(exactDirect)) throw new Error('Direct cohort must remain exactly BTC + ETH + AERO + PENDLE + CRV + FXS + VVV + ICP + MANA + SAND');
if (JSON.stringify(relativeIds) !== JSON.stringify(exactRelative)) throw new Error('Relative cohort must be exactly CVX');
if (new Set(promotedIds).size !== promotedIds.length) throw new Error('Promoted cohorts overlap');
if (overrideIds.length !== promotedIds.length || overrideIds.some(id => !promotedIds.includes(id))) throw new Error('Asset overrides exceed bounded promoted cohorts');
if (Number(policy.pilot?.maxPromotedAssetCount) !== 10) throw new Error('Direct cohort promotion cap drift');
if (Number(policy.relativePilot?.maxPromotedAssetCount) !== 1) throw new Error('Relative cohort promotion cap drift');
if (policy.pilot?.requiredRouteType !== 'chainlink-v3' || policy.pilot?.requiredQuote !== 'USD') throw new Error('Direct cohort must remain direct Chainlink/USD only');
if (policy.relativePilot?.requiredRouteType !== 'chainlink-v3-relative' || policy.relativePilot?.requiredFeedQuote !== 'ETH' || policy.relativePilot?.requiredQuoteAssetId !== 'ethereum' || policy.relativePilot?.requiredOutputQuote !== 'USD' || policy.relativePilot?.requiredDependencyStatus !== 'shadow-ok') throw new Error('Relative CVX route contract drift');

for (const assetId of directIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.pilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact direct route requirement missing`);
  if (observation?.source !== policy.pilot.requiredRouteType) throw new Error(`${assetId}: direct route type drift`);
  if (observation?.network !== req.network) throw new Error(`${assetId}: direct network drift`);
  if (String(observation?.contract || '').toLowerCase() !== String(req.contract || '').toLowerCase()) throw new Error(`${assetId}: direct feed contract drift`);
  if (observation?.quote !== policy.pilot.requiredQuote) throw new Error(`${assetId}: direct quote drift`);
}

for (const assetId of relativeIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.relativePilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact relative route requirement missing`);
  if (observation?.source !== policy.relativePilot.requiredRouteType) throw new Error(`${assetId}: relative route type drift`);
  if (observation?.network !== req.network) throw new Error(`${assetId}: relative network drift`);
  if (String(observation?.contract || '').toLowerCase() !== String(req.contract || '').toLowerCase()) throw new Error(`${assetId}: relative feed contract drift`);
  if (observation?.feedQuote !== policy.relativePilot.requiredFeedQuote) throw new Error(`${assetId}: relative feed quote drift`);
  if (observation?.quoteAssetId !== policy.relativePilot.requiredQuoteAssetId) throw new Error(`${assetId}: relative dependency asset drift`);
  if (observation?.outputQuote !== policy.relativePilot.requiredOutputQuote) throw new Error(`${assetId}: relative output quote drift`);
}

if (forceCoinGeckoFailback) {
  for (const assetId of promotedIds) {
    const observation = shadow?.observations?.[assetId];
    shadow.observations[assetId] = { ...observation, status: 'cycle-forced-failback', usd: null };
  }
}

const evaluation = evaluateMarketDataAuthority({ policy, marketData: source, shadow, nowMs });
const prices = {};
let onchainSelectedAssetCount = 0;
let directOnchainSelectedAssetCount = 0;
let relativeOnchainSelectedAssetCount = 0;
let coingeckoSelectedAssetCount = 0;
let fallbackCount = 0;
let unknownCount = 0;

for (const [assetId, sourceRow] of Object.entries(source.prices || {})) {
  const selection = evaluation.selections?.[assetId];
  if (!selection) throw new Error(`${assetId}: authority selection missing`);
  if (selection.selectedLane === 'onchain-shadow') {
    const usd = finite(selection.selected?.usd);
    if (!(usd > 0)) throw new Error(`${assetId}: selected onchain price invalid`);
    prices[assetId] = {
      ...sourceRow,
      usd,
      status: 'fresh',
      observedAt: selection.selected?.observedAt || rawShadow.generatedAt || null,
      source: `onchain-${selection.selected?.source || 'unknown'}`,
      authority: { requestedPrimary: selection.requestedPrimary, selectedLane: 'onchain', fallbackUsed: false, sourceSnapshotGeneratedAt: rawShadow.generatedAt || null }
    };
    onchainSelectedAssetCount += 1;
    if (directIds.includes(assetId)) directOnchainSelectedAssetCount += 1;
    if (relativeIds.includes(assetId)) relativeOnchainSelectedAssetCount += 1;
  } else if (selection.selectedLane === 'coingecko-lane') {
    prices[assetId] = {
      ...sourceRow,
      authority: { requestedPrimary: selection.requestedPrimary, selectedLane: 'coingecko-lane', fallbackUsed: selection.fallbackUsed === true, sourceSnapshotGeneratedAt: source.generatedAt || null }
    };
    coingeckoSelectedAssetCount += 1;
    if (selection.fallbackUsed) fallbackCount += 1;
  } else {
    prices[assetId] = {
      ...sourceRow,
      usd: null,
      status: 'unknown',
      observedAt: null,
      source: null,
      authority: { requestedPrimary: selection.requestedPrimary, selectedLane: 'unknown', fallbackUsed: true, sourceSnapshotGeneratedAt: null }
    };
    unknownCount += 1;
    fallbackCount += 1;
  }
}

if (directOnchainSelectedAssetCount > Number(policy.pilot.maxPromotedAssetCount)) throw new Error('Direct selected asset count exceeds direct cap');
if (relativeOnchainSelectedAssetCount > Number(policy.relativePilot.maxPromotedAssetCount)) throw new Error('Relative selected asset count exceeds relative cap');
if (onchainSelectedAssetCount > Number(policy.pilot.maxPromotedAssetCount) + Number(policy.relativePilot.maxPromotedAssetCount)) throw new Error('Total onchain selected asset count exceeds combined cap');
for (const assetId of Object.keys(prices)) {
  if (!promotedIds.includes(assetId) && prices[assetId]?.authority?.selectedLane !== 'coingecko-lane') throw new Error(`${assetId}: non-promoted asset left CoinGecko lane`);
}
if (forceCoinGeckoFailback && onchainSelectedAssetCount !== 0) throw new Error('Cycle failback did not remove onchain selections');

const output = {
  ...source,
  version: '0.9-market-data-bounded-direct-plus-relative-chainlink',
  engineVersion: '0.9-per-asset-authority-materializer-direct10-plus-cvx-relative',
  generatedAt: new Date(nowMs).toISOString(),
  status: unknownCount > 0 ? 'partial' : fallbackCount > 0 ? 'fallback-active' : 'ok',
  semantics: {
    ...source.semantics,
    canonicalMirrorEqualsCoinGeckoSourceLane: false,
    perAssetAuthoritySelectionApplied: true,
    boundedOnchainPrimaryPilot: true,
    directChainlinkUsdCohortRetained: true,
    relativeChainlinkPilotEnabled: true,
    dependencyAwareEligibility: true,
    coinGeckoRemainsFallbackAndSanityCheck: true,
    automaticCohortExpansionAllowed: false,
    cycleForcedCoinGeckoFailback: forceCoinGeckoFailback,
    unknownIsNotZero: true
  },
  prices,
  authority: {
    productionPriceLane: 'per-asset',
    defaultProductionAuthority: 'coingecko-lane',
    pilotCohortId: policy.pilot.cohortId,
    pilotAssetIds: directIds,
    relativePilotCohortId: policy.relativePilot.cohortId,
    relativePilotAssetIds: relativeIds,
    onchainSelectedAssetCount,
    directOnchainSelectedAssetCount,
    relativeOnchainSelectedAssetCount,
    coingeckoSelectedAssetCount,
    fallbackCount,
    unknownCount,
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false
  },
  sourceState: {
    coinGeckoGeneratedAt: source.generatedAt || null,
    onchainShadowGeneratedAt: rawShadow.generatedAt || null,
    onchainShadowStatus: rawShadow.status || null,
    forceCoinGeckoFailback
  }
};

fs.writeFileSync(PATHS.output, JSON.stringify(output, null, 2) + '\n');
console.log('Market Data authority materialized', {
  directPilotAssetIds: directIds,
  relativePilotAssetIds: relativeIds,
  onchainSelectedAssetCount,
  directOnchainSelectedAssetCount,
  relativeOnchainSelectedAssetCount,
  coingeckoSelectedAssetCount,
  fallbackCount,
  unknownCount,
  forceCoinGeckoFailback,
  executionAuthority: 'none'
});
