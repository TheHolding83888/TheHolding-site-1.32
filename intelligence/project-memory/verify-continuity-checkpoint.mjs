#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = 'intelligence/project-memory';
const rootPath = `${root}/CONTINUITY.md`;
if (!fs.existsSync(rootPath)) throw new Error('CONTINUITY.md missing');
const continuityRoot = fs.readFileSync(rootPath, 'utf8');
const latestMatch = continuityRoot.match(/^Latest immutable checkpoint: \[(THE_HOLDING_MASTER_CONTINUITY_.*\.md)\]\(\.\/\1\)$/m);
if (!latestMatch) throw new Error('CONTINUITY.md latest immutable checkpoint pointer missing or malformed');
const latest = latestMatch[1];
const latestPath = path.join(root, latest);
if (!fs.existsSync(latestPath)) throw new Error(`CONTINUITY.md points to missing checkpoint: ${latest}`);

const checkpoint = fs.readFileSync(latestPath, 'utf8');
const requiredCheckpointPhrases = [
  'executionAuthority: **none**',
  'Changing facts must always be re-read from live `main`',
  'Canonical Income Ledger remains the sole factual earned-income recognition authority',
  'Reference APR/APY',
  '`UNKNOWN != 0`',
  '`GREEN workflow != physically materialized production artifact`',
  'CURRENT → latest continuity → Routing Index → task-specific canon/context → live artifact → exact evidence',
  'No wallet signing, claiming, transaction execution, capital movement',
  'ACTIVE FRONTIER / ARTIFACT FRESHNESS',
  'Trigger boundary head:',
  'Active Frontier is diagnostic resume guidance only',
];
for (const phrase of requiredCheckpointPhrases) {
  if (!checkpoint.toLowerCase().includes(phrase.toLowerCase())) {
    throw new Error(`Latest continuity checkpoint missing invariant: ${phrase}`);
  }
}

const rootHead = continuityRoot.match(/^Checkpoint source head: \*\*([0-9a-f]{40})\*\*$/m)?.[1] ?? null;
const checkpointHead = checkpoint.match(/^- Canonical source head: \*\*([0-9a-f]{40})\*\*$/m)?.[1] ?? null;
if (!rootHead || !checkpointHead || rootHead !== checkpointHead) {
  throw new Error(`Continuity source-head mismatch: root=${rootHead} checkpoint=${checkpointHead}`);
}
const triggerHead = checkpoint.match(/^- Trigger boundary head: \*\*([0-9a-f]{40})\*\*$/m)?.[1] ?? null;
const triggerTime = checkpoint.match(/^- Trigger boundary time: \*\*([^*]+)\*\*$/m)?.[1] ?? null;
if (!triggerHead || !triggerTime || !Number.isFinite(Date.parse(triggerTime))) {
  throw new Error(`Continuity trigger boundary missing or malformed: head=${triggerHead} time=${triggerTime}`);
}

const freshnessRows = ['Accounting Coverage','Canonical Income Ledger','Company Monthly Reports'];
const allowedFreshnessStates = ['at-or-after-trigger-boundary','predates-trigger-boundary-recheck-live','unknown-generated-at'];
for (const label of freshnessRows) {
  const statePattern = allowedFreshnessStates.join('|');
  const row = checkpoint.match(new RegExp(`^- ${label}: (${statePattern}); generatedAt (.+)\\.$`, 'm'));
  if (!row) throw new Error(`Continuity freshness row missing or malformed: ${label}`);
}

const allContinuities = fs.readdirSync(root)
  .filter(name => /^THE_HOLDING_MASTER_CONTINUITY_.*\.md$/.test(name))
  .sort();
if (!allContinuities.includes(latest)) throw new Error('Root latest checkpoint is not in continuity inventory');

const rootRequired = [
  'immutable `THE_HOLDING_MASTER_CONTINUITY_*.md` files are never rewritten',
  'executionAuthority = none',
  'checkpoint snapshots explicitly expose whether key machine artifacts predate their trigger boundary',
  '`UNKNOWN != 0`',
  'Reference APR/APY is never factual income authority',
  '`GREEN workflow != physically materialized production artifact`',
];
for (const phrase of rootRequired) {
  if (!continuityRoot.toLowerCase().includes(phrase.toLowerCase())) throw new Error(`CONTINUITY.md missing invariant: ${phrase}`);
}

console.log('Continuity root + immutable checkpoint contract PASS', {
  latest,
  sourceHead: rootHead,
  triggerHead,
  triggerTime,
  continuityCount: allContinuities.length,
  freshnessAware: true,
});
