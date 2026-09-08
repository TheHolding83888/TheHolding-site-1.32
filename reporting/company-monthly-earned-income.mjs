import fs from 'node:fs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';
import { incomeOwnedByCompany } from './income-ownership.mjs';
import { COMPANY_INCOME_SCOPE_VERSION, incomeScopeFor } from './company-income-scope.mjs';

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

function eventBelongsToMonth(row, month) {
  return (row.month || monthKey(row.economicDate || row.periodEnd)) === month;
}

function rowsOwnedByCompany(rows, company, month) {
  return rows.filter(row => incomeOwnedByCompany(row, company) && eventBelongsToMonth(row, month));
}

function rowsForReportingScope(rows, targetCompany, month) {
  const scope = incomeScopeFor(targetCompany);
  return rows.filter(row => eventBelongsToMonth(row, month) && scope.confirmedOwners.some(owner => incomeOwnedByCompany(row, owner)));
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

function yieldPct(incomeUsd, averageCapitalUsd) {
  return finite(incomeUsd) && finite(averageCapitalUsd) && Number(averageCapitalUsd) > 0
    ? round(Number(incomeUsd) / Number(averageCapitalUsd) * 100, 6)
    : null;
}

function ownerBreakdown(rows, owners) {
  return owners.map(owner => {
    const selected = rows.filter(row => incomeOwnedByCompany(row, owner));
    return {
      canonicalOwner: owner,
      eventCount: selected.length,
      usd: sumUsd(selected),
      canonicalOwnershipPreserved: true
    };
  });
}

function reportingScopeView(targetCompany, rows) {
  const scope = incomeScopeFor(targetCompany);
  const breakdown = ownerBreakdown(rows, scope.confirmedOwners);
  const direct = breakdown.find(x => x.canonicalOwner === targetCompany) || { canonicalOwner: targetCompany, eventCount: 0, usd: 0, canonicalOwnershipPreserved: true };
  const associated = breakdown.filter(x => x.canonicalOwner !== targetCompany);
  return {
    version: COMPANY_INCOME_SCOPE_VERSION,
    targetCompany,
    confirmedOwners: [...scope.confirmedOwners],
    estimatedContributors: [...scope.estimatedContributors],
    capitalOwners: [...scope.capitalOwners],
    associatedCompanies: [...scope.associatedCompanies],
    associatedConfirmedIncluded: scope.includeAssociatedConfirmed === true,
    associatedEstimatedIncluded: scope.includeAssociatedEstimated === true,
    associatedCapitalIncluded: scope.includeAssociatedCapital === true,
    canonicalOwnershipPreserved: true,
    crossCompanyReattributionAllowed: false,
    holdingWideAggregationMustUseCanonicalOwners: true,
    companyReportTotalsAreNotAdditiveAcrossCompanies: scope.companyReportTotalsAreNotAdditiveAcrossCompanies,
    directConfirmed: direct,
    associatedConfirmed: associated,
    scopedConfirmedEventCount: rows.length,
    scopedConfirmedObservedUsd: sumUsd(rows),
    executionAuthority: 'none'
  };
}

function scopeCoverageComplete(targetCompany) {
  const scope = incomeScopeFor(targetCompany);
  return scope.confirmedOwners.every(owner => ledger?.companies?.[owner]?.coverage?.overallComplete === true);
}

function attachConfirmedEstimatedView(row, scopeView) {
  const complete = row.accountingCoverageComplete === true;
  const partialObserved = row.accountingStatus === 'partial-observed' && Number(row.accountingEvidenceCount || 0) > 0;
  const confirmedUsd = complete && finite(row.generatedIncomeUsd)
    ? round(row.generatedIncomeUsd, 8)
    : partialObserved && finite(row.observedEarnedIncomeUsd)
      ? round(row.observedEarnedIncomeUsd, 8)
      : null;
  const confirmedYieldPct = complete && finite(row.monthlyYieldPct)
    ? round(row.monthlyYieldPct, 6)
    : partialObserved && finite(row.observedPeriodYieldPct)
      ? round(row.observedPeriodYieldPct, 6)
      : null;
  const confirmedStatus = complete ? 'complete' : partialObserved ? 'partial-observed' : 'unknown';

  const referenceUsd = row.referenceAnalytics?.generatedIncomeUsd;
  const referenceYieldPct = row.referenceAnalytics?.monthlyYieldPct;
  const referenceMode = String(row.mode || '');
  const estimatedAvailable = referenceMode !== 'reported-realised' && finite(referenceUsd);

  row.incomeView = {
    version: '0.1-confirmed-estimated-non-additive',
    scope: {
      version: scopeView.version,
      targetCompany: scopeView.targetCompany,
      confirmedOwners: scopeView.confirmedOwners,
      estimatedContributors: scopeView.estimatedContributors,
      capitalOwners: scopeView.capitalOwners,
      associatedCompanies: scopeView.associatedCompanies,
      canonicalOwnershipPreserved: true,
      crossCompanyReattributionAllowed: false,
      holdingWideAggregationMustUseCanonicalOwners: true,
      companyReportTotalsAreNotAdditiveAcrossCompanies: scopeView.companyReportTotalsAreNotAdditiveAcrossCompanies,
      executionAuthority: 'none'
    },
    confirmed: {
      usd: confirmedUsd,
      yieldPct: confirmedYieldPct,
      status: confirmedStatus,
      amountRecognitionAuthority: confirmedUsd !== null ? 'canonical-earned-income-view' : 'none',
      factualRecognizedAmount: confirmedUsd !== null,
      fullPeriodComplete: complete,
      fullPeriodTotalAuthority: complete,
      periodStart: row.periodStart || null,
      periodEnd: row.periodEnd || null,
      evidenceCount: Number(row.accountingEvidenceCount || 0),
      canonicalOwnerBreakdown: scopeView.directConfirmed && scopeView.associatedConfirmed
        ? [scopeView.directConfirmed, ...scopeView.associatedConfirmed]
        : [],
      canonicalOwnershipPreserved: true,
      unknownIsNotZero: true
    },
    estimated: {
      available: estimatedAvailable,
      usd: estimatedAvailable ? round(referenceUsd, 8) : null,
      yieldPct: estimatedAvailable && finite(referenceYieldPct) ? round(referenceYieldPct, 6) : null,
      basis: estimatedAvailable ? 'existing-reference-model' : null,
      sourceFamily: estimatedAvailable ? (row.referenceAnalytics?.sourceFamily || null) : null,
      semantic: estimatedAvailable ? (row.referenceAnalytics?.semantic || null) : null,
      scopeContributors: scopeView.estimatedContributors,
      associatedCompaniesIncluded: scopeView.associatedCompanies.filter(name => scopeView.estimatedContributors.includes(name)),
      capitalOwners: scopeView.capitalOwners,
      earnedIncomeAuthority: false,
      factualIncomeAuthority: false,
      canCloseAccountingCoverage: false,
      canReplaceUnknown: false,
      periodStart: row.periodStart || null,
      periodEnd: row.periodEnd || null
    },
    relationship: {
      additive: false,
      confirmedPlusEstimatedIsValidTotal: false,
      estimatedMayOverlapConfirmedEconomics: true,
      estimatedIsAlternativeAnalyticView: true
    },
    unknownIsNotZero: true,
    executionAuthority: 'none'
  };
}

report.version = '0.5-company-monthly-confirmed-estimated-view';
report.methodologyVersion = '0.4-canonical-ledger-sole-income-recognition-authority';
report.presentationModelVersion = '0.1-confirmed-estimated-non-additive';
report.economicReportingScopeVersion = COMPANY_INCOME_SCOPE_VERSION;
report.generatedAt = new Date().toISOString();
report.accountingPolicy = {
  recognitionBasis: 'canonical-ledger-admitted-events-with-explicit-non-overlap-recognition',
  canonicalLedgerIsSoleMonthlyIncomeEventSource: true,
  canonicalCompanyOwnsIncomeExclusively: true,
  crossCompanyEarnedIncomeReattributionForbidden: true,
  explicitEconomicReportingScopeMayAggregateCanonicalOwnersForPresentation: true,
  holdingWideAggregationMustUseCanonicalOwners: true,
  companyReportTotalsWithAssociatedCompaniesAreNotAdditive: true,
  implicitForeignCompanyReferenceIncomeInclusion: false,
  explicitForeignCompanyReferenceIncomeRequiresEconomicScope: true,
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
  observedPeriodYieldUsesCanonicalEarnedIncomeOnly: true,
  observedPeriodYieldDoesNotImplyFullMonthCoverage: true,
  confirmedAndEstimatedAreNonAdditive: true,
  estimatedIncomeIsAlternativeAnalyticView: true,
  estimatedIncomeCanCloseAccountingCoverage: false,
  estimatedIncomeCanReplaceUnknown: false,
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
  company.incomeReportingScope = incomeScopeFor(companyName);

  for (const [month, row] of Object.entries(company.months || {})) {
    const oldReferenceUsd = finite(row.generatedIncomeUsd) ? Number(row.generatedIncomeUsd) : null;
    const oldReferenceYield = finite(row.monthlyYieldPct) ? Number(row.monthlyYieldPct) : null;
    row.referenceAnalytics = {
      generatedIncomeUsd: oldReferenceUsd,
      monthlyYieldPct: oldReferenceYield,
      semantic: row.semantic || row.incomeAccounting?.primaryMetric?.semantic || null,
      sourceFamily: row.incomeAccounting?.primaryMetric?.sourceFamily || company.sourceFamilyPrevious || null,
      earnedIncomeAuthority: false,
      reportingScopeVersion: COMPANY_INCOME_SCOPE_VERSION,
      scopeContributors: [...incomeScopeFor(companyName).estimatedContributors],
      canonicalOwnershipPreserved: true
    };

    if (legacyDefiteaActual(month, row)) {
      const scopeView = reportingScopeView(companyName, []);
      row.generatedIncomeUsd = round(oldReferenceUsd, 8);
      row.monthlyYieldPct = yieldPct(row.generatedIncomeUsd, row.averageCapitalUsd);
      row.observedEarnedIncomeUsd = row.generatedIncomeUsd;
      row.observedPeriodYieldPct = row.monthlyYieldPct;
      row.semantic = 'canonical-earned-income';
      row.accountingStatus = 'complete-legacy-verified-realised';
      row.accountingCoverageComplete = true;
      row.accountingEvidenceCount = 1;
      row.accountingUnknownReason = null;
      row.incomeReportingScope = {
        ...scopeView,
        legacyVerifiedArchive: true,
        associatedCompaniesAppliedToLegacyArchive: false
      };
      row.incomeAccounting = {
        version: '0.3-ledger-sole-recognition-authority',
        primaryMetric: {
          usd: row.generatedIncomeUsd,
          observedUsd: row.generatedIncomeUsd,
          observedPeriodYieldPct: row.observedPeriodYieldPct,
          semantic: 'canonical-earned-income',
          earnedIncomeAuthority: true,
          valuationFrozen: true
        },
        referenceAnalytics: row.referenceAnalytics,
        reportingScope: row.incomeReportingScope,
        accountingStatus: row.accountingStatus,
        coverageComplete: true,
        evidenceCount: 1,
        source: 'reporting/reporting-data.json legacy-verified-report',
        canonicalLedgerOnlyForNewPeriods: true,
        canonicalCompanyOwnsIncomeExclusively: true,
        crossCompanyReattributionAllowed: false,
        holdingWideAggregationMustUseCanonicalOwners: true,
        unknownIsNotZero: true,
        executionAuthority: 'none'
      };
      attachConfirmedEstimatedView(row, row.incomeReportingScope);
      continue;
    }

    const recognized = rowsForReportingScope(earned.recognized, companyName, month);
    const settlements = rowsForReportingScope(earned.settlements, companyName, month);
    const unresolved = rowsForReportingScope(earned.unresolved, companyName, month);
    const observedUsd = sumUsd(recognized);
    const allRecognizedValued = recognized.every(event => finite(event.usdValue));
    const complete = scopeCoverageComplete(companyName) && unresolved.length === 0 && allRecognizedValued;
    const observedPeriodYieldPct = (complete || recognized.length > 0)
      ? yieldPct(observedUsd, row.averageCapitalUsd)
      : null;
    const scopeView = reportingScopeView(companyName, recognized);

    row.observedEarnedIncomeUsd = observedUsd;
    row.observedPeriodYieldPct = observedPeriodYieldPct;
    row.generatedIncomeUsd = complete ? observedUsd : null;
    row.monthlyYieldPct = complete ? observedPeriodYieldPct : null;
    row.semantic = complete ? 'canonical-earned-income' : 'canonical-earned-income-incomplete-coverage';
    row.accountingStatus = complete ? 'complete' : (recognized.length ? 'partial-observed' : 'unknown-incomplete-coverage');
    row.accountingCoverageComplete = complete;
    row.accountingEvidenceCount = recognized.length;
    row.accountingUnknownReason = complete ? null : 'Not all active income mechanisms, associated reporting-scope members, settlement links, and period boundaries are proven. Reference analytics remains separate and is never substituted for earned income.';
    row.incomeReportingScope = scopeView;
    row.incomeAccounting = {
      version: '0.3-ledger-sole-recognition-authority',
      primaryMetric: {
        usd: row.generatedIncomeUsd,
        observedUsd,
        observedPeriodYieldPct,
        semantic: row.semantic,
        earnedIncomeAuthority: complete,
        valuationFrozen: true
      },
      referenceAnalytics: row.referenceAnalytics,
      reportingScope: scopeView,
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
      source: 'reporting/income-ledger.json via canonical earned-income recognition view and explicit economic reporting scope',
      sourceGeneratedAt: ledger.generatedAt || null,
      monthlyLayerCreatesIncomeEvents: false,
      claimableSnapshotDeltaCreatesIncome: false,
      canonicalCompanyOwnsIncomeExclusively: true,
      crossCompanyReattributionAllowed: false,
      holdingWideAggregationMustUseCanonicalOwners: true,
      companyReportTotalsAreNotAdditiveAcrossCompanies: scopeView.companyReportTotalsAreNotAdditiveAcrossCompanies,
      unknownIsNotZero: true,
      executionAuthority: 'none'
    };
    attachConfirmedEstimatedView(row, scopeView);
  }
}

fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
console.log('Company Monthly Reports canonical-ledger projection applied', {
  companies: Object.keys(report.companies || {}).length,
  economicReportingScopeVersion: COMPANY_INCOME_SCOPE_VERSION,
  rawCanonicalEvents: earned.summary.rawEventCount,
  recognizedCanonicalEvents: earned.summary.recognizedEventCount,
  unresolvedCanonicalEvents: earned.summary.unresolvedEventCount,
  settlementOnlyEvents: earned.summary.settlementOnlyEventCount,
  claimableSnapshotDerivedIncomeEvents: 0,
  completeMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete === true).length,
  partialObservedMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'partial-observed').length,
  partialObservedYieldMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingStatus === 'partial-observed' && finite(m.observedPeriodYieldPct)).length,
  estimatedMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.incomeView?.estimated?.available === true).length,
  partialOrUnknownMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete !== true).length
});
