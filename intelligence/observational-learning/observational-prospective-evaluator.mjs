#!/usr/bin/env node
import crypto from 'node:crypto';

const arr = value => Array.isArray(value) ? value : [];
const finite = value => {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const round = (value, digits = 8) => {
  const n = finite(value);
  return n === null ? null : Number(n.toFixed(digits));
};
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const signalForEpisode = episode => episode?.patternSignalType === 'increment-velocity'
  ? episode?.incrementVelocityDirection ?? null
  : episode?.direction ?? null;

export function evaluateProspectiveBaseline(episodesInput, baseline, policy) {
  const episodes = arr(episodesInput);
  if (!baseline || baseline?.status !== 'frozen-prospective-baseline') throw new Error('Prospective baseline missing or not frozen');
  if (baseline?.authority?.executionAuthority !== 'none' || baseline?.authority?.causalClaimAuthority !== 'none') throw new Error('Prospective baseline authority boundary failed');
  const frozenAt = new Date(baseline?.frozenAt ?? '').toISOString();
  const expectedIds = new Set(arr(baseline?.patternIds));
  if (!expectedIds.size || expectedIds.size !== Number(baseline?.patternCount)) throw new Error('Prospective baseline pattern count mismatch');

  const minSupport = Number(policy?.patternPolicy?.minimumSupportEpisodes ?? 2);
  const minConsistency = Number(policy?.patternPolicy?.minimumDirectionalConsistencyPct ?? 66.67);
  const maxEvidence = Number(policy?.limits?.maximumPatternEvidenceIds ?? 50);
  const bySeries = new Map();
  for (const episode of episodes) {
    if (!bySeries.has(episode.seriesKey)) bySeries.set(episode.seriesKey, []);
    bySeries.get(episode.seriesKey).push(episode);
  }

  const evaluations = [];
  const matchedIds = new Set();

  for (const [seriesKey, series] of [...bySeries.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const baselineRows = series
      .filter(x => x.observedAt <= frozenAt)
      .map(episode => ({ episode, signal: signalForEpisode(episode) }))
      .filter(row => row.signal && row.signal !== 'unchanged');
    if (baselineRows.length < minSupport) continue;

    const counts = {};
    for (const row of baselineRows) counts[row.signal] = (counts[row.signal] || 0) + 1;
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    if (!dominant) continue;
    const [dominantSignal, frozenSupportCount] = dominant;
    const frozenConsistencyPct = round(frozenSupportCount / baselineRows.length * 100, 2);
    if (frozenSupportCount < minSupport || frozenConsistencyPct < minConsistency) continue;

    const exemplar = series.filter(x => x.observedAt <= frozenAt).at(-1);
    if (!exemplar) continue;
    const patternId = `pattern-${sha256(`${seriesKey}|${dominantSignal}|${exemplar.patternSignalType}`).slice(0, 20)}`;
    if (!expectedIds.has(patternId)) continue;
    matchedIds.add(patternId);

    const futureRows = series
      .filter(x => x.observedAt > frozenAt)
      .map(episode => ({ episode, signal: signalForEpisode(episode) }));
    const scoredRows = futureRows.filter(row => row.signal && row.signal !== 'unchanged');
    const supportRows = scoredRows.filter(row => row.signal === dominantSignal);
    const counterRows = scoredRows.filter(row => row.signal !== dominantSignal);
    const noSignalRows = futureRows.filter(row => !row.signal || row.signal === 'unchanged');

    evaluations.push({
      patternId,
      seriesKey,
      episodeClass: exemplar.episodeClass,
      semanticDomain: exemplar.semanticDomain,
      entity: exemplar.entity,
      metric: exemplar.metric,
      signalType: exemplar.patternSignalType,
      frozenDominantSignal: dominantSignal,
      frozenAt,
      frozenSupportCount,
      frozenObservedSignalCount: baselineRows.length,
      frozenDirectionalConsistencyPct: frozenConsistencyPct,
      postFreezeEpisodeCount: futureRows.length,
      postFreezeScoredSignalCount: scoredRows.length,
      prospectiveSupportCount: supportRows.length,
      prospectiveCounterevidenceCount: counterRows.length,
      prospectiveNoSignalCount: noSignalRows.length,
      prospectiveSupportEpisodeIds: supportRows.map(x => x.episode.episodeId).slice(-maxEvidence),
      prospectiveCounterevidenceEpisodeIds: counterRows.map(x => x.episode.episodeId).slice(-maxEvidence),
      prospectiveNoSignalEpisodeIds: noSignalRows.map(x => x.episode.episodeId).slice(-maxEvidence),
      status: scoredRows.length ? 'observing-prospectively' : 'waiting-no-post-freeze-scored-evidence',
      epistemicStatus: 'prospective-evaluation-of-retrospective-candidate',
      predictionClaim: false,
      causalClaim: false,
      lessonClaim: false,
      policyAuthority: false,
      executionAuthority: 'none'
    });
  }

  const missing = [...expectedIds].filter(id => !matchedIds.has(id));
  if (missing.length) throw new Error(`Frozen prospective patterns cannot be reconstructed from pre-freeze canonical history: ${missing.join(', ')}`);

  const totals = {
    frozenPatternCount: expectedIds.size,
    reconstructedFrozenPatternCount: matchedIds.size,
    patternsWithPostFreezeScoredEvidence: evaluations.filter(x => x.postFreezeScoredSignalCount > 0).length,
    postFreezeEpisodeCount: evaluations.reduce((sum, x) => sum + x.postFreezeEpisodeCount, 0),
    postFreezeScoredSignalCount: evaluations.reduce((sum, x) => sum + x.postFreezeScoredSignalCount, 0),
    prospectiveSupportCount: evaluations.reduce((sum, x) => sum + x.prospectiveSupportCount, 0),
    prospectiveCounterevidenceCount: evaluations.reduce((sum, x) => sum + x.prospectiveCounterevidenceCount, 0),
    prospectiveNoSignalCount: evaluations.reduce((sum, x) => sum + x.prospectiveNoSignalCount, 0)
  };

  return {
    version: '0.1-prospective-pattern-evaluation',
    status: totals.patternsWithPostFreezeScoredEvidence ? 'observing-prospectively' : 'warming-no-post-freeze-scored-evidence',
    frozenAt,
    semantics: {
      purpose: 'Evaluate a frozen retrospective candidate only on later canonical eligible change-events.',
      supportAndCounterevidenceSymmetric: true,
      eventTriggeredSampling: true,
      marketFrequencyClaimAllowed: false,
      trendStrengthClaimAllowed: false,
      predictionClaimAllowed: false,
      causalClaimAllowed: false,
      lessonPromotionAllowed: false,
      automaticPolicyMutation: false,
      executionAuthority: 'none'
    },
    totals,
    evaluations,
    integrity: {
      baselinePatternIdsHash: sha256([...expectedIds].sort()),
      evaluationCompositeHash: sha256(evaluations.map(x => [
        x.patternId,
        x.frozenDominantSignal,
        x.prospectiveSupportEpisodeIds,
        x.prospectiveCounterevidenceEpisodeIds,
        x.prospectiveNoSignalEpisodeIds
      ]))
    }
  };
}
