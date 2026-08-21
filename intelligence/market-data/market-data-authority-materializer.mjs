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
function sameAddress(a, b) { return String(a || '').toLowerCase() === String(b || '').toLowerCase(); }
function assertAddress(actual, expected, label) {
  // Some protocol adapters expose the verified factory/pool route but do not
  // duplicate token addresses into the observation payload. Validate any
  // emitted address exactly, while the source registry + CI bind the static
  // route definition for fields the runtime observation intentionally omits.
  if (expected && actual !== undefined && actual !== null && !sameAddress(actual, expected)) throw new Error(`${label} drift`);
}
function assertEqual(actual, expected, label) {
  if (expected !== undefined && actual !== expected) throw new Error(`${label} drift`);
}
function assertNumber(actual, expected, label) {
  if (expected !== undefined && Number(actual) !== Number(expected)) throw new Error(`${label} drift`);
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
const v3RelativeIds = [...(policy.v3RelativePilot?.assetIds || [])];
const reviewedIds = [...(policy.reviewedPilot?.assetIds || [])];
const promotedIds = [...directIds, ...relativeIds, ...v3RelativeIds, ...reviewedIds];
const overrideIds = Object.keys(policy.assetOverrides || {});

const exactDirect = ['bitcoin', 'ethereum', 'aerodrome-finance', 'pendle', 'curve-dao-token', 'frax-share', 'venice-token', 'internet-computer', 'decentraland', 'the-sandbox'];
const exactRelative = ['convex-finance'];
const exactV3Relative = ['ovr', 'beam-2', 'liquity', 'virtual-protocol', 'ondo-finance', 'zksync'];
const exactReviewed = ['tether-gold', 'fxn-token', 'yield-basis', 'velodrome-finance', 'resupply', 'autonolas', 'mode', 'elizaos', 'convex-crv'];
if (JSON.stringify(directIds) !== JSON.stringify(exactDirect)) throw new Error('Direct cohort drift');
if (JSON.stringify(relativeIds) !== JSON.stringify(exactRelative)) throw new Error('Relative cohort drift');
if (JSON.stringify(v3RelativeIds) !== JSON.stringify(exactV3Relative)) throw new Error('V3 relative cohort drift');
if (JSON.stringify(reviewedIds) !== JSON.stringify(exactReviewed)) throw new Error('Reviewed cohort drift');
if (new Set(promotedIds).size !== promotedIds.length) throw new Error('Promoted cohorts overlap');
if (overrideIds.length !== promotedIds.length || overrideIds.some(id => !promotedIds.includes(id))) throw new Error('Asset overrides must equal explicit promoted cohorts');
if (promotedIds.length !== 26) throw new Error(`Expected 26 explicitly reviewed canonical onchain assets, got ${promotedIds.length}`);
if (Number(policy.pilot?.maxPromotedAssetCount) !== 10 || Number(policy.relativePilot?.maxPromotedAssetCount) !== 1 || Number(policy.v3RelativePilot?.maxPromotedAssetCount) !== 6 || Number(policy.reviewedPilot?.maxPromotedAssetCount) !== 9) throw new Error('Promotion cap drift');

for (const assetId of directIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.pilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact direct route requirement missing`);
  assertEqual(observation?.source, policy.pilot.requiredRouteType, `${assetId}: direct source`);
  assertEqual(observation?.network, req.network, `${assetId}: direct network`);
  assertAddress(observation?.contract, req.contract, `${assetId}: direct contract`);
  assertEqual(observation?.quote, policy.pilot.requiredQuote, `${assetId}: direct quote`);
}

for (const assetId of relativeIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.relativePilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact relative route requirement missing`);
  assertEqual(observation?.source, policy.relativePilot.requiredRouteType, `${assetId}: relative source`);
  assertEqual(observation?.network, req.network, `${assetId}: relative network`);
  assertAddress(observation?.contract, req.contract, `${assetId}: relative contract`);
  assertEqual(observation?.feedQuote, policy.relativePilot.requiredFeedQuote, `${assetId}: feed quote`);
  assertEqual(observation?.quoteAssetId, policy.relativePilot.requiredQuoteAssetId, `${assetId}: quote asset`);
  assertEqual(observation?.outputQuote, policy.relativePilot.requiredOutputQuote, `${assetId}: output quote`);
}

for (const assetId of v3RelativeIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.v3RelativePilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact V3 route requirement missing`);
  assertEqual(observation?.source, policy.v3RelativePilot.requiredRouteType, `${assetId}: V3 source`);
  assertEqual(observation?.network, req.network, `${assetId}: V3 network`);
  assertAddress(observation?.factory, req.factory, `${assetId}: V3 factory`);
  assertAddress(observation?.token, req.token, `${assetId}: V3 token`);
  assertAddress(observation?.quoteToken, req.quoteToken, `${assetId}: V3 quote token`);
  assertNumber(observation?.fee, req.fee, `${assetId}: V3 fee`);
  assertNumber(observation?.twapWindowSeconds, req.twapWindowSeconds, `${assetId}: V3 window`);
  assertEqual(observation?.feedQuote, policy.v3RelativePilot.requiredFeedQuote, `${assetId}: V3 feed quote`);
  assertEqual(observation?.quoteAssetId, policy.v3RelativePilot.requiredQuoteAssetId, `${assetId}: V3 quote asset`);
  assertEqual(observation?.outputQuote, policy.v3RelativePilot.requiredOutputQuote, `${assetId}: V3 output quote`);
}

for (const assetId of reviewedIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.reviewedPilot?.routeRequirements?.[assetId];
  if (!observation || !req) throw new Error(`${assetId}: reviewed route evidence missing`);
  assertEqual(observation.source, req.source, `${assetId}: reviewed source`);
  assertEqual(observation.network, req.network, `${assetId}: reviewed network`);
  assertAddress(observation.factory, req.factory, `${assetId}: reviewed factory`);
  assertAddress(observation.token, req.token, `${assetId}: reviewed token`);
  assertAddress(observation.quoteToken, req.quoteToken, `${assetId}: reviewed quote token`);
  assertAddress(observation.pool, req.pool, `${assetId}: reviewed pool`);
  assertAddress(observation.pair, req.pair, `${assetId}: reviewed pair`);
  assertNumber(observation.fee, req.fee, `${assetId}: reviewed fee`);
  assertEqual(observation.quoteAssetId, req.quoteAssetId, `${assetId}: reviewed quote asset`);
  assertEqual(observation.feedQuote, req.feedQuote, `${assetId}: reviewed feed quote`);
  assertEqual(observation.outputQuote, req.outputQuote, `${assetId}: reviewed output quote`);
  if (req.dependencyStatus !== undefined) assertEqual(observation.dependencyStatus, req.dependencyStatus, `${assetId}: reviewed dependency`);
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
let v3RelativeOnchainSelectedAssetCount = 0;
let reviewedOnchainSelectedAssetCount = 0;
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
    if (v3RelativeIds.includes(assetId)) v3RelativeOnchainSelectedAssetCount += 1;
    if (reviewedIds.includes(assetId)) reviewedOnchainSelectedAssetCount += 1;
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

if (directOnchainSelectedAssetCount > 10 || relativeOnchainSelectedAssetCount > 1 || v3RelativeOnchainSelectedAssetCount > 6 || reviewedOnchainSelectedAssetCount > 9) throw new Error('Selected cohort cap exceeded');
if (onchainSelectedAssetCount > 26) throw new Error('Total onchain selected asset count exceeds canonical universe');
for (const assetId of Object.keys(prices)) {
  if (!promotedIds.includes(assetId)) throw new Error(`${assetId}: canonical asset missing explicit authority review`);
}
if (forceCoinGeckoFailback && onchainSelectedAssetCount !== 0) throw new Error('Cycle failback did not remove onchain selections');

const output = {
  ...source,
  version: '1.1-market-data-all-canonical-reviewed-onchain-primary',
  engineVersion: '1.1-per-asset-authority-materializer-26-reviewed-canonical-assets',
  generatedAt: new Date(nowMs).toISOString(),
  status: unknownCount > 0 ? 'partial' : fallbackCount > 0 ? 'fallback-active' : 'ok',
  semantics: {
    ...source.semantics,
    canonicalMirrorEqualsCoinGeckoSourceLane: false,
    perAssetAuthoritySelectionApplied: true,
    boundedOnchainPrimaryPilot: true,
    allCanonicalAssetsExplicitlyReviewedForOnchainPrimary: true,
    coinGeckoRemainsDailyFallbackAndSanityCheck: true,
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
    v3RelativePilotCohortId: policy.v3RelativePilot.cohortId,
    v3RelativePilotAssetIds: v3RelativeIds,
    reviewedPilotCohortId: policy.reviewedPilot.cohortId,
    reviewedPilotAssetIds: reviewedIds,
    onchainSelectedAssetCount,
    directOnchainSelectedAssetCount,
    relativeOnchainSelectedAssetCount,
    v3RelativeOnchainSelectedAssetCount,
    reviewedOnchainSelectedAssetCount,
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
  onchainSelectedAssetCount,
  directOnchainSelectedAssetCount,
  relativeOnchainSelectedAssetCount,
  v3RelativeOnchainSelectedAssetCount,
  reviewedOnchainSelectedAssetCount,
  coingeckoSelectedAssetCount,
  fallbackCount,
  unknownCount,
  forceCoinGeckoFailback,
  executionAuthority: 'none'
});
