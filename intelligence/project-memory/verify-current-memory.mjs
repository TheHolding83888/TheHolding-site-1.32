#!/usr/bin/env node
import fs from 'node:fs';

const current = fs.readFileSync('intelligence/project-memory/CURRENT.md','utf8');
const security = JSON.parse(fs.readFileSync('security/security-intelligence.json','utf8'));
const c = security?.severityCounts ?? {};
const expected = `Security Sentinel (latest standalone state): **${String(security?.status || 'unknown').toUpperCase()}**; Critical ${c.critical ?? 0} / High ${c.high ?? 0} / Medium ${c.medium ?? 0}; generatedAt ${security?.generatedAt || 'n/a'}.`;
if (!current.includes(expected)) {
  throw new Error(`CURRENT Security mismatch. Expected exact fresh Sentinel summary: ${expected}`);
}
if (!current.includes(`Canonical source state represented here: **${security.generatedAt}**`) && security.generatedAt) {
  const m = current.match(/Canonical source state represented here: \*\*([^*]+)\*\*/);
  if (!m) throw new Error('CURRENT canonical source timestamp missing');
  if (Date.parse(m[1]) < Date.parse(security.generatedAt)) {
    throw new Error(`CURRENT source timestamp ${m[1]} is older than fresh Security ${security.generatedAt}`);
  }
}
console.log('CURRENT Security consistency PASS', { generatedAt: security.generatedAt, critical:c.critical, high:c.high, medium:c.medium });
