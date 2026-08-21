import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Legacy consumers may still request CoinGecko's simple-price shape, but the
// compatibility response must come from the canonical per-asset authority
// snapshot. The daily CoinGecko file is a fallback/sanity source lane only.
const SNAPSHOT = path.join(__dirname, 'market-data.json');
const originalFetch = globalThis.fetch.bind(globalThis);

function readSnapshot() {
  try { return JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')); }
  catch { return null; }
}

function isCoinGeckoSimplePrice(input) {
  try {
    const raw = typeof input === 'string' || input instanceof URL ? input : input?.url;
    const url = new URL(raw);
    return url.hostname === 'api.coingecko.com' && url.pathname === '/api/v3/simple/price';
  } catch { return false; }
}

function providerIndex(snapshot) {
  const index = new Map();
  for (const row of Object.values(snapshot?.prices || {})) {
    if (row?.providerId) index.set(String(row.providerId), row);
  }
  return index;
}

function localCoinGeckoResponse(input) {
  const raw = typeof input === 'string' || input instanceof URL ? input : input?.url;
  const url = new URL(raw);
  const requested = String(url.searchParams.get('ids') || '').split(',').map(x => x.trim()).filter(Boolean);
  const snapshot = readSnapshot();
  if (!snapshot?.prices) throw new Error('Canonical Market Data snapshot unavailable for compatibility shim');
  if (snapshot?.semantics?.perAssetAuthoritySelectionApplied !== true) {
    throw new Error('Compatibility shim refuses non-materialized Market Data');
  }

  const byProviderId = providerIndex(snapshot);
  const body = {};
  for (const id of requested) {
    const row = byProviderId.get(id);
    const usd = Number(row?.usd);
    if (Number.isFinite(usd) && usd >= 0) body[id] = { usd };
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-the-holding-market-data': 'canonical-per-asset-snapshot',
      'x-the-holding-external-request': '0'
    }
  });
}

globalThis.fetch = async function theHoldingSharedMarketFetch(input, init) {
  if (isCoinGeckoSimplePrice(input)) return localCoinGeckoResponse(input);
  return originalFetch(input, init);
};
