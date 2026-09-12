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
function requirePrNetworkBoundary(label, source) {
  requireIncludes(label, source, 'Determine PR live-probe requirement');
  requireIncludes(label, source, 'Orchestration-only PR proof');
  requireIncludes(label, source, "github.event_name != 'pull_request' || steps.evidence_mode.outputs.live_probe_needed == 'true'");
}

requireIncludes('Voting Provenance', text.voting, 'The Holding · Votium vlCVX Round Flow');
if (/\n\s*schedule:\s*\n/.test(text.voting)) throw new Error('Voting Provenance must not retain an independent schedule; Round Flow is the cadence root');
requireWorkflowRunGuard('Voting Provenance', text.voting);
requirePrNetworkBoundary('Voting Provenance', text.voting);
requireIncludes('Voting Provenance', text.voting, 'round_flow_rebuild_needed=true');
requireIncludes('Voting Provenance', text.voting, 'Build PR upstream round flow');
requireIncludes('Voting Provenance', text.voting, 'VLCVX_VOTIUM_ROUND_FLOW_FILE=/tmp/vlcvx-votium-round-flow.json node intelligence/economic-graph/vlcvx-votium-round-flow.mjs');
requireIncludes('Voting Provenance', text.voting, 'VLCVX_VOTIUM_ROUND_FLOW_FILE=/tmp/vlcvx-votium-round-flow.json node scripts/verify-vlcvx-votium-round-flow.mjs');
requireIncludes('Voting Provenance', text.voting, 'ROUND_FLOW_INPUT="/tmp/vlcvx-votium-round-flow.json"');
requireIncludes('Voting Provenance', text.voting, 'VLCVX_VOTIUM_ROUND_FLOW_FILE="$ROUND_FLOW_INPUT" VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE="$TMP" node intelligence/economic-graph/vlcvx-votium-snapshot-proof.mjs');
requireIncludes('Voting Provenance', text.voting, 'VLCVX_VOTIUM_ROUND_FLOW_FILE="$ROUND_FLOW_INPUT" VLCVX_VOTIUM_SNAPSHOT_PROOF_FILE=/tmp/vlcvx-votium-snapshot-proof.json node scripts/verify-vlcvx-votium-snapshot-proof.mjs');

requireIncludes('Curve Gauge Flow', text.gauge, 'The Holding · Votium vlCVX Voting Provenance');
requireWorkflowRunGuard('Curve Gauge Flow', text.gauge);
requirePrNetworkBoundary('Curve Gauge Flow', text.gauge);

requireIncludes('Curve Pool Context', text.pool, 'The Holding · Votium → Curve Gauge Flow');
requireWorkflowRunGuard('Curve Pool Context', text.pool);
requireIncludes('Curve Pool Context', text.pool, 'cron: "23 */6 * * *"');
requirePrNetworkBoundary('Curve Pool Context', text.pool);

for (const [label, source] of Object.entries(text)) {
  if (/actions:\s*write/.test(source)) throw new Error(`${label} unexpectedly gained workflow-dispatch authority`);
  requireIncludes(label, source, 'contents: write');
}

console.log('VLCVX / VOTIUM EVIDENCE HANDOFF CANARY PASS', {
  chain: 'Round Flow -> Voting Provenance -> Curve Gauge Flow -> Curve Pool Context',
  rootCadenceOnly: true,
  prUpstreamRebuildBoundToDownstreamProof: true,
  poolIndependentFreshness: '6h-preserved',
  orchestrationOnlyPrNetworkCalls: false,
  productionLiveEvidenceBuilds: true,
  workflowDispatchAuthority: 'none'
});
