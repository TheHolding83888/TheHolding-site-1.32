#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-monthly-reports.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');

assert.match(workflow,/^name: Update Company Monthly Reports/m,'monthly reports workflow identity drift');
assert.match(workflow,/permissions:\n  contents: write/,'monthly reports writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write/,'monthly reports must not gain actions:write');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'monthly reports production writer must not gain pull_request execution');
assert.match(workflow,/group:\s*company-monthly-reports-daily/,'monthly reports concurrency group drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'monthly reports writer must remain non-cancellable');
assert.match(workflow,/workflow_run:\n\s+workflows:\n\s+- "Update The Holding Reporting Data"\n\s+types: \[completed\]/,'monthly reports canonical Reporting handoff missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/,'monthly workflow_run success gate missing');
assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/,'monthly workflow_run main-branch gate missing');
assert.match(workflow,/ref: main/,'monthly reports must consume canonical main');
assert.ok(workflow.includes("- 'companies/productivity-data.json'"),'monthly reports Productivity materialization wake missing');
assert.ok(workflow.includes("- cron: '37 7 * * *'"),'monthly reports fallback heartbeat missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports\.mjs/,'monthly report builder missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports-validation\.mjs/,'monthly report validator missing');
assert.doesNotMatch(workflow,/gh workflow run|workflow_dispatch\s*\(/,'monthly reports workflow gained dispatch behavior');

// The output is presentation/reporting data only. The workflow has no wallet,
// capital execution, methodology mutation, or arbitrary Actions dispatch path.
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'workflow_dispatch(', 'actions: write', 'write-all']){
  assert.equal(workflow.includes(forbidden),false,`monthly reports authority expansion: ${forbidden}`);
}

console.log('Company Monthly Reports workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  canonicalUpstream:'Update The Holding Reporting Data',
  productivityMaterializationWake:true,
  fallbackCron:'37 7 * * *',
  executionAuthority:'none',
  walletAuthority:false,
  methodologyMutationAuthority:false
});
