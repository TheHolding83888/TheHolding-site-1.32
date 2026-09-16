#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const WORKFLOW = '.github/workflows/update-stable-capital.yml';
const EXPECTED_CRON = '41 5 * * *';
const PREVIOUS_CRON = '37 5 * * *';
const BASE_SHA = process.env.BASE_SHA || '';
const HEAD_SHA = process.env.HEAD_SHA || '';

function fail(message) {
  throw new Error(`Stable Capital scheduler proof failed: ${message}`);
}

if (!BASE_SHA || !HEAD_SHA) fail('BASE_SHA/HEAD_SHA missing');

const text = fs.readFileSync(WORKFLOW, 'utf8');

if (!text.includes('# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs')) {
  fail('paired proof marker missing');
}
if (!text.includes('name: "Update Stable Capital"')) fail('workflow identity changed');
if (!text.includes('workflow_dispatch:')) fail('manual recovery trigger missing');
if (!text.includes(`cron: "${EXPECTED_CRON}"`)) fail('expected re-registered daily cron missing');
if (text.includes(`cron: "${PREVIOUS_CRON}"`)) fail('old cron still present');
if ((text.match(/\bcron:\s*/g) || []).length !== 1) fail('expected exactly one cron schedule');
if (!text.includes('contents: write')) fail('canonical writer permission missing');
if (!text.includes('group: update-stable-capital')) fail('canonical concurrency group changed');
if (!text.includes('cancel-in-progress: false')) fail('concurrency semantics changed');

for (const required of [
  'node stable-capital/stable-capital-engine.mjs',
  'node stable-capital/embedded-yield-interval-history.mjs',
  'node stable-capital/stable-index-bridge.mjs',
  'companies/stable-capital-data.json',
  'companies/embedded-yield-ledger.json',
  'companies/stable-index-data.json'
]) {
  if (!text.includes(required)) fail(`canonical writer invariant missing: ${required}`);
}

const diff = execFileSync('git', ['diff', '--unified=0', '--no-ext-diff', BASE_SHA, HEAD_SHA, '--', WORKFLOW], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

const payload = diff
  .split(/\r?\n/)
  .filter(line => (line.startsWith('+') || line.startsWith('-')) && !line.startsWith('+++') && !line.startsWith('---'));

const expectedPayload = new Set([
  '+# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs',
  '-    - cron: "37 5 * * *"',
  '+    # P10 scheduler-liveness repair: preserve daily cadence while re-registering the canonical schedule.',
  '+    - cron: "41 5 * * *"'
]);

if (payload.length !== expectedPayload.size || payload.some(line => !expectedPayload.has(line))) {
  fail(`workflow diff escaped bounded scheduler-only contract: ${JSON.stringify(payload)}`);
}

console.log('Update Stable Capital scheduler definition proof PASS');
console.log(JSON.stringify({
  workflow: WORKFLOW,
  dailyCronUtc: EXPECTED_CRON,
  canonicalWriterPreserved: true,
  duplicateWriterAdded: false,
  accountingSemanticsChanged: false,
  executionAuthority: 'none'
}, null, 2));
