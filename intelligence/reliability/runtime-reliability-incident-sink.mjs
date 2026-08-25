#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function marker(fingerprint) { return `<!-- holding-runtime-fingerprint:${fingerprint} -->`; }
function occurrenceMarker(fingerprint) { return `<!-- holding-runtime-occurrence:${fingerprint} -->`; }
function issueTitle(prefix, incident) {
  return `${prefix} ${incident.type} · ${incident.subject}`.slice(0, 240);
}
function issueBody(incident, report, policy) {
  return [
    marker(incident.classFingerprint),
    occurrenceMarker(incident.occurrenceFingerprint),
    '## Runtime reliability incident',
    '',
    `- Status: **${incident.severity.toUpperCase()}**`,
    `- Type: \`${incident.type}\``,
    `- Subject: \`${incident.subject}\``,
    `- First observed by loop: ${report.generatedAt}`,
    `- Regression of known fingerprint: ${incident.regression ? 'yes' : 'no'}`,
    `- Root cause: **${incident.rootCause || 'UNKNOWN_UNTIL_REVIEWED'}**`,
    '',
    incident.detail,
    '',
    '### Learning contract',
    '',
    '`Incident → Root Cause (reviewed) → Durable Lesson → Preventive Invariant → Canary`',
    '',
    'This issue is operational memory only. The observer cannot dispatch/cancel/rerun workflows and cannot mutate repository production state.',
    '',
    `Policy: \`${policy.version}\``
  ].join('\n');
}
function recurrenceComment(incident, report) {
  return [
    occurrenceMarker(incident.occurrenceFingerprint),
    `Runtime recurrence observed at ${report.generatedAt}.`,
    '',
    `- ${incident.type} · ${incident.subject}`,
    `- ${incident.detail}`,
    `- Root cause remains: ${incident.rootCause || 'UNKNOWN_UNTIL_REVIEWED'}`
  ].join('\n');
}

export function extractKnownFingerprints(issues = []) {
  const out = new Set();
  for (const issue of issues) {
    const body = String(issue.body || '');
    for (const m of body.matchAll(/<!--\s*holding-runtime-fingerprint:([a-f0-9]{8,64})\s*-->/g)) out.add(m[1]);
  }
  return [...out].sort();
}

export function planIncidentWrites(report, issues, policy, nowIso = report.generatedAt) {
  const cfg = policy.incidentSink || {};
  if (!cfg.enabled) return [];
  const nowMs = Date.parse(nowIso);
  const cooldownMs = Number(cfg.commentCooldownHours || 6) * 3600000;
  const maxWrites = Number(cfg.maxWritesPerRun || 3);
  const plans = [];
  const candidates = (report.materialIncidents || []).filter(x => x.severity === (cfg.minimumSeverity || 'red'));

  for (const incident of candidates) {
    const m = marker(incident.classFingerprint);
    const existing = issues.find(issue => String(issue.body || '').includes(m));
    if (!existing) {
      plans.push({
        action: 'create',
        incident,
        title: issueTitle(cfg.titlePrefix || '[Runtime Reliability]', incident),
        body: issueBody(incident, report, policy)
      });
    } else {
      const updatedMs = Date.parse(existing.updated_at || existing.created_at || '');
      const cooled = !Number.isFinite(updatedMs) || nowMs - updatedMs >= cooldownMs;
      if (existing.state === 'closed') {
        plans.push({ action: 'reopen', incident, issueNumber: existing.number, comment: recurrenceComment(incident, report) });
      } else if (cooled) {
        plans.push({ action: 'comment', incident, issueNumber: existing.number, comment: recurrenceComment(incident, report) });
      }
    }
    if (plans.length >= maxWrites) break;
  }
  return plans;
}

async function api(url, token, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'the-holding-runtime-reliability',
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init.method || 'GET'} ${url} -> ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function main() {
  const reportFile = process.argv[2];
  const policyFile = process.argv[3] || 'intelligence/reliability/runtime-reliability-policy.json';
  if (!reportFile) throw new Error('usage: runtime-reliability-incident-sink.mjs <report.json> [policy.json]');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY;
  if (!token || !repo) throw new Error('GH_TOKEN/GITHUB_TOKEN and GITHUB_REPOSITORY required');
  const [owner, name] = repo.split('/');
  if (!owner || !name) throw new Error('invalid GITHUB_REPOSITORY');
  const base = `https://api.github.com/repos/${owner}/${name}`;
  const report = JSON.parse(fs.readFileSync(path.resolve(reportFile), 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.resolve(policyFile), 'utf8'));
  const issues = await api(`${base}/issues?state=all&per_page=100&sort=updated&direction=desc`, token);
  const realIssues = (issues || []).filter(x => !x.pull_request);
  const plans = planIncidentWrites(report, realIssues, policy);
  for (const plan of plans) {
    if (plan.action === 'create') {
      await api(`${base}/issues`, token, { method: 'POST', body: JSON.stringify({ title: plan.title, body: plan.body }) });
    } else if (plan.action === 'reopen') {
      await api(`${base}/issues/${plan.issueNumber}`, token, { method: 'PATCH', body: JSON.stringify({ state: 'open' }) });
      await api(`${base}/issues/${plan.issueNumber}/comments`, token, { method: 'POST', body: JSON.stringify({ body: plan.comment }) });
    } else if (plan.action === 'comment') {
      await api(`${base}/issues/${plan.issueNumber}/comments`, token, { method: 'POST', body: JSON.stringify({ body: plan.comment }) });
    }
  }
  console.log(`Runtime incident sink PASS; plannedWrites=${plans.length}`);
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();

export { marker };
