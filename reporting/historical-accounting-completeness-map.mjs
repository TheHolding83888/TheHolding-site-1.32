#!/usr/bin/env node
/**
 * The Holding · Historical Accounting Completeness Map v0.1
 *
 * Derived diagnostic only. It maps canonical Accounting Coverage into an
 * explicit company × mechanism × month evidence-completeness state. It does
 * not create income, close months, replace UNKNOWN, infer Reference income,
 * or gain execution authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const ROOT = process.cwd();
const COVERAGE_FILE = process.env.ACCOUNTING_COVERAGE_FILE || path.join(ROOT, 'reporting', 'accounting-coverage.json');
const MONTHLY_FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || path.join(ROOT, 'reporting', 'company-monthly-reports.json');
const OUTPUT_FILE = process.env.HISTORICAL_ACCOUNTING_COMPLETENESS_FILE || path.join(ROOT, 'reporting', 'historical-accounting-completeness-map.json');

const VERSION = '0.1-historical-accounting-completeness-map';
const START_MONTH = '2026-08';
const STATE_LABELS = {
  complete: 'Complete',
  partial: 'Partial',
  'tracking-no-event': 'Tracking-no-event',
  unknown: 'Unknown',
  'n/a': 'N/A'
};

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
};
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const canonical = name => String(name || '').trim() === 'aerocrvyb.eth' ? 'aerocvxyb.eth' : String(name || '').trim();
const unique = values => [...new Set((values || []).filter(Boolean))];

function monthlyCompany(monthly, company) {
  const key = Object.keys(monthly?.companies || {}).find(name => canonical(name) === canonical(company));
  return key ? monthly.companies[key] : null;
}

function companyMonthLifecycle(monthly, company, month) {
  const row = monthlyCompany(monthly, company)?.months?.[month] || null;
  const lifecycle = row?.incomeAccounting?.lifecycle || {};
  return {
    monthlyRowPresent: Boolean(row),
    accountingStatus: row?.accountingStatus || null,
    accountingCoverageComplete: row?.accountingCoverageComplete === true,
    partialPeriod: row?.partialPeriod === true || row?.status === 'provisional',
    unresolvedEventCount: Number(lifecycle?.unresolvedEventCount || 0),
    unresolvedReasons: Array.isArray(lifecycle?.unresolvedReasons) ? lifecycle.unresolvedReasons : []
  };
}

function explicitNotApplicable(mechanism, state) {
  return state?.applicableForMonth === false ||
    state?.status === 'not-applicable' ||
    mechanism?.applicable === false;
}

function classifyMechanismMonth({ mechanism, state, month, currentMonth }) {
  if (explicitNotApplicable(mechanism, state)) {
    return {
      state: 'n/a',
      reasonCodes: ['explicitly-not-applicable'],
      evidenceComplete: false
    };
  }

  if (!state) {
    return {
      state: 'unknown',
      reasonCodes: ['coverage-state-absent'],
      evidenceComplete: false
    };
  }

  const tracking = state?.factualTrackingActive === true;
  const eventCount = Number(state?.factualEventCount || 0);
  const valuedEventCount = Number(state?.factualValuedEventCount || 0);
  const crossMonthUnresolved = Number(state?.crossMonthUnresolvedCount || 0);
  const partialObservation = state?.factualTrackingObservationComplete === false || Number(state?.factualTrackingPartialObservationCount || 0) > 0;
  const completionBlockers = Array.isArray(state?.completionBlockers) ? state.completionBlockers : [];
  const valuationIncomplete = eventCount > 0 && (valuedEventCount < eventCount || !finite(state?.factualUsdSubtotal));
  const currentPeriodOpen = month === currentMonth;

  if (!tracking) {
    return {
      state: 'unknown',
      reasonCodes: unique([
        'factual-tracking-not-proven',
        state?.status ? `coverage-status:${state.status}` : null,
        ...completionBlockers.map(code => `coverage-blocker:${code}`)
      ]),
      evidenceComplete: false
    };
  }

  if (crossMonthUnresolved > 0 || partialObservation || valuationIncomplete) {
    return {
      state: 'partial',
      reasonCodes: unique([
        crossMonthUnresolved > 0 ? 'cross-month-boundary-unresolved' : null,
        partialObservation ? 'source-observation-partial' : null,
        valuationIncomplete ? 'factual-event-valuation-incomplete' : null,
        ...completionBlockers.map(code => `coverage-blocker:${code}`)
      ]),
      evidenceComplete: false
    };
  }

  if (eventCount === 0) {
    return {
      state: 'tracking-no-event',
      reasonCodes: unique([
        'factual-tracking-active-no-period-event',
        currentPeriodOpen ? 'current-period-open' : null
      ]),
      evidenceComplete: false
    };
  }

  if (currentPeriodOpen) {
    return {
      state: 'partial',
      reasonCodes: ['current-period-open', 'factual-period-events-observed-to-date'],
      evidenceComplete: false
    };
  }

  if (completionBlockers.length > 0) {
    return {
      state: 'partial',
      reasonCodes: completionBlockers.map(code => `coverage-blocker:${code}`),
      evidenceComplete: false
    };
  }

  return {
    state: 'complete',
    reasonCodes: ['closed-period-factual-tracking-and-valued-events-no-known-blocker'],
    evidenceComplete: true
  };
}

function aggregateCompanyMonth(rows, lifecycle, month, currentMonth) {
  if (!rows.length) {
    return {
      state: 'n/a',
      reasonCodes: ['no-active-mechanism-rows'],
      evidenceComplete: false
    };
  }
  if (month === currentMonth) {
    return {
      state: 'partial',
      reasonCodes: unique([
        'current-period-open',
        lifecycle.unresolvedEventCount > 0 ? 'company-lifecycle-unresolved' : null
      ]),
      evidenceComplete: false
    };
  }
  if (lifecycle.unresolvedEventCount > 0) {
    return {
      state: 'partial',
      reasonCodes: unique(['company-lifecycle-unresolved', ...lifecycle.unresolvedReasons.map(reason => `lifecycle:${reason}`)]),
      evidenceComplete: false
    };
  }
  if (rows.some(row => row.state === 'unknown')) {
    return { state: 'unknown', reasonCodes: ['one-or-more-mechanisms-unknown'], evidenceComplete: false };
  }
  if (rows.some(row => row.state === 'partial')) {
    return { state: 'partial', reasonCodes: ['one-or-more-mechanisms-partial'], evidenceComplete: false };
  }
  if (rows.every(row => row.state === 'n/a')) {
    return { state: 'n/a', reasonCodes: ['all-mechanisms-not-applicable'], evidenceComplete: false };
  }
  if (rows.every(row => row.state === 'complete' || row.state === 'tracking-no-event' || row.state === 'n/a')) {
    return {
      state: rows.some(row => row.state === 'tracking-no-event') ? 'partial' : 'complete',
      reasonCodes: rows.some(row => row.state === 'tracking-no-event')
        ? ['one-or-more-mechanisms-tracking-no-event']
        : ['all-applicable-mechanisms-diagnostic-complete'],
      evidenceComplete: !rows.some(row => row.state === 'tracking-no-event')
    };
  }
  return { state: 'partial', reasonCodes: ['mixed-evidence-state'], evidenceComplete: false };
}

const coverage = read(COVERAGE_FILE);
const monthly = read(MONTHLY_FILE);

if (coverage?.status !== 'diagnostic-no-completion-authority') throw new Error('Accounting Coverage must remain diagnostic-only');
if (coverage?.semantics?.canonicalLedgerIsSoleFactualIncomeAuthority !== true) throw new Error('Accounting Coverage canonical income authority drift');
if (coverage?.semantics?.unknownIsNotZero !== true) throw new Error('Accounting Coverage UNKNOWN semantics drift');
if (coverage?.authority?.monthClosingAuthority !== false || coverage?.authority?.executionAuthority !== 'none') throw new Error('Accounting Coverage authority drift');
if (monthly?.trackingPolicy?.referenceIncomeIsEarnedIncomeAuthority !== false || monthly?.trackingPolicy?.executionAuthority !== 'none') throw new Error('Company Monthly Reports authority drift');

const currentMonth = coverage.currentMonth;
if (!/^\d{4}-\d{2}$/.test(String(currentMonth || ''))) throw new Error('Accounting Coverage currentMonth missing');

const allMonths = new Set();
for (const company of Object.values(coverage.companies || {})) {
  for (const mechanism of Object.values(company?.mechanisms || {})) {
    for (const month of Object.keys(mechanism?.months || {})) {
      if (month >= START_MONTH && month <= currentMonth) allMonths.add(month);
    }
  }
}
for (const company of Object.values(monthly?.companies || {})) {
  for (const month of Object.keys(company?.months || {})) {
    if (month >= START_MONTH && month <= currentMonth) allMonths.add(month);
  }
}
const months = [...allMonths].sort();

const rows = [];
for (const [companyName, company] of Object.entries(coverage.companies || {})) {
  const canonicalCompany = canonical(companyName);
  for (const [engineId, mechanism] of Object.entries(company?.mechanisms || {})) {
    for (const month of months) {
      const state = mechanism?.months?.[month] || null;
      const classification = classifyMechanismMonth({ mechanism, state, month, currentMonth });
      rows.push({
        id: [canonicalCompany, month, engineId].join(':'),
        company: canonicalCompany,
        registry: company?.registry || null,
        month,
        mechanism: engineId,
        principalId: mechanism?.principalId || null,
        protocol: mechanism?.protocol || null,
        accountingFamily: mechanism?.accountingFamily || null,
        mechanismType: mechanism?.mechanismType || null,
        state: classification.state,
        stateLabel: STATE_LABELS[classification.state],
        evidenceComplete: classification.evidenceComplete,
        reasonCodes: classification.reasonCodes,
        factualTrackingActive: state?.factualTrackingActive === true,
        factualTrackingObservationComplete: state?.factualTrackingObservationComplete ?? null,
        factualTrackingPartialObservationCount: Number(state?.factualTrackingPartialObservationCount || 0),
        factualEventCount: Number(state?.factualEventCount || 0),
        factualValuedEventCount: Number(state?.factualValuedEventCount || 0),
        factualUsdSubtotal: finite(state?.factualUsdSubtotal) ? Number(state.factualUsdSubtotal) : null,
        crossMonthEvidenceCount: Number(state?.crossMonthEvidenceCount || 0),
        crossMonthExplicitlyAttributedCount: Number(state?.crossMonthExplicitlyAttributedCount || 0),
        crossMonthUnresolvedCount: Number(state?.crossMonthUnresolvedCount || 0),
        firstFactualEvidenceAt: state?.firstFactualEvidenceAt || null,
        lastFactualEvidenceAt: state?.lastFactualEvidenceAt || null,
        sourceCoverageStatus: state?.status || null,
        sourceCompletionBlockers: Array.isArray(state?.completionBlockers) ? state.completionBlockers : [],
        sourceMechanismCompleteForMonth: state?.mechanismCompleteForMonth === true,
        currentPeriodOpen: month === currentMonth,
        sourceOfTruth: false,
        incomeCreationAuthority: false,
        monthClosingAuthority: false,
        canReplaceUnknown: false,
        executionAuthority: 'none'
      });
    }
  }
}
rows.sort((a, b) => a.company.localeCompare(b.company) || a.month.localeCompare(b.month) || a.mechanism.localeCompare(b.mechanism));

const companyMonths = [];
for (const companyName of [...new Set(rows.map(row => row.company))].sort()) {
  for (const month of months) {
    const scoped = rows.filter(row => row.company === companyName && row.month === month);
    const lifecycle = companyMonthLifecycle(monthly, companyName, month);
    const aggregate = aggregateCompanyMonth(scoped, lifecycle, month, currentMonth);
    companyMonths.push({
      id: [companyName, month].join(':'),
      company: companyName,
      month,
      state: aggregate.state,
      stateLabel: STATE_LABELS[aggregate.state],
      evidenceComplete: aggregate.evidenceComplete,
      reasonCodes: aggregate.reasonCodes,
      mechanismCount: scoped.length,
      completeMechanismCount: scoped.filter(row => row.state === 'complete').length,
      partialMechanismCount: scoped.filter(row => row.state === 'partial').length,
      trackingNoEventMechanismCount: scoped.filter(row => row.state === 'tracking-no-event').length,
      unknownMechanismCount: scoped.filter(row => row.state === 'unknown').length,
      notApplicableMechanismCount: scoped.filter(row => row.state === 'n/a').length,
      companyLifecycle: lifecycle,
      sourceOfTruth: false,
      incomeCreationAuthority: false,
      monthClosingAuthority: false,
      canReplaceUnknown: false,
      executionAuthority: 'none'
    });
  }
}

const countState = (list, state) => list.filter(row => row.state === state).length;
const output = {
  version: VERSION,
  generatedAt: new Date().toISOString(),
  status: 'diagnostic-no-completion-authority',
  periodStart: START_MONTH,
  currentMonth,
  purpose: 'Machine-readable company × mechanism × month evidence completeness map for historical accounting hardening. Complete means no known evidence gap under the current canonical diagnostics; it is not book-close authority.',
  stateModel: {
    Complete: 'Closed-period mechanism evidence has factual tracking, at least one factual event, complete factual USD valuation, no unresolved cross-month evidence, no partial source observation, and no known completion blocker. This is diagnostic completeness, not accounting closure.',
    Partial: 'Some factual evidence exists or tracking is active, but the period is open or a known valuation, source-observation, lifecycle, or cross-month evidence gap remains.',
    'Tracking-no-event': 'Factual tracking is active for the mechanism/month but no factual earned-income event is observed. This is not zero-income proof and not an error.',
    Unknown: 'Factual tracking for the mechanism/month is not proven or the coverage state is absent. UNKNOWN must not be converted to zero.',
    'N/A': 'Used only when non-applicability is explicitly proven by source metadata; never inferred merely from missing evidence.'
  },
  semantics: {
    sourceOfTruth: false,
    canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority: true,
    accountingCoverageRemainsFactualTrackingAuthority: true,
    companyMonthlyReportsRemainPresentationAuthority: true,
    completeMeansDiagnosticEvidenceCompletenessNotAccountingClosure: true,
    completeStateHasMonthClosingAuthority: false,
    trackingNoEventIsZeroIncomeProof: false,
    currentPeriodCanBeComplete: false,
    partialCanCreateIncome: false,
    referenceAprCanBackfillIncome: false,
    estimatedIncomeCanReplaceUnknown: false,
    missingEvidenceCanBecomeNotApplicable: false,
    crossMonthProrationAllowed: false,
    unknownIsNotZero: true
  },
  sourceState: {
    accountingCoverage: { file: 'reporting/accounting-coverage.json', version: coverage.version, generatedAt: coverage.generatedAt },
    companyMonthlyReports: { file: 'reporting/company-monthly-reports.json', version: monthly.version, generatedAt: monthly.generatedAt }
  },
  months,
  summary: {
    rowCount: rows.length,
    companyMonthCount: companyMonths.length,
    companyCount: new Set(rows.map(row => row.company)).size,
    mechanismInstanceCount: new Set(rows.map(row => `${row.company}:${row.mechanism}`)).size,
    completeCount: countState(rows, 'complete'),
    partialCount: countState(rows, 'partial'),
    trackingNoEventCount: countState(rows, 'tracking-no-event'),
    unknownCount: countState(rows, 'unknown'),
    notApplicableCount: countState(rows, 'n/a'),
    completeCompanyMonthCount: countState(companyMonths, 'complete'),
    partialCompanyMonthCount: countState(companyMonths, 'partial'),
    unknownCompanyMonthCount: countState(companyMonths, 'unknown'),
    notApplicableCompanyMonthCount: countState(companyMonths, 'n/a')
  },
  companyMonths,
  rows,
  authority: {
    readOnly: true,
    sourceOfTruth: false,
    factualIncomeAuthority: false,
    incomeCreationAuthority: false,
    accountingCompletionAuthority: false,
    monthClosingAuthority: false,
    canReplaceUnknown: false,
    methodologyMutationAuthority: 'none',
    walletAuthority: 'none',
    capitalExecution: false,
    executionAuthority: 'none'
  }
};

write(OUTPUT_FILE, output);
console.log('Historical Accounting Completeness Map v0.1 built', output.summary);
