#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/update-capital-state.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const unified = fs.readFileSync('.github/workflows/unified-capital-refresh.yml', 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/capital-state-recovery-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /^on:\s*\n\s*workflow_dispatch:\s*$/m, 'Capital State diagnostic must remain workflow_dispatch-only');
assert.doesNotMatch(workflow, /\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:|\bpush\s*:/, 'Capital State diagnostic trigger authority widened');

// ONE ARTIFACT -> ONE CANONICAL WRITER: this legacy entrypoint is a read-only
// diagnostic replay. The Unified Capital workflow owns production publication.
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/, 'Capital State diagnostic must be repository read-only');
assert.doesNotMatch(workflow, /contents:\s*write|permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/, 'Capital State diagnostic regained repository/workflow write authority');
assert.doesNotMatch(workflow, /git\s+(?:add|commit|push)\b/, 'Capital State diagnostic regained repository publication behavior');
assert.match(workflow, /repositoryMutation:false/, 'explicit no-repository-mutation diagnostic missing');
assert.match(workflow, /executionAuthority:'none'/, 'explicit execution authority boundary missing');

assert.match(unified, /^name: "The Holding Capital · Unified Refresh"$/m, 'canonical Unified Capital writer missing');
assert.match(unified, /^\s*workflow_dispatch:\s*$/m, 'canonical Unified Capital writer lost manual dispatch');
assert.match(unified, /permissions:\s*\n\s*contents:\s*write/, 'canonical Unified Capital publication authority missing');
const publishBlock = unified.slice(unified.indexOf('- name: Publish one coherent capital snapshot safely'));
assert.ok(publishBlock.length > 0, 'canonical Unified Capital publish block missing');
for (const surface of [
  'intelligence/capital-state/general-company-balance-sheet.json',
  'intelligence/capital-state/capital-state.json'
]) {
  assert.ok(publishBlock.includes(surface), `canonical Unified Capital writer does not own expected Capital State surface: ${surface}`);
}

assert.match(workflow, /concurrency:\s*\n\s*group:\s*capital-state\s*\n\s*cancel-in-progress:\s*false/, 'Capital State concurrency contract drift');
assert.match(workflow, /onchainSelectedAssetCount\)!==26/, '26\/26 canonical Market Data guard missing');
assert.match(workflow, /node intelligence\/capital-state\/general-company-balance-sheet\.mjs/, 'General Company Balance Sheet diagnostic replay missing');
assert.match(workflow, /node intelligence\/capital-state\/capital-state\.mjs/, 'Capital State diagnostic replay missing');
assert.match(workflow, /registryCompanyCount!==10/, 'Registry admission validation missing');
assert.match(workflow, /totalCapitalCoverage!==1/, 'complete capital coverage validation missing');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/, 'Capital State diagnostic contains wallet/capital transaction behavior');

console.log('Capital State read-only diagnostic workflow definition proof PASS', {
  canonicalWriter: 'The Holding Capital · Unified Refresh',
  legacyRepositoryMutation: false,
  manualCanonicalRecoveryAvailable: true,
  generalBalanceOwnedByUnifiedCapital: true,
  capitalStateOwnedByUnifiedCapital: true,
  executionAuthority: 'none'
});
