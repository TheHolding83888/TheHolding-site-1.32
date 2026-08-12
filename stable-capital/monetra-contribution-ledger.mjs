#!/usr/bin/env node
/**
 * THE HOLDING · MONETRA CONTRIBUTION LEDGER v0.1
 *
 * One-time historical boundary-flow backfill for Registry #008 / Monetra.eth.
 *
 * Goal:
 *   Reconstruct what capital crossed INTO or OUT OF the company from founding,
 *   without mistaking internal DeFi operations for owner contributions/withdrawals.
 *
 * Output:
 *   /companies/company-008-contribution-ledger.json
 *
 * Accounting boundary:
 *   - contribution = external capital crossing into the Monetra company boundary;
 *   - distribution/withdrawal = capital crossing out of the company boundary;
 *   - protocol deposit, vault mint, wrapper conversion, swap and strategy rotation = internal;
 *   - matched cross-chain bridge movement = internal;
 *   - gas/native funding is diagnostic only and is NOT Stable Capital Invested;
 *   - current APY is NEVER used to reconstruct historical performance.
 *
 * Fail-closed:
 *   If an external flow cannot be valued or classified reproducibly, it goes to
 *   reviewQueue and invested/performance stay null.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Contract,
  JsonRpcProvider,
  id,
  zeroPadValue,
  getAddress,
  formatUnits
} from 'ethers';

const VERSION = '0.2-monetra-contribution-ledger-targeted-close';
const METHODOLOGY = '0.2-boundary-flow-targeted-close-net-invested';
const ROOT = path.resolve(process.cwd());

const RESOLVER_FILE =
  process.env.MONETRA_RESOLVER_FILE ||
  path.join(ROOT, 'companies', 'company-008-resolve.json');

const STABLE_FILE =
  process.env.STABLE_CAPITAL_DATA_FILE ||
  path.join(ROOT, 'companies', 'stable-capital-data.json');

const OUT_FILE =
  process.env.MONETRA_CONTRIBUTION_LEDGER_FILE ||
  path.join(ROOT, 'companies', 'company-008-contribution-ledger.json');

const WALLET = addr('0x888d39aee2aec979c81f125ea94bb3ceb60f6bbb');
const ZERO = '0x0000000000000000000000000000000000000000';
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');

const CHAINS = Object.freeze({
  ethereum: {
    label: 'Ethereum',
    chainId: 1,
    explorer: 'https://eth.blockscout.com',
    txBase: 'https://eth.blockscout.com/tx/',
    rpcs: uniq([
      process.env.ETH_RPC_URL,
      process.env.ETH_RPC_URL_2,
      'https://ethereum-rpc.publicnode.com',
      'https://eth.llamarpc.com',
      'https://eth.blockscout.com/api/eth-rpc'
    ])
  },
  base: {
    label: 'Base',
    chainId: 8453,
    explorer: 'https://base.blockscout.com',
    txBase: 'https://base.blockscout.com/tx/',
    rpcs: uniq([
      process.env.BASE_RPC_URL,
      process.env.BASE_RPC_URL_2,
      'https://base-rpc.publicnode.com',
      'https://mainnet.base.org'
    ])
  },
  fraxtal: {
    label: 'Fraxtal',
    chainId: 252,
    explorer: 'https://explorer.mainnet.frax.com',
    txBase: 'https://explorer.mainnet.frax.com/tx/',
    rpcs: uniq([
      process.env.FRAXTAL_RPC_URL,
      process.env.FRAXTAL_RPC_URL_2,
      'https://fraxtal.gateway.tenderly.co',
      'https://rpc.frax.com'
    ])
  }
});

// Base stable units that can be valued as nominal Stable Capital principal.
// Yield-bearing wrappers are intentionally NOT in this list.
const NOMINAL_STABLE_SYMBOLS = new Set([
  'USDC', 'USDBC', 'USDC.E', 'USDT', 'DAI', 'CRVUSD', 'FXUSD',
  'DOLA', 'USDS', 'GHO', 'BOLD', 'FRXUSD', 'LUSD', 'PYUSD', 'GUSD'
]);

const MAX_EXPLORER_PAGES = 120;
const MAX_RPC_LOG_ADDRESSES_PER_CHAIN = 40;
const BRIDGE_WINDOW_MS = 6 * 60 * 60 * 1000;
const BRIDGE_AMOUNT_TOLERANCE = 0.02; // 2%
const MIN_MEANINGFUL_STABLE = 0.000001;

// Bounded spam/address-poisoning tokens observed in the fresh v0.1 diagnostic.
// These are explicitly outside the Stable Capital book and are never Invested.
const IGNORE_TOKEN_ADDRESSES = new Set([
  '0x9a508f4ad6d667892aed6cb53c6a32a85823dfd5', // fake "Token"
  '0x53fdca91fd33b9131b5ceade42a3edbd9b38edff', // CAT
  '0x60e2d3aad146f978dc0b103a2d29229560c1c02d', // ARB | t.me/s/arb_pool
  '0x3b91dd79102dcc37e565c8e94b0bb36438198e91', // ARB | t.me/s/arb_pool
  '0xf82d598ce6fce9f2d46f046fc46653e3284040aa', // DOG
  '0xf0a15e9082df01936d335a7a8557a4f694f94f65', // lookalike ÚЅDТ, NOT canonical USDT
  '0x27d24125c875516a8981d853fe8058ce08f84a81', // DRC
  '0x58bdc4310db1b19854ca9066deed7e3df4f2ec9b', // lookalike EṬH
  '0x486f662020286e17e7469df4e5f2cf2415f36662'  // AI
]);

// Bridge/router identities independently verified after v0.1:
// - Squid Multicall: 0xaD6C...
// - Across Ethereum Spoke Pool V2: 0x5c7B...
// - Across Multicall Handler: 0x0F7A...
const KNOWN_BRIDGE_ENDPOINTS = new Set([
  '0xad6cea45f98444a922a2b4fe96b8c90f0862d2f4',
  '0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5',
  '0x0f7ae28de1c8532170ad4ee566b5801485c13a0e'
]);

const EXTERNAL_ROUTE_SWAP_WINDOW_MS = 10 * 60 * 1000;

function addr(x) {
  try { return getAddress(String(x).toLowerCase()); }
  catch { return null; }
}

function lower(x) { return String(x || '').toLowerCase(); }
function uniq(xs) { return [...new Set((xs || []).filter(Boolean))]; }
function nowIso() { return new Date().toISOString(); }
function round(x, d = 8) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function finite(x) { return Number.isFinite(Number(x)); }
function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function sha256(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}
function errorText(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error').slice(0, 1800);
}
function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function symbolKey(symbol) {
  return String(symbol || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/^CRVUSD$/, 'CRVUSD');
}
function isNominalStable(symbol) {
  return NOMINAL_STABLE_SYMBOLS.has(symbolKey(symbol));
}
function topicAddress(address) {
  return zeroPadValue(address, 32);
}

async function fetchJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: {
        'accept': 'application/json',
        'user-agent': 'The-Holding-Monetra-Contribution-Ledger/0.1'
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    const text = await r.text();
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

function collectAddresses(value, out = new Set()) {
  if (Array.isArray(value)) {
    for (const x of value) collectAddresses(x, out);
    return out;
  }
  if (!value || typeof value !== 'object') return out;
  for (const v of Object.values(value)) {
    if (typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v)) {
      const a = addr(v);
      if (a) out.add(a);
    } else if (v && typeof v === 'object') {
      collectAddresses(v, out);
    }
  }
  return out;
}

function positionChainKey(position) {
  const c = lower(position?.chain);
  if (c.includes('base')) return 'base';
  if (c.includes('fraxtal')) return 'fraxtal';
  return 'ethereum';
}

function collectBookAddressesByChain(resolver) {
  const out = { ethereum: new Set(), base: new Set(), fraxtal: new Set() };
  for (const p of resolver?.stableCapital?.positions || []) {
    const key = positionChainKey(p);
    collectAddresses(p, out[key]);
  }

  // Some mechanism contracts live in resolver diagnostics instead of the normalized
  // position row (e.g. Liquity StabilityPool, Lido oracle/vault).
  const allStableResolverAddresses = collectAddresses({
    stableCapital: resolver?.stableCapital,
    resolutionV13: resolver?.resolutionV13,
    resolutionV14: resolver?.resolutionV14,
    resolution: resolver?.resolution
  });
  // Diagnostic addresses without explicit chain are primarily Ethereum for Monetra.
  for (const a of allStableResolverAddresses) {
    if (![...out.base].some(x => lower(x) === lower(a)) &&
        ![...out.fraxtal].some(x => lower(x) === lower(a))) {
      out.ethereum.add(a);
    }
  }

  for (const key of Object.keys(out)) {
    out[key].delete(WALLET);
    out[key].delete(addr(ZERO));
  }
  return out;
}

function tokenTransferAddress(item) {
  return addr(
    item?.token?.address ||
    item?.token?.address_hash ||
    item?.token?.token_address ||
    item?.address_hash ||
    item?.token_address
  );
}

function objectAddress(x) {
  return addr(x?.hash || x?.address || x);
}

function transferTimestamp(item) {
  const raw = item?.timestamp || item?.block_timestamp || item?.timeStamp || item?.time;
  if (!raw) return null;
  const d = new Date(/^\d+$/.test(String(raw)) ? Number(raw) * 1000 : raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function tokenDecimals(item) {
  const d = item?.token?.decimals ?? item?.total?.decimals ?? item?.decimals;
  const n = Number(d);
  return Number.isInteger(n) && n >= 0 && n <= 36 ? n : 18;
}

function tokenSymbol(item) {
  return item?.token?.symbol || item?.symbol || null;
}

function transferRawValue(item) {
  return (
    item?.total?.value ??
    item?.value ??
    item?.amount ??
    item?.token?.value ??
    null
  );
}

function parseAmount(raw, decimals) {
  if (raw == null) return null;
  const s = String(raw);
  if (/^-?\d+$/.test(s)) {
    try { return Number(formatUnits(BigInt(s), decimals)); }
    catch { return null; }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function transferCounterpartyMeta(item, direction) {
  const obj = direction === 'in' ? item?.from : item?.to;
  return {
    address: objectAddress(obj),
    isContract:
      typeof obj?.is_contract === 'boolean'
        ? obj.is_contract
        : typeof obj?.isContract === 'boolean'
          ? obj.isContract
          : null,
    name: obj?.name || obj?.metadata?.name || null
  };
}

function normalizeExplorerTransfer(item, chainKey) {
  const from = objectAddress(item?.from);
  const to = objectAddress(item?.to);
  if (!from || !to) return null;
  const walletLower = lower(WALLET);
  let direction = null;
  if (lower(to) === walletLower && lower(from) !== walletLower) direction = 'in';
  if (lower(from) === walletLower && lower(to) !== walletLower) direction = 'out';
  if (!direction) return null;

  const token = tokenTransferAddress(item);
  if (!token) return null;
  const decimals = tokenDecimals(item);
  const amount = parseAmount(transferRawValue(item), decimals);
  const timestamp = transferTimestamp(item);
  const counterparty = transferCounterpartyMeta(item, direction);
  const txHash = item?.tx_hash || item?.transaction_hash || item?.hash || null;
  const logIndex = safeNum(item?.log_index ?? item?.index);

  return {
    source: 'blockscout-v2',
    chain: chainKey,
    chainLabel: CHAINS[chainKey].label,
    txHash,
    blockNumber: safeNum(item?.block_number),
    logIndex,
    timestamp,
    direction,
    token,
    symbol: tokenSymbol(item),
    decimals,
    amount: finite(amount) ? amount : null,
    counterparty: counterparty.address,
    counterpartyIsContract: counterparty.isContract,
    counterpartyName: counterparty.name,
    tokenType: item?.token?.type || item?.type || null,
    explorerUrl: txHash ? CHAINS[chainKey].txBase + txHash : null
  };
}

function nextPageUrl(baseUrl, nextParams) {
  if (!nextParams || typeof nextParams !== 'object') return null;
  const u = new URL(baseUrl);
  for (const [k, v] of Object.entries(nextParams)) {
    if (v === null || v === undefined || v === '') continue;
    u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function fetchBlockscoutTransfers(chainKey, foundedMs) {
  const cfg = CHAINS[chainKey];
  const baseUrl = `${cfg.explorer}/api/v2/addresses/${WALLET}/token-transfers`;
  let url = baseUrl;
  const rows = [];
  const errors = [];
  let pages = 0;
  let reachedPreFounding = false;

  while (url && pages < MAX_EXPLORER_PAGES) {
    try {
      const j = await fetchJson(url);
      pages += 1;
      const items = Array.isArray(j?.items) ? j.items : [];
      if (!items.length) break;

      let pageHasPostFounding = false;
      let pageHasPreFounding = false;

      for (const item of items) {
        const row = normalizeExplorerTransfer(item, chainKey);
        if (!row || !row.timestamp) continue;
        const ms = new Date(row.timestamp).getTime();
        if (ms >= foundedMs) {
          pageHasPostFounding = true;
          rows.push(row);
        } else {
          pageHasPreFounding = true;
        }
      }

      // Blockscout normally returns newest first. Once a page contains only
      // pre-founding events we can stop.
      if (pageHasPreFounding && !pageHasPostFounding) {
        reachedPreFounding = true;
        break;
      }
      url = nextPageUrl(baseUrl, j?.next_page_params);
    } catch (e) {
      errors.push(errorText(e));
      break;
    }
  }

  return {
    ok: rows.length > 0 || errors.length === 0,
    rows,
    pages,
    reachedPreFounding,
    errors
  };
}

async function withProvider(chainKey, fn) {
  const cfg = CHAINS[chainKey];
  const attempts = [];
  for (const url of cfg.rpcs) {
    let provider;
    try {
      provider = new JsonRpcProvider(url, cfg.chainId, { staticNetwork: true });
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== cfg.chainId) throw new Error(`wrong chain ${net.chainId}`);
      const value = await fn(provider, url);
      try { provider.destroy?.(); } catch {}
      return { ok: true, value, providerUrl: url, attempts };
    } catch (e) {
      attempts.push({ url, error: errorText(e) });
      try { provider?.destroy?.(); } catch {}
    }
  }
  return { ok: false, attempts, error: 'all providers failed' };
}

async function findBlockAtOrBefore(provider, targetTs) {
  const latest = await provider.getBlock('latest');
  if (!latest) throw new Error('latest block unavailable');
  if (Number(latest.timestamp) <= targetTs) return latest;

  let low = 0;
  let high = Number(latest.number);
  let best = 0;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    if (!block) { high = mid - 1; continue; }
    const ts = Number(block.timestamp);
    if (ts <= targetTs) {
      best = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  const out = await provider.getBlock(best);
  if (!out) throw new Error(`historical block ${best} unavailable`);
  return out;
}

async function getLogsAdaptive(provider, filter, fromBlock, toBlock, depth = 0) {
  try {
    return await provider.getLogs({ ...filter, fromBlock, toBlock });
  } catch (e) {
    if (fromBlock >= toBlock || depth >= 12) throw e;
    const mid = Math.floor((fromBlock + toBlock) / 2);
    const a = await getLogsAdaptive(provider, filter, fromBlock, mid, depth + 1);
    const b = await getLogsAdaptive(provider, filter, mid + 1, toBlock, depth + 1);
    return [...a, ...b];
  }
}

async function tokenMeta(provider, token, cache) {
  const key = lower(token);
  if (cache.has(key)) return cache.get(key);
  const c = new Contract(token, [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ], provider);
  let decimals = 18, symbol = null;
  try { decimals = Number(await c.decimals()); } catch {}
  try { symbol = await c.symbol(); } catch {}
  const meta = { decimals, symbol };
  cache.set(key, meta);
  return meta;
}

async function fetchRpcKnownTransfers(chainKey, foundedTs, addresses) {
  const limited = [...addresses].slice(0, MAX_RPC_LOG_ADDRESSES_PER_CHAIN);
  const res = await withProvider(chainKey, async (provider, url) => {
    const startBlockObj = await findBlockAtOrBefore(provider, foundedTs);
    const latest = await provider.getBlock('latest');
    if (!latest) throw new Error('latest block unavailable');
    const fromBlock = Number(startBlockObj.number);
    const toBlock = Number(latest.number);
    const walletTopic = topicAddress(WALLET);
    const metaCache = new Map();
    const seen = new Set();
    const rows = [];
    const addressErrors = [];

    for (const token of limited) {
      try {
        const filters = [
          { address: token, topics: [TRANSFER_TOPIC, walletTopic] },        // from wallet
          { address: token, topics: [TRANSFER_TOPIC, null, walletTopic] }  // to wallet
        ];
        for (const filter of filters) {
          const logs = await getLogsAdaptive(provider, filter, fromBlock, toBlock);
          for (const log of logs) {
            const dedupe = `${lower(log.transactionHash)}:${Number(log.index ?? log.logIndex ?? 0)}`;
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);

            const from = addr('0x' + String(log.topics?.[1] || '').slice(-40));
            const to = addr('0x' + String(log.topics?.[2] || '').slice(-40));
            if (!from || !to) continue;
            const direction =
              lower(to) === lower(WALLET) && lower(from) !== lower(WALLET) ? 'in' :
              lower(from) === lower(WALLET) && lower(to) !== lower(WALLET) ? 'out' :
              null;
            if (!direction) continue;

            const meta = await tokenMeta(provider, token, metaCache);
            let amount = null;
            try { amount = Number(formatUnits(BigInt(log.data), meta.decimals)); } catch {}
            const block = await provider.getBlock(log.blockNumber);
            const timestamp = block ? new Date(Number(block.timestamp) * 1000).toISOString() : null;
            const counterparty = direction === 'in' ? from : to;

            rows.push({
              source: 'rpc-known-token-fallback',
              chain: chainKey,
              chainLabel: CHAINS[chainKey].label,
              txHash: log.transactionHash,
              blockNumber: Number(log.blockNumber),
              logIndex: Number(log.index ?? log.logIndex ?? 0),
              timestamp,
              direction,
              token: addr(token),
              symbol: meta.symbol,
              decimals: meta.decimals,
              amount,
              counterparty,
              counterpartyIsContract: null,
              counterpartyName: null,
              tokenType: 'ERC-20',
              explorerUrl: CHAINS[chainKey].txBase + log.transactionHash
            });
          }
        }
      } catch (e) {
        addressErrors.push({ token, error: errorText(e) });
      }
    }

    return {
      provider: new URL(url).hostname,
      fromBlock,
      toBlock,
      addressesScanned: limited.length,
      rows,
      addressErrors
    };
  });
  return res;
}

function transferKey(r) {
  return [
    r.chain, lower(r.txHash), r.logIndex ?? '',
    lower(r.token), r.direction, lower(r.counterparty), r.amount
  ].join(':');
}

function dedupeTransfers(rows) {
  const m = new Map();
  for (const r of rows) {
    const key = transferKey(r);
    if (!m.has(key)) m.set(key, r);
    else if (m.get(key).source !== 'blockscout-v2' && r.source === 'blockscout-v2') m.set(key, r);
  }
  return [...m.values()].sort((a, b) =>
    new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
  );
}

function groupByTx(rows) {
  const m = new Map();
  for (const r of rows) {
    const key = `${r.chain}:${lower(r.txHash) || `block-${r.blockNumber}`}`;
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(r);
  }
  return m;
}

function classifyToken(row, bookAddressesByChain) {
  const symbol = symbolKey(row.symbol);
  const tokenIsBook = [...(bookAddressesByChain[row.chain] || [])].some(
    a => lower(a) === lower(row.token)
  );
  if (isNominalStable(symbol)) return 'nominal-stable';
  if (tokenIsBook) return 'book-asset-needs-historical-nav';
  return 'outside-book-token';
}

function knownInternalAddress(address, chainKey, bookAddressesByChain) {
  if (!address) return false;
  if (lower(address) === lower(ZERO)) return true;
  return [...(bookAddressesByChain[chainKey] || [])].some(a => lower(a) === lower(address));
}

function preliminaryClassification(row, txRows, bookAddressesByChain) {
  const tokenClass = classifyToken(row, bookAddressesByChain);
  const cp = lower(row.counterparty);

  if (IGNORE_TOKEN_ADDRESSES.has(lower(row.token))) {
    return {
      classification: 'ignored-spam-or-address-poisoning',
      confidence: 'high',
      tokenClass: 'outside-book-token'
    };
  }

  if (!row.amount || Math.abs(row.amount) < MIN_MEANINGFUL_STABLE) {
    return { classification: 'dust-or-zero', confidence: 'high', tokenClass };
  }
  if (cp === lower(ZERO)) {
    return { classification: 'internal-mint-burn', confidence: 'high', tokenClass };
  }
  if (knownInternalAddress(row.counterparty, row.chain, bookAddressesByChain)) {
    return { classification: 'internal-known-protocol', confidence: 'high', tokenClass };
  }

  const hasOppositeBookFlow = txRows.some(x =>
    x !== row &&
    x.direction !== row.direction &&
    classifyToken(x, bookAddressesByChain) !== 'outside-book-token'
  );
  if (hasOppositeBookFlow) {
    return {
      classification: 'internal-swap-or-wrapper-rotation',
      confidence: 'high',
      tokenClass
    };
  }

  if (tokenClass === 'outside-book-token') {
    return {
      classification: 'review-outside-book-token',
      confidence: 'low',
      tokenClass
    };
  }

  // Direct transfer from/to an EOA is the strongest boundary-flow signal.
  if (row.counterpartyIsContract === false) {
    return {
      classification: row.direction === 'in'
        ? 'external-contribution-candidate'
        : 'external-distribution-candidate',
      confidence: 'high',
      tokenClass
    };
  }

  // Unknown contract can be a bridge, router, reward distributor or external custody.
  if (row.counterpartyIsContract === true) {
    return {
      classification: row.direction === 'in'
        ? 'review-inbound-from-contract'
        : 'review-outbound-to-contract',
      confidence: 'medium',
      tokenClass
    };
  }

  // RPC fallback has no counterparty metadata: keep candidate but require review.
  return {
    classification: row.direction === 'in'
      ? 'review-inbound-unknown-counterparty-type'
      : 'review-outbound-unknown-counterparty-type',
    confidence: 'medium',
    tokenClass
  };
}

function nominalUsd(row, tokenClass) {
  if (tokenClass !== 'nominal-stable') return null;
  return finite(row.amount) ? round(row.amount, 8) : null;
}

function isBoundaryCandidate(c) {
  return [
    'external-contribution-candidate',
    'external-distribution-candidate',
    'review-inbound-from-contract',
    'review-outbound-to-contract',
    'review-inbound-unknown-counterparty-type',
    'review-outbound-unknown-counterparty-type'
  ].includes(c);
}

function bridgeSymbolEquivalent(a, b) {
  if (symbolKey(a.symbol) === symbolKey(b.symbol)) return true;

  // v0.1 exposed a real Squid route: CRVUSD leaves Ethereum through the
  // verified Squid Multicall and near-equal frxUSD arrives on Fraxtal.
  // Cross-asset stable matching is allowed ONLY when at least one side is
  // a verified bridge/router endpoint.
  const bridgeEndpointInvolved =
    KNOWN_BRIDGE_ENDPOINTS.has(lower(a.counterparty)) ||
    KNOWN_BRIDGE_ENDPOINTS.has(lower(b.counterparty));

  return (
    bridgeEndpointInvolved &&
    a.tokenClass === 'nominal-stable' &&
    b.tokenClass === 'nominal-stable'
  );
}

function bridgeAmountsMatch(a, b) {
  if (!finite(a.nominalStableUsd) || !finite(b.nominalStableUsd)) return false;
  const x = Math.abs(Number(a.nominalStableUsd));
  const y = Math.abs(Number(b.nominalStableUsd));
  if (!(x > 0 && y > 0)) return false;
  return Math.abs(x - y) / Math.max(x, y) <= BRIDGE_AMOUNT_TOLERANCE;
}


function matchExternalRouteStableConversions(classified) {
  const candidates = classified.filter(x =>
    ['external-contribution-candidate', 'external-distribution-candidate'].includes(x.classification) &&
    x.tokenClass === 'nominal-stable' &&
    x.timestamp &&
    x.counterparty
  );

  const matched = [];
  const used = new Set();

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (used.has(a.id)) continue;

    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (used.has(b.id)) continue;
      if (a.chain !== b.chain) continue;
      if (a.direction === b.direction) continue;
      if (lower(a.counterparty) !== lower(b.counterparty)) continue;
      if (!bridgeAmountsMatch(a, b)) continue;

      const dt = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (dt > EXTERNAL_ROUTE_SWAP_WINDOW_MS) continue;

      used.add(a.id);
      used.add(b.id);

      a.classification = 'internal-external-route-stable-conversion';
      b.classification = 'internal-external-route-stable-conversion';
      a.confidence = 'high';
      b.confidence = 'high';
      a.routePairId = b.id;
      b.routePairId = a.id;

      matched.push({
        id: `stable-route:${a.id}:${b.id}`,
        counterparty: a.counterparty,
        chain: a.chainLabel,
        assetA: a.symbol,
        amountA: a.amount,
        directionA: a.direction,
        assetB: b.symbol,
        amountB: b.amount,
        directionB: b.direction,
        timestampA: a.timestamp,
        timestampB: b.timestamp,
        reason: 'Opposite-direction near-equal nominal stable flows through the same external counterparty within 10 minutes; treated as a conversion route, not owner capital movement.'
      });
      break;
    }
  }
  return matched;
}

function matchCrossChainBridges(classified) {
  const candidates = classified.filter(x =>
    isBoundaryCandidate(x.classification) &&
    x.tokenClass === 'nominal-stable' &&
    x.timestamp
  );
  const matched = [];
  const used = new Set();

  for (let i = 0; i < candidates.length; i++) {
    const a = candidates[i];
    if (used.has(a.id)) continue;

    for (let j = i + 1; j < candidates.length; j++) {
      const b = candidates[j];
      if (used.has(b.id)) continue;
      if (a.chain === b.chain) continue;
      if (a.direction === b.direction) continue;
      if (!bridgeSymbolEquivalent(a, b)) continue;
      if (!bridgeAmountsMatch(a, b)) continue;

      const dt = Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      if (dt > BRIDGE_WINDOW_MS) continue;

      used.add(a.id);
      used.add(b.id);
      a.classification = 'internal-bridge-matched';
      b.classification = 'internal-bridge-matched';
      a.confidence = 'medium';
      b.confidence = 'medium';
      a.bridgePairId = b.id;
      b.bridgePairId = a.id;
      matched.push({
        id: `bridge:${a.id}:${b.id}`,
        asset: a.symbol,
        amountA: a.amount,
        amountB: b.amount,
        chainA: a.chainLabel,
        chainB: b.chainLabel,
        timestampA: a.timestamp,
        timestampB: b.timestamp,
        txA: a.txHash,
        txB: b.txHash,
        reason: 'Opposite-direction near-equal stable flows across different chains within 6h and 2% amount tolerance; same-symbol or verified bridge-endpoint route.'
      });
      break;
    }
  }
  return matched;
}

function sumCurrentClaimable(stableData) {
  let total = 0;
  for (const p of stableData?.positions || []) {
    const v = Number(p?.currentSnapshot?.accruedClaimable?.usdValue);
    if (Number.isFinite(v)) total += v;
  }
  return round(total, 8) || 0;
}

function resolverFoundingNative(resolver) {
  return (
    resolver?.company?.founding?.evidence?.selected?.kind === 'native-funding'
      ? resolver.company.founding.evidence.selected
      : resolver?.company?.founding?.evidence?.firstNative || null
  );
}

function makeReviewReason(row) {
  if (row.tokenClass === 'book-asset-needs-historical-nav') {
    return 'Boundary-like transfer is a yield-bearing/book asset; historical canonical NAV is required before it can be valued as Invested/Distribution.';
  }
  if (row.classification === 'review-outside-book-token') {
    return 'Token is outside the current Stable Capital book. Confirm whether it was company funding, reward/spam, or unrelated.';
  }
  if (row.classification.includes('contract')) {
    return 'Counterparty is a contract. It may be bridge/router/reward distribution rather than owner capital; requires classification.';
  }
  if (row.classification.includes('unknown-counterparty-type')) {
    return 'RPC fallback cannot identify whether counterparty is an EOA or contract; requires explorer confirmation.';
  }
  return 'Boundary classification is not reproducible enough for automatic Invested/Performance.';
}

async function main() {
  const startedAt = nowIso();
  const resolver = readJson(RESOLVER_FILE);
  const stableData = readJson(STABLE_FILE);

  if (resolver?.company?.registry !== '008' || resolver?.company?.name !== 'Monetra.eth') {
    throw new Error('resolver identity mismatch');
  }
  if (lower(resolver?.company?.wallet) !== lower(WALLET)) {
    throw new Error('resolver wallet mismatch');
  }
  if ((resolver?.stableCapital?.positions || []).length < 9) {
    throw new Error('resolver Stable Capital book unexpectedly incomplete');
  }
  if (stableData?.company?.registry !== '008' || (stableData?.positions || []).length !== 10) {
    throw new Error('Stable Capital data identity/count regression');
  }

  const foundedAt =
    resolver?.company?.founding?.foundedAt ||
    resolver?.company?.founding?.date ||
    '2026-05-27T05:46:11.000Z';

  const foundedMs = new Date(foundedAt).getTime();
  if (!Number.isFinite(foundedMs)) throw new Error('invalid foundedAt');
  const foundedTs = Math.floor(foundedMs / 1000);

  const bookAddressesByChain = collectBookAddressesByChain(resolver);
  const sourceDiagnostics = {};
  const allTransfers = [];

  for (const chainKey of Object.keys(CHAINS)) {
    const explorer = await fetchBlockscoutTransfers(chainKey, foundedMs);
    sourceDiagnostics[chainKey] = {
      chain: CHAINS[chainKey].label,
      explorer: CHAINS[chainKey].explorer,
      blockscout: {
        status: explorer.errors.length ? (explorer.rows.length ? 'partial' : 'failed') : 'ok',
        pages: explorer.pages,
        rows: explorer.rows.length,
        reachedPreFounding: explorer.reachedPreFounding,
        errors: explorer.errors
      },
      rpcFallback: null
    };

    if (explorer.rows.length) {
      allTransfers.push(...explorer.rows);
      continue;
    }

    const fallback = await fetchRpcKnownTransfers(
      chainKey,
      foundedTs,
      bookAddressesByChain[chainKey]
    );
    sourceDiagnostics[chainKey].rpcFallback = fallback.ok
      ? {
          status: 'ok',
          provider: fallback.value.provider,
          fromBlock: fallback.value.fromBlock,
          toBlock: fallback.value.toBlock,
          addressesScanned: fallback.value.addressesScanned,
          rows: fallback.value.rows.length,
          addressErrors: fallback.value.addressErrors
        }
      : {
          status: 'failed',
          attempts: fallback.attempts,
          error: fallback.error
        };

    if (fallback.ok) allTransfers.push(...fallback.value.rows);
  }

  const transfers = dedupeTransfers(allTransfers).filter(r =>
    r.timestamp && new Date(r.timestamp).getTime() >= foundedMs
  );

  const txGroups = groupByTx(transfers);
  const classified = transfers.map((row, i) => {
    const txKey = `${row.chain}:${lower(row.txHash) || `block-${row.blockNumber}`}`;
    const pre = preliminaryClassification(
      row,
      txGroups.get(txKey) || [row],
      bookAddressesByChain
    );
    const nominal = nominalUsd(row, pre.tokenClass);
    return {
      id: `${row.chain}:${row.txHash || row.blockNumber}:${row.logIndex ?? i}:${row.direction}`,
      ...row,
      tokenClass: pre.tokenClass,
      classification: pre.classification,
      confidence: pre.confidence,
      nominalStableUsd: nominal,
      valuationStatus:
        pre.tokenClass === 'nominal-stable'
          ? 'nominal-stable-units'
          : pre.tokenClass === 'book-asset-needs-historical-nav'
            ? 'historical-nav-required'
            : 'not-valued'
    };
  });

  const matchedExternalStableConversions =
    matchExternalRouteStableConversions(classified);
  const matchedBridges = matchCrossChainBridges(classified);

  const highConfidenceContributions = classified.filter(r =>
    r.classification === 'external-contribution-candidate' &&
    r.confidence === 'high'
  );
  const highConfidenceDistributions = classified.filter(r =>
    r.classification === 'external-distribution-candidate' &&
    r.confidence === 'high'
  );

  const reviewQueue = classified
    .filter(r =>
      r.classification.startsWith('review-') ||
      (
        ['external-contribution-candidate', 'external-distribution-candidate'].includes(r.classification) &&
        !finite(r.nominalStableUsd)
      )
    )
    .map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      chain: r.chainLabel,
      txHash: r.txHash,
      explorerUrl: r.explorerUrl,
      direction: r.direction,
      asset: r.symbol,
      token: r.token,
      amount: r.amount,
      counterparty: r.counterparty,
      counterpartyIsContract: r.counterpartyIsContract,
      tokenClass: r.tokenClass,
      classification: r.classification,
      confidence: r.confidence,
      valuationStatus: r.valuationStatus,
      reason: makeReviewReason(r)
    }));

  const sourceFailed = Object.values(sourceDiagnostics).some(d =>
    d.blockscout.status === 'failed' &&
    d.rpcFallback?.status !== 'ok'
  );

  const valuedContributionRows = highConfidenceContributions.filter(r => finite(r.nominalStableUsd));
  const valuedDistributionRows = highConfidenceDistributions.filter(r => finite(r.nominalStableUsd));
  const allContributionCandidatesValued =
    highConfidenceContributions.length === valuedContributionRows.length;
  const allDistributionCandidatesValued =
    highConfidenceDistributions.length === valuedDistributionRows.length;

  const grossContributionsUsd = round(
    valuedContributionRows.reduce((s, r) => s + Number(r.nominalStableUsd || 0), 0),
    8
  );
  const externalDistributionsUsd = round(
    valuedDistributionRows.reduce((s, r) => s + Number(r.nominalStableUsd || 0), 0),
    8
  );

  // Public Invested = net owner capital still economically contributed:
  // gross contributions minus external distributions/withdrawals.
  // This is the intuitive denominator for the desired Passport:
  // Invested / Current Capital / Performance $ / Performance %.
  const netInvestedUsd =
    finite(grossContributionsUsd) && finite(externalDistributionsUsd)
      ? round(Number(grossContributionsUsd) - Number(externalDistributionsUsd), 8)
      : null;

  const currentStableCapitalUsd = round(stableData?.summary?.stableCapitalUsd, 8);
  const currentClaimableUsd = sumCurrentClaimable(stableData);
  const currentEconomicValueUsd =
    finite(currentStableCapitalUsd)
      ? round(Number(currentStableCapitalUsd) + Number(currentClaimableUsd || 0), 8)
      : null;

  const autoReady =
    !sourceFailed &&
    reviewQueue.length === 0 &&
    allContributionCandidatesValued &&
    allDistributionCandidatesValued &&
    finite(netInvestedUsd) &&
    Number(netInvestedUsd) > 0 &&
    finite(currentEconomicValueUsd);

  const performanceUsd = autoReady
    ? round(Number(currentEconomicValueUsd) - Number(netInvestedUsd), 8)
    : null;

  const performancePct =
    autoReady && Number(netInvestedUsd) > 0
      ? round((Number(performanceUsd) / Number(netInvestedUsd)) * 100, 6)
      : null;

  const foundingNative = resolverFoundingNative(resolver);

  const out = {
    version: VERSION,
    methodologyVersion: METHODOLOGY,
    generatedAt: nowIso(),
    startedAt,
    company: {
      registry: '008',
      name: 'Monetra.eth',
      wallet: WALLET,
      foundedAt: new Date(foundedMs).toISOString(),
      category: 'Stable Capital'
    },
    accountingBoundary: {
      principle: 'Only capital crossing the company boundary can change Invested/Distributions. Internal DeFi operations do not.',
      contribution: 'External capital entering the Monetra wallet/company boundary.',
      distribution: 'Capital leaving the Monetra company boundary.',
      internalExamples: [
        'protocol deposit / withdrawal',
        'vault mint / redeem',
        'wrapper conversion',
        'stable-to-stable swap',
        'strategy rotation',
        'matched cross-chain bridge movement'
      ],
      stablePrincipalValuation:
        'Base stablecoin boundary flows are valued in nominal stable units. Yield-bearing wrapper boundary flows require historical canonical NAV.',
      nativeGas:
        'Native ETH / chain gas funding is excluded from Stable Capital Invested. It is retained only as company-origin evidence.',
      performance:
        'Net Invested = gross external contributions - external distributions. Performance = Current Stable Capital + Current Claimable - Net Invested. Current APY is never used to backfill historical performance.'
    },
    foundingOriginEvidence: {
      nativeFunding: foundingNative
        ? {
            timestamp: foundingNative.timestamp || null,
            txHash: foundingNative.txHash || null,
            amountEth: foundingNative.amountEth ?? null,
            from: foundingNative.from || null,
            treatment: 'company-origin-only; excluded from Stable Capital Invested'
          }
        : null,
      firstStableEvidence: resolver?.company?.founding?.evidence?.firstStable || null
    },
    sourceDiagnostics,
    bookAddressUniverse: Object.fromEntries(
      Object.entries(bookAddressesByChain).map(([k, set]) => [k, [...set].sort()])
    ),
    summary: {
      status: autoReady ? 'verified-auto-ready' : 'diagnostic-review-required',
      manualReviewRequired: !autoReady,
      sourceFailed,
      transferRowsObserved: classified.length,
      matchedInternalBridgePairs: matchedBridges.length,
      matchedExternalStableConversionPairs: matchedExternalStableConversions.length,
      highConfidenceContributionCount: highConfidenceContributions.length,
      highConfidenceDistributionCount: highConfidenceDistributions.length,
      reviewQueueCount: reviewQueue.length,
      grossContributionsUsd: autoReady ? grossContributionsUsd : null,
      externalDistributionsUsd: autoReady ? externalDistributionsUsd : null,
      netInvestedUsd: autoReady ? netInvestedUsd : null,
      currentStableCapitalUsd,
      currentClaimableUsd,
      currentEconomicValueUsd,
      performanceUsd,
      performancePct,
      publicInvestedReady: autoReady,
      publicPerformanceReady: autoReady,
      note: autoReady
        ? 'All boundary flows were reproducibly classified and valued. Invested and since-inception Performance are ready for integration.'
        : 'No historical performance is published yet. Review only the listed ambiguous boundary candidates; do not restart wallet discovery.'
    },
    candidateLedger: classified.map(r => ({
      id: r.id,
      timestamp: r.timestamp,
      chain: r.chainLabel,
      txHash: r.txHash,
      explorerUrl: r.explorerUrl,
      direction: r.direction,
      asset: r.symbol,
      token: r.token,
      amount: r.amount,
      counterparty: r.counterparty,
      counterpartyIsContract: r.counterpartyIsContract,
      counterpartyName: r.counterpartyName,
      tokenClass: r.tokenClass,
      classification: r.classification,
      confidence: r.confidence,
      nominalStableUsd: r.nominalStableUsd,
      valuationStatus: r.valuationStatus,
      bridgePairId: r.bridgePairId || null,
      source: r.source
    })),
    matchedExternalStableConversions,
    matchedInternalBridges: matchedBridges,
    reviewQueue,
    targetedResolution: {
      basis: 'Fresh production v0.1 reviewQueue generated 2026-08-12T18:08:24.658Z.',
      fixes: [
        'Fixed v0.1 bridge matcher field mismatch: nominalUsd -> nominalStableUsd.',
        'Verified Squid Multicall and Across bridge endpoint identities.',
        'Allows near-equal cross-asset stable pairing only when a verified bridge endpoint is involved.',
        'Pairs same-counterparty near-equal opposite stable flows within 10 minutes as an external conversion route.',
        'Ignores only the explicit spam/address-poisoning token addresses observed in v0.1.',
        'Public Invested uses net contributed capital, not gross historical deposits.'
      ],
      knownBridgeEndpoints: [...KNOWN_BRIDGE_ENDPOINTS],
      ignoredTokenAddresses: [...IGNORE_TOKEN_ADDRESSES]
    },
    integrationContract: {
      publishInvestedOnlyWhen: 'summary.publicInvestedReady === true',
      publishPerformanceOnlyWhen: 'summary.publicPerformanceReady === true',
      futureStableIndexFields: {
        investedUsd: autoReady ? netInvestedUsd : null,
        currentCapitalUsd: currentStableCapitalUsd,
        claimableUsd: currentClaimableUsd,
        performanceUsd,
        performancePct
      },
      uiTarget: 'Capital / APY / Performance / Claimable / Strategy Book; add Invested only after verified backfill.'
    },
    provenance: {
      resolverVersion: resolver?.version || null,
      resolverSha256: sha256(fs.readFileSync(RESOLVER_FILE, 'utf8')),
      stableCapitalVersion: stableData?.version || null,
      stableCapitalSha256: sha256(fs.readFileSync(STABLE_FILE, 'utf8')),
      generatedBy: 'stable-capital/monetra-contribution-ledger.mjs'
    }
  };

  writeJson(OUT_FILE, out);

  console.log('Monetra Contribution Ledger v0.1');
  console.log('Status:', out.summary.status);
  console.log('Transfers:', out.summary.transferRowsObserved);
  console.log('High-confidence contributions:', out.summary.highConfidenceContributionCount);
  console.log('High-confidence distributions:', out.summary.highConfidenceDistributionCount);
  console.log('Stable conversion pairs:', out.summary.matchedExternalStableConversionPairs);
  console.log('Bridge pairs:', out.summary.matchedInternalBridgePairs);
  console.log('Review queue:', out.summary.reviewQueueCount);
  console.log('Current Stable Capital:', out.summary.currentStableCapitalUsd);
  console.log('Current Claimable:', out.summary.currentClaimableUsd);
  console.log('Public Invested ready:', out.summary.publicInvestedReady);
  console.log('Public Performance ready:', out.summary.publicPerformanceReady);
  console.log('Output:', path.relative(ROOT, OUT_FILE));
}

main().catch(e => {
  console.error('MONETRA CONTRIBUTION LEDGER FATAL:', e);
  process.exitCode = 1;
});
