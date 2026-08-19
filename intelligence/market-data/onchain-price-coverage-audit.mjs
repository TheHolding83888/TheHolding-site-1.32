import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function buildCoverageAudit({ marketRegistry, onchainRegistry, fundRegistry, publicCapital }) {
  const marketAssets = Array.isArray(marketRegistry?.assets) ? marketRegistry.assets : [];
  const marketIds = marketAssets.map(x => x.assetId).filter(Boolean);
  const marketSet = new Set(marketIds);
  if (marketSet.size !== marketIds.length) throw new Error('Duplicate assetId in canonical Market Data registry');

  const routeIds = Object.keys(onchainRegistry?.assets || {});
  const marketRouted = marketIds.filter(id => routeIds.includes(id));
  const pendingMarket = marketIds.filter(id => !routeIds.includes(id));
  const nonMarketRoutes = routeIds.filter(id => !marketSet.has(id));

  const allowedNonMarketRoutes = new Set(['physical-silver']);
  const unexpectedNonMarketRoutes = nonMarketRoutes.filter(id => !allowedNonMarketRoutes.has(id));
  if (unexpectedNonMarketRoutes.length) {
    throw new Error(`Unexpected onchain routes outside canonical market universe: ${unexpectedNonMarketRoutes.join(', ')}`);
  }

  const fundMarketIds = [];
  let physicalSilverDeclared = false;
  for (const fund of Object.values(fundRegistry?.funds || {})) {
    for (const position of fund?.positions || []) {
      if (position?.pricing === 'market') fundMarketIds.push(position.assetId);
      if (position?.assetId === 'physical-silver') physicalSilverDeclared = true;
    }
  }
  for (const id of fundMarketIds) {
    if (!marketSet.has(id)) throw new Error(`Fund market position missing from canonical Market Data registry: ${id}`);
  }
  if (physicalSilverDeclared && !routeIds.includes('physical-silver')) {
    throw new Error('Physical silver is held by a fund but has no onchain/reference route');
  }

  const companySharedMarketIds = [];
  for (const company of publicCapital?.companies || []) {
    for (const position of company?.positions || []) {
      if (position?.valuationSource === 'shared-market-data' && position?.assetId) {
        companySharedMarketIds.push(position.assetId);
        if (!marketSet.has(position.assetId)) {
          throw new Error(`Company shared-market-data position missing from canonical Market Data registry: ${position.assetId}`);
        }
      }
    }
  }

  const specialRoutes = nonMarketRoutes.filter(id => allowedNonMarketRoutes.has(id));
  const totalLiveObservationTargets = marketRouted.length + specialRoutes.length;

  return {
    version: '0.1-onchain-price-coverage-audit',
    canonicalMarketAssetCount: marketIds.length,
    routedMarketAssetCount: marketRouted.length,
    pendingMarketAssetCount: pendingMarket.length,
    routedMarketAssets: marketRouted,
    pendingMarketAssets: pendingMarket,
    specialOnchainReferenceCount: specialRoutes.length,
    specialOnchainReferences: specialRoutes,
    totalLiveObservationTargets,
    fundMarketAssets: [...new Set(fundMarketIds)],
    companySharedMarketAssets: [...new Set(companySharedMarketIds)],
    semantics: {
      oneCanonicalMarketUniverse: true,
      fundsAndCompaniesReuseSameMarketAssetIds: true,
      protocolNavRemainsUpstream: true,
      pendingDoesNotMeanZero: true,
      executionAuthority: 'none'
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = buildCoverageAudit({
    marketRegistry: readJson(path.join(__dirname, 'market-price-registry.json')),
    onchainRegistry: readJson(path.join(__dirname, 'onchain-price-source-registry.json')),
    fundRegistry: readJson(path.join(__dirname, 'fund-capital-registry.json')),
    publicCapital: readJson(path.join(__dirname, 'public-capital-state.json'))
  });
  console.log(JSON.stringify(report, null, 2));
  if (report.canonicalMarketAssetCount !== 26) {
    console.warn(`Canonical market universe changed from current 26-asset baseline to ${report.canonicalMarketAssetCount}; review new assets before promotion.`);
  }
}
