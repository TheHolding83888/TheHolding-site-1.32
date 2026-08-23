#!/usr/bin/env node
/**
 * THE HOLDING — OWNER ECONOMIC OUTCOME EXPERIENCE ENGINE v0.1
 *
 * Compiles owner-initiated economic decisions + append-only human outcome
 * reviews into a deterministic experience state.
 *
 * No model call. No capital execution. No policy mutation.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FILES = {
  policy: 'intelligence/learning/owner-outcome-review-policy.json',
  decisionLedger: 'intelligence/learning/decision-ledger.json',
  reviewLedger: 'intelligence/learning/owner-outcome-review-ledger.json',
  output: 'intelligence/learning-state/owner-outcome-experience.json',
};
const VERSION = '0.1-owner-economic-outcome-experience';
const ENGINE_VERSION = '0.1-owner-economic-outcome-experience-engine';
const args = new Set(process.argv.slice(2));
const SELF_TEST = args.has('--self-test');

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}
function stableStringify(value) { return JSON.stringify(stableValue(value)); }
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
function writeJson(rel, value) {
  const abs = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function validIsoOrDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function nowIso() {
  const override = process.env.OWNER_OUTCOME_NOW;
  if (!override) return new Date().toISOString();
  const parsed = validIsoOrDate(override);
  if (!parsed) fail('OWNER_OUTCOME_NOW is invalid');
  return parsed;
}
function coreWithoutIntegrity(obj) { const core = { ...obj }; delete core.integrity; return core; }
function decisionCore(entry) { const core = { ...entry }; delete core.integrity; return core; }
function reviewCore(entry) { const core = { ...entry }; delete core.integrity; return core; }

function validateDecisionLedger(ledger) {
  if (ledger?.version !== '0.1-decision-ledger' || !Array.isArray(ledger?.decisions)) fail('Decision ledger schema invalid');
  if (ledger.decisionCount !== ledger.decisions.length) fail('Decision ledger count mismatch');
  let previous = null;
  for (let i = 0; i < ledger.decisions.length; i += 1) {
    const d = ledger.decisions[i];
    if (d?.chain?.previousDecisionHash !== previous) fail(`Decision chain broken at ${i}`);
    const expected = sha256(stableStringify(decisionCore(d)));
    if (d?.integrity?.decisionHash !== expected) fail(`Decision hash mismatch at ${i}`);
    if (d?.authority?.executable !== false || d?.authority?.executionAuthority !== 'none') fail(`Decision ${d?.decisionId ?? i} escaped inert authority`);
    previous = expected;
  }
  if ((ledger.integrity?.chainRootHash ?? null) !== (ledger.decisions[0]?.integrity?.decisionHash ?? null)) fail('Decision ledger root mismatch');
  if ((ledger.integrity?.latestDecisionHash ?? null) !== (ledger.decisions.at(-1)?.integrity?.decisionHash ?? null)) fail('Decision ledger latest mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Decision ledger hash mismatch');
}
function validateReviewLedger(ledger) {
  if (ledger?.version !== '0.1-owner-outcome-review-ledger' || !Array.isArray(ledger?.reviews)) fail('Outcome review ledger schema invalid');
  if (ledger.reviewCount !== ledger.reviews.length) fail('Outcome review ledger count mismatch');
  let previous = null;
  for (let i = 0; i < ledger.reviews.length; i += 1) {
    const r = ledger.reviews[i];
    if (r?.chain?.previousReviewHash !== previous) fail(`Outcome review chain broken at ${i}`);
    const expected = sha256(stableStringify(reviewCore(r)));
    if (r?.integrity?.reviewHash !== expected) fail(`Outcome review hash mismatch at ${i}`);
    if (r?.authority?.executable !== false || r?.authority?.executionAuthority !== 'none') fail(`Outcome review ${r?.reviewId ?? i} escaped inert authority`);
    previous = expected;
  }
  if ((ledger.integrity?.chainRootHash ?? null) !== (ledger.reviews[0]?.integrity?.reviewHash ?? null)) fail('Outcome review ledger root mismatch');
  if ((ledger.integrity?.latestReviewHash ?? null) !== (ledger.reviews.at(-1)?.integrity?.reviewHash ?? null)) fail('Outcome review ledger latest mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Outcome review ledger hash mismatch');
}
function validatePolicy(policy) {
  if (policy?.version !== '0.1-owner-economic-outcome-review-policy') fail('Owner outcome policy version mismatch');
  if (policy?.safety?.executionAuthority !== 'none') fail('Owner outcome policy execution authority drift');
  if (policy?.safety?.capitalExecutionAllowed !== false || policy?.safety?.walletActionAllowed !== false) fail('Owner outcome policy enabled capital/wallet execution');
  if (policy?.lessonPromotion?.causalClaimAllowed !== false) fail('Owner outcome policy unexpectedly allows causal claims');
  if (Number(policy?.lessonPromotion?.minCorroboratingReviewedOutcomes) < 2) fail('Owner outcome lesson promotion threshold must be at least 2');
}
function isOwnerEconomicDecision(decision) {
  return decision?.source?.provenance?.sourceMode === 'owner-initiated'
    && decision?.authorRole === 'owner'
    && decision?.sourceCase?.domain === 'economic'
    && decision?.experience?.preOutcomeCaptured === true;
}
function reviewDirection(status) {
  if (status === 'supported') return 'supported';
  if (status === 'contradicted') return 'contradicted';
  return null;
}
function experienceClass(decision) {
  return `OEC-${sha256(stableStringify({
    domain: decision?.sourceCase?.domain ?? null,
    category: decision?.sourceCase?.category ?? null,
    recommendationClass: decision?.sourceCase?.recommendationClass ?? null,
  })).slice(0, 16)}`;
}
function candidateText(decision, review) {
  if (review.outcomeStatus === 'supported') {
    return `The expected path for ${decision.sourceCase?.category ?? 'this owner decision'} was supported by the reviewed evidence at the recorded horizon.`;
  }
  if (review.outcomeStatus === 'contradicted') {
    return `The expected path for ${decision.sourceCase?.category ?? 'this owner decision'} was contradicted by the reviewed evidence at the recorded horizon.`;
  }
  return null;
}
function learnedText(group) {
  const direction = group.direction;
  const category = group.category ?? 'this decision class';
  return direction === 'supported'
    ? `Across repeated reviewed owner decisions in ${category}, the expected path was consistently supported by later evidence. Preserve this as an observed association for future reasoning, not as proof of causation.`
    : `Across repeated reviewed owner decisions in ${category}, the expected path was consistently contradicted by later evidence. Preserve this as an observed association for future reasoning, not as proof of causation.`;
}

if (SELF_TEST) {
  const decision = {
    decisionId: 'DEC-A',
    sourceCase: { domain: 'economic', category: 'reward-harvest-timing', recommendationClass: 'owner-capital-allocation' },
  };
  const r = { outcomeStatus: 'supported' };
  if (!candidateText(decision, r)?.includes('supported')) fail('candidate self-test failed');
  const cls = experienceClass(decision);
  if (!/^OEC-[0-9a-f]{16}$/.test(cls)) fail('experience class self-test failed');
  console.log(JSON.stringify({ status: 'pass', version: ENGINE_VERSION, executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const generatedAt = nowIso();
const policyLoaded = readJson(FILES.policy);
const decisionLoaded = readJson(FILES.decisionLedger);
const reviewLoaded = readJson(FILES.reviewLedger);
validatePolicy(policyLoaded.data);
validateDecisionLedger(decisionLoaded.data);
validateReviewLedger(reviewLoaded.data);

const policy = policyLoaded.data;
const decisionLedger = decisionLoaded.data;
const reviewLedger = reviewLoaded.data;
const decisions = decisionLedger.decisions.filter(isOwnerEconomicDecision);
const reviewsByDecision = new Map();
for (const review of reviewLedger.reviews) {
  if (!reviewsByDecision.has(review.decisionId)) reviewsByDecision.set(review.decisionId, []);
  reviewsByDecision.get(review.decisionId).push(review);
}
for (const items of reviewsByDecision.values()) items.sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt));

const states = [];
for (const decision of decisions) {
  const reviewOnOrAfter = validIsoOrDate(decision?.experience?.reviewCondition?.reviewOnOrAfter);
  if (!reviewOnOrAfter) fail(`Owner decision ${decision.decisionId} has invalid reviewOnOrAfter`);
  const reviews = reviewsByDecision.get(decision.decisionId) ?? [];
  const effectiveReviews = reviews.filter((r) => !reviews.some((x) => x.supersedesReviewId === r.reviewId));
  if (effectiveReviews.length > 1) fail(`Multiple effective outcome reviews for decision ${decision.decisionId}`);
  const latest = effectiveReviews.at(-1) ?? null;
  let lifecycleState;
  if (latest) lifecycleState = 'reviewed';
  else if (Date.parse(generatedAt) >= Date.parse(reviewOnOrAfter)) lifecycleState = 'review-due';
  else if (Date.parse(generatedAt) > Date.parse(decision.recordedAt)) lifecycleState = 'observing';
  else lifecycleState = 'open';

  const lessonCandidate = latest && policy.lessonPromotion.candidateStatuses.includes(latest.outcomeStatus)
    ? {
        candidateId: `LC-${sha256(stableStringify({ decisionId: decision.decisionId, reviewId: latest.reviewId })).slice(0, 20)}`,
        decisionId: decision.decisionId,
        reviewId: latest.reviewId,
        experienceClass: experienceClass(decision),
        direction: reviewDirection(latest.outcomeStatus),
        createdAt: latest.reviewedAt,
        text: candidateText(decision, latest),
        epistemicStatus: 'candidate-association',
        causalClaim: false,
      }
    : null;

  states.push({
    decisionId: decision.decisionId,
    caseId: decision.caseId,
    caseKey: decision.caseKey,
    experienceClass: experienceClass(decision),
    entity: decision.sourceCase?.entity ?? null,
    category: decision.sourceCase?.category ?? null,
    recommendationClass: decision.sourceCase?.recommendationClass ?? null,
    recordedAt: decision.recordedAt,
    reviewOnOrAfter,
    lifecycleState,
    expectedOutcome: decision.expectedOutcome ?? null,
    evaluationCriterion: decision.experience?.evaluationCriterion ?? null,
    counterevidence: decision.experience?.counterevidence ?? null,
    invalidationCondition: decision.experience?.invalidationCondition ?? null,
    reviewCount: reviews.length,
    latestReview: latest ? {
      reviewId: latest.reviewId,
      reviewedAt: latest.reviewedAt,
      trigger: latest.trigger,
      outcomeStatus: latest.outcomeStatus,
      summary: latest.summary,
      confidence: latest.confidence,
      evidenceCount: latest.evidence?.files?.length ?? 0,
      sourceCommitSha: latest.evidence?.sourceCommitSha ?? null,
    } : null,
    lessonCandidate,
  });
}

const candidateRows = states.map((s) => s.lessonCandidate).filter(Boolean);
const groups = new Map();
for (const state of states) {
  const c = state.lessonCandidate;
  if (!c?.direction) continue;
  const key = `${c.experienceClass}:${c.direction}`;
  if (!groups.has(key)) groups.set(key, {
    experienceClass: c.experienceClass,
    direction: c.direction,
    category: state.category,
    recommendationClass: state.recommendationClass,
    decisionIds: new Set(),
    reviewIds: [],
  });
  const g = groups.get(key);
  g.decisionIds.add(state.decisionId);
  g.reviewIds.push(c.reviewId);
}

const learnedLessons = [];
for (const group of groups.values()) {
  const minReviews = Number(policy.lessonPromotion.minCorroboratingReviewedOutcomes);
  const minDecisions = Number(policy.lessonPromotion.minDistinctDecisionIds);
  if (group.reviewIds.length < minReviews || group.decisionIds.size < minDecisions) continue;
  learnedLessons.push({
    lessonId: `OLL-${sha256(stableStringify({
      experienceClass: group.experienceClass,
      direction: group.direction,
      reviewIds: [...group.reviewIds].sort(),
    })).slice(0, 20)}`,
    experienceClass: group.experienceClass,
    direction: group.direction,
    category: group.category,
    recommendationClass: group.recommendationClass,
    corroboratingReviewCount: group.reviewIds.length,
    distinctDecisionCount: group.decisionIds.size,
    decisionIds: [...group.decisionIds].sort(),
    reviewIds: [...group.reviewIds].sort(),
    text: learnedText(group),
    epistemicStatus: 'learned-association',
    causalClaim: false,
    policyMutationAuthority: 'none',
    executionAuthority: 'none',
  });
}

const result = {
  version: VERSION,
  engineVersion: ENGINE_VERSION,
  generatedAt,
  status: 'ready',
  source: {
    decisionLedgerFile: FILES.decisionLedger,
    decisionLedgerHash: decisionLedger.integrity?.ledgerHash ?? null,
    decisionLedgerSha256: sha256(decisionLoaded.text),
    reviewLedgerFile: FILES.reviewLedger,
    reviewLedgerHash: reviewLedger.integrity?.ledgerHash ?? null,
    reviewLedgerSha256: sha256(reviewLoaded.text),
    policyFile: FILES.policy,
    policySha256: sha256(policyLoaded.text),
  },
  summary: {
    ownerEconomicDecisionCount: decisions.length,
    openCount: states.filter((x) => x.lifecycleState === 'open').length,
    observingCount: states.filter((x) => x.lifecycleState === 'observing').length,
    reviewDueCount: states.filter((x) => x.lifecycleState === 'review-due').length,
    reviewedCount: states.filter((x) => x.lifecycleState === 'reviewed').length,
    lessonCandidateCount: candidateRows.length,
    learnedLessonCount: learnedLessons.length,
  },
  decisions: states,
  lessonCandidates: candidateRows,
  learnedLessons,
  operatingContract: {
    sequence: 'owner decision -> observing -> review due/material change -> evidence-bound human review -> lesson candidate -> repeated-evidence learned association',
    reviewAuthority: 'human owner',
    evidenceAuthority: 'exact repository evidence snapshot bound to review record',
    lessonAuthority: 'deterministic repeated association only',
    causalClaimAuthority: 'none',
    policyChangeAuthority: 'human only',
    executionAuthority: 'none',
  },
  constraints: {
    modelCallPerformed: false,
    capitalExecutionAllowed: false,
    walletActionAllowed: false,
    autonomousPolicyMutationAllowed: false,
    autonomousMethodologyMutationAllowed: false,
    autonomousRepositoryMutationFromOutcomeAllowed: false,
  },
};
result.integrity = { stateHash: sha256(stableStringify(result)) };
writeJson(FILES.output, result);

console.log(JSON.stringify({
  status: 'ready',
  engineVersion: ENGINE_VERSION,
  ownerEconomicDecisions: result.summary.ownerEconomicDecisionCount,
  reviewDue: result.summary.reviewDueCount,
  reviewed: result.summary.reviewedCount,
  lessonCandidates: result.summary.lessonCandidateCount,
  learnedLessons: result.summary.learnedLessonCount,
  executionAuthority: 'none',
}, null, 2));
