#!/usr/bin/env node
/**
 * THE HOLDING · Aerodrome Market Breath Descriptor v0.1
 *
 * Deterministic descriptive overlay on proven Aerodrome epoch accounting.
 * Compares completed epoch vs completed epoch without summing heterogeneous
 * tokens or claiming causes. Directional breadth counts token lanes equally;
 * it is not USD-, capital-, or outcome-weighted and is not a prediction.
 */
import fs from 'node:fs';
import process from 'node:process';

const PULSE_FILE = process.env.AERODROME_PULSE_FILE || 'intelligence/economic-graph/aerodrome-managed-pulse.json';

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function round(value, digits = 8) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}
function classify(prior, previous) {
  const a = Number(prior || 0), b = Number(previous || 0);
  if (a === 0 && b === 0) return 'flat-zero';
  if (a === 0 && b > 0) return 'activated';
  if (a > 0 && b === 0) return 'extinguished';
  if (b > a) return 'increased';
  if (b < a) return 'decreased';
  return 'flat-active';
}
function descriptor(up, down) {
  if (up > down) return 'more-token-lanes-expanding-than-contracting';
  if (down > up) return 'more-token-lanes-contracting-than-expanding';
  return 'balanced-expanding-contracting-token-lanes';
}
function movementRows(comparison = []) {
  return comparison.map(row => ({
    token: row.token,
    symbol: row.symbol,
    priorCompletedAmount: Number(row.priorCompletedAmount || 0),
    previousCompletedAmount: Number(row.previousCompletedAmount || 0),
    deltaAmount: Number(row.deltaAmount || 0),
    deltaPct: row.deltaPct === null || row.deltaPct === undefined ? null : Number(row.deltaPct),
    direction: classify(row.priorCompletedAmount, row.previousCompletedAmount)
  }));
}
function laneDescriptor(lane) {
  const movements = movementRows(lane?.completedEpochComparison || []);
  const counts = {
    activated: 0,
    increased: 0,
    decreased: 0,
    extinguished: 0,
    flatActive: 0,
    flatZero: 0
  };
  for (const row of movements) {
    if (row.direction === 'activated') counts.activated++;
    else if (row.direction === 'increased') counts.increased++;
    else if (row.direction === 'decreased') counts.decreased++;
    else if (row.direction === 'extinguished') counts.extinguished++;
    else if (row.direction === 'flat-active') counts.flatActive++;
    else counts.flatZero++;
  }
  const expanding = counts.activated + counts.increased;
  const contracting = counts.extinguished + counts.decreased;
  const activePrior = movements.filter(x => x.priorCompletedAmount > 0).length;
  const activePrevious = movements.filter(x => x.previousCompletedAmount > 0).length;
  const activePairUniverse = movements.filter(x => x.priorCompletedAmount > 0 || x.previousCompletedAmount > 0).length;
  return {
    tokenUniverseCount: movements.length,
    activePriorCompletedTokenCount: activePrior,
    activePreviousCompletedTokenCount: activePrevious,
    activeTokenBreadthDelta: activePrevious - activePrior,
    activePairUniverseCount: activePairUniverse,
    directionCounts: {
      ...counts,
      expanding,
      contracting,
      netDirectionalCount: expanding - contracting
    },
    directionalBreadthPct: activePairUniverse > 0 ? round((expanding - contracting) / activePairUniverse * 100, 8) : null,
    descriptor: descriptor(expanding, contracting),
    movements,
    weighting: 'equal-token-lane-direction-only-not-value-weighted'
  };
}

function main() {
  const pulse = readJson(PULSE_FILE);
  const e = pulse.epochFlowAccounting;
  if (pulse.version !== '0.1-aerodrome-managed-strategy-pulse' || e?.version !== '0.1-aerodrome-reward-epoch-accounting') {
    throw new Error('Physical Aerodrome Pulse with epochFlowAccounting required');
  }
  if (pulse.authority?.executionAuthority !== 'none' || pulse.authority?.promotionAuthority !== 'none') {
    throw new Error('Market Breath overlay refuses expanded authority');
  }
  if (e.comparisonPolicy?.completedEpochsComparable !== true || e.comparisonPolicy?.currentToDateVsCompletedComparable !== false) {
    throw new Error('Completed-epoch comparability contract missing');
  }
  const previous = e.epochs?.find(x => x.key === 'previousCompleted');
  const prior = e.epochs?.find(x => x.key === 'priorCompleted');
  if (!previous || !prior || previous.status !== 'completed' || prior.status !== 'completed') {
    throw new Error('Two completed Aerodrome epochs required');
  }

  const fees = laneDescriptor(e.lanes?.feeVotingRewards);
  const bribes = laneDescriptor(e.lanes?.bribeVotingRewards);
  const locked = laneDescriptor(e.lanes?.lockedManagedRewards);
  const free = laneDescriptor(e.lanes?.freeManagedRewards);

  pulse.marketBreath = {
    version: '0.1-aerodrome-completed-epoch-directional-breadth',
    generatedAt: new Date().toISOString(),
    basis: {
      priorCompletedEpochStart: prior.epochStartIso,
      previousCompletedEpochStart: previous.epochStartIso,
      comparisonClass: 'completed-epoch-vs-completed-epoch',
      currentIncompleteEpochExcludedFromDirectionalComparison: true
    },
    lanes: {
      feeInflows: {
        meaning: 'Directional breadth of token inflows notified by gauges into FeeVotingReward contracts across Defitea managed-veNFT voted pools.',
        ...fees
      },
      incentiveInflows: {
        meaning: 'Directional breadth of external whitelisted token inflows notified into BribeVotingReward contracts across Defitea managed-veNFT voted pools.',
        ...bribes
      },
      lockedManagedInflows: {
        meaning: 'Directional change in VotingEscrow-notified escrow-token inflows to the managed strategy LockedManagedReward contract.',
        ...locked
      },
      freeManagedInflows: {
        meaning: 'Directional change in whitelisted free-token inflows to the managed strategy FreeManagedReward contract.',
        ...free
      }
    },
    interpretation: {
      feeDescriptor: fees.descriptor,
      incentiveDescriptor: bribes.descriptor,
      combinedRegime: null,
      reasonNoCombinedRegime: 'fee and incentive tokens are heterogeneous and economically non-commensurable without canonical value normalization; equal-token directional breadth must remain lane-specific',
      valueWeightedAggregationAvailable: false,
      prediction: false
    },
    epistemic: {
      sourceClass: 'derived-from-proven-same-block-tokenRewardsPerEpoch-accounting',
      descriptorClass: 'descriptive-completed-epoch-directional-breadth',
      equalTokenLaneWeightingOnly: true,
      heterogeneousTokenAmountsNotSummed: true,
      contractWideInflowsAreNotCompanyEarnedShare: true,
      correlationIsNotCausation: true,
      causalAttribution: 'unresolved-beyond-proven-reward-contract-accounting',
      primaryDriver: null,
      recommendationAuthority: false,
      predictionAuthority: 'none',
      promotionAuthority: 'none'
    }
  };
  pulse.semantics = {
    ...pulse.semantics,
    marketBreathDescriptor: true,
    marketBreathIsDescriptiveNotPredictive: true,
    marketBreathHasNoCrossTokenValueAggregation: true
  };
  fs.writeFileSync(PULSE_FILE, `${JSON.stringify(pulse, null, 2)}\n`);
  console.log('AERODROME MARKET BREATH DESCRIPTOR PASS', {
    priorCompleted: prior.epochStartIso,
    previousCompleted: previous.epochStartIso,
    feeActiveBreadthDelta: fees.activeTokenBreadthDelta,
    feeNetDirectionalCount: fees.directionCounts.netDirectionalCount,
    feeDescriptor: fees.descriptor,
    incentiveActiveBreadthDelta: bribes.activeTokenBreadthDelta,
    incentiveNetDirectionalCount: bribes.directionCounts.netDirectionalCount,
    incentiveDescriptor: bribes.descriptor,
    lockedManagedMovements: locked.movements.length,
    primaryDriver: pulse.marketBreath.epistemic.primaryDriver,
    promotionAuthority: pulse.marketBreath.epistemic.promotionAuthority
  });
}

try { main(); } catch (error) {
  console.error(error?.stack || error);
  process.exit(1);
}
