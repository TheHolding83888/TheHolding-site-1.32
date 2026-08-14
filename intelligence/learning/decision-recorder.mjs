#!/usr/bin/env node
/**
 * THE HOLDING — DECISION RECORDER v0.1
 *
 * Append-only, hash-chained human decision memory for Grounded Brain cases.
 *
 * This file DOES NOT execute decisions. It records an owner decision as inert,
 * public, machine-readable memory bound to the exact Grounded Brain and
 * Cognitive Stack bytes that were current when the decision was recorded.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { verifyGroundedBrainUpstreams } from '../brain-upstream-guard.mjs';

const ROOT = process.cwd();
const FILES = {
  brain: 'intelligence/brain-intelligence.json',
  stack: 'intelligence/cognitive-stack-state.json',
  cognitiveManifest: 'intelligence/cognitive-stack-release.json',
  policy: 'intelligence/learning/decision-policy.json',
  ledger: 'intelligence/learning/decision-ledger.json',
};
const VERSION = '0.1-decision-recorder';
const LEDGER_VERSION = '0.1-decision-ledger';

const args = new Set(process.argv.slice(2));
const VERIFY_BOUND = args.has('--verify-bound-decision');
const SELF_TEST = args.has('--self-test');

function fail(message) { throw new Error(message); }
function readText(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Required file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) fail(`Required file empty: ${rel}`);
  return text;
}
function readJson(rel) {
  const text = readText(rel);
  try { return { text, data: JSON.parse(text) }; }
  catch (error) { fail(`Invalid JSON in ${rel}: ${error.message}`); }
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}
function stableStringify(value) { return JSON.stringify(stableValue(value)); }
function iso(value, label) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) fail(`${label} is not a valid timestamp`);
  return new Date(ms).toISOString();
}
function stableEntity(caseObj) {
  const entity = caseObj?.entity ?? null;
  if (typeof entity === 'string' && /^\d+\s+current findings$/i.test(entity.trim())) return 'current findings';
  return entity;
}
function stableCaseIdentity(caseObj) {
  const identity = {
    domain: caseObj?.domain ?? null,
    category: caseObj?.category ?? null,
    entity: stableEntity(caseObj),
    recommendationClass: caseObj?.recommendationClass ?? null,
  };
  // Persistent mechanism/security cases deliberately keep the original v0.1
  // identity bytes. Generic evidence-review cases are event observations and may
  // legitimately share domain/category/entity/recommendationClass, so only that
  // class receives a per-event discriminator. This preserves every existing
  // owner Decision caseKey while preventing event collisions as Brain grows.
  if (caseObj?.recommendationClass === 'evidence-review') {
    const eventDiscriminator = caseObj?.id ?? caseObj?.signal ?? null;
    if (!eventDiscriminator) fail('evidence-review case requires a stable event discriminator');
    identity.eventDiscriminator = eventDiscriminator;
  }
  return identity;
}
function caseKey(caseObj) {
  return `CK-${sha256(stableStringify(stableCaseIdentity(caseObj))).slice(0, 20)}`;
}
function casePayloadHash(caseObj) {
  return sha256(stableStringify({
    id: caseObj?.id ?? null,
    domain: caseObj?.domain ?? null,
    severity: caseObj?.severity ?? null,
    category: caseObj?.category ?? null,
    entity: caseObj?.entity ?? null,
    signal: caseObj?.signal ?? null,
    whyItMatters: caseObj?.whyItMatters ?? null,
    whatFollows: caseObj?.whatFollows ?? null,
    whatShouldBeDone: caseObj?.whatShouldBeDone ?? null,
    recommendationClass: caseObj?.recommendationClass ?? null,
    riskTier: caseObj?.riskTier ?? null,
    confidence: caseObj?.confidence ?? null,
    actionMode: caseObj?.actionMode ?? null,
  }));
}
function validatePolicy(policy) {
  if (policy?.version !== '0.1-decision-outcome-learning-policy') fail('Unexpected decision policy version');
  if (policy?.mode !== 'evidence-bound-human-decision-memory') fail('Decision policy mode mismatch');
  if (policy?.safety?.capitalExecutionAllowed !== false) fail('Decision policy unexpectedly enables capital execution');
  if (policy?.safety?.repositoryCodeMutationAllowed !== false) fail('Decision policy unexpectedly enables code mutation');
  if (policy?.safety?.decisionRecordsAreExecutable !== false) fail('Decision records must remain inert');
  if (policy?.decisions?.appendOnly !== true) fail('Decision ledger must remain append-only');
}
function ledgerCore(ledger) {
  const core = { ...ledger };
  delete core.integrity;
  return core;
}
function decisionCore(entry) {
  const core = { ...entry };
  delete core.integrity;
  return core;
}
function validateLedger(ledger) {
  if (ledger?.version !== LEDGER_VERSION) fail(`Unexpected decision ledger version: ${ledger?.version}`);
  if (!Array.isArray(ledger?.decisions)) fail('decision-ledger.decisions must be an array');
  if (ledger.decisionCount !== ledger.decisions.length) fail('decision-ledger decisionCount mismatch');
  let previous = null;
  for (let i = 0; i < ledger.decisions.length; i += 1) {
    const entry = ledger.decisions[i];
    if (entry?.chain?.previousDecisionHash !== previous) fail(`Decision chain broken at index ${i}`);
    const expected = sha256(stableStringify(decisionCore(entry)));
    if (entry?.integrity?.decisionHash !== expected) fail(`Decision hash mismatch at index ${i}`);
    previous = expected;
  }
  const root = ledger.decisions[0]?.integrity?.decisionHash ?? null;
  const latest = ledger.decisions.at(-1)?.integrity?.decisionHash ?? null;
  if ((ledger.integrity?.chainRootHash ?? null) !== root) fail('Decision ledger chain root mismatch');
  if ((ledger.integrity?.latestDecisionHash ?? null) !== latest) fail('Decision ledger latest hash mismatch');
  const expectedLedgerHash = sha256(stableStringify(ledgerCore(ledger)));
  if (ledger.integrity?.ledgerHash !== expectedLedgerHash) fail('Decision ledger hash mismatch');
}
function detectSecretLike(text) {
  const patterns = [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\b(?:seed phrase|mnemonic|private key)\s*[:=]/i,
  ];
  return patterns.some((regex) => regex.test(text));
}
function cleanString(value, label, { min = 0, max = 2000, required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) fail(`${label} is required`);
  if (text.length < min) fail(`${label} must be at least ${min} characters`);
  if (text.length > max) fail(`${label} exceeds ${max} characters`);
  if (detectSecretLike(text)) fail(`${label} contains a secret-like marker; decision memory is public by design`);
  return text;
}
function intEnv(name, fallback = null) {
  const raw = process.env[name];
  if ((raw === undefined || raw === '') && fallback !== null) return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n)) fail(`${name} must be an integer`);
  return n;
}
function appendGithubOutput(key, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (!out) return;
  fs.appendFileSync(out, `${key}=${String(value).replace(/\n/g, ' ')}\n`, 'utf8');
}

function verifyCognitiveBinding(brainLoaded, stack, cognitiveManifestLoaded) {
  const brain = brainLoaded.data;
  const brainSha = sha256(brainLoaded.text);
  const cognitiveManifestSha = sha256(cognitiveManifestLoaded.text);
  const cognitiveManifest = cognitiveManifestLoaded.data;
  try { verifyGroundedBrainUpstreams({ root: ROOT, brain }); }
  catch (error) { fail(`Grounded Brain is not current relative to canonical upstreams: ${error.message}`); }
  if (stack?.readyForManualInterpretation !== true) fail('Cognitive Stack is not ready for manual interpretation');
  if (stack?.release?.exactByteMatch !== true) fail('Cognitive Stack static release is not coherent');
  if (stack?.release?.manifestSha256 !== cognitiveManifestSha) fail('Cognitive Stack was built against a different cognitive release manifest; refresh the Cognitive Stack first');
  if (stack?.release?.releaseId !== cognitiveManifest?.releaseId) fail('Cognitive Stack releaseId does not match the current cognitive release manifest');
  if (stack?.chain?.groundedBrain?.sha256 !== brainSha) fail('Cognitive Stack is not bound to the exact current Grounded Brain bytes');
  if (stack?.chain?.groundedBrain?.snapshotHash !== brain?.bridge?.snapshotHash) fail('Cognitive Stack / Brain snapshot hash mismatch');
  if (stack?.chain?.groundedBrain?.exactCanonicalUpstreamBinding !== true) fail('Grounded Brain exact-upstream binding is not current');
  if (stack?.chain?.chatgptBridge?.exactCanonicalUpstreamBinding !== true) fail('ChatGPT Bridge exact-upstream binding is not current');
  if (stack?.chain?.chatgptBridge?.noExecution !== true) fail('ChatGPT Bridge no-execution invariant is not current');
  if (stack?.operatingContract?.executionAuthority !== 'none') fail('Cognitive Stack execution authority is not none');
  return { brain, brainSha, cognitiveManifestSha };
}

if (SELF_TEST) {
  const sample = { domain: 'economic', category: 'adapter-state', entity: 'x', recommendationClass: 'data-gap-resolution' };
  const a = caseKey(sample);
  const b = caseKey({ ...sample });
  if (a !== b || !/^CK-[0-9a-f]{20}$/.test(a)) fail('caseKey self-test failed');
  console.log(JSON.stringify({ status: 'pass', version: VERSION, caseKey: a }, null, 2));
  process.exit(0);
}

const policyLoaded = readJson(FILES.policy);
validatePolicy(policyLoaded.data);
const ledgerLoaded = readJson(FILES.ledger);
validateLedger(ledgerLoaded.data);
const brainLoaded = readJson(FILES.brain);
const stackLoaded = readJson(FILES.stack);
const cognitiveManifestLoaded = readJson(FILES.cognitiveManifest);
const { brain, brainSha, cognitiveManifestSha } = verifyCognitiveBinding(brainLoaded, stackLoaded.data, cognitiveManifestLoaded);

if (VERIFY_BOUND) {
  const decisionId = cleanString(process.env.DECISION_VERIFY_ID, 'DECISION_VERIFY_ID', { required: true, max: 100 });
  const found = ledgerLoaded.data.decisions.find((x) => x.decisionId === decisionId);
  if (!found) fail(`Decision not found: ${decisionId}`);
  if (found.source?.brainSha256 !== brainSha) fail('Bound decision no longer matches current Brain bytes after repository movement');
  if (found.source?.brainSnapshotHash !== brain?.bridge?.snapshotHash) fail('Bound decision no longer matches current Brain snapshot');
  if (found.source?.cognitiveChainHash !== stackLoaded.data?.integrity?.chainHash) fail('Bound decision no longer matches current Cognitive Stack chain hash');
  if (found.source?.cognitiveReleaseManifestSha256 !== cognitiveManifestSha) fail('Bound decision no longer matches current cognitive release manifest');
  console.log(JSON.stringify({ status: 'verified', decisionId, brainSha256: brainSha }, null, 2));
  process.exit(0);
}

const policy = policyLoaded.data;
const caseId = cleanString(process.env.DECISION_CASE_ID, 'DECISION_CASE_ID', { required: true, max: 120 });
const disposition = cleanString(process.env.DECISION_DISPOSITION, 'DECISION_DISPOSITION', { required: true, max: 20 });
if (!policy.decisions.allowedDispositions.includes(disposition)) fail(`Unsupported disposition: ${disposition}`);
const rationale = cleanString(process.env.DECISION_RATIONALE, 'DECISION_RATIONALE', {
  required: true,
  min: Number(policy.decisions.minimumRationaleCharacters),
  max: Number(policy.decisions.maximumRationaleCharacters),
});
const expectedOutcome = cleanString(process.env.DECISION_EXPECTED_OUTCOME, 'DECISION_EXPECTED_OUTCOME', {
  required: false,
  max: Number(policy.decisions.maximumExpectedOutcomeCharacters),
});
const modifiedAction = cleanString(process.env.DECISION_MODIFIED_ACTION, 'DECISION_MODIFIED_ACTION', {
  required: disposition === 'modify',
  max: Number(policy.decisions.maximumModifiedActionCharacters),
});
if (disposition !== 'modify' && modifiedAction) fail('DECISION_MODIFIED_ACTION is only allowed when disposition=modify');
const supersedesDecisionId = cleanString(process.env.DECISION_SUPERSEDES_ID, 'DECISION_SUPERSEDES_ID', { max: 100 });
if (supersedesDecisionId && !ledgerLoaded.data.decisions.some((x) => x.decisionId === supersedesDecisionId)) {
  fail(`Superseded decision does not exist: ${supersedesDecisionId}`);
}
const predictionEvent = cleanString(process.env.DECISION_PREDICTION_EVENT || 'none', 'DECISION_PREDICTION_EVENT', { required: true, max: 64 });
if (!policy.predictions.allowedEvents.includes(predictionEvent)) fail(`Unsupported prediction event: ${predictionEvent}`);
const probabilityBps = predictionEvent === 'none' ? null : intEnv('DECISION_PROBABILITY_BPS', 7000);
const reviewDays = predictionEvent === 'none' ? null : intEnv('DECISION_REVIEW_DAYS', 14);
if (probabilityBps !== null && (probabilityBps < policy.predictions.minimumProbabilityBps || probabilityBps > policy.predictions.maximumProbabilityBps)) {
  fail(`Probability bps out of policy range: ${probabilityBps}`);
}
if (reviewDays !== null && (reviewDays < policy.predictions.minimumReviewDays || reviewDays > policy.predictions.maximumReviewDays)) {
  fail(`Review days out of policy range: ${reviewDays}`);
}

const sourceCase = (brain.reasoningCases ?? []).find((x) => x.id === caseId);
if (!sourceCase) fail(`Current Grounded Brain case not found: ${caseId}`);
if (sourceCase.actionMode !== 'proposal-only') fail('Source Brain case is not proposal-only');
if (!Array.isArray(sourceCase.evidence) || sourceCase.evidence.length === 0) fail('Source Brain case has no evidence');

const recordedAt = new Date().toISOString();
const reviewAt = reviewDays === null ? null : new Date(Date.parse(recordedAt) + reviewDays * 86_400_000).toISOString();
const key = caseKey(sourceCase);
const alreadySuperseded = new Set(ledgerLoaded.data.decisions.map((d) => d.supersedesDecisionId).filter(Boolean));
const effectiveCaseDecisions = ledgerLoaded.data.decisions.filter((d) => d.caseKey === key && !alreadySuperseded.has(d.decisionId));
if (effectiveCaseDecisions.length > 1) fail('Decision ledger has multiple effective decisions for the same stable case; refuse ambiguous correction');
if (supersedesDecisionId) {
  const superseded = ledgerLoaded.data.decisions.find((d) => d.decisionId === supersedesDecisionId);
  if (superseded?.caseKey !== key) fail('A decision may supersede only an earlier decision for the same stable caseKey');
  if (alreadySuperseded.has(supersedesDecisionId)) fail('The requested superseded decision has already been superseded');
} else if (effectiveCaseDecisions.length > 0) {
  fail(`This stable case already has an effective decision (${effectiveCaseDecisions.at(-1).decisionId}); record a correction/update by explicitly superseding it`);
}
const payloadHash = casePayloadHash(sourceCase);
const previousDecisionHash = ledgerLoaded.data.decisions.at(-1)?.integrity?.decisionHash ?? null;
const sequence = ledgerLoaded.data.decisions.length + 1;
const decisionId = `DEC-${sha256(stableStringify({ sequence, recordedAt, caseId, brainSha, disposition, rationale })).slice(0, 20)}`;
const entryCore = {
  decisionId,
  sequence,
  recordedAt,
  authorRole: 'owner',
  caseId,
  caseKey: key,
  disposition,
  rationale,
  expectedOutcome: expectedOutcome || null,
  modifiedAction: modifiedAction || null,
  supersedesDecisionId: supersedesDecisionId || null,
  prediction: {
    event: predictionEvent,
    probabilityBps,
    reviewDays,
    reviewAt,
  },
  sourceCase: {
    payloadHash,
    domain: sourceCase.domain ?? null,
    severity: sourceCase.severity ?? null,
    category: sourceCase.category ?? null,
    entity: sourceCase.entity ?? null,
    recommendationClass: sourceCase.recommendationClass ?? null,
    riskTier: sourceCase.riskTier ?? null,
    confidence: sourceCase.confidence ?? null,
    deterministicAction: sourceCase.whatShouldBeDone ?? null,
    evidenceCount: sourceCase.evidence.length,
    actionMode: sourceCase.actionMode,
  },
  source: {
    brainFile: FILES.brain,
    brainSha256: brainSha,
    brainSnapshotHash: brain.bridge?.snapshotHash ?? null,
    brainInputCompositeHash: brain.bridge?.inputCompositeHash ?? null,
    cognitiveStackFile: FILES.stack,
    cognitiveChainHash: stackLoaded.data?.integrity?.chainHash ?? null,
    cognitiveReleaseId: stackLoaded.data?.release?.releaseId ?? null,
    cognitiveReleaseManifestSha256: cognitiveManifestSha,
  },
  authority: {
    recordType: 'human-decision-memory',
    executable: false,
    executionAuthority: 'none',
    note: 'This record captures an owner decision. It does not execute or authorize capital, repository, methodology, or workflow actions.',
  },
  chain: {
    previousDecisionHash,
  },
};
const decisionHash = sha256(stableStringify(entryCore));
const entry = { ...entryCore, integrity: { decisionHash } };

const next = {
  ...ledgerLoaded.data,
  lastUpdatedAt: recordedAt,
  decisionCount: sequence,
  decisions: [...ledgerLoaded.data.decisions, entry],
};
const nextCore = ledgerCore(next);
next.integrity = {
  chainRootHash: next.decisions[0]?.integrity?.decisionHash ?? null,
  latestDecisionHash: decisionHash,
  ledgerHash: sha256(stableStringify(nextCore)),
};
validateLedger(next);
fs.writeFileSync(path.join(ROOT, FILES.ledger), JSON.stringify(next, null, 2) + '\n', 'utf8');
appendGithubOutput('decision_id', decisionId);
appendGithubOutput('decision_hash', decisionHash);
appendGithubOutput('brain_sha256', brainSha);
appendGithubOutput('cognitive_chain_hash', stackLoaded.data.integrity.chainHash);

console.log(JSON.stringify({
  status: 'recorded',
  version: VERSION,
  decisionId,
  caseId,
  caseKey: key,
  disposition,
  predictionEvent,
  probabilityBps,
  reviewAt,
  decisionHash,
  executionAuthority: 'none',
}, null, 2));
