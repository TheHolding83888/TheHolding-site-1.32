#!/usr/bin/env node
/**
 * THE HOLDING — NEURAL GRAPH OBSERVATIONAL EXPERIENCE v0.1
 *
 * Enriches the existing canonical Neural Graph overlay with exact longitudinal
 * observational episodes and candidate temporal patterns. It never creates a
 * second graph and has no causal, policy, methodology or execution authority.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILES = Object.freeze({
  base: 'intelligence/neural-graph/neural-graph-telemetry.json',
  quality: 'intelligence/neural-graph/neural-graph-quality.json',
  observational: 'intelligence/observational-learning/observational-experience.json',
  policy: 'intelligence/observational-learning/observational-learning-policy.json'
});
const VERSION = '0.4-neural-graph-observational-experience';
const ENGINE_VERSION = '0.4.0-observational-experience-bridge';
const SELF_TEST = process.argv.includes('--self-test');
const CAUSAL_KINDS = new Set(['caused-by', 'causes']);
const ALLOWED_EPISTEMIC = new Set(['direct', 'derived', 'candidate-association']);

const arr = value => Array.isArray(value) ? value : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const pct = (n, d) => d > 0 ? Number((n / d * 100).toFixed(2)) : null;
const fpNode = value => sha256({ type: value.type, label: value.label, status: value.status, provenance: value.provenance, data: value.data });
const fpEdge = value => sha256({ kind: value.kind, from: value.from, to: value.to, status: value.status, epistemicClass: value.epistemicClass, data: value.data });

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing observational graph source: ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  return { text, data: JSON.parse(text) };
}

function makeGraph(baseNodes, baseConnections, overlayNodes, overlayConnections) {
  const allNodes = () => new Map([...baseNodes, ...overlayNodes]);
  const allConnections = () => new Map([...baseConnections, ...overlayConnections]);
  function addNode(type, rawId, label, data = {}, provenance = {}, status = 'established') {
    const local = norm(rawId);
    if (!local) return null;
    const id = `${type}:${local}`;
    if (baseNodes.has(id)) return id;
    const value = { id, type, label: String(label ?? rawId), status, provenance, data };
    value.fingerprint = fpNode(value);
    const prior = overlayNodes.get(id);
    if (!prior) overlayNodes.set(id, value);
    else if (prior.fingerprint !== value.fingerprint) {
      const merged = {
        ...prior,
        status: prior.status === 'established' || value.status === 'established' ? 'established' : value.status,
        provenance: { ...obj(prior.provenance), ...obj(value.provenance) },
        data: { ...obj(prior.data), ...obj(value.data) }
      };
      merged.fingerprint = fpNode(merged);
      overlayNodes.set(id, merged);
    }
    return id;
  }
  function addConnection(kind, from, to, data = {}, status = 'established', epistemicClass = 'direct') {
    if (!from || !to) return null;
    if (!ALLOWED_EPISTEMIC.has(epistemicClass)) throw new Error(`Unsupported observational epistemic class: ${epistemicClass}`);
    if (CAUSAL_KINDS.has(kind)) throw new Error(`Observational learner has no causal edge authority: ${kind}`);
    const nodes = allNodes();
    if (!nodes.has(from) || !nodes.has(to)) throw new Error(`Refusing dangling observational edge ${kind}: ${from} -> ${to}`);
    const id = `${kind}:${from}->${to}`;
    if (baseConnections.has(id)) return id;
    const value = { id, kind, from, to, status, epistemicClass, data };
    value.fingerprint = fpEdge(value);
    overlayConnections.set(id, value);
    return id;
  }
  return { allNodes, allConnections, addNode, addConnection };
}

function connectivity(nodesMap, connectionsMap) {
  const ids = [...nodesMap.entries()].filter(([, n]) => n?.status !== 'candidate').map(([id]) => id);
  const idSet = new Set(ids);
  const edges = [...connectionsMap.values()].filter(e => e?.status !== 'candidate' && idSet.has(e.from) && idSet.has(e.to));
  const adjacency = new Map(ids.map(id => [id, new Set()]));
  for (const edge of edges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }
  const zeroDegreeIds = ids.filter(id => (adjacency.get(id)?.size || 0) === 0);
  const seen = new Set();
  const components = [];
  for (const start of ids) {
    if (seen.has(start)) continue;
    const queue = [start];
    const members = [];
    seen.add(start);
    while (queue.length) {
      const current = queue.shift();
      members.push(current);
      for (const next of adjacency.get(current) || []) if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
    components.push(members);
  }
  components.sort((a, b) => b.length - a.length);
  return {
    nodeCount: ids.length,
    edgeCount: edges.length,
    edgesPerNode: ids.length ? Number((edges.length / ids.length).toFixed(4)) : null,
    zeroDegreeCount: zeroDegreeIds.length,
    zeroDegreePct: ids.length ? Number((zeroDegreeIds.length / ids.length * 100).toFixed(2)) : null,
    connectedComponentCount: components.length,
    singletonComponentCount: components.filter(x => x.length === 1).length,
    largestComponentSize: components[0]?.length || 0,
    largestComponentPct: ids.length ? Number(((components[0]?.length || 0) / ids.length * 100).toFixed(2)) : null,
    zeroDegreeIds: zeroDegreeIds.slice(0, 100)
  };
}

function resolveEntity(graph, raw) {
  const local = norm(raw);
  for (const type of ['company', 'protocol', 'strategy', 'entity']) {
    const id = `${type}:${local}`;
    if (graph.allNodes().has(id)) return id;
  }
  return graph.addNode('entity', raw, raw, { observationalOnlyIdentity: true }, { source: FILES.observational }, 'established');
}

function metricTarget(graph, episode) {
  const entityLocal = norm(episode.entity);
  if (episode.metric === 'aprLatestPct') {
    const id = `metric:company:${entityLocal}:reference-yield`;
    if (graph.allNodes().has(id)) return id;
  }
  if (episode.metric === 'coverage') {
    const id = `metric:company:${entityLocal}:coverage`;
    if (graph.allNodes().has(id)) return id;
  }
  if (episode.semanticDomain === 'cash-flow-semantics') {
    const id = 'context-domain:cash-flow-semantics';
    if (graph.allNodes().has(id)) return id;
  }
  if (episode.semanticDomain === 'protocol-economics') {
    const id = 'context-domain:protocol-economics';
    if (graph.allNodes().has(id)) return id;
  }
  return null;
}

function applyObservationalLayer(base, quality, observational, observationalText, policyText) {
  if (base?.authority?.executionAuthority !== 'none' || base?.authority?.readOnly !== true) throw new Error('Base graph authority boundary failed');
  if (quality?.version !== '0.3-neural-graph-relation-quality-experience') throw new Error(`Expected Experience graph 0.3 before observational pass, got ${quality?.version}`);
  if (quality?.authority?.executionAuthority !== 'none' || quality?.authority?.causalClaimAuthority !== 'none-by-default') throw new Error('Experience graph authority boundary failed');
  if (observational?.version !== '0.1-autonomous-observational-experience') throw new Error(`Unexpected observational state version: ${observational?.version}`);
  if (observational?.authority?.executionAuthority !== 'none' || observational?.authority?.causalClaimAuthority !== 'none') throw new Error('Observational state gained authority');
  if (arr(observational?.patternCandidates).some(x => x?.causalClaim !== false || x?.status !== 'candidate')) throw new Error('Observational patterns escaped candidate/non-causal boundary');

  const baseNodes = new Map(Object.entries(obj(base?.catalog?.nodes)));
  const baseConnections = new Map(Object.entries(obj(base?.catalog?.connections)));
  const overlayNodes = new Map(Object.entries(obj(quality?.overlay?.nodes)));
  const overlayConnections = new Map(Object.entries(obj(quality?.overlay?.connections)));
  const priorConnectivity = connectivity(new Map([...baseNodes, ...overlayNodes]), new Map([...baseConnections, ...overlayConnections]));
  const initialEstablishedNodes = [...overlayNodes.values()].filter(x => x?.status !== 'candidate').length;
  const initialEstablishedConnections = [...overlayConnections.values()].filter(x => x?.status !== 'candidate').length;
  const graph = makeGraph(baseNodes, baseConnections, overlayNodes, overlayConnections);

  const episodeNodeById = new Map();
  const entityByEpisodeId = new Map();
  for (const episode of arr(observational?.episodes)) {
    if (episode?.epistemic?.causalClaim !== false) throw new Error(`Episode claims causation: ${episode?.episodeId}`);
    const episodeNode = graph.addNode('observational-episode', episode.episodeId, `${episode.entity} · ${episode.metric} · ${episode.observedAt}`, {
      episodeClass: episode.episodeClass,
      observedAt: episode.observedAt,
      windowStart: episode.windowStart,
      windowEnd: episode.windowEnd,
      metric: episode.metric,
      unit: episode.unit,
      previousValue: episode.previousValue,
      currentValue: episode.currentValue,
      delta: episode.delta,
      direction: episode.direction,
      increment: episode.increment,
      incrementVelocityDirection: episode.incrementVelocityDirection,
      possiblePeriodResetOrCorrection: episode.possiblePeriodResetOrCorrection,
      economicLossInferred: false,
      causalClaim: false,
      sourceEventId: episode.sourceEventId
    }, {
      source: FILES.observational,
      canonicalHistoryFile: observational?.source?.file ?? null,
      sourceHistorySha256: observational?.source?.sha256 ?? null,
      sourceEventId: episode.sourceEventId,
      sourceKeys: episode.sourceKeys
    }, 'established');
    episodeNodeById.set(episode.episodeId, episodeNode);

    const entity = resolveEntity(graph, episode.entity);
    entityByEpisodeId.set(episode.episodeId, entity);
    graph.addConnection('observed-in', episodeNode, entity, { observedAt: episode.observedAt }, 'established', 'direct');

    const metric = metricTarget(graph, episode);
    if (metric) graph.addConnection('observation-measures', episodeNode, metric, { metric: episode.metric, semanticDomain: episode.semanticDomain }, 'established', 'direct');

    if (episode.changedAfterEpisodeId) {
      const prior = episodeNodeById.get(episode.changedAfterEpisodeId) || `observational-episode:${norm(episode.changedAfterEpisodeId)}`;
      if (!graph.allNodes().has(prior)) throw new Error(`Prior observational episode missing: ${episode.episodeId} -> ${episode.changedAfterEpisodeId}`);
      graph.addConnection('changed-after', episodeNode, prior, {
        temporalOnly: true,
        causalClaim: false,
        windowStart: episode.windowStart,
        windowEnd: episode.windowEnd
      }, 'established', 'derived');
    }
  }

  for (const pattern of arr(observational?.patternCandidates)) {
    const patternNode = graph.addNode('observational-pattern-candidate', pattern.patternId, pattern.statement ?? pattern.patternId, {
      status: 'candidate',
      seriesKey: pattern.seriesKey,
      episodeClass: pattern.episodeClass,
      metric: pattern.metric,
      signalType: pattern.signalType,
      dominantSignal: pattern.dominantSignal,
      supportCount: pattern.supportCount,
      directionalConsistencyPct: pattern.directionalConsistencyPct,
      causalClaim: false
    }, { source: FILES.observational, sourceHistorySha256: observational?.source?.sha256 ?? null }, 'candidate');

    const entityTarget = resolveEntity(graph, pattern.entity);
    graph.addConnection('applies-to-company', patternNode, entityTarget, { candidateOnly: true }, 'candidate', 'candidate-association');

    const semanticTarget = pattern.semanticDomain === 'cash-flow-semantics'
      ? 'context-domain:cash-flow-semantics'
      : pattern.semanticDomain === 'protocol-economics'
        ? 'context-domain:protocol-economics'
        : null;
    if (semanticTarget && graph.allNodes().has(semanticTarget)) {
      graph.addConnection('hypothesis-about', patternNode, semanticTarget, { candidateOnly: true, causalClaim: false }, 'candidate', 'candidate-association');
    }
    for (const episodeId of arr(pattern.supportEpisodeIds)) {
      const episodeNode = episodeNodeById.get(episodeId) || `observational-episode:${norm(episodeId)}`;
      if (!graph.allNodes().has(episodeNode)) throw new Error(`Pattern evidence episode missing: ${pattern.patternId} -> ${episodeId}`);
      graph.addConnection('pattern-observed-across', patternNode, episodeNode, { candidateOnly: true }, 'candidate', 'candidate-association');
    }
  }

  const mergedNodes = graph.allNodes();
  const mergedConnections = graph.allConnections();
  for (const edge of mergedConnections.values()) {
    if (!mergedNodes.has(edge.from) || !mergedNodes.has(edge.to)) throw new Error(`Final observational graph has dangling edge: ${edge.id}`);
    if (CAUSAL_KINDS.has(edge.kind)) throw new Error(`Observational graph contains causal edge: ${edge.id}`);
  }

  const finalConnectivity = connectivity(mergedNodes, mergedConnections);
  const finalEstablishedNodes = [...overlayNodes.values()].filter(x => x?.status !== 'candidate').length;
  const finalEstablishedConnections = [...overlayConnections.values()].filter(x => x?.status !== 'candidate').length;
  const traceableEpisodes = arr(observational?.episodes).filter(episode => {
    const node = `observational-episode:${norm(episode.episodeId)}`;
    const entity = entityByEpisodeId.get(episode.episodeId);
    return graph.allNodes().has(node) && !!entity && [...mergedConnections.values()].some(edge => edge.kind === 'observed-in' && edge.from === node && edge.to === entity);
  }).length;
  const traceablePatterns = arr(observational?.patternCandidates).filter(pattern => {
    const node = `observational-pattern-candidate:${norm(pattern.patternId)}`;
    return graph.allNodes().has(node) && arr(pattern.supportEpisodeIds).every(episodeId => [...mergedConnections.values()].some(edge => edge.kind === 'pattern-observed-across' && edge.from === node && edge.to === `observational-episode:${norm(episodeId)}`));
  }).length;

  quality.version = VERSION;
  quality.engineVersion = ENGINE_VERSION;
  quality.generatedAt = observational?.generatedAt ?? quality.generatedAt;
  quality.purpose = 'Measure canonical graph usefulness, owner/decision experience traceability and autonomous observational episode/pattern connectivity without causal inflation.';
  quality.authority = {
    ...obj(quality.authority),
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    methodologyMutationAuthority: false,
    policyMutationAuthority: false,
    causalClaimAuthority: 'none-by-default'
  };
  quality.sourceState = {
    ...obj(quality.sourceState),
    observationalExperience: {
      file: FILES.observational,
      version: observational?.version ?? null,
      generatedAt: observational?.generatedAt ?? null,
      sourceHistoryFile: observational?.source?.file ?? null,
      sourceHistoryLastUpdatedAt: observational?.source?.lastUpdatedAt ?? null,
      sourceHistorySha256: observational?.source?.sha256 ?? null,
      sha256: sha256(observationalText)
    }
  };
  quality.connectivity = {
    ...obj(quality.connectivity),
    enriched: finalConnectivity,
    observationalDelta: {
      priorEstablishedNodes: priorConnectivity.nodeCount,
      priorEstablishedConnections: priorConnectivity.edgeCount,
      addedEstablishedNodes: finalEstablishedNodes - initialEstablishedNodes,
      addedEstablishedConnections: finalEstablishedConnections - initialEstablishedConnections,
      connectedComponentChange: finalConnectivity.connectedComponentCount - priorConnectivity.connectedComponentCount,
      zeroDegreeChange: finalConnectivity.zeroDegreeCount - priorConnectivity.zeroDegreeCount
    }
  };
  quality.observationalLearning = {
    status: observational?.status ?? 'unknown',
    episodeCount: arr(observational?.episodes).length,
    traceableEpisodeCount: traceableEpisodes,
    episodeTraceabilityPct: pct(traceableEpisodes, arr(observational?.episodes).length),
    seriesCount: observational?.totals?.seriesCount ?? null,
    entityCount: observational?.totals?.entityCount ?? null,
    episodeClassCounts: observational?.totals?.episodeClassCounts ?? {},
    patternCandidateCount: arr(observational?.patternCandidates).length,
    traceablePatternCandidateCount: traceablePatterns,
    patternCandidateTraceabilityPct: pct(traceablePatterns, arr(observational?.patternCandidates).length),
    possibleCounterResetOrCorrectionCount: observational?.totals?.possibleCounterResetOrCorrectionCount ?? 0,
    causalConnectionCount: 0,
    causalClaimAuthority: 'none',
    executionAuthority: 'none',
    relationKinds: ['observed-in', 'observation-measures', 'changed-after', 'pattern-observed-across', 'applies-to-company', 'hypothesis-about'],
    epistemicLadder: ['exact-observation', 'deterministic-derived-change', 'candidate-association'],
    rule: 'Autonomous observations become exact episodes and bounded candidate temporal patterns. changed-after, repeated direction and co-history never mean caused-by.'
  };
  quality.overlay = {
    semantics: 'Canonical enriched traversal overlay over base Neural Graph telemetry. This is not a second graph or truth source.',
    nodes: Object.fromEntries([...overlayNodes.entries()].sort(([a], [b]) => a.localeCompare(b))),
    connections: Object.fromEntries([...overlayConnections.entries()].sort(([a], [b]) => a.localeCompare(b)))
  };
  quality.integrity = {
    ...obj(quality.integrity),
    observationalExperienceHash: sha256(observationalText),
    observationalPolicyHash: sha256(policyText),
    observationalOverlayNodeHash: sha256([...overlayNodes.values()].filter(x => x?.type === 'observational-episode' || x?.type === 'observational-pattern-candidate').map(x => [x.id, x.fingerprint]).sort()),
    observationalConnectionHash: sha256([...overlayConnections.values()].filter(x => ['observed-in','observation-measures','changed-after','pattern-observed-across','applies-to-company','hypothesis-about'].includes(x?.kind)).map(x => [x.id, x.fingerprint]).sort())
  };
  delete quality.integrity.qualityHash;
  quality.integrity.qualityHash = sha256({ ...quality, integrity: quality.integrity });
  return quality;
}

function selfTest() {
  const company = { id: 'company:a', type: 'company', label: 'A', status: 'established', provenance: {}, data: {} };
  company.fingerprint = fpNode(company);
  const metric = { id: 'metric:company:a:reference-yield', type: 'metric', label: 'A yield', status: 'established', provenance: {}, data: {} };
  metric.fingerprint = fpNode(metric);
  const domain = { id: 'context-domain:protocol-economics', type: 'context-domain', label: 'protocol economics', status: 'established', provenance: {}, data: {} };
  domain.fingerprint = fpNode(domain);
  const domainBridge = { id: `fixture-domain-link:${domain.id}->${metric.id}`, kind: 'fixture-domain-link', from: domain.id, to: metric.id, status: 'established', epistemicClass: 'direct', data: { fixture: true } };
  domainBridge.fingerprint = fpEdge(domainBridge);
  const base = { authority: { executionAuthority: 'none', readOnly: true }, catalog: { nodes: { [company.id]: company, [metric.id]: metric }, connections: {} } };
  const quality = {
    version: '0.3-neural-graph-relation-quality-experience', engineVersion: 'fixture', generatedAt: '2026-01-01T00:00:00Z',
    authority: { executionAuthority: 'none', readOnly: true, causalClaimAuthority: 'none-by-default' },
    overlay: { nodes: { [domain.id]: domain }, connections: { [domainBridge.id]: domainBridge } }, connectivity: {}, sourceState: {}, integrity: {}
  };
  const observational = {
    version: '0.1-autonomous-observational-experience', generatedAt: '2026-01-02T00:00:00Z', status: 'ready',
    authority: { executionAuthority: 'none', causalClaimAuthority: 'none' },
    source: { file: 'intelligence/change-history.json', sha256: 'fixture' }, totals: { seriesCount: 1, entityCount: 1, episodeClassCounts: { 'productive-rate-change': 2 } },
    episodes: [
      { episodeId: 'obs-1', sourceEventId: '1', episodeClass: 'productive-rate-change', semanticDomain: 'protocol-economics', observedAt: '2026-01-01T00:00:00Z', windowStart: null, windowEnd: '2026-01-01T00:00:00Z', changedAfterEpisodeId: null, entity: 'A', metric: 'aprLatestPct', previousValue: 10, currentValue: 11, delta: 1, direction: 'increase', sourceKeys: ['productivity'], epistemic: { causalClaim: false } },
      { episodeId: 'obs-2', sourceEventId: '2', episodeClass: 'productive-rate-change', semanticDomain: 'protocol-economics', observedAt: '2026-01-02T00:00:00Z', windowStart: '2026-01-01T00:00:00Z', windowEnd: '2026-01-02T00:00:00Z', changedAfterEpisodeId: 'obs-1', entity: 'A', metric: 'aprLatestPct', previousValue: 11, currentValue: 12, delta: 1, direction: 'increase', sourceKeys: ['productivity'], epistemic: { causalClaim: false } }
    ],
    patternCandidates: [{ patternId: 'p1', status: 'candidate', causalClaim: false, entity: 'A', metric: 'aprLatestPct', semanticDomain: 'protocol-economics', statement: 'candidate', supportEpisodeIds: ['obs-1','obs-2'] }]
  };
  const out = applyObservationalLayer(base, quality, observational, JSON.stringify(observational), '{}');
  if (out.authority.executionAuthority !== 'none' || out.observationalLearning.causalConnectionCount !== 0) throw new Error('self-test authority boundary failed');
  if (out.observationalLearning.episodeTraceabilityPct !== 100 || out.observationalLearning.patternCandidateTraceabilityPct !== 100) throw new Error('self-test traceability failed');
  const episodeIds = Object.values(out.overlay.nodes).filter(node => node?.type === 'observational-episode' && node?.status !== 'candidate').map(node => node.id);
  const establishedEdges = Object.values(out.overlay.connections).filter(edge => edge?.status !== 'candidate');
  if (episodeIds.some(id => !establishedEdges.some(edge => edge.from === id || edge.to === id))) throw new Error('self-test created isolated established observational neuron');
  if (out.connectivity.enriched.zeroDegreeCount !== 0) throw new Error('self-test fixture is not a connected prior graph');
  if (Object.values(out.overlay.connections).some(edge => CAUSAL_KINDS.has(edge.kind))) throw new Error('self-test causal edge leaked');
  console.log(JSON.stringify({ status: 'pass', version: out.version, observationalLearning: out.observationalLearning, connectivity: out.connectivity.enriched }, null, 2));
}

if (SELF_TEST) {
  selfTest();
  process.exit(0);
}

const loaded = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, readJson(file)]));
const output = applyObservationalLayer(loaded.base.data, loaded.quality.data, loaded.observational.data, loaded.observational.text, loaded.policy.text);
fs.writeFileSync(FILES.quality, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ version: output.version, engineVersion: output.engineVersion, observationalLearning: output.observationalLearning, observationalDelta: output.connectivity.observationalDelta, enrichedConnectivity: output.connectivity.enriched, executionAuthority: output.authority.executionAuthority }, null, 2));
