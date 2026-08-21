import fs from 'node:fs';
import { selectMarketDataAuthority } from './market-data-authority-selector.mjs';

const materializer = fs.readFileSync(new URL('./market-data-authority-materializer.mjs', import.meta.url), 'utf8');
const policy = JSON.parse(fs.readFileSync(new URL('./market-data-authority-policy.json', import.meta.url), 'utf8'));
const source = JSON.parse(fs.readFileSync(new URL('./market-data-coingecko.json', import.meta.url), 'utf8'));
const shadow = JSON.parse(fs.readFileSync(new URL('./onchain-price-shadow.json', import.meta.url), 'utf8'));

if (materializer.includes('assertEqual(observation.dependencyStatus, req.dependencyStatus')) {
  throw new Error('Materializer must not enforce runtime dependencyStatus as static route identity');
}
if (!materializer.includes('dependencyStatus is runtime health, not immutable route identity')) {
  throw new Error('Materializer health-boundary contract marker missing');
}

const nowMs = Date.parse(shadow.generatedAt);
if (!Number.isFinite(nowMs)) throw new Error('Shadow generatedAt invalid');

const divergent = structuredClone(shadow);
divergent.observations['convex-finance'] = {
  ...divergent.observations['convex-finance'],
  status: 'dependency-warning',
  dependencyStatus: 'divergent',
  usd: Number(source.prices['convex-finance']?.usd) * 1.08
};
const divergenceSelection = selectMarketDataAuthority({
  policy,
  marketData: source,
  shadow: divergent,
  assetId: 'convex-finance',
  nowMs
});
if (divergenceSelection.selectedLane !== 'onchain-shadow' || divergenceSelection.fallbackUsed) {
  throw new Error('Healthy dependency divergence must remain onchain authority');
}

const failed = structuredClone(shadow);
failed.observations['convex-finance'] = {
  ...failed.observations['convex-finance'],
  status: 'dependency-warning',
  dependencyStatus: 'rpc-unavailable',
  usd: null
};
const failedSelection = selectMarketDataAuthority({
  policy,
  marketData: source,
  shadow: failed,
  assetId: 'convex-finance',
  nowMs
});
if (failedSelection.selectedLane !== 'coingecko-lane' || failedSelection.fallbackUsed !== true) {
  throw new Error('Real dependency failure must perform bounded CoinGecko failback');
}

console.log('Market Data materializer health-boundary validation PASS', {
  divergenceTelemetryKeepsOnchain: true,
  realDependencyFailureFailsBackPerAsset: true,
  materializerDoesNotPreemptSelectorHealthDecision: true,
  executionAuthority: 'none'
});
