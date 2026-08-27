import fs from 'node:fs';
import path from 'node:path';

const PRODUCTIVITY_FILE = process.env.PRODUCTIVITY_DATA_FILE || './companies/productivity-data.json';
const REPORTING_FILE = process.env.REPORTING_DATA_FILE || './reporting/reporting-data.json';
const INCOME_LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';
const MEMORY_VAULT_DIR = process.env.MEMORY_VAULT_DIR || './intelligence/memory-vault';
const OUTPUT_FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const START_MONTH = '2026-08';
const MAX_CARRY_DAYS = 8;

const REGISTRY = Object.freeze({
  '05081966.eth': '001',
  'YieldRing.eth': '002',
  'dinaz.eth': '003',
  'defitea.eth': '004',
  '0x5860...83CA8.eth': '005',
  'aerocvxyb.eth': '006',
  "Rook's portfolio": '007',
  'Monetra.eth': '008',
  '1milliondollar.eth': '009',
  'Cypher': '010'
});

const STANDARD_REFERENCE_COMPANIES = Object.keys(REGISTRY).filter(name => !['defitea.eth', 'Monetra.eth'].includes(name));
const FAMILY_KEYS = Object.freeze({
  accruedEntitlement: 'accruedEntitlement',
  realisedCashFlow: 'realisedCashFlow',
  embeddedIncome: 'embeddedIncome'
});

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function finite(value) {
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}

function round(value, digits = 6) {
  if (!finite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(Number(value) * scale) / scale;
}

function dateKey(value) {
  const t = Date.parse(value || '');
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

function monthKey(value) {
  const d = typeof value === 'string' && /^\d{4}-\d{2}/.test(value) ? value.slice(0, 7) : dateKey(value)?.slice(0, 7);
  return d || null;
}

function utcDay(date) {
  return new Date(`${date}T00:00:00.000Z`);
}

function addDays(date, days) {
  const d = utcDay(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDiff(a, b) {
  return Math.floor((utcDay(a) - utcDay(b)) / 86400000);
}

function endOfMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function listJsonFiles(root) {
  if (!fs.existsSync(root)) return [];
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(full));
    else if (entry.isFile() && entry.name.endsWith('.json') && entry.name !== 'manifest.json' && entry.name !== 'corrections.json') out.push(full);
  }
  return out.sort();
}

function observationFromCompanyRow(name, row, at, source, sourceFreshness = null) {
  if (!row || !finite(row.aprLatestPct ?? row.apr)) return null;
  const covered = row.coveredProductiveValueUsd ?? row.coveredProductiveValue ?? row.totalProductiveValue ?? row.productiveValueUsd;
  const total = row.productiveValueUsd ?? row.totalProductiveValue ?? covered;
  if (!finite(covered) || !(Number(covered) > 0)) return null;
  const date = dateKey(at);
  if (!date || monthKey(date) < START_MONTH) return null;
  return {
    company: name,
    date,
    observedAt: new Date(at).toISOString(),
    aprPct: Number(row.aprLatestPct ?? row.apr),
    coveredCapitalUsd: Number(covered),
    productiveCapitalUsd: finite(total) ? Number(total) : Number(covered),
    coverage: finite(row.coverage) ? Number(row.coverage) : null,
    source,
    sourceFreshness
  };
}

function collectReferenceObservations(productivity) {
  const byCompany = new Map(STANDARD_REFERENCE_COMPANIES.map(name => [name, []]));
  const push = obs => { if (obs && byCompany.has(obs.company)) byCompany.get(obs.company).push(obs); };

  for (const name of STANDARD_REFERENCE_COMPANIES) {
    for (const row of productivity?.history?.companies?.[name] || []) {
      push(observationFromCompanyRow(name, row, row.periodEnd, 'productivity-history'));
    }
  }

  for (const file of listJsonFiles(MEMORY_VAULT_DIR)) {
    let record;
    try { record = readJson(file); } catch { continue; }
    const freshness = record?.sources?.productivity?.freshness || null;
    const maxAge = Number(record?.sources?.productivity?.expectedMaxAgeHours);
    const age = Number(record?.sources?.productivity?.ageHours);
    if (freshness && freshness !== 'fresh') continue;
    if (Number.isFinite(maxAge) && Number.isFinite(age) && age > maxAge) continue;
    const at = record?.generatedAt;
    const rows = record?.currentSnapshot?.productivity?.companies || {};
    for (const name of STANDARD_REFERENCE_COMPANIES) {
      push(observationFromCompanyRow(name, rows[name], at, 'memory-vault', freshness));
    }
  }

  const currentAt = productivity?.generatedAt;
  for (const name of STANDARD_REFERENCE_COMPANIES) {
    push(observationFromCompanyRow(name, productivity?.companies?.[name], currentAt, 'productivity-current'));
  }

  for (const [name, rows] of byCompany) {
    const byDate = new Map();
    for (const row of rows.sort((a, b) => a.observedAt.localeCompare(b.observedAt))) {
      const prev = byDate.get(row.date);
      if (!prev || row.observedAt >= prev.observedAt) byDate.set(row.date, row);
    }
    byCompany.set(name, [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)));
  }
  return byCompany;
}

function buildDailyReferenceSeries(observations) {
  if (!observations.length) return [];
  const start = observations[0].date;
  const end = observations[observations.length - 1].date;
  const rows = [];
  let idx = 0;
  let active = null;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    while (idx < observations.length && observations[idx].date <= day) {
      active = observations[idx];
      idx += 1;
    }
    if (!active) continue;
    const ageDays = dayDiff(day, active.date);
    if (ageDays < 0 || ageDays > MAX_CARRY_DAYS) continue;
    const generatedIncomeUsd = active.coveredCapitalUsd * active.aprPct / 100 / 365;
    rows.push({
      date: day,
      month: day.slice(0, 7),
      generatedIncomeUsd,
      coveredCapitalUsd: active.coveredCapitalUsd,
      productiveCapitalUsd: active.productiveCapitalUsd,
      aprPct: active.aprPct,
      coverage: active.coverage,
      sourceDate: active.date,
      source: active.source
    });
  }
  return rows;
}

function aggregateReferenceMonths(name, observations) {
  const daily = buildDailyReferenceSeries(observations);
  const grouped = new Map();
  for (const row of daily) {
    if (row.month < START_MONTH) continue;
    if (!grouped.has(row.month)) grouped.set(row.month, []);
    grouped.get(row.month).push(row);
  }
  const months = {};
  for (const [month, rows] of [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const income = rows.reduce((sum, row) => sum + row.generatedIncomeUsd, 0);
    const avgCovered = rows.reduce((sum, row) => sum + row.coveredCapitalUsd, 0) / rows.length;
    const avgCoverage = rows.reduce((sum, row) => sum + (finite(row.coverage) ? row.coverage : 1), 0) / rows.length;
    const first = rows[0].date;
    const last = rows[rows.length - 1].date;
    const closed = last === endOfMonth(month);
    months[month] = {
      month,
      status: closed ? 'reported' : 'provisional',
      mode: 'observed-reference-model',
      generatedIncomeUsd: round(income, 6),
      monthlyYieldPct: avgCovered > 0 ? round(income / avgCovered * 100, 6) : null,
      averageCapitalUsd: round(avgCovered, 4),
      averageCoverage: round(avgCoverage, 6),
      sampleDays: rows.length,
      periodStart: first,
      periodEnd: last,
      partialPeriod: first !== `${month}-01` || !closed,
      firstObservedDate: observations[0]?.date || first,
      semantic: 'reference-generated-income-not-realised-cash-flow',
      unknownIsNotZero: true,
      preTrackingDaysBackfilled: false,
      executionAuthority: 'none'
    };
  }
  return months;
}

function normalizeFundMonths(fund, type) {
  const out = {};
  for (const [key, row] of Object.entries(fund?.months || {}).sort(([a], [b]) => a.localeCompare(b))) {
    const month = row?.month || key;
    if (!month || month < (type === 'defitea' ? '0000-00' : START_MONTH)) continue;
    const generated = row.cashFlowUsd ?? row.generatedIncomeUsd ?? row.referenceCashFlowUsd;
    const avg = row.averageTvlUsd ?? row.averageStableCapitalUsd ?? row.averageCapitalUsd;
    out[month] = {
      month,
      status: row.status || 'reported',
      mode: row.mode || 'canonical-reporting',
      generatedIncomeUsd: finite(generated) ? round(generated, 6) : null,
      monthlyYieldPct: finite(row.monthlyYieldPct) ? round(row.monthlyYieldPct, 6) : null,
      averageCapitalUsd: finite(avg) ? round(avg, 4) : null,
      sampleDays: finite(row.sampleDays) ? Number(row.sampleDays) : null,
      periodStart: row.periodStart || null,
      periodEnd: row.periodEnd || null,
      partialPeriod: row.partialPeriod === true,
      firstObservedDate: row.trackingStartedAt || fund?.trackingStartedAt || null,
      semantic: type === 'defitea' ? 'canonical-fund-reporting' : 'reference-generated-income-not-realised-cash-flow',
      unknownIsNotZero: true,
      preTrackingDaysBackfilled: row.unobservedPreTrackingDaysBackfilled === true,
      executionAuthority: 'none'
    };
  }
  return out;
}

function evidenceFamily(source, coverage) {
  const eventCount = Number(source?.eventCount || 0);
  const completeCoverage = coverage === 'complete';
  const usdComplete = eventCount > 0 && source?.usdComplete === true;
  let status = 'unknown-no-complete-coverage';
  let usd = null;
  if (eventCount > 0) {
    status = usdComplete ? 'observed' : 'observed-partial-valuation';
    usd = usdComplete && finite(source?.usd) ? round(source.usd, 8) : null;
  } else if (completeCoverage) {
    status = 'measured-zero';
    usd = 0;
  }
  return {
    status,
    coverage: coverage || 'unknown',
    eventCount,
    valuedEventCount: Number(source?.valuedEventCount || 0),
    unvaluedEventCount: Number(source?.unvaluedEventCount || 0),
    usdComplete: completeCoverage ? source?.usdComplete !== false : usdComplete,
    usd,
    valuedUsdSubtotal: eventCount > 0 && finite(source?.valuedUsdSubtotal) ? round(source.valuedUsdSubtotal, 8) : null,
    earnedIncomeEvidence: eventCount > 0,
    unknownIsNotZero: true,
    executionAuthority: 'none'
  };
}

function attachIncomeAccounting(companies, incomeLedger) {
  if (incomeLedger?.version !== '0.1-canonical-income-ledger') throw new Error(`Canonical Income Ledger version mismatch: ${incomeLedger?.version}`);
  if (incomeLedger?.semantics?.unknownIsNotZero !== true || incomeLedger?.semantics?.referenceAprCanBackfillEarnedIncome !== false) {
    throw new Error('Canonical Income Ledger epistemic contract invalid');
  }
  if (incomeLedger?.authority?.executionAuthority !== 'none' || incomeLedger?.authority?.capitalExecution !== false) {
    throw new Error('Canonical Income Ledger authority expansion');
  }

  for (const [name, company] of Object.entries(companies)) {
    const ledgerCompany = incomeLedger?.companies?.[name] || null;
    const coverage = ledgerCompany?.coverage || {};
    for (const [month, reportMonth] of Object.entries(company.months || {})) {
      const ledgerMonth = ledgerCompany?.monthly?.[month] || null;
      const families = ledgerMonth?.families || {};
      const accrued = evidenceFamily(families[FAMILY_KEYS.accruedEntitlement], coverage.accruedEntitlement);
      const realised = evidenceFamily(families[FAMILY_KEYS.realisedCashFlow], coverage.realisedCashFlow);
      const embedded = evidenceFamily(families[FAMILY_KEYS.embeddedIncome], coverage.embeddedIncome);
      const defiteaLegacyOverlap = name === 'defitea.eth';

      reportMonth.incomeAccounting = {
        version: '0.1-monthly-evidence-family-view',
        primaryMetric: {
          usd: finite(reportMonth.generatedIncomeUsd) ? round(reportMonth.generatedIncomeUsd, 8) : null,
          semantic: reportMonth.semantic,
          sourceFamily: company.sourceFamily,
          earnedIncomeAuthority: false,
          additiveWithCanonicalEvidenceFamilies: false,
          overlapStatus: defiteaLegacyOverlap
            ? 'canonical-reporting-aggregate-may-overlap-accrued-and-realised-evidence'
            : 'separate-reference-or-reporting-metric'
        },
        canonicalEvidence: {
          accruedEntitlement: accrued,
          realisedCashFlow: realised,
          embeddedIncome: embedded,
          stablePriceEffectUsd: ledgerMonth && finite(ledgerMonth.stablePriceEffectUsd) ? round(ledgerMonth.stablePriceEffectUsd, 8) : null
        },
        combinedIncomeUsd: null,
        crossFamilySumAllowed: false,
        reconciliationStatus: 'not-reconciled-for-cross-family-total',
        source: 'reporting/income-ledger.json',
        sourceGeneratedAt: incomeLedger.generatedAt || null,
        companyCoverageOverallComplete: ledgerCompany?.coverage?.overallComplete === true,
        unknownIsNotZero: true,
        executionAuthority: 'none'
      };
    }
  }
}

function companyRecord(name, registry, sourceFamily, capitalMetric, months, extra = {}) {
  return {
    registry,
    name,
    sourceFamily,
    capitalMetric,
    averageCapitalLabel: extra.averageCapitalLabel || null,
    fullReportHref: extra.fullReportHref || null,
    executionAuthority: 'none',
    months
  };
}

const productivity = readJson(PRODUCTIVITY_FILE);
const reporting = readJson(REPORTING_FILE);
const incomeLedger = readJson(INCOME_LEDGER_FILE);
const observations = collectReferenceObservations(productivity);

const companies = {};

const defitea = reporting?.funds?.['defitea.eth'];
if (!defitea) throw new Error('Defitea canonical Reporting missing');
companies['defitea.eth'] = companyRecord(
  'defitea.eth', REGISTRY['defitea.eth'], 'canonical-fund-reporting', 'tvl', normalizeFundMonths(defitea, 'defitea'),
  { averageCapitalLabel: 'Average TVL', fullReportHref: '/yield-reports/' }
);

const monetra = reporting?.funds?.['Monetra.eth'];
if (!monetra) throw new Error('Monetra canonical Reporting missing');
companies['Monetra.eth'] = companyRecord(
  'Monetra.eth', REGISTRY['Monetra.eth'], 'canonical-stable-reporting', 'stable-capital', normalizeFundMonths(monetra, 'monetra'),
  { averageCapitalLabel: 'Average Stable Capital', fullReportHref: '/yield-reports/' }
);

for (const name of STANDARD_REFERENCE_COMPANIES) {
  const rows = observations.get(name) || [];
  const months = aggregateReferenceMonths(name, rows);
  if (!Object.keys(months).length) throw new Error(`No observed monthly source for ${name}`);
  const latestMonth = months[Object.keys(months).sort().at(-1)];
  const partialCoverage = finite(latestMonth?.averageCoverage) && Number(latestMonth.averageCoverage) < 0.999999;
  companies[name] = companyRecord(
    name,
    REGISTRY[name],
    'observed-productivity-reference-model',
    partialCoverage ? 'covered-productive-capital' : 'productive-capital',
    months,
    { averageCapitalLabel: partialCoverage ? 'Average Covered Capital' : 'Average Productive Capital' }
  );
}

attachIncomeAccounting(companies, incomeLedger);

const orderedCompanies = Object.fromEntries(Object.entries(companies).sort(([, a], [, b]) => a.registry.localeCompare(b.registry)));
const output = {
  version: '0.2-company-monthly-reporting-income-families',
  methodologyVersion: '0.2-reference-metrics-plus-canonical-evidence-families',
  generatedAt: new Date().toISOString(),
  incomeLedger: {
    source: 'reporting/income-ledger.json',
    version: incomeLedger.version,
    policyVersion: incomeLedger.policyVersion || null,
    generatedAt: incomeLedger.generatedAt || null,
    status: incomeLedger.status || null,
    crossFamilySummationForbidden: true,
    unknownIsNotZero: true
  },
  trackingPolicy: {
    standardCompaniesStartNoEarlierThan: '2026-08-01',
    noPreTrackingBackfill: true,
    unknownIsNotZero: true,
    referenceIncomeFormula: 'coveredProductiveCapitalUsd * companyReferenceAprPct / 100 / 365',
    referenceIncomeIsEarnedIncomeAuthority: false,
    canonicalEvidenceFamiliesPresentedSideBySide: true,
    canonicalEvidenceFamiliesAddedToPrimaryMetric: false,
    crossFamilySummationForbidden: true,
    maxCarryForwardDays: MAX_CARRY_DAYS,
    defiteaAuthority: 'canonical-reporting',
    monetraAuthority: 'canonical-stable-reporting',
    executionAuthority: 'none'
  },
  companies: orderedCompanies
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2) + '\n');
console.log('Company Monthly Reports generated', {
  output: OUTPUT_FILE,
  companyCount: Object.keys(orderedCompanies).length,
  incomeLedgerVersion: incomeLedger.version,
  incomeLedgerGeneratedAt: incomeLedger.generatedAt,
  crossFamilySummationForbidden: true,
  months: Object.fromEntries(Object.entries(orderedCompanies).map(([name, c]) => [name, Object.keys(c.months)]))
});
