#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-accounting-coverage.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');

assert.match(workflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/accounting-coverage-workflow-definition-proof\.mjs/m,'paired proof declaration missing');
assert.match(workflow,/^name: Update Accounting Coverage Registry/m,'workflow identity drift');
assert.match(workflow,/permissions:\n  contents: write/,'coverage writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write|write-all/,'coverage writer gained broad Actions authority');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'production coverage writer must not execute on pull requests');
assert.match(workflow,/group:\s*accounting-coverage-registry/,'coverage writer concurrency drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'coverage writer must remain non-cancellable');
assert.match(workflow,/workflow_run:\n\s+workflows:\n\s+- "Update Company Monthly Reports"\n\s+types: \[completed\]/,'canonical monthly handoff missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/,'workflow_run success gate missing');
assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/,'workflow_run main gate missing');
assert.match(workflow,/ref: main/,'coverage writer must consume canonical main');
assert.match(workflow,/run: node reporting\/accounting-coverage\.mjs/,'coverage registry builder missing');
assert.match(workflow,/run: node reporting\/accounting-coverage-validation\.mjs/,'coverage registry validator missing');
assert.match(workflow,/git add reporting\/accounting-coverage\.json/,'generated coverage output missing');
assert.match(workflow,/git diff --name-only origin\/main\.\.\.HEAD/,'post-rebase delta guard missing');
assert.match(workflow,/\[ "\$\{ahead\[0\]\}" != "reporting\/accounting-coverage\.json" \]/,'coverage writer allowlist drift');
assert.match(workflow,/critical_fingerprint\(\)/,'critical fingerprint missing');
assert.match(workflow,/Critical accounting coverage code changed during publish rebase; fail closed/,'code-race fail-closed guard missing');
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE=\.\/reporting\/accounting-coverage\.json[\s\S]*node reporting\/accounting-coverage\.mjs/,'post-rebase canonical rebuild missing');
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE=\.\/reporting\/accounting-coverage\.json[\s\S]*node reporting\/accounting-coverage-validation\.mjs/,'post-rebase validation missing');

for(const forbidden of ['sendTransaction(', 'new Wallet(', 'workflow_dispatch(', 'gh workflow run', 'api.coingecko.com', 'COINGECKO_API_KEY']){
  assert.equal(workflow.includes(forbidden),false,`coverage writer authority expansion: ${forbidden}`);
}

console.log('Accounting Coverage workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  canonicalUpstream:'Update Company Monthly Reports',
  generatedOutput:'reporting/accounting-coverage.json',
  diagnosticOnly:true,
  monthClosingAuthority:false,
  executionAuthority:'none',
  walletAuthority:false,
  capitalExecution:false
});
