#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const workflow = fs.readFileSync('.github/workflows/update-explanatory-context.yml', 'utf8');
for (const phrase of [
  'workflow_run:',
  '"The Holding · Economic Graph"',
  '"The Holding · Comparative Intelligence"',
  'types: [completed]',
  "github.event.workflow_run.conclusion == 'success'",
  "github.event.workflow_run.head_branch == 'main'",
]) {
  if (!workflow.includes(phrase)) throw new Error(`Explanatory handoff contract missing: ${phrase}`);
}

const comparativePath = 'intelligence/comparative/comparative-intelligence.json';
const incomePath = 'intelligence/income-performance/income-performance.json';
const comparative = JSON.parse(fs.readFileSync(comparativePath, 'utf8'));
const incomeBytes = fs.readFileSync(incomePath);
const incomeSha = crypto.createHash('sha256').update(incomeBytes).digest('hex');
if (comparative?.sourceState?.incomePerformance?.sha256 !== incomeSha) {
  throw new Error('Comparative/Income exact-byte coherence missing');
}

console.log('EXPLANATORY HANDOFF CANARY PASS', {
  upstreams: ['Economic Graph', 'Comparative Intelligence'],
  comparativeIncomeExactByteBound: true,
  requiresSuccess: true,
  requiresMain: true,
  executionAuthority: 'none',
});
