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

// HyperLend Rewards projection is owned by this canonical Rewards writer.
assert.ok(workflow.includes("- 'rewards/company-010-hyperlend-rewards-overlay.mjs'"),'Rewards writer must wake on HyperLend projection source changes');
assert.ok(workflow.includes('node --check rewards/company-010-hyperlend-rewards-overlay.mjs'),'Rewards writer does not syntax-check HyperLend projection');
assert.ok(workflow.includes('node rewards/company-010-hyperlend-rewards-overlay.mjs'),'Rewards writer does not materialize HyperLend projection');
assert.ok(workflow.includes("repositoryMutationAuthority!=='Update Company Rewards'"),'Rewards writer HyperLend ownership assertion missing');

// ICP/NNS owns domain state/history only. Update Company Rewards is the sole
// publisher of the ICP projection inside companies/rewards-data.json. Keep the
// path trigger for human/code changes, and explicitly consume the successful
// ICP workflow completion because GITHUB_TOKEN-generated state commits do not
// recursively emit ordinary push workflows.
assert.ok(workflow.includes("- 'rewards/icp-nns-rewards-projection.mjs'"),'Rewards writer must wake on ICP projection source changes');
assert.ok(workflow.includes("- 'companies/icp-nns-rewards-state.json'"),'Rewards writer must retain the canonical ICP state path trigger');
const icpWorkflowRun='- "Update ICP NNS Rewards"';
assert.equal(workflow.split(icpWorkflowRun).length-1,1,'ICP NNS workflow_run handoff must exist exactly once');
assert.match(workflow,/workflow_run:\n\s+workflows:[\s\S]*- "Update ICP NNS Rewards"[\s\S]*types: \[completed\]/,'Rewards writer must consume ICP workflow completion');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/,'Rewards workflow_run handoffs must fail closed on unsuccessful upstream runs');
assert.ok(workflow.includes('node --check rewards/icp-nns-rewards-projection.mjs'),'Rewards writer does not syntax-check ICP projection');
assert.ok(workflow.includes('node rewards/icp-nns-rewards-projection.mjs'),'Rewards writer does not materialize ICP projection');
assert.ok(workflow.includes("sourceStateRepositoryMutationAuthority!=='Update ICP NNS Rewards'"),'Rewards writer ICP source ownership assertion missing');
assert.ok(workflow.includes("diag.repositoryMutationAuthority!=='Update Company Rewards'"),'Rewards writer ICP aggregate ownership assertion missing');
assert.ok(workflow.includes('git add companies/rewards-data.json'),'Rewards writer bounded publication path missing');

// #616 closed Rook's current Convex-Team vlCVX tracking boundary. The production
// writer must accept only that bounded factual state and must not regress to the
// former `unresolved` final-parity expectation or turn tracking proof into income.
assert.match(workflow,/currentRewardSettlement!=='no-votium-incentive-eligibility-observed-current-route'/,'Rook bounded Convex-Team settlement final-parity guard missing');
assert.match(workflow,/trackingBoundaryComplete!==true/,'Rook factual tracking completion guard missing');
assert.match(workflow,/periodIncomeAuthority!==false/,'Rook settlement income-authority isolation guard missing');
assert.match(workflow,/universalExternalRewardZeroAsserted!==false/,'Rook universal-zero epistemic guard missing');
assert.match(workflow,/vlCvxConvexTeamSettlement\?\.scope!=='tracking-proof-only'/,'Rook tracking-only diagnostic guard missing');
assert.doesNotMatch(workflow,/currentRewardSettlement!=='unresolved'/,'stale Rook unresolved production parity guard survived');

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
  hyperlendProjectionOwnedByRewardsWriter:true,
  icpNnsStatePathTriggerRetained:true,
  icpNnsWorkflowRunHandoff:true,
  icpNnsProjectionOwnedByRewardsWriter:true,
  githubTokenRecursivePushAssumed:false,
  rookConvexTeamSettlementBoundary:true,
  rookTrackingOnlyNoIncomeAuthority:true,
  productionWriterContentsAuthority:true,
  workflowDispatchAuthority:false,
  concurrency:'company-rewards-daily/non-cancellable',
  naturalScheduleProofRequired:true,
  generatedStateCollisionRecovery:'fresh-main-recompute/no-old-head-rerun/no-merge-guessing'
});
