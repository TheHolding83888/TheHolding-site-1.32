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

const collaborationFile = 'THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md';
if (!fs.existsSync(`intelligence/project-memory/${collaborationFile}`)) {
  throw new Error(`Owner collaboration canon missing: ${collaborationFile}`);
}
const resumeMatch = current.match(/## Resume order\n\n([\s\S]*?)\n\n## Owner collaboration bootstrap/);
if (!resumeMatch) throw new Error('CURRENT Resume order / Owner collaboration bootstrap boundary missing');
const resume = resumeMatch[1];
const expectedResumeLines = [
  /^1\. \[THE_HOLDING_MASTER_CONTINUITY_.*\.md\]\(\.\/THE_HOLDING_MASTER_CONTINUITY_.*\.md\)$/m,
  new RegExp(`^2\\. \\[Owner Collaboration Operating Style\\]\\(\\.\\/${collaborationFile.replaceAll('.', '\\.') }\\)$`, 'm'),
  /^3\. \[THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14\.md\]\(\.\/THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14\.md\)$/m,
  /^4\. \[Project Memory README\]\(\.\/README\.md\)$/m,
  /^5\. Read only the live machine-readable subsystem artifacts and task-specific canons needed for the current task\.$/m,
];
for (const pattern of expectedResumeLines) {
  if (!pattern.test(resume)) throw new Error(`CURRENT Resume order contract missing: ${pattern}`);
}

for (const phrase of [
  'Default working language with the owner is **Russian**',
  'Work **one primary objective at a time**',
  'not a new production merge',
  'Live-site screenshots are visual acceptance evidence',
  'not a psychological profile',
]) {
  if (!current.includes(phrase)) throw new Error(`CURRENT owner collaboration bootstrap missing phrase: ${phrase}`);
}

console.log('CURRENT Security + owner collaboration bootstrap consistency PASS', {
  generatedAt: security.generatedAt,
  critical:c.critical,
  high:c.high,
  medium:c.medium,
  collaborationFile,
});
