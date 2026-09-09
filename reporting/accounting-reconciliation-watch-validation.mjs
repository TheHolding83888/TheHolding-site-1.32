#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const NOTICE_FILE = process.env.ACCOUNTING_NOTICE_QUEUE_FILE || './reporting/accounting-notice-queue.json';
const RECONCILIATION_FILE = process.env.ACCOUNTING_REFERENCE_RECONCILIATION_FILE || './reporting/accounting-reference-reconciliation.json';
const COMPLETENESS_FILE = process.env.HISTORICAL_ACCOUNTING_COMPLETENESS_FILE || './reporting/historical-accounting-completeness-map.json';
const WATCH_FILE = process.env.ACCOUNTING_RECONCILIATION_WATCH_FILE || './reporting/accounting-reconciliation-watch.json';

function read(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
}

function expectedNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Number(numeric.toFixed(8)) : null;
}

const notice = read(NOTICE_FILE);
const reconciliation = read(RECONCILIATION_FILE);
const completeness = read(COMPLETENESS_FILE);
const watch = read(WATCH_FILE);

assert.equal(watch.version, '0.1.1-accounting-reconciliation-watch-null-preserving');
assert.equal(watch.status, 'diagnostic-watch-no-accounting-authority');
assert.equal(watch.currentMonth, completeness.currentMonth || notice.currentMonth);
assert.equal(watch.semantics?.sourceOfTruth, false);
assert.equal(watch.semantics?.canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority, true);
assert.equal(watch.semantics?.accountingCoverageRemainsFactualTrackingAuthority, true);
assert.equal(watch.semantics?.referenceDeltaIsMissingIncome, false);
assert.equal(watch.semantics?.trackingNoEventIsFailure, false);
assert.equal(watch.semantics?.openMonthPartialIsHistoricalFailure, false);
assert.equal(watch.semantics?.evidencePendingIsEngineeringFailure, false);
assert.equal(watch.semantics?.resolvedWatchItemClosesAccounting, false);
assert.equal(watch.semantics?.baselineCreatesAlerts, false);
assert.equal(watch.semantics?.crossMonthProrationAllowed, false);
assert.equal(watch.semantics?.nullAmountsRemainUnknown, true);
assert.equal(watch.semantics?.unknownIsNotZero, true);

for (const [key, expected] of Object.entries({
  sourceOfTruth: false,
  factualIncomeAuthority: false,
  incomeCreationAuthority: false,
  accountingCompletionAuthority: false,
  monthClosingAuthority: false,
  canReplaceUnknown: false,
  executionAuthority: 'none',
  capitalExecution: false,
  walletAuthority: false
})) assert.equal(watch.authority?.[key], expected, `watch authority expanded: ${key}`);

assert.ok(Array.isArray(watch.items));
assert.ok(Array.isArray(watch.resolved));
assert.ok(Array.isArray(watch.alerts));
assert.ok(Array.isArray(watch.evidenceUpdates));
assert.ok(Array.isArray(watch.diagnosticUpdates));
assert.match(String(watch.semanticFingerprint || ''), /^[a-f0-9]{64}$/);
assert.equal(new Set(watch.items.map(x => x.id)).size, watch.items.length, 'duplicate watch ids');

const currentMonth = watch.currentMonth;
const closedRows = (completeness.rows || []).filter(row => row.month && row.month < currentMonth);
const expectedEngineering = (notice.rows || []).filter(row => row.engineeringActionable === true).length;
const expectedEvidencePending = (notice.rows || []).filter(row => row.engineeringActionable !== true && row.parked === true).length;
const expectedHistorical = closedRows.filter(row => row.state === 'unknown' || row.state === 'partial').length;
const expectedHighReference = (reconciliation.rows || []).filter(row => row.attention === 'high' && row.parked !== true && row.engineeringActionable !== true).length;

assert.equal(watch.summary.watchItemCount, watch.items.length);
assert.equal(watch.summary.engineeringActionRequiredCount, expectedEngineering);
assert.equal(watch.summary.evidencePendingCount, expectedEvidencePending);
assert.equal(watch.summary.historicalForensicReviewCount, expectedHistorical);
assert.equal(watch.summary.referenceDiagnosticReviewCount, expectedHighReference);
assert.equal(watch.summary.closedPeriodUnknownCount, closedRows.filter(row => row.state === 'unknown').length);
assert.equal(watch.summary.closedPeriodPartialCount, closedRows.filter(row => row.state === 'partial').length);
assert.equal(watch.summary.closedPeriodTrackingNoEventCount, closedRows.filter(row => row.state === 'tracking-no-event').length);
assert.equal(watch.summary.highAttentionReferenceRowCount, expectedHighReference);

for (const item of watch.items) {
  assert.equal(item.sourceOfTruth, false, `${item.id} gained source-of-truth authority`);
  assert.equal(item.incomeCreationAuthority, false, `${item.id} gained income authority`);
  assert.equal(item.accountingCompletionAuthority, false, `${item.id} gained accounting completion authority`);
  assert.equal(item.monthClosingAuthority, false, `${item.id} gained month closing authority`);
  assert.equal(item.canReplaceUnknown, false, `${item.id} can replace UNKNOWN`);
  assert.equal(item.executionAuthority, 'none', `${item.id} gained execution authority`);
  assert.equal(item.capitalExecution, false, `${item.id} gained capital execution`);
  assert.equal(item.walletAuthority, false, `${item.id} gained wallet authority`);
  assert.match(String(item.fingerprint || ''), /^[a-f0-9]{64}$/);
  assert.ok(['baseline', 'new', 'changed', 'unchanged'].includes(item.transition), `${item.id} invalid transition`);

  if (item.watchClass === 'historical-forensic-review') {
    assert.ok(item.month < currentMonth, `${item.id} open month promoted to historical failure`);
    assert.ok(item.detail?.sourceState === 'unknown' || item.detail?.sourceState === 'partial', `${item.id} historical watch class without Unknown/Partial`);
  }
  if (item.detail?.sourceState === 'tracking-no-event') {
    assert.notEqual(item.watchClass, 'historical-forensic-review', `${item.id} tracking-no-event promoted to forensic failure`);
    assert.notEqual(item.watchClass, 'engineering-action-required', `${item.id} tracking-no-event promoted to engineering failure`);
  }
  if (item.watchClass === 'reference-diagnostic-review') {
    assert.equal(item.actionability, 'diagnostic-only');
    assert.ok((item.reasonCodes || []).includes('reference-comparator-is-non-factual'));
  }

  // Numeric projection must preserve source null/UNKNOWN. null must never silently become zero.
  if (item.source === 'accounting-notice-queue') {
    const sourceId = item.id.slice('notice:'.length);
    const row = (notice.rows || []).find(x => x.id === sourceId);
    assert.ok(row, `${item.id} notice source row missing`);
    for (const key of ['confirmedUsd', 'estimatedUsd', 'deltaUsd']) {
      assert.equal(item.detail?.[key], expectedNumber(row[key]), `${item.id} null/value projection drift: ${key}`);
    }
  } else if (item.source === 'historical-accounting-completeness-map') {
    const sourceId = item.id.slice('historical:'.length);
    const row = (completeness.rows || []).find(x => x.id === sourceId);
    assert.ok(row, `${item.id} completeness source row missing`);
    assert.equal(item.detail?.factualUsdSubtotal, expectedNumber(row.factualUsdSubtotal), `${item.id} factualUsdSubtotal null/value projection drift`);
  } else if (item.source === 'accounting-reference-reconciliation') {
    const sourceId = item.id.slice('reconciliation:'.length);
    const row = (reconciliation.rows || []).find(x => x.id === sourceId);
    assert.ok(row, `${item.id} reconciliation source row missing`);
    for (const key of ['referenceUsd', 'confirmedUsd', 'deltaUsd', 'captureRatio']) {
      assert.equal(item.detail?.[key], expectedNumber(row[key]), `${item.id} null/value projection drift: ${key}`);
    }
  }
}

for (const item of watch.resolved) {
  assert.equal(item.resolutionSemantic, 'watch-item-no-longer-present-in-derived-current-state; not accounting-close proof');
}

function item(id) {
  return watch.items.find(row => row.id === id);
}

const beefyBoundary = item('notice:period-lifecycle-reconciliation:1milliondollar.eth:2026-09:__company_period__');
assert.ok(beefyBoundary, '1milliondollar boundary evidence watch missing');
assert.equal(beefyBoundary.watchClass, 'evidence-pending');
assert.equal(beefyBoundary.actionability, 'external-evidence');
assert.equal(beefyBoundary.detail?.engineeringActionable, false);
assert.equal(beefyBoundary.detail?.parked, true);
assert.equal(beefyBoundary.detail?.prorationAllowed, false);

const monetraBoundary = item('notice:period-lifecycle-reconciliation:Monetra.eth:2026-09:__company_period__');
assert.ok(monetraBoundary, 'Monetra boundary evidence watch missing');
assert.equal(monetraBoundary.watchClass, 'evidence-pending');
assert.equal(monetraBoundary.detail?.engineeringActionable, false);
assert.equal(monetraBoundary.detail?.parked, true);
assert.equal(monetraBoundary.detail?.prorationAllowed, false);

const ownerPending = item('notice:period-lifecycle-reconciliation:0x5860...83CA8.eth:2026-09:icp_nns');
assert.ok(ownerPending, 'ICP owner-data-pending watch missing');
assert.equal(ownerPending.watchClass, 'evidence-pending');
assert.equal(ownerPending.detail?.estimatedUsd, null, 'owner-data-pending estimated UNKNOWN became zero');
assert.equal(ownerPending.detail?.confirmedUsd, null, 'owner-data-pending confirmed UNKNOWN became zero');
assert.equal(ownerPending.detail?.deltaUsd, null, 'owner-data-pending delta UNKNOWN became zero');

const historicalCurve = item('historical:05081966.eth:2026-08:curve_vecrv');
assert.ok(historicalCurve, 'closed-period veCRV Unknown forensic watch missing');
assert.equal(historicalCurve.watchClass, 'historical-forensic-review');
assert.equal(historicalCurve.detail?.sourceState, 'unknown');
assert.equal(historicalCurve.detail?.factualUsdSubtotal, null, 'veCRV historical UNKNOWN USD became zero');

assert.equal(item('historical:05081966.eth:2026-08:aerodrome_veaero'), undefined, 'tracking-no-event veAERO must not become forensic backlog');
assert.equal(item('historical:defitea.eth:2026-08:velodrome_vevelo'), undefined, 'Complete Defitea veVELO must not remain forensic backlog');

if (watch.baseline === true) {
  assert.equal(watch.summary.newCount, 0);
  assert.equal(watch.summary.changedCount, 0);
  assert.equal(watch.summary.unchangedCount, 0);
  assert.equal(watch.summary.baselineCount, watch.items.length);
  assert.equal(watch.summary.resolvedCount, 0);
  assert.equal(watch.summary.alertCount, 0);
  assert.equal(watch.summary.evidenceUpdateCount, 0);
  assert.equal(watch.summary.diagnosticUpdateCount, 0);
  assert.deepEqual(watch.alerts, []);
  assert.deepEqual(watch.evidenceUpdates, []);
  assert.deepEqual(watch.diagnosticUpdates, []);
}

console.log('Accounting Reconciliation Watch validation PASS', {
  version: watch.version,
  baseline: watch.baseline,
  semanticFingerprint: watch.semanticFingerprint,
  ...watch.summary
});
