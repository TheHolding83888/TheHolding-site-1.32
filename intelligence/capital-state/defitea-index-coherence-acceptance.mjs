import fs from 'node:fs';

const publicState = JSON.parse(fs.readFileSync('intelligence/market-data/public-capital-state.json', 'utf8'));
const canonical = JSON.parse(fs.readFileSync('companies/defitea-canonical-state.json', 'utf8'));
const site = fs.readFileSync('companies/index.html', 'utf8');

function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}
function finite(value) {
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
requireCondition(fund && company004 && company001 && company002, 'Defitea or nested company public rows missing');

// One economic object, two public surfaces: the fund and registry #004 must show one identical consolidated TVL.
requireCondition(near(fund.tvlUsd, company004.tvlUsd), 'Defitea fund/company TVL parity drift');
requireCondition(fund.consolidation?.fundCompanyTvlParityRequired === true, 'Fund parity contract missing');
requireCondition(company004.consolidation?.fundCompanyTvlParityRequired === true, 'Company parity contract missing');
requireCondition(canonical.capitalAggregation?.economicIdentity === 'defitea-fund-equals-defitea-company', 'Canonical Defitea economic identity drift');
requireCondition(canonical.capitalAggregation?.fundCompanyTvlParityRequired === true, 'Canonical fund/company parity boundary missing');

// Consolidated display TVL = standalone parent capital + current capital of #001 and #002.
const nestedFromRows = finite(company001.tvlUsd) + finite(company002.tvlUsd);
requireCondition(near(fund.nestedCompanyCapitalUsd, nestedFromRows), 'Defitea nested capital does not equal #001 + #002 current TVL');
requireCondition(near(company004.nestedCompanyCapitalUsd, nestedFromRows), 'Registry #004 nested capital does not equal #001 + #002 current TVL');
requireCondition(near(fund.tvlUsd, finite(fund.standaloneTvlUsd) + nestedFromRows), 'Fund consolidated TVL arithmetic drift');
requireCondition(near(company004.tvlUsd, finite(company004.standaloneTvlUsd) + nestedFromRows), 'Company consolidated TVL arithmetic drift');
requireCondition(near(fund.consolidation?.consolidatedCapitalUsd, fund.tvlUsd), 'Fund consolidation output does not equal display TVL');
requireCondition(near(company004.consolidation?.consolidatedCapitalUsd, company004.tvlUsd), 'Company consolidation output does not equal display TVL');

const childMap = new Map((fund.consolidation?.children || []).map(row => [String(row.registry || '').padStart(3, '0'), row]));
requireCondition(near(childMap.get('001')?.capitalUsd, company001.tvlUsd), 'Defitea child #001 snapshot drift');
requireCondition(near(childMap.get('002')?.capitalUsd, company002.tvlUsd), 'Defitea child #002 snapshot drift');

// The nested capital is displayed in Defitea but is not re-added to the network/index contribution.
requireCondition(near(fund.networkContributionUsd, fund.standaloneTvlUsd), 'Defitea fund network contribution must equal standalone capital only');
requireCondition(near(company004.networkContributionUsd, company004.standaloneTvlUsd), 'Registry #004 network contribution must equal standalone capital only');
requireCondition(fund.consolidation?.childCapitalIncludedInDisplayTvl === true, 'Nested capital display inclusion boundary missing');
requireCondition(fund.consolidation?.childCapitalIncludedAgainInNetworkContribution === false, 'Nested capital network double-count guard missing');
requireCondition(publicState.semantics?.defiteaNestedCapitalNetworkDoubleCount === false, 'Public Capital nested double-count semantic drift');
requireCondition(canonical.capitalAggregation?.networkContributionMode === 'standalone-only-to-prevent-double-count', 'Canonical Defitea network contribution mode drift');

const networkContributionSum = companies.reduce((sum, row) => {
  const value = finite(row.networkContributionUsd);
  requireCondition(value !== null && value >= 0, `Invalid network contribution for registry ${row.registry}`);
  return sum + value;
}, 0);
requireCondition(near(networkContributionSum, publicState.totals?.companyNetworkTvlUsd), 'Company Network TVL is not the sum of unique company network contributions');
requireCondition(String(publicState.totals?.companyNetworkCountingPolicy || '').includes('does not re-add Registry #001/#002'), 'Network counting policy no longer documents Defitea nested deduplication');

// Capital aggregation must never become earned-income aggregation authority.
for (const row of [fund.consolidation, company004.consolidation]) {
  requireCondition(row?.childIncomeIncluded === false, 'Nested company factual income was included in Defitea');
  requireCondition(row?.incomeAggregationAuthority === false, 'Defitea gained nested-company income aggregation authority');
}
requireCondition(canonical.capitalAggregation?.incomeAggregationAuthority === false, 'Canonical Defitea income aggregation authority drift');
requireCondition(canonical.semantics?.nestedCompanyCapitalDoesNotImplyIncomeAuthority === true, 'Canonical capital-vs-income boundary missing');

// UNKNOWN != 0 and partial != total remain explicit even while current TVL is complete.
requireCondition(publicState.semantics?.unknownIsNotZero === true, 'UNKNOWN != 0 semantic missing');
requireCondition(publicState.semantics?.partialIsNotTotal === true, 'partial != total semantic missing');
requireCondition(canonical.semantics?.unknownCostBasisIsNotZero === true, 'Defitea UNKNOWN cost basis semantic missing');
requireCondition(canonical.semantics?.partialCostBasisIsNotTotal === true, 'Defitea partial cost basis semantic missing');
requireCondition(canonical.costBasis?.frax?.status === 'partial', 'Defitea FRAX partial cost-basis status was silently changed');
requireCondition(canonical.costBasis?.frax?.costBasisUsd === null, 'Defitea FRAX unknown added-lot cost basis must remain null');

// Public Companies surface must use consolidated display TVL but unique contribution for the Index/Network lens.
requireCondition(site.includes('const publicCompanyTvl = (key, fallback) =>'), 'Companies page public TVL binding missing');
requireCondition(site.includes('const publicCompanyNetworkContribution = (key, fallback) =>'), 'Companies page unique network-contribution binding missing');
requireCondition(site.includes('f.indexCapitalValue = publicCompanyNetworkContribution(key, v);'), 'Index capital value is not bound to unique network contribution');
requireCondition(site.includes('const canonicalNetworkTvl = Number(publicCapitalSnapshot?.totals?.companyNetworkTvlUsd);'), 'Companies page canonical Network TVL binding missing');
requireCondition(site.includes("key === '004'") && site.includes('consolidated-current-value-without-automatic-consolidated-cost-basis'), 'Defitea consolidated performance-basis guard missing from Companies page');

requireCondition(canonical.authority?.executionAuthority === 'none', 'Canonical Defitea execution authority expanded');
requireCondition(publicState.authority?.executionAuthority === 'none', 'Public Capital execution authority expanded');

console.log('PACKAGE 2 · Defitea TVL / Index coherence ACCEPTANCE PASS', {
  companyCount: companies.length,
  defiteaConsolidatedTvlUsd: fund.tvlUsd,
  defiteaStandaloneTvlUsd: fund.standaloneTvlUsd,
  nestedCompanyCapitalUsd: nestedFromRows,
  company001TvlUsd: company001.tvlUsd,
  company002TvlUsd: company002.tvlUsd,
  defiteaNetworkContributionUsd: company004.networkContributionUsd,
  canonicalNetworkTvlUsd: publicState.totals.companyNetworkTvlUsd,
  fundCompanyParity: true,
  nestedCapitalDoubleCount: false,
  nestedIncomeAggregationAuthority: false,
  executionAuthority: 'none'
});
