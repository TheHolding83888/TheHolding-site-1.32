#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW='.github/workflows/verify-settlement-accounting-links.yml';
const ACCOUNTING='reporting/accounting-coverage.mjs';
const VALIDATOR='reporting/settlement-link-validation.mjs';

for(const file of[WORKFLOW,ACCOUNTING,VALIDATOR])assert.ok(fs.existsSync(file),`missing ${file}`);
const workflow=fs.readFileSync(WORKFLOW,'utf8');
const accounting=fs.readFileSync(ACCOUNTING,'utf8');
const validator=fs.readFileSync(VALIDATOR,'utf8');

assert.ok(workflow.includes('# holding-workflow-definition-proof: intelligence/reliability/settlement-accounting-links-workflow-definition-proof.mjs'));
assert.match(workflow,/pull_request:/);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/\n\s*push:/);
assert.doesNotMatch(workflow,/\n\s*schedule:/);
assert.doesNotMatch(workflow,/\n\s*workflow_run:/);
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
assert.doesNotMatch(workflow,/contents:\s*write/);
assert.doesNotMatch(workflow,/secrets\./);
assert.match(workflow,/node reporting\/settlement-link-validation\.mjs/);
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE:\s*\/tmp\/settlement-accounting-coverage\.json/);
assert.match(workflow,/node reporting\/accounting-coverage\.mjs/);
assert.match(workflow,/node reporting\/accounting-coverage-validation\.mjs/);

assert.match(accounting,/export function explicitSettlementMechanismLinks\(events=\[\],mechanismRows=\[\]\)/);
assert.match(accounting,/forty-acres-velodrome-received/);
assert.match(accounting,/engineId:'velodrome_vevelo'/);
assert.match(accounting,/settlementLinkDoesNotChangeIncomeFamily:true/);
assert.match(accounting,/settlementLinkIsNotPeriodIncomeAuthority:true/);
assert.match(accounting,/settlementLinksAreDiagnosticOnly:true/);
assert.match(accounting,/canonicalLedgerIsSoleFactualIncomeAuthority:true/);
assert.match(accounting,/referenceMetricIsNotEarnedIncome:true/);
assert.match(accounting,/unknownIsNotZero:true/);
assert.match(accounting,/executionAuthority:'none'/);

assert.match(validator,/realised settlement leaked into accrued factual-period evidence/);
assert.match(validator,/settlement link became factual tracking authority/);
assert.match(validator,/wrong source file/);
assert.match(validator,/physical\/source mismatch/);
assert.match(validator,/settlement linked without the exact active velodrome_vevelo mechanism/);

console.log('Settlement accounting links workflow definition proof PASS',{
  triggerScope:'pull_request+manual-only',
  contentsPermission:'read',
  secretUse:false,
  crossFamilyIncomeAuthority:false,
  executionAuthority:'none'
});
