#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';

const FILE = process.env.HISTORICAL_ACCOUNTING_COMPLETENESS_FILE || './reporting/historical-accounting-completeness-map.json';
const map = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const states = new Set(['complete', 'partial', 'tracking-no-event', 'unknown', 'n/a']);
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));

assert.equal(map.version, '0.1-historical-accounting-completeness-map');
assert.equal(map.status, 'diagnostic-no-completion-authority');
assert.match(map.currentMonth, /^\d{4}-\d{2}$/);
assert.equal(map.semantics?.sourceOfTruth, false);
assert.equal(map.semantics?.canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority, true);
assert.equal(map.semantics?.completeMeansDiagnosticEvidenceCompletenessNotAccountingClosure, true);
assert.equal(map.semantics?.completeStateHasMonthClosingAuthority, false);
assert.equal(map.semantics?.trackingNoEventIsZeroIncomeProof, false);
assert.equal(map.semantics?.currentPeriodCanBeComplete, false);
assert.equal(map.semantics?.referenceAprCanBackfillIncome, false);
assert.equal(map.semantics?.estimatedIncomeCanReplaceUnknown, false);
assert.equal(map.semantics?.missingEvidenceCanBecomeNotApplicable, false);
assert.equal(map.semantics?.crossMonthProrationAllowed, false);
assert.equal(map.semantics?.unknownIsNotZero, true);
assert.equal(map.authority?.readOnly, true);
assert.equal(map.authority?.sourceOfTruth, false);
assert.equal(map.authority?.factualIncomeAuthority, false);
assert.equal(map.authority?.incomeCreationAuthority, false);
assert.equal(map.authority?.accountingCompletionAuthority, false);
assert.equal(map.authority?.monthClosingAuthority, false);
assert.equal(map.authority?.canReplaceUnknown, false);
assert.equal(map.authority?.methodologyMutationAuthority, 'none');
assert.equal(map.authority?.walletAuthority, 'none');
assert.equal(map.authority?.capitalExecution, false);
assert.equal(map.authority?.executionAuthority, 'none');
assert.ok(Array.isArray(map.rows) && map.rows.length > 0);
assert.ok(Array.isArray(map.companyMonths) && map.companyMonths.length > 0);
assert.equal(new Set(map.rows.map(row => row.id)).size, map.rows.length, 'mechanism-month row identities must be unique');
assert.equal(new Set(map.companyMonths.map(row => row.id)).size, map.companyMonths.length, 'company-month row identities must be unique');

for (const row of map.rows) {
  assert.ok(states.has(row.state), `unsupported completeness state ${row.state}`);
  assert.match(row.month, /^\d{4}-\d{2}$/);
  assert.ok(String(row.company || '').length > 0);
  assert.ok(String(row.mechanism || '').length > 0);
  assert.ok(Array.isArray(row.reasonCodes) && row.reasonCodes.length > 0, `${row.id} reason codes missing`);
  assert.equal(row.sourceOfTruth, false, `${row.id} became source of truth`);
  assert.equal(row.incomeCreationAuthority, false, `${row.id} gained income authority`);
  assert.equal(row.monthClosingAuthority, false, `${row.id} gained month closing authority`);
  assert.equal(row.canReplaceUnknown, false, `${row.id} can replace UNKNOWN`);
  assert.equal(row.executionAuthority, 'none', `${row.id} execution authority drift`);

  if (row.state === 'complete') {
    assert.notEqual(row.month, map.currentMonth, `${row.id} current month became complete`);
    assert.equal(row.factualTrackingActive, true, `${row.id} complete without factual tracking`);
    assert.ok(Number(row.factualEventCount || 0) > 0, `${row.id} complete without factual events`);
    assert.equal(Number(row.factualValuedEventCount || 0), Number(row.factualEventCount || 0), `${row.id} complete with unvalued events`);
    assert.ok(finite(row.factualUsdSubtotal), `${row.id} complete without factual USD subtotal`);
    assert.equal(Number(row.crossMonthUnresolvedCount || 0), 0, `${row.id} complete with unresolved cross-month evidence`);
    assert.notEqual(row.factualTrackingObservationComplete, false, `${row.id} complete with partial source observation`);
    assert.equal((row.sourceCompletionBlockers || []).length, 0, `${row.id} complete with source blockers`);
    assert.equal(row.evidenceComplete, true, `${row.id} complete state lacks evidenceComplete`);
  }

  if (row.state === 'partial') {
    assert.equal(row.evidenceComplete, false, `${row.id} partial became evidence-complete`);
  }

  if (row.state === 'tracking-no-event') {
    assert.equal(row.factualTrackingActive, true, `${row.id} no-event row lacks factual tracking`);
    assert.equal(Number(row.factualEventCount || 0), 0, `${row.id} no-event row has factual event`);
    assert.notEqual(row.factualTrackingObservationComplete, false, `${row.id} no-event row hides partial source observation`);
    assert.equal(Number(row.crossMonthUnresolvedCount || 0), 0, `${row.id} no-event row hides cross-month unresolved evidence`);
    assert.equal(row.evidenceComplete, false, `${row.id} no-event state became completion authority`);
  }

  if (row.state === 'unknown') {
    assert.equal(row.evidenceComplete, false, `${row.id} UNKNOWN became complete`);
  }

  if (row.state === 'n/a') {
    assert.ok(row.reasonCodes.includes('explicitly-not-applicable'), `${row.id} N/A was inferred without explicit non-applicability`);
  }
}

for (const row of map.companyMonths) {
  assert.ok(states.has(row.state), `unsupported company-month state ${row.state}`);
  assert.equal(row.sourceOfTruth, false);
  assert.equal(row.incomeCreationAuthority, false);
  assert.equal(row.monthClosingAuthority, false);
  assert.equal(row.canReplaceUnknown, false);
  assert.equal(row.executionAuthority, 'none');
  if (row.month === map.currentMonth) assert.notEqual(row.state, 'complete', `${row.id} open company month became complete`);
  if (row.state === 'complete') assert.equal(row.evidenceComplete, true, `${row.id} complete company month lacks evidenceComplete`);
}

const byId = id => map.rows.find(row => row.id === id);
const defiteaVeloAugust = byId('defitea.eth:2026-08:velodrome_vevelo');
assert.ok(defiteaVeloAugust, 'Defitea August veVELO completeness row missing');
assert.equal(defiteaVeloAugust.state, 'complete', 'Defitea August veVELO should remain complete after canonical historical valuation materialization');
assert.equal(Number(defiteaVeloAugust.factualEventCount), 19);
assert.equal(Number(defiteaVeloAugust.factualValuedEventCount), 19);
assert.ok(Math.abs(Number(defiteaVeloAugust.factualUsdSubtotal) - 2.04403678) < 1e-8);

const beefySeptember = byId('1milliondollar.eth:2026-09:beefy_cvxcrv');
assert.ok(beefySeptember, '1milliondollar September Beefy completeness row missing');
assert.equal(beefySeptember.state, 'partial');
assert.ok(beefySeptember.reasonCodes.includes('cross-month-boundary-unresolved'));

const firstCurveAugust = byId('05081966.eth:2026-08:curve_vecrv');
assert.ok(firstCurveAugust, '05081966 August veCRV completeness row missing');
assert.equal(firstCurveAugust.state, 'unknown');

const firstAeroAugust = byId('05081966.eth:2026-08:aerodrome_veaero');
assert.ok(firstAeroAugust, '05081966 August veAERO completeness row missing');
assert.equal(firstAeroAugust.state, 'tracking-no-event');

assert.equal(map.summary?.rowCount, map.rows.length);
assert.equal(map.summary?.companyMonthCount, map.companyMonths.length);
assert.equal(map.summary?.completeCount, map.rows.filter(row => row.state === 'complete').length);
assert.equal(map.summary?.partialCount, map.rows.filter(row => row.state === 'partial').length);
assert.equal(map.summary?.trackingNoEventCount, map.rows.filter(row => row.state === 'tracking-no-event').length);
assert.equal(map.summary?.unknownCount, map.rows.filter(row => row.state === 'unknown').length);
assert.equal(map.summary?.notApplicableCount, map.rows.filter(row => row.state === 'n/a').length);

console.log('Historical Accounting Completeness Map validation PASS', map.summary);
