#!/usr/bin/env node
/**
 * THE HOLDING — OWNER ECONOMIC OUTCOME REVIEW RECORDER v0.1
 *
 * Appends one human-authored outcome review to the canonical owner outcome
 * review ledger. The review is bound to exact repository evidence bytes at the
 * current commit. It does not execute capital or mutate policy/methodology.
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
};
const VERSION = '0.1-owner-economic-outcome-review-recorder';
const args = new Set(process.argv.slice(2));
const SELF_TEST = args.has('--self-test');
const VERIFY_REVIEW = args.has('--verify-review');

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
  if (detectSecretLike(text)) fail(`${label} contains a secret-like marker; outcome memory is public`);
  return text;
}
function validIsoOrDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();
  const ms = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00Z` : text);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function validateDecisionLedger(ledger) {
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
  if ((ledger.integrity?.chainRootHash ?? null) !== (ledger.reviews[0]?.integrity?.reviewHash ?? null)) fail('Outcome review root mismatch');
  if ((ledger.integrity?.latestReviewHash ?? null) !== (ledger.reviews.at(-1)?.integrity?.reviewHash ?? null)) fail('Outcome review latest mismatch');
  if (ledger.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Outcome review ledger hash mismatch');
}
function validatePolicy(policy) {
  if (policy?.version !== '0.1-owner-economic-outcome-review-policy') fail('Owner outcome policy version mismatch');
  if (policy?.safety?.executionAuthority !== 'none' || policy?.safety?.reviewsExecutable !== false) fail('Owner outcome review policy escaped inert authority');
}
function isSafeEvidencePath(policy, rel) {
  if (!rel || path.isAbsolute(rel)) return false;
  const normalized = path.posix.normalize(rel.replaceAll('\\', '/'));
  if (normalized.startsWith('../') || normalized.includes('/../')) return false;
  if (!(policy.evidence.allowedPrefixes ?? []).some((prefix) => normalized.startsWith(prefix))) return false;
  if ((policy.evidence.deniedPrefixes ?? []).some((prefix) => normalized.startsWith(prefix))) return false;
  if ((policy.evidence.deniedFiles ?? []).includes(normalized)) return false;
  if (!(policy.evidence.allowedExtensions ?? []).some((ext) => normalized.endsWith(ext))) return false;
  return true;
}
function sourceMetadata(rel, text) {
  const meta = { generatedAt: null, observedAt: null, asOf: null, version: null };
  if (!rel.endsWith('.json')) return meta;
  try {
    const data = JSON.parse(text);
    meta.generatedAt = typeof data?.generatedAt === 'string' ? data.generatedAt : null;
    meta.observedAt = typeof data?.observedAt === 'string' ? data.observedAt : null;
    meta.asOf = typeof data?.asOf === 'string' ? data.asOf : null;
    meta.version = typeof data?.version === 'string' ? data.version : null;
  } catch {}
  return meta;
}
function parseEvidenceManifest(policy, raw) {
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (error) { fail(`OUTCOME_EVIDENCE_JSON must be valid JSON: ${error.message}`); }
  if (!Array.isArray(parsed)) fail('OUTCOME_EVIDENCE_JSON must be an array');
  const min = Number(policy.evidence.minimumFiles);
  const max = Number(policy.evidence.maximumFiles);
  if (parsed.length < min || parsed.length > max) fail(`Evidence file count must be between ${min} and ${max}`);
  const seen = new Set();
  return parsed.map((item, index) => {
    const file = cleanString(item?.file, `evidence[${index}].file`, { required: true, max: 300 }).replaceAll('\\', '/');
    const role = cleanString(item?.role ?? 'supporting', `evidence[${index}].role`, { required: true, max: 40 });
    if (!(policy.evidence.allowedRoles ?? []).includes(role)) fail(`Unsupported evidence role: ${role}`);
    if (!isSafeEvidencePath(policy, file)) fail(`Unsafe or disallowed evidence path: ${file}`);
    if (seen.has(file)) fail(`Duplicate evidence file: ${file}`);
    seen.add(file);
    const text = readText(file);
    return { file, role, sha256: sha256(text), ...sourceMetadata(file, text) };
  });
}
function gitText(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}
function gitFileBytes(commit, file) {
  return execFileSync('git', ['show', `${commit}:${file}`], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
}
function verifyEvidenceAtCommit(review) {
  const commit = review?.evidence?.sourceCommitSha;
  if (!/^[0-9a-f]{40}$/i.test(commit ?? '')) fail(`Review ${review?.reviewId ?? 'unknown'} has invalid source commit`);
  for (const item of review?.evidence?.files ?? []) {
    if (!item?.file || !/^[0-9a-f]{64}$/i.test(item?.sha256 ?? '')) fail(`Review ${review.reviewId} has invalid evidence entry`);
    if (sha256(gitFileBytes(commit, item.file)) !== item.sha256) fail(`Historical evidence hash mismatch for ${review.reviewId}: ${item.file}`);
  }
}
function appendGithubOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${String(value).replace(/\n/g, ' ')}\n`, 'utf8');
}

if (SELF_TEST) {
  const samplePolicy = {
    evidence: {
      allowedPrefixes: ['intelligence/'],
      deniedPrefixes: ['intelligence/project-memory/'],
      deniedFiles: ['intelligence/learning/decision-ledger.json'],
      allowedExtensions: ['.json'],
    },
  };
  if (!isSafeEvidencePath(samplePolicy, 'intelligence/market-data/market-data.json')) fail('safe evidence path self-test failed');
  if (isSafeEvidencePath(samplePolicy, 'intelligence/project-memory/CURRENT.md')) fail('denied evidence path self-test failed');
  console.log(JSON.stringify({ status: 'pass', version: VERSION, executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const policyLoaded = readJson(FILES.policy);
const decisionLoaded = readJson(FILES.decisionLedger);
const reviewLoaded = readJson(FILES.reviewLedger);
validatePolicy(policyLoaded.data);
validateDecisionLedger(decisionLoaded.data);
validateReviewLedger(reviewLoaded.data);

if (VERIFY_REVIEW) {
  const reviewId = cleanString(process.env.OUTCOME_VERIFY_REVIEW_ID, 'OUTCOME_VERIFY_REVIEW_ID', { required: true, max: 100 });
  const review = reviewLoaded.data.reviews.find((x) => x.reviewId === reviewId);
  if (!review) fail(`Outcome review not found: ${reviewId}`);
  verifyEvidenceAtCommit(review);
  console.log(JSON.stringify({ status: 'verified', reviewId, evidenceFiles: review.evidence.files.length, executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const policy = policyLoaded.data;
const decisionId = cleanString(process.env.OUTCOME_DECISION_ID, 'OUTCOME_DECISION_ID', { required: true, max: 100 });
const decision = decisionLoaded.data.decisions.find((x) => x.decisionId === decisionId);
if (!decision) fail(`Decision not found: ${decisionId}`);
if (decision?.source?.provenance?.sourceMode !== 'owner-initiated' || decision?.sourceCase?.domain !== 'economic' || decision?.experience?.preOutcomeCaptured !== true) {
  fail('Outcome reviews may only bind to owner-initiated economic pre-outcome decisions');
}

const trigger = cleanString(process.env.OUTCOME_TRIGGER, 'OUTCOME_TRIGGER', { required: true, max: 40 });
if (!(policy.lifecycle.reviewTriggers ?? []).includes(trigger)) fail(`Unsupported review trigger: ${trigger}`);
const outcomeStatus = cleanString(process.env.OUTCOME_STATUS, 'OUTCOME_STATUS', { required: true, max: 40 });
if (!(policy.lifecycle.allowedOutcomeStatuses ?? []).includes(outcomeStatus)) fail(`Unsupported outcome status: ${outcomeStatus}`);
const confidence = cleanString(process.env.OUTCOME_CONFIDENCE || 'unknown', 'OUTCOME_CONFIDENCE', { required: true, max: 40 });
if (!(policy.lifecycle.allowedConfidence ?? []).includes(confidence)) fail(`Unsupported outcome confidence: ${confidence}`);
const summary = cleanString(process.env.OUTCOME_SUMMARY, 'OUTCOME_SUMMARY', { required: true, min: Number(policy.review.minimumSummaryCharacters), max: Number(policy.review.maximumTextCharacters) });
const criterionAssessment = cleanString(process.env.OUTCOME_CRITERION_ASSESSMENT, 'OUTCOME_CRITERION_ASSESSMENT', { required: true, max: Number(policy.review.maximumTextCharacters) });
const counterevidenceAssessment = cleanString(process.env.OUTCOME_COUNTEREVIDENCE_ASSESSMENT, 'OUTCOME_COUNTEREVIDENCE_ASSESSMENT', { required: true, max: Number(policy.review.maximumTextCharacters) });
const invalidationAssessment = cleanString(process.env.OUTCOME_INVALIDATION_ASSESSMENT, 'OUTCOME_INVALIDATION_ASSESSMENT', { required: true, max: Number(policy.review.maximumTextCharacters) });
const materialChange = cleanString(process.env.OUTCOME_MATERIAL_CHANGE, 'OUTCOME_MATERIAL_CHANGE', { required: trigger === 'material-change', max: Number(policy.review.maximumTextCharacters) }) || null;
const supersedesReviewId = cleanString(process.env.OUTCOME_SUPERSEDES_REVIEW_ID, 'OUTCOME_SUPERSEDES_REVIEW_ID', { max: 100 }) || null;

const now = new Date().toISOString();
const reviewBoundary = validIsoOrDate(decision.experience?.reviewCondition?.reviewOnOrAfter);
if (!reviewBoundary) fail(`Decision ${decisionId} has invalid reviewOnOrAfter`);
if (trigger === 'horizon' && Date.parse(now) < Date.parse(reviewBoundary)) fail(`Decision review horizon has not been reached: ${reviewBoundary}`);
if (trigger === 'material-change' && !materialChange) fail('Material-change review requires OUTCOME_MATERIAL_CHANGE');

const priorReviews = reviewLoaded.data.reviews.filter((r) => r.decisionId === decisionId);
const superseded = new Set(reviewLoaded.data.reviews.map((r) => r.supersedesReviewId).filter(Boolean));
const effective = priorReviews.filter((r) => !superseded.has(r.reviewId));
if (effective.length > 1) fail(`Multiple effective outcome reviews already exist for ${decisionId}`);
if (supersedesReviewId) {
  const prior = reviewLoaded.data.reviews.find((r) => r.reviewId === supersedesReviewId);
  if (!prior) fail('Superseded outcome review does not exist');
  if (prior.decisionId !== decisionId) fail('Outcome review may supersede only a review for the same decision');
  if (superseded.has(supersedesReviewId)) fail('Requested outcome review is already superseded');
} else if (effective.length) {
  fail(`Decision ${decisionId} already has an effective outcome review (${effective.at(-1).reviewId}); supersede explicitly`);
}

const evidenceFiles = parseEvidenceManifest(policy, cleanString(process.env.OUTCOME_EVIDENCE_JSON, 'OUTCOME_EVIDENCE_JSON', { required: true, max: 12000 }));
const sourceCommitSha = gitText('rev-parse', 'HEAD');
if (!/^[0-9a-f]{40}$/i.test(sourceCommitSha)) fail('Unable to determine source commit SHA');

const reviewedAt = now;
const sequence = reviewLoaded.data.reviews.length + 1;
const previousReviewHash = reviewLoaded.data.reviews.at(-1)?.integrity?.reviewHash ?? null;
const reviewId = `ORV-${sha256(stableStringify({ sequence, decisionId, reviewedAt, outcomeStatus, sourceCommitSha, evidence: evidenceFiles })).slice(0, 20)}`;

const entryCore = {
  reviewId,
  sequence,
  reviewedAt,
  authorRole: 'owner',
  decisionId,
  caseId: decision.caseId,
  caseKey: decision.caseKey,
  trigger,
  materialChange,
  outcomeStatus,
  confidence,
  summary,
  criterionAssessment,
  counterevidenceAssessment,
  invalidationAssessment,
  supersedesReviewId,
  evidence: {
    sourceCommitSha,
    files: evidenceFiles,
    evidenceCompositeHash: sha256(stableStringify(evidenceFiles.map((x) => ({ file: x.file, role: x.role, sha256: x.sha256 })))),
  },
  authority: {
    recordType: 'human-outcome-review-memory',
    executable: false,
    executionAuthority: 'none',
    note: 'This review records observed evidence about a prior owner decision. It does not execute or authorize capital, repository, methodology, policy, or workflow actions.',
  },
  chain: { previousReviewHash },
};
const reviewHash = sha256(stableStringify(entryCore));
const entry = { ...entryCore, integrity: { reviewHash } };
const next = { ...reviewLoaded.data, lastUpdatedAt: reviewedAt, reviewCount: sequence, reviews: [...reviewLoaded.data.reviews, entry] };
next.integrity = {
  chainRootHash: next.reviews[0]?.integrity?.reviewHash ?? null,
  latestReviewHash: reviewHash,
  ledgerHash: sha256(stableStringify(coreWithoutIntegrity(next))),
};
validateReviewLedger(next);
fs.writeFileSync(path.join(ROOT, FILES.reviewLedger), JSON.stringify(next, null, 2) + '\n', 'utf8');

appendGithubOutput('review_id', reviewId);
appendGithubOutput('decision_id', decisionId);
appendGithubOutput('source_commit_sha', sourceCommitSha);
console.log(JSON.stringify({ status: 'recorded', version: VERSION, reviewId, decisionId, trigger, outcomeStatus, evidenceFiles: evidenceFiles.length, sourceCommitSha, executionAuthority: 'none' }, null, 2));
