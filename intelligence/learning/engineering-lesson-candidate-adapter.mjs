#!/usr/bin/env node
/**
 * THE HOLDING — VERIFIED ENGINEERING LESSON CANDIDATE ADAPTER v0.1
 *
 * Extends the existing Decision Outcome Learning Loop with a bounded engineering
 * incident lane:
 *
 *   incident -> bounded cause -> fix -> exact evidence -> verified lesson candidate
 *
 * A verified engineering candidate is NOT a formal owner-decision Lesson, does
 * not prove causation, and cannot mutate policy, code, wallets or capital.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const FILES = {
  ledger: 'intelligence/learning/engineering-incident-ledger.json',
  output: 'intelligence/learning-state/engineering-lesson-candidates.json',
  brief: 'intelligence/learning-state/learning-brief.md',
};
const VERSION = '0.1-engineering-lesson-candidates';
const ENGINE_VERSION = '0.1-engineering-lesson-candidate-adapter';
const START = '<!-- engineering-lessons:start -->';
const END = '<!-- engineering-lessons:end -->';
const args = new Set(process.argv.slice(2));

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
function readText(rel, required = true) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) {
    if (!required) return null;
    fail(`Required engineering-learning file missing: ${rel}`);
  }
  const text = fs.readFileSync(abs, 'utf8');
  if (required && !text.trim()) fail(`Required engineering-learning file empty: ${rel}`);
  return text;
}
function readJson(rel) {
  const text = readText(rel);
  try { return { text, data: JSON.parse(text) }; }
  catch (error) { fail(`Invalid JSON in ${rel}: ${error.message}`); }
}
function incidentCore(incident) { const core = structuredClone(incident); delete core.integrity; return core; }
function ledgerCore(ledger) { const core = structuredClone(ledger); delete core.integrity; return core; }
function outputCore(output) { const core = structuredClone(output); delete core.integrity; return core; }
function validSha(value) { return typeof value === 'string' && /^[0-9a-f]{40}$/.test(value); }
function shortSha(value) { return validSha(value) ? value.slice(0, 12) : 'invalid'; }
function commitEvidenceDetail(kind, evidence) {
  const id = shortSha(evidence?.sha);
  if (kind === 'not-ancestor') return `commit ${id} is not an ancestor of HEAD`;
  if (kind === 'unreadable-subject') return `cannot read commit subject for ${id}`;
  if (kind === 'subject-mismatch') return `ancestor commit ${id} · required subject marker mismatch`;
  if (kind === 'subject-match') return `ancestor commit ${id} · required subject marker matched`;
  return `commit ${id} evidence status unavailable`;
}
function getJsonPath(obj, jsonPath) {
  const parts = String(jsonPath ?? '').split('.').filter(Boolean);
  let cur = obj;
  for (const part of parts) {
    if (cur === null || typeof cur !== 'object' || !(part in cur)) return { found: false, value: undefined };
    cur = cur[part];
  }
  return { found: true, value: cur };
}
function verifyLedger(ledger) {
  if (ledger?.version !== '0.1-engineering-incident-ledger') fail(`Unexpected engineering incident ledger version: ${ledger?.version}`);
  if (!Array.isArray(ledger?.incidents)) fail('Engineering incident ledger incidents missing');
  if (ledger.incidentCount !== ledger.incidents.length) fail('Engineering incident ledger count mismatch');
  let previous = null;
  const ids = new Set();
  for (const [index, incident] of ledger.incidents.entries()) {
    if (!/^ENG-INC-[A-Za-z0-9._-]+$/.test(incident?.incidentId ?? '')) fail(`Invalid incidentId at ${index}`);
    if (ids.has(incident.incidentId)) fail(`Duplicate incidentId: ${incident.incidentId}`);
    ids.add(incident.incidentId);
    if (!incident?.incident || !incident?.boundedCause || !incident?.fix || !incident?.result || !incident?.lessonCandidate || !incident?.epistemicNote) {
      fail(`Engineering incident ${incident.incidentId} is missing incident/cause/fix/result/candidate semantics`);
    }
    if (!Array.isArray(incident.evidence) || incident.evidence.length < 2) fail(`Engineering incident ${incident.incidentId} needs >=2 evidence checks`);
    if (incident?.authority?.formalLesson !== false ||
        incident?.authority?.causalClaimAuthority !== 'none' ||
        incident?.authority?.policyMutationAuthority !== 'none' ||
        incident?.authority?.executionAuthority !== 'none') {
      fail(`Engineering incident ${incident.incidentId} escaped candidate-only authority`);
    }
    if ((incident?.chain?.previousIncidentHash ?? null) !== previous) fail(`Engineering incident chain broken at ${incident.incidentId}`);
    const expected = sha256(stableStringify(incidentCore(incident)));
    if (incident?.integrity?.incidentHash !== expected) fail(`Engineering incident hash mismatch: ${incident.incidentId}`);
    previous = expected;
  }
  const root = ledger.incidents[0]?.integrity?.incidentHash ?? null;
  const latest = ledger.incidents.at(-1)?.integrity?.incidentHash ?? null;
  if ((ledger?.integrity?.chainRootHash ?? null) !== root) fail('Engineering incident ledger root hash mismatch');
  if ((ledger?.integrity?.latestIncidentHash ?? null) !== latest) fail('Engineering incident ledger latest hash mismatch');
  if (ledger?.integrity?.ledgerHash !== sha256(stableStringify(ledgerCore(ledger)))) fail('Engineering incident ledger hash mismatch');
}
function gitCommitEvidence(evidence) {
  if (!validSha(evidence.sha)) return { pass: false, detail: 'invalid commit sha' };
  const ancestry = spawnSync('git', ['merge-base', '--is-ancestor', evidence.sha, 'HEAD'], { cwd: ROOT });
  if (ancestry.status !== 0) return { pass: false, detail: commitEvidenceDetail('not-ancestor', evidence) };
  let subject = '';
  try { subject = execFileSync('git', ['show', '-s', '--format=%s', evidence.sha], { cwd: ROOT, encoding: 'utf8' }).trim(); }
  catch { return { pass: false, detail: commitEvidenceDetail('unreadable-subject', evidence) }; }
  if (evidence.subjectIncludes && !subject.toLowerCase().includes(String(evidence.subjectIncludes).toLowerCase())) {
    return { pass: false, detail: commitEvidenceDetail('subject-mismatch', evidence) };
  }
  return { pass: true, detail: commitEvidenceDetail('subject-match', evidence) };
}
function fileContainsEvidence(evidence) {
  const text = readText(evidence.path, false);
  if (text === null) return { pass: false, detail: `file missing: ${evidence.path}` };
  const needles = Array.isArray(evidence.contains) ? evidence.contains : [];
  if (!needles.length) return { pass: false, detail: 'contains list is empty' };
  const missing = needles.filter((needle) => !text.includes(String(needle)));
  return missing.length
    ? { pass: false, detail: `missing text in ${evidence.path}: ${missing.join(' | ')}` }
    : { pass: true, detail: `${evidence.path} contains ${needles.length} required marker(s)` };
}
function jsonEvidence(evidence, arrayLength = false) {
  let loaded;
  try { loaded = readJson(evidence.path).data; }
  catch (error) { return { pass: false, detail: error.message }; }
  const resolved = getJsonPath(loaded, evidence.jsonPath);
  if (!resolved.found) return { pass: false, detail: `JSON path missing: ${evidence.path}#${evidence.jsonPath}` };
  if (arrayLength) {
    if (!Array.isArray(resolved.value)) return { pass: false, detail: `JSON path is not an array: ${evidence.path}#${evidence.jsonPath}` };
    const pass = resolved.value.length === evidence.value;
    return { pass, detail: `${evidence.path}#${evidence.jsonPath} length=${resolved.value.length}; expected=${evidence.value}` };
  }
  const pass = stableStringify(resolved.value) === stableStringify(evidence.value);
  return { pass, detail: `${evidence.path}#${evidence.jsonPath}=${JSON.stringify(resolved.value)}; expected=${JSON.stringify(evidence.value)}` };
}
function verifyEvidence(evidence) {
  if (evidence?.kind === 'commit-ancestor') return gitCommitEvidence(evidence);
  if (evidence?.kind === 'file-contains-all') return fileContainsEvidence(evidence);
  if (evidence?.kind === 'json-equals') return jsonEvidence(evidence, false);
  if (evidence?.kind === 'json-array-length') return jsonEvidence(evidence, true);
  return { pass: false, detail: `unsupported evidence kind: ${evidence?.kind ?? 'missing'}` };
}
function semantic(value) {
  const clone = structuredClone(value);
  delete clone.generatedAt;
  delete clone.integrity;
  return stableStringify(clone);
}
function renderBriefSection(output) {
  return [
    START,
    '## Verified engineering experience',
    '',
    `Verified engineering lesson candidates: ${output.summary.verifiedCandidateCount}`,
    `Pending engineering incident records: ${output.summary.pendingEvidenceCount}`,
    '',
    'These are evidence-backed engineering associations inside the existing Learning Loop. They are separate from formal owner-decision `Lessons`, do not prove causation, and cannot mutate policy or execution authority.',
    END,
  ].join('\n');
}
function updateBrief(output) {
  const current = readText(FILES.brief);
  const section = renderBriefSection(output);
  let base = current;
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start >= 0 && end >= start) base = current.slice(0, start).trimEnd() + '\n';
  else base = current.trimEnd() + '\n';
  fs.writeFileSync(path.join(ROOT, FILES.brief), `${base}\n${section}\n`, 'utf8');
}

if (args.has('--self-test')) {
  const sample = { a: 1, b: { c: 2 } };
  if (stableStringify(sample) !== '{"a":1,"b":{"c":2}}') fail('stable stringify self-test failed');
  if (getJsonPath({ a: { b: [1, 2] } }, 'a.b').value.length !== 2) fail('json path self-test failed');
  const sampleSha = '1111111111111111111111111111111111111111';
  if (commitEvidenceDetail('subject-match', { sha: sampleSha }) !== 'ancestor commit 111111111111 · required subject marker matched') fail('commit evidence detail self-test failed');
  console.log(JSON.stringify({ status: 'pass', engineVersion: ENGINE_VERSION, executionAuthority: 'none' }, null, 2));
  process.exit(0);
}

const loaded = readJson(FILES.ledger);
const ledger = loaded.data;
verifyLedger(ledger);

const candidates = ledger.incidents.map((incident) => {
  const evidenceChecks = incident.evidence.map((evidence) => {
    const result = verifyEvidence(evidence);
    return { evidence, pass: result.pass === true, detail: result.detail };
  });
  const verified = evidenceChecks.length >= 2 && evidenceChecks.every((x) => x.pass === true);
  return {
    incidentId: incident.incidentId,
    domain: incident.domain,
    recordedAt: incident.recordedAt,
    status: verified ? 'verified-candidate' : 'pending-evidence',
    incident: incident.incident,
    boundedCause: incident.boundedCause,
    fix: incident.fix,
    observedResult: incident.result,
    lessonCandidate: incident.lessonCandidate,
    epistemicNote: incident.epistemicNote,
    evidenceCheckCount: evidenceChecks.length,
    passedEvidenceCheckCount: evidenceChecks.filter((x) => x.pass).length,
    evidenceChecks,
    authority: {
      formalLesson: false,
      causalClaimAuthority: 'none',
      policyMutationAuthority: 'none',
      executionAuthority: 'none',
    },
  };
});

const candidateCore = {
  version: VERSION,
  engineVersion: ENGINE_VERSION,
  source: {
    incidentLedgerFile: FILES.ledger,
    incidentLedgerHash: ledger.integrity.ledgerHash,
  },
  summary: {
    incidentCount: candidates.length,
    verifiedCandidateCount: candidates.filter((x) => x.status === 'verified-candidate').length,
    pendingEvidenceCount: candidates.filter((x) => x.status === 'pending-evidence').length,
    formalLessonCount: 0,
  },
  candidates,
  operatingContract: {
    sequence: 'engineering incident -> bounded cause -> fix -> exact repository evidence -> verified lesson candidate -> future human/manual interpretation',
    lessonAuthority: 'candidate association only; formal owner-decision Lessons remain separate',
    causalClaimAuthority: 'none',
    policyChangeAuthority: 'human only',
    executionAuthority: 'none',
  },
  constraints: {
    modelCallPerformed: false,
    externalApiRequired: false,
    automaticPolicyMutationAllowed: false,
    automaticRepositoryCodeMutationAllowed: false,
    walletActionAllowed: false,
    capitalExecutionAllowed: false,
  },
};

const existingText = readText(FILES.output, false);
let existing = null;
if (existingText) {
  try { existing = JSON.parse(existingText); } catch { existing = null; }
}
let output;
if (existing && existing.version === VERSION && semantic(existing) === semantic(candidateCore)) {
  output = existing;
  console.log('Engineering lesson candidate semantics unchanged; preserving prior generatedAt/integrity bytes.');
} else {
  output = { ...candidateCore, generatedAt: new Date().toISOString() };
  output.integrity = { stateHash: sha256(stableStringify(outputCore(output))) };
  fs.mkdirSync(path.dirname(path.join(ROOT, FILES.output)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, FILES.output), JSON.stringify(output, null, 2) + '\n', 'utf8');
}
updateBrief(output);

console.log(JSON.stringify({
  status: 'ready',
  engineVersion: ENGINE_VERSION,
  incidentCount: output.summary.incidentCount,
  verifiedEngineeringLessonCandidates: output.summary.verifiedCandidateCount,
  pendingEvidence: output.summary.pendingEvidenceCount,
  formalLessonsCreated: 0,
  causalClaimAuthority: 'none',
  executionAuthority: 'none',
}, null, 2));
