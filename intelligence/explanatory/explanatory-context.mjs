import fs from 'node:fs';
import crypto from 'node:crypto';

const OUT = 'intelligence/explanatory/explanatory-context.json';
const COMPARATIVE = 'intelligence/comparative/comparative-intelligence.json';
const INCOME = 'intelligence/income-performance/income-performance.json';
const ECONOMIC_GRAPH = 'intelligence/economic-graph/economic-graph.json';

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
function requireFinite(value, label) {
  if (!Number.isFinite(Number(value))) throw new Error(`${label} must be finite`);
  return Number(value);
}

const comparative = readJson(COMPARATIVE);
const income = readJson(INCOME);
const economicGraph = readJson(ECONOMIC_GRAPH);

if (comparative.version !== '0.1-comparative-intelligence') throw new Error('unexpected Comparative Intelligence version');
if (income.version !== '0.1-income-performance-intelligence') throw new Error('unexpected Income & Performance version');
if (economicGraph.version !== '0.1-economic-graph') throw new Error('unexpected Economic Graph version');
if (economicGraph.status !== 'partial-first-cohort') throw new Error('Economic Graph must remain partial-first-cohort');
if (economicGraph.authority?.readOnly !== true || economicGraph.authority?.executionAuthority !== 'none') throw new Error('Economic Graph authority regression');
if (economicGraph.authority?.causalClaimAuthority !== 'none') throw new Error('Economic Graph causal authority regression');

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

const economicObservation = economicGraph.latest?.observation;
const economicMovement = economicGraph.latest?.movement;
if (!economicObservation || !economicMovement) throw new Error('Economic Graph latest observation/movement unavailable');
if (economicObservation.company?.registry !== '004' || economicObservation.protocol !== 'f(x)' || economicObservation.mechanism !== 'veFXN Locker') {
  throw new Error('Unexpected Economic Graph first cohort identity');
}
const liveApr = requireFinite(economicObservation.liveObservedAprPct, 'Economic Graph live APR');
const canonicalApr = requireFinite(economicObservation.canonicalProductivityAprPct, 'Economic Graph canonical APR');
const aprParityDelta = requireFinite(economicObservation.aprParityDeltaPctPoints, 'Economic Graph APR parity delta');
if (Math.abs(aprParityDelta) > 0.01 || Math.abs(liveApr - canonicalApr) > 0.01) {
  throw new Error('Economic Graph APR parity failed');
}
if (economicObservation.epistemic?.causalAttribution !== 'unresolved' || economicObservation.epistemic?.primaryDriver !== null) {
  throw new Error('First-cohort causal boundary must remain unresolved');
}

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

const protocolAprChangeContext = {
  question: 'What measured protocol-economic context is available around the current veFXN Reference APR, and can it prove why APR changed?',
  status: 'context-available-causal-attribution-unresolved',
  coverage: {
    cohort: economicGraph.semantics?.currentCohort ?? 'Defitea -> f(x) veFXN',
    companyRegistry: economicObservation.company.registry,
    company: economicObservation.company.name,
    protocol: economicObservation.protocol,
    mechanism: economicObservation.mechanism,
    asset: economicObservation.asset
  },
  apr: {
    liveObservedPct: liveApr,
    canonicalProductivityPct: canonicalApr,
    parityDeltaPctPoints: aprParityDelta,
    currentObservationStatus: economicObservation.canonicalProductivityStatus,
    deltaFromPriorGraphObservationPctPoints: economicMovement.aprDeltaPctPoints ?? null
  },
  measuredDrivers: {
    fxnLocked: economicObservation.drivers?.fxnLocked ?? null,
    fxnCirculatingSupplyLockedPct: economicObservation.drivers?.fxnCirculatingSupplyLockedPct ?? null,
    totalVeFxn: economicObservation.drivers?.totalVeFxn ?? null,
    cumulativeThisWeekWsteth: economicObservation.drivers?.cumulativeThisWeekWsteth ?? null,
    previousWeekWsteth: economicObservation.drivers?.previousWeekWsteth ?? null,
    averageLockRaw: economicObservation.drivers?.averageLockRaw ?? null,
    accumulateTillRaw: economicObservation.drivers?.accumulateTillRaw ?? null
  },
  measuredMovement: {
    priorObservationId: economicMovement.priorObservationId ?? null,
    elapsedHours: economicMovement.elapsedHours ?? null,
    fxnLockedDelta: economicMovement.fxnLockedDelta ?? null,
    fxnCirculatingSupplyLockedPctDeltaPoints: economicMovement.fxnCirculatingSupplyLockedPctDeltaPoints ?? null,
    totalVeFxnDelta: economicMovement.totalVeFxnDelta ?? null,
    currentWeekRevenueDeltaWsteth: economicMovement.currentWeekRevenueDeltaWsteth ?? null,
    revenueDeltaComparable: economicMovement.revenueDeltaComparable ?? null,
    revenueDeltaNonComparableReason: economicMovement.revenueDeltaNonComparableReason ?? null
  },
  provenance: {
    graphFile: ECONOMIC_GRAPH,
    graphSha256: sha256(ECONOMIC_GRAPH),
    observationId: economicObservation.id,
    observedAt: economicObservation.observedAt,
    sourceUrl: economicObservation.source?.url ?? null,
    sourceType: economicObservation.source?.sourceType ?? null,
    rawBlockHash: economicObservation.source?.rawBlockHash ?? null
  },
  causalAttribution: 'unresolved',
  primaryDriver: null,
  causalClass: 'measured-context-only',
  explanation: 'Canonical protocol-economic driver context is now available for the Defitea veFXN cohort. The system may report these measured values and their comparable deltas, but it must not say that revenue, locked supply, Total veFXN, price, incentives or another driver caused the APR until a protocol-specific formula or onchain accounting identity proves that path.',
  promotionRule: economicGraph.semantics?.driverPromotionRule ?? 'Require a protocol-specific formula or onchain accounting identity before causal attribution.'
};

const state = {
  version: '0.2-explanatory-context',
  engineVersion: '0.2-evidence-bound-economic-driver-context',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  purpose: 'Explain proven metric differences through reproducible identities and expose canonical protocol-economic driver context without turning association into causation.',
  semantics: {
    mechanismRule: 'Use causal language only when the relationship follows from an explicit accounting or metric identity, or when a mechanism-specific source proves the causal link.',
    associationRule: 'Observed co-movement, rank order, contextual proximity, or Economic Graph driver movement is association/context only unless a mechanism is proven.',
    noNarrativeGuessing: 'Do not invent market, protocol, governance, volume, fee, incentive, or user-behavior explanations when no canonical source binds them.',
    aprRule: 'Reference APR is productive capacity, not realised return.',
    rankingRule: 'A rank is explained by the metric definition and its measured inputs, not by a universal quality score.',
    economicGraphRule: 'Economic Graph observations may answer what changed around a protocol mechanism; they do not answer why it changed until causal attribution is promoted by proof.'
  },
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    allocationAuthority: false,
    recommendationAuthority: false,
    causalClaimAuthority: 'none',
    methodologyMutationAuthority: false
  },
  sourceState: {
    comparative: { file: COMPARATIVE, version: comparative.version, generatedAt: comparative.generatedAt, sha256: sha256(COMPARATIVE) },
    incomePerformance: { file: INCOME, version: income.version, generatedAt: income.generatedAt, sha256: sha256(INCOME) },
    economicGraph: {
      file: ECONOMIC_GRAPH,
      version: economicGraph.version,
      engineVersion: economicGraph.engineVersion,
      generatedAt: economicGraph.generatedAt,
      status: economicGraph.status,
      sha256: sha256(ECONOMIC_GRAPH)
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
        outputGapUsd,
        productiveCapitalMultipleVsTopAprCompany: productiveCapitalMultiple,
        aprDifferencePctPoints,
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
    },
    protocolAprChangeContext
  },
  answerability: {
    'why-top-apr-differs-from-top-output': 'answerable',
    'why-largest-company-is-not-best-apr': 'answerable-by-separate-metric-definitions',
    'what-drove-monetra-latest-measured-income': 'answerable-latest-interval-only',
    'why-monetra-strategy-performance-differs-from-net-pnl': 'answerable-by-reconciliation-identity',
    'what-protocol-context-accompanied-apr': 'answerable-by-measured-context-first-cohort',
    'why-protocol-apr-changed': 'context-available-cause-unresolved',
    'why-company-tvl-changed': 'blocked-no-time-series-driver-decomposition',
    'why-market-moved': 'blocked-no-market-causal-evidence',
    'mtd-monetra-protocol-driver-attribution': 'blocked-no-canonical-interval-history',
    'best-company-overall-explanation': 'blocked-no-universal-score'
  },
  nextEvidenceGaps: [
    {
      id: 'protocol-driver-causal-attribution',
      need: 'Protocol-specific APR formula or onchain accounting identity that reproduces the APR change from canonical driver inputs before promoting any observed driver to ATTRIBUTED.',
      rule: 'Measured driver context may be reported now; causal language remains blocked until the mechanism is proven.'
    },
    {
      id: 'economic-graph-cohort-expansion',
      need: 'Equivalent canonical driver observations for additional Defitea productive mechanisms before protocol-economic explanation coverage can expand beyond veFXN.',
      rule: 'Each protocol/mechanism requires its own authority, cadence, units and attribution rules.'
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

console.log('Explanatory Context v0.2 built', {
  topApr: topApr.name,
  topOutput: topOutput.name,
  outputGapUsd,
  topMonetraContributor: topMonetra?.protocol,
  monetraNetPnlReproduced: reproducedNetPnl,
  protocolAprContext: protocolAprChangeContext.status,
  economicGraphObservation: protocolAprChangeContext.provenance.observationId,
  executionAuthority: state.authority.executionAuthority,
  causalClaimAuthority: state.authority.causalClaimAuthority
});
