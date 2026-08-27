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
assert.match(workflow,/test -s reporting\/income-ledger\.json/,'monthly reports canonical income ledger preflight missing');
assert.match(workflow,/INCOME_LEDGER_FILE:\s*\.\/reporting\/income-ledger\.json/,'monthly reports canonical income ledger runtime binding missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports\.mjs/,'monthly report builder missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports-validation\.mjs/,'monthly report validator missing');
assert.doesNotMatch(workflow,/gh workflow run|workflow_dispatch\s*\(/,'monthly reports workflow gained dispatch behavior');

assert.match(workflow,/critical_fingerprint\(\)/,'monthly writer critical fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-reports\.mjs/,'monthly writer builder fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-reports-validation\.mjs/,'monthly writer validator fingerprint missing');
assert.match(workflow,/Critical Company Monthly Reports code changed during publish rebase; fail closed/,'monthly writer code-race fail-closed guard missing');
assert.match(workflow,/PRODUCTIVITY_DATA_FILE=\.\/companies\/productivity-data\.json[\s\S]*INCOME_LEDGER_FILE=\.\/reporting\/income-ledger\.json[\s\S]*node reporting\/company-monthly-reports\.mjs/,'monthly writer post-rebase canonical rebuild missing');
assert.match(workflow,/git diff --name-only origin\/main\.\.\.HEAD/,'monthly writer post-rebase delta guard missing');
assert.match(workflow,/reporting\/company-monthly-reports\.json/,'monthly writer generated output allowlist missing');

// The output is presentation/reporting data only. The workflow has no wallet,
// capital execution, methodology mutation, arbitrary Actions dispatch, or
// independent price-discovery authority.
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'workflow_dispatch(', 'actions: write', 'write-all', 'api.coingecko.com', 'COINGECKO_API_KEY']){
  assert.equal(workflow.includes(forbidden),false,`monthly reports authority expansion: ${forbidden}`);
}

console.log('Company Monthly Reports workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  canonicalUpstream:'Update The Holding Reporting Data',
  canonicalIncomeLedger:'reporting/income-ledger.json',
  productivityMaterializationWake:true,
  fallbackCron:'37 7 * * *',
  movingMainRebuild:true,
  criticalCodeRaceFailClosed:true,
  executionAuthority:'none',
  walletAuthority:false,
  methodologyMutationAuthority:false
});
