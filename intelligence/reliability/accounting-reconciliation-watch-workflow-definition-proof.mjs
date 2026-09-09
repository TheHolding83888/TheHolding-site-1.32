#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-accounting-reconciliation-watch.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');

function requireText(text,message){assert.ok(workflow.includes(text),message);}
function ordered(text,needles,message){
  let last=-1;
  for(const needle of needles){
    const at=text.indexOf(needle,last+1);
    assert.ok(at>last,`${message}: ${needle}`);
    last=at;
  }
}

assert.match(workflow,/^name: Update Accounting Reconciliation Watch$/m,'reconciliation watch writer identity drift');
requireText('# holding-workflow-definition-proof: intelligence/reliability/accounting-reconciliation-watch-workflow-definition-proof.mjs','paired workflow proof marker missing');
requireText('# holding-control-plane: repository-writer','repository-writer control-plane role missing');
requireText('# holding-truth-plane: derived-accounting-diagnostics','derived truth-plane declaration missing');
requireText('# holding-control-domain: reporting-accounting-reconciliation-watch','bounded control-domain declaration missing');
requireText('permissions:\n  contents: write','reconciliation watch writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write|write-all/,'reconciliation watch writer gained broader Actions/repository authority');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'production reconciliation watch writer must not execute on pull_request');
requireText('workflow_dispatch:','bounded manual recovery trigger missing');
requireText('workflows:\n      - "Update Historical Accounting Completeness Map"','canonical completeness handoff missing');
requireText("github.event.workflow_run.conclusion == 'success'",'upstream success gate missing');
requireText("github.event.workflow_run.head_branch == 'main'",'upstream main gate missing');
requireText('ref: main','production writer must consume canonical main');
requireText('group: accounting-reconciliation-watch','writer concurrency group drift');
requireText('cancel-in-progress: false','writer must remain non-cancellable');
requireText("- cron: '2 8 * * *'",'fallback heartbeat drift');
requireText('timeout-minutes: 5','bounded writer runtime missing');

for(const input of [
  'test -s reporting/accounting-notice-queue.json',
  'test -s reporting/accounting-reference-reconciliation.json',
  'test -s reporting/historical-accounting-completeness-map.json'
]) requireText(input,`reconciliation watch canonical input preflight missing: ${input}`);
requireText('node reporting/accounting-reconciliation-watch.mjs','watch build missing');
requireText('node reporting/accounting-reconciliation-watch-validation.mjs','watch validation missing');

// Derived writer must never publish or mutate canonical accounting sources.
for(const forbiddenAdd of [
  'git add reporting/income-ledger.json',
  'git add reporting/accounting-coverage.json',
  'git add reporting/company-monthly-reports.json',
  'git add reporting/accounting-notice-queue.json',
  'git add reporting/accounting-reference-reconciliation.json',
  'git add reporting/historical-accounting-completeness-map.json'
]) assert.equal(workflow.includes(forbiddenAdd),false,`reconciliation watch canonical input mutation: ${forbiddenAdd}`);
assert.equal(workflow.includes('node reporting/income-ledger.mjs'),false,'watch must not create canonical income events');

ordered(workflow,[
  'git add reporting/accounting-reconciliation-watch.json',
  'git commit -m "data: update accounting reconciliation watch"',
  'for attempt in 1 2 3; do',
  'git fetch origin main',
  'git rebase origin/main',
  'ACCOUNTING_NOTICE_QUEUE_FILE=./reporting/accounting-notice-queue.json',
  'ACCOUNTING_RECONCILIATION_WATCH_PREVIOUS_FILE=./reporting/accounting-reconciliation-watch.json',
  'node reporting/accounting-reconciliation-watch.mjs',
  'node reporting/accounting-reconciliation-watch-validation.mjs',
  'git add reporting/accounting-reconciliation-watch.json',
  'git commit --amend --no-edit',
  'git diff --name-only origin/main...HEAD',
  'git push origin HEAD:main'
],'reconciliation watch safe-writer order drift');

requireText('reporting/accounting-reconciliation-watch.json) ;;','single-output allowlist missing');
requireText('Unexpected reconciliation watch publish delta after rebase','unexpected publish delta fail-closed guard missing');
requireText('Safe writer guard: rebase conflict; refusing to guess.','rebase conflict fail-closed guard missing');
requireText('Safe writer guard: main moved during push; rebuilding on rebased current state','moving-main retry guard missing');
requireText('Safe writer guard: push failed after 3 attempts.','bounded publish retry guard missing');

for(const forbidden of [
  'sendTransaction(',
  'writeContract(',
  'new Wallet(',
  'privateKey',
  'mnemonic',
  'COINGECKO_API_KEY',
  'gh workflow run',
  'actions: write',
  'write-all'
]) assert.equal(workflow.includes(forbidden),false,`reconciliation watch authority expansion: ${forbidden}`);

console.log('Accounting Reconciliation Watch workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  proofScope:'workflow-definition-and-derived-safe-writer-contract',
  canonicalUpstream:'Update Historical Accounting Completeness Map',
  controlPlaneRole:'repository-writer',
  truthPlane:'derived-accounting-diagnostics',
  controlDomain:'reporting-accounting-reconciliation-watch',
  factualIncomeAuthority:false,
  accountingCompletionAuthority:false,
  monthClosingAuthority:false,
  canonicalInputMutation:false,
  generatedOutputAllowlist:['reporting/accounting-reconciliation-watch.json'],
  movingMainRebuild:true,
  executionAuthority:'none',
  capitalExecution:false,
  walletAuthority:false
});
