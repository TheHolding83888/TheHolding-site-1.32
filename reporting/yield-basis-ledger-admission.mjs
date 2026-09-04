#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, finalizeCandidate, admitEvents } from './income-ledger.mjs';
import { yieldBasisEvidenceCandidates, validateYieldBasisEvidence } from './yield-basis-income-candidates.mjs';
import { runVlCvxPlatformLedgerAdmission } from './vlcvx-platform-ledger-admission.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const EVIDENCE_FILE=process.env.YIELD_BASIS_EVIDENCE_FILE||path.join(ROOT,'reporting','yield-basis-accounting-evidence.json');
const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export function admitYieldBasisIntoLedgerState({ledger,evidence,generatedAt=new Date().toISOString()}={}){
  const presence=validateYieldBasisEvidence(evidence);
  if(!presence.present)return{ledger,newEventsAdmitted:0,candidateEventCount:0};
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch before Yield Basis admission');
  const candidates=yieldBasisEvidenceCandidates(evidence,finalizeCandidate,generatedAt),admitted=admitEvents(ledger?.events,candidates);
  return{ledger:{...ledger,events:admitted.events},newEventsAdmitted:admitted.admitted,candidateEventCount:candidates.length};
}

function annotate({rebuilt,priorLedger,evidence,admission,generatedAt}){
  const checkpointCount=Array.isArray(evidence?.checkpoints)?evidence.checkpoints.length:0,eventCount=Array.isArray(evidence?.events)?evidence.events.length:0;
  return{
    ...rebuilt,
    generatedAt,
    sourceState:{
      ...(rebuilt.sourceState||{}),
      ...(priorLedger?.sourceState||{}),
      yieldBasisAccrual:{
        file:'reporting/yield-basis-accounting-evidence.json',version:evidence?.version||null,status:evidence?.status||null,
        fullAccountingStart:evidence?.fullAccountingStart||null,checkpointCount,candidateEventCount:eventCount,
        feeDistributor:evidence?.source?.feeDistributor||null,claimableMetric:evidence?.source?.claimableMetric||null,
        settlementEvent:evidence?.source?.settlementEvent||null,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false
      }
    },
    run:{
      ...(rebuilt.run||{}),
      ...(priorLedger?.run||{}),
      yieldBasisCandidateEventCount:admission.candidateEventCount,
      yieldBasisNewEventsAdmitted:admission.newEventsAdmitted,
      yieldBasisCheckpointCount:checkpointCount
    },
    accountingExtensions:{
      ...(rebuilt.accountingExtensions||{}),
      ...(priorLedger?.accountingExtensions||{}),
      yieldBasisAccrual:{
        version:evidence?.version||null,source:'reporting/yield-basis-accounting-evidence.json',status:evidence?.status||null,
        fullAccountingStart:evidence?.fullAccountingStart||null,openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,
        claimIsSettlementNotSecondIncome:true,tokenSpecificReconciliation:true,referenceAprUsed:false,
        laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true,executionAuthority:'none'
      }
    }
  };
}

export async function runYieldBasisLedgerAdmission({generatedAt=new Date().toISOString()}={}){
  const [evidence,ledger]=await Promise.all([readJson(EVIDENCE_FILE),readJson(LEDGER_FILE)]);
  const admission=admitYieldBasisIntoLedgerState({ledger,evidence,generatedAt});
  if(admission.ledger!==ledger)await writeJson(LEDGER_FILE,admission.ledger);

  // Rebuild all derived company/month views through the same Canonical Ledger
  // builder. The interim event set becomes previous append-only history, so
  // existing Frax / ve(3,3) / embedded / realised events remain immutable.
  const rebuilt=await build();
  const yieldBasisLedger=annotate({rebuilt,priorLedger:ledger,evidence,admission,generatedAt});
  await writeJson(LEDGER_FILE,yieldBasisLedger);

  // Keep one canonical Reporting writer: the next mechanism-specific admission
  // runs inside this same writer after Yield Basis, rather than adding a second
  // scheduler or writer for the Canonical Income Ledger.
  return runVlCvxPlatformLedgerAdmission({generatedAt});
}

async function main(){
  const output=await runYieldBasisLedgerAdmission();
  console.log('Yield Basis + vlCVX platform evidence admitted through Canonical Ledger builder',{
    events:output.events?.length||0,
    yieldBasisCandidates:output.run?.yieldBasisCandidateEventCount||0,
    yieldBasisNewEvents:output.run?.yieldBasisNewEventsAdmitted||0,
    yieldBasisCheckpoints:output.run?.yieldBasisCheckpointCount||0,
    vlCvxPlatformCandidates:output.run?.vlCvxPlatformCandidateEventCount||0,
    vlCvxPlatformNewEvents:output.run?.vlCvxPlatformNewEventsAdmitted||0,
    vlCvxPlatformBoundaries:output.run?.vlCvxPlatformBoundaryCount||0,
    executionAuthority:output.authority?.executionAuthority||null
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
