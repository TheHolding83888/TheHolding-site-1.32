#!/usr/bin/env node
/**
 * The Holding · ICP NNS Rewards Overlay v0.1
 *
 * Read-only collector for the owner-declared shared ICP NNS neuron pool used by
 * Company #005 and Company #006. Principal already exists in canonical company
 * capital and is NEVER added to TVL here. This file only measures / estimates
 * protocol-side NNS rewards and publishes them into the existing Rewards layer.
 *
 * Public truth hierarchy:
 *   1. IC Dashboard API per-neuron state (stake/state/dissolve/voting/maturity)
 *   2. exact public unstaked maturity when it is actually exposed with complete coverage
 *   3. owner-confirmed maturity baseline + canonical icp_nns Reference APR fallback
 *
 * No controller key, seed phrase, identity.pem, claim transaction or execution authority.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(ROOT, 'intelligence', 'icp-nns', 'company-005-006-neuron-pool.json');
const REWARDS_FILE = path.join(ROOT, 'companies', 'rewards-data.json');
const PRODUCTIVITY_FILE = path.join(ROOT, 'companies', 'productivity-data.json');
const MARKET_FILE = path.join(ROOT, 'intelligence', 'market-data', 'market-data.json');
const STATE_FILE = path.join(ROOT, 'companies', 'icp-nns-rewards-state.json');
const HISTORY_FILE = path.join(ROOT, 'companies', 'icp-nns-rewards-history.json');
const API_BASE = 'https://ic-api.internetcomputer.org/api/v3';
const ROUTE = 'icp-nns-governance';
const ENGINE_VERSION = '0.1-public-neuron-state-with-bounded-maturity-fallback';
const FETCH_TIMEOUT_MS = 12000;

const round = (n, d = 8) => {
  const f = 10 ** d;
  return Math.round((Number(n) + Number.EPSILON) * f) / f;
};
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const e8sToIcp = v => finite(v) ? Number(v) / 1e8 : null;
const nowIso = () => new Date().toISOString();

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) {
    if (fallback !== null) return fallback;
    throw e;
  }
}
async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(value, null, 2) + '\n');
}
async function fetchJson(url) {
  const c = new AbortController();
  const timer = setTimeout(() => c.abort(), FETCH_TIMEOUT_MS);
  try {
    const r = await fetch(url, {
      signal: c.signal,
      headers: { accept: 'application/json', 'user-agent': 'The-Holding-ICP-NNS-ReadOnly/0.1' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

// The Dashboard API response shape has evolved. Resolve fields recursively by
// exact key so the collector survives harmless envelope changes while never
// confusing maturity_e8s_equivalent with staked_maturity_e8s_equivalent.
function findField(root, wanted) {
  const seen = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return { found: false, value: null };
    seen.add(node);
    if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, wanted)) {
      return { found: true, value: node[wanted] };
    }
    for (const v of Object.values(node)) {
      if (v && typeof v === 'object') {
        const hit = walk(v);
        if (hit.found) return hit;
      }
    }
    return { found: false, value: null };
  }
  return walk(root);
}
function collectFieldValues(root, wanted) {
  const out = [];
  const seen = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (!Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, wanted)) out.push(node[wanted]);
    for (const v of Object.values(node)) if (v && typeof v === 'object') walk(v);
  }
  walk(root);
  return out;
}
function valueOf(root, keys) {
  for (const key of keys) {
    const hit = findField(root, key);
    if (hit.found) return hit.value;
  }
  return null;
}
function stateLabel(v) {
  const s = String(v ?? 'Unknown').replace(/[_\s-]/g, '').toLowerCase();
  if (s === 'dissolving') return 'Dissolving';
  if (s === 'notdissolving') return 'NotDissolving';
  if (s === 'dissolved') return 'Dissolved';
  if (s === 'spawning') return 'Spawning';
  return String(v ?? 'Unknown');
}

async function collectNeuron(id, observedAt) {
  const row = {
    neuronId: id,
    detailStatus: 'unavailable',
    ballotStatus: 'unavailable',
    stakeIcp: null,
    state: 'Unknown',
    dissolveDelaySeconds: null,
    estimatedUnlockAt: null,
    votingPower: null,
    decidingVotingPower: null,
    potentialVotingPower: null,
    maturityIcp: null,
    maturityFieldExposed: false,
    stakedMaturityIcp: null,
    stakedMaturityFieldExposed: false,
    recentBallotCount: null,
    recentParticipatingBallotCount: null,
    votingEvidence: 'unknown-public',
    errors: []
  };
  try {
    const detail = await fetchJson(`${API_BASE}/neurons/${id}`);
    row.detailStatus = 'ok';
    row.stakeIcp = e8sToIcp(valueOf(detail, ['stake_e8s', 'cached_neuron_stake_e8s']));
    row.state = stateLabel(valueOf(detail, ['state']));
    const delay = valueOf(detail, ['dissolve_delay_seconds']);
    row.dissolveDelaySeconds = finite(delay) ? Number(delay) : null;
    if (row.state === 'Dissolving' && finite(row.dissolveDelaySeconds)) {
      row.estimatedUnlockAt = new Date(new Date(observedAt).getTime() + Number(row.dissolveDelaySeconds) * 1000).toISOString();
    }
    const vp = valueOf(detail, ['voting_power']);
    const dvp = valueOf(detail, ['deciding_voting_power']);
    const pvp = valueOf(detail, ['potential_voting_power']);
    row.votingPower = finite(vp) ? Number(vp) : null;
    row.decidingVotingPower = finite(dvp) ? Number(dvp) : null;
    row.potentialVotingPower = finite(pvp) ? Number(pvp) : null;

    const maturity = findField(detail, 'maturity_e8s_equivalent');
    row.maturityFieldExposed = maturity.found && finite(maturity.value);
    row.maturityIcp = row.maturityFieldExposed ? e8sToIcp(maturity.value) : null;
    const staked = findField(detail, 'staked_maturity_e8s_equivalent');
    row.stakedMaturityFieldExposed = staked.found && finite(staked.value);
    row.stakedMaturityIcp = row.stakedMaturityFieldExposed ? e8sToIcp(staked.value) : null;
  } catch (e) {
    row.errors.push(`detail:${e?.message || e}`);
  }

  try {
    const ballots = await fetchJson(`${API_BASE}/neurons/${id}/recent-ballots`);
    const votes = collectFieldValues(ballots, 'vote')
      .map(Number)
      .filter(Number.isFinite);
    row.ballotStatus = 'ok';
    row.recentBallotCount = votes.length;
    row.recentParticipatingBallotCount = votes.filter(v => v === 1 || v === 2).length;
  } catch (e) {
    row.errors.push(`ballots:${e?.message || e}`);
  }

  if ((row.recentParticipatingBallotCount || 0) > 0) row.votingEvidence = 'recent-ballots';
  else if ((row.decidingVotingPower || row.votingPower || 0) > 0) row.votingEvidence = 'positive-voting-power';
  else if (row.detailStatus === 'ok') row.votingEvidence = 'no-positive-public-evidence';
  return row;
}

function upsertIcpReward(company, amountIcp, usdValue, priceUsd, sourceDetails, generatedAt) {
  if (!company) throw new Error('Target company missing from rewards snapshot');
  company.rewards = Array.isArray(company.rewards) ? company.rewards.filter(x => x?.route !== ROUTE) : [];
  company.sources = Array.isArray(company.sources) ? company.sources.filter(x => x?.route !== ROUTE) : [];
  company.rewardTokens = Array.isArray(company.rewardTokens) ? company.rewardTokens.filter(x => x?.symbol !== 'ICP') : [];

  company.rewards.push({
    protocol: 'Internet Computer · NNS Governance',
    route: ROUTE,
    chain: 'Internet Computer',
    token: null,
    symbol: 'ICP',
    amount: round(amountIcp, 8),
    classification: 'unclaimed',
    source: sourceDetails.rewardSource,
    usdValue: round(usdValue, 6),
    priceUsd: round(priceUsd, 8),
    priceMethod: 'canonical-market-data:internet-computer',
    details: {
      productiveAsset: 'ICP',
      positionType: 'NNS Governance Neurons',
      allocationPolicy: 'owner-declared-50-50-shared-neuron-pool',
      rewardMeasurementMode: sourceDetails.mode,
      estimated: sourceDetails.estimated,
      exactPublicUnstakedMaturityAvailable: sourceDetails.exactPublicUnstakedMaturityAvailable,
      referenceAprPct: sourceDetails.referenceAprPct,
      aggregateNeuronCount: sourceDetails.aggregateNeuronCount,
      liveNeuronCoverage: sourceDetails.liveNeuronCoverage,
      companyProductiveNnsBaseIcp: sourceDetails.companyProductiveNnsBaseIcp,
      baselineMaturitySnapshotDate: sourceDetails.baselineMaturitySnapshotDate,
      unknownIsNotZero: true,
      usdValueIncludedInTvl: false,
      principalIncludedInTvlAgain: false,
      claimTransactionAuthority: 'none',
      executionAuthority: 'none'
    }
  });
  company.sources.push({
    protocol: 'Internet Computer · NNS Governance',
    route: ROUTE,
    status: sourceDetails.estimated ? 'partial' : 'ok',
    chain: 'Internet Computer',
    metric: sourceDetails.estimated
      ? 'Unclaimed maturity estimate · public neuron state + owner baseline + canonical NNS Reference APR'
      : 'Public exact unstaked NNS maturity',
    note: sourceDetails.estimated
      ? 'Private/public neuron data does not prove complete exact unstaked maturity. The displayed Unclaimed amount is a bounded estimate anchored to the owner-confirmed 2026-07-04 maturity snapshot and current canonical NNS Reference APR.'
      : 'Exact public unstaked maturity coverage is complete for the tracked neuron pool.',
    details: { ...sourceDetails, claimTransactionAuthority: 'none', executionAuthority: 'none', unknownIsNotZero: true }
  });
  company.rewardTokens.push({
    symbol: 'ICP', token: null, amount: round(amountIcp, 8), usdValue: round(usdValue, 6)
  });

  const knownClaimable = company.rewards.reduce((sum, r) => finite(r?.usdValue) ? sum + Number(r.usdValue) : sum, 0);
  company.knownAccruedUsd = round(knownClaimable, 6);
  company.claimableUsd = round(knownClaimable, 6);
  company.totalUsd = round(knownClaimable, 6);
  // Preserve incompleteness from any existing route; the ICP estimate is itself partial.
  company.totalUsdIsComplete = sourceDetails.estimated ? false : company.totalUsdIsComplete;
  company.status = sourceDetails.estimated ? 'partial' : (company.status || 'ok');
  company.updatedAt = generatedAt;
}

async function main() {
  const generatedAt = nowIso();
  const [config, rewards, productivity, market] = await Promise.all([
    readJson(CONFIG_FILE), readJson(REWARDS_FILE), readJson(PRODUCTIVITY_FILE), readJson(MARKET_FILE)
  ]);

  if (!Array.isArray(config.neuronIds) || config.neuronIds.length !== 41 || new Set(config.neuronIds).size !== 41) {
    throw new Error('ICP NNS config must contain exactly 41 unique neuron IDs');
  }
  const apr = Number(productivity?.engines?.icp_nns?.aprLatest);
  if (!Number.isFinite(apr) || apr < 0 || apr > 100) throw new Error('Canonical icp_nns Reference APR unavailable');
  const priceUsd = Number(market?.prices?.['internet-computer']?.usd);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) throw new Error('Canonical ICP market price unavailable');

  const neuronRows = [];
  // Small bounded batches avoid hammering the public Dashboard API.
  for (let i = 0; i < config.neuronIds.length; i += 6) {
    neuronRows.push(...await Promise.all(config.neuronIds.slice(i, i + 6).map(id => collectNeuron(id, generatedAt))));
  }

  const detailOk = neuronRows.filter(x => x.detailStatus === 'ok');
  const fullDetailCoverage = detailOk.length === config.neuronIds.length;
  const stateCounts = {};
  for (const x of neuronRows) stateCounts[x.state] = (stateCounts[x.state] || 0) + 1;
  const liveStakeIcp = detailOk.reduce((s, x) => s + (finite(x.stakeIcp) ? Number(x.stakeIcp) : 0), 0);
  const liveActiveStakeIcp = detailOk
    .filter(x => !['Dissolved', 'Spawning'].includes(x.state))
    .reduce((s, x) => s + (finite(x.stakeIcp) ? Number(x.stakeIcp) : 0), 0);
  const maturityRows = detailOk.filter(x => x.maturityFieldExposed);
  const exactMaturityCoverage = fullDetailCoverage && maturityRows.length === detailOk.length;
  const exactMaturityIcp = maturityRows.reduce((s, x) => s + Number(x.maturityIcp || 0), 0);
  const stakedMaturityRows = detailOk.filter(x => x.stakedMaturityFieldExposed);
  const stakedMaturityIcp = stakedMaturityRows.reduce((s, x) => s + Number(x.stakedMaturityIcp || 0), 0);

  const baselineStake = Number(config.baseline.activeStakedIcp);
  const baselineMaturity = Number(config.baseline.manualUnstakedMaturityIcp);
  const baselineAt = new Date(`${config.baseline.snapshotDate}T00:00:00Z`);
  const elapsedYears = Math.max(0, (new Date(generatedAt) - baselineAt) / (365 * 24 * 60 * 60 * 1000));
  const earningBaseIcp = fullDetailCoverage && liveActiveStakeIcp > 0
    ? Math.min(baselineStake, liveActiveStakeIcp)
    : baselineStake;
  const modeledMaturityIcp = baselineMaturity + earningBaseIcp * (apr / 100) * elapsedYears;

  // A fully exposed non-zero ordinary maturity aggregate is authoritative.
  // If all returned values are zero despite a known positive owner baseline,
  // treat that as redaction/insufficient evidence rather than silently erasing rewards.
  const canUseExactMaturity = exactMaturityCoverage && (exactMaturityIcp > 0 || baselineMaturity === 0);
  const aggregateUnclaimedIcp = canUseExactMaturity ? exactMaturityIcp : modeledMaturityIcp;
  const mode = canUseExactMaturity
    ? 'public-exact-unstaked-maturity'
    : 'owner-baseline-plus-canonical-reference-apr-estimate';
  const estimated = !canUseExactMaturity;

  const allocations = config.allocation?.companies || {};
  const allocationSum = Object.values(allocations).reduce((s, x) => s + Number(x), 0);
  if (Math.abs(allocationSum - 1) > 1e-9) throw new Error('ICP NNS company allocations must sum to 1');

  const common = {
    rewardSource: canUseExactMaturity
      ? 'ic-api: public exact maturity_e8s_equivalent'
      : 'model: owner-confirmed maturity baseline + canonical icp_nns Reference APR',
    mode,
    estimated,
    exactPublicUnstakedMaturityAvailable: canUseExactMaturity,
    referenceAprPct: round(apr, 6),
    aggregateNeuronCount: config.neuronIds.length,
    liveNeuronCoverage: `${detailOk.length}/${config.neuronIds.length}`,
    baselineMaturitySnapshotDate: config.baseline.snapshotDate
  };

  const companyResults = {};
  for (const [companyName, shareRaw] of Object.entries(allocations)) {
    const share = Number(shareRaw);
    const amount = aggregateUnclaimedIcp * share;
    const usd = amount * priceUsd;
    const productiveBase = earningBaseIcp * share;
    upsertIcpReward(rewards.companies?.[companyName], amount, usd, priceUsd, {
      ...common,
      companyProductiveNnsBaseIcp: round(productiveBase, 8)
    }, generatedAt);
    companyResults[companyName] = {
      allocationShare: share,
      productiveNnsBaseIcp: round(productiveBase, 8),
      unclaimedIcp: round(amount, 8),
      unclaimedUsd: round(usd, 6)
    };
  }

  const unlocks = neuronRows
    .filter(x => x.state === 'Dissolving' && x.estimatedUnlockAt)
    .map(x => ({ neuronId: x.neuronId, amountIcp: x.stakeIcp, estimatedUnlockAt: x.estimatedUnlockAt }))
    .sort((a, b) => String(a.estimatedUnlockAt).localeCompare(String(b.estimatedUnlockAt)));
  const voting = {
    recentBallotEvidenceCount: neuronRows.filter(x => x.votingEvidence === 'recent-ballots').length,
    positiveVotingPowerEvidenceCount: neuronRows.filter(x => ['recent-ballots', 'positive-voting-power'].includes(x.votingEvidence)).length,
    noPositivePublicEvidenceCount: neuronRows.filter(x => x.votingEvidence === 'no-positive-public-evidence').length,
    unknownPublicCount: neuronRows.filter(x => x.votingEvidence === 'unknown-public').length
  };

  const state = {
    version: '0.1-icp-nns-rewards-state',
    engineVersion: ENGINE_VERSION,
    generatedAt,
    status: estimated || !fullDetailCoverage ? 'partial' : 'ok',
    asset: 'ICP',
    network: 'Internet Computer',
    route: ROUTE,
    capitalAccounting: {
      principalAddedToTvl: false,
      company005CanonicalIcpBalanceChanged: false,
      company006CanonicalIcpBalanceChanged: false,
      note: 'Rewards overlay only. Existing Company #005/#006 ICP capital remains canonical elsewhere.'
    },
    publicNeuronObservation: {
      requestedNeuronCount: config.neuronIds.length,
      detailOkCount: detailOk.length,
      fullDetailCoverage,
      stateCounts,
      totalObservedStakeIcp: round(liveStakeIcp, 8),
      activeObservedStakeIcp: round(liveActiveStakeIcp, 8),
      voting,
      dissolvingNeuronCount: unlocks.length,
      upcomingUnlocks: unlocks.slice(0, 12),
      exactUnstakedMaturityFieldCount: maturityRows.length,
      exactUnstakedMaturityIcp: exactMaturityCoverage ? round(exactMaturityIcp, 8) : null,
      stakedMaturityFieldCount: stakedMaturityRows.length,
      observedStakedMaturityIcp: stakedMaturityRows.length ? round(stakedMaturityIcp, 8) : null
    },
    rewards: {
      mode,
      estimated,
      aggregateUnclaimedIcp: round(aggregateUnclaimedIcp, 8),
      aggregateUnclaimedUsd: round(aggregateUnclaimedIcp * priceUsd, 6),
      referenceAprPct: round(apr, 6),
      canonicalIcpPriceUsd: round(priceUsd, 8),
      baselineUnclaimedMaturityIcp: baselineMaturity,
      baselineSnapshotDate: config.baseline.snapshotDate,
      modeledEarningBaseIcp: round(earningBaseIcp, 8),
      elapsedYearsFromBaseline: round(elapsedYears, 10),
      companies: companyResults
    },
    authority: { readOnly: true, claimTransactionAuthority: 'none', executionAuthority: 'none' },
    unknownIsNotZero: true,
    neurons: neuronRows
  };

  rewards.generatedAt = generatedAt;
  rewards.date = generatedAt.slice(0, 10);
  rewards.diagnostics = rewards.diagnostics || {};
  rewards.diagnostics.icpNns = {
    capability: ENGINE_VERSION,
    status: state.status,
    route: ROUTE,
    aggregateUnclaimedIcp: state.rewards.aggregateUnclaimedIcp,
    measurementMode: mode,
    estimated,
    allocationPolicy: config.allocation.policy,
    companies: companyResults,
    liveNeuronCoverage: `${detailOk.length}/${config.neuronIds.length}`,
    voting,
    dissolvingNeuronCount: unlocks.length,
    principalAddedToTvl: false,
    claimTransactionAuthority: 'none',
    executionAuthority: 'none',
    unknownIsNotZero: true
  };

  const history = await readJson(HISTORY_FILE, {
    version: '0.1-icp-nns-rewards-history',
    route: ROUTE,
    observations: []
  });
  history.version = '0.1-icp-nns-rewards-history';
  history.route = ROUTE;
  history.observations = Array.isArray(history.observations) ? history.observations : [];
  const observation = {
    date: generatedAt.slice(0, 10),
    generatedAt,
    status: state.status,
    mode,
    aggregateUnclaimedIcp: state.rewards.aggregateUnclaimedIcp,
    aggregateUnclaimedUsd: state.rewards.aggregateUnclaimedUsd,
    referenceAprPct: state.rewards.referenceAprPct,
    canonicalIcpPriceUsd: state.rewards.canonicalIcpPriceUsd,
    activeObservedStakeIcp: state.publicNeuronObservation.activeObservedStakeIcp,
    liveNeuronCoverage: `${detailOk.length}/${config.neuronIds.length}`,
    company005UnclaimedIcp: companyResults['0x5860...83CA8.eth']?.unclaimedIcp ?? null,
    company006UnclaimedIcp: companyResults['aerocvxyb.eth']?.unclaimedIcp ?? null
  };
  history.observations = history.observations.filter(x => x?.date !== observation.date);
  history.observations.push(observation);
  history.observations = history.observations.slice(-730);

  // Fail-closed invariants before publishing.
  const five = companyResults['0x5860...83CA8.eth'];
  const six = companyResults['aerocvxyb.eth'];
  if (!five || !six) throw new Error('Both ICP company allocations must exist');
  if (Math.abs(five.unclaimedIcp - six.unclaimedIcp) > 1e-8) throw new Error('Owner 50/50 ICP reward allocation drift');
  if (!(aggregateUnclaimedIcp >= 0) || !Number.isFinite(aggregateUnclaimedIcp)) throw new Error('Invalid ICP unclaimed aggregate');
  if (state.capitalAccounting.principalAddedToTvl !== false) throw new Error('ICP reward principal leaked into TVL');

  await Promise.all([
    writeJson(REWARDS_FILE, rewards),
    writeJson(STATE_FILE, state),
    writeJson(HISTORY_FILE, history)
  ]);
  console.log('ICP NNS rewards overlay PASS', {
    mode,
    neuronCoverage: `${detailOk.length}/${config.neuronIds.length}`,
    aggregateUnclaimedIcp: state.rewards.aggregateUnclaimedIcp,
    company005: five.unclaimedIcp,
    company006: six.unclaimedIcp,
    referenceAprPct: state.rewards.referenceAprPct,
    dissolving: unlocks.length,
    voting
  });
}

main().catch(e => {
  console.error(e?.stack || e);
  process.exit(1);
});
