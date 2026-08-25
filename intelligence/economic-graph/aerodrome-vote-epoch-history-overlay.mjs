#!/usr/bin/env node
/**
 * THE HOLDING · Aerodrome Managed Vote Epoch History Overlay v0.1
 *
 * Reconstructs managed-veNFT allocation state from canonical Aerodrome Voter
 * Voted/Abstained events. Additive, read-only and shadow-only: vote allocation
 * changes are not treated as causes of APR, reward inflows or company outcomes.
 */
import fs from 'node:fs';
import process from 'node:process';
import { Interface, JsonRpcProvider, getAddress, toBeHex, zeroPadValue } from 'ethers';

const PULSE_FILE = process.env.AERODROME_PULSE_FILE || 'intelligence/economic-graph/aerodrome-managed-pulse.json';
const WEEK = 7 * 24 * 60 * 60;
const VOTER = '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';
const SOURCE_REPO = 'aerodrome-finance/contracts';
const SOURCE_COMMIT = '1ba30815bba620f7e9faa34769ffd00c214c9b82';
// Base targets ~2s blocks. 1.6m blocks is a conservative >4-week query
// horizon without requiring historical eth_getBlockByNumber archive access.
// Exact epoch boundaries come from timestamps emitted by Voter events.
const LOOKBACK_BLOCKS = 1_600_000;
const EVENT_IFACE = new Interface([
  'event Voted(address indexed voter,address indexed pool,uint256 indexed tokenId,uint256 weight,uint256 totalWeight,uint256 timestamp)',
  'event Abstained(address indexed voter,address indexed pool,uint256 indexed tokenId,uint256 weight,uint256 totalWeight,uint256 timestamp)'
]);
const VOTED_TOPIC = EVENT_IFACE.getEvent('Voted').topicHash;
const ABSTAINED_TOPIC = EVENT_IFACE.getEvent('Abstained').topicHash;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function round(value, digits = 8) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}
function iso(seconds) { return new Date(Number(seconds) * 1000).toISOString(); }
function bigPct(part, whole, digits = 8) {
  const p = BigInt(part), w = BigInt(whole);
  if (w === 0n) return null;
  const scale = 10n ** BigInt(digits);
  return Number((p * 100n * scale) / w) / Number(scale);
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

async function getLogsChunked(provider, filter, fromBlock, toBlock) {
  const out = [];
  let cursor = Number(fromBlock);
  const finalBlock = Number(toBlock);
  let chunkSize = 100_000;
  const minChunk = 2_500;
  while (cursor <= finalBlock) {
    const end = Math.min(finalBlock, cursor + chunkSize - 1);
    try {
      const logs = await provider.getLogs({ ...filter, fromBlock: cursor, toBlock: end });
      out.push(...logs);
      cursor = end + 1;
      if (chunkSize < 100_000) chunkSize = Math.min(100_000, chunkSize * 2);
    } catch (error) {
      if (chunkSize <= minChunk) throw error;
      chunkSize = Math.max(minChunk, Math.floor(chunkSize / 2));
    }
  }
  return out;
}

function decodeLog(log) {
  const parsed = EVENT_IFACE.parseLog(log);
  if (!parsed || (parsed.name !== 'Voted' && parsed.name !== 'Abstained')) return null;
  return {
    event: parsed.name,
    voter: getAddress(parsed.args.voter),
    pool: getAddress(parsed.args.pool),
    tokenId: parsed.args.tokenId.toString(),
    weightRaw: parsed.args.weight.toString(),
    poolTotalWeightRaw: parsed.args.totalWeight.toString(),
    timestamp: Number(parsed.args.timestamp),
    blockNumber: Number(log.blockNumber),
    transactionHash: log.transactionHash,
    transactionIndex: Number(log.transactionIndex ?? 0),
    logIndex: Number(log.index ?? log.logIndex ?? 0)
  };
}

function groupTransactions(events) {
  const groups = [];
  for (const event of events) {
    const key = `${event.blockNumber}:${event.transactionHash}`;
    let group = groups.at(-1);
    if (!group || group.key !== key) {
      group = { key, blockNumber: event.blockNumber, transactionHash: event.transactionHash, timestamp: event.timestamp, events: [] };
      groups.push(group);
    }
    group.events.push(event);
    group.timestamp = Math.max(group.timestamp, event.timestamp);
  }
  return groups;
}

function pairLookup(pulse) {
  return new Map((pulse?.latest?.pools || []).map(row => [String(row.pool).toLowerCase(), row.pair || null]));
}

function allocationSnapshot(state, pairMap) {
  const rows = [...state.entries()].map(([pool, weight]) => ({ pool, weight: BigInt(weight) }));
  const total = rows.reduce((sum, row) => sum + row.weight, 0n);
  if (total === 0n) {
    return { usedWeightRaw: '0', poolCount: 0, allocationHhi: null, topAllocationPct: null, allocations: [] };
  }
  const allocations = rows.map(row => ({
    pool: row.pool,
    pair: pairMap.get(row.pool.toLowerCase()) ?? null,
    weightRaw: row.weight.toString(),
    allocationPct: bigPct(row.weight, total, 8)
  })).sort((a, b) => Number(b.allocationPct || 0) - Number(a.allocationPct || 0) || a.pool.localeCompare(b.pool));
  const hhi = allocations.reduce((sum, row) => sum + Number(row.allocationPct || 0) ** 2, 0);
  return {
    usedWeightRaw: total.toString(),
    poolCount: allocations.length,
    allocationHhi: round(hhi, 8),
    topAllocationPct: allocations[0]?.allocationPct ?? null,
    allocations
  };
}

function compareCompleted(prior, previous) {
  if (!prior?.stateKnownAtEnd || !previous?.stateKnownAtEnd) {
    return { comparable: false, reason: 'event-reconstructed allocation state not known at both completed epoch boundaries' };
  }
  const a = new Map((prior.allocations || []).map(row => [row.pool.toLowerCase(), row]));
  const b = new Map((previous.allocations || []).map(row => [row.pool.toLowerCase(), row]));
  const pools = [...new Set([...a.keys(), ...b.keys()])];
  const changes = pools.map(key => {
    const before = a.get(key), after = b.get(key);
    const priorPct = Number(before?.allocationPct || 0), previousPct = Number(after?.allocationPct || 0);
    let state = 'flat';
    if (!before && after) state = 'newly-voted';
    else if (before && !after) state = 'no-longer-voted';
    else if (previousPct > priorPct) state = 'increased';
    else if (previousPct < priorPct) state = 'decreased';
    return {
      pool: after?.pool || before?.pool,
      pair: after?.pair || before?.pair || null,
      priorCompletedAllocationPct: round(priorPct, 8),
      previousCompletedAllocationPct: round(previousPct, 8),
      deltaPctPoints: round(previousPct - priorPct, 8),
      state
    };
  });
  const absoluteDelta = changes.reduce((sum, row) => sum + Math.abs(Number(row.deltaPctPoints || 0)), 0);
  const retained = changes.reduce((sum, row) => sum + Math.min(Number(row.priorCompletedAllocationPct || 0), Number(row.previousCompletedAllocationPct || 0)), 0);
  const newAllocation = changes.filter(row => row.state === 'newly-voted').reduce((sum, row) => sum + Number(row.previousCompletedAllocationPct || 0), 0);
  const removedAllocation = changes.filter(row => row.state === 'no-longer-voted').reduce((sum, row) => sum + Number(row.priorCompletedAllocationPct || 0), 0);
  return {
    comparable: true,
    comparisonClass: 'event-reconstructed-completed-epoch-end-allocation-vs-completed-epoch-end-allocation',
    priorCompletedEpochStart: prior.epochStart,
    previousCompletedEpochStart: previous.epochStart,
    priorPoolCount: prior.poolCount,
    previousPoolCount: previous.poolCount,
    poolCountDelta: previous.poolCount - prior.poolCount,
    reallocatedPct: round(absoluteDelta / 2, 8),
    retainedAllocationPct: round(retained, 8),
    newlyVotedAllocationPct: round(newAllocation, 8),
    removedAllocationPct: round(removedAllocation, 8),
    allocationHhiDelta: prior.allocationHhi === null || previous.allocationHhi === null ? null : round(previous.allocationHhi - prior.allocationHhi, 8),
    changedPoolCount: changes.filter(row => Math.abs(Number(row.deltaPctPoints || 0)) > 0.00000001).length,
    topAbsoluteAllocationShifts: [...changes].sort((x, y) => Math.abs(Number(y.deltaPctPoints || 0)) - Math.abs(Number(x.deltaPctPoints || 0))).slice(0, 15),
    allChanges: changes
  };
}

function proveCurrentParity(pulse, current) {
  if (!current?.stateKnownAtEnd) throw new Error('Current managed vote state was not reconstructed from event evidence');
  const livePools = new Map((pulse?.latest?.pools || []).map(row => [String(row.pool).toLowerCase(), row]));
  if (current.poolCount !== Number(pulse?.latest?.voting?.votedPoolCount)) {
    throw new Error(`Event-reconstructed current pool count ${current.poolCount} != Pulse ${pulse?.latest?.voting?.votedPoolCount}`);
  }
  if (BigInt(current.usedWeightRaw) !== BigInt(pulse?.latest?.voting?.usedVotingWeightRaw || 0)) {
    throw new Error('Event-reconstructed current used weight != same-block Voter state');
  }
  for (const row of current.allocations || []) {
    const live = livePools.get(row.pool.toLowerCase());
    if (!live || BigInt(live.managedVoteWeightRaw || 0) !== BigInt(row.weightRaw)) {
      throw new Error(`Event-reconstructed current pool weight mismatch for ${row.pool}`);
    }
  }
  return {
    status: 'exact-current-state-parity',
    poolCount: current.poolCount,
    usedWeightRaw: current.usedWeightRaw,
    allPoolWeightsMatch: true
  };
}

async function main() {
  const pulse = readJson(PULSE_FILE);
  if (pulse.version !== '0.1-aerodrome-managed-strategy-pulse' || pulse.status !== 'shadow-measured-not-promoted') {
    throw new Error('Aerodrome Managed Strategy Pulse v0.1 shadow artifact required');
  }
  if (pulse.authority?.executionAuthority !== 'none' || pulse.authority?.promotionAuthority !== 'none') {
    throw new Error('Vote history overlay refuses expanded Pulse authority');
  }
  if (pulse.marketBreath?.version !== '0.1-aerodrome-completed-epoch-directional-breadth') {
    throw new Error('Aerodrome Market Breath descriptor required before vote epoch history');
  }
  const blockTag = Number(pulse?.latest?.blockNumber);
  const blockHash = pulse?.latest?.blockHash;
  const managedTokenId = BigInt(pulse?.latest?.identity?.managedTokenId || 0);
  const activePeriodSec = Math.floor(Date.parse(pulse?.latest?.protocolEpoch?.activePeriod || '') / 1000);
  if (!Number.isInteger(blockTag) || blockTag <= 0 || !blockHash || managedTokenId <= 0n || !Number.isFinite(activePeriodSec)) {
    throw new Error('Pulse block / managed token / active period unavailable');
  }

  const { provider, endpointClass } = await providerWithFallback();
  try {
    const currentBlockNumber = await provider.getBlockNumber();
    if (currentBlockNumber < blockTag) throw new Error('RPC head is behind Pulse block');
    const fromBlock = Math.max(1, blockTag - LOOKBACK_BLOCKS);
    const requiredCoverageStart = activePeriodSec - 4 * WEEK;
    const tokenTopic = zeroPadValue(toBeHex(managedTokenId), 32);
    const logs = await getLogsChunked(provider, {
      address: VOTER,
      topics: [[VOTED_TOPIC, ABSTAINED_TOPIC], null, null, tokenTopic]
    }, fromBlock, blockTag);
    const events = logs.map(decodeLog).filter(Boolean)
      .sort((a, b) => a.blockNumber - b.blockNumber || a.transactionIndex - b.transactionIndex || a.logIndex - b.logIndex);
    if (!events.length) throw new Error('No Aerodrome Voter events found for managed tokenId in conservative lookback');
    const txGroups = groupTransactions(events);
    const pairs = pairLookup(pulse);

    const targets = [
      { key: 'priorCompleted', start: activePeriodSec - 2 * WEEK, end: activePeriodSec - WEEK, status: 'completed' },
      { key: 'previousCompleted', start: activePeriodSec - WEEK, end: activePeriodSec, status: 'completed' },
      { key: 'currentToDate', start: activePeriodSec, end: Math.floor(Date.parse(pulse.latest.observedAt) / 1000) + 1, status: 'in-progress' }
    ];

    const state = new Map();
    let stateKnown = false, cursor = 0, lastMutation = null;
    const snapshots = [];
    for (const target of targets) {
      while (cursor < txGroups.length && txGroups[cursor].timestamp < target.end) {
        const group = txGroups[cursor++];
        for (const event of group.events) {
          if (event.event === 'Abstained') state.delete(event.pool.toLowerCase());
          else state.set(event.pool.toLowerCase(), BigInt(event.weightRaw));
        }
        // Official Voter._vote performs a full _reset before emitting the
        // replacement Voted set. A reset-only transaction emits the complete
        // Abstained set. Therefore post-transaction allocation is authoritative.
        stateKnown = true;
        lastMutation = group;
      }
      const alloc = stateKnown ? allocationSnapshot(state, pairs) : allocationSnapshot(new Map(), pairs);
      const eventsWithin = events.filter(event => event.timestamp >= target.start && event.timestamp < target.end);
      snapshots.push({
        key: target.key,
        epochStart: iso(target.start),
        epochEndOrObservation: target.status === 'completed' ? iso(target.end) : pulse.latest.observedAt,
        epochStatus: target.status,
        stateKnownAtEnd: stateKnown,
        sourceEventCountWithinEpoch: eventsWithin.length,
        sourceTransactionCountWithinEpoch: new Set(eventsWithin.map(event => event.transactionHash)).size,
        lastMutationAtOrBeforeEnd: lastMutation ? iso(lastMutation.timestamp) : null,
        lastMutationBlock: lastMutation?.blockNumber ?? null,
        lastMutationTransactionHash: lastMutation?.transactionHash ?? null,
        ...alloc
      });
    }

    const prior = snapshots.find(x => x.key === 'priorCompleted');
    const previous = snapshots.find(x => x.key === 'previousCompleted');
    const current = snapshots.find(x => x.key === 'currentToDate');
    const completedComparison = compareCompleted(prior, previous);
    if (!completedComparison.comparable) {
      throw new Error(`Two completed Aerodrome vote epochs are not reconstructably comparable: ${completedComparison.reason}`);
    }
    const currentParity = proveCurrentParity(pulse, current);

    pulse.voteEpochHistory = {
      version: '0.1-aerodrome-managed-vote-event-reconstruction',
      generatedAt: new Date().toISOString(),
      managedTokenId: managedTokenId.toString(),
      sourceCoverage: {
        method: 'conservative-recent-block-lookback-no-archive-state-read',
        minimumRequiredTimestamp: iso(requiredCoverageStart),
        fromBlock,
        lookbackBlocks: LOOKBACK_BLOCKS,
        toBlock: blockTag,
        toBlockHash: blockHash,
        eventCount: events.length,
        transactionCount: txGroups.length,
        firstObservedEventTimestamp: iso(events[0].timestamp),
        lastObservedEventTimestamp: iso(events.at(-1).timestamp),
        rpcEndpointClass: endpointClass
      },
      currentStateParity: currentParity,
      snapshots,
      completedEpochComparison: completedComparison,
      currentStateContext: {
        currentEpochStart: current.epochStart,
        currentEpochMutationCount: current.sourceTransactionCountWithinEpoch,
        currentStateKnown: current.stateKnownAtEnd,
        currentPoolCount: current.poolCount,
        currentTopAllocationPct: current.topAllocationPct,
        comparisonToCompletedEpochOutcome: 'not-attributed'
      },
      officialContractSource: {
        repository: SOURCE_REPO,
        commit: SOURCE_COMMIT,
        voter: 'contracts/Voter.sol',
        interface: 'contracts/interfaces/IVoter.sol',
        eventSemantics: 'Voted/Abstained events reconstruct Voter storage allocation transitions for managed tokenId'
      },
      semantics: {
        reconstructionBasis: 'ordered-onchain-Voted-and-Abstained-events',
        noHistoricalArchiveStateRequired: true,
        endOfEpochStateIsStorageAllocationSnapshot: true,
        voteTimestampDoesNotByItselfIdentifyRewardCausality: true,
        currentIncompleteEpochIsNotCompletedOutcome: true,
        allocationPercentagesAreNormalizedWithinManagedTokenVoteState: true
      },
      epistemic: {
        observationClass: 'direct-onchain-voter-event-reconstruction',
        stateTransitionClass: 'proven-by-official-Voter-reset-and-vote-accounting',
        completedEpochAllocationComparison: 'measured-event-reconstructed',
        currentStateParity: 'proven-against-same-block-voter-state',
        referenceAprConnection: 'not-attributed-by-this-overlay',
        rewardInflowConnection: 'not-attributed-by-this-overlay',
        companyOutcomeConnection: 'not-attributed-by-this-overlay',
        causalAttribution: 'unresolved-beyond-voter-state-transition-accounting',
        primaryDriver: null,
        predictionAuthority: 'none',
        promotionAuthority: 'none'
      }
    };

    pulse.semantics = {
      ...pulse.semantics,
      managedVoteEpochHistory: true,
      managedVoteHistoryIsEventReconstructed: true,
      voteAllocationChangeIsNotCausalAttribution: true
    };
    pulse.nextUnlocks = (pulse.nextUnlocks || []).filter(item => item !== 'historize managed vote allocation across epochs');
    if (!pulse.nextUnlocks.includes('relate completed-epoch vote allocation changes to fee/incentive inflow lanes without causal over-promotion')) {
      pulse.nextUnlocks.unshift('relate completed-epoch vote allocation changes to fee/incentive inflow lanes without causal over-promotion');
    }

    fs.writeFileSync(PULSE_FILE, `${JSON.stringify(pulse, null, 2)}\n`);
    console.log('AERODROME MANAGED VOTE EPOCH HISTORY PASS', {
      managedTokenId: managedTokenId.toString(),
      events: events.length,
      transactions: txGroups.length,
      priorPoolCount: prior.poolCount,
      previousPoolCount: previous.poolCount,
      currentPoolCount: current.poolCount,
      completedComparable: completedComparison.comparable,
      reallocatedPct: completedComparison.reallocatedPct,
      retainedAllocationPct: completedComparison.retainedAllocationPct,
      currentEpochMutationCount: current.sourceTransactionCountWithinEpoch,
      currentParity: currentParity.status,
      primaryDriver: pulse.voteEpochHistory.epistemic.primaryDriver,
      promotionAuthority: pulse.voteEpochHistory.epistemic.promotionAuthority
    });
  } finally {
    try { provider.destroy(); } catch {}
  }
}

try {
  await main();
} catch (error) {
  console.error(error?.stack || error);
  process.exit(1);
}
