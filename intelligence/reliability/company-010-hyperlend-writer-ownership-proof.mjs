#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const DIAGNOSTIC='.github/workflows/update-company-010-hyperlend-income.yml';
const STATE_WORKFLOW='.github/workflows/update-company-010-state.yml';
const REWARDS_WORKFLOW='.github/workflows/update-company-rewards.yml';
const STATE_OVERLAY='onboarding/company-010-hyperlend-income-overlay.mjs';
const REWARDS_OVERLAY='rewards/company-010-hyperlend-rewards-overlay.mjs';

const diagnostic=fs.readFileSync(DIAGNOSTIC,'utf8');
const stateWorkflow=fs.readFileSync(STATE_WORKFLOW,'utf8');
const rewardsWorkflow=fs.readFileSync(REWARDS_WORKFLOW,'utf8');
const stateOverlay=fs.readFileSync(STATE_OVERLAY,'utf8');
const rewardsOverlay=fs.readFileSync(REWARDS_OVERLAY,'utf8');

assert.match(diagnostic,/^# holding-workflow-definition-proof: intelligence\/reliability\/company-010-hyperlend-writer-ownership-proof\.mjs/m,'HyperLend paired proof marker missing');
assert.match(diagnostic,/name: "Update Company #010 · HyperLend Income"/,'HyperLend diagnostic identity drift');
assert.match(diagnostic,/permissions:\n  contents: read/,'HyperLend diagnostic must remain repository read-only');
assert.doesNotMatch(diagnostic,/contents:\s*write|actions:\s*write|write-all/,'HyperLend diagnostic regained write authority');
assert.doesNotMatch(diagnostic,/git add|git commit|git push|git rebase/,'HyperLend diagnostic regained repository publication behavior');
assert.ok(diagnostic.includes('COMPANY_010_STATE: /tmp/company-010-production-state.json'),'HyperLend diagnostic must replay Company State ephemerally');
assert.ok(diagnostic.includes('REWARDS_DATA: /tmp/rewards-data.json'),'HyperLend diagnostic must replay Rewards ephemerally');
assert.ok(diagnostic.includes('node onboarding/company-010-hyperlend-income-overlay.mjs'),'HyperLend state replay missing');
assert.ok(diagnostic.includes('node rewards/company-010-hyperlend-rewards-overlay.mjs'),'HyperLend Rewards replay missing');
assert.ok(diagnostic.includes('repositoryMutationAuthority:false'),'HyperLend diagnostic ownership declaration missing');
assert.ok(diagnostic.includes('test -z "$(git status --porcelain)"'),'HyperLend diagnostic repository-clean proof missing');

assert.match(stateWorkflow,/permissions:\n  contents: write/,'Canonical Company #010 writer lost bounded contents authority');
assert.ok(stateWorkflow.includes("- 'onboarding/company-010-hyperlend-income-overlay.mjs'"),'Canonical Company #010 writer does not wake on HyperLend source changes');
assert.ok(stateWorkflow.includes('node --check onboarding/company-010-hyperlend-income-overlay.mjs'),'Canonical Company #010 writer does not syntax-check HyperLend overlay');
assert.ok(stateWorkflow.includes('node onboarding/company-010-hyperlend-income-overlay.mjs'),'Canonical Company #010 writer does not materialize HyperLend state');
assert.ok(stateWorkflow.includes('REWARDS_DATA: /tmp/company-010-hyperlend-rewards-disabled.json'),'Company State writer must isolate shared Rewards output');
assert.ok(stateWorkflow.includes("if(fs.existsSync(process.env.REWARDS_DATA))throw new Error('Canonical Company State writer must not materialize shared Rewards aggregate')"),'Company State writer Rewards isolation proof missing');
assert.ok(stateWorkflow.includes('hyperlendAprIsNotRealisedIncome'),'HyperLend epistemic boundary missing from Company State writer');
assert.ok(stateWorkflow.includes('git add companies/company-010-production-state.json'),'Canonical Company #010 publication path missing');

assert.match(rewardsWorkflow,/permissions:\n  contents: write/,'Canonical Rewards writer lost bounded contents authority');
assert.ok(rewardsWorkflow.includes("- 'rewards/company-010-hyperlend-rewards-overlay.mjs'"),'Canonical Rewards writer does not wake on HyperLend Rewards projection changes');
assert.ok(rewardsWorkflow.includes('node rewards/company-010-hyperlend-rewards-overlay.mjs'),'Canonical Rewards writer does not materialize HyperLend Rewards projection');
assert.ok(rewardsWorkflow.includes("repositoryMutationAuthority!=='Update Company Rewards'"),'Rewards writer ownership assertion missing');
assert.ok(rewardsWorkflow.includes('git add companies/rewards-data.json'),'Canonical Rewards publication path missing');

assert.ok(stateOverlay.includes("const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json')"),'HyperLend state target drift');
assert.ok(stateOverlay.includes("const REWARDS_DATA=process.env.REWARDS_DATA||path.join(ROOT,'companies/rewards-data.json')"),'HyperLend optional Rewards target drift');
assert.ok(stateOverlay.includes("executionAuthority:'none'"),'HyperLend state overlay execution boundary missing');
assert.ok(stateOverlay.includes('noDoubleCount:true'),'HyperLend no-double-count boundary missing');
assert.ok(rewardsOverlay.includes("sourceOfTruth:'companies/company-010-production-state.json'"),'HyperLend Rewards must consume canonical Company #010 state');
assert.ok(rewardsOverlay.includes("repositoryMutationAuthority:'Update Company Rewards'"),'HyperLend Rewards canonical writer declaration missing');
assert.ok(rewardsOverlay.includes("executionAuthority:'none'"),'HyperLend Rewards execution boundary missing');

const combined=[diagnostic,stateWorkflow,rewardsWorkflow,stateOverlay,rewardsOverlay].join('\n');
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'eth_sendTransaction', 'eth_sendRawTransaction', 'privateKey', 'mnemonic']){
  assert.equal(combined.includes(forbidden),false,`HyperLend writer split authority expansion: ${forbidden}`);
}

console.log('Company #010 HyperLend writer ownership proof PASS',{
  diagnosticRepositoryMutationAuthority:false,
  companyStateCanonicalWriter:'Update Company #010 · Cypher Production State',
  rewardsCanonicalWriter:'Update Company Rewards',
  hyperlendStateMaterializedByCanonicalStateWriter:true,
  hyperlendRewardsMaterializedByCanonicalRewardsWriter:true,
  crossArtifactWriterRetired:true,
  noDoubleCount:true,
  executionAuthority:'none',
  walletAuthority:false,
  capitalExecution:false
});
