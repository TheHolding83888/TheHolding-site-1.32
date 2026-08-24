#!/usr/bin/env node
/**
 * The Holding · Aerodrome veAERO Economic Graph candidate v0.1
 *
 * Shadow-admission only. This module proves two distinct facts without
 * conflating them:
 *   1) the canonical 40 Acres Reference APR mechanical identity; and
 *   2) Defitea's current managed-veNFT AERO compounding state from canonical
 *      Rewards memory.
 *
 * The actual company reward state is measured context, NOT an input to the
 * 40 Acres simulator Reference APR. Upstream fee / incentive / volume / emission
 * causality remains unresolved until separately evidenced.
 */

import crypto from 'node:crypto';

export const AERODROME_CANDIDATE_ID = 'defitea-aerodrome-veaero';
export const AERODROME_CANDIDATE_VERSION = '0.1-aerodrome-veaero-shadow-admission';
const APR_TOLERANCE_PCT_POINTS = 0.01;
const MAX_OBSERVATIONS = 1000;

function fail(message) { throw new Error(message); }
function finite(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) fail(`${label} must be finite`);
  return n;
}
function round(value, digits = 8) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
}
function delta(current, prior, digits = 8) {
  return Number.isFinite(Number(current)) && Number.isFinite(Number(prior))
    ? round(Number(current) - Number(prior), digits)
    : null;
}
function sha256Text(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function findCompany(container, expectedName) {
  const companies = container?.companies;
  if (!companies || typeof companies !== 'object') fail('companies map missing');
  if (companies[expectedName]) return { key: expectedName, company: companies[expectedName] };
  const expected = expectedName.toLowerCase();
  const rows = Object.entries(companies).filter(([key, company]) => {
    const identities = [key, company?.name, company?.ens, company?.company, company?.label]
      .filter(Boolean).map(x => String(x).toLowerCase());
    return identities.includes(expected) || identities.some(x => x.includes('defitea'));
  });
  if (rows.length !== 1) fail(`Expected exactly one Defitea company row, found ${rows.length}`);
  return { key: rows[0][0], company: rows[0][1] };
}
function walk(value, visit, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  visit(value);
  if (Array.isArray(value)) value.forEach(x => walk(x, visit, seen));
  else Object.values(value).forEach(x => walk(x, visit, seen));
}
function managedPositionsFromSource(source) {
  const out = new Map();
  walk(source, node => {
    if (node?.mode !== 'managed' || node?.tokenId === undefined || node?.managedTokenId === undefined) return;
    const key = String(node.tokenId);
    if (!out.has(key)) {
      out.set(key, {
        tokenId: key,
        managedTokenId: String(node.managedTokenId),
        lockedManagedReward: node.lockedManagedReward ?? null,
        freeManagedReward: node.freeManagedReward ?? null,
        accruedBaseRaw: node.accruedBaseRaw === undefined ? null : String(node.accruedBaseRaw)
      });
    }
  });
  return [...out.values()];
}
function aeroFromRaw(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  try { return Number(BigInt(String(raw))) / 1e18; }
  catch { return null; }
}
function stableObservationCore(observation) {
  return {
    referenceObservedAt: observation.referenceObservedAt,
    rewardsObservedAt: observation.rewardsObservedAt,
    canonicalReferenceAprPct: observation.referenceProductivity.canonicalAprPct,
    weeklyExpectedVotingRewardsUsd: observation.referenceProductivity.formula.weeklyExpectedVotingRewardsUsd,
    impliedVeNftValueUsd: observation.referenceProductivity.formula.impliedVeNftValueUsd,
    productiveUnitsAero: observation.companyPosition.productiveUnitsAero,
    currentManagedAccruedAero: observation.actualManagedVeNft.currentAccruedAero,
    managedTokenIds: observation.actualManagedVeNft.positions.map(x => x.tokenId),
    productivitySha256: observation.provenance.productivitySha256,
    rewardsSha256: observation.provenance.rewardsSha256
  };
}

export function buildAerodromeCandidateObservation({ productivity, rewards, productivitySha256, rewardsSha256 }) {
  if (!productivity || !rewards) fail('Aerodrome candidate requires Productivity and Rewards state');
  if (!/^[0-9a-f]{64}$/i.test(String(productivitySha256 || ''))) fail('Productivity SHA-256 missing');
  if (!/^[0-9a-f]{64}$/i.test(String(rewardsSha256 || ''))) fail('Rewards SHA-256 missing');

  const engine = productivity?.engines?.aerodrome_veaero;
  if (!engine || engine.status !== 'ok') fail('Canonical aerodrome_veaero Productivity engine unavailable');
  if (engine.sourceType !== 'official-frontend' || engine.sourceUrl !== 'https://www.40acres.finance/') {
    fail('Aerodrome Reference APR source authority drift');
  }
  if (engine.sourceMetric !== '40 Acres simulator gross expected weekly voting rewards annualized') {
    fail('Aerodrome Reference APR metric drift');
  }

  const maxBorrowUsd = finite(engine?.details?.maxBorrow, '40 Acres maxBorrow');
  const ltvPct = finite(engine?.details?.ltv, '40 Acres LTV');
  const weeklyExpectedVotingRewardsUsd = finite(engine?.details?.weekly, '40 Acres weekly expected voting rewards');
  const impliedVeNftValueUsd = finite(engine?.details?.impliedVeNftValue, '40 Acres implied veNFT value');
  const canonicalAprPct = finite(engine.aprLatest, 'Aerodrome canonical Reference APR');
  if (!(maxBorrowUsd > 0) || !(ltvPct > 0 && ltvPct <= 100) || !(weeklyExpectedVotingRewardsUsd >= 0) || !(impliedVeNftValueUsd > 0)) {
    fail('Aerodrome Reference APR formula inputs outside admissible range');
  }
  const reproducedVeNftValueUsd = maxBorrowUsd / (ltvPct / 100);
  if (Math.abs(reproducedVeNftValueUsd - impliedVeNftValueUsd) > 0.01) {
    fail(`Aerodrome implied veNFT value parity failed: ${reproducedVeNftValueUsd} != ${impliedVeNftValueUsd}`);
  }
  const reproducedAprPct = weeklyExpectedVotingRewardsUsd * 52 / impliedVeNftValueUsd * 100;
  const aprParityDeltaPctPoints = canonicalAprPct - reproducedAprPct;
  if (Math.abs(aprParityDeltaPctPoints) > APR_TOLERANCE_PCT_POINTS) {
    fail(`Aerodrome Reference APR formula parity failed: ${canonicalAprPct} != ${reproducedAprPct}`);
  }

  const productivityCompany = findCompany(productivity, 'defitea.eth').company;
  const position = (productivityCompany?.breakdown || []).find(row => row?.engineId === 'aerodrome_veaero');
  if (!position) fail('Defitea aerodrome_veaero Productivity position missing');
  const productiveUnitsAero = finite(position.units, 'Defitea productive AERO units');
  const productiveValueUsd = finite(position.value, 'Defitea productive AERO value');
  const positionAprPct = finite(position.apr, 'Defitea AERO position APR');
  if (Math.abs(positionAprPct - canonicalAprPct) > APR_TOLERANCE_PCT_POINTS) fail('Defitea AERO position APR diverged from engine');

  const rewardsCompany = findCompany(rewards, 'defitea.eth').company;
  const routeSource = (rewardsCompany?.sources || []).find(row => row?.route === 'aerodrome-ve');
  if (!routeSource) fail('Defitea canonical Aerodrome Rewards route missing');
  if (!['ok', 'partial'].includes(routeSource.status)) fail(`Defitea Aerodrome Rewards route status unsupported: ${routeSource.status}`);
  const managedPositions = managedPositionsFromSource(routeSource);
  const rewardRows = (rewardsCompany?.rewards || []).filter(row => row?.route === 'aerodrome-ve');
  const managedAeroRows = rewardRows.filter(row =>
    String(row?.symbol || '').toUpperCase() === 'AERO' &&
    row?.classification === 'compounded-locked' &&
    String(row?.source || '').includes('LockedManagedReward.earned')
  );

  // Some canonical Rewards snapshots expose managed position state mainly on the
  // reward row. Merge that identity into the position set instead of assuming a
  // particular wrapper shape under source.details.walletResults.
  for (const row of managedAeroRows) {
    const d = row?.details || {};
    if (d.tokenId === undefined || d.managedTokenId === undefined) continue;
    if (!managedPositions.some(x => x.tokenId === String(d.tokenId))) {
      managedPositions.push({
        tokenId: String(d.tokenId),
        managedTokenId: String(d.managedTokenId),
        lockedManagedReward: d.lockedManagedReward ?? null,
        freeManagedReward: null,
        accruedBaseRaw: row.amountRaw === undefined ? null : String(row.amountRaw)
      });
    }
  }
  if (managedPositions.length < 1) fail('Defitea managed veAERO position identity unavailable');

  const rowAccruedAero = managedAeroRows.length
    ? managedAeroRows.reduce((sum, row) => sum + finite(row.amount, 'Managed AERO reward amount'), 0)
    : null;
  const positionAccruedParts = managedPositions.map(x => aeroFromRaw(x.accruedBaseRaw)).filter(Number.isFinite);
  const positionAccruedAero = positionAccruedParts.length === managedPositions.length
    ? positionAccruedParts.reduce((a, b) => a + b, 0)
    : null;
  if (rowAccruedAero !== null && positionAccruedAero !== null && Math.abs(rowAccruedAero - positionAccruedAero) > 0.000001) {
    fail(`Defitea managed AERO reward parity failed: rows=${rowAccruedAero}, positions=${positionAccruedAero}`);
  }
  const currentAccruedAero = rowAccruedAero ?? positionAccruedAero;
  if (!Number.isFinite(Number(currentAccruedAero))) fail('Defitea managed AERO accrued amount unavailable');
  const managedAccruedUsd = managedAeroRows.length && managedAeroRows.every(row => Number.isFinite(Number(row.usdValue)))
    ? managedAeroRows.reduce((sum, row) => sum + Number(row.usdValue), 0)
    : null;

  const referenceObservedAt = engine.lastUpdatedAt || engine.periodEnd || productivity.generatedAt;
  const rewardsObservedAt = rewards.generatedAt || rewardsCompany.updatedAt || null;
  if (!Number.isFinite(Date.parse(referenceObservedAt))) fail('Aerodrome Reference observation timestamp invalid');
  if (!Number.isFinite(Date.parse(rewardsObservedAt))) fail('Aerodrome Rewards observation timestamp invalid');
  const sourceSkewHours = Math.abs(Date.parse(referenceObservedAt) - Date.parse(rewardsObservedAt)) / 36e5;

  const observation = {
    cohortId: AERODROME_CANDIDATE_ID,
    status: 'shadow-measured-not-promoted',
    referenceObservedAt,
    rewardsObservedAt,
    company: { registry: '004', name: 'defitea.eth' },
    protocol: 'Aerodrome',
    mechanism: 'veAERO / managed veNFT voting rewards',
    asset: 'AERO',
    companyPosition: {
      productiveUnitsAero: round(productiveUnitsAero, 10),
      productiveValueUsd: round(productiveValueUsd, 8),
      positionAprPct: round(positionAprPct, 6)
    },
    referenceProductivity: {
      canonicalAprPct: round(canonicalAprPct, 6),
      status: engine.status,
      sourceUrl: engine.sourceUrl,
      sourceType: engine.sourceType,
      sourceMetric: engine.sourceMetric,
      nativeCadence: engine.nativeCadence,
      formula: {
        status: 'proven-canonical-collector-identity',
        identity: 'referenceAprPct = weeklyExpectedVotingRewardsUsd * 52 / impliedVeNftValueUsd * 100',
        veNftValueIdentity: 'impliedVeNftValueUsd = maxBorrowUsd / (ltvPct / 100)',
        maxBorrowUsd: round(maxBorrowUsd, 8),
        ltvPct: round(ltvPct, 6),
        weeklyExpectedVotingRewardsUsd: round(weeklyExpectedVotingRewardsUsd, 8),
        impliedVeNftValueUsd: round(impliedVeNftValueUsd, 8),
        reproducedVeNftValueUsd: round(reproducedVeNftValueUsd, 8),
        reproducedAprPct: round(reproducedAprPct, 6),
        parityDeltaPctPoints: round(aprParityDeltaPctPoints, 6)
      }
    },
    actualManagedVeNft: {
      sourceStatus: routeSource.status,
      sourceMetric: routeSource.metric ?? null,
      sourceNote: routeSource.note ?? null,
      positionCount: managedPositions.length,
      positions: managedPositions,
      currentAccruedAero: round(currentAccruedAero, 10),
      currentAccruedUsdAtRewardsSnapshot: managedAccruedUsd === null ? null : round(managedAccruedUsd, 8),
      rewardRowCount: managedAeroRows.length,
      stateClass: 'measured-current-company-compounding-context'
    },
    temporalBoundary: {
      sourceSnapshotsAreSameTime: referenceObservedAt === rewardsObservedAt,
      sourceSkewHours: round(sourceSkewHours, 6),
      rule: 'Never combine simulator Reference APR and actual managed-veNFT accrued rewards as if they were one same-block formula input.'
    },
    provenance: {
      productivityFile: 'companies/productivity-data.json',
      productivityGeneratedAt: productivity.generatedAt ?? null,
      productivitySha256,
      rewardsFile: 'companies/rewards-data.json',
      rewardsGeneratedAt: rewards.generatedAt ?? null,
      rewardsSha256
    },
    epistemic: {
      admissionClass: 'shadow-candidate',
      mechanicalAttribution: 'proven-within-reference-simulator-formula',
      companyRewardState: 'measured-context-not-reference-formula-input',
      causalAttribution: 'unresolved-beyond-reference-formula',
      primaryDriver: null,
      blockedQuestion: 'why-aerodrome-voting-rewards-or-reference-apr-changed',
      unlockCondition: 'canonical Aerodrome pool fee / incentive / emission / volume evidence tied to the relevant voting-reward paths',
      promotionAuthority: 'none'
    }
  };
  const core = stableObservationCore(observation);
  observation.id = `aerodrome-veaero:${String(referenceObservedAt).slice(0, 10)}:${sha256Text(JSON.stringify(core)).slice(0, 20)}`;
  return observation;
}

function buildMovement(current, prior) {
  return {
    priorObservationId: prior?.id ?? null,
    referenceElapsedHours: prior ? round((Date.parse(current.referenceObservedAt) - Date.parse(prior.referenceObservedAt)) / 36e5, 6) : null,
    rewardsElapsedHours: prior ? round((Date.parse(current.rewardsObservedAt) - Date.parse(prior.rewardsObservedAt)) / 36e5, 6) : null,
    referenceAprDeltaPctPoints: prior ? delta(current.referenceProductivity.canonicalAprPct, prior.referenceProductivity?.canonicalAprPct, 6) : null,
    weeklyExpectedVotingRewardsUsdDelta: prior ? delta(current.referenceProductivity.formula.weeklyExpectedVotingRewardsUsd, prior.referenceProductivity?.formula?.weeklyExpectedVotingRewardsUsd, 8) : null,
    impliedVeNftValueUsdDelta: prior ? delta(current.referenceProductivity.formula.impliedVeNftValueUsd, prior.referenceProductivity?.formula?.impliedVeNftValueUsd, 8) : null,
    currentManagedAccruedAeroDelta: prior ? delta(current.actualManagedVeNft.currentAccruedAero, prior.actualManagedVeNft?.currentAccruedAero, 10) : null,
    comparable: Boolean(prior),
    note: 'Each delta compares like-for-like source fields. Cross-source simulator-vs-actual deltas are intentionally not computed.'
  };
}

export function applyAerodromeCandidate({ state, previousState, productivity, rewards, productivitySha256, rewardsSha256 }) {
  if (!state || typeof state !== 'object') fail('Economic Graph base state missing');
  if (state?.authority?.executionAuthority !== 'none' || state?.authority?.causalClaimAuthority !== 'none') {
    fail('Aerodrome candidate refuses Economic Graph authority drift');
  }
  const current = buildAerodromeCandidateObservation({ productivity, rewards, productivitySha256, rewardsSha256 });
  const previousRows = Array.isArray(previousState?.candidateCohorts?.[AERODROME_CANDIDATE_ID]?.observations)
    ? previousState.candidateCohorts[AERODROME_CANDIDATE_ID].observations
    : [];
  const observations = [...previousRows];
  if (!observations.some(row => row?.id === current.id)) observations.push(current);
  const bounded = observations.slice(-MAX_OBSERVATIONS);
  const latest = bounded.at(-1);
  const prior = [...bounded].reverse().find(row => row?.id !== latest?.id) ?? null;

  state.candidateLayer = {
    version: AERODROME_CANDIDATE_VERSION,
    status: 'shadow-admission-active',
    candidateCount: 1,
    candidateIds: [AERODROME_CANDIDATE_ID],
    canonicalCohortCountUnchanged: Number(state?.coverage?.cohortCount) === 2,
    rule: 'Candidate telemetry may be measured and historized before downstream causal/consumer promotion. Candidate presence does not expand canonical cohort authority.',
    promotionAuthority: 'none'
  };
  state.candidateCohorts = {
    ...(state.candidateCohorts || {}),
    [AERODROME_CANDIDATE_ID]: {
      cohortId: AERODROME_CANDIDATE_ID,
      status: 'shadow-measured-not-promoted',
      identity: { companyRegistry: '004', company: 'defitea.eth', protocol: 'Aerodrome', mechanism: 'veAERO / managed veNFT voting rewards', asset: 'AERO' },
      latest: { observation: latest, movement: buildMovement(latest, prior) },
      observationCount: bounded.length,
      observations: bounded,
      attribution: {
        status: 'reference-formula-proven-position-context-measured-upstream-cause-unresolved',
        formulaProven: true,
        actualPositionContextMeasured: true,
        mechanicalInputs: ['40 Acres gross expected weekly voting rewards', '40 Acres implied veNFT value'],
        actualPositionContext: ['Defitea managed veNFT identity', 'LockedManagedReward accrued AERO'],
        primaryDriver: null,
        blockedQuestion: 'why-aerodrome-voting-rewards-or-reference-apr-changed',
        unlockCondition: 'canonical Aerodrome pool fee / incentive / emission / volume evidence tied to relevant voting-reward paths',
        promotionAuthority: 'none'
      }
    }
  };
  return state;
}
