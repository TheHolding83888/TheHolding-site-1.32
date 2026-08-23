#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const MANIFEST = 'intelligence/proposals/proposal-release.json';
const EXPECTED_FILES = [
  '.github/workflows/update-proposal-work-queue.yml',
  'intelligence/proposals/README.md',
  'intelligence/proposals/proposal-policy.json',
  'intelligence/proposals/proposal-schema.json',
  'intelligence/proposals/proposal-engine.mjs',
  'intelligence/proposals/independent-proposal-reviewer.mjs',
  'intelligence/proposals/proposal-decision-policy.json',
  'intelligence/proposals/proposal-decision-bridge.mjs',
  'intelligence/proposals/independent-proposal-decision-reviewer.mjs',
].sort();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
if (manifest.version !== '0.2.3-proposal-release') throw new Error(`Unexpected Proposal release version: ${manifest.version}`);
if (manifest.releaseId !== '0.2.3-source-change-materialization') throw new Error(`Unexpected Proposal releaseId: ${manifest.releaseId}`);
const actual = (manifest.staticFiles ?? []).map(x => x.file).sort();
if (JSON.stringify(actual) !== JSON.stringify(EXPECTED_FILES)) {
  throw new Error(`Proposal static file contract mismatch: ${JSON.stringify(actual)}`);
}
for (const x of manifest.staticFiles ?? []) {
  if (!fs.existsSync(x.file)) throw new Error(`Missing static Proposal file: ${x.file}`);
  const bytes = fs.readFileSync(x.file);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  if (hash !== x.sha256) throw new Error(`Proposal static release mismatch: ${x.file}`);
  if (bytes.length !== x.bytes) throw new Error(`Proposal static byte-size mismatch: ${x.file}`);
}
console.log('Proposal static release coherence PASS', {
  releaseId: manifest.releaseId,
  staticFileCount: manifest.staticFiles?.length ?? 0,
});
