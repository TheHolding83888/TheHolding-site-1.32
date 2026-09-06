#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, finalizeCandidate, admitEvents } from './income-ledger.mjs';
import { buildProjectXIncomeCandidates } from './projectx-income-candidates.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const HISTORY_FILE=process.env.PROJECTX_HISTORY_FILE||path.join(ROOT,'companies','company-010-projectx-rate-history.json');
const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export function admitProjectXIntoLedgerState({ledger,history,generatedAt=new Date().toISOString()}={}){
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch before Project X admission');
  const built=buildProjectXIncomeCandidates(history,finalizeCandidate,generatedAt);
  const admitted=admitEvents(ledger?.events,built.candidates);
  return{
    ledger:{...ledger,events:admitted.events},
    candidateBuild:built,
    candidateEventCount:built.candidates.length,
    newEventsAdmitted:admitted.admitted
  };
}

function annotate(rebuilt,history,admission,generatedAt){
  const summary=admission.candidateBuild.summary;
  return{
    ...rebuilt,
    generatedAt,
    sourceState:{
      ...(rebuilt.sourceState||{}),
      projectXFeeAccrual:{
        file:'companies/company-010-projectx-rate-history.json',
        version:history?.version||null,
        engineVersion:history?.engineVersion||null,
        generatedAt:history?.generatedAt||null,
        observationCount:summary.observationCount,
        intervalCount:summary.intervalCount,
        acceptedIntervalCount:summary.acceptedIntervalCount,
        fingerprintBoundaryCount:summary.fingerprintBoundaryCount,
        claimResetBoundaryCount:summary.claimResetBoundaryCount,
        crossMonthBoundaryCount:summary.crossMonthBoundaryCount,
        candidateEventCount:summary.candidateEventCount,
        sourceMethod:'adjacent same-fingerprint collect.staticCall fee growth',
        referenceAprUsed:false,
        currentClaimableBalanceIsPeriodIncome:false,
        laterPriceMovementRewritesClosedIncome:false
      }
    },
    run:{
      ...(rebuilt.run||{}),
      projectXCandidateEventCount:admission.candidateEventCount,
      projectXNewEventsAdmitted:admission.newEventsAdmitted,
      projectXObservationCount:summary.observationCount,
      projectXAcceptedIntervalCount:summary.acceptedIntervalCount,
      projectXBoundaryCount:summary.fingerprintBoundaryCount+summary.claimResetBoundaryCount+summary.crossMonthBoundaryCount
    },
    accountingExtensions:{
      ...(rebuilt.accountingExtensions||{}),
      projectXFeeAccrual:{
        version:admission.candidateBuild.version,
        source:'companies/company-010-projectx-rate-history.json',
        company:'Cypher',
        route:'projectx-whype-usdc',
        family:'accrued-entitlement',
        openingBalanceCreatesIncome:false,
        fingerprintChangeCreatesIncome:false,
        claimOrResetCreatesIncome:false,
        claimOrResetIsSettlementBoundary:true,
        crossMonthIntervalAutoAllocated:false,
        currentClaimableBalanceIsPeriodIncome:false,
        endpointObservedPriceFreezesValuation:true,
        referenceAprUsed:false,
        laterPriceMovementRewritesClosedIncome:false,
        unknownIsNotZero:true,
        executionAuthority:'none'
      }
    }
  };
}

export async function runProjectXLedgerAdmission({generatedAt=new Date().toISOString()}={}){
  const[history,ledger]=await Promise.all([readJson(HISTORY_FILE),readJson(LEDGER_FILE)]);
  const admission=admitProjectXIntoLedgerState({ledger,history,generatedAt});

  // Materialize new append-only events first. Re-running the canonical builder
  // then reconstructs company/month views from one canonical event history and
  // preserves every previously admitted mechanism-specific event.
  if(admission.newEventsAdmitted>0)await writeJson(LEDGER_FILE,admission.ledger);
  const rebuilt=await build();
  const finalLedger=annotate(rebuilt,history,admission,generatedAt);
  await writeJson(LEDGER_FILE,finalLedger);
  return finalLedger;
}

async function main(){
  const output=await runProjectXLedgerAdmission();
  console.log('Project X factual fee evidence admitted through Canonical Ledger builder',{
    events:output.events?.length||0,
    candidates:output.run?.projectXCandidateEventCount||0,
    newEvents:output.run?.projectXNewEventsAdmitted||0,
    observations:output.run?.projectXObservationCount||0,
    acceptedIntervals:output.run?.projectXAcceptedIntervalCount||0,
    boundaries:output.run?.projectXBoundaryCount||0,
    referenceAprUsed:false,
    executionAuthority:output.authority?.executionAuthority||null
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
