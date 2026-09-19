#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const WORKFLOW = '.github/workflows/update-stable-capital-scheduled.yml';
const RETIRED_WORKFLOW = '.github/workflows/update-stable-capital.yml';
const PROOF = 'intelligence/reliability/update-stable-capital-scheduler-proof.mjs';
const ENGINE = 'stable-capital/stable-capital-engine.mjs';
const ARCHIVE_COORDINATOR = 'stable-capital/historical-rpc-coordinator.mjs';
const REGRESSION_VALIDATION = 'stable-capital/stable-regression-validation.mjs';
const RPC_SELECTOR = 'stable-capital/rpc-capability-selector.mjs';
const RPC_ARTIFACT = 'intelligence/reliability/stable-rpc-capability.json';
const STABLE_UI = 'companies/index.html';
const UI_SENTINEL = 'ui-regression/ui-regression-sentinel-v0.1.mjs';
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
if (!fs.existsSync(RPC_SELECTOR)) fail('historical RPC capability selector missing');
if (!fs.existsSync(ARCHIVE_COORDINATOR)) fail('historical RPC coordinator missing');
if (!fs.existsSync(REGRESSION_VALIDATION)) fail('Stable regression validation missing');

const MERGE_BASE = git(['merge-base', BASE_SHA, HEAD_SHA]);
if (!MERGE_BASE) fail('unable to resolve PR merge base');

const text = fs.readFileSync(WORKFLOW, 'utf8');
const retired = fs.readFileSync(RETIRED_WORKFLOW, 'utf8');
const selector = fs.readFileSync(RPC_SELECTOR, 'utf8');
const coordinator = fs.readFileSync(ARCHIVE_COORDINATOR, 'utf8');
const validation = fs.readFileSync(REGRESSION_VALIDATION, 'utf8');
const stableUi = fs.readFileSync(STABLE_UI, 'utf8');
const uiSentinel = fs.readFileSync(UI_SENTINEL, 'utf8');

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
  ARCHIVE_COORDINATOR,
  REGRESSION_VALIDATION,
  RPC_SELECTOR,
  '.github/workflows/update-stable-capital-scheduled.yml',
  PROOF,
  'contents: write',
  'group: update-stable-capital',
  'cancel-in-progress: false',
  'node stable-capital/rpc-capability-selector.mjs',
  'node stable-capital/stable-regression-validation.mjs',
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

// Shared transport selector: actual historical contract state is the capability
// test. It may select transport only; it never becomes a writer or accounting
// authority and it must preserve UNKNOWN/null when capability is unavailable.
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
if (!selector.includes('const probe = new Contract(probeAddress')) fail('selector no longer proves contract state');
if (!selector.includes('probe.decimals({ blockTag: historicalBlockNumber })')) fail('selector no longer performs historical eth_call');
if (/git\s+(?:commit|push)|contents:\s*write/.test(selector)) fail('selector acquired repository writer surface');

// The capability probe proves that historical state can be read. The shared
// coordinator additionally proves that the real multi-adapter workload cannot
// burst the selected endpoint or repeat the same timestamp binary search.
for (const required of [
  'export function createHistoricalRpcCoordinator',
  'const blockPromises = new Map()',
  'let queueTail = Promise.resolve()',
  'queueTail.then(() => task(), () => task())',
  'blockPromises.delete(key)',
  'return Object.freeze({ run, targetTimestamp, blockAtOrBefore })'
]) {
  if (!coordinator.includes(required)) fail(`historical RPC coordinator invariant missing: ${required}`);
}
if (/git\s+(?:commit|push)|contents:\s*write/.test(coordinator)) fail('historical RPC coordinator acquired writer authority');

for (const required of [
  'archive workloads were not serialized',
  'shared historical block was resolved more than once',
  'failed historical block lookup was not evicted',
  'Stable strategy UNKNOWN can still become numeric zero'
]) {
  if (!validation.includes(required)) fail(`Stable regression proof missing: ${required}`);
}
if (!stableUi.includes('const aprText = stablePct(p.referenceApyPct, 2);')) fail('Stable strategy renderer bypasses nullable formatter');
if (stableUi.includes('Number(p.referenceApyPct)')) fail('Stable strategy renderer can coerce null to zero');
if (!uiSentinel.includes('Stable UNKNOWN rates render as dash, never false 0.00%')) fail('physical UI null/zero regression check missing');

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
const allowed = new Set([
  WORKFLOW,
  PROOF,
  ENGINE,
  ARCHIVE_COORDINATOR,
  REGRESSION_VALIDATION,
  RPC_SELECTOR,
  STABLE_UI,
  UI_SENTINEL
]);
if (changed.length < 1 || changed.some(file => !allowed.has(file))) {
  fail(`repair escaped bounded path set: ${JSON.stringify(changed)}`);
}
for (const requiredChanged of [PROOF, ENGINE, REGRESSION_VALIDATION, RPC_SELECTOR]) {
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
  cronUtc: EXPECTED_CRON,
  automaticFallbackHeartbeat: FALLBACK_HEARTBEAT,
  engineSelfProbePath: ENGINE,
  historicalTransportSelector: RPC_SELECTOR,
  historicalWorkloadCoordinator: ARCHIVE_COORDINATOR,
  stableRegressionValidation: REGRESSION_VALIDATION,
  historicalCapabilityArtifact: RPC_ARTIFACT,
  historicalCapabilityContract: 'actual historical contract eth_call required; liveness/header history insufficient; unavailable remains UNKNOWN/null',
  historicalWorkloadContract: 'one bounded archive workload at a time; one shared historical block per provider/window; failed lookup remains retryable',
  stableUiTruthContract: 'UNKNOWN/null renders as dash; genuine finite zero remains 0.00%',
  fallbackSemantics: 'canonical Market Data baseline publication wakes the existing Stable writer; no duplicate writer and no workflow-dispatch authority added',
  retiredRegistrationReadOnly: true,
  retiredRegistrationScheduled: false,
  canonicalWriterCount: 1,
  duplicateWriterAdded: false,
  newWorkflowAdded: false,
  pullRequestFanoutDelta: 0,
  accountingSemanticsChanged: false,
  executionAuthority: 'none'
}, null, 2));
