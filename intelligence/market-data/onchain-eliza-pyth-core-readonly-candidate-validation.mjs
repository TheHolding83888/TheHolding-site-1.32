import fs from 'node:fs';
import { encodePythGetPriceUnsafe, decodePythPrice } from './onchain-price-resolver-v08.mjs';

const registry = JSON.parse(fs.readFileSync('intelligence/market-data/onchain-price-source-registry.json', 'utf8'));
const marketData = JSON.parse(fs.readFileSync('intelligence/market-data/market-data.json', 'utf8'));
const network = registry.networks?.bsc;
if (!network) throw new Error('BSC network missing');

const HERMES = 'https://hermes.pyth.network/v2/price_feeds';
const PYTH_CORE = '0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594';
const MAX_AGE_SECONDS = 7200;
const MAX_CONFIDENCE_PCT = 5;
const MAX_DIVERGENCE_PCT = 10;
const canonicalUsd = Number(marketData.prices?.elizaos?.usd);
if (!(canonicalUsd > 0)) throw new Error('Canonical ELIZA CoinGecko price missing');

function objectText(value) {
  try { return JSON.stringify(value).toLowerCase(); } catch { return ''; }
}
function normalizedId(value) {
  const clean = String(value || '').replace(/^0x/, '').toLowerCase();
  return /^[0-9a-f]{64}$/.test(clean) ? `0x${clean}` : null;
}
function collectObjects(value, out = []) {
  if (Array.isArray(value)) for (const item of value) collectObjects(item, out);
  else if (value && typeof value === 'object') {
    out.push(value);
    for (const child of Object.values(value)) if (child && typeof child === 'object') collectObjects(child, out);
  }
  return out;
}
function findIdsInObject(obj) {
  const ids = new Set();
  for (const [key, value] of Object.entries(obj || {})) {
    if (/^(id|price_id|priceId|price_feed_id|priceFeedId)$/i.test(key)) {
      const id = normalizedId(value);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}
async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error(`Hermes HTTP ${response.status}`);
  return response.json();
}
async function discoverFeedIds() {
  const queries = ['ELIZAOS', 'ELIZAOS/USD', 'Crypto.ELIZAOS/USD'];
  const evidence = [];
  const ids = new Set();
  for (const query of queries) {
    const url = `${HERMES}?query=${encodeURIComponent(query)}`;
    const json = await fetchJson(url);
    const objects = collectObjects(json);
    const matches = objects.filter(obj => {
      const text = objectText(obj);
      return text.includes('elizaos') && (text.includes('usd') || text.includes('crypto'));
    });
    const queryIds = new Set();
    for (const match of matches) for (const id of findIdsInObject(match)) { ids.add(id); queryIds.add(id); }
    evidence.push({ query, resultObjectCount: objects.length, matchingObjectCount: matches.length, ids: [...queryIds] });
  }
  return { ids: [...ids], evidence };
}
async function rpcCall(endpoint, priceId) {
  const payload = {
    jsonrpc: '2.0', id: 1, method: 'eth_call',
    params: [{ to: PYTH_CORE, data: encodePythGetPriceUnsafe(priceId) }, 'latest']
  };
  const response = await fetch(endpoint.url, {
    method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body?.error) throw new Error(body.error.message || JSON.stringify(body.error));
  if (!body?.result || body.result === '0x') throw new Error('Pyth Core result missing');
  return body.result;
}
function divergencePct(a, b) { return Math.abs(a - b) / b * 100; }

const discovery = await discoverFeedIds();
console.log('ELIZAOS/USD Hermes metadata discovery (catalog only; not a pricing source)');
console.log(JSON.stringify(discovery, null, 2));
if (!discovery.ids.length) throw new Error('Hermes catalog returned no exact ELIZAOS/USD candidate price id');

const now = Math.floor(Date.now() / 1000);
const candidates = [];
for (const priceId of discovery.ids) {
  const endpointResults = [];
  for (const endpoint of network.rpcFailover || []) {
    try {
      const raw = await rpcCall(endpoint, priceId);
      const price = decodePythPrice(raw);
      const feedAgeSeconds = Math.max(0, now - price.publishTime);
      const diffPct = price.usd > 0 ? divergencePct(price.usd, canonicalUsd) : null;
      const healthy = price.usd > 0 && feedAgeSeconds <= MAX_AGE_SECONDS && Number(price.confidencePct) <= MAX_CONFIDENCE_PCT && diffPct <= MAX_DIVERGENCE_PCT;
      endpointResults.push({
        endpointId: endpoint.id, ok: true, usd: price.usd, publishTime: price.publishTime,
        feedUpdatedAt: price.publishTime > 0 ? new Date(price.publishTime * 1000).toISOString() : null,
        feedAgeSeconds, confidencePct: price.confidencePct, divergencePct: diffPct, healthy
      });
    } catch (error) {
      endpointResults.push({ endpointId: endpoint.id, ok: false, error: error instanceof Error ? error.message : String(error), healthy: false });
    }
  }
  candidates.push({ priceId, endpointResults });
}

console.log('ELIZAOS/USD BSC Pyth Core stored-state LIVE probe');
console.log(JSON.stringify({
  pythCore: PYTH_CORE,
  canonicalUsd,
  maxAgeSeconds: MAX_AGE_SECONDS,
  maxConfidencePct: MAX_CONFIDENCE_PCT,
  maxDivergencePct: MAX_DIVERGENCE_PCT,
  hermesUsedForMetadataOnly: true,
  hermesPriceUpdateDataUsed: false,
  pythUpdateTransactionSubmitted: false,
  candidates
}, null, 2));

const healthy = candidates.flatMap(candidate => candidate.endpointResults
  .filter(row => row.healthy)
  .map(row => ({ priceId: candidate.priceId, ...row })));
if (!healthy.length) throw new Error('No fresh read-only ELIZAOS/USD stored Pyth Core state on configured BSC public RPC');
healthy.sort((a, b) => a.feedAgeSeconds - b.feedAgeSeconds || a.divergencePct - b.divergencePct);
console.log('BEST_ELIZA_PYTH_CORE_CANDIDATE=' + JSON.stringify(healthy[0]));
