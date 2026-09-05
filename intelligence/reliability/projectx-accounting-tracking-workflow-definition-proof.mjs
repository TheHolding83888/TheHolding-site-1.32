#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/verify-projectx-accounting-tracking.yml';
const ENGINE_PATH='reporting/accounting-coverage.mjs';
const VALIDATION_PATH='reporting/projectx-tracking-proof-validation.mjs';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const engine=fs.readFileSync(ENGINE_PATH,'utf8');
const validation=fs.readFileSync(VALIDATION_PATH,'utf8');

assert.match(workflow,/holding-workflow-definition-proof: intelligence\/reliability\/projectx-accounting-tracking-workflow-definition-proof\.mjs/,'workflow definition proof binding missing');
assert.match(workflow,/\bpull_request\s*:/,'Project X accounting verification must run on PR candidates');
assert.match(workflow,/\bworkflow_dispatch\s*:/,'manual verification escape hatch missing');
assert.doesNotMatch(workflow,/\bschedule\s*:|\bpush\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:/,'Project X verification trigger authority widened');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/,'Project X verification must remain read-only');
assert.doesNotMatch(workflow,/contents:\s*write|actions:\s*write|pull-requests:\s*write|permissions:\s*write-all/,'Project X verification permissions widened');
assert.doesNotMatch(workflow,/secrets\./,'Project X verification unexpectedly depends on repository secrets');
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE:\s*\/tmp\/projectx-accounting-coverage\.json/,'verification must write only a temporary derived registry');
assert.doesNotMatch(workflow,/git\s+(add|commit|push)|update-ref|create-pull-request/,'verification workflow gained repository write behavior');
assert.match(workflow,/node reporting\/projectx-tracking-proof-validation\.mjs/,'Project X deterministic validator is not executed');
assert.match(workflow,/node reporting\/accounting-coverage\.mjs/,'production Accounting Coverage builder is not executed');
assert.match(workflow,/node intelligence\/reliability\/projectx-accounting-tracking-workflow-definition-proof\.mjs/,'workflow does not self-check its authority contract');

const start=engine.indexOf('export function projectXWhypeUsdcObservationProofs');
const end=engine.indexOf('\nfunction strongVlCvxRouteProofs',start);
assert.ok(start>=0&&end>start,'Project X factual tracking proof implementation missing');
const proof=engine.slice(start,end);
assert.match(proof,/engineId='projectx-whype-usdc'/,'Project X engine identity drift');
assert.match(proof,/sourceFile:'companies\/company-010-production-state\.json#strategies\.projectX'/,'Project X canonical proof source missing');
assert.match(proof,/measurementStatus!=='measured'/,'Project X claimable measurement guard missing');
assert.match(proof,/claimableFeesExcludedFromCapital!==true/,'Project X capital/income separation guard missing');
assert.match(proof,/referenceAprIsNotRealisedIncome!==true/,'Project X reference APR boundary missing');
assert.match(proof,/executionAuthority!=='none'/,'Project X execution authority boundary missing');
assert.doesNotMatch(proof,/referenceAprPct|feeDeltaUsd|windowHours/,'reference analytics leaked into factual tracking qualification');
assert.doesNotMatch(proof,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(/,'Project X tracking proof contains transaction-capable behavior');

assert.match(validation,/referenceDrift\.strategies\.projectX\.yield\.referenceAprPct=999999/,'reference-authority negative control missing');
assert.match(validation,/knownZero/,'known-zero Project X control missing');
assert.match(validation,/periodIncomeAuthority:false/,'period income authority boundary missing from validator');
assert.match(validation,/executionAuthority:'none'/,'execution authority boundary missing from validator');

console.log('Project X accounting tracking workflow definition proof PASS');
