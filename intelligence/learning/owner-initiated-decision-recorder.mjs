#!/usr/bin/env node
/**
 * THE HOLDING — OWNER-INITIATED DECISION RECORDER v0.1
 *
 * Records a material owner-authored economic decision into the same canonical
 * append-only Decision Ledger used by Brain-originated decisions.
 *
 * This recorder DOES NOT execute capital, wallet, repository, methodology, or
 * workflow actions. It captures pre-outcome evidence and fails closed if the
 * coherent Cognitive Stack bytes move before publication.
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
const VERSION = '0.1-owner-initiated-decision-recorder';
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
function ledgerCore(ledger) { const core = { ...ledger }; delete core.integrity; return core; }
function decisionCore(entry) { const core = { ...entry }; delete core.integrity; return core; }
function detectSecretLike(text) {
  return [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/,
    /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/,
    /\bsk-ant-[A-Za-z0-9_-]{20,}\b/,
    /\bAKIA[0-9A-Z]{16}\b/,
    /\b(?:seed phrase|mnemonic|private key)\s*[:=]/i,
  ].some((regex) => regex.test(text));
}
function cleanString(value, label, { min = 0, max = 2400, required = false } = {}) {
  const text = String(value ?? '').trim();
  if (required && !text) fail(`${label} is required`);
  if (text.length < min) fail(`${label} must be at least ${min} characters`);
  if (text.length > max) fail(`${label} exceeds ${max} characters`);
  if (detectSecretLike(text)) fail(`${label} contains a secret-like marker; Decision Memory is public`);
  return text;
}
function validReview(value) {
  const text = cleanString(value, 'DECISION_REVIEW_ON_OR_AFTER', { required: true, max: 64 });
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text);
  const ms = Date.parse(dateOnly ? `${text}T00:00:00Z` : text);
  if (!Number.isFinite(ms)) fail('DECISION_REVIEW_ON_OR_AFTER must be YYYY-MM-DD or a valid timestamp');
  return dateOnly ? text : new Date(ms).toISOString();
}
function stableIdentity({ domain, category, entity, recommendationClass }) {
  return { domain, category, entity, recommendationClass };
}
function caseKey(x) { return `CK-${sha256(stableStringify(stableIdentity(x))).slice(0, 20)}`; }
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
    if (entry?.authority?.executable !== false || entry?.authority?.executionAuthority !== 'none') {
      fail(`Decision ${entry?.decisionId ?? i} escaped inert authority`);
    }
    previous = expected;
  }
  const root = ledger.decisions[0]?.integrity?.decisionHash ?? null;
  const latest = ledger.decisions.at(-1)?.integrity?.decisionHash ?? null;
  if ((ledger.integrity?.chainRootHash ?? null) !== root) fail('Decision ledger chain root mismatch');
  if ((ledger.integrity?.latestDecisionHash ?? null) !== latest) fail('Decision ledger latest hash mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(ledgerCore(ledger)))) fail('Decision ledger hash mismatch');
}
function validatePolicy(policy) {
  if (policy?.version !== '0.1-decision-outcome-learning-policy') fail('Unexpected decision policy version');
  const owner = policy?.ownerInitiatedDecisions;
  if (owner?.enabled !== true || owner?.version !== '0.1-pre-outcome-owner-economic-decision') fail('Owner-initiated policy is not enabled');
  if (owner?.outcomeStateAtRecord !== 'open') fail('Owner-initiated decisions must enter as open outcomes');
  if (policy?.safety?.decisionRecordsAreExecutable !== false) fail('Decision records must remain inert');
  if (policy?.safety?.capitalExecutionAllowed !== false || policy?.safety?.walletActionAllowed !== false) fail('Capital/wallet execution must remain disabled');
}
function coherentSource(brainLoaded, stackLoaded, manifestLoaded) {
  const brain = brainLoaded.data;
  const stack = stackLoaded.data;
  const manifestSha = sha256(manifestLoaded.text);
  const brainSha = sha256(brainLoaded.text);
  try { verifyGroundedBrainUpstreams({ root: ROOT, brain }); }
  catch (error) { fail(`Grounded Brain is not current relative to canonical upstreams: ${error.message}`); }
  if (stack?.readyForManualInterpretation !== true) fail('Cognitive Stack is not ready for manual interpretation');
  if (stack?.release?.exactByteMatch !== true) fail('Cognitive Stack release is not exact-byte coherent');
  if (stack?.release?.manifestSha256 !== manifestSha) fail('Cognitive Stack release manifest binding is stale');
  if (stack?.chain?.groundedBrain?.sha256 !== brainSha) fail('Cognitive Stack is not bound to exact current Brain bytes');
  if (stack?.chain?.groundedBrain?.snapshotHash !== brain?.bridge?.snapshotHash) fail('Cognitive Stack / Brain snapshot mismatch');
  if (stack?.chain?.groundedBrain?.exactCanonicalUpstreamBinding !== true) fail('Brain exact canonical upstream binding is false');
  if (stack?.chain?.chatgptBridge?.exactCanonicalUpstreamBinding !== true || stack?.chain?.chatgptBridge?.noExecution !== true) fail('Bridge exact/no-execution binding is not current');
  if (stack?.operatingContract?.executionAuthority !== 'none') fail('Cognitive Stack execution authority is not none');
  return { brain, stack, brainSha, manifestSha };
}
function appendGithubOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${String(value).replace(/\n/g, ' ')}\n`, 'utf8');
}

if (SELF_TEST) {
  const sample = { domain: 'economic', category: 'reward-harvest-timing', entity: 'defitea.eth', recommendationClass: 'owner-capital-allocation' };
  const key = caseKey(sample);
  if (!/^CK-[0-9a-f]{20}$/.test(key) || key !== caseKey({ ...sample })) fail('owner caseKey self-test failed');
  console.log(JSON.stringify({ status: 'pass', version: VERSION, caseKey: key, executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const policyLoaded = readJson(FILES.policy);
validatePolicy(policyLoaded.data);
const ledgerLoaded = readJson(FILES.ledger);
validateLedger(ledgerLoaded.data);
const brainLoaded = readJson(FILES.brain);
const stackLoaded = readJson(FILES.stack);
const manifestLoaded = readJson(FILES.cognitiveManifest);
const coherent = coherentSource(brainLoaded, stackLoaded, manifestLoaded);

if (VERIFY_BOUND) {
  const decisionId = cleanString(process.env.DECISION_VERIFY_ID, 'DECISION_VERIFY_ID', { required: true, max: 100 });
  const found = ledgerLoaded.data.decisions.find((x) => x.decisionId === decisionId);
  if (!found) fail(`Decision not found: ${decisionId}`);
  if (found?.authority?.sourceMode !== 'owner-initiated') fail('Decision is not owner-initiated');
  if (found.source?.brainSha256 !== coherent.brainSha) fail('Bound decision no longer matches current Brain bytes');
  if (found.source?.brainSnapshotHash !== coherent.brain?.bridge?.snapshotHash) fail('Bound decision no longer matches current Brain snapshot');
  if (found.source?.cognitiveChainHash !== coherent.stack?.integrity?.chainHash) fail('Bound decision no longer matches current Cognitive Stack chain');
  if (found.source?.cognitiveReleaseManifestSha256 !== coherent.manifestSha) fail('Bound decision no longer matches current cognitive release manifest');
  console.log(JSON.stringify({ status: 'verified', decisionId, sourceMode: 'owner-initiated', executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const ownerCfg = policyLoaded.data.ownerInitiatedDecisions;
const domain = cleanString(process.env.DECISION_DOMAIN || 'economic', 'DECISION_DOMAIN', { required: true, max: 64 });
if (!ownerCfg.allowedDomains.includes(domain)) fail(`Unsupported owner-initiated domain: ${domain}`);
const category = cleanString(process.env.DECISION_CATEGORY, 'DECISION_CATEGORY', { required: true, max: 120 });
const entity = cleanString(process.env.DECISION_ENTITY, 'DECISION_ENTITY', { required: true, max: 200 });
const recommendationClass = cleanString(process.env.DECISION_RECOMMENDATION_CLASS || 'owner-capital-allocation', 'DECISION_RECOMMENDATION_CLASS', { required: true, max: 120 });
if (!ownerCfg.allowedRecommendationClasses.includes(recommendationClass)) fail(`Unsupported owner recommendation class: ${recommendationClass}`);
if (!(policyLoaded.data.experienceEligibility?.decisionWorthyRecommendationClasses ?? []).includes(recommendationClass)) {
  fail('Owner recommendation class is not decision-worthy under the current policy');
}
const disposition = cleanString(process.env.DECISION_DISPOSITION, 'DECISION_DISPOSITION', { required: true, max: 20 });
if (!policyLoaded.data.decisions.allowedDispositions.includes(disposition)) fail(`Unsupported disposition: ${disposition}`);
const rationale = cleanString(process.env.DECISION_RATIONALE, 'DECISION_RATIONALE', { required: true, min: policyLoaded.data.decisions.minimumRationaleCharacters, max: policyLoaded.data.decisions.maximumRationaleCharacters });
const expectedOutcome = cleanString(process.env.DECISION_EXPECTED_OUTCOME, 'DECISION_EXPECTED_OUTCOME', { required: true, max: policyLoaded.data.decisions.maximumExpectedOutcomeCharacters });
const evaluationCriterion = cleanString(process.env.DECISION_EVALUATION_CRITERION, 'DECISION_EVALUATION_CRITERION', { required: true });
const reviewOnOrAfter = validReview(process.env.DECISION_REVIEW_ON_OR_AFTER);
const counterevidence = cleanString(process.env.DECISION_COUNTEREVIDENCE, 'DECISION_COUNTEREVIDENCE', { required: true });
const invalidationCondition = cleanString(process.env.DECISION_INVALIDATION_CONDITION, 'DECISION_INVALIDATION_CONDITION', { required: true });
const deferredAlternative = cleanString(process.env.DECISION_DEFERRED_ALTERNATIVE, 'DECISION_DEFERRED_ALTERNATIVE', { required: true });
const intendedUse = cleanString(process.env.DECISION_INTENDED_USE, 'DECISION_INTENDED_USE', { max: 1800 });
const confidence = cleanString(process.env.DECISION_CONFIDENCE, 'DECISION_CONFIDENCE', { max: 40 }) || null;
const evidenceNote = cleanString(process.env.DECISION_EVIDENCE_NOTE, 'DECISION_EVIDENCE_NOTE', { max: 1800 }) || null;
const supersedesDecisionId = cleanString(process.env.DECISION_SUPERSEDES_ID, 'DECISION_SUPERSEDES_ID', { max: 100 });

const syntheticCase = {
  domain,
  category,
  entity,
  recommendationClass,
};
const key = caseKey(syntheticCase);
const superseded = new Set(ledgerLoaded.data.decisions.map((d) => d.supersedesDecisionId).filter(Boolean));
const effective = ledgerLoaded.data.decisions.filter((d) => d.caseKey === key && !superseded.has(d.decisionId));
if (effective.length > 1) fail('Multiple effective decisions exist for this owner caseKey');
if (supersedesDecisionId) {
  const prior = ledgerLoaded.data.decisions.find((d) => d.decisionId === supersedesDecisionId);
  if (!prior) fail('Superseded decision does not exist');
  if (prior.caseKey !== key) fail('Owner decision may supersede only the same stable caseKey');
  if (superseded.has(supersedesDecisionId)) fail('Requested decision is already superseded');
} else if (effective.length) {
  fail(`This owner case already has an effective decision (${effective.at(-1).decisionId}); supersede explicitly`);
}

const recordedAt = new Date().toISOString();
const sequence = ledgerLoaded.data.decisions.length + 1;
const caseId = `OWNER-${sha256(stableStringify({ key, recordedAt, entity, category })).slice(0, 20)}`;
const previousDecisionHash = ledgerLoaded.data.decisions.at(-1)?.integrity?.decisionHash ?? null;
const decisionId = `DEC-${sha256(stableStringify({ sequence, recordedAt, caseId, coherentBrain: coherent.brainSha, disposition, rationale })).slice(0, 20)}`;

const sourceCase = {
  payloadHash: sha256(stableStringify({
    sourceMode: 'owner-initiated',
    domain,
    category,
    entity,
    recommendationClass,
    rationale,
    expectedOutcome,
    evaluationCriterion,
    reviewOnOrAfter,
    counterevidence,
    invalidationCondition,
    deferredAlternative,
    intendedUse: intendedUse || null,
  })),
  domain,
  severity: 'owner-review',
  category,
  entity,
  recommendationClass,
  riskTier: 'owner-defined',
  confidence,
  deterministicAction: null,
  evidenceCount: 1,
  actionMode: 'proposal-only',
};

const entryCore = {
  decisionId,
  sequence,
  recordedAt,
  authorRole: 'owner',
  caseId,
  caseKey: key,
  disposition,
  rationale,
  expectedOutcome,
  modifiedAction: null,
  supersedesDecisionId: supersedesDecisionId || null,
  prediction: {
    event: 'none',
    probabilityBps: null,
    reviewDays: null,
    reviewAt: null,
  },
  experience: {
    version: ownerCfg.version,
    status: 'open',
    preOutcomeCaptured: true,
    evaluationCriterion,
    reviewCondition: {
      reviewOnOrAfter,
      amountThreshold: null,
      materialChangeTrigger: true,
    },
    counterevidence,
    invalidationCondition,
    deferredAlternative,
    intendedUse: intendedUse || null,
    confidence,
    evidenceNote,
    calibrationEligibility: ownerCfg.calibrationEligibility,
  },
  sourceCase,
  source: {
    brainFile: FILES.brain,
    brainSha256: coherent.brainSha,
    brainSnapshotHash: coherent.brain?.bridge?.snapshotHash ?? null,
    brainInputCompositeHash: coherent.brain?.bridge?.inputCompositeHash ?? null,
    cognitiveStackFile: FILES.stack,
    cognitiveChainHash: coherent.stack?.integrity?.chainHash ?? null,
    cognitiveReleaseId: coherent.stack?.release?.releaseId ?? null,
    cognitiveReleaseManifestSha256: coherent.manifestSha,
    provenance: {
      sourceMode: 'owner-initiated',
      authorRole: 'owner',
      peerOwnerStatement: false,
      directBrainCase: false,
      note: 'The decision is authored by the owner and context-bound to the exact coherent Cognitive Stack; the Brain did not originate this decision.',
    },
  },
  authority: {
    recordType: 'human-decision-memory',
    sourceMode: 'owner-initiated',
    executable: false,
    executionAuthority: 'none',
    note: 'This record captures an owner decision. It does not execute or authorize capital, repository, methodology, or workflow actions.',
  },
  chain: { previousDecisionHash },
};
const decisionHash = sha256(stableStringify(entryCore));
const entry = { ...entryCore, integrity: { decisionHash } };
const next = {
  ...ledgerLoaded.data,
  lastUpdatedAt: recordedAt,
  decisionCount: sequence,
  decisions: [...ledgerLoaded.data.decisions, entry],
};
next.integrity = {
  chainRootHash: next.decisions[0]?.integrity?.decisionHash ?? null,
  latestDecisionHash: decisionHash,
  ledgerHash: sha256(stableStringify(ledgerCore(next))),
};
validateLedger(next);
fs.writeFileSync(path.join(ROOT, FILES.ledger), JSON.stringify(next, null, 2) + '\n', 'utf8');

appendGithubOutput('decision_id', decisionId);
appendGithubOutput('decision_hash', decisionHash);
appendGithubOutput('brain_sha256', coherent.brainSha);
appendGithubOutput('cognitive_chain_hash', coherent.stack.integrity.chainHash);
console.log(JSON.stringify({
  status: 'recorded',
  version: VERSION,
  decisionId,
  caseId,
  caseKey: key,
  sourceMode: 'owner-initiated',
  disposition,
  experienceStatus: 'open',
  reviewOnOrAfter,
  calibrationEligibleNow: false,
  executionAuthority: 'none',
}, null, 2));
