import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'all27';
const allowedModes = new Set(['all27', 'final9']);
if (!allowedModes.has(mode)) throw new Error(`Unsupported live proof mode: ${mode}`);

const attempts = 3;
const shadowPath = 'intelligence/market-data/onchain-price-shadow.json';
const policyPath = 'intelligence/market-data/market-data-authority-policy.json';
const marketPath = 'intelligence/market-data/market-data.json';
const healthy = new Map();
const attemptEvidence = [];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function routeAllowed(row) {
  if (!row || !(Number(row.usd) > 0)) return false;
  return row.status === 'shadow-ok'
    || row.status === 'divergent'
    || (row.status === 'dependency-warning' && row.dependencyStatus === 'divergent');
}

function finalRouteAllowed(id, row, req) {
  if (!row || !req || row.status !== 'shadow-ok' || !(Number(row.usd) > 0)) return false;
  if (row.source !== req.source || row.network !== req.network) return false;
  if (req.dependencyStatus && row.dependencyStatus !== req.dependencyStatus) return false;
  if (req.quoteAssetId && row.quoteAssetId !== req.quoteAssetId) return false;
  if (req.feedQuote && row.feedQuote !== req.feedQuote) return false;
  if (req.outputQuote && row.outputQuote !== req.outputQuote) return false;
  if (Number.isFinite(Number(row.divergencePct)) && Number.isFinite(Number(row.maxDivergencePct)) && Number(row.divergencePct) > Number(row.maxDivergencePct)) return false;
  if (id === 'tether-gold') {
    if (row.source !== 'uniswap-v3-twap-chainlink-quote') return false;
    if (String(row.pool || '').toLowerCase() !== '0x6546055f46e866a4b9a4a13e81273e3152bae5da') return false;
    if (row.feedQuote !== 'USDT' || row.quoteAssetId !== 'ethereum-usdt-usd') return false;
  }
  return true;
}

const policy = readJson(policyPath);
const finalIds = policy.reviewedPilot?.assetIds || [];
if (mode === 'final9' && finalIds.length !== 9) throw new Error(`Expected 9 final reviewed assets, got ${finalIds.length}`);

for (let attempt = 1; attempt <= attempts; attempt += 1) {
  console.log(`Market Data live evidence attempt ${attempt}/${attempts} (${mode})`);
  const result = spawnSync(process.execPath, ['intelligence/market-data/onchain-price-resolver.mjs'], {
    stdio: 'inherit',
    env: process.env
  });

  let shadow = null;
  try {
    shadow = readJson(shadowPath);
  } catch (error) {
    console.warn(`attempt ${attempt}: Shadow state unavailable: ${error.message}`);
  }

  if (shadow) {
    if (shadow.mode !== 'shadow' || shadow.semantics?.productionPriceAuthority !== false) throw new Error('Live Shadow authority drift');
    if (shadow.coverage?.assetCount !== 27) throw new Error(`Expected 27 total Shadow routes, got ${shadow.coverage?.assetCount}`);
    if (shadow.authority?.executionAuthority !== 'none') throw new Error('Live Shadow execution authority drift');

    const newlyHealthy = [];
    if (mode === 'all27') {
      const observations = Object.values(shadow.observations || {});
      if (observations.length !== 27) throw new Error(`Expected 27 live observations, got ${observations.length}`);
      for (const row of observations) {
        if (routeAllowed(row) && !healthy.has(row.assetId)) {
          healthy.set(row.assetId, { attempt, generatedAt: shadow.generatedAt, status: row.status, usd: row.usd });
          newlyHealthy.push(row.assetId);
        }
      }
    } else {
      for (const id of finalIds) {
        const row = shadow.observations?.[id];
        const req = policy.reviewedPilot.routeRequirements?.[id];
        if (finalRouteAllowed(id, row, req) && !healthy.has(id)) {
          healthy.set(id, { attempt, generatedAt: shadow.generatedAt, status: row.status, usd: row.usd });
          newlyHealthy.push(id);
        }
      }
    }

    attemptEvidence.push({
      attempt,
      resolverExitCode: result.status,
      generatedAt: shadow.generatedAt,
      coverage: shadow.coverage,
      newlyHealthy,
      cumulativeHealthyCount: healthy.size
    });
  } else {
    attemptEvidence.push({ attempt, resolverExitCode: result.status, generatedAt: null, coverage: null, newlyHealthy: [], cumulativeHealthyCount: healthy.size });
  }

  const targetCount = mode === 'all27' ? 27 : 9;
  if (healthy.size === targetCount) break;
  if (attempt < attempts) {
    const delayMs = attempt * 2000;
    console.warn(`Live evidence incomplete (${healthy.size}/${targetCount}); retrying after ${delayMs}ms without accepting unavailable routes as healthy.`);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
  }
}

const targetIds = mode === 'all27' ? Object.keys(readJson(shadowPath).observations || {}) : finalIds;
const missing = targetIds.filter(id => !healthy.has(id));
if (missing.length) {
  console.error('Bounded live evidence incomplete', { mode, missing, attemptEvidence });
  throw new Error(`${mode}: routes without a fresh healthy live observation after ${attempts} attempts: ${missing.join(', ')}`);
}

if (mode === 'final9') {
  const materialize = spawnSync(process.execPath, ['intelligence/market-data/market-data-authority-materializer.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, MARKET_DATA_FORCE_COINGECKO_FAILBACK: 'false' }
  });
  if (materialize.status !== 0) throw new Error(`Production authority materializer failed with exit ${materialize.status}`);

  const market = readJson(marketPath);
  const onchain = Number(market.authority?.onchainSelectedAssetCount);
  const coingecko = Number(market.authority?.coingeckoSelectedAssetCount);
  const unknown = Number(market.authority?.unknownCount);
  if (onchain + coingecko !== 26) throw new Error(`Canonical production authority does not sum to 26: ${onchain}+${coingecko}`);
  if (unknown !== 0) throw new Error(`Canonical production authority contains ${unknown} unknown assets`);
  if (market.authority?.executionAuthority !== 'none' || market.authority?.capitalExecution !== false || market.authority?.policyMutationAuthority !== false) throw new Error('Production authority boundary drift');
  for (const [id, row] of Object.entries(market.prices || {})) {
    if (!(Number(row?.usd) > 0)) throw new Error(`${id}: canonical production price invalid`);
    const lane = row.authority?.selectedLane;
    if (!['onchain', 'coingecko-lane'].includes(lane)) throw new Error(`${id}: invalid canonical selected lane ${lane}`);
    if (lane === 'onchain' && !String(row.source || '').startsWith('onchain-')) throw new Error(`${id}: onchain provenance missing`);
    if (lane === 'coingecko-lane' && row.authority?.fallbackUsed !== true) throw new Error(`${id}: CoinGecko may only be selected as explicit per-asset failback`);
  }
  console.log('Production per-asset failback boundary PASS', { onchainSelectedAssetCount: onchain, coingeckoSelectedAssetCount: coingecko, unknownCount: unknown });
}

console.log('Market Data bounded route-by-route live evidence PASS', {
  mode,
  targetCount: targetIds.length,
  healthyCount: healthy.size,
  attemptsUsed: attemptEvidence.length,
  everyRoutePersonallyObservedHealthy: true,
  unavailableAcceptedAsHealthy: false,
  executionAuthority: 'none',
  attemptEvidence
});
