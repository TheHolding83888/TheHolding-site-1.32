#!/usr/bin/env node
/**
 * THE HOLDING — OPERATING EVENT INTELLIGENCE v0.1
 *
 * Read-only deterministic synthesis of source-backed company/protocol events.
 * It never executes capital actions and never invents causal explanations.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const FILES = {
  policy: process.env.EVENT_POLICY_PATH || 'intelligence/event-intelligence-policy.json',
  history: process.env.EVENT_HISTORY_PATH || 'intelligence/change-history.json',
  reporting: process.env.EVENT_REPORTING_PATH || 'reporting/reporting-data.json',
  output: process.env.EVENT_OUTPUT_PATH || 'intelligence/event-intelligence.json'
};
const VERSION = '0.1-operating-event-intelligence';
const ENGINE_VERSION = '0.1-source-backed-event-synthesizer';

function fail(message) { throw new Error(message); }
function readJson(rel) {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  if (!fs.existsSync(abs)) fail(`Required file missing: ${rel}`);
  const text = fs.readFileSync(abs, 'utf8');
  if (!text.trim()) fail(`Required file empty: ${rel}`);
  try { return { data: JSON.parse(text), text }; }
  catch (error) { fail(`Invalid JSON in ${rel}: ${error.message}`); }
}
function writeJson(rel, value) {
  const abs = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, JSON.stringify(value, null, 2) + '\n', 'utf8');
}
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function iso(value) {
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}
function ageHours(timestamp, nowMs) {
  const t = iso(timestamp);
  return t ? Math.max(0, (nowMs - Date.parse(t)) / 3_600_000) : null;
}
function round(value, digits = 4) {
  if (!finite(value)) return null;
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
function pctChange(previous, current) {
  if (!finite(previous) || !finite(current) || previous === 0) return null;
  return ((current - previous) / Math.abs(previous)) * 100;
}
function eventId(core) { return `EV-${sha256(JSON.stringify(core)).slice(0, 20)}`; }
function nowIso() {
  const override = process.env.EVENT_NOW;
  if (override) {
    const parsed = iso(override);
    if (!parsed) fail('EVENT_NOW is invalid');
    return parsed;
  }
  return new Date().toISOString();
}
function normalizedCompanyName(key) {
  if (key === 'defitea.eth') return 'Defitea';
  if (key === 'monetra.eth') return 'Monetra';
  return key;
}
function validatePolicy(policy) {
  if (policy?.version !== '0.1-operating-event-policy') fail('Unexpected event policy version');
  if (policy?.mode !== 'read-only-source-backed-event-intelligence') fail('Event policy mode mismatch');
  if (policy?.authority?.executionAuthority !== 'none') fail('Event Intelligence executionAuthority must remain none');
  if (policy?.authority?.capitalActionAllowed !== false || policy?.authority?.walletActionAllowed !== false) {
    fail('Event Intelligence action authority must remain disabled');
  }
  if (!Array.isArray(policy.eventTypes) || !Array.isArray(policy.coverageGaps)) fail('Policy event type arrays missing');
}
function isObservedAprChange(previous, current) {
  return finite(previous) && finite(current) && previous !== current;
}
function baseEvent({ type, mode, occurredAt, entity, headline, detail, severity = 'info', source, metrics = {}, attribution = null }) {
  const core = { type, mode, occurredAt, entity, headline, detail, severity, source, metrics, attribution };
  return { id: eventId(core), ...core };
}
function deriveRewardMilestones(history, policy) {
  const step = Number(policy.feed.rewardMilestoneUsdStep);
  if (!Number.isFinite(step) || step <= 0) return [];
  const out = [];
  for (const e of history.events || []) {
    if (e?.category !== 'rewards' || e?.metric !== 'totalUsd') continue;
    const prev = num(e.previousValue), cur = num(e.currentValue);
    if (prev === null || cur === null || cur <= prev) continue;
    const first = Math.floor(prev / step) + 1;
    const last = Math.floor(cur / step);
    for (let n = first; n <= last; n += 1) {
      const milestone = n * step;
      out.push(baseEvent({
        type: 'reward-usd-milestone',
        mode: 'derived',
        occurredAt: iso(e.detectedAt),
        entity: e.entity || 'Unknown company',
        headline: `${e.entity || 'Company'} rewards crossed $${milestone}`,
        detail: `Accrued reward value moved $${prev.toFixed(2)} → $${cur.toFixed(2)} and crossed the $${milestone} milestone.`,
        severity: 'info',
        source: { kind: 'change-history', eventId: e.id, sourceKeys: e.sourceKeys || [] },
        metrics: { previousUsd: round(prev, 6), currentUsd: round(cur, 6), milestoneUsd: milestone },
        attribution: { status: 'not-separated', note: 'Current lane cannot yet separate newly accrued reward units from reward-token price effect for this crossing.' }
      }));
    }
  }
  return out;
}
function deriveReportingEvents(reporting, policy) {
  const out = [];
  const tvlThreshold = Number(policy.feed.companyDailyTvlMovePct ?? 10);
  for (const [fundKey, fund] of Object.entries(reporting.funds || {})) {
    const rows = Array.isArray(fund?.daily) ? fund.daily.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))) : [];
    for (let i = 1; i < rows.length; i += 1) {
      const prev = rows[i - 1], cur = rows[i];
      const occurredAt = iso(cur.capturedAt) || (cur.date ? `${cur.date}T00:00:00.000Z` : null);
      const entity = normalizedCompanyName(fundKey);
      const prevTvl = num(prev.totalValueUsd), curTvl = num(cur.totalValueUsd);
      const tvlPct = prevTvl !== null && curTvl !== null ? pctChange(prevTvl, curTvl) : null;
      if (finite(tvlPct) && Math.abs(tvlPct) >= tvlThreshold) {
        out.push(baseEvent({
          type: 'company-daily-tvl-move',
          mode: 'derived',
          occurredAt,
          entity,
          headline: `${entity} TVL moved ${tvlPct >= 0 ? '+' : ''}${tvlPct.toFixed(1)}% in one daily observation`,
          detail: `Daily company value changed $${prevTvl.toFixed(2)} → $${curTvl.toFixed(2)}. This is a review signal, not a strategy conclusion.`,
          severity: 'review',
          source: { kind: 'reporting', fund: fundKey, previousDate: prev.date, currentDate: cur.date },
          metrics: { previousUsd: round(prevTvl, 4), currentUsd: round(curTvl, 4), changePct: round(tvlPct, 4), ownerThresholdPct: tvlThreshold }
        }));
      }
      const prevApr = num(prev.referenceApr), curApr = num(cur.referenceApr);
      if (isObservedAprChange(prevApr, curApr)) {
        const pp = curApr - prevApr;
        const rel = pctChange(prevApr, curApr);
        out.push(baseEvent({
          type: 'company-reference-apr-change',
          mode: 'derived',
          occurredAt,
          entity,
          headline: `${entity} reference APR moved ${prevApr.toFixed(2)}% → ${curApr.toFixed(2)}%`,
          detail: `Company-level reference APR changed ${pp >= 0 ? '+' : ''}${pp.toFixed(2)} pp. Event Intelligence does not infer the cause without protocol-specific volume/fee evidence.`,
          severity: 'watch',
          source: { kind: 'reporting', fund: fundKey, previousDate: prev.date, currentDate: cur.date },
          metrics: { previousAprPct: round(prevApr, 6), currentAprPct: round(curApr, 6), changePp: round(pp, 6), relativeChangePct: round(rel, 4) },
          attribution: { status: 'unattributed', note: 'Volume/fee/revenue causality is a coverage gap until bound to a verified mechanism-specific source.' }
        }));
      }
      const prevPositions = new Map((prev.positions || []).filter(p => p?.engineId).map(p => [p.engineId, p]));
      for (const p of cur.positions || []) {
        if (!p?.engineId || !prevPositions.has(p.engineId)) continue;
        const prior = prevPositions.get(p.engineId);
        const a = num(prior.referenceApr), b = num(p.referenceApr);
        if (!isObservedAprChange(a, b)) continue;
        const pp = b - a;
        const rel = pctChange(a, b);
        const protocolLabel = p.principalId || p.engineId;
        out.push(baseEvent({
          type: 'protocol-reference-apr-change',
          mode: 'derived',
          occurredAt,
          entity: `${entity} · ${protocolLabel}`,
          headline: `${protocolLabel} reference APR moved ${a.toFixed(2)}% → ${b.toFixed(2)}%`,
          detail: `The tracked productive route changed ${pp >= 0 ? '+' : ''}${pp.toFixed(2)} pp between daily snapshots. Cause remains unassigned until protocol economics are measured directly.`,
          severity: 'watch',
          source: { kind: 'reporting', fund: fundKey, engineId: p.engineId, previousDate: prev.date, currentDate: cur.date },
          metrics: { previousAprPct: round(a, 6), currentAprPct: round(b, 6), changePp: round(pp, 6), relativeChangePct: round(rel, 4) },
          attribution: { status: 'unattributed', note: 'Do not equate APR movement with trading-volume movement without source-backed protocol economics.' }
        }));
      }
    }
  }
  return out;
}
function normalizeMeasuredHistory(history) {
  const out = [];
  for (const e of history.events || []) {
    const base = {
      occurredAt: iso(e.detectedAt),
      entity: e.entity || 'System',
      source: { kind: 'change-history', eventId: e.id, sourceKeys: e.sourceKeys || [] }
    };
    if (e.category === 'reporting' && e.metric === 'currentMonthGeneratedIncomeUsd') {
      out.push(baseEvent({ ...base, type: 'generated-income-change', mode: 'measured', headline: e.summary || `${e.entity} generated income changed`, detail: e.whyItMatters || 'Generated income changed.', severity: e.severity || 'info', metrics: { previousUsd: num(e.previousValue), currentUsd: num(e.currentValue) } }));
    } else if (e.category === 'reporting' && e.metric === 'currentMonthCashFlowUsd') {
      out.push(baseEvent({ ...base, type: 'cash-flow-counter-change', mode: 'measured', headline: e.summary || `${e.entity} cash-flow counter changed`, detail: e.whyItMatters || 'Cash-flow counter changed.', severity: e.severity || 'info', metrics: { previousUsd: num(e.previousValue), currentUsd: num(e.currentValue) } }));
    } else if (e.category === 'stable-capital' && e.metric === 'coverage-state') {
      out.push(baseEvent({ ...base, type: 'coverage-state-change', mode: 'measured', headline: e.summary || 'Stable coverage state changed', detail: e.whyItMatters || 'Coverage state changed.', severity: e.severity || 'important', metrics: { previous: e.previousValue, current: e.currentValue } }));
    } else if (e.category === 'stable-capital' && ['currentCapitalUsd', 'embeddedIncomeSinceTrackingUsd'].includes(e.metric)) {
      out.push(baseEvent({ ...base, type: 'stable-capital-change', mode: 'measured', headline: e.summary || 'Stable Capital changed', detail: e.whyItMatters || 'Stable Capital state changed.', severity: e.severity || 'info', metrics: { metric: e.metric, previous: e.previousValue, current: e.currentValue } }));
    } else if (e.category === 'reporting' && e.metric === 'new-daily-snapshot') {
      out.push(baseEvent({ ...base, type: 'daily-reporting-observation', mode: 'measured', headline: e.summary || `${e.entity} added a daily observation`, detail: e.whyItMatters || 'Daily operating memory extended.', severity: 'memory', metrics: { previousDate: e.previousValue, currentDate: e.currentValue } }));
    } else if (e.category === 'rewards' && e.metric === 'totalUsd') {
      out.push(baseEvent({ ...base, type: 'reward-value-change', mode: 'measured', headline: e.summary || `${e.entity} accrued rewards changed`, detail: e.whyItMatters || 'Accrued reward value changed.', severity: e.severity || 'info', metrics: { previousUsd: num(e.previousValue), currentUsd: num(e.currentValue) }, attribution: { status: 'not-separated', note: 'USD movement may combine newly accrued units and reward-token price movement until route-level decomposition is canonical.' } }));
    } else {
      out.push(baseEvent({ ...base, type: 'observer-material-change', mode: 'measured', headline: e.summary || `${e.entity || 'System'} observed ${e.metric || e.category || 'a change'}`, detail: e.whyItMatters || 'Canonical Observer history recorded this change.', severity: e.severity || 'info', metrics: { category: e.category ?? null, metric: e.metric ?? null, previous: e.previousValue ?? null, current: e.currentValue ?? null } }));
    }
  }
  return out;
}
function dedupe(items) {
  const map = new Map();
  for (const item of items) {
    if (!item?.id) continue;
    map.set(item.id, item);
  }
  return [...map.values()];
}
function rankSeverity(value) {
  return ({ review: 5, important: 4, watch: 3, info: 2, memory: 1 }[String(value)] ?? 0);
}

const generatedAt = nowIso();
const nowMs = Date.parse(generatedAt);
const policyLoaded = readJson(FILES.policy);
const historyLoaded = readJson(FILES.history);
const reportingLoaded = readJson(FILES.reporting);
const policy = policyLoaded.data;
const history = historyLoaded.data;
const reporting = reportingLoaded.data;
validatePolicy(policy);
if (!Array.isArray(history?.events)) fail('change-history events missing');
if (!reporting?.funds || typeof reporting.funds !== 'object') fail('reporting funds missing');

const eventTypes = policy.eventTypes.map(x => ({ ...x }));
const active = eventTypes.filter(x => x.status === 'active');
const measuredCount = active.filter(x => x.mode === 'measured').length;
const derivedCount = active.filter(x => x.mode === 'derived').length;
const planned = policy.coverageGaps.map(x => ({ ...x }));

const events = dedupe([
  ...deriveRewardMilestones(history, policy),
  ...deriveReportingEvents(reporting, policy),
  ...normalizeMeasuredHistory(history)
]).filter(e => e.occurredAt)
  .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || rankSeverity(b.severity) - rankSeverity(a.severity));

const maxItems = Math.max(10, Number(policy.feed.maxItems) || 80);
const reportingAge = ageHours(reporting.generatedAt, nowMs);
const historyAge = ageHours(history.lastUpdatedAt, nowMs);
const sourceHealth = {
  status: ((reportingAge !== null && reportingAge <= Number(policy.freshness.reportingMaxAgeHours)) && (historyAge !== null && historyAge <= Number(policy.freshness.changeHistoryMaxAgeHours))) ? 'fresh' : 'watch',
  reporting: { generatedAt: iso(reporting.generatedAt), ageHours: round(reportingAge, 2), maxAgeHours: policy.freshness.reportingMaxAgeHours, sha256: sha256(reportingLoaded.text) },
  changeHistory: { generatedAt: iso(history.lastUpdatedAt), ageHours: round(historyAge, 2), maxAgeHours: policy.freshness.changeHistoryMaxAgeHours, sha256: sha256(historyLoaded.text) }
};

const output = {
  version: VERSION,
  engineVersion: ENGINE_VERSION,
  generatedAt,
  status: sourceHealth.status === 'fresh' ? 'ok' : 'watch',
  purpose: 'Source-backed operating event telemetry for The Holding console and future Curators.',
  authority: {
    executionAuthority: 'none',
    readOnly: true,
    automaticCapitalAction: false,
    automaticPolicyMutation: false
  },
  tracked: {
    activeEventTypeCount: active.length,
    measuredEventTypeCount: measuredCount,
    derivedEventTypeCount: derivedCount,
    coverageGapCount: planned.length,
    eventTypes: active,
    coverageGaps: planned
  },
  sourceHealth,
  feed: {
    itemCount: Math.min(events.length, maxItems),
    totalDerivedFromAvailableHistory: events.length,
    maxItems,
    items: events.slice(0, maxItems)
  },
  semantics: {
    measured: 'Directly normalized from canonical event history.',
    derived: 'Deterministically computed from canonical historical observations.',
    coverageGap: 'Requested intelligence that is not yet supported by a canonical source contract.',
    causality: 'APR, TVL or reward movement never proves a protocol-level cause by itself.'
  },
  integrity: {
    policySha256: sha256(policyLoaded.text),
    reportingSha256: sha256(reportingLoaded.text),
    changeHistorySha256: sha256(historyLoaded.text)
  }
};

writeJson(FILES.output, output);
console.log(`Event Intelligence: ${output.status}`);
console.log(`Tracked event types: ${output.tracked.activeEventTypeCount}`);
console.log(`Coverage gaps: ${output.tracked.coverageGapCount}`);
console.log(`Feed items: ${output.feed.itemCount}`);
