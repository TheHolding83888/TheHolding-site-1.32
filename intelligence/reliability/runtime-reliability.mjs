#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_POLICY = 'intelligence/reliability/runtime-reliability-policy.json';

function minutes(ms) { return ms / 60000; }
function asTime(value) {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : null;
}
function workflowId(run) {
  const p = String(run.path || '').replaceAll('\\', '/');
  const base = p.split('/').pop() || String(run.name || 'unknown');
  return base.replace(/\.ya?ml$/i, '') || 'unknown';
}
function stableHash(parts, length = 20) {
  return crypto.createHash('sha256').update(parts.map(v => String(v ?? '')).join('|')).digest('hex').slice(0, length);
}
function median(values) {
  const xs = values.filter(Number.isFinite).slice().sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}
function severityRank(v) { return ({ info: 0, watch: 1, red: 2 })[v] ?? 0; }
function finding(type, severity, subject, detail, evidence = {}) {
  const peer = evidence.consumer || evidence.producer || '';
  const classFingerprint = stableHash([type, subject, peer], 18);
  const occurrenceFingerprint = stableHash([
    classFingerprint,
    evidence.runId || '',
    evidence.producerRunId || '',
    evidence.createdAt || '',
    evidence.completedAt || ''
  ], 22);
  return { type, severity, subject, detail, classFingerprint, occurrenceFingerprint, evidence };
}

function normalizeRun(run) {
  return {
    id: Number(run.id),
    workflowId: workflowId(run),
    name: run.name || null,
    event: run.event || null,
    branch: run.head_branch || null,
    headSha: run.head_sha || null,
    status: run.status || null,
    conclusion: run.conclusion || null,
    createdAt: run.created_at || null,
    startedAt: run.run_started_at || null,
    updatedAt: run.updated_at || null,
    createdMs: asTime(run.created_at),
    startedMs: asTime(run.run_started_at),
    updatedMs: asTime(run.updated_at),
    url: run.html_url || null,
    runNumber: Number(run.run_number || 0)
  };
}

function isSupersededCancel(run, runs, windowMinutes) {
  if (run.conclusion !== 'cancelled' || run.createdMs === null) return false;
  const upper = (run.updatedMs ?? run.createdMs) + windowMinutes * 60000;
  return runs.some(other =>
    other.id !== run.id &&
    other.workflowId === run.workflowId &&
    other.branch === run.branch &&
    other.createdMs !== null &&
    other.createdMs > run.createdMs &&
    other.createdMs <= upper
  );
}

export function analyzeRuntime(envelope, policy, nowIso = new Date().toISOString()) {
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(nowMs)) throw new Error('invalid now');
  const rawRuns = Array.isArray(envelope) ? envelope : (envelope?.runs || []);
  const knownFingerprints = new Set(envelope?.knownIncidentFingerprints || []);
  const ignored = new Set(policy.ignoredWorkflowIds || []);
  const branch = policy.productionBranch || 'main';
  const cutoffMs = nowMs - Number(policy.coverage?.lookbackHours || 6) * 3600000;
  const runs = rawRuns.map(normalizeRun)
    .filter(r => r.branch === branch && !ignored.has(r.workflowId) && (r.createdMs === null || r.createdMs >= cutoffMs))
    .sort((a, b) => (b.createdMs || 0) - (a.createdMs || 0));
  const findings = [];
  const t = policy.thresholds || {};

  for (const run of runs) {
    if (run.status === 'queued' && run.createdMs !== null) {
      const age = minutes(nowMs - run.createdMs);
      if (age >= Number(t.queuedMinutes || 15)) {
        findings.push(finding('queued-too-long', 'red', run.workflowId, `queued ${age.toFixed(1)}m`, {
          runId: run.id, createdAt: run.createdAt, url: run.url, ageMinutes: Number(age.toFixed(2))
        }));
      }
    }
    if (run.status === 'in_progress') {
      const start = run.startedMs ?? run.createdMs;
      if (start !== null) {
        const age = minutes(nowMs - start);
        if (age >= Number(t.runningMinutes || 30)) {
          findings.push(finding('running-too-long', 'red', run.workflowId, `running ${age.toFixed(1)}m`, {
            runId: run.id, createdAt: run.createdAt, url: run.url, ageMinutes: Number(age.toFixed(2))
          }));
        }
      }
    }
  }

  const byWorkflow = new Map();
  for (const run of runs) {
    if (!byWorkflow.has(run.workflowId)) byWorkflow.set(run.workflowId, []);
    byWorkflow.get(run.workflowId).push(run);
  }
  const failures = new Set(policy.failureConclusions || ['failure', 'timed_out', 'action_required', 'startup_failure']);

  for (const [id, wfRuns] of byWorkflow) {
    const terminal = wfRuns.filter(r => r.status === 'completed' && r.conclusion && r.conclusion !== 'cancelled' && r.conclusion !== 'skipped');
    let consecutiveFailures = 0;
    for (const run of terminal) {
      if (failures.has(run.conclusion)) consecutiveFailures += 1;
      else break;
    }
    if (consecutiveFailures >= Number(t.repeatedFailureCount || 2)) {
      const latest = terminal[0];
      findings.push(finding('repeated-failure', 'red', id, `${consecutiveFailures} consecutive production failures`, {
        runId: latest?.id, createdAt: latest?.createdAt, url: latest?.url, consecutiveFailures
      }));
    }

    for (const run of wfRuns.filter(r => r.status === 'completed' && r.conclusion === 'cancelled')) {
      if (!isSupersededCancel(run, wfRuns, Number(t.supersededCancelWindowMinutes || 15))) {
        findings.push(finding('unsuperseded-cancel', 'watch', id, 'cancelled run has no nearby newer replacement', {
          runId: run.id, createdAt: run.createdAt, url: run.url
        }));
      }
    }

    const successful = wfRuns.filter(r => r.status === 'completed' && r.conclusion === 'success' && r.createdMs !== null && r.updatedMs !== null);
    const durations = successful.map(r => minutes(r.updatedMs - (r.startedMs ?? r.createdMs))).filter(v => v >= 0);
    if (durations.length >= Number(t.slowMinimumSamples || 3)) {
      const base = median(durations.slice(1));
      const latest = successful[0];
      if (base !== null && latest) {
        const latestDuration = minutes(latest.updatedMs - (latest.startedMs ?? latest.createdMs));
        const threshold = Math.max(Number(t.slowFloorMinutes || 10), base * Number(t.slowMultiplier || 3));
        if (latestDuration > threshold) {
          findings.push(finding('slow-run-regression', 'watch', id, `latest success ${latestDuration.toFixed(1)}m vs median ${base.toFixed(1)}m`, {
            runId: latest.id, createdAt: latest.createdAt, url: latest.url,
            durationMinutes: Number(latestDuration.toFixed(2)), baselineMedianMinutes: Number(base.toFixed(2))
          }));
        }
      }
    }
  }

  for (const edge of policy.criticalHandoffs || []) {
    const producerRuns = runs.filter(r => r.workflowId === edge.producer && r.status === 'completed' && r.conclusion === 'success' && r.updatedMs !== null);
    if (!producerRuns.length) continue;
    const producer = producerRuns[0];
    const grace = Number(edge.graceMinutes ?? t.handoffGraceMinutes ?? 20);
    if (nowMs - producer.updatedMs < grace * 60000) continue;
    const searchWindow = Number(edge.searchWindowMinutes ?? t.handoffSearchWindowMinutes ?? 60) * 60000;
    const consumer = runs.find(r =>
      r.workflowId === edge.consumer &&
      r.createdMs !== null &&
      r.createdMs >= producer.updatedMs &&
      r.createdMs <= producer.updatedMs + searchWindow
    );
    if (!consumer) {
      findings.push(finding('critical-handoff-miss', 'red', edge.producer, `${edge.producer} succeeded but ${edge.consumer} did not materialize within ${Math.round(searchWindow / 60000)}m`, {
        producer: edge.producer,
        consumer: edge.consumer,
        producerRunId: producer.id,
        createdAt: producer.createdAt,
        completedAt: producer.updatedAt,
        url: producer.url
      }));
    }
  }

  const fanoutStart = nowMs - Number(t.fanoutWindowMinutes || 15) * 60000;
  const recentFanout = runs.filter(r => r.createdMs !== null && r.createdMs >= fanoutStart).length;
  if (recentFanout >= Number(t.fanoutWatchCount || 40)) {
    findings.push(finding('fanout-burst', 'watch', 'repository', `${recentFanout} workflow runs started in ${Number(t.fanoutWindowMinutes || 15)}m`, {
      createdAt: nowIso, runCount: recentFanout
    }));
  }

  const unique = [...new Map(findings.map(f => [`${f.type}|${f.subject}|${f.occurrenceFingerprint}`, f])).values()];
  for (const f of unique) {
    f.regression = knownFingerprints.has(f.classFingerprint);
    f.rootCause = policy.learning?.rootCauseDefaultsTo || 'UNKNOWN_UNTIL_REVIEWED';
  }
  unique.sort((a, b) => severityRank(b.severity) - severityRank(a.severity) || `${a.type}|${a.subject}`.localeCompare(`${b.type}|${b.subject}`));

  const truncated = Boolean(envelope?.truncated);
  const redCount = unique.filter(f => f.severity === 'red').length;
  const watchCount = unique.filter(f => f.severity === 'watch').length;
  const status = redCount ? 'RED' : (watchCount || truncated ? 'WATCH' : 'GREEN');
  const materialIncidents = unique.filter(f => f.severity === 'red');

  return {
    version: policy.version,
    generatedAt: nowIso,
    status,
    authority: policy.authority,
    coverage: {
      productionBranch: branch,
      lookbackHours: Number(policy.coverage?.lookbackHours || 6),
      fetchedRunCount: rawRuns.length,
      analyzedRunCount: runs.length,
      pageCount: Number(envelope?.pageCount || 0),
      truncated,
      epistemicStatus: truncated ? 'PARTIAL_API_WINDOW' : 'BOUNDED_COMPLETE_WINDOW'
    },
    summary: {
      redCount,
      watchCount,
      findingCount: unique.length,
      materialIncidentCount: materialIncidents.length,
      knownRegressionCount: materialIncidents.filter(f => f.regression).length,
      recentFanoutRunCount: recentFanout,
      observedWorkflowCount: byWorkflow.size
    },
    findings: unique,
    materialIncidents
  };
}

export function renderMarkdown(report) {
  const lines = [
    `# Runtime Reliability · ${report.status}`,
    '',
    `Generated: ${report.generatedAt}`,
    `Runs analyzed: ${report.coverage.analyzedRunCount} · workflows: ${report.summary.observedWorkflowCount}`,
    `RED: ${report.summary.redCount} · WATCH: ${report.summary.watchCount} · known regressions: ${report.summary.knownRegressionCount}`,
    `Coverage: ${report.coverage.epistemicStatus}`,
    ''
  ];
  if (!report.findings.length) lines.push('No runtime reliability findings in the bounded observation window.');
  else {
    lines.push('## Findings');
    for (const f of report.findings.slice(0, 30)) {
      lines.push(`- **${f.severity.toUpperCase()}** ${f.type} · ${f.subject} · ${f.detail}${f.regression ? ' · KNOWN REGRESSION' : ''}`);
    }
  }
  lines.push('', 'Authority: observation + issue-ledger metadata only; no workflow dispatch/cancel/rerun, no repository mutation, no execution authority.');
  return `${lines.join('\n')}\n`;
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}

function main() {
  const runsFile = arg('--runs');
  if (!runsFile) throw new Error('--runs <file> required');
  const policyFile = arg('--policy') || DEFAULT_POLICY;
  const outFile = arg('--out');
  const markdownFile = arg('--markdown');
  const now = arg('--now') || new Date().toISOString();
  const envelope = JSON.parse(fs.readFileSync(path.resolve(runsFile), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyFile), 'utf8'));
  const report = analyzeRuntime(envelope, policy, now);
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (outFile) fs.writeFileSync(path.resolve(outFile), text);
  else process.stdout.write(text);
  if (markdownFile) fs.writeFileSync(path.resolve(markdownFile), renderMarkdown(report));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();

export { stableHash };
