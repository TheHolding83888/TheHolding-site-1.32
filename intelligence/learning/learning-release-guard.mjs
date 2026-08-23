#!/usr/bin/env node
/**
 * THE HOLDING — LEARNING LOOP RELEASE GUARD v0.2
 *
 * Fail-closed exact-byte deployment coherence guard for the static Decision &
 * Outcome Learning components, including the owner-economic outcome review lane.
 *
 * Mutable append-only ledgers and generated learning state are intentionally not
 * release-manifest members; the static code/policy/workflow plane is exact-bound
 * while evidence memory remains append-only and independently integrity-checked.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const MANIFEST = 'intelligence/learning/learning-release.json';
const GUARD_VERSION = '0.2-owner-outcome-static-release-coherence';

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function readText(rel) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Learning release file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) fail(`Learning release file empty: ${rel}`);
  return text;
}

const manifestText = readText(MANIFEST);
let manifest;
try { manifest = JSON.parse(manifestText); }
catch (error) { fail(`Invalid Learning release manifest: ${error.message}`); }
if (manifest?.version !== '0.1-learning-release') fail(`Unexpected Learning release version: ${manifest?.version}`);
if (manifest?.releaseId !== '0.1-decision-outcome-learning-production') fail(`Unexpected Learning releaseId: ${manifest?.releaseId}`);

const REQUIRED_FILES = [
  'intelligence/learning/decision-recorder.mjs',
  'intelligence/learning/owner-initiated-decision-recorder.mjs',
  'intelligence/learning/decision-learning-engine.mjs',
  'intelligence/learning/independent-learning-reviewer.mjs',
  'intelligence/learning/decision-policy.json',
  'intelligence/learning/owner-outcome-review-policy.json',
  'intelligence/learning/owner-outcome-review-recorder.mjs',
  'intelligence/learning/owner-outcome-experience-engine.mjs',
  'intelligence/learning/independent-owner-outcome-experience-reviewer.mjs',
  'intelligence/learning/learning-release-guard.mjs',
  '.github/workflows/update-learning-loop.yml',
  '.github/workflows/record-brain-decision.yml',
  '.github/workflows/record-owner-economic-decision.yml',
  '.github/workflows/record-owner-economic-outcome-review.yml',
  '.github/workflows/security-sentinel.yml',
  'intelligence/cognitive-stack-release.json',
];

if (!Array.isArray(manifest?.files) || manifest.files.length !== REQUIRED_FILES.length) fail('Learning release manifest file set is incomplete');
const manifestFiles = manifest.files.map((x) => x?.file).sort();
const requiredFiles = [...REQUIRED_FILES].sort();
if (JSON.stringify(manifestFiles) !== JSON.stringify(requiredFiles)) fail('Learning release manifest does not contain the exact required static file set');

const seen = new Set();
const vector = [];
for (const item of manifest.files) {
  if (!item?.file || !/^[0-9a-f]{64}$/i.test(item?.sha256 ?? '')) fail('Learning release manifest contains invalid file/SHA entry');
  if (seen.has(item.file)) fail(`Duplicate Learning release file: ${item.file}`);
  seen.add(item.file);
  if (path.isAbsolute(item.file) || path.posix.normalize(item.file).includes('../')) fail(`Unsafe Learning release path: ${item.file}`);
  const text = readText(item.file);
  const actual = sha256(text);
  if (actual !== item.sha256) {
    fail(`Learning release coherence failure: ${item.file}\nrequired ${item.sha256}\nactual   ${actual}`);
  }
  vector.push({ file: item.file, sha256: actual, exactByteMatch: true });
}

console.log(JSON.stringify({
  status: 'pass',
  guardVersion: GUARD_VERSION,
  releaseId: manifest.releaseId,
  manifestSha256: sha256(manifestText),
  fileCount: vector.length,
  exactByteMatch: true,
  mutableEvidenceExcludedFromRelease: [
    'intelligence/learning/decision-ledger.json',
    'intelligence/learning/owner-outcome-review-ledger.json',
    'intelligence/learning-state/**',
  ],
  files: vector,
}, null, 2));
