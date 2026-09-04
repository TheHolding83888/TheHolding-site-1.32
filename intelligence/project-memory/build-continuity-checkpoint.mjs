#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const projectDir = path.join(ROOT, 'intelligence/project-memory');
const rel = p => path.join(ROOT, p);
const readJson = p => {
  try { return JSON.parse(fs.readFileSync(rel(p), 'utf8')); }
  catch { return null; }
};
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
const fmt = v => (v === null || v === undefined || v === '' ? 'n/a' : String(v));
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const yesNo = v => v === true ? 'yes' : v === false ? 'no' : 'n/a';
const safeLine = s => String(s ?? '').replace(/[\r\n]+/g, ' ').trim();

if (!fs.existsSync(projectDir)) throw new Error('Project Memory directory missing');

const sourceHead = git('rev-parse', 'HEAD');
const shortHead = sourceHead.slice(0, 8);
const sourceTime = git('show', '-s', '--format=%cI', sourceHead);
const sourceSubject = safeLine(git('show', '-s', '--format=%s', sourceHead));
const sourceDate = new Date(sourceTime);
if (Number.isNaN(sourceDate.getTime())) throw new Error(`Invalid source commit time: ${sourceTime}`);
const stamp = sourceDate.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const datePart = stamp.slice(0, 8);
const timePart = stamp.slice(9, 15);
const checkpointName = `THE_HOLDING_MASTER_CONTINUITY_${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}_${timePart}_AUTO_${shortHead}.md`;
const checkpointPath = path.join(projectDir, checkpointName);

const allContinuities = fs.readdirSync(projectDir)
  .filter(name => /^THE_HOLDING_MASTER_CONTINUITY_.*\.md$/.test(name))
  .sort();
const previousContinuity = allContinuities.at(-1) ?? null;

const security = readJson('security/security-intelligence.json');
const coverage = readJson('reporting/accounting-coverage.json');
const monthly = readJson('reporting/company-monthly-reports.json');
const ledger = readJson('reporting/income-ledger.json');
const mechanisms = coverage?.mechanisms ?? {};
const mechanismRows = Object.entries(mechanisms);
const gaps = mechanismRows
  .filter(([, m]) => m?.reusableCoverageGap === true)
  .map(([id, m]) => ({
    id,
    active: num(m?.activeCompanyCount),
    factual: num(m?.factualTrackingCompanyCount ?? m?.factualCompanyCount),
    productiveUsd: num(m?.knownProductiveValueUsdTotal),
    stateOnly: num(m?.stateOnlyCompanyCount),
    referenceOnly: num(m?.referenceOnlyCompanyCount),
  }))
  .sort((a, b) => (b.productiveUsd ?? -1) - (a.productiveUsd ?? -1));

const keyIds = [
  'aerodrome_veaero',
  'velodrome_vevelo',
  'frax_vefrax',
  'yieldbasis_veyb',
  'beefy_cvxcrv',
  'convex_vlcvx',
  'convex_staked_cvxcrv',
  'curve_vecrv',
];
const keyMechanismLines = keyIds
  .filter(id => mechanisms[id])
  .map(id => {
    const m = mechanisms[id];
    return `- \`${id}\`: factual tracking ${fmt(m?.factualTrackingCompanyCount ?? m?.factualCompanyCount)}/${fmt(m?.activeCompanyCount)}; current-month factual events ${fmt(m?.currentMonthFactualEventCount)}; reusableCoverageGap=${yesNo(m?.reusableCoverageGap)}.`;
  });

let changedFiles = [];
try {
  changedFiles = [...new Set(git('diff-tree', '--no-commit-id', '--name-only', '-r', '-m', sourceHead).split('\n').filter(Boolean))].slice(0, 60);
} catch {}

const sec = security?.severityCounts ?? {};
const ledgerEventCount = Array.isArray(ledger?.events) ? ledger.events.length
  : Array.isArray(ledger?.entries) ? ledger.entries.length
  : Array.isArray(ledger?.incomeEvents) ? ledger.incomeEvents.length
  : null;
const monthlyCompanyCount = monthly?.companies && typeof monthly.companies === 'object'
  ? Object.keys(monthly.companies).length
  : Array.isArray(monthly?.companies) ? monthly.companies.length
  : null;

const lines = [
  '# THE HOLDING — MASTER CONTINUITY · AUTOMATIC CHECKPOINT',
  `## ${sourceDate.toISOString()} · source ${shortHead}`,
  '',
  'Status: **AUTOMATIC IMMUTABLE RESUME CHECKPOINT**  ',
  'Authority: **observation / continuity only**  ',
  'executionAuthority: **none**',
  '',
  '> This checkpoint is generated from live repository state. It is a resume anchor, not a substitute for fresh evidence. Changing facts must always be re-read from live `main`, fresh machine-readable artifacts and exact workflow evidence.',
  '',
  '## 1. SOURCE BOUNDARY',
  '',
  `- Canonical source head: **${sourceHead}**`,
  `- Source commit time: **${sourceTime}**`,
  `- Source commit: **${sourceSubject || 'n/a'}**`,
  `- Previous continuity: ${previousContinuity ? `\`${previousContinuity}\`` : 'none'}.`,
  `- Changed paths observed on source commit: ${changedFiles.length}.`,
  ...(changedFiles.length ? changedFiles.map(p => `  - \`${p}\``) : ['  - none reported by git diff-tree']),
  '',
  '## 2. CURRENT MACHINE SNAPSHOT',
  '',
  `- Security Sentinel: **${String(security?.status ?? 'unknown').toUpperCase()}**; Critical ${fmt(sec.critical ?? 0)} / High ${fmt(sec.high ?? 0)} / Medium ${fmt(sec.medium ?? 0)}; generatedAt ${fmt(security?.generatedAt)}.`,
  `- Accounting Coverage: version ${fmt(coverage?.version)}; generatedAt ${fmt(coverage?.generatedAt)}; mechanisms ${mechanismRows.length}; reusable gaps ${gaps.length}.`,
  `- Canonical Income Ledger: version ${fmt(ledger?.version)}; status ${fmt(ledger?.status)}; generatedAt ${fmt(ledger?.generatedAt)}; observed event count ${fmt(ledgerEventCount)}.`,
  `- Company Monthly Reports: version ${fmt(monthly?.version)}; methodology ${fmt(monthly?.methodologyVersion)}; generatedAt ${fmt(monthly?.generatedAt)}; companies ${fmt(monthlyCompanyCount)}.`,
  '',
  '### Key factual-accounting mechanisms',
  '',
  ...(keyMechanismLines.length ? keyMechanismLines : ['- No key mechanism rows available in current Coverage artifact.']),
  '',
  '### Highest-value reusable coverage gaps',
  '',
  ...(gaps.length ? gaps.slice(0, 12).map(g => `- \`${g.id}\`: factual ${fmt(g.factual)}/${fmt(g.active)}; state-only ${fmt(g.stateOnly)}; reference-only ${fmt(g.referenceOnly)}; known productive value USD ${fmt(g.productiveUsd)}.`) : ['- None reported by the current Coverage Registry.']),
  '',
  '## 3. NON-NEGOTIABLE ACCOUNTING / AUTHORITY LAWS',
  '',
  '- Canonical Income Ledger remains the sole factual earned-income recognition authority.',
  '- Reference APR/APY and reference generated income are analytics, not factual period-income authority.',
  '- Opening balance is baseline, not current-period income; later claim/reset/withdrawal/receipt is settlement when the economic income was already recognized.',
  '- `UNKNOWN != 0`; incomplete evidence stays partial/null and fails closed rather than being estimated into factual income.',
  '- `GREEN workflow != physically materialized production artifact`; production closure requires the artifact on live `main` plus downstream proof where applicable.',
  '- No wallet signing, claiming, transaction execution, capital movement, automatic methodology mutation or execution-authority expansion is granted by this checkpoint.',
  '- Security watch findings stay visible; continuity automation must never improve status by suppressing detectors.',
  '',
  '## 4. RESUME CONTRACT',
  '',
  'Canonical recovery path:',
  '',
  '`CURRENT → latest continuity → Routing Index → task-specific canon/context → live artifact → exact evidence`',
  '',
  'At resume time:',
  '1. re-read live `intelligence/project-memory/CURRENT.md`;',
  '2. re-read this checkpoint only if CURRENT still points here;',
  '3. follow `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;',
  '4. verify changing production facts from live artifacts and exact Actions/check evidence;',
  '5. preserve `executionAuthority = none` unless the owner explicitly changes that boundary.',
  '',
  'The model can change. **The memory must remain The Holding\'s.**',
  '',
];

if (!fs.existsSync(checkpointPath)) {
  fs.writeFileSync(checkpointPath, lines.join('\n'), 'utf8');
}

const rootLines = [
  '# THE HOLDING — CONTINUITY ROOT',
  '',
  'This file is the deterministic pointer between live `CURRENT.md` and immutable master continuity checkpoints.',
  '',
  `Latest immutable checkpoint: [${checkpointName}](./${checkpointName})`,
  `Checkpoint source head: **${sourceHead}**`,
  `Checkpoint source time: **${sourceTime}**`,
  '',
  'Rules:',
  '- `CURRENT.md` is generated and must resolve its latest-continuity slot through this root when present.',
  '- immutable `THE_HOLDING_MASTER_CONTINUITY_*.md` files are never rewritten by the automatic checkpoint writer;',
  '- changing facts still come from live `main` + fresh machine artifacts + exact evidence;',
  '- the automatic writer has continuity-file authority only; `executionAuthority = none`;',
  '- `UNKNOWN != 0`; Reference APR/APY is never factual income authority;',
  '- `GREEN workflow != physically materialized production artifact`.',
  '',
];
fs.writeFileSync(path.join(projectDir, 'CONTINUITY.md'), rootLines.join('\n'), 'utf8');

console.log('Continuity checkpoint prepared', {
  checkpointName,
  sourceHead,
  sourceTime,
  previousContinuity,
  security: security?.status ?? null,
  mechanismCount: mechanismRows.length,
  gapCount: gaps.length,
});