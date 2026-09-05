#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW='.github/workflows/verify-gmx-accounting-tracking.yml';
const ACCOUNTING='reporting/accounting-coverage.mjs';
const VALIDATOR='reporting/gmx-tracking-proof-validation.mjs';

for(const file of[WORKFLOW,ACCOUNTING,VALIDATOR])assert.ok(fs.existsSync(file),`missing ${file}`);
const workflow=fs.readFileSync(WORKFLOW,'utf8');
const accounting=fs.readFileSync(ACCOUNTING,'utf8');
const validator=fs.readFileSync(VALIDATOR,'utf8');

assert.ok(workflow.includes('# holding-workflow-definition-proof: intelligence/reliability/gmx-accounting-tracking-workflow-definition-proof.mjs'));
assert.match(workflow,/pull_request:/);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/\n\s*push:/);
assert.doesNotMatch(workflow,/\n\s*schedule:/);
assert.doesNotMatch(workflow,/\n\s*workflow_run:/);
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/secrets\./);
assert.match(workflow,/node reporting\/gmx-tracking-proof-validation\.mjs/);
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE:\s*\/tmp\/gmx-accounting-coverage\.json/);
assert.match(workflow,/node reporting\/accounting-coverage\.mjs/);
assert.match(workflow,/node reporting\/accounting-coverage-validation\.mjs/);

assert.match(accounting,/export function gmxV2MarketObservationProofs\(state=\{\}\)/);
assert.match(accounting,/gmx-gm-btc-usdc/);
assert.match(accounting,/gmx-gm-eth-usdc/);
assert.match(accounting,/sourceFile:'companies\/company-010-production-state\.json#strategies\.gmx'/);
assert.match(accounting,/referenceMetricIsNotEarnedIncome:true/);
assert.match(accounting,/unknownIsNotZero:true/);
assert.match(accounting,/executionAuthority:'none'/);

assert.match(validator,/Reference APY leaked into GMX factual tracking authority/);
assert.match(validator,/additive GMX underlying exposure failed open/);
assert.match(validator,/GMX embedded income became a separate claimable route/);
assert.match(validator,/execution-capable Company state gained GMX accounting tracking authority/);
assert.match(validator,/unknown GMX ETH balance was treated as measured zero\/current state/);

console.log('GMX accounting workflow definition proof PASS',{
  triggerScope:'pull_request+manual-only',
  contentsPermission:'read',
  secretUse:false,
  periodIncomeAuthority:false,
  executionAuthority:'none'
});
