import fs from 'node:fs';

const FILE = process.env.COMPANY_MONTHLY_REPORTS_FILE || './reporting/company-monthly-reports.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const EXPECTED = Object.freeze({
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

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const fail = msg => { throw new Error(msg); };

if (data.version !== '0.1-company-monthly-reporting') fail('version drift');
if (data.methodologyVersion !== '0.1-observed-reference-income-from-august-2026') fail('methodology drift');
if (data.trackingPolicy?.noPreTrackingBackfill !== true || data.trackingPolicy?.unknownIsNotZero !== true) fail('tracking truthfulness contract missing');
if (data.trackingPolicy?.executionAuthority !== 'none') fail('execution authority expanded');
if (data.trackingPolicy?.maxCarryForwardDays !== 8) fail('carry-forward freshness contract drift');

const companies = data.companies || {};
const names = Object.keys(companies);
if (names.length !== Object.keys(EXPECTED).length) fail(`expected 10 companies, got ${names.length}`);
for (const name of Object.keys(EXPECTED)) if (!companies[name]) fail(`missing company ${name}`);

for (const [name, registry] of Object.entries(EXPECTED)) {
  const c = companies[name];
  if (c.registry !== registry) fail(`${name} registry drift`);
  if (c.executionAuthority !== 'none') fail(`${name} execution authority expanded`);
  const months = c.months || {};
  if (!Object.keys(months).length) fail(`${name} has no monthly reports`);
  for (const [key, m] of Object.entries(months)) {
    if (m.month !== key) fail(`${name} month key mismatch ${key}`);
    if (!finite(m.generatedIncomeUsd)) fail(`${name} generated income missing ${key}`);
    if (!finite(m.monthlyYieldPct)) fail(`${name} month yield missing ${key}`);
    if (!finite(m.averageCapitalUsd) || !(Number(m.averageCapitalUsd) > 0)) fail(`${name} average capital missing ${key}`);
    if (m.unknownIsNotZero !== true) fail(`${name} unknown-is-not-zero missing ${key}`);
    if (m.executionAuthority !== 'none') fail(`${name} month authority expanded ${key}`);
  }
}

const d = companies['defitea.eth'];
if (d.sourceFamily !== 'canonical-fund-reporting' || d.capitalMetric !== 'tvl') fail('Defitea source/capital authority drift');
for (const key of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']) {
  if (!d.months?.[key]) fail(`Defitea archive missing ${key}`);
}

const m = companies['Monetra.eth'];
if (m.sourceFamily !== 'canonical-stable-reporting' || m.capitalMetric !== 'stable-capital') fail('Monetra source/capital authority drift');
if (!m.months?.['2026-08']) fail('Monetra August missing');
if (m.months['2026-08'].periodStart !== '2026-08-13') fail('Monetra canonical August start drift');

for (const name of Object.keys(EXPECTED)) {
  if (['defitea.eth', 'Monetra.eth'].includes(name)) continue;
  const c = companies[name];
  if (c.sourceFamily !== 'observed-productivity-reference-model') fail(`${name} source family drift`);
  const aug = c.months?.['2026-08'];
  if (!aug) fail(`${name} August missing`);
  if (!/^2026-08-\d{2}$/.test(String(aug.periodStart || ''))) fail(`${name} August start invalid`);
  if (aug.periodStart < '2026-08-01') fail(`${name} pre-August history leaked into pilot`);
  if (aug.firstObservedDate !== aug.periodStart) fail(`${name} report begins before/after first proven observation`);
  if (aug.preTrackingDaysBackfilled !== false) fail(`${name} pre-tracking backfill detected`);
  if (aug.semantic !== 'reference-generated-income-not-realised-cash-flow') fail(`${name} semantic drift`);
  if (!(Number(aug.sampleDays) >= 1)) fail(`${name} sampleDays invalid`);
  if (aug.partialPeriod !== true) fail(`${name} August must remain explicitly partial while live`);
}

if (companies.Cypher.capitalMetric !== 'covered-productive-capital') fail('Cypher partial coverage must use covered productive capital');
if (companies.Cypher.months['2026-08'].averageCoverage >= 1) fail('Cypher coverage unexpectedly treated as complete');

console.log('Company Monthly Reports validation PASS', {
  companyCount: names.length,
  starts: Object.fromEntries(Object.entries(companies).map(([name, c]) => [name, c.months?.['2026-08']?.periodStart || null]))
});
