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
const promotedIds = [...directIds, ...relativeIds, ...v3RelativeIds];
const overrideIds = Object.keys(policy.assetOverrides || {});
const exactDirect = ['bitcoin', 'ethereum', 'aerodrome-finance', 'pendle', 'curve-dao-token', 'frax-share', 'venice-token', 'internet-computer', 'decentraland', 'the-sandbox'];
const exactRelative = ['convex-finance'];
const exactV3Relative = ['ovr', 'beam-2', 'liquity', 'virtual-protocol', 'ondo-finance', 'zksync'];
if (JSON.stringify(directIds) !== JSON.stringify(exactDirect)) throw new Error('Direct cohort must remain exactly BTC + ETH + AERO + PENDLE + CRV + FXS + VVV + ICP + MANA + SAND');
if (JSON.stringify(relativeIds) !== JSON.stringify(exactRelative)) throw new Error('Relative cohort must be exactly CVX');
if (JSON.stringify(v3RelativeIds) !== JSON.stringify(exactV3Relative)) throw new Error('V3 relative cohort must remain exactly OVR + BEAM + LQTY + VIRTUAL + ONDO + ZK');
if (new Set(promotedIds).size !== promotedIds.length) throw new Error('Promoted cohorts overlap');
if (overrideIds.length !== promotedIds.length || overrideIds.some(id => !promotedIds.includes(id))) throw new Error('Asset overrides exceed bounded promoted cohorts');
if (Number(policy.pilot?.maxPromotedAssetCount) !== 10) throw new Error('Direct cohort promotion cap drift');
if (Number(policy.relativePilot?.maxPromotedAssetCount) !== 1) throw new Error('Relative cohort promotion cap drift');
if (Number(policy.v3RelativePilot?.maxPromotedAssetCount) !== 6) throw new Error('V3 relative cohort promotion cap drift');
if (policy.pilot?.requiredRouteType !== 'chainlink-v3' || policy.pilot?.requiredQuote !== 'USD') throw new Error('Direct cohort must remain direct Chainlink/USD only');
if (policy.relativePilot?.requiredRouteType !== 'chainlink-v3-relative' || policy.relativePilot?.requiredFeedQuote !== 'ETH' || policy.relativePilot?.requiredQuoteAssetId !== 'ethereum' || policy.relativePilot?.requiredOutputQuote !== 'USD' || policy.relativePilot?.requiredDependencyStatus !== 'shadow-ok') throw new Error('Relative CVX route contract drift');
if (policy.v3RelativePilot?.requiredRouteType !== 'uniswap-v3-twap-relative' || policy.v3RelativePilot?.requiredFeedQuote !== 'ETH' || policy.v3RelativePilot?.requiredQuoteAssetId !== 'ethereum' || policy.v3RelativePilot?.requiredOutputQuote !== 'USD' || policy.v3RelativePilot?.requiredDependencyStatus !== 'shadow-ok') throw new Error('V3 relative route contract drift');

for (const assetId of directIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.pilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact direct route requirement missing`);
  if (observation?.source !== policy.pilot.requiredRouteType) throw new Error(`${assetId}: direct route type drift`);
  if (observation?.network !== req.network) throw new Error(`${assetId}: direct network drift`);
  if (!sameAddress(observation?.contract, req.contract)) throw new Error(`${assetId}: direct feed contract drift`);
  if (observation?.quote !== policy.pilot.requiredQuote) throw new Error(`${assetId}: direct quote drift`);
}

for (const assetId of relativeIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.relativePilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact relative route requirement missing`);
  if (observation?.source !== policy.relativePilot.requiredRouteType) throw new Error(`${assetId}: relative route type drift`);
  if (observation?.network !== req.network) throw new Error(`${assetId}: relative network drift`);
  if (!sameAddress(observation?.contract, req.contract)) throw new Error(`${assetId}: relative feed contract drift`);
  if (observation?.feedQuote !== policy.relativePilot.requiredFeedQuote) throw new Error(`${assetId}: relative feed quote drift`);
  if (observation?.quoteAssetId !== policy.relativePilot.requiredQuoteAssetId) throw new Error(`${assetId}: relative dependency asset drift`);
  if (observation?.outputQuote !== policy.relativePilot.requiredOutputQuote) throw new Error(`${assetId}: relative output quote drift`);
}

for (const assetId of v3RelativeIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.v3RelativePilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact V3 relative route requirement missing`);
  if (observation?.source !== policy.v3RelativePilot.requiredRouteType) throw new Error(`${assetId}: V3 relative route type drift`);
  if (observation?.network !== req.network) throw new Error(`${assetId}: V3 relative network drift`);
  if (!sameAddress(observation?.factory, req.factory)) throw new Error(`${assetId}: V3 relative factory drift`);
  if (!sameAddress(observation?.token, req.token)) throw new Error(`${assetId}: V3 relative token drift`);
  if (!sameAddress(observation?.quoteToken, req.quoteToken)) throw new Error(`${assetId}: V3 relative quote token drift`);
  if (Number(observation?.fee) !== Number(req.fee)) throw new Error(`${assetId}: V3 relative fee drift`);
  if (Number(observation?.twapWindowSeconds) !== Number(req.twapWindowSeconds)) throw new Error(`${assetId}: V3 relative TWAP window drift`);
  if (observation?.feedQuote !== policy.v3RelativePilot.requiredFeedQuote) throw new Error(`${assetId}: V3 relative feed quote drift`);
  if (observation?.quoteAssetId !== policy.v3RelativePilot.requiredQuoteAssetId) throw new Error(`${assetId}: V3 relative dependency asset drift`);
  if (observation?.outputQuote !== policy.v3RelativePilot.requiredOutputQuote) throw new Error(`${assetId}: V3 relative output quote drift`);
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
if (v3RelativeOnchainSelectedAssetCount > Number(policy.v3RelativePilot.maxPromotedAssetCount)) throw new Error('V3 relative selected asset count exceeds V3 relative cap');
const totalCap = Number(policy.pilot.maxPromotedAssetCount) + Number(policy.relativePilot.maxPromotedAssetCount) + Number(policy.v3RelativePilot.maxPromotedAssetCount);
if (onchainSelectedAssetCount > totalCap) throw new Error('Total onchain selected asset count exceeds combined cap');
for (const assetId of Object.keys(prices)) {
  if (!promotedIds.includes(assetId) && prices[assetId]?.authority?.selectedLane !== 'coingecko-lane') throw new Error(`${assetId}: non-promoted asset left CoinGecko lane`);
}
if (forceCoinGeckoFailback && onchainSelectedAssetCount !== 0) throw new Error('Cycle failback did not remove onchain selections');

const output = {
  ...source,
  version: '1.0-market-data-bounded-direct-plus-relative-plus-v3-relative',
  engineVersion: '1.0-per-asset-authority-materializer-direct10-cvx1-v3relative6',
  generatedAt: new Date(nowMs).toISOString(),
  status: unknownCount > 0 ? 'partial' : fallbackCount > 0 ? 'fallback-active' : 'ok',
  semantics: {
    ...source.semantics,
    canonicalMirrorEqualsCoinGeckoSourceLane: false,
    perAssetAuthoritySelectionApplied: true,
    boundedOnchainPrimaryPilot: true,
    directChainlinkUsdCohortRetained: true,
    relativeChainlinkPilotEnabled: true,
    uniswapV3RelativeCohortEnabled: true,
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
    v3RelativePilotCohortId: policy.v3RelativePilot.cohortId,
    v3RelativePilotAssetIds: v3RelativeIds,
    onchainSelectedAssetCount,
    directOnchainSelectedAssetCount,
    relativeOnchainSelectedAssetCount,
    v3RelativeOnchainSelectedAssetCount,
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
  v3RelativePilotAssetIds: v3RelativeIds,
  onchainSelectedAssetCount,
  directOnchainSelectedAssetCount,
  relativeOnchainSelectedAssetCount,
  v3RelativeOnchainSelectedAssetCount,
  coingeckoSelectedAssetCount,
  fallbackCount,
  unknownCount,
  forceCoinGeckoFailback,
  executionAuthority: 'none'
});
