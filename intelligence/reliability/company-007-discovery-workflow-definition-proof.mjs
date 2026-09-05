#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/discover-company-007.yml';
const PROOF_PATH='onboarding/company-007-yblp-current-state-proof.mjs';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const proof=fs.readFileSync(PROOF_PATH,'utf8');

// Workflow remains explicitly manual-only. This proof does not grant dispatch authority.
assert.match(workflow,/^on:\s*\n\s*workflow_dispatch:\s*$/m,'Company #007 discovery must remain workflow_dispatch-only');
assert.doesNotMatch(workflow,/\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:/,'Company #007 discovery trigger authority widened');

// Existing writer/concurrency boundary is preserved.
assert.match(workflow,/permissions:\s*\n\s*contents:\s*write/,'Company #007 discovery contents writer permission missing');
assert.doesNotMatch(workflow,/permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/,'Company #007 discovery permissions widened');
assert.match(workflow,/concurrency:\s*\n\s*group:\s*discover-company-007\s*\n\s*cancel-in-progress:\s*false/,'Company #007 discovery concurrency contract drift');
assert.match(workflow,/for attempt in 1 2 3/,'bounded writer retry contract missing');
assert.match(workflow,/git fetch origin main/,'fresh-main writer reconciliation missing');
assert.match(workflow,/git rebase origin\/main/,'safe writer rebase missing');
assert.match(workflow,/git push origin HEAD:main/,'canonical main writer target drift');

// New state proof must execute before discovery and both outputs must be validated/published together.
const proofStep=workflow.indexOf('node onboarding/company-007-yblp-current-state-proof.mjs');
const discoveryStep=workflow.indexOf('node onboarding/company-007-discovery.mjs');
assert.ok(proofStep>=0 && discoveryStep>proofStep,'YBLP current-state proof must run before Company #007 discovery');
assert.match(workflow,/companies\/company-007-yblp-current-state\.json/,'YBLP current-state evidence artifact missing');
assert.match(workflow,/unknownIsNotZero/,'UNKNOWN != 0 validation missing');
assert.match(workflow,/historyMustBePreserved/,'historical preservation boundary missing');
assert.match(workflow,/proofActive/,'independent proof/discovery active-set reconciliation missing');
assert.match(workflow,/verified-zero YBLP BTC still appears as productive inventory/,'verified-zero BTC inventory guard missing');
assert.match(workflow,/verified-zero YBLP ETH still appears as productive inventory/,'verified-zero ETH inventory guard missing');
assert.match(workflow,/git add -f "\$FILE" "\$PROOF"/,'discovery and proof must use one existing publish transaction');

// Proof implementation is observation-only and fails rather than fabricating zero on incomplete quorum.
assert.match(proof,/const REQUIRED_QUORUM=.*\|\|2/,'two-provider quorum default missing');
assert.match(proof,/currentState:active\.length\?'active':'verified-zero'/,'explicit verified-zero state missing');
assert.match(proof,/YBLP current-state quorum not reached/,'source failure must fail closed');
assert.match(proof,/unknownIsNotZero:true/,'proof UNKNOWN != 0 semantic missing');
assert.match(proof,/historyMustBePreserved:true/,'proof history preservation semantic missing');
assert.match(proof,/referenceAprUsed:false/,'reference APR must remain non-authoritative');
assert.match(proof,/executionAuthority:'none'/,'execution authority expanded');
assert.match(proof,/walletAuthority:'none'/,'wallet authority expanded');
assert.match(proof,/claimingAuthority:'none'/,'claim authority expanded');
assert.match(proof,/capitalExecution:false/,'capital authority expanded');
assert.doesNotMatch(proof,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(/,'current-state proof contains transaction-capable behavior');

console.log('Company #007 discovery workflow definition proof PASS');
