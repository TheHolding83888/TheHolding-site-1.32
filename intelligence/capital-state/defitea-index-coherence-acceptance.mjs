import fs from 'node:fs';

const publicState = JSON.parse(fs.readFileSync('intelligence/market-data/public-capital-state.json', 'utf8'));
const canonical = JSON.parse(fs.readFileSync('companies/defitea-canonical-state.json', 'utf8'));
const site = fs.readFileSync('companies/index.html', 'utf8');

function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}
function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function near(a, b, tolerance = 0.02) {
  const x = finite(a);
  const y = finite(b);
  return x !== null && y !== null && Math.abs(x - y) <= tolerance;
}

const companies = Array.isArray(publicState.companies) ? publicState.companies : [];
const byRegistry = new Map(companies.map(row => [String(row.registry || '').padStart(3, '0'), row]));
const company001 = byRegistry.get('001');
const company002 = byRegistry.get('002');
const company004 = byRegistry.get('004');
const fund = publicState.funds?.defitea;

requireCondition(publicState.status === 'ok', 'Public Capital State must be ok');
requireCondition(companies.length === 10, `Expected 10 registered public companies, got ${companies.length}`);
requireCondition(fund && company004 && company001 && company002, 'Defitea or related company public rows missing');

// Defitea Fund and defitea.eth are the same capital scope and must show one identical own-asset TVL.
requireCondition(near(fund.tvlUsd, company004.tvlUsd), 'Defitea fund/company TVL parity drift');
requireCondition(canonical.capitalAggregation?.economicIdentity === 'defitea-fund-equals-defitea-company', 'Canonical Defitea economic identity drift');
requireCondition(canonical.capitalAggregation?.displayTvlMode === 'standalone-company-assets-only', 'Defitea own-capital TVL mode drift');
requireCondition(canonical.capitalAggregation?.fundCompanyTvlParityRequired === true, 'Canonical fund/company parity boundary missing');
requireCondition(canonical.capitalAggregation?.networkContributionMode === 'same-standalone-company-capital', 'Canonical network contribution mode drift');
requireCondition(canonical.semantics?.relatedCompanyCapitalExcludedFromDefiteaTvl === true, 'Related-company capital exclusion missing');
requireCondition(canonical.semantics?.relatedCompanyIncomeRollupSeparateFromCapital === true, 'Capital/income separation missing');

// Related companies remain independent capital scopes and must never be added into Defitea TVL.
requireCondition(near(company004.standaloneTvlUsd, company004.tvlUsd), 'Registry #004 standalone TVL must equal display TVL');
requireCondition(near(fund.standaloneTvlUsd, fund.tvlUsd), 'Defitea Fund standalone TVL must equal display TVL');
requireCondition(near(company004.nestedCompanyCapitalUsd, 0), 'Registry #004 related-company capital leaked into TVL');
requireCondition(near(fund.nestedCompanyCapitalUsd, 0), 'Defitea Fund related-company capital leaked into TVL');
requireCondition(company004.consolidation?.mode === 'standalone-company-assets-only', 'Registry #004 own-capital consolidation marker missing');
requireCondition(company004.consolidation?.relatedCompanyCapitalIncluded === false, 'Registry #004 related-company capital inclusion drift');
requireCondition(company004.consolidation?.relatedCompanyIncomeRollupSeparate === true, 'Registry #004 income roll-up separation missing');
requireCondition(publicState.semantics?.defiteaDisplayTvlIncludesNestedCompanies === false, 'Public Capital still claims related-company TVL inclusion');
requireCondition(publicState.semantics?.defiteaRelatedCompanyCapitalExcluded === true, 'Public Capital related-company exclusion semantic missing');

// Network/Index contribution equals the same own-company TVL. #001 and #002 contribute independently once.
requireCondition(near(company004.networkContributionUsd, company004.tvlUsd), 'Registry #004 network contribution must equal own-company TVL');
const networkContributionSum = companies.reduce((sum, row) => {
  const value = finite(row.networkContributionUsd);
  requireCondition(value !== null && value >= 0, `Invalid network contribution for registry ${row.registry}`);
  return sum + value;
}, 0);
requireCondition(near(networkContributionSum, publicState.totals?.companyNetworkTvlUsd), 'Company Network TVL is not the sum of unique company contributions');
requireCondition(String(publicState.totals?.companyNetworkCountingPolicy || '').includes('Defitea contributes only Registry #004 own capital'), 'Network counting policy no longer documents Defitea own-capital boundary');

// This acceptance covers capital only. Income ownership and fund-level roll-up are separate reporting concerns.
requireCondition(company004.consolidation?.incomeAggregationAuthority === false, 'Capital State gained factual-income aggregation authority');
requireCondition(publicState.semantics?.defiteaRelatedCompanyIncomeRollupSeparateFromCapital === true, 'Public Capital income/capital boundary missing');

// Complete historical acquisition basis is now available for all current Defitea positions.
requireCondition(publicState.semantics?.unknownIsNotZero === true, 'UNKNOWN != 0 semantic missing');
requireCondition(publicState.semantics?.partialIsNotTotal === true, 'partial != total semantic missing');
requireCondition(canonical.version === '0.2-defitea-canonical-state', 'Defitea canonical state version drift');
requireCondition(canonical.semantics?.unknownCostBasisIsNotZero === true, 'Defitea UNKNOWN cost basis semantic missing');
requireCondition(canonical.semantics?.completeCostBasisRequiresEveryCurrentPosition === true, 'Defitea complete-basis fail-closed semantic missing');
requireCondition(canonical.semantics?.newPositionWithoutBasisRevertsPortfolioToPartial === true, 'Defitea new-position fail-closed semantic missing');
requireCondition(canonical.costBasis?.status === 'complete', 'Defitea portfolio basis is not complete');
requireCondition(near(canonical.costBasis?.totalUsd, 9724.36, 0.005), 'Defitea total historical cost basis drift');
requireCondition(canonical.costBasis?.coveredPositionCount === 11 && canonical.costBasis?.totalPositionCount === 11, 'Defitea cost-basis coverage drift');
requireCondition(Array.isArray(canonical.productivePositions) && canonical.productivePositions.length === 11, 'Defitea current position inventory drift');
requireCondition(canonical.productivePositions.every(row => finite(row.costBasisUsd) !== null), 'Defitea current position without explicit historical cost basis');
const byAsset = new Map(canonical.productivePositions.map(row => [row.assetId, row]));
requireCondition(near(byAsset.get('aerodrome-finance')?.quantity, 2632.61, 1e-9) && near(byAsset.get('aerodrome-finance')?.costBasisUsd, 1038.45, 0.005), 'Defitea AERO screenshot basis drift');
requireCondition(near(byAsset.get('frax-share')?.quantity, 4456.96, 1e-9) && near(byAsset.get('frax-share')?.costBasisUsd, 1777.44, 0.005), 'Defitea FRAX screenshot basis drift');
requireCondition(near(canonical.evidenceSnapshot?.marketValueUsd, 12814.37, 0.005) && near(canonical.evidenceSnapshot?.unrealizedProfitUsd, 3090.01, 0.005), 'Defitea screenshot reconciliation drift');

// Public Companies surface consumes canonical current values while Company Book carries the fixed historical basis.
requireCondition(site.includes('const publicCompanyTvl = (key, fallback) =>'), 'Companies page public TVL binding missing');
requireCondition(site.includes('const publicCompanyNetworkContribution = (key, fallback) =>'), 'Companies page unique network-contribution binding missing');
requireCondition(site.includes('f.indexCapitalValue = publicCompanyNetworkContribution(key, v);'), 'Index capital value is not bound to canonical company contribution');
requireCondition(site.includes('const canonicalNetworkTvl = Number(publicCapitalSnapshot?.totals?.companyNetworkTvlUsd);'), 'Companies page canonical Network TVL binding missing');
requireCondition(site.includes("'defitea.eth': ["), 'Defitea Company Book block missing');
requireCondition(site.includes('qty: 2632.61') && site.includes('costBasisUsd: 1038.45'), 'Defitea AERO public basis projection missing');
requireCondition(site.includes('qty: 4456.96') && site.includes('costBasisUsd: 1777.44'), 'Defitea FRAX public basis projection missing');

requireCondition(canonical.authority?.executionAuthority === 'none', 'Canonical Defitea execution authority expanded');
requireCondition(publicState.authority?.executionAuthority === 'none', 'Public Capital execution authority expanded');

console.log('Defitea own-capital TVL / Index / Performance coherence ACCEPTANCE PASS', {
  companyCount: companies.length,
  defiteaTvlUsd: fund.tvlUsd,
  company001TvlUsd: company001.tvlUsd,
  company002TvlUsd: company002.tvlUsd,
  relatedCompanyCapitalIncludedInDefitea: false,
  defiteaNetworkContributionUsd: company004.networkContributionUsd,
  canonicalNetworkTvlUsd: publicState.totals.companyNetworkTvlUsd,
  historicalCostBasisUsd: canonical.costBasis.totalUsd,
  basisCoverage: `${canonical.costBasis.coveredPositionCount}/${canonical.costBasis.totalPositionCount}`,
  fundCompanyParity: true,
  incomeRollupHandledSeparately: true,
  executionAuthority: 'none'
});
