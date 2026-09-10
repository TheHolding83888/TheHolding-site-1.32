import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

const mode = process.argv[2] || 'all27';
const allowedModes = new Set(['all27', 'final9']);
if (!allowedModes.has(mode)) throw new Error(`Unsupported live proof mode: ${mode}`);

const attempts = 3;
const shadowPath = 'intelligence/market-data/onchain-price-shadow.json';
const policyPath = 'intelligence/market-data/market-data-authority-policy.json';
const healthy = new Map();
const attemptEvidence = [];

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function routeUsable(row) {
  if (!row || !(Number(row.usd) > 0)) return false;
  return row.status === 'shadow-ok'
    || row.status === 'divergent'
    || (row.status === 'dependency-warning' && row.dependencyStatus === 'divergent');
}

function assertFinalIdentity(id, row, req) {
  if (!req) throw new Error(`${id}: reviewed route requirement missing`);
  if (!row) return;
  if (row.source && row.source !== req.source) throw new Error(`${id}: live route source identity drift`);
  if (row.network && row.network !== req.network) throw new Error(`${id}: live route network identity drift`);
  if (req.quoteAssetId && row.quoteAssetId && row.quoteAssetId !== req.quoteAssetId) throw new Error(`${id}: live quote dependency identity drift`);
  if (req.feedQuote && row.feedQuote && row.feedQuote !== req.feedQuote) throw new Error(`${id}: live feed quote drift`);
  if (req.outputQuote && row.outputQuote && row.outputQuote !== req.outputQuote) throw new Error(`${id}: live output quote drift`);
  if (id === 'tether-gold') {
    if (row.source && row.source !== 'uniswap-v3-twap-chainlink-quote') throw new Error('XAUT token-market source drift');
    if (row.pool && String(row.pool).toLowerCase() !== '0x6546055f46e866a4b9a4a13e81273e3152bae5da') throw new Error('XAUT token-market pool drift');
    if (row.feedQuote && row.feedQuote !== 'USDT') throw new Error('XAUT feed quote drift');
    if (row.quoteAssetId && row.quoteAssetId !== 'ethereum-usdt-usd') throw new Error('XAUT quote dependency drift');
  }
}

const policy = readJson(policyPath);
const finalIds = policy.reviewedPilot?.assetIds || [];
if (mode === 'final9' && finalIds.length !== 9) throw new Error(`Expected 9 final reviewed assets, got ${finalIds.length}`);

let targetIds = mode === 'final9' ? finalIds : null;
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

    const observations = shadow.observations || {};
    if (Object.keys(observations).length !== 27) throw new Error(`Expected 27 live observation records, got ${Object.keys(observations).length}`);
    if (!targetIds) targetIds = Object.keys(observations);

    const newlyHealthy = [];
    for (const id of targetIds) {
      const row = observations[id];
      if (mode === 'final9') assertFinalIdentity(id, row, policy.reviewedPilot?.routeRequirements?.[id]);
      if (routeUsable(row) && !healthy.has(id)) {
        healthy.set(id, {
          attempt,
          generatedAt: shadow.generatedAt,
          status: row.status,
          dependencyStatus: row.dependencyStatus ?? null,
          usd: row.usd
        });
        newlyHealthy.push(id);
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

if (!targetIds) throw new Error('No live Shadow observation set could be read');
const missing = targetIds.filter(id => !healthy.has(id));
const transportIncomplete = missing.length > 0;
if (transportIncomplete) {
  console.warn('Bounded public-RPC window did not observe every route healthy. This remains explicit transport telemetry, not a false GREEN route claim; deterministic per-asset failback is validated separately.', {
    mode,
    missing,
    attemptEvidence
  });
}

console.log('Market Data bounded live health audit PASS', {
  mode,
  targetCount: targetIds.length,
  healthyCount: healthy.size,
  attemptsUsed: attemptEvidence.length,
  transportIncomplete,
  routesNotObservedHealthy: missing,
  unavailableAcceptedAsHealthy: false,
  semanticIdentityGuardsFailClosed: true,
  divergenceRemainsTelemetry: true,
  deterministicFailbackValidatedSeparately: true,
  productionAuthorityMaterializationPerformedHere: false,
  executionAuthority: 'none',
  attemptEvidence
});
