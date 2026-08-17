import fs from 'node:fs';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const OUT = 'intelligence/explanatory/explanatory-context.json';
const COMPARATIVE = 'intelligence/comparative/comparative-intelligence.json';
const INCOME = 'intelligence/income-performance/income-performance.json';

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
function sha256(path) {
  return crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
}
function round(n, d = 8) {
  if (!Number.isFinite(Number(n))) return null;
  return Number(Number(n).toFixed(d));
}
function pct(part, whole) {
  if (!Number.isFinite(Number(part)) || !Number.isFinite(Number(whole)) || Number(whole) === 0) return null;
  return round(Number(part) / Number(whole) * 100, 6);
}

const comparative = readJson(COMPARATIVE);
const income = readJson(INCOME);

if (comparative.version !== '0.1-comparative-intelligence') throw new Error('unexpected Comparative Intelligence version');
if (income.version !== '0.1-income-performance-intelligence') throw new Error('unexpected Income & Performance version');

const capitalRows = comparative.comparisons?.companyCapitalScale?.rows || [];
const general = comparative.comparisons?.generalCompanyReferenceProductivity;
const aprRows = general?.byReferenceApr || [];
const outputRows = general?.byAnnualizedReferenceOutput || [];
const productiveRows = general?.byProductiveCapital || [];
const monetraRows = comparative.comparisons?.monetraLatestMeasuredIncomeContribution?.rows || [];

if (capitalRows.length !== 9 || aprRows.length !== 8 || outputRows.length !== 8 || monetraRows.length !== 8) {
  throw new Error('required comparative universes unavailable');
}

const topApr = aprRows[0];
const topOutput = outputRows[0];
const topProductiveCapital = productiveRows[0];
const largestCompany = capitalRows[0];
const monetraLatest = income.embeddedYield?.latestMeasuredInterval;

function companyExplanation(row) {
  const capital = capitalRows.find(r => r.registry === row.registry);
  return {
    registry: row.registry,
    name: row.name,
    totalCapitalUsd: capital?.capitalUsd ?? null,
    productiveCapitalUsd: row.productiveCapitalUsd,
    productiveShareOfCompanyPct: row.productiveShareOfCompanyPct,
    referenceAprPct: row.referenceAprPct,
    annualizedReferenceOutputUsd: row.annualizedReferenceOutputUsd,
    identities: {
      annualizedReferenceOutput: 'productiveCapitalUsd * referenceAprPct / 100',
      reproducedUsd: round(row.productiveCapitalUsd * row.referenceAprPct / 100, 8),
      productiveShare: 'productiveCapitalUsd / totalCapitalUsd * 100',
      reproducedProductiveSharePct: capital ? pct(row.productiveCapitalUsd, capital.capitalUsd) : null
    }
  };
}

const topAprExplained = companyExplanation(topApr);
const topOutputExplained = companyExplanation(topOutput);

const outputGapUsd = round(topOutput.annualizedReferenceOutputUsd - topApr.annualizedReferenceOutputUsd, 8);
const productiveCapitalMultiple = round(topOutput.productiveCapitalUsd / topApr.productiveCapitalUsd, 6);
const aprDifferencePctPoints = round(topOutput.referenceAprPct - topApr.referenceAprPct, 6);

const latestIncomeTotal = Number(monetraLatest?.incomeUsd);
const monetraContributors = monetraRows.map(r => ({
  rank: r.rank,
  protocol: r.protocol,
  latestMeasuredIncomeUsd: r.latestMeasuredIncomeUsd,
  shareOfMeasuredIncomePct: pct(r.latestMeasuredIncomeUsd, latestIncomeTotal),
  interpretation: 'share of the latest measured checkpoint-interval Embedded Yield only'
}));

const topMonetra = monetraContributors[0];
const top3Income = monetraContributors.slice(0, 3).reduce((a, r) => a + Number(r.latestMeasuredIncomeUsd || 0), 0);

const strategyPerf = income.performance?.strategy;
const netPnl = income.performance?.netMarketPnl;
const stablePriceEffectUsd = Number(netPnl?.stablePriceEffectUsd);
const reproducedNetPnl = round(Number(strategyPerf?.sinceInceptionUsd) + stablePriceEffectUsd, 8);

const state = {
  version: '0.1-explanatory-context',
  engineVersion: '0.1-evidence-bound-reason-decomposition',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  purpose: 'Explain proven metric differences through reproducible identities and bounded reason decomposition without turning association into causation.',
  semantics: {
    mechanismRule: 'Use causal language only when the relationship follows from an explicit accounting or metric identity, or when a mechanism-specific source proves the causal link.',
    associationRule: 'Observed co-movement, rank order, or contextual proximity is association/context only unless a mechanism is proven.',
    noNarrativeGuessing: 'Do not invent market, protocol, governance, volume, fee, or user-behavior explanations when no canonical source binds them.',
    aprRule: 'Reference APR is productive capacity, not realised return.',
    rankingRule: 'A rank is explained by the metric definition and its measured inputs, not by a universal quality score.'
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
    comparative: {
      file: COMPARATIVE,
      version: comparative.version,
      generatedAt: comparative.generatedAt,
      sha256: sha256(COMPARATIVE)
    },
    incomePerformance: {
      file: INCOME,
      version: income.version,
      generatedAt: income.generatedAt,
      sha256: sha256(INCOME)
    }
  },
  explanations: {
    referenceProductivity: {
      question: 'Why can the highest-APR company differ from the highest annualized-output company?',
      status: 'answerable-by-metric-identity',
      highestReferenceApr: topAprExplained,
      highestAnnualizedReferenceOutput: topOutputExplained,
      decomposition: {
        higherOutputCompany: topOutput.name,
        higherAprCompany: topApr.name,
        outputGapUsd: outputGapUsd,
        productiveCapitalMultipleVsTopAprCompany: productiveCapitalMultiple,
        aprDifferencePctPoints: aprDifferencePctPoints,
        explanation: `${topOutput.name} has lower Reference APR than ${topApr.name} but more productive capital. Because annualized Reference Output = productive capital × Reference APR, the larger productive-capital base more than offsets the APR gap.`
      },
      causalClass: 'definition-mechanical'
    },
    capitalScaleVsProductivity: {
      question: 'Why is the largest company not necessarily the most productive by APR?',
      status: 'answerable-by-separate-metric-definitions',
      largestCompany: {
        registry: largestCompany.registry,
        name: largestCompany.name,
        capitalUsd: largestCompany.capitalUsd,
        shareOfNetworkPct: largestCompany.shareOfNetworkPct
      },
      highestReferenceAprCompany: {
        registry: topApr.registry,
        name: topApr.name,
        referenceAprPct: topApr.referenceAprPct,
        productiveCapitalUsd: topApr.productiveCapitalUsd
      },
      explanation: 'Current total capital measures scale. Reference APR measures annualized productive capacity on the productive subset. They use different denominators and answer different questions, so rank divergence is expected and is not evidence that one company is universally better.',
      causalClass: 'definition-semantic'
    },
    productiveCapitalScale: {
      question: 'Which company currently contributes the largest productive-capital base?',
      status: 'answerable',
      company: {
        registry: topProductiveCapital.registry,
        name: topProductiveCapital.name,
        productiveCapitalUsd: topProductiveCapital.productiveCapitalUsd,
        referenceAprPct: topProductiveCapital.referenceAprPct,
        annualizedReferenceOutputUsd: topProductiveCapital.annualizedReferenceOutputUsd
      },
      explanation: 'This is a scale statement about measured productive capital, not a realised-performance or quality statement.',
      causalClass: 'measurement-only'
    },
    monetraLatestIncome: {
      question: 'What explains Monetra latest measured Embedded Yield?',
      status: 'answerable-for-latest-measured-interval-only',
      interval: {
        label: monetraLatest?.label,
        incomeUsd: monetraLatest?.incomeUsd,
        stablePriceEffectUsd: monetraLatest?.stablePriceEffectUsd,
        exactCalendarDay: monetraLatest?.exactCalendarDay,
        measuredPositionCount: monetraLatest?.measuredPositionCount,
        totalPositionCount: monetraLatest?.totalPositionCount
      },
      contributors: monetraContributors,
      concentration: {
        topProtocol: topMonetra?.protocol,
        topProtocolIncomeUsd: topMonetra?.latestMeasuredIncomeUsd,
        topProtocolSharePct: topMonetra?.shareOfMeasuredIncomePct,
        top3SharePct: pct(top3Income, latestIncomeTotal)
      },
      explanation: 'Protocol contribution shares reproduce the latest measured Embedded Yield interval only. They do not explain MTD, calendar-day income, claimable rewards, or realised cash flow.',
      causalClass: 'accounting-attribution'
    },
    monetraPerformanceReconciliation: {
      question: 'Why does Monetra Strategy Performance differ from net market P&L?',
      status: 'answerable-by-reconciliation-identity',
      strategyPerformanceUsd: strategyPerf?.sinceInceptionUsd,
      strategyPerformancePct: strategyPerf?.sinceInceptionPct,
      stablePriceEffectUsd: netPnl?.stablePriceEffectUsd,
      netMarketPnlUsd: netPnl?.usd,
      netMarketPnlPct: netPnl?.pct,
      identity: 'strategyPerformanceUsd + stablePriceEffectUsd = netMarketPnlUsd',
      reproducedNetMarketPnlUsd: reproducedNetPnl,
      explanation: 'Strategy Performance measures strategy-unit performance against verified entry principal. Net market P&L additionally includes current stable-price effects; the stable-price effect therefore reconciles the difference mechanically.',
      causalClass: 'accounting-identity'
    }
  },
  answerability: {
    'why-top-apr-differs-from-top-output': 'answerable',
    'why-largest-company-is-not-best-apr': 'answerable-by-separate-metric-definitions',
    'what-drove-monetra-latest-measured-income': 'answerable-latest-interval-only',
    'why-monetra-strategy-performance-differs-from-net-pnl': 'answerable-by-reconciliation-identity',
    'why-protocol-apr-changed': 'blocked-no-canonical-driver-context',
    'why-company-tvl-changed': 'blocked-no-time-series-driver-decomposition',
    'why-market-moved': 'blocked-no-market-causal-evidence',
    'mtd-monetra-protocol-driver-attribution': 'blocked-no-canonical-interval-history',
    'best-company-overall-explanation': 'blocked-no-universal-score'
  },
  nextEvidenceGaps: [
    {
      id: 'protocol-driver-context',
      need: 'Canonical protocol-level context such as volume, fees, TVL, reward rate or mechanism-specific state before explaining APR changes.',
      rule: 'Context may be reported as association unless the protocol mechanism proves causation.'
    },
    {
      id: 'capital-change-decomposition',
      need: 'Comparable historical Capital State snapshots and explicit boundary-flow classification before explaining company TVL changes over time.'
    },
    {
      id: 'monetra-interval-history',
      need: 'Canonical interval-by-interval Embedded Yield attribution before MTD protocol driver explanations are allowed.'
    }
  ]
};

fs.mkdirSync('intelligence/explanatory', { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(state, null, 2) + '\n');

console.log('Explanatory Context v0.1 built', {
  topApr: topApr.name,
  topOutput: topOutput.name,
  outputGapUsd,
  topMonetraContributor: topMonetra?.protocol,
  monetraNetPnlReproduced: reproducedNetPnl,
  executionAuthority: state.authority.executionAuthority
});
