import fs from 'node:fs';

const FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const fail = msg => { throw new Error(msg); };

if (data.version !== '0.3-company-monthly-earned-income-accounting') fail('earned-income version drift');
if (data.methodologyVersion !== '0.3-canonical-earned-income-primary-reference-analytics-secondary') fail('earned-income methodology drift');
if (data.accountingPolicy?.referenceIncomeIsPrimaryMetric !== false) fail('reference income returned to primary metric');
if (data.accountingPolicy?.referenceIncomeIsEarnedIncomeAuthority !== false) fail('reference income became earned-income authority');
if (data.accountingPolicy?.currentRewardBalanceIsPeriodIncome !== false) fail('current reward balance became period income');
if (data.accountingPolicy?.laterPriceMovementRewritesClosedIncome !== false) fail('price movement may rewrite closed income');
if (data.accountingPolicy?.incompleteCoverageMayMasqueradeAsCompleteIncome !== false) fail('incomplete coverage may masquerade as complete');
if (data.accountingPolicy?.executionAuthority !== 'none') fail('authority expanded');
if (data.accountingEvidence?.sourceGeneratedAt !== ledger.generatedAt) fail('stale canonical income ledger');

const companies = data.companies || {};
if (Object.keys(companies).length !== 10) fail(`expected 10 companies, got ${Object.keys(companies).length}`);

for (const [name, company] of Object.entries(companies)) {
  if (company.sourceFamily !== 'canonical-earned-income-accounting') fail(`${name} source family is not accounting`);
  for (const [month, row] of Object.entries(company.months || {})) {
    if (!row.referenceAnalytics) fail(`${name} ${month} missing retained reference analytics`);
    if (row.referenceAnalytics.earnedIncomeAuthority !== false) fail(`${name} ${month} reference analytics became accounting authority`);
    if (!row.incomeAccounting || row.incomeAccounting.version !== '0.2-earned-income-primary') fail(`${name} ${month} missing earned-income accounting view`);
    if (row.incomeAccounting.unknownIsNotZero !== true || row.incomeAccounting.executionAuthority !== 'none') fail(`${name} ${month} epistemic/authority drift`);
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

const yAug = companies['YieldRing.eth']?.months?.['2026-08'];
if (!yAug) fail('YieldRing August missing');
if (yAug.accountingCoverageComplete !== false) fail('YieldRing August incorrectly declared complete');
if (yAug.generatedIncomeUsd !== null) fail('YieldRing August reference estimate still masquerades as earned income');
if (!finite(yAug.referenceAnalytics?.generatedIncomeUsd)) fail('YieldRing August reference analytics not retained');

const dAug = companies['defitea.eth']?.months?.['2026-08'];
if (!dAug || dAug.accountingCoverageComplete !== false || dAug.generatedIncomeUsd !== null) fail('Defitea August mixed reference report still masquerades as complete earned income');

const mAug = companies['Monetra.eth']?.months?.['2026-08'];
if (!mAug || mAug.accountingCoverageComplete !== false || mAug.generatedIncomeUsd !== null) fail('Monetra August reference report still masquerades as complete earned income');

console.log('Company Monthly Reports earned-income validation PASS', {
  companyCount: Object.keys(companies).length,
  completeMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete === true).length,
  partialObservedMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'partial-observed').length,
  unknownMonths: Object.values(companies).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'unknown-incomplete-coverage').length,
  yieldRingAugustReferenceRetainedUsd: yAug.referenceAnalytics.generatedIncomeUsd,
  yieldRingAugustObservedEarnedUsd: yAug.observedEarnedIncomeUsd
});
