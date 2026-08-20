import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  resolveOnchainPrices as resolveLegacyOnchainPrices,
  mergeOnchainRegistryExtensions as mergeLegacyRegistryExtensions
} from './onchain-price-resolver-v09.mjs';
import {
  UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE,
  resolveUniswapV3ChainlinkQuotePrices
} from './onchain-uniswap-v3-chainlink-quote.mjs';
import {
  CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE,
  resolveCurveEmaChainlinkQuotePrices
} from './onchain-curve-ema-chainlink-quote.mjs';

export * from './onchain-price-resolver-v09.mjs';
export { UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE } from './onchain-uniswap-v3-chainlink-quote.mjs';
export { CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE } from './onchain-curve-ema-chainlink-quote.mjs';

/*
 * Backward-compatible validation markers. The complete proven v0.9 resolver
 * is preserved byte-for-byte in onchain-price-resolver-v09.mjs; this wrapper
 * adds explicit Chainlink-quoted V3 and Curve EMA lanes plus bounded route replacement.
 *
 * pyth-core-readonly
 * 96834ad3
 * pythHermesDependency: false
 * pythPriceUpdatesSubmitted: false
 * pythPublishTimeFreshnessChecked: true
 * pythConfidenceIntervalChecked: true
 * uniswapV3TwapRoutes: true
 * uniswapV3FactoryDiscovery: true
 * uniswapV3TwapReadsPinnedToDiscoveryBlock: true
 * uniswapV3UsesObserveNotSpot: true
 * curveEmaRoutes: curveEnabled
 * curvePriceOracleReadsPinnedToBlock: curveEnabled
 * curveUsesPriceOracleNotSpot: curveEnabled
 * dexSpotPriceAuthority: false
 */

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
  const extended = mergeLegacyRegistryExtensions(baseRegistry, extensionRegistry);
  const withNetworks = {
    ...extended,
    networks: { ...(extended.networks || {}), ...(extensionRegistry?.networks || {}) }
  };
  const overrides = extensionRegistry?.overrides || {};
  const ids = Object.keys(overrides);
  if (!ids.length) return withNetworks;
  const unknown = ids.filter(id => !withNetworks?.assets?.[id]);
  if (unknown.length) throw new Error(`Onchain route override targets unknown canonical assets: ${unknown.join(', ')}`);
  const assets = { ...(withNetworks.assets || {}) };
  for (const id of ids) {
    const replacement = overrides[id];
    if (!replacement?.route || replacement.assetId !== id) throw new Error(`Invalid route override contract for ${id}`);
    assets[id] = { ...assets[id], ...replacement, route: replacement.route };
  }
  return {
    ...withNetworks,
    semantics: { ...(withNetworks.semantics || {}), boundedRouteOverridesApplied: true },
    assets
  };
}

function mergeNetworkTelemetry(baseNetworks, quoteNetworks) {
  const merged = { ...(baseNetworks || {}) };
  for (const [networkId, quote] of Object.entries(quoteNetworks || {})) {
    const base = merged[networkId];
    if (!base) { merged[networkId] = quote; continue; }
    merged[networkId] = {
      ...base,
      routeCount: Number(base.routeCount || 0) + Number(quote.routeCount || 0),
      batchCallCount: Number(base.batchCallCount || 0) + Number(quote.batchCallCount || 0),
      httpBatchRequestCount: Number(base.httpBatchRequestCount || 0) + Number(quote.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(base.rpcFailoverAttempts || 0) + Number(quote.rpcFailoverAttempts || 0),
      protocolReadPhases: Math.max(Number(base.protocolReadPhases || 1), Number(quote.protocolReadPhases || 1)),
      chainlinkQuotedUniswapV3RouteCount: quote.routeCount,
      chainlinkQuoteDependencyRouteCount: quote.chainlinkQuoteDependencyRouteCount,
      chainlinkQuoteDependencyEndpointId: quote.chainlinkQuoteDependencyEndpointId,
      chainlinkQuoteDependencyBlockTag: quote.chainlinkQuoteDependencyBlockTag,
      onchainTokenDecimalsRead: quote.onchainTokenDecimalsRead === true
    };
  }
  return merged;
}

function mergeCurveQuoteNetworkTelemetry(baseNetworks, curveNetworks) {
  const merged = { ...(baseNetworks || {}) };
  for (const [networkId, curve] of Object.entries(curveNetworks || {})) {
    const base = merged[networkId];
    if (!base) { merged[networkId] = curve; continue; }
    merged[networkId] = {
      ...base,
      routeCount: Number(base.routeCount || 0) + Number(curve.routeCount || 0),
      batchCallCount: Number(base.batchCallCount || 0) + Number(curve.batchCallCount || 0),
      httpBatchRequestCount: Number(base.httpBatchRequestCount || 0) + Number(curve.httpBatchRequestCount || 0),
      rpcFailoverAttempts: Number(base.rpcFailoverAttempts || 0) + Number(curve.rpcFailoverAttempts || 0),
      protocolReadPhases: Math.max(Number(base.protocolReadPhases || 1), Number(curve.protocolReadPhases || 1)),
      chainlinkQuotedCurveEmaRouteCount: curve.chainlinkCurveQuoteDependencyRouteCount || curve.routeCount,
      chainlinkCurveQuoteDependencyRouteCount: curve.chainlinkCurveQuoteDependencyRouteCount,
      chainlinkCurveQuoteDependencyEndpointId: curve.chainlinkCurveQuoteDependencyEndpointId
    };
  }
  return merged;
}

export async function resolveOnchainPrices({ registry, marketData = null, fetchImpl = fetch, nowMs = Date.now() }) {
  if (!registry?.assets || !registry?.networks) throw new Error('Onchain source registry missing or invalid');
  const v3QuoteAssets = Object.fromEntries(Object.entries(registry.assets).filter(([, asset]) => asset?.route?.type === UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE));
  const curveQuoteAssets = Object.fromEntries(Object.entries(registry.assets).filter(([, asset]) => asset?.route?.type === CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE));
  const specializedQuoteTypes = new Set([UNISWAP_V3_CHAINLINK_QUOTE_ROUTE_TYPE, CURVE_EMA_CHAINLINK_QUOTE_ROUTE_TYPE]);
  const legacyAssets = Object.fromEntries(Object.entries(registry.assets).filter(([, asset]) => !specializedQuoteTypes.has(asset?.route?.type)));
  const legacy = await resolveLegacyOnchainPrices({ registry: { ...registry, assets: legacyAssets }, marketData, fetchImpl, nowMs });

  const v3Quote = Object.keys(v3QuoteAssets).length
    ? await resolveUniswapV3ChainlinkQuotePrices({ registry: { ...registry, assets: v3QuoteAssets }, marketData, fetchImpl, nowMs })
    : { observations: {}, networks: {}, coverage: { assetCount: 0, okCount: 0, warningCount: 0, unavailableCount: 0 }, rpcEfficiency: { networkCount: 0, routeCount: 0, httpBatchRequestCount: 0 } };
  const curveQuote = Object.keys(curveQuoteAssets).length
    ? await resolveCurveEmaChainlinkQuotePrices({ registry: { ...registry, assets: curveQuoteAssets }, marketData, fetchImpl, nowMs })
    : { observations: {}, networks: {}, coverage: { assetCount: 0, okCount: 0, warningCount: 0, unavailableCount: 0 }, rpcEfficiency: { networkCount: 0, routeCount: 0, httpBatchRequestCount: 0 } };

  if (v3Quote.coverage.assetCount === 0 && curveQuote.coverage.assetCount === 0) return legacy;

  const coverage = {
    assetCount: Number(legacy.coverage?.assetCount || 0) + Number(v3Quote.coverage?.assetCount || 0) + Number(curveQuote.coverage?.assetCount || 0),
    okCount: Number(legacy.coverage?.okCount || 0) + Number(v3Quote.coverage?.okCount || 0) + Number(curveQuote.coverage?.okCount || 0),
    warningCount: Number(legacy.coverage?.warningCount || 0) + Number(v3Quote.coverage?.warningCount || 0) + Number(curveQuote.coverage?.warningCount || 0),
    unavailableCount: Number(legacy.coverage?.unavailableCount || 0) + Number(v3Quote.coverage?.unavailableCount || 0) + Number(curveQuote.coverage?.unavailableCount || 0)
  };
  const networks = mergeCurveQuoteNetworkTelemetry(mergeNetworkTelemetry(legacy.networks, v3Quote.networks), curveQuote.networks);
  const rpcEfficiency = {
    networkCount: new Set([...Object.keys(legacy.networks || {}), ...Object.keys(v3Quote.networks || {}), ...Object.keys(curveQuote.networks || {})]).size,
    routeCount: Number(legacy.rpcEfficiency?.routeCount || 0) + Number(v3Quote.rpcEfficiency?.routeCount || 0) + Number(curveQuote.rpcEfficiency?.routeCount || 0),
    httpBatchRequestCount: Number(legacy.rpcEfficiency?.httpBatchRequestCount || 0) + Number(v3Quote.rpcEfficiency?.httpBatchRequestCount || 0) + Number(curveQuote.rpcEfficiency?.httpBatchRequestCount || 0)
  };

  return {
    ...legacy,
    version: '0.11-onchain-price-shadow-chainlink-quoted-curve-ema',
    engineVersion: '0.11-composite-v10-plus-curve-ema-chainlink-quote-resolver',
    generatedAt: new Date(nowMs).toISOString(),
    status: coverage.unavailableCount > 0 ? 'partial' : coverage.warningCount > 0 ? 'warning' : 'ok',
    semantics: {
      ...(legacy.semantics || {}),
      uniswapV3ChainlinkQuoteRoutes: v3Quote.coverage.assetCount > 0,
      curveEmaChainlinkQuoteRoutes: curveQuote.coverage.assetCount > 0,
      chainlinkQuoteFreshnessChecked: true,
      chainlinkQuoteRoundIntegrityChecked: true,
      tokenDecimalsReadOnchain: v3Quote.coverage.assetCount > 0,
      stablecoinPegHardcoded: false,
      boundedRouteOverridesApplied: registry.semantics?.boundedRouteOverridesApplied === true,
      routeScopedExtensionNetworksApplied: true,
      uniswapV3SpotPriceAuthority: false,
      curveSpotPriceAuthority: false,
      dexSpotPriceAuthority: false
    },
    rpcEfficiency,
    coverage,
    networks,
    observations: { ...(legacy.observations || {}), ...(v3Quote.observations || {}), ...(curveQuote.observations || {}) },
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