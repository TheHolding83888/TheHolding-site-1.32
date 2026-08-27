#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const WORKFLOW_PATH = '.github/workflows/refresh-downstream-continuity.yml';
const PROOF_PATH = 'intelligence/reliability/downstream-material-change-definition-proof.mjs';
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

function hash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

export function builderQueueProjection(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Builder queue must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  if (out.integrity && typeof out.integrity === 'object') delete out.integrity.queueHash;
  return out;
}

export function builderEvalProjection(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Builder eval must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  if (out.source && typeof out.source === 'object') delete out.source.candidateQueueSha256;
  return out;
}

export function guardianStateProjection(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Guardian state must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  if (out.integrity && typeof out.integrity === 'object') delete out.integrity.stateHash;
  return out;
}

export function guardianEvalProjection(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Guardian eval must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  if (out.source && typeof out.source === 'object') delete out.source.guardianStateSha256;
  return out;
}

function assertBuilderContract(queue, evaluation, label) {
  assert(queue?.version === '0.1-builder-candidate-queue', `${label}: unexpected Builder queue version`);
  assert(queue?.engineVersion === '0.1-bounded-builder-candidate-engine', `${label}: unexpected Builder engine`);
  assert(Array.isArray(queue?.candidates), `${label}: Builder candidates missing`);
  assert(queue?.constraints?.executionAuthority === 'none', `${label}: Builder execution authority drift`);
  assert(queue?.summary?.productionMutationAuthorizedCount === 0, `${label}: Builder mutation authority drift`);
  assert(evaluation?.version === '0.1-builder-eval', `${label}: unexpected Builder eval version`);
  assert(evaluation?.status === 'pass', `${label}: Builder reviewer is not PASS`);
  assert(evaluation?.boundaries?.executionAuthority === 'none', `${label}: Builder reviewer authority drift`);
}

function assertGuardianContract(state, evaluation, label) {
  assert(state?.version === '0.1-guardian-state', `${label}: unexpected Guardian state version`);
  assert(state?.engineVersion === '0.1-deterministic-guardian-capability-gate', `${label}: unexpected Guardian engine`);
  assert(Array.isArray(state?.decisions), `${label}: Guardian decisions missing`);
  assert(state?.constraints?.executionAuthority === 'none', `${label}: Guardian execution authority drift`);
  assert(state?.summary?.sandboxBuildAuthorizedCount === 0, `${label}: Guardian sandbox authority drift`);
  assert(state?.summary?.productionMutationAuthorizedCount === 0, `${label}: Guardian mutation authority drift`);
  assert(evaluation?.version === '0.1-guardian-eval', `${label}: unexpected Guardian eval version`);
  assert(evaluation?.status === 'pass', `${label}: Guardian reviewer is not PASS`);
  assert(evaluation?.boundaries?.executionAuthority === 'none', `${label}: Guardian reviewer authority drift`);
}

function syntheticBuilder() {
  const queue = {
    version: '0.1-builder-candidate-queue',
    engineVersion: '0.1-bounded-builder-candidate-engine',
    generatedAt: '2026-08-27T04:20:54.414Z',
    status: 'watch',
    source: {
      proposalQueueSha256: 'proposal-a',
      proposalQueueHash: 'proposal-hash-a',
      proposalDecisionEvalSha256: 'proposal-eval-a',
      learningContextSha256: 'learning-a',
      decisionLedgerHash: 'ledger-a',
      cognitiveChainHash: 'chain-a',
      builderPolicySha256: 'builder-policy-a'
    },
    summary: { approvedProposalCount: 1, candidateCount: 1, productionMutationAuthorizedCount: 0 },
    candidates: [{ candidateId: 'BLD-a', state: 'CANDIDATE', objective: 'Research.', boundaries: { executionAuthority: 'none' } }],
    constraints: { executionAuthority: 'none' },
    integrity: { queueHash: 'volatile-a' }
  };
  const evaluation = {
    version: '0.1-builder-eval',
    reviewerVersion: '0.1-independent-builder-reviewer',
    generatedAt: '2026-08-27T04:20:54.451Z',
    status: 'pass',
    source: { candidateQueueSha256: 'volatile-queue-a', proposalQueueSha256: 'proposal-a', learningContextSha256: 'learning-a' },
    counts: { approvedProposals: 1, candidates: 1, errors: 0, warnings: 0 },
    errors: [], warnings: [],
    boundaries: { executionAuthority: 'none' }
  };
  return { queue, evaluation };
}

function syntheticGuardian() {
  const state = {
    version: '0.1-guardian-state',
    engineVersion: '0.1-deterministic-guardian-capability-gate',
    generatedAt: '2026-08-27T04:20:54.509Z',
    status: 'watch',
    source: { candidateQueueSha256: 'builder-a', candidateQueueHash: 'builder-hash-a', guardianPolicySha256: 'guardian-policy-a' },
    summary: { candidateCount: 1, researchOnlyCount: 1, blockedCount: 0, sandboxBuildAuthorizedCount: 0, productionMutationAuthorizedCount: 0 },
    decisions: [{ guardianDecisionId: 'GRD-a', candidateId: 'BLD-a', gateDecision: 'RESEARCH_ONLY', allowedCapabilities: ['research'], authority: { executionAuthority: 'none' } }],
    constraints: { executionAuthority: 'none', sandboxBuildAuthority: false },
    integrity: { stateHash: 'volatile-a' }
  };
  const evaluation = {
    version: '0.1-guardian-eval',
    reviewerVersion: '0.1-independent-guardian-reviewer',
    generatedAt: '2026-08-27T04:20:54.543Z',
    status: 'pass',
    source: { guardianStateSha256: 'volatile-state-a', candidateQueueSha256: 'builder-a', guardianPolicySha256: 'guardian-policy-a' },
    counts: { candidates: 1, researchOnly: 1, blocked: 0, errors: 0, warnings: 0 },
    errors: [], warnings: [],
    boundaries: { executionAuthority: 'none' }
  };
  return { state, evaluation };
}

function runSelfTest() {
  const b1 = syntheticBuilder();
  assertBuilderContract(b1.queue, b1.evaluation, 'builder-base');
  const b2 = structuredClone(b1);
  b2.queue.generatedAt = '2026-08-27T08:57:53.557Z';
  b2.queue.integrity.queueHash = 'volatile-b';
  b2.evaluation.generatedAt = '2026-08-27T08:57:53.596Z';
  b2.evaluation.source.candidateQueueSha256 = 'volatile-queue-b';
  assert(hash(builderQueueProjection(b1.queue)) === hash(builderQueueProjection(b2.queue)), 'Builder clock-only queue delta must be suppressible');
  assert(hash(builderEvalProjection(b1.evaluation)) === hash(builderEvalProjection(b2.evaluation)), 'Builder clock-derived eval delta must be suppressible');

  const bSource = structuredClone(b2);
  bSource.queue.source.learningContextSha256 = 'learning-b';
  assert(hash(builderQueueProjection(b1.queue)) !== hash(builderQueueProjection(bSource.queue)), 'Builder source provenance change must remain material');
  const bCandidate = structuredClone(b2);
  bCandidate.queue.candidates[0].objective = 'Different research.';
  assert(hash(builderQueueProjection(b1.queue)) !== hash(builderQueueProjection(bCandidate.queue)), 'Builder candidate content change must remain material');
  const bReview = structuredClone(b2);
  bReview.evaluation.counts.warnings = 1;
  bReview.evaluation.warnings = ['new warning'];
  assert(hash(builderEvalProjection(b1.evaluation)) !== hash(builderEvalProjection(bReview.evaluation)), 'Builder reviewer result change must remain material');
  const bAuthority = structuredClone(b2);
  bAuthority.queue.constraints.executionAuthority = 'unexpected';
  assert(hash(builderQueueProjection(b1.queue)) !== hash(builderQueueProjection(bAuthority.queue)), 'Builder authority change must remain material');

  const g1 = syntheticGuardian();
  assertGuardianContract(g1.state, g1.evaluation, 'guardian-base');
  const g2 = structuredClone(g1);
  g2.state.generatedAt = '2026-08-27T08:57:53.660Z';
  g2.state.integrity.stateHash = 'volatile-b';
  g2.evaluation.generatedAt = '2026-08-27T08:57:53.697Z';
  g2.evaluation.source.guardianStateSha256 = 'volatile-state-b';
  assert(hash(guardianStateProjection(g1.state)) === hash(guardianStateProjection(g2.state)), 'Guardian clock-only state delta must be suppressible');
  assert(hash(guardianEvalProjection(g1.evaluation)) === hash(guardianEvalProjection(g2.evaluation)), 'Guardian clock-derived eval delta must be suppressible');

  const gDecision = structuredClone(g2);
  gDecision.state.decisions[0].gateDecision = 'BLOCKED';
  assert(hash(guardianStateProjection(g1.state)) !== hash(guardianStateProjection(gDecision.state)), 'Guardian gate decision change must remain material');
  const gPolicy = structuredClone(g2);
  gPolicy.state.source.guardianPolicySha256 = 'guardian-policy-b';
  assert(hash(guardianStateProjection(g1.state)) !== hash(guardianStateProjection(gPolicy.state)), 'Guardian policy provenance change must remain material');
  const gReview = structuredClone(g2);
  gReview.evaluation.status = 'fail';
  assert(hash(guardianEvalProjection(g1.evaluation)) !== hash(guardianEvalProjection(gReview.evaluation)), 'Guardian reviewer status change must remain material');
  const gAuthority = structuredClone(g2);
  gAuthority.state.constraints.executionAuthority = 'unexpected';
  assert(hash(guardianStateProjection(g1.state)) !== hash(guardianStateProjection(gAuthority.state)), 'Guardian authority change must remain material');

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  for (const required of [
    `# holding-workflow-definition-proof: ${PROOF_PATH}`,
    `node ${PROOF_PATH}`,
    `node ${PROOF_PATH} --builder /tmp/builder-queue.previous.json intelligence/builder/candidate-queue.json /tmp/builder-eval.previous.json intelligence/builder/candidate-eval.json`,
    `node ${PROOF_PATH} --guardian /tmp/guardian-state.previous.json intelligence/guardian/guardian-state.json /tmp/guardian-eval.previous.json intelligence/guardian/guardian-eval.json`,
    'No material Builder delta; preserving prior reviewed Builder packet.',
    'No material Guardian delta; preserving prior reviewed Guardian packet.',
    'node intelligence/project-memory/build-current-memory.mjs'
  ]) assert(workflow.includes(required), `Downstream workflow material-change contract missing: ${required}`);

  console.log('DOWNSTREAM MATERIAL-CHANGE DEFINITION PROOF PASS', {
    workflow: WORKFLOW_PATH,
    builderIgnoredVolatileFields: ['generatedAt', 'integrity.queueHash', 'eval.generatedAt', 'eval.source.candidateQueueSha256'],
    guardianIgnoredVolatileFields: ['generatedAt', 'integrity.stateHash', 'eval.generatedAt', 'eval.source.guardianStateSha256'],
    currentAlwaysRebuilt: true,
    preservedMaterialClasses: ['source-provenance', 'candidate-content', 'reviewer-result', 'guardian-decision', 'policy-binding', 'constraints', 'authority', 'independent-current-state'],
    executionAuthority: 'none'
  });
}

function runBuilderGate(previousQueuePath, candidateQueuePath, previousEvalPath, candidateEvalPath) {
  const previousQueue = readJson(previousQueuePath);
  const candidateQueue = readJson(candidateQueuePath);
  const previousEval = readJson(previousEvalPath);
  const candidateEval = readJson(candidateEvalPath);
  assertBuilderContract(previousQueue, previousEval, 'builder-previous');
  assertBuilderContract(candidateQueue, candidateEval, 'builder-candidate');
  const previousHash = hash({ queue: builderQueueProjection(previousQueue), evaluation: builderEvalProjection(previousEval) });
  const candidateHash = hash({ queue: builderQueueProjection(candidateQueue), evaluation: builderEvalProjection(candidateEval) });
  const materialChange = previousHash !== candidateHash;
  console.log(JSON.stringify({ version: '0.1-downstream-builder-material-change-gate', materialChange, previousHash, candidateHash, currentAlwaysRebuilt: true, executionAuthority: 'none' }, null, 2));
  if (!materialChange) process.exit(NO_MATERIAL_CHANGE_EXIT);
}

function runGuardianGate(previousStatePath, candidateStatePath, previousEvalPath, candidateEvalPath) {
  const previousState = readJson(previousStatePath);
  const candidateState = readJson(candidateStatePath);
  const previousEval = readJson(previousEvalPath);
  const candidateEval = readJson(candidateEvalPath);
  assertGuardianContract(previousState, previousEval, 'guardian-previous');
  assertGuardianContract(candidateState, candidateEval, 'guardian-candidate');
  const previousHash = hash({ state: guardianStateProjection(previousState), evaluation: guardianEvalProjection(previousEval) });
  const candidateHash = hash({ state: guardianStateProjection(candidateState), evaluation: guardianEvalProjection(candidateEval) });
  const materialChange = previousHash !== candidateHash;
  console.log(JSON.stringify({ version: '0.1-downstream-guardian-material-change-gate', materialChange, previousHash, candidateHash, currentAlwaysRebuilt: true, executionAuthority: 'none' }, null, 2));
  if (!materialChange) process.exit(NO_MATERIAL_CHANGE_EXIT);
}

if (process.argv[2] === '--builder') runBuilderGate(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
else if (process.argv[2] === '--guardian') runGuardianGate(process.argv[3], process.argv[4], process.argv[5], process.argv[6]);
else runSelfTest();
