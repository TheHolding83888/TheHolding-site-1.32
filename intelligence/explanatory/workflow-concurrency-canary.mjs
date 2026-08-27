#!/usr/bin/env node
import fs from 'node:fs';

const explanatoryFile = '.github/workflows/update-explanatory-context.yml';
const recoveryFile = '.github/workflows/resume-economic-graph-after-code-change.yml';
const workflow = fs.readFileSync(explanatoryFile, 'utf8');
const recovery = fs.readFileSync(recoveryFile, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const required of [
  "github.event_name == 'pull_request'",
  "format('the-holding-explanatory-context-pr-{0}', github.event.pull_request.number)",
  "'the-holding-explanatory-context-production'",
  "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  'workflow_dispatch:',
  'workflow_run:',
  'pull_request:',
  'push:',
  'contents: write'
]) {
  assert(workflow.includes(required), `Explanatory concurrency contract missing: ${required}`);
}

assert(!workflow.includes('group: the-holding-explanatory-context\n'), 'legacy shared Explanatory concurrency lane still present');
assert(!workflow.includes('cancel-in-progress: false'), 'Explanatory PR supersession must not remain globally disabled');
assert(!workflow.includes('cancel-in-progress: true'), 'Explanatory production work must never be globally cancellable');

assert(!workflow.includes('      - "intelligence/explanatory/explanatory-context.mjs"'), 'premature Explanatory source-code push trigger reintroduced');
assert(!workflow.includes('      - "intelligence/explanatory/vlcvx-votium-curve-shadow-context.mjs"'), 'premature Explanatory extension source push trigger reintroduced');
assert(workflow.includes('      - "intelligence/economic-graph/economic-graph.json"'), 'materialized Graph push wake source missing');

for (const required of [
  "- 'intelligence/economic-graph/*.mjs'",
  "- 'intelligence/explanatory/*.mjs'",
  'Rebuild canonical Economic Graph first',
  'Prove physical eight-protocol Graph and Frax ecosystem',
  'Rebuild Explanatory only after Graph materialization',
  'Prove exact Graph to Explanatory Frax handoff',
  'Refresh Observer and System Memory before cognition',
  'Prove dependency-scoped Observer and System Memory contract',
  'Refresh canonical Cognitive Stack from proven Explanatory and Observer',
  'Prove Brain consumed Frax deep context',
  'Refresh Project Memory after downstream success',
  "group: economic-graph-code-change-resume",
  'cancel-in-progress: false'
]) {
  assert(recovery.includes(required), `Ordered recovery contract missing: ${required}`);
}

assert(recovery.includes('--scope economic-graph-recovery'), 'Scoped recovery freshness proof missing');
assert(recovery.includes('--max-observer-age-hours 1'), 'Bounded Observer age proof missing');

const graphPos = recovery.indexOf('Rebuild canonical Economic Graph first');
const graphProofPos = recovery.indexOf('Prove physical eight-protocol Graph and Frax ecosystem');
const explanatoryPos = recovery.indexOf('Rebuild Explanatory only after Graph materialization');
const explanatoryProofPos = recovery.indexOf('Prove exact Graph to Explanatory Frax handoff');
const observerPos = recovery.indexOf('Refresh Observer and System Memory before cognition');
const observerProofPos = recovery.indexOf('Prove dependency-scoped Observer and System Memory contract');
const cognitivePos = recovery.indexOf('Refresh canonical Cognitive Stack from proven Explanatory and Observer');
const memoryPos = recovery.indexOf('Refresh Project Memory after downstream success');
assert(graphPos < graphProofPos && graphProofPos < explanatoryPos && explanatoryPos < explanatoryProofPos && explanatoryProofPos < observerPos && observerPos < observerProofPos && observerProofPos < cognitivePos && cognitivePos < memoryPos, 'Graph→Explanatory→Observer→Brain→Memory recovery order drift');

console.log('EXPLANATORY CONCURRENCY + DEPENDENCY-SCOPED RECOVERY CANARY PASS', {
  prLane: 'per-pr-number',
  prSupersession: true,
  productionLane: 'serialized',
  productionCancellation: false,
  sourceCodeRaceBlocked: true,
  graphModuleCoverage: 'globbed',
  scopedObserverFreshnessGate: true,
  graphRecoveryDependencies: ['productivity', 'rewards'],
  recoveryOrder: 'Graph→Explanatory→Observer→Brain→Memory'
});
