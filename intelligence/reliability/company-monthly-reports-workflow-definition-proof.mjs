#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-monthly-reports.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');

function requireText(text,message){assert.ok(workflow.includes(text),message);}
function section(start,end){
  const a=workflow.indexOf(start);
  assert.ok(a>=0,`missing workflow section: ${start}`);
  const b=end?workflow.indexOf(end,a+start.length):-1;
  if(end)assert.ok(b>a,`missing workflow section boundary: ${end}`);
  return b>a?workflow.slice(a,b):workflow.slice(a);
}
function ordered(text,needles,message){
  let last=-1;
  for(const needle of needles){
    const at=text.indexOf(needle,last+1);
    assert.ok(at>last,`${message}: ${needle}`);
    last=at;
  }
}

// Identity, authority and trigger boundary.
assert.match(workflow,/^name: Update Company Monthly Reports$/m,'monthly reports workflow identity drift');
requireText('# holding-workflow-definition-proof: intelligence/reliability/company-monthly-reports-workflow-definition-proof.mjs','paired definition proof marker missing');
requireText('permissions:\n  contents: write','monthly writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write|write-all/,'monthly writer gained broader Actions/repository authority');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'production writer must not execute on pull_request');
requireText('workflow_dispatch:','bounded manual recovery trigger missing');
requireText('workflows:\n      - "Update The Holding Reporting Data"','canonical Reporting handoff missing');
requireText("github.event.workflow_run.conclusion == 'success'",'canonical Reporting success gate missing');
requireText("github.event.workflow_run.head_branch == 'main'",'canonical Reporting main gate missing');
requireText('ref: main','production writer must consume canonical main');
requireText('group: company-monthly-reports-daily','writer concurrency group drift');
requireText('cancel-in-progress: false','writer must remain non-cancellable');
requireText("- cron: '37 7 * * *'",'fallback heartbeat drift');
requireText('timeout-minutes: 5','bounded writer runtime missing');

// Code/data dependencies that alter the projection must wake this writer.
for(const path of [
  "- 'companies/productivity-data.json'",
  "- 'reporting/income-ledger.json'",
  "- 'reporting/reporting-data.json'",
  "- 'reporting/accounting-coverage.mjs'",
  "- 'reporting/accounting-coverage-validation.mjs'",
  "- 'reporting/accounting-notice-queue.mjs'",
  "- 'reporting/accounting-notice-queue-validation.mjs'",
  "- 'reporting/accounting-reference-reconciliation.mjs'",
  "- 'reporting/accounting-reference-reconciliation-validation.mjs'"
]) requireText(path,`monthly writer dependency wake missing: ${path}`);
assert.equal(workflow.includes("- 'reporting/accounting-coverage.json'"),false,'Monthly Reports must not self-wake from canonical persisted Coverage; Reporting workflow_run is the owner handoff');

// Static preflight must fail closed before projection.
for(const path of [
  'reporting/accounting-coverage.mjs',
  'reporting/accounting-coverage-validation.mjs',
  'reporting/accounting-notice-queue.mjs',
  'reporting/accounting-notice-queue-validation.mjs',
  'reporting/accounting-reference-reconciliation.mjs',
  'reporting/accounting-reference-reconciliation-validation.mjs'
]) requireText(`node --check ${path}`,`monthly writer static preflight missing: ${path}`);
requireText('test -s reporting/income-ledger.json','canonical Income Ledger dependency preflight missing');
assert.equal(workflow.includes('test -s reporting/accounting-coverage.json'),false,'Monthly Reports must not depend on stale persisted Coverage preflight');
requireText("referenceAprCanBackfillEarnedIncome!==false",'Income Ledger Reference APR authority guard missing');
requireText("x.authority?.executionAuthority!=='none'",'Income Ledger execution-authority guard missing');

// Initial production-shaped diagnostic projection: fresh ephemeral Coverage before downstream consumers.
const diagnostic=section('- name: Build + validate accounting diagnostics','- name: Commit monthly reporting snapshot');
requireText('ACCOUNTING_COVERAGE_FILE: /tmp/accounting-coverage.json','ephemeral Coverage output binding missing');
ordered(diagnostic,[
  'node reporting/accounting-coverage.mjs',
  'node reporting/accounting-coverage-validation.mjs',
  'node reporting/accounting-notice-queue.mjs',
  'node reporting/accounting-notice-queue-validation.mjs',
  'node reporting/accounting-reference-reconciliation.mjs',
  'node reporting/accounting-reference-reconciliation-validation.mjs'
],'monthly diagnostic dependency order drift');
requireText('PRODUCTIVITY_DATA_FILE: ./companies/productivity-data.json','Coverage productivity binding missing');
requireText('INCOME_LEDGER_FILE: ./reporting/income-ledger.json','Coverage canonical ledger binding missing');
requireText('Canonical persisted accounting-coverage.json remains owned by Reporting.','single-writer Coverage ownership comment missing');

// Moving-main publication must rebuild the same dependency chain after every safe rebase.
const publish=section('for attempt in 1 2 3; do');
ordered(publish,[
  'git fetch origin main',
  'git rebase origin/main',
  'critical_after="$(critical_fingerprint)"',
  'node reporting/company-monthly-reports.mjs',
  'node reporting/company-monthly-reports-validation.mjs',
  'node reporting/company-monthly-earned-income.mjs',
  'node reporting/company-monthly-earned-income-validation.mjs',
  'ACCOUNTING_COVERAGE_FILE=/tmp/accounting-coverage.json',
  'node reporting/accounting-coverage.mjs',
  'node reporting/accounting-coverage-validation.mjs',
  'node reporting/accounting-notice-queue.mjs',
  'node reporting/accounting-notice-queue-validation.mjs',
  'node reporting/accounting-reference-reconciliation.mjs',
  'node reporting/accounting-reference-reconciliation-validation.mjs',
  'git add reporting/company-monthly-reports.json reporting/accounting-notice-queue.json reporting/accounting-reference-reconciliation.json',
  'git commit --amend --no-edit',
  'git diff --name-only origin/main...HEAD',
  'git push origin HEAD:main'
],'post-rebase canonical rebuild/publish order drift');
requireText('Safe writer guard: rebase conflict; refusing to guess.','rebase conflict fail-closed guard missing');
requireText('Critical Company Monthly Reports code changed during publish rebase; fail closed and require a fresh canonical run.','critical-code race guard missing');
requireText('Safe writer guard: main moved during push; rebuilding on the next rebased canonical state','moving-main retry guard missing');
requireText('Safe writer guard: push failed after 3 attempts.','bounded publish retry guard missing');

// Any code that can change downstream interpretation must be in the critical fingerprint.
for(const path of [
  'reporting/company-monthly-reports.mjs',
  'reporting/canonical-earned-income-view.mjs',
  'reporting/company-monthly-earned-income.mjs',
  'reporting/accounting-coverage.mjs',
  'reporting/accounting-coverage-validation.mjs',
  'reporting/accounting-notice-queue.mjs',
  'reporting/accounting-notice-queue-validation.mjs',
  'reporting/accounting-reference-reconciliation.mjs',
  'reporting/accounting-reference-reconciliation-validation.mjs',
  '.github/workflows/update-company-monthly-reports.yml'
]) requireText(path,`critical writer dependency missing: ${path}`);

// Publication boundary: Monthly Reports publishes only its three canonical outputs.
const addSet='git add reporting/company-monthly-reports.json reporting/accounting-notice-queue.json reporting/accounting-reference-reconciliation.json';
requireText(addSet,'generated monthly diagnostic add-set missing');
const outputAllowlist='reporting/company-monthly-reports.json|reporting/accounting-notice-queue.json|reporting/accounting-reference-reconciliation.json) ;;';
requireText(outputAllowlist,'generated output allowlist drift');
assert.equal(workflow.includes('git add reporting/company-monthly-reports.json reporting/accounting-coverage.json'),false,'Monthly Reports must not publish canonical Coverage');
assert.equal(workflow.includes('reporting/company-monthly-reports.json|reporting/accounting-coverage.json|'),false,'Monthly Reports allowlist must not include canonical Coverage');
requireText('Unexpected Company Monthly Reports publish delta after rebase','unexpected publish delta fail-closed guard missing');

// Definition proof only; accounting semantics remain independently exercised by Verify Company Monthly Reports.
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'gh workflow run', 'actions: write', 'write-all', 'COINGECKO_API_KEY']){
  assert.equal(workflow.includes(forbidden),false,`monthly writer authority expansion: ${forbidden}`);
}

console.log('Company Monthly Reports workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  proofScope:'workflow-definition-and-safe-writer-contract',
  canonicalUpstream:'Update The Holding Reporting Data',
  diagnosticDependencyOrder:['ephemeral-accounting-coverage','accounting-notice-queue','accounting-reference-reconciliation'],
  coverageEphemeralBeforeDiagnostics:true,
  canonicalPersistedCoverageOwner:'Update The Holding Reporting Data',
  duplicateCoverageWriterIntroduced:false,
  movingMainRebuild:true,
  criticalCodeRaceFailClosed:true,
  generatedOutputAllowlistBounded:true,
  deeperAccountingSemanticsVerifier:'Verify Company Monthly Reports',
  executionAuthority:'none',
  capitalExecution:false,
  walletAuthority:false
});
