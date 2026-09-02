import fs from 'node:fs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const REPORT_FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';
const REPORTING_FILE = process.env.REPORTING_DATA_FILE || './reporting/reporting-data.json';

const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
const reporting = JSON.parse(fs.readFileSync(REPORTING_FILE, 'utf8'));
const earned = buildCanonicalEarnedIncomeView(ledger);

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const round = (v, d = 8) => finite(v) ? Math.round(Number(v) * 10 ** d) / 10 ** d : null;
const monthKey = v => {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : null;
};

function legacyDefiteaActual(month, row) {
  const source = reporting?.funds?.['defitea.eth']?.months?.[month];
  return Boolean(source && source.mode === 'reported-realised' && finite(source.cashFlowUsd) && month <= '2026-07' && finite(row.generatedIncomeUsd));
}

function rowsForMonth(rows, company, month) {
  return rows.filter(row => row.company === company && (row.month || monthKey(row.economicDate || row.periodEnd)) === month);
}

function sumUsd(rows) {
  if (!rows.length) return 0;
  if (rows.some(row => !finite(row.usdValue))) return null;
  return round(rows.reduce((sum, row) => sum + Number(row.usdValue), 0), 8);
}

function familySummary(rows, family) {
  const selected = rows.filter(row => row.family === family);
  return { eventCount: selected.length, usd: sumUsd(selected) };
}

report.version = '0.4-company-monthly-earned-income-accounting';
report.methodologyVersion = '0.4-canonical-ledger-sole-income-recognition-authority';
report.generatedAt = new Date().toISOString();
report.accountingPolicy = {
  recognitionBasis: 'canonical-ledger-admitted-events-with-explicit-non-overlap-recognition',
  canonicalLedgerIsSoleMonthlyIncomeEventSource: true,
  monthlyLayerCreatesIncomeEvents: false,
  claimableSnapshotDeltaCreatesIncome: false,
  genericReceiptCreatesIncome: false,
  referenceIncomeIsPrimaryMetric: false,
  referenceIncomeIsEarnedIncomeAuthority: false,
  currentRewardBalanceIsPeriodIncome: false,
  accruedIncomeMayBeEarnedBeforeClaim: true,
  embeddedCompoundingMayBeEarnedIncome: true,
  settlementDoesNotReRecognizeEarnedIncome: true,
  laterPriceMovementRewritesClosedIncome: false,
  laterClaimOrTransferRewritesEarnedIncome: false,
  incompleteCoverageMayMasqueradeAsZero: false,
  incompleteCoverageMayMasqueradeAsCompleteIncome: false,
  executionAuthority: 'none'
};
report.accountingEvidence = {
  source: 'reporting/income-ledger.json',
  sourceVersion: ledger.version || null,
  sourceGeneratedAt: ledger.generatedAt || null,
  recognitionViewVersion: earned.version,
  rawCanonicalEventCount: earned.summary.rawEventCount,
  recognizedCanonicalEventCount: earned.summary.recognizedEventCount,
  settlementOnlyEventCount: earned.summary.settlementOnlyEventCount,
  unresolvedCanonicalEventCount: earned.summary.unresolvedEventCount,
  claimableSnapshotDerivedIncomeEventCount: 0,
  monthlyIncomeEventDiscoveryAuthority: false,
  executionAuthority: 'none'
};

for (const [companyName, company] of Object.entries(report.companies || {})) {
  company.sourceFamilyPrevious = company.sourceFamily;
  company.sourceFamily = 'canonical-earned-income-accounting';

  for (const [month, row] of Object.entries(company.months || {})) {
    const oldReferenceUsd = finite(row.generatedIncomeUsd) ? Number(row.generatedIncomeUsd) : null;
    const oldReferenceYield = finite(row.monthlyYieldPct) ? Number(row.monthlyYieldPct) : null;
    row.referenceAnalytics = {
      generatedIncomeUsd: oldReferenceUsd,
      monthlyYieldPct: oldReferenceYield,
      semantic: row.semantic || row.incomeAccounting?.primaryMetric?.semantic || null,
      sourceFamily: row.incomeAccounting?.primaryMetric?.sourceFamily || company.sourceFamilyPrevious || null,
      earnedIncomeAuthority: false
    };

    if (legacyDefiteaActual(month, row)) {
      row.generatedIncomeUsd = round(oldReferenceUsd, 8);
      row.monthlyYieldPct = finite(row.averageCapitalUsd) && Number(row.averageCapitalUsd) > 0
        ? round(Number(row.generatedIncomeUsd) / Number(row.averageCapitalUsd) * 100, 6)
        : null;
      row.semantic = 'canonical-earned-income';
      row.accountingStatus = 'complete-legacy-verified-realised';
      row.accountingCoverageComplete = true;
      row.accountingEvidenceCount = 1;
      row.accountingUnknownReason = null;
      row.observedEarnedIncomeUsd = row.generatedIncomeUsd;
      row.incomeAccounting = {
        version: '0.3-ledger-sole-recognition-authority',
        primaryMetric: { usd: row.generatedIncomeUsd, observedUsd: row.generatedIncomeUsd, semantic: 'canonical-earned-income', earnedIncomeAuthority: true, valuationFrozen: true },
        referenceAnalytics: row.referenceAnalytics,
        accountingStatus: row.accountingStatus,
        coverageComplete: true,
        evidenceCount: 1,
        source: 'reporting/reporting-data.json legacy-verified-report',
        canonicalLedgerOnlyForNewPeriods: true,
        unknownIsNotZero: true,
        executionAuthority: 'none'
      };
      continue;
    }

    const recognized = rowsForMonth(earned.recognized, companyName, month);
    const settlements = rowsForMonth(earned.settlements, companyName, month);
    const unresolved = rowsForMonth(earned.unresolved, companyName, month);
    const observedUsd = sumUsd(recognized);
    const ledgerCoverageComplete = ledger?.companies?.[companyName]?.coverage?.overallComplete === true;
    const allRecognizedValued = recognized.every(event => finite(event.usdValue));
    const complete = ledgerCoverageComplete && unresolved.length === 0 && allRecognizedValued;

    row.observedEarnedIncomeUsd = observedUsd;
    row.generatedIncomeUsd = complete ? observedUsd : null;
    row.monthlyYieldPct = complete && finite(row.averageCapitalUsd) && Number(row.averageCapitalUsd) > 0
      ? round(Number(observedUsd) / Number(row.averageCapitalUsd) * 100, 6)
      : null;
    row.semantic = complete ? 'canonical-earned-income' : 'canonical-earned-income-incomplete-coverage';
    row.accountingStatus = complete ? 'complete' : (recognized.length ? 'partial-observed' : 'unknown-incomplete-coverage');
    row.accountingCoverageComplete = complete;
    row.accountingEvidenceCount = recognized.length;
    row.accountingUnknownReason = complete ? null : 'Not all active income mechanisms, settlement links, and period boundaries are proven. Reference analytics remains separate and is never substituted for earned income.';
    row.incomeAccounting = {
      version: '0.3-ledger-sole-recognition-authority',
      primaryMetric: {
        usd: row.generatedIncomeUsd,
        observedUsd,
        semantic: row.semantic,
        earnedIncomeAuthority: complete,
        valuationFrozen: true
      },
      referenceAnalytics: row.referenceAnalytics,
      accountingStatus: row.accountingStatus,
      coverageComplete: complete,
      evidenceCount: recognized.length,
      evidenceFamilies: {
        accruedEntitlement: familySummary(recognized, 'accrued-entitlement'),
        embeddedIncome: familySummary(recognized, 'embedded-income'),
        directRealisedCashFlow: familySummary(recognized, 'realised-cash-flow')
      },
      lifecycle: {
        settlementOnlyEventCount: settlements.length,
        unresolvedEventCount: unresolved.length,
        unresolvedReasons: [...new Set(unresolved.map(event => event.reason).filter(Boolean))].sort()
      },
      source: 'reporting/income-ledger.json via canonical earned-income recognition view',
      sourceGeneratedAt: ledger.generatedAt || null,
      monthlyLayerCreatesIncomeEvents: false,
      claimableSnapshotDeltaCreatesIncome: false,
      unknownIsNotZero: true,
      executionAuthority: 'none'
    };
  }
}

fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
console.log('Company Monthly Reports canonical-ledger projection applied', {
  companies: Object.keys(report.companies || {}).length,
  rawCanonicalEvents: earned.summary.rawEventCount,
  recognizedCanonicalEvents: earned.summary.recognizedEventCount,
  unresolvedCanonicalEvents: earned.summary.unresolvedEventCount,
  settlementOnlyEvents: earned.summary.settlementOnlyEventCount,
  claimableSnapshotDerivedIncomeEvents: 0,
  completeMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete === true).length,
  partialOrUnknownMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete !== true).length
});
