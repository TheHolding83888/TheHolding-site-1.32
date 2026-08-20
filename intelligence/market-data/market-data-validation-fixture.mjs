import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'market-price-registry.json'), 'utf8'));
const generatedAt = new Date().toISOString();
const prices = {};

for (const [index, asset] of (registry.assets || []).entries()) {
  const usd = Number((1 + (index + 1) / 1000).toFixed(6));
  prices[asset.assetId] = {
    assetId: asset.assetId,
    symbol: asset.symbol || null,
    providerId: asset.providerId,
    usd,
    status: 'validation-fixture',
    observedAt: generatedAt,
    source: 'deterministic-ci-fixture'
  };
}

const output = {
  version: '0.3-market-data-validation-fixture-source-lane-separated',
  engineVersion: '0.2-zero-external-request-ci-source-lane-mirror',
  generatedAt,
  requestedAt: null,
  observedAt: generatedAt,
  status: 'validation-fixture',
  validationFixture: true,
  semantics: {
    oneExternalRequestPerRefresh: true,
    externalRequestCount: 0,
    browserExternalPriceRequestsAllowed: false,
    unknownIsNotZero: true,
    wrapperNavAndProtocolValuationStayUpstream: true,
    productionPriceAuthority: false,
    dedicatedCoinGeckoSourceLane: true,
    canonicalMirrorEqualsCoinGeckoSourceLane: true,
    perAssetAuthoritySelectionApplied: false
  },
  provider: {
    id: 'validation-fixture',
    endpoint: null,
    credentialExposed: false,
    httpStatus: null,
    error: null
  },
  coverage: {
    requestedAssetCount: registry.assets.length,
    freshCount: 0,
    staleFallbackCount: 0,
    unknownCount: 0,
    validationFixtureCount: registry.assets.length,
    freshCoverage: 0,
    usableCoverage: 1
  },
  prices,
  authority: {
    productionPriceLane: 'coingecko-lane',
    onchainSelectedAssetCount: 0,
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false
  }
};

const bytes = JSON.stringify(output, null, 2) + '\n';
fs.writeFileSync(path.join(__dirname, 'market-data-coingecko.json'), bytes);
fs.writeFileSync(path.join(__dirname, 'market-data.json'), bytes);
console.log('Market Data validation source lane + canonical mirror written', {
  assetCount: registry.assets.length,
  externalRequestCount: 0,
  onchainSelectedAssetCount: 0
});
