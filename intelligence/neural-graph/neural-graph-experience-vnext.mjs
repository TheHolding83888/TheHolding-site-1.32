#!/usr/bin/env node
/**
 * THE HOLDING — NEURAL GRAPH EXPERIENCE RELATIONS v0.2
 *
 * Enriches the existing canonical Neural Graph quality overlay with typed,
 * provenance-aware Decision -> Outcome -> Evidence Review -> Lesson relations.
 *
 * This is an enrichment pass over the existing graph, not a second graph.
 * It is read-only with respect to capital, policy, methodology and execution.
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const FILES = Object.freeze({
  base: 'intelligence/neural-graph/neural-graph-telemetry.json',
  quality: 'intelligence/neural-graph/neural-graph-quality.json',
  decisions: 'intelligence/learning/decision-ledger.json',
  outcomeMemory: 'intelligence/learning-state/outcome-memory.json',
  ownerOutcomeExperience: 'intelligence/learning-state/owner-outcome-experience.json',
  ownerOutcomeReviews: 'intelligence/learning/owner-outcome-review-ledger.json',
  owner: 'intelligence/owner-context/owner-decision-context.json',
});
const VERSION = '0.3-neural-graph-relation-quality-experience';
const ENGINE_VERSION = '0.3.1-experience-traceability-semantic-bridge-evaluator';
const SELF_TEST = process.argv.includes('--self-test');
const CAUSAL_KINDS = new Set(['caused-by', 'causes']);
const ALLOWED_EPISTEMIC = new Set([
  'direct', 'derived', 'owner-reported', 'hypothesized', 'unknown',
  'reviewed-association', 'candidate-association', 'learned-association'
]);
const EXPERIENCE_KINDS = new Set([
  'decision-expected-result', 'decision-about', 'outcome-of', 'outcome-observed-by', 'settled-by',
  'decision-experience-class', 'experience-evaluates-expectation', 'review-of', 'review-supersedes-review',
  'review-supported-by', 'review-counterevidence', 'review-supports-expectation', 'review-contradicts-expectation',
  'review-assesses-expectation', 'lesson-applies-to-experience-class', 'lesson-derived-from-decision',
  'lesson-derived-from-review'
]);

const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
const pct = (numerator, denominator) => denominator > 0 ? Number((numerator / denominator * 100).toFixed(2)) : null;
const fpNode = value => sha256({ type: value.type, label: value.label, status: value.status, provenance: value.provenance, data: value.data });
const fpEdge = value => sha256({ kind: value.kind, from: value.from, to: value.to, status: value.status, epistemicClass: value.epistemicClass, data: value.data });

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`Missing Neural Graph vNext source: ${file}`);
  const text = fs.readFileSync(file, 'utf8');
  if (!text.trim()) throw new Error(`Empty Neural Graph vNext source: ${file}`);
  try { return { text, data: JSON.parse(text) }; }
  catch (error) { throw new Error(`Invalid JSON ${file}: ${error.message}`); }
}

function makeGraph(baseNodes, baseConnections, overlayNodes, overlayConnections) {
  const allNodes = () => new Map([...baseNodes, ...overlayNodes]);
  const allConnections = () => new Map([...baseConnections, ...overlayConnections]);

  function addNode(type, rawId, label, data = {}, provenance = {}, status = 'established') {
    const local = norm(rawId);
    if (!local) return null;
    const id = `${type}:${local}`;
    if (baseNodes.has(id)) return id;
    const prior = overlayNodes.get(id);
    const value = { id, type, label: String(label ?? rawId), status, provenance, data };
    value.fingerprint = fpNode(value);
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
    if (!ALLOWED_EPISTEMIC.has(epistemicClass)) throw new Error(`Unsupported epistemic class: ${epistemicClass}`);
    if (CAUSAL_KINDS.has(kind) && data?.causalEvidence !== true) throw new Error(`Unsupported causal edge without mechanism proof: ${kind}`);
    const nodeMap = allNodes();
    if (!nodeMap.has(from) || !nodeMap.has(to)) throw new Error(`Refusing dangling experience edge ${kind}: ${from} -> ${to}`);
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
  const establishedNodeIds = [...nodesMap.entries()].filter(([, n]) => n?.status !== 'candidate').map(([id]) => id);
  const establishedNodeSet = new Set(establishedNodeIds);
  const establishedEdges = [...connectionsMap.values()].filter(e => e?.status !== 'candidate' && establishedNodeSet.has(e.from) && establishedNodeSet.has(e.to));
  const adjacency = new Map(establishedNodeIds.map(id => [id, new Set()]));
  for (const edge of establishedEdges) {
    adjacency.get(edge.from)?.add(edge.to);
    adjacency.get(edge.to)?.add(edge.from);
  }
  const zeroDegreeIds = establishedNodeIds.filter(id => (adjacency.get(id)?.size || 0) === 0);
  const isolatedByType = {};
  for (const id of zeroDegreeIds) {
    const type = nodesMap.get(id)?.type || 'unknown';
    isolatedByType[type] = (isolatedByType[type] || 0) + 1;
  }
  const seen = new Set();
  const components = [];
  for (const start of establishedNodeIds) {
    if (seen.has(start)) continue;
    const queue = [start];
    const members = [];
    seen.add(start);
    while (queue.length) {
      const current = queue.shift();
      members.push(current);
      for (const next of adjacency.get(current) || []) {
        if (!seen.has(next)) { seen.add(next); queue.push(next); }
      }
    }
    components.push(members);
  }
  components.sort((a, b) => b.length - a.length);
  return {
    nodeCount: establishedNodeIds.length,
    edgeCount: establishedEdges.length,
    edgesPerNode: establishedNodeIds.length ? Number((establishedEdges.length / establishedNodeIds.length).toFixed(4)) : null,
    zeroDegreeCount: zeroDegreeIds.length,
    zeroDegreePct: establishedNodeIds.length ? Number((zeroDegreeIds.length / establishedNodeIds.length * 100).toFixed(2)) : null,
    isolatedByType,
    connectedComponentCount: components.length,
    singletonComponentCount: components.filter(x => x.length === 1).length,
    largestComponentSize: components[0]?.length || 0,
    largestComponentPct: establishedNodeIds.length ? Number(((components[0]?.length || 0) / establishedNodeIds.length * 100).toFixed(2)) : null,
    zeroDegreeIds: zeroDegreeIds.slice(0, 100)
  };
}

function runSelfTest() {
  if (pct(0, 0) !== null || pct(2, 2) !== 100) throw new Error('null/traceability semantics self-test failed');
  const baseNodes = new Map();
  for (const id of ['decision:dec-a', 'decision:dec-b', 'context-domain:protocol-economics', 'context-domain:cash-flow-semantics', 'context-domain:capital-allocation']) {
    const [type] = id.split(':');
    const value = { id, type, label: id, status: 'established', provenance: {}, data: {} };
    value.fingerprint = fpNode(value);
    baseNodes.set(id, value);
  }
  const overlayNodes = new Map();
  const overlayConnections = new Map();
  const graph = makeGraph(baseNodes, new Map(), overlayNodes, overlayConnections);
  const heuristic = graph.addNode('owner-heuristic', 'fixture', 'Fixture heuristic', {}, {}, 'established');
  for (const domain of ['context-domain:protocol-economics', 'context-domain:cash-flow-semantics', 'context-domain:capital-allocation']) {
    graph.addConnection('owner-heuristic-contextualizes', heuristic, domain, {}, 'established', 'owner-reported');
  }
  const reviewA = graph.addNode('owner-outcome-review', 'review-a', 'Review A', {}, {}, 'established');
  const reviewB = graph.addNode('owner-outcome-review', 'review-b', 'Review B', {}, {}, 'established');
  graph.addConnection('review-of', reviewA, 'decision:dec-a', {}, 'established', 'reviewed-association');
  graph.addConnection('review-of', reviewB, 'decision:dec-b', {}, 'established', 'reviewed-association');
  const lesson = graph.addNode('learned-lesson', 'lesson-a', 'Lesson', { causalClaim: false }, {}, 'established');
  graph.addConnection('lesson-derived-from-review', lesson, reviewA, {}, 'established', 'learned-association');
  graph.addConnection('lesson-derived-from-review', lesson, reviewB, {}, 'established', 'learned-association');
  graph.addConnection('lesson-derived-from-decision', lesson, 'decision:dec-a', {}, 'established', 'learned-association');
  graph.addConnection('lesson-derived-from-decision', lesson, 'decision:dec-b', {}, 'established', 'learned-association');
  let causalRejected = false;
  try { graph.addConnection('caused-by', lesson, reviewA, {}, 'established', 'learned-association'); }
  catch { causalRejected = true; }
  if (!causalRejected) throw new Error('causal boundary self-test failed');
  const c = connectivity(graph.allNodes(), graph.allConnections());
  if (c.zeroDegreeCount !== 0 || c.singletonComponentCount !== 0) throw new Error('self-test created isolated experience neurons');
  console.log(JSON.stringify({ status: 'pass', engineVersion: ENGINE_VERSION, causalRejected, connectivity: c, executionAuthority: 'none' }, null, 2));
}

if (SELF_TEST) {
  runSelfTest();
  process.exit(0);
}

const loaded = Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, readJson(file)]));
const base = loaded.base.data;
const quality = loaded.quality.data;
const decisions = loaded.decisions.data;
const outcomeMemory = loaded.outcomeMemory.data;
const ownerOutcomeExperience = loaded.ownerOutcomeExperience.data;
const ownerOutcomeReviews = loaded.ownerOutcomeReviews.data;
const owner = loaded.owner.data;

if (base?.authority?.executionAuthority !== 'none' || base?.authority?.readOnly !== true) throw new Error('Base Neural Graph authority boundary failed');
if (quality?.authority?.executionAuthority !== 'none' || quality?.authority?.readOnly !== true) throw new Error('Graph quality authority boundary failed');
if (decisions?.policy?.executionAuthority !== 'none') throw new Error('Decision ledger authority boundary failed');
if (ownerOutcomeReviews?.policy?.executionAuthority !== 'none') throw new Error('Outcome review ledger authority boundary failed');
if (ownerOutcomeExperience?.operatingContract?.executionAuthority !== 'none') throw new Error('Owner outcome experience authority boundary failed');
if (ownerOutcomeExperience?.operatingContract?.causalClaimAuthority !== 'none') throw new Error('Owner outcome experience gained causal authority');
if (ownerOutcomeExperience?.constraints?.capitalExecutionAllowed !== false || ownerOutcomeExperience?.constraints?.walletActionAllowed !== false) throw new Error('Owner outcome experience gained capital/wallet authority');
if (owner?.authority?.executionAuthority !== 'none' || owner?.authority?.executable !== false) throw new Error('Owner context authority boundary failed');
if (ownerOutcomeExperience?.source?.decisionLedgerSha256 !== sha256(loaded.decisions.text)) throw new Error('Owner outcome experience is not exact-byte bound to current decision ledger');
if (ownerOutcomeExperience?.source?.reviewLedgerSha256 !== sha256(loaded.ownerOutcomeReviews.text)) throw new Error('Owner outcome experience is not exact-byte bound to current review ledger');
if (outcomeMemory?.source?.decisionLedgerHash !== decisions?.integrity?.ledgerHash) throw new Error('Core outcome memory is not bound to current decision ledger');

const baseNodes = new Map(Object.entries(obj(base?.catalog?.nodes)));
const baseConnections = new Map(Object.entries(obj(base?.catalog?.connections)));
const overlayNodes = new Map(Object.entries(obj(quality?.overlay?.nodes)));
const overlayConnections = new Map(Object.entries(obj(quality?.overlay?.connections)));
const priorEnrichedConnectivity = quality?.connectivity?.enriched ?? connectivity(new Map([...baseNodes, ...overlayNodes]), new Map([...baseConnections, ...overlayConnections]));
const initialOverlayEstablishedNodes = [...overlayNodes.values()].filter(x => x?.status !== 'candidate').length;
const initialOverlayEstablishedConnections = [...overlayConnections.values()].filter(x => x?.status !== 'candidate').length;
const graph = makeGraph(baseNodes, baseConnections, overlayNodes, overlayConnections);

const decisionById = decisionId => arr(decisions?.decisions).find(x => x?.decisionId === decisionId) ?? null;
function decisionNode(decisionId) {
  const id = `decision:${norm(decisionId)}`;
  if (!graph.allNodes().has(id)) throw new Error(`Decision missing from canonical graph: ${decisionId}`);
  return id;
}
function ensureExpectation(decision) {
  const text = String(decision?.expectedOutcome ?? '').trim();
  if (!text) return null;
  return graph.addNode('expected-result', decision.decisionId, `Expected result · ${decision.decisionId}`, {
    text,
    reviewAt: decision?.prediction?.reviewAt ?? decision?.experience?.reviewCondition?.reviewOnOrAfter ?? null
  }, { source: FILES.decisions, decisionId: decision.decisionId }, 'established');
}
function resolveDecisionEntity(decision) {
  const raw = decision?.sourceCase?.entity;
  const local = norm(raw);
  if (!local) return null;
  const nodes = graph.allNodes();
  for (const type of ['company', 'protocol', 'strategy', 'asset', 'entity']) {
    const id = `${type}:${local}`;
    if (nodes.has(id)) return id;
  }
  return graph.addNode('entity', raw, raw, { domain: decision?.sourceCase?.domain ?? null }, { source: FILES.decisions }, 'established');
}

for (const decision of arr(decisions?.decisions)) {
  const d = decisionNode(decision.decisionId);
  const expectation = ensureExpectation(decision);
  if (expectation) graph.addConnection('decision-expected-result', d, expectation, {}, 'established', 'direct');
  const entity = resolveDecisionEntity(decision);
  if (entity) graph.addConnection('decision-about', d, entity, { domain: decision?.sourceCase?.domain ?? null }, 'established', 'direct');
}

for (const outcome of arr(outcomeMemory?.outcomes)) {
  const d = decisionNode(outcome.decisionId);
  const outcomeNode = graph.addNode('outcome', outcome.outcomeId, `Outcome · ${outcome.decisionId}`, {
    status: outcome?.status ?? null,
    event: outcome?.event ?? null,
    settledAt: outcome?.settledAt ?? null,
    eventObserved: outcome?.eventObserved ?? null,
    probabilityBps: outcome?.probabilityBps ?? null
  }, { source: FILES.outcomeMemory, decisionId: outcome.decisionId }, 'established');
  graph.addConnection('outcome-of', outcomeNode, d, { status: outcome?.status ?? null }, 'established', 'direct');
  const observationId = outcome?.evidence?.observationId;
  if (observationId) {
    const observation = graph.addNode('observation', observationId, observationId, {
      caseStatusAtReview: outcome?.evidence?.caseStatusAtReview ?? null,
      brainObservationAtOrAfterReview: outcome?.evidence?.brainObservationAtOrAfterReview ?? null
    }, { source: outcome?.evidence?.source ?? FILES.outcomeMemory }, 'established');
    graph.addConnection('outcome-observed-by', outcomeNode, observation, {}, 'established', 'direct');
    if (outcome?.status === 'settled' || outcome?.settledAt) graph.addConnection('settled-by', outcomeNode, observation, {}, 'established', 'direct');
  }
}

const experienceDecisionIds = new Set();
for (const state of arr(ownerOutcomeExperience?.decisions)) {
  const d = decisionNode(state.decisionId);
  experienceDecisionIds.add(state.decisionId);
  const cls = graph.addNode('experience-class', state.experienceClass, state.category ?? state.experienceClass, {
    category: state?.category ?? null,
    recommendationClass: state?.recommendationClass ?? null
  }, { source: FILES.ownerOutcomeExperience }, 'established');
  graph.addConnection('decision-experience-class', d, cls, { lifecycleState: state?.lifecycleState ?? null }, 'established', 'direct');
  const expectation = ensureExpectation(decisionById(state.decisionId));
  if (expectation) graph.addConnection('experience-evaluates-expectation', cls, expectation, {}, 'established', 'derived');
}

const reviewNodeById = new Map();
for (const review of arr(ownerOutcomeReviews?.reviews)) {
  const d = decisionNode(review.decisionId);
  if (!experienceDecisionIds.has(review.decisionId)) throw new Error(`Outcome review is not represented in owner experience state: ${review.reviewId}`);
  const reviewNode = graph.addNode('owner-outcome-review', review.reviewId, `Outcome review · ${review.decisionId}`, {
    reviewedAt: review?.reviewedAt ?? null,
    trigger: review?.trigger ?? null,
    outcomeStatus: review?.outcomeStatus ?? null,
    confidence: review?.confidence ?? null,
    summary: review?.summary ?? null,
    sourceCommitSha: review?.evidence?.sourceCommitSha ?? null
  }, { source: FILES.ownerOutcomeReviews, reviewHash: review?.integrity?.reviewHash ?? null }, 'established');
  reviewNodeById.set(review.reviewId, reviewNode);
  graph.addConnection('review-of', reviewNode, d, { outcomeStatus: review?.outcomeStatus ?? null }, 'established', 'reviewed-association');

  const expectation = ensureExpectation(decisionById(review.decisionId));
  if (expectation) {
    const kind = review?.outcomeStatus === 'supported'
      ? 'review-supports-expectation'
      : review?.outcomeStatus === 'contradicted'
        ? 'review-contradicts-expectation'
        : 'review-assesses-expectation';
    graph.addConnection(kind, reviewNode, expectation, {
      outcomeStatus: review?.outcomeStatus ?? null,
      confidence: review?.confidence ?? null
    }, 'established', 'reviewed-association');
  }

  for (const evidence of arr(review?.evidence?.files)) {
    const evidenceId = `${review.reviewId}:${evidence?.file}:${evidence?.sha256}`;
    const evidenceNode = graph.addNode('evidence-snapshot', evidenceId, evidence?.file ?? evidenceId, {
      file: evidence?.file ?? null,
      role: evidence?.role ?? null,
      sha256: evidence?.sha256 ?? null,
      generatedAt: evidence?.generatedAt ?? null,
      observedAt: evidence?.observedAt ?? null,
      asOf: evidence?.asOf ?? null,
      version: evidence?.version ?? null,
      sourceCommitSha: review?.evidence?.sourceCommitSha ?? null
    }, { source: FILES.ownerOutcomeReviews, reviewId: review.reviewId }, 'established');
    const kind = evidence?.role === 'counterevidence' ? 'review-counterevidence' : 'review-supported-by';
    graph.addConnection(kind, reviewNode, evidenceNode, { role: evidence?.role ?? null }, 'established', 'direct');
  }
}

for (const review of arr(ownerOutcomeReviews?.reviews)) {
  if (!review?.supersedesReviewId) continue;
  const current = reviewNodeById.get(review.reviewId);
  const prior = reviewNodeById.get(review.supersedesReviewId);
  if (!current || !prior) throw new Error(`Outcome review supersession chain incomplete: ${review.reviewId}`);
  graph.addConnection('review-supersedes-review', current, prior, {}, 'established', 'direct');
}

for (const candidate of arr(ownerOutcomeExperience?.lessonCandidates)) {
  if (candidate?.causalClaim === true) throw new Error(`Lesson candidate claims causation: ${candidate.candidateId}`);
  const candidateNode = graph.addNode('lesson-candidate', candidate.candidateId, candidate.text ?? candidate.candidateId, {
    direction: candidate?.direction ?? null,
    epistemicStatus: candidate?.epistemicStatus ?? null,
    causalClaim: false
  }, { source: FILES.ownerOutcomeExperience }, 'candidate');
  const d = decisionNode(candidate.decisionId);
  const reviewNode = `owner-outcome-review:${norm(candidate.reviewId)}`;
  const cls = `experience-class:${norm(candidate.experienceClass)}`;
  if (!graph.allNodes().has(reviewNode) || !graph.allNodes().has(cls)) throw new Error(`Lesson candidate traceability incomplete: ${candidate.candidateId}`);
  graph.addConnection('lesson-candidate-derived-from-review', candidateNode, reviewNode, {}, 'candidate', 'candidate-association');
  graph.addConnection('lesson-candidate-derived-from-decision', candidateNode, d, {}, 'candidate', 'candidate-association');
  graph.addConnection('lesson-candidate-applies-to-experience-class', candidateNode, cls, {}, 'candidate', 'candidate-association');
}

for (const lesson of arr(ownerOutcomeExperience?.learnedLessons)) {
  if (lesson?.causalClaim === true) throw new Error(`Learned lesson claims causation: ${lesson.lessonId}`);
  if (lesson?.executionAuthority !== 'none' || lesson?.policyMutationAuthority !== 'none') throw new Error(`Learned lesson escaped inert authority: ${lesson.lessonId}`);
  const lessonNode = graph.addNode('learned-lesson', lesson.lessonId, lesson.text ?? lesson.lessonId, {
    direction: lesson?.direction ?? null,
    epistemicStatus: lesson?.epistemicStatus ?? null,
    corroboratingReviewCount: lesson?.corroboratingReviewCount ?? null,
    distinctDecisionCount: lesson?.distinctDecisionCount ?? null,
    causalClaim: false
  }, { source: FILES.ownerOutcomeExperience }, 'established');
  const cls = `experience-class:${norm(lesson.experienceClass)}`;
  if (!graph.allNodes().has(cls)) throw new Error(`Learned lesson experience class missing: ${lesson.lessonId}`);
  graph.addConnection('lesson-applies-to-experience-class', lessonNode, cls, {}, 'established', 'learned-association');
  for (const decisionId of arr(lesson?.decisionIds)) graph.addConnection('lesson-derived-from-decision', lessonNode, decisionNode(decisionId), {}, 'established', 'learned-association');
  for (const reviewId of arr(lesson?.reviewIds)) {
    const reviewNode = `owner-outcome-review:${norm(reviewId)}`;
    if (!graph.allNodes().has(reviewNode)) throw new Error(`Learned lesson review missing: ${lesson.lessonId} -> ${reviewId}`);
    graph.addConnection('lesson-derived-from-review', lessonNode, reviewNode, {}, 'established', 'learned-association');
  }
}

const spontaneousSources = arr(owner?.sources).filter(source =>
  Number(source?.teachingItemCount ?? 0) === 0
  && arr(source?.questionsCovered).length === 0
  && Object.keys(obj(source?.modules)).length > 0
);
const spontaneousHeuristicIds = [];
for (const source of spontaneousSources) {
  const rawId = source?.file ?? `tranche-${source?.tranche ?? 'spontaneous'}`;
  const heuristicNode = graph.addNode('owner-heuristic', rawId, `Owner heuristic · ${source?.version ?? rawId}`, {
    version: source?.version ?? null,
    tranche: source?.tranche ?? null,
    sourceChannel: source?.sourceChannel ?? null,
    moduleKeys: Object.keys(obj(source?.modules)).sort()
  }, { source: FILES.owner, sourceFile: source?.file ?? null, authority: 'decision-context-not-market-truth' }, 'established');
  spontaneousHeuristicIds.push(heuristicNode);

  const semanticDomains = [
    ['protocol-economics', 'real-yield-and-fee-economics-context'],
    ['cash-flow-semantics', 'generated-income-semantics-context'],
    ['capital-allocation', 'capital-reinforcement-and-distribution-context']
  ];
  for (const [domainName, reason] of semanticDomains) {
    const domainId = `context-domain:${norm(domainName)}`;
    if (!graph.allNodes().has(domainId)) throw new Error(`Required existing owner semantic domain missing: ${domainId}`);
    graph.addConnection('owner-heuristic-contextualizes', heuristicNode, domainId, { reason }, 'established', 'owner-reported');
  }

  const candidateDemand = new Set();
  const walk = value => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    for (const [key, child] of Object.entries(value)) {
      if (key === 'trackingHooks' && Array.isArray(child)) {
        for (const hook of child) {
          const hookId = typeof hook === 'string' ? hook : hook?.id;
          if (hookId) candidateDemand.add(hookId);
        }
      }
      if (key === 'relationshipCandidates' && Array.isArray(child)) {
        for (const rel of child) {
          if (rel?.from) candidateDemand.add(rel.from);
          if (rel?.to) candidateDemand.add(rel.to);
        }
      }
      walk(child);
    }
  };
  walk(source?.modules);
  for (const candidateId of candidateDemand) {
    const candidate = `candidate-metric:${norm(candidateId)}`;
    if (!graph.allNodes().has(candidate)) graph.addNode('candidate-metric', candidateId, candidateId, { lifecycle: 'owner-demand' }, { source: FILES.owner }, 'candidate');
    graph.addConnection('owner-heuristic-tracking-demand', heuristicNode, candidate, {}, 'candidate', 'owner-reported');
  }
}

const mergedNodes = graph.allNodes();
const mergedConnections = graph.allConnections();
for (const edge of mergedConnections.values()) {
  if (!mergedNodes.has(edge.from) || !mergedNodes.has(edge.to)) throw new Error(`Final Neural Graph has dangling edge: ${edge.id}`);
}

const enrichedConnectivity = connectivity(mergedNodes, mergedConnections);
const baseConnectivity = quality?.connectivity?.base ?? connectivity(baseNodes, baseConnections);
const finalOverlayEstablishedNodes = [...overlayNodes.values()].filter(x => x?.status !== 'candidate').length;
const finalOverlayEstablishedConnections = [...overlayConnections.values()].filter(x => x?.status !== 'candidate').length;
const vNextAddedEstablishedNodes = finalOverlayEstablishedNodes - initialOverlayEstablishedNodes;
const vNextAddedEstablishedConnections = finalOverlayEstablishedConnections - initialOverlayEstablishedConnections;
const componentChangeFromPriorEnriched = Number(enrichedConnectivity.connectedComponentCount) - Number(priorEnrichedConnectivity.connectedComponentCount);

const edgeExists = (kind, from, to = null) => [...mergedConnections.values()].some(edge => edge.kind === kind && edge.from === from && (to === null || edge.to === to));
const coreOutcomes = arr(outcomeMemory?.outcomes);
const ownerStates = arr(ownerOutcomeExperience?.decisions);
const reviews = arr(ownerOutcomeReviews?.reviews);
const candidates = arr(ownerOutcomeExperience?.lessonCandidates);
const lessons = arr(ownerOutcomeExperience?.learnedLessons);
const coreOutcomeTraced = coreOutcomes.filter(outcome => edgeExists('outcome-of', `outcome:${norm(outcome.outcomeId)}`, `decision:${norm(outcome.decisionId)}`)).length;
const ownerDecisionTraced = ownerStates.filter(state => edgeExists('decision-experience-class', `decision:${norm(state.decisionId)}`, `experience-class:${norm(state.experienceClass)}`)).length;
const reviewTraced = reviews.filter(review => edgeExists('review-of', `owner-outcome-review:${norm(review.reviewId)}`, `decision:${norm(review.decisionId)}`)).length;
const evidenceRows = reviews.flatMap(review => arr(review?.evidence?.files).map(file => ({ review, file })));
const evidenceTraced = evidenceRows.filter(({ review, file }) => {
  const reviewNode = `owner-outcome-review:${norm(review.reviewId)}`;
  const evidenceNode = `evidence-snapshot:${norm(`${review.reviewId}:${file?.file}:${file?.sha256}`)}`;
  return graph.allNodes().has(evidenceNode) && (edgeExists('review-supported-by', reviewNode, evidenceNode) || edgeExists('review-counterevidence', reviewNode, evidenceNode));
}).length;
const candidateTraced = candidates.filter(candidate => {
  const id = `lesson-candidate:${norm(candidate.candidateId)}`;
  return graph.allNodes().has(id)
    && edgeExists('lesson-candidate-derived-from-review', id)
    && edgeExists('lesson-candidate-derived-from-decision', id)
    && edgeExists('lesson-candidate-applies-to-experience-class', id);
}).length;
const lessonTraced = lessons.filter(lesson => {
  const id = `learned-lesson:${norm(lesson.lessonId)}`;
  return graph.allNodes().has(id)
    && edgeExists('lesson-applies-to-experience-class', id)
    && arr(lesson?.decisionIds).every(decisionId => edgeExists('lesson-derived-from-decision', id, `decision:${norm(decisionId)}`))
    && arr(lesson?.reviewIds).every(reviewId => edgeExists('lesson-derived-from-review', id, `owner-outcome-review:${norm(reviewId)}`));
}).length;

const establishedEdges = [...mergedConnections.values()].filter(x => x?.status !== 'candidate');
const epistemicClasses = [...new Set(establishedEdges.map(x => x.epistemicClass).filter(Boolean))].sort();
const epistemicClassCounts = Object.fromEntries(epistemicClasses.map(key => [key, establishedEdges.filter(x => x.epistemicClass === key).length]));
const causalEdges = [...mergedConnections.values()].filter(edge => CAUSAL_KINDS.has(edge.kind));
const unsupportedCausal = causalEdges.filter(edge => edge?.data?.causalEvidence !== true);
if (unsupportedCausal.length) throw new Error(`Unsupported causal Neural Graph edges: ${unsupportedCausal.map(x => x.id).join(', ')}`);
const heuristicZeroDegree = spontaneousHeuristicIds.filter(id => !establishedEdges.some(edge => edge.from === id || edge.to === id)).length;

quality.version = VERSION;
quality.engineVersion = ENGINE_VERSION;
quality.purpose = 'Measure graph usefulness, owner-context activation and exact Decision -> Outcome -> Lesson traceability while preserving strict evidence, semantic and non-causal boundaries.';
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
  decisionLedger: { file: FILES.decisions, sha256: sha256(loaded.decisions.text), lastUpdatedAt: decisions?.lastUpdatedAt ?? null },
  outcomeMemory: { file: FILES.outcomeMemory, sha256: sha256(loaded.outcomeMemory.text), generatedAt: outcomeMemory?.generatedAt ?? null },
  ownerOutcomeExperience: { file: FILES.ownerOutcomeExperience, sha256: sha256(loaded.ownerOutcomeExperience.text), generatedAt: ownerOutcomeExperience?.generatedAt ?? null, stateHash: ownerOutcomeExperience?.integrity?.stateHash ?? null },
  ownerOutcomeReviews: { file: FILES.ownerOutcomeReviews, sha256: sha256(loaded.ownerOutcomeReviews.text), lastUpdatedAt: ownerOutcomeReviews?.lastUpdatedAt ?? null }
};
quality.connectivity = {
  ...obj(quality.connectivity),
  base: baseConnectivity,
  enriched: enrichedConnectivity,
  delta: {
    addedEstablishedNodes: finalOverlayEstablishedNodes,
    addedEstablishedConnections: finalOverlayEstablishedConnections,
    zeroDegreeReduction: Number(baseConnectivity?.zeroDegreeCount ?? 0) - enrichedConnectivity.zeroDegreeCount,
    componentReduction: Number(baseConnectivity?.connectedComponentCount ?? 0) - enrichedConnectivity.connectedComponentCount,
    edgesPerNodeChange: Number.isFinite(baseConnectivity?.edgesPerNode) ? Number((enrichedConnectivity.edgesPerNode - baseConnectivity.edgesPerNode).toFixed(4)) : null
  },
  vNextDelta: {
    addedEstablishedNodes: vNextAddedEstablishedNodes,
    addedEstablishedConnections: vNextAddedEstablishedConnections,
    priorEnrichedConnectedComponentCount: priorEnrichedConnectivity.connectedComponentCount,
    finalEnrichedConnectedComponentCount: enrichedConnectivity.connectedComponentCount,
    connectedComponentChange: componentChangeFromPriorEnriched,
    rule: 'Experience enrichment should connect to existing semantic fabric rather than create new established islands.'
  }
};
quality.ownerHeuristicIntegration = {
  spontaneousHeuristicCount: spontaneousHeuristicIds.length,
  zeroDegreeHeuristicCount: heuristicZeroDegree,
  fullyTraversable: spontaneousHeuristicIds.length > 0 ? heuristicZeroDegree === 0 : null,
  semanticBridgeDomains: ['protocol-economics', 'cash-flow-semantics', 'capital-allocation'],
  heuristicIds: spontaneousHeuristicIds,
  rule: 'Spontaneous owner heuristics bridge existing semantic domains as decision context. They are not market facts and never become automatic policy.'
};
quality.relationQuality = {
  epistemicClassCounts,
  establishedExperienceConnectionCount: establishedEdges.filter(edge => EXPERIENCE_KINDS.has(edge.kind)).length,
  causalConnectionCount: causalEdges.length,
  unsupportedCausalConnectionCount: unsupportedCausal.length,
  unsupportedCausalConnectionIds: unsupportedCausal.map(x => x.id),
  rule: 'Reviewed and learned associations remain non-causal unless a separate mechanism-specific causal proof explicitly authorizes a causal edge.'
};
quality.experienceTraceability = {
  measurementStatus: ownerStates.length || reviews.length || lessons.length ? 'active' : 'warming-no-owner-economic-outcomes-yet',
  coreOutcomeCount: coreOutcomes.length,
  coreOutcomeTraceableCount: coreOutcomeTraced,
  coreOutcomeTraceabilityPct: pct(coreOutcomeTraced, coreOutcomes.length),
  ownerEconomicDecisionCount: ownerStates.length,
  ownerEconomicDecisionTraceableCount: ownerDecisionTraced,
  ownerEconomicDecisionTraceabilityPct: pct(ownerDecisionTraced, ownerStates.length),
  ownerOutcomeReviewCount: reviews.length,
  ownerOutcomeReviewTraceableCount: reviewTraced,
  ownerOutcomeReviewTraceabilityPct: pct(reviewTraced, reviews.length),
  evidenceSnapshotCount: evidenceRows.length,
  evidenceSnapshotTraceableCount: evidenceTraced,
  evidenceSnapshotTraceabilityPct: pct(evidenceTraced, evidenceRows.length),
  lessonCandidateCount: candidates.length,
  lessonCandidateTraceableCount: candidateTraced,
  lessonCandidateTraceabilityPct: pct(candidateTraced, candidates.length),
  learnedLessonCount: lessons.length,
  learnedLessonTraceableCount: lessonTraced,
  learnedLessonTraceabilityPct: pct(lessonTraced, lessons.length),
  nullSemantics: 'A traceability percentage is null when its denominator is zero. The graph never reports fake 100% coverage for an empty experience class.',
  causalBoundary: 'Traceability proves provenance links, not causation.'
};
quality.overlay = {
  semantics: 'Canonical enriched traversal overlay over base Neural Graph telemetry. This is not a second graph or truth source.',
  nodes: Object.fromEntries([...overlayNodes.entries()].sort(([a], [b]) => a.localeCompare(b))),
  connections: Object.fromEntries([...overlayConnections.entries()].sort(([a], [b]) => a.localeCompare(b)))
};
quality.integrity = {
  ...obj(quality.integrity),
  baseTelemetryHash: base?.integrity?.telemetryHash ?? null,
  overlayNodeHash: sha256([...overlayNodes.values()].map(x => [x.id, x.fingerprint]).sort()),
  overlayConnectionHash: sha256([...overlayConnections.values()].map(x => [x.id, x.fingerprint]).sort()),
  experienceSourceHash: sha256({
    decisionLedger: sha256(loaded.decisions.text),
    outcomeMemory: sha256(loaded.outcomeMemory.text),
    ownerOutcomeExperience: sha256(loaded.ownerOutcomeExperience.text),
    ownerOutcomeReviews: sha256(loaded.ownerOutcomeReviews.text)
  })
};
delete quality.integrity.qualityHash;
quality.integrity.qualityHash = sha256({ ...quality, integrity: quality.integrity });

fs.writeFileSync(FILES.quality, `${JSON.stringify(quality, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({
  version: quality.version,
  engineVersion: quality.engineVersion,
  ownerHeuristicIntegration: quality.ownerHeuristicIntegration,
  relationQuality: quality.relationQuality,
  experienceTraceability: quality.experienceTraceability,
  vNextDelta: quality.connectivity.vNextDelta,
  enrichedConnectivity: quality.connectivity.enriched,
  executionAuthority: quality.authority.executionAuthority
}, null, 2));
