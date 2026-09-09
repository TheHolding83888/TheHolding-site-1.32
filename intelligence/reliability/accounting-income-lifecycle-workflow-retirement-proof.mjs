#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const RETIRED_WORKFLOW='.github/workflows/verify-accounting-income-lifecycle-contract.yml';
const RETIRED_CONTRACT='reporting/accounting-income-lifecycle-contract.json';
const RETIRED_VALIDATOR='reporting/accounting-income-lifecycle-contract-validation.mjs';
const CANONICAL_WORKFLOW='.github/workflows/verify-income-lifecycle-contract.yml';
const CANONICAL_CONTRACT='reporting/income-lifecycle-contract.json';
const CANONICAL_VALIDATOR='reporting/income-lifecycle-contract-validation.mjs';
const PROOF='intelligence/reliability/accounting-income-lifecycle-workflow-retirement-proof.mjs';

// holding-workflow-retirement-proof: .github/workflows/verify-accounting-income-lifecycle-contract.yml

for(const file of [RETIRED_WORKFLOW,CANONICAL_WORKFLOW,CANONICAL_CONTRACT,CANONICAL_VALIDATOR]){
  if(!fs.existsSync(file)||!fs.statSync(file).size) throw new Error(`required lifecycle retirement proof input missing: ${file}`);
}
for(const file of [RETIRED_CONTRACT,RETIRED_VALIDATOR]){
  if(fs.existsSync(file)) throw new Error(`duplicate lifecycle machinery still exists: ${file}`);
}

const retired=fs.readFileSync(RETIRED_WORKFLOW,'utf8');
const canonicalWorkflow=fs.readFileSync(CANONICAL_WORKFLOW,'utf8');
const canonicalContract=JSON.parse(fs.readFileSync(CANONICAL_CONTRACT,'utf8'));

for(const token of [
  'pull_request:',
  'schedule:',
  'workflow_run:',
  'contents: write',
  'actions: write',
  'git push',
  'git commit',
  RETIRED_CONTRACT,
  RETIRED_VALIDATOR
]){
  if(retired.includes(token)) throw new Error(`retired lifecycle workflow regained automatic/write/duplicate authority: ${token}`);
}
if(!retired.includes('workflow_dispatch:')) throw new Error('retired lifecycle workflow must remain explicit manual diagnostic only');
if(!retired.includes('contents: read')) throw new Error('retired lifecycle workflow must remain read-only');
if(!retired.includes(`holding-workflow-definition-proof: ${PROOF}`)) throw new Error('retired lifecycle workflow is not bound to its deterministic retirement proof');
if(!canonicalWorkflow.includes(CANONICAL_VALIDATOR)) throw new Error('canonical lifecycle workflow lost canonical validator binding');
if(canonicalWorkflow.includes(RETIRED_VALIDATOR)||canonicalWorkflow.includes(RETIRED_CONTRACT)) throw new Error('canonical lifecycle workflow references retired duplicate machinery');

const expectedLifecycle=['earned','accrued','claimable','claimed','received','reinvested'];
if(JSON.stringify(canonicalContract.lifecycle)!==JSON.stringify(expectedLifecycle)) throw new Error('canonical lifecycle sequence drift');
if(canonicalContract.authority?.executionAuthority!=='none') throw new Error('canonical lifecycle execution authority expanded');
if(canonicalContract.authority?.incomeCreationAuthority!==false) throw new Error('canonical lifecycle income creation authority expanded');
if(canonicalContract.authority?.monthClosingAuthority!==false) throw new Error('canonical lifecycle month closing authority expanded');
if(canonicalContract.recognitionContract?.unknownIsNotZero!==true) throw new Error('canonical lifecycle UNKNOWN != 0 invariant lost');
if(canonicalContract.recognitionContract?.crossMonthTimeProrationCreatesIncome!==false) throw new Error('canonical lifecycle cross-month proration guard lost');
if(canonicalContract.recognitionContract?.economicIncomeRecognizedAtMostOnce!==true) throw new Error('canonical lifecycle one-time recognition invariant lost');

execFileSync(process.execPath,[CANONICAL_VALIDATOR],{
  encoding:'utf8',
  stdio:['ignore','pipe','pipe'],
  timeout:30000
});

console.log('Accounting lifecycle duplicate workflow retirement proof PASS',{
  retiredWorkflow:RETIRED_WORKFLOW,
  canonicalWorkflow:CANONICAL_WORKFLOW,
  canonicalContract:CANONICAL_CONTRACT,
  duplicateContractRemoved:!fs.existsSync(RETIRED_CONTRACT),
  duplicateValidatorRemoved:!fs.existsSync(RETIRED_VALIDATOR),
  automaticTrigger:false,
  repositoryMutationAuthority:false,
  executionAuthority:'none'
});
