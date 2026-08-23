#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const POLICY_FILE = 'intelligence/observational-learning/observational-learning-policy.json';
const HISTORY_FILE = 'intelligence/change-history.json';
const OUTPUT_FILE = 'intelligence/observational-learning/observational-experience.json';
const VERSION = '0.1-autonomous-observational-experience';
const ENGINE_VERSION = '0.1-change-history-episode-pattern-compiler';
const SELF_TEST = process.argv.includes('--self-test');

const arr = value => Array.isArray(value) ? value : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const finite = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round = (value, digits = 8) => {
  const n = finite(value);
  return n === null ? null : Number(n.toFixed(digits));
};
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : stableStringify(value)).digest('hex');
function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}
function readJson(file) {
  const text = fs.readFileSync(file, 'utf8');
  return { text, data: JSON.parse(text) };
}
function direction(delta) {
  if (delta === null) return null;
  if (delta > 0) return 'increase';
  if (delta < 0) return 'decrease';
  return 'unchanged';
}
function iso(value) {
  const t = Date.parse(value ?? '');
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}
function runProvenance(run) {
  return {
    generatedAt: iso(run?.generatedAt),
    snapshotHash: run?.snapshotHash ?? null,
    sourceCompositeHash: run?.sourceCompositeHash ?? null,
    vaultRecordPath: run?.vaultRecordPath ?? null,
    vaultRecordHash: run?.vaultRecordHash ?? null
  };
}
function selectPrimaryRun(runs, observedAt) {
  const observedMs = Date.parse(observedAt ?? '');
  return [...runs].sort((a, b) => {
    const aIso = iso(a?.generatedAt);
    const bIso = iso(b?.generatedAt);
    const aMs = Date.parse(aIso ?? '');
    const bMs = Date.parse(bIso ?? '');
    const aExact = aIso === observedAt ? 0 : 1;
    const bExact = bIso === observedAt ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    const aDistance = Number.isFinite(aMs) && Number.isFinite(observedMs) ? Math.abs(aMs - observedMs) : Number.MAX_SAFE_INTEGER;
    const bDistance = Number.isFinite(bMs) && Number.isFinite(observedMs) ? Math.abs(bMs - observedMs) : Number.MAX_SAFE_INTEGER;
    if (aDistance !== bDistance) return aDistance - bDistance;
    return stableStringify(runProvenance(a)).localeCompare(stableStringify(runProvenance(b)));
  })[0] ?? null;
}

function compile(policy, history, historyText) {
  if (history?.version !== policy?.sourceContract?.requiredHistoryVersion) {
    throw new Error(`Unexpected Change History version: ${history?.version}`);
  }
  if (policy?.authority?.executionAuthority !== 'none' || policy?.authority?.causalClaimAuthority !== 'none') {
    throw new Error('Observational policy authority boundary failed');
  }
  if (policy?.patternPolicy?.status !== 'candidate-only' || policy?.patternPolicy?.causalClaim !== false) {
    throw new Error('Observational pattern policy must remain candidate-only and non-causal');
  }

  const classByKey = new Map();
  for (const cls of arr(policy?.episodeClasses)) {
    for (const metric of arr(cls?.metrics)) classByKey.set(`${cls.category}:${metric}`, cls);
  }

  const runsByEventId = new Map();
  for (const run of arr(history?.runs)) {
    for (const eventId of arr(run?.eventIds)) {
      if (!runsByEventId.has(eventId)) runsByEventId.set(eventId, []);
      runsByEventId.get(eventId).push(run);
    }
  }

  const rawEpisodes = [];
  for (const event of arr(history?.events)) {
    const cls = classByKey.get(`${event?.category}:${event?.metric}`);
    if (!cls) continue;
    const previous = finite(event?.previousValue);
    const current = finite(event?.currentValue);
    if (cls?.valueType === 'numeric' && (previous === null || current === null)) continue;
    const observedAt = iso(event?.detectedAt);
    if (!event?.id || !observedAt || !event?.entity || !event?.metric) continue;

    const delta = previous !== null && current !== null ? round(current - previous, 10) : null;
    const cumulative = cls?.counterSemantics === 'period-cumulative-counter';
    const possibleReset = cumulative && delta !== null && delta < 0;
    const seriesKey = `${event.category}|${event.entity}|${event.metric}`;
    const memberships = arr(runsByEventId.get(event.id));
    const primaryRun = selectPrimaryRun(memberships, observedAt);
    const sourceRuns = memberships
      .map(runProvenance)
      .sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
    rawEpisodes.push({
      episodeId: `obs-${event.id}`,
      sourceEventId: event.id,
      episodeClass: cls.id,
      semanticDomain: cls.semanticDomain,
      seriesKey,
      observedAt,
      category: event.category,
      entity: event.entity,
      metric: event.metric,
      unit: event?.unit ?? null,
      previousValue: event.previousValue,
      currentValue: event.currentValue,
      delta,
      direction: possibleReset ? null : direction(delta),
      counterSemantics: cls.counterSemantics,
      patternSignalType: cls.patternSignal,
      possiblePeriodResetOrCorrection: possibleReset,
      resetInterpretation: possibleReset ? policy?.counterRules?.negativeCumulativeDelta : null,
      economicLossInferred: false,
      sourceKeys: arr(event?.sourceKeys),
      sourceRunMembershipCount: sourceRuns.length,
      sourceRun: primaryRun ? runProvenance(primaryRun) : null,
      sourceRuns,
      sourceSummary: event?.summary ?? null,
      sourceWhyItMatters: event?.whyItMatters ?? null,
      epistemic: {
        observation: 'exact-observation',
        change: delta === null ? 'unknown' : 'deterministic-derived-change',
        causalClaim: false
      }
    });
  }

  rawEpisodes.sort((a, b) => a.observedAt.localeCompare(b.observedAt) || a.episodeId.localeCompare(b.episodeId));
  const bySeries = new Map();
  for (const episode of rawEpisodes) {
    if (!bySeries.has(episode.seriesKey)) bySeries.set(episode.seriesKey, []);
    bySeries.get(episode.seriesKey).push(episode);
  }

  for (const episodes of bySeries.values()) {
    let previousEpisode = null;
    let previousNonResetIncrement = null;
    for (const episode of episodes) {
      episode.windowStart = previousEpisode?.observedAt ?? null;
      episode.windowEnd = episode.observedAt;
      episode.changedAfterEpisodeId = previousEpisode?.episodeId ?? null;
      if (episode.counterSemantics === 'period-cumulative-counter') {
        if (!episode.possiblePeriodResetOrCorrection && episode.delta !== null) {
          episode.increment = episode.delta;
          episode.incrementVelocityDirection = previousNonResetIncrement === null
            ? null
            : direction(round(episode.delta - previousNonResetIncrement, 10));
          previousNonResetIncrement = episode.delta;
        } else {
          episode.increment = null;
          episode.incrementVelocityDirection = null;
          previousNonResetIncrement = null;
        }
      } else {
        episode.increment = null;
        episode.incrementVelocityDirection = null;
      }
      previousEpisode = episode;
    }
  }

  const minSupport = Number(policy?.patternPolicy?.minimumSupportEpisodes ?? 2);
  const minConsistency = Number(policy?.patternPolicy?.minimumDirectionalConsistencyPct ?? 66.67);
  const maxEvidence = Number(policy?.limits?.maximumPatternEvidenceIds ?? 50);
  const patternCandidates = [];

  for (const [seriesKey, episodes] of [...bySeries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const signalRows = episodes.map(episode => ({
      episode,
      signal: episode.patternSignalType === 'increment-velocity'
        ? episode.incrementVelocityDirection
        : episode.direction
    })).filter(row => row.signal && row.signal !== 'unchanged');
    if (signalRows.length < minSupport) continue;
    const counts = {};
    for (const row of signalRows) counts[row.signal] = (counts[row.signal] || 0) + 1;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!dominant) continue;
    const [dominantSignal, supportCount] = dominant;
    const consistencyPct = round(supportCount / signalRows.length * 100, 2);
    if (supportCount < minSupport || consistencyPct < minConsistency) continue;
    const supportEpisodeIds = signalRows.filter(row => row.signal === dominantSignal).map(row => row.episode.episodeId).slice(-maxEvidence);
    const exemplar = episodes[episodes.length - 1];
    const patternId = `pattern-${sha256(`${seriesKey}|${dominantSignal}|${exemplar.patternSignalType}`).slice(0, 20)}`;
    patternCandidates.push({
      patternId,
      status: 'candidate',
      epistemicStatus: 'candidate-association',
      causalClaim: false,
      seriesKey,
      episodeClass: exemplar.episodeClass,
      semanticDomain: exemplar.semanticDomain,
      entity: exemplar.entity,
      metric: exemplar.metric,
      signalType: exemplar.patternSignalType,
      dominantSignal,
      supportCount,
      observedSignalCount: signalRows.length,
      directionalConsistencyPct: consistencyPct,
      firstObservedAt: signalRows[0].episode.observedAt,
      lastObservedAt: signalRows[signalRows.length - 1].episode.observedAt,
      supportEpisodeIds,
      statement: exemplar.patternSignalType === 'increment-velocity'
        ? `${exemplar.entity} ${exemplar.metric} increment velocity repeatedly moved ${dominantSignal}; this is a candidate temporal pattern, not a causal explanation.`
        : `${exemplar.entity} ${exemplar.metric} repeatedly moved ${dominantSignal}; this is a candidate temporal pattern, not a causal explanation.`
    });
  }

  const maxEpisodes = Number(policy?.limits?.maximumEpisodes ?? 5000);
  const maxPatterns = Number(policy?.limits?.maximumPatternCandidates ?? 500);
  if (rawEpisodes.length > maxEpisodes) throw new Error(`Observational episode cap exceeded: ${rawEpisodes.length}`);
  if (patternCandidates.length > maxPatterns) throw new Error(`Observational pattern cap exceeded: ${patternCandidates.length}`);

  const episodeClassCounts = {};
  for (const episode of rawEpisodes) episodeClassCounts[episode.episodeClass] = (episodeClassCounts[episode.episodeClass] || 0) + 1;
  const uniqueEntities = [...new Set(rawEpisodes.map(x => x.entity))].sort();
  const uniqueSeries = [...bySeries.keys()].sort();
  const resetCount = rawEpisodes.filter(x => x.possiblePeriodResetOrCorrection).length;
  const multiRunMembershipEpisodeCount = rawEpisodes.filter(x => x.sourceRunMembershipCount > 1).length;
  const sourceSha256 = sha256(historyText);

  const output = {
    version: VERSION,
    engineVersion: ENGINE_VERSION,
    generatedAt: iso(history?.lastUpdatedAt) ?? iso(history?.runs?.at?.(-1)?.generatedAt) ?? null,
    status: rawEpisodes.length ? 'ready' : 'warming-no-eligible-observations',
    purpose: 'Deterministic source-bound world episodes and candidate temporal patterns derived from canonical Change Intelligence history.',
    authority: {
      readOnly: true,
      executionAuthority: 'none',
      capitalExecution: false,
      policyMutationAuthority: false,
      methodologyMutationAuthority: false,
      repositoryMutationAuthorityFromLearning: false,
      causalClaimAuthority: 'none'
    },
    source: {
      file: HISTORY_FILE,
      version: history?.version ?? null,
      lastUpdatedAt: iso(history?.lastUpdatedAt),
      sha256: sourceSha256,
      runCount: arr(history?.runs).length,
      eventCount: arr(history?.events).length
    },
    semantics: {
      exactObservation: 'Each episode points to one canonical Change History event and preserves its previous/current values, entity, metric, time and sourceKeys.',
      runMembership: 'A canonical Change History event may be referenced by more than one history run. This creates one episode with all run memberships preserved; it never creates duplicate economic observations.',
      primaryRunSelection: 'When multiple run memberships exist, sourceRun is selected deterministically by exact/nearest generatedAt for convenience while sourceRuns preserves every membership.',
      derivedChange: 'Numeric deltas, temporal ordering and increment velocity are deterministic transforms of source observations.',
      counterReset: 'A negative delta in a period-cumulative counter is treated as possible reset/correction and never as economic loss by default.',
      patternCandidate: 'Repeated direction or increment-velocity is candidate association only; it is not a lesson, prediction, policy or causal claim.',
      causalBoundary: 'Correlation and temporal order are not causation. This layer has no causal edge authority.',
      realYieldBoundary: 'A Reference APR increase alone never proves why yield rose; owner real-yield interpretation requires source/mechanism attribution before strong economic explanation.'
    },
    totals: {
      episodeCount: rawEpisodes.length,
      seriesCount: uniqueSeries.length,
      entityCount: uniqueEntities.length,
      patternCandidateCount: patternCandidates.length,
      possibleCounterResetOrCorrectionCount: resetCount,
      multiRunMembershipEpisodeCount,
      episodeClassCounts
    },
    entities: uniqueEntities,
    series: uniqueSeries,
    episodes: rawEpisodes,
    patternCandidates,
    integrity: {
      policySha256: sha256(stableStringify(policy)),
      sourceSha256,
      episodeCompositeHash: sha256(rawEpisodes.map(x => [x.episodeId, x.sourceEventId, x.delta, x.direction, x.incrementVelocityDirection, x.sourceRunMembershipCount, x.sourceRuns])),
      patternCompositeHash: sha256(patternCandidates.map(x => [x.patternId, x.supportCount, x.dominantSignal, x.supportEpisodeIds]))
    }
  };
  output.integrity.stateHash = sha256({ ...output, integrity: output.integrity });
  return output;
}

function selfTest() {
  const policy = {
    authority: { executionAuthority: 'none', causalClaimAuthority: 'none' },
    sourceContract: { requiredHistoryVersion: '0.2.1-change-history' },
    episodeClasses: [
      { id: 'productive-rate-change', category: 'productivity', metrics: ['aprLatestPct'], valueType: 'numeric', counterSemantics: 'point-in-time-rate', patternSignal: 'direction', semanticDomain: 'protocol-economics' },
      { id: 'reported-income-progression', category: 'reporting', metrics: ['currentMonthCashFlowUsd'], valueType: 'numeric', counterSemantics: 'period-cumulative-counter', patternSignal: 'increment-velocity', semanticDomain: 'cash-flow-semantics' }
    ],
    patternPolicy: { minimumSupportEpisodes: 2, minimumDirectionalConsistencyPct: 66.67, status: 'candidate-only', causalClaim: false },
    counterRules: { negativeCumulativeDelta: 'possible-period-reset-or-correction' },
    limits: { maximumEpisodes: 50, maximumPatternCandidates: 20, maximumPatternEvidenceIds: 10 }
  };
  const events = [
    ['a1','2026-01-01','productivity','A','aprLatestPct',10,11],
    ['a2','2026-01-02','productivity','A','aprLatestPct',11,12],
    ['a3','2026-01-03','productivity','A','aprLatestPct',12,11.5],
    ['c1','2026-01-01','reporting','A','currentMonthCashFlowUsd',10,20],
    ['c2','2026-01-02','reporting','A','currentMonthCashFlowUsd',20,32],
    ['c3','2026-01-03','reporting','A','currentMonthCashFlowUsd',32,46],
    ['c4','2026-02-01','reporting','A','currentMonthCashFlowUsd',46,3]
  ].map(([id,date,category,entity,metric,previousValue,currentValue]) => ({ id, detectedAt: `${date}T00:00:00Z`, category, entity, metric, previousValue, currentValue, sourceKeys: [category] }));
  const runs = events.map(e => ({ generatedAt: e.detectedAt, eventIds: [e.id], snapshotHash: e.id, sourceCompositeHash: `s-${e.id}` }));
  runs.push({ generatedAt: '2026-01-02T00:05:00Z', eventIds: ['c2'], snapshotHash: 'c2-repeat', sourceCompositeHash: 's-c2-repeat' });
  const history = {
    version: '0.2.1-change-history', lastUpdatedAt: '2026-02-01T00:00:00Z',
    runs,
    events
  };
  const result = compile(policy, history, `${JSON.stringify(history)}\n`);
  if (result.authority.executionAuthority !== 'none' || result.authority.causalClaimAuthority !== 'none') throw new Error('self-test authority escaped');
  if (result.episodes.length !== 7) throw new Error(`self-test episode count mismatch: ${result.episodes.length}`);
  const duplicateMembership = result.episodes.find(x => x.sourceEventId === 'c2');
  if (duplicateMembership?.sourceRunMembershipCount !== 2 || duplicateMembership?.sourceRuns?.length !== 2) throw new Error('self-test multi-run provenance preservation failed');
  if (duplicateMembership?.sourceRun?.generatedAt !== '2026-01-02T00:00:00.000Z') throw new Error('self-test primary run selection failed');
  const reset = result.episodes.find(x => x.sourceEventId === 'c4');
  if (!reset?.possiblePeriodResetOrCorrection || reset?.economicLossInferred !== false || reset?.direction !== null) throw new Error('self-test cumulative reset semantics failed');
  if (!result.patternCandidates.some(x => x.metric === 'aprLatestPct' && x.dominantSignal === 'increase')) throw new Error('self-test APR pattern missing');
  if (!result.patternCandidates.some(x => x.metric === 'currentMonthCashFlowUsd' && x.dominantSignal === 'increase')) throw new Error('self-test cash-flow velocity pattern missing');
  if (result.patternCandidates.some(x => x.causalClaim !== false || x.status !== 'candidate')) throw new Error('self-test candidate boundary failed');
  console.log(JSON.stringify({ status: 'pass', version: result.version, totals: result.totals, resetSemantics: reset.resetInterpretation, multiRunMemberships: duplicateMembership.sourceRunMembershipCount, executionAuthority: result.authority.executionAuthority }, null, 2));
}

if (SELF_TEST) {
  selfTest();
  process.exit(0);
}

const policyLoaded = readJson(POLICY_FILE);
const historyLoaded = readJson(HISTORY_FILE);
const output = compile(policyLoaded.data, historyLoaded.data, historyLoaded.text);
fs.mkdirSync('intelligence/observational-learning', { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ version: output.version, engineVersion: output.engineVersion, status: output.status, totals: output.totals, source: output.source, executionAuthority: output.authority.executionAuthority }, null, 2));
