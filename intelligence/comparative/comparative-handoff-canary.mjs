#!/usr/bin/env node
import fs from 'node:fs';

const workflow = fs.readFileSync('.github/workflows/update-comparative-intelligence.yml', 'utf8');

const required = [
  'workflow_run:',
  '"The Holding Capital · Unified Refresh"',
  '"The Holding · Income & Performance Intelligence"',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.head_branch == 'main'",
];

for (const phrase of required) {
  if (!workflow.includes(phrase)) throw new Error(`Comparative handoff contract missing: ${phrase}`);
}

if (!/workflow_run:\s*\n\s*workflows:\s*\n[\s\S]*?types:\s*\[completed\]/m.test(workflow)) {
  throw new Error('Comparative workflow_run must remain completed-event bounded');
}

console.log('COMPARATIVE HANDOFF CANARY PASS', {
  upstreams: ['Unified Capital', 'Income & Performance'],
  requiresSuccess: true,
  requiresMain: true,
  executionAuthority: 'none',
});
