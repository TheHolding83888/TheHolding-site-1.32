#!/usr/bin/env node
/**
 * THE HOLDING · STABLE COMPANIES INDEX BRIDGE v0.1
 *
 * Converts the detailed Stable Capital Intelligence artifacts into a compact,
 * UI-facing index/passport dataset.
 *
 * Stable companies are intentionally a separate measurement universe.
 * They do not enter the general Company Composite Index.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const STABLE_FILE = process.env.STABLE_CAPITAL_DATA_FILE
  || path.join(ROOT, 'companies', 'stable-capital-data.json');
const LEDGER_FILE = process.env.EMBEDDED_YIELD_LEDGER_FILE
  || path.join(ROOT, 'companies', 'embedded-yield-ledger.json');
const OUT_FILE = process.env.STABLE_INDEX_DATA_FILE
  || path.join(ROOT, 'companies', 'stable-index-data.json');

const VERSION = '0.1-stable-companies-index';
const METHODOLOGY_VERSION = '0.1-separate-stable-universe';

const finite = x => x !== null && x !== undefined && x !== '' && typeof x !== 'boolean' && Number.isFinite(Number(x));
const round = (x,d=8) => finite(x) ? Number(Number(x).toFixed(d)) : null;
const sum = xs => xs.reduce((a,b)=>a+Number(b||0),0);

function protocolFamily(name) {
  const x = String(name || '');
  if (/^Aave\b/i.test(x)) return 'Aave';
  if (/^Frax\b/i.test(x)) return 'Frax';
  if (/^Lido\b/i.test(x)) return 'Lido';
  if (/^Liquity\b/i.test(x)) return 'Liquity';
  if (/^Yearn\b/i.test(x)) return 'Yearn';
  return x;
}

function latestFullObservation(data) {
  const rows = Array.isArray(data?.history) ? data.history : [];
  for (let i=rows.length-1;i>=0;i--) {
    const r=rows[i];
    if (Number(r?.coverage) >= 0.999999 && finite(r?.referenceApyPct)) return r;
  }
  return null;
}

function aggregateBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r) || 'Other';
    const prev = map.get(k) || { label:k, valueUsd:0, positionCount:0 };
    prev.valueUsd += Number(r.valueUsd || 0);
    prev.positionCount += 1;
    map.set(k, prev);
  }
  const total = sum([...map.values()].map(x=>x.valueUsd));
  return [...map.values()]
    .map(x=>({
      ...x,
      valueUsd: round(x.valueUsd, 6),
      share: total > 0 ? round(x.valueUsd/total, 8) : 0
    }))
    .sort((a,b)=>b.valueUsd-a.valueUsd);
}

async function main() {
  const [stableText, ledgerText] = await Promise.all([
    fs.readFile(STABLE_FILE,'utf8'),
    fs.readFile(LEDGER_FILE,'utf8')
  ]);
  const stable = JSON.parse(stableText);
  const ledger = JSON.parse(ledgerText);

  if (stable?.company?.registry !== '008' || stable?.company?.name !== 'Monetra.eth') {
    throw new Error('Stable Index bridge expects Registry #008 Monetra.eth');
  }
  if (ledger?.company?.registry !== '008' || ledger?.company?.name !== 'Monetra.eth') {
    throw new Error('Embedded Yield Ledger identity mismatch');
  }
  if (!Array.isArray(stable.positions) || stable.positions.length !== 10) {
    throw new Error(`Expected 10 Monetra Stable Capital positions, got ${stable.positions?.length}`);
  }

  const lastFull = latestFullObservation(stable);
  const currentFull = stable.summary?.fullCoverage === true
    && Number(stable.summary?.coverage) >= 0.999999
    && finite(stable.summary?.referenceApyPct);

  const displayApy = currentFull
    ? Number(stable.summary.referenceApyPct)
    : (finite(lastFull?.referenceApyPct) ? Number(lastFull.referenceApyPct) : null);

  const claimables = Array.isArray(ledger.accruedClaimable) ? ledger.accruedClaimable : [];
  const claimableUsd = sum(claimables.map(x=>finite(x.usdValue)?Number(x.usdValue):0));

  const ledgerPositions = ledger.positions || {};
  const embeddedEligible = Object.values(ledgerPositions).filter(x=>x?.accounting?.embeddedYieldEligible === true);
  const embeddedComparable = embeddedEligible.filter(x=>x?.accounting?.currentComparable === true);

  const positions = stable.positions.map(p => {
    const lp = ledgerPositions[p.id] || null;
    return {
      id: p.id,
      protocol: p.protocol,
      protocolFamily: protocolFamily(p.protocol),
      chain: p.chain,
      positionType: p.positionType,
      asset: p.wrapperSymbol || p.underlyingSymbol || p.currentSnapshot?.terminalSymbol || 'Stable',
      wrapperSymbol: p.wrapperSymbol || null,
      underlyingSymbol: p.underlyingSymbol || null,
      terminalSymbol: p.currentSnapshot?.terminalSymbol || null,
      incomeMode: p.incomeMode,
      valueUsd: round(p.valueUsd,8),
      referenceApyPct: finite(p.reference?.annualYieldPct) ? round(p.reference.annualYieldPct,6) : null,
      referenceStatus: p.reference?.status || 'missing',
      referenceRateType: p.reference?.rawRateType || p.reference?.normalizedRateType || null,
      referenceSourceType: p.reference?.sourceType || null,
      valuationCanonical: p.currentSnapshot?.valuationCanonical === true,
      embeddedYieldEligible: lp?.accounting?.embeddedYieldEligible === true,
      embeddedYieldComparable: lp?.accounting?.currentComparable === true,
      latestIntervalStatus: lp?.latestInterval?.status || null,
      methodologyNote: p.reference?.methodology || p.reference?.note || p.currentSnapshot?.note || null
    };
  });

  const protocols = [...new Set(positions.map(p=>p.protocolFamily).filter(Boolean))].sort();
  const chains = [...new Set(positions.map(p=>p.chain).filter(Boolean))].sort();

  const company = {
    registry: '008',
    name: 'Monetra.eth',
    category: 'Stable Capital',
    wallet: stable.company.wallet,
    foundedAt: stable.company.foundedAt,
    foundedDate: stable.company.foundedDate,
    stableCapitalUsd: round(stable.summary.stableCapitalUsd,6),
    productiveStableCapitalUsd: round(stable.summary.productiveStableCapitalUsd,6),
    currentCoverage: round(stable.summary.coverage,8),
    currentFullCoverage: currentFull,
    currentReferenceApyPct: currentFull ? round(stable.summary.referenceApyPct,6) : null,
    displayReferenceApyPct: round(displayApy,6),
    referenceApyStatus: currentFull ? 'current-full-coverage' : (displayApy!=null ? 'last-full-coverage' : 'warming'),
    lastFullCoverageObservation: lastFull,
    strategyCount: positions.length,
    protocolCount: protocols.length,
    protocols,
    chainCount: chains.length,
    chains,
    accruedClaimableUsd: round(claimableUsd,8),
    accruedClaimable: claimables.map(x=>({
      protocol:x.protocol,
      symbol:x.symbol,
      amount:round(x.amount,12),
      usdValue:round(x.usdValue,8),
      classification:x.classification || 'accrued-claimable',
      source:x.source || null,
      snapshotAt:x.snapshotAt || ledger.generatedAt
    })),
    embeddedYield: {
      status: ledger.aggregate?.status || 'warming',
      trackingStartedAt: ledger.trackingStartedAt || null,
      mtdUsd: finite(ledger.aggregate?.embeddedIncomeMtdUsd) ? round(ledger.aggregate.embeddedIncomeMtdUsd,8) : null,
      qtdUsd: finite(ledger.aggregate?.embeddedIncomeQtdUsd) ? round(ledger.aggregate.embeddedIncomeQtdUsd,8) : null,
      ytdUsd: finite(ledger.aggregate?.embeddedIncomeYtdUsd) ? round(ledger.aggregate.embeddedIncomeYtdUsd,8) : null,
      sinceTrackingUsd: finite(ledger.aggregate?.embeddedIncomeSinceTrackingUsd) ? round(ledger.aggregate.embeddedIncomeSinceTrackingUsd,8) : null,
      stablePriceEffectSinceTrackingUsd: finite(ledger.aggregate?.stablePriceEffectSinceTrackingUsd)
        ? round(ledger.aggregate.stablePriceEffectSinceTrackingUsd,8) : null,
      eligiblePositionCount: embeddedEligible.length,
      comparablePositionCount: embeddedComparable.length,
      note: ledger.aggregate?.note || null
    },
    allocation: {
      byChain: aggregateBy(positions, p=>p.chain),
      byStrategyType: aggregateBy(positions, p=>p.positionType)
    },
    positions
  };

  const out = {
    version: VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    generatedAt: new Date().toISOString(),
    source: {
      stableCapitalVersion: stable.version,
      stableCapitalMethodologyVersion: stable.methodologyVersion,
      stableCapitalGeneratedAt: stable.generatedAt,
      ledgerVersion: ledger.version,
      ledgerGeneratedAt: ledger.generatedAt
    },
    universe: {
      id: 'stable-companies',
      name: 'The Holding Stable Companies Index',
      category: 'Stable Capital',
      separateFromGeneralComposite: true,
      separationPolicy: 'Stable-only companies are measured in a dedicated universe and do not compete in the general Composite Index against companies whose objectives include volatile assets, reserve assets, long-lock governance positions or mixed capital structures.',
      currentScoringPolicy: 'Descriptive measurement first. Stable Capital, Reference APY, Embedded Yield, Accrued Claimable Rewards and operating history are tracked directly; no synthetic Stable Composite score is invented before sufficient multi-company history exists.'
    },
    methodology: {
      stableCapital: 'Current USD economic value of stable-only strategy principal. Gas assets are excluded.',
      referenceApy: 'Capital-weighted normalized current annualized productive capacity across the company stable strategy book. It is not realised return.',
      embeddedYield: 'Flow-adjusted growth already capitalized inside lending, savings or vault positions. The ledger starts from verified checkpoints and does not backfill income from current APY.',
      claimableRewards: 'Protocol-side value earned and separately claimable. It is not merged with principal or Embedded Yield.',
      stablePriceEffect: 'Stablecoin/depeg price movement is measured separately from strategy income where comparable checkpoints exist.'
    },
    summary: {
      companyCount: 1,
      stableCapitalUsd: company.stableCapitalUsd,
      productiveStableCapitalUsd: company.productiveStableCapitalUsd,
      capitalWeightedReferenceApyPct: company.displayReferenceApyPct,
      referenceApyStatus: company.referenceApyStatus,
      currentFullCoverage: company.currentFullCoverage,
      accruedClaimableUsd: company.accruedClaimableUsd,
      embeddedIncomeSinceTrackingUsd: company.embeddedYield.sinceTrackingUsd,
      strategyCount: company.strategyCount,
      protocolCount: company.protocolCount,
      chainCount: company.chainCount,
      firstFullCoverageObservationAt: lastFull?.timestamp || null
    },
    companies: [company]
  };

  await fs.writeFile(OUT_FILE, JSON.stringify(out,null,2)+'\n');
  console.log(JSON.stringify({
    version: out.version,
    companyCount: out.summary.companyCount,
    stableCapitalUsd: out.summary.stableCapitalUsd,
    referenceApyPct: out.summary.capitalWeightedReferenceApyPct,
    referenceApyStatus: out.summary.referenceApyStatus,
    claimableUsd: out.summary.accruedClaimableUsd,
    embeddedComparable: `${company.embeddedYield.comparablePositionCount}/${company.embeddedYield.eligiblePositionCount}`,
    separateFromGeneralComposite: out.universe.separateFromGeneralComposite
  },null,2));
}
main().catch(e=>{ console.error(e); process.exit(1); });
