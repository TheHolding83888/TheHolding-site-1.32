import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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

function localCoinGeckoResponse(input) {
  const raw = typeof input === 'string' || input instanceof URL ? input : input?.url;
  const url = new URL(raw);
  const requested = String(url.searchParams.get('ids') || '').split(',').map(x => x.trim()).filter(Boolean);
  const snapshot = readSnapshot();
  if (!snapshot?.prices) throw new Error('Market Data snapshot unavailable for CoinGecko compatibility shim');

  const body = {};
  for (const id of requested) {
    const row = snapshot.prices[id];
    const usd = Number(row?.usd);
    if (Number.isFinite(usd) && usd >= 0) body[id] = { usd };
  }

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-the-holding-market-data': 'shared-snapshot',
      'x-the-holding-external-request': '0'
    }
  });
}

globalThis.fetch = async function theHoldingSharedMarketFetch(input, init) {
  if (isCoinGeckoSimplePrice(input)) return localCoinGeckoResponse(input);
  return originalFetch(input, init);
};
