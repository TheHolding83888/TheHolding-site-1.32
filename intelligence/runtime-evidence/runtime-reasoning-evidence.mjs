import fs from 'node:fs';
import crypto from 'node:crypto';

const RUNTIME_FILE = 'intelligence/owner-context/runtime-owner-activation.json';
const GRAPH_FILE = 'intelligence/neural-graph/runtime-capability-overlay.json';
const REGISTRY_FILE = 'intelligence/runtime-evidence/runtime-capability-registry.json';
const SOURCE_STATE_FILE = 'intelligence/runtime-evidence/runtime-capability-source-state.json';
const OUT_DIR = 'intelligence/runtime-evidence';
const OUT_FILE = `${OUT_DIR}/runtime-reasoning-evidence.json`;

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = file => fs.readFileSync(file, 'utf8');
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];

for (const file of [RUNTIME_FILE, GRAPH_FILE, REGISTRY_FILE, SOURCE_STATE_FILE]) {
  if (!fs.existsSync(file)) throw new Error(`Missing runtime reasoning source: ${file}`);
}

const runtime = read(RUNTIME_FILE);
const graph = read(GRAPH_FILE);
const registry = read(REGISTRY_FILE);
const sourceState = read(SOURCE_STATE_FILE);

if (runtime?.authority?.executionAuthority !== 'none' || runtime?.authority?.readOnly !== true) throw new Error('Runtime activation authority boundary failed');
if (graph?.authority?.executionAuthority !== 'none' || graph?.authority?.readOnly !== true) throw new Error('Runtime capability graph authority boundary failed');
if (registry?.authority?.executionAuthority !== 'none' || registry?.authority?.readOnly !== true) throw new Error('Runtime capability registry authority boundary failed');
if (sourceState?.authority?.executionAuthority !== 'none' || sourceState?.authority?.readOnly !== true) throw new Error('Runtime capability source-state authority boundary failed');
if (registry?.authority?.automaticCapabilityActivation !== false || sourceState?.authority?.automaticCapabilityActivation !== false) throw new Error('Capability registry/source-state gained automatic activation authority');

const registryById = new Map(arr(registry.capabilities).map(entry => [entry.capabilityId, entry]));
const stateById = new Map(arr(sourceState.capabilities).map(entry => [entry.capabilityId, entry]));

function adaptHealthFactor(unit, entry, state) {
  const sourceFile = entry?.source?.file;
  if (!sourceFile || !fs.existsSync(sourceFile)) return null;
  if (!state?.fresh || !state?.adapterReady) return null;
  const risk = read(sourceFile);
  if (risk?.authority?.executionAuthority !== 'none' || risk?.authority?.readOnly !== true) throw new Error('Risk intelligence authority boundary failed');
  if (risk?.status !== 'ok') return null;

  const observations = arr(risk?.observations)
    .filter(obs => obs?.onchain?.status === 'ok')
    .map(obs => ({
      observationType: 'company-health-factor',
      companyRegistry: obs?.companyRegistry ?? null,
      companyName: obs?.companyName ?? null,
      wallet: obs?.wallet ?? null,
      chain: obs?.chain ?? null,
      chainId: obs?.chainId ?? null,
      protocol: obs?.protocol ?? null,
      pool: obs?.pool ?? null,
      observedAt: obs?.observedAt ?? null,
      blockNumber: obs?.onchain?.blockNumber ?? null,
      debtPresent: obs?.assessment?.debtPresent ?? null,
      healthFactorApplicable: obs?.assessment?.healthFactorApplicable ?? null,
      healthFactor: obs?.assessment?.healthFactor ?? null,
      state: obs?.assessment?.state ?? 'unknown',
      attention: obs?.assessment?.attention ?? 'unknown',
      totalCollateralBaseRaw: obs?.onchain?.totalCollateralBaseRaw ?? null,
      totalDebtBaseRaw: obs?.onchain?.totalDebtBaseRaw ?? null,
      availableBorrowsBaseRaw: obs?.onchain?.availableBorrowsBaseRaw ?? null,
      currentLiquidationThresholdBps: obs?.onchain?.currentLiquidationThresholdBps ?? null,
      ltvBps: obs?.onchain?.ltvBps ?? null,
      provenance: {
        source: sourceFile,
        method: obs?.onchain?.method ?? null,
        rpc: obs?.onchain?.rpc ?? null,
        sourceFiles: arr(obs?.sourceFiles),
        sourcePositionIds: arr(obs?.sourcePositionIds)
      }
    }));

  if (observations.length === 0) return null;
  return {
    capabilityId: unit.capabilityId,
    capabilityLabel: unit.capabilityLabel,
    family: entry.family,
    runtimeAdapter: entry.runtimeAdapter,
    ownerUnitId: unit.unitId,
    declaredStatus: unit.declaredStatus,
    runtimeStatus: unit.runtimeStatus,
    runtimeCoverage: unit.runtimeCoverage,
    evidenceStatus: unit.evidenceStatus,
    sourceFile,
    sourceGeneratedAt: state.generatedAt ?? unit.sourceGeneratedAt ?? null,
    sourceAgeHours: state.ageHours,
    maxSourceAgeHours: state.maxAgeHours,
    supportedMarkets: arr(unit.supportedMarkets),
    unresolvedDimensions: [...new Set([...arr(entry.unresolvedDimensions), ...arr(unit.unresolvedDimensions)])],
    observations
  };
}

const ADAPTERS = new Map([
  ['health-factor-v1', adaptHealthFactor]
]);

const capabilities = [];
const omittedCapabilities = [];
for (const unit of arr(runtime?.units)) {
  if (unit?.runtimeStatus !== 'activated') continue;
  const entry = registryById.get(unit.capabilityId);
  const state = stateById.get(unit.capabilityId);
  if (!entry || !state) {
    omittedCapabilities.push({ capabilityId: unit.capabilityId, reason: 'missing-registry-or-source-state' });
    continue;
  }
  if (entry.runtimeEmission === 'disabled-pending-schema-bound-adapter' || entry.runtimeEmission === 'disabled-pending-schema-audit') {
    omittedCapabilities.push({ capabilityId: unit.capabilityId, reason: entry.runtimeEmission });
    continue;
  }
  const adapter = ADAPTERS.get(entry.runtimeAdapter);
  if (!adapter) {
    omittedCapabilities.push({ capabilityId: unit.capabilityId, reason: 'no-runtime-adapter-implemented' });
    continue;
  }
  const adapted = adapter(unit, entry, state);
  if (!adapted) {
    omittedCapabilities.push({ capabilityId: unit.capabilityId, reason: state?.fresh ? 'adapter-produced-no-current-observation' : 'source-not-fresh' });
    continue;
  }
  capabilities.push(adapted);
}

const catalog = arr(registry.capabilities).map(entry => {
  const state = stateById.get(entry.capabilityId) || {};
  return {
    capabilityId: entry.capabilityId,
    label: entry.label,
    family: entry.family,
    runtimeEmission: entry.runtimeEmission,
    runtimeAdapter: entry.runtimeAdapter,
    sourceFile: entry?.source?.file ?? null,
    sourceExists: state.sourceExists ?? false,
    schemaInspected: state.schemaInspected ?? false,
    fresh: state.fresh ?? false,
    adapterReady: state.adapterReady ?? false,
    activeInCurrentPacket: capabilities.some(capability => capability.capabilityId === entry.capabilityId),
    unresolvedDimensions: arr(entry.unresolvedDimensions)
  };
});

const out = {
  version: '0.2-runtime-reasoning-evidence',
  engineVersion: '0.2-registry-driven-bounded-reasoning-packet',
  generatedAt: new Date().toISOString(),
  status: 'ok',
  purpose: 'Expose current production-proven capabilities as a small, source-bound reasoning packet for Ask and future release-coherent Brain ingestion using a reusable capability registry rather than capability-specific routing.',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false,
    ownerContextMarketFactAuthority: false,
    automaticCapabilityActivation: false
  },
  semantics: {
    capabilityBoundary: 'Only runtime-activated capabilities with registry-declared adapters and fresh current production evidence enter active capabilities.',
    registryBoundary: 'Registry membership alone is not activation and does not place a fact into an answer.',
    ownerContextBoundary: 'Owner teaching supplies interpretation context only; live market/account facts come from named canonical evidence sources.',
    economicObjectBoundary: 'Rewards, Reference APR/Productivity, Embedded Yield and Realised Cash Flow remain distinct evidence families.',
    healthFactorBoundary: 'Zero-debt accounts expose healthFactor=null/not-applicable. Owner HF ranges remain review context, never hard automatic thresholds.',
    missingDimensionBoundary: 'Unresolved dimensions remain explicit and cannot be inferred from a partial capability.',
    degradation: 'If a source becomes stale, unavailable, invalid, schema-unbound, or semantically unsupported, the capability is omitted rather than fabricated as zero or carried forward as current.'
  },
  registry: {
    file: REGISTRY_FILE,
    version: registry.version,
    capabilityCount: catalog.length,
    catalog,
    omittedActivatedCapabilities: omittedCapabilities
  },
  sourceState: {
    file: SOURCE_STATE_FILE,
    version: sourceState.version,
    summary: sourceState.summary
  },
  capabilities,
  summary: {
    registeredCapabilityCount: catalog.length,
    activeCapabilityCount: capabilities.length,
    omittedActivatedCapabilityCount: omittedCapabilities.length,
    observationCount: capabilities.reduce((sum, capability) => sum + capability.observations.length, 0),
    companyCount: new Set(capabilities.flatMap(capability => capability.observations.map(obs => obs.companyRegistry).filter(Boolean))).size,
    supportedMarketCount: new Set(capabilities.flatMap(capability => capability.supportedMarkets)).size
  },
  integrity: {
    runtimeActivationHash: runtime?.integrity?.runtimeActivationHash ?? null,
    runtimeGraphOverlayHash: graph?.integrity?.overlayHash ?? null,
    capabilityRegistryHash: sha256(text(REGISTRY_FILE)),
    capabilitySourceStateHash: sourceState?.integrity?.stateHash ?? null,
    sourceHashes: {
      [RUNTIME_FILE]: sha256(text(RUNTIME_FILE)),
      [GRAPH_FILE]: sha256(text(GRAPH_FILE)),
      [REGISTRY_FILE]: sha256(text(REGISTRY_FILE)),
      [SOURCE_STATE_FILE]: sha256(text(SOURCE_STATE_FILE)),
      ...Object.fromEntries(capabilities.map(capability => [capability.sourceFile, sha256(text(capability.sourceFile))]))
    }
  }
};
out.integrity.packetHash = sha256({ ...out, integrity: out.integrity });

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({
  version: out.version,
  status: out.status,
  registeredCapabilities: out.summary.registeredCapabilityCount,
  activeCapabilities: out.summary.activeCapabilityCount,
  observations: out.summary.observationCount,
  omittedActivated: out.summary.omittedActivatedCapabilityCount,
  companies: out.summary.companyCount,
  executionAuthority: out.authority.executionAuthority
}, null, 2));
