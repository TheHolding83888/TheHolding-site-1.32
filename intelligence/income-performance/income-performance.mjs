import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/income-performance/income-performance.json');
const LEDGER = 'companies/embedded-yield-ledger.json';
const STABLE_INDEX = 'companies/stable-index-data.json';
const REALISED = 'intelligence/realised-cash-flow/realised-cash-flow.json';

function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function sha256File(rel) { return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
function round(value, digits = 8) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}
function sum(values) { return values.reduce((a, b) => a + (Number.isFinite(Number(b)) ? Number(b) : 0), 0); }

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

const positionRows = Object.entries(ledger.positions || {}).map(([positionId, p]) => {
  const checkpoints = Array.isArray(p.checkpoints) ? p.checkpoints : [];
  const latest = p.latestInterval || {};
  return {
    positionId,
    protocol: p.protocol || null,
    chain: p.chain || null,
    positionType: p.positionType || null,
    incomeMode: p.incomeMode || null,
    embeddedYieldEligible: p.accounting?.embeddedYieldEligible === true,
    currentComparable: p.accounting?.currentComparable === true,
    checkpointCount: checkpoints.length,
    latestCheckpointAt: checkpoints.at(-1)?.timestamp || null,
    latestInterval: {
      status: latest.status || 'unknown',
      incomeUsd: round(latest.incomeUsd),
      stablePriceEffectUsd: round(latest.stablePriceEffectUsd),
      exactCalendarDay: false,
      semanticWindow: latest.status === 'ok' ? 'latest-measured-checkpoint-interval' : 'not-currently-comparable'
    }
  };
});

const latestMeasuredPositions = positionRows.filter(p => p.latestInterval.status === 'ok' && Number.isFinite(p.latestInterval.incomeUsd));
const latestEmbeddedIncomeUsd = round(sum(latestMeasuredPositions.map(p => p.latestInterval.incomeUsd)));
const latestStablePriceEffectUsd = round(sum(latestMeasuredPositions.map(p => p.latestInterval.stablePriceEffectUsd)));

const byProtocol = new Map();
for (const p of latestMeasuredPositions) {
  const key = p.protocol || 'Unknown';
  const row = byProtocol.get(key) || { protocol: key, incomeUsd: 0, stablePriceEffectUsd: 0, positionCount: 0 };
  row.incomeUsd += Number(p.latestInterval.incomeUsd || 0);
  row.stablePriceEffectUsd += Number(p.latestInterval.stablePriceEffectUsd || 0);
  row.positionCount += 1;
  byProtocol.set(key, row);
}
const latestProtocolAttribution = [...byProtocol.values()]
  .map(r => ({ ...r, incomeUsd: round(r.incomeUsd), stablePriceEffectUsd: round(r.stablePriceEffectUsd) }))
  .sort((a, b) => b.incomeUsd - a.incomeUsd);

const sourceMtd = Number(ledger.aggregate?.embeddedIncomeMtdUsd);
if (!Number.isFinite(sourceMtd)) throw new Error('source-labelled MTD aggregate unavailable');
if (Math.abs(sourceMtd - latestEmbeddedIncomeUsd) > 0.00002) {
  throw new Error(`current ledger aggregate contract drift: sourceMtd=${sourceMtd} latestIntervals=${latestEmbeddedIncomeUsd}`);
}

const claimableUsd = Number(monetra.accruedClaimableUsd);
const realisedCompany = realised.companies?.['Monetra.eth'] || null;
const realisedCoverage = realisedCompany?.ledger?.coverage || null;

const output = {
  version: '0.1-income-performance-intelligence',
  engineVersion: '0.1.1-monetra-evidence-family-compiler',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  scope: 'First bounded Income & Performance Intelligence slice for Monetra.eth. Compiles proven evidence families without collapsing them or overclaiming period attribution.',
  company: { registry: '008', name: 'Monetra.eth' },
  semantics: {
    embeddedYield: 'Flow-safe growth already capitalized inside strategy positions. It is not claimable rewards, realised cash flow, reference APY, or stable-price movement.',
    accruedClaimable: 'Earned protocol-side value that remains separately claimable. It is not realised cash flow and is not added to Embedded Yield.',
    realisedCashFlow: 'Accepted realised income events only under mechanism-specific proof. Incomplete coverage never becomes zero.',
    strategyPerformance: 'Verified entry principal versus same-run nominal stable strategy value.',
    netMarketPnl: 'Invested versus current USD capital including current market/stable-price effects under Stable Index reconciliation.',
    referenceProductivity: 'Current annualized productive capacity. It is not earned return.',
    todayPolicy: 'Do not label latest measured interval as calendar-day income unless its boundaries exactly match a calendar day.',
    periodAttributionPolicy: 'The current Embedded Yield Ledger exposes source-labelled MTD/QTD/YTD aggregates but does not preserve a canonical interval-by-interval attribution ledger. Therefore protocol attribution is emitted only for the latest measured interval; MTD protocol attribution remains blocked.',
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
      label: 'latest measured checkpoint interval, not calendar-day income',
      byProtocol: latestProtocolAttribution
    },
    monthToDate: {
      status: 'source-labelled-aggregate-no-canonical-protocol-attribution',
      incomeUsd: round(ledger.aggregate.embeddedIncomeMtdUsd),
      protocolAttributionStatus: 'blocked-no-canonical-interval-history',
      byProtocol: null
    },
    quarterToDate: { status: 'source-labelled-aggregate', incomeUsd: round(ledger.aggregate.embeddedIncomeQtdUsd) },
    yearToDate: { status: 'source-labelled-aggregate', incomeUsd: round(ledger.aggregate.embeddedIncomeYtdUsd) },
    sinceTracking: { status: 'source-labelled-aggregate', incomeUsd: round(ledger.aggregate.embeddedIncomeSinceTrackingUsd) },
    stablePriceEffectSinceTrackingUsd: round(ledger.aggregate.stablePriceEffectSinceTrackingUsd)
  },
  accruedRewards: {
    status: Number.isFinite(claimableUsd) ? 'measured-current-claimable' : 'unknown',
    currentClaimableUsd: Number.isFinite(claimableUsd) ? round(claimableUsd) : null,
    items: (monetra.accruedClaimable || []).map(x => ({ protocol: x.protocol || null, symbol: x.symbol || null, amount: round(x.amount, 12), usdValue: round(x.usdValue), snapshotAt: x.snapshotAt || null }))
  },
  realisedCashFlow: {
    status: realised.status || 'unknown',
    overallCoverageComplete: realised.methodology?.overallCoverageComplete === true,
    companyLanePresent: Boolean(realisedCompany),
    companyCoverageComplete: realisedCoverage?.complete === true,
    usd: realisedCompany?.ledger?.summary && Number.isFinite(Number(realisedCompany.ledger.summary.realisedCashFlowUsd)) && realisedCoverage?.complete === true ? round(realisedCompany.ledger.summary.realisedCashFlowUsd) : null,
    interpretation: realisedCompany ? 'A mechanism-specific lane may be measured, but overall company Realised Cash Flow remains incomplete unless companyCoverageComplete=true.' : 'No Monetra-specific realised-cash-flow lane is currently present; do not infer zero.'
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
    'monetra-latest-measured-embedded-income': latestMeasuredPositions.length > 0 ? 'answerable-with-interval-label-and-protocol-attribution' : 'blocked',
    'monetra-calendar-day-income-today': 'blocked-no-exact-calendar-day-boundary',
    'monetra-month-to-date-embedded-income': 'answerable-source-labelled-aggregate',
    'monetra-month-to-date-protocol-attribution': 'blocked-no-canonical-interval-history',
    'monetra-since-inception-strategy-performance': 'answerable',
    'monetra-net-market-pnl': 'answerable',
    'monetra-overall-realised-cash-flow': realisedCoverage?.complete === true ? 'answerable' : 'blocked-incomplete-coverage'
  },
  gaps: [
    {
      id: 'embedded-yield-canonical-interval-history',
      severity: 'blocking-for-period-attribution',
      affects: ['calendar-day-income', 'mtd-protocol-attribution', 'qtd-protocol-attribution', 'ytd-protocol-attribution'],
      detail: 'Current ledger persists checkpoints and latestInterval but not a canonical interval ledger with historical accepted interval rows. Do not reconstruct official period attribution in this compiler.'
    }
  ],
  authority: { readOnly: true, executionAuthority: 'none', capitalExecution: false, claimingAuthority: false, allocationAuthority: false, methodologyMutationAuthority: false }
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
console.log('Income & Performance Intelligence v0.1 built', {
  sourceMtdEmbeddedIncomeUsd: output.embeddedYield.monthToDate.incomeUsd,
  latestMeasuredIncomeUsd: output.embeddedYield.latestMeasuredInterval.incomeUsd,
  latestProtocolsAttributed: output.embeddedYield.latestMeasuredInterval.byProtocol.length,
  mtdProtocolAttribution: output.answerability['monetra-month-to-date-protocol-attribution'],
  strategyPerformanceUsd: output.performance.strategy.sinceInceptionUsd,
  realisedCashFlow: output.realisedCashFlow.status,
  executionAuthority: output.authority.executionAuthority
});
