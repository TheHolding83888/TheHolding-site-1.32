#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-010-state.yml';
const BASELINE_PATH='onboarding/company-010-production-baseline.mjs';
const OVERLAY_PATH='onboarding/company-010-stakedao-overlay.mjs';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const baseline=fs.readFileSync(BASELINE_PATH,'utf8');
const overlay=fs.readFileSync(OVERLAY_PATH,'utf8');

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
assert.ok(workflow.includes('git fetch origin main'),'Company #010 moving-main publish guard missing');
assert.ok(workflow.includes('git rebase origin/main'),'Company #010 moving-main rebase missing');
assert.ok(workflow.includes('Company #010 source contract changed during publication; fresh collection required.'),'Company #010 code-race fail-closed guard missing');
assert.ok(workflow.includes('git push origin HEAD:main'),'Company #010 bounded writer publish missing');

assert.ok(baseline.includes('stakeDao?.ok!==true'),'baseline requires factual Stake DAO resolution');
assert.ok(baseline.includes('stakeDaoUsd<0'),'baseline rejects negative invalid state');
assert.ok(baseline.includes('stakeDaoCurrentPositionActive:stakeDaoUsd>0'),'baseline exposes active/inactive lifecycle');
assert.ok(overlay.includes('const stakeActive=stakeUsd>0||stakeShares>0||stakeLp>0'),'overlay active-state derivation missing');
assert.ok(overlay.includes("state.capital.positions=(state.capital.positions||[]).filter(x=>x.assetId!=='stakedao-base-curve-4pool')"),'overlay stale capital removal missing');
assert.ok(overlay.includes("if(stakeActive)state.capital.positions.push"),'overlay must only publish active Stake DAO capital');
assert.ok(overlay.includes("if(stakeActive)state.productivity.positions.push"),'overlay must only publish active Stake DAO Productivity');
assert.ok(overlay.includes('zeroIsKnown:stakeUsd===0'),'overlay proven-zero provenance missing');
assert.ok(overlay.includes('knownZeroIsNotUnknown=true'),'overlay known-zero epistemic boundary missing');

const combined=[workflow,baseline,overlay].join('\n');
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'eth_sendTransaction', 'eth_sendRawTransaction', 'privateKey', 'mnemonic']){
  assert.equal(combined.includes(forbidden),false,`Company #010 lifecycle authority expansion: ${forbidden}`);
}

console.log('Company #010 state workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
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
