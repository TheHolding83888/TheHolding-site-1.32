import fs from 'node:fs';
import crypto from 'node:crypto';

const OUT_DIR = 'intelligence/neural-graph';
const CURRENT_FILE = `${OUT_DIR}/neural-graph-telemetry.json`;
const HISTORY_FILE = `${OUT_DIR}/neural-graph-history.json`;
const MAX_HISTORY = 365;
const NOW = new Date();
const NOW_ISO = NOW.toISOString();
const DAY_MS = 24 * 60 * 60 * 1000;

const PATHS = Object.freeze({
  productivity: 'companies/productivity-data.json',
  stable: 'companies/stable-capital-data.json',
  events: 'intelligence/event-intelligence.json',
  brain: 'intelligence/brain-chatgpt-bridge.json',
  decisions: 'intelligence/learning/decision-ledger.json',
  memory: 'intelligence/memory-vault/manifest.json',
  security: 'security/security-intelligence.json',
  owner: 'intelligence/owner-context/owner-decision-context.json',
  graphDirective: 'intelligence/owner-context/intelligence-graph-growth-directive.json'
});

const readJson = (file, optional = false) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (optional) return null; throw new Error(`Unable to read ${file}: ${error.message}`); }
};
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];
const obj = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');
const stable = value => JSON.stringify(value, Object.keys(value || {}).sort());

for (const file of Object.values(PATHS)) {
  if (!fs.existsSync(file)) throw new Error(`Missing canonical source: ${file}`);
}

const sourceText = Object.fromEntries(Object.entries(PATHS).map(([key, file]) => [key, fs.readFileSync(file, 'utf8')]));
const source = Object.fromEntries(Object.entries(sourceText).map(([key, text]) => [key, JSON.parse(text)]));

if (source.owner?.authority?.executionAuthority !== 'none' || source.owner?.authority?.executable !== false) {
  throw new Error('Owner context authority boundary failed');
}
if (source.events?.authority?.executionAuthority !== 'none') throw new Error('Event Intelligence authority boundary failed');
if (source.decisions?.policy?.executionAuthority !== 'none') throw new Error('Decision ledger authority boundary failed');
if (source.graphDirective?.authority?.executionAuthority !== 'none') throw new Error('Graph directive authority boundary failed');

const nodes = new Map();
const connections = new Map();

function addNode(type, rawId, data = {}, provenance = {}) {
  const local = norm(rawId);
  if (!local) return null;
  const id = `${type}:${local}`;
  const value = { id, type, label: String(data.label ?? rawId), status: data.status ?? 'established', provenance, data: data.data ?? {} };
  value.fingerprint = sha256({ type: value.type, label: value.label, status: value.status, provenance: value.provenance, data: value.data });
  const prior = nodes.get(id);
  if (prior && prior.fingerprint !== value.fingerprint) {
    // Same canonical identity from multiple sources: merge provenance/data rather than duplicate the neuron.
    const merged = {
      ...prior,
      provenance: { ...prior.provenance, ...value.provenance },
      data: { ...prior.data, ...value.data },
      status: prior.status === 'established' || value.status === 'established' ? 'established' : value.status
    };
    merged.fingerprint = sha256({ type: merged.type, label: merged.label, status: merged.status, provenance: merged.provenance, data: merged.data });
    nodes.set(id, merged);
  } else if (!prior) nodes.set(id, value);
  return id;
}

function addConnection(kind, from, to, data = {}, status = 'established', epistemicClass = 'direct') {
  if (!from || !to) return null;
  const id = `${kind}:${from}->${to}`;
  const value = { id, kind, from, to, status, epistemicClass, data };
  value.fingerprint = sha256({ kind, from, to, status, epistemicClass, data });
  connections.set(id, value);
  return id;
}

// 1) Productive companies, strategies, protocols, assets and metric instances.
const engines = obj(source.productivity?.engines);
for (const [engineId, engine] of Object.entries(engines)) {
  const strategy = addNode('strategy', engineId, { label: engineId, data: { sourceType: engine?.sourceType ?? null, nativeCadence: engine?.nativeCadence ?? null } }, { source: PATHS.productivity });
  const protocolName = engine?.protocol || engineId;
  const protocol = addNode('protocol', protocolName, { label: protocolName }, { source: PATHS.productivity });
  const assetSymbol = engine?.principalSymbol || engine?.principalId;
  const asset = assetSymbol ? addNode('asset', assetSymbol, { label: assetSymbol }, { source: PATHS.productivity }) : null;
  addConnection('strategy-protocol', strategy, protocol, {}, 'established', 'direct');
  if (asset) addConnection('strategy-asset', strategy, asset, {}, 'established', 'direct');
  if (engine?.aprLatest !== null && engine?.aprLatest !== undefined) {
    const metric = addNode('metric', `strategy:${engineId}:reference-yield`, { label: `${engineId} Reference Yield`, data: { value: Number(engine.aprLatest), unit: 'percent', observedAt: engine?.lastUpdatedAt ?? source.productivity?.generatedAt ?? null } }, { source: PATHS.productivity, semantics: engine?.sourceMetric ?? null });
    addConnection('strategy-metric', strategy, metric, {}, 'established', 'derived');
  }
}

for (const [companyName, company] of Object.entries(obj(source.productivity?.companies))) {
  const companyNode = addNode('company', companyName, { label: companyName, data: { status: company?.status ?? null } }, { source: PATHS.productivity });
  for (const row of arr(company?.breakdown)) {
    const strategy = nodes.has(`strategy:${norm(row?.engineId)}`)
      ? `strategy:${norm(row.engineId)}`
      : addNode('strategy', row?.engineId, { label: row?.engineId ?? 'unknown' }, { source: PATHS.productivity });
    addConnection('company-strategy', companyNode, strategy, { valueUsd: row?.value ?? null }, 'established', 'direct');
  }
  for (const [metricName, value, unit] of [
    ['reference-yield', company?.aprLatest, 'percent'],
    ['productive-value', company?.productiveValue, 'USD'],
    ['coverage', company?.coverage, 'ratio']
  ]) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) continue;
    const metric = addNode('metric', `company:${companyName}:${metricName}`, { label: `${companyName} ${metricName}`, data: { value: Number(value), unit, observedAt: company?.updatedAt ?? source.productivity?.generatedAt ?? null } }, { source: PATHS.productivity });
    addConnection('company-metric', companyNode, metric, {}, 'established', 'derived');
  }
}

// 2) Stable strategies extend the same graph without collapsing them into general Productivity.
const stableCompanyName = source.stable?.company?.name;
const stableCompany = stableCompanyName ? addNode('company', stableCompanyName, { label: stableCompanyName, data: { category: source.stable?.company?.category ?? 'Stable Capital' } }, { source: PATHS.stable }) : null;
for (const position of arr(source.stable?.positions)) {
  const strategy = addNode('strategy', `stable:${position?.id}`, { label: `${position?.protocol ?? 'Stable'} · ${position?.positionType ?? position?.id}`, data: { chain: position?.chain ?? null, incomeMode: position?.incomeMode ?? null } }, { source: PATHS.stable });
  if (stableCompany) addConnection('company-strategy', stableCompany, strategy, { universe: 'stable-capital' }, 'established', 'direct');
  const protocol = addNode('protocol', position?.protocol ?? position?.id, { label: position?.protocol ?? position?.id }, { source: PATHS.stable });
  addConnection('strategy-protocol', strategy, protocol, {}, 'established', 'direct');
  const symbols = [...new Set([position?.wrapperSymbol, position?.underlyingSymbol].filter(Boolean))];
  for (const symbol of symbols) {
    const asset = addNode('asset', symbol, { label: symbol }, { source: PATHS.stable });
    addConnection('strategy-asset', strategy, asset, {}, 'established', 'direct');
  }
  const annualYield = position?.reference?.annualYieldPct;
  if (annualYield !== null && annualYield !== undefined && Number.isFinite(Number(annualYield))) {
    const metric = addNode('metric', `strategy:stable:${position?.id}:reference-yield`, { label: `${position?.protocol ?? 'Stable'} Reference Yield`, data: { value: Number(annualYield), unit: 'percent', observedAt: source.stable?.generatedAt ?? null } }, { source: PATHS.stable, semantics: position?.reference?.sourceType ?? null });
    addConnection('strategy-metric', strategy, metric, {}, 'established', 'derived');
  }
}

// 3) Operating events and coverage gaps.
for (const item of arr(source.events?.feed?.items)) {
  const event = addNode('event', item?.id, { label: item?.headline ?? item?.id, data: { type: item?.type ?? null, severity: item?.severity ?? null, occurredAt: item?.occurredAt ?? null } }, { source: PATHS.events });
  const entityRaw = item?.entity;
  if (entityRaw) {
    const candidates = [`company:${norm(entityRaw)}`, `strategy:${norm(entityRaw)}`, `protocol:${norm(entityRaw)}`];
    const target = candidates.find(id => nodes.has(id)) || addNode('entity', entityRaw, { label: entityRaw }, { source: PATHS.events });
    addConnection('event-entity', event, target, {}, 'established', 'direct');
  }
  const metricName = item?.metrics?.metric;
  if (metricName) {
    const metric = addNode('metric-definition', metricName, { label: metricName, data: { category: item?.metrics?.category ?? null } }, { source: PATHS.events });
    addConnection('event-metric', event, metric, {}, 'established', 'direct');
  }
}
for (const gap of arr(source.events?.tracked?.coverageGaps)) {
  addNode('coverage-gap', gap?.id, { label: gap?.id, data: { why: gap?.why ?? null } }, { source: PATHS.events });
}

// 4) Brain cases and their evidence references.
for (const c of arr(source.brain?.cases)) {
  const caseNode = addNode('brain-case', c?.caseId, { label: c?.signal ?? c?.caseId, data: { domain: c?.domain ?? null, severity: c?.severity ?? null, category: c?.category ?? null, actionMode: c?.actionMode ?? null } }, { source: PATHS.brain });
  for (const evidenceId of arr(c?.evidenceIds)) {
    const evidence = addNode('evidence', evidenceId, { label: evidenceId }, { source: PATHS.brain });
    addConnection('case-evidence', caseNode, evidence, {}, 'established', 'direct');
  }
}

// 5) Human decisions -> exact remembered Brain case identity.
for (const d of arr(source.decisions?.decisions)) {
  const decision = addNode('decision', d?.decisionId, { label: d?.decisionId, data: { disposition: d?.disposition ?? null, recordedAt: d?.recordedAt ?? null } }, { source: PATHS.decisions });
  const caseId = d?.caseId;
  if (caseId) {
    const caseNode = nodes.has(`brain-case:${norm(caseId)}`) ? `brain-case:${norm(caseId)}` : addNode('brain-case', caseId, { label: caseId, status: 'historical-reference' }, { source: PATHS.decisions });
    addConnection('decision-case', decision, caseNode, {}, 'established', 'direct');
  }
}

// 6) Permanent memory records.
for (const run of arr(source.memory?.runs)) {
  addNode('memory-record', run?.runId, { label: run?.runId, data: { generatedAt: run?.generatedAt ?? null, mode: run?.mode ?? null, eventCount: run?.eventCount ?? null } }, { source: PATHS.memory });
}

// 7) Current defensive findings.
for (const finding of arr(source.security?.currentFindings)) {
  addNode('security-finding', finding?.id, { label: finding?.summary ?? finding?.id, data: { severity: finding?.severity ?? null, category: finding?.category ?? null, file: finding?.file ?? null } }, { source: PATHS.security });
}

// 8) Owner context as provenance-bound context neurons. These never gain fact authority.
const ownerUnits = [];
for (const ownerSource of arr(source.owner?.sources)) {
  const textItems = arr(ownerSource?.modules?.textTeaching?.items);
  for (const item of textItems) ownerUnits.push({ id: item?.id, label: item?.topic ?? item?.id, classification: item?.classification ?? null, namespace: ownerSource?.teachingNamespace ?? null });
  for (const q of arr(ownerSource?.questionsCovered)) ownerUnits.push({ id: `Q${q}`, label: `Owner audio Q${q}`, classification: 'explicit-owner-teaching', namespace: ownerSource?.teachingNamespace ?? 'audio-owner-q' });
}
for (const unit of ownerUnits) {
  addNode('owner-context', `${unit.namespace}:${unit.id}`, { label: unit.label, data: { classification: unit.classification, namespace: unit.namespace } }, { source: PATHS.owner, authority: 'decision-context-not-market-truth' });
}

// 9) Candidate neurons / connections from owner teaching and graph directive.
const candidateMetricNames = new Set();
const candidateRelationships = [];
function walkOwner(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(walkOwner); return; }
  for (const [key, child] of Object.entries(value)) {
    if (key === 'trackingHooks' && Array.isArray(child)) {
      for (const hook of child) {
        if (typeof hook === 'string') candidateMetricNames.add(hook);
        else if (hook?.id) candidateMetricNames.add(hook.id);
      }
    }
    if (key === 'relationshipCandidates' && Array.isArray(child)) candidateRelationships.push(...child);
    walkOwner(child);
  }
}
walkOwner(source.owner?.sources);
for (const metric of arr(source.graphDirective?.candidateNodeClasses)) candidateMetricNames.add(metric);
for (const metric of candidateMetricNames) addNode('candidate-metric', metric, { label: metric, status: 'candidate' }, { source: PATHS.owner, rule: 'candidate-not-tracked-until-source-and-semantics-verified' });
for (const rel of candidateRelationships) {
  const from = addNode('candidate-metric', rel?.from, { label: rel?.from, status: 'candidate' }, { source: PATHS.owner });
  const to = addNode('candidate-metric', rel?.to, { label: rel?.to, status: 'candidate' }, { source: PATHS.owner });
  addConnection('candidate-relation', from, to, { rule: rel?.rule ?? null, declaredStatus: rel?.status ?? null }, 'candidate', rel?.status?.includes('derived') ? 'derived' : 'hypothesized');
}

const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
const connectionList = [...connections.values()].sort((a, b) => a.id.localeCompare(b.id));
const nodeById = Object.fromEntries(nodeList.map(x => [x.id, x]));
const connById = Object.fromEntries(connectionList.map(x => [x.id, x]));
const establishedNodes = nodeList.filter(x => x.status !== 'candidate');
const candidateNodes = nodeList.filter(x => x.status === 'candidate');
const establishedConnections = connectionList.filter(x => x.status !== 'candidate');
const candidateConnections = connectionList.filter(x => x.status === 'candidate');

const countBy = (items, key) => Object.fromEntries([...new Set(items.map(x => x[key]))].sort().map(value => [value, items.filter(x => x[key] === value).length]));
const sourceState = Object.fromEntries(Object.entries(sourceText).map(([key, text]) => [key, { file: PATHS[key], sha256: sha256(text), generatedAt: source[key]?.generatedAt ?? source[key]?.lastUpdatedAt ?? null }]));

const previous = readJson(CURRENT_FILE, true);
function diffCatalog(currentMap, previousCatalog, key) {
  if (!previousCatalog || !previousCatalog[key]) return { mode: 'baseline', added: null, removed: null, updated: null, addedIds: [], removedIds: [], updatedIds: [] };
  const prior = previousCatalog[key];
  const currentIds = new Set(Object.keys(currentMap));
  const priorIds = new Set(Object.keys(prior));
  const addedIds = [...currentIds].filter(id => !priorIds.has(id));
  const removedIds = [...priorIds].filter(id => !currentIds.has(id));
  const updatedIds = [...currentIds].filter(id => priorIds.has(id) && currentMap[id].fingerprint !== prior[id].fingerprint);
  return { mode: 'delta', added: addedIds.length, removed: removedIds.length, updated: updatedIds.length, addedIds: addedIds.slice(0, 50), removedIds: removedIds.slice(0, 50), updatedIds: updatedIds.slice(0, 50) };
}
const nodeDelta = diffCatalog(nodeById, previous?.catalog, 'nodes');
const connectionDelta = diffCatalog(connById, previous?.catalog, 'connections');

const oldHistory = readJson(HISTORY_FILE, true);
const historyEntries = arr(oldHistory?.snapshots).filter(x => x?.generatedAt && Date.parse(x.generatedAt) < NOW.getTime());
const newHistoryEntry = {
  generatedAt: NOW_ISO,
  mode: previous ? 'delta' : 'baseline',
  totals: {
    neurons: establishedNodes.length,
    candidateNeurons: candidateNodes.length,
    connections: establishedConnections.length,
    candidateConnections: candidateConnections.length
  },
  delta: { neurons: nodeDelta, connections: connectionDelta }
};
const boundedHistory = [...historyEntries, newHistoryEntry].slice(-MAX_HISTORY);
const rolling24hEntries = boundedHistory.filter(x => Date.parse(x.generatedAt) >= NOW.getTime() - DAY_MS && x?.mode === 'delta');
const sum = (selector) => rolling24hEntries.reduce((total, entry) => total + (Number(selector(entry)) || 0), 0);
const rolling24h = rolling24hEntries.length ? {
  mode: 'activity',
  snapshotCount: rolling24hEntries.length,
  neurons: {
    added: sum(x => x.delta?.neurons?.added),
    removed: sum(x => x.delta?.neurons?.removed),
    updated: sum(x => x.delta?.neurons?.updated)
  },
  connections: {
    added: sum(x => x.delta?.connections?.added),
    removed: sum(x => x.delta?.connections?.removed),
    updated: sum(x => x.delta?.connections?.updated)
  }
} : { mode: 'baseline', snapshotCount: 0, neurons: { added: null, removed: null, updated: null }, connections: { added: null, removed: null, updated: null } };

const telemetry = {
  version: '0.1-neural-graph-telemetry',
  engineVersion: '0.1-canonical-neuron-and-connection-counter',
  generatedAt: NOW_ISO,
  status: 'ok',
  purpose: 'Compact instrument telemetry for how The Holding knowledge graph grows and changes.',
  semantics: {
    neuron: 'A canonical reusable knowledge node: company, protocol, asset, strategy, metric, event, Brain case, evidence, decision, memory record, security finding, owner-context unit, or explicit coverage gap.',
    neuralConnection: 'A provenance-aware relationship between canonical nodes. Established structural/derived links are separated from candidate or hypothesized links.',
    candidateBoundary: 'Candidate neurons/connections are visible for learning growth but do not count as established knowledge and never become causal or tracked merely because they exist.',
    updatedNeuron: 'A stable node identity whose canonical fingerprint changed since the previous telemetry snapshot.',
    twentyFourHourActivity: 'Sum of added/removed/updated deltas from telemetry snapshots generated during the last 24 hours. Baseline remains unknown until at least one prior snapshot exists.',
    thiBoundary: 'Neural Graph growth is not THI. More nodes or edges do not automatically raise intelligence maturity.'
  },
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false,
    marketFactAuthorityForOwnerContext: false
  },
  totals: {
    neurons: establishedNodes.length,
    candidateNeurons: candidateNodes.length,
    neuralConnections: establishedConnections.length,
    candidateConnections: candidateConnections.length,
    nodeTypes: countBy(establishedNodes, 'type'),
    candidateNodeTypes: countBy(candidateNodes, 'type'),
    connectionKinds: countBy(establishedConnections, 'kind'),
    candidateConnectionKinds: countBy(candidateConnections, 'kind'),
    epistemicClasses: countBy(establishedConnections, 'epistemicClass')
  },
  deltaSincePreviousSnapshot: {
    previousGeneratedAt: previous?.generatedAt ?? null,
    neurons: nodeDelta,
    connections: connectionDelta
  },
  activity24h: rolling24h,
  sourceState,
  catalog: { nodes: nodeById, connections: connById },
  integrity: {
    nodeCompositeHash: sha256(nodeList.map(x => [x.id, x.fingerprint])),
    connectionCompositeHash: sha256(connectionList.map(x => [x.id, x.fingerprint])),
    sourceCompositeHash: sha256(sourceState)
  }
};
telemetry.integrity.telemetryHash = sha256({ ...telemetry, catalog: undefined, integrity: telemetry.integrity });

const history = {
  version: '0.1-neural-graph-history',
  retention: { maxSnapshots: MAX_HISTORY, semantics: 'operational-growth-telemetry-not-a-replacement-for-permanent-memory-vault' },
  snapshots: boundedHistory
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(CURRENT_FILE, `${JSON.stringify(telemetry, null, 2)}\n`);
fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`);

console.log(JSON.stringify({
  version: telemetry.version,
  generatedAt: telemetry.generatedAt,
  neurons: telemetry.totals.neurons,
  candidateNeurons: telemetry.totals.candidateNeurons,
  connections: telemetry.totals.neuralConnections,
  candidateConnections: telemetry.totals.candidateConnections,
  deltaMode: telemetry.deltaSincePreviousSnapshot.neurons.mode,
  activity24h: telemetry.activity24h
}, null, 2));
