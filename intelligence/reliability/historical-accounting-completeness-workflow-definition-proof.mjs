#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-historical-accounting-completeness.yml';
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
assert.match(workflow,/^name: Update Historical Accounting Completeness Map$/m,'historical completeness writer identity drift');
requireText('# holding-workflow-definition-proof: intelligence/reliability/historical-accounting-completeness-workflow-definition-proof.mjs','paired definition proof marker missing');
requireText('# holding-control-plane: repository-writer','repository-writer control-plane role missing');
requireText('# holding-truth-plane: derived-accounting-diagnostics','derived truth-plane declaration missing');
requireText('# holding-control-domain: reporting-historical-accounting-completeness','bounded control-domain declaration missing');
requireText('permissions:\n  contents: write','historical completeness writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write|write-all/,'historical completeness writer gained broader Actions/repository authority');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'production derived-data writer must not execute on pull_request');
requireText('workflow_dispatch:','bounded manual recovery trigger missing');
requireText('workflows:\n      - "Update Company Monthly Reports"','canonical Monthly Reports handoff missing');
requireText("github.event.workflow_run.conclusion == 'success'",'Monthly Reports success gate missing');
requireText("github.event.workflow_run.head_branch == 'main'",'Monthly Reports main gate missing');
requireText('ref: main','production writer must consume canonical main');
requireText('group: historical-accounting-completeness-map','writer concurrency group drift');
requireText('cancel-in-progress: false','writer must remain non-cancellable');
requireText("- cron: '52 7 * * *'",'fallback heartbeat drift');
requireText('timeout-minutes: 5','bounded writer runtime missing');

// Only code/definition changes wake directly; factual data refresh arrives through the canonical Monthly Reports handoff.
for(const path of [
  "- 'reporting/historical-accounting-completeness-map.mjs'",
  "- 'reporting/historical-accounting-completeness-map-validation.mjs'",
  "- '.github/workflows/update-historical-accounting-completeness.yml'",
  "- '.github/workflows/verify-historical-accounting-completeness.yml'"
]) requireText(path,`historical completeness dependency wake missing: ${path}`);

// The writer is projection-only: it consumes canonical diagnostics and creates no factual income authority.
requireText('test -s reporting/accounting-coverage.json','Accounting Coverage dependency preflight missing');
requireText('test -s reporting/company-monthly-reports.json','Company Monthly Reports dependency preflight missing');
requireText('node reporting/historical-accounting-completeness-map.mjs','derived map build missing');
requireText('node reporting/historical-accounting-completeness-map-validation.mjs','derived map validation missing');
assert.equal(workflow.includes('node reporting/income-ledger.mjs'),false,'historical completeness writer must not create or mutate canonical income events');
assert.equal(workflow.includes('git add reporting/income-ledger.json'),false,'historical completeness writer must not publish Income Ledger');
assert.equal(workflow.includes('git add reporting/accounting-coverage.json'),false,'historical completeness writer must not publish Accounting Coverage');
assert.equal(workflow.includes('git add reporting/company-monthly-reports.json'),false,'historical completeness writer must not publish Monthly Reports');

// Publication must be one-file bounded and rebuild after every safe rebase.
const publish=section('- name: Commit canonical derived snapshot');
ordered(publish,[
  'git add reporting/historical-accounting-completeness-map.json',
  'git commit -m "data: update historical accounting completeness map"',
  'for attempt in 1 2 3; do',
  'git fetch origin main',
  'git rebase origin/main',
  'ACCOUNTING_COVERAGE_FILE=./reporting/accounting-coverage.json',
  'node reporting/historical-accounting-completeness-map.mjs',
  'node reporting/historical-accounting-completeness-map-validation.mjs',
  'git add reporting/historical-accounting-completeness-map.json',
  'git commit --amend --no-edit',
  'git diff --name-only origin/main...HEAD',
  'git push origin HEAD:main'
],'historical completeness safe-writer order drift');
requireText('reporting/historical-accounting-completeness-map.json) ;;','single-output allowlist missing');
requireText('Unexpected historical completeness publish delta after rebase','unexpected publish delta fail-closed guard missing');
requireText('Safe writer guard: rebase conflict; refusing to guess.','rebase conflict fail-closed guard missing');
requireText('Safe writer guard: main moved during push; rebuilding on rebased current state','moving-main retry guard missing');
requireText('Safe writer guard: push failed after 3 attempts.','bounded publish retry guard missing');

// This proof guards workflow semantics only; it must not grant execution/capital/wallet authority.
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
]) assert.equal(workflow.includes(forbidden),false,`historical completeness workflow authority expansion: ${forbidden}`);

console.log('Historical Accounting Completeness workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  proofScope:'workflow-definition-and-derived-safe-writer-contract',
  canonicalUpstream:'Update Company Monthly Reports',
  controlPlaneRole:'repository-writer',
  truthPlane:'derived-accounting-diagnostics',
  controlDomain:'reporting-historical-accounting-completeness',
  factualIncomeAuthority:false,
  accountingCompletionAuthority:false,
  monthClosingAuthority:false,
  canonicalInputMutation:false,
  generatedOutputAllowlist:['reporting/historical-accounting-completeness-map.json'],
  movingMainRebuild:true,
  executionAuthority:'none',
  capitalExecution:false,
  walletAuthority:false
});
