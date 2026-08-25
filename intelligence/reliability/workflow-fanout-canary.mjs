#!/usr/bin/env node
import { parsePullRequestTrigger, wakesForChangedFiles, auditFanout } from './workflow-fanout-audit.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const own = '.github/workflows/domain.yml';
const domain = 'src/domain.mjs';

const literal = parsePullRequestTrigger(`name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - '.github/workflows/domain.yml'\njobs: {}`);
assert(literal.enabled, 'literal pull_request trigger missing');
assert(wakesForChangedFiles(literal, [own]), 'own workflow path must wake literal self trigger');
assert(wakesForChangedFiles(literal, [domain]), 'domain path must wake domain trigger');
assert(!wakesForChangedFiles(literal, ['README.md']), 'unrelated file woke bounded trigger');

const domainOnly = parsePullRequestTrigger(`name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\njobs: {}`);
assert(!wakesForChangedFiles(domainOnly, [own]), 'domain-only trigger woke on workflow definition');
assert(wakesForChangedFiles(domainOnly, [domain]), 'domain-only trigger missed domain source');

const broad = parsePullRequestTrigger(`name: Broad\non:\n  pull_request:\n    paths:\n      - '.github/workflows/**'\njobs: {}`);
assert(wakesForChangedFiles(broad, [own]), 'broad workflow path did not match');

const unbounded = parsePullRequestTrigger(`name: Unbounded\non:\n  pull_request:\njobs: {}`);
assert(unbounded.unbounded, 'unbounded pull_request not classified');
assert(wakesForChangedFiles(unbounded, ['anything.txt']), 'unbounded PR did not wake');

const ignored = parsePullRequestTrigger(`name: Ignore\non:\n  pull_request:\n    paths-ignore:\n      - '.github/workflows/**'\njobs: {}`);
assert(!wakesForChangedFiles(ignored, [own]), 'paths-ignore failed to suppress workflow-only change');
assert(wakesForChangedFiles(ignored, [domain]), 'paths-ignore suppressed relevant domain change');

const negative = parsePullRequestTrigger(`name: Negative\non:\n  pull_request:\n    paths:\n      - '**'\n      - '!.github/workflows/**'\njobs: {}`);
assert(!wakesForChangedFiles(negative, [own]), 'ordered negative path failed');
assert(wakesForChangedFiles(negative, [domain]), 'ordered negative path suppressed domain source');

const policy = {
  version: 'canary',
  mode: 'observe',
  authority: { readOnly: true },
  epistemics: {},
  protectedWorkflowChangeChecks: ['global']
};
const report = auditFanout([
  { file: '.github/workflows/global.yml', text: `name: Global\non:\n  pull_request:\n    paths:\n      - '.github/workflows/**'\njobs: {}` },
  { file: '.github/workflows/domain.yml', text: `name: Domain\non:\n  pull_request:\n    paths:\n      - 'src/**'\n      - '.github/workflows/domain.yml'\njobs: {}` },
  { file: '.github/workflows/domain-clean.yml', text: `name: Clean\non:\n  pull_request:\n    paths:\n      - 'src/**'\njobs: {}` }
], policy);
assert(report.summary.workflowCount === 3, 'canary workflow count mismatch');
assert(report.summary.workflowFleetWakeCount === 2, 'canary fleet wake count mismatch');
assert(report.summary.protectedWorkflowFleetWakeCount === 1, 'canary protected count mismatch');
assert(report.summary.reductionCandidateWorkflowFleetWakeCount === 1, 'canary reduction candidate count mismatch');

console.log('WORKFLOW FAN-OUT CANARY PASS', report.summary);
