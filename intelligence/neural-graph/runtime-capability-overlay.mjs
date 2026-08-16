import fs from 'node:fs';
import crypto from 'node:crypto';

const GRAPH_FILE = 'intelligence/neural-graph/neural-graph-quality.json';
const RUNTIME_FILE = 'intelligence/owner-context/runtime-owner-activation.json';
const RISK_FILE = 'intelligence/risk/health-factor-intelligence.json';
const OUT_FILE = 'intelligence/neural-graph/runtime-capability-overlay.json';

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];
const norm = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9._:-]+/g, '-').replace(/^-+|-+$/g, '');

for (const file of [GRAPH_FILE, RUNTIME_FILE, RISK_FILE]) {
  if (!fs.existsSync(file)) throw new Error(`Missing runtime capability graph source: ${file}`);
}

const graph = read(GRAPH_FILE);
const runtime = read(RUNTIME_FILE);
const risk = read(RISK_FILE);

if (graph?.authority?.executionAuthority !== 'none' || graph?.authority?.readOnly !== true) throw new Error('Graph quality authority boundary failed');
if (runtime?.authority?.executionAuthority !== 'none' || runtime?.authority?.readOnly !== true) throw new Error('Runtime activation authority boundary failed');
if (risk?.authority?.executionAuthority !== 'none' || risk?.authority?.readOnly !== true) throw new Error('Risk intelligence authority boundary failed');

const nodes = {};
const connections = {};

function addNode(type, rawId, label, data = {}, provenance = {}) {
  const id = `${type}:${norm(rawId)}`;
  nodes[id] = { id, type, label: String(label ?? rawId), status: 'established', data, provenance };
  nodes[id].fingerprint = sha256(nodes[id]);
  return id;
}

function addEdge(kind, from, to, data = {}, epistemicClass = 'direct') {
  const id = `${kind}:${from}->${to}`;
  connections[id] = { id, kind, from, to, status: 'established', epistemicClass, data };
  connections[id].fingerprint = sha256(connections[id]);
  return id;
}

for (const unit of arr(runtime?.units)) {
  if (unit?.runtimeStatus !== 'activated') continue;
  const ownerNode = unit.unitId;
  const capability = addNode('capability', unit.capabilityId, unit.capabilityLabel, {
    runtimeCoverage: unit.runtimeCoverage,
    evidenceStatus: unit.evidenceStatus,
    sourceGeneratedAt: unit.sourceGeneratedAt,
    unresolvedDimensions: arr(unit.unresolvedDimensions)
  }, { source: RUNTIME_FILE, evidenceSource: unit.source });
  addEdge('owner-runtime-capability', ownerNode, capability, {
    declaredStatus: unit.declaredStatus,
    runtimeStatus: unit.runtimeStatus,
    runtimeCoverage: unit.runtimeCoverage
  }, 'direct');

  if (unit.capabilityId === 'health-factor-monitoring') {
    for (const obs of arr(risk?.observations).filter(x => x?.onchain?.status === 'ok')) {
      const company = `company:${norm(obs.companyName || `company-${obs.companyRegistry}`)}`;
      const protocol = addNode('protocol-runtime', `${obs.chain}:${obs.protocol}`, `${obs.protocol} · ${obs.chain}`, {
        chain: obs.chain,
        chainId: obs.chainId,
        pool: obs.pool
      }, { source: RISK_FILE });
      const observation = addNode('risk-observation', `${obs.companyRegistry}:${obs.chain}:${obs.protocol}:${obs.onchain?.blockNumber}`, `${obs.companyName} · Health Factor`, {
        companyRegistry: obs.companyRegistry,
        wallet: obs.wallet,
        observedAt: obs.observedAt,
        blockNumber: obs.onchain?.blockNumber,
        totalCollateralBaseRaw: obs.onchain?.totalCollateralBaseRaw,
        totalDebtBaseRaw: obs.onchain?.totalDebtBaseRaw,
        healthFactor: obs.assessment?.healthFactor,
        healthFactorApplicable: obs.assessment?.healthFactorApplicable,
        state: obs.assessment?.state,
        attention: obs.assessment?.attention
      }, { source: RISK_FILE, method: obs.onchain?.method, rpc: obs.onchain?.rpc });
      addEdge('capability-observes-risk', capability, observation, { semantic: 'live-risk-observation' }, 'direct');
      addEdge('risk-observation-company', observation, company, { companyRegistry: obs.companyRegistry }, 'direct');
      addEdge('risk-observation-protocol', observation, protocol, { market: `${obs.protocol} ${obs.chain}` }, 'direct');
    }
  }
}

const out = {
  version: '0.1-runtime-capability-graph-overlay',
  engineVersion: '0.1-runtime-evidence-to-graph-binding',
  generatedAt: new Date().toISOString(),
  status: 'ok',
  purpose: 'Bind runtime-proven owner capabilities to live canonical observations and graph entities without mutating the base graph or inferring causality.',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false
  },
  semantics: {
    runtimeCapability: 'A capability exists only while its runtime activation evidence is current and valid.',
    observationEdge: 'Observation edges show source-backed relation, not causal influence or action authority.',
    baseGraphBoundary: 'This overlay augments traversal; it does not rewrite neural-graph-telemetry.json or historical graph counts.'
  },
  totals: {
    nodeCount: Object.keys(nodes).length,
    connectionCount: Object.keys(connections).length,
    runtimeCapabilityCount: Object.values(nodes).filter(x => x.type === 'capability').length,
    riskObservationCount: Object.values(nodes).filter(x => x.type === 'risk-observation').length
  },
  catalog: { nodes, connections },
  integrity: {
    graphQualityHash: graph?.integrity?.qualityHash || null,
    runtimeActivationHash: runtime?.integrity?.runtimeActivationHash || null,
    riskStateHash: risk?.integrity?.stateHash || null,
    nodeCompositeHash: sha256(Object.values(nodes).map(x => [x.id, x.fingerprint])),
    connectionCompositeHash: sha256(Object.values(connections).map(x => [x.id, x.fingerprint]))
  }
};
out.integrity.overlayHash = sha256({ ...out, catalog: undefined, integrity: out.integrity });

fs.writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ version: out.version, totals: out.totals, executionAuthority: out.authority.executionAuthority }, null, 2));