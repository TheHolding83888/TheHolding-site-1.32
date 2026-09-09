import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

const PATHS = {
  market: path.join(__dirname, 'market-data.json'),
  funds: path.join(__dirname, 'fund-capital-registry.json'),
  defitea: path.join(ROOT, 'companies/defitea-canonical-state.json'),
  productivity: path.join(ROOT, 'companies/productivity-data.json'),
  stableIndex: path.join(ROOT, 'companies/stable-index-data.json'),
  capital: path.join(ROOT, 'intelligence/capital-state/capital-state.json'),
  output: path.join(__dirname, 'public-capital-state.json')
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function finite(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function round(v, digits = 6) {
  const n = finite(v);
  return n === null ? null : Number(n.toFixed(digits));
}
function sum(values) {
  let total = 0;
  for (const value of values) {
    const n = finite(value);
    if (n === null) return null;
    total += n;
  }
  return total;
}
function marketRow(market, assetId) {
  return market?.prices?.[assetId] || null;
}
function marketPrice(market, assetId) {
  const row = marketRow(market, assetId);
  const n = finite(row?.usd);
  return n !== null && n >= 0 ? n : null;
}
function worstStatus(statuses) {
  if (statuses.includes('unknown')) return 'partial';
  if (statuses.includes('stale-fallback')) return 'stale-fallback';
  return 'ok';
}

const market = readJson(PATHS.market);
const fundRegistry = readJson(PATHS.funds);
const defiteaState = readJson(PATHS.defitea);
const productivity = readJson(PATHS.productivity);
const stableIndex = readJson(PATHS.stableIndex);
const capitalState = readJson(PATHS.capital);

if (defiteaState?.capitalAggregation?.fundCompanyTvlParityRequired !== true ||
    defiteaState?.capitalAggregation?.networkContributionMode !== 'standalone-only-to-prevent-double-count' ||
    defiteaState?.capitalAggregation?.incomeAggregationAuthority !== false) {
  throw new Error('Defitea fund/company consolidated TVL contract unavailable');
}

function valueRegistryFund(fundId, fund) {
  const rows = [];
  for (const position of fund.positions || []) {
    let priceUsd = null;
    let valueUsd = null;
    let status = 'unknown';
    let source = null;

    if (position.pricing === 'market') {
      const m = marketRow(market, position.assetId);
      priceUsd = marketPrice(market, position.assetId);
      status = priceUsd === null ? 'unknown' : (m?.status || 'fresh') === 'fresh' ? 'ok' : 'stale-fallback';
      source = m?.source || null;
      if (priceUsd !== null) valueUsd = Number(position.quantity) * priceUsd;
      if (valueUsd === null && finite(position.fallbackTotalValueUsd) !== null) {
        valueUsd = finite(position.fallbackTotalValueUsd);
        priceUsd = valueUsd / Number(position.quantity || 1);
        status = 'stale-fallback';
        source = 'explicit-fund-registry-fallback';
      }
    } else if (position.pricing === 'legacy-xaut-ratio') {
      const xaut = marketRow(market, 'tether-gold');
      const xautPrice = marketPrice(market, 'tether-gold');
      const ratio = finite(position.ratioToXaut);
      if (xautPrice !== null && ratio && ratio > 0) {
        priceUsd = xautPrice / ratio;
        valueUsd = Number(position.quantity) * priceUsd;
        status = xaut?.status === 'fresh' ? 'ok' : 'stale-fallback';
        source = 'legacy-xaut-ratio-preserved';
      }
    } else if (position.pricing === 'fixed-total') {
      valueUsd = finite(position.fixedTotalValueUsd);
      priceUsd = valueUsd !== null && Number(position.quantity) ? valueUsd / Number(position.quantity) : null;
      status = valueUsd === null ? 'unknown' : 'ok';
      source = position.evidenceStatus === 'owner-provided-current'
        ? 'owner-provided-current-fixed-total'
        : 'explicit-fixed-total';
    }

    rows.push({
      assetId: position.assetId,
      symbol: position.symbol || null,
      quantity: finite(position.quantity),
      priceUsd: round(priceUsd),
      valueUsd: round(valueUsd),
      status,
      source,
      evidenceStatus: position.evidenceStatus || null,
      asOf: position.asOf || null
    });
  }

  const tvl = sum(rows.map(x => x.valueUsd));
  return {
    id: fundId,
    name: fund.name,
    status: tvl === null ? 'partial' : worstStatus(rows.map(x => x.status)),
    tvlUsd: round(tvl),
    positions: rows,
    excludedFromTvl: fund.excludedFromTvl || [],
    source: 'canonical-fund-capital-registry'
  };
}

function valueMonetra(fund) {
  const row = (stableIndex.companies || []).find(x => x.name === fund.companyName) || null;
  const tvl = finite(row?.currentCapitalUsd);
  return {
    id: 'monetra',
    name: fund.name,
    companyName: fund.companyName,
    status: tvl === null ? 'partial' : 'ok',
    tvlUsd: round(tvl),
    referenceAprPct: round(row?.currentReferenceApyPct ?? row?.displayReferenceApyPct),
    referenceAprUpdatedAt: stableIndex.generatedAt || null,
    positions: null,
    source: 'stable-index-protocol-nav',
    note: 'Stable/wrapper/protocol NAV is intentionally not repriced through CoinGecko.'
  };
}

function shouldMarketRevalue(position) {
  if (!position?.assetId) return false;
  if (marketPrice(market, position.assetId) === null) return false;
  const provenance = String(position.priceProvenance || '');
  return provenance.includes('coingecko') || provenance.includes('canonical-productivity-breakdown');
}

const companies = [];
for (const company of capitalState.companies || []) {
  const rows = [];
  for (const position of company.measuredPositions || []) {
    const units = finite(position.units);
    const canonicalValue = finite(position.valueUsd);
    let valueUsd = canonicalValue;
    let priceUsd = finite(position.priceUsd);
    let valuationSource = 'canonical-capital-state';
    let status = canonicalValue === null ? 'unknown' : 'ok';

    if (units !== null && shouldMarketRevalue(position)) {
      const m = marketRow(market, position.assetId);
      const px = marketPrice(market, position.assetId);
      priceUsd = px;
      valueUsd = px === null ? canonicalValue : units * px;
      valuationSource = px === null ? 'canonical-capital-state-fallback' : 'shared-market-data';
      status = px === null ? (canonicalValue === null ? 'unknown' : 'stale-fallback') : m?.status === 'fresh' ? 'ok' : 'stale-fallback';
    }

    rows.push({
      assetId: position.assetId || null,
      units,
      priceUsd: round(priceUsd),
      valueUsd: round(valueUsd),
      status,
      valuationSource,
      canonicalSourceKind: position.sourceKind || null,
      primaryCapitalLayer: position.primaryCapitalLayer || null,
      evidenceStatus: position.evidenceStatus || null
    });
  }

  const rowProjection = rows.length ? sum(rows.map(x => x.valueUsd)) : finite(company.measuredCapitalUsd);
  const isDefiteaConsolidated =
    company.registry === '004' &&
    company.consolidation?.fundCompanyTvlParityRequired === true &&
    company.consolidation?.childCapitalIncludedAgainInNetworkContribution === false;
  const projected = isDefiteaConsolidated ? finite(company.measuredCapitalUsd) : rowProjection;
  const networkContribution = finite(company.networkContributionUsd) ?? projected;
  if (projected === null) throw new Error(`${company.registry}/${company.name}: public TVL unavailable`);
  if (networkContribution === null) throw new Error(`${company.registry}/${company.name}: network contribution unavailable`);
  if (isDefiteaConsolidated) {
    const standalone = finite(company.standaloneCapitalUsd);
    const nested = finite(company.nestedCompanyCapitalUsd);
    if (standalone === null || nested === null || Math.abs(projected - standalone - nested) > 0.05) {
      throw new Error('Defitea consolidated Public Capital identity drift');
    }
    if (Math.abs(networkContribution - standalone) > 0.05) {
      throw new Error('Defitea Public Capital network contribution double-count drift');
    }
  }

  const status = projected === null ? 'partial' : worstStatus(rows.map(x => x.status));
  companies.push({
    registry: company.registry,
    name: company.name,
    status,
    tvlUsd: round(projected),
    standaloneTvlUsd: isDefiteaConsolidated ? round(company.standaloneCapitalUsd) : null,
    nestedCompanyCapitalUsd: isDefiteaConsolidated ? round(company.nestedCompanyCapitalUsd) : null,
    networkContributionUsd: round(networkContribution),
    sourceCapitalGeneratedAt: capitalState.generatedAt,
    positions: rows,
    consolidation: isDefiteaConsolidated ? company.consolidation : null,
    performanceBasisStatus: isDefiteaConsolidated
      ? 'consolidated-current-value-without-automatic-consolidated-cost-basis'
      : 'company-scope'
  });
}

function publicCompany(registry) {
  return companies.find(x => x.registry === registry) || null;
}

function valueDefitea(fund) {
  const company = publicCompany('004');
  if (!company) throw new Error('Defitea Registry #004 public company projection missing');
  const p = productivity?.companies?.[fund.companyName] || null;
  const standaloneRows = company.positions || [];
  return {
    id: 'defitea',
    name: fund.name,
    companyName: fund.companyName,
    status: company.status,
    tvlUsd: company.tvlUsd,
    standaloneTvlUsd: company.standaloneTvlUsd,
    nestedCompanyCapitalUsd: company.nestedCompanyCapitalUsd,
    networkContributionUsd: company.networkContributionUsd,
    referenceAprPct: round(p?.aprLatest),
    referenceAprUpdatedAt: p?.updatedAt || productivity?.generatedAt || null,
    positions: standaloneRows,
    consolidation: company.consolidation,
    source: 'capital-state-defitea-consolidated-company-identity',
    note: 'Defitea Fund and defitea.eth publish the same consolidated TVL. Nested company capital is included in the Defitea display TVL but not counted twice in Network TVL; child-company factual income remains separate.'
  };
}

const funds = {};
for (const [fundId, fund] of Object.entries(fundRegistry.funds || {})) {
  if (fund.valuationMode === 'delegate-defitea-canonical-state') funds[fundId] = valueDefitea(fund);
  else if (fund.valuationMode === 'delegate-stable-index') funds[fundId] = valueMonetra(fund);
  else funds[fundId] = valueRegistryFund(fundId, fund);
}

const defiteaCompany = publicCompany('004');
if (!defiteaCompany || Math.abs(Number(funds.defitea?.tvlUsd) - Number(defiteaCompany.tvlUsd)) > 0.000001) {
  throw new Error('Defitea Fund/company TVL parity failed');
}

const companyNetworkTvl = sum(companies.map(x => x.networkContributionUsd));
const canonicalNetworkTvl = finite(capitalState?.network?.networkTvlUsd);
if (canonicalNetworkTvl !== null && companyNetworkTvl !== null && Math.abs(companyNetworkTvl - canonicalNetworkTvl) > 0.05) {
  throw new Error(`Public Company Network TVL drift: public=${companyNetworkTvl} capitalState=${canonicalNetworkTvl}`);
}
const fundEcosystemTvl = sum(Object.values(funds).map(x => x.tvlUsd));
const generatedAt = new Date().toISOString();

const output = {
  version: '0.1-public-capital-state',
  engineVersion: '0.2-defitea-consolidated-parity-network-unique',
  generatedAt,
  status: companyNetworkTvl === null || fundEcosystemTvl === null ? 'partial' : worstStatus([
    ...companies.map(x => x.status),
    ...Object.values(funds).map(x => x.status)
  ]),
  semantics: {
    marketPricesFetchedOnceUpstream: true,
    browserExternalPriceRequestsAllowed: false,
    fundAndCompanyConsumersShareSamePriceObservation: true,
    wrapperNavAndProtocolValuationRemainCanonicalUpstream: true,
    defiteaFundCompanyTvlParityRequired: true,
    defiteaDisplayTvlIncludesNestedCompanies: true,
    defiteaNestedCapitalNetworkDoubleCount: false,
    defiteaNestedCapitalDoesNotGrantIncomeAuthority: true,
    reportingIsHistoryNotCurrentValuationAuthority: true,
    unknownIsNotZero: true,
    partialIsNotTotal: true,
    oneEconomicPositionOnce: true
  },
  sourceState: {
    marketDataGeneratedAt: market.generatedAt || null,
    marketDataObservedAt: market.observedAt || null,
    marketDataStatus: market.status || null,
    defiteaCanonicalVersion: defiteaState.version || null,
    productivityGeneratedAt: productivity.generatedAt || null,
    stableIndexGeneratedAt: stableIndex.generatedAt || null,
    capitalStateGeneratedAt: capitalState.generatedAt || null
  },
  totals: {
    fundEcosystemTvlUsd: round(fundEcosystemTvl),
    fundEcosystemStatus: fundEcosystemTvl === null ? 'partial' : worstStatus(Object.values(funds).map(x => x.status)),
    companyNetworkTvlUsd: round(companyNetworkTvl),
    companyNetworkStatus: companyNetworkTvl === null ? 'partial' : worstStatus(companies.map(x => x.status)),
    companyNetworkCountingPolicy: 'unique-network-contribution; Defitea consolidated parent view does not re-add Registry #001/#002'
  },
  funds,
  companies,
  authority: {
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    allocationAuthority: false,
    methodologyMutationAuthority: false
  }
};

fs.writeFileSync(PATHS.output, JSON.stringify(output, null, 2) + '\n');
console.log('Public Capital State written', {
  status: output.status,
  fundEcosystemTvlUsd: output.totals.fundEcosystemTvlUsd,
  companyNetworkTvlUsd: output.totals.companyNetworkTvlUsd,
  defiteaFundTvlUsd: output.funds.defitea?.tvlUsd,
  defiteaCompanyTvlUsd: defiteaCompany.tvlUsd,
  defiteaStandaloneTvlUsd: defiteaCompany.standaloneTvlUsd,
  defiteaNestedCompanyCapitalUsd: defiteaCompany.nestedCompanyCapitalUsd,
  defiteaReferenceAprPct: output.funds.defitea?.referenceAprPct
});
