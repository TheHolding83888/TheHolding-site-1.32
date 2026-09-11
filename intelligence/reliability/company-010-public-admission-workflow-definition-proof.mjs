#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/admit-company-010-public.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const admission = fs.readFileSync('onboarding/company-010-public-admission.mjs', 'utf8');
const unified = fs.readFileSync('.github/workflows/unified-capital-refresh.yml', 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/company-010-public-admission-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /^\s*workflow_dispatch:\s*$/m, 'Cypher admission diagnostic lost manual replay');
assert.match(workflow, /^\s*push:\s*$/m, 'Cypher admission source-change diagnostic trigger missing');
assert.match(workflow, /companies\/company-010-public-adapter\.js/, 'Cypher public adapter source trigger missing');
assert.match(workflow, /onboarding\/company-010-public-admission\.mjs/, 'Cypher admission validator source trigger missing');
assert.doesNotMatch(workflow, /\bpull_request\s*:|\bschedule\s*:|\bworkflow_run\s*:|\brepository_dispatch\s*:/, 'Cypher admission diagnostic trigger authority widened');

// ONE ARTIFACT -> ONE CANONICAL WRITER: this legacy admission path is now a
// parity proof only. It may build a temporary preview but it cannot publish the
// canonical Companies surface independently of Unified Capital / reviewed code.
assert.match(workflow, /permissions:\s*\n\s*contents:\s*read/, 'Cypher admission diagnostic must be repository read-only');
assert.doesNotMatch(workflow, /contents:\s*write|permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/, 'Cypher admission diagnostic regained repository/workflow write authority');
assert.doesNotMatch(workflow, /git\s+(?:add|commit|push|rebase)\b/, 'Cypher admission diagnostic regained repository publication behavior');
assert.doesNotMatch(workflow, /company-010-public-admission\.mjs\s+--write/, 'Cypher admission workflow regained direct canonical-page mutation');
assert.match(workflow, /cmp -s companies\/index\.html \.tmp-company-010-public-admission\.html/, 'canonical/current admission parity comparison missing');
assert.match(workflow, /refusing implicit publication/, 'fail-closed admission parity boundary missing');
assert.match(workflow, /repositoryMutation=false/, 'explicit no-repository-mutation diagnostic missing');

// The historical anchor-rewrite utility itself is retired as a writer. It now
// validates the already-admitted current surface and writes only a disposable
// workspace preview so existing PR verification can keep its deep UI checks.
assert.match(admission, /if\(process\.argv\.includes\('--write'\)\)/, 'retired --write guard missing');
assert.match(admission, /public admission writer is retired/, 'retired writer error boundary missing');
assert.match(admission, /mode:'read-only-validator'/, 'read-only validator semantics missing');
assert.match(admission, /repositoryMutation:false/, 'validator repository-mutation diagnostic missing');
assert.match(admission, /fs\.writeFileSync\(previewPath,html\)/, 'disposable preview materialization missing');
assert.doesNotMatch(admission, /fs\.writeFileSync\(pagePath/, 'historical admission utility regained canonical-page mutation');
assert.doesNotMatch(admission, /replaceOnce|replaceRequired/, 'stale anchor-rewrite machinery returned');

assert.match(unified, /^name: "The Holding Capital · Unified Refresh"$/m, 'canonical Unified Capital writer missing');
assert.match(unified, /^\s*workflow_dispatch:\s*$/m, 'canonical Unified Capital writer lost manual dispatch');
assert.match(unified, /permissions:\s*\n\s*contents:\s*write/, 'canonical Unified Capital publication authority missing');
const publishBlock = unified.slice(unified.indexOf('- name: Publish one coherent capital snapshot safely'));
assert.ok(publishBlock.length > 0, 'canonical Unified Capital publish block missing');
assert.ok(publishBlock.includes('companies/index.html'), 'canonical Unified Capital writer no longer owns Companies surface');

assert.match(workflow, /concurrency:\s*\n\s*group:\s*company-010-public-admission\s*\n\s*cancel-in-progress:\s*false/, 'Cypher admission concurrency contract drift');
assert.match(workflow, /d\.company\?\.registry!=='010'\|\|d\.company\?\.name!=='Cypher'/, 'Cypher canonical identity guard missing');
assert.match(workflow, /d\.capital\?\.totalCapitalComplete!==true/, 'Cypher complete-capital guard missing');
assert.match(workflow, /knownButUnboundCapitalMayExist!==false/, 'Cypher unresolved-capital guard missing');
assert.match(workflow, /unknownIsNotZero!==true\|\|d\.epistemicBoundary\?\.partialTotalIsNotTotal!==true/, 'Cypher epistemic boundary guard missing');
assert.match(workflow, /d\.authority\?\.executionAuthority!=='none'\|\|d\.authority\?\.transactions!==false/, 'Cypher execution boundary guard missing');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/, 'Cypher admission workflow contains wallet/capital transaction behavior');
assert.doesNotMatch(admission, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/, 'Cypher admission validator contains wallet/capital transaction behavior');

console.log('Cypher public admission read-only workflow definition proof PASS', {
  canonicalWriter: 'The Holding Capital · Unified Refresh',
  legacyRepositoryMutation: false,
  historicalAnchorMutatorRetired: true,
  previewParityRequired: true,
  sourceChangeDiagnosticPreserved: true,
  executionAuthority: 'none'
});
