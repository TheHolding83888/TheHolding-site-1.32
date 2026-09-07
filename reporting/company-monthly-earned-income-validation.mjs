import fs from 'node:fs';

const FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const fail = msg => { throw new Error(msg); };
const closeEnough = (a, b, epsilon = 1e-9) => finite(a) && finite(b) && Math.abs(Number(a) - Number(b)) <= epsilon;

if (data.version !== '0.5-company-monthly-confirmed-estimated-view') fail('earned-income version drift');
if (data.methodologyVersion !== '0.4-canonical-ledger-sole-income-recognition-authority') fail('earned-income methodology drift');
if (data.presentationModelVersion !== '0.1-confirmed-estimated-non-additive') fail('confirmed/estimated presentation model drift');
if (data.accountingPolicy?.canonicalLedgerIsSoleMonthlyIncomeEventSource !== true) fail('Canonical Ledger lost sole monthly income-event authority');
if (data.accountingPolicy?.monthlyLayerCreatesIncomeEvents !== false) fail('monthly layer regained income-event creation authority');
if (data.accountingPolicy?.claimableSnapshotDeltaCreatesIncome !== false) fail('claimable snapshot delta became income authority');
if (data.accountingPolicy?.genericReceiptCreatesIncome !== false) fail('generic receipt became income authority');
if (data.accountingPolicy?.referenceIncomeIsPrimaryMetric !== false) fail('reference income returned to primary metric');
if (data.accountingPolicy?.referenceIncomeIsEarnedIncomeAuthority !== false) fail('reference income became earned-income authority');
if (data.accountingPolicy?.currentRewardBalanceIsPeriodIncome !== false) fail('current reward balance became period income');
if (data.accountingPolicy?.accruedIncomeMayBeEarnedBeforeClaim !== true) fail('earned accrual became dependent on claim');
if (data.accountingPolicy?.embeddedCompoundingMayBeEarnedIncome !== true) fail('embedded compounding lost earned-income semantics');
if (data.accountingPolicy?.settlementDoesNotReRecognizeEarnedIncome !== true) fail('settlement may re-recognize prior income');
if (data.accountingPolicy?.laterPriceMovementRewritesClosedIncome !== false) fail('price movement may rewrite closed income');
if (data.accountingPolicy?.incompleteCoverageMayMasqueradeAsCompleteIncome !== false) fail('incomplete coverage may masquerade as complete');
if (data.accountingPolicy?.observedPeriodYieldUsesCanonicalEarnedIncomeOnly !== true) fail('observed-period yield lost canonical-income basis');
if (data.accountingPolicy?.observedPeriodYieldDoesNotImplyFullMonthCoverage !== true) fail('observed-period yield may imply full-month coverage');
if (data.accountingPolicy?.confirmedAndEstimatedAreNonAdditive !== true) fail('confirmed and estimated lanes became additive');
if (data.accountingPolicy?.estimatedIncomeIsAlternativeAnalyticView !== true) fail('estimated lane lost alternative-view semantics');
if (data.accountingPolicy?.estimatedIncomeCanCloseAccountingCoverage !== false) fail('estimated lane can close accounting coverage');
if (data.accountingPolicy?.estimatedIncomeCanReplaceUnknown !== false) fail('estimated lane can replace UNKNOWN');
if (data.accountingPolicy?.executionAuthority !== 'none') fail('authority expanded');
if (data.accountingEvidence?.sourceGeneratedAt !== ledger.generatedAt) fail('stale canonical income ledger');
if (data.accountingEvidence?.claimableSnapshotDerivedIncomeEventCount !== 0) fail('monthly report contains snapshot-derived income events');
if (data.accountingEvidence?.monthlyIncomeEventDiscoveryAuthority !== false) fail('monthly report gained event-discovery authority');

const companies = data.companies || {};
if (Object.keys(companies).length !== 10) fail(`expected 10 companies, got ${Object.keys(companies).length}`);

for (const [name, company] of Object.entries(companies)) {
  if (company.sourceFamily !== 'canonical-earned-income-accounting') fail(`${name} source family is not accounting`);
  for (const [month, row] of Object.entries(company.months || {})) {
    if (!row.referenceAnalytics) fail(`${name} ${month} missing retained reference analytics`);
    if (row.referenceAnalytics.earnedIncomeAuthority !== false) fail(`${name} ${month} reference analytics became accounting authority`);
    if (!row.incomeAccounting || row.incomeAccounting.version !== '0.3-ledger-sole-recognition-authority') fail(`${name} ${month} missing ledger-only earned-income view`);
    if (row.incomeAccounting.unknownIsNotZero !== true || row.incomeAccounting.executionAuthority !== 'none') fail(`${name} ${month} epistemic/authority drift`);
    if (row.incomeAccounting.monthlyLayerCreatesIncomeEvents === true) fail(`${name} ${month} monthly layer creates income events`);
    if (row.incomeAccounting.claimableSnapshotDeltaCreatesIncome === true) fail(`${name} ${month} claimable snapshots create income`);
    if (row.incomeAccounting.primaryMetric?.observedPeriodYieldPct !== row.observedPeriodYieldPct) fail(`${name} ${month} observed-period yield projection drift`);

    const view = row.incomeView;
    if (!view || view.version !== '0.1-confirmed-estimated-non-additive') fail(`${name} ${month} missing confirmed/estimated view`);
    if (view.unknownIsNotZero !== true || view.executionAuthority !== 'none') fail(`${name} ${month} confirmed/estimated epistemic or authority drift`);
    if (view.relationship?.additive !== false || view.relationship?.confirmedPlusEstimatedIsValidTotal !== false) fail(`${name} ${month} confirmed + estimated became a valid sum`);
    if (view.relationship?.estimatedMayOverlapConfirmedEconomics !== true || view.relationship?.estimatedIsAlternativeAnalyticView !== true) fail(`${name} ${month} estimated overlap/alternative semantics missing`);
    if (view.estimated?.earnedIncomeAuthority !== false || view.estimated?.factualIncomeAuthority !== false) fail(`${name} ${month} estimated lane became factual income authority`);
    if (view.estimated?.canCloseAccountingCoverage !== false || view.estimated?.canReplaceUnknown !== false) fail(`${name} ${month} estimated lane can close/replace accounting truth`);
    if (view.confirmed?.periodStart !== (row.periodStart || null) || view.confirmed?.periodEnd !== (row.periodEnd || null)) fail(`${name} ${month} confirmed period drift`);
    if (view.estimated?.periodStart !== (row.periodStart || null) || view.estimated?.periodEnd !== (row.periodEnd || null)) fail(`${name} ${month} estimated period drift`);

    const expectedEstimateAvailable = row.mode !== 'reported-realised' && finite(row.referenceAnalytics.generatedIncomeUsd);
    if (view.estimated.available !== expectedEstimateAvailable) fail(`${name} ${month} estimated availability drift`);
    if (expectedEstimateAvailable) {
      if (!finite(view.estimated.usd) || !closeEnough(view.estimated.usd, row.referenceAnalytics.generatedIncomeUsd, 1e-8)) fail(`${name} ${month} estimated USD drift`);
      if (view.estimated.basis !== 'existing-reference-model') fail(`${name} ${month} estimated basis drift`);
      if (finite(row.referenceAnalytics.monthlyYieldPct) && !closeEnough(view.estimated.yieldPct, row.referenceAnalytics.monthlyYieldPct, 1e-8)) fail(`${name} ${month} estimated yield drift`);
    } else {
      if (view.estimated.usd !== null || view.estimated.yieldPct !== null || view.estimated.basis !== null) fail(`${name} ${month} unavailable estimate became numeric`);
    }

    if (row.accountingCoverageComplete === true) {
      if (!finite(row.generatedIncomeUsd)) fail(`${name} ${month} complete accounting missing numeric income`);
      if (row.incomeAccounting.primaryMetric?.earnedIncomeAuthority !== true) fail(`${name} ${month} complete income lacks authority`);
      if (row.semantic !== 'canonical-earned-income') fail(`${name} ${month} complete semantic drift`);
      if (view.confirmed?.status !== 'complete' || view.confirmed?.fullPeriodComplete !== true || view.confirmed?.fullPeriodTotalAuthority !== true) fail(`${name} ${month} complete confirmed lane lost full-period authority`);
      if (!closeEnough(view.confirmed?.usd, row.generatedIncomeUsd, 1e-8)) fail(`${name} ${month} complete confirmed USD drift`);
      if (view.confirmed?.factualRecognizedAmount !== true || view.confirmed?.amountRecognitionAuthority !== 'canonical-earned-income-view') fail(`${name} ${month} complete confirmed amount lost factual recognition`);
      if (finite(row.averageCapitalUsd) && Number(row.averageCapitalUsd) > 0) {
        if (!finite(row.observedPeriodYieldPct)) fail(`${name} ${month} complete accounting missing observed-period yield`);
        if (!closeEnough(row.monthlyYieldPct, row.observedPeriodYieldPct, 1e-8)) fail(`${name} ${month} complete monthly yield differs from observed-period yield`);
        if (!closeEnough(view.confirmed?.yieldPct, row.monthlyYieldPct, 1e-8)) fail(`${name} ${month} complete confirmed yield drift`);
      }
    } else {
      if (row.generatedIncomeUsd !== null) fail(`${name} ${month} incomplete accounting masquerades as numeric total`);
      if (row.monthlyYieldPct !== null) fail(`${name} ${month} incomplete accounting masquerades as full-month numeric yield`);
      if (row.incomeAccounting.primaryMetric?.earnedIncomeAuthority !== false) fail(`${name} ${month} incomplete income gained authority`);
      if (!['partial-observed', 'unknown-incomplete-coverage'].includes(row.accountingStatus)) fail(`${name} ${month} incomplete accounting status invalid`);
      if (view.confirmed?.fullPeriodComplete !== false || view.confirmed?.fullPeriodTotalAuthority !== false) fail(`${name} ${month} incomplete confirmed lane gained full-period authority`);

      if (row.accountingStatus === 'partial-observed') {
        if (!(Number(row.accountingEvidenceCount || 0) > 0)) fail(`${name} ${month} partial-observed missing factual evidence`);
        if (!finite(row.observedEarnedIncomeUsd)) fail(`${name} ${month} partial-observed missing observed income`);
        if (view.confirmed?.status !== 'partial-observed' || !closeEnough(view.confirmed?.usd, row.observedEarnedIncomeUsd, 1e-8)) fail(`${name} ${month} partial confirmed amount drift`);
        if (view.confirmed?.factualRecognizedAmount !== true || view.confirmed?.amountRecognitionAuthority !== 'canonical-earned-income-view') fail(`${name} ${month} partial confirmed amount lost factual recognition`);
        if (finite(row.averageCapitalUsd) && Number(row.averageCapitalUsd) > 0 && !finite(row.observedPeriodYieldPct)) {
          fail(`${name} ${month} partial-observed missing observed-period yield`);
        }
        if (finite(row.observedPeriodYieldPct) && !closeEnough(view.confirmed?.yieldPct, row.observedPeriodYieldPct, 1e-8)) fail(`${name} ${month} partial confirmed yield drift`);
      }

      if (row.accountingStatus === 'unknown-incomplete-coverage') {
        if (row.observedPeriodYieldPct !== null) fail(`${name} ${month} unknown period fabricated observed yield`);
        if (view.confirmed?.status !== 'unknown' || view.confirmed?.usd !== null || view.confirmed?.yieldPct !== null) fail(`${name} ${month} UNKNOWN period fabricated confirmed amount`);
        if (view.confirmed?.factualRecognizedAmount !== false || view.confirmed?.amountRecognitionAuthority !== 'none') fail(`${name} ${month} UNKNOWN period gained factual recognition`);
      }
    }
    if (row.incomeAccounting.primaryMetric?.usd !== row.generatedIncomeUsd) fail(`${name} ${month} primary metric drift`);
  }
}

for (const month of ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07']) {
  const row = companies['defitea.eth']?.months?.[month];
  if (!row || row.accountingCoverageComplete !== true || !finite(row.generatedIncomeUsd)) fail(`Defitea verified archive lost ${month}`);
  if (row.incomeView?.estimated?.available !== false) fail(`Defitea verified realised archive incorrectly exposes estimate ${month}`);
}

for (const [name, month] of [['YieldRing.eth','2026-08'], ['defitea.eth','2026-08'], ['Monetra.eth','2026-08']]) {
  const row = companies[name]?.months?.[month];
  if (!row || row.accountingCoverageComplete !== false || row.generatedIncomeUsd !== null) fail(`${name} ${month} incomplete period masquerades as complete earned income`);
  if (!finite(row.referenceAnalytics?.generatedIncomeUsd)) fail(`${name} ${month} reference analytics not retained`);
  if (row.incomeView?.estimated?.available !== true || !finite(row.incomeView?.estimated?.usd)) fail(`${name} ${month} estimated lane missing from incomplete period`);
  if (row.incomeView?.relationship?.additive !== false) fail(`${name} ${month} estimated lane became additive`);
  if (row.accountingStatus === 'partial-observed' && finite(row.averageCapitalUsd) && Number(row.averageCapitalUsd) > 0 && !finite(row.observedPeriodYieldPct)) {
    fail(`${name} ${month} factual partial period missing observed-period yield`);
  }
}

console.log('Company Monthly Reports confirmed/estimated earned-income validation PASS', {
  companyCount: Object.keys(companies).length,
  completeMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete === true).length,
  partialObservedMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'partial-observed').length,
  partialObservedYieldMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'partial-observed' && finite(m.observedPeriodYieldPct)).length,
  estimatedMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.incomeView?.estimated?.available === true).length,
  unknownMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'unknown-incomplete-coverage').length,
  rawCanonicalEventCount: data.accountingEvidence.rawCanonicalEventCount,
  recognizedCanonicalEventCount: data.accountingEvidence.recognizedCanonicalEventCount,
  unresolvedCanonicalEventCount: data.accountingEvidence.unresolvedCanonicalEventCount,
  claimableSnapshotDerivedIncomeEventCount: data.accountingEvidence.claimableSnapshotDerivedIncomeEventCount
});