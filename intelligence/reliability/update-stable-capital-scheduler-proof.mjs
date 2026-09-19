#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const WORKFLOW = '.github/workflows/update-stable-capital-scheduled.yml';
const RETIRED_WORKFLOW = '.github/workflows/update-stable-capital.yml';
const PROOF = 'intelligence/reliability/update-stable-capital-scheduler-proof.mjs';
const EXPECTED_CRON = '52 4,16 * * *';
const FALLBACK_HEARTBEAT = 'intelligence/market-data/market-data-coingecko.json';
const BASE_SHA = process.env.BASE_SHA || '';
const HEAD_SHA = process.env.HEAD_SHA || '';

function fail(message) {
  throw new Error(`Stable Capital scheduler proof failed: ${message}`);
}
function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

if (!BASE_SHA || !HEAD_SHA) fail('BASE_SHA/HEAD_SHA missing');
if (!fs.existsSync(WORKFLOW)) fail('active workflow path missing');
if (!fs.existsSync(RETIRED_WORKFLOW)) fail('retired registration tombstone missing');

const MERGE_BASE = git(['merge-base', BASE_SHA, HEAD_SHA]);
if (!MERGE_BASE) fail('unable to resolve PR merge base');

const text = fs.readFileSync(WORKFLOW, 'utf8');
const retired = fs.readFileSync(RETIRED_WORKFLOW, 'utf8');

for (const required of [
  '# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs',
  '# holding-control-plane: repository-writer',
  '# holding-truth-plane: Stable Capital / Embedded Yield / Stable Companies Index',
  '# holding-control-domain: Monetra Stable Capital scheduled materialization',
  'name: "Update Stable Capital"',
  'workflow_dispatch:',
  `cron: "${EXPECTED_CRON}"`,
  'push:',
  'branches: [main]',
  FALLBACK_HEARTBEAT,
  '.github/workflows/update-stable-capital-scheduled.yml',
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
  if (!text.includes(required)) fail(`active writer invariant missing: ${required}`);
}
if ((text.match(/\bcron:\s*/g) || []).length !== 1) fail('active registration must have exactly one cron declaration');
if ((text.match(/intelligence\/market-data\/market-data-coingecko\.json/g) || []).length !== 1) {
  fail('active registration must have exactly one canonical Market Data fallback heartbeat path');
}

for (const required of [
  '# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs',
  'name: "Update Stable Capital · Retired Registration"',
  'workflow_dispatch:',
  'contents: read',
  'group: update-stable-capital-retired'
]) {
  if (!retired.includes(required)) fail(`retired registration invariant missing: ${required}`);
}
if (/\bcron:\s*/.test(retired) || /^\s*schedule:\s*$/m.test(retired)) fail('retired registration must have no schedule');
if (/contents:\s*write/.test(retired)) fail('retired registration retained contents write authority');
if (/\bgit\s+(?:commit|push)\b/.test(retired)) fail('retired registration retained git writer command');
for (const forbidden of [
  'stable-capital/stable-capital-engine.mjs',
  'stable-capital/embedded-yield-interval-history.mjs',
  'stable-capital/stable-index-bridge.mjs',
  'companies/stable-capital-data.json',
  'companies/embedded-yield-ledger.json',
  'companies/stable-index-data.json'
]) {
  if (retired.includes(forbidden)) fail(`retired registration still references production writer surface: ${forbidden}`);
}

const changed = git(['diff', '--name-only', MERGE_BASE, HEAD_SHA]).split(/\r?\n/).filter(Boolean).sort();
const allowed = new Set([WORKFLOW, PROOF]);
if (changed.length < 1 || changed.some(path => !allowed.has(path))) {
  fail(`repair escaped bounded path set: ${JSON.stringify(changed)}`);
}

const baseText = git(['show', `${MERGE_BASE}:${WORKFLOW}`]);
for (const invariant of [
  'name: "Update Stable Capital"',
  'contents: write',
  'group: update-stable-capital',
  'node stable-capital/stable-capital-engine.mjs',
  'node stable-capital/embedded-yield-interval-history.mjs',
  'node stable-capital/stable-index-bridge.mjs',
  'companies/stable-capital-data.json',
  'companies/embedded-yield-ledger.json',
  'companies/stable-index-data.json'
]) {
  if (!baseText.includes(invariant)) fail(`base active-workflow invariant missing unexpectedly: ${invariant}`);
}

console.log('Update Stable Capital scheduler definition proof PASS');
console.log(JSON.stringify({
  mergeBase: MERGE_BASE,
  retiredWorkflow: RETIRED_WORKFLOW,
  activeWorkflow: WORKFLOW,
  cronUtc: EXPECTED_CRON,
  automaticFallbackHeartbeat: FALLBACK_HEARTBEAT,
  fallbackSemantics: 'canonical Market Data baseline publication wakes the existing Stable writer; no duplicate writer and no workflow-dispatch authority added',
  retiredRegistrationReadOnly: true,
  retiredRegistrationScheduled: false,
  canonicalWriterCount: 1,
  duplicateWriterAdded: false,
  accountingSemanticsChanged: false,
  executionAuthority: 'none'
}, null, 2));
