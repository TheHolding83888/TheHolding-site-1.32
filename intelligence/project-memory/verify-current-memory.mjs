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
const routingFile = 'THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md';
for (const f of [collaborationFile,routingFile]) {
  if (!fs.existsSync(`intelligence/project-memory/${f}`)) throw new Error(`Required project-memory contract missing: ${f}`);
}
const router = fs.readFileSync(`intelligence/project-memory/${routingFile}`,'utf8');
for (const phrase of [
  'CURRENT → continuity → router → task canon → live artifact → exact evidence',
  'enumerable NFT inventory != economic strategy inventory',
  'base lending interest',
  'external incentives',
  'Memory write-back rule',
]) {
  if (!router.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Memory Routing Index missing durable route phrase: ${phrase}`);
}

const resumeMatch = current.match(/## Resume order\n\n([\s\S]*?)\n\n## Task-aware retrieval/);
if (!resumeMatch) throw new Error('CURRENT Resume order / Task-aware retrieval boundary missing');
const resume = resumeMatch[1];
const expectedResumeLines = [
  /^1\. \[THE_HOLDING_MASTER_CONTINUITY_.*\.md\]\(\.\/THE_HOLDING_MASTER_CONTINUITY_.*\.md\)$/m,
  new RegExp(`^2\\. \\[Owner Collaboration Operating Style\\]\\(\\.\\/${collaborationFile.replaceAll('.', '\\.') }\\)$`, 'm'),
  /^3\. \[THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14\.md\]\(\.\/THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14\.md\)$/m,
  new RegExp(`^4\\. \\[Memory Routing Index\\]\\(\\.\\/${routingFile.replaceAll('.', '\\.') }\\)$`, 'm'),
  /^5\. \[Project Memory README\]\(\.\/README\.md\)$/m,
  /^6\. Follow the Routing Index: read only the task-specific durable blocks and live machine-readable artifacts needed for the current objective\.$/m,
];
for (const pattern of expectedResumeLines) {
  if (!pattern.test(resume)) throw new Error(`CURRENT Resume order contract missing: ${pattern}`);
}

const continuityMatch = current.match(/^1\. \[(THE_HOLDING_MASTER_CONTINUITY_.*\.md)\]/m);
if (!continuityMatch) throw new Error('Latest continuity link missing from CURRENT');
const continuityPath = `intelligence/project-memory/${continuityMatch[1]}`;
if (!fs.existsSync(continuityPath)) throw new Error(`CURRENT latest continuity file missing: ${continuityMatch[1]}`);
const continuity = fs.readFileSync(continuityPath,'utf8');
for (const phrase of [
  'PROJECT X + HYPERLEND CLOSED',
  'resolver completeness != promotion completeness',
  'HyperLend base lending interest = Compounded / Embedded',
  'rewardAssetCount = 0',
  'generic implementation permission != merge permission',
]) {
  if (!continuity.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Latest continuity missing material 2026-08-18 checkpoint phrase: ${phrase}`);
}

for (const phrase of [
  'Canonical retrieval path: `CURRENT → latest continuity → routing index → task-specific canon/context → live artifact → exact evidence`',
  'Do not load every historical checkpoint by default',
  'Default working language with the owner is **Russian**',
  'Work **one primary objective at a time**',
  'not a new production merge',
  'Live-site screenshots are visual acceptance evidence',
  'not a psychological profile',
]) {
  if (!current.includes(phrase)) throw new Error(`CURRENT bootstrap missing phrase: ${phrase}`);
}

console.log('CURRENT Security + collaboration + task-routing bootstrap consistency PASS', {
  generatedAt: security.generatedAt,
  critical:c.critical,
  high:c.high,
  medium:c.medium,
  collaborationFile,
  routingFile,
  latestContinuity:continuityMatch[1],
});
