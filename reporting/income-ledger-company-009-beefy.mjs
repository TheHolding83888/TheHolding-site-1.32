#!/usr/bin/env node
/**
 * The Holding · Company #009 Beefy cvxCRV canonical embedded-income admission
 *
 * Admits only factual adjacent Beefy vault checkpoints with an identical share
 * balance. Embedded income is shares × positive ΔPPFS in cvxCRV and is valued
 * once at the later checkpoint's canonical cvxCRV USD price. Reference APR is
 * never used. Cross-month intervals are retained but remain unallocated by the
 * Canonical Income Ledger monthly attribution rule.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  finalizeCandidate, admitEvents, buildMonthly, eventMonth
} from './income-ledger.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');

const SOURCE_FILE=process.env.COMPANY_009_BEEFY_INCOME_FILE||path.join(ROOT,'companies','company-009-beefy-cvxcrv-income.json');
const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const COMPANY='1milliondollar.eth';
const REGISTRY='009';
const ROUTE='beefy-cvxcrv';

function finite(v){if(v===null||v===undefined||v==='')return NaN;const n=Number(v);return Number.isFinite(n)?n:NaN;}
function round(v,d=12){const n=finite(v);if(!Number.isFinite(n))return null;const f=10**d;return Math.round(n*f)/f;}
function monthKey(v){const t=Date.parse(v||'');return Number.isFinite(t)?new Date(t).toISOString().slice(0,7):null;}
async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}
async function writeJson(file,data){await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

function validateSource(source){
  if(source?.version!=='0.1-company-009-beefy-cvxcrv-embedded-income')throw new Error('Company #009 Beefy source version drift');
  if(source?.company?.registry!==REGISTRY||source?.company?.name!==COMPANY)throw new Error('Company #009 Beefy identity mismatch');
  if(source?.strategy?.id!==ROUTE||source?.strategy?.incomeMode!=='compounded-embedded'||source?.strategy?.claimableApplicable!==false)throw new Error('Company #009 Beefy strategy semantics drift');
  const checkpoints=Array.isArray(source?.checkpoints)?source.checkpoints:[];
  if(checkpoints.length<2)throw new Error('Company #009 Beefy requires at least two factual checkpoints');
  let lastAt='';
  for(const c of checkpoints){
    if(!c?.observationId||!c?.generatedAt||!Number.isInteger(Number(c?.blockNumber)))throw new Error('Company #009 Beefy checkpoint identity incomplete');
    if(lastAt&&c.generatedAt<=lastAt)throw new Error('Company #009 Beefy checkpoints are not strictly chronological');
    lastAt=c.generatedAt;
    if(!c?.sharesRaw||!c?.ppfsRaw||!(finite(c.shares)>0)||!(finite(c.ppfs)>0)||!(finite(c.cvxCrvPriceUsd)>0))throw new Error(`Company #009 Beefy checkpoint economics incomplete: ${c.observationId}`);
  }
  return checkpoints;
}

function beefyCandidates(source,generatedAt){
  const checkpoints=validateSource(source);
  const out=[];
  let zeroIntervals=0;
  for(let i=1;i<checkpoints.length;i++){
    const a=checkpoints[i-1],b=checkpoints[i];
    if(a.sharesRaw!==b.sharesRaw)throw new Error(`Company #009 Beefy share balance changed between ${a.observationId} and ${b.observationId}; attribution requires reconciliation`);
    const shares=finite(b.shares),startPpfs=finite(a.ppfs),endPpfs=finite(b.ppfs),price=finite(b.cvxCrvPriceUsd);
    const deltaPpfs=endPpfs-startPpfs;
    if(deltaPpfs<-1e-15)throw new Error(`Company #009 Beefy PPFS decreased between ${a.observationId} and ${b.observationId}; loss accounting requires a separate canonical lane`);
    if(deltaPpfs<=1e-15){zeroIntervals++;continue;}
    const incomeUnderlying=shares*deltaPpfs;
    const incomeUsd=incomeUnderlying*price;
    if(!(incomeUnderlying>0)||!(incomeUsd>0))throw new Error(`Company #009 Beefy positive PPFS interval produced invalid income: ${a.observationId} -> ${b.observationId}`);
    const startMonth=monthKey(a.generatedAt),endMonth=monthKey(b.generatedAt);
    const sourceIdentity=`${a.observationId}:${b.observationId}`;
    out.push(finalizeCandidate({
      eventKey:`company-009-beefy-embedded:${sourceIdentity}`,
      company:COMPANY,
      family:'embedded-income',
      economicDate:b.generatedAt.slice(0,10),
      periodStart:a.generatedAt,
      periodEnd:b.generatedAt,
      route:ROUTE,
      protocol:'Beefy',
      asset:'cvxCRV',
      amount:round(incomeUnderlying,12),
      usdValue:round(incomeUsd,8),
      valuationStatus:'frozen-at-interval-end-cvxcrv-price',
      valuationAsset:'cvxCRV',
      valuationUnitUsd:round(price,12),
      shareBalanceRaw:b.sharesRaw,
      startPpfs:round(startPpfs,18),
      endPpfs:round(endPpfs,18),
      periodAttributionStatus:startMonth&&startMonth===endMonth?'single-month':'cross-month-boundary-unallocated',
      sourceFile:'companies/company-009-beefy-cvxcrv-income.json',
      sourceFamily:'adjacent factual Beefy vault checkpoints',
      sourceIdentity,
      evidenceStatus:'canonical-constant-share-positive-ppfs-interval',
      referenceAprUsed:false
    },generatedAt));
  }
  return{events:out,zeroIntervals,checkpointCount:checkpoints.length};
}

function refreshCompany(ledger){
  const rows=(ledger.events||[]).filter(e=>e.company===COMPANY);
  const prior=ledger?.companies?.[COMPANY]||{};
  const currentClaimableState=prior.currentClaimableState||null;
  const claimableContinuity=prior.claimableContinuity||[];
  const crossMonthEmbedded=rows.filter(e=>e.family==='embedded-income'&&eventMonth(e)===null).length;
  ledger.companies=ledger.companies||{};
  ledger.companies[COMPANY]={
    ...prior,
    status:'partial',
    eventCount:rows.length,
    eventCountsByFamily:{
      accruedEntitlement:rows.filter(e=>e.family==='accrued-entitlement').length,
      realisedCashFlow:rows.filter(e=>e.family==='realised-cash-flow').length,
      embeddedIncome:rows.filter(e=>e.family==='embedded-income').length
    },
    currentClaimableState,
    claimableContinuity,
    monthly:buildMonthly(ledger.events||[],COMPANY),
    coverage:{
      ...(prior.coverage||{}),
      overallComplete:false,
      embeddedIncome:'partial-mechanism-specific-beefy-cvxcrv',
      crossMonthEmbeddedIntervalsExcludedFromMonthlyAttribution:crossMonthEmbedded,
      unknownIsNotZero:true
    }
  };
}

async function build(){
  const generatedAt=new Date().toISOString();
  const [source,ledger]=await Promise.all([readJson(SOURCE_FILE),readJson(LEDGER_FILE)]);
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch');
  if(ledger?.semantics?.referenceAprCanBackfillEarnedIncome!==false||ledger?.semantics?.unknownIsNotZero!==true)throw new Error('Canonical Income Ledger epistemic contract invalid');
  if(ledger?.authority?.executionAuthority!=='none'||ledger?.authority?.capitalExecution!==false)throw new Error('Canonical Income Ledger authority expansion');
  const candidates=beefyCandidates(source,generatedAt);
  const admitted=admitEvents(ledger.events||[],candidates.events);
  ledger.events=admitted.events;
  ledger.sourceState=ledger.sourceState||{};
  ledger.sourceState.company009BeefyEmbeddedIncome={
    file:'companies/company-009-beefy-cvxcrv-income.json',
    version:source.version,
    generatedAt:source.generatedAt||null,
    strategyId:source.strategy?.id||null,
    checkpointCount:candidates.checkpointCount,
    candidateIntervalCount:candidates.events.length,
    zeroIncomeIntervalCount:candidates.zeroIntervals,
    referenceAprUsed:false
  };
  refreshCompany(ledger);
  ledger.run=ledger.run||{};
  ledger.run.company009BeefyCandidateEventCount=candidates.events.length;
  ledger.run.company009BeefyNewEventsAdmitted=admitted.admitted;
  ledger.run.company009BeefyCheckpointCount=candidates.checkpointCount;
  ledger.accountingExtensions={
    ...(ledger.accountingExtensions||{}),
    company009BeefyEmbeddedIncome:{
      version:'0.1-constant-share-positive-ppfs',
      source:'companies/company-009-beefy-cvxcrv-income.json',
      referenceAprUsed:false,
      laterPriceMovementRewritesIncome:false,
      crossMonthIntervalsAutoAllocated:false,
      executionAuthority:'none'
    }
  };
  return ledger;
}

async function main(){
  const output=await build();
  await writeJson(LEDGER_FILE,output);
  const c=output.companies?.[COMPANY];
  console.log('Company #009 Beefy canonical embedded-income admission applied',{
    events:c?.eventCountsByFamily?.embeddedIncome||0,
    months:Object.keys(c?.monthly||{}),
    newEvents:output.run?.company009BeefyNewEventsAdmitted||0,
    referenceAprUsed:false,
    overallCoverageComplete:c?.coverage?.overallComplete===true,
    executionAuthority:output.authority?.executionAuthority
  });
}

export{validateSource,beefyCandidates,refreshCompany,build};
if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(err=>{console.error(err);process.exitCode=1;});
