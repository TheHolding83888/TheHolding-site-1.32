#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-010-state.yml';
const APR_WORKFLOW_PATH='.github/workflows/update-company-010-projectx-reference-apr.yml';
const BASELINE_PATH='onboarding/company-010-production-baseline.mjs';
const OVERLAY_PATH='onboarding/company-010-stakedao-overlay.mjs';
const APR_SCRIPT_PATH='onboarding/company-010-projectx-reference-apr.mjs';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const aprWorkflow=fs.readFileSync(APR_WORKFLOW_PATH,'utf8');
const baseline=fs.readFileSync(BASELINE_PATH,'utf8');
const overlay=fs.readFileSync(OVERLAY_PATH,'utf8');
const aprScript=fs.readFileSync(APR_SCRIPT_PATH,'utf8');

assert.match(workflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/company-010-state-workflow-definition-proof\.mjs/m,'paired proof marker missing');
assert.match(workflow,/name: "Update Company #010 · Cypher Production State"/,'Company #010 writer identity drift');
assert.match(workflow,/permissions:\n  contents: write/,'Company #010 writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write|write-all/,'Company #010 writer authority widened');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'production writer must not execute on pull_request');
assert.match(workflow,/group:\s*company-010-production-state/,'Company #010 writer concurrency drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'Company #010 writer must remain non-cancellable');
assert.match(workflow,/ref:\s*main/,'Company #010 writer must consume canonical main');
assert.ok(workflow.includes("- cron: '47 4 * * *'"),'Company #010 fallback heartbeat missing');
assert.ok(workflow.includes('node onboarding/company-010-reconciliation.mjs'),'Company #010 reconciliation collection missing');
assert.ok(workflow.includes('node onboarding/company-010-production-baseline.mjs'),'Company #010 baseline bridge missing');
assert.ok(workflow.includes('node onboarding/company-010-stakedao-overlay.mjs'),'Company #010 Stake DAO lifecycle overlay missing');
assert.ok(workflow.includes("const stakeResolved=stakeEvidence?.ok===true&&Number.isFinite(stakeUsd)&&stakeUsd>=0"),'workflow known-zero resolution contract missing');
assert.ok(workflow.includes('if(stakeActive){'),'workflow active-position branch missing');
assert.ok(workflow.includes("if(stake) throw new Error('Stake DAO proven-zero capital row survived')"),'workflow proven-zero capital guard missing');
assert.ok(workflow.includes("if(prod) throw new Error('Stake DAO proven-zero Productivity row survived')"),'workflow proven-zero Productivity guard missing');
assert.ok(workflow.includes('knownZeroIsNotUnknown'),'workflow known-zero epistemic guard missing');
assert.ok(workflow.includes("- 'onboarding/company-010-projectx-reference-apr.mjs'"),'canonical writer does not wake on Project X APR source changes');
assert.ok(workflow.includes('node --check onboarding/company-010-projectx-reference-apr.mjs'),'canonical writer does not syntax-check Project X APR source');
assert.ok(workflow.includes('node onboarding/company-010-projectx-reference-apr.mjs'),'canonical writer does not materialize Project X APR');
assert.ok(workflow.includes('companies/company-010-projectx-rate-history.json'),'canonical writer does not publish Project X rate history with final Cypher state');
assert.ok(workflow.includes('projectXReferenceAprUsesObservedFeeGrowth'),'canonical writer Project X epistemic proof missing');
assert.ok(workflow.includes('git fetch origin main'),'Company #010 moving-main publish guard missing');
assert.ok(workflow.includes('git rebase origin/main'),'Company #010 moving-main rebase missing');
assert.ok(workflow.includes('Company #010 source contract changed during publication; fresh collection required.'),'Company #010 code-race fail-closed guard missing');
assert.ok(workflow.includes('git push origin HEAD:main'),'Company #010 bounded writer publish missing');

// The old Project X workflow remains useful as a replay diagnostic, but it no
// longer owns repository mutation for either the canonical Cypher state or its
// rate-history input. One canonical writer now owns both materialized outputs.
assert.match(aprWorkflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/company-010-state-workflow-definition-proof\.mjs/m,'Project X diagnostic paired proof marker missing');
assert.match(aprWorkflow,/name: "Update Company #010 · Project X Reference APR"/,'Project X diagnostic identity drift');
assert.match(aprWorkflow,/permissions:\n  contents: read/,'Project X diagnostic must remain repository read-only');
assert.doesNotMatch(aprWorkflow,/contents:\s*write|actions:\s*write|write-all/,'Project X diagnostic regained write authority');
assert.doesNotMatch(aprWorkflow,/git add|git commit|git push|git rebase/,'Project X diagnostic regained repository publication behavior');
assert.ok(aprWorkflow.includes('node onboarding/company-010-projectx-reference-apr.mjs'),'Project X diagnostic replay missing');
assert.ok(aprWorkflow.includes('git checkout -- companies/company-010-production-state.json companies/company-010-projectx-rate-history.json'),'Project X diagnostic does not discard ephemeral replay');
assert.ok(aprWorkflow.includes('repositoryMutationAuthority:false'),'Project X diagnostic ownership diagnostic missing');

assert.ok(aprScript.includes("const STATE=process.env.COMPANY_010_STATE||path.join(ROOT,'companies/company-010-production-state.json')"),'Project X APR canonical state target drift');
assert.ok(aprScript.includes("const HISTORY=process.env.COMPANY_010_PROJECTX_RATE_HISTORY||path.join(ROOT,'companies/company-010-projectx-rate-history.json')"),'Project X APR history target drift');
assert.ok(aprScript.includes("projectXFeeTierIsNotApr:true"),'Project X APR fee-tier epistemic boundary missing');
assert.ok(aprScript.includes("projectXReferenceAprUsesObservedFeeGrowth:true"),'Project X APR observed-fee methodology boundary missing');
assert.ok(aprScript.includes("executionAuthority:'none'"),'Project X APR execution boundary missing');

assert.ok(baseline.includes('stakeDao?.ok!==true'),'baseline requires factual Stake DAO resolution');
assert.ok(baseline.includes('stakeDaoUsd<0'),'baseline rejects negative invalid state');
assert.ok(baseline.includes('stakeDaoCurrentPositionActive:stakeDaoUsd>0'),'baseline exposes active/inactive lifecycle');
assert.ok(overlay.includes('const stakeActive=stakeUsd>0||stakeShares>0||stakeLp>0'),'overlay active-state derivation missing');
assert.ok(overlay.includes("state.capital.positions=(state.capital.positions||[]).filter(x=>x.assetId!=='stakedao-base-curve-4pool')"),'overlay stale capital removal missing');
assert.ok(overlay.includes("if(stakeActive)state.capital.positions.push"),'overlay must only publish active Stake DAO capital');
assert.ok(overlay.includes("if(stakeActive)state.productivity.positions.push"),'overlay must only publish active Stake DAO Productivity');
assert.ok(overlay.includes('zeroIsKnown:stakeUsd===0'),'overlay proven-zero provenance missing');
assert.ok(overlay.includes('knownZeroIsNotUnknown=true'),'overlay known-zero epistemic boundary missing');

const combined=[workflow,aprWorkflow,baseline,overlay,aprScript].join('\n');
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'eth_sendTransaction', 'eth_sendRawTransaction', 'privateKey', 'mnemonic']){
  assert.equal(combined.includes(forbidden),false,`Company #010 lifecycle authority expansion: ${forbidden}`);
}

console.log('Company #010 state workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  projectXDiagnostic:APR_WORKFLOW_PATH,
  canonicalProductionStateWriter:'Update Company #010 · Cypher Production State',
  projectXDiagnosticRepositoryMutationAuthority:false,
  projectXRateHistoryOwnedByCanonicalStateWriter:true,
  knownZeroIsNotUnknown:true,
  inactivePrincipalPublishesCapital:false,
  inactivePrincipalPublishesProductivity:false,
  currentRewardsMayRemainMeasured:true,
  movingMainRebuild:true,
  sourceRaceFailClosed:true,
  executionAuthority:'none',
  walletAuthority:false,
  claimingAuthority:false,
  capitalExecution:false
});
