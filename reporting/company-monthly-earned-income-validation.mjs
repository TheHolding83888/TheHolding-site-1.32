import fs from 'node:fs';

const FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const fail = msg => { throw new Error(msg); };

if (data.version !== '0.4-company-monthly-earned-income-accounting') fail('earned-income version drift');
if (data.methodologyVersion !== '0.4-canonical-ledger-sole-income-recognition-authority') fail('earned-income methodology drift');
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

    if (row.accountingCoverageComplete === true) {
      if (!finite(row.generatedIncomeUsd)) fail(`${name} ${month} complete accounting missing numeric income`);
      if (row.incomeAccounting.primaryMetric?.earnedIncomeAuthority !== true) fail(`${name} ${month} complete income lacks authority`);
      if (row.semantic !== 'canonical-earned-income') fail(`${name} ${month} complete semantic drift`);
    } else {
      if (row.generatedIncomeUsd !== null) fail(`${name} ${month} incomplete accounting masquerades as numeric total`);
      if (row.monthlyYieldPct !== null) fail(`${name} ${month} incomplete accounting masquerades as numeric yield`);
      if (row.incomeAccounting.primaryMetric?.earnedIncomeAuthority !== false) fail(`${name} ${month} incomplete income gained authority`);
      if (!['partial-observed', 'unknown-incomplete-coverage'].includes(row.accountingStatus)) fail(`${name} ${month} incomplete accounting status invalid`);
    }
    if (row.incomeAccounting.primaryMetric?.usd !== row.generatedIncomeUsd) fail(`${name} ${month} primary metric drift`);
  }
}

for (const month of ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07']) {
  const row = companies['defitea.eth']?.months?.[month];
  if (!row || row.accountingCoverageComplete !== true || !finite(row.generatedIncomeUsd)) fail(`Defitea verified archive lost ${month}`);
}

for (const [name, month] of [['YieldRing.eth','2026-08'], ['defitea.eth','2026-08'], ['Monetra.eth','2026-08']]) {
  const row = companies[name]?.months?.[month];
  if (!row || row.accountingCoverageComplete !== false || row.generatedIncomeUsd !== null) fail(`${name} ${month} incomplete period masquerades as complete earned income`);
  if (!finite(row.referenceAnalytics?.generatedIncomeUsd)) fail(`${name} ${month} reference analytics not retained`);
}

console.log('Company Monthly Reports ledger-only earned-income validation PASS', {
  companyCount: Object.keys(companies).length,
  completeMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete === true).length,
  partialObservedMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'partial-observed').length,
  unknownMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'unknown-incomplete-coverage').length,
  rawCanonicalEventCount: data.accountingEvidence.rawCanonicalEventCount,
  recognizedCanonicalEventCount: data.accountingEvidence.recognizedCanonicalEventCount,
  unresolvedCanonicalEventCount: data.accountingEvidence.unresolvedCanonicalEventCount,
  claimableSnapshotDerivedIncomeEventCount: data.accountingEvidence.claimableSnapshotDerivedIncomeEventCount
});
