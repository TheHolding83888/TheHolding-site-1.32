#!/usr/bin/env node
/**
 * THE HOLDING · Aerodrome Epoch Flow Accounting Overlay v0.2
 *
 * Additive, read-only enrichment for the existing Aerodrome Managed Strategy
 * Pulse. Reads Aerodrome Reward.tokenRewardsPerEpoch at the exact Pulse block
 * for current-to-date plus two completed protocol epochs. It does not promote
 * Aerodrome into the canonical cohort set and does not treat contract-wide
 * reward inflows as Defitea-earned rewards.
 *
 * After the existing Market Breath + managed vote epoch-history chain has
 * completed, this same canonical overlay also builds a bounded descriptive
 * vote-flow context: completed-epoch allocation changes are joined to
 * fee/incentive token-lane direction only where reward-contract coverage is
 * physically present. Missing historical-only pools are excluded, never zeroed.
 */
import fs from 'node:fs';
import process from 'node:process';
import { Contract, JsonRpcProvider, formatUnits } from 'ethers';

const PULSE_FILE = process.env.AERODROME_PULSE_FILE || 'intelligence/economic-graph/aerodrome-managed-pulse.json';
const DURATION = 7 * 24 * 60 * 60;
const SOURCE_REPO = 'aerodrome-finance/contracts';
const SOURCE_COMMIT = '1ba30815bba620f7e9faa34769ffd00c214c9b82';

const REWARD_ABI = [
  'function tokenRewardsPerEpoch(address token,uint256 epochStart) view returns (uint256)'
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function round(value, digits = 12) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}
function isoFromSeconds(value) {
  return new Date(Number(value) * 1000).toISOString();
}
function pctDelta(current, prior) {
  const c = Number(current), p = Number(prior);
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null;
  return round((c - p) / Math.abs(p) * 100, 8);
}
function rpcCandidates() {
  return [...new Set([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ].filter(Boolean))];
}
function rpcLabel(url) {
  if (url === process.env.BASE_RPC_URL || url === process.env.BASE_RPC_URL_2) return 'configured-secret';
  try { return new URL(url).hostname; } catch { return 'configured'; }
}
async function providerWithFallback() {
  let lastError = null;
  for (const url of rpcCandidates()) {
    const provider = new JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      await provider.getBlockNumber();
      return { provider, endpointClass: rpcLabel(url) };
    } catch (error) {
      lastError = error;
      try { provider.destroy(); } catch {}
    }
  }
  throw lastError || new Error('No working Base RPC');
}

function protocolEpochs(pulse) {
  const activeIso = pulse?.latest?.protocolEpoch?.activePeriod;
  const activeMs = Date.parse(activeIso || '');
  if (!Number.isFinite(activeMs)) throw new Error('Aerodrome activePeriod unavailable for epoch accounting');
  const current = Math.floor(activeMs / 1000);
  return [
    { key: 'currentToDate', epochStart: current, epochStartIso: isoFromSeconds(current), status: 'in-progress' },
    { key: 'previousCompleted', epochStart: current - DURATION, epochStartIso: isoFromSeconds(current - DURATION), status: 'completed' },
    { key: 'priorCompleted', epochStart: current - 2 * DURATION, epochStartIso: isoFromSeconds(current - 2 * DURATION), status: 'completed' }
  ];
}

async function enrichRewardState(provider, rewardState, epochs, blockTag) {
  if (!rewardState?.address || !Array.isArray(rewardState.rewards)) return rewardState;
  const reward = new Contract(rewardState.address, REWARD_ABI, provider);
  const rows = await Promise.all(rewardState.rewards.map(async row => {
    const raws = await Promise.all(epochs.map(epoch => reward.tokenRewardsPerEpoch(row.token, epoch.epochStart, { blockTag })));
    return {
      ...row,
      epochInflows: epochs.map((epoch, index) => ({
        key: epoch.key,
        epochStart: epoch.epochStartIso,
        epochStatus: epoch.status,
        amountRaw: raws[index].toString(),
        amount: round(Number(formatUnits(raws[index], Number(row.decimals ?? 18))), 12),
        stateClass: 'onchain-tokenRewardsPerEpoch-same-block'
      }))
    };
  }));
  return {
    ...rewardState,
    rewards: rows,
    epochAccountingClass: 'proven-reward-contract-accounting'
  };
}

function aggregateByToken(rewardStates, epochs) {
  const map = new Map();
  for (const state of rewardStates.filter(Boolean)) {
    for (const row of state.rewards || []) {
      const key = String(row.token).toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          token: row.token,
          symbol: row.symbol,
          decimals: Number(row.decimals ?? 18),
          rawByEpoch: Object.fromEntries(epochs.map(epoch => [epoch.key, 0n])),
          contributingContracts: new Set()
        });
      }
      const target = map.get(key);
      target.contributingContracts.add(state.address);
      for (const flow of row.epochInflows || []) {
        target.rawByEpoch[flow.key] += BigInt(flow.amountRaw || '0');
      }
    }
  }
  return [...map.values()]
    .map(row => ({
      token: row.token,
      symbol: row.symbol,
      decimals: row.decimals,
      contributingContractCount: row.contributingContracts.size,
      epochInflows: epochs.map(epoch => {
        const raw = row.rawByEpoch[epoch.key];
        return {
          key: epoch.key,
          epochStart: epoch.epochStartIso,
          epochStatus: epoch.status,
          amountRaw: raw.toString(),
          amount: round(Number(formatUnits(raw, row.decimals)), 12)
        };
      })
    }))
    .sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)) || String(a.token).localeCompare(String(b.token)));
}

function completedEpochComparison(rows) {
  return rows.map(row => {
    const previous = row.epochInflows.find(x => x.key === 'previousCompleted')?.amount ?? 0;
    const prior = row.epochInflows.find(x => x.key === 'priorCompleted')?.amount ?? 0;
    return {
      token: row.token,
      symbol: row.symbol,
      previousCompletedAmount: previous,
      priorCompletedAmount: prior,
      deltaAmount: round(Number(previous) - Number(prior), 12),
      deltaPct: pctDelta(previous, prior)
    };
  });
}

function tokenLaneDirection(prior, previous) {
  const a = Number(prior || 0), b = Number(previous || 0);
  if (a === 0 && b === 0) return 'flat-zero';
  if (a === 0 && b > 0) return 'activated';
  if (a > 0 && b === 0) return 'extinguished';
  if (b > a) return 'increased';
  if (b < a) return 'decreased';
  return 'flat-active';
}
function allocationDirection(state) {
  if (state === 'newly-voted' || state === 'increased') return 'allocation-expanded';
  if (state === 'no-longer-voted' || state === 'decreased') return 'allocation-contracted';
  return 'allocation-flat';
}
function rewardLaneContext(rewardState) {
  const movements = (rewardState?.rewards || []).map(row => {
    const prior = row.epochInflows?.find(x => x.key === 'priorCompleted')?.amount ?? 0;
    const previous = row.epochInflows?.find(x => x.key === 'previousCompleted')?.amount ?? 0;
    return {
      token: row.token,
      symbol: row.symbol,
      priorCompletedAmount: Number(prior),
      previousCompletedAmount: Number(previous),
      direction: tokenLaneDirection(prior, previous)
    };
  });
  const expanding = movements.filter(x => x.direction === 'activated' || x.direction === 'increased').length;
  const contracting = movements.filter(x => x.direction === 'extinguished' || x.direction === 'decreased').length;
  const activePairUniverse = movements.filter(x => x.priorCompletedAmount > 0 || x.previousCompletedAmount > 0).length;
  let direction = 'balanced-or-flat';
  if (expanding > contracting) direction = 'token-lanes-expanding';
  else if (contracting > expanding) direction = 'token-lanes-contracting';
  return {
    rewardContract: rewardState?.address ?? null,
    tokenUniverseCount: movements.length,
    activePairUniverseCount: activePairUniverse,
    expandingTokenLaneCount: expanding,
    contractingTokenLaneCount: contracting,
    netDirectionalCount: expanding - contracting,
    direction,
    movements,
    weighting: 'equal-token-lane-direction-only-not-value-weighted'
  };
}
function jointState(allocation, flow) {
  return `${allocation}|${flow}`;
}
function summarizeJoint(rows, laneKey) {
  const counts = {};
  let aligned = 0, opposed = 0, indeterminate = 0;
  for (const row of rows) {
    const allocation = row.allocationDirection;
    const flow = row[laneKey].direction;
    const key = jointState(allocation, flow);
    counts[key] = (counts[key] || 0) + 1;
    const allocationUp = allocation === 'allocation-expanded';
    const allocationDown = allocation === 'allocation-contracted';
    const flowUp = flow === 'token-lanes-expanding';
    const flowDown = flow === 'token-lanes-contracting';
    if ((allocationUp && flowUp) || (allocationDown && flowDown)) aligned++;
    else if ((allocationUp && flowDown) || (allocationDown && flowUp)) opposed++;
    else indeterminate++;
  }
  return {
    jointStateCounts: counts,
    directionalAlignmentCount: aligned,
    directionalOppositionCount: opposed,
    indeterminateCount: indeterminate,
    statisticalCorrelationComputed: false,
    interpretation: 'descriptive-joint-directional-context-only'
  };
}

function addVoteFlowContext() {
  const pulse = readJson(PULSE_FILE);
  const vote = pulse.voteEpochHistory?.completedEpochComparison;
  const flow = pulse.epochFlowAccounting;
  if (pulse.voteEpochHistory?.version !== '0.1-aerodrome-managed-vote-event-reconstruction' || vote?.comparable !== true) {
    throw new Error('Comparable managed vote epoch history required for vote-flow context');
  }
  if (flow?.version !== '0.1-aerodrome-reward-epoch-accounting' || pulse.marketBreath?.version !== '0.1-aerodrome-completed-epoch-directional-breadth') {
    throw new Error('Completed-epoch reward accounting and Market Breath required for vote-flow context');
  }
  if (pulse.authority?.executionAuthority !== 'none' || pulse.authority?.promotionAuthority !== 'none' || pulse.authority?.causalClaimAuthority !== 'none') {
    throw new Error('Vote-flow context refuses expanded authority');
  }
  if (vote.priorCompletedEpochStart !== flow.epochs?.find(x => x.key === 'priorCompleted')?.epochStartIso ||
      vote.previousCompletedEpochStart !== flow.epochs?.find(x => x.key === 'previousCompleted')?.epochStartIso) {
    throw new Error('Vote and reward-flow completed-epoch boundaries do not match');
  }

  const currentPools = new Map((pulse.latest?.pools || []).map(pool => [String(pool.pool).toLowerCase(), pool]));
  const allVoteChanges = Array.isArray(vote.allChanges) ? vote.allChanges : [];
  const rows = [];
  const excluded = [];
  for (const change of allVoteChanges) {
    const pool = currentPools.get(String(change.pool).toLowerCase());
    if (!pool) {
      excluded.push({
        pool: change.pool,
        pair: change.pair ?? null,
        reason: 'historical-vote-pool-not-present-in-current-pulse-reward-contract-universe',
        treatment: 'excluded-not-zero'
      });
      continue;
    }
    rows.push({
      pool: change.pool,
      pair: change.pair ?? pool.pair ?? null,
      voteState: change.state,
      allocationDirection: allocationDirection(change.state),
      priorCompletedAllocationPct: Number(change.priorCompletedAllocationPct || 0),
      previousCompletedAllocationPct: Number(change.previousCompletedAllocationPct || 0),
      allocationDeltaPctPoints: Number(change.deltaPctPoints || 0),
      feeInflows: rewardLaneContext(pool.feeVotingReward),
      incentiveInflows: rewardLaneContext(pool.bribeVotingReward)
    });
  }

  const comparisonPoolCount = allVoteChanges.length;
  const matchedPoolCount = rows.length;
  pulse.voteFlowContext = {
    version: '0.1-aerodrome-completed-epoch-vote-flow-context',
    generatedAt: new Date().toISOString(),
    basis: {
      priorCompletedEpochStart: vote.priorCompletedEpochStart,
      previousCompletedEpochStart: vote.previousCompletedEpochStart,
      comparisonClass: 'completed-epoch-vote-allocation-vs-completed-epoch-reward-lane-direction',
      currentIncompleteEpochExcluded: true
    },
    coverage: {
      voteComparisonPoolCount: comparisonPoolCount,
      matchedCurrentRewardContractPoolCount: matchedPoolCount,
      excludedHistoricalOnlyPoolCount: excluded.length,
      matchedCoveragePct: comparisonPoolCount > 0 ? round(matchedPoolCount / comparisonPoolCount * 100, 8) : null,
      missingHistoricalPoolTreatment: 'excluded-not-zero',
      fullHistoricalRewardContractCoverage: excluded.length === 0
    },
    poolContexts: rows,
    excludedPools: excluded,
    associations: {
      feeInflows: summarizeJoint(rows, 'feeInflows'),
      incentiveInflows: summarizeJoint(rows, 'incentiveInflows')
    },
    epistemic: {
      relationshipClass: 'correlated-context-not-causal-attribution',
      sourceVoteState: 'measured-event-reconstructed-completed-epoch-allocation',
      sourceRewardFlows: 'proven-tokenRewardsPerEpoch-accounting',
      equalTokenLaneDirectionOnly: true,
      heterogeneousTokenAmountsNotSummed: true,
      missingHistoricalPoolsAreUnknownNotZero: true,
      statisticalCorrelationComputed: false,
      causalAttribution: 'unresolved',
      primaryDriver: null,
      referenceAprConnection: 'not-attributed-by-this-context',
      companyOutcomeConnection: 'not-attributed-by-this-context',
      recommendationAuthority: false,
      predictionAuthority: 'none',
      promotionAuthority: 'none',
      executionAuthority: 'none'
    }
  };

  pulse.semantics = {
    ...pulse.semantics,
    voteFlowContext: true,
    voteFlowContextIsCorrelatedNotCausal: true,
    historicalPoolCoverageIsExplicit: true,
    missingHistoricalPoolsAreNotZeroed: true
  };
  pulse.nextUnlocks = (pulse.nextUnlocks || []).filter(item => item !== 'relate completed-epoch vote allocation changes to fee/incentive inflow lanes without causal over-promotion');
  const coverageUnlock = 'expand reward-contract coverage to historical-only voted pools before full pool-universe vote-flow association';
  if (excluded.length > 0 && !pulse.nextUnlocks.includes(coverageUnlock)) pulse.nextUnlocks.unshift(coverageUnlock);

  fs.writeFileSync(PULSE_FILE, `${JSON.stringify(pulse, null, 2)}\n`);
  console.log('AERODROME VOTE-FLOW CONTEXT PASS', {
    priorCompleted: vote.priorCompletedEpochStart,
    previousCompleted: vote.previousCompletedEpochStart,
    voteComparisonPools: comparisonPoolCount,
    matchedPools: matchedPoolCount,
    excludedHistoricalOnlyPools: excluded.length,
    matchedCoveragePct: pulse.voteFlowContext.coverage.matchedCoveragePct,
    feeAligned: pulse.voteFlowContext.associations.feeInflows.directionalAlignmentCount,
    feeOpposed: pulse.voteFlowContext.associations.feeInflows.directionalOppositionCount,
    incentiveAligned: pulse.voteFlowContext.associations.incentiveInflows.directionalAlignmentCount,
    incentiveOpposed: pulse.voteFlowContext.associations.incentiveInflows.directionalOppositionCount,
    causalAttribution: pulse.voteFlowContext.epistemic.causalAttribution,
    promotionAuthority: pulse.voteFlowContext.epistemic.promotionAuthority
  });
}

async function main() {
  const pulse = readJson(PULSE_FILE);
  if (pulse.version !== '0.1-aerodrome-managed-strategy-pulse' || pulse.status !== 'shadow-measured-not-promoted') {
    throw new Error('Aerodrome Managed Strategy Pulse v0.1 shadow artifact required');
  }
  if (pulse.authority?.executionAuthority !== 'none' || pulse.authority?.promotionAuthority !== 'none') {
    throw new Error('Epoch overlay refuses expanded Pulse authority');
  }
  const blockTag = Number(pulse?.latest?.blockNumber);
  if (!Number.isInteger(blockTag) || blockTag <= 0 || pulse?.latest?.provenance?.sameBlockRead !== true) {
    throw new Error('Exact same-block Pulse provenance required');
  }
  const epochs = protocolEpochs(pulse);
  const { provider, endpointClass } = await providerWithFallback();
  try {
    const block = await provider.getBlock(blockTag);
    if (!block || block.hash !== pulse.latest.blockHash) throw new Error('Pulse block hash no longer matches canonical Base block');

    for (const pool of pulse.latest.pools || []) {
      pool.feeVotingReward = await enrichRewardState(provider, pool.feeVotingReward, epochs, blockTag);
      pool.bribeVotingReward = await enrichRewardState(provider, pool.bribeVotingReward, epochs, blockTag);
    }
    pulse.latest.depositorManagedRewards.locked = await enrichRewardState(
      provider,
      pulse.latest.depositorManagedRewards.locked,
      epochs,
      blockTag
    );
    pulse.latest.depositorManagedRewards.free = await enrichRewardState(
      provider,
      pulse.latest.depositorManagedRewards.free,
      epochs,
      blockTag
    );

    const feeStates = (pulse.latest.pools || []).map(pool => pool.feeVotingReward);
    const bribeStates = (pulse.latest.pools || []).map(pool => pool.bribeVotingReward);
    const feeByToken = aggregateByToken(feeStates, epochs);
    const bribeByToken = aggregateByToken(bribeStates, epochs);
    const lockedByToken = aggregateByToken([pulse.latest.depositorManagedRewards.locked], epochs);
    const freeByToken = aggregateByToken([pulse.latest.depositorManagedRewards.free], epochs);

    pulse.epochFlowAccounting = {
      version: '0.1-aerodrome-reward-epoch-accounting',
      generatedAt: new Date().toISOString(),
      blockNumber: blockTag,
      blockHash: block.hash,
      rpcEndpointClass: endpointClass,
      epochs,
      lanes: {
        feeVotingRewards: {
          meaning: 'Total token amounts notified by the corresponding gauge into FeesVotingReward for each protocol epoch.',
          byToken: feeByToken,
          completedEpochComparison: completedEpochComparison(feeByToken)
        },
        bribeVotingRewards: {
          meaning: 'Total whitelisted external incentive token amounts notified into BribeVotingReward for each protocol epoch.',
          byToken: bribeByToken,
          completedEpochComparison: completedEpochComparison(bribeByToken)
        },
        lockedManagedRewards: {
          meaning: 'Total escrow-token amounts notified by VotingEscrow into LockedManagedReward for managed-position distribution per epoch.',
          byToken: lockedByToken,
          completedEpochComparison: completedEpochComparison(lockedByToken)
        },
        freeManagedRewards: {
          meaning: 'Total whitelisted token amounts notified into FreeManagedReward for managed-position distribution per epoch.',
          byToken: freeByToken,
          completedEpochComparison: completedEpochComparison(freeByToken)
        }
      },
      comparisonPolicy: {
        completedEpochsComparable: true,
        currentToDateVsCompletedComparable: false,
        reason: 'current protocol epoch is incomplete; current-to-date inflows must not be compared as a full-epoch delta'
      },
      officialContractSource: {
        repository: SOURCE_REPO,
        commit: SOURCE_COMMIT,
        rewardContract: 'contracts/rewards/Reward.sol',
        feesVotingReward: 'contracts/rewards/FeesVotingReward.sol',
        bribeVotingReward: 'contracts/rewards/BribeVotingReward.sol',
        lockedManagedReward: 'contracts/rewards/LockedManagedReward.sol',
        freeManagedReward: 'contracts/rewards/FreeManagedReward.sol'
      },
      epistemic: {
        observationClass: 'direct-onchain-contract-accounting-same-block',
        feeVotingRewardInflow: 'proven-tokenRewardsPerEpoch-accounting',
        bribeVotingRewardInflow: 'proven-tokenRewardsPerEpoch-accounting',
        lockedManagedRewardInflow: 'proven-tokenRewardsPerEpoch-accounting',
        freeManagedRewardInflow: 'proven-tokenRewardsPerEpoch-accounting',
        contractWideInflowsAreNotCompanyEarnedShare: true,
        referenceAprConnection: 'not-attributed-by-this-overlay',
        causalAttribution: 'unresolved-beyond-proven-reward-contract-accounting',
        primaryDriver: null,
        promotionAuthority: 'none'
      }
    };

    pulse.semantics = {
      ...pulse.semantics,
      epochFlowAccounting: true,
      currentEpochIsPartial: true,
      completedEpochComparisonOnly: true,
      rewardContractInflowsAreNotCompanyEarnedShare: true
    };

    fs.writeFileSync(PULSE_FILE, `${JSON.stringify(pulse, null, 2)}\n`);
    console.log('AERODROME EPOCH FLOW ACCOUNTING PASS', {
      block: blockTag,
      currentEpoch: epochs[0].epochStartIso,
      previousCompleted: epochs[1].epochStartIso,
      priorCompleted: epochs[2].epochStartIso,
      feeTokens: feeByToken.length,
      bribeTokens: bribeByToken.length,
      lockedManagedTokens: lockedByToken.length,
      freeManagedTokens: freeByToken.length,
      primaryDriver: pulse.epochFlowAccounting.epistemic.primaryDriver,
      promotionAuthority: pulse.epochFlowAccounting.epistemic.promotionAuthority
    });
  } finally {
    try { provider.destroy(); } catch {}
  }
}

main()
  .then(() => import('./aerodrome-market-breath-overlay.mjs'))
  .then(() => addVoteFlowContext())
  .catch(error => {
    console.error(error?.stack || error);
    process.exit(1);
  });
