import fs from 'node:fs';
import crypto from 'node:crypto';

const REPORT_FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';
const REPORTING_FILE = process.env.REPORTING_DATA_FILE || './reporting/reporting-data.json';

const report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf8'));
const ledger = JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8'));
const reporting = JSON.parse(fs.readFileSync(REPORTING_FILE, 'utf8'));

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const round = (v, d = 8) => finite(v) ? Math.round(Number(v) * 10 ** d) / 10 ** d : null;
const monthKey = v => {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 7) : null;
};
const dayKey = v => {
  const t = Date.parse(v || '');
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
};
const stable = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const hash = v => crypto.createHash('sha256').update(stable(v)).digest('hex');

function routeIdentityComplete(row) {
  return Boolean(row?.routeKey && row?.route && row?.protocol && (row?.token || row?.symbol) && row?.amountComplete === true);
}

function snapshotStateHash(snapshot) {
  return hash((snapshot?.rows || []).map(r => ({
    routeKey: r.routeKey,
    amount: r.amount,
    usdValue: r.usdValue,
    amountComplete: r.amountComplete,
    usdValueComplete: r.usdValueComplete
  })));
}

function dedupeSnapshots(rows) {
  const sorted = [...rows].filter(x => x?.capturedAt).sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
  const out = [];
  let lastHash = null;
  for (const row of sorted) {
    const h = snapshotStateHash(row);
    if (h === lastHash) continue;
    out.push(row);
    lastHash = h;
  }
  return out;
}

function explicitEventKey(e) {
  return `${e.company || ''}:${e.family || ''}:${e.route || ''}:${e.economicDate || e.periodEnd || ''}:${e.sourceIdentity || e.eventKey || ''}`;
}

function buildExplicitEvents() {
  return (ledger.events || []).map(e => ({
    ...e,
    accountingOrigin: 'canonical-event-ledger',
    accountingEventKey: `canonical:${explicitEventKey(e)}`,
    valuationFrozen: finite(e.usdValue)
  }));
}

function buildObservedRewardAccruals(explicitEvents) {
  const byCompany = new Map();
  for (const s of ledger.claimableSnapshots || []) {
    if (!s?.company) continue;
    if (!byCompany.has(s.company)) byCompany.set(s.company, []);
    byCompany.get(s.company).push(s);
  }
  const events = [];
  const coverage = {};
  const explicitAccruedRoutes = new Map();
  for (const e of explicitEvents.filter(x => x.family === 'accrued-entitlement')) {
    const m = monthKey(e.economicDate || e.periodEnd);
    const k = `${e.company}:${m}`;
    if (!explicitAccruedRoutes.has(k)) explicitAccruedRoutes.set(k, new Set());
    if (e.route) explicitAccruedRoutes.get(k).add(String(e.route).toLowerCase());
  }

  for (const [company, snapshotsRaw] of byCompany) {
    const snapshots = dedupeSnapshots(snapshotsRaw);
    coverage[company] = {};
    for (let i = 1; i < snapshots.length; i++) {
      const prev = snapshots[i - 1];
      const cur = snapshots[i];
      const prevMonth = monthKey(prev.capturedAt);
      const curMonth = monthKey(cur.capturedAt);
      if (!prevMonth || !curMonth) continue;
      const month = curMonth;
      if (!coverage[company][month]) coverage[company][month] = {
        comparableIntervals: 0,
        unresolvedIntervals: 0,
        crossMonthIntervals: 0,
        positiveAccrualEvents: 0,
        firstObservedAt: cur.capturedAt,
        lastObservedAt: cur.capturedAt
      };
      const c = coverage[company][month];
      c.firstObservedAt = c.firstObservedAt < prev.capturedAt ? c.firstObservedAt : prev.capturedAt;
      c.lastObservedAt = c.lastObservedAt > cur.capturedAt ? c.lastObservedAt : cur.capturedAt;
      if (prevMonth !== curMonth) {
        c.crossMonthIntervals++;
        continue;
      }

      const a = new Map((prev.rows || []).map(r => [r.routeKey, r]));
      const b = new Map((cur.rows || []).map(r => [r.routeKey, r]));
      const keys = new Set([...a.keys(), ...b.keys()]);
      for (const routeKey of keys) {
        const before = a.get(routeKey);
        const after = b.get(routeKey);
        c.comparableIntervals++;
        if (!before || !after || !routeIdentityComplete(before) || !routeIdentityComplete(after) || !finite(before.amount) || !finite(after.amount)) {
          c.unresolvedIntervals++;
          continue;
        }
        const delta = Number(after.amount) - Number(before.amount);
        if (delta < -1e-12) {
          c.unresolvedIntervals++;
          continue;
        }
        if (delta <= 1e-12) continue;

        const explicitRoutes = explicitAccruedRoutes.get(`${company}:${month}`) || new Set();
        const routeName = String(after.route || '').toLowerCase();
        if (routeName && explicitRoutes.has(routeName)) continue;

        if (!finite(after.usdValue) || !(Number(after.amount) > 0)) {
          c.unresolvedIntervals++;
          continue;
        }
        const unitUsd = Number(after.usdValue) / Number(after.amount);
        if (!Number.isFinite(unitUsd) || unitUsd < 0) {
          c.unresolvedIntervals++;
          continue;
        }
        const usdValue = delta * unitUsd;
        const accountingEventKey = `reward-accrual:${company}:${routeKey}:${prev.capturedAt}:${cur.capturedAt}`;
        events.push({
          accountingEventKey,
          company,
          family: 'accrued-entitlement',
          economicDate: dayKey(cur.capturedAt),
          periodStart: prev.capturedAt,
          periodEnd: cur.capturedAt,
          route: after.route,
          protocol: after.protocol,
          asset: after.symbol || after.token,
          amount: round(delta, 12),
          usdValue: round(usdValue, 8),
          valuationUnitUsd: round(unitUsd, 12),
          valuationAt: cur.capturedAt,
          valuationStatus: 'observation-time-unit-price-frozen',
          accountingOrigin: 'observed-native-reward-delta',
          evidenceStatus: 'mechanism-identified-positive-native-unit-delta',
          sourceIdentity: accountingEventKey,
          immutableEvidenceHash: hash({ company, routeKey, prev: prev.capturedAt, cur: cur.capturedAt, delta: round(delta, 12), usdValue: round(usdValue, 8) }),
          laterClaimOrPriceMoveDoesNotRewriteIncome: true,
          executionAuthority: 'none'
        });
        c.positiveAccrualEvents++;
      }
    }
  }
  return { events, coverage };
}

function canonicalMonthEvents(allEvents, company, month) {
  return allEvents.filter(e => e.company === company && monthKey(e.economicDate || e.periodEnd) === month);
}

function sumValued(rows) {
  if (!rows.length) return 0;
  if (rows.some(r => !finite(r.usdValue))) return null;
  return round(rows.reduce((s, r) => s + Number(r.usdValue), 0), 8);
}

function routeSet(rows) {
  return new Set(rows.map(r => String(r.route || '').toLowerCase()).filter(Boolean));
}

function recognizedEarnedIncome(events) {
  const accrued = events.filter(e => e.family === 'accrued-entitlement');
  const embedded = events.filter(e => e.family === 'embedded-income');
  const accruedRoutes = routeSet(accrued);
  const realised = events.filter(e => e.family === 'realised-cash-flow' && !accruedRoutes.has(String(e.route || '').toLowerCase()));
  const included = [...accrued, ...embedded, ...realised];
  return {
    included,
    accrued,
    embedded,
    realised,
    usd: sumValued(included),
    allValued: included.every(e => finite(e.usdValue))
  };
}

function legacyDefiteaActual(month, row) {
  const source = reporting?.funds?.['defitea.eth']?.months?.[month];
  return Boolean(source && source.mode === 'reported-realised' && finite(source.cashFlowUsd) && month <= '2026-07' && finite(row.generatedIncomeUsd));
}

const explicitEvents = buildExplicitEvents();
const observed = buildObservedRewardAccruals(explicitEvents);
const allEvents = [...explicitEvents, ...observed.events];

report.version = '0.3-company-monthly-earned-income-accounting';
report.methodologyVersion = '0.3-canonical-earned-income-primary-reference-analytics-secondary';
report.generatedAt = new Date().toISOString();
report.accountingPolicy = {
  recognitionBasis: 'earned-when-canonically-observed-or-mechanism-identified-accrual-is-proven',
  referenceIncomeIsPrimaryMetric: false,
  referenceIncomeIsEarnedIncomeAuthority: false,
  currentRewardBalanceIsPeriodIncome: false,
  laterPriceMovementRewritesClosedIncome: false,
  laterClaimOrTransferRewritesEarnedIncome: false,
  crossMonthRewardDeltaAllocation: 'forbidden-until-boundary-is-proven',
  incompleteCoverageMayMasqueradeAsZero: false,
  incompleteCoverageMayMasqueradeAsCompleteIncome: false,
  executionAuthority: 'none'
};
report.accountingEvidence = {
  source: 'reporting/income-ledger.json',
  sourceVersion: ledger.version || null,
  sourceGeneratedAt: ledger.generatedAt || null,
  explicitCanonicalEventCount: explicitEvents.length,
  observedRewardAccrualEventCount: observed.events.length,
  observedRewardAccrualMethod: 'positive native-unit deltas between consecutive mechanism-identified reward snapshots, valued and frozen at later observation time',
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
      row.incomeAccounting = {
        version: '0.2-earned-income-primary',
        primaryMetric: { usd: row.generatedIncomeUsd, semantic: 'canonical-earned-income', earnedIncomeAuthority: true, valuationFrozen: true },
        referenceAnalytics: row.referenceAnalytics,
        accountingStatus: row.accountingStatus,
        coverageComplete: true,
        evidenceCount: 1,
        source: 'reporting/reporting-data.json legacy-verified-report',
        unknownIsNotZero: true,
        executionAuthority: 'none'
      };
      continue;
    }

    const monthEvents = canonicalMonthEvents(allEvents, companyName, month);
    const recognized = recognizedEarnedIncome(monthEvents);
    const rewardCoverage = observed.coverage?.[companyName]?.[month] || null;
    const ledgerCoverageComplete = ledger?.companies?.[companyName]?.coverage?.overallComplete === true;
    const unresolved = Number(rewardCoverage?.unresolvedIntervals || 0) + Number(rewardCoverage?.crossMonthIntervals || 0);
    const complete = ledgerCoverageComplete && unresolved === 0 && recognized.allValued;

    row.observedEarnedIncomeUsd = recognized.usd;
    row.generatedIncomeUsd = complete ? recognized.usd : null;
    row.monthlyYieldPct = complete && finite(row.averageCapitalUsd) && Number(row.averageCapitalUsd) > 0
      ? round(Number(recognized.usd) / Number(row.averageCapitalUsd) * 100, 6)
      : null;
    row.semantic = complete ? 'canonical-earned-income' : 'canonical-earned-income-incomplete-coverage';
    row.accountingStatus = complete ? 'complete' : (recognized.included.length ? 'partial-observed' : 'unknown-incomplete-coverage');
    row.accountingCoverageComplete = complete;
    row.accountingEvidenceCount = recognized.included.length;
    row.accountingUnknownReason = complete ? null : 'Not all income mechanisms and period boundaries are proven; reference analytics is retained separately and is never substituted for earned income.';
    row.incomeAccounting = {
      version: '0.2-earned-income-primary',
      primaryMetric: {
        usd: row.generatedIncomeUsd,
        observedUsd: recognized.usd,
        semantic: row.semantic,
        earnedIncomeAuthority: complete,
        valuationFrozen: true
      },
      referenceAnalytics: row.referenceAnalytics,
      accountingStatus: row.accountingStatus,
      coverageComplete: complete,
      evidenceCount: recognized.included.length,
      evidenceFamilies: {
        accruedEntitlement: { eventCount: recognized.accrued.length, usd: sumValued(recognized.accrued) },
        embeddedIncome: { eventCount: recognized.embedded.length, usd: sumValued(recognized.embedded) },
        directRealisedCashFlow: { eventCount: recognized.realised.length, usd: sumValued(recognized.realised) }
      },
      rewardSnapshotCoverage: rewardCoverage,
      source: 'reporting/income-ledger.json + deterministic reward-snapshot accrual evidence',
      sourceGeneratedAt: ledger.generatedAt || null,
      unknownIsNotZero: true,
      executionAuthority: 'none'
    };
  }
}

fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2) + '\n');
console.log('Company Monthly Reports earned-income accounting overlay applied', {
  companies: Object.keys(report.companies || {}).length,
  explicitCanonicalEventCount: explicitEvents.length,
  observedRewardAccrualEventCount: observed.events.length,
  completeMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete === true).length,
  partialOrUnknownMonths: Object.values(report.companies || {}).flatMap(c => Object.values(c.months || {})).filter(m => m.accountingCoverageComplete !== true).length
});
