#!/usr/bin/env node
/**
 * The Holding · Reporting Layer v1.1.0 · Defitea + Monetra
 * -------------------------------------------------------
 * One lightweight daily reporting writer for two different income families.
 *
 * Defitea:
 *   COMPANY_BOOK + one batched CoinGecko request + latest validated Reference APR
 *   -> daily productive TVL -> monthly reference cash-flow model.
 *
 * Monetra:
 *   fresh Stable Companies Index + Embedded Yield Ledger
 *   -> daily Stable Capital + validated Reference APY
 *   -> monthly reference-generated-income model.
 *
 * IMPORTANT:
 * - Defitea Jan–Jul 2026 reported/realised history is immutable.
 * - Automated Defitea months are reference models, not claim accounting.
 * - Monetra monthly Generated Income is a reference model across the full stable
 *   strategy book. It is deliberately not presented as realised cash flow.
 * - Stable Price Effect / depeg movement is excluded from Monetra income.
 * - The Embedded Yield Ledger is retained as an audit/observed-income companion;
 *   it is not promoted to full-fund monthly income until comparability is complete.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COMPANY_PAGE_FILE = process.env.COMPANY_PAGE_FILE || path.join(ROOT, 'companies', 'index.html');
const PRODUCTIVITY_DATA_FILE = process.env.PRODUCTIVITY_DATA_FILE || path.join(ROOT, 'companies', 'productivity-data.json');
const STABLE_INDEX_DATA_FILE = process.env.STABLE_INDEX_DATA_FILE || path.join(ROOT, 'companies', 'stable-index-data.json');
const EMBEDDED_LEDGER_FILE = process.env.EMBEDDED_LEDGER_FILE || path.join(ROOT, 'companies', 'embedded-yield-ledger.json');
const REPORTING_DATA_FILE = process.env.REPORTING_DATA_FILE || path.join(ROOT, 'reporting', 'reporting-data.json');

const DEFITEA = 'defitea.eth';
const MONETRA = 'Monetra.eth';
const REPORTING_VERSION = '1.1.0-dual-fund-monetra';
const METHODOLOGY_VERSION = '1.1-dual-fund-daily-reference-model';
const API_TIMEOUT_MS = 12000;
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
  const f = 10 ** d;
  return Math.round(n * f) / f;
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
async function readJson(file, fallback={}) {
  try { return JSON.parse(await fs.readFile(file,'utf8')); } catch { return fallback; }
}
async function writeJson(file,data) {
  await fs.mkdir(path.dirname(file),{recursive:true});
  await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');
}
async function parseCompanyBook() {
  const html = await fs.readFile(COMPANY_PAGE_FILE,'utf8');
  const m = html.match(/const COMPANY_BOOK\s*=\s*(\{[\s\S]*?\n\};)/);
  if (!m) throw new Error(`COMPANY_BOOK not found in ${COMPANY_PAGE_FILE}`);
  return vm.runInNewContext('('+m[1].replace(/;\s*$/,'')+')',Object.create(null),{timeout:1000});
}
async function fetchJson(url, attempts=2) {
  let last;
  for (let i=0;i<attempts;i++) {
    const c = new AbortController();
    const timer = setTimeout(()=>c.abort(),API_TIMEOUT_MS);
    try {
      const r = await fetch(url,{signal:c.signal,headers:{accept:'application/json','user-agent':'TheHolding-ReportingLayer/1.1'}});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch(e) {
      last=e;
      await new Promise(r=>setTimeout(r,650*(i+1)));
    } finally { clearTimeout(timer); }
  }
  throw last;
}
async function getCoinGeckoPrices(ids) {
  const unique=[...new Set(ids)].filter(Boolean);
  if (!unique.length) return {};
  const key=process.env.COINGECKO_API_KEY||'';
  const qs=new URLSearchParams({ids:unique.join(','),vs_currencies:'usd'});
  if (key) qs.set('x_cg_demo_api_key',key);
  const json=await fetchJson('https://api.coingecko.com/api/v3/simple/price?'+qs.toString());
  return Object.fromEntries(unique.flatMap(id=>{
    const v=finite(json?.[id]?.usd);
    return Number.isFinite(v)&&v>0 ? [[id,v]] : [];
  }));
}
function upsertDaily(previousRows, snapshot) {
  const byDate=new Map((Array.isArray(previousRows)?previousRows:[]).filter(r=>r?.date).map(r=>[r.date,r]));
  byDate.set(snapshot.date,snapshot);
  return [...byDate.values()].sort((a,b)=>String(a.date).localeCompare(String(b.date))).slice(-MAX_DAILY_SNAPSHOTS);
}

// ─────────────────────────────────────────────────────────────────────────────
// DEFITEA
// ─────────────────────────────────────────────────────────────────────────────
function buildDefiteaSnapshot({generatedAt,positions,prices,productivity,previous}) {
  const rowsProd=productivity?.companies?.[DEFITEA]?.breakdown||[];
  const breakdown=new Map(rowsProd.map(r=>[r.principalId,r]));
  const previousLatest=previous?.funds?.[DEFITEA]?.latestSnapshot||null;
  const prodFallback=new Map(rowsProd.map(r=>[r.principalId,finite(r.price)]));
  const priorFallback=new Map((previousLatest?.positions||[]).map(r=>[r.principalId,finite(r.price)]));
  const company=productivity?.companies?.[DEFITEA]||{};
  const fallbackPrices=[]; const missingPrices=[]; const rows=[];
  let totalValue=0, coveredValue=0, weightedApr=0;

  for (const p of positions) {
    const prod=breakdown.get(p.id)||null;
    let price=NaN, priceSource='missing';
    if (p.fixed!==undefined) { price=finite(p.fixed); priceSource='company-book-fixed'; }
    else if (finite(prices[p.id])>0) { price=finite(prices[p.id]); priceSource='coingecko'; }
    else if (prodFallback.get(p.id)>0) { price=prodFallback.get(p.id); priceSource='weekly-productivity-fallback'; fallbackPrices.push(p.id); }
    else if (priorFallback.get(p.id)>0) { price=priorFallback.get(p.id); priceSource='previous-daily-fallback'; fallbackPrices.push(p.id); }
    else missingPrices.push(p.id);

    const value=Number.isFinite(price)?finite(p.qty)*price:NaN;
    const apr=finite(prod?.apr);
    const aprOk=prod?.engineStatus==='ok'&&Number.isFinite(apr)&&apr>=0;
    if (Number.isFinite(value)&&value>=0) {
      totalValue+=value;
      if (aprOk) { coveredValue+=value; weightedApr+=value*apr; }
    }
    rows.push({
      principalId:p.id,units:finite(p.qty),price:Number.isFinite(price)?round(price,8):null,
      valueUsd:Number.isFinite(value)?round(value,2):null,priceSource,
      engineId:prod?.engineId||null,referenceApr:aprOk?round(apr,4):null,engineStatus:prod?.engineStatus||null
    });
  }
  const publicApr=finite(company.aprLatest);
  const internalApr=coveredValue>0?weightedApr/coveredValue:NaN;
  const referenceApr=Number.isFinite(publicApr)&&publicApr>=0?publicApr:internalApr;
  const modeledDailyCashFlow=coveredValue>0&&Number.isFinite(weightedApr)?(weightedApr/100)/365:NaN;
  return {
    date:dayKey(new Date(generatedAt)),capturedAt:generatedAt,
    totalValueUsd:totalValue>0?round(totalValue,2):null,
    coveredValueUsd:coveredValue>0?round(coveredValue,2):0,
    coverage:totalValue>0?round(coveredValue/totalValue,6):0,
    referenceApr:Number.isFinite(referenceApr)?round(referenceApr,4):null,
    modeledDailyCashFlowUsd:Number.isFinite(modeledDailyCashFlow)?round(modeledDailyCashFlow,6):null,
    productivitySnapshotAt:productivity?.generatedAt||null,
    priceStatus:missingPrices.length?'partial':(fallbackPrices.length?'fallback':'fresh'),
    fallbackPrices,missingPrices,positions:rows
  };
}
function aggregateDefiteaMonths(daily, now=new Date()) {
  const groups=new Map();
  for (const row of daily) {
    if (!row?.date) continue;
    const key=row.date.slice(0,7);
    if (!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(row);
  }
  const currentKey=monthKeyFromDate(now); const out={};
  for (const [key,raw] of groups) {
    const rows=raw.slice().sort((a,b)=>a.date.localeCompare(b.date));
    const good=rows.filter(r=>finite(r.totalValueUsd)>0&&finite(r.referenceApr)>=0);
    if (!good.length) continue;
    const [year,month]=key.split('-').map(Number);
    const totalTvl=good.reduce((s,r)=>s+finite(r.totalValueUsd),0);
    const averageTvl=totalTvl/good.length;
    const weightedApr=good.reduce((s,r)=>s+finite(r.totalValueUsd)*finite(r.referenceApr),0)/totalTvl;
    const observed=good.reduce((s,r)=>s+(Number.isFinite(finite(r.modeledDailyCashFlowUsd))?finite(r.modeledDailyCashFlowUsd):finite(r.totalValueUsd)*(finite(r.referenceApr)/100)/365),0);
    const isCurrent=key===currentKey;
    const fullDays=daysInMonthUTC(year,month);
    const expectedDays=isCurrent?now.getUTCDate():fullDays;
    const uniqueDays=new Set(good.map(r=>r.date)).size;
    const coverage=expectedDays>0?uniqueDays/expectedDays*100:0;
    const firstDay=Number(good[0].date.slice(8,10));
    const partial=firstDay>1||coverage<80;
    const normalization=!isCurrent&&uniqueDays>0&&uniqueDays<fullDays?fullDays/uniqueDays:1;
    const cash=observed*normalization;
    const monthlyYield=averageTvl>0?cash/averageTvl*100:NaN;
    out[key]={
      month:key,label:monthLabel(key),status:isCurrent?'provisional':(partial?'final-reference-partial':'final-reference'),mode:'reference-model',
      cashFlowUsd:round(cash,2),referenceCashFlowUsd:round(cash,2),observedReferenceCashFlowUsd:round(observed,2),normalizationFactor:round(normalization,6),
      monthlyYieldPct:Number.isFinite(monthlyYield)?round(monthlyYield,4):null,
      annualizedAprPct:Number.isFinite(isCurrent?weightedApr:monthlyYield*12)?round(isCurrent?weightedApr:monthlyYield*12,4):null,
      averageReferenceAprPct:round(weightedApr,4),averageTvlUsd:round(averageTvl,2),sampleDays:uniqueDays,expectedDays,sampleCoveragePct:round(coverage,2),partialPeriod:partial,
      periodStart:good[0].date,periodEnd:good[good.length-1].date,source:'the-holding-reporting-layer',
      note:isCurrent?'Live reference model. Current month remains provisional until the first daily run of the next month.':(partial?'Final full-month reference estimate normalized from observed daily samples.':'Final reference model from daily productive TVL and validated Reference APR.')
    };
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// MONETRA
// ─────────────────────────────────────────────────────────────────────────────
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
    currentCapitalUsd:Number.isFinite(currentCapital)?round(currentCapital,8):null,
    accruedClaimableUsd:Number.isFinite(claimable)?round(claimable,8):null,
    referenceApyPct:round(referenceApy,6),referenceApyStatus:c.referenceApyStatus||null,currentCoverage:Number.isFinite(finite(c.currentCoverage))?round(finite(c.currentCoverage),8):null,
    modeledDailyGeneratedIncomeUsd:round(generated,8),dailyEquivalentYieldPct:round(dailyRate*100,8),
    observedEmbeddedIncomeSinceTrackingUsd:Number.isFinite(embedded)?round(embedded,8):null,
    strategyPerformanceSinceInceptionUsd:Number.isFinite(strategyPnl)?round(strategyPnl,8):null,
    stablePriceEffectUsd:Number.isFinite(stablePrice)?round(stablePrice,8):null,
    netMarketPnlUsd:Number.isFinite(netPnl)?round(netPnl,8):null,
    stableSnapshotAt:stableIndex?.generatedAt||null,ledgerSnapshotAt:ledger?.generatedAt||null,
    source:'stable-capital-intelligence-layer'
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
    // Never fabricate the unobserved beginning of the very first tracking month.
    // Later closed months may normalize isolated missed daily runs only.
    const normalization=!isCurrent&&!isFirstTrackedMonth&&uniqueDays>0&&uniqueDays<fullDays?fullDays/uniqueDays:1;
    const generated=observed*normalization;
    const monthlyYield=avgCapital>0?generated/avgCapital*100:NaN;
    out[key]={
      month:key,label:monthLabel(key),status:isCurrent?'provisional':(partial?'final-reference-partial':'final-reference'),mode:'stable-reference-income',
      generatedIncomeUsd:round(generated,4),cashFlowUsd:round(generated,4),observedGeneratedIncomeUsd:round(observed,4),normalizationFactor:round(normalization,6),
      monthlyYieldPct:Number.isFinite(monthlyYield)?round(monthlyYield,4):null,
      averageReferenceApyPct:round(weightedApy,6),annualizedAprPct:round(weightedApy,6),
      averageStableCapitalUsd:round(avgCapital,4),averageTvlUsd:round(avgCapital,4),sampleDays:uniqueDays,expectedDays,sampleCoveragePct:round(coverage,2),partialPeriod:partial,
      periodStart:good[0].date,periodEnd:good[good.length-1].date,source:'the-holding-stable-reporting-layer',
      semantic:'reference-generated-income-not-realised-cash-flow',stablePriceEffectExcluded:true,
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
  return {
    year,closedMonths:closed.length,ytdCashFlowUsd:round(cash,2),ytdCashFlowEstimated:closed.some(m=>m.mode!=='reported-realised'),ytdCashFlowYieldPct:round(ytdYield,4),
    annualizedCashFlowAprPct:Number.isFinite(annualized)?round(annualized,4):null,bestMonth:best?.month||null,bestMonthLabel:best?.label||null,bestMonthYieldPct:best?round(finite(best.monthlyYieldPct),4):null,
    periodStart:closed[0]?.month||null,periodEnd:closed[closed.length-1]?.month||null,currentMonth:provisional?.month||null,
    currentMonthReferenceCashFlowUsd:provisional?.cashFlowUsd??null,currentMonthYieldPct:provisional?.monthlyYieldPct??null,currentMonthAverageTvlUsd:provisional?.averageTvlUsd??null,
    modes:[...new Set(closed.map(m=>m.mode))]
  };
}
function buildMonetraSummary(months, year, latestSnapshot) {
  const generic=buildYearSummary(months,year);
  const current=generic.currentMonth?months[generic.currentMonth]:null;
  return {
    ...generic,
    currentMonthGeneratedIncomeUsd:current?.generatedIncomeUsd??null,
    currentMonthYieldPct:current?.monthlyYieldPct??null,
    currentMonthAverageStableCapitalUsd:current?.averageStableCapitalUsd??null,
    currentStableCapitalUsd:latestSnapshot?.stableCapitalUsd??null,
    currentCapitalUsd:latestSnapshot?.currentCapitalUsd??null,
    currentReferenceApyPct:latestSnapshot?.referenceApyPct??null,
    observedEmbeddedIncomeSinceTrackingUsd:latestSnapshot?.observedEmbeddedIncomeSinceTrackingUsd??null,
    metricSemantic:'reference-generated-income-not-realised-cash-flow'
  };
}

async function main() {
  const generatedAt=nowIso();
  const [companyBook,productivity,stableIndex,ledger,previous]=await Promise.all([
    parseCompanyBook(),readJson(PRODUCTIVITY_DATA_FILE,{}),readJson(STABLE_INDEX_DATA_FILE,{}),readJson(EMBEDDED_LEDGER_FILE,{}),readJson(REPORTING_DATA_FILE,{})
  ]);

  const defPositions=companyBook?.[DEFITEA];
  if (!Array.isArray(defPositions)||!defPositions.length) throw new Error(`${DEFITEA} not found in COMPANY_BOOK`);
  if (!productivity?.companies?.[DEFITEA]) throw new Error(`${DEFITEA} not found in productivity-data.json`);

  let prices={};
  try { prices=await getCoinGeckoPrices(defPositions.filter(p=>p.fixed===undefined).map(p=>p.id)); }
  catch(e) { console.warn('[CoinGecko] daily Defitea price request failed; using central/previous fallbacks:',e?.message||e); }

  const defSnapshot=buildDefiteaSnapshot({generatedAt,positions:defPositions,prices,productivity,previous});
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
    note:'Daily Reporting Layer for Defitea and Monetra. Defitea Jan–Jul 2026 reported/realised history is preserved; automated Defitea months remain reference cash-flow models. Monetra months report reference-generated income from daily Stable Capital and validated Reference APY, including income whether economically distributed or compounded, while Stable Price Effect remains separate. Neither automated family is claim accounting.',
    schedule:{dailySnapshot:'06:07 UTC',defiteaProductivityReference:'latest available Productivity Intelligence snapshot',monetraStableReference:'latest Stable Capital Intelligence snapshot after 05:37 UTC daily run'},
    funds:{
      [DEFITEA]:{trackingStartedAt:defDaily[0]?.date||null,latestSnapshot:defSnapshot,daily:defDaily,months:defMonths,summaries:defSummaries},
      [MONETRA]:{trackingStartedAt:monDaily[0]?.date||null,latestSnapshot:monSnapshot,daily:monDaily,months:monMonths,summaries:monSummaries,semantic:'reference-generated-income-not-realised-cash-flow'}
    }
  };
  await writeJson(REPORTING_DATA_FILE,output);
  console.log(`✓ ${DEFITEA} daily TVL: $${defSnapshot.totalValueUsd??'—'} · Reference APR ${defSnapshot.referenceApr??'—'}%`);
  console.log(`✓ ${MONETRA} Stable Capital: $${monSnapshot.stableCapitalUsd??'—'} · Reference APY ${monSnapshot.referenceApyPct??'—'}%`);
  console.log(`✓ ${MONETRA} modeled daily generated income: $${monSnapshot.modeledDailyGeneratedIncomeUsd??'—'}`);
  console.log(`Wrote ${REPORTING_DATA_FILE}`);
}

main().catch(err=>{console.error(err);process.exitCode=1;});
