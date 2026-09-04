#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-rewards.yml';
const CONTRACT_PATH='rewards/rewards-scheduler-contract.json';

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const contract=JSON.parse(fs.readFileSync(CONTRACT_PATH,'utf8'));

assert.equal(contract.version,'0.1-rewards-scheduler-contract');
assert.equal(contract.status,'production');
assert.equal(contract.timezone,'UTC');
assert.equal(contract.cron,'07 5 * * *');
assert.equal(contract.dailySnapshotUtc,'05:07 UTC');
assert.equal(contract.epistemics?.naturalScheduleProofRequired,true);
assert.equal(contract.epistemics?.manualDispatchDoesNotProveSchedulerHealth,true);
assert.equal(contract.epistemics?.unknownIsNotZero,true);
assert.equal(contract.generatedStateCollisionRecovery?.mode,'fresh-main-recompute');
assert.equal(contract.generatedStateCollisionRecovery?.oldHeadFailedJobRerunAllowed,false);
assert.equal(contract.generatedStateCollisionRecovery?.conflictMergeGuessingAllowed,false);
assert.match(String(contract.generatedStateCollisionRecovery?.reason||''),/fresh main/i,'generated-state collision recovery must explain fresh-main recompute');

assert.equal(contract.authority?.repositoryMutationAuthority,true,'Rewards writer must retain bounded contents write authority');
for(const key of ['workflowDispatchAuthority','capitalExecution','walletAuthority','methodologyMutationAuthority']){
  assert.equal(contract.authority?.[key],false,`Rewards scheduler authority expansion: ${key}`);
}

const exactCron=`- cron: '${contract.cron}'`;
assert.equal(workflow.split(exactCron).length-1,1,'Rewards workflow must contain exactly one canonical scheduler cron');
const cypherGenericTrigger="- 'rewards/company-010-generic-ve-promotion.mjs'";
assert.equal(workflow.split(cypherGenericTrigger).length-1,1,'Rewards writer must naturally wake for Cypher generic promotion source changes');
assert.match(workflow,/permissions:\n  contents: write/,'Rewards writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write/,'Rewards scheduler must not gain actions:write');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'Rewards production writer must not gain pull_request execution');
assert.match(workflow,/group:\s*company-rewards-daily/,'Rewards concurrency group drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'Rewards production writer must remain non-cancellable');
assert.match(workflow,/node intelligence\/reliability\/rewards-scheduler-workflow-definition-proof\.mjs/,'Rewards scheduler contract preflight missing');

const rewardMinutes=5*60+7;
for(const downstream of contract.downstreamSequence||[]){
  const m=/^(\d{2}):(\d{2}) UTC$/.exec(String(downstream.nominalUtc||''));
  assert.ok(m,`invalid downstream time for ${downstream.workflow}`);
  const minute=Number(m[1])*60+Number(m[2]);
  assert.ok(rewardMinutes<minute,`Rewards schedule must remain before downstream ${downstream.workflow}`);
}

console.log('Rewards workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  cron:contract.cron,
  dailySnapshotUtc:contract.dailySnapshotUtc,
  cypherGenericPromotionNaturalTrigger:true,
  productionWriterContentsAuthority:true,
  workflowDispatchAuthority:false,
  concurrency:'company-rewards-daily/non-cancellable',
  naturalScheduleProofRequired:true,
  generatedStateCollisionRecovery:'fresh-main-recompute/no-old-head-rerun/no-merge-guessing'
});