#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const WORKFLOW = '.github/workflows/update-stable-capital-scheduled.yml';
const OLD_WORKFLOW = '.github/workflows/update-stable-capital.yml';
const PROOF = 'intelligence/reliability/update-stable-capital-scheduler-proof.mjs';
const EXPECTED_CRON = '41 5 * * *';
const BASE_SHA = process.env.BASE_SHA || '';
const HEAD_SHA = process.env.HEAD_SHA || '';

function fail(message) {
  throw new Error(`Stable Capital scheduler proof failed: ${message}`);
}

if (!BASE_SHA || !HEAD_SHA) fail('BASE_SHA/HEAD_SHA missing');
if (!fs.existsSync(WORKFLOW)) fail('fresh workflow path missing');
if (fs.existsSync(OLD_WORKFLOW)) fail('stale workflow path still present; duplicate writer risk');

const text = fs.readFileSync(WORKFLOW, 'utf8');

for (const required of [
  '# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs',
  '# holding-control-plane: repository-writer',
  '# holding-truth-plane: Stable Capital / Embedded Yield / Stable Companies Index',
  '# holding-control-domain: Monetra Stable Capital scheduled materialization',
  'name: "Update Stable Capital"',
  'workflow_dispatch:',
  `cron: "${EXPECTED_CRON}"`,
  'contents: write',
  'group: update-stable-capital',
  'cancel-in-progress: false',
  'node stable-capital/stable-capital-engine.mjs',
  'node stable-capital/embedded-yield-interval-history.mjs',
  'node stable-capital/stable-index-bridge.mjs',
  'companies/stable-capital-data.json',
  'companies/embedded-yield-ledger.json',
  'companies/stable-index-data.json'
]) {
  if (!text.includes(required)) fail(`canonical migration invariant missing: ${required}`);
}

if ((text.match(/\bcron:\s*/g) || []).length !== 1) fail('expected exactly one cron schedule');

const changed = execFileSync('git', ['diff', '--name-only', BASE_SHA, HEAD_SHA], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
}).trim().split(/\r?\n/).filter(Boolean).sort();

const allowed = [OLD_WORKFLOW, WORKFLOW, PROOF].sort();
if (changed.length !== allowed.length || changed.some((path, i) => path !== allowed[i])) {
  fail(`migration escaped bounded path set: ${JSON.stringify(changed)}`);
}

const baseText = execFileSync('git', ['show', `${BASE_SHA}:${OLD_WORKFLOW}`], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'pipe']
});

for (const invariant of [
  'name: "Update Stable Capital"',
  `cron: "${EXPECTED_CRON}"`,
  'contents: write',
  'group: update-stable-capital',
  'cancel-in-progress: false',
  'node stable-capital/stable-capital-engine.mjs',
  'node stable-capital/embedded-yield-interval-history.mjs',
  'node stable-capital/stable-index-bridge.mjs',
  'companies/stable-capital-data.json',
  'companies/embedded-yield-ledger.json',
  'companies/stable-index-data.json'
]) {
  if (!baseText.includes(invariant)) fail(`base workflow invariant missing unexpectedly: ${invariant}`);
}

console.log('Update Stable Capital workflow re-registration proof PASS');
console.log(JSON.stringify({
  retiredWorkflow: OLD_WORKFLOW,
  activeWorkflow: WORKFLOW,
  dailyCronUtc: EXPECTED_CRON,
  workflowPathReregistered: true,
  canonicalWriterPreserved: true,
  duplicateWriterAdded: false,
  accountingSemanticsChanged: false,
  executionAuthority: 'none'
}, null, 2));
