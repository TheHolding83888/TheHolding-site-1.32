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

const pilotIds = [...(policy.pilot?.assetIds || [])];
const overrideIds = Object.keys(policy.assetOverrides || {});
const exactPilot = ['bitcoin', 'ethereum', 'aerodrome-finance', 'pendle', 'curve-dao-token', 'frax-share'];
if (JSON.stringify(pilotIds) !== JSON.stringify(exactPilot)) throw new Error('Pilot cohort must be exactly BTC + ETH + AERO + PENDLE + CRV + FXS');
if (overrideIds.length !== pilotIds.length || overrideIds.some(id => !pilotIds.includes(id))) throw new Error('Asset overrides exceed bounded pilot cohort');
if (Number(policy.pilot?.maxPromotedAssetCount) !== 6) throw new Error('Pilot promotion cap drift');
if (policy.pilot?.requiredRouteType !== 'chainlink-v3' || policy.pilot?.requiredQuote !== 'USD') throw new Error('Pilot must remain direct Chainlink/USD only');

for (const assetId of pilotIds) {
  const observation = shadow?.observations?.[assetId];
  const req = policy.pilot?.routeRequirements?.[assetId];
  if (!req) throw new Error(`${assetId}: exact route requirement missing`);
  if (observation?.source !== policy.pilot.requiredRouteType) throw new Error(`${assetId}: pilot route type drift`);
  if (observation?.network !== req.network) throw new Error(`${assetId}: pilot network drift`);
  if (String(observation?.contract || '').toLowerCase() !== String(req.contract || '').toLowerCase()) throw new Error(`${assetId}: pilot feed contract drift`);
  if (observation?.quote !== policy.pilot.requiredQuote) throw new Error(`${assetId}: pilot quote drift`);
  if (forceCoinGeckoFailback) shadow.observations[assetId] = { ...observation, status: 'cycle-forced-failback', usd: null };
}

const evaluation = evaluateMarketDataAuthority({ policy, marketData: source, shadow, nowMs });
const prices = {};
let onchainSelectedAssetCount = 0;
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

if (onchainSelectedAssetCount > Number(policy.pilot.maxPromotedAssetCount)) throw new Error('Onchain selected asset count exceeds pilot cap');
for (const assetId of Object.keys(prices)) {
  if (!pilotIds.includes(assetId) && prices[assetId]?.authority?.selectedLane !== 'coingecko-lane') throw new Error(`${assetId}: non-pilot asset left CoinGecko lane`);
}
if (forceCoinGeckoFailback && onchainSelectedAssetCount !== 0) throw new Error('Cycle failback did not remove onchain selections');

const output = {
  ...source,
  version: '0.6-market-data-bounded-direct-oracle-cohort',
  engineVersion: '0.6-per-asset-authority-materializer-btc-eth-aero-pendle-crv-fxs',
  generatedAt: new Date(nowMs).toISOString(),
  status: unknownCount > 0 ? 'partial' : fallbackCount > 0 ? 'fallback-active' : 'ok',
  semantics: {
    ...source.semantics,
    canonicalMirrorEqualsCoinGeckoSourceLane: false,
    perAssetAuthoritySelectionApplied: true,
    boundedOnchainPrimaryPilot: true,
    directChainlinkUsdCohortOnly: true,
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
    pilotAssetIds: pilotIds,
    onchainSelectedAssetCount,
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
console.log('Market Data authority materialized', { pilotAssetIds: pilotIds, onchainSelectedAssetCount, coingeckoSelectedAssetCount, fallbackCount, unknownCount, forceCoinGeckoFailback, executionAuthority: 'none' });
