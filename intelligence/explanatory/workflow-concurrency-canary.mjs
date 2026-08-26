#!/usr/bin/env node
import fs from 'node:fs';

const file = '.github/workflows/update-explanatory-context.yml';
const workflow = fs.readFileSync(file, 'utf8');

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

console.log('EXPLANATORY CONCURRENCY PARTITION CANARY PASS', {
  prLane: 'per-pr-number',
  prSupersession: true,
  productionLane: 'serialized',
  productionCancellation: false
});
