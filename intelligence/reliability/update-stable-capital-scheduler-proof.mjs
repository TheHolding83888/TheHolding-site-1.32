#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const WORKFLOW = '.github/workflows/update-stable-capital-scheduled.yml';
const RETIRED_WORKFLOW = '.github/workflows/update-stable-capital.yml';
const CANARY_WORKFLOW = '.github/workflows/verify-stable-rpc-capability.yml';
const PROOF = 'intelligence/reliability/update-stable-capital-scheduler-proof.mjs';
const ENGINE = 'stable-capital/stable-capital-engine.mjs';
const RPC_SELECTOR = 'stable-capital/rpc-capability-selector.mjs';
const RPC_ARTIFACT = 'intelligence/reliability/stable-rpc-capability.json';
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
if (!fs.existsSync(CANARY_WORKFLOW)) fail('historical RPC canary workflow missing');
if (!fs.existsSync(RPC_SELECTOR)) fail('historical RPC capability selector missing');

const MERGE_BASE = git(['merge-base', BASE_SHA, HEAD_SHA]);
if (!MERGE_BASE) fail('unable to resolve PR merge base');

const text = fs.readFileSync(WORKFLOW, 'utf8');
const retired = fs.readFileSync(RETIRED_WORKFLOW, 'utf8');
const canary = fs.readFileSync(CANARY_WORKFLOW, 'utf8');
const selector = fs.readFileSync(RPC_SELECTOR, 'utf8');

for (const required of [
  '# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs',
  '# holding-control-plane: repository-writer',
  '# holding-truth-plane: Stable Capital / Embedded Yield / Stable Companies Index / Historical RPC Capability',
  '# holding-control-domain: Monetra Stable Capital scheduled materialization',
  'name: "Update Stable Capital"',
  'workflow_dispatch:',
  `cron: "${EXPECTED_CRON}"`,
  'push:',
  'branches: [main]',
  FALLBACK_HEARTBEAT,
  ENGINE,
  RPC_SELECTOR,
  '.github/workflows/update-stable-capital-scheduled.yml',
  PROOF,
  'contents: write',
  'group: update-stable-capital',
  'cancel-in-progress: false',
  'node stable-capital/rpc-capability-selector.mjs',
  'node stable-capital/stable-capital-engine.mjs',
  'node stable-capital/embedded-yield-interval-history.mjs',
  'node stable-capital/stable-index-bridge.mjs',
  'companies/stable-capital-data.json',
  'companies/embedded-yield-ledger.json',
  'companies/stable-index-data.json',
  RPC_ARTIFACT,
  'unknownNeverZero',
  'secondStableWriterCreated',
  "executionAuthority!=='none'"
]) {
  if (!text.includes(required)) fail(`active writer invariant missing: ${required}`);
}
if ((text.match(/\bcron:\s*/g) || []).length !== 1) fail('active registration must have exactly one cron declaration');
if ((text.match(/intelligence\/market-data\/market-data-coingecko\.json/g) || []).length !== 1) {
  fail('active registration must have exactly one canonical Market Data fallback heartbeat path');
}

// The shared selector may influence transport only. It must prove historical
// contract state, fail closed, sanitize persisted provenance and never become
// an economic writer or authority expansion.
for (const required of [
  "export const VERSION = '0.1-stable-rpc-capability'",
  "capability: 'historical-contract-state-read'",
  "status: selection?.ok ? 'ready' : 'unavailable-fail-closed'",
  'historical eth_call must succeed; liveness/header history alone is insufficient',
  'unknownNeverZero: true',
  'failClosed: true',
  'secondStableWriterCreated: false',
  "executionAuthority: 'none'",
  'ETH_ARCHIVE_RPC_URL=${selectedUrl}'
]) {
  if (!selector.includes(required)) fail(`RPC selector invariant missing: ${required}`);
}
if (!selector.includes("const probe = new Contract(probeAddress")) fail('selector no longer proves contract state');
if (!selector.includes('probe.decimals({ blockTag: historicalBlockNumber })')) fail('selector no longer performs historical eth_call');
if (/git\s+(?:commit|push)|contents:\s*write/.test(selector)) fail('selector acquired repository writer surface');

// The PR canary is review-only. It proves both deterministic fail-closed
// semantics and one real historical state read without creating a writer.
for (const required of [
  'name: Verify Stable Historical RPC Capability',
  'pull_request:',
  RPC_SELECTOR,
  CANARY_WORKFLOW,
  'contents: read',
  'Deterministic truth-contract validation',
  'Focused Ethereum historical state canary',
  'selectHistoricalRpc',
  'historyBlockDistance:50000'
]) {
  if (!canary.includes(required)) fail(`RPC canary invariant missing: ${required}`);
}
if (/contents:\s*write/.test(canary)) fail('RPC canary acquired write permission');
if (/\bgit\s+(?:commit|push)\b/.test(canary)) fail('RPC canary acquired git writer command');
if (/^\s*schedule:\s*$/m.test(canary) || /\bcron:\s*/.test(canary)) fail('RPC canary must not create a scheduled writer/runner');

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
const allowed = new Set([WORKFLOW, PROOF, RPC_SELECTOR, CANARY_WORKFLOW]);
if (changed.length < 1 || changed.some(file => !allowed.has(file))) {
  fail(`repair escaped bounded path set: ${JSON.stringify(changed)}`);
}
for (const requiredChanged of [WORKFLOW, PROOF, RPC_SELECTOR, CANARY_WORKFLOW]) {
  if (!changed.includes(requiredChanged)) fail(`bounded repair path not changed: ${requiredChanged}`);
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

console.log('Update Stable Capital scheduler + historical transport definition proof PASS');
console.log(JSON.stringify({
  mergeBase: MERGE_BASE,
  retiredWorkflow: RETIRED_WORKFLOW,
  activeWorkflow: WORKFLOW,
  canaryWorkflow: CANARY_WORKFLOW,
  cronUtc: EXPECTED_CRON,
  automaticFallbackHeartbeat: FALLBACK_HEARTBEAT,
  engineSelfProbePath: ENGINE,
  historicalTransportSelector: RPC_SELECTOR,
  historicalCapabilityArtifact: RPC_ARTIFACT,
  historicalCapabilityContract: 'actual historical contract eth_call required; liveness/header history insufficient; unavailable remains UNKNOWN/null',
  fallbackSemantics: 'canonical Market Data baseline publication wakes the existing Stable writer; no duplicate writer and no workflow-dispatch authority added',
  retiredRegistrationReadOnly: true,
  retiredRegistrationScheduled: false,
  canonicalWriterCount: 1,
  duplicateWriterAdded: false,
  canaryReadOnly: true,
  accountingSemanticsChanged: false,
  executionAuthority: 'none'
}, null, 2));
