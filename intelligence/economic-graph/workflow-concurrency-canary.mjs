#!/usr/bin/env node
import fs from 'node:fs';

const file = '.github/workflows/update-economic-graph.yml';
const workflow = fs.readFileSync(file, 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const required of [
  "github.event_name == 'pull_request'",
  "format('the-holding-economic-graph-pr-{0}', github.event.pull_request.number)",
  "'the-holding-economic-graph-production'",
  "cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  'workflow_dispatch:',
  'schedule:',
  'workflow_run:',
  'pull_request:',
  'push:',
  'contents: write'
]) {
  assert(workflow.includes(required), `Economic Graph concurrency contract missing: ${required}`);
}

assert(!workflow.includes('group: the-holding-economic-graph\n'), 'legacy shared Economic Graph concurrency lane still present');
assert(!workflow.includes('cancel-in-progress: false'), 'Economic Graph PR supersession must not remain globally disabled');
assert(!workflow.includes('cancel-in-progress: true'), 'Economic Graph production work must never be globally cancellable');

console.log('ECONOMIC GRAPH CONCURRENCY PARTITION CANARY PASS', {
  prLane: 'per-pr-number',
  prSupersession: true,
  productionLane: 'serialized',
  productionCancellation: false
});
