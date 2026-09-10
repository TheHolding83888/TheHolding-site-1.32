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

// UNKNOWN != 0 and partial != total remain explicit while current TVL itself stays complete.
requireCondition(publicState.semantics?.unknownIsNotZero === true, 'UNKNOWN != 0 semantic missing');
requireCondition(publicState.semantics?.partialIsNotTotal === true, 'partial != total semantic missing');
requireCondition(canonical.semantics?.unknownCostBasisIsNotZero === true, 'Defitea UNKNOWN cost basis semantic missing');
requireCondition(canonical.semantics?.partialCostBasisIsNotTotal === true, 'Defitea partial cost basis semantic missing');
requireCondition(canonical.costBasis?.frax?.quantity === 4456, 'Defitea veFRAX current quantity drift');
requireCondition(canonical.costBasis?.frax?.status === 'partial', 'Defitea FRAX partial cost-basis status was silently changed');
requireCondition(canonical.costBasis?.frax?.costBasisUsd === null, 'Defitea FRAX unknown added-lot cost basis must remain null');

// Public Companies surface still consumes canonical TVL/network values; Defitea no longer needs a consolidated-performance suppression state.
requireCondition(site.includes('const publicCompanyTvl = (key, fallback) =>'), 'Companies page public TVL binding missing');
requireCondition(site.includes('const publicCompanyNetworkContribution = (key, fallback) =>'), 'Companies page unique network-contribution binding missing');
requireCondition(site.includes('f.indexCapitalValue = publicCompanyNetworkContribution(key, v);'), 'Index capital value is not bound to canonical company contribution');
requireCondition(site.includes('const canonicalNetworkTvl = Number(publicCapitalSnapshot?.totals?.companyNetworkTvlUsd);'), 'Companies page canonical Network TVL binding missing');

requireCondition(canonical.authority?.executionAuthority === 'none', 'Canonical Defitea execution authority expanded');
requireCondition(publicState.authority?.executionAuthority === 'none', 'Public Capital execution authority expanded');

console.log('Defitea own-capital TVL / Index coherence ACCEPTANCE PASS', {
  companyCount: companies.length,
  defiteaTvlUsd: fund.tvlUsd,
  company001TvlUsd: company001.tvlUsd,
  company002TvlUsd: company002.tvlUsd,
  relatedCompanyCapitalIncludedInDefitea: false,
  defiteaNetworkContributionUsd: company004.networkContributionUsd,
  canonicalNetworkTvlUsd: publicState.totals.companyNetworkTvlUsd,
  fundCompanyParity: true,
  incomeRollupHandledSeparately: true,
  executionAuthority: 'none'
});
