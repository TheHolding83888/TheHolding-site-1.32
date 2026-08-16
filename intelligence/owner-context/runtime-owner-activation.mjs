import fs from 'node:fs';
import crypto from 'node:crypto';

const ACTIVATION_FILE = 'intelligence/owner-context/owner-teaching-activation.json';
const RISK_FILE = 'intelligence/risk/health-factor-intelligence.json';
const OUT_FILE = 'intelligence/owner-context/runtime-owner-activation.json';
const MAX_RISK_AGE_HOURS = 30;

const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const arr = value => Array.isArray(value) ? value : [];

for (const file of [ACTIVATION_FILE, RISK_FILE]) {
  if (!fs.existsSync(file)) throw new Error(`Missing runtime activation source: ${file}`);
}

const activation = read(ACTIVATION_FILE);
const risk = read(RISK_FILE);

if (activation?.authority?.executionAuthority !== 'none' || activation?.authority?.readOnly !== true) throw new Error('Declared activation authority boundary failed');
if (risk?.authority?.executionAuthority !== 'none' || risk?.authority?.readOnly !== true) throw new Error('Risk intelligence authority boundary failed');

const now = Date.now();
const riskGenerated = Date.parse(risk?.generatedAt || '');
const riskAgeHours = Number.isFinite(riskGenerated) ? (now - riskGenerated) / 3_600_000 : Infinity;
const riskFresh = riskAgeHours >= 0 && riskAgeHours <= MAX_RISK_AGE_HOURS;
const observations = arr(risk?.observations);
const successful = observations.filter(x => x?.onchain?.status === 'ok');

function q7RuntimeEvidence() {
  const q7 = arr(activation?.units).find(x => x?.unitId === 'owner-context:audio-owner-q:q7');
  if (!q7) throw new Error('Q7 activation declaration unavailable');
  const blockerMatches = q7?.blocker?.id === 'health-factor-monitoring';
  const evidenceOk = blockerMatches && risk?.status === 'ok' && riskFresh && successful.length > 0;
  return {
    unitId: q7.unitId,
    declaredStatus: q7.status,
    declaredBlockerId: q7?.blocker?.id || null,
    runtimeStatus: evidenceOk ? 'activated' : 'blocked',
    runtimeCoverage: evidenceOk ? 'partial' : 'none',
    evidenceStatus: evidenceOk ? 'proven-current' : 'insufficient-current-evidence',
    capabilityId: 'health-factor-monitoring',
    capabilityLabel: 'Canonical company Health Factor monitoring',
    source: RISK_FILE,
    sourceGeneratedAt: risk?.generatedAt || null,
    sourceAgeHours: Number.isFinite(riskAgeHours) ? Number(riskAgeHours.toFixed(4)) : null,
    maxSourceAgeHours: MAX_RISK_AGE_HOURS,
    successfulObservationCount: successful.length,
    supportedMarkets: arr(risk?.coverage?.supportedMarkets),
    unresolvedDimensions: [
      'market-regime inference',
      'cross-market lending coverage beyond supported Aave v3 Base targets',
      'collateral-volatility model',
      'debt-asset risk semantics',
      'stable/foundation buffer integration',
      'unlock-latency integration',
      'automatic borrow/repay/deleveraging remains forbidden'
    ],
    authority: {
      readOnly: true,
      executionAuthority: 'none',
      automaticCapitalAction: false,
      hardThresholdPolicy: false
    }
  };
}

const runtimeUnits = [q7RuntimeEvidence()];
const promoted = runtimeUnits.filter(x => x.declaredStatus === 'blocked' && x.runtimeStatus === 'activated');

const out = {
  version: '0.1-runtime-owner-activation',
  engineVersion: '0.1-production-evidence-capability-promotion',
  generatedAt: new Date().toISOString(),
  status: 'ok',
  purpose: 'Resolve whether declared owner-teaching blockers are actually closed by current production evidence, without mutating the declared teaching contract or granting execution authority.',
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    declaredActivationMutation: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false,
    marketFactAuthorityForOwnerTeaching: false
  },
  semantics: {
    declaredStatus: 'Human-reviewed durable teaching disposition stored in owner-teaching-activation.json.',
    runtimeStatus: 'Evidence-derived current capability state. It may regress if production evidence becomes stale, unavailable, or invalid.',
    promotion: 'A declared blocker is runtime-promoted only when a named production primitive is fresh, authority-safe, and source-valid.',
    partial: 'Runtime activation can be partial. Missing dimensions remain explicit and cannot be inferred from one primitive.'
  },
  summary: {
    evaluatedUnitCount: runtimeUnits.length,
    runtimeActivatedCount: runtimeUnits.filter(x => x.runtimeStatus === 'activated').length,
    runtimeBlockedCount: runtimeUnits.filter(x => x.runtimeStatus === 'blocked').length,
    promotedFromDeclaredBlockedCount: promoted.length
  },
  units: runtimeUnits,
  integrity: {
    declaredActivationHash: sha256(fs.readFileSync(ACTIVATION_FILE, 'utf8')),
    riskStateHash: risk?.integrity?.stateHash || null,
    sourceCompositeHash: sha256({ activation: fs.readFileSync(ACTIVATION_FILE, 'utf8'), risk: fs.readFileSync(RISK_FILE, 'utf8') })
  }
};
out.integrity.runtimeActivationHash = sha256({ ...out, integrity: out.integrity });

fs.writeFileSync(OUT_FILE, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({
  version: out.version,
  generatedAt: out.generatedAt,
  summary: out.summary,
  q7: runtimeUnits[0]
}, null, 2));