#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
const mf = 'intelligence/proposals/proposal-release.json';
const m = JSON.parse(fs.readFileSync(mf,'utf8'));
if (m.version !== '0.1-proposal-release') throw new Error(`Unexpected Proposal release version: ${m.version}`);
for (const x of m.staticFiles ?? []) {
  if (!fs.existsSync(x.file)) throw new Error(`Missing static Proposal file: ${x.file}`);
  const b = fs.readFileSync(x.file);
  const h = crypto.createHash('sha256').update(b).digest('hex');
  if (h !== x.sha256) throw new Error(`Proposal static release mismatch: ${x.file}`);
  if (b.length !== x.bytes) throw new Error(`Proposal static byte-size mismatch: ${x.file}`);
}
console.log('Proposal static release coherence PASS', {releaseId:m.releaseId, staticFileCount:m.staticFiles?.length ?? 0});
