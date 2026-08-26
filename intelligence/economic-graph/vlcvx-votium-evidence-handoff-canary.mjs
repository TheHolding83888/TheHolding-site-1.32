#!/usr/bin/env node
import fs from 'node:fs';

const files = {
  voting: '.github/workflows/update-vlcvx-votium-snapshot-proof.yml',
  gauge: '.github/workflows/update-vlcvx-votium-curve-gauge-flow.yml',
  pool: '.github/workflows/update-vlcvx-votium-curve-pool-context.yml'
};
const text = Object.fromEntries(Object.entries(files).map(([k,p]) => [k, fs.readFileSync(p, 'utf8')]));

function requireIncludes(label, source, fragment) {
  if (!source.includes(fragment)) throw new Error(`${label} missing required handoff fragment: ${fragment}`);
}
function requireWorkflowRunGuard(label, source) {
  requireIncludes(label, source, "github.event.workflow_run.conclusion == 'success'");
  requireIncludes(label, source, "github.event.workflow_run.head_branch == 'main'");
}

requireIncludes('Voting Provenance', text.voting, 'The Holding · Votium vlCVX Round Flow');
if (/\n\s*schedule:\s*\n/.test(text.voting)) throw new Error('Voting Provenance must not retain an independent schedule; Round Flow is the cadence root');
requireWorkflowRunGuard('Voting Provenance', text.voting);

requireIncludes('Curve Gauge Flow', text.gauge, 'The Holding · Votium vlCVX Voting Provenance');
requireWorkflowRunGuard('Curve Gauge Flow', text.gauge);

requireIncludes('Curve Pool Context', text.pool, 'The Holding · Votium → Curve Gauge Flow');
requireWorkflowRunGuard('Curve Pool Context', text.pool);
requireIncludes('Curve Pool Context', text.pool, 'cron: "23 */6 * * *"');

for (const [label, source] of Object.entries(text)) {
  if (/actions:\s*write/.test(source)) throw new Error(`${label} unexpectedly gained workflow-dispatch authority`);
  requireIncludes(label, source, 'contents: write');
}

console.log('VLCVX / VOTIUM EVIDENCE HANDOFF CANARY PASS', {
  chain: 'Round Flow -> Voting Provenance -> Curve Gauge Flow -> Curve Pool Context',
  rootCadenceOnly: true,
  poolIndependentFreshness: '6h-preserved',
  workflowDispatchAuthority: 'none'
});
