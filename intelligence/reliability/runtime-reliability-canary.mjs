#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeRuntime } from './runtime-reliability.mjs';

const policy = JSON.parse(fs.readFileSync(new URL('./runtime-reliability-policy.json', import.meta.url), 'utf8'));
const NOW = '2026-08-25T17:30:00.000Z';
let nextId = 1000;
function iso(minsAgo) { return new Date(Date.parse(NOW) - minsAgo * 60000).toISOString(); }
function run(id, { minsAgo, duration = 1, status = 'completed', conclusion = 'success', branch = 'main', event = 'workflow_run' } = {}) {
  const createdAt = iso(minsAgo);
  const updatedAt = status === 'completed' ? iso(Math.max(0, minsAgo - duration)) : iso(0);
  return {
    id: nextId++, name: id, path: `.github/workflows/${id}.yml`, head_branch: branch,
    head_sha: `sha-${nextId}`, event, status, conclusion,
    created_at: createdAt, run_started_at: createdAt, updated_at: updatedAt,
    html_url: `https://example.invalid/${nextId}`, run_number: nextId
  };
}
function baseEnvelope(runs, extra = {}) { return { runs, pageCount: 1, truncated: false, knownIncidentFingerprints: [], ...extra }; }
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const healthyRuns = [
  run('unified-capital-refresh', { minsAgo: 90 }),
  run('update-economic-graph', { minsAgo: 85 }),
  run('update-explanatory-context', { minsAgo: 80 }),
  run('refresh-cognitive-stack', { minsAgo: 75 }),
  run('worker-a', { minsAgo: 30 }), run('worker-a', { minsAgo: 60 }), run('worker-a', { minsAgo: 120 })
];
const healthy = analyzeRuntime(baseEnvelope(healthyRuns), policy, NOW);
assert(healthy.status === 'GREEN', `healthy should be GREEN, got ${healthy.status}`);

const cancelled = run('coalesced-worker', { minsAgo: 25, conclusion: 'cancelled' });
const replacement = run('coalesced-worker', { minsAgo: 20, conclusion: 'success' });
const superseded = analyzeRuntime(baseEnvelope([cancelled, replacement]), policy, NOW);
assert(!superseded.findings.some(f => f.type === 'unsuperseded-cancel'), 'superseded cancellation misclassified');

const fail1 = run('broken-worker', { minsAgo: 10, conclusion: 'failure' });
const fail2 = run('broken-worker', { minsAgo: 20, conclusion: 'failure' });
const repeated = analyzeRuntime(baseEnvelope([fail1, fail2]), policy, NOW);
const repeatedFinding = repeated.findings.find(f => f.type === 'repeated-failure');
assert(repeated.status === 'RED' && repeatedFinding, 'repeated failures should be RED');

const stuckRun = run('stuck-worker', { minsAgo: 45, status: 'in_progress', conclusion: null });
const stuck = analyzeRuntime(baseEnvelope([stuckRun]), policy, NOW);
assert(stuck.findings.some(f => f.type === 'running-too-long' && f.severity === 'red'), 'stuck run not detected');

const handoffMiss = analyzeRuntime(baseEnvelope([run('update-economic-graph', { minsAgo: 50 })]), policy, NOW);
assert(handoffMiss.findings.some(f => f.type === 'critical-handoff-miss' && f.evidence.consumer === 'update-explanatory-context'), 'handoff miss not detected');

const fanoutRuns = Array.from({ length: 41 }, (_, i) => run(`fanout-${i}`, { minsAgo: 5 }));
const fanout = analyzeRuntime(baseEnvelope(fanoutRuns), policy, NOW);
assert(fanout.findings.some(f => f.type === 'fanout-burst' && f.severity === 'watch'), 'fanout burst not detected');
assert(fanout.status === 'WATCH', 'fanout-only case should be WATCH');

const fingerprint = repeatedFinding.classFingerprint;
const regression = analyzeRuntime(baseEnvelope([fail1, fail2], { knownIncidentFingerprints: [fingerprint] }), policy, NOW);
assert(regression.materialIncidents.some(f => f.type === 'repeated-failure' && f.regression === true), 'known fingerprint should mark regression');

const partial = analyzeRuntime(baseEnvelope([], { truncated: true }), policy, NOW);
assert(partial.status === 'WATCH' && partial.coverage.epistemicStatus === 'PARTIAL_API_WINDOW', 'partial API coverage must fail open to WATCH, not false GREEN');

console.log('Runtime Reliability analyzer canary PASS');
