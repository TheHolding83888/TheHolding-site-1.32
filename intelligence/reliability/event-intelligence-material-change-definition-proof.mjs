#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const WORKFLOW_PATH = '.github/workflows/update-event-intelligence.yml';
const PROOF_PATH = 'intelligence/reliability/event-intelligence-material-change-definition-proof.mjs';
const NO_MATERIAL_CHANGE_EXIT = 10;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) throw new Error(`Empty JSON: ${file}`);
  return JSON.parse(text);
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

function materialProjection(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Event Intelligence payload must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  for (const key of ['reporting', 'changeHistory']) {
    if (out.sourceHealth?.[key] && typeof out.sourceHealth[key] === 'object') delete out.sourceHealth[key].ageHours;
  }
  return out;
}

function materialHash(value) {
  return crypto.createHash('sha256').update(stableStringify(materialProjection(value))).digest('hex');
}

function assertCanonicalContract(value, label) {
  assert(value?.version === '0.1-operating-event-intelligence', `${label}: unexpected Event Intelligence version`);
  assert(value?.engineVersion === '0.1-source-backed-event-synthesizer', `${label}: unexpected Event Intelligence engine`);
  assert(value?.authority?.executionAuthority === 'none' && value?.authority?.readOnly === true, `${label}: authority boundary drift`);
  assert(['ok', 'watch'].includes(value?.status), `${label}: invalid top-level status`);
  assert(['fresh', 'watch'].includes(value?.sourceHealth?.status), `${label}: invalid sourceHealth status`);
  for (const key of ['reporting', 'changeHistory']) {
    const source = value?.sourceHealth?.[key];
    assert(source && typeof source === 'object', `${label}: missing ${key} sourceHealth`);
    assert(typeof source.generatedAt === 'string' && Number.isFinite(Date.parse(source.generatedAt)), `${label}: invalid ${key}.generatedAt`);
    assert(Number.isFinite(Number(source.maxAgeHours)) && Number(source.maxAgeHours) > 0, `${label}: invalid ${key}.maxAgeHours`);
    assert(typeof source.sha256 === 'string' && /^[a-f0-9]{64}$/.test(source.sha256), `${label}: invalid ${key}.sha256`);
  }
}

function syntheticPayload() {
  return {
    version: '0.1-operating-event-intelligence',
    engineVersion: '0.1-source-backed-event-synthesizer',
    generatedAt: '2026-08-27T17:46:44.354Z',
    status: 'ok',
    authority: { executionAuthority: 'none', readOnly: true, automaticCapitalAction: false, automaticPolicyMutation: false },
    tracked: { activeEventTypeCount: 1, measuredEventTypeCount: 1, derivedEventTypeCount: 0, coverageGapCount: 0, eventTypes: [{ id: 'x' }], coverageGaps: [] },
    sourceHealth: {
      status: 'fresh',
      reporting: { generatedAt: '2026-08-27T17:19:42.170Z', ageHours: 0.45, maxAgeHours: 36, sha256: 'a'.repeat(64) },
      changeHistory: { generatedAt: '2026-08-27T17:46:21.337Z', ageHours: 0.01, maxAgeHours: 36, sha256: 'b'.repeat(64) }
    },
    feed: { itemCount: 1, totalDerivedFromAvailableHistory: 1, maxItems: 80, items: [{ id: 'EV-1', occurredAt: '2026-08-27T17:46:21.337Z' }] },
    semantics: { causality: 'fail-closed' },
    integrity: { policySha256: 'c'.repeat(64), reportingSha256: 'a'.repeat(64), changeHistorySha256: 'b'.repeat(64) }
  };
}

function runSelfTest() {
  const base = syntheticPayload();
  const clockOnly = structuredClone(base);
  clockOnly.generatedAt = '2026-08-27T17:52:47.054Z';
  clockOnly.sourceHealth.reporting.ageHours = 0.55;
  clockOnly.sourceHealth.changeHistory.ageHours = 0.11;
  assert(materialHash(base) === materialHash(clockOnly), 'clock-only delta must be suppressible');

  const statusTransition = structuredClone(clockOnly);
  statusTransition.status = 'watch';
  statusTransition.sourceHealth.status = 'watch';
  assert(materialHash(base) !== materialHash(statusTransition), 'fresh/watch transition must remain material');

  const sourceTimestamp = structuredClone(clockOnly);
  sourceTimestamp.sourceHealth.reporting.generatedAt = '2026-08-27T18:19:42.170Z';
  assert(materialHash(base) !== materialHash(sourceTimestamp), 'source generatedAt provenance change must remain material');

  const sourceHash = structuredClone(clockOnly);
  sourceHash.sourceHealth.reporting.sha256 = 'd'.repeat(64);
  sourceHash.integrity.reportingSha256 = 'd'.repeat(64);
  assert(materialHash(base) !== materialHash(sourceHash), 'source SHA change must remain material');

  const feedChange = structuredClone(clockOnly);
  feedChange.feed.items[0].id = 'EV-2';
  assert(materialHash(base) !== materialHash(feedChange), 'feed change must remain material');

  const authorityChange = structuredClone(clockOnly);
  authorityChange.authority.executionAuthority = 'unexpected';
  assert(materialHash(base) !== materialHash(authorityChange), 'authority change must remain material');

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  for (const required of [
    `# holding-workflow-definition-proof: ${PROOF_PATH}`,
    `node ${PROOF_PATH}`,
    `node ${PROOF_PATH} --gate /tmp/event-intelligence.previous.json intelligence/event-intelligence.json`,
    'git show HEAD:intelligence/event-intelligence.json > /tmp/event-intelligence.previous.json',
    'git restore --source=HEAD -- intelligence/event-intelligence.json',
    'No material Event Intelligence delta; preserving prior artifact bytes.'
  ]) assert(workflow.includes(required), `Workflow material-change contract missing: ${required}`);

  console.log('EVENT INTELLIGENCE MATERIAL-CHANGE DEFINITION PROOF PASS', {
    workflow: WORKFLOW_PATH,
    ignoredVolatileFields: ['generatedAt', 'sourceHealth.reporting.ageHours', 'sourceHealth.changeHistory.ageHours'],
    preservedMaterialClasses: ['freshness-status', 'source-generatedAt', 'source-sha', 'feed', 'tracked', 'integrity', 'authority'],
    executionAuthority: 'none'
  });
}

function runGate(previousPath, candidatePath) {
  assert(previousPath && candidatePath, '--gate requires previous and candidate paths');
  const previous = readJson(previousPath);
  const candidate = readJson(candidatePath);
  assertCanonicalContract(previous, 'previous');
  assertCanonicalContract(candidate, 'candidate');
  const previousHash = materialHash(previous);
  const candidateHash = materialHash(candidate);
  const materialChange = previousHash !== candidateHash;
  console.log(JSON.stringify({
    version: '0.1-event-intelligence-material-change-gate',
    materialChange,
    previousHash,
    candidateHash,
    ignoredVolatileFields: ['generatedAt', 'sourceHealth.reporting.ageHours', 'sourceHealth.changeHistory.ageHours'],
    freshnessStatusPreserved: true,
    sourceProvenancePreserved: true,
    executionAuthority: 'none'
  }, null, 2));
  if (!materialChange) process.exit(NO_MATERIAL_CHANGE_EXIT);
}

if (process.argv[2] === '--gate') runGate(process.argv[3], process.argv[4]);
else runSelfTest();
