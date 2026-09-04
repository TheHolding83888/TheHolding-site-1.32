#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { build, finalizeCandidate, admitEvents } from './income-ledger.mjs';
import { buildVlCvxPlatformAccrual, VERSION as ADAPTER_VERSION } from './vlcvx-platform-accounting-adapter.mjs';

const __filename=fileURLToPath(import.meta.url);
const ROOT=path.resolve(path.dirname(__filename),'..');
const LEDGER_FILE=process.env.INCOME_LEDGER_FILE||path.join(ROOT,'reporting','income-ledger.json');
const REWARDS_FILE=process.env.REWARDS_DATA_FILE||path.join(ROOT,'companies','rewards-data.json');
const MARKET_FILE=process.env.MARKET_DATA_FILE||path.join(ROOT,'intelligence','market-data','market-data.json');

async function readJson(file,fallback={}){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch{return fallback;}}
async function writeJson(file,data){await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,JSON.stringify(data,null,2)+'\n');}

export async function admitVlCvxPlatformIntoLedgerState({ledger,rewards,marketData,generatedAt=new Date().toISOString(),provider=null}={}){
  if(ledger?.version!=='0.1-canonical-income-ledger')throw new Error('Canonical Income Ledger version mismatch before vlCVX platform admission');
  const accrual=await buildVlCvxPlatformAccrual({rewards,marketData,previousExtension:ledger?.accountingExtensions?.vlCvxPlatformAccrual||null,generatedAt,provider});
  const candidates=(accrual.events||[]).map(e=>finalizeCandidate(e,generatedAt)),admitted=admitEvents(ledger?.events,candidates);
  return{ledger:{...ledger,events:admitted.events,accountingExtensions:{...(ledger.accountingExtensions||{}),vlCvxPlatformAccrual:accrual.extension}},extension:accrual.extension,newEventsAdmitted:admitted.admitted,candidateEventCount:candidates.length};
}

function annotate({rebuilt,priorLedger,admission,generatedAt}){
  const x=admission.extension;
  return{
    ...rebuilt,
    generatedAt,
    sourceState:{
      ...(rebuilt.sourceState||{}),...(priorLedger?.sourceState||{}),
      vlCvxPlatformAccrual:{
        source:'companies/rewards-data.json#vlcvx-locker-platform-rewards',adapterVersion:x.version,status:x.status,
        locker:x.locker,currentStateCount:x.diagnostics.currentStateCount,companyCount:x.diagnostics.companyCount,
        boundaryCount:x.boundaries.length,candidateEventCount:admission.candidateEventCount,reconciliationCount:x.diagnostics.reconciliationCount,
        marketDataSource:'intelligence/market-data/market-data.json',referenceAprUsed:false
      }
    },
    run:{
      ...(rebuilt.run||{}),...(priorLedger?.run||{}),
      vlCvxPlatformCandidateEventCount:admission.candidateEventCount,
      vlCvxPlatformNewEventsAdmitted:admission.newEventsAdmitted,
      vlCvxPlatformBoundaryCount:x.boundaries.length,
      vlCvxPlatformReconciliationCount:x.diagnostics.reconciliationCount
    },
    accountingExtensions:{
      ...(rebuilt.accountingExtensions||{}),...(priorLedger?.accountingExtensions||{}),
      vlCvxPlatformAccrual:x
    }
  };
}

export async function runVlCvxPlatformLedgerAdmission({generatedAt=new Date().toISOString(),provider=null}={}){
  const [ledger,rewards,marketData]=await Promise.all([readJson(LEDGER_FILE),readJson(REWARDS_FILE),readJson(MARKET_FILE)]);
  const admission=await admitVlCvxPlatformIntoLedgerState({ledger,rewards,marketData,generatedAt,provider});
  await writeJson(LEDGER_FILE,admission.ledger);
  const rebuilt=await build();
  const finalLedger=annotate({rebuilt,priorLedger:ledger,admission,generatedAt});
  await writeJson(LEDGER_FILE,finalLedger);
  return finalLedger;
}

async function main(){
  const output=await runVlCvxPlatformLedgerAdmission();
  console.log('vlCVX platform evidence admitted through Canonical Ledger builder',{
    adapterVersion:ADAPTER_VERSION,events:output.events?.length||0,
    candidates:output.run?.vlCvxPlatformCandidateEventCount||0,newEvents:output.run?.vlCvxPlatformNewEventsAdmitted||0,
    boundaries:output.run?.vlCvxPlatformBoundaryCount||0,reconciliation:output.run?.vlCvxPlatformReconciliationCount||0,
    executionAuthority:output.authority?.executionAuthority||null
  });
}

if(process.argv[1]&&path.resolve(process.argv[1])===__filename)main().catch(error=>{console.error(error);process.exitCode=1;});
