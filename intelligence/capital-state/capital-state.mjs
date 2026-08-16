import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'intelligence/capital-state/capital-state.json');
const PRODUCTIVITY = 'companies/productivity-data.json';
const STABLE_INDEX = 'companies/stable-index-data.json';
const GENERAL_BALANCE = 'intelligence/capital-state/general-company-balance-sheet.json';

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
const generalBalance = readJson(GENERAL_BALANCE);

if (productivity.version !== '1.15') throw new Error(`unexpected Productivity version ${productivity.version}`);
if (stableIndex.version !== '0.2-stable-companies-index-strategy-performance') throw new Error(`unexpected Stable Index version ${stableIndex.version}`);
if (generalBalance.version !== '0.1-general-company-balance-sheet') throw new Error(`unexpected General Balance Sheet version ${generalBalance.version}`);
if (generalBalance.status !== 'ok') throw new Error('general company balance sheet is not healthy');

const productiveCompanies = productivity.companies || {};
const stableCompanies = new Map((stableIndex.companies || []).map(c => [c.name, c]));
const generalCompanies = new Map((generalBalance.companies || []).map(c => [c.name, c]));

const companyStates = [];
const layerTotals = {
  foundationUsd: 0,
  productiveDividendUsd: 0,
  stableReserveUsd: 0,
  rwaUsd: 0,
  ventureUsd: 0,
  unclassifiedUsd: 0
};
let productiveMeasuredUsd = 0;
let stableMeasuredUsd = 0;
let totalMeasuredUsd = 0;

for (const [registry, name] of REGISTRY) {
  const p = productiveCompanies[name] || null;
  const s = stableCompanies.get(name) || null;
  const g = generalCompanies.get(name) || null;
  let measuredCapitalUsd = null;
  let capitalScope = 'unbound';
  let totalCapitalComplete = false;
  let layerValues = {
    foundationUsd: null,
    productiveDividendUsd: null,
    stableReserveUsd: null,
    rwaUsd: null,
    ventureUsd: null,
    unclassifiedUsd: null
  };
  let measuredPositions = [];
  let epistemicNote = null;

  if (g) {
    const total = Number(g.totalCapitalUsd);
    if (!Number.isFinite(total) || total <= 0 || g.totalCapitalComplete !== true) throw new Error(`${name}: invalid general total-capital binding`);
    measuredCapitalUsd = total;
    totalCapitalComplete = true;
    capitalScope = 'general-company-total-current-capital';
    layerValues = { ...g.layerValues };
    measuredPositions = (g.positions || []).map(pos => ({ sourceKind:'general-balance-sheet', ...pos }));
    epistemicNote = g.epistemicNote || null;

    const productiveLayer = Number(layerValues.productiveDividendUsd || 0);
    const canonicalProductive = Number(p?.productiveValue);
    if (!Number.isFinite(canonicalProductive)) throw new Error(`${name}: canonical Productive capital unavailable`);
    if (Math.abs(productiveLayer - canonicalProductive) > 0.05) throw new Error(`${name}: productive layer drift`);
    productiveMeasuredUsd += canonicalProductive;
  }

  if (s) {
    const currentCapital = Number(s.currentCapitalUsd);
    if (!Number.isFinite(currentCapital) || currentCapital <= 0) throw new Error(`${name}: stable currentCapitalUsd unavailable`);
    measuredCapitalUsd = currentCapital;
    stableMeasuredUsd += currentCapital;
    totalCapitalComplete = true;
    capitalScope = 'stable-company-total-current-capital';
    layerValues = {
      foundationUsd: 0,
      productiveDividendUsd: 0,
      stableReserveUsd: round(currentCapital),
      rwaUsd: 0,
      ventureUsd: 0,
      unclassifiedUsd: 0
    };
    measuredPositions = (s.positions || []).map(pos => {
      const value = Number(pos.marketValueUsd ?? pos.currentValueUsd ?? pos.valueUsd);
      return {
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
      };
    });
  }

  if (!totalCapitalComplete || !Number.isFinite(Number(measuredCapitalUsd))) throw new Error(`${name}: complete total-capital binding missing`);
  totalMeasuredUsd += Number(measuredCapitalUsd);
  for (const key of Object.keys(layerTotals)) {
    const v = Number(layerValues[key] || 0);
    if (!Number.isFinite(v) || v < 0) throw new Error(`${name}: invalid layer value ${key}`);
    layerTotals[key] += v;
  }

  const layerSum = Object.values(layerValues).reduce((sum, value) => sum + Number(value || 0), 0);
  if (Math.abs(layerSum - Number(measuredCapitalUsd)) > 0.05) throw new Error(`${name}: capital layers do not reconcile to company total`);

  companyStates.push({
    registry,
    name,
    measurementStatus: 'total-capital-complete',
    measuredCapitalUsd: round(measuredCapitalUsd),
    capitalScope,
    totalCapitalComplete: true,
    knownButUnboundCapitalMayExist: false,
    layerValues: Object.fromEntries(Object.entries(layerValues).map(([k,v]) => [k, round(Number(v || 0))])),
    coverage: {
      companyCapitalCoverage: 1,
      reason: g
        ? 'Existing browser Company Book is normalized into the canonical machine-readable General Company Balance Sheet and reconciled against canonical Productivity.'
        : 'Canonical Stable Index covers the complete current strategy capital state.'
    },
    epistemicNote,
    measuredPositions
  });
}

for (const key of Object.keys(layerTotals)) layerTotals[key] = round(layerTotals[key]);
const measuredCompanyCount = companyStates.length;
const totalCapitalCompleteCompanyCount = companyStates.filter(c => c.totalCapitalComplete).length;
const measuredCapitalFloorUsd = round(totalMeasuredUsd);
const networkTvlUsd = totalCapitalCompleteCompanyCount === REGISTRY.length ? measuredCapitalFloorUsd : null;
const layerWeight = key => networkTvlUsd > 0 ? round(layerTotals[key] / networkTvlUsd) : null;

const output = {
  version: '0.2-capital-state',
  engineVersion: '0.2-complete-balance-sheet-capital-substrate',
  generatedAt: new Date().toISOString(),
  status: networkTvlUsd !== null ? 'ok' : 'partial',
  purpose: 'Canonical machine-readable Capital State with complete current total-capital binding across the Registry, explicit capital layers, provenance, and fail-closed double-count protection.',
  semantics: {
    measuredCapitalFloorUsd: 'Sum of non-overlapping capital amounts proven by canonical machine-readable sources. With 9/9 complete bindings this equals Network TVL.',
    networkTvlUsd: 'Populated only when every registered company has a complete, non-overlapping total-capital binding. Unknown is never treated as zero.',
    capitalLayer: 'Primary economic role used for allocation reasoning. Productivity can be an attribute of Stable Reserve and must not force double classification.',
    layerTaxonomy: ['foundation', 'productive-dividend', 'stable-reserve', 'rwa', 'venture', 'unclassified'],
    unknownPolicy: 'unknown != zero; ambiguous classification remains unclassified rather than guessed',
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
    generalBalanceSheet: {
      file: GENERAL_BALANCE,
      version: generalBalance.version,
      generatedAt: generalBalance.generatedAt || null,
      sha256: sha256File(GENERAL_BALANCE),
      role: 'complete total-capital binding for eight general companies'
    },
    productivity: {
      file: PRODUCTIVITY,
      version: productivity.version,
      generatedAt: productivity.generatedAt || null,
      sha256: sha256File(PRODUCTIVITY),
      role: 'productive-capital reconciliation and productive current prices'
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
    totalCapitalCoverage: round(totalCapitalCompleteCompanyCount / REGISTRY.length),
    measuredProductiveCapitalUsd: round(productiveMeasuredUsd),
    measuredStableCapitalUsd: round(stableMeasuredUsd),
    measuredCapitalFloorUsd,
    networkTvlUsd,
    networkTvlStatus: networkTvlUsd !== null ? 'complete' : 'withheld-incomplete-total-capital-coverage',
    indexedCoverageStatus: `${totalCapitalCompleteCompanyCount}/${REGISTRY.length} companies have canonical complete total-capital binding`,
    layerValues: layerTotals,
    layerWeights: {
      foundation: layerWeight('foundationUsd'),
      productiveDividend: layerWeight('productiveDividendUsd'),
      stableReserve: layerWeight('stableReserveUsd'),
      rwa: layerWeight('rwaUsd'),
      venture: layerWeight('ventureUsd'),
      unclassified: layerWeight('unclassifiedUsd')
    },
    latestUpstreamGeneratedAt: isoMax([generalBalance.generatedAt, productivity.generatedAt, stableIndex.generatedAt])
  },
  companies: companyStates,
  gaps: [
    ...(generalBalance.gaps || []),
    {
      id: 'rwa-and-venture-current-capital-coverage',
      severity: 'non-blocking',
      affects: ['rwa-weight', 'venture-weight'],
      detail: 'Current Registry Company Books contain no proven current RWA or Venture capital rows. Their zero weights describe the present bound Company Books, not a permanent architectural target.'
    }
  ],
  readiness: {
    q12AllocationContext: networkTvlUsd !== null ? 'available-with-layer-provenance' : 'partial',
    companyCurrentMeasuredCapital: 'complete-current-total-capital',
    networkCapitalFloor: 'available',
    networkTvl: networkTvlUsd !== null ? 'available' : 'blocked',
    capitalLayerWeights: networkTvlUsd !== null ? 'available-with-unclassified-disclosure' : 'partial'
  }
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n');
console.log('Capital State v0.2 built', {
  measuredCompanyCount,
  totalCapitalCompleteCompanyCount,
  networkTvlUsd: output.network.networkTvlUsd,
  layerWeights: output.network.layerWeights,
  executionAuthority: output.authority.executionAuthority
});
