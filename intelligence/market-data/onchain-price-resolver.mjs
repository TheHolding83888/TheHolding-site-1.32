import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveOnchainPrices as resolveLegacyOnchainPrices } from './onchain-price-resolver-v08.mjs';
import {
  UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE,
  resolveUniswapV2HistoricalTwapPrices,
  UNISWAP_V2_HISTORICAL_TWAP_SELECTORS
} from './onchain-uniswap-v2-historical-twap.mjs';

export * from './onchain-price-resolver-v08.mjs';
export { UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE, UNISWAP_V2_HISTORICAL_TWAP_SELECTORS } from './onchain-uniswap-v2-historical-twap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_REGISTRY_PATH = path.join(__dirname, 'onchain-price-source-registry.json');
const EXTENSION_REGISTRY_PATH = path.join(__dirname, 'onchain-price-source-registry-extensions.json');
const MARKET_DATA_PATH = path.join(__dirname, 'market-data.json');
const OUTPUT_PATH = path.join(__dirname, 'onchain-price-shadow.json');

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}

export function mergeOnchainRegistryExtensions(baseRegistry, extensionRegistry) {
  if (!extensionRegistry) return baseRegistry;
  const extensionAssets = extensionRegistry.assets || {};
  const duplicateIds = Object.keys(extensionAssets).filter(id => baseRegistry?.assets?.[id]);
  if (duplicateIds.length) throw new Error(`Onchain extension duplicates canonical route ids: ${duplicateIds.join(', ')}`);
  return {
    ...baseRegistry,
    version: extensionRegistry.effectiveRegistryVersion || baseRegistry.version,
    semantics: { ...(baseRegistry.semantics || {}), ...(extensionRegistry.semantics || {}) },
    assets: { ...(baseRegistry.assets || {}), ...extensionAssets }
  };
}

function mergeV2NetworkTelemetry(baseNetworks, v2Networks) {
  const merged = { ...baseNetworks };
  for (const [networkId, v2] of Object.entries(v2Networks || {})) {
    const base = merged[networkId];
    if (!base) { merged[networkId] = v2; continue; }
    merged[networkId] = {
      ...base,
      routeCount: Number(base.routeCount || 0) + Number(v2.routeCount || 0),
      batchCallCount: Number(base.batchCallCount || 0) + Number(v2.batchCallCount || 0),
      httpBatchRequestCount: Number(base.httpBatchRequestCount || 0) + Number(v2.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(base.rpcFailoverAttempts || 0) + Number(v2.rpcFailoverAttempts || 0),
      protocolReadPhases: Math.max(Number(base.protocolReadPhases || 1), Number(v2.protocolReadPhases || 1)),
      uniswapV2HistoricalTwapRouteCount: v2.uniswapV2HistoricalTwapRouteCount,
      uniswapV2HistoricalTwapBatchCallCount: v2.uniswapV2HistoricalTwapBatchCallCount,
      uniswapV2BlockEndpointId: v2.uniswapV2BlockEndpointId,
      uniswapV2HistoricalTwapEndpointId: v2.uniswapV2HistoricalTwapEndpointId,
      uniswapV2CurrentBlockTag: v2.uniswapV2CurrentBlockTag,
      historicalStateReads: v2.historicalStateReads === true
    };
  }
  return merged;
}

export async function resolveOnchainPrices({ registry, marketData = null, fetchImpl = fetch, nowMs = Date.now() }) {
  if (!registry?.assets || !registry?.networks) throw new Error('Onchain source registry missing or invalid');
  const v2Assets = Object.fromEntries(Object.entries(registry.assets).filter(([, asset]) => asset?.route?.type === UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE));
  const legacyAssets = Object.fromEntries(Object.entries(registry.assets).filter(([, asset]) => asset?.route?.type !== UNISWAP_V2_HISTORICAL_TWAP_ROUTE_TYPE));
  const legacyRegistry = { ...registry, assets: legacyAssets };
  const legacy = await resolveLegacyOnchainPrices({ registry: legacyRegistry, marketData, fetchImpl, nowMs });

  if (Object.keys(v2Assets).length === 0) return legacy;

  const v2Registry = { ...registry, assets: v2Assets };
  const v2 = await resolveUniswapV2HistoricalTwapPrices({
    registry: v2Registry,
    marketData,
    coreObservations: legacy.observations,
    fetchImpl,
    nowMs
  });

  const coverage = {
    assetCount: Number(legacy.coverage?.assetCount || 0) + Number(v2.coverage?.assetCount || 0),
    okCount: Number(legacy.coverage?.okCount || 0) + Number(v2.coverage?.okCount || 0),
    warningCount: Number(legacy.coverage?.warningCount || 0) + Number(v2.coverage?.warningCount || 0),
    unavailableCount: Number(legacy.coverage?.unavailableCount || 0) + Number(v2.coverage?.unavailableCount || 0)
  };
  const networks = mergeV2NetworkTelemetry(legacy.networks, v2.networks);
  const rpcEfficiency = {
    networkCount: new Set([...Object.keys(legacy.networks || {}), ...Object.keys(v2.networks || {})]).size,
    routeCount: Number(legacy.rpcEfficiency?.routeCount || 0) + Number(v2.rpcEfficiency?.routeCount || 0),
    httpBatchRequestCount: Number(legacy.rpcEfficiency?.httpBatchRequestCount || 0) + Number(v2.rpcEfficiency?.httpBatchRequestCount || 0)
  };

  return {
    ...legacy,
    version: '0.9-onchain-price-shadow-uniswap-v2-historical-twap',
    engineVersion: '0.9-composite-v08-plus-uniswap-v2-historical-twap-resolver',
    generatedAt: new Date(nowMs).toISOString(),
    status: coverage.unavailableCount > 0 ? 'partial' : coverage.warningCount > 0 ? 'warning' : 'ok',
    semantics: {
      ...(legacy.semantics || {}),
      uniswapV2HistoricalTwapRoutes: true,
      uniswapV2HistoricalStateReads: true,
      uniswapV2ExternalUpdaterDependency: false,
      uniswapV2SpotPriceAuthority: false,
      dexSpotPriceAuthority: false
    },
    rpcEfficiency,
    coverage,
    networks,
    observations: { ...(legacy.observations || {}), ...(v2.observations || {}) },
    authority: { readOnly: true, executionAuthority: 'none', capitalExecution: false, policyMutationAuthority: false }
  };
}

export async function runCli() {
  const baseRegistry = readJson(BASE_REGISTRY_PATH);
  if (!baseRegistry) throw new Error('Onchain price source registry not found');
  const extensionRegistry = readJson(EXTENSION_REGISTRY_PATH, null);
  const registry = mergeOnchainRegistryExtensions(baseRegistry, extensionRegistry);
  const marketData = readJson(MARKET_DATA_PATH, null);
  const output = await resolveOnchainPrices({ registry, marketData });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log('Onchain price shadow written', {
    status: output.status,
    coverage: output.coverage,
    rpcEfficiency: output.rpcEfficiency,
    productionPriceAuthority: false,
    extensionRegistryVersion: extensionRegistry?.version || null
  });
  if (output.coverage.okCount === 0) throw new Error('No healthy onchain shadow observations');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runCli();
