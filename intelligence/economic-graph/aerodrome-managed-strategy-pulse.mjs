#!/usr/bin/env node
/**
 * THE HOLDING · Aerodrome Managed Strategy Pulse v0.1
 *
 * Read-only same-block observation of the protocol-economic machinery around
 * Defitea's Aerodrome managed veNFT. This is SHADOW evidence: it does not
 * promote Aerodrome into the canonical Economic Graph cohort set, does not
 * claim why Reference APR changed, and has no execution/recommendation authority.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const ROOT = process.cwd();
const GRAPH_FILE = process.env.ECONOMIC_GRAPH_FILE || path.join(ROOT, 'intelligence/economic-graph/economic-graph.json');
const OUT = process.env.AERODROME_PULSE_FILE || path.join(ROOT, 'intelligence/economic-graph/aerodrome-managed-pulse.json');
const CANDIDATE_ID = 'defitea-aerodrome-veaero';
const HISTORY_LIMIT = 60;

const ADDR = Object.freeze({
  aero: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  votingEscrow: '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4',
  rewardsDistributor: '0x227f65131A261548b057215bB1D5Ab2997964C7d',
  voter: '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5',
  minter: '0xeB018363F0a9Af8f91F06FEe6613a751b2A33FE5',
  managedRewardsFactory: '0xFdA1fb5A2a5B23638C7017950506a36dcFD2bDC3',
  votingRewardsFactory: '0x45cA74858C579E717ee29A86042E0d53B252B504'
});

const VOTER_ABI = [
  'function totalWeight() view returns (uint256)',
  'function maxVotingNum() view returns (uint256)',
  'function poolVote(uint256 tokenId,uint256 index) view returns (address)',
  'function votes(uint256 tokenId,address pool) view returns (uint256)',
  'function usedWeights(uint256 tokenId) view returns (uint256)',
  'function lastVoted(uint256 tokenId) view returns (uint256)',
  'function gauges(address pool) view returns (address)',
  'function gaugeToFees(address gauge) view returns (address)',
  'function gaugeToBribe(address gauge) view returns (address)',
  'function weights(address pool) view returns (uint256)',
  'function isAlive(address gauge) view returns (bool)',
  'function claimable(address gauge) view returns (uint256)'
];
const VE_ABI = [
  'function balanceOfNFT(uint256 tokenId) view returns (uint256)',
  'function idToManaged(uint256 tokenId) view returns (uint256)',
  'function managedToLocked(uint256 managedTokenId) view returns (address)',
  'function managedToFree(uint256 managedTokenId) view returns (address)'
];
const MINTER_ABI = [
  'function weekly() view returns (uint256)',
  'function activePeriod() view returns (uint256)',
  'function epochCount() view returns (uint256)',
  'function tailEmissionRate() view returns (uint256)',
  'function teamRate() view returns (uint256)'
];
const GAUGE_ABI = [
  'function rewardRate() view returns (uint256)',
  'function periodFinish() view returns (uint256)',
  'function left() view returns (uint256)',
  'function fees0() view returns (uint256)',
  'function fees1() view returns (uint256)'
];
const POOL_ABI = [
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function stable() view returns (bool)'
];
const REWARD_ABI = [
  'function rewardsListLength() view returns (uint256)',
  'function rewards(uint256 index) view returns (address)',
  'function earned(address token,uint256 tokenId) view returns (uint256)'
];
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];

function readJson(file, required = true) {
  try {
    const raw = fs.readFileSync(file, 'utf8');
    if (!raw.trim() && !required) return null;
    return JSON.parse(raw);
  } catch (error) {
    if (!required && error?.code === 'ENOENT') return null;
    throw error;
  }
}
function sha256File(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function sha256Text(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function round(value, digits = 10) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(digits));
}
function pct(part, whole) {
  const p = Number(part), w = Number(whole);
  if (!Number.isFinite(p) || !Number.isFinite(w) || w === 0) return null;
  return round(p / w * 100, 8);
}
function isoFromSeconds(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
}
function unique(values) { return [...new Set(values.filter(Boolean).map(x => String(x).toLowerCase()))]; }

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

const tokenMetaCache = new Map();
async function tokenMeta(provider, address, blockTag) {
  const normalized = getAddress(address);
  const key = normalized.toLowerCase();
  if (tokenMetaCache.has(key)) return tokenMetaCache.get(key);
  const c = new Contract(normalized, ERC20_ABI, provider);
  const [symbol, decimalsRaw] = await Promise.all([
    c.symbol({ blockTag }).catch(() => 'TOKEN'),
    c.decimals({ blockTag }).catch(() => 18)
  ]);
  const meta = { address: normalized, symbol: String(symbol || 'TOKEN'), decimals: Number(decimalsRaw) };
  tokenMetaCache.set(key, meta);
  return meta;
}

async function rewardState(provider, rewardAddress, tokenId, blockTag, { fallbackTokens = [] } = {}) {
  if (!rewardAddress || rewardAddress === ZeroAddress) return { address: ZeroAddress, rewards: [], issues: ['reward-contract-zero-address'] };
  const address = getAddress(rewardAddress);
  const reward = new Contract(address, REWARD_ABI, provider);
  const issues = [];
  let length = 0;
  try { length = Math.min(Number(await reward.rewardsListLength({ blockTag })), 32); }
  catch (error) { issues.push(`rewardsListLength: ${error.shortMessage || error.message}`); }

  const tokens = [];
  for (let i = 0; i < length; i++) {
    try { tokens.push(getAddress(await reward.rewards(i, { blockTag }))); }
    catch (error) { issues.push(`rewards(${i}): ${error.shortMessage || error.message}`); }
  }
  for (const token of fallbackTokens) {
    try { tokens.push(getAddress(token)); } catch {}
  }

  const rows = [];
  for (const token of unique(tokens)) {
    try {
      const meta = await tokenMeta(provider, token, blockTag);
      const raw = await reward.earned(meta.address, tokenId, { blockTag });
      rows.push({
        token: meta.address,
        symbol: meta.symbol,
        decimals: meta.decimals,
        amountRaw: raw.toString(),
        amount: round(Number(formatUnits(raw, meta.decimals)), 12),
        stateClass: 'onchain-earned-current-block'
      });
    } catch (error) {
      issues.push(`earned(${token},${tokenId}): ${error.shortMessage || error.message}`);
    }
  }
  return { address, rewardTokenCount: rows.length, rewards: rows, issues };
}

async function collectPool(provider, voter, pool, managedTokenId, usedWeight, totalWeight, blockTag) {
  const issues = [];
  const poolAddress = getAddress(pool);
  const [voteWeightRaw, poolWeightRaw, gaugeRaw] = await Promise.all([
    voter.votes(managedTokenId, poolAddress, { blockTag }),
    voter.weights(poolAddress, { blockTag }),
    voter.gauges(poolAddress, { blockTag })
  ]);
  const voteWeight = BigInt(voteWeightRaw);
  const poolWeight = BigInt(poolWeightRaw);
  const gauge = getAddress(gaugeRaw);
  if (gauge === ZeroAddress) throw new Error(`Managed veNFT voted pool ${poolAddress} has no gauge`);

  const [feeRewardRaw, bribeRewardRaw, alive, gaugeClaimableRaw] = await Promise.all([
    voter.gaugeToFees(gauge, { blockTag }),
    voter.gaugeToBribe(gauge, { blockTag }),
    voter.isAlive(gauge, { blockTag }),
    voter.claimable(gauge, { blockTag })
  ]);
  const feeReward = getAddress(feeRewardRaw);
  const bribeReward = getAddress(bribeRewardRaw);

  const poolContract = new Contract(poolAddress, POOL_ABI, provider);
  const gaugeContract = new Contract(gauge, GAUGE_ABI, provider);
  const [token0Raw, token1Raw, stableRaw, rewardRateRaw, periodFinishRaw, leftRaw, fees0Raw, fees1Raw] = await Promise.all([
    poolContract.token0({ blockTag }),
    poolContract.token1({ blockTag }),
    poolContract.stable({ blockTag }).catch(error => { issues.push(`stable() unsupported: ${error.shortMessage || error.message}`); return null; }),
    gaugeContract.rewardRate({ blockTag }).catch(() => null),
    gaugeContract.periodFinish({ blockTag }).catch(() => null),
    gaugeContract.left({ blockTag }).catch(() => null),
    gaugeContract.fees0({ blockTag }).catch(() => null),
    gaugeContract.fees1({ blockTag }).catch(() => null)
  ]);
  const token0 = await tokenMeta(provider, token0Raw, blockTag);
  const token1 = await tokenMeta(provider, token1Raw, blockTag);

  const [feesState, bribesState] = await Promise.all([
    rewardState(provider, feeReward, managedTokenId, blockTag),
    rewardState(provider, bribeReward, managedTokenId, blockTag)
  ]);
  issues.push(...feesState.issues.map(x => `fees:${x}`), ...bribesState.issues.map(x => `bribes:${x}`));

  const fee0 = fees0Raw === null ? null : round(Number(formatUnits(fees0Raw, token0.decimals)), 12);
  const fee1 = fees1Raw === null ? null : round(Number(formatUnits(fees1Raw, token1.decimals)), 12);
  const gaugeClaimableAero = round(Number(formatUnits(gaugeClaimableRaw, 18)), 12);
  const gaugeRewardRateAeroPerSecond = rewardRateRaw === null ? null : round(Number(formatUnits(rewardRateRaw, 18)), 14);
  const gaugeLeftAero = leftRaw === null ? null : round(Number(formatUnits(leftRaw, 18)), 12);
  const poolImplementationClass = stableRaw === null ? 'non-legacy-or-unclassified' : (Boolean(stableRaw) ? 'legacy-stable' : 'legacy-volatile');

  return {
    pool: poolAddress,
    poolImplementationClass,
    stable: stableRaw === null ? null : Boolean(stableRaw),
    pair: `${token0.symbol}/${token1.symbol}`,
    tokens: [token0, token1],
    managedVoteWeightRaw: voteWeight.toString(),
    poolTotalVoteWeightRaw: poolWeight.toString(),
    managedAllocationPct: pct(voteWeight, usedWeight),
    managedShareOfPoolVotePct: pct(voteWeight, poolWeight),
    poolShareOfSystemVotePct: pct(poolWeight, totalWeight),
    gauge: {
      address: gauge,
      alive: Boolean(alive),
      voterClaimableAero: gaugeClaimableAero,
      rewardRateAeroPerSecond: gaugeRewardRateAeroPerSecond,
      rewardRateAeroPerWeek: gaugeRewardRateAeroPerSecond === null ? null : round(gaugeRewardRateAeroPerSecond * 604800, 10),
      leftAero: gaugeLeftAero,
      periodFinish: periodFinishRaw === null ? null : isoFromSeconds(periodFinishRaw),
      cachedPoolFees: [
        { token: token0.address, symbol: token0.symbol, amount: fee0 },
        { token: token1.address, symbol: token1.symbol, amount: fee1 }
      ]
    },
    feeVotingReward: feesState,
    bribeVotingReward: bribesState,
    issues,
    epistemic: {
      poolImplementation: stableRaw === null ? 'measured-core-interface-with-optional-style-unresolved' : 'measured-legacy-style',
      voteToRewardDeposit: 'proven-onchain-contract-relationship',
      gaugeEmissionState: 'measured-current-block',
      feeAndBribeEarned: 'measured-current-block-managed-venft-voter-context',
      upstreamCause: 'unresolved'
    }
  };
}

function summarizeObservation(obs) {
  return {
    observationId: obs.id,
    observedAt: obs.observedAt,
    blockNumber: obs.blockNumber,
    blockHash: obs.blockHash,
    managedTokenId: obs.identity.managedTokenId,
    managedVotingPowerRaw: obs.voting.managedVotingPowerRaw,
    usedVotingWeightRaw: obs.voting.usedVotingWeightRaw,
    usedVotingPowerPct: obs.voting.usedVotingPowerPct,
    votedPoolCount: obs.voting.votedPoolCount,
    totalGaugeClaimableAero: obs.aggregates.totalGaugeClaimableAero,
    totalGaugeWeeklyEmissionRateAero: obs.aggregates.totalGaugeWeeklyEmissionRateAero,
    depositorLockedManagedAero: obs.depositorManagedRewards.lockedAeroAmount,
    poolVotes: obs.pools.map(p => ({ pool: p.pool, pair: p.pair, managedVoteWeightRaw: p.managedVoteWeightRaw, managedAllocationPct: p.managedAllocationPct }))
  };
}
function movement(current, prior) {
  if (!prior) return { priorObservationId: null, comparable: false, reason: 'first-pulse-observation' };
  const byPool = new Map((prior.poolVotes || []).map(p => [p.pool.toLowerCase(), p]));
  const currentPools = new Set(current.pools.map(p => p.pool.toLowerCase()));
  const allocationChanges = current.pools.map(p => {
    const prev = byPool.get(p.pool.toLowerCase());
    return {
      pool: p.pool,
      pair: p.pair,
      priorAllocationPct: prev?.managedAllocationPct ?? null,
      currentAllocationPct: p.managedAllocationPct,
      deltaPctPoints: prev?.managedAllocationPct === null || prev?.managedAllocationPct === undefined ? null : round(p.managedAllocationPct - prev.managedAllocationPct, 8),
      state: prev ? 'continued' : 'newly-voted'
    };
  });
  for (const p of prior.poolVotes || []) {
    if (!currentPools.has(p.pool.toLowerCase())) allocationChanges.push({ pool: p.pool, pair: p.pair, priorAllocationPct: p.managedAllocationPct, currentAllocationPct: 0, deltaPctPoints: round(-Number(p.managedAllocationPct || 0), 8), state: 'no-longer-voted' });
  }
  return {
    priorObservationId: prior.observationId,
    comparable: true,
    elapsedHours: round((Date.parse(current.observedAt) - Date.parse(prior.observedAt)) / 3600000, 6),
    votedPoolCountDelta: current.voting.votedPoolCount - Number(prior.votedPoolCount || 0),
    usedVotingPowerPctDeltaPoints: prior.usedVotingPowerPct === null ? null : round(current.voting.usedVotingPowerPct - Number(prior.usedVotingPowerPct), 8),
    totalGaugeClaimableAeroDelta: round(current.aggregates.totalGaugeClaimableAero - Number(prior.totalGaugeClaimableAero || 0), 12),
    totalGaugeWeeklyEmissionRateAeroDelta: round(current.aggregates.totalGaugeWeeklyEmissionRateAero - Number(prior.totalGaugeWeeklyEmissionRateAero || 0), 10),
    depositorLockedManagedAeroDelta: round(current.depositorManagedRewards.lockedAeroAmount - Number(prior.depositorLockedManagedAero || 0), 12),
    allocationChanges
  };
}

async function buildPulse() {
  const graph = readJson(GRAPH_FILE);
  const candidateLayer = graph?.candidateLayer;
  const candidate = graph?.candidateCohorts?.[CANDIDATE_ID];
  const candidateObs = candidate?.latest?.observation;
  const candidateIds = Array.isArray(candidateLayer?.candidateIds) ? candidateLayer.candidateIds : [];
  if (
    candidateLayer?.status !== 'shadow-admission-active' ||
    candidateLayer?.canonicalCohortCountUnchanged !== true ||
    !candidateIds.includes(CANDIDATE_ID) ||
    candidate?.status !== 'shadow-measured-not-promoted' ||
    !candidateObs
  ) {
    throw new Error('Active Aerodrome shadow candidate is required before Managed Strategy Pulse');
  }
  if (Number(graph?.coverage?.cohortCount) !== 2 || candidateLayer?.promotionAuthority !== 'none') {
    throw new Error('Managed Strategy Pulse refuses changed canonical/promotion authority');
  }
  const depositorTokenId = BigInt(candidateObs.actualManagedVeNft?.positions?.[0]?.tokenId || 0);
  const managedTokenId = BigInt(candidateObs.actualManagedVeNft?.positions?.[0]?.managedTokenId || 0);
  if (depositorTokenId <= 0n || managedTokenId <= 0n) throw new Error('Aerodrome depositor/managed token identity unavailable');

  const { provider, endpointClass } = await providerWithFallback();
  try {
    const blockNumber = await provider.getBlockNumber();
    const block = await provider.getBlock(blockNumber);
    if (!block) throw new Error(`Base block ${blockNumber} unavailable`);
    const blockTag = blockNumber;
    const voter = new Contract(ADDR.voter, VOTER_ABI, provider);
    const ve = new Contract(ADDR.votingEscrow, VE_ABI, provider);
    const minter = new Contract(ADDR.minter, MINTER_ABI, provider);

    const [managedBinding, lockedRewardRaw, freeRewardRaw, totalWeightRaw, maxVotingNumRaw, usedWeightRaw, lastVotedRaw, managedVotingPowerRaw, weeklyRaw, activePeriodRaw, epochCountRaw, tailRateRaw, teamRateRaw] = await Promise.all([
      ve.idToManaged(depositorTokenId, { blockTag }),
      ve.managedToLocked(managedTokenId, { blockTag }),
      ve.managedToFree(managedTokenId, { blockTag }),
      voter.totalWeight({ blockTag }),
      voter.maxVotingNum({ blockTag }),
      voter.usedWeights(managedTokenId, { blockTag }),
      voter.lastVoted(managedTokenId, { blockTag }),
      ve.balanceOfNFT(managedTokenId, { blockTag }),
      minter.weekly({ blockTag }),
      minter.activePeriod({ blockTag }),
      minter.epochCount({ blockTag }),
      minter.tailEmissionRate({ blockTag }),
      minter.teamRate({ blockTag })
    ]);
    if (BigInt(managedBinding) !== managedTokenId) throw new Error('Live VotingEscrow managed binding diverged from canonical candidate');
    const lockedReward = getAddress(lockedRewardRaw);
    const freeReward = getAddress(freeRewardRaw);
    const candidateLocked = getAddress(candidateObs.actualManagedVeNft.positions[0].lockedManagedReward);
    const candidateFree = getAddress(candidateObs.actualManagedVeNft.positions[0].freeManagedReward);
    if (lockedReward !== candidateLocked || freeReward !== candidateFree) throw new Error('Live managed reward contracts diverged from canonical candidate identity');

    const totalWeight = BigInt(totalWeightRaw);
    const usedWeight = BigInt(usedWeightRaw);
    const managedVotingPower = BigInt(managedVotingPowerRaw);
    const maxVotingNum = Math.min(Number(maxVotingNumRaw), 64);
    if (!Number.isFinite(maxVotingNum) || maxVotingNum < 1) throw new Error('Invalid Aerodrome maxVotingNum');

    const votedPools = [];
    for (let i = 0; i < maxVotingNum; i++) {
      try {
        const pool = getAddress(await voter.poolVote(managedTokenId, i, { blockTag }));
        if (!pool || pool === ZeroAddress) break;
        votedPools.push(pool);
      } catch { break; }
    }

    const pools = [];
    for (const pool of votedPools) pools.push(await collectPool(provider, voter, pool, managedTokenId, usedWeight, totalWeight, blockTag));

    const [lockedManagedState, freeManagedState] = await Promise.all([
      rewardState(provider, lockedReward, depositorTokenId, blockTag, { fallbackTokens: [ADDR.aero] }),
      rewardState(provider, freeReward, depositorTokenId, blockTag)
    ]);
    const lockedAero = lockedManagedState.rewards.find(r => r.token.toLowerCase() === ADDR.aero.toLowerCase())?.amount ?? 0;
    const totalGaugeClaimableAero = round(pools.reduce((sum, p) => sum + Number(p.gauge.voterClaimableAero || 0), 0), 12);
    const totalGaugeWeeklyEmissionRateAero = round(pools.reduce((sum, p) => sum + Number(p.gauge.rewardRateAeroPerWeek || 0), 0), 10);

    const observation = {
      id: `aerodrome-managed-pulse:${blockNumber}:${sha256Text(`${managedTokenId}:${block.hash}`).slice(0, 20)}`,
      observedAt: new Date(Number(block.timestamp) * 1000).toISOString(),
      blockNumber,
      blockHash: block.hash,
      chain: 'Base',
      identity: {
        companyRegistry: '004',
        company: 'defitea.eth',
        protocol: 'Aerodrome',
        depositorTokenId: depositorTokenId.toString(),
        managedTokenId: managedTokenId.toString()
      },
      contracts: {
        aero: ADDR.aero,
        votingEscrow: ADDR.votingEscrow,
        voter: ADDR.voter,
        minter: ADDR.minter,
        rewardsDistributor: ADDR.rewardsDistributor,
        managedRewardsFactory: ADDR.managedRewardsFactory,
        votingRewardsFactory: ADDR.votingRewardsFactory,
        lockedManagedReward: lockedReward,
        freeManagedReward: freeReward
      },
      protocolEpoch: {
        weeklyAeroRaw: weeklyRaw.toString(),
        weeklyAero: round(Number(formatUnits(weeklyRaw, 18)), 8),
        activePeriod: isoFromSeconds(activePeriodRaw),
        epochCount: Number(epochCountRaw),
        tailEmissionRateRaw: Number(tailRateRaw),
        teamRateRaw: Number(teamRateRaw),
        stateClass: 'measured-current-block-protocol-emission-context'
      },
      voting: {
        managedVotingPowerRaw: managedVotingPower.toString(),
        usedVotingWeightRaw: usedWeight.toString(),
        systemTotalVoteWeightRaw: totalWeight.toString(),
        managedVotingPower: round(Number(formatUnits(managedVotingPower, 18)), 8),
        usedVotingWeight: round(Number(formatUnits(usedWeight, 18)), 8),
        systemTotalVoteWeight: round(Number(formatUnits(totalWeight, 18)), 8),
        usedVotingPowerPct: pct(usedWeight, managedVotingPower),
        managedShareOfSystemVotePct: pct(usedWeight, totalWeight),
        lastVoted: isoFromSeconds(lastVotedRaw),
        maxVotingNum,
        votedPoolCount: pools.length,
        stateClass: 'measured-current-block-managed-venft-voting-state'
      },
      pools,
      depositorManagedRewards: {
        depositorTokenId: depositorTokenId.toString(),
        locked: lockedManagedState,
        free: freeManagedState,
        lockedAeroAmount: round(Number(lockedAero), 12),
        priorCanonicalCandidateLockedAero: round(Number(candidateObs.actualManagedVeNft.currentAccruedAero), 12),
        deltaFromPriorCandidateSnapshotAero: round(Number(lockedAero) - Number(candidateObs.actualManagedVeNft.currentAccruedAero), 12),
        stateClass: 'measured-current-block-depositor-managed-reward-state'
      },
      aggregates: {
        totalGaugeClaimableAero,
        totalGaugeWeeklyEmissionRateAero,
        feeVotingRewardTokenRows: pools.reduce((sum, p) => sum + p.feeVotingReward.rewards.length, 0),
        bribeVotingRewardTokenRows: pools.reduce((sum, p) => sum + p.bribeVotingReward.rewards.length, 0),
        poolIssueCount: pools.reduce((sum, p) => sum + p.issues.length, 0)
      },
      provenance: {
        economicGraphFile: 'intelligence/economic-graph/economic-graph.json',
        economicGraphSha256: sha256File(GRAPH_FILE),
        candidateObservationId: candidateObs.id,
        rpcEndpointClass: endpointClass,
        sameBlockRead: true,
        blockNumber,
        blockHash: block.hash
      },
      epistemic: {
        positionToManagedBinding: 'proven-onchain-votingescrow-state',
        managedVoteAllocation: 'measured-current-block',
        voteToFeeAndBribeRewardDeposit: 'proven-by-aerodrome-voter-accounting-identity',
        gaugeEmissionState: 'measured-current-block',
        managedVoterEarnedRewards: 'measured-current-block-upstream-strategy-context',
        depositorManagedRewards: 'measured-current-block-company-position-context',
        referenceAprConnection: 'not-attributed-by-this-pulse',
        causalAttribution: 'unresolved-beyond-contract-accounting-identities',
        primaryDriver: null,
        promotionAuthority: 'none',
        rule: 'Measured vote, gauge, fee/bribe reward and managed-reward states may be reported. Do not claim that a measured upstream value caused the 40 Acres Reference APR or the depositor reward outcome unless a specific formula/accounting path is proven for that metric.'
      }
    };

    const previous = readJson(OUT, false);
    const priorHistory = Array.isArray(previous?.history) ? previous.history : [];
    const prior = priorHistory.at(-1) || (previous?.latest ? summarizeObservation(previous.latest) : null);
    const summary = summarizeObservation(observation);
    let history = [...priorHistory];
    if (!history.some(x => x.observationId === summary.observationId)) history.push(summary);
    history = history.slice(-HISTORY_LIMIT);

    return {
      version: '0.1-aerodrome-managed-strategy-pulse',
      engineVersion: '0.1-defitea-managed-venft-same-block-pulse',
      generatedAt: new Date().toISOString(),
      status: 'shadow-measured-not-promoted',
      purpose: 'Observe the real Aerodrome managed-veNFT voting, gauge, fee/bribe reward and emission machinery around Defitea without promoting causal or execution authority.',
      authority: {
        readOnly: true,
        executionAuthority: 'none',
        capitalExecution: false,
        walletAuthority: false,
        allocationAuthority: false,
        recommendationAuthority: false,
        causalClaimAuthority: 'none',
        promotionAuthority: 'none',
        methodologyMutationAuthority: false
      },
      sourceBinding: {
        economicGraphSha256: sha256File(GRAPH_FILE),
        candidateId: CANDIDATE_ID,
        candidateObservationId: candidateObs.id,
        canonicalCohortCountAtObservation: Number(graph.coverage.cohortCount),
        canonicalCohortCountUnchanged: true
      },
      latest: observation,
      movement: movement(observation, prior),
      history,
      semantics: {
        sameBlockOnchainPulse: true,
        heterogeneousPoolImplementationsAllowed: true,
        optionalLegacyStableFlagDoesNotDefinePoolIdentity: true,
        referenceAprIsSeparateEvidenceLane: true,
        actualManagedRewardsAreSeparateEvidenceLane: true,
        contextIsNotCause: true,
        unknownIsNotZero: true,
        candidateNotCanonical: true
      },
      nextUnlocks: [
        'historize managed vote allocation across epochs',
        'trace pool trading fees into FeesVotingReward at epoch boundaries',
        'trace external incentives into BribeVotingReward',
        'separate gauge emissions from voter fee/bribe economics',
        'prove manager-specific onward accounting from managed veNFT earned rewards into LockedManagedReward / FreeManagedReward when available'
      ]
    };
  } finally {
    try { provider.destroy(); } catch {}
  }
}

async function main() {
  const state = await buildPulse();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(state, null, 2) + '\n');
  console.log('AERODROME MANAGED STRATEGY PULSE PASS', {
    generatedAt: state.generatedAt,
    blockNumber: state.latest.blockNumber,
    managedTokenId: state.latest.identity.managedTokenId,
    votedPools: state.latest.voting.votedPoolCount,
    usedVotingPowerPct: state.latest.voting.usedVotingPowerPct,
    totalGaugeClaimableAero: state.latest.aggregates.totalGaugeClaimableAero,
    totalGaugeWeeklyEmissionRateAero: state.latest.aggregates.totalGaugeWeeklyEmissionRateAero,
    lockedManagedAero: state.latest.depositorManagedRewards.lockedAeroAmount,
    primaryDriver: state.latest.epistemic.primaryDriver,
    promotionAuthority: state.latest.epistemic.promotionAuthority,
    executionAuthority: state.authority.executionAuthority
  });
}

if (path.resolve(process.argv[1] || '') === path.resolve(new URL(import.meta.url).pathname)) {
  main().catch(error => { console.error(error?.stack || error); process.exit(1); });
}

export { buildPulse };
