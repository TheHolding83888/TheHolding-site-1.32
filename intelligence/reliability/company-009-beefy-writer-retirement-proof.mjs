#!/usr/bin/env node
import fs from 'node:fs';

const WORKFLOW='.github/workflows/update-income-ledger-company-009-beefy.yml';
const CANONICAL='reporting/income-ledger.mjs';
const SOURCE='companies/company-009-beefy-cvxcrv-income.json';

for(const file of [WORKFLOW,CANONICAL,SOURCE]){
  if(!fs.existsSync(file)||!fs.statSync(file).size) throw new Error(`required retirement proof input missing: ${file}`);
}

const workflow=fs.readFileSync(WORKFLOW,'utf8');
const canonical=fs.readFileSync(CANONICAL,'utf8');

const forbidden=[
  'contents: write',
  'git push',
  'git commit',
  'workflow_run:',
  'schedule:',
  'branches: [main]',
  'INCOME_LEDGER_FILE:',
  'node reporting/income-ledger-company-009-beefy.mjs'
];
for(const token of forbidden){
  if(workflow.includes(token)) throw new Error(`retired Beefy writer regained runtime/write capability: ${token}`);
}
if(!workflow.includes('contents: read')) throw new Error('retired Beefy workflow must remain contents: read');
if(!workflow.includes('workflow_dispatch:')) throw new Error('retired Beefy workflow must remain explicit manual diagnostic only');
if(!canonical.includes("const COMPANY_009_BEEFY_FILE=")) throw new Error('canonical Income Ledger missing Company #009 Beefy source binding');
if(!canonical.includes('company009BeefyCandidates')) throw new Error('canonical Income Ledger missing Beefy factual candidate admission');
if(!canonical.includes('companies/company-009-beefy-cvxcrv-income.json')) throw new Error('canonical Income Ledger not bound to factual Beefy source');
if(!canonical.includes('referenceAprUsed:false')) throw new Error('canonical Beefy admission lost Reference APR exclusion');

console.log('Company #009 Beefy writer retirement proof PASS',{
  workflow:WORKFLOW,
  canonicalWriter:CANONICAL,
  factualSource:SOURCE,
  repositoryMutationAuthority:false,
  executionAuthority:'none'
});
