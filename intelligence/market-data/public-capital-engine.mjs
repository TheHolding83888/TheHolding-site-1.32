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
      source = 'explicit-fixed-total';
    }

    rows.push({
      assetId: position.assetId,
      symbol: position.symbol || null,
      quantity: finite(position.quantity),
      priceUsd: round(priceUsd),
      valueUsd: round(valueUsd),
      status,
      source
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

function valueDefitea(fund) {
  const rows = (defiteaState.productivePositions || []).map(position => {
    const m = marketRow(market, position.assetId);
    const px = marketPrice(market, position.assetId);
    return {
      assetId: position.assetId,
      symbol: position.display || null,
      quantity: finite(position.quantity),
      priceUsd: round(px),
      valueUsd: px === null ? null : round(Number(position.quantity) * px),
      status: px === null ? 'unknown' : m?.status === 'fresh' ? 'ok' : 'stale-fallback',
      source: m?.source || null
    };
  });
  const tvl = sum(rows.map(x => x.valueUsd));
  const p = productivity?.companies?.[fund.companyName] || null;
  return {
    id: 'defitea',
    name: fund.name,
    companyName: fund.companyName,
    status: tvl === null ? 'partial' : worstStatus(rows.map(x => x.status)),
    tvlUsd: round(tvl),
    referenceAprPct: round(p?.aprLatest),
    referenceAprUpdatedAt: p?.updatedAt || productivity?.generatedAt || null,
    positions: rows,
    source: 'defitea-canonical-state-plus-shared-market-data'
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

const funds = {};
for (const [fundId, fund] of Object.entries(fundRegistry.funds || {})) {
  if (fund.valuationMode === 'delegate-defitea-canonical-state') funds[fundId] = valueDefitea(fund);
  else if (fund.valuationMode === 'delegate-stable-index') funds[fundId] = valueMonetra(fund);
  else funds[fundId] = valueRegistryFund(fundId, fund);
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
      primaryCapitalLayer: position.primaryCapitalLayer || null
    });
  }

  const projected = rows.length ? sum(rows.map(x => x.valueUsd)) : finite(company.measuredCapitalUsd);
  const status = projected === null ? 'partial' : worstStatus(rows.map(x => x.status));
  companies.push({
    registry: company.registry,
    name: company.name,
    status,
    tvlUsd: round(projected),
    sourceCapitalGeneratedAt: capitalState.generatedAt,
    positions: rows
  });
}

const companyNetworkTvl = sum(companies.map(x => x.tvlUsd));
const fundEcosystemTvl = sum(Object.values(funds).map(x => x.tvlUsd));
const generatedAt = new Date().toISOString();

const output = {
  version: '0.1-public-capital-state',
  engineVersion: '0.1-shared-market-data-plus-canonical-protocol-nav',
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
    companyNetworkStatus: companyNetworkTvl === null ? 'partial' : worstStatus(companies.map(x => x.status))
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
  defiteaTvlUsd: output.funds.defitea?.tvlUsd,
  defiteaReferenceAprPct: output.funds.defitea?.referenceAprPct
});
