#!/usr/bin/env node
/**
 * The Holding · Reporting Layer v1.2.1 · Defitea + Monetra
 * ---------------------------------------------------------
 *
 * Core reliability rule:
 *   fail soft on an individual economic data source, fail closed on structural
 *   integrity. A single temporarily unavailable Reference APR must not freeze
 *   the whole report. UNKNOWN is never converted to 0.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const DEFITEA_STATE_FILE = process.env.DEFITEA_STATE_FILE || path.join(ROOT, 'companies', 'defitea-canonical-state.json');
const PRODUCTIVITY_DATA_FILE = process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT, 'companies', 'productivity-data.json');
const MARKET_DATA_FILE = process.env.MARKET_DATA_FILE || path.join(ROOT, 'intelligence', 'market-data', 'market-data.json');
const REWARDS_DATA_FILE = process.env.REWARDS_DATA_FILE || path.join(ROOT, 'companies', 'rewards-data.json');
const STABLE_INDEX_DATA_FILE = process.env.STABLE_INDEX_DATA_FILE || path.join(ROOT, 'companies', 'stable-index-data.json');
const EMBEDDED_LEDGER_FILE = process.env.EMBEDDED_LEDGER_FILE || path.join(ROOT, 'companies', 'embedded-yield-ledger.json');
const REPORTING_DATA_FILE = process.env.REPORTING_DATA_FILE || path.join(ROOT, 'reporting', 'reporting-data.json');
const RATE_CONTINUITY_POLICY_FILE = process.env.RATE_CONTINUITY_POLICY_FILE || path.join(ROOT, 'reporting', 'rate-continuity-policy.json');

const DEFITEA = 'defitea.eth';
const MONETRA = 'Monetra.eth';
const DEFITEA_CANONICAL_POSITION_COUNT = 11;
const REPORTING_VERSION = '1.2.1-resilient-rate-coverage';
const METHODOLOGY_VERSION = '1.2.1-dual-fund-canonical-market-data-resilient-reference-model';
const MAX_DAILY_SNAPSHOTS = 550;

const LEGACY_DEFITEA_MONTHS = {
  '2026-01': { month:'2026-01', status:'final-reported', mode:'reported-realised', cashFlowUsd:29.66, monthlyYieldPct:1.34, annualizedAprPct:16.00, averageTvlUsd:2213.43, source:'legacy-verified-report' },
  '2026-02': { month:'2026-02', status:'final-reported', mode:'reported-realised', cashFlowUsd:45.97, monthlyYieldPct:1.84, annualizedAprPct:22.00, averageTvlUsd:2498.37, source:'legacy-verified-report' },
  '2026-03': { month:'2026-03', status:'final-reported', mode:'reported-realised', cashFlowUsd:27.51, monthlyYieldPct:1.02, annualizedAprPct:12.22, averageTvlUsd:2697.06, source:'legacy-verified-report' },
  '2026-04': { month:'2026-04', status:'final-reported', mode:'reported-realised', cashFlowUsd:20.20, monthlyYieldPct:0.78, annualizedAprPct:9.36, averageTvlUsd:2589.74, source:'legacy-verified-report' },
  '2026-05': { month:'2026-05', status:'final-reported', mode:'reported-realised', cashFlowUsd:30.40, monthlyYieldPct:1.01, annualizedAprPct:12.20, averageTvlUsd:3009.90, source:'legacy-verified-report' },
  '2026-06': { month:'2026-06', status:'final-reported', mode:'reported-realised', cashFlowUsd:74.76, monthlyYieldPct:1.31, annualizedAprPct:15.72, averageTvlUsd:5706.87, source:'legacy-verified-report' },
  '2026-07': { month:'2026-07', status:'final-reported', mode:'reported-realised', cashFlowUsd:56.05, monthlyYieldPct:0.82, annualizedAprPct:9.89, averageTvlUsd:6835.37, source:'legacy-verified-report' }
};

function round(n, d=4) {
  if (!Number.isFinite(Number(n))) return null;
  const f = 10 ** d;
  return Math.round(Number(n) * f) / f;
}
function finite(v) {
  if (v === null || v === undefined || v === '') return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function avg(arr) {
  const clean = arr.map(finite).filter(Number.isFinite);
  return clean.length ? clean.reduce((s,x) => s+x, 0) / clean.length : NaN;
}
function nowIso() { return new Date().toISOString(); }
function dayKey(date = new Date()) { return date.toISOString().slice(0,10); }
function monthKeyFromDate(date = new Date()) { return date.toISOString().slice(0,7); }
function daysInMonthUTC(year, month1) { return new Date(Date.UTC(year, month1, 0)).getUTCDate(); }
function monthLabel(key) {
  const [y,m] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,1)));
}
function ageDays(now, then) {
  const a=Date.parse(now||'');
  const b=Date.parse(then||'');
  return Number.isFinite(a)&&Number.isFinite(b)?Math.max(0,(a-b)/86400000):Infinity;
}
async function readJson(file, fallback={}) {
  try { return JSON.parse(await fs.readFile(file,'utf8')); } catch { return fallback; }
}
async function writeJson(file,data) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
}
function sameStringSet(a,b) {
  if (a.length !== b.length) return false;
  const aa=[...a].sort(), bb=[...b].sort();
  return aa.every((x,i)=>x===bb[i]);
}
function validateRatePolicy(policy) {
  if (policy?.version!=='0.1-reporting-rate-continuity'||policy?.status!=='production') throw new Error('Reporting rate continuity policy invalid');
  if (policy?.semantics?.unknownIsNotZero!==true||policy?.semantics?.singleSourceDataFailureMustNotFreezeWholeReport!==true||policy?.semantics?.structuralIntegrityFailureRemainsFailClosed!==true) throw new Error('Reporting rate continuity epistemic policy drift');
  return policy;
}
function carryDaysForCadence(policy, cadence) {
  const key=String(cadence||'').toLowerCase();
  const exact=finite(policy?.cadenceMaxCarryDays?.[key]);
  const fallback=finite(policy?.defaultMaxCarryDays);
  return Number.isFinite(exact)&&exact>=0?exact:(Number.isFinite(fallback)&&fallback>=0?fallback:0);
}
function canonicalDefiteaPositions(defiteaState) {
  if (defiteaState?.company?.name !== DEFITEA) throw new Error('Defitea canonical state identity mismatch');
  const rows=defiteaState?.productivePositions;
  if (!Array.isArray(rows) || rows.length !== DEFITEA_CANONICAL_POSITION_COUNT) throw new Error(`Defitea canonical productive inventory must contain exactly ${DEFITEA_CANONICAL_POSITION_COUNT} positions`);
  const ids=rows.map(r=>r?.assetId).filter(Boolean);
  if (new Set(ids).size !== DEFITEA_CANONICAL_POSITION_COUNT) throw new Error('Defitea canonical productive asset IDs must be unique');
  for (const row of rows) {
    if (!row?.assetId) throw new Error('Defitea canonical productive position missing assetId');
    if (!(finite(row.quantity)>0)) throw new Error(`${row.assetId}: canonical quantity must be positive`);
  }
  return rows.map(r=>({id:r.assetId,qty:finite(r.quantity),display:r.display||null}));
}
function assertDefiteaProductivityParity(positions, productivity) {
  const company=productivity?.companies?.[DEFITEA];
  const rows=company?.breakdown;
  if (!company || !Array.isArray(rows)) throw new Error(`${DEFITEA} missing from productivity-data.json`);
  const positionIds=positions.map(p=>p.id);
  const productivityIds=rows.map(r=>r?.principalId).filter(Boolean);
  if (!sameStringSet(positionIds,productivityIds)) throw new Error(`Defitea Productivity inventory drift: canonical=${positionIds.join(',')} productivity=${productivityIds.join(',')}`);
  const byId=new Map(rows.map(r=>[r.principalId,r]));
  for (const p of positions) if (!byId.get(p.id)?.engineId) throw new Error(`${p.id}: Productivity engineId missing`);
  return {company,byId};
}
function selectedMarketPrices(positions, marketData) {
  if (!marketData || typeof marketData !== 'object') throw new Error('Canonical Market Data unavailable');
  if (!marketData.generatedAt) throw new Error('Canonical Market Data generatedAt missing');
  if (marketData?.semantics?.perAssetAuthoritySelectionApplied !== true) throw new Error('Canonical Market Data per-asset authority selection missing');
  const byId=new Map();
  for (const p of positions) {
    const row=marketData?.prices?.[p.id];
    const usd=finite(row?.usd);
    if (!(usd>0)) throw new Error(`${p.id}: selected canonical market price missing`);
    if (row?.status !== 'fresh') throw new Error(`${p.id}: canonical market price is not fresh`);
    if (!row?.authority?.selectedLane) throw new Error(`${p.id}: canonical selected-lane provenance missing`);
    byId.set(p.id,{usd,row});
  }
  return byId;
}
function resolveReferenceRate({prod,engine,prior,previousCapturedAt,generatedAt,policy}) {
  const currentStatus=String(prod?.engineStatus||engine?.status||'unknown').toLowerCase();
  const currentApr=finite(prod?.apr);
  const accepted=new Set(policy?.currentAcceptedStatuses||['ok']);
  if (accepted.has(currentStatus)&&Number.isFinite(currentApr)&&currentApr>=0) {
    return {
      status:'current', apr:currentApr, source:'productivity-current',
      observedAt:engine?.periodEnd||engine?.lastUpdatedAt||generatedAt,
      ageDays:0, maxCarryDays:carryDaysForCadence(policy,engine?.nativeCadence),
      sourceEngineStatus:currentStatus
    };
  }

  const hard=new Set(policy?.hardInvalidStatuses||[]);
  const carryEligible=new Set(policy?.carryEligibleStatuses||[]);
  if (!hard.has(currentStatus)&&carryEligible.has(currentStatus)) {
    const priorApr=finite(prior?.referenceApr);
    const priorObservedAt=prior?.rateObservedAt||prior?.rateSourceObservedAt||previousCapturedAt||null;
    const maxCarryDays=carryDaysForCadence(policy,engine?.nativeCadence);
    const priorAge=ageDays(generatedAt,priorObservedAt);
    if (Number.isFinite(priorApr)&&priorApr>=0&&priorObservedAt&&priorAge<=maxCarryDays) {
      return {
        status:'carried-forward', apr:priorApr, source:'previous-published-valid-reporting-rate',
        observedAt:priorObservedAt, ageDays:priorAge, maxCarryDays,
        sourceEngineStatus:currentStatus
      };
    }
  }

  return {
    status:'unknown', apr:null, source:'unavailable', observedAt:null, ageDays:null,
    maxCarryDays:carryDaysForCadence(policy,engine?.nativeCadence),
    sourceEngineStatus:currentStatus
  };
}
function buildVlCvxReconciliation(rewards) {
  const diag=rewards?.diagnostics?.defiteaUnion||null;
  const company=rewards?.companies?.[DEFITEA]||null;
  const unionRow=(company?.rewards||[]).find(r=>r?.route==='votium-union-scrvusd')||null;
  const routeSource=(company?.sources||[]).find(r=>r?.route==='votium-union')||null;
  const graph=routeSource?.details?.vlCvxRouteGraph||diag?.routeGraph||null;
  const entitlement=routeSource?.details?.union?.airdrop?.entitlement||null;
  const currentRoute=graph?.currentRoute||graph?.current||null;
  const settlementAsset=graph?.currentSettlementAsset||'scrvUSD';
  return {
    status:diag||routeSource||unionRow?'observed':'unknown', principalAsset:'vlCVX', referenceIncomeEngine:'convex_vlcvx',
    referenceAprIncludesVotiumIncentives:true, currentRoute, settlementAsset,
    claimableSettlement:{classification:unionRow?.classification||entitlement?.status||null,amount:Number.isFinite(finite(unionRow?.amount))?round(finite(unionRow.amount),10):null,usdValue:Number.isFinite(finite(unionRow?.usdValue))?round(finite(unionRow.usdValue),6):null},
    legacyResidualPreserved:graph?.preserveLegacyResidualUntilClaimed??null,
    claimableSettlementAddedToReferenceCashFlow:false, realisedCashFlowAuthority:false,
    reason:'Votium incentives are already represented inside the convex_vlcvx Reference APR. Union settlement is a separate claimable/reconciliation lane and is never added on top of the reference cash-flow model.',
    unknownIsNotZero:true
  };
}
function upsertDaily(previousRows, snapshot) {
  const byDate=new Map((Array.isArray(previousRows)?previousRows:[]).filter(r=>r?.date).map(r=>[r.date,r]));
  byDate.set(snapshot.date,snapshot);
  return [...byDate.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-MAX_DAILY_SNAPSHOTS);
}

function buildDefiteaSnapshot({generatedAt,positions,productivity,marketData,rewards,previousSnapshot=null,ratePolicy}) {
  validateRatePolicy(ratePolicy);
  const {company,byId:breakdown}=assertDefiteaProductivityParity(positions,productivity);
  const market=selectedMarketPrices(positions,marketData);
  const priorRows=new Map((previousSnapshot?.positions||[]).map(r=>[r?.principalId||r?.engineId,r]));
  const rows=[];
  const carriedRatePositions=[];
  const unknownRatePositions=[];
  let totalValue=0, coveredValue=0, weightedApr=0;

  for (const p of positions) {
    const prod=breakdown.get(p.id);
    const engine=productivity?.engines?.[prod.engineId]||{};
    const priceState=market.get(p.id);
    const value=p.qty*priceState.usd;
    const prior=priorRows.get(p.id)||priorRows.get(prod.engineId)||null;
    const resolved=resolveReferenceRate({prod,engine,prior,previousCapturedAt:previousSnapshot?.capturedAt||null,generatedAt,policy:ratePolicy});
    totalValue+=value;
    if (Number.isFinite(finite(resolved.apr))) {
      coveredValue+=value;
      weightedApr+=value*finite(resolved.apr);
    }
    if (resolved.status==='carried-forward') carriedRatePositions.push(p.id);
    if (resolved.status==='unknown') unknownRatePositions.push(p.id);
    rows.push({
      principalId:p.id, display:p.display, units:p.qty, price:round(priceState.usd,8), valueUsd:round(value,2),
      priceSource:'canonical-market-data', marketSource:priceState.row.source||null,
      selectedLane:priceState.row.authority.selectedLane, marketObservedAt:priceState.row.observedAt||marketData.generatedAt,
      engineId:prod.engineId, engineStatus:prod.engineStatus||engine.status||'unknown',
      referenceApr:Number.isFinite(finite(resolved.apr))?round(finite(resolved.apr),4):null,
      rateStatus:resolved.status, rateSource:resolved.source, rateObservedAt:resolved.observedAt,
      rateAgeDays:Number.isFinite(finite(resolved.ageDays))?round(finite(resolved.ageDays),4):null,
      maxCarryDays:resolved.maxCarryDays, sourceEngineStatus:resolved.sourceEngineStatus,
      unknownIsNotZero:true
    });
  }
  const rateCoveredPositionCount=rows.filter(r=>r.rateStatus!=='unknown').length;
  const coverage=totalValue>0?coveredValue/totalValue:0;
  const referenceApr=coveredValue>0?weightedApr/coveredValue:NaN;
  const modeledDailyCashFlow=coveredValue>0?(weightedApr/100)/365:NaN;
  const publishedApr=finite(company.aprLatest);
  const fullProductiveCoverage=rateCoveredPositionCount===rows.length;
  return {
    date:dayKey(new Date(generatedAt)), capturedAt:generatedAt,
    totalValueUsd:round(totalValue,2), coveredValueUsd:round(coveredValue,2), coverage:round(coverage,8),
    positionCount:rows.length, rateCoveredPositionCount, fullProductiveCoverage,
    reportQuality:fullProductiveCoverage?'full':(rateCoveredPositionCount>0?'partial':'rate-unavailable'),
    referenceApr:Number.isFinite(referenceApr)?round(referenceApr,4):null,
    productivityPublishedApr:Number.isFinite(publishedApr)?round(publishedApr,4):null,
    modeledDailyCashFlowUsd:Number.isFinite(modeledDailyCashFlow)?round(modeledDailyCashFlow,6):null,
    productivitySnapshotAt:productivity?.generatedAt||null,
    marketDataGeneratedAt:marketData.generatedAt, marketDataVersion:marketData.version||null, marketDataStatus:marketData.status||null,
    priceAuthority:'canonical-selected-market-data', priceStatus:'canonical', fallbackPrices:[], missingPrices:[],
    rateContinuityPolicyVersion:ratePolicy.version,
    carriedRatePositions, unknownRatePositions, unknownIsNotZero:true,
    sourceIsolationApplied:carriedRatePositions.length>0||unknownRatePositions.length>0,
    vlCvxReconciliation:buildVlCvxReconciliation(rewards), positions:rows
  };
}
function aggregateDefiteaMonths(daily, now=new Date()) {
  const ordered=(Array.isArray(daily)?daily:[]).filter(r=>r?.date).slice().sort((a,b)=>a.date.localeCompare(b.date));
  const firstTracked=ordered[0]?.date||null;
  const firstTrackedMonth=firstTracked?firstTracked.slice(0,7):null;
  const groups=new Map();
  for (const row of ordered) {
    const key=row.date.slice(0,7);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  const currentKey=monthKeyFromDate(now); const out={};
  for (const [key,raw] of groups) {
    const rows=raw.slice().sort((a,b)=>a.date.localeCompare(b.date));
    const good=rows.filter(r=>finite(r.totalValueUsd)>0&&finite(r.coveredValueUsd)>0&&finite(r.referenceApr)>=0&&finite(r.modeledDailyCashFlowUsd)>=0);
    if (!good.length) continue;
    const [year,month]=key.split('-').map(Number);
    const totalTvl=good.reduce((s,r)=>s+finite(r.totalValueUsd),0);
    const totalCovered=good.reduce((s,r)=>s+finite(r.coveredValueUsd),0);
    const averageTvl=totalTvl/good.length;
    const averageCovered=totalCovered/good.length;
    const weightedApr=totalCovered>0?good.reduce((s,r)=>s+finite(r.coveredValueUsd)*finite(r.referenceApr),0)/totalCovered:NaN;
    const observed=good.reduce((s,r)=>s+finite(r.modeledDailyCashFlowUsd),0);
    const isCurrent=key===currentKey;
    const isFirstTrackedMonth=key===firstTrackedMonth;
    const fullDays=daysInMonthUTC(year,month);
    const expectedDays=isCurrent?now.getUTCDate():fullDays;
    const uniqueDays=new Set(good.map(r=>r.date)).size;
    const dayCoverage=expectedDays>0?uniqueDays/expectedDays*100:0;
    const rateCoverage=totalTvl>0?totalCovered/totalTvl:0;
    const firstDay=Number(good[0].date.slice(8,10));
    const partial=firstDay>1||dayCoverage<80||rateCoverage<0.999999;
    const normalization=!isCurrent&&!isFirstTrackedMonth&&uniqueDays>0&&uniqueDays<fullDays?fullDays/uniqueDays:1;
    const cash=observed*normalization;
    const monthlyYield=averageTvl>0?cash/averageTvl*100:NaN;
    const observedYield=averageTvl>0?observed/averageTvl*100:NaN;
    const cashFlowAnnualizedApr=isCurrent?(uniqueDays>0?observedYield*365/uniqueDays:NaN):monthlyYield*12;
    const carriedDays=good.filter(r=>(r.carriedRatePositions||[]).length>0).length;
    const unknownDays=good.filter(r=>(r.unknownRatePositions||[]).length>0).length;
    out[key]={
      month:key,label:monthLabel(key),status:isCurrent?'provisional':(partial?'final-reference-partial':'final-reference'),mode:'reference-model',
      cashFlowUsd:round(cash,2),referenceCashFlowUsd:round(cash,2),observedReferenceCashFlowUsd:round(observed,2),normalizationFactor:round(normalization,6),
      monthlyYieldPct:Number.isFinite(monthlyYield)?round(monthlyYield,4):null,
      annualizedAprPct:Number.isFinite(cashFlowAnnualizedApr)?round(cashFlowAnnualizedApr,4):null,
      averageReferenceAprPct:Number.isFinite(weightedApr)?round(weightedApr,4):null,
      averageTvlUsd:round(averageTvl,2),averageRateCoveredTvlUsd:round(averageCovered,2),averageRateCoverage:round(rateCoverage,8),
      sampleDays:uniqueDays,expectedDays,sampleCoveragePct:round(dayCoverage,2),partialPeriod:partial,
      carriedRateDays:carriedDays,unknownRateDays:unknownDays,
      periodStart:good[0].date,periodEnd:good[good.length-1].date,source:'the-holding-reporting-layer',
      firstTrackingMonth:isFirstTrackedMonth,unobservedPreTrackingDaysBackfilled:false,unknownIsNotZero:true,
      note:isCurrent
        ?'Live reference model. Temporarily unavailable rate sources are isolated; bounded prior verified rates may be carried with provenance, otherwise UNKNOWN positions are excluded from modeled income without becoming zero.'
        :(isFirstTrackedMonth&&partial
          ?'First Defitea tracking month: only observed reporting days are counted; no income is fabricated before autonomous tracking began.'
          :(partial?'Reference model contains partial day and/or rate coverage; UNKNOWN remains excluded, never zero.':'Final reference model from canonical daily productive TVL and validated Reference APR.'))
    };
  }
  return out;
}

function buildMonetraSnapshot({generatedAt,stableIndex,ledger}) {
  const c=(stableIndex?.companies||[]).find(x=>x?.registry==='008'||x?.name===MONETRA);
  if (!c) throw new Error(`${MONETRA} not found in stable-index-data.json`);
  const stableCapital=finite(c.productiveStableCapitalUsd??c.stableCapitalUsd);
  const currentCapital=finite(c.currentCapitalUsd??c.performance?.currentCapitalUsd);
  const marketPrincipal=finite(c.marketPrincipalUsd??c.performance?.marketPrincipalUsd??c.stableCapitalUsd);
  const claimable=finite(c.accruedClaimableUsd??c.performance?.claimableUsd);
  const displayApy=finite(c.currentReferenceApyPct);
  const fallbackApy=finite(c.displayReferenceApyPct);
  const referenceApy=Number.isFinite(displayApy)?displayApy:fallbackApy;
  if (!(stableCapital>0)) throw new Error('Monetra productive Stable Capital missing');
  if (!(referenceApy>=0)) throw new Error('Monetra Reference APY missing');
  const dailyRate=Math.pow(1+referenceApy/100,1/365)-1;
  const generated=stableCapital*dailyRate;
  const embedded=finite(c.embeddedYield?.sinceTrackingUsd??ledger?.aggregate?.embeddedIncomeSinceTrackingUsd);
  const stablePrice=finite(c.performance?.stablePriceEffectUsd??stableIndex?.summary?.stablePriceEffectUsd);
  const strategyPnl=finite(c.performance?.sinceInceptionUsd??stableIndex?.summary?.strategyPerformanceUsd);
  const netPnl=finite(c.performance?.netMarketPnlUsd??stableIndex?.summary?.netMarketPnlUsd);
  return {
    date:dayKey(new Date(generatedAt)),capturedAt:generatedAt,
    stableCapitalUsd:round(stableCapital,8),marketPrincipalUsd:Number.isFinite(marketPrincipal)?round(marketPrincipal,8):null,
    currentCapitalUsd:Number.isFinite(currentCapital)?round(currentCapital,8):null,accruedClaimableUsd:Number.isFinite(claimable)?round(claimable,8):null,
    referenceApyPct:round(referenceApy,6),referenceApyStatus:c.referenceApyStatus||null,currentCoverage:Number.isFinite(finite(c.currentCoverage))?round(finite(c.currentCoverage),8):null,
    modeledDailyGeneratedIncomeUsd:round(generated,8),dailyEquivalentYieldPct:round(dailyRate*100,8),
    observedEmbeddedIncomeSinceTrackingUsd:Number.isFinite(embedded)?round(embedded,8):null,
    strategyPerformanceSinceInceptionUsd:Number.isFinite(strategyPnl)?round(strategyPnl,8):null,
    stablePriceEffectUsd:Number.isFinite(stablePrice)?round(stablePrice,8):null,netMarketPnlUsd:Number.isFinite(netPnl)?round(netPnl,8):null,
    stableSnapshotAt:stableIndex?.generatedAt||null,ledgerSnapshotAt:ledger?.generatedAt||null,source:'stable-capital-intelligence-layer'
  };
}
function aggregateMonetraMonths(daily, now=new Date()) {
  const groups=new Map();
  for (const row of daily) {
    if (!row?.date) continue;
    const key=row.date.slice(0,7);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  const firstTracked=daily.find(r=>r?.date)?.date||null;
  const firstTrackedMonth=firstTracked?firstTracked.slice(0,7):null;
  const currentKey=monthKeyFromDate(now); const out={};
  for (const [key,raw] of groups) {
    const rows=raw.slice().sort((a,b)=>a.date.localeCompare(b.date));
    const good=rows.filter(r=>finite(r.stableCapitalUsd)>0&&finite(r.referenceApyPct)>=0&&finite(r.modeledDailyGeneratedIncomeUsd)>=0);
    if (!good.length) continue;
    const [year,month]=key.split('-').map(Number);
    const totalCapital=good.reduce((s,r)=>s+finite(r.stableCapitalUsd),0);
    const avgCapital=totalCapital/good.length;
    const weightedApy=good.reduce((s,r)=>s+finite(r.stableCapitalUsd)*finite(r.referenceApyPct),0)/totalCapital;
    const observed=good.reduce((s,r)=>s+finite(r.modeledDailyGeneratedIncomeUsd),0);
    const isCurrent=key===currentKey;
    const isFirstTrackedMonth=key===firstTrackedMonth;
    const fullDays=daysInMonthUTC(year,month);
    const expectedDays=isCurrent?now.getUTCDate():fullDays;
    const uniqueDays=new Set(good.map(r=>r.date)).size;
    const coverage=expectedDays>0?uniqueDays/expectedDays*100:0;
    const partial=Number(good[0].date.slice(8,10))>1||coverage<80;
    const normalization=!isCurrent&&!isFirstTrackedMonth&&uniqueDays>0&&uniqueDays<fullDays?fullDays/uniqueDays:1;
    const generated=observed*normalization;
    const monthlyYield=avgCapital>0?generated/avgCapital*100:NaN;
    out[key]={
      month:key,label:monthLabel(key),status:isCurrent?'provisional':(partial?'final-reference-partial':'final-reference'),mode:'stable-reference-income',
      generatedIncomeUsd:round(generated,4),cashFlowUsd:round(generated,4),observedGeneratedIncomeUsd:round(observed,4),normalizationFactor:round(normalization,6),
      monthlyYieldPct:Number.isFinite(monthlyYield)?round(monthlyYield,4):null,averageReferenceApyPct:round(weightedApy,6),annualizedAprPct:round(weightedApy,6),
      averageStableCapitalUsd:round(avgCapital,4),averageTvlUsd:round(avgCapital,4),sampleDays:uniqueDays,expectedDays,sampleCoveragePct:round(coverage,2),partialPeriod:partial,
      periodStart:good[0].date,periodEnd:good[good.length-1].date,source:'the-holding-stable-reporting-layer',semantic:'reference-generated-income-not-realised-cash-flow',stablePriceEffectExcluded:true,
      note:isCurrent?'Live Monetra reference-generated income. Current month is provisional.':(isFirstTrackedMonth&&partial?'First tracking month: only observed reporting days are counted; no historical income is fabricated.':(partial?'Reference estimate normalized only for isolated missed daily snapshots.':'Final reference-generated-income model from daily Stable Capital and validated Reference APY.'))
    };
  }
  return out;
}
function buildYearSummary(months, year) {
  const rows=Object.values(months||{}).filter(m=>m?.month?.startsWith(String(year)+'-')).sort((a,b)=>a.month.localeCompare(b.month));
  const closed=rows.filter(m=>m.status!=='provisional');
  const provisional=rows.find(m=>m.status==='provisional')||null;
  const cash=closed.reduce((s,m)=>s+(finite(m.cashFlowUsd)||0),0);
  const yields=closed.map(m=>finite(m.monthlyYieldPct)).filter(Number.isFinite);
  const ytdYield=yields.reduce((s,x)=>s+x,0);
  const annualized=yields.length?avg(yields)*12:NaN;
  const best=closed.filter(m=>Number.isFinite(finite(m.monthlyYieldPct))).sort((a,b)=>finite(b.monthlyYieldPct)-finite(a.monthlyYieldPct))[0]||null;
  return {year,closedMonths:closed.length,ytdCashFlowUsd:round(cash,2),ytdCashFlowEstimated:closed.some(m=>m.mode!=='reported-realised'),ytdCashFlowYieldPct:round(ytdYield,4),annualizedCashFlowAprPct:Number.isFinite(annualized)?round(annualized,4):null,bestMonth:best?.month||null,bestMonthLabel:best?.label||null,bestMonthYieldPct:best?round(finite(best.monthlyYieldPct),4):null,periodStart:closed[0]?.month||null,periodEnd:closed[closed.length-1]?.month||null,currentMonth:provisional?.month||null,currentMonthReferenceCashFlowUsd:provisional?.cashFlowUsd??null,currentMonthYieldPct:provisional?.monthlyYieldPct??null,currentMonthAverageTvlUsd:provisional?.averageTvlUsd??null,modes:[...new Set(closed.map(m=>m.mode))]};
}
function buildMonetraSummary(months, year, latestSnapshot) {
  const generic=buildYearSummary(months,year);
  const current=generic.currentMonth?months[generic.currentMonth]:null;
  return {...generic,currentMonthGeneratedIncomeUsd:current?.generatedIncomeUsd??null,currentMonthYieldPct:current?.monthlyYieldPct??null,currentMonthAverageStableCapitalUsd:current?.averageStableCapitalUsd??null,currentStableCapitalUsd:latestSnapshot?.stableCapitalUsd??null,currentCapitalUsd:latestSnapshot?.currentCapitalUsd??null,currentReferenceApyPct:latestSnapshot?.referenceApyPct??null,observedEmbeddedIncomeSinceTrackingUsd:latestSnapshot?.observedEmbeddedIncomeSinceTrackingUsd??null,metricSemantic:'reference-generated-income-not-realised-cash-flow'};
}

async function main() {
  const generatedAt=nowIso();
  const [defiteaState,productivity,marketData,rewards,stableIndex,ledger,previous,ratePolicyRaw]=await Promise.all([
    readJson(DEFITEA_STATE_FILE,{}),readJson(PRODUCTIVITY_DATA_FILE,{}),readJson(MARKET_DATA_FILE,{}),readJson(REWARDS_DATA_FILE,{}),readJson(STABLE_INDEX_DATA_FILE,{}),readJson(EMBEDDED_LEDGER_FILE,{}),readJson(REPORTING_DATA_FILE,{}),readJson(RATE_CONTINUITY_POLICY_FILE,{})
  ]);
  const ratePolicy=validateRatePolicy(ratePolicyRaw);
  const defPositions=canonicalDefiteaPositions(defiteaState);
  const defSnapshot=buildDefiteaSnapshot({generatedAt,positions:defPositions,productivity,marketData,rewards,previousSnapshot:previous?.funds?.[DEFITEA]?.latestSnapshot||null,ratePolicy});
  const defDaily=upsertDaily(previous?.funds?.[DEFITEA]?.daily,defSnapshot);
  const defAuto=aggregateDefiteaMonths(defDaily,new Date(generatedAt));
  const defMonths={...(previous?.funds?.[DEFITEA]?.months||{}),...LEGACY_DEFITEA_MONTHS,...defAuto};
  for (const [k,v] of Object.entries(LEGACY_DEFITEA_MONTHS)) defMonths[k]=v;
  const defYears=[...new Set(Object.keys(defMonths).map(k=>Number(k.slice(0,4))).filter(Number.isFinite))];
  const defSummaries=Object.fromEntries(defYears.map(y=>[String(y),buildYearSummary(defMonths,y)]));

  const monSnapshot=buildMonetraSnapshot({generatedAt,stableIndex,ledger});
  const monDaily=upsertDaily(previous?.funds?.[MONETRA]?.daily,monSnapshot);
  const monAuto=aggregateMonetraMonths(monDaily,new Date(generatedAt));
  const monMonths={...(previous?.funds?.[MONETRA]?.months||{}),...monAuto};
  const monYears=[...new Set(Object.keys(monMonths).map(k=>Number(k.slice(0,4))).filter(Number.isFinite))];
  const monSummaries=Object.fromEntries(monYears.map(y=>[String(y),buildMonetraSummary(monMonths,y,monSnapshot)]));

  const output={
    version:REPORTING_VERSION,methodologyVersion:METHODOLOGY_VERSION,generatedAt,
    note:'Daily Reporting Layer for Defitea and Monetra. Structural integrity remains fail-closed. Individual temporary rate-source failures are isolated: a bounded prior verified rate may be carried with provenance; otherwise that source remains UNKNOWN and is excluded from modeled income without becoming zero. Defitea Jan–Jul 2026 reported/realised history is preserved. Monetra remains a separate stable reference-income family.',
    schedule:{dailySnapshot:'06:07 UTC',defiteaInventoryReference:'companies/defitea-canonical-state.json',defiteaMarketDataReference:'intelligence/market-data/market-data.json',defiteaProductivityReference:'latest available Productivity Intelligence snapshot',defiteaExternalPriceDiscovery:false,rateContinuityPolicyReference:'reporting/rate-continuity-policy.json',monetraStableReference:'latest Stable Capital Intelligence snapshot after 05:37 UTC daily run'},
    funds:{
      [DEFITEA]:{trackingStartedAt:defDaily[0]?.date||null,latestSnapshot:defSnapshot,daily:defDaily,months:defMonths,summaries:defSummaries,semantic:'reference-cash-flow-model-with-source-isolation-not-claim-accounting',exactCanonicalProductivePositionCount:DEFITEA_CANONICAL_POSITION_COUNT,rateContinuityPolicyVersion:ratePolicy.version,vlCvxReconciliation:defSnapshot.vlCvxReconciliation},
      [MONETRA]:{trackingStartedAt:monDaily[0]?.date||null,latestSnapshot:monSnapshot,daily:monDaily,months:monMonths,summaries:monSummaries,semantic:'reference-generated-income-not-realised-cash-flow'}
    }
  };
  await writeJson(REPORTING_DATA_FILE,output);
  console.log(`✓ ${DEFITEA} canonical positions: ${defSnapshot.positionCount}/${DEFITEA_CANONICAL_POSITION_COUNT}`);
  console.log(`✓ ${DEFITEA} rate coverage: ${defSnapshot.rateCoveredPositionCount}/${defSnapshot.positionCount} · ${round(defSnapshot.coverage*100,2)}% of TVL · carried ${defSnapshot.carriedRatePositions.length} · unknown ${defSnapshot.unknownRatePositions.length}`);
  console.log(`✓ ${DEFITEA} daily TVL: $${defSnapshot.totalValueUsd??'—'} · covered Reference APR ${defSnapshot.referenceApr??'UNKNOWN'}%`);
  console.log(`✓ ${MONETRA} Stable Capital: $${monSnapshot.stableCapitalUsd??'—'} · Reference APY ${monSnapshot.referenceApyPct??'—'}%`);
  console.log(`Wrote ${REPORTING_DATA_FILE}`);
}

export {
  DEFITEA_CANONICAL_POSITION_COUNT,REPORTING_VERSION,METHODOLOGY_VERSION,canonicalDefiteaPositions,assertDefiteaProductivityParity,selectedMarketPrices,validateRatePolicy,carryDaysForCadence,resolveReferenceRate,buildVlCvxReconciliation,buildDefiteaSnapshot,aggregateDefiteaMonths
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) main().catch(err=>{console.error(err);process.exitCode=1;});
