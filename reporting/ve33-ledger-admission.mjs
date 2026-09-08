#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, finalizeCandidate, admitEvents } from './income-ledger.mjs';
import { ve33EvidenceCandidates, validateVe33Evidence } from './ve33-income-candidates.mjs';
import {
  buildLockedManagedEvidence,
  LOCKED_MANAGED_VERSION,
  LOCKED_MANAGED_ACCOUNTING_START,
  trackedLockedManagedDescriptors
} from './ve33-locked-managed-accounting-evidence.mjs';
import { lockedManagedEvidenceCandidates, validateLockedManagedEvidence } from './ve33-locked-managed-income-candidates.mjs';
import {
  canReuseEvidence,
  evidenceInputFingerprint,
  SAFE_WRITER_EVIDENCE_REUSE,
  selectHistoricalProviders
} from './ve33-accounting-runner.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const EVIDENCE_FILE=process.env.VE33_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-accounting-evidence.json');
const LOCKED_EVIDENCE_FILE=process.env.VE33_LOCKED_MANAGED_EVIDENCE_FILE||path.join(ROOT,'reporting','ve33-locked-managed-accounting-evidence.json');
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const LOCKED_MANAGED_MATERIALIZATION_ATTEMPTS=Math.max(1,Math.min(3,Number(process.env.VE33_LOCKED_MANAGED_MATERIALIZATION_ATTEMPTS||2)));

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export function admitVe33IntoLedgerState({ledger,evidence,generatedAt=new Date().toISOString()}={}){
  const presence=validateVe33Evidence(evidence);
  if(!presence.present)return{ledger,newEventsAdmitted:0,candidateEventCount:0};
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch before ve33 admission');
  const candidates=ve33EvidenceCandidates(evidence,finalizeCandidate,generatedAt);
  const admitted=admitEvents(ledger?.events,candidates);
  return{ledger:{...ledger,events:admitted.events},newEventsAdmitted:admitted.admitted,candidateEventCount:candidates.length};
}

export function admitLockedManagedIntoLedgerState({ledger,evidence,generatedAt=new Date().toISOString()}={}){
  const presence=validateLockedManagedEvidence(evidence);
  if(!presence.present)return{ledger,newEventsAdmitted:0,candidateEventCount:0};
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch before locked-managed admission');
  const candidates=lockedManagedEvidenceCandidates(evidence,finalizeCandidate,generatedAt);
  const admitted=admitEvents(ledger?.events,candidates);
  return{ledger:{...ledger,events:admitted.events},newEventsAdmitted:admitted.admitted,candidateEventCount:candidates.length};
}

export function requiredLockedManagedHistoricalProtocols(rewards){
  return [...new Set(trackedLockedManagedDescriptors(rewards).map(x=>x.protocolKey).filter(Boolean))].sort();
}

export function validateLockedManagedHistoricalSelection({rewards,selection}={}){
  const required=requiredLockedManagedHistoricalProtocols(rewards),missing=[];
  for(const protocolKey of required){
    const row=selection?.diagnostics?.[protocolKey];
    if(row?.status!=='archive-capable-provider-selected'||!selection?.providers?.[protocolKey])missing.push(protocolKey);
  }
  if(missing.length)throw new Error(`locked-managed historical RPC capability missing for: ${missing.join(', ')}`);
  return required;
}

function isExactMonthBoundary(value){
  const text=String(value||'');
  if(!/^\d{4}-\d{2}-01T00:00:00\.000Z$/.test(text))return false;
  return Number.isFinite(Date.parse(text));
}

export function lockedManagedHistoricalBoundaryFailures(evidence={}){
  return Object.values(evidence?.diagnostics?.protocols||{})
    .flatMap(row=>row?.boundaryFailures||[])
    .filter(row=>isExactMonthBoundary(row?.boundaryAt)&&['archive-state-unavailable','boundary-block-unavailable'].includes(row?.status));
}

function compactHistoricalSelection(selection,required=[]){
  return Object.fromEntries(required.map(protocolKey=>{
    const row=selection?.diagnostics?.[protocolKey]||{};
    return[protocolKey,{
      status:row.status||null,
      selectedProvider:row.selectedProvider||null,
      currentProvider:row.currentProvider||null,
      routingMode:row.routingMode||null,
      requiredBoundaries:row.requiredBoundaries||[],
      executionAuthority:'none'
    }];
  }));
}

function annotate(rebuilt,evidence,admission,lockedEvidence,lockedAdmission,generatedAt){
  const checkpointCount=Array.isArray(evidence?.checkpoints)?evidence.checkpoints.length:0;
  const eventCount=Array.isArray(evidence?.events)?evidence.events.length:0;
  const lockedCheckpointCount=Array.isArray(lockedEvidence?.checkpoints)?lockedEvidence.checkpoints.length:0;
  const lockedEventCount=Array.isArray(lockedEvidence?.events)?lockedEvidence.events.length:0;
  return{
    ...rebuilt,
    generatedAt,
    sourceState:{
      ...(rebuilt.sourceState||{}),
      ve33Accrual:{
        file:'reporting/ve33-accounting-evidence.json',version:evidence?.version||null,status:evidence?.status||null,
        fullAccountingStart:evidence?.fullAccountingStart||null,checkpointCount,candidateEventCount:eventCount,
        includedMechanisms:evidence?.scope?.included||[],deferredMechanisms:evidence?.scope?.deferred||[],
        referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false
      },
      ve33LockedManaged:{
        file:'reporting/ve33-locked-managed-accounting-evidence.json',version:lockedEvidence?.version||null,status:lockedEvidence?.status||null,
        fullAccountingStart:lockedEvidence?.fullAccountingStart||null,checkpointCount:lockedCheckpointCount,candidateEventCount:lockedEventCount,
        includedMechanisms:lockedEvidence?.scope?.included||[],excludedMechanisms:lockedEvidence?.scope?.excluded||[],
        historicalRpcSelection:lockedEvidence?.provenance?.historicalRpcSelection||null,
        materializationAttempts:lockedEvidence?.provenance?.materializationAttempts||[],
        lastEarnNoSettlementProofCount:lockedEvidence?.diagnostics?.lastEarnNoSettlementProofCount||0,
        referenceAprUsed:false,grossVeNftPrincipalDeltaIsIncomeAuthority:false,laterPriceMovementRewritesClosedIncome:false
      }
    },
    run:{
      ...(rebuilt.run||{}),
      ve33CandidateEventCount:admission.candidateEventCount,ve33NewEventsAdmitted:admission.newEventsAdmitted,ve33CheckpointCount:checkpointCount,
      ve33LockedManagedCandidateEventCount:lockedAdmission.candidateEventCount,ve33LockedManagedNewEventsAdmitted:lockedAdmission.newEventsAdmitted,ve33LockedManagedCheckpointCount:lockedCheckpointCount
    },
    accountingExtensions:{
      ...(rebuilt.accountingExtensions||{}),
      ve33Accrual:{
        version:evidence?.version||null,source:'reporting/ve33-accounting-evidence.json',status:evidence?.status||null,
        fullAccountingStart:evidence?.fullAccountingStart||null,openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,
        claimIsSettlementNotSecondIncome:true,rebaseDepositIntoVeNftIsSecondIncome:false,referenceAprUsed:false,
        laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true,executionAuthority:'none'
      },
      ve33LockedManaged:{
        version:lockedEvidence?.version||null,source:'reporting/ve33-locked-managed-accounting-evidence.json',status:lockedEvidence?.status||null,
        fullAccountingStart:lockedEvidence?.fullAccountingStart||null,openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,
        withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,
        historicalBoundaryIdentityMustMatch:true,unchangedLastEarnAcrossExactBoundariesProvesNoSettlement:true,
        historicalClosedIntervalPriceSource:'canonical market-data Git history only; unmapped or stale price remains UNKNOWN',
        laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true,executionAuthority:'none'
      }
    }
  };
}

export async function runVe33LedgerAdmission({generatedAt=new Date().toISOString()}={}){
  const[evidence,ledger,rewards,previousLocked]=await Promise.all([
    readJson(EVIDENCE_FILE),readJson(LEDGER_FILE),readJson(REWARDS_FILE),readJson(LOCKED_EVIDENCE_FILE,{})
  ]);

  const lockedFingerprint=evidenceInputFingerprint({
    rewards,
    root:ROOT,
    extra:{
      lane:'ve33-locked-managed',
      version:LOCKED_MANAGED_VERSION,
      accountingStart:LOCKED_MANAGED_ACCOUNTING_START,
      historicalCanonicalPriceRequiredForClosedMonth:true,
      exactLastEarnSettlementContinuityProof:true,
      boundedHistoricalMaterializationRetry:true,
      ve33EvidenceInputFingerprint:evidence?.runner?.safeWriterInputFingerprint||null
    }
  });
  const reuseCandidate=canReuseEvidence({
    previous:previousLocked,
    fingerprint:lockedFingerprint,
    root:ROOT,
    env:process.env,
    previousFingerprint:previousLocked?.provenance?.safeWriterInputFingerprint||null
  });
  const reuseLocked=reuseCandidate&&lockedManagedHistoricalBoundaryFailures(previousLocked).length===0;

  let lockedEvidence;
  if(reuseLocked){
    lockedEvidence=previousLocked;
  }else{
    let seed=previousLocked,selection=null,requiredHistoricalProtocols=[],materializationAttempts=[];
    for(let attempt=1;attempt<=LOCKED_MANAGED_MATERIALIZATION_ATTEMPTS;attempt++){
      selection=await selectHistoricalProviders({rewards,env:process.env});
      requiredHistoricalProtocols=validateLockedManagedHistoricalSelection({rewards,selection});
      lockedEvidence=await buildLockedManagedEvidence({rewards,previous:seed,generatedAt,providers:selection.providers});
      const historicalFailures=lockedManagedHistoricalBoundaryFailures(lockedEvidence);
      materializationAttempts.push({
        attempt,
        historicalBoundaryFailureCount:historicalFailures.length,
        historicalBoundaryFailures:historicalFailures.slice(0,20).map(row=>({
          laneKey:row.laneKey||null,boundaryAt:row.boundaryAt||null,status:row.status||null,error:row.error||null
        })),
        checkpointCount:Array.isArray(lockedEvidence?.checkpoints)?lockedEvidence.checkpoints.length:0,
        eventCount:Array.isArray(lockedEvidence?.events)?lockedEvidence.events.length:0,
        selectedProviders:Object.fromEntries(requiredHistoricalProtocols.map(protocolKey=>[protocolKey,selection?.diagnostics?.[protocolKey]?.selectedProvider||null]))
      });
      seed=lockedEvidence;
      if(historicalFailures.length===0)break;
    }
    lockedEvidence.provenance={
      ...(lockedEvidence.provenance||{}),
      safeWriterInputFingerprint:lockedFingerprint,
      safeWriterEvidenceReuseVersion:SAFE_WRITER_EVIDENCE_REUSE.version,
      safeWriterEvidenceReuseMaxAgeMinutes:SAFE_WRITER_EVIDENCE_REUSE.maxAgeMinutes,
      historicalRpcRequired:true,
      historicalRpcSelection:compactHistoricalSelection(selection,requiredHistoricalProtocols),
      materializationRetryPolicy:'retry only when exact month-boundary archive state remains unavailable; each attempt uses fresh proven historical providers and the prior attempt as append-only evidence seed',
      materializationAttemptLimit:LOCKED_MANAGED_MATERIALIZATION_ATTEMPTS,
      materializationAttempts,
      historicalBoundaryFailureCountAfterRetry:lockedManagedHistoricalBoundaryFailures(lockedEvidence).length,
      exactLastEarnSettlementContinuityProof:true,
      executionAuthority:'none'
    };
    await writeJson(LOCKED_EVIDENCE_FILE,lockedEvidence);
  }

  const admission=admitVe33IntoLedgerState({ledger,evidence,generatedAt});
  const lockedAdmission=admitLockedManagedIntoLedgerState({ledger:admission.ledger,evidence:lockedEvidence,generatedAt});
  if(lockedAdmission.ledger!==ledger)await writeJson(LEDGER_FILE,lockedAdmission.ledger);

  // Re-run the same Canonical Ledger builder against the interim append-only
  // event set. Its ordinary previous-event retention reconstructs every derived
  // company/month view from one canonical event history instead of duplicating
  // projection logic in mechanism adapters.
  const rebuilt=await build();
  const finalLedger=annotate(rebuilt,evidence,admission,lockedEvidence,lockedAdmission,generatedAt);
  await writeJson(LEDGER_FILE,finalLedger);
  return finalLedger;
}

async function main(){
  const output=await runVe33LedgerAdmission();
  console.log('ve(3,3) evidence admitted through Canonical Ledger builder',{
    events:output.events?.length||0,
    ve33Candidates:output.run?.ve33CandidateEventCount||0,ve33NewEvents:output.run?.ve33NewEventsAdmitted||0,ve33Checkpoints:output.run?.ve33CheckpointCount||0,
    lockedManagedCandidates:output.run?.ve33LockedManagedCandidateEventCount||0,lockedManagedNewEvents:output.run?.ve33LockedManagedNewEventsAdmitted||0,lockedManagedCheckpoints:output.run?.ve33LockedManagedCheckpointCount||0,
    executionAuthority:output.authority?.executionAuthority||null
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
