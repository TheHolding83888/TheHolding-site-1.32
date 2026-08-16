import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/capital-state/capital-state.json');
const PRODUCTIVITY = 'companies/productivity-data.json';
const STABLE_INDEX = 'companies/stable-index-data.json';

const REGISTRY = [
  ['001', '05081966.eth'],
  ['002', 'YieldRing.eth'],
  ['003', 'dinaz.eth'],
  ['004', 'defitea.eth'],
  ['005', '0x5860...83CA8.eth'],
  ['006', 'aerocvxyb.eth'],
  ['007', "Rook's portfolio"],
  ['008', 'Monetra.eth'],
  ['009', '1milliondollar.eth']
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}
function sha256File(rel) {
  return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');
}
function round(n, digits = 6) {
  if (!Number.isFinite(Number(n))) return null;
  const p = 10 ** digits;
  return Math.round(Number(n) * p) / p;
}
function isoMax(values) {
  const valid = values.filter(Boolean).filter(v => Number.isFinite(Date.parse(v)));
  if (!valid.length) return null;
  return valid.sort((a, b) => Date.parse(b) - Date.parse(a))[0];
}

const productivity = readJson(PRODUCTIVITY);
const stableIndex = readJson(STABLE_INDEX);

if (productivity.version !== '1.15') throw new Error(`unexpected Productivity version ${productivity.version}`);
if (stableIndex.version !== '0.2-stable-companies-index-strategy-performance') throw new Error(`unexpected Stable Index version ${stableIndex.version}`);

const productiveCompanies = productivity.companies || {};
const stableCompanies = new Map((stableIndex.companies || []).map(c => [c.name, c]));

const companyStates = [];
let productiveMeasuredUsd = 0;
let stableMeasuredUsd = 0;

for (const [registry, name] of REGISTRY) {
  const p = productiveCompanies[name] || null;
  const s = stableCompanies.get(name) || null;
  const measuredPositions = [];
  let measuredCapitalUsd = null;
  let capitalScope = 'unbound';
  let totalCapitalComplete = false;
  const layerValues = {
    foundationUsd: null,
    productiveDividendUsd: null,
    stableReserveUsd: null,
    rwaUsd: null,
    ventureUsd: null,
    unclassifiedUsd: null
  };

  if (p) {
    const productiveValue = Number(p.productiveValue);
    if (!Number.isFinite(productiveValue)) throw new Error(`${name}: invalid productiveValue`);
    measuredCapitalUsd = productiveValue;
    productiveMeasuredUsd += productiveValue;
    capitalScope = 'productive-capital-only';
    layerValues.productiveDividendUsd = round(productiveValue);

    for (const pos of p.breakdown || []) {
      if (!Number.isFinite(Number(pos.value))) throw new Error(`${name}: productive position missing value`);
      measuredPositions.push({
        sourceKind: 'productivity',
        engineId: pos.engineId || null,
        principalId: pos.principalId || null,
        units: round(pos.units, 12),
        priceUsd: round(pos.price, 12),
        valueUsd: round(pos.value),
        primaryCapitalLayer: 'productive-dividend',
        classificationRule: 'canonical-productivity-position-is-productive-capital',
        classificationStatus: 'established',
        doubleCountPolicy: 'position contributes once through canonical Productivity breakdown'
      });
    }
  }

  if (s) {
    const currentCapital = Number(s.currentCapitalUsd);
    if (!Number.isFinite(currentCapital)) throw new Error(`${name}: stable currentCapitalUsd unavailable`);
    measuredCapitalUsd = currentCapital;
    stableMeasuredUsd += currentCapital;
    capitalScope = 'stable-company-total-current-capital';
    totalCapitalComplete = true;
    layerValues.stableReserveUsd = round(currentCapital);

    for (const pos of s.positions || []) {
      const value = Number(pos.marketValueUsd ?? pos.currentValueUsd ?? pos.valueUsd);
      measuredPositions.push({
        sourceKind: 'stable-index',
        positionId: pos.id || null,
        protocol: pos.protocolFamily || pos.protocol || null,
        chain: pos.chain || null,
        asset: pos.asset || pos.underlyingSymbol || pos.terminalSymbol || null,
        valueUsd: Number.isFinite(value) ? round(value) : null,
        primaryCapitalLayer: 'stable-reserve',
        productiveAttribute: true,
        classificationRule: 'Registry 008 is canonical Stable Capital universe; principal remains Stable Reserve while productivity is an attribute, not a second capital layer',
        classificationStatus: 'established',
        doubleCountPolicy: 'position detail is descriptive; company aggregate uses stableIndex.currentCapitalUsd exactly once'
      });
    }
  }

  const knownButUnbound = !totalCapitalComplete;
  companyStates.push({
    registry,
    name,
    measurementStatus: measuredCapitalUsd === null ? 'unbound' : (totalCapitalComplete ? 'total-capital-complete' : 'partial-capital-measurement'),
    measuredCapitalUsd: round(measuredCapitalUsd),
    capitalScope,
    totalCapitalComplete,
    knownButUnboundCapitalMayExist: knownButUnbound,
    layerValues,
    coverage: {
      companyCapitalCoverage: totalCapitalComplete ? 1 : null,
      reason: totalCapitalComplete
        ? 'Canonical stable company source covers the complete current strategy capital state.'
        : p
          ? 'Canonical Productivity covers productive capital, but non-productive/foundation capital is not yet machine-bound into Capital State.'
          : 'No canonical machine-bound current capital source.'
    },
    measuredPositions
  });
}

const measuredCompanyCount = companyStates.filter(c => c.measuredCapitalUsd !== null).length;
const totalCapitalCompleteCompanyCount = companyStates.filter(c => c.totalCapitalComplete).length;
const measuredCapitalFloorUsd = round(productiveMeasuredUsd + stableMeasuredUsd);
const totalCapitalCoverage = totalCapitalCompleteCompanyCount / REGISTRY.length;

const output = {
  version: '0.1-capital-state',
  engineVersion: '0.1-evidence-bound-capital-substrate',
  generatedAt: new Date().toISOString(),
  status: 'partial',
  purpose: 'Canonical machine-readable Capital State substrate. It separates measured capital from complete company/network TVL and fails closed on unbound capital.',
  semantics: {
    measuredCapitalFloorUsd: 'Sum of non-overlapping capital amounts currently proven by canonical machine-readable sources. This is a lower bound, not Network TVL.',
    networkTvlUsd: 'Only populated when every registered company has a complete, non-overlapping total-capital binding. Unknown is never treated as zero.',
    capitalLayer: 'Primary economic role used for allocation reasoning. Productivity can be an attribute of Stable Reserve and must not force double classification.',
    layerTaxonomy: ['foundation', 'productive-dividend', 'stable-reserve', 'rwa', 'venture', 'unclassified'],
    unknownPolicy: 'unknown != zero; unbound or ambiguous capital remains null/unclassified rather than guessed',
    doubleCountPolicy: 'wrapper/LP/underlying/productivity representations may contribute only through one canonical economic path to company/network aggregates'
  },
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    allocationAuthority: false,
    policyMutationAuthority: false,
    methodologyMutationAuthority: false
  },
  sourceState: {
    productivity: {
      file: PRODUCTIVITY,
      version: productivity.version,
      generatedAt: productivity.generatedAt || null,
      sha256: sha256File(PRODUCTIVITY),
      role: 'productive-capital measurement for eight general companies'
    },
    stableIndex: {
      file: STABLE_INDEX,
      version: stableIndex.version,
      generatedAt: stableIndex.generatedAt || null,
      sha256: sha256File(STABLE_INDEX),
      role: 'complete current capital state for Stable Capital company Monetra.eth'
    }
  },
  network: {
    registryCompanyCount: REGISTRY.length,
    measuredCompanyCount,
    totalCapitalCompleteCompanyCount,
    totalCapitalCoverage: round(totalCapitalCoverage),
    measuredProductiveCapitalUsd: round(productiveMeasuredUsd),
    measuredStableCapitalUsd: round(stableMeasuredUsd),
    measuredCapitalFloorUsd,
    networkTvlUsd: totalCapitalCompleteCompanyCount === REGISTRY.length ? measuredCapitalFloorUsd : null,
    networkTvlStatus: totalCapitalCompleteCompanyCount === REGISTRY.length ? 'complete' : 'withheld-incomplete-total-capital-coverage',
    indexedCoverageStatus: `${totalCapitalCompleteCompanyCount}/${REGISTRY.length} companies have canonical complete total-capital binding`,
    latestUpstreamGeneratedAt: isoMax([productivity.generatedAt, stableIndex.generatedAt])
  },
  companies: companyStates,
  gaps: [
    {
      id: 'general-company-total-capital-binding',
      severity: 'blocking',
      affects: ['networkTvlUsd', 'foundation-weight', 'whole-company-concentration', 'owner-q12-allocation-context'],
      detail: 'Eight general companies have canonical productive-capital measurement but their full balance-sheet/company-book capital is still browser-side or otherwise not normalized into a machine-readable canonical total-capital source.'
    },
    {
      id: 'capital-layer-classification-beyond-proven-sources',
      severity: 'blocking',
      affects: ['foundation', 'rwa', 'venture', 'unclassified-share'],
      detail: 'Capital layers are emitted only where source semantics establish them. No asset is silently promoted into Foundation/RWA/Venture from owner preference alone.'
    }
  ],
  readiness: {
    q12AllocationContext: 'partial',
    companyCurrentMeasuredCapital: 'available-with-scope',
    networkCapitalFloor: 'available',
    networkTvl: 'blocked',
    capitalLayerWeights: 'partial'
  }
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
console.log('Capital State built', {
  measuredCompanyCount,
  totalCapitalCompleteCompanyCount,
  measuredCapitalFloorUsd,
  networkTvlUsd: output.network.networkTvlUsd,
  executionAuthority: output.authority.executionAuthority
});
