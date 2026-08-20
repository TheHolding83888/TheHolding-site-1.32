import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = path.join(__dirname, 'market-price-registry.json');
const SOURCE_OUTPUT_PATH = path.join(__dirname, 'market-data-coingecko.json');
const CANONICAL_OUTPUT_PATH = path.join(__dirname, 'market-data.json');
const MAX_PREVIOUS_AGE_MS = 6 * 60 * 60 * 1000;
const MIN_EXTERNAL_REFRESH_MS = 40 * 60 * 1000;

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function iso(value = Date.now()) { return new Date(value).toISOString(); }
function writeMirroredSnapshot(output) {
  const bytes = JSON.stringify(output, null, 2) + '\n';
  fs.writeFileSync(SOURCE_OUTPUT_PATH, bytes);
  fs.writeFileSync(CANONICAL_OUTPUT_PATH, bytes);
}
function previousPrice(previous, assetId) {
  const row = previous?.prices?.[assetId];
  const px = finite(row?.usd);
  if (!(px >= 0)) return null;
  const observedAt = row?.observedAt || previous?.observedAt || previous?.generatedAt || null;
  const age = observedAt ? Date.now() - Date.parse(observedAt) : Infinity;
  if (!Number.isFinite(age) || age > MAX_PREVIOUS_AGE_MS) return null;
  return { usd: px, observedAt, ageMs: age };
}

const registry = readJson(REGISTRY_PATH);
if (!registry?.assets?.length) throw new Error('Market price registry missing or empty');

// CoinGecko fallback history is now isolated from the canonical selected lane.
// Stage 2A still mirrors this source lane byte-for-byte into market-data.json,
// so production price selection remains unchanged.
const previous = readJson(SOURCE_OUTPUT_PATH, readJson(CANONICAL_OUTPUT_PATH, null));
const forceRefresh = String(process.env.MARKET_DATA_FORCE_REFRESH || '').toLowerCase() === 'true';
const previousObservedAt = previous?.observedAt || previous?.generatedAt || null;
const previousAgeMs = previousObservedAt ? Date.now() - Date.parse(previousObservedAt) : Infinity;
const previousHasFullRegistry = registry.assets.every(asset => finite(previous?.prices?.[asset.assetId]?.usd) !== null);

if (!forceRefresh && previousHasFullRegistry && Number.isFinite(previousAgeMs) && previousAgeMs >= 0 && previousAgeMs < MIN_EXTERNAL_REFRESH_MS) {
  writeMirroredSnapshot(previous);
  console.log('Market Data external fetch skipped; CoinGecko source lane reused and canonical mirror preserved', {
    observedAt: previousObservedAt,
    ageMinutes: Number((previousAgeMs / 60000).toFixed(2)),
    externalRequestCount: 0
  });
  process.exit(0);
}

const apiKey = String(process.env.COINGECKO_API_KEY || '').trim();
const keylessFallbackAllowed = registry?.bootstrap?.serverSideKeylessFallbackAllowed === true;
if (!apiKey && !keylessFallbackAllowed) {
  throw new Error('COINGECKO_API_KEY is required for an external Market Data refresh; browser credentials are forbidden');
}

const providerIds = [...new Set(registry.assets.map(x => x.providerId).filter(Boolean))];
const url = new URL(registry.provider?.endpoint || 'https://api.coingecko.com/api/v3/simple/price');
url.searchParams.set('ids', providerIds.join(','));
url.searchParams.set('vs_currencies', registry.provider?.currency || 'usd');
if (apiKey) url.searchParams.set('x_cg_demo_api_key', apiKey);

const authMode = apiKey ? 'github-actions-secret' : 'server-side-keyless-fallback';
const requestedAt = iso();
let payload = null;
let requestError = null;
let httpStatus = null;

try {
  const response = await fetch(url, {
    method: 'GET',
    headers: { 'accept': 'application/json' },
    signal: AbortSignal.timeout(12_000)
  });
  httpStatus = response.status;
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  payload = await response.json();
} catch (error) {
  requestError = error instanceof Error ? error.message : String(error);
}

const observedAt = iso();
const prices = {};
let freshCount = 0;
let fallbackCount = 0;
let unknownCount = 0;

for (const asset of registry.assets) {
  const fresh = finite(payload?.[asset.providerId]?.usd);
  if (fresh !== null && fresh >= 0) {
    prices[asset.assetId] = {
      assetId: asset.assetId,
      symbol: asset.symbol || null,
      providerId: asset.providerId,
      usd: fresh,
      status: 'fresh',
      observedAt,
      source: 'coingecko-single-batch'
    };
    freshCount += 1;
    continue;
  }

  const prior = previousPrice(previous, asset.assetId);
  if (prior) {
    prices[asset.assetId] = {
      assetId: asset.assetId,
      symbol: asset.symbol || null,
      providerId: asset.providerId,
      usd: prior.usd,
      status: 'stale-fallback',
      observedAt: prior.observedAt,
      source: 'previous-coingecko-source-snapshot'
    };
    fallbackCount += 1;
  } else {
    prices[asset.assetId] = {
      assetId: asset.assetId,
      symbol: asset.symbol || null,
      providerId: asset.providerId,
      usd: null,
      status: 'unknown',
      observedAt: null,
      source: null
    };
    unknownCount += 1;
  }
}

const status = unknownCount > 0 ? 'partial' : fallbackCount > 0 ? 'stale-fallback' : 'ok';
const output = {
  version: '0.3-market-data-source-lane-separation',
  engineVersion: '0.3-coingecko-source-lane-plus-canonical-mirror',
  generatedAt: iso(),
  requestedAt,
  observedAt: freshCount > 0 ? observedAt : previous?.observedAt || null,
  status,
  semantics: {
    oneExternalRequestPerRefresh: true,
    externalRequestCount: 1,
    minimumOffCycleReuseMinutes: MIN_EXTERNAL_REFRESH_MS / 60000,
    browserExternalPriceRequestsAllowed: false,
    serverSideKeylessFallbackAllowed: keylessFallbackAllowed,
    unknownIsNotZero: true,
    staleFallbackMaxAgeHours: MAX_PREVIOUS_AGE_MS / 3600000,
    wrapperNavAndProtocolValuationStayUpstream: true,
    dedicatedCoinGeckoSourceLane: true,
    canonicalMirrorEqualsCoinGeckoSourceLane: true,
    perAssetAuthoritySelectionApplied: false
  },
  provider: {
    id: 'coingecko',
    endpoint: url.origin + url.pathname,
    authMode,
    credentialExposed: false,
    httpStatus,
    error: requestError
  },
  coverage: {
    requestedAssetCount: registry.assets.length,
    freshCount,
    staleFallbackCount: fallbackCount,
    unknownCount,
    freshCoverage: registry.assets.length ? freshCount / registry.assets.length : 0,
    usableCoverage: registry.assets.length ? (freshCount + fallbackCount) / registry.assets.length : 0
  },
  prices,
  authority: {
    productionPriceLane: 'coingecko-lane',
    onchainSelectedAssetCount: 0,
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false
  }
};

writeMirroredSnapshot(output);
console.log('CoinGecko source lane and canonical Market Data mirror written', {
  status,
  authMode,
  freshCount,
  fallbackCount,
  unknownCount,
  externalRequestCount: 1,
  onchainSelectedAssetCount: 0
});

if (unknownCount === registry.assets.length) {
  throw new Error('Market Data has zero usable prices; refusing to publish an all-unknown snapshot');
}
