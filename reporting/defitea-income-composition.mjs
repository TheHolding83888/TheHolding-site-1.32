#!/usr/bin/env node
/**
 * The Holding · Defitea Income Composition v0.1
 *
 * Post-processes the canonical Reporting Layer without creating a second TVL
 * or market-price authority.
 *
 * Defitea report cash flow =
 *   Defitea 11-position base reference income
 *   + associated-company reference income (YieldRing + 05081966)
 *   + observed VoteMarket veCRV / veFXN entitlement events.
 *
 * Capital boundary:
 *   Defitea TVL remains Defitea-only. Associated-company capital is used only
 *   to model those companies' own income and is never added to Defitea TVL.
 *
 * VoteMarket boundary:
 *   Current claimable balance is NOT summed every day. Each proven entitlement
 *   is admitted once into a persistent append-only event ledger, keyed by its
 *   exact epoch/campaign/gauge/wallet/reward-token identity. Later claiming or
 *   disappearance from current Rewards does not erase previously observed
 *   income. Weeks with no eligible vote produce no event and therefore zero
 *   VoteMarket income.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

const REPORTING_DATA_FILE=process.env.REPORTING_DATA_FILE||path.join(ROOT,'reporting','reporting-data.json');
const INCOME_LEDGER_FILE=process.env.DEFITEA_INCOME_LEDGER_FILE||path.join(ROOT,'reporting','defitea-income-ledger.json');
const PRODUCTIVITY_DATA_FILE=process.env.PRODUCTIVITY_DATA_FILE||path.join(ROOT,'companies','productivity-data.json');
const REWARDS_DATA_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');

const DEFITEA='defitea.eth';
const CONTRIBUTORS=['YieldRing.eth','05081966.eth'];
const VOTEMARKET_ROUTES=new Set(['votemarket-vecrv','votemarket-vefxn']);
const LEDGER_VERSION='0.1-defitea-income-composition';
const COMPOSITION_VERSION='0.1-defitea-associated-income-plus-votemarket-events';

function finite(v){
  if(v===null||v===undefined||v==='') return NaN;
  const n=Number(v); return Number.isFinite(n)?n:NaN;
}
function round(n,d=6){const f=10**d;return Math.round(n*f)/f;}
function dayKey(v){return String(v||'').slice(0,10);}
function monthKey(v){return dayKey(v).slice(0,7);}
async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function voteMarketEventKey(row){
  const d=row?.details||{};
  const parts=[
    row?.route,d.epoch,d.chainId,d.platform,d.campaignId,d.gauge,
    d.wallet||row?.wallet,row?.token
  ].map(x=>String(x??'').toLowerCase());
  if(parts.some(x=>!x)) return null;
  return parts.join(':');
}

function collectVoteMarketEvents(rewards,{trackingStartedAt,existing=[]}={}){
  const start=dayKey(trackingStartedAt);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)) throw new Error('Defitea trackingStartedAt missing for VoteMarket admission');
  const current=rewards?.companies?.[DEFITEA]?.rewards;
  if(!Array.isArray(current)) throw new Error('Defitea current Rewards rows unavailable');
  const byKey=new Map((Array.isArray(existing)?existing:[]).filter(x=>x?.eventKey).map(x=>[x.eventKey,x]));
  let admitted=0;
  for(const row of current){
    if(!VOTEMARKET_ROUTES.has(row?.route)) continue;
    const eventDate=dayKey(row?.details?.epochDate);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||eventDate<start) continue;
    const usd=finite(row?.usdValue);
    if(!(usd>0)) continue;
    const eventKey=voteMarketEventKey(row);
    if(!eventKey||byKey.has(eventKey)) continue;
    byKey.set(eventKey,{
      eventKey,
      eventDate,
      month:eventDate.slice(0,7),
      route:row.route,
      protocol:row.protocol||null,
      epoch:Number(row.details.epoch),
      chainId:Number(row.details.chainId),
      platform:row.details.platform,
      campaignId:String(row.details.campaignId),
      gauge:row.details.gauge,
      wallet:row.details.wallet||row.wallet||null,
      walletAlias:row.details.walletAlias||null,
      rewardToken:row.token,
      rewardSymbol:row.symbol||row.details.symbol||null,
      rewardAmount:Number.isFinite(finite(row.amount))?finite(row.amount):null,
      usdValue:round(usd,6),
      usdValueFrozenAtFirstAdmission:true,
      firstObservedAt:rewards?.generatedAt||new Date().toISOString(),
      source:row.source||'canonical Rewards VoteMarket measurement',
      classificationAtAdmission:row.classification||null,
      entitlementIdentity:'epoch+campaign+gauge+wallet+reward-token',
      laterClaimDoesNotEraseIncome:true
    });
    admitted++;
  }
  return {events:[...byKey.values()].sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||a.eventKey.localeCompare(b.eventKey)),admitted};
}

function contributorRow(productivity,company,date){
  const c=productivity?.companies?.[company];
  if(!c) throw new Error(`${company}: missing from Productivity`);
  const value=finite(c.productiveValue);
  const apr=finite(c.aprLatest);
  const coverage=finite(c.coverage);
  if(c.status!=='ok'||coverage!==1||!(value>0)||!(apr>=0)){
    throw new Error(`${company}: complete canonical Productivity state required for Defitea income contribution`);
  }
  const daily=value*(apr/100)/365;
  return {
    entryKey:`${date}:${company}`,
    date,
    month:date.slice(0,7),
    company,
    productiveValueUsd:round(value,2),
    referenceAprPct:round(apr,4),
    referenceIncomeUsd:round(daily,6),
    productivityGeneratedAt:productivity.generatedAt||null,
    productivityCoverage:coverage,
    productivityStatus:c.status,
    incomeIncludedInDefiteaCashFlow:true,
    includedInDefiteaTvl:false,
    semantic:'associated-company-reference-income-not-capital-contribution'
  };
}

function upsertContributorDaily(existing,productivity,date){
  const map=new Map((Array.isArray(existing)?existing:[]).filter(x=>x?.entryKey).map(x=>[x.entryKey,x]));
  for(const company of CONTRIBUTORS){
    const row=contributorRow(productivity,company,date);
    map.set(row.entryKey,row);
  }
  return [...map.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.company.localeCompare(b.company));
}

function sumByMonth(rows,valueField){
  const out=new Map();
  for(const row of rows||[]){
    const m=row?.month||monthKey(row?.date||row?.eventDate);
    const v=finite(row?.[valueField]);
    if(!/^\d{4}-\d{2}$/.test(m)||!Number.isFinite(v)) continue;
    out.set(m,(out.get(m)||0)+v);
  }
  return out;
}

function rebuildDefiteaMonths(fund,ledger){
  const months={...(fund?.months||{})};
  const contributorByMonth=sumByMonth(ledger.contributorDaily,'referenceIncomeUsd');
  const voteByMonth=sumByMonth(ledger.voteMarketEvents,'usdValue');
  for(const [key,m] of Object.entries(months)){
    if(m?.mode!=='reference-model') continue;
    const base=finite(m.baseDefiteaReferenceCashFlowUsd??m.referenceCashFlowUsd??m.cashFlowUsd);
    const contributor=contributorByMonth.get(key)||0;
    const vote=voteByMonth.get(key)||0;
    if(!Number.isFinite(base)) throw new Error(`${key}: base Defitea reference cash flow missing`);
    const unified=base+contributor+vote;
    const avgTvl=finite(m.averageTvlUsd);
    const yld=avgTvl>0?unified/avgTvl*100:NaN;
    const sampleDays=Number(m.sampleDays||0);
    const annualized=m.status==='provisional'
      ? (sampleDays>0&&Number.isFinite(yld)?yld*365/sampleDays:NaN)
      : (Number.isFinite(yld)?yld*12:NaN);
    months[key]={
      ...m,
      baseDefiteaReferenceCashFlowUsd:round(base,2),
      associatedCompanyReferenceCashFlowUsd:round(contributor,2),
      voteMarketObservedIncomeUsd:round(vote,2),
      cashFlowUsd:round(unified,2),
      monthlyYieldPct:Number.isFinite(yld)?round(yld,4):null,
      annualizedAprPct:Number.isFinite(annualized)?round(annualized,4):null,
      incomeCompositionVersion:COMPOSITION_VERSION,
      tvlSemantic:'defitea-only',
      associatedCompanyTvlIncluded:false,
      voteMarketAccounting:'deduplicated-observed-entitlement-events',
      note:[m.note,'Unified Defitea cash flow adds associated-company reference income and deduplicated observed VoteMarket veCRV/veFXN entitlement events; associated-company TVL is excluded.'].filter(Boolean).join(' ')
    };
  }
  return months;
}

function rebuildYearSummary(months,year){
  const rows=Object.values(months||{}).filter(m=>m?.month?.startsWith(`${year}-`)).sort((a,b)=>a.month.localeCompare(b.month));
  const closed=rows.filter(m=>m.status!=='provisional');
  const provisional=rows.find(m=>m.status==='provisional')||null;
  const cash=closed.reduce((s,m)=>s+(finite(m.cashFlowUsd)||0),0);
  const yields=closed.map(m=>finite(m.monthlyYieldPct)).filter(Number.isFinite);
  const ytdYield=yields.reduce((s,x)=>s+x,0);
  const annualizedRates=rows.map(m=>finite(m.annualizedAprPct)).filter(Number.isFinite);
  const annualized=annualizedRates.length?annualizedRates.reduce((s,x)=>s+x,0)/annualizedRates.length:NaN;
  const liveAnnualized=finite(provisional?.annualizedAprPct);
  const best=closed.filter(m=>Number.isFinite(finite(m.monthlyYieldPct))).sort((a,b)=>finite(b.monthlyYieldPct)-finite(a.monthlyYieldPct))[0]||null;
  return {
    year:Number(year),
    closedMonths:closed.length,
    ytdCashFlowUsd:round(cash,2),
    ytdCashFlowEstimated:closed.some(m=>m.mode!=='reported-realised'),
    ytdCashFlowYieldPct:round(ytdYield,4),
    annualizedCashFlowAprPct:Number.isFinite(annualized)?round(annualized,4):null,
    annualizedCashFlowAprIncludesLiveMonth:Boolean(provisional&&Number.isFinite(liveAnnualized)),
    annualizedCashFlowAprMonths:annualizedRates.length,
    currentMonthAnnualizedAprPct:Number.isFinite(liveAnnualized)?round(liveAnnualized,4):null,
    bestMonth:best?.month||null,
    bestMonthLabel:best?.label||null,
    bestMonthYieldPct:best?round(finite(best.monthlyYieldPct),4):null,
    periodStart:closed[0]?.month||null,
    periodEnd:closed[closed.length-1]?.month||null,
    currentMonth:provisional?.month||null,
    currentMonthReferenceCashFlowUsd:provisional?.cashFlowUsd??null,
    currentMonthYieldPct:provisional?.monthlyYieldPct??null,
    currentMonthAverageTvlUsd:provisional?.averageTvlUsd??null,
    modes:[...new Set(closed.map(m=>m.mode))]
  };
}

function compose({reporting,productivity,rewards,ledger}){
  const fund=reporting?.funds?.[DEFITEA];
  if(!fund||!fund.latestSnapshot) throw new Error('Defitea Reporting fund unavailable');
  const date=dayKey(fund.latestSnapshot.date||reporting.generatedAt);
  const trackingStartedAt=dayKey(fund.trackingStartedAt);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Defitea reporting date unavailable');

  const prior={
    version:LEDGER_VERSION,
    fund:DEFITEA,
    trackingStartedAt,
    createdAt:ledger?.createdAt||reporting.generatedAt||new Date().toISOString(),
    contributorDaily:Array.isArray(ledger?.contributorDaily)?ledger.contributorDaily:[],
    voteMarketEvents:Array.isArray(ledger?.voteMarketEvents)?ledger.voteMarketEvents:[]
  };
  const vote=collectVoteMarketEvents(rewards,{trackingStartedAt,existing:prior.voteMarketEvents});
  const contributorDaily=upsertContributorDaily(prior.contributorDaily,productivity,date);
  const nextLedger={
    ...prior,
    updatedAt:reporting.generatedAt||new Date().toISOString(),
    compositionVersion:COMPOSITION_VERSION,
    contributors:CONTRIBUTORS.map(company=>({company,incomeIncludedInDefiteaCashFlow:true,includedInDefiteaTvl:false})),
    voteMarketRoutes:[...VOTEMARKET_ROUTES],
    contributorDaily,
    voteMarketEvents:vote.events,
    accounting:{
      defiteaTvlAuthority:'Defitea canonical 11-position Reporting snapshot only',
      associatedCompanyTvlIncluded:false,
      contributorIncomeMethod:'productiveValue × Reference APR / 365',
      voteMarketMethod:'one frozen USD income event per exact proven entitlement identity',
      currentClaimableBalanceSummedDaily:false,
      claimedEventRetention:'indefinite',
      unknownIsNotZero:true
    }
  };

  const months=rebuildDefiteaMonths(fund,nextLedger);
  const years=[...new Set(Object.keys(months).map(k=>k.slice(0,4)).filter(x=>/^\d{4}$/.test(x)))];
  const summaries=Object.fromEntries(years.map(y=>[y,rebuildYearSummary(months,y)]));
  const contributorToday=contributorDaily.filter(x=>x.date===date).reduce((s,x)=>s+finite(x.referenceIncomeUsd),0);
  const voteToday=vote.events.filter(x=>x.eventDate===date).reduce((s,x)=>s+finite(x.usdValue),0);

  const nextReporting=structuredClone(reporting);
  nextReporting.funds[DEFITEA]={
    ...fund,
    months,
    summaries,
    incomeComposition:{
      version:COMPOSITION_VERSION,
      ledger:'reporting/defitea-income-ledger.json',
      contributors:CONTRIBUTORS,
      associatedCompanyTvlIncluded:false,
      voteMarketRoutes:[...VOTEMARKET_ROUTES],
      voteMarketEventsRecorded:vote.events.length,
      voteMarketEventsAdmittedThisRun:vote.admitted,
      contributorDailyEntries:contributorDaily.length,
      currentDayAssociatedCompanyReferenceIncomeUsd:round(contributorToday,6),
      currentDayVoteMarketEventIncomeUsd:round(voteToday,6),
      defiteaTvlUsd:fund.latestSnapshot.totalValueUsd,
      tvlSemantic:'defitea-only'
    }
  };
  nextReporting.note=`${reporting.note||''} Defitea cash-flow composition additionally includes YieldRing.eth and 05081966.eth reference income plus deduplicated observed VoteMarket veCRV/veFXN entitlement events; their capital is not added to Defitea TVL.`.trim();
  return {reporting:nextReporting,ledger:nextLedger};
}

async function main(){
  const [reporting,productivity,rewards,ledger]=await Promise.all([
    readJson(REPORTING_DATA_FILE,{}),readJson(PRODUCTIVITY_DATA_FILE,{}),readJson(REWARDS_DATA_FILE,{}),readJson(INCOME_LEDGER_FILE,{})
  ]);
  const out=compose({reporting,productivity,rewards,ledger});
  await writeJson(INCOME_LEDGER_FILE,out.ledger);
  await writeJson(REPORTING_DATA_FILE,out.reporting);
  const d=out.reporting.funds[DEFITEA];
  const current=d.months?.[monthKey(d.latestSnapshot.date)];
  console.log('Defitea income composition PASS',{
    defiteaTvlUsd:d.latestSnapshot.totalValueUsd,
    associatedCompanyTvlIncluded:false,
    currentMonthCashFlowUsd:current?.cashFlowUsd,
    baseDefiteaReferenceCashFlowUsd:current?.baseDefiteaReferenceCashFlowUsd,
    associatedCompanyReferenceCashFlowUsd:current?.associatedCompanyReferenceCashFlowUsd,
    voteMarketObservedIncomeUsd:current?.voteMarketObservedIncomeUsd,
    voteMarketEventsRecorded:out.ledger.voteMarketEvents.length
  });
}

export {
  DEFITEA,CONTRIBUTORS,VOTEMARKET_ROUTES,LEDGER_VERSION,COMPOSITION_VERSION,
  voteMarketEventKey,collectVoteMarketEvents,contributorRow,upsertContributorDaily,
  rebuildDefiteaMonths,rebuildYearSummary,compose
};

if(process.argv[1]&&path.resolve(process.argv[1])===__filename){
  main().catch(err=>{console.error(err);process.exitCode=1;});
}
