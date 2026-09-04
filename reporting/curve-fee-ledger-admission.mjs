#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, finalizeCandidate, admitEvents } from './income-ledger.mjs';
import { buildCurveFeeAccrual, VERSION as ADAPTER_VERSION } from './curve-fee-accounting-adapter.mjs';

const __filename=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(__filename),'..');
const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const MARKET_FILE=process.env.MARKET_DATA_FILE||path.join(ROOT,'intelligence','market-data','market-data.json');

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export async function admitCurveFeeIntoLedgerState({ledger,rewards,marketData,generatedAt=new Date().toISOString(),provider=null,blockNumber=null,currentStates=null,claimableReader=null,claimScanner=null}={}){
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch before Curve fee admission');
  const accrual=await buildCurveFeeAccrual({
    rewards,marketData,previousExtension:ledger?.accountingExtensions?.curveFeeAccrual||null,generatedAt,
    provider,blockNumber,currentStates,claimableReader,claimScanner
  });
  const candidates=(accrual.events||[]).map(e=>finalizeCandidate(e,generatedAt));
  const admitted=admitEvents(ledger?.events,candidates);
  return{
    ledger:{...ledger,events:admitted.events,accountingExtensions:{...(ledger.accountingExtensions||{}),curveFeeAccrual:accrual.extension}},
    extension:accrual.extension,newEventsAdmitted:admitted.admitted,candidateEventCount:candidates.length
  };
}

function annotate({rebuilt,priorLedger,admission,generatedAt}){
  const x=admission.extension;
  return{
    ...rebuilt,
    generatedAt,
    sourceState:{
      ...(rebuilt.sourceState||{}),...(priorLedger?.sourceState||{}),
      curveFeeAccrual:{
        source:'Curve FeeDistributor exact-block claim(address) simulation',adapterVersion:x.version,status:x.status,
        feeDistributor:x.feeDistributor,token:x.token,currentStateCount:x.diagnostics.currentStateCount,
        companyCount:x.diagnostics.companyCount,boundaryCount:x.boundaries.length,candidateEventCount:admission.candidateEventCount,
        reconciliationCount:x.diagnostics.reconciliationCount,failureCount:x.diagnostics.failureCount,
        marketDataSource:'intelligence/market-data/market-data.json',referenceAprUsed:false,unknownIsNotZero:true
      }
    },
    run:{
      ...(rebuilt.run||{}),...(priorLedger?.run||{}),
      curveFeeCandidateEventCount:admission.candidateEventCount,
      curveFeeNewEventsAdmitted:admission.newEventsAdmitted,
      curveFeeBoundaryCount:x.boundaries.length,
      curveFeeReconciliationCount:x.diagnostics.reconciliationCount,
      curveFeeFailureCount:x.diagnostics.failureCount
    },
    accountingExtensions:{
      ...(rebuilt.accountingExtensions||{}),...(priorLedger?.accountingExtensions||{}),
      curveFeeAccrual:x
    }
  };
}

export async function runCurveFeeLedgerAdmission({generatedAt=new Date().toISOString(),provider=null}={}){
  const [ledger,rewards,marketData]=await Promise.all([readJson(LEDGER_FILE),readJson(REWARDS_FILE),readJson(MARKET_FILE)]);
  const admission=await admitCurveFeeIntoLedgerState({ledger,rewards,marketData,generatedAt,provider});
  await writeJson(LEDGER_FILE,admission.ledger);

  // Rebuild all canonical company/month derivatives from the append-only event
  // set, then restore mechanism extensions. This stays inside the sole Reporting
  // writer and never creates a second accounting truth plane.
  const rebuilt=await build();
  const finalLedger=annotate({rebuilt,priorLedger:ledger,admission,generatedAt});
  await writeJson(LEDGER_FILE,finalLedger);
  return finalLedger;
}

async function main(){
  const output=await runCurveFeeLedgerAdmission();
  console.log('Curve FeeDistributor evidence admitted through Canonical Ledger builder',{
    adapterVersion:ADAPTER_VERSION,events:output.events?.length||0,
    candidates:output.run?.curveFeeCandidateEventCount||0,newEvents:output.run?.curveFeeNewEventsAdmitted||0,
    boundaries:output.run?.curveFeeBoundaryCount||0,reconciliation:output.run?.curveFeeReconciliationCount||0,
    failures:output.run?.curveFeeFailureCount||0,executionAuthority:output.authority?.executionAuthority||null
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
