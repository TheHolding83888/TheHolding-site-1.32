#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const OBSERVER_VERSION = '0.2.1-deterministic-memory-vault-corrections';
const LAYER_VERSION = '0.2.1-autonomous-change-intelligence-memory-vault';
const MEMORY_VERSION = '0.2.1-system-memory';
const HISTORY_VERSION = '0.2.1-change-history';
const VAULT_MANIFEST_VERSION = '0.2-memory-vault-manifest';
const VAULT_RECORD_VERSION = '0.2-memory-vault-record';
const VAULT_CORRECTIONS_VERSION = '0.2.1-memory-vault-corrections';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');

const PATHS = {
  productivity: process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT, 'companies', 'productivity-data.json'),
  rewards: process.env.REWARDS_DATA_FILE || path.join(ROOT, 'companies', 'rewards-data.json'),
  stableCapital: process.env.STABLE_CAPITAL_DATA_FILE || path.join(ROOT, 'companies', 'stable-capital-data.json'),
  stableIndex: process.env.STABLE_INDEX_DATA_FILE || path.join(ROOT, 'companies', 'stable-index-data.json'),
  embeddedLedger: process.env.EMBEDDED_LEDGER_FILE || path.join(ROOT, 'companies', 'embedded-yield-ledger.json'),
  reporting: process.env.REPORTING_DATA_FILE || path.join(ROOT, 'reporting', 'reporting-data.json'),
  memory: process.env.SYSTEM_MEMORY_FILE || path.join(ROOT, 'intelligence', 'system-memory.json'),
  history: process.env.CHANGE_HISTORY_FILE || path.join(ROOT, 'intelligence', 'change-history.json'),
  latest: process.env.CHANGE_INTELLIGENCE_FILE || path.join(ROOT, 'intelligence', 'change-intelligence.json'),
  brief: process.env.CHANGE_BRIEF_FILE || path.join(ROOT, 'intelligence', 'daily-brief.md'),
  vaultRoot: process.env.MEMORY_VAULT_ROOT || path.join(ROOT, 'intelligence', 'memory-vault'),
  vaultManifest: process.env.MEMORY_VAULT_MANIFEST || path.join(ROOT, 'intelligence', 'memory-vault', 'manifest.json'),
  vaultCorrections: process.env.MEMORY_VAULT_CORRECTIONS || path.join(ROOT, 'intelligence', 'memory-vault', 'corrections.json'),
};

function ensureDir(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function readText(file) { return fs.readFileSync(file, 'utf8'); }
function readJson(file, required = true) {
  try { return JSON.parse(readText(file)); }
  catch (err) {
    if (!required && err?.code === 'ENOENT') return null;
    throw new Error(`Cannot read JSON ${path.relative(ROOT, file)}: ${err.message}`);
  }
}
function sha256Text(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function sha256File(file) { return sha256Text(readText(file)); }
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
}
function hashObject(value) { return sha256Text(stableStringify(value)); }
function finite(v) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round(v, d = 8) { const n = finite(v); return n === null ? null : Number(n.toFixed(d)); }
function writeJson(file, value) {
  ensureDir(file);
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function pct(v) { const n = finite(v); return n === null ? null : round(n * 100, 4); }
function isoOrNull(v) { const d = v ? new Date(v) : null; return d && Number.isFinite(d.getTime()) ? d.toISOString() : null; }
function hoursSince(v, nowMs) { const t = v ? new Date(v).getTime() : NaN; return Number.isFinite(t) ? (nowMs - t) / 36e5 : null; }
function sortedObject(obj, mapper) {
  return Object.fromEntries(Object.entries(obj || {}).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => [k, mapper(v,k)]));
}
function relPath(file) { return path.relative(ROOT, file).replaceAll(path.sep, '/'); }
function safeGet(obj, pathArr) { let x=obj; for (const k of pathArr) { if (x == null) return null; x=x[k]; } return x ?? null; }

const now = new Date();
const generatedAt = now.toISOString();
const nowMs = now.getTime();

const raw = {
  productivity: readJson(PATHS.productivity),
  rewards: readJson(PATHS.rewards),
  stableCapital: readJson(PATHS.stableCapital),
  stableIndex: readJson(PATHS.stableIndex),
  embeddedLedger: readJson(PATHS.embeddedLedger),
  reporting: readJson(PATHS.reporting),
};

const expectedFreshHours = {
  productivity: 192,
  rewards: 36,
  stableCapital: 36,
  stableIndex: 36,
  embeddedLedger: 36,
  reporting: 36,
};

function sourceMeta(key, obj, file) {
  const sourceGeneratedAt = isoOrNull(obj?.generatedAt || obj?.updatedAt || obj?.date);
  const ageHours = hoursSince(sourceGeneratedAt, nowMs);
  const maxAgeHours = expectedFreshHours[key];
  return {
    file: relPath(file),
    version: obj?.version ?? null,
    methodologyVersion: obj?.methodologyVersion ?? null,
    collectorVersion: obj?.collectorVersion ?? null,
    generatedAt: sourceGeneratedAt,
    sha256: sha256File(file),
    ageHours: ageHours === null ? null : round(ageHours, 2),
    freshness: ageHours === null ? 'unknown' : (ageHours <= maxAgeHours ? 'fresh' : 'stale'),
    expectedMaxAgeHours: maxAgeHours,
  };
}

const sources = {
  productivity: sourceMeta('productivity', raw.productivity, PATHS.productivity),
  rewards: sourceMeta('rewards', raw.rewards, PATHS.rewards),
  stableCapital: sourceMeta('stableCapital', raw.stableCapital, PATHS.stableCapital),
  stableIndex: sourceMeta('stableIndex', raw.stableIndex, PATHS.stableIndex),
  embeddedLedger: sourceMeta('embeddedLedger', raw.embeddedLedger, PATHS.embeddedLedger),
  reporting: sourceMeta('reporting', raw.reporting, PATHS.reporting),
};

function normalizeProductivity(obj) {
  return {
    generatedAt: isoOrNull(obj?.generatedAt),
    snapshotKey: obj?.snapshotKey ?? null,
    companies: sortedObject(obj?.companies, c => ({
      status: c?.status ?? null,
      aprLatestPct: round(c?.aprLatest, 6),
      aprHistoricalAveragePct: round(c?.aprHistoricalAverage, 6),
      coverage: round(c?.coverage, 8),
      productiveValueUsd: round(c?.productiveValue, 6),
      coveredProductiveValueUsd: round(c?.coveredProductiveValue, 6),
      observationCount: finite(c?.observationCount),
      updatedAt: isoOrNull(c?.updatedAt),
    })),
    engines: sortedObject(obj?.engines, e => ({
      protocol: e?.protocol ?? null,
      principalSymbol: e?.principalSymbol ?? null,
      status: e?.status ?? null,
      aprLatestPct: round(e?.aprLatest, 6),
      lastUpdatedAt: isoOrNull(e?.lastUpdatedAt || e?.periodEnd),
    })),
  };
}

function normalizeRewards(obj) {
  return {
    generatedAt: isoOrNull(obj?.generatedAt),
    date: obj?.date ?? null,
    engineErrorCount: Object.keys(obj?.engineErrors || {}).length,
    companies: sortedObject(obj?.companies, c => ({
      status: c?.status ?? null,
      totalUsd: round(c?.totalUsd, 6),
      totalUsdIsComplete: c?.totalUsdIsComplete ?? null,
      routeCoverage: round(c?.routeCoverage, 8),
      completeRouteCoverage: round(c?.completeRouteCoverage, 8),
      routeCount: finite(c?.routeCount),
      pendingRoutes: finite(c?.pendingRoutes),
      unpricedRewards: finite(c?.unpricedRewards),
      updatedAt: isoOrNull(c?.updatedAt),
    })),
  };
}

function normalizeStableCapital(obj) {
  const s = obj?.summary || {};
  return {
    generatedAt: isoOrNull(obj?.generatedAt),
    company: obj?.company?.name ?? null,
    stableCapitalUsd: round(s?.stableCapitalUsd, 8),
    productiveStableCapitalUsd: round(s?.productiveStableCapitalUsd, 8),
    coveredProductiveStableCapitalUsd: round(s?.coveredProductiveStableCapitalUsd, 8),
    coverage: round(s?.coverage, 8),
    fullCoverage: s?.fullCoverage ?? null,
    referenceAnnualYieldPct: round(s?.referenceAnnualYieldPct, 8),
    referenceApyPct: round(s?.referenceApyPct, 8),
    positionCount: finite(s?.positionCount),
    coveredPositionCount: finite(s?.coveredPositionCount),
    warmingPositionIds: [...(s?.warmingPositionIds || [])].sort(),
  };
}

function normalizeStableIndex(obj) {
  const s = obj?.summary || {};
  const companies = {};
  for (const c of obj?.companies || []) {
    const name = c?.name || c?.registry || 'unknown';
    companies[name] = {
      registry: c?.registry ?? null,
      currentCapitalUsd: round(c?.currentCapitalUsd, 8),
      stableCapitalUsd: round(c?.stableCapitalUsd, 8),
      investedUsd: round(c?.investedUsd, 8),
      displayReferenceApyPct: round(c?.displayReferenceApyPct, 8),
      currentReferenceApyPct: round(c?.currentReferenceApyPct, 8),
      referenceApyStatus: c?.referenceApyStatus ?? null,
      currentCoverage: round(c?.currentCoverage, 8),
      currentFullCoverage: c?.currentFullCoverage ?? null,
      accruedClaimableUsd: round(c?.accruedClaimableUsd, 8),
      embeddedYieldSinceTrackingUsd: round(c?.embeddedYield?.sinceTrackingUsd, 8),
      strategyPerformanceUsd: round(c?.performance?.sinceInceptionUsd, 8),
      strategyPerformancePct: round(c?.performance?.sinceInceptionPct, 8),
      stablePriceEffectUsd: round(c?.performance?.stablePriceEffectUsd, 8),
      netMarketPnlUsd: round(c?.performance?.netMarketPnlUsd, 8),
      netMarketPnlPct: round(c?.performance?.netMarketPnlPct, 8),
      strategyCount: finite(c?.strategyCount),
      protocolCount: finite(c?.protocolCount),
      chainCount: finite(c?.chainCount),
    };
  }
  return {
    generatedAt: isoOrNull(obj?.generatedAt),
    companyCount: finite(s?.companyCount),
    stableCapitalUsd: round(s?.stableCapitalUsd, 8),
    currentCapitalUsd: round(s?.currentCapitalUsd, 8),
    capitalWeightedReferenceApyPct: round(s?.capitalWeightedReferenceApyPct, 8),
    referenceApyStatus: s?.referenceApyStatus ?? null,
    currentFullCoverage: s?.currentFullCoverage ?? null,
    accruedClaimableUsd: round(s?.accruedClaimableUsd, 8),
    embeddedIncomeSinceTrackingUsd: round(s?.embeddedIncomeSinceTrackingUsd, 8),
    investedUsd: round(s?.investedUsd, 8),
    strategyPerformanceUsd: round(s?.strategyPerformanceUsd, 8),
    strategyPerformancePct: round(s?.strategyPerformancePct, 8),
    stablePriceEffectUsd: round(s?.stablePriceEffectUsd, 8),
    netMarketPnlUsd: round(s?.netMarketPnlUsd, 8),
    netMarketPnlPct: round(s?.netMarketPnlPct, 8),
    strategyCount: finite(s?.strategyCount),
    protocolCount: finite(s?.protocolCount),
    chainCount: finite(s?.chainCount),
    companies,
  };
}

function normalizeEmbeddedLedger(obj) {
  const positionEntries = Object.values(obj?.positions || {});
  const summary = obj?.summary || {};
  return {
    generatedAt: isoOrNull(obj?.generatedAt),
    trackingStartedAt: isoOrNull(obj?.trackingStartedAt || summary?.trackingStartedAt),
    positionCount: positionEntries.length,
    observedEmbeddedIncomeSinceTrackingUsd: round(
      summary?.observedEmbeddedIncomeSinceTrackingUsd ??
      summary?.sinceTrackingUsd ??
      obj?.observedEmbeddedIncomeSinceTrackingUsd ??
      obj?.sinceTrackingUsd,
      8
    ),
    stablePriceEffectSinceTrackingUsd: round(
      summary?.stablePriceEffectSinceTrackingUsd ?? obj?.stablePriceEffectSinceTrackingUsd,
      8
    ),
  };
}

function normalizeReporting(obj) {
  const funds = {};
  for (const [name, f] of Object.entries(obj?.funds || {})) {
    const latest = f?.latestSnapshot || {};
    const year = String(new Date().getUTCFullYear());
    const ys = f?.summaries?.[year] || {};
    funds[name] = {
      trackingStartedAt: f?.trackingStartedAt ?? null,
      latestDate: latest?.date ?? null,
      capturedAt: isoOrNull(latest?.capturedAt),
      totalValueUsd: round(latest?.totalValueUsd, 8),
      stableCapitalUsd: round(latest?.stableCapitalUsd, 8),
      currentCapitalUsd: round(latest?.currentCapitalUsd, 8),
      accruedClaimableUsd: round(latest?.accruedClaimableUsd, 8),
      referenceAprPct: round(latest?.referenceApr, 8),
      referenceApyPct: round(latest?.referenceApyPct, 8),
      coverage: round(latest?.coverage ?? latest?.currentCoverage, 8),
      modeledDailyCashFlowUsd: round(latest?.modeledDailyCashFlowUsd, 8),
      modeledDailyGeneratedIncomeUsd: round(latest?.modeledDailyGeneratedIncomeUsd, 8),
      observedEmbeddedIncomeSinceTrackingUsd: round(latest?.observedEmbeddedIncomeSinceTrackingUsd, 8),
      strategyPerformanceSinceInceptionUsd: round(latest?.strategyPerformanceSinceInceptionUsd, 8),
      stablePriceEffectUsd: round(latest?.stablePriceEffectUsd, 8),
      netMarketPnlUsd: round(latest?.netMarketPnlUsd, 8),
      currentMonth: ys?.currentMonth ?? null,
      currentMonthCashFlowUsd: round(ys?.currentMonthReferenceCashFlowUsd, 8),
      currentMonthGeneratedIncomeUsd: round(ys?.currentMonthGeneratedIncomeUsd, 8),
      currentMonthYieldPct: round(ys?.currentMonthYieldPct, 8),
      ytdCashFlowUsd: round(ys?.ytdCashFlowUsd, 8),
      annualizedCashFlowAprPct: round(ys?.annualizedCashFlowAprPct, 8),
    };
  }
  return { generatedAt: isoOrNull(obj?.generatedAt), funds: sortedObject(funds, v => v) };
}

const snapshot = {
  productivity: normalizeProductivity(raw.productivity),
  rewards: normalizeRewards(raw.rewards),
  stableCapital: normalizeStableCapital(raw.stableCapital),
  stableIndex: normalizeStableIndex(raw.stableIndex),
  embeddedLedger: normalizeEmbeddedLedger(raw.embeddedLedger),
  reporting: normalizeReporting(raw.reporting),
};
const snapshotHash = hashObject(snapshot);
const sourceCompositeHash = hashObject(Object.fromEntries(Object.entries(sources).map(([k,v]) => [k, v.sha256])));

const previousMemory = readJson(PATHS.memory, false);
const previousLatest = readJson(PATHS.latest, false);
const previous = previousMemory?.currentSnapshot || null;

const events = [];
function severityRank(s) { return ({critical:4, important:3, watch:2, info:1})[s] || 0; }
function makeEvent({category, entity, metric, previousValue, currentValue, unit=null, severity='info', summary, whyItMatters, sourceKeys=[]}) {
  const identity = {category,entity,metric,previousValue,currentValue,unit,sourceKeys};
  const id = sha256Text(stableStringify(identity)).slice(0, 20);
  events.push({ id, detectedAt: generatedAt, category, entity, metric, previousValue, currentValue, unit, severity, summary, whyItMatters, sourceKeys });
}
function changed(a,b) { return stableStringify(a) !== stableStringify(b); }
function numericDeltaEvent({category, entity, metric, prev, curr, unit, absThreshold=0, relThreshold=0, severity='info', summaryFn, why, sourceKeys=[]}) {
  const a=finite(prev), b=finite(curr); if (a===null || b===null) return;
  const delta=b-a; const rel=Math.abs(a)>1e-12 ? Math.abs(delta/a) : (Math.abs(delta)>0 ? Infinity : 0);
  if (Math.abs(delta) < absThreshold && rel < relThreshold) return;
  if (Math.abs(delta) <= 1e-12) return;
  makeEvent({category,entity,metric,previousValue:a,currentValue:b,unit,severity,summary:summaryFn(a,b,delta),whyItMatters:why,sourceKeys});
}
function setDiff(prevArr=[], currArr=[]) {
  const a=new Set(prevArr), b=new Set(currArr); return {added:[...b].filter(x=>!a.has(x)).sort(),removed:[...a].filter(x=>!b.has(x)).sort()};
}

if (previous) {
  // Source/version changes
  for (const key of Object.keys(sources)) {
    const old = previousMemory?.sources?.[key]; const cur = sources[key];
    if (old && old.version !== cur.version) makeEvent({category:'system',entity:key,metric:'source-version',previousValue:old.version,currentValue:cur.version,severity:'important',summary:`${key} source version changed ${old.version ?? '∅'} → ${cur.version ?? '∅'}.`,whyItMatters:'A source/schema version change can unlock new capabilities or alter downstream assumptions and should be observed explicitly.',sourceKeys:[key]});
  }

  // Productivity company deltas/status/coverage
  const pcOld=previous.productivity?.companies||{}, pcNew=snapshot.productivity?.companies||{};
  const cd=setDiff(Object.keys(pcOld),Object.keys(pcNew));
  for (const name of cd.added) makeEvent({category:'registry-intelligence',entity:name,metric:'productivity-company-added',previousValue:null,currentValue:'present',severity:'important',summary:`${name} entered the Productivity intelligence snapshot.`,whyItMatters:'A new measured company expands the system’s reusable operating knowledge.',sourceKeys:['productivity']});
  for (const name of cd.removed) makeEvent({category:'registry-intelligence',entity:name,metric:'productivity-company-removed',previousValue:'present',currentValue:null,severity:'watch',summary:`${name} is no longer present in the Productivity intelligence snapshot.`,whyItMatters:'Unexpected disappearance can indicate a registry or measurement regression.',sourceKeys:['productivity']});
  for (const name of Object.keys(pcNew)) if (pcOld[name]) {
    const a=pcOld[name], b=pcNew[name];
    if (a.status!==b.status) makeEvent({category:'productivity',entity:name,metric:'status',previousValue:a.status,currentValue:b.status,severity:b.status==='ok'?'important':'watch',summary:`${name} Productivity status changed ${a.status} → ${b.status}.`,whyItMatters:'Status changes alter how much of the company’s productive capital is currently reproducibly measured.',sourceKeys:['productivity']});
    numericDeltaEvent({category:'productivity',entity:name,metric:'aprLatestPct',prev:a.aprLatestPct,curr:b.aprLatestPct,unit:'percentage-points',absThreshold:.20,relThreshold:.05,severity:'info',summaryFn:(x,y,d)=>`${name} Reference APR moved ${x.toFixed(2)}% → ${y.toFixed(2)}% (${d>=0?'+':''}${d.toFixed(2)} pp).`,why:'Meaningful changes in productive capacity are part of the company’s operating history.',sourceKeys:['productivity']});
    numericDeltaEvent({category:'productivity',entity:name,metric:'coverage',prev:a.coverage,curr:b.coverage,unit:'ratio',absThreshold:.01,relThreshold:.02,severity:(finite(b.coverage)===1?'important':'watch'),summaryFn:(x,y,d)=>`${name} Productivity coverage moved ${(x*100).toFixed(1)}% → ${(y*100).toFixed(1)}%.`,why:'Coverage tells us how much productive capital is currently understood rather than guessed or treated as zero.',sourceKeys:['productivity']});
  }

  // Engine status transitions
  const eOld=previous.productivity?.engines||{}, eNew=snapshot.productivity?.engines||{};
  for (const id of Object.keys(eNew)) if (eOld[id] && eOld[id].status!==eNew[id].status) {
    makeEvent({category:'adapter-intelligence',entity:id,metric:'engine-status',previousValue:eOld[id].status,currentValue:eNew[id].status,severity:eNew[id].status==='ok'?'important':'watch',summary:`${eNew[id].protocol || id} adapter ${id} changed ${eOld[id].status} → ${eNew[id].status}.`,whyItMatters:eNew[id].status==='ok'?'A previously unresolved mechanism is now reproducibly measurable and becomes reusable intelligence.':'A previously measured mechanism now needs attention before it can be treated as fully current.',sourceKeys:['productivity']});
  }

  // Rewards company deltas/status
  const rOld=previous.rewards?.companies||{}, rNew=snapshot.rewards?.companies||{};
  const rd=setDiff(Object.keys(rOld),Object.keys(rNew));
  for (const name of rd.added) makeEvent({category:'rewards',entity:name,metric:'company-added',previousValue:null,currentValue:'present',severity:'important',summary:`${name} entered the Accrued Rewards snapshot.`,whyItMatters:'The system can now observe another company’s protocol-side earned value.',sourceKeys:['rewards']});
  for (const name of Object.keys(rNew)) if (rOld[name]) {
    const a=rOld[name], b=rNew[name];
    if (a.status!==b.status) makeEvent({category:'rewards',entity:name,metric:'status',previousValue:a.status,currentValue:b.status,severity:b.status==='ok'?'important':'watch',summary:`${name} Rewards status changed ${a.status} → ${b.status}.`,whyItMatters:'Reward measurement completeness affects the reliability of current earned-but-unclaimed value.',sourceKeys:['rewards']});
    numericDeltaEvent({category:'rewards',entity:name,metric:'totalUsd',prev:a.totalUsd,curr:b.totalUsd,unit:'USD',absThreshold:.25,relThreshold:.05,severity:'info',summaryFn:(x,y,d)=>`${name} accrued rewards moved $${x.toFixed(2)} → $${y.toFixed(2)} (${d>=0?'+':''}$${d.toFixed(2)}).`,why:'Accrued rewards are a separate economic state and their changes help explain the path from productive capital to realised cash flow.',sourceKeys:['rewards']});
    if (finite(a.pendingRoutes)!==finite(b.pendingRoutes) || finite(a.unpricedRewards)!==finite(b.unpricedRewards)) makeEvent({category:'rewards',entity:name,metric:'completeness',previousValue:{pendingRoutes:a.pendingRoutes,unpricedRewards:a.unpricedRewards},currentValue:{pendingRoutes:b.pendingRoutes,unpricedRewards:b.unpricedRewards},severity:(Number(b.pendingRoutes||0)===0&&Number(b.unpricedRewards||0)===0)?'important':'watch',summary:`${name} Rewards completeness changed: pending routes ${a.pendingRoutes ?? '∅'} → ${b.pendingRoutes ?? '∅'}, unpriced ${a.unpricedRewards ?? '∅'} → ${b.unpricedRewards ?? '∅'}.`,whyItMatters:'Completeness improvements turn previously partial observations into reusable verified intelligence.',sourceKeys:['rewards']});
  }

  // Stable Index / Monetra economics
  const sOld=previous.stableIndex||{}, sNew=snapshot.stableIndex||{};
  numericDeltaEvent({category:'stable-capital',entity:'Stable Companies Index',metric:'currentCapitalUsd',prev:sOld.currentCapitalUsd,curr:sNew.currentCapitalUsd,unit:'USD',absThreshold:.02,relThreshold:.002,severity:'info',summaryFn:(x,y,d)=>`Stable Companies current capital moved $${x.toFixed(4)} → $${y.toFixed(4)} (${d>=0?'+':''}$${d.toFixed(4)}).`,why:'Current Capital is the market-value state of Stable Capital plus separately earned claimable value.',sourceKeys:['stableIndex']});
  numericDeltaEvent({category:'stable-capital',entity:'Stable Companies Index',metric:'referenceApyPct',prev:sOld.capitalWeightedReferenceApyPct,curr:sNew.capitalWeightedReferenceApyPct,unit:'percentage-points',absThreshold:.10,relThreshold:.03,severity:'info',summaryFn:(x,y,d)=>`Stable Companies Reference APY moved ${x.toFixed(3)}% → ${y.toFixed(3)}%.`,why:'Reference APY captures current productive capacity and helps separate rate changes from realised performance.',sourceKeys:['stableIndex','stableCapital']});
  numericDeltaEvent({category:'stable-capital',entity:'Stable Companies Index',metric:'accruedClaimableUsd',prev:sOld.accruedClaimableUsd,curr:sNew.accruedClaimableUsd,unit:'USD',absThreshold:.005,relThreshold:.10,severity:'info',summaryFn:(x,y,d)=>`Stable Companies claimable value moved $${x.toFixed(4)} → $${y.toFixed(4)}.`,why:'Claimable is earned but not yet treasury-held value and must remain visible as its own accounting state.',sourceKeys:['stableIndex']});
  numericDeltaEvent({category:'stable-capital',entity:'Stable Companies Index',metric:'embeddedIncomeSinceTrackingUsd',prev:sOld.embeddedIncomeSinceTrackingUsd,curr:sNew.embeddedIncomeSinceTrackingUsd,unit:'USD',absThreshold:.001,relThreshold:.10,severity:'info',summaryFn:(x,y,d)=>`Observed embedded income since tracking moved $${x.toFixed(4)} → $${y.toFixed(4)}.`,why:'Embedded Yield is the system’s memory of value that compounds inside positions instead of waiting to be claimed.',sourceKeys:['stableIndex','embeddedLedger']});
  numericDeltaEvent({category:'stable-capital',entity:'Stable Companies Index',metric:'strategyPerformanceUsd',prev:sOld.strategyPerformanceUsd,curr:sNew.strategyPerformanceUsd,unit:'USD',absThreshold:.02,relThreshold:.10,severity:'info',summaryFn:(x,y,d)=>`Verified Stable strategy performance moved $${x.toFixed(4)} → $${y.toFixed(4)}.`,why:'Strategy Performance connects verified entry principal to current nominal strategy value without mixing in stable-price effects.',sourceKeys:['stableIndex']});
  if (sOld.referenceApyStatus!==sNew.referenceApyStatus || sOld.currentFullCoverage!==sNew.currentFullCoverage) makeEvent({category:'stable-capital',entity:'Stable Companies Index',metric:'coverage-state',previousValue:{status:sOld.referenceApyStatus,fullCoverage:sOld.currentFullCoverage},currentValue:{status:sNew.referenceApyStatus,fullCoverage:sNew.currentFullCoverage},severity:sNew.currentFullCoverage?'important':'watch',summary:`Stable Index coverage state changed: ${sOld.referenceApyStatus}/${sOld.currentFullCoverage} → ${sNew.referenceApyStatus}/${sNew.currentFullCoverage}.`,whyItMatters:'Stable Reference APY is fail-closed; coverage state determines whether the current rate is fully observed or the latest full observation is being carried forward.',sourceKeys:['stableCapital','stableIndex']});

  // Reporting changes: current month counters and latest values
  const fOld=previous.reporting?.funds||{}, fNew=snapshot.reporting?.funds||{};
  for (const name of Object.keys(fNew)) if (fOld[name]) {
    const a=fOld[name], b=fNew[name];
    if (a.latestDate!==b.latestDate) makeEvent({category:'reporting',entity:name,metric:'new-daily-snapshot',previousValue:a.latestDate,currentValue:b.latestDate,severity:'info',summary:`${name} recorded a new daily reporting observation for ${b.latestDate}.`,whyItMatters:'Every new daily observation extends the operating memory used by future analytics and decision support.',sourceKeys:['reporting']});
    numericDeltaEvent({category:'reporting',entity:name,metric:'currentMonthCashFlowUsd',prev:a.currentMonthCashFlowUsd,curr:b.currentMonthCashFlowUsd,unit:'USD',absThreshold:.01,relThreshold:.01,severity:'info',summaryFn:(x,y,d)=>`${name} current-month cash-flow/reference-income counter moved $${x.toFixed(2)} → $${y.toFixed(2)}.`,why:'Autonomous reporting is turning recurring observations into a continuously growing economic history.',sourceKeys:['reporting']});
    numericDeltaEvent({category:'reporting',entity:name,metric:'currentMonthGeneratedIncomeUsd',prev:a.currentMonthGeneratedIncomeUsd,curr:b.currentMonthGeneratedIncomeUsd,unit:'USD',absThreshold:.001,relThreshold:.01,severity:'info',summaryFn:(x,y,d)=>`${name} current-month generated income moved $${x.toFixed(4)} → $${y.toFixed(4)}.`,why:'Generated income is a distinct history stream for capital that may compound inside positions rather than arrive as realised cash.',sourceKeys:['reporting']});
  }
}

// Watch list is evaluated even on the baseline run.
const watchNext = [];
for (const [key, meta] of Object.entries(sources)) if (meta.freshness !== 'fresh') watchNext.push({severity:'watch',category:'source-freshness',entity:key,summary:`${key} source freshness is ${meta.freshness}${meta.ageHours !== null ? ` (${meta.ageHours}h old)` : ''}.`,whyItMatters:'The Observer should reason from current, reproducible data rather than silently carrying stale state.'});
for (const [id,e] of Object.entries(snapshot.productivity.engines||{})) if (e.status !== 'ok') watchNext.push({severity:'watch',category:'adapter-state',entity:id,summary:`${e.protocol || id} / ${id} remains ${e.status}.`,whyItMatters:'A non-ok adapter marks a known edge where the system still lacks a fully current reproducible measurement.'});
for (const [name,c] of Object.entries(snapshot.productivity.companies||{})) if (finite(c.coverage) !== null && c.coverage < .999999) watchNext.push({severity:'watch',category:'productivity-coverage',entity:name,summary:`${name} Productivity coverage is ${(c.coverage*100).toFixed(1)}%.`,whyItMatters:'Unknown productive capital is excluded rather than fabricated as zero; coverage shows exactly what is currently understood.'});
for (const [name,c] of Object.entries(snapshot.rewards.companies||{})) if (Number(c.pendingRoutes||0)>0 || Number(c.unpricedRewards||0)>0 || c.status!=='ok') watchNext.push({severity:'watch',category:'rewards-completeness',entity:name,summary:`${name} Rewards needs attention: status=${c.status}, pendingRoutes=${c.pendingRoutes ?? 0}, unpricedRewards=${c.unpricedRewards ?? 0}.`,whyItMatters:'Unresolved reward routes reduce the completeness of earned-value memory.'});
if (snapshot.stableIndex.currentFullCoverage === false) watchNext.push({severity:'watch',category:'stable-capital-coverage',entity:'Stable Companies Index',summary:`Stable Capital current coverage is not full; display APY is ${snapshot.stableIndex.referenceApyStatus || 'unknown'}.`,whyItMatters:'The Stable layer intentionally carries the last full observation rather than inventing a current full rate.'});

// Rank and cap latest events; history keeps all detected events.
events.sort((a,b)=>severityRank(b.severity)-severityRank(a.severity) || a.category.localeCompare(b.category) || a.entity.localeCompare(b.entity));
watchNext.sort((a,b)=>severityRank(b.severity)-severityRank(a.severity) || a.category.localeCompare(b.category) || a.entity.localeCompare(b.entity));

function eventHeadline() {
  if (!previous) return 'The Holding Observer initialized its first system-memory baseline.';
  if (!events.length) return 'No material system changes crossed the Observer thresholds in this run.';
  const important=events.filter(e=>severityRank(e.severity)>=3).length;
  return `${events.length} material change${events.length===1?'':'s'} detected across The Holding${important?`, including ${important} high-signal event${important===1?'':'s'}`:''}.`;
}

const latest = {
  version: LAYER_VERSION,
  observerVersion: OBSERVER_VERSION,
  generatedAt,
  mode: previous ? 'delta' : 'baseline',
  headline: eventHeadline(),
  sourceHealth: {
    allFresh: Object.values(sources).every(x=>x.freshness==='fresh'),
    freshCount: Object.values(sources).filter(x=>x.freshness==='fresh').length,
    sourceCount: Object.keys(sources).length,
    sources,
  },
  whatChanged: events.slice(0, 20),
  watchNext: watchNext.slice(0, 30),
  bridge: {
    purpose: 'Compact canonical handoff for human/AI reasoning. Read this file first before opening large source artifacts.',
    snapshotHash,
    sourceCompositeHash,
    previousSnapshotAt: previousMemory?.generatedAt ?? null,
  },
};

const memory = {
  version: MEMORY_VERSION,
  observerVersion: OBSERVER_VERSION,
  generatedAt,
  sourceCompositeHash,
  snapshotHash,
  sources,
  currentSnapshot: snapshot,
};

const oldHistory = readJson(PATHS.history, false) || {
  version: HISTORY_VERSION,
  observerVersion: OBSERVER_VERSION,
  startedAt: generatedAt,
  lastUpdatedAt: null,
  runs: [],
  events: [],
};

function timestampFilePart(iso) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) throw new Error(`Invalid Memory Vault timestamp: ${iso}`);
  return d.toISOString().replaceAll(':', '-').replaceAll('.', '-');
}
function vaultRelPathFor(iso, runId) {
  const d = new Date(iso);
  const year = String(d.getUTCFullYear());
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return path.posix.join('intelligence', 'memory-vault', year, month, `${runId}.json`);
}
function vaultAbsPath(rel) {
  const abs = path.resolve(ROOT, rel);
  const vaultRoot = path.resolve(PATHS.vaultRoot);
  if (abs !== vaultRoot && !abs.startsWith(vaultRoot + path.sep)) {
    throw new Error(`Memory Vault path escaped vault root: ${rel}`);
  }
  return abs;
}
function buildVaultRecord({
  recordType = 'observer-run',
  at,
  mode,
  previousRecordHash = null,
  sourceHash,
  snapHash,
  sourceState,
  normalizedState,
  headline,
  runEvents,
  runWatch,
  migration = null,
}) {
  const runId = `${timestampFilePart(at)}-${String(snapHash || 'nohash').slice(0, 10)}`;
  const core = {
    version: VAULT_RECORD_VERSION,
    observerVersion: OBSERVER_VERSION,
    layerVersion: LAYER_VERSION,
    recordType,
    runId,
    generatedAt: at,
    mode,
    chain: {
      previousRecordHash,
    },
    sourceCompositeHash: sourceHash ?? null,
    snapshotHash: snapHash ?? null,
    sources: sourceState || {},
    currentSnapshot: normalizedState || null,
    intelligence: {
      headline: headline ?? null,
      eventCount: safeArray(runEvents).length,
      events: safeArray(runEvents),
      watchCount: safeArray(runWatch).length,
      watchNext: safeArray(runWatch),
    },
    ...(migration ? {migration} : {}),
  };
  const recordHash = hashObject(core);
  return {
    ...core,
    integrity: {
      algorithm: 'sha256',
      recordHash,
      previousRecordHash,
    },
  };
}
function safeArray(v) { return Array.isArray(v) ? v : []; }
function deepEqual(a, b) { return stableStringify(a) === stableStringify(b); }
function validateCorrectionLedger(ledger) {
  if (!ledger || typeof ledger !== 'object') throw new Error('Memory Vault correction ledger is invalid.');
  if (ledger.version !== VAULT_CORRECTIONS_VERSION) throw new Error(`Unexpected Memory Vault correction version: ${ledger.version}`);
  if (!Array.isArray(ledger.entries)) throw new Error('Memory Vault corrections entries[] missing.');
  if (ledger.entryCount !== ledger.entries.length) throw new Error('Memory Vault correction entryCount mismatch.');
  if (ledger.policy?.originalRecordsImmutable !== true) throw new Error('Memory Vault correction policy must preserve original records.');
  const core = {...ledger};
  delete core.integrity;
  const expected = ledger?.integrity?.ledgerHash;
  if (typeof expected !== 'string' || expected.length !== 64) throw new Error('Memory Vault correction ledger hash missing.');
  const actual = hashObject(core);
  if (actual !== expected) throw new Error(`Memory Vault correction ledger integrity mismatch: expected ${expected}, got ${actual}`);
  for (const entry of ledger.entries) {
    if (!entry?.targetRecord?.path || !entry?.targetRecord?.hash) throw new Error(`Correction ${entry?.id || 'unknown'} target record missing.`);
    if (!entry?.evidenceRecord?.path || !entry?.evidenceRecord?.hash) throw new Error(`Correction ${entry?.id || 'unknown'} evidence record missing.`);
    const target = readJson(vaultAbsPath(entry.targetRecord.path));
    const evidence = readJson(vaultAbsPath(entry.evidenceRecord.path));
    verifyVaultRecord(target);
    verifyVaultRecord(evidence);
    if (target.integrity.recordHash !== entry.targetRecord.hash) throw new Error(`Correction ${entry.id} target record hash mismatch.`);
    if (evidence.integrity.recordHash !== entry.evidenceRecord.hash) throw new Error(`Correction ${entry.id} evidence record hash mismatch.`);
    if (target.sourceCompositeHash !== entry.sourceCompositeHash || evidence.sourceCompositeHash !== entry.sourceCompositeHash) {
      throw new Error(`Correction ${entry.id} source-composite evidence mismatch.`);
    }
    for (const field of safeArray(entry.fields)) {
      if (!Array.isArray(field.path) || !field.path.length) throw new Error(`Correction ${entry.id} contains invalid field path.`);
      const targetValue = safeGet(target, field.path);
      const evidenceValue = safeGet(evidence, field.path);
      if (!deepEqual(targetValue, field.recordedValue)) throw new Error(`Correction ${entry.id} target value mismatch at ${field.path.join('.')}.`);
      if (!deepEqual(evidenceValue, field.canonicalInterpretation)) throw new Error(`Correction ${entry.id} evidence value mismatch at ${field.path.join('.')}.`);
    }
  }
  return true;
}
function verifyVaultRecord(record) {
  if (!record || typeof record !== 'object') throw new Error('Memory Vault record is not an object.');
  const expected = record?.integrity?.recordHash;
  if (typeof expected !== 'string' || expected.length !== 64) throw new Error('Memory Vault record hash missing.');
  const core = {...record};
  delete core.integrity;
  const actual = hashObject(core);
  if (actual !== expected) throw new Error(`Memory Vault record integrity mismatch: expected ${expected}, got ${actual}`);
  if ((record?.chain?.previousRecordHash ?? null) !== (record?.integrity?.previousRecordHash ?? null)) {
    throw new Error('Memory Vault previous-record hash mismatch inside record.');
  }
  return true;
}
function writeVaultRecord(record) {
  verifyVaultRecord(record);
  const rel = vaultRelPathFor(record.generatedAt, record.runId);
  const abs = vaultAbsPath(rel);
  if (fs.existsSync(abs)) {
    const existing = readJson(abs);
    verifyVaultRecord(existing);
    if (existing.integrity.recordHash !== record.integrity.recordHash) {
      throw new Error(`Memory Vault refuses to overwrite immutable record ${rel}`);
    }
    return rel;
  }
  writeJson(abs, record);
  return rel;
}
function validateVaultManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') throw new Error('Memory Vault manifest is invalid.');
  if (manifest.version !== VAULT_MANIFEST_VERSION) throw new Error(`Unexpected Memory Vault manifest version: ${manifest.version}`);
  if (!Array.isArray(manifest.runs)) throw new Error('Memory Vault manifest runs[] missing.');
  if (manifest.runCount !== manifest.runs.length) throw new Error('Memory Vault manifest runCount mismatch.');
  const latestMeta = manifest.latestRecord || null;
  if (manifest.runs.length === 0) {
    if (latestMeta !== null) throw new Error('Memory Vault empty manifest cannot have latestRecord.');
    return true;
  }
  const first = manifest.runs[0];
  if (!manifest.chainRootHash || manifest.chainRootHash !== first.recordHash) {
    throw new Error('Memory Vault chain root mismatch.');
  }
  for (let i = 0; i < manifest.runs.length; i++) {
    const expectedPrev = i === 0 ? null : manifest.runs[i - 1].recordHash;
    if ((manifest.runs[i].previousRecordHash ?? null) !== expectedPrev) {
      throw new Error(`Memory Vault manifest chain broken at run ${i}.`);
    }
  }
  const last = manifest.runs[manifest.runs.length - 1];
  if (!latestMeta || latestMeta.recordHash !== last.recordHash || latestMeta.recordPath !== last.recordPath) {
    throw new Error('Memory Vault latestRecord does not match final manifest run.');
  }
  const latestAbs = vaultAbsPath(last.recordPath);
  const latestRecord = readJson(latestAbs);
  verifyVaultRecord(latestRecord);
  if (latestRecord.integrity.recordHash !== last.recordHash) throw new Error('Memory Vault manifest/record hash mismatch.');
  if (latestRecord.snapshotHash !== last.snapshotHash) throw new Error('Memory Vault manifest/record snapshot mismatch.');
  return true;
}
function emptyVaultManifest() {
  return {
    version: VAULT_MANIFEST_VERSION,
    observerVersion: OBSERVER_VERSION,
    recordVersion: VAULT_RECORD_VERSION,
    policy: {
      mode: 'append-only-hash-chained',
      hardLifetimeCap: null,
      canonicalRetention: 'indefinite',
      note: 'Operational change-history remains bounded for fast access; Memory Vault preserves every Observer run without a configured lifetime cap.',
    },
    startedAt: null,
    lastUpdatedAt: null,
    runCount: 0,
    eventCount: 0,
    chainRootHash: null,
    latestRecord: null,
    runs: [],
  };
}
function appendVaultRecord(manifest, record) {
  const rel = writeVaultRecord(record);
  if (manifest.runs.some(r => r.runId === record.runId)) {
    const existing = manifest.runs.find(r => r.runId === record.runId);
    if (existing.recordHash !== record.integrity.recordHash) throw new Error(`Memory Vault duplicate runId conflict: ${record.runId}`);
    return manifest;
  }
  const meta = {
    runId: record.runId,
    generatedAt: record.generatedAt,
    recordType: record.recordType,
    mode: record.mode,
    recordPath: rel,
    recordHash: record.integrity.recordHash,
    previousRecordHash: record.integrity.previousRecordHash,
    snapshotHash: record.snapshotHash,
    sourceCompositeHash: record.sourceCompositeHash,
    eventCount: record.intelligence.eventCount,
    watchCount: record.intelligence.watchCount,
  };
  const next = {
    ...manifest,
    observerVersion: OBSERVER_VERSION,
    recordVersion: VAULT_RECORD_VERSION,
    startedAt: manifest.startedAt || record.generatedAt,
    lastUpdatedAt: generatedAt,
    runCount: manifest.runCount + 1,
    eventCount: manifest.eventCount + record.intelligence.eventCount,
    chainRootHash: manifest.chainRootHash || record.integrity.recordHash,
    latestRecord: meta,
    runs: [...manifest.runs, meta],
  };
  validateVaultManifest(next);
  return next;
}

let vaultManifest = readJson(PATHS.vaultManifest, false);
if (vaultManifest) validateVaultManifest(vaultManifest);
else vaultManifest = emptyVaultManifest();

const vaultCorrections = readJson(PATHS.vaultCorrections);
validateCorrectionLedger(vaultCorrections);

// v0.2 bootstraps the already-verified v0.1 Observer memory into the permanent Vault.
// This imports only data that already physically existed in canonical Observer artifacts.
if (vaultManifest.runCount === 0 && previousMemory?.currentSnapshot && previousMemory?.generatedAt) {
  const sameLatest = previousLatest?.bridge?.snapshotHash === previousMemory?.snapshotHash;
  const legacyRun = [...safeArray(oldHistory.runs)].reverse().find(r => r?.snapshotHash === previousMemory?.snapshotHash) || null;
  const seedEvents = sameLatest ? safeArray(previousLatest?.whatChanged) : safeArray(oldHistory.events).filter(e => safeArray(legacyRun?.eventIds).includes(e?.id));
  const seedWatch = sameLatest ? safeArray(previousLatest?.watchNext) : [];
  const seed = buildVaultRecord({
    recordType: 'imported-v0.1-observer-memory',
    at: previousMemory.generatedAt,
    mode: previousLatest?.mode || legacyRun?.mode || 'baseline',
    previousRecordHash: null,
    sourceHash: previousMemory.sourceCompositeHash,
    snapHash: previousMemory.snapshotHash,
    sourceState: previousMemory.sources,
    normalizedState: previousMemory.currentSnapshot,
    headline: sameLatest ? previousLatest?.headline : 'Imported verified pre-v0.2 Observer memory.',
    runEvents: seedEvents,
    runWatch: seedWatch,
    migration: {
      importedAt: generatedAt,
      fromMemoryVersion: previousMemory.version ?? null,
      fromObserverVersion: previousMemory.observerVersion ?? null,
      sourceHistoryVersion: oldHistory.version ?? null,
      sourceLatestVersion: previousLatest?.version ?? null,
      method: 'verified-existing-observer-artifacts',
      legacyOperationalHistory: {
        startedAt: oldHistory.startedAt ?? null,
        lastUpdatedAt: oldHistory.lastUpdatedAt ?? null,
        runs: safeArray(oldHistory.runs),
        events: safeArray(oldHistory.events),
      },
    },
  });
  vaultManifest = appendVaultRecord(vaultManifest, seed);
}

const currentVaultRecord = buildVaultRecord({
  at: generatedAt,
  mode: previous ? 'delta' : 'baseline',
  previousRecordHash: vaultManifest.latestRecord?.recordHash ?? null,
  sourceHash: sourceCompositeHash,
  snapHash: snapshotHash,
  sourceState: sources,
  normalizedState: snapshot,
  headline: latest.headline,
  runEvents: events,
  runWatch: watchNext,
});
vaultManifest = appendVaultRecord(vaultManifest, currentVaultRecord);
writeJson(PATHS.vaultManifest, vaultManifest);

latest.bridge.memoryVault = {
  version: VAULT_MANIFEST_VERSION,
  policy: vaultManifest.policy.mode,
  runCount: vaultManifest.runCount,
  eventCount: vaultManifest.eventCount,
  startedAt: vaultManifest.startedAt,
  latestRecordPath: vaultManifest.latestRecord.recordPath,
  chainRootHash: vaultManifest.chainRootHash,
  latestRecordHash: vaultManifest.latestRecord.recordHash,
  previousRecordHash: vaultManifest.latestRecord.previousRecordHash,
  corrections: {
    version: vaultCorrections.version,
    policy: vaultCorrections.policy.mode,
    entryCount: vaultCorrections.entryCount,
    ledgerPath: relPath(PATHS.vaultCorrections),
    ledgerHash: vaultCorrections.integrity.ledgerHash,
    interpretationPrecedence: vaultCorrections.policy.interpretationPrecedence,
  },
};

memory.memoryVault = {
  version: VAULT_MANIFEST_VERSION,
  runCount: vaultManifest.runCount,
  eventCount: vaultManifest.eventCount,
  startedAt: vaultManifest.startedAt,
  latestRecordPath: vaultManifest.latestRecord.recordPath,
  chainRootHash: vaultManifest.chainRootHash,
  latestRecordHash: vaultManifest.latestRecord.recordHash,
  corrections: {
    version: vaultCorrections.version,
    entryCount: vaultCorrections.entryCount,
    ledgerPath: relPath(PATHS.vaultCorrections),
    ledgerHash: vaultCorrections.integrity.ledgerHash,
  },
};

const eventById = new Map((oldHistory.events||[]).map(e=>[e.id,e]));
for (const e of events) if (!eventById.has(e.id)) eventById.set(e.id,e);
const run = {
  date: generatedAt.slice(0,10),
  generatedAt,
  mode: previous?'delta':'baseline',
  snapshotHash,
  sourceCompositeHash,
  eventCount: events.length,
  eventIds: events.map(e=>e.id),
  watchCount: watchNext.length,
  vaultRecordPath: vaultManifest.latestRecord.recordPath,
  vaultRecordHash: vaultManifest.latestRecord.recordHash,
};
const priorLifetimeRuns = finite(oldHistory?.lifetime?.runCount) ?? safeArray(oldHistory.runs).length;
const priorLifetimeEvents = finite(oldHistory?.lifetime?.eventCount) ??
  safeArray(oldHistory.runs).reduce((sum, r) => sum + (finite(r?.eventCount) ?? 0), 0);
const history = {
  version:HISTORY_VERSION,
  observerVersion:OBSERVER_VERSION,
  startedAt:oldHistory.startedAt||generatedAt,
  lastUpdatedAt:generatedAt,
  retention: {
    operationalRuns: 730,
    operationalUniqueEvents: 5000,
    longTermCanonicalMemory: 'intelligence/memory-vault/',
  },
  lifetime: {
    runCount: priorLifetimeRuns + 1,
    eventCount: priorLifetimeEvents + events.length,
    uniqueEventCount: eventById.size,
    vaultRunCount: vaultManifest.runCount,
    vaultEventCount: vaultManifest.eventCount,
    vaultStartedAt: vaultManifest.startedAt,
    memoryCorrectionCount: vaultCorrections.entryCount,
  },
  runs:[...(oldHistory.runs||[]),run].slice(-730),
  events:[...eventById.values()].sort((a,b)=>String(a.detectedAt).localeCompare(String(b.detectedAt))).slice(-5000),
};

function money(v, d=2) { const n=finite(v); return n===null?'n/a':`$${n.toFixed(d)}`; }
function buildBrief() {
  const lines=[];
  lines.push('# The Holding — Autonomous Change Intelligence');
  lines.push('');
  lines.push(`**Generated:** ${generatedAt}`);
  lines.push(`**Observer:** ${OBSERVER_VERSION}`);
  lines.push('');
  lines.push(`## ${latest.headline}`);
  lines.push('');
  if (!previous) {
    lines.push('First deterministic baseline recorded. Future runs will compare the same normalized system state and append only material changes to the event memory.');
  } else if (!events.length) {
    lines.push('The source files were observed and normalized, but no configured material-change threshold was crossed.');
  } else {
    for (const e of events.slice(0,12)) lines.push(`- **${e.entity}** — ${e.summary}`);
  }
  lines.push('');
  lines.push('## Watch next');
  lines.push('');
  if (!watchNext.length) lines.push('- No current watch conditions.');
  else for (const w of watchNext.slice(0,12)) lines.push(`- **${w.entity}** — ${w.summary}`);
  lines.push('');
  lines.push('## Current memory anchors');
  lines.push('');
  const def=snapshot.productivity.companies?.['defitea.eth'];
  const mon=snapshot.stableIndex.companies?.['Monetra.eth'];
  const repDef=snapshot.reporting.funds?.['defitea.eth'];
  const repMon=snapshot.reporting.funds?.['Monetra.eth'];
  if (def) lines.push(`- Defitea Reference APR: ${def.aprLatestPct ?? 'n/a'}% · coverage ${def.coverage===null?'n/a':(def.coverage*100).toFixed(1)+'%'}.`);
  if (repDef) lines.push(`- Defitea current-month cash-flow/reference counter: ${money(repDef.currentMonthCashFlowUsd)}.`);
  if (mon) lines.push(`- Monetra Current Capital: ${money(mon.currentCapitalUsd,4)} · display Reference APY ${mon.displayReferenceApyPct ?? 'n/a'}% · claimable ${money(mon.accruedClaimableUsd,4)}.`);
  if (repMon) lines.push(`- Monetra current-month Generated Income: ${money(repMon.currentMonthGeneratedIncomeUsd,4)}.`);
  lines.push('');
  lines.push('## Long-term memory');
  lines.push('');
  lines.push(`- Memory Vault: ${vaultManifest.runCount} immutable/hash-chained run record${vaultManifest.runCount===1?'':'s'} since ${vaultManifest.startedAt}.`);
  lines.push(`- Latest vault record: \`${vaultManifest.latestRecord.recordPath}\`.`);
  lines.push('- Operational history remains compact; the Memory Vault has no configured lifetime cap.');
  lines.push(`- Memory correction ledger: ${vaultCorrections.entryCount} append-only annotation${vaultCorrections.entryCount===1?'':'s'}; original Vault records remain immutable.`);
  lines.push('');
  lines.push('---');
  lines.push('This brief is deterministic. It does not invent explanations or investment decisions. Higher-level reasoning should be performed from `change-intelligence.json` plus the cited source artifacts.');
  lines.push('');
  return lines.join('\n');
}

for (const file of [PATHS.memory,PATHS.history,PATHS.latest,PATHS.brief,PATHS.vaultManifest,PATHS.vaultCorrections]) ensureDir(file);
writeJson(PATHS.memory, memory);
writeJson(PATHS.history, history);
writeJson(PATHS.latest, latest);
fs.writeFileSync(PATHS.brief, buildBrief()+'\n');

console.log('The Holding Observer complete.');
console.log(`Mode: ${latest.mode}`);
console.log(`Events: ${events.length}`);
console.log(`Watch: ${watchNext.length}`);
console.log(`Memory Vault runs: ${vaultManifest.runCount}`);
console.log(`Memory Vault latest: ${vaultManifest.latestRecord.recordPath}`);
console.log(`Snapshot hash: ${snapshotHash}`);
