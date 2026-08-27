#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const WORKFLOW_PATH = '.github/workflows/update-proposal-work-queue.yml';
const PROOF_PATH = 'intelligence/reliability/proposal-material-change-definition-proof.mjs';
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

export function materialProjection(value) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Proposal payload must be an object');
  const out = structuredClone(value);
  delete out.generatedAt;
  if (out.integrity && typeof out.integrity === 'object') delete out.integrity.queueHash;
  if (Array.isArray(out.proposals)) {
    for (const proposal of out.proposals) {
      if (proposal && typeof proposal === 'object') delete proposal.updatedAt;
    }
  }
  return out;
}

function materialHash(value) {
  return crypto.createHash('sha256').update(stableStringify(materialProjection(value))).digest('hex');
}

function assertCanonicalContract(value, label) {
  assert(value?.version === '0.1-proposal-work-queue', `${label}: unexpected Proposal version`);
  assert(value?.engineVersion === '0.1.2-decision-eligible-proposal-engine', `${label}: unexpected Proposal engine`);
  assert(Array.isArray(value?.proposals), `${label}: proposals missing`);
  assert(value?.constraints?.noProductionExecution === true, `${label}: production execution boundary drift`);
  assert(value?.constraints?.noAutomaticCodeChanges === true, `${label}: automatic code boundary drift`);
  assert(value?.constraints?.noAutomaticApprovals === true, `${label}: automatic approval boundary drift`);
  assert(value?.decisionBridge?.executionAuthority === 'none', `${label}: execution authority drift`);
  assert(value?.decisionBridge?.productionMutationAuthorized === false, `${label}: production mutation authority drift`);
  assert(typeof value.generatedAt === 'string' && Number.isFinite(Date.parse(value.generatedAt)), `${label}: invalid generatedAt`);
}

function syntheticQueue() {
  return {
    version: '0.1-proposal-work-queue',
    engineVersion: '0.1.2-decision-eligible-proposal-engine',
    generatedAt: '2026-08-27T04:20:38.025Z',
    status: 'watch',
    headline: '1 active proposal; execution remains disabled.',
    source: {
      brainSha256: 'brain-a',
      cognitiveChainHash: 'chain-a',
      learningContextSha256: 'learning-a',
      learningGeneratedAt: '2026-08-27T04:20:00.000Z',
      decisionLedgerHash: 'ledger-a'
    },
    summary: {
      activeCaseCount: 1,
      activeProposalCount: 1,
      stateCounts: { PROPOSED: 1, APPROVED: 0, SUPERSEDED: 0 }
    },
    proposals: [{
      proposalId: 'PRP-a',
      proposalKey: 'a',
      state: 'PROPOSED',
      createdAt: '2026-08-14T17:53:54.564Z',
      updatedAt: '2026-08-27T04:20:38.025Z',
      priorityScore: 150,
      rankClass: 'P0',
      source: { caseKey: 'CK-a', cognitiveChainHash: 'chain-a' },
      proposedAction: 'Review evidence.',
      boundaries: { automaticApproval: false, automaticExecution: false, humanApprovalRequired: true },
      verificationRequired: ['fresh source evidence', 'independent deterministic review', 'human approval before mutation']
    }],
    constraints: {
      noProductionExecution: true,
      noAutomaticCodeChanges: true,
      noAutomaticApprovals: true
    },
    decisionBridge: {
      executionAuthority: 'none',
      productionMutationAuthorized: false
    },
    integrity: { queueHash: 'volatile-a' }
  };
}

function runSelfTest() {
  const base = syntheticQueue();
  assertCanonicalContract(base, 'base');

  const rebuildClockOnly = structuredClone(base);
  rebuildClockOnly.generatedAt = '2026-08-27T08:57:35.620Z';
  rebuildClockOnly.proposals[0].updatedAt = '2026-08-27T08:57:35.620Z';
  rebuildClockOnly.integrity.queueHash = 'volatile-b';
  assert(materialHash(base) === materialHash(rebuildClockOnly), 'pure Proposal rebuild clock must be suppressible');

  const sourceChange = structuredClone(rebuildClockOnly);
  sourceChange.source.learningContextSha256 = 'learning-b';
  assert(materialHash(base) !== materialHash(sourceChange), 'Learning provenance change must remain material');

  const stateChange = structuredClone(rebuildClockOnly);
  stateChange.proposals[0].state = 'APPROVED';
  assert(materialHash(base) !== materialHash(stateChange), 'Proposal state change must remain material');

  const priorityChange = structuredClone(rebuildClockOnly);
  priorityChange.proposals[0].priorityScore = 151;
  assert(materialHash(base) !== materialHash(priorityChange), 'Proposal priority change must remain material');

  const decisionChange = structuredClone(rebuildClockOnly);
  decisionChange.proposals[0].decisionBinding = { decisionId: 'DEC-a', exactDecisionMemory: true, authority: 'human-owner' };
  assert(materialHash(base) !== materialHash(decisionChange), 'Decision binding change must remain material');

  const proposalChange = structuredClone(rebuildClockOnly);
  proposalChange.proposals[0].proposedAction = 'Review different evidence.';
  assert(materialHash(base) !== materialHash(proposalChange), 'Proposal action change must remain material');

  const authorityChange = structuredClone(rebuildClockOnly);
  authorityChange.decisionBridge.executionAuthority = 'unexpected';
  assert(materialHash(base) !== materialHash(authorityChange), 'Authority change must remain material');

  const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
  for (const required of [
    `# holding-workflow-definition-proof: ${PROOF_PATH}`,
    `node ${PROOF_PATH}`,
    `node ${PROOF_PATH} --gate /tmp/proposal-queue.previous.json intelligence/proposals/proposal-queue.json`,
    'git show HEAD:intelligence/proposals/proposal-queue.json > /tmp/proposal-queue.previous.json',
    'git restore --source=HEAD -- intelligence/proposals/proposal-queue.json intelligence/proposals/proposal-brief.md intelligence/proposals/proposal-eval.json intelligence/proposals/proposal-decision-eval.json',
    'No material Proposal delta; preserving prior reviewed artifact bytes.'
  ]) assert(workflow.includes(required), `Workflow Proposal material-change contract missing: ${required}`);

  console.log('PROPOSAL MATERIAL-CHANGE DEFINITION PROOF PASS', {
    workflow: WORKFLOW_PATH,
    ignoredVolatileFields: ['generatedAt', 'proposals[*].updatedAt', 'integrity.queueHash'],
    preservedMaterialClasses: ['source-provenance', 'state', 'priority', 'decision-binding', 'proposal-content', 'constraints', 'authority'],
    executionAuthority: 'none'
  });
}

function runGate(previousPath, candidatePath) {
  assert(previousPath && candidatePath, '--gate requires previous and candidate queue paths');
  const previous = readJson(previousPath);
  const candidate = readJson(candidatePath);
  assertCanonicalContract(previous, 'previous');
  assertCanonicalContract(candidate, 'candidate');
  const previousHash = materialHash(previous);
  const candidateHash = materialHash(candidate);
  const materialChange = previousHash !== candidateHash;
  console.log(JSON.stringify({
    version: '0.1-proposal-material-change-gate',
    materialChange,
    previousHash,
    candidateHash,
    ignoredVolatileFields: ['generatedAt', 'proposals[*].updatedAt', 'integrity.queueHash'],
    sourceProvenancePreserved: true,
    decisionBindingPreserved: true,
    authorityPreserved: true,
    executionAuthority: 'none'
  }, null, 2));
  if (!materialChange) process.exit(NO_MATERIAL_CHANGE_EXIT);
}

if (process.argv[2] === '--gate') runGate(process.argv[3], process.argv[4]);
else runSelfTest();
