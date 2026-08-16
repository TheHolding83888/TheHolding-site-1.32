import fs from 'node:fs';
import crypto from 'node:crypto';

const REGISTRY_FILE = 'intelligence/runtime-evidence/runtime-capability-registry.json';
const OUT_FILE = 'intelligence/runtime-evidence/runtime-capability-source-state.json';

const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const readText = file => fs.readFileSync(file, 'utf8');
const readJson = file => JSON.parse(readText(file));

if (!fs.existsSync(REGISTRY_FILE)) throw new Error('Missing runtime capability registry');
const registryText = readText(REGISTRY_FILE);
const registry = JSON.parse(registryText);

if (registry?.version !== '0.2-runtime-evidence-capability-registry') throw new Error('Unexpected runtime capability registry version');
if (registry?.authority?.executionAuthority !== 'none' || registry?.authority?.readOnly !== true) throw new Error('Runtime capability registry gained execution authority');
if (registry?.authority?.automaticCapabilityActivation !== false) throw new Error('Runtime capability registry may activate capabilities autonomously');

const getPath = (obj, dotted) => {
  if (!dotted) return null;
  return String(dotted).split('.').reduce((acc, key) => acc == null ? null : acc[key], obj);
};

const now = Date.now();
const capabilities = [];
for (const entry of registry.capabilities || []) {
  const file = entry?.source?.file;
  if (!file || typeof file !== 'string') throw new Error(`Capability ${entry?.capabilityId ?? 'unknown'} missing source file`);
  const exists = fs.existsSync(file);
  const item = {
    capabilityId: entry.capabilityId,
    family: entry.family,
    runtimeAdapter: entry.runtimeAdapter,
    runtimeEmission: entry.runtimeEmission,
    sourceFile: file,
    sourceExists: exists,
    sourceBytes: exists ? fs.statSync(file).size : 0,
    sourceSha256: exists ? sha256(readText(file)) : null,
    schemaInspected: entry?.source?.schemaInspected === true,
    sourceVerified: entry?.source?.sourceVerified === true || entry?.source?.canonical === true,
    generatedAt: null,
    ageHours: null,
    maxAgeHours: Number.isFinite(entry?.freshness?.maxAgeHours) ? entry.freshness.maxAgeHours : null,
    fresh: false,
    statusValue: null,
    adapterReady: false,
    emissionEligibleByRegistry: entry.runtimeEmission === 'enabled-when-explicitly-activated' || entry.runtimeEmission === 'available-for-future-explicit-activation',
    unresolvedDimensions: Array.isArray(entry.unresolvedDimensions) ? entry.unresolvedDimensions : []
  };

  if (exists && entry?.source?.schemaInspected === true) {
    const data = readJson(file);
    const generatedAt = getPath(data, entry?.source?.generatedAtPath);
    const generatedMs = typeof generatedAt === 'string' ? Date.parse(generatedAt) : NaN;
    item.generatedAt = Number.isFinite(generatedMs) ? generatedAt : null;
    item.ageHours = Number.isFinite(generatedMs) ? Number(((now - generatedMs) / 3_600_000).toFixed(4)) : null;
    item.fresh = Number.isFinite(generatedMs) && item.ageHours >= 0 && item.maxAgeHours !== null && item.ageHours <= item.maxAgeHours;
    item.statusValue = entry?.source?.statusPath ? getPath(data, entry.source.statusPath) : null;
    item.adapterReady = item.emissionEligibleByRegistry && item.fresh;
  } else if (exists) {
    item.adapterReady = false;
  }

  capabilities.push(item);
}

const out = {
  version: '0.2-runtime-capability-source-state',
  engineVersion: '0.2-registry-driven-source-health',
  generatedAt: new Date().toISOString(),
  status: 'ok',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    automaticCapabilityActivation: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false
  },
  semantics: {
    sourceStateIsNotOwnerActivation: true,
    adapterReadyDoesNotImplyOwnerTeachingActivated: true,
    uninspectedSchemaCannotEmitRuntimeFacts: true,
    staleSourceCannotEmitCurrentRuntimeFacts: true,
    missingSourceIsNeverZero: true
  },
  capabilities,
  summary: {
    capabilityCount: capabilities.length,
    sourcePresentCount: capabilities.filter(x => x.sourceExists).length,
    freshSchemaBoundCount: capabilities.filter(x => x.schemaInspected && x.fresh).length,
    adapterReadyCount: capabilities.filter(x => x.adapterReady).length,
    schemaPendingCount: capabilities.filter(x => x.sourceExists && !x.schemaInspected).length,
    missingSourceCount: capabilities.filter(x => !x.sourceExists).length
  },
  integrity: {
    registryHash: sha256(registryText),
    stateHash: null
  }
};
out.integrity.stateHash = sha256(JSON.stringify({ ...out, integrity: { ...out.integrity, stateHash: null } }));

fs.writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({
  version: out.version,
  capabilities: out.summary.capabilityCount,
  sourcePresent: out.summary.sourcePresentCount,
  freshSchemaBound: out.summary.freshSchemaBoundCount,
  adapterReady: out.summary.adapterReadyCount,
  schemaPending: out.summary.schemaPendingCount,
  executionAuthority: out.authority.executionAuthority
}, null, 2));
