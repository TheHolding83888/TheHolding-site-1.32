import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const registry = JSON.parse(fs.readFileSync(path.join(__dirname, 'market-price-registry.json'), 'utf8'));
const generatedAt = new Date().toISOString();
const prices = {};

for (const [index, asset] of (registry.assets || []).entries()) {
  // Deterministic positive values keep valuation/weighting code exercised while
  // making CI independent of credentials, network price providers and market moves.
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
  version: '0.2-market-data-validation-fixture',
  engineVersion: '0.1-zero-external-request-ci-fixture',
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
    productionPriceAuthority: false
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
    readOnly: true,
    executionAuthority: 'none',
    capitalExecution: false,
    policyMutationAuthority: false
  }
};

fs.writeFileSync(path.join(__dirname, 'market-data.json'), JSON.stringify(output, null, 2) + '\n');
console.log('Market Data validation fixture written', {
  assetCount: registry.assets.length,
  externalRequestCount: 0
});
