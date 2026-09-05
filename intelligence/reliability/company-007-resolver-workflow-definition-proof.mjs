#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/resolve-company-007.yml';
const RESOLVER_PATH='onboarding/company-007-resolve.mjs';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const resolver=fs.readFileSync(RESOLVER_PATH,'utf8');

assert.match(workflow,/^on:\s*\n\s*workflow_dispatch:\s*$/m,'Company #007 resolver must remain workflow_dispatch-only');
assert.doesNotMatch(workflow,/\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:/,'Company #007 resolver trigger authority widened');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*write/,'resolver writer permission missing');
assert.doesNotMatch(workflow,/permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/,'resolver permissions widened');
assert.match(workflow,/concurrency:\s*\n\s*group:\s*resolve-company-007\s*\n\s*cancel-in-progress:\s*false/,'resolver concurrency contract drift');
assert.match(workflow,/cp "\$FILE" \/tmp\/company-007-resolve\.before-yb\.json/,'current tracked LKG preservation baseline missing');
assert.doesNotMatch(workflow,/BASELINE_COMMIT=/,'resolver must not restore a frozen historical commit');
assert.match(workflow,/companies\/company-007-yblp-current-state\.json/,'resolver must require canonical current-state proof');
assert.match(workflow,/1\.9-current-state-active-set/,'resolver workflow version guard drift');
assert.match(workflow,/for attempt in 1 2 3/,'bounded writer retry contract missing');
assert.match(workflow,/git fetch origin main/,'fresh-main writer reconciliation missing');
assert.match(workflow,/git rebase origin\/main/,'safe writer rebase missing');
assert.match(workflow,/git push origin HEAD:main/,'canonical main writer target drift');

assert.match(resolver,/CURRENT_STATE_VERSION = '0\.1-yblp-current-state-quorum'/,'resolver current-state contract missing');
assert.match(resolver,/activeMarketsFromCurrentState/,'resolver active-set derivation missing');
assert.match(resolver,/filter\(x => x\.currentState === 'active'\)/,'resolver does not filter to proven active mechanisms');
assert.match(resolver,/verifiedZeroMarkets/,'resolver verified-zero history boundary missing');
assert.match(resolver,/unknownIsNotZero: true/,'resolver UNKNOWN != 0 semantic missing');
assert.match(resolver,/currentInventoryDoesNotRewriteHistory: true/,'resolver history-preservation semantic missing');
assert.match(resolver,/currentStateProofIsIncomeAuthority: false/,'current-state proof gained income authority');
assert.match(resolver,/redemptionPpsUsedForApr: false/,'redemption PPS methodology boundary drift');
assert.match(resolver,/emissionsIncluded: false/,'emissions methodology boundary drift');
assert.doesNotMatch(resolver,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(/,'resolver contains transaction-capable behavior');

console.log('Company #007 resolver workflow definition proof PASS');
