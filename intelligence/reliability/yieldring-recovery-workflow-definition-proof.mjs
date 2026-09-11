#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/project-yieldring-capital-state.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const unified = fs.readFileSync('.github/workflows/unified-capital-refresh.yml', 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/yieldring-recovery-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:\s*$/m, 'YieldRing diagnostic must remain workflow_dispatch-only');
assert.doesNotMatch(workflow, /\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:|\bpush\s*:/, 'YieldRing diagnostic trigger authority widened');

// ONE ARTIFACT -> ONE CANONICAL WRITER: the legacy YieldRing recovery path may
// still prove the projection ephemerally, but production publication belongs
// only to Unified Capital.
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/, 'YieldRing diagnostic must be repository read-only');
assert.doesNotMatch(workflow, /contents:\s*write|permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/, 'YieldRing diagnostic regained repository/workflow write authority');
assert.doesNotMatch(workflow, /git\s+(?:add|commit|push)\b/, 'YieldRing diagnostic regained repository publication behavior');
assert.doesNotMatch(workflow, /git push origin HEAD:main/, 'YieldRing diagnostic regained canonical-main writer authority');
assert.match(workflow, /Verify diagnostic replay without repository publication/, 'read-only diagnostic terminal verification missing');
assert.match(workflow, /repositoryMutation:false/, 'explicit no-repository-mutation diagnostic missing');

assert.match(unified, /^name: "The Holding Capital · Unified Refresh"$/m, 'canonical Unified Capital writer missing');
assert.match(unified, /^\s*workflow_dispatch:\s*$/m, 'canonical Unified Capital writer lost manual dispatch');
assert.match(unified, /permissions:\s*\n\s*contents:\s*write/, 'canonical Unified Capital publication authority missing');
const publishBlock = unified.slice(unified.indexOf('- name: Publish one coherent capital snapshot safely'));
assert.ok(publishBlock.length > 0, 'canonical Unified Capital publish block missing');
for (const surface of [
  'companies/index.html',
  'yieldring/index.html',
  'intelligence/capital-state/general-company-balance-sheet.mjs'
]) {
  assert.ok(publishBlock.includes(surface), `canonical Unified Capital writer does not own expected YieldRing surface: ${surface}`);
}

assert.match(workflow, /concurrency:\s*\n\s*group:\s*yieldring-capital-projection-main\s*\n\s*cancel-in-progress:\s*false/, 'YieldRing diagnostic concurrency contract drift');
assert.match(workflow, /node --check companies\/yieldring-public-capital-projection\.mjs/, 'YieldRing projector syntax preflight missing');
assert.match(workflow, /node companies\/yieldring-public-capital-projection\.mjs/, 'YieldRing diagnostic replay missing');
assert.match(workflow, /qty: 0\.0334/, 'YieldRing BTC projection guard missing');
assert.match(workflow, /qty: 678/, 'YieldRing AERO projection guard missing');
assert.match(workflow, /managerId: '10298'/, 'YieldRing manager projection guard missing');
assert.match(workflow, /2 locks · Maxi relay/, 'YieldRing lock projection guard missing');
assert.match(workflow, /s\.authority\?\.executionAuthority!=='none'/, 'YieldRing execution authority runtime guard missing');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/, 'YieldRing workflow contains wallet/capital transaction behavior');

console.log('YieldRing read-only diagnostic workflow definition proof PASS', {
  canonicalWriter: 'The Holding Capital · Unified Refresh',
  legacyRepositoryMutation: false,
  manualCanonicalRecoveryAvailable: true,
  diagnosticReplayPreserved: true,
  executionAuthority: 'none'
});
