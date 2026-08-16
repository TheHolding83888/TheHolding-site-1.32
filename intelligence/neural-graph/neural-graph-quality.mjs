import fs from 'node:fs';
import crypto from 'node:crypto';

const BASE_FILE = 'intelligence/neural-graph/neural-graph-telemetry.json';
const OUT_FILE = 'intelligence/neural-graph/neural-graph-quality.json';
const OWNER_FILE = 'intelligence/owner-context/owner-decision-context.json';
const ACTIVATION_FILE = 'intelligence/owner-context/owner-teaching-activation.json';
const EVENTS_FILE = 'intelligence/event-intelligence.json';
const SECURITY_FILE = 'security/security-intelligence.json';
const MEMORY_FILE = 'intelligence/memory-vault/manifest.json';
const ACTIVE_CANDIDATE_CAP = 24;

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');

for (const file of [BASE_FILE, OWNER_FILE, ACTIVATION_FILE, EVENTS_FILE, SECURITY_FILE, MEMORY_FILE]) {
  if (!fs.existsSync(file)) throw new Error(`Missing required graph-quality source: ${file}`);
}

const base = read(BASE_FILE);
const owner = read(OWNER_FILE);
const activation = read(ACTIVATION_FILE);
const events = read(EVENTS_FILE);
const security = read(SECURITY_FILE);
const memory = read(MEMORY_FILE);

if (base?.authority?.executionAuthority !== 'none' || base?.authority?.readOnly !== true) throw new Error('Base graph authority boundary failed');
if (owner?.authority?.executionAuthority !== 'none' || owner?.authority?.executable !== false) throw new Error('Owner authority boundary failed');
if (activation?.authority?.executionAuthority !== 'none' || activation?.authority?.readOnly !== true) throw new Error('Activation authority boundary failed');
if (events?.authority?.executionAuthority !== 'none') throw new Error('Event Intelligence authority boundary failed');

const baseNodes = new Map(Object.entries(obj(base?.catalog?.nodes)));
const baseConnections = new Map(Object.entries(obj(base?.catalog?.connections)));
const overlayNodes = new Map();
const overlayConnections = new Map();

function addOverlayNode(type, rawId, label, data = {}, provenance = {}, status = 'established') {
  const id = `${type}:${norm(rawId)}`;
  if (baseNodes.has(id)) return id;
  const value = { id, type, label: String(label ?? rawId), status, provenance, data };
  value.fingerprint = sha256({ type, label: value.label, status: value.status, provenance, data });
  overlayNodes.set(id, value);
  return id;
}

function addOverlayConnection(kind, from, to, data = {}, status = 'established', epistemicClass = 'direct') {
  if (!from || !to) return null;
  const id = `${kind}:${from}->${to}`;
  const value = { id, kind, from, to, status, epistemicClass, data };
  value.fingerprint = sha256({ kind, from, to, status, epistemicClass, data });
  overlayConnections.set(id, value);
  return id;
}

function extractOwnerUnitIds() {
  const ids = [];
  for (const source of arr(owner?.sources)) {
    const namespace = source?.teachingNamespace ?? null;
    for (const item of arr(source?.modules?.textTeaching?.items)) ids.push(`owner-context:${norm(namespace)}:${norm(item?.id)}`);
    for (const q of arr(source?.questionsCovered)) ids.push(`owner-context:${norm(namespace || 'audio-owner-q')}:q${norm(q)}`);
  }
  return [...new Set(ids)].sort();
}

const ownerUnitIds = extractOwnerUnitIds();
const dispositions = arr(activation?.units);
const dispositionById = new Map(dispositions.map(x => [String(x?.unitId || '').toLowerCase(), x]));
const allowedStatuses = new Set(['activated', 'blocked', 'contextual']);

if (dispositions.length !== ownerUnitIds.length) throw new Error(`Owner activation contract count mismatch: owner=${ownerUnitIds.length}, activation=${dispositions.length}`);
for (const id of ownerUnitIds) {
  if (!baseNodes.has(id)) throw new Error(`Owner neuron missing from base graph: ${id}`);
  const item = dispositionById.get(id);
  if (!item) throw new Error(`Owner teaching missing activation disposition: ${id}`);
  if (!allowedStatuses.has(item.status)) throw new Error(`Invalid activation status for ${id}: ${item.status}`);
  if (item.status === 'activated' && !arr(item.targets).length) throw new Error(`Activated owner teaching lacks evidence target: ${id}`);
  if (item.status === 'blocked' && !item.blocker?.id) throw new Error(`Blocked owner teaching lacks blocker: ${id}`);
  if (item.status === 'contextual' && !item.domain) throw new Error(`Contextual owner teaching lacks domain: ${id}`);
}
for (const item of dispositions) {
  if (!ownerUnitIds.includes(String(item?.unitId || '').toLowerCase())) throw new Error(`Activation contract contains non-canonical owner unit: ${item?.unitId}`);
}

// Every owner teaching gets a semantic domain edge. This makes it traversable without pretending it is operationalized.
for (const item of dispositions) {
  const unitId = String(item.unitId).toLowerCase();
  const domain = addOverlayNode('context-domain', item.domain, item.domain, { semantics: 'owner-context-domain' }, { source: ACTIVATION_FILE });
  addOverlayConnection('owner-context-domain', unitId, domain, { activationStatus: item.status }, 'established', 'owner-reported');

  if (item.status === 'activated') {
    for (const target of arr(item.targets)) {
      const capability = addOverlayNode('capability', target.id, target.label || target.id, {
        source: target.source || null,
        evidence: target.evidence || null,
        coverage: item.coverage || null
      }, { source: ACTIVATION_FILE, evidenceSource: target.source || null });
      addOverlayConnection('owner-context-activation', unitId, capability, {
        coverage: item.coverage || null,
        evidence: target.evidence || null
      }, 'established', 'direct');
    }
  }

  if (item.status === 'blocked') {
    const gap = addOverlayNode('coverage-gap', item.blocker.id, item.blocker.label || item.blocker.id, {
      why: item.blocker.why || null,
      source: 'owner-teaching-activation'
    }, { source: ACTIVATION_FILE });
    addOverlayConnection('owner-context-blocked-by-gap', unitId, gap, { why: item.blocker.why || null }, 'established', 'direct');
  }
}

// Security findings are not useful islands: bind each current finding to the exact code surface it names.
for (const finding of arr(security?.currentFindings)) {
  const findingId = `security-finding:${norm(finding?.id)}`;
  if (!baseNodes.has(findingId)) continue;
  if (!finding?.file) continue;
  const surface = addOverlayNode('code-surface', finding.file, finding.file, { category: finding?.category ?? null }, { source: SECURITY_FILE });
  addOverlayConnection('security-finding-surface', findingId, surface, { severity: finding?.severity ?? null }, 'established', 'direct');
}

// Permanent Memory already has a real append-only hash chain. Expose that exact temporal relation instead of leaving records as islands.
const memoryRuns = arr(memory?.runs);
for (let i = 1; i < memoryRuns.length; i += 1) {
  const previous = memoryRuns[i - 1];
  const current = memoryRuns[i];
  if (current?.previousRecordHash && previous?.recordHash && current.previousRecordHash !== previous.recordHash) {
    throw new Error(`Memory chain mismatch between ${previous?.runId} and ${current?.runId}`);
  }
  const from = `memory-record:${norm(previous?.runId)}`;
  const to = `memory-record:${norm(current?.runId)}`;
  if (!baseNodes.has(from) || !baseNodes.has(to)) throw new Error(`Memory record missing from base graph: ${from} / ${to}`);
  addOverlayConnection('memory-record-next', from, to, {
    previousRecordHash: previous?.recordHash ?? null,
    currentPreviousRecordHash: current?.previousRecordHash ?? null,
    generatedAt: current?.generatedAt ?? null
  }, 'established', 'direct');
}

// Explicit coverage gaps are established architecture demand. Candidate targets remain candidate and do not become established simply because a gap points at them.
const architectureDemand = addOverlayNode('context-domain', 'architecture-demand', 'Architecture Demand', { semantics: 'known-missing-capability-domain' }, { source: EVENTS_FILE });
const gapCandidateMap = {
  'protocol-trading-volume-change': ['protocol-trading-volume', 'volume'],
  'protocol-fees-revenue-change': ['protocol-fees', 'protocol-revenue-or-fee-capture', 'fees', 'protocol-revenue-fee-capture'],
  'company-cash-flow-fee-attribution': ['company-generated-cash-flow', 'generated-cash-flow'],
  'reward-unit-vs-price-attribution': ['reward-token-units', 'reward-token-unit-price', 'reward-value-usd', 'reward-price-effect'],
  'company-concentration-drift': ['productive-position-concentration-drift', 'concentration'],
  'index-movement-feed': ['index-movement']
};
for (const gap of arr(events?.tracked?.coverageGaps)) {
  const gapId = `coverage-gap:${norm(gap?.id)}`;
  const resolvedGapId = baseNodes.has(gapId) ? gapId : addOverlayNode('coverage-gap', gap?.id, gap?.id, { why: gap?.why ?? null }, { source: EVENTS_FILE });
  addOverlayConnection('coverage-gap-domain', resolvedGapId, architectureDemand, { why: gap?.why ?? null }, 'established', 'derived');
  for (const candidateId of gapCandidateMap[gap?.id] || []) {
    const candidate = `candidate-metric:${norm(candidateId)}`;
    const target = baseNodes.has(candidate) ? candidate : addOverlayNode('candidate-metric', candidateId, candidateId, { lifecycle: 'blocked' }, { source: EVENTS_FILE }, 'candidate');
    addOverlayConnection('coverage-gap-candidate', resolvedGapId, target, { reason: gap?.why ?? null }, 'candidate', 'unknown');
  }
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

const mergedNodes = new Map([...baseNodes, ...overlayNodes]);
const mergedConnections = new Map([...baseConnections, ...overlayConnections]);
const baseConnectivity = connectivity(baseNodes, baseConnections);
const mergedConnectivity = connectivity(mergedNodes, mergedConnections);

const ownerBaseZeroDegree = ownerUnitIds.filter(id => baseConnectivity.zeroDegreeIds.includes(id)).length;
const mergedOwnerDegrees = new Map(ownerUnitIds.map(id => [id, 0]));
for (const edge of [...mergedConnections.values()].filter(x => x?.status !== 'candidate')) {
  if (mergedOwnerDegrees.has(edge.from)) mergedOwnerDegrees.set(edge.from, mergedOwnerDegrees.get(edge.from) + 1);
  if (mergedOwnerDegrees.has(edge.to)) mergedOwnerDegrees.set(edge.to, mergedOwnerDegrees.get(edge.to) + 1);
}
const ownerMergedZeroDegree = [...mergedOwnerDegrees.values()].filter(x => x === 0).length;

const activationCounts = { activated: 0, blocked: 0, contextual: 0 };
for (const item of dispositions) activationCounts[item.status] += 1;
const activationRatePct = dispositions.length ? Number((activationCounts.activated / dispositions.length * 100).toFixed(2)) : null;

const candidateNodes = [...baseNodes.values()].filter(x => x?.status === 'candidate' || x?.type === 'candidate-metric');
const candidateIds = new Set(candidateNodes.map(x => x.id));
const blockedCandidateIds = new Set();
const referencedCandidateIds = new Set();
for (const item of dispositions) {
  for (const raw of arr(item?.candidateIds)) {
    const id = `candidate-metric:${norm(raw)}`;
    if (candidateIds.has(id)) referencedCandidateIds.add(id);
    if (item.status === 'blocked' && candidateIds.has(id)) blockedCandidateIds.add(id);
  }
}
for (const edge of baseConnections.values()) {
  if (edge?.status === 'candidate') {
    if (candidateIds.has(edge.from)) referencedCandidateIds.add(edge.from);
    if (candidateIds.has(edge.to)) referencedCandidateIds.add(edge.to);
  }
}

const explicitPromotions = {
  'candidate-metric:reward-usd-milestone': 'capability:owner-signal-event-intelligence',
  'candidate-metric:company-daily-tvl-change-pct': 'capability:owner-signal-event-intelligence',
  'candidate-metric:company-reference-yield': 'capability:owner-signal-event-intelligence'
};
const promoted = [...candidateIds].filter(id => explicitPromotions[id]);
const activePool = [...referencedCandidateIds].filter(id => !blockedCandidateIds.has(id) && !explicitPromotions[id]).sort();
const active = activePool.slice(0, ACTIVE_CANDIDATE_CAP);
const activeSet = new Set(active);
const dormant = [...candidateIds].filter(id => !blockedCandidateIds.has(id) && !explicitPromotions[id] && !activeSet.has(id)).sort();

const blockedDemand = dispositions.filter(x => x.status === 'blocked').map(x => ({
  unitId: x.unitId,
  blockerId: x.blocker?.id || null,
  label: x.blocker?.label || null,
  why: x.blocker?.why || null,
  candidateIds: arr(x.candidateIds)
}));

const quality = {
  version: '0.2-neural-graph-quality-and-activation',
  engineVersion: '0.2.1-connectivity-activation-candidate-capacity-evaluator',
  generatedAt: new Date().toISOString(),
  status: 'ok',
  purpose: 'Measure graph usefulness and relational depth beside raw growth, while classifying every owner teaching unit by real activation state.',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    methodologyMutationAuthority: false,
    policyMutationAuthority: false
  },
  sourceState: {
    baseGraph: { file: BASE_FILE, generatedAt: base?.generatedAt ?? null, sha256: sha256(fs.readFileSync(BASE_FILE, 'utf8')) },
    ownerContext: { file: OWNER_FILE, asOf: owner?.asOf ?? null, sha256: sha256(fs.readFileSync(OWNER_FILE, 'utf8')) },
    activationContract: { file: ACTIVATION_FILE, asOf: activation?.asOf ?? null, sha256: sha256(fs.readFileSync(ACTIVATION_FILE, 'utf8')) },
    eventIntelligence: { file: EVENTS_FILE, generatedAt: events?.generatedAt ?? null, sha256: sha256(fs.readFileSync(EVENTS_FILE, 'utf8')) },
    security: { file: SECURITY_FILE, generatedAt: security?.generatedAt ?? null, sha256: sha256(fs.readFileSync(SECURITY_FILE, 'utf8')) },
    memory: { file: MEMORY_FILE, generatedAt: memory?.lastUpdatedAt ?? null, sha256: sha256(fs.readFileSync(MEMORY_FILE, 'utf8')) }
  },
  ownerActivation: {
    teachingUnitCount: dispositions.length,
    ...activationCounts,
    activationRatePct,
    partialActivatedCount: dispositions.filter(x => x.status === 'activated' && x.coverage === 'partial').length,
    baseGraphZeroDegreeOwnerUnits: ownerBaseZeroDegree,
    enrichedGraphZeroDegreeOwnerUnits: ownerMergedZeroDegree,
    rule: 'Ask quotation alone is not activation. Activated requires a concrete production primitive; contextual teaching stays contextual.'
  },
  connectivity: {
    base: baseConnectivity,
    enriched: mergedConnectivity,
    delta: {
      addedEstablishedNodes: [...overlayNodes.values()].filter(x => x.status !== 'candidate').length,
      addedEstablishedConnections: [...overlayConnections.values()].filter(x => x.status !== 'candidate').length,
      zeroDegreeReduction: baseConnectivity.zeroDegreeCount - mergedConnectivity.zeroDegreeCount,
      componentReduction: baseConnectivity.connectedComponentCount - mergedConnectivity.connectedComponentCount,
      edgesPerNodeChange: baseConnectivity.edgesPerNode === null || mergedConnectivity.edgesPerNode === null ? null : Number((mergedConnectivity.edgesPerNode - baseConnectivity.edgesPerNode).toFixed(4))
    }
  },
  candidateCapacity: {
    inventoryCount: candidateIds.size,
    activeReviewCap: ACTIVE_CANDIDATE_CAP,
    activeReviewCount: active.length,
    blockedCount: blockedCandidateIds.size,
    dormantCount: dormant.length,
    promotedCount: promoted.length,
    activeIds: active,
    blockedIds: [...blockedCandidateIds].sort(),
    promoted: promoted.map(id => ({ candidateId: id, targetId: explicitPromotions[id] })),
    rule: 'Candidates are never deleted merely by age. Active review is bounded; blocked and dormant states preserve useful ideas without pretending they are progressing.'
  },
  blockedArchitectureDemand: blockedDemand,
  utility: {
    questionsMadeAnswerableByGraph: null,
    measurementStatus: 'warming',
    why: 'A causal graph-utility number requires repeatable evaluation where graph traversal itself is the measured treatment. Conversational Cortex A/B evidence must not be relabeled as graph-only utility.'
  },
  overlay: {
    semantics: 'Merge these nodes/connections with base Neural Graph catalog for activation-aware traversal. Overlay does not replace the base telemetry or its history.',
    nodes: Object.fromEntries([...overlayNodes.entries()].sort(([a], [b]) => a.localeCompare(b))),
    connections: Object.fromEntries([...overlayConnections.entries()].sort(([a], [b]) => a.localeCompare(b)))
  },
  integrity: {
    baseTelemetryHash: base?.integrity?.telemetryHash ?? null,
    overlayNodeHash: sha256([...overlayNodes.values()].map(x => [x.id, x.fingerprint]).sort()),
    overlayConnectionHash: sha256([...overlayConnections.values()].map(x => [x.id, x.fingerprint]).sort()),
    activationContractHash: sha256(activation)
  }
};
quality.integrity.qualityHash = sha256({ ...quality, integrity: quality.integrity });

fs.writeFileSync(OUT_FILE, `${JSON.stringify(quality, null, 2)}\n`);
console.log(JSON.stringify({
  version: quality.version,
  ownerActivation: quality.ownerActivation,
  connectivity: {
    base: quality.connectivity.base,
    enriched: quality.connectivity.enriched,
    delta: quality.connectivity.delta
  },
  candidateCapacity: {
    inventory: quality.candidateCapacity.inventoryCount,
    active: quality.candidateCapacity.activeReviewCount,
    blocked: quality.candidateCapacity.blockedCount,
    dormant: quality.candidateCapacity.dormantCount,
    promoted: quality.candidateCapacity.promotedCount
  },
  executionAuthority: quality.authority.executionAuthority
}, null, 2));