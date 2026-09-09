#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const ROOT = process.cwd();
const read = file => JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

const coverage = read('./reporting/accounting-coverage.json');
const ledger = read('./reporting/income-ledger.json');
const monthly = read('./reporting/company-monthly-reports.json');
const notice = read('./reporting/accounting-notice-queue.json');
const reconciliation = read('./reporting/accounting-reference-reconciliation.json');
const completeness = read('./reporting/historical-accounting-completeness-map.json');
const watch = read('./reporting/accounting-reconciliation-watch.json');
const lifecycle = read('./reporting/income-lifecycle-contract.json');
const earned = buildCanonicalEarnedIncomeView(ledger);

const currentMonth = coverage.currentMonth;
assert.match(String(currentMonth || ''), /^\d{4}-\d{2}$/, 'current accounting month missing');
assert.equal(currentMonth, completeness.currentMonth, 'Coverage/Completeness current month drift');
assert.equal(currentMonth, notice.currentMonth, 'Coverage/Notice current month drift');
assert.equal(currentMonth, watch.currentMonth, 'Coverage/Watch current month drift');

// Canonical authority plane.
assert.equal(ledger.version, '0.1-canonical-income-ledger');
assert.equal(ledger.semantics?.unknownIsNotZero, true);
assert.equal(ledger.semantics?.referenceAprCanBackfillEarnedIncome, false);
assert.equal(ledger.authority?.executionAuthority, 'none');
assert.equal(ledger.authority?.capitalExecution, false);
assert.equal(coverage.semantics?.canonicalLedgerIsSoleFactualIncomeAuthority, true);
assert.equal(monthly.accountingPolicy?.canonicalLedgerIsSoleMonthlyIncomeEventSource, true);
assert.equal(monthly.accountingPolicy?.monthlyLayerCreatesIncomeEvents, false);
assert.equal(monthly.accountingPolicy?.referenceIncomeIsEarnedIncomeAuthority, false);
assert.equal(monthly.accountingPolicy?.estimatedIncomeCanReplaceUnknown, false);
assert.equal(monthly.accountingPolicy?.executionAuthority, 'none');
assert.equal(monthly.incomeLedger?.generatedAt, ledger.generatedAt, 'Monthly Reports are not bound to current Canonical Income Ledger');
assert.equal(coverage.summary?.canonicalLedgerEventCount, ledger.events?.length, 'Coverage/Ledger event-count drift');

// Coverage acceptance.
assert.equal(coverage.status, 'diagnostic-no-completion-authority');
assert.equal(coverage.summary?.reusableCoverageGapCount, 0, 'reusable accounting coverage gap remains');
assert.equal(coverage.summary?.unclassifiedMechanismInstanceCount, 0, 'unclassified accounting mechanism remains');
assert.equal(coverage.summary?.classifiedMechanismInstanceCount, coverage.summary?.mechanismInstanceCount, 'mechanism classification parity drift');
assert.equal(coverage.semantics?.coverageGapMeansMissingFactualTrackingCapability, true);
assert.equal(coverage.semantics?.zeroPeriodEventDoesNotImplyCoverageGap, true);
assert.equal(coverage.semantics?.settlementLinkIsNotPeriodIncomeAuthority, true);
assert.equal(coverage.semantics?.crossMonthWithoutExplicitCanonicalAttributionRemainsUnresolved, true);
assert.equal(coverage.semantics?.unknownIsNotZero, true);
assert.equal(coverage.authority?.monthClosingAuthority, false);
assert.equal(coverage.authority?.capitalExecution, false);

// Company/month projection acceptance and September rollover.
assert.equal(monthly.version, '0.5-company-monthly-confirmed-estimated-view');
assert.equal(monthly.methodologyVersion, '0.4-canonical-ledger-sole-income-recognition-authority');
const companies = monthly.companies || {};
const companyNames = Object.keys(companies);
assert.equal(companyNames.length, 10, `expected 10 companies, got ${companyNames.length}`);
assert.equal(coverage.summary?.companyCount, companyNames.length, 'Coverage/Monthly company count drift');
for (const [name, company] of Object.entries(companies)) {
  const aug = company.months?.['2026-08'];
  const current = company.months?.[currentMonth];
  assert.ok(aug, `${name} August report missing`);
  assert.ok(current, `${name} ${currentMonth} report missing`);
  assert.match(String(aug.periodStart || ''), /^2026-08-\d{2}$/, `${name} August period start drift`);
  assert.match(String(aug.periodEnd || ''), /^2026-08-\d{2}$/, `${name} August period end drift`);
  assert.match(String(current.periodStart || ''), new RegExp(`^${currentMonth}-\\d{2}$`), `${name} current-month period start drift`);
  assert.match(String(current.periodEnd || ''), new RegExp(`^${currentMonth}-\\d{2}$`), `${name} current-month period end drift`);
  assert.equal(company.incomeReportingScope?.canonicalOwnershipPreserved, true, `${name} company ownership drift`);
  assert.equal(company.incomeReportingScope?.crossCompanyReattributionAllowed, false, `${name} cross-company reattribution enabled`);
  for (const [month, row] of Object.entries(company.months || {})) {
    assert.equal(row.incomeReportingScope?.canonicalOwnershipPreserved, true, `${name} ${month} ownership drift`);
    assert.equal(row.incomeReportingScope?.crossCompanyReattributionAllowed, false, `${name} ${month} reattribution drift`);
    assert.equal(row.incomeAccounting?.unknownIsNotZero, true, `${name} ${month} UNKNOWN boundary drift`);
    assert.equal(row.incomeAccounting?.executionAuthority, 'none', `${name} ${month} execution authority drift`);
    assert.equal(row.incomeView?.relationship?.additive, false, `${name} ${month} Confirmed + Estimated became additive`);
    assert.equal(row.incomeView?.relationship?.confirmedPlusEstimatedIsValidTotal, false, `${name} ${month} Confirmed + Estimated became valid total`);
  }
}

// Canonical earned-income lifecycle / non-overlap acceptance.
assert.equal(earned.version, '0.1-canonical-earned-income-view');
assert.equal(earned.semantics?.claimableSnapshotsCreateIncome, false);
assert.equal(earned.semantics?.genericReceiptCreatesIncome, false);
assert.equal(earned.semantics?.settlementDoesNotReRecognizeIncome, true);
assert.equal(earned.semantics?.crossMonthTimeProrationCreatesIncome, false);
assert.equal(earned.semantics?.unknownIsNotZero, true);
const recognitionIds = new Set();
const recognizedEventKeys = new Set();
for (const row of earned.recognized || []) {
  assert.ok(row.recognitionId, `${row.eventKey} recognition id missing`);
  assert.equal(recognitionIds.has(row.recognitionId), false, `duplicate recognition id ${row.recognitionId}`);
  recognitionIds.add(row.recognitionId);
  assert.equal(recognizedEventKeys.has(row.eventKey), false, `duplicate recognized event ${row.eventKey}`);
  recognizedEventKeys.add(row.eventKey);
}
for (const row of earned.settlements || []) {
  assert.equal(row.recognizesEarnedIncome, false, `${row.eventKey} settlement recognized income`);
  assert.ok(row.settlementOf, `${row.eventKey} settlement provenance missing`);
  assert.equal(recognizedEventKeys.has(row.eventKey), false, `${row.eventKey} counted as earned and settlement`);
}

// Historical Completeness Map is diagnostic acceptance, not month close.
assert.equal(completeness.version, '0.1-historical-accounting-completeness-map');
assert.equal(completeness.status, 'diagnostic-no-completion-authority');
assert.equal(completeness.semantics?.currentPeriodCanBeComplete, false);
assert.equal(completeness.semantics?.trackingNoEventIsZeroIncomeProof, false);
assert.equal(completeness.semantics?.crossMonthProrationAllowed, false);
assert.equal(completeness.semantics?.unknownIsNotZero, true);
assert.equal(completeness.sourceState?.accountingCoverage?.version, coverage.version, 'Completeness/Coverage version drift');
assert.equal(completeness.sourceState?.accountingCoverage?.generatedAt, coverage.generatedAt, 'Completeness/Coverage generation drift');
assert.equal(completeness.sourceState?.companyMonthlyReports?.version, monthly.version, 'Completeness/Monthly version drift');
assert.equal(completeness.sourceState?.companyMonthlyReports?.generatedAt, monthly.generatedAt, 'Completeness/Monthly generation drift');
assert.equal(completeness.summary?.companyCount, companyNames.length, 'Completeness company count drift');
assert.equal(completeness.summary?.mechanismInstanceCount, coverage.summary?.mechanismInstanceCount, 'Completeness mechanism count drift');
const currentRows = (completeness.rows || []).filter(row => row.month === currentMonth);
assert.equal(currentRows.length, coverage.summary?.mechanismInstanceCount, 'current-month completeness row parity drift');
assert.equal(currentRows.some(row => row.state === 'complete'), false, 'open/current month became Complete');
assert.equal(currentRows.some(row => row.state === 'unknown'), false, 'current month still has Unknown factual-tracking state');
assert.equal(currentRows.every(row => ['partial', 'tracking-no-event'].includes(row.state)), true, 'current month has unexpected completeness state');
const augustCrossMonthUnresolved = (completeness.rows || []).filter(row => row.month === '2026-08' && Number(row.crossMonthUnresolvedCount || 0) > 0);
assert.equal(augustCrossMonthUnresolved.length, 0, 'unresolved cross-month evidence leaked back into August');
for (const row of (completeness.rows || []).filter(row => row.month === currentMonth && Number(row.crossMonthUnresolvedCount || 0) > 0)) {
  assert.equal(row.state, 'partial', `${row.id} unresolved boundary is not Partial`);
  assert.ok((row.reasonCodes || []).includes('cross-month-boundary-unresolved'), `${row.id} unresolved boundary reason missing`);
}

// Notice / reconciliation closure: no engineering defect remains; accepted evidence boundaries stay explicit.
assert.equal(notice.status, 'diagnostic-no-completion-authority');
assert.equal(notice.summary?.engineeringActionableCount, 0, 'engineering-actionable accounting notice remains');
assert.equal(notice.summary?.missingCapabilityCount, 0, 'missing factual-tracking capability remains');
assert.equal(notice.semantics?.boundaryEvidencePendingIsEngineeringFailure, false);
assert.equal(notice.semantics?.crossMonthIntervalProrationAllowed, false);
assert.equal(notice.semantics?.unknownIsNotZero, true);
for (const row of notice.rows || []) {
  if (row.blocker === 'historical-boundary-evidence-pending' || row.blocker === 'owner-data-pending') {
    assert.equal(row.parked, true, `${row.id} accepted evidence boundary is not parked`);
    assert.equal(row.engineeringActionable, false, `${row.id} accepted evidence boundary became engineering failure`);
  }
  if (row.boundaryEvidencePending === true) assert.equal(row.prorationAllowed, false, `${row.id} boundary proration enabled`);
  if (row.category === 'tracking-no-period-event') assert.equal(row.engineeringActionable, false, `${row.id} tracking-no-event became engineering failure`);
}

assert.equal(reconciliation.status, 'diagnostic-no-completion-authority');
assert.equal(reconciliation.summary?.engineeringActionableCompanyPeriodCount, 0, 'engineering-actionable reconciliation company period remains');
assert.equal(reconciliation.semantics?.deltaIsMissingIncome, false);
assert.equal(reconciliation.semantics?.captureRatioIsAccountingCompleteness, false);
assert.equal(reconciliation.semantics?.supplementaryReferenceDoubleAddForbidden, true);
assert.equal(reconciliation.semantics?.principalCapitalCountedOnce, true);
assert.equal(reconciliation.semantics?.boundaryEvidencePendingIsEngineeringFailure, false);
assert.equal(reconciliation.semantics?.crossMonthIntervalProrationAllowed, false);
assert.equal(reconciliation.semantics?.unknownIsNotZero, true);
assert.equal(reconciliation.sourceState?.companyMonthlyReports?.generatedAt, monthly.generatedAt, 'Reconciliation/Monthly generation drift');
assert.equal(reconciliation.sourceState?.accountingCoverage?.generatedAt, coverage.generatedAt, 'Reconciliation/Coverage generation drift');
assert.equal(reconciliation.sourceState?.accountingNoticeQueue?.generatedAt, notice.generatedAt, 'Reconciliation/Notice generation drift');
for (const row of reconciliation.rows || []) assert.notEqual(row.engineeringActionable, true, `${row.id} reconciliation remains engineering-actionable`);

// Automatic watch must preserve all accepted classifications without fabricating alerts or zeroes.
assert.equal(watch.version, '0.1.1-accounting-reconciliation-watch-null-preserving');
assert.equal(watch.status, 'diagnostic-watch-no-accounting-authority');
assert.equal(watch.summary?.engineeringActionRequiredCount, 0, 'Reconciliation Watch has engineering action required');
assert.equal(watch.summary?.alertCount, 0, 'Reconciliation Watch has active baseline alerts');
assert.equal(watch.semantics?.referenceDeltaIsMissingIncome, false);
assert.equal(watch.semantics?.trackingNoEventIsFailure, false);
assert.equal(watch.semantics?.evidencePendingIsEngineeringFailure, false);
assert.equal(watch.semantics?.nullAmountsRemainUnknown, true);
assert.equal(watch.semantics?.unknownIsNotZero, true);
assert.equal(watch.sourceState?.accountingNoticeQueue?.generatedAt, notice.generatedAt, 'Watch/Notice generation drift');
assert.equal(watch.sourceState?.accountingReferenceReconciliation?.generatedAt, reconciliation.generatedAt, 'Watch/Reconciliation generation drift');
assert.equal(watch.sourceState?.historicalAccountingCompleteness?.generatedAt, completeness.generatedAt, 'Watch/Completeness generation drift');
for (const item of watch.items || []) {
  assert.equal(item.sourceOfTruth, false, `${item.id} watch gained truth authority`);
  assert.equal(item.incomeCreationAuthority, false, `${item.id} watch gained income authority`);
  assert.equal(item.monthClosingAuthority, false, `${item.id} watch gained month-close authority`);
  assert.equal(item.executionAuthority, 'none', `${item.id} watch gained execution authority`);
}

// Reusable lifecycle contract exists and remains non-authoritative.
assert.equal(lifecycle.version, '0.1-income-lifecycle-contract');
assert.deepEqual(lifecycle.sequence, ['earned', 'accrued', 'claimable', 'claimed', 'received', 'reinvested']);
assert.equal(lifecycle.invariants?.sameEconomicIncomeRecognizedAtMostOnce, true);
assert.equal(lifecycle.invariants?.settlementDoesNotReRecognizeIncome, true);
assert.equal(lifecycle.invariants?.reinvestmentCreatesSecondIncome, false);
assert.equal(lifecycle.invariants?.crossMonthProrationAllowed, false);
assert.equal(lifecycle.invariants?.unknownIsNotZero, true);
assert.equal(lifecycle.authority?.sourceOfTruth, false);
assert.equal(lifecycle.authority?.incomeCreationAuthority, false);
assert.equal(lifecycle.authority?.monthClosingAuthority, false);
assert.equal(lifecycle.authority?.executionAuthority, 'none');

const currentStateCounts = Object.fromEntries(
  ['complete', 'partial', 'tracking-no-event', 'unknown', 'n/a'].map(state => [state, currentRows.filter(row => row.state === state).length])
);
const unresolvedCrossMonthCurrent = currentRows.filter(row => Number(row.crossMonthUnresolvedCount || 0) > 0).map(row => row.id);

console.log('PUBLIC FOUNDATION v1 final acceptance audit PASS', {
  currentMonth,
  companies: companyNames.length,
  mechanismInstances: coverage.summary.mechanismInstanceCount,
  uniqueMechanisms: coverage.summary.uniqueMechanismCount,
  reusableCoverageGaps: coverage.summary.reusableCoverageGapCount,
  canonicalLedgerEvents: ledger.events.length,
  recognizedIncomeEvents: earned.summary.recognizedEventCount,
  settlementOnlyEvents: earned.summary.settlementOnlyEventCount,
  unresolvedCanonicalEvents: earned.summary.unresolvedEventCount,
  currentMonthStates: currentStateCounts,
  augustCrossMonthUnresolvedCount: augustCrossMonthUnresolved.length,
  currentMonthCrossMonthPending: unresolvedCrossMonthCurrent,
  noticeEngineeringActionable: notice.summary.engineeringActionableCount,
  noticeParked: notice.summary.parkedCount,
  reconciliationEngineeringActionableCompanyPeriods: reconciliation.summary.engineeringActionableCompanyPeriodCount,
  watchEngineeringActionRequired: watch.summary.engineeringActionRequiredCount,
  watchEvidencePending: watch.summary.evidencePendingCount,
  watchHistoricalForensicReview: watch.summary.historicalForensicReviewCount,
  lifecycleVersion: lifecycle.version,
  executionAuthority: 'none'
});
