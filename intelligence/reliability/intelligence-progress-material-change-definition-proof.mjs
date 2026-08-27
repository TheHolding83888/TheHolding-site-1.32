#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const WORKFLOW_PATH = '.github/workflows/update-intelligence-progress.yml';
const PROOF_PATH = 'intelligence/reliability/intelligence-progress-material-change-definition-proof.mjs';
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
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Intelligence Progress payload must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  if (out.growth && typeof out.growth === 'object') delete out.growth.previousGeneratedAt;
  return out;
}

function materialHash(value) {
  return crypto.createHash('sha256').update(stableStringify(materialProjection(value))).digest('hex');
}

function assertCanonicalContract(value, label) {
  assert(value?.version === '0.1-intelligence-progress', `${label}: unexpected Intelligence Progress version`);
  assert(value?.engineVersion === '0.2.1-live-cognitive-integrity-public-safe-thi-engine', `${label}: unexpected Intelligence Progress engine`);
  assert(value?.authority?.executionAuthority === 'none' && value?.authority?.executable === false, `${label}: authority boundary drift`);
  assert(Number.isFinite(Number(value?.index?.value)) && Number(value.index.value) >= 0 && Number(value.index.value) <= 100, `${label}: invalid THI value`);
  assert(Array.isArray(value?.factors) && value.factors.length === 5, `${label}: invalid factor set`);
  assert(Array.isArray(value?.history), `${label}: history missing`);
  assert(value?.growth && typeof value.growth === 'object', `${label}: growth missing`);
  assert(typeof value.generatedAt === 'string' && Number.isFinite(Date.parse(value.generatedAt)), `${label}: invalid generatedAt`);
}

function syntheticPayload() {
  return {
    version: '0.1-intelligence-progress',
    engineVersion: '0.2.1-live-cognitive-integrity-public-safe-thi-engine',
    generatedAt: '2026-08-25T10:55:41.150Z',
    index: { name: 'The Holding Intelligence Index', shortName: 'THI', value: 70.7, delta: 0, stage: 'Operational Intelligence' },
    authority: { executionAuthority: 'none', executable: false },
    factors: [
      { id: 'memory', score: 18, max: 20, pct: 90 },
      { id: 'reasoning', score: 16, max: 20, pct: 80 },
      { id: 'evaluation', score: 14, max: 20, pct: 70 },
      { id: 'experience', score: 9.7, max: 20, pct: 48.5 },
      { id: 'integrity', score: 13, max: 20, pct: 65 }
    ],
    metrics: {
      memory: { rememberedCases: 170 },
      reasoning: { brainObservations: 39 },
      evaluation: { totalAskRuns: 100, successfulAskRuns: 99 },
      experience: { ownerDecisions: 2, settledOutcomes: 0, lessons: 0 },
      integrity: { cognitiveEvalPass: true, securityStatus: 'watch' }
    },
    bottleneck: { factor: 'experience' },
    growth: {
      previousGeneratedAt: '2026-08-25T10:55:41.150Z',
      metricDelta: { memoryVaultRuns: 0, memoryVaultEvents: 0, rememberedCases: 0, brainObservations: 0 }
    },
    sourceFreshness: {
      learningGeneratedAt: '2026-08-25T10:55:37.306Z',
      brainGeneratedAt: '2026-08-25T10:55:30.000Z',
      securityGeneratedAt: '2026-08-25T10:55:20.000Z',
      observerGeneratedAt: '2026-08-25T10:55:10.000Z'
    },
    history: [{ generatedAt: '2026-08-25T10:55:41.150Z', value: 70.7 }]
  };
}

function runSelfTest() {
  const base = syntheticPayload();

  const clockOnly = structuredClone(base);
  clockOnly.generatedAt = '2026-08-25T10:56:00.921Z';
  clockOnly.growth.previousGeneratedAt = '2026-08-25T10:56:00.921Z';
  assert(materialHash(base) === materialHash(clockOnly), 'pure writer-clock delta must be suppressible');

  const indexDeltaReset = structuredClone(clockOnly);
  indexDeltaReset.index.delta = 0.1;
  assert(materialHash(base) !== materialHash(indexDeltaReset), 'index.delta must remain material for Console semantics');

  const metricDeltaReset = structuredClone(clockOnly);
  metricDeltaReset.growth.metricDelta.rememberedCases = 16;
  assert(materialHash(base) !== materialHash(metricDeltaReset), 'growth.metricDelta must remain material');

  const scoreChange = structuredClone(clockOnly);
  scoreChange.index.value = 70.8;
  scoreChange.factors[0].score = 18.1;
  assert(materialHash(base) !== materialHash(scoreChange), 'THI/factor change must remain material');

  const sourceChange = structuredClone(clockOnly);
  sourceChange.sourceFreshness.learningGeneratedAt = '2026-08-26T06:30:13.449Z';
  assert(materialHash(base) !== materialHash(sourceChange), 'source freshness/provenance change must remain material');

  const historyChange = structuredClone(clockOnly);
  historyChange.history.push({ generatedAt: '2026-08-25T11:30:00.000Z', value: 70.7 });
  assert(materialHash(base) !== materialHash(historyChange), 'history cadence/evidence change must remain material');

  const integrityChange = structuredClone(clockOnly);
  integrityChange.metrics.integrity.securityStatus = 'ok';
  assert(materialHash(base) !== materialHash(integrityChange), 'integrity/security state must remain material');

  const authorityChange = structuredClone(clockOnly);
  authorityChange.authority.executionAuthority = 'unexpected';
  assert(materialHash(base) !== materialHash(authorityChange), 'authority change must remain material');

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  for (const required of [
    `# holding-workflow-definition-proof: ${PROOF_PATH}`,
    `node ${PROOF_PATH}`,
    `node ${PROOF_PATH} --gate /tmp/intelligence-progress.previous.json intelligence/intelligence-progress.json`,
    'git show HEAD:intelligence/intelligence-progress.json > /tmp/intelligence-progress.previous.json',
    'git restore --source=HEAD -- intelligence/intelligence-progress.json',
    'No material Intelligence Progress delta; preserving prior artifact bytes.'
  ]) assert(workflow.includes(required), `Workflow material-change contract missing: ${required}`);

  console.log('INTELLIGENCE PROGRESS MATERIAL-CHANGE DEFINITION PROOF PASS', {
    workflow: WORKFLOW_PATH,
    ignoredVolatileFields: ['generatedAt', 'growth.previousGeneratedAt'],
    preservedMaterialClasses: ['index-delta', 'metric-delta', 'thi-score', 'factors', 'metrics', 'source-freshness', 'history', 'integrity', 'authority'],
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
    version: '0.1-intelligence-progress-material-change-gate',
    materialChange,
    previousHash,
    candidateHash,
    ignoredVolatileFields: ['generatedAt', 'growth.previousGeneratedAt'],
    indexDeltaPreserved: true,
    sourceFreshnessPreserved: true,
    historyPreserved: true,
    executionAuthority: 'none'
  }, null, 2));
  if (!materialChange) process.exit(NO_MATERIAL_CHANGE_EXIT);
}

if (process.argv[2] === '--gate') runGate(process.argv[3], process.argv[4]);
else runSelfTest();
