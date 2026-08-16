import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/income-performance/income-performance.json');
const LEDGER = 'companies/embedded-yield-ledger.json';
const STABLE_INDEX = 'companies/stable-index-data.json';
const REALISED = 'intelligence/realised-cash-flow/realised-cash-flow.json';

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
function sum(values) {
  return values.reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0);
}
function monthKey(ts) {
  return typeof ts === 'string' && ts.length >= 7 ? ts.slice(0, 7) : null;
}

const ledger = readJson(LEDGER);
const stableIndex = readJson(STABLE_INDEX);
const realised = readJson(REALISED);

if (ledger.version !== '0.4-flow-aware-recurring-checkpoints') throw new Error(`unexpected Embedded Yield Ledger ${ledger.version}`);
if (stableIndex.version !== '0.2-stable-companies-index-strategy-performance') throw new Error(`unexpected Stable Index ${stableIndex.version}`);
if (realised.version !== '0.2.3-yield-basis-live-realised-cash-flow-resilient-logs') throw new Error(`unexpected Realised Cash Flow ${realised.version}`);
if (ledger.company?.registry !== '008' || ledger.company?.name !== 'Monetra.eth') throw new Error('Embedded Yield company mismatch');

const monetra = (stableIndex.companies || []).find(c => c.registry === '008');
if (!monetra || monetra.name !== 'Monetra.eth') throw new Error('Monetra missing from Stable Index');
if (monetra.performance?.status !== 'verified-since-inception') throw new Error('Monetra Performance is not verified');

const positionRows = [];
for (const [positionId, p] of Object.entries(ledger.positions || {})) {
  const checkpoints = Array.isArray(p.checkpoints) ? p.checkpoints : [];
  const comparable = checkpoints.filter(c => c.ledgerComparable === true && c.valuationCanonical === true);
  const latestInterval = p.latestInterval || {};
  const latestCp = checkpoints.at(-1) || null;
  const latestMonth = monthKey(latestCp?.timestamp || ledger.generatedAt);

  let mtdIncomeUsd = 0;
  let mtdStablePriceEffectUsd = 0;
  let mtdIntervalCount = 0;
  let previous = null;

  for (const cp of comparable) {
    if (!previous) {
      previous = cp;
      continue;
    }
    if (monthKey(cp.timestamp) === latestMonth && previous.flowFingerprint === cp.flowFingerprint &&
        Number.isFinite(Number(previous.underlyingAmount)) && Number.isFinite(Number(cp.underlyingAmount)) &&
        Number.isFinite(Number(cp.terminalPriceUsd))) {
      const underlyingGrowth = Number(cp.underlyingAmount) - Number(previous.underlyingAmount);
      const incomeUsd = underlyingGrowth * Number(cp.terminalPriceUsd);
      const valueDelta = Number(cp.economicValueUsd) - Number(previous.economicValueUsd);
      const priceEffectUsd = valueDelta - incomeUsd;
      mtdIncomeUsd += incomeUsd;
      mtdStablePriceEffectUsd += priceEffectUsd;
      mtdIntervalCount += 1;
    }
    previous = cp;
  }

  positionRows.push({
    positionId,
    protocol: p.protocol || null,
    chain: p.chain || null,
    positionType: p.positionType || null,
    incomeMode: p.incomeMode || null,
    embeddedYieldEligible: p.accounting?.embeddedYieldEligible === true,
    currentComparable: p.accounting?.currentComparable === true,
    checkpointCount: checkpoints.length,
    comparableCheckpointCount: comparable.length,
    latestCheckpointAt: latestCp?.timestamp || null,
    latestInterval: {
      status: latestInterval.status || 'unknown',
      incomeUsd: round(latestInterval.incomeUsd),
      stablePriceEffectUsd: round(latestInterval.stablePriceEffectUsd),
      exactCalendarDay: false,
      semanticWindow: latestInterval.status === 'ok' ? 'latest-measured-checkpoint-interval' : 'not-currently-comparable'
    },
    monthToDate: {
      month: latestMonth,
      status: mtdIntervalCount > 0 ? 'measured-flow-safe-checkpoints' : 'warming-or-not-comparable',
      intervalCount: mtdIntervalCount,
      incomeUsd: mtdIntervalCount > 0 ? round(mtdIncomeUsd) : null,
      stablePriceEffectUsd: mtdIntervalCount > 0 ? round(mtdStablePriceEffectUsd) : null
    }
  });
}

const latestMeasuredPositions = positionRows.filter(p => p.latestInterval.status === 'ok' && Number.isFinite(p.latestInterval.incomeUsd));
const mtdMeasuredPositions = positionRows.filter(p => Number.isFinite(p.monthToDate.incomeUsd));
const latestEmbeddedIncomeUsd = round(sum(latestMeasuredPositions.map(p => p.latestInterval.incomeUsd)));
const latestStablePriceEffectUsd = round(sum(latestMeasuredPositions.map(p => p.latestInterval.stablePriceEffectUsd)));
const mtdAttributedIncomeUsd = round(sum(mtdMeasuredPositions.map(p => p.monthToDate.incomeUsd)));
const mtdAttributedStablePriceEffectUsd = round(sum(mtdMeasuredPositions.map(p => p.monthToDate.stablePriceEffectUsd)));

const byProtocol = new Map();
for (const p of mtdMeasuredPositions) {
  const key = p.protocol || 'Unknown';
  const row = byProtocol.get(key) || { protocol: key, incomeUsd: 0, stablePriceEffectUsd: 0, positionCount: 0 };
  row.incomeUsd += Number(p.monthToDate.incomeUsd || 0);
  row.stablePriceEffectUsd += Number(p.monthToDate.stablePriceEffectUsd || 0);
  row.positionCount += 1;
  byProtocol.set(key, row);
}
const protocolAttribution = [...byProtocol.values()]
  .map(r => ({ ...r, incomeUsd: round(r.incomeUsd), stablePriceEffectUsd: round(r.stablePriceEffectUsd) }))
  .sort((a, b) => b.incomeUsd - a.incomeUsd);

const ledgerMtd = Number(ledger.aggregate?.embeddedIncomeMtdUsd);
if (!Number.isFinite(ledgerMtd)) throw new Error('ledger MTD aggregate unavailable');
if (Math.abs(ledgerMtd - mtdAttributedIncomeUsd) > 0.00002) {
  throw new Error(`MTD attribution drift: ledger=${ledgerMtd} compiled=${mtdAttributedIncomeUsd}`);
}

const claimableUsd = Number(monetra.accruedClaimableUsd);
const realisedCompany = realised.companies?.['Monetra.eth'] || null;
const realisedCoverage = realisedCompany?.ledger?.coverage || null;

const output = {
  version: '0.1-income-performance-intelligence',
  engineVersion: '0.1-monetra-evidence-family-compiler',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  scope: 'First bounded Income & Performance Intelligence slice for Monetra.eth. Compiles proven economic evidence families without collapsing them into a generic income number.',
  company: {
    registry: '008',
    name: 'Monetra.eth'
  },
  semantics: {
    embeddedYield: 'Flow-safe growth already capitalized inside strategy positions. It is not claimable rewards, realised cash flow, reference APY, or stable-price movement.',
    accruedClaimable: 'Earned protocol-side value that remains separately claimable. It is not realised cash flow and is not added to Embedded Yield.',
    realisedCashFlow: 'Accepted realised income events only under mechanism-specific proof. Incomplete coverage never becomes zero.',
    strategyPerformance: 'Verified entry principal versus same-run nominal stable strategy value.',
    netMarketPnl: 'Invested versus current USD capital including current market/stable-price effects under the Stable Index reconciliation.',
    referenceProductivity: 'Current annualized productive capacity. It is not earned return.',
    todayPolicy: 'Do not label latest measured interval as calendar-day income unless its boundaries exactly match a calendar day. Expose exact interval timestamps/status instead.',
    noCollapseRule: 'Do not sum Embedded Yield + Accrued Claimable + Realised Cash Flow + Strategy Performance + Net Market P&L into one income number because these families overlap or answer different economic questions.'
  },
  sourceState: {
    embeddedYieldLedger: { file: LEDGER, version: ledger.version, generatedAt: ledger.generatedAt, sha256: sha256File(LEDGER) },
    stableIndex: { file: STABLE_INDEX, version: stableIndex.version, generatedAt: stableIndex.generatedAt, sha256: sha256File(STABLE_INDEX) },
    realisedCashFlow: { file: REALISED, version: realised.version, generatedAt: realised.generatedAt, sha256: sha256File(REALISED), overallCoverageComplete: realised.methodology?.overallCoverageComplete === true }
  },
  current: {
    currentCapitalUsd: round(monetra.currentCapitalUsd),
    investedUsd: round(monetra.investedUsd),
    referenceApyPct: round(monetra.displayReferenceApyPct, 6),
    referenceApyStatus: monetra.referenceApyStatus || null,
    accruedClaimableUsd: Number.isFinite(claimableUsd) ? round(claimableUsd) : null
  },
  embeddedYield: {
    trackingStartedAt: ledger.trackingStartedAt,
    latestMeasuredInterval: {
      status: latestMeasuredPositions.length > 0 ? 'measured-partial-position-coverage' : 'unavailable',
      measuredPositionCount: latestMeasuredPositions.length,
      totalPositionCount: positionRows.length,
      incomeUsd: latestMeasuredPositions.length > 0 ? latestEmbeddedIncomeUsd : null,
      stablePriceEffectUsd: latestMeasuredPositions.length > 0 ? latestStablePriceEffectUsd : null,
      exactCalendarDay: false,
      label: 'latest measured checkpoint interval, not calendar-day income'
    },
    monthToDate: {
      status: 'measured-flow-safe-subset',
      incomeUsd: round(ledger.aggregate.embeddedIncomeMtdUsd),
      independentlyAttributedIncomeUsd: mtdAttributedIncomeUsd,
      attributionReconciled: true,
      stablePriceEffectUsd: mtdAttributedStablePriceEffectUsd,
      measuredPositionCount: mtdMeasuredPositions.length,
      totalPositionCount: positionRows.length,
      byProtocol: protocolAttribution
    },
    quarterToDateUsd: round(ledger.aggregate.embeddedIncomeQtdUsd),
    yearToDateUsd: round(ledger.aggregate.embeddedIncomeYtdUsd),
    sinceTrackingUsd: round(ledger.aggregate.embeddedIncomeSinceTrackingUsd),
    stablePriceEffectSinceTrackingUsd: round(ledger.aggregate.stablePriceEffectSinceTrackingUsd)
  },
  accruedRewards: {
    status: Number.isFinite(claimableUsd) ? 'measured-current-claimable' : 'unknown',
    currentClaimableUsd: Number.isFinite(claimableUsd) ? round(claimableUsd) : null,
    items: (monetra.accruedClaimable || []).map(x => ({
      protocol: x.protocol || null,
      symbol: x.symbol || null,
      amount: round(x.amount, 12),
      usdValue: round(x.usdValue),
      snapshotAt: x.snapshotAt || null
    }))
  },
  realisedCashFlow: {
    status: realised.status || 'unknown',
    overallCoverageComplete: realised.methodology?.overallCoverageComplete === true,
    companyLanePresent: Boolean(realisedCompany),
    companyCoverageComplete: realisedCoverage?.complete === true,
    usd: realisedCompany?.ledger?.summary && Number.isFinite(Number(realisedCompany.ledger.summary.realisedCashFlowUsd)) && realisedCoverage?.complete === true
      ? round(realisedCompany.ledger.summary.realisedCashFlowUsd)
      : null,
    interpretation: realisedCompany
      ? 'A mechanism-specific lane may be measured, but overall company Realised Cash Flow remains incomplete unless companyCoverageComplete=true.'
      : 'No Monetra-specific realised-cash-flow lane is currently present; do not infer zero.'
  },
  performance: {
    strategy: {
      status: monetra.performance.status,
      sinceInceptionUsd: round(monetra.performance.sinceInceptionUsd),
      sinceInceptionPct: round(monetra.performance.sinceInceptionPct, 6),
      basis: monetra.performance.basis,
      asOf: monetra.performance.asOf,
      entryAsOf: monetra.performance.entryAsOf
    },
    netMarketPnl: {
      usd: round(monetra.performance.netMarketPnlUsd),
      pct: round(monetra.performance.netMarketPnlPct, 6),
      stablePriceEffectUsd: round(monetra.performance.stablePriceEffectUsd),
      reconciliationIdentity: monetra.performance.reconciliationIdentity
    }
  },
  positions: positionRows,
  answerability: {
    'monetra-current-capital': 'answerable',
    'monetra-current-claimable-rewards': Number.isFinite(claimableUsd) ? 'answerable' : 'blocked',
    'monetra-latest-measured-embedded-income': latestMeasuredPositions.length > 0 ? 'answerable-with-interval-label' : 'blocked',
    'monetra-calendar-day-income-today': 'blocked-no-exact-calendar-day-boundary',
    'monetra-month-to-date-embedded-income': 'answerable-with-flow-safe-coverage-disclosure',
    'monetra-month-to-date-protocol-attribution': protocolAttribution.length > 0 ? 'answerable-with-flow-safe-coverage-disclosure' : 'blocked',
    'monetra-since-inception-strategy-performance': 'answerable',
    'monetra-net-market-pnl': 'answerable',
    'monetra-overall-realised-cash-flow': realisedCoverage?.complete === true ? 'answerable' : 'blocked-incomplete-coverage'
  },
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    claimingAuthority: false,
    allocationAuthority: false,
    methodologyMutationAuthority: false
  }
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
console.log('Income & Performance Intelligence v0.1 built', {
  mtdEmbeddedIncomeUsd: output.embeddedYield.monthToDate.incomeUsd,
  latestMeasuredIncomeUsd: output.embeddedYield.latestMeasuredInterval.incomeUsd,
  protocolCount: output.embeddedYield.monthToDate.byProtocol.length,
  strategyPerformanceUsd: output.performance.strategy.sinceInceptionUsd,
  realisedCashFlow: output.realisedCashFlow.status,
  executionAuthority: output.authority.executionAuthority
});
