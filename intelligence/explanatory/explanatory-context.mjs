import fs from 'node:fs';
import crypto from 'node:crypto';

const OUT = 'intelligence/explanatory/explanatory-context.json';
const COMPARATIVE = 'intelligence/comparative/comparative-intelligence.json';
const INCOME = 'intelligence/income-performance/income-performance.json';
const ECONOMIC_GRAPH = 'intelligence/economic-graph/economic-graph.json';
const FXN_COHORT_ID = 'defitea-fxn-vefxn';
const CURVE_COHORT_ID = 'defitea-curve-vecrv';
const APR_PARITY_TOLERANCE_PCT_POINTS = 0.01;

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
function requireCohort(graph, id) {
  const cohort = graph?.cohorts?.[id];
  if (!cohort?.latest?.observation || !cohort?.latest?.movement) {
    throw new Error(`Economic Graph cohort unavailable: ${id}`);
  }
  return cohort;
}

const comparative = readJson(COMPARATIVE);
const income = readJson(INCOME);
const economicGraph = readJson(ECONOMIC_GRAPH);
const economicGraphSha256 = sha256(ECONOMIC_GRAPH);

if (comparative.version !== '0.1-comparative-intelligence') throw new Error('unexpected Comparative Intelligence version');
if (comparative.engineVersion !== '0.1.1-registry-derived-comparability') throw new Error('Comparative Intelligence registry-derived engine required');
if (income.version !== '0.1-income-performance-intelligence') throw new Error('unexpected Income & Performance version');
if (economicGraph.version !== '0.1-economic-graph') throw new Error('unexpected Economic Graph version');
if (economicGraph.engineVersion !== '0.2-defitea-fxn-curve-multi-cohort') throw new Error('Economic Graph multi-cohort engine required');
if (economicGraph.coverage?.status !== 'partial-two-cohort' || Number(economicGraph.coverage?.cohortCount) !== 2) {
  throw new Error('Economic Graph canonical two-cohort coverage required');
}
if (economicGraph.statusCompatibility?.deprecated !== true || economicGraph.status !== 'partial-first-cohort') {
  throw new Error('Economic Graph legacy compatibility alias changed unexpectedly');
}
if (economicGraph.authority?.readOnly !== true || economicGraph.authority?.executionAuthority !== 'none') throw new Error('Economic Graph authority regression');
if (economicGraph.authority?.causalClaimAuthority !== 'none') throw new Error('Economic Graph causal authority regression');

const capitalScale = comparative.comparisons?.companyCapitalScale;
const capitalRows = capitalScale?.rows || [];
const general = comparative.comparisons?.generalCompanyReferenceProductivity;
const aprRows = general?.byReferenceApr || [];
const outputRows = general?.byAnnualizedReferenceOutput || [];
const productiveRows = general?.byProductiveCapital || [];
const monetra = comparative.comparisons?.monetraLatestMeasuredIncomeContribution;
const monetraRows = monetra?.rows || [];

const capitalEligibleCount = Number(capitalScale?.eligibleCount);
const generalEligibleCount = Number(general?.eligibleCount);
const monetraEligibleCount = Number(monetra?.eligibleCount);
if (
  !Number.isInteger(capitalEligibleCount) || capitalEligibleCount < 1 ||
  !Number.isInteger(generalEligibleCount) || generalEligibleCount < 1 ||
  !Number.isInteger(monetraEligibleCount) || monetraEligibleCount < 1 ||
  capitalRows.length !== capitalEligibleCount ||
  aprRows.length !== generalEligibleCount ||
  outputRows.length !== generalEligibleCount ||
  productiveRows.length !== generalEligibleCount ||
  monetraRows.length !== monetraEligibleCount
) {
  throw new Error('required comparative universes unavailable');
}

const topApr = aprRows[0];
const topOutput = outputRows[0];
const topProductiveCapital = productiveRows[0];
const largestCompany = capitalRows[0];
const monetraLatest = income.embeddedYield?.latestMeasuredInterval;

const fxnCohort = requireCohort(economicGraph, FXN_COHORT_ID);
const curveCohort = requireCohort(economicGraph, CURVE_COHORT_ID);
const fxnObservation = fxnCohort.latest.observation;
const fxnMovement = fxnCohort.latest.movement;
const curveObservation = curveCohort.latest.observation;
const curveMovement = curveCohort.latest.movement;

if (fxnObservation.company?.registry !== '004' || fxnObservation.protocol !== 'f(x)' || fxnObservation.mechanism !== 'veFXN Locker') {
  throw new Error('Unexpected veFXN cohort identity');
}
const fxnLiveApr = requireFinite(fxnObservation.liveObservedAprPct, 'veFXN live APR');
const fxnCanonicalApr = requireFinite(fxnObservation.canonicalProductivityAprPct, 'veFXN canonical APR');
const fxnParityDelta = requireFinite(fxnObservation.aprParityDeltaPctPoints, 'veFXN APR parity delta');
if (Math.abs(fxnParityDelta) > APR_PARITY_TOLERANCE_PCT_POINTS || Math.abs(fxnLiveApr - fxnCanonicalApr) > APR_PARITY_TOLERANCE_PCT_POINTS) {
  throw new Error('veFXN APR parity failed');
}
if (fxnObservation.epistemic?.causalAttribution !== 'unresolved' || fxnObservation.epistemic?.primaryDriver !== null) {
  throw new Error('veFXN causal boundary must remain unresolved');
}

if (curveObservation.company?.registry !== '004' || curveObservation.protocol !== 'Curve' || curveObservation.mechanism !== 'veCRV Fee Distributor') {
  throw new Error('Unexpected Curve veCRV cohort identity');
}
const curveCanonicalApr = requireFinite(curveObservation.canonicalProductivityAprPct, 'Curve canonical APR');
const curveReproducedApr = requireFinite(curveObservation.formulaReproducedAprPct, 'Curve reproduced APR');
const curveParityDelta = requireFinite(curveObservation.formulaParityDeltaPctPoints, 'Curve formula parity delta');
if (Math.abs(curveParityDelta) > APR_PARITY_TOLERANCE_PCT_POINTS || Math.abs(curveCanonicalApr - curveReproducedApr) > APR_PARITY_TOLERANCE_PCT_POINTS) {
  throw new Error('Curve veCRV formula parity failed');
}
if (curveObservation.formula?.status !== 'proven-canonical-collector-identity') throw new Error('Curve canonical formula proof missing');
if (curveObservation.epistemic?.mechanicalAttribution !== 'proven-within-apr-formula') throw new Error('Curve mechanical attribution proof missing');
if (curveObservation.epistemic?.causalAttribution !== 'unresolved-beyond-formula' || curveObservation.epistemic?.primaryDriver !== null) {
  throw new Error('Curve upstream causal boundary weakened');
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

const fxnContext = {
  question: 'What measured protocol-economic context is available around the current veFXN Reference APR, and can it prove why APR changed?',
  status: 'context-available-causal-attribution-unresolved',
  coverage: {
    cohortId: FXN_COHORT_ID,
    cohort: 'Defitea -> f(x) veFXN',
    companyRegistry: fxnObservation.company.registry,
    company: fxnObservation.company.name,
    protocol: fxnObservation.protocol,
    mechanism: fxnObservation.mechanism,
    asset: fxnObservation.asset
  },
  apr: {
    liveObservedPct: fxnLiveApr,
    canonicalProductivityPct: fxnCanonicalApr,
    parityDeltaPctPoints: fxnParityDelta,
    currentObservationStatus: fxnObservation.canonicalProductivityStatus,
    deltaFromPriorGraphObservationPctPoints: fxnMovement.aprDeltaPctPoints ?? null
  },
  measuredDrivers: {
    fxnLocked: fxnObservation.drivers?.fxnLocked ?? null,
    fxnCirculatingSupplyLockedPct: fxnObservation.drivers?.fxnCirculatingSupplyLockedPct ?? null,
    totalVeFxn: fxnObservation.drivers?.totalVeFxn ?? null,
    cumulativeThisWeekWsteth: fxnObservation.drivers?.cumulativeThisWeekWsteth ?? null,
    previousWeekWsteth: fxnObservation.drivers?.previousWeekWsteth ?? null,
    averageLockRaw: fxnObservation.drivers?.averageLockRaw ?? null,
    accumulateTillRaw: fxnObservation.drivers?.accumulateTillRaw ?? null
  },
  measuredMovement: {
    priorObservationId: fxnMovement.priorObservationId ?? null,
    elapsedHours: fxnMovement.elapsedHours ?? null,
    fxnLockedDelta: fxnMovement.fxnLockedDelta ?? null,
    fxnCirculatingSupplyLockedPctDeltaPoints: fxnMovement.fxnCirculatingSupplyLockedPctDeltaPoints ?? null,
    totalVeFxnDelta: fxnMovement.totalVeFxnDelta ?? null,
    currentWeekRevenueDeltaWsteth: fxnMovement.currentWeekRevenueDeltaWsteth ?? null,
    revenueDeltaComparable: fxnMovement.revenueDeltaComparable ?? null,
    revenueDeltaNonComparableReason: fxnMovement.revenueDeltaNonComparableReason ?? null
  },
  provenance: {
    graphFile: ECONOMIC_GRAPH,
    graphSha256: economicGraphSha256,
    observationId: fxnObservation.id,
    observedAt: fxnObservation.observedAt,
    sourceUrl: fxnObservation.source?.url ?? null,
    sourceType: fxnObservation.source?.sourceType ?? null,
    rawBlockHash: fxnObservation.source?.rawBlockHash ?? null
  },
  causalAttribution: 'unresolved',
  primaryDriver: null,
  causalClass: 'measured-context-only',
  explanation: 'Canonical protocol-economic driver context is available for the Defitea veFXN cohort. The system may report these measured values and comparable deltas, but it must not say that revenue, locked supply, Total veFXN, price, incentives or another driver caused the APR until a protocol-specific formula or onchain accounting identity proves that path.',
  promotionRule: economicGraph.semantics?.driverPromotionRule ?? 'Require a protocol-specific formula or onchain accounting identity before causal attribution.'
};

const curveContext = {
  question: 'How is the current Curve veCRV Reference APR mechanically formed, and do we know why its upstream fee inputs changed?',
  status: 'mechanics-proven-upstream-cause-unresolved',
  coverage: {
    cohortId: CURVE_COHORT_ID,
    cohort: 'Defitea -> Curve veCRV Fee Distributor',
    companyRegistry: curveObservation.company.registry,
    company: curveObservation.company.name,
    protocol: curveObservation.protocol,
    mechanism: curveObservation.mechanism,
    asset: curveObservation.asset
  },
  apr: {
    canonicalProductivityPct: curveCanonicalApr,
    formulaReproducedPct: curveReproducedApr,
    formulaParityDeltaPctPoints: curveParityDelta,
    currentObservationStatus: curveObservation.canonicalProductivityStatus,
    deltaFromPriorGraphObservationPctPoints: curveMovement.aprDeltaPctPoints ?? null
  },
  measuredDrivers: {
    crvPriceUsd: curveObservation.drivers?.crvPriceUsd ?? null,
    rollingFourWeekFeesCrvUSD: curveObservation.drivers?.rollingFourWeekFeesCrvUSD ?? null,
    rollingAverageVeSupply: curveObservation.drivers?.rollingAverageVeSupply ?? null,
    rollingAverageAprPct: curveObservation.drivers?.rollingAverageAprPct ?? null,
    weeksUsed: curveObservation.drivers?.weeksUsed ?? null,
    rollingWindowStart: curveObservation.drivers?.rollingWindowStart ?? null,
    rollingWindowEnd: curveObservation.drivers?.rollingWindowEnd ?? null,
    latestCompletedWeek: curveObservation.drivers?.latestCompletedWeek ?? null
  },
  measuredMovement: {
    priorObservationId: curveMovement.priorObservationId ?? null,
    elapsedHours: curveMovement.elapsedHours ?? null,
    aprDeltaPctPoints: curveMovement.aprDeltaPctPoints ?? null,
    crvPriceDeltaUsd: curveMovement.crvPriceDeltaUsd ?? null,
    rollingAverageVeSupplyDelta: curveMovement.rollingAverageVeSupplyDelta ?? null,
    rollingFourWeekFeesDeltaCrvUSD: curveMovement.rollingFourWeekFeesDeltaCrvUSD ?? null,
    rollingWindowComparable: curveMovement.rollingWindowComparable ?? null,
    rollingWindowNonComparableReason: curveMovement.rollingWindowNonComparableReason ?? null,
    latestWeekFeesDeltaCrvUSD: curveMovement.latestWeekFeesDeltaCrvUSD ?? null,
    latestWeekVeSupplyDelta: curveMovement.latestWeekVeSupplyDelta ?? null,
    latestWeekAprDeltaPctPoints: curveMovement.latestWeekAprDeltaPctPoints ?? null,
    latestWeekComparable: curveMovement.latestWeekComparable ?? null,
    latestWeekNonComparableReason: curveMovement.latestWeekNonComparableReason ?? null
  },
  mechanics: {
    status: curveObservation.formula.status,
    weeklyIdentity: curveObservation.formula.weeklyIdentity,
    rollingIdentity: curveObservation.formula.rollingIdentity,
    reproducedCanonicalAprPct: curveObservation.formula.reproducedCanonicalAprPct,
    parityDeltaPctPoints: curveObservation.formula.parityDeltaPctPoints,
    mechanicalAttribution: curveObservation.epistemic.mechanicalAttribution,
    provenRelation: curveObservation.epistemic.provenRelation
  },
  provenance: {
    graphFile: ECONOMIC_GRAPH,
    graphSha256: economicGraphSha256,
    observationId: curveObservation.id,
    observedAt: curveObservation.observedAt,
    sourceUrl: curveObservation.source?.url ?? null,
    sourceType: curveObservation.source?.sourceType ?? null,
    sourceMetric: curveObservation.source?.sourceMetric ?? null,
    contract: curveObservation.source?.contract ?? null,
    productivitySha256: curveObservation.source?.productivitySha256 ?? null
  },
  causalAttribution: 'unresolved-beyond-formula',
  primaryDriver: null,
  causalClass: 'proven-mechanical-identity-upstream-cause-unresolved',
  explanation: 'Curve veCRV Reference APR is mechanically reproducible from distributed crvUSD fees, veCRV supply and CRV price under the canonical completed-week formula. This proves how those measured inputs form the Reference APR. It does not prove why Curve fee distributions themselves increased or decreased; upstream protocol activity remains unresolved until fee-origin evidence is added.',
  promotionRule: 'Formula inputs may be described as mechanical APR inputs. Upstream causes of fee changes require separate canonical protocol-activity evidence before causal promotion.'
};

const protocolAprChangeContexts = {
  [FXN_COHORT_ID]: fxnContext,
  [CURVE_COHORT_ID]: curveContext
};

const state = {
  version: '0.2-explanatory-context',
  engineVersion: '0.3-multi-cohort-protocol-economic-context',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  coverage: {
    protocolEconomicCohortCount: 2,
    activeCohortIds: [FXN_COHORT_ID, CURVE_COHORT_ID],
    protocols: ['f(x)', 'Curve'],
    legacyProtocolAprChangeContextAlias: FXN_COHORT_ID,
    nextPlannedCohort: economicGraph.coverage?.nextPlannedCohort ?? 'Defitea -> Aerodrome veAERO'
  },
  purpose: 'Explain proven metric differences through reproducible identities and expose canonical multi-cohort protocol-economic driver context without turning association into causation.',
  semantics: {
    mechanismRule: 'Use causal language only when the relationship follows from an explicit accounting or metric identity, or when a mechanism-specific source proves the causal link.',
    associationRule: 'Observed co-movement, rank order, contextual proximity, or Economic Graph driver movement is association/context only unless a mechanism is proven.',
    noNarrativeGuessing: 'Do not invent market, protocol, governance, volume, fee, incentive, or user-behavior explanations when no canonical source binds them.',
    aprRule: 'Reference APR is productive capacity, not realised return.',
    rankingRule: 'A rank is explained by the metric definition and its measured inputs, not by a universal quality score.',
    economicGraphRule: 'Economic Graph observations may answer what changed around a protocol mechanism; causal claims stop at the strongest proven mechanical identity and do not leap to unresolved upstream causes.',
    multiCohortRule: 'Canonical protocol-economic context lives under explanations.protocolAprChangeContexts. explanations.protocolAprChangeContext remains a deprecated veFXN compatibility alias until downstream consumers migrate.'
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
      legacyStatus: economicGraph.status,
      coverageStatus: economicGraph.coverage.status,
      cohortCount: economicGraph.coverage.cohortCount,
      sha256: economicGraphSha256
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
    protocolAprChangeContexts,
    protocolAprChangeContext: fxnContext
  },
  answerability: {
    'why-top-apr-differs-from-top-output': 'answerable',
    'why-largest-company-is-not-best-apr': 'answerable-by-separate-metric-definitions',
    'what-drove-monetra-latest-measured-income': 'answerable-latest-interval-only',
    'why-monetra-strategy-performance-differs-from-net-pnl': 'answerable-by-reconciliation-identity',
    'what-protocol-context-accompanied-apr': 'answerable-by-measured-context-first-cohort',
    'what-protocol-contexts-accompanied-apr': 'answerable-by-canonical-multi-cohort-context',
    'how-curve-vecrv-reference-apr-is-formed': 'answerable-by-proven-mechanical-identity',
    'why-protocol-apr-changed': 'context-available-cause-unresolved',
    'why-curve-fee-distributions-changed': 'blocked-no-upstream-fee-origin-evidence',
    'why-company-tvl-changed': 'blocked-no-time-series-driver-decomposition',
    'why-market-moved': 'blocked-no-market-causal-evidence',
    'mtd-monetra-protocol-driver-attribution': 'blocked-no-canonical-interval-history',
    'best-company-overall-explanation': 'blocked-no-universal-score'
  },
  answerabilityByCohort: {
    [FXN_COHORT_ID]: {
      measuredContext: 'answerable',
      mechanicalAprFormation: 'blocked-no-canonical-formula-identity',
      upstreamCause: 'unresolved'
    },
    [CURVE_COHORT_ID]: {
      measuredContext: 'answerable',
      mechanicalAprFormation: 'answerable-by-proven-canonical-formula',
      upstreamCause: 'unresolved-fee-origin'
    }
  },
  nextEvidenceGaps: [
    {
      id: 'fxn-protocol-driver-causal-attribution',
      need: 'Protocol-specific veFXN APR formula or onchain accounting identity that reproduces APR from canonical driver inputs before promoting any observed veFXN driver to ATTRIBUTED.',
      rule: 'Measured f(x) context may be reported now; causal language remains blocked until the mechanism is proven.'
    },
    {
      id: 'curve-upstream-fee-origin',
      need: 'Canonical Curve protocol revenue / fee-origin evidence tied to Fee Distributor inflows before explaining why distributed crvUSD fees changed.',
      rule: 'The proven APR formula explains mechanics, not the upstream economic origin of fee changes.'
    },
    {
      id: 'economic-graph-cohort-expansion',
      need: 'Add the next bounded protocol-economic cohort, currently Defitea -> Aerodrome veAERO, with its own authority, cadence, units and causal boundary.'
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

console.log('Explanatory Context v0.3 built', {
  topApr: topApr.name,
  topOutput: topOutput.name,
  outputGapUsd,
  topMonetraContributor: topMonetra?.protocol,
  monetraNetPnlReproduced: reproducedNetPnl,
  protocolEconomicCohorts: state.coverage.protocolEconomicCohortCount,
  fxnStatus: fxnContext.status,
  curveStatus: curveContext.status,
  curveFormulaParityDeltaPctPoints: curveContext.apr.formulaParityDeltaPctPoints,
  executionAuthority: state.authority.executionAuthority,
  causalClaimAuthority: state.authority.causalClaimAuthority
});