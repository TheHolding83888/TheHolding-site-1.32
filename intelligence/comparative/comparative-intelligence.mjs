import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/comparative/comparative-intelligence.json');
const CAPITAL = 'intelligence/capital-state/capital-state.json';
const PRODUCTIVITY = 'companies/productivity-data.json';
const INCOME = 'intelligence/income-performance/income-performance.json';

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function sha256File(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}
function round(value, digits = 8) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
function rankDesc(rows, field) {
  return [...rows]
    .filter(r => Number.isFinite(Number(r[field])))
    .sort((a,b) => Number(b[field]) - Number(a[field]))
    .map((r,i) => ({ rank: i + 1, ...r }));
}
function sum(values) {
  return values.reduce((a,b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0);
}

const capital = readJson(CAPITAL);
const productivity = readJson(PRODUCTIVITY);
const income = readJson(INCOME);

if (capital.version !== '0.3-capital-state') throw new Error(`unexpected Capital State ${capital.version}`);
if (productivity.version !== '1.16') throw new Error(`unexpected Productivity ${productivity.version}`);
if (income.version !== '0.1-income-performance-intelligence') throw new Error(`unexpected Income & Performance ${income.version}`);
if (capital.network?.totalCapitalCoverage !== 1 || capital.network?.networkTvlStatus !== 'complete') throw new Error('Capital State not fully comparable');

const registryCompanyCount = Number(capital.network?.registryCompanyCount);
const completeCompanyCount = Number(capital.network?.totalCapitalCompleteCompanyCount);
if (!Number.isInteger(registryCompanyCount) || registryCompanyCount < 1 || completeCompanyCount !== registryCompanyCount) {
  throw new Error('Capital State registry completeness contract unavailable');
}

const capitalRows = (capital.companies || []).map(c => ({
  registry: c.registry,
  name: c.name,
  capitalUsd: round(c.measuredCapitalUsd),
  shareOfNetworkPct: round((Number(c.measuredCapitalUsd) / Number(capital.network.networkTvlUsd)) * 100, 6),
  totalCapitalComplete: c.totalCapitalComplete === true,
  capitalScope: c.capitalScope || null
}));
if (capitalRows.length !== registryCompanyCount || capitalRows.some(r => !r.totalCapitalComplete)) {
  throw new Error(`capital ranking requires ${registryCompanyCount}/${registryCompanyCount} complete companies`);
}
const capitalRanking = rankDesc(capitalRows, 'capitalUsd');

const stableCapitalNames = new Set(
  capitalRows
    .filter(c => c.capitalScope === 'stable-company-total-current-capital')
    .map(c => c.name)
);
const expectedGeneralCompanyNames = new Set(
  capitalRows
    .filter(c => !stableCapitalNames.has(c.name))
    .map(c => c.name)
);

const productivityRows = [];
for (const [name, p] of Object.entries(productivity.companies || {})) {
  const cap = capitalRows.find(c => c.name === name);
  if (!cap) throw new Error(`Productivity company missing from Capital State: ${name}`);
  if (p.status !== 'ok' || Number(p.coverage) !== 1 || p.aprScope !== 'full-productive-capital') continue;
  const productiveValueUsd = Number(p.productiveValue);
  const aprPct = Number(p.aprLatest);
  if (!Number.isFinite(productiveValueUsd) || !Number.isFinite(aprPct)) continue;
  productivityRows.push({
    registry: cap.registry,
    name,
    productiveCapitalUsd: round(productiveValueUsd),
    referenceAprPct: round(aprPct, 6),
    productiveShareOfCompanyPct: round((productiveValueUsd / Number(cap.capitalUsd)) * 100, 6),
    annualizedReferenceOutputUsd: round(productiveValueUsd * aprPct / 100),
    coverage: Number(p.coverage),
    methodologyVersion: productivity.methodologyVersion,
    aprScope: p.aprScope
  });
}
const rankedGeneralNames = new Set(productivityRows.map(r => r.name));
const missingGeneral = [...expectedGeneralCompanyNames].filter(name => !rankedGeneralNames.has(name));
const unexpectedGeneral = [...rankedGeneralNames].filter(name => !expectedGeneralCompanyNames.has(name));
if (productivityRows.length !== expectedGeneralCompanyNames.size || missingGeneral.length || unexpectedGeneral.length) {
  throw new Error(`general-company productivity universe mismatch: expected=${expectedGeneralCompanyNames.size} actual=${productivityRows.length} missing=${missingGeneral.join(',') || 'none'} unexpected=${unexpectedGeneral.join(',') || 'none'}`);
}

const protocolRows = Object.values(productivity.engines || {})
  .filter(e => e.status === 'ok' && Number.isFinite(Number(e.aprLatest)))
  .map(e => ({
    engineId: e.engineId,
    protocol: e.protocol,
    principalSymbol: e.principalSymbol,
    referenceAprPct: round(e.aprLatest, 6),
    sourceType: e.sourceType,
    sourceMetric: e.sourceMetric,
    nativeCadence: e.nativeCadence,
    periodStart: e.periodStart || null,
    periodEnd: e.periodEnd || null
  }));

const latest = income.embeddedYield?.latestMeasuredInterval;
if (!latest || latest.exactCalendarDay !== false || !Array.isArray(latest.byProtocol)) throw new Error('latest income interval not safely comparable');
const incomeRows = latest.byProtocol.map(r => ({
  protocol: r.protocol,
  latestMeasuredIncomeUsd: round(r.incomeUsd),
  stablePriceEffectUsd: round(r.stablePriceEffectUsd),
  positionCount: r.positionCount,
  intervalSemantic: 'latest-measured-checkpoint-interval'
}));
const incomeSum = round(sum(incomeRows.map(r => r.latestMeasuredIncomeUsd)));
if (Math.abs(incomeSum - Number(latest.incomeUsd)) > 0.00002) throw new Error('latest income attribution drift');

const output = {
  version: '0.1-comparative-intelligence',
  engineVersion: '0.1.1-registry-derived-comparability',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  purpose: 'Evidence-bound comparative layer that ranks only within explicitly comparable universes and preserves metric semantics, exclusions, provenance, and coverage.',
  semantics: {
    noUniversalLeaderboard: 'There is no single best company or protocol score. Capital scale, Reference Productivity, protocol Reference APR, and measured income contribution answer different questions.',
    comparabilityRule: 'A ranking is emitted only when metric definition, eligible universe, coverage and source methodology are explicit enough to reproduce it.',
    registryRule: 'Company-count expectations are derived from canonical Capital State registry completeness rather than hard-coded historical registry size.',
    aprRule: 'Reference APR is annualized productive capacity, not realised cash flow, embedded yield, claimable rewards or verified performance.',
    incomeRule: 'Latest measured income contribution is an observed checkpoint-interval attribution for Monetra only; it is not a calendar-day, MTD, or cross-company performance ranking.',
    zeroRule: 'Unknown or unsupported values are excluded, not ranked as zero.'
  },
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    allocationAuthority: false,
    recommendationAuthority: false,
    methodologyMutationAuthority: false
  },
  sourceState: {
    capitalState: { file: CAPITAL, version: capital.version, generatedAt: capital.generatedAt, sha256: sha256File(CAPITAL) },
    productivity: { file: PRODUCTIVITY, version: productivity.version, methodologyVersion: productivity.methodologyVersion, generatedAt: productivity.generatedAt, sha256: sha256File(PRODUCTIVITY) },
    incomePerformance: { file: INCOME, version: income.version, engineVersion: income.engineVersion, generatedAt: income.generatedAt, sha256: sha256File(INCOME) }
  },
  comparisons: {
    companyCapitalScale: {
      metric: 'current-total-capital-usd',
      rankingBasis: 'descending measuredCapitalUsd',
      eligibleUniverse: 'all Registry companies with complete total-capital binding',
      eligibleCount: capitalRanking.length,
      networkTvlUsd: round(capital.network.networkTvlUsd),
      coverageRule: `requires ${registryCompanyCount}/${registryCompanyCount} complete Capital State total-capital binding`,
      exclusions: [],
      rows: capitalRanking
    },
    generalCompanyReferenceProductivity: {
      metric: 'capital-weighted-reference-apr-pct',
      rankingBasis: 'descending aprLatest within full-productive-capital methodology',
      eligibleUniverse: 'non-Stable-Capital Registry companies in canonical Productivity with status=ok, coverage=1 and aprScope=full-productive-capital',
      eligibleCount: productivityRows.length,
      coverageRule: 'all non-Stable-Capital Registry companies must have 100% covered full-productive-capital Productivity before this ranking is emitted',
      exclusions: [...stableCapitalNames].map(name => `${name} is excluded from this leaderboard because Stable Capital Reference APY is produced by a separate stable methodology/universe.`),
      byReferenceApr: rankDesc(productivityRows, 'referenceAprPct'),
      byProductiveCapital: rankDesc(productivityRows, 'productiveCapitalUsd'),
      byAnnualizedReferenceOutput: rankDesc(productivityRows, 'annualizedReferenceOutputUsd')
    },
    protocolReferenceApr: {
      metric: 'current-reference-apr-pct',
      rankingBasis: 'descending normalized aprLatest',
      eligibleUniverse: 'canonical Productivity engines with status=ok and finite Reference APR',
      eligibleCount: protocolRows.length,
      coverageRule: 'engine-level ranking only; differing native cadences and mechanisms remain visible in every row',
      exclusions: ['Do not infer realised performance from this ranking.', 'Do not compare this directly with Monetra measured income contribution.'],
      rows: rankDesc(protocolRows, 'referenceAprPct')
    },
    monetraLatestMeasuredIncomeContribution: {
      metric: 'latest-measured-embedded-income-usd',
      rankingBasis: 'descending observed incomeUsd inside the same latest checkpoint interval',
      eligibleUniverse: 'Monetra positions/protocols with latestInterval.status=ok',
      eligibleCount: incomeRows.length,
      measuredPositionCount: latest.measuredPositionCount,
      totalPositionCount: latest.totalPositionCount,
      latestMeasuredIncomeUsd: round(latest.incomeUsd),
      coverageRule: 'same company, same checkpoint interval semantic; non-comparable/warming positions excluded',
      exclusions: ['Not calendar-day income.', 'Not MTD protocol attribution.', 'Not cross-company performance.'],
      rows: rankDesc(incomeRows, 'latestMeasuredIncomeUsd')
    }
  },
  answerability: {
    'largest-company-by-current-capital': 'answerable',
    'smallest-company-by-current-capital': 'answerable',
    'highest-reference-apr-general-company': 'answerable-with-general-universe-disclosure',
    'largest-general-productive-capital': 'answerable-with-general-universe-disclosure',
    'highest-reference-apr-protocol-engine': 'answerable-with-mechanism-and-cadence-disclosure',
    'largest-monetra-latest-income-contributor': 'answerable-with-interval-label',
    'best-company-overall': 'blocked-no-universal-score',
    'best-protocol-overall': 'blocked-no-universal-score',
    'cross-company-realised-performance-ranking': 'blocked-insufficient-comparable-realised-performance-coverage'
  },
  gaps: [
    {
      id: 'cross-company-realised-performance-coverage',
      status: 'blocking',
      blocks: ['realised-performance leaderboard', 'capital-efficiency ranking based on realised return'],
      reason: 'Comparable realised income/performance is not yet available across the full company universe.'
    },
    {
      id: 'stable-vs-general-reference-yield-normalization',
      status: 'deliberately-separated',
      blocks: ['single Reference APR leaderboard across Monetra and general companies'],
      reason: 'Stable Capital Reference APY and general-company Productivity APR are separate methodologies and should not be silently collapsed.'
    }
  ]
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
console.log('Comparative Intelligence v0.1.1 built', {
  networkTvlUsd: output.comparisons.companyCapitalScale.networkTvlUsd,
  companiesRanked: output.comparisons.companyCapitalScale.eligibleCount,
  generalCompaniesRanked: output.comparisons.generalCompanyReferenceProductivity.eligibleCount,
  protocolEnginesRanked: output.comparisons.protocolReferenceApr.eligibleCount,
  monetraLatestProtocolsRanked: output.comparisons.monetraLatestMeasuredIncomeContribution.eligibleCount,
  executionAuthority: output.authority.executionAuthority
});
