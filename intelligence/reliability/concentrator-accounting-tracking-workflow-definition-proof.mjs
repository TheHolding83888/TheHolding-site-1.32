#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW='.github/workflows/verify-concentrator-accounting-tracking.yml';
const ACCOUNTING='reporting/accounting-coverage.mjs';
const VALIDATOR='reporting/concentrator-tracking-proof-validation.mjs';

for(const file of[WORKFLOW,ACCOUNTING,VALIDATOR])assert.ok(fs.existsSync(file),`missing ${file}`);
const workflow=fs.readFileSync(WORKFLOW,'utf8');
const accounting=fs.readFileSync(ACCOUNTING,'utf8');
const validator=fs.readFileSync(VALIDATOR,'utf8');

assert.ok(workflow.includes('# holding-workflow-definition-proof: intelligence/reliability/concentrator-accounting-tracking-workflow-definition-proof.mjs'));
assert.match(workflow,/pull_request:/);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/\n\s*push:/);
assert.doesNotMatch(workflow,/\n\s*schedule:/);
assert.doesNotMatch(workflow,/\n\s*workflow_run:/);
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/secrets\./);
assert.match(workflow,/node reporting\/concentrator-tracking-proof-validation\.mjs/);
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE:\s*\/tmp\/concentrator-accounting-coverage\.json/);
assert.match(workflow,/node reporting\/accounting-coverage\.mjs/);

assert.match(accounting,/export function concentratorAsdCrvObservationProofs\(state=\{\}\)/);
assert.match(accounting,/engineId='concentrator_asdcrv'/);
assert.match(accounting,/sourceFile:'companies\/company-010-production-state\.json#strategies\.crv\.concentrator-asdcrv'/);
assert.match(accounting,/referenceMetricIsNotEarnedIncome:true/);
assert.match(accounting,/unknownIsNotZero:true/);
assert.match(accounting,/executionAuthority:'none'/);

assert.match(validator,/Reference APR leaked into Concentrator factual tracking authority/);
assert.match(validator,/capital\/share mismatch failed open/);
assert.match(validator,/underlying parity mismatch failed open/);
assert.match(validator,/compounded\/claimable boundary failed open/);
assert.match(validator,/execution-capable Company state gained accounting tracking authority/);
assert.match(validator,/unknown Concentrator underlying was treated as measured zero/);

console.log('Concentrator accounting workflow definition proof PASS',{
  triggerScope:'pull_request+manual-only',
  contentsPermission:'read',
  secretUse:false,
  executionAuthority:'none'
});
