#!/usr/bin/env node
import fs from 'node:fs';

const policy = JSON.parse(fs.readFileSync('intelligence/reliability/pr-run-supersession-policy.json','utf8'));
const workflow = fs.readFileSync('.github/workflows/pr-run-supersession-controller.yml','utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function classifyTarget({ state, sha, ref }) {
  if (state === 'closed') return 'noop';
  if (state !== 'open' || !sha || !ref || ref === 'main') return 'reject';
  return 'active';
}

assert(classifyTarget({ state: 'closed', sha: 'abc', ref: 'feature' }) === 'noop', 'closed PR must be a safe no-op');
assert(classifyTarget({ state: 'open', sha: 'abc', ref: 'feature' }) === 'active', 'valid open PR must remain active');
assert(classifyTarget({ state: 'unknown', sha: 'abc', ref: 'feature' }) === 'reject', 'unexpected state must fail closed');
assert(classifyTarget({ state: 'open', sha: '', ref: 'feature' }) === 'reject', 'missing SHA must fail closed');
assert(classifyTarget({ state: 'open', sha: 'abc', ref: 'main' }) === 'reject', 'main target must fail closed');

assert(policy.version === '0.4-pr-run-supersession-controller', 'policy version drift');
assert(policy.mode === 'cancel-superseded-pull-request-runs-only', 'policy mode drift');
assert(policy.trigger?.primaryEvent === 'workflow_run', 'controller must remain workflow_run-driven');
assert(Array.isArray(policy.trigger?.allowedUpstreamEvents), 'allowed upstream events missing');
assert(policy.trigger.allowedUpstreamEvents.includes('pull_request'), 'pull_request wake support missing');
assert(policy.trigger.allowedUpstreamEvents.includes('pull_request_target'), 'bootstrap pull_request_target wake support missing');
assert(policy.trigger?.bootstrapWakeSource === 'The Holding Production Deployment Smoke', 'bootstrap wake source drift');
assert(policy.trigger?.upstreamCompletionOnly === true, 'upstream completion gate missing');
assert(policy.trigger?.addsPullRequestFanout === false, 'controller may not add pull_request fanout');
assert(policy.trigger?.ignoreMainUpstreamBranch === true, 'main upstream workflow_run filter missing from policy');
assert(policy.scope?.cancellableRunEvent === 'pull_request', 'cancellation target must remain pull_request-only');
assert(policy.scope?.requiresSamePullRequestNumber === true, 'same PR gate missing');
assert(policy.scope?.requiresSameHeadBranch === true, 'same head branch gate missing');
assert(policy.scope?.requiresDifferentHeadSha === true, 'different head SHA gate missing');
assert(policy.scope?.requiresOpenPullRequest === true, 'open PR gate missing');
assert(policy.scope?.closedPullRequestWakeIsNoop === true, 'closed PR no-op law missing');
assert(policy.scope?.unknownOrMalformedTargetFailsClosed === true, 'malformed target fail-closed law missing');
assert(policy.scope?.forbidMainHeadBranch === true, 'main protection missing');
assert(policy.scope?.currentHeadNeverCancelled === true, 'current-head protection missing');
assert(policy.scope?.productionRunsNeverCancelled === true, 'production protection missing');
assert(policy.authority?.repositoryMutationAuthority === false, 'repository mutation authority expanded');
assert(policy.authority?.workflowDispatchAuthority === false, 'workflow dispatch authority expanded');
assert(policy.authority?.workflowCancellationAuthority === 'superseded-pull-request-runs-only', 'cancellation authority widened');
assert(policy.authority?.executionAuthority === 'none', 'execution authority expanded');

const workflowRunBlock = workflow.match(/\n  workflow_run:\n([\s\S]*?)\n  workflow_dispatch:/)?.[1] || '';
assert(/branches-ignore:\s*\n\s*-\s*main\s*(?:\n|$)/.test(workflowRunBlock), 'workflow_run must filter main before creating supersession runs');

for (const required of [
  '# holding-control-plane: workflow-controller',
  '# holding-control-domain: pull-request-supersession-only',
  '# holding-workflow-definition-proof: intelligence/reliability/pr-run-supersession-canary.mjs',
  'workflow_run:',
  'The Holding Reliability · Repository Hygiene Guard',
  'The Holding Security · Commit Identity Privacy Guard',
  'The Holding Security · Public Surface Privacy Guard',
  'The Holding Production Deployment Smoke',
  'types: [completed]',
  'branches-ignore:',
  '- main',
  'actions: write',
  'contents: read',
  'pull-requests: read',
  "github.event.workflow_run.event == 'pull_request'",
  "github.event.workflow_run.event == 'pull_request_target'",
  "github.event.workflow_run.head_branch != 'main'",
  'group: pr-run-supersession-${{',
  'cancel-in-progress: true',
  'ref: main',
  'PR_JSON="$(gh api "repos/$GITHUB_REPOSITORY/pulls/$PR_NUMBER")"',
  'if [ "$PR_STATE" = "closed" ]; then',
  'echo "active=false" >> "$GITHUB_OUTPUT"',
  'safe no-op; no workflow cancellation attempted',
  'echo "active=true" >> "$GITHUB_OUTPUT"',
  "if: steps.target.outputs.active == 'true'",
  'actions/runs?event=pull_request&per_page=100',
  '.event == "pull_request"',
  '.head_sha != $current_sha',
  '.head_branch == $head_ref',
  '.head_branch != "main"',
  '.pull_requests | any(.number == $pr)',
  '/cancel'
]) {
  assert(workflow.includes(required), `workflow safety contract missing: ${required}`);
}

for (const forbidden of [
  '\n  pull_request:\n',
  '\n  pull_request_target:\n',
  'actions/runs?event=pull_request_target',
  'contents: write',
  'git push',
  'git commit',
  'gh workflow run '
]) {
  assert(!workflow.includes(forbidden), `forbidden controller capability present: ${forbidden}`);
}

console.log('PR RUN SUPERSESSION CANARY PASS', {
  version: policy.version,
  trigger: policy.trigger.primaryEvent,
  upstreamEvents: policy.trigger.allowedUpstreamEvents,
  bootstrapWakeSource: policy.trigger.bootstrapWakeSource,
  mainUpstreamWake: 'filtered-at-trigger',
  closedPrWake: 'safe-noop',
  addsPullRequestFanout: policy.trigger.addsPullRequestFanout,
  cancellationAuthority: policy.authority.workflowCancellationAuthority,
  executionAuthority: policy.authority.executionAuthority
});
