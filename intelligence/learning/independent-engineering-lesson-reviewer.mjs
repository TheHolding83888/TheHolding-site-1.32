#!/usr/bin/env node
/**
 * THE HOLDING — INDEPENDENT ENGINEERING LESSON REVIEWER v0.1
 *
 * Independently verifies the engineering incident ledger and generated
 * engineering lesson candidates. Candidate != formal Lesson; no causal,
 * policy-mutation or execution authority is granted.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FILES = {
  ledger: 'intelligence/learning/engineering-incident-ledger.json',
  output: 'intelligence/learning-state/engineering-lesson-candidates.json',
  brief: 'intelligence/learning-state/learning-brief.md',
};
const REVIEWER_VERSION = '0.1-independent-engineering-lesson-reviewer';
const START = '<!-- engineering-lessons:start -->';
const END = '<!-- engineering-lessons:end -->';
const args = new Set(process.argv.slice(2));

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stableValue(value[k])]));
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
function coreWithoutIntegrity(obj) { const core = structuredClone(obj); delete core.integrity; return core; }
function incidentCore(obj) { const core = structuredClone(obj); delete core.integrity; return core; }

if (args.has('--self-test')) {
  if (sha256('x').length !== 64) fail('sha256 self-test failed');
  console.log(JSON.stringify({ status: 'pass', reviewerVersion: REVIEWER_VERSION }, null, 2));
  process.exit(0);
}

const ledger = readJson(FILES.ledger).data;
const output = readJson(FILES.output).data;
const brief = readText(FILES.brief);

if (ledger?.version !== '0.1-engineering-incident-ledger' || !Array.isArray(ledger?.incidents)) fail('Engineering incident ledger schema invalid');
if (ledger.incidentCount !== ledger.incidents.length) fail('Engineering incident count mismatch');
let previous = null;
for (const incident of ledger.incidents) {
  if ((incident?.chain?.previousIncidentHash ?? null) !== previous) fail(`Engineering incident chain broken: ${incident?.incidentId ?? 'unknown'}`);
  if (incident?.authority?.formalLesson !== false ||
      incident?.authority?.causalClaimAuthority !== 'none' ||
      incident?.authority?.policyMutationAuthority !== 'none' ||
      incident?.authority?.executionAuthority !== 'none') {
    fail(`Engineering incident authority escaped candidate-only boundary: ${incident?.incidentId ?? 'unknown'}`);
  }
  const hash = sha256(stableStringify(incidentCore(incident)));
  if (incident?.integrity?.incidentHash !== hash) fail(`Engineering incident hash mismatch: ${incident?.incidentId ?? 'unknown'}`);
  previous = hash;
}
if ((ledger?.integrity?.chainRootHash ?? null) !== (ledger.incidents[0]?.integrity?.incidentHash ?? null)) fail('Engineering ledger root hash mismatch');
if ((ledger?.integrity?.latestIncidentHash ?? null) !== (ledger.incidents.at(-1)?.integrity?.incidentHash ?? null)) fail('Engineering ledger latest hash mismatch');
if (ledger?.integrity?.ledgerHash !== sha256(stableStringify(coreWithoutIntegrity(ledger)))) fail('Engineering ledger hash mismatch');

if (output?.version !== '0.1-engineering-lesson-candidates') fail('Engineering candidate output version mismatch');
if (output?.source?.incidentLedgerHash !== ledger.integrity.ledgerHash) fail('Engineering candidates are not bound to current incident ledger');
if (output?.integrity?.stateHash !== sha256(stableStringify(coreWithoutIntegrity(output)))) fail('Engineering candidate output hash mismatch');
if (!Array.isArray(output?.candidates) || output.candidates.length !== ledger.incidentCount) fail('Engineering candidate coverage mismatch');
if (output?.summary?.incidentCount !== output.candidates.length) fail('Engineering candidate summary count mismatch');
const verified = output.candidates.filter((x) => x.status === 'verified-candidate');
const pending = output.candidates.filter((x) => x.status === 'pending-evidence');
if (output?.summary?.verifiedCandidateCount !== verified.length) fail('Verified engineering candidate count mismatch');
if (output?.summary?.pendingEvidenceCount !== pending.length) fail('Pending engineering candidate count mismatch');
if (output?.summary?.formalLessonCount !== 0) fail('Engineering candidates were upgraded into formal Lessons');
for (const candidate of output.candidates) {
  if (!Array.isArray(candidate?.evidenceChecks) || candidate.evidenceChecks.length < 2) fail(`Engineering candidate lacks evidence checks: ${candidate?.incidentId ?? 'unknown'}`);
  const passed = candidate.evidenceChecks.filter((x) => x.pass === true).length;
  if (candidate.passedEvidenceCheckCount !== passed) fail(`Evidence pass count mismatch: ${candidate.incidentId}`);
  if (candidate.status === 'verified-candidate' && passed !== candidate.evidenceChecks.length) fail(`Unverified evidence was promoted: ${candidate.incidentId}`);
  if (candidate?.authority?.formalLesson !== false ||
      candidate?.authority?.causalClaimAuthority !== 'none' ||
      candidate?.authority?.policyMutationAuthority !== 'none' ||
      candidate?.authority?.executionAuthority !== 'none') {
    fail(`Engineering candidate authority escaped boundary: ${candidate.incidentId}`);
  }
}
if (output?.operatingContract?.causalClaimAuthority !== 'none' || output?.operatingContract?.executionAuthority !== 'none') fail('Engineering output authority changed');
if (output?.constraints?.automaticPolicyMutationAllowed !== false ||
    output?.constraints?.automaticRepositoryCodeMutationAllowed !== false ||
    output?.constraints?.walletActionAllowed !== false ||
    output?.constraints?.capitalExecutionAllowed !== false) {
  fail('Engineering output constraints escaped fail-closed boundary');
}

if (!brief.includes(START) || !brief.includes(END)) fail('Learning brief engineering section missing');
if (!brief.includes(`Verified engineering lesson candidates: ${verified.length}`)) fail('Learning brief verified engineering count mismatch');
if (!brief.includes(`Pending engineering incident records: ${pending.length}`)) fail('Learning brief pending engineering count mismatch');
if (!brief.includes('separate from formal owner-decision `Lessons`')) fail('Learning brief does not preserve candidate/formal-Lesson separation');

console.log(JSON.stringify({
  status: 'pass',
  reviewerVersion: REVIEWER_VERSION,
  incidentCount: output.summary.incidentCount,
  verifiedEngineeringLessonCandidates: verified.length,
  pendingEvidence: pending.length,
  formalLessonsCreated: 0,
  causalClaimAuthority: 'none',
  executionAuthority: 'none',
}, null, 2));
