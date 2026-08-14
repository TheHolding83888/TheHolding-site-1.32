import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const candidateRoot = path.resolve(process.argv[2] || '.');
const baselineRoot = path.resolve(process.argv[3] || candidateRoot);
const locked = [
  'verification/production-boundary-guard-v1.mjs',
  'verification/production-boundary-self-lock-v1.mjs',
  '.github/workflows/production-boundary-guard.yml'
];
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const failures = [];

for (const rel of locked) {
  const base = path.join(baselineRoot, rel);
  const candidate = path.join(candidateRoot, rel);
  if (!fs.existsSync(base)) continue; // bootstrap only; after first merge the lock becomes active.
  if (!fs.existsSync(candidate)) {
    failures.push(`self-protected guard file deleted: ${rel}`);
    continue;
  }
  if (digest(base) !== digest(candidate)) failures.push(`self-protected guard file modified: ${rel}`);
}

if (failures.length) {
  console.error('PRODUCTION BOUNDARY SELF-LOCK: FAIL');
  for (const item of failures) console.error(`- ${item}`);
  console.error('Changing the production guard requires an explicit owner-controlled administrative maintenance procedure, not an ordinary PR.');
  process.exit(1);
}

console.log('PRODUCTION BOUNDARY SELF-LOCK: GREEN');
