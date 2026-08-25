#!/usr/bin/env node
/**
 * THE HOLDING · Aerodrome Epoch Flow Accounting Overlay v0.4
 *
 * Additive, read-only enrichment for the existing Aerodrome Managed Strategy
 * Pulse. Reads Aerodrome Reward.tokenRewardsPerEpoch at the exact Pulse block
 * for current-to-date plus two completed protocol epochs. It does not promote
 * Aerodrome into the canonical cohort set and does not treat contract-wide
 * reward inflows as Defitea-earned rewards.
 *
 * After the existing Market Breath + managed vote epoch-history chain has
 * completed, this same canonical overlay also builds a bounded descriptive
 * vote-flow context. Historical-only voted pools are resolved through exact-
 * Pulse-block Multicall3 reads of the Voter's single-assignment pool->gauge->
 * reward mappings, reward token lists and stored epoch inflows. Individual
 * call failures remain unknown/excluded and are never converted to zero.
 */
import fs from 'node:fs';
import process from 'node:process';
import { Contract, Interface, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const PULSE_FILE = process.env.AERODROME_PULSE_FILE || 'intelligence/economic-graph/aerodrome-managed-pulse.json';
const DURATION = 7 * 24 * 60 * 60;
const SOURCE_REPO = 'aerodrome-finance/contracts';
const SOURCE_COMMIT = '1ba30815bba620f7e9faa34769ffd00c214c9b82';
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL_ABI = [
  'function aggregate3(tuple(address target,bool allowFailure,bytes callData)[] calls) payable returns (tuple(bool success,bytes returnData)[] returnData)'
];

const VOTER_TOPOLOGY_ABI = [
  'function gauges(address pool) view returns (address)',
  'function gaugeToFees(address gauge) view returns (address)',
  'function gaugeToBribe(address gauge) view returns (address)'
];
const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)'
];
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];
const REWARD_ABI = [
  'function tokenRewardsPerEpoch(address token,uint256 epochStart) view returns (uint256)',
  'function rewardsListLength() view returns (uint256)',
  'function rewards(uint256 index) view returns (address)'
];
const VOTER_TOPOLOGY_IFACE = new Interface(VOTER_TOPOLOGY_ABI);
const POOL_IFACE = new Interface(POOL_ABI);
const ERC20_IFACE = new Interface(ERC20_ABI);
const REWARD_IFACE = new Interface(REWARD_ABI);

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
function unique(values) {
  return [...new Set(values.filter(Boolean).map(value => String(value).toLowerCase()))];
}
function rpcCandidates() {
  return [...new Set([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ].filter(Boolean))];
}
function historicalTopologyRpcCandidates() {
  return [...new Set([
    process.env.BASE_ARCHIVE_RPC_URL,
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base-rpc.publicnode.com'
  ].filter(Boolean))];
}
function rpcLabel(url) {
  if ([process.env.BASE_ARCHIVE_RPC_URL, process.env.BASE_RPC_URL, process.env.BASE_RPC_URL_2].includes(url)) return 'configured-secret';
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
async function providerForHistoricalTopology(pulse, probePool) {
  const blockTag = Number(pulse?.latest?.blockNumber);
  const blockHash = pulse?.latest?.blockHash;
  const voterAddress = getAddress(pulse?.latest?.contracts?.voter);
  const poolAddress = getAddress(probePool);
  let lastError = null;
  for (const url of historicalTopologyRpcCandidates()) {
    const provider = new JsonRpcProvider(url, 8453, { staticNetwork: true });
    try {
      const head = await provider.getBlockNumber();
      if (head < blockTag) throw new Error(`RPC head ${head} behind Pulse block ${blockTag}`);
      const block = await provider.getBlock(blockTag);
      if (!block || block.hash !== blockHash) throw new Error('Pulse block hash unavailable on historical topology RPC');
      const multicallCode = await provider.getCode(MULTICALL3, blockTag);
      if (!multicallCode || multicallCode === '0x') throw new Error('Multicall3 unavailable at exact Pulse block');
      const voter = new Contract(voterAddress, VOTER_TOPOLOGY_ABI, provider);
      await voter.gauges(poolAddress, { blockTag });
      return { provider, endpointClass: rpcLabel(url) };
    } catch (error) {
      lastError = error;
      try { provider.destroy(); } catch {}
    }
  }
  throw lastError || new Error('No Base RPC with exact-Pulse-block historical topology capability');
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
      for (const flow of row.epochInflows || []) target.rawByEpoch[flow.key] += BigInt(flow.amountRaw || '0');
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
function jointState(allocation, flow) { return `${allocation}|${flow}`; }
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

function decodeAddress(iface, method, result) {
  if (!result?.success) return null;
  try { return getAddress(iface.decodeFunctionResult(method, result.returnData)[0]); } catch { return null; }
}
function decodeBig(iface, method, result) {
  if (!result?.success) return null;
  try { return BigInt(iface.decodeFunctionResult(method, result.returnData)[0]); } catch { return null; }
}
function decodeUint(iface, method, result) {
  const value = decodeBig(iface, method, result);
  return value === null ? null : Number(value);
}
function decodeString(iface, method, result) {
  if (!result?.success) return null;
  try { return String(iface.decodeFunctionResult(method, result.returnData)[0]); } catch { return null; }
}
async function aggregate3(provider, calls, blockTag) {
  if (!calls.length) return [];
  const multicall = new Contract(MULTICALL3, MULTICALL_ABI, provider);
  return multicall.aggregate3.staticCall(calls, { blockTag });
}
function markFailure(item, reason) {
  if (!item.failureReason) item.failureReason = reason;
}

async function resolveHistoricalPoolContexts(provider, pulse, changes, epochs, blockTag) {
  const voterAddress = getAddress(pulse.latest.contracts.voter);
  const items = changes.map(change => ({ change, pool: getAddress(change.pool), feeTokens: [], bribeTokens: [] }));

  const gaugeResults = await aggregate3(provider, items.map(item => ({
    target: voterAddress,
    allowFailure: true,
    callData: VOTER_TOPOLOGY_IFACE.encodeFunctionData('gauges', [item.pool])
  })), blockTag);
  gaugeResults.forEach((result, index) => {
    const item = items[index];
    item.gauge = decodeAddress(VOTER_TOPOLOGY_IFACE, 'gauges', result);
    if (!item.gauge || item.gauge === ZeroAddress) markFailure(item, 'historical-pool-gauge-resolution-failed');
  });

  const mappingCalls = [];
  const mappingOwners = [];
  for (const item of items) {
    if (item.failureReason) continue;
    for (const lane of ['fee', 'bribe']) {
      const method = lane === 'fee' ? 'gaugeToFees' : 'gaugeToBribe';
      mappingCalls.push({ target: voterAddress, allowFailure: true, callData: VOTER_TOPOLOGY_IFACE.encodeFunctionData(method, [item.gauge]) });
      mappingOwners.push({ item, lane, method });
    }
  }
  const mappingResults = await aggregate3(provider, mappingCalls, blockTag);
  mappingResults.forEach((result, index) => {
    const { item, lane, method } = mappingOwners[index];
    const address = decodeAddress(VOTER_TOPOLOGY_IFACE, method, result);
    item[`${lane}Reward`] = address;
    if (!address || address === ZeroAddress) markFailure(item, `historical-${lane}-reward-mapping-failed`);
  });

  const poolCalls = [];
  const poolOwners = [];
  const lengthCalls = [];
  const lengthOwners = [];
  for (const item of items) {
    if (item.failureReason) continue;
    for (const method of ['token0', 'token1']) {
      poolCalls.push({ target: item.pool, allowFailure: true, callData: POOL_IFACE.encodeFunctionData(method, []) });
      poolOwners.push({ item, method });
    }
    for (const lane of ['fee', 'bribe']) {
      const address = item[`${lane}Reward`];
      lengthCalls.push({ target: address, allowFailure: true, callData: REWARD_IFACE.encodeFunctionData('rewardsListLength', []) });
      lengthOwners.push({ item, lane });
    }
  }
  const [poolResults, lengthResults] = await Promise.all([
    aggregate3(provider, poolCalls, blockTag),
    aggregate3(provider, lengthCalls, blockTag)
  ]);
  poolResults.forEach((result, index) => {
    const { item, method } = poolOwners[index];
    const address = decodeAddress(POOL_IFACE, method, result);
    item[method] = address;
    if (!address) item.poolTokenMetadataIncomplete = true;
  });
  lengthResults.forEach((result, index) => {
    const { item, lane } = lengthOwners[index];
    const count = decodeUint(REWARD_IFACE, 'rewardsListLength', result);
    item[`${lane}RewardTokenCount`] = count;
    if (!Number.isInteger(count) || count < 0 || count > 32) markFailure(item, `historical-${lane}-reward-token-list-length-failed`);
  });

  const tokenCalls = [];
  const tokenOwners = [];
  for (const item of items) {
    if (item.failureReason) continue;
    for (const lane of ['fee', 'bribe']) {
      const address = item[`${lane}Reward`];
      const count = item[`${lane}RewardTokenCount`];
      for (let index = 0; index < count; index++) {
        tokenCalls.push({ target: address, allowFailure: true, callData: REWARD_IFACE.encodeFunctionData('rewards', [index]) });
        tokenOwners.push({ item, lane, index });
      }
    }
  }
  const tokenResults = await aggregate3(provider, tokenCalls, blockTag);
  tokenResults.forEach((result, index) => {
    const { item, lane, index: tokenIndex } = tokenOwners[index];
    const token = decodeAddress(REWARD_IFACE, 'rewards', result);
    item[`${lane}Tokens`][tokenIndex] = token;
    if (!token) markFailure(item, `historical-${lane}-reward-token-read-failed`);
  });

  const rewardTokenAddresses = unique(items.flatMap(item => [...(item.feeTokens || []), ...(item.bribeTokens || [])]));
  const poolTokenAddresses = unique(items.flatMap(item => [item.token0, item.token1]));
  const metadataAddresses = unique([...rewardTokenAddresses, ...poolTokenAddresses]);
  const metadataCalls = [];
  const metadataOwners = [];
  for (const token of metadataAddresses) {
    const address = getAddress(token);
    metadataCalls.push({ target: address, allowFailure: true, callData: ERC20_IFACE.encodeFunctionData('symbol', []) });
    metadataOwners.push({ token: address, field: 'symbol' });
    metadataCalls.push({ target: address, allowFailure: true, callData: ERC20_IFACE.encodeFunctionData('decimals', []) });
    metadataOwners.push({ token: address, field: 'decimals' });
  }
  const metadataResults = await aggregate3(provider, metadataCalls, blockTag);
  const tokenMeta = new Map(metadataAddresses.map(token => [getAddress(token).toLowerCase(), { address: getAddress(token), symbol: null, decimals: null }]));
  metadataResults.forEach((result, index) => {
    const owner = metadataOwners[index];
    const meta = tokenMeta.get(owner.token.toLowerCase());
    if (!meta) return;
    if (owner.field === 'symbol') meta.symbol = decodeString(ERC20_IFACE, 'symbol', result);
    else meta.decimals = decodeUint(ERC20_IFACE, 'decimals', result);
  });
  for (const item of items) {
    if (item.failureReason) continue;
    for (const token of [...item.feeTokens, ...item.bribeTokens]) {
      const meta = tokenMeta.get(String(token).toLowerCase());
      if (!meta || !Number.isInteger(meta.decimals) || meta.decimals < 0 || meta.decimals > 255) {
        markFailure(item, 'historical-reward-token-decimals-unavailable');
        break;
      }
    }
  }

  const flowCalls = [];
  const flowOwners = [];
  for (const item of items) {
    if (item.failureReason) continue;
    item.flowRaw = { fee: new Map(), bribe: new Map() };
    for (const lane of ['fee', 'bribe']) {
      const rewardAddress = item[`${lane}Reward`];
      for (const token of item[`${lane}Tokens`]) {
        const key = String(token).toLowerCase();
        item.flowRaw[lane].set(key, new Map());
        for (const epoch of epochs) {
          flowCalls.push({
            target: rewardAddress,
            allowFailure: true,
            callData: REWARD_IFACE.encodeFunctionData('tokenRewardsPerEpoch', [token, epoch.epochStart])
          });
          flowOwners.push({ item, lane, token, epoch });
        }
      }
    }
  }
  const flowResults = await aggregate3(provider, flowCalls, blockTag);
  flowResults.forEach((result, index) => {
    const { item, lane, token, epoch } = flowOwners[index];
    const raw = decodeBig(REWARD_IFACE, 'tokenRewardsPerEpoch', result);
    if (raw === null) {
      markFailure(item, `historical-${lane}-epoch-storage-read-failed`);
      return;
    }
    item.flowRaw[lane].get(String(token).toLowerCase()).set(epoch.key, raw);
  });

  const rows = [];
  const excluded = [];
  for (const item of items) {
    if (item.failureReason) {
      excluded.push({
        pool: item.pool,
        pair: item.change.pair ?? null,
        reason: item.failureReason,
        treatment: 'excluded-not-zero'
      });
      continue;
    }
    function rewardState(lane) {
      const address = item[`${lane}Reward`];
      const rewards = item[`${lane}Tokens`].map(token => {
        const meta = tokenMeta.get(String(token).toLowerCase());
        const rawByEpoch = item.flowRaw[lane].get(String(token).toLowerCase());
        return {
          token: getAddress(token),
          symbol: meta.symbol || 'TOKEN',
          decimals: meta.decimals,
          stateClass: 'historical-pool-reward-token-discovered-at-pulse-block-multicall',
          epochInflows: epochs.map(epoch => {
            const raw = rawByEpoch.get(epoch.key);
            return {
              key: epoch.key,
              epochStart: epoch.epochStartIso,
              epochStatus: epoch.status,
              amountRaw: raw.toString(),
              amount: round(Number(formatUnits(raw, meta.decimals)), 12),
              stateClass: 'onchain-tokenRewardsPerEpoch-same-block-multicall'
            };
          })
        };
      });
      return {
        address,
        rewardTokenCount: rewards.length,
        rewards,
        issues: [],
        epochAccountingClass: 'proven-reward-contract-accounting'
      };
    }
    const feeState = rewardState('fee');
    const bribeState = rewardState('bribe');
    const token0Meta = item.token0 ? tokenMeta.get(String(item.token0).toLowerCase()) : null;
    const token1Meta = item.token1 ? tokenMeta.get(String(item.token1).toLowerCase()) : null;
    const pair = item.change.pair ?? (token0Meta && token1Meta ? `${token0Meta.symbol || 'TOKEN'}/${token1Meta.symbol || 'TOKEN'}` : null);
    rows.push({
      pool: item.pool,
      pair,
      voteState: item.change.state,
      allocationDirection: allocationDirection(item.change.state),
      priorCompletedAllocationPct: Number(item.change.priorCompletedAllocationPct || 0),
      previousCompletedAllocationPct: Number(item.change.previousCompletedAllocationPct || 0),
      allocationDeltaPctPoints: Number(item.change.deltaPctPoints || 0),
      coverageClass: 'historical-pool-reward-contract-topology-resolved-at-pulse-block-multicall',
      topology: {
        gauge: item.gauge,
        feeVotingReward: item.feeReward,
        bribeVotingReward: item.bribeReward,
        poolTokens: [item.token0, item.token1].filter(Boolean),
        poolTokenMetadataComplete: !item.poolTokenMetadataIncomplete,
        sourceClass: 'voter-single-assignment-createGauge-mappings-from-pinned-source-exact-block-multicall'
      },
      feeInflows: rewardLaneContext(feeState),
      incentiveInflows: rewardLaneContext(bribeState)
    });
  }
  return {
    rows,
    excluded,
    diagnostics: {
      requestedHistoricalPoolCount: changes.length,
      resolvedHistoricalPoolCount: rows.length,
      excludedHistoricalPoolCount: excluded.length,
      rewardTokenReadCount: tokenCalls.length,
      epochStorageReadCount: flowCalls.length,
      readClass: 'exact-pulse-block-bounded-multicall3'
    }
  };
}

async function addVoteFlowContext() {
  const pulse = readJson(PULSE_FILE);
  const vote = pulse.voteEpochHistory?.completedEpochComparison;
  const flow = pulse.epochFlowAccounting;
  if (pulse.voteEpochHistory?.version !== '0.1-aerodrome-managed-vote-event-reconstruction' || vote?.comparable !== true) throw new Error('Comparable managed vote epoch history required for vote-flow context');
  if (flow?.version !== '0.1-aerodrome-reward-epoch-accounting' || pulse.marketBreath?.version !== '0.1-aerodrome-completed-epoch-directional-breadth') throw new Error('Completed-epoch reward accounting and Market Breath required for vote-flow context');
  if (pulse.authority?.executionAuthority !== 'none' || pulse.authority?.promotionAuthority !== 'none' || pulse.authority?.causalClaimAuthority !== 'none') throw new Error('Vote-flow context refuses expanded authority');
  if (vote.priorCompletedEpochStart !== flow.epochs?.find(x => x.key === 'priorCompleted')?.epochStartIso || vote.previousCompletedEpochStart !== flow.epochs?.find(x => x.key === 'previousCompleted')?.epochStartIso) throw new Error('Vote and reward-flow completed-epoch boundaries do not match');

  const currentPools = new Map((pulse.latest?.pools || []).map(pool => [String(pool.pool).toLowerCase(), pool]));
  const allVoteChanges = Array.isArray(vote.allChanges) ? vote.allChanges : [];
  const currentRows = [];
  const historicalChanges = [];
  for (const change of allVoteChanges) {
    const pool = currentPools.get(String(change.pool).toLowerCase());
    if (!pool) {
      historicalChanges.push(change);
      continue;
    }
    currentRows.push({
      pool: change.pool,
      pair: change.pair ?? pool.pair ?? null,
      voteState: change.state,
      allocationDirection: allocationDirection(change.state),
      priorCompletedAllocationPct: Number(change.priorCompletedAllocationPct || 0),
      previousCompletedAllocationPct: Number(change.previousCompletedAllocationPct || 0),
      allocationDeltaPctPoints: Number(change.deltaPctPoints || 0),
      coverageClass: 'current-pulse-reward-contract-universe',
      feeInflows: rewardLaneContext(pool.feeVotingReward),
      incentiveInflows: rewardLaneContext(pool.bribeVotingReward)
    });
  }

  let historicalRows = [];
  let excluded = [];
  let historicalResolutionDiagnostics = null;
  let historicalTopologyRpcEndpointClass = null;
  if (historicalChanges.length > 0) {
    const epochs = protocolEpochs(pulse);
    const blockTag = Number(pulse.latest?.blockNumber);
    const { provider, endpointClass } = await providerForHistoricalTopology(pulse, historicalChanges[0].pool);
    historicalTopologyRpcEndpointClass = endpointClass;
    try {
      const resolved = await resolveHistoricalPoolContexts(provider, pulse, historicalChanges, epochs, blockTag);
      historicalRows = resolved.rows;
      excluded = resolved.excluded;
      historicalResolutionDiagnostics = resolved.diagnostics;
    } finally {
      try { provider.destroy(); } catch {}
    }
  }

  const rows = [...currentRows, ...historicalRows];
  const comparisonPoolCount = allVoteChanges.length;
  const matchedPoolCount = rows.length;
  pulse.voteFlowContext = {
    version: '0.3-aerodrome-completed-epoch-vote-flow-full-multicall-context',
    generatedAt: new Date().toISOString(),
    basis: {
      priorCompletedEpochStart: vote.priorCompletedEpochStart,
      previousCompletedEpochStart: vote.previousCompletedEpochStart,
      comparisonClass: 'completed-epoch-vote-allocation-vs-completed-epoch-reward-lane-direction',
      currentIncompleteEpochExcluded: true
    },
    coverage: {
      voteComparisonPoolCount: comparisonPoolCount,
      matchedCurrentRewardContractPoolCount: currentRows.length,
      historicalOnlyVotePoolCount: historicalChanges.length,
      matchedHistoricalRewardContractPoolCount: historicalRows.length,
      matchedRewardContractPoolCount: matchedPoolCount,
      excludedHistoricalOnlyPoolCount: excluded.length,
      matchedCoveragePct: comparisonPoolCount > 0 ? round(matchedPoolCount / comparisonPoolCount * 100, 8) : null,
      missingHistoricalPoolTreatment: 'excluded-not-zero',
      historicalTopologyResolutionClass: 'exact-pulse-block-bounded-multicall-voter-single-assignment-mappings-plus-stored-tokenRewardsPerEpoch',
      historicalTopologyRpcEndpointClass,
      historicalResolutionDiagnostics,
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
      historicalRewardContractTopology: 'proven-by-exact-block-multicall-voter-mappings-and-pinned-createGauge-source',
      officialSourceRepository: SOURCE_REPO,
      officialSourceCommit: SOURCE_COMMIT,
      equalTokenLaneDirectionOnly: true,
      heterogeneousTokenAmountsNotSummed: true,
      unresolvedHistoricalPoolsAreUnknownNotZero: true,
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
    historicalRewardTopologyUsesPinnedSingleAssignmentMappings: true,
    historicalTopologyRpcCapabilityProbed: true,
    historicalTopologyUsesBoundedExactBlockMulticall: true,
    missingHistoricalPoolsAreNotZeroed: true,
    fullHistoricalRewardContractCoverage: excluded.length === 0
  };
  const coverageUnlock = 'expand reward-contract coverage to historical-only voted pools before full pool-universe vote-flow association';
  pulse.nextUnlocks = (pulse.nextUnlocks || [])
    .filter(item => item !== 'relate completed-epoch vote allocation changes to fee/incentive inflow lanes without causal over-promotion')
    .filter(item => item !== coverageUnlock);
  if (excluded.length > 0 && !pulse.nextUnlocks.includes(coverageUnlock)) pulse.nextUnlocks.unshift(coverageUnlock);
  else if (excluded.length === 0) {
    const observationUnlock = 'accumulate additional completed-epoch vote-flow transitions before any statistical relationship test';
    if (!pulse.nextUnlocks.includes(observationUnlock)) pulse.nextUnlocks.unshift(observationUnlock);
  }

  fs.writeFileSync(PULSE_FILE, `${JSON.stringify(pulse, null, 2)}\n`);
  console.log('AERODROME VOTE-FLOW CONTEXT PASS', {
    priorCompleted: vote.priorCompletedEpochStart,
    previousCompleted: vote.previousCompletedEpochStart,
    voteComparisonPools: comparisonPoolCount,
    matchedCurrentPools: currentRows.length,
    historicalOnlyPools: historicalChanges.length,
    matchedHistoricalPools: historicalRows.length,
    excludedHistoricalOnlyPools: excluded.length,
    matchedCoveragePct: pulse.voteFlowContext.coverage.matchedCoveragePct,
    historicalTopologyRpcEndpointClass,
    historicalReadClass: historicalResolutionDiagnostics?.readClass ?? null,
    historicalRewardTokenReads: historicalResolutionDiagnostics?.rewardTokenReadCount ?? 0,
    historicalEpochStorageReads: historicalResolutionDiagnostics?.epochStorageReadCount ?? 0,
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
  if (pulse.version !== '0.1-aerodrome-managed-strategy-pulse' || pulse.status !== 'shadow-measured-not-promoted') throw new Error('Aerodrome Managed Strategy Pulse v0.1 shadow artifact required');
  if (pulse.authority?.executionAuthority !== 'none' || pulse.authority?.promotionAuthority !== 'none') throw new Error('Epoch overlay refuses expanded Pulse authority');
  const blockTag = Number(pulse?.latest?.blockNumber);
  if (!Number.isInteger(blockTag) || blockTag <= 0 || pulse?.latest?.provenance?.sameBlockRead !== true) throw new Error('Exact same-block Pulse provenance required');
  const epochs = protocolEpochs(pulse);
  const { provider, endpointClass } = await providerWithFallback();
  try {
    const block = await provider.getBlock(blockTag);
    if (!block || block.hash !== pulse.latest.blockHash) throw new Error('Pulse block hash no longer matches canonical Base block');

    for (const pool of pulse.latest.pools || []) {
      pool.feeVotingReward = await enrichRewardState(provider, pool.feeVotingReward, epochs, blockTag);
      pool.bribeVotingReward = await enrichRewardState(provider, pool.bribeVotingReward, epochs, blockTag);
    }
    pulse.latest.depositorManagedRewards.locked = await enrichRewardState(provider, pulse.latest.depositorManagedRewards.locked, epochs, blockTag);
    pulse.latest.depositorManagedRewards.free = await enrichRewardState(provider, pulse.latest.depositorManagedRewards.free, epochs, blockTag);

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
