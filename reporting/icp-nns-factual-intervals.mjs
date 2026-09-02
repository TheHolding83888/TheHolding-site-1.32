#!/usr/bin/env node
/**
 * The Holding · ICP NNS factual interval evaluator v0.1
 *
 * Converts comparable owner-attested NNS maturity snapshots into diagnostic
 * earned-income admission candidates. It never writes the Canonical Income
 * Ledger and never uses Reference APR. With one snapshot it must produce zero
 * period-income candidates.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(__filename),'..');
const EVIDENCE_FILE=process.env.ICP_NNS_FACTUAL_SNAPSHOTS_FILE||path.join(ROOT,'reporting','icp-nns-factual-snapshots.json');
const CONFIG_FILE=process.env.ICP_NNS_CONFIG_FILE||path.join(ROOT,'intelligence','icp-nns','company-005-006-neuron-pool.json');
const OUTPUT_FILE=process.env.ICP_NNS_FACTUAL_INTERVALS_FILE||null;

const VERSION='0.1-icp-nns-factual-interval-evaluator';
const EXPECTED_EVIDENCE_VERSION='0.1-icp-nns-factual-snapshot-evidence';
const EXPECTED_CONFIG_VERSION='0.1-icp-nns-shared-neuron-pool';

const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const round=(v,d=12)=>{const n=Number(v);if(!Number.isFinite(n))return null;const f=10**d;return Math.round(n*f)/f;};
const monthKey=v=>/^\d{4}-\d{2}-\d{2}$/.test(String(v||''))?String(v).slice(0,7):null;
const sha256=v=>crypto.createHash('sha256').update(v).digest('hex');
async function readJson(file){return JSON.parse(await fs.readFile(file,'utf8'));}

function validateAuthority(evidence){
  const a=evidence?.authority||{};
  if(a.executionAuthority!=='none'||a.walletAuthority!=='none'||a.claimAuthority!=='none'||a.capitalExecution!==false||a.periodIncomeAuthority!==false||a.methodologyMutationAuthority!=='none'){
    throw new Error('ICP NNS factual evidence authority expansion');
  }
  const s=evidence?.semantics||{};
  for(const key of ['snapshotIsStateNotPeriodIncome','unknownIsNotZero'])if(s[key]!==true)throw new Error(`ICP NNS factual evidence semantic missing: ${key}`);
  for(const key of ['singleSnapshotCanCreateIncome','referenceAprCanCreateIncome','publicGlobalRewardPoolCanCreateCompanyIncome','ballotCountCanCreateIncome','principalUnlockIsIncome'])if(s[key]!==false)throw new Error(`ICP NNS factual evidence fail-closed semantic invalid: ${key}`);
}

function validateConfig(config,evidence){
  if(config?.version!==EXPECTED_CONFIG_VERSION)throw new Error('ICP NNS canonical config version drift');
  if(!Array.isArray(config.neuronIds)||config.neuronIds.length!==41)throw new Error('ICP NNS canonical neuron universe must contain 41 IDs');
  if(new Set(config.neuronIds).size!==config.neuronIds.length)throw new Error('ICP NNS canonical neuron universe contains duplicate IDs');
  const hash=sha256(JSON.stringify(config.neuronIds));
  if(evidence?.positionScope?.neuronUniverseCount!==config.neuronIds.length)throw new Error('ICP NNS evidence neuron count differs from canonical config');
  if(evidence?.positionScope?.neuronUniverseSha256!==hash)throw new Error('ICP NNS evidence neuron universe hash differs from canonical config');
  const allocation=evidence?.positionScope?.companies||{};
  const configAllocation=config?.allocation?.companies||{};
  for(const company of ['0x5860...83CA8.eth','aerocvxyb.eth']){
    if(Number(allocation[company])!==0.5||Number(configAllocation[company])!==0.5)throw new Error(`ICP NNS 50/50 economic allocation drift: ${company}`);
  }
  return hash;
}

function validateSnapshots(evidence,universeHash){
  const snapshots=Array.isArray(evidence?.snapshots)?evidence.snapshots:[];
  if(!snapshots.length)throw new Error('ICP NNS factual evidence requires at least one state snapshot');
  const ids=new Set();
  let previousDate='';
  for(const s of snapshots){
    if(!s?.snapshotId||ids.has(s.snapshotId))throw new Error('ICP NNS snapshot identity missing or duplicated');
    ids.add(s.snapshotId);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(s.observationDate||'')))throw new Error(`ICP NNS snapshot date invalid: ${s.snapshotId}`);
    if(previousDate&&s.observationDate<=previousDate)throw new Error('ICP NNS snapshots must be strictly chronological');
    previousDate=s.observationDate;
    if(s.timestampPrecision!=='date-only'&&s.timestampPrecision!=='exact')throw new Error(`ICP NNS snapshot timestamp precision invalid: ${s.snapshotId}`);
    if(s.sourceType!=='owner-manual-nns-dapp-snapshot'&&s.sourceType!=='read-only-exact-nns-state')throw new Error(`ICP NNS snapshot source type is not factual: ${s.snapshotId}`);
    if(!s.measurementBasis)throw new Error(`ICP NNS snapshot measurement basis missing: ${s.snapshotId}`);
    if(s.neuronUniverseCount!==41||s.neuronUniverseSha256!==universeHash)throw new Error(`ICP NNS snapshot universe mismatch: ${s.snapshotId}`);
    if(!(finite(s?.maturity?.aggregateIcp)&&Number(s.maturity.aggregateIcp)>=0))throw new Error(`ICP NNS aggregate maturity missing: ${s.snapshotId}`);
    if(s.periodIncomeAuthority!==false)throw new Error(`ICP NNS state snapshot gained period-income authority: ${s.snapshotId}`);
  }
  return snapshots;
}

function lifecycleForInterval(events,startDate,endDate){
  return (Array.isArray(events)?events:[]).filter(e=>String(e?.occurredAt||'').slice(0,10)>startDate&&String(e?.occurredAt||'').slice(0,10)<=endDate);
}

function evaluatePair(a,b,evidence){
  const blockers=[];
  if(a.neuronUniverseSha256!==b.neuronUniverseSha256||a.neuronUniverseCount!==b.neuronUniverseCount)blockers.push('neuron-universe-changed');
  if(a.measurementBasis!==b.measurementBasis)blockers.push('measurement-basis-changed');
  const lifecycle=lifecycleForInterval(evidence.lifecycleEvents,a.observationDate,b.observationDate);
  let rewardStateAdjustmentIcp=0;
  for(const e of lifecycle){
    if(e?.recognizedIncome===true)blockers.push(`lifecycle-event-must-not-self-recognize-income:${e.eventId}`);
    if(e?.affectsRewardStateComparability===true){
      if(e?.reconciliationStatus!=='reconciled'||!finite(e?.rewardStateAdjustmentIcp))blockers.push(`unreconciled-reward-state-lifecycle:${e.eventId}`);
      else rewardStateAdjustmentIcp+=Number(e.rewardStateAdjustmentIcp);
    }
  }
  const rawDelta=Number(b.maturity.aggregateIcp)-Number(a.maturity.aggregateIcp);
  const reconciledDelta=rawDelta+rewardStateAdjustmentIcp;
  if(!(reconciledDelta>0))blockers.push('no-positive-comparable-maturity-delta');
  const crossMonth=monthKey(a.observationDate)!==monthKey(b.observationDate);
  if(crossMonth)blockers.push('cross-month-boundary-requires-explicit-allocation');
  const valuationOk=finite(b?.valuation?.unitUsd)&&Number(b.valuation.unitUsd)>0&&Boolean(b?.valuation?.source)&&Boolean(b?.valuation?.observedAt);
  if(reconciledDelta>0&&!valuationOk)blockers.push('canonical-usd-valuation-missing-at-interval-end');
  const economicallyComparable=!blockers.some(x=>x.startsWith('neuron-universe')||x.startsWith('measurement-basis')||x.startsWith('unreconciled-reward-state-lifecycle')||x.startsWith('lifecycle-event-must-not-self-recognize-income'));
  const readyForCanonicalAdmission=blockers.length===0;
  const candidates=[];
  if(readyForCanonicalAdmission){
    const totalUsd=reconciledDelta*Number(b.valuation.unitUsd);
    for(const [company,share] of Object.entries(evidence.positionScope.companies)){
      candidates.push({
        eventKey:`icp-nns-maturity:${company}:${a.snapshotId}:${b.snapshotId}`,
        company,
        family:'accrued-entitlement',
        route:'icp-nns-governance',
        protocol:'Internet Computer NNS',
        asset:'ICP',
        periodStart:a.observationDate,
        periodEnd:b.observationDate,
        economicDate:b.observationDate,
        amount:round(reconciledDelta*Number(share),12),
        usdValue:round(totalUsd*Number(share),8),
        valuationUnitUsd:round(b.valuation.unitUsd,12),
        valuationSource:b.valuation.source,
        valuationObservedAt:b.valuation.observedAt,
        sourceFile:'reporting/icp-nns-factual-snapshots.json',
        sourceIdentity:`${a.snapshotId}:${b.snapshotId}`,
        evidenceStatus:'comparable-factual-maturity-delta',
        referenceAprUsed:false,
        periodAttributionStatus:'single-month',
        executionAuthority:'none'
      });
    }
  }
  return{
    intervalId:`${a.snapshotId}__${b.snapshotId}`,
    startSnapshotId:a.snapshotId,
    endSnapshotId:b.snapshotId,
    periodStart:a.observationDate,
    periodEnd:b.observationDate,
    rawMaturityDeltaIcp:round(rawDelta,12),
    rewardStateAdjustmentIcp:round(rewardStateAdjustmentIcp,12),
    reconciledMaturityDeltaIcp:round(reconciledDelta,12),
    economicallyComparable,
    crossMonth,
    readyForCanonicalAdmission,
    blockers,
    lifecycleEventIds:lifecycle.map(e=>e.eventId),
    candidates
  };
}

export async function buildIcpNnsFactualIntervals(){
  const [evidence,config]=await Promise.all([readJson(EVIDENCE_FILE),readJson(CONFIG_FILE)]);
  if(evidence?.version!==EXPECTED_EVIDENCE_VERSION)throw new Error('ICP NNS factual evidence version mismatch');
  validateAuthority(evidence);
  const universeHash=validateConfig(config,evidence);
  const snapshots=validateSnapshots(evidence,universeHash);
  const intervals=[];
  for(let i=1;i<snapshots.length;i++)intervals.push(evaluatePair(snapshots[i-1],snapshots[i],evidence));
  const candidates=intervals.flatMap(x=>x.candidates);
  return{
    version:VERSION,
    generatedAt:new Date().toISOString(),
    status:snapshots.length===1?'baseline-only-no-period-income':'intervals-evaluated',
    referenceAprUsed:false,
    accountingAuthority:false,
    executionAuthority:'none',
    sourceFile:'reporting/icp-nns-factual-snapshots.json',
    canonicalNeuronUniverseSha256:universeHash,
    snapshotCount:snapshots.length,
    intervalCount:intervals.length,
    readyIntervalCount:intervals.filter(x=>x.readyForCanonicalAdmission).length,
    admissionCandidateCount:candidates.length,
    snapshots:snapshots.map(s=>({snapshotId:s.snapshotId,observationDate:s.observationDate,evidenceStatus:s.evidenceStatus,measurementBasis:s.measurementBasis,aggregateMaturityIcp:s.maturity.aggregateIcp,periodIncomeAuthority:false})),
    intervals,
    admissionCandidates:candidates,
    invariants:{
      currentStateIsNotPeriodIncome:true,
      singleSnapshotCreatesZeroIncome:true,
      referenceAprCanNeverBackfillEarnedIncome:true,
      lifecycleDiscontinuityFailsClosed:true,
      unknownIsNotZero:true
    }
  };
}

const result=await buildIcpNnsFactualIntervals();
if(OUTPUT_FILE){
  await fs.mkdir(path.dirname(OUTPUT_FILE),{recursive:true});
  await fs.writeFile(OUTPUT_FILE,JSON.stringify(result,null,2)+'\n');
}else{
  console.log('ICP NNS factual interval evaluator',JSON.stringify(result,null,2));
}
