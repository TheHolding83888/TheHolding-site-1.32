#!/usr/bin/env node
/**
 * THE HOLDING — BRAIN OWNER CONTEXT OVERLAY v0.2
 *
 * Joins the current Grounded Brain snapshot with compiled owner decision context
 * without changing deterministic reasoning cases or action authority.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const BRAIN_FILE = 'intelligence/brain-intelligence.json';
const CONTEXT_FILE = 'intelligence/owner-context/owner-decision-context.json';
const OUTPUT_FILE = 'intelligence/owner-context/brain-owner-context-overlay.json';
const VERSION = '0.1-brain-owner-context-overlay';

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function readJson(rel) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (!text.trim()) fail(`Required file empty: ${rel}`);
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail(`Invalid JSON ${rel}: ${error.message}`);
  }
  return { text, data };
}

const brainLoaded = readJson(BRAIN_FILE);
const contextLoaded = readJson(CONTEXT_FILE);
const brain = brainLoaded.data;
const context = contextLoaded.data;

if (brain?.version !== '0.1-grounded-reasoning-gateway') {
  fail(`Unexpected Brain version: ${brain?.version}`);
}
if (brain?.constraints?.actionMode !== 'proposal-only') {
  fail('Grounded Brain escaped proposal-only mode');
}
if (!brain?.bridge?.snapshotHash || !brain?.bridge?.inputCompositeHash) {
  fail('Grounded Brain binding hashes missing');
}
if (context?.version !== '0.1-owner-decision-context-runtime') {
  fail(`Unexpected owner context version: ${context?.version}`);
}
if (context?.authority?.executionAuthority !== 'none' || context?.authority?.executable !== false) {
  fail('Owner context overlay received executable authority');
}
if (context?.authority?.marketFactAuthority !== false || context?.authority?.evidenceOverrideAuthority !== false) {
  fail('Owner context overlay gained fact/evidence authority');
}

const brainSha256 = sha256(brainLoaded.text);
const contextSha256 = sha256(contextLoaded.text);

const caseIndex = (brain.reasoningCases ?? []).map((item) => ({
  caseId: item.id,
  domain: item.domain,
  severity: item.severity,
  category: item.category,
  entity: item.entity ?? null,
  recommendationClass: item.recommendationClass,
  actionMode: item.actionMode,
}));

const output = {
  version: VERSION,
  overlayEngineVersion: '0.2-multi-namespace-owner-teaching-overlay',
  status: 'ready-for-contextual-interpretation',
  purpose:
    'Read-only interpretation overlay joining canonical Grounded Brain evidence with explicit owner decision context.',
  sourceBrain: {
    file: BRAIN_FILE,
    sha256: brainSha256,
    version: brain.version,
    reasonerVersion: brain.reasonerVersion,
    generatedAt: brain.generatedAt,
    status: brain.status,
    snapshotHash: brain.bridge.snapshotHash,
    inputCompositeHash: brain.bridge.inputCompositeHash,
    reasoningCaseCount: Array.isArray(brain.reasoningCases) ? brain.reasoningCases.length : 0,
  },
  ownerDecisionContext: {
    file: CONTEXT_FILE,
    sha256: contextSha256,
    version: context.version,
    compilerVersion: context.compilerVersion ?? null,
    asOf: context.asOf,
    sourceCount: context.provenance?.sourceCount ?? null,
    questionCount: context.provenance?.questionCount ?? null,
    questionsCovered: context.provenance?.questionsCovered ?? [],
    audioQuestionCount: context.provenance?.audioQuestionCount ?? context.provenance?.questionCount ?? null,
    audioQuestionsCovered: context.provenance?.audioQuestionsCovered ?? context.provenance?.questionsCovered ?? [],
    textTeachingItemCount: context.provenance?.textTeachingItemCount ?? 0,
    totalTeachingUnits: context.provenance?.totalTeachingUnits ?? context.provenance?.questionCount ?? null,
    teachingNamespaces: context.provenance?.teachingNamespaces ?? [],
    numberingRule: context.provenance?.numberingRule ?? null,
    sourceCompositeHash: context.provenance?.sourceCompositeHash ?? null,
    contextHash: context.contextHash,
    ownerExperience: context.ownerExperience,
    epistemicContract: context.epistemicContract,
    interpretationHints: context.interpretationHints,
    sources: context.sources,
  },
  brainCases: caseIndex,
  interpretationContract: {
    factAuthority: 'grounded-brain-canonical-evidence',
    securityFactAuthority: 'grounded-brain-canonical-security-evidence',
    ownerDecisionContextAuthority: 'explicit-owner-teaching-context-only',
    deterministicActionAuthority: 'grounded-brain-case',
    conflictRule:
      'Owner context may shape interpretation of a proven case but may not override canonical facts, evidence, uncertainty, or deterministic action boundaries.',
    synthesisRule:
      'Use owner context to explain fit, priorities, tradeoffs and likely owner review questions only when a Grounded Brain case or explicit human question makes that context relevant.',
    provenanceRule:
      'Preserve the teaching namespace and source channel. Earlier text teaching and later audio Q&A may reinforce each other but must not be silently presented as one numbered interview sequence.',
    noCaseFabrication: true,
    noFactFabrication: true,
    noAutomaticPolicyPromotion: true,
    noAutomaticCapitalAction: true,
  },
  constraints: {
    proposalOnly: true,
    executionAllowed: false,
    autonomousCapitalActionAllowed: false,
    autonomousBorrowingAllowed: false,
    autonomousSellingAllowed: false,
    autonomousRebalancingAllowed: false,
    autonomousRepositoryCodeMutationAllowed: false,
    autonomousMethodologyMutationAllowed: false,
    sourceDataMutationAllowed: false,
    workflowPlaneMutationAllowed: false,
  },
  integrity: {
    overlayHash: null,
  },
};

output.integrity.overlayHash = sha256(stableStringify({
  ...output,
  integrity: { overlayHash: null },
}));

fs.writeFileSync(
  path.join(ROOT, OUTPUT_FILE),
  JSON.stringify(output, null, 2) + '\n',
  'utf8'
);

console.log(JSON.stringify({
  version: output.version,
  overlayEngineVersion: output.overlayEngineVersion,
  status: output.status,
  brainSnapshotHash: output.sourceBrain.snapshotHash,
  ownerContextHash: output.ownerDecisionContext.contextHash,
  audioQuestionCount: output.ownerDecisionContext.audioQuestionCount,
  textTeachingItemCount: output.ownerDecisionContext.textTeachingItemCount,
  totalTeachingUnits: output.ownerDecisionContext.totalTeachingUnits,
  reasoningCaseCount: output.sourceBrain.reasoningCaseCount,
  overlayHash: output.integrity.overlayHash,
  executionAllowed: output.constraints.executionAllowed,
}, null, 2));
