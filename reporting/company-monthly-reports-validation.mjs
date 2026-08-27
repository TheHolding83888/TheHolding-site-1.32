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

if (data.version !== '0.2-company-monthly-reporting-income-families') fail('version drift');
if (data.methodologyVersion !== '0.2-reference-metrics-plus-canonical-evidence-families') fail('methodology drift');
if (data.trackingPolicy?.noPreTrackingBackfill !== true || data.trackingPolicy?.unknownIsNotZero !== true) fail('tracking truthfulness contract missing');
if (data.trackingPolicy?.executionAuthority !== 'none') fail('execution authority expanded');
if (data.trackingPolicy?.maxCarryForwardDays !== 8) fail('carry-forward freshness contract drift');
if (data.trackingPolicy?.referenceIncomeIsEarnedIncomeAuthority !== false) fail('reference income escaped earned-income boundary');
if (data.trackingPolicy?.canonicalEvidenceFamiliesPresentedSideBySide !== true) fail('canonical evidence family presentation contract missing');
if (data.trackingPolicy?.canonicalEvidenceFamiliesAddedToPrimaryMetric !== false) fail('canonical evidence was made additive to primary metric');
if (data.trackingPolicy?.crossFamilySummationForbidden !== true) fail('cross-family summation guard missing');
if (data.incomeLedger?.source !== 'reporting/income-ledger.json') fail('canonical income ledger provenance missing');
if (data.incomeLedger?.version !== '0.1-canonical-income-ledger') fail('canonical income ledger version drift');
if (data.incomeLedger?.crossFamilySummationForbidden !== true || data.incomeLedger?.unknownIsNotZero !== true) fail('canonical income ledger epistemic metadata missing');

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

    const a = m.incomeAccounting;
    if (!a || a.version !== '0.1-monthly-evidence-family-view') fail(`${name} income accounting view missing ${key}`);
    if (a.primaryMetric?.usd !== m.generatedIncomeUsd) fail(`${name} primary metric drift ${key}`);
    if (a.primaryMetric?.earnedIncomeAuthority !== false) fail(`${name} primary metric became earned-income authority ${key}`);
    if (a.primaryMetric?.additiveWithCanonicalEvidenceFamilies !== false) fail(`${name} primary metric became additive with evidence families ${key}`);
    if (a.combinedIncomeUsd !== null || a.crossFamilySumAllowed !== false) fail(`${name} cross-family collapse detected ${key}`);
    if (a.reconciliationStatus !== 'not-reconciled-for-cross-family-total') fail(`${name} reconciliation status drift ${key}`);
    if (a.source !== 'reporting/income-ledger.json' || !a.sourceGeneratedAt) fail(`${name} canonical ledger provenance missing ${key}`);
    if (a.unknownIsNotZero !== true || a.executionAuthority !== 'none') fail(`${name} income accounting epistemic/authority drift ${key}`);

    for (const familyName of ['accruedEntitlement', 'realisedCashFlow', 'embeddedIncome']) {
      const f = a.canonicalEvidence?.[familyName];
      if (!f) fail(`${name} ${familyName} family missing ${key}`);
      if (!Number.isInteger(f.eventCount) || f.eventCount < 0) fail(`${name} ${familyName} event count invalid ${key}`);
      if (f.unknownIsNotZero !== true || f.executionAuthority !== 'none') fail(`${name} ${familyName} epistemic/authority drift ${key}`);
      if (f.eventCount === 0 && f.coverage !== 'complete' && f.usd !== null) fail(`${name} ${familyName} incomplete no-event family became zero/numeric ${key}`);
      if (f.eventCount > 0 && f.usdComplete === true && !finite(f.usd)) fail(`${name} ${familyName} complete valued events missing USD ${key}`);
      if (f.eventCount > 0 && f.usdComplete !== true && f.usd !== null) fail(`${name} ${familyName} partial valuation masquerades as complete USD ${key}`);
    }
  }
}

const d = companies['defitea.eth'];
if (d.sourceFamily !== 'canonical-fund-reporting' || d.capitalMetric !== 'tvl') fail('Defitea source/capital authority drift');
for (const key of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08']) {
  if (!d.months?.[key]) fail(`Defitea archive missing ${key}`);
}
for (const key of ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07']) {
  const a = d.months[key].incomeAccounting;
  if (a.canonicalEvidence.accruedEntitlement.usd !== null || a.canonicalEvidence.realisedCashFlow.usd !== null) fail(`Defitea pre-ledger history fabricated canonical evidence ${key}`);
}
const dAug = d.months['2026-08'].incomeAccounting;
if (dAug.primaryMetric?.overlapStatus !== 'canonical-reporting-aggregate-may-overlap-accrued-and-realised-evidence') fail('Defitea overlap warning missing');
if (!(dAug.canonicalEvidence.accruedEntitlement.eventCount > 0)) fail('Defitea August canonical accrued entitlement events missing');
if (!(dAug.canonicalEvidence.realisedCashFlow.eventCount > 0)) fail('Defitea August canonical realised cash-flow events missing');
if (!finite(dAug.canonicalEvidence.accruedEntitlement.usd) || !finite(dAug.canonicalEvidence.realisedCashFlow.usd)) fail('Defitea August valued canonical evidence missing');
if (dAug.combinedIncomeUsd !== null) fail('Defitea overlapping families were summed');

const m = companies['Monetra.eth'];
if (m.sourceFamily !== 'canonical-stable-reporting' || m.capitalMetric !== 'stable-capital') fail('Monetra source/capital authority drift');
if (!m.months?.['2026-08']) fail('Monetra August missing');
if (m.months['2026-08'].periodStart !== '2026-08-13') fail('Monetra canonical August start drift');
const mAug = m.months['2026-08'].incomeAccounting;
if (!(mAug.canonicalEvidence.embeddedIncome.eventCount > 0)) fail('Monetra August canonical embedded-income intervals missing');
if (!finite(mAug.canonicalEvidence.embeddedIncome.usd)) fail('Monetra August canonical embedded income missing');
if (mAug.primaryMetric?.semantic !== 'reference-generated-income-not-realised-cash-flow') fail('Monetra primary reference metric semantic drift');
if (mAug.primaryMetric?.additiveWithCanonicalEvidenceFamilies !== false || mAug.combinedIncomeUsd !== null) fail('Monetra reference and embedded income were incorrectly summed');

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
  if (aug.incomeAccounting.primaryMetric.earnedIncomeAuthority !== false) fail(`${name} reference model became earned-income authority`);
}

if (companies.Cypher.capitalMetric !== 'covered-productive-capital') fail('Cypher partial coverage must use covered productive capital');
if (companies.Cypher.months['2026-08'].averageCoverage >= 1) fail('Cypher coverage unexpectedly treated as complete');

console.log('Company Monthly Reports validation PASS', {
  companyCount: names.length,
  incomeLedgerVersion: data.incomeLedger.version,
  defiteaAugust: {
    accruedEntitlementUsd: dAug.canonicalEvidence.accruedEntitlement.usd,
    realisedCashFlowUsd: dAug.canonicalEvidence.realisedCashFlow.usd,
    primaryMetricUsd: dAug.primaryMetric.usd,
    combinedIncomeUsd: dAug.combinedIncomeUsd
  },
  monetraAugust: {
    embeddedIncomeUsd: mAug.canonicalEvidence.embeddedIncome.usd,
    referenceMetricUsd: mAug.primaryMetric.usd,
    combinedIncomeUsd: mAug.combinedIncomeUsd
  },
  starts: Object.fromEntries(Object.entries(companies).map(([name, c]) => [name, c.months?.['2026-08']?.periodStart || null]))
});
