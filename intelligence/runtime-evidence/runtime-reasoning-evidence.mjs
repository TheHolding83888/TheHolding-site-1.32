import fs from 'node:fs';
import crypto from 'node:crypto';

const RUNTIME_FILE = 'intelligence/owner-context/runtime-owner-activation.json';
const GRAPH_FILE = 'intelligence/neural-graph/runtime-capability-overlay.json';
const RISK_FILE = 'intelligence/risk/health-factor-intelligence.json';
const OUT_DIR = 'intelligence/runtime-evidence';
const OUT_FILE = `${OUT_DIR}/runtime-reasoning-evidence.json`;
const MAX_SOURCE_AGE_HOURS = 30;

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const text = file => fs.readFileSync(file, 'utf8');
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];

for (const file of [RUNTIME_FILE, GRAPH_FILE, RISK_FILE]) {
  if (!fs.existsSync(file)) throw new Error(`Missing runtime reasoning source: ${file}`);
}

const runtime = read(RUNTIME_FILE);
const graph = read(GRAPH_FILE);
const risk = read(RISK_FILE);

if (runtime?.authority?.executionAuthority !== 'none' || runtime?.authority?.readOnly !== true) throw new Error('Runtime activation authority boundary failed');
if (graph?.authority?.executionAuthority !== 'none' || graph?.authority?.readOnly !== true) throw new Error('Runtime capability graph authority boundary failed');
if (risk?.authority?.executionAuthority !== 'none' || risk?.authority?.readOnly !== true) throw new Error('Risk intelligence authority boundary failed');

const now = Date.now();
const sourceGeneratedAt = Date.parse(risk?.generatedAt || '');
const sourceAgeHours = Number.isFinite(sourceGeneratedAt) ? (now - sourceGeneratedAt) / 3_600_000 : Infinity;
const sourceFresh = sourceAgeHours >= 0 && sourceAgeHours <= MAX_SOURCE_AGE_HOURS;

const capabilities = [];
for (const unit of arr(runtime?.units)) {
  if (unit?.runtimeStatus !== 'activated') continue;
  if (unit?.capabilityId !== 'health-factor-monitoring') continue;

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
        source: RISK_FILE,
        method: obs?.onchain?.method ?? null,
        rpc: obs?.onchain?.rpc ?? null,
        sourceFiles: arr(obs?.sourceFiles),
        sourcePositionIds: arr(obs?.sourcePositionIds)
      }
    }));

  if (!sourceFresh || observations.length === 0) continue;

  capabilities.push({
    capabilityId: unit.capabilityId,
    capabilityLabel: unit.capabilityLabel,
    ownerUnitId: unit.unitId,
    declaredStatus: unit.declaredStatus,
    runtimeStatus: unit.runtimeStatus,
    runtimeCoverage: unit.runtimeCoverage,
    evidenceStatus: unit.evidenceStatus,
    sourceGeneratedAt: unit.sourceGeneratedAt,
    sourceAgeHours: Number.isFinite(sourceAgeHours) ? Number(sourceAgeHours.toFixed(4)) : null,
    maxSourceAgeHours: MAX_SOURCE_AGE_HOURS,
    supportedMarkets: arr(unit.supportedMarkets),
    unresolvedDimensions: arr(unit.unresolvedDimensions),
    observations
  });
}

const out = {
  version: '0.1-runtime-reasoning-evidence',
  engineVersion: '0.1-runtime-capability-to-bounded-reasoning-packet',
  generatedAt: new Date().toISOString(),
  status: 'ok',
  purpose: 'Expose current production-proven capabilities as a small, source-bound reasoning packet for Ask and future release-coherent Brain ingestion.',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false,
    ownerContextMarketFactAuthority: false
  },
  semantics: {
    capabilityBoundary: 'Only runtime-activated capabilities with fresh current production evidence enter this packet.',
    ownerContextBoundary: 'Owner teaching supplies interpretation context only; live market/account facts come from named canonical evidence sources.',
    healthFactorBoundary: 'Zero-debt accounts expose healthFactor=null/not-applicable. Owner HF ranges remain review context, never hard automatic thresholds.',
    missingDimensionBoundary: 'Unresolved dimensions remain explicit and cannot be inferred from a partial capability.',
    degradation: 'If a source becomes stale, unavailable, or invalid, the capability is omitted rather than fabricated as zero or carried forward as current.'
  },
  freshness: {
    maxSourceAgeHours: MAX_SOURCE_AGE_HOURS,
    riskSourceAgeHours: Number.isFinite(sourceAgeHours) ? Number(sourceAgeHours.toFixed(4)) : null,
    riskSourceFresh: sourceFresh
  },
  capabilities,
  summary: {
    activeCapabilityCount: capabilities.length,
    observationCount: capabilities.reduce((sum, capability) => sum + capability.observations.length, 0),
    companyCount: new Set(capabilities.flatMap(capability => capability.observations.map(obs => obs.companyRegistry).filter(Boolean))).size,
    supportedMarketCount: new Set(capabilities.flatMap(capability => capability.supportedMarkets)).size
  },
  integrity: {
    runtimeActivationHash: runtime?.integrity?.runtimeActivationHash ?? null,
    runtimeGraphOverlayHash: graph?.integrity?.overlayHash ?? null,
    riskStateHash: risk?.integrity?.stateHash ?? null,
    sourceHashes: {
      [RUNTIME_FILE]: sha256(text(RUNTIME_FILE)),
      [GRAPH_FILE]: sha256(text(GRAPH_FILE)),
      [RISK_FILE]: sha256(text(RISK_FILE))
    }
  }
};
out.integrity.packetHash = sha256({ ...out, integrity: out.integrity });

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({
  version: out.version,
  status: out.status,
  activeCapabilities: out.summary.activeCapabilityCount,
  observations: out.summary.observationCount,
  companies: out.summary.companyCount,
  executionAuthority: out.authority.executionAuthority
}, null, 2));
