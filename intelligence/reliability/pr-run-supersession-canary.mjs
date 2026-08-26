#!/usr/bin/env node
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync('intelligence/reliability/pr-run-supersession-policy.json','utf8'));
const workflow = fs.readFileSync('.github/workflows/pr-run-supersession-controller.yml','utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(policy.version === '0.1-pr-run-supersession-controller', 'policy version drift');
assert(policy.mode === 'cancel-superseded-pull-request-runs-only', 'policy mode drift');
assert(policy.scope?.allowedEvent === 'pull_request', 'controller event scope must remain pull_request-only for cancellations');
assert(policy.scope?.requiresSamePullRequestNumber === true, 'same PR gate missing');
assert(policy.scope?.requiresSameHeadBranch === true, 'same head branch gate missing');
assert(policy.scope?.requiresDifferentHeadSha === true, 'different head SHA gate missing');
assert(policy.scope?.forbidMainHeadBranch === true, 'main protection missing');
assert(policy.scope?.currentHeadNeverCancelled === true, 'current-head protection missing');
assert(policy.scope?.productionRunsNeverCancelled === true, 'production protection missing');
assert(policy.authority?.repositoryMutationAuthority === false, 'repository mutation authority expanded');
assert(policy.authority?.workflowDispatchAuthority === false, 'workflow dispatch authority expanded');
assert(policy.authority?.workflowCancellationAuthority === 'superseded-pull-request-runs-only', 'cancellation authority widened');
assert(policy.authority?.executionAuthority === 'none', 'execution authority expanded');

for (const required of [
  '# holding-control-plane: workflow-controller',
  '# holding-control-domain: pull-request-supersession-only',
  'actions: write',
  'contents: read',
  'pull-requests: read',
  'group: pr-run-supersession-${{ github.event.pull_request.number || inputs.pr_number }}',
  'cancel-in-progress: true',
  'event == "pull_request"',
  'head_sha != current_sha',
  'head_branch == head_ref',
  'head_branch != "main"',
  'pull_requests | any(.number == $pr)',
  '/cancel'
]) {
  assert(workflow.includes(required), `workflow safety contract missing: ${required}`);
}

for (const forbidden of [
  'contents: write',
  'git push',
  'git commit',
  'workflow_dispatch_authority',
  'pull_request_target:'
]) {
  assert(!workflow.includes(forbidden), `forbidden controller capability present: ${forbidden}`);
}

console.log('PR RUN SUPERSESSION CANARY PASS', {
  mode: policy.mode,
  cancellationAuthority: policy.authority.workflowCancellationAuthority,
  executionAuthority: policy.authority.executionAuthority
});
