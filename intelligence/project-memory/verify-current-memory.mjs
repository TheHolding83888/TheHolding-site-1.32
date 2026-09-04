#!/usr/bin/env node
import fs from 'node:fs';

const root = 'intelligence/project-memory';
const current = fs.readFileSync(`${root}/CURRENT.md`, 'utf8');
const security = JSON.parse(fs.readFileSync('security/security-intelligence.json', 'utf8'));
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
const buildFile = 'THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md';
const legacyRoutingFile = 'THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md';
const routingFile = 'THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md';
const marketDataCanon = 'THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md';
for (const f of [collaborationFile, buildFile, legacyRoutingFile, routingFile, marketDataCanon]) {
  if (!fs.existsSync(`${root}/${f}`)) throw new Error(`Required project-memory contract missing: ${f}`);
}

const collaboration = fs.readFileSync(`${root}/${collaborationFile}`, 'utf8');
for (const phrase of [
  'Bounded routine merge flow',
  'routine, low-risk repository changes may proceed',
  'bounded',
  'capital movement',
  'security-policy mutation',
  'expected_head_sha',
]) {
  if (!collaboration.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Owner Collaboration canon missing bounded merge-flow phrase: ${phrase}`);
}

const build = fs.readFileSync(`${root}/${buildFile}`, 'utf8');
for (const phrase of [
  'layer by layer',
  'one primary objective',
  'No new layer',
  'capability',
  'complexity',
]) {
  if (!build.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Build Discipline canon missing durable phrase: ${phrase}`);
}

const legacyRouter = fs.readFileSync(`${root}/${legacyRoutingFile}`, 'utf8');
for (const phrase of [
  'CURRENT → continuity → router → task canon → live artifact → exact evidence',
  'enumerable NFT inventory != economic strategy inventory',
  'base lending interest',
  'external incentives',
  'Memory write-back rule',
  'MARKET DATA / ONCHAIN PRICING / PUBLIC CAPITAL / COINGECKO FALLBACK',
  'GREEN workflow != physically materialized production artifact',
]) {
  if (!legacyRouter.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Legacy Memory Routing Index missing durable route phrase: ${phrase}`);
}

const router = fs.readFileSync(`${root}/${routingFile}`, 'utf8');
for (const phrase of [
  'CURRENT → latest continuity → this router → task canon → live artifact → exact evidence',
  'ALWAYS-READ HOT CORE',
  'Autonomous Observational / World Learning',
  'primary continuous learning lane',
  'Owner Decision → Outcome',
  'PROJECT MEMORY / CONTINUITY / NEW-CHAT RECOVERY',
  'GREEN workflow != physically materialized production artifact',
  'Memory quality is not measured by how much text a model reads',
]) {
  if (!router.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Memory Routing Index v2 missing hot-path contract phrase: ${phrase}`);
}

const marketCanon = fs.readFileSync(`${root}/${marketDataCanon}`, 'utf8');
for (const phrase of [
  'ONE CANONICAL PRICE PLANE',
  'physical silver',
  'DIVERGENCE IS TELEMETRY, NOT AUTOMATIC FAILURE',
  'per-asset-authority',
  'ONE WRITER — RECOVERY PATHS INCLUDED',
  'GREEN workflow != physically materialized production artifact',
  'executionAuthority = none',
]) {
  if (!marketCanon.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Market Data canon missing durable contract phrase: ${phrase}`);
}

const continuityRootPath = `${root}/CONTINUITY.md`;
if (!fs.existsSync(continuityRootPath)) throw new Error('Project Memory CONTINUITY.md root missing');
const continuityRoot = fs.readFileSync(continuityRootPath, 'utf8');
const rootLatest = continuityRoot.match(/^Latest immutable checkpoint: \[(THE_HOLDING_MASTER_CONTINUITY_.*\.md)\]\(\.\/\1\)$/m)?.[1] ?? null;
if (!rootLatest) throw new Error('CONTINUITY.md latest immutable checkpoint pointer missing');
if (!fs.existsSync(`${root}/${rootLatest}`)) throw new Error(`CONTINUITY.md points to missing checkpoint: ${rootLatest}`);

const resumeMatch = current.match(/## Minimum recovery packet\n\n([\s\S]*?)\n\nFull Owner Collaboration/);
if (!resumeMatch) throw new Error('CURRENT Minimum recovery packet boundary missing');
const resume = resumeMatch[1];
const currentLatest = current.match(/^1\. \[(THE_HOLDING_MASTER_CONTINUITY_.*\.md)\]/m)?.[1] ?? null;
if (!currentLatest) throw new Error('Latest continuity link missing from CURRENT');
if (currentLatest !== rootLatest) throw new Error(`CURRENT/root continuity mismatch: CURRENT=${currentLatest} root=${rootLatest}`);

const expectedResumeLines = [
  /^1\. \[THE_HOLDING_MASTER_CONTINUITY_.*\.md\]\(\.\/THE_HOLDING_MASTER_CONTINUITY_.*\.md\)$/m,
  new RegExp(`^2\\. \\[Memory Routing Index v2\\]\\(\\.\\/${routingFile.replaceAll('.', '\\.') }\\)$`, 'm'),
  /^3\. Follow the router: load only the task-specific durable canon\/context and live machine-readable evidence needed for the current objective\.$/m,
];
for (const pattern of expectedResumeLines) {
  if (!pattern.test(resume)) throw new Error(`CURRENT minimum recovery contract missing: ${pattern}`);
}
if (/Owner Collaboration Operating Style|Project Memory README|THE_HOLDING_BUILD_DISCIPLINE_CANON/.test(resume)) {
  throw new Error('Cold core document leaked back into minimum recovery packet');
}

const continuity = fs.readFileSync(`${root}/${currentLatest}`, 'utf8');
for (const phrase of [
  'executionAuthority: **none**',
  'Changing facts',
  'live `main`',
  'GREEN workflow != physically materialized production artifact',
]) {
  if (!continuity.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`Latest continuity missing generic invariant: ${phrase}`);
}

for (const phrase of [
  'Canonical retrieval path: `CURRENT → latest continuity → routing index → task-specific canon/context → live artifact → exact evidence`',
  'Do not load every historical checkpoint by default',
  'Default working language with the owner is **Russian**',
  'Work **one primary objective at a time**',
  'Routine low-risk repository work may proceed through verified PR merge and production proof without a separate per-PR confirmation',
  'Live-site screenshots are visual acceptance evidence',
  'not a psychological profile',
  'autonomous observational/world evidence is the primary always-on lane',
  'cold durable references',
]) {
  if (!current.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`CURRENT bootstrap missing phrase: ${phrase}`);
}

console.log('CURRENT minimum recovery + Security + continuity-root + cold-canon invariants PASS', {
  generatedAt: security.generatedAt,
  critical: c.critical,
  high: c.high,
  medium: c.medium,
  collaborationFile,
  buildFile,
  legacyRoutingFile,
  routingFile,
  marketDataCanon,
  latestContinuity: currentLatest,
  continuityRoot: 'CONTINUITY.md',
  minimumRecoveryDocumentsAfterCurrent: 2,
});
