#!/usr/bin/env node
/**
 * THE HOLDING — INDEPENDENT OWNER OUTCOME EXPERIENCE REVIEWER v0.1
 *
 * Recomputes owner-economic outcome state integrity, review-ledger integrity,
 * decision bindings, historical evidence hashes, lifecycle semantics and
 * lesson-promotion thresholds independently from the producer.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const FILES = {
  policy: 'intelligence/learning/owner-outcome-review-policy.json',
  decisionLedger: 'intelligence/learning/decision-ledger.json',
  reviewLedger: 'intelligence/learning/owner-outcome-review-ledger.json',
  output: 'intelligence/learning-state/owner-outcome-experience.json',
};
const VERSION = '0.1-independent-owner-outcome-experience-reviewer';
const args = new Set(process.argv.slice(2));
const SELF_TEST = args.has('--self-test');

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
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
function coreWithoutIntegrity(obj) { const core = { ...obj }; delete core.integrity; return core; }
function decisionCore(entry) { const core = { ...entry }; delete core.integrity; return core; }
function reviewCore(entry) { const core = { ...entry }; delete core.integrity; return core; }
function gitFileBytes(commit, file) {
  return execFileSync('git', ['show', `${commit}:${file}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
}
function verifyDecisionLedger(ledger) {
  if (ledger?.version !== '0.1-decision-ledger' || !Array.isArray(ledger?.decisions)) fail('Decision ledger schema invalid');
  if (ledger.decisionCount !== ledger.decisions.length) fail('Decision ledger count mismatch');
  let previous = null;
  for (let i = 0; i < ledger.decisions.length; i += 1) {
    const d = ledger.decisions[i];
    if (d?.chain?.previousDecisionHash !== previous) fail(`Decision chain broken at ${i}`);
    const expected = sha256(stableStringify(decisionCore(d)));
    if (d?.integrity?.decisionHash !== expected) fail(`Decision hash mismatch at ${i}`);
    previous = expected;
  }
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Decision ledger hash mismatch');
}
function verifyReviewLedger(ledger) {
  if (ledger?.version !== '0.1-owner-outcome-review-ledger' || !Array.isArray(ledger?.reviews)) fail('Outcome review ledger schema invalid');
  if (ledger.reviewCount !== ledger.reviews.length) fail('Outcome review count mismatch');
  let previous = null;
  for (let i = 0; i < ledger.reviews.length; i += 1) {
    const r = ledger.reviews[i];
    if (r?.chain?.previousReviewHash !== previous) fail(`Outcome review chain broken at ${i}`);
    const expected = sha256(stableStringify(reviewCore(r)));
    if (r?.integrity?.reviewHash !== expected) fail(`Outcome review hash mismatch at ${i}`);
    if (r?.authority?.executable !== false || r?.authority?.executionAuthority !== 'none') fail(`Outcome review ${r?.reviewId ?? i} escaped inert authority`);
    previous = expected;
  }
  if ((ledger.integrity?.chainRootHash ?? null) !== (ledger.reviews[0]?.integrity?.reviewHash ?? null)) fail('Outcome review root mismatch');
  if ((ledger.integrity?.latestReviewHash ?? null) !== (ledger.reviews.at(-1)?.integrity?.reviewHash ?? null)) fail('Outcome review latest mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Outcome review ledger hash mismatch');
}
function isOwnerEconomicDecision(decision) {
  return decision?.source?.provenance?.sourceMode === 'owner-initiated'
    && decision?.authorRole === 'owner'
    && decision?.sourceCase?.domain === 'economic'
    && decision?.experience?.preOutcomeCaptured === true;
}
function experienceClass(decision) {
  return `OEC-${sha256(stableStringify({
    domain: decision?.sourceCase?.domain ?? null,
    category: decision?.sourceCase?.category ?? null,
    recommendationClass: decision?.sourceCase?.recommendationClass ?? null,
  })).slice(0, 16)}`;
}

if (SELF_TEST) {
  const x = experienceClass({ sourceCase: { domain: 'economic', category: 'x', recommendationClass: 'owner-capital-allocation' } });
  if (!/^OEC-[0-9a-f]{16}$/.test(x)) fail('experience class self-test failed');
  console.log(JSON.stringify({ status: 'pass', version: VERSION, executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const policyLoaded = readJson(FILES.policy);
const decisionLoaded = readJson(FILES.decisionLedger);
const reviewLoaded = readJson(FILES.reviewLedger);
const outputLoaded = readJson(FILES.output);
const policy = policyLoaded.data;
const decisionLedger = decisionLoaded.data;
const reviewLedger = reviewLoaded.data;
const output = outputLoaded.data;

if (policy?.version !== '0.1-owner-economic-outcome-review-policy') fail('Owner outcome policy version mismatch');
if (policy?.safety?.executionAuthority !== 'none' || policy?.lessonPromotion?.causalClaimAllowed !== false) fail('Owner outcome policy authority drift');
verifyDecisionLedger(decisionLedger);
verifyReviewLedger(reviewLedger);

if (output?.version !== '0.1-owner-economic-outcome-experience') fail('Owner outcome experience version mismatch');
if (output?.engineVersion !== '0.1-owner-economic-outcome-experience-engine') fail('Owner outcome experience engine version mismatch');
if (output?.operatingContract?.executionAuthority !== 'none' || output?.operatingContract?.causalClaimAuthority !== 'none') fail('Owner outcome experience authority drift');
if (output?.constraints?.capitalExecutionAllowed !== false || output?.constraints?.autonomousPolicyMutationAllowed !== false) fail('Owner outcome experience safety boundary drift');

const expectedOutputHash = sha256(stableStringify(coreWithoutIntegrity(output)));
if (output?.integrity?.stateHash !== expectedOutputHash) fail('Owner outcome experience integrity hash mismatch');
if (output?.source?.decisionLedgerHash !== decisionLedger?.integrity?.ledgerHash) fail('Owner outcome experience decision-ledger binding mismatch');
if (output?.source?.reviewLedgerHash !== reviewLedger?.integrity?.ledgerHash) fail('Owner outcome experience review-ledger binding mismatch');
if (output?.source?.decisionLedgerSha256 !== sha256(decisionLoaded.text)) fail('Owner outcome experience decision-ledger byte binding mismatch');
if (output?.source?.reviewLedgerSha256 !== sha256(reviewLoaded.text)) fail('Owner outcome experience review-ledger byte binding mismatch');
if (output?.source?.policySha256 !== sha256(policyLoaded.text)) fail('Owner outcome experience policy binding mismatch');

const decisions = decisionLedger.decisions.filter(isOwnerEconomicDecision);
if (output?.summary?.ownerEconomicDecisionCount !== decisions.length) fail('Owner economic decision count mismatch');
const byDecision = new Map(decisions.map((d) => [d.decisionId, d]));
const reviewsByDecision = new Map();
for (const review of reviewLedger.reviews) {
  const decision = byDecision.get(review.decisionId);
  if (!decision) fail(`Outcome review points to missing/non-owner-economic decision: ${review.reviewId}`);
  if (review.caseId !== decision.caseId || review.caseKey !== decision.caseKey) fail(`Outcome review decision identity mismatch: ${review.reviewId}`);
  const commit = review?.evidence?.sourceCommitSha;
  if (!/^[0-9a-f]{40}$/i.test(commit ?? '')) fail(`Outcome review source commit invalid: ${review.reviewId}`);
  const files = review?.evidence?.files;
  if (!Array.isArray(files) || files.length < Number(policy.evidence.minimumFiles) || files.length > Number(policy.evidence.maximumFiles)) fail(`Outcome review evidence count invalid: ${review.reviewId}`);
  const compositeRows = [];
  const seen = new Set();
  for (const item of files) {
    if (seen.has(item.file)) fail(`Duplicate outcome evidence file: ${review.reviewId}`);
    seen.add(item.file);
    if (!(policy.evidence.allowedRoles ?? []).includes(item.role)) fail(`Outcome evidence role invalid: ${review.reviewId}`);
    let bytes;
    try { bytes = gitFileBytes(commit, item.file); } catch { fail(`Historical outcome evidence missing: ${review.reviewId} ${item.file}`); }
    if (sha256(bytes) !== item.sha256) fail(`Historical outcome evidence hash mismatch: ${review.reviewId} ${item.file}`);
    compositeRows.push({ file: item.file, role: item.role, sha256: item.sha256 });
  }
  if (review.evidence.evidenceCompositeHash !== sha256(stableStringify(compositeRows))) fail(`Outcome evidence composite hash mismatch: ${review.reviewId}`);
  if (!reviewsByDecision.has(review.decisionId)) reviewsByDecision.set(review.decisionId, []);
  reviewsByDecision.get(review.decisionId).push(review);
}

if (!Array.isArray(output?.decisions) || output.decisions.length !== decisions.length) fail('Owner outcome decision state coverage mismatch');
const outputByDecision = new Map(output.decisions.map((x) => [x.decisionId, x]));
for (const decision of decisions) {
  const state = outputByDecision.get(decision.decisionId);
  if (!state) fail(`Missing owner outcome state: ${decision.decisionId}`);
  if (state.experienceClass !== experienceClass(decision)) fail(`Owner outcome experience class mismatch: ${decision.decisionId}`);
  const all = reviewsByDecision.get(decision.decisionId) ?? [];
  const superseded = new Set(all.map((r) => r.supersedesReviewId).filter(Boolean));
  const effective = all.filter((r) => !superseded.has(r.reviewId));
  if (effective.length > 1) fail(`Multiple effective owner outcome reviews: ${decision.decisionId}`);
  const latest = effective.at(-1) ?? null;
  if (latest) {
    if (state.lifecycleState !== 'reviewed') fail(`Reviewed decision state mismatch: ${decision.decisionId}`);
    if (state.latestReview?.reviewId !== latest.reviewId || state.latestReview?.outcomeStatus !== latest.outcomeStatus) fail(`Latest owner outcome review mismatch: ${decision.decisionId}`);
  } else if (state.lifecycleState === 'reviewed') {
    fail(`Owner outcome state reviewed without effective review: ${decision.decisionId}`);
  }
}

const candidates = Array.isArray(output?.lessonCandidates) ? output.lessonCandidates : [];
for (const candidate of candidates) {
  if (!['supported', 'contradicted'].includes(candidate.direction)) fail(`Lesson candidate direction invalid: ${candidate.candidateId}`);
  if (candidate.epistemicStatus !== 'candidate-association' || candidate.causalClaim !== false) fail(`Lesson candidate epistemic boundary invalid: ${candidate.candidateId}`);
}
const learned = Array.isArray(output?.learnedLessons) ? output.learnedLessons : [];
const minReviews = Number(policy.lessonPromotion.minCorroboratingReviewedOutcomes);
const minDecisions = Number(policy.lessonPromotion.minDistinctDecisionIds);
for (const lesson of learned) {
  if (lesson.corroboratingReviewCount < minReviews || lesson.distinctDecisionCount < minDecisions) fail(`Learned lesson lacks corroboration: ${lesson.lessonId}`);
  if (lesson.epistemicStatus !== 'learned-association' || lesson.causalClaim !== false) fail(`Learned lesson epistemic boundary invalid: ${lesson.lessonId}`);
  if (lesson.policyMutationAuthority !== 'none' || lesson.executionAuthority !== 'none') fail(`Learned lesson authority drift: ${lesson.lessonId}`);
}

if (output.summary.lessonCandidateCount !== candidates.length) fail('Lesson candidate count mismatch');
if (output.summary.learnedLessonCount !== learned.length) fail('Learned lesson count mismatch');
if (output.summary.reviewedCount !== output.decisions.filter((x) => x.lifecycleState === 'reviewed').length) fail('Reviewed state count mismatch');
if (output.summary.reviewDueCount !== output.decisions.filter((x) => x.lifecycleState === 'review-due').length) fail('Review-due state count mismatch');

console.log(JSON.stringify({ status: 'pass', reviewerVersion: VERSION, ownerEconomicDecisions: decisions.length, reviews: reviewLedger.reviewCount, reviewed: output.summary.reviewedCount, reviewDue: output.summary.reviewDueCount, lessonCandidates: candidates.length, learnedLessons: learned.length, executionAuthority: 'none' }, null, 2));
