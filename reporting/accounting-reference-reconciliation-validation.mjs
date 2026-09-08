#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';

const FILE=process.env.ACCOUNTING_REFERENCE_RECONCILIATION_FILE||'./reporting/accounting-reference-reconciliation.json';
const x=JSON.parse(fs.readFileSync(FILE,'utf8'));
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const allowedScopes=new Set(['company-period','mechanism-base-reference']);
const allowedBands=new Set(['not-comparable','wide-divergence','material-divergence','review-band','broad-parity-band','above-reference']);
const allowedAttention=new Set(['context','high','moderate','review','low']);

assert.equal(x.version,'0.2-accounting-reference-reconciliation-cross-month-attribution');
assert.equal(x.status,'diagnostic-no-completion-authority');
assert.equal(x.periodStart,'2026-08');
assert.equal(x.semantics?.sourceOfTruth,false);
assert.equal(x.semantics?.canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority,true);
assert.equal(x.semantics?.referenceEstimateIsFactualIncome,false);
assert.equal(x.semantics?.referenceEstimateCanBackfillIncome,false);
assert.equal(x.semantics?.deltaIsMissingIncome,false);
assert.equal(x.semantics?.captureRatioIsAccountingCompleteness,false);
assert.equal(x.semantics?.signalBandIsAccountingStatus,false);
assert.equal(x.semantics?.broadParityDoesNotCloseMonth,true);
assert.equal(x.semantics?.modelVariancePossibleDoesNotProveModelVariance,true);
assert.equal(x.semantics?.companyAndMechanismRowsHaveDifferentReferenceScopes,true);
assert.equal(x.semantics?.mechanismRowsDoNotNecessarilySumToCompanyEstimated,true);
assert.equal(x.semantics?.mechanismReferenceAprMayIncludeSupplementaryOverlay,true);
assert.equal(x.semantics?.supplementaryReferenceDoubleAddForbidden,true);
assert.equal(x.semantics?.principalCapitalCountedOnce,true);
assert.equal(x.semantics?.historicalReferenceChannelDecompositionIsNotInferred,true);
assert.equal(x.semantics?.explicitCanonicalPeriodAttributionCanResolveDiagnosticBoundary,true);
assert.equal(x.semantics?.explicitCanonicalPeriodAttributionCannotCreateOrReallocateIncome,true);
assert.equal(x.semantics?.unknownIsNotZero,true);
assert.equal(x.diagnosticBands?.accountingAuthority,false);
assert.equal(x.diagnosticBands?.monthClosingAuthority,false);
assert.equal(x.prioritizationPolicy?.numericalConvergenceTarget,false);
assert.equal(x.authority?.readOnly,true);
assert.equal(x.authority?.sourceOfTruth,false);
assert.equal(x.authority?.incomeCreationAuthority,false);
assert.equal(x.authority?.factualIncomeAuthority,false);
assert.equal(x.authority?.referenceIncomeAuthority,false);
assert.equal(x.authority?.accountingCompletionAuthority,false);
assert.equal(x.authority?.monthClosingAuthority,false);
assert.equal(x.authority?.canReplaceUnknown,false);
assert.equal(x.authority?.methodologyMutationAuthority,'none');
assert.equal(x.authority?.walletAuthority,'none');
assert.equal(x.authority?.capitalExecution,false);
assert.equal(x.authority?.executionAuthority,'none');
assert.ok(Array.isArray(x.rows)&&x.rows.length>0);
assert.equal(new Set(x.rows.map(row=>row.id)).size,x.rows.length,'reconciliation row identities must be unique');

for(const row of x.rows){
  assert.ok(allowedScopes.has(row.scope),`unsupported reconciliation scope ${row.scope}`);
  assert.match(String(row.month||''),/^\d{4}-\d{2}$/);
  assert.ok(String(row.company||'').length>0);
  assert.ok(allowedBands.has(row.signalBand),`unsupported signal band ${row.signalBand}`);
  assert.ok(allowedAttention.has(row.attention),`unsupported attention ${row.attention}`);
  assert.equal(row.sourceOfTruth,false,`${row.id} became source of truth`);
  assert.equal(row.incomeCreationAuthority,false,`${row.id} gained income authority`);
  assert.equal(row.monthClosingAuthority,false,`${row.id} gained month-closing authority`);
  assert.equal(row.canReplaceUnknown,false,`${row.id} can replace UNKNOWN`);
  assert.equal(row.executionAuthority,'none',`${row.id} execution authority drift`);
  assert.equal(row.modelVarianceIsProven,false,`${row.id} inferred model variance as fact`);
  if(finite(row.referenceUsd)&&finite(row.confirmedUsd)){
    assert.equal(row.deltaUsd,Math.round((Number(row.referenceUsd)-Number(row.confirmedUsd))*1e8)/1e8,`${row.id} delta mismatch`);
  }else{
    assert.equal(row.deltaUsd,null,`${row.id} must keep non-comparable delta null`);
  }
  if(finite(row.referenceUsd)&&Number(row.referenceUsd)>0&&finite(row.confirmedUsd)){
    assert.ok(finite(row.captureRatio),`${row.id} comparable row missing ratio`);
    assert.ok(Number(row.captureRatio)>=0,`${row.id} capture ratio must be non-negative`);
  }else{
    assert.equal(row.captureRatio,null,`${row.id} non-comparable row gained ratio`);
    assert.equal(row.signalBand,'not-comparable',`${row.id} non-comparable row gained signal`);
  }
  assert.ok(Array.isArray(row.reasonCodes)&&row.reasonCodes.length>0,`${row.id} reason codes missing`);
  const comparisonText=String(row.comparisonSemantic||'').toLowerCase();
  assert.ok(!comparisonText.includes('missing income')||comparisonText.includes('does not prove missing income'),`${row.id} comparison text implies missing income`);
}

const companyRows=x.rows.filter(row=>row.scope==='company-period');
assert.ok(companyRows.some(row=>row.company==='defitea.eth'&&row.month==='2026-08'),'Defitea August company reconciliation row missing');
assert.ok(companyRows.some(row=>row.company==='defitea.eth'&&row.month==='2026-09'),'Defitea September company reconciliation row missing');
for(const row of companyRows){
  assert.equal(row.factualTrackingActive,null,'company-period row must not fake one mechanism tracking state');
  assert.ok(Array.isArray(row.referenceScopeContributors));
  assert.ok(Array.isArray(row.confirmedOwnerBreakdown));
}

const mechanismRows=x.rows.filter(row=>row.scope==='mechanism-base-reference');
assert.ok(mechanismRows.length>0,'Defitea mechanism reconciliation rows missing');
assert.ok(mechanismRows.some(row=>row.company==='defitea.eth'&&row.month==='2026-08'&&row.mechanism==='aerodrome_veaero'),'Defitea August veAERO mechanism row missing');
for(const row of mechanismRows){
  assert.equal(row.company,'defitea.eth','v0.2 mechanism reference scope must remain bounded to Defitea');
  assert.equal(row.companyEstimatedReconciliationAuthority,false,`${row.id} mechanism row gained company-total authority`);
  assert.equal(row.referenceScope,'Defitea principal productive position with one admitted effective Reference APR');
  assert.ok(Array.isArray(row.referenceScopeExcludes)&&row.referenceScopeExcludes.includes('associated-company-reference-contributors'));
  assert.ok(row.referenceScopeExcludes.includes('separate-supplementary-reference-double-add'));
  assert.equal(row.principalCapitalCountedOnce,true,`${row.id} principal capital duplication guard missing`);
  assert.equal(row.referenceAprMayIncludeSupplementaryChannelOverlay,true,`${row.id} supplementary overlay possibility missing`);
  assert.equal(row.supplementaryReferenceMustNotBeAddedAgain,true,`${row.id} supplementary Reference double-add guard missing`);
  assert.equal(row.referenceRateComposition,'published-effective-rate-as-observed',`${row.id} historical effective-rate semantics missing`);
  assert.equal(row.referenceRateChannelDecompositionAuthority,false,`${row.id} inferred historical channel decomposition`);
  assert.ok(row.reasonCodes.includes('principal-position-reference-comparator-is-non-factual'),`${row.id} principal comparator reason missing`);
  assert.ok(!row.reasonCodes.includes('base-position-reference-comparator-is-non-factual'),`${row.id} retained misleading base-only semantics`);
  assert.ok(Number(row.referenceSampleDays)>0);
  assert.ok(Array.isArray(row.referencePositionIds)&&row.referencePositionIds.length>0);

  const cross=Number(row.crossMonthEvidenceCount||0);
  const attributed=Number(row.crossMonthExplicitlyAttributedCount||0);
  const unresolved=Number(row.crossMonthUnresolvedCount||0);
  assert.ok(Number.isInteger(cross)&&cross>=0,`${row.id} invalid cross-month evidence count`);
  assert.ok(Number.isInteger(attributed)&&attributed>=0&&attributed<=cross,`${row.id} invalid explicitly-attributed cross-month count`);
  assert.ok(Number.isInteger(unresolved)&&unresolved>=0&&unresolved<=cross,`${row.id} invalid unresolved cross-month count`);
  assert.equal(attributed+unresolved,cross,`${row.id} cross-month diagnostic partition drift`);
  assert.equal(row.periodBoundaryIssue,unresolved>0,`${row.id} period boundary must depend only on unresolved cross-month evidence`);
  if(cross>0&&unresolved===0){
    assert.ok(attributed>0,`${row.id} resolved cross-month evidence lacks explicit canonical attribution`);
    assert.ok(row.reasonCodes.includes('canonical-cross-month-attribution-resolved'),`${row.id} resolved attribution reason missing`);
  }
  if(unresolved>0){
    assert.ok(row.reasonCodes.includes('unresolved-cross-month-evidence'),`${row.id} unresolved cross-month reason missing`);
  }
}

const summary=x.summary||{};
assert.equal(summary.rowCount,x.rows.length);
assert.equal(summary.companyPeriodRowCount,companyRows.length);
assert.equal(summary.mechanismBaseReferenceRowCount,mechanismRows.length);
console.log('Accounting Reference Reconciliation validation PASS',summary);
