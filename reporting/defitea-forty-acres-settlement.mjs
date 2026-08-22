#!/usr/bin/env node
/**
 * The Holding · Defitea 40 Acres Settlement Overlay v0.1
 *
 * Replaces the modeled veVELO Reference-income contribution with actual net
 * 40 Acres USDC receipts when those receipts are proven by canonical Rewards.
 * This prevents double counting the same economic lane.
 *
 * Runs inside the single canonical Reporting writer after the existing
 * Defitea income composition step. No second writer, price authority, TVL
 * authority or execution authority is introduced.
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
const REWARDS_DATA_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');

const DEFITEA='defitea.eth';
const TRACKING_SINCE='2026-08-01';
const ROUTE='forty-acres-velodrome-received';
const PRINCIPAL_ID='velodrome-finance';
const SETTLEMENT_VERSION='0.1-40acres-actual-received-replaces-velodrome-reference';

function finite(v){
  if(v===null||v===undefined||v==='') return NaN;
  const n=Number(v); return Number.isFinite(n)?n:NaN;
}
function round(n,d=6){const f=10**d;return Math.round(n*f)/f;}
function dayKey(v){return String(v||'').slice(0,10);}
async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function receivedEventKey(txHash,logIndex){
  const tx=String(txHash||'').toLowerCase();
  const idx=Number(logIndex);
  if(!/^0x[0-9a-f]{64}$/.test(tx)||!Number.isInteger(idx)||idx<0) return null;
  return `40acres:${tx}:${idx}`;
}

function collectReceivedEvents(rewards,{existing=[]}={}){
  const company=rewards?.companies?.[DEFITEA];
  const rows=company?.receivedIncome;
  if(!Array.isArray(rows)) throw new Error('Defitea Received income rows unavailable');
  if(company?.receivedIncomeUsdIsComplete!==true) throw new Error('Defitea Received income USD coverage incomplete');
  const byKey=new Map((Array.isArray(existing)?existing:[]).filter(x=>x?.eventKey).map(x=>[x.eventKey,x]));
  let admitted=0;
  for(const row of rows){
    if(row?.route!==ROUTE||row?.classification!=='received'||row?.state!=='Received') continue;
    if(row?.includedInClaimableTotal!==false||row?.executionAuthority!=='none') throw new Error('40 Acres Received lifecycle boundary drift');
    for(const transfer of row?.transfers||[]){
      const eventDate=dayKey(transfer?.timestamp);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)||eventDate<TRACKING_SINCE) continue;
      const usd=finite(transfer?.usdValue);
      if(!(usd>0)) continue;
      const eventKey=receivedEventKey(transfer?.txHash,transfer?.logIndex);
      if(!eventKey||byKey.has(eventKey)) continue;
      byKey.set(eventKey,{
        eventKey,eventDate,month:eventDate.slice(0,7),route:ROUTE,
        protocol:row.protocol||'40 Acres · veVELO',chain:transfer.chain||row.chain||'Optimism',
        portfolio:row.portfolio||null,recipient:transfer.recipient||row.recipient||null,
        payoutToken:transfer.token||row.payoutToken||null,payoutSymbol:transfer.symbol||row.symbol||null,
        amount:Number.isFinite(finite(transfer.amount))?finite(transfer.amount):null,
        usdValue:round(usd,6),txHash:transfer.txHash,blockNumber:Number(transfer.blockNumber),logIndex:Number(transfer.logIndex),
        firstObservedAt:rewards.generatedAt||new Date().toISOString(),usdValueFrozenAtFirstAdmission:true,
        accounting:'actual-net-received',laterWalletMovementDoesNotEraseIncome:true,executionAuthority:'none'
      });
      admitted++;
    }
  }
  return {events:[...byKey.values()].sort((a,b)=>a.eventDate.localeCompare(b.eventDate)||a.eventKey.localeCompare(b.eventKey)),admitted};
}

function sumReceivedByMonth(events){
  const out=new Map();
  for(const e of events||[]){
    const usd=finite(e?.usdValue);
    if(!/^\d{4}-\d{2}$/.test(e?.month||'')||!Number.isFinite(usd)) continue;
    out.set(e.month,(out.get(e.month)||0)+usd);
  }
  return out;
}

function modeledVelodromeByMonth(fund){
  const observed=new Map();
  for(const day of fund?.daily||[]){
    const date=dayKey(day?.date);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<TRACKING_SINCE) continue;
    const p=(day.positions||[]).find(x=>x?.principalId===PRINCIPAL_ID);
    const value=finite(p?.valueUsd),apr=finite(p?.referenceApr);
    if(!(value>0)||!(apr>=0)) throw new Error(`${date}: veVELO modeled Reference-income row missing`);
    const month=date.slice(0,7);
    observed.set(month,(observed.get(month)||0)+value*(apr/100)/365);
  }
  const out=new Map();
  for(const [month,value] of observed){
    const factor=finite(fund?.months?.[month]?.normalizationFactor);
    const normalization=Number.isFinite(factor)&&factor>0?factor:1;
    out.set(month,value*normalization);
  }
  return out;
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
    year:Number(year),closedMonths:closed.length,ytdCashFlowUsd:round(cash,2),
    ytdCashFlowEstimated:closed.some(m=>m.mode!=='reported-realised'),ytdCashFlowYieldPct:round(ytdYield,4),
    annualizedCashFlowAprPct:Number.isFinite(annualized)?round(annualized,4):null,
    annualizedCashFlowAprIncludesLiveMonth:Boolean(provisional&&Number.isFinite(liveAnnualized)),
    annualizedCashFlowAprMonths:annualizedRates.length,currentMonthAnnualizedAprPct:Number.isFinite(liveAnnualized)?round(liveAnnualized,4):null,
    bestMonth:best?.month||null,bestMonthLabel:best?.label||null,bestMonthYieldPct:best?round(finite(best.monthlyYieldPct),4):null,
    periodStart:closed[0]?.month||null,periodEnd:closed[closed.length-1]?.month||null,
    currentMonth:provisional?.month||null,currentMonthReferenceCashFlowUsd:provisional?.cashFlowUsd??null,
    currentMonthYieldPct:provisional?.monthlyYieldPct??null,currentMonthAverageTvlUsd:provisional?.averageTvlUsd??null,
    modes:[...new Set(closed.map(m=>m.mode))]
  };
}

function applySettlement({reporting,rewards,ledger}){
  const fund=reporting?.funds?.[DEFITEA];
  if(!fund?.latestSnapshot) throw new Error('Defitea Reporting fund unavailable');
  const collected=collectReceivedEvents(rewards,{existing:ledger?.fortyAcresReceivedEvents||[]});
  const receivedByMonth=sumReceivedByMonth(collected.events);
  const modeledByMonth=modeledVelodromeByMonth(fund);
  const months={...(fund.months||{})};

  for(const [key,m] of Object.entries(months)){
    if(m?.mode!=='reference-model') continue;
    const base=finite(m.baseDefiteaReferenceCashFlowUsd??m.referenceCashFlowUsd);
    const associated=finite(m.associatedCompanyReferenceCashFlowUsd);
    const vote=finite(m.voteMarketObservedIncomeUsd);
    if(!Number.isFinite(base)) throw new Error(`${key}: Defitea base reference cash flow missing`);
    const modeledVelodrome=modeledByMonth.get(key)||0;
    const received=receivedByMonth.get(key)||0;
    const unified=base-modeledVelodrome+(Number.isFinite(associated)?associated:0)+(Number.isFinite(vote)?vote:0)+received;
    if(unified<0) throw new Error(`${key}: 40 Acres settlement replacement produced negative cash flow`);
    const avgTvl=finite(m.averageTvlUsd);
    const yld=avgTvl>0?unified/avgTvl*100:NaN;
    const sampleDays=Number(m.sampleDays||0);
    const annualized=m.status==='provisional'
      ? (sampleDays>0&&Number.isFinite(yld)?yld*365/sampleDays:NaN)
      : (Number.isFinite(yld)?yld*12:NaN);
    months[key]={
      ...m,cashFlowUsd:round(unified,2),monthlyYieldPct:Number.isFinite(yld)?round(yld,4):null,
      annualizedAprPct:Number.isFinite(annualized)?round(annualized,4):null,
      fortyAcresReceivedIncomeUsd:round(received,6),
      fortyAcresReceivedEventCount:collected.events.filter(x=>x.month===key).length,
      fortyAcresReplacedReferenceCashFlowUsd:round(modeledVelodrome,6),
      fortyAcresSettlementAccounting:'actual-received-replaces-velodrome-reference-model',
      fortyAcresReferenceDoubleCountPrevented:true,fortyAcresTrackingSince:TRACKING_SINCE,
      note:[m.note,'Actual net 40 Acres veVELO USDC receipts replace the corresponding modeled veVELO Reference-income component; they are not added on top, preventing double counting.'].filter(Boolean).join(' ')
    };
  }

  const years=[...new Set(Object.keys(months).map(k=>k.slice(0,4)).filter(x=>/^\d{4}$/.test(x)))];
  const summaries=Object.fromEntries(years.map(y=>[y,rebuildYearSummary(months,y)]));
  const nextReporting=structuredClone(reporting);
  nextReporting.funds[DEFITEA]={
    ...fund,months,summaries,
    fortyAcresSettlement:{
      version:SETTLEMENT_VERSION,route:ROUTE,trackingSince:TRACKING_SINCE,
      accounting:'actual-net-received-replaces-velodrome-reference-model',eventsRecorded:collected.events.length,
      eventsAdmittedThisRun:collected.admitted,receivedUsd:round(collected.events.reduce((s,x)=>s+finite(x.usdValue),0),6),
      referenceDoubleCountPrevented:true,claimableAffected:false,tvlAffected:false,executionAuthority:'none'
    }
  };
  nextReporting.note=`${reporting.note||''} Defitea 40 Acres veVELO cash flow uses actual net Received USDC as settlement authority and replaces, rather than adds to, the corresponding modeled veVELO Reference-income lane.`.trim();

  const nextLedger={
    ...(ledger||{}),updatedAt:reporting.generatedAt||new Date().toISOString(),fortyAcresReceivedEvents:collected.events,
    fortyAcresSettlement:{
      version:SETTLEMENT_VERSION,route:ROUTE,trackingSince:TRACKING_SINCE,principalId:PRINCIPAL_ID,
      method:'actual net 40 Acres Received replaces same-period modeled veVELO Reference income',
      currentClaimableBalanceSummedDaily:false,receivedEventRetention:'indefinite',walletBalanceUsedAsIncomeAuthority:false,
      referenceDoubleCountPrevented:true,unknownIsNotZero:true,executionAuthority:'none'
    }
  };
  return {reporting:nextReporting,ledger:nextLedger,admitted:collected.admitted};
}

async function main(){
  const [reporting,rewards,ledger]=await Promise.all([readJson(REPORTING_DATA_FILE),readJson(REWARDS_DATA_FILE),readJson(INCOME_LEDGER_FILE)]);
  const out=applySettlement({reporting,rewards,ledger});
  await Promise.all([writeJson(REPORTING_DATA_FILE,out.reporting),writeJson(INCOME_LEDGER_FILE,out.ledger)]);
  const fund=out.reporting.funds[DEFITEA];
  const current=fund.months?.[String(fund.latestSnapshot.date||'').slice(0,7)]||null;
  console.log('Defitea 40 Acres settlement PASS',{
    admitted:out.admitted,events:fund.fortyAcresSettlement.eventsRecorded,receivedUsd:fund.fortyAcresSettlement.receivedUsd,
    currentMonthCashFlowUsd:current?.cashFlowUsd,replacedReferenceUsd:current?.fortyAcresReplacedReferenceCashFlowUsd,
    executionAuthority:fund.fortyAcresSettlement.executionAuthority
  });
}

export {collectReceivedEvents,modeledVelodromeByMonth,applySettlement,rebuildYearSummary};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename) main().catch(err=>{console.error(err);process.exitCode=1;});
