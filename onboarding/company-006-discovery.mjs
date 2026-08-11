import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  ZeroAddress,
  formatUnits,
  getAddress,
  id,
  zeroPadValue,
  toBeHex
} from 'ethers';

const VERSION = '1.2';
const OUTPUT = process.env.COMPANY_006_DISCOVERY_OUTPUT || path.resolve('companies/company-006-discovery.json');
const CG_KEY = process.env.COINGECKO_API_KEY || '';

const COMPANY = {
  registry: '006',
  name: 'aerocrvyb.eth',
  wallets: {
    aerodrome: {
      alias: 'Aero / Velo wallet',
      address: getAddress('0xa641752824d512fa8683758c6b2d8a04ea46dcd0'),
      chains: ['Base', 'Optimism'],
      routes: ['aerodrome-ve', 'velodrome-ve-direct']
    },
    yieldBasis: {
      alias: 'Yield Basis wallet',
      address: getAddress('0x6c6543eba07946706fd10a1064fa773326b5f5a9'),
      chain: 'Ethereum',
      route: 'yield-basis-fees',
      routes: ['yield-basis-fees']
    }
  }
};

const ADDR = {
  aerodrome: {
    token: getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),
    votingEscrow: getAddress('0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4')
  },
  velodrome: {
    token: getAddress('0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db'),
    votingEscrow: getAddress('0xFAf8FD17D9840595845582fCB047DF13f006787d')
  },
  yieldBasis: {
    token: getAddress('0x01791F726B4103694969820be083196cC7c045fF'),
    votingEscrow: getAddress('0x8235c179E9e84688FBd8B12295EfC26834dAC211'),
    feeDistributor: getAddress('0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90')
  }
};

const RPC = {
  base: unique([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ]),
  ethereum: unique([
    process.env.ETH_RPC_URL,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com'
  ]),
  optimism: unique([
    process.env.OPTIMISM_RPC_URL,
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io',
    'https://optimism.drpc.org'
  ])
};

function unique(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function errMsg(e) { return String(e?.shortMessage || e?.message || e || 'unknown error').replace(/https?:\/\/[^\s)]+/g, '[rpc-redacted]'); }
function isoFromTs(ts) { return new Date(Number(ts) * 1000).toISOString(); }
function topicAddress(address) { return zeroPadValue(address, 32); }
function safeNumber(x) { const n = Number(x); return Number.isFinite(n) ? n : null; }
function positiveBigInt(x) { try { const n = BigInt(x); return n > 0n ? n : 0n; } catch { return 0n; } }

async function withProvider(chain, fn) {
  const errors = [];
  for (const url of RPC[chain] || []) {
    const provider = new JsonRpcProvider(url);
    try {
      const result = await fn(provider);
      return { result, providerLabel: `${chain}:${new URL(url).hostname}`, errors };
    } catch (e) {
      errors.push(`${chain}:${safeHost(url)}: ${errMsg(e)}`);
    }
  }
  throw new Error(`${chain} providers exhausted: ${errors.join(' | ')}`);
}
function safeHost(url) {
  try {
    const secret = [process.env.BASE_RPC_URL, process.env.BASE_RPC_URL_2, process.env.ETH_RPC_URL, process.env.OPTIMISM_RPC_URL].filter(Boolean).includes(url);
    return secret ? 'configured' : new URL(url).hostname;
  } catch { return 'configured'; }
}

async function fetchJson(url, options = {}, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(t); }
}

async function cgHistory(idValue, isoDate) {
  const d = new Date(`${isoDate}T12:00:00Z`);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = d.getUTCFullYear();
  const headers = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {};
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(idValue)}/history?date=${dd}-${mm}-${yyyy}&localization=false`;
  const data = await fetchJson(url, { headers }, 25000);
  const usd = safeNumber(data?.market_data?.current_price?.usd);
  return {
    coingeckoId: idValue,
    date: isoDate,
    usd,
    method: 'CoinGecko daily history market_data.current_price.usd',
    status: usd !== null && usd > 0 ? 'ok' : 'unavailable'
  };
}


async function llamaHistoricalPrice(chain, tokenAddress, timestamp, symbol = null) {
  const coin = `${chain}:${String(tokenAddress).toLowerCase()}`;
  const url = `https://coins.llama.fi/prices/historical/${Number(timestamp)}/${encodeURIComponent(coin)}`;
  const data = await fetchJson(url, {}, 25000);
  const row = data?.coins?.[coin] || data?.coins?.[String(coin).toLowerCase()] || null;
  const usd = safeNumber(row?.price);
  return {
    chain,
    token: tokenAddress,
    symbol,
    timestamp: Number(timestamp),
    at: isoFromTs(timestamp),
    usd,
    method: 'DeFiLlama contract historical price at verified onchain event timestamp',
    source: 'coins.llama.fi/prices/historical',
    confidence: usd !== null && usd > 0 ? (row?.confidence ?? null) : null,
    status: usd !== null && usd > 0 ? 'ok' : 'unavailable'
  };
}

async function marketHistory({ coingeckoId, llamaChain, token, event, symbol }) {
  if (!event?.timestamp) return {
    symbol, coingeckoId, date: event?.foundedISO || null, usd: null,
    status: 'unavailable', error: 'event timestamp unavailable'
  };

  // Exact event-time, contract-address price is preferred. It works for history
  // older than CoinGecko Demo's rolling historical window.
  try {
    const llama = await llamaHistoricalPrice(llamaChain, token, event.timestamp, symbol);
    if (llama.status === 'ok') return { ...llama, coingeckoId, date: event.foundedISO };
  } catch (e) {}

  // Daily CoinGecko history remains a deterministic fallback when available.
  try {
    const cg = await cgHistory(coingeckoId, event.foundedISO);
    if (cg.status === 'ok') return { ...cg, symbol, timestamp: event.timestamp, at: event.foundedAt };
    return { ...cg, symbol, timestamp: event.timestamp, at: event.foundedAt };
  } catch (e) {
    return {
      symbol, coingeckoId, date: event.foundedISO, timestamp: event.timestamp,
      at: event.foundedAt, usd: null, status: 'unavailable', error: errMsg(e)
    };
  }
}

async function cgCurrent(ids) {
  const headers = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {};
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=usd`;
  try {
    const data = await fetchJson(url, { headers }, 20000);
    const out = {};
    for (const x of ids) out[x] = safeNumber(data?.[x]?.usd);
    return out;
  } catch (e) {
    return Object.fromEntries(ids.map(x => [x, null]));
  }
}

// Find the first block in which a contract has bytecode. Useful to avoid scanning
// logs from genesis. Requires historical eth_getCode; if unavailable, return 0 and
// the log scanner will fall back to conservative windowing.
async function contractCreationBlock(provider, address) {
  try {
    const latest = await provider.getBlockNumber();
    const latestCode = await provider.getCode(address, latest);
    if (!latestCode || latestCode === '0x') throw new Error('no code at latest');
    let lo = 0, hi = latest;
    for (let i = 0; i < 32 && lo < hi; i++) {
      const mid = Math.floor((lo + hi) / 2);
      const code = await provider.getCode(address, mid);
      if (code && code !== '0x') hi = mid;
      else lo = mid + 1;
    }
    return lo;
  } catch {
    return 0;
  }
}

async function getLogsAdaptive(provider, filter, start, end, initialWindow = 500000) {
  const logs = [];
  let from = start;
  let window = initialWindow;
  while (from <= end) {
    const to = Math.min(end, from + window - 1);
    try {
      const batch = await provider.getLogs({ ...filter, fromBlock: from, toBlock: to });
      logs.push(...batch);
      from = to + 1;
      if (window < initialWindow) window = Math.min(initialWindow, window * 2);
    } catch (e) {
      if (window <= 2000) throw e;
      window = Math.max(2000, Math.floor(window / 4));
    }
  }
  return logs;
}

async function blockscoutLegacyNftTransfers(baseUrl, wallet, contract) {
  const url = `${baseUrl}/api?module=account&action=tokennfttx&address=${wallet}&contractaddress=${contract}&startblock=0&endblock=999999999&page=1&offset=1000&sort=asc`;
  try {
    const data = await fetchJson(url, {}, 30000);
    if (!Array.isArray(data?.result)) throw new Error(data?.message || 'unexpected response');
    return data.result;
  } catch { return []; }
}

function blockscoutAddress(v) {
  if (typeof v === 'string') return v.toLowerCase();
  return String(v?.hash || v?.address_hash || v?.address || '').toLowerCase();
}

async function blockscoutV2InstanceTransfers(baseUrl, contract, tokenId) {
  const out = [];
  let next = null;
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams();
    if (next && typeof next === 'object') {
      for (const [k,v] of Object.entries(next)) if (v !== null && v !== undefined) qs.set(k, String(v));
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const data = await fetchJson(`${baseUrl}/api/v2/tokens/${contract}/instances/${tokenId}/transfers${suffix}`, {}, 30000);
    const items = Array.isArray(data?.items) ? data.items : [];
    out.push(...items);
    next = data?.next_page_params && Object.keys(data.next_page_params).length ? data.next_page_params : null;
    if (!next) break;
  }
  return out;
}

async function currentNftHistoryV2({ baseUrl, contract, wallet, tokenIds, provider = null, chain }) {
  const events = {};
  const mintCandidates = [];
  const diagnostics = [];
  for (const tokenId of tokenIds || []) {
    try {
      const rows = await blockscoutV2InstanceTransfers(baseUrl, contract, tokenId);
      diagnostics.push(`Blockscout v2 instance ${tokenId}: ${rows.length} transfer rows`);
      const normalized = [];
      for (const x of rows) {
        const from = blockscoutAddress(x?.from);
        const to = blockscoutAddress(x?.to);
        const blockNumber = Number(x?.block_number ?? x?.blockNumber ?? 0) || null;
        const txHash = x?.transaction_hash || x?.transactionHash || x?.hash || null;
        let timestamp = null;
        const rawTs = x?.timestamp || x?.block_timestamp || null;
        if (rawTs) {
          const parsed = Date.parse(rawTs);
          if (Number.isFinite(parsed)) timestamp = Math.floor(parsed / 1000);
          else if (Number.isFinite(Number(rawTs))) timestamp = Number(rawTs);
        }
        if (!timestamp && blockNumber && provider) {
          try { timestamp = Number((await provider.getBlock(blockNumber))?.timestamp || 0) || null; } catch {}
        }
        normalized.push({ tokenId:String(tokenId), from, to, blockNumber, txHash, timestamp });
      }
      normalized.sort((a,b)=>(a.blockNumber||0)-(b.blockNumber||0));
      const mint = normalized.find(x => x.from === ZeroAddress.toLowerCase()) || null;
      if (mint) mintCandidates.push(mint);
      const inbound = normalized.find(x => x.to === wallet.toLowerCase()) || null;
      if (inbound) {
        events[String(tokenId)] = {
          blockNumber: inbound.blockNumber, txHash: inbound.txHash, tokenId: String(tokenId),
          from: inbound.from, to: wallet, timestamp: inbound.timestamp,
          eventType: inbound.from === ZeroAddress.toLowerCase() ? 'mint-to-wallet' : 'transfer-to-wallet',
          source: `${chain}-blockscout-v2: first inbound current veNFT transfer`, confidence: 'high',
          ...(inbound.timestamp ? { acquiredAt: isoFromTs(inbound.timestamp), acquiredISO: isoFromTs(inbound.timestamp).slice(0,10) } : {})
        };
      }
    } catch (e) { diagnostics.push(`Blockscout v2 instance ${tokenId} failed: ${errMsg(e)}`); }
  }
  mintCandidates.sort((a,b)=>(a.blockNumber||0)-(b.blockNumber||0));
  const mint = mintCandidates[0] || null;
  let first = null;
  if (mint) {
    first = { blockNumber: mint.blockNumber, txHash: mint.txHash, tokenId: mint.tokenId,
      timestamp: mint.timestamp, source: `${chain}-blockscout-v2: veNFT instance mint history`,
      method: 'veNFT-zero-address-mint-history', confidence: 'high' };
    if (first.timestamp) { first.foundedAt = isoFromTs(first.timestamp); first.foundedISO = first.foundedAt.slice(0,10); }
  }
  return { first, candidates: mintCandidates, events, diagnostics };
}

const TRANSFER_IFACE = new Interface(['event Transfer(address indexed from,address indexed to,uint256 indexed tokenId)']);
const TRANSFER_TOPIC = TRANSFER_IFACE.getEvent('Transfer').topicHash;

async function earliestMintToWallet({ chain, provider, contract, wallet, blockscoutBase = null }) {
  const zeroTopic = topicAddress(ZeroAddress);
  const walletTopic = topicAddress(wallet);
  const candidates = [];
  const diagnostics = [];

  if (blockscoutBase) {
    const rows = await blockscoutLegacyNftTransfers(blockscoutBase, wallet, contract);
    for (const x of rows) {
      if (String(x.from || '').toLowerCase() !== ZeroAddress.toLowerCase()) continue;
      if (String(x.to || '').toLowerCase() !== wallet.toLowerCase()) continue;
      candidates.push({
        blockNumber: Number(x.blockNumber || x.block_number || 0),
        txHash: x.hash || x.transactionHash || x.transaction_hash || null,
        tokenId: String(x.tokenID || x.tokenId || x.token_id || ''),
        timestamp: Number(x.timeStamp || x.timestamp || 0) || null,
        source: `${chain}-blockscout: wallet NFT mint history`
      });
    }
    diagnostics.push(`Blockscout mint candidates: ${candidates.length}`);
  }

  if (!candidates.length) {
    const latest = await provider.getBlockNumber();
    const creation = await contractCreationBlock(provider, contract);
    diagnostics.push(`RPC contract creation lower bound: ${creation}`);
    const logs = await getLogsAdaptive(provider, {
      address: contract,
      topics: [TRANSFER_TOPIC, zeroTopic, walletTopic]
    }, creation, latest, 750000);
    for (const log of logs) {
      const parsed = TRANSFER_IFACE.parseLog(log);
      candidates.push({
        blockNumber: log.blockNumber,
        txHash: log.transactionHash,
        tokenId: parsed.args.tokenId.toString(),
        timestamp: null,
        source: `${chain}-rpc: ERC721 zero-address Transfer`
      });
    }
    diagnostics.push(`RPC mint candidates: ${logs.length}`);
  }

  candidates.sort((a, b) => a.blockNumber - b.blockNumber);
  const first = candidates[0] || null;
  if (!first) return { first: null, candidates: [], diagnostics };
  if (!first.timestamp) {
    const block = await provider.getBlock(first.blockNumber);
    first.timestamp = Number(block.timestamp);
  }
  first.foundedAt = isoFromTs(first.timestamp);
  first.foundedISO = first.foundedAt.slice(0, 10);
  first.method = 'veNFT-zero-address-mint-history';
  first.confidence = 'high';
  return { first, candidates, diagnostics };
}


async function acquisitionEventsForCurrentIds({ chain, provider, contract, wallet, tokenIds, blockscoutBase = null }) {
  const wanted = new Set((tokenIds || []).map(String));
  const out = {};
  const diagnostics = [];
  if (!wanted.size) return { events: out, diagnostics };

  let rows = [];
  if (blockscoutBase) rows = await blockscoutLegacyNftTransfers(blockscoutBase, wallet, contract);
  diagnostics.push(`Blockscout transfer rows for current NFTs: ${rows.length}`);

  for (const idValue of wanted) {
    const inbound = rows
      .filter(x => String(x.tokenID || x.tokenId || x.token_id || '') === idValue)
      .filter(x => String(x.to || '').toLowerCase() === wallet.toLowerCase())
      .sort((a,b) => Number(a.blockNumber || a.block_number || 0) - Number(b.blockNumber || b.block_number || 0))[0];
    if (!inbound) continue;
    let timestamp = Number(inbound.timeStamp || inbound.timestamp || 0) || null;
    const blockNumber = Number(inbound.blockNumber || inbound.block_number || 0);
    if (!timestamp && blockNumber) {
      try { timestamp = Number((await provider.getBlock(blockNumber)).timestamp); } catch {}
    }
    const from = String(inbound.from || '');
    const event = {
      blockNumber,
      txHash: inbound.hash || inbound.transactionHash || inbound.transaction_hash || null,
      tokenId: idValue,
      from: from || null,
      to: wallet,
      timestamp,
      eventType: from.toLowerCase() === ZeroAddress.toLowerCase() ? 'mint-to-wallet' : 'transfer-to-wallet',
      source: `${chain}-blockscout: first inbound current veNFT transfer`,
      confidence: 'high'
    };
    if (timestamp) {
      event.acquiredAt = isoFromTs(timestamp);
      event.acquiredISO = event.acquiredAt.slice(0, 10);
    }
    out[idValue] = event;
  }
  return { events: out, diagnostics };
}

async function discoverStandardVe({
  providerKey, chainLabel, wallet, token, votingEscrow, blockscoutBase,
  symbol, amountField, cgId, llamaChain
}) {
  return await withProvider(providerKey, async provider => {
    const abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function ownerToNFTokenIdList(address owner,uint256 index) view returns (uint256)',
      'function locked(uint256 tokenId) view returns (int128 amount,uint256 end,bool isPermanent)',
      'function idToManaged(uint256 tokenId) view returns (uint256)',
      'function weights(uint256 tokenId,uint256 managedTokenId) view returns (uint256)',
      'function escrowType(uint256 tokenId) view returns (uint8)'
    ];
    const ve = new Contract(votingEscrow, abi, provider);
    const count = Number(await ve.balanceOf(wallet));
    const positions = [];
    let economicPrincipalRaw = 0n;

    for (let i = 0; i < count; i++) {
      const tokenId = await ve.ownerToNFTokenIdList(wallet, i);
      let managedId = 0n;
      try { managedId = await ve.idToManaged(tokenId); } catch {}
      let amountRaw = 0n, end = 0n, isPermanent = false, escrowType = 0;
      try {
        const l = await ve.locked(tokenId);
        amountRaw = positiveBigInt(l.amount);
        end = BigInt(l.end);
        isPermanent = Boolean(l.isPermanent);
      } catch {}
      try { escrowType = Number(await ve.escrowType(tokenId)); } catch {}
      let managedWeightRaw = 0n;
      if (managedId > 0n) {
        try { managedWeightRaw = positiveBigInt(await ve.weights(tokenId, managedId)); } catch {}
      }
      const economicRaw = managedWeightRaw > 0n ? managedWeightRaw : amountRaw;
      economicPrincipalRaw += economicRaw;
      positions.push({
        tokenId: tokenId.toString(),
        escrowType,
        managedTokenId: managedId.toString(),
        [`directLocked${symbol}`]: Number(formatUnits(amountRaw, 18)),
        [`managedWeight${symbol}`]: Number(formatUnits(managedWeightRaw, 18)),
        [`economicPrincipal${symbol}`]: Number(formatUnits(economicRaw, 18)),
        lockEnd: end > 0n ? isoFromTs(end) : null,
        isPermanent
      });
    }

    // Keep successfully read current veVELO state even if historical discovery is unavailable.
    // Use sparse Blockscout v2 per-instance history instead of a full-chain Transfer backfill.
    let mint = { first: null, candidates: [], diagnostics: [] };
    let acq = { events: {}, diagnostics: [] };
    try {
      const hist = await currentNftHistoryV2({
        baseUrl: blockscoutBase, contract: votingEscrow, wallet,
        tokenIds: positions.map(x => x.tokenId), provider, chain: providerKey
      });
      mint = { first: hist.first, candidates: hist.candidates, diagnostics: hist.diagnostics };
      acq = { events: hist.events, diagnostics: hist.diagnostics };
    } catch (e) {
      mint.diagnostics.push(`Non-fatal historical discovery error: ${errMsg(e)}`);
    }

    let entryPrice = null;
    const eventForEntry = Object.values(acq.events).sort((a,b)=>(a.blockNumber||0)-(b.blockNumber||0))[0] || mint.first || null;
    if (eventForEntry?.timestamp) {
      const normalizedEvent = {
        ...eventForEntry,
        foundedAt: eventForEntry.foundedAt || eventForEntry.acquiredAt || isoFromTs(eventForEntry.timestamp),
        foundedISO: eventForEntry.foundedISO || eventForEntry.acquiredISO || isoFromTs(eventForEntry.timestamp).slice(0,10)
      };
      entryPrice = await marketHistory({
        coingeckoId: cgId, llamaChain, token, event: normalizedEvent, symbol
      });
    }

    return {
      wallet,
      chain: chainLabel,
      token,
      votingEscrow,
      currentVeNftCount: count,
      positions,
      [`economicPrincipal${symbol}`]: Number(formatUnits(economicPrincipalRaw, 18)),
      firstLock: mint.first,
      firstLockCandidates: mint.candidates,
      currentNftAcquisitionEvents: acq.events,
      entryPrice,
      discoveryDiagnostics: [...new Set([...(mint.diagnostics || []), ...(acq.diagnostics || [])])]
    };
  });
}

async function discoverVelodrome() {
  return discoverStandardVe({
    providerKey: 'optimism',
    chainLabel: 'Optimism',
    wallet: COMPANY.wallets.aerodrome.address,
    token: ADDR.velodrome.token,
    votingEscrow: ADDR.velodrome.votingEscrow,
    blockscoutBase: 'https://optimism.blockscout.com',
    symbol: 'Velo',
    amountField: 'VELO',
    cgId: 'velodrome-finance',
    llamaChain: 'optimism'
  });
}

async function discoverAerodrome() {
  const wallet = COMPANY.wallets.aerodrome.address;
  return await withProvider('base', async provider => {
    const abi = [
      'function balanceOf(address owner) view returns (uint256)',
      'function ownerToNFTokenIdList(address owner,uint256 index) view returns (uint256)',
      'function locked(uint256 tokenId) view returns (int128 amount,uint256 end,bool isPermanent)',
      'function idToManaged(uint256 tokenId) view returns (uint256)',
      'function weights(uint256 tokenId,uint256 managedTokenId) view returns (uint256)',
      'function escrowType(uint256 tokenId) view returns (uint8)'
    ];
    const ve = new Contract(ADDR.aerodrome.votingEscrow, abi, provider);
    const count = Number(await ve.balanceOf(wallet));
    const positions = [];
    let economicPrincipalRaw = 0n;
    for (let i = 0; i < count; i++) {
      const tokenId = await ve.ownerToNFTokenIdList(wallet, i);
      let managedId = 0n;
      try { managedId = await ve.idToManaged(tokenId); } catch {}
      let amountRaw = 0n, end = 0n, isPermanent = false, escrowType = 0;
      try {
        const l = await ve.locked(tokenId);
        amountRaw = positiveBigInt(l.amount);
        end = BigInt(l.end);
        isPermanent = Boolean(l.isPermanent);
      } catch {}
      try { escrowType = Number(await ve.escrowType(tokenId)); } catch {}
      let managedWeightRaw = 0n;
      if (managedId > 0n) {
        try { managedWeightRaw = positiveBigInt(await ve.weights(tokenId, managedId)); } catch {}
      }
      const economicRaw = managedWeightRaw > 0n ? managedWeightRaw : amountRaw;
      economicPrincipalRaw += economicRaw;
      positions.push({
        tokenId: tokenId.toString(),
        escrowType,
        managedTokenId: managedId.toString(),
        directLockedAero: Number(formatUnits(amountRaw, 18)),
        managedWeightAero: Number(formatUnits(managedWeightRaw, 18)),
        economicPrincipalAero: Number(formatUnits(economicRaw, 18)),
        lockEnd: end > 0n ? isoFromTs(end) : null,
        isPermanent
      });
    }

    const mint = await earliestMintToWallet({
      chain: 'base', provider,
      contract: ADDR.aerodrome.votingEscrow,
      wallet,
      blockscoutBase: 'https://base.blockscout.com'
    });
    const acq = await acquisitionEventsForCurrentIds({
      chain: 'base', provider,
      contract: ADDR.aerodrome.votingEscrow,
      wallet,
      tokenIds: positions.map(x => x.tokenId),
      blockscoutBase: 'https://base.blockscout.com'
    });

    // Owner-confirmed acquisition classification:
    // 64985 = market-purchased capital; 69194 = airdrop, therefore $0 cost basis.
    const acquisitionByTokenId = {
      '64985': { type: 'market-purchased', costBasisRule: 'historical AERO price at first verified lock' },
      '69194': { type: 'airdrop', costBasisRule: 'zero' }
    };
    for (const p of positions) {
      p.acquisition = acquisitionByTokenId[p.tokenId] || { type: 'unknown', costBasisRule: 'requires-owner-or-onchain-review' };
      p.acquisitionEvent = acq.events[p.tokenId] || null;
    }

    let entryPrice = null;
    if (mint.first?.timestamp) {
      entryPrice = await marketHistory({
        coingeckoId: 'aerodrome-finance',
        llamaChain: 'base',
        token: ADDR.aerodrome.token,
        event: mint.first,
        symbol: 'AERO'
      });
    }
    return {
      wallet,
      token: ADDR.aerodrome.token,
      votingEscrow: ADDR.aerodrome.votingEscrow,
      currentVeNftCount: count,
      positions,
      economicPrincipalAero: Number(formatUnits(economicPrincipalRaw, 18)),
      firstLock: mint.first,
      firstLockCandidates: mint.candidates,
      currentNftAcquisitionEvents: acq.events,
      entryPrice,
      acquisitionPolicy: {
        publicPresentation: 'aggregate both current veAERO NFTs into one AERO / veAERO balance line',
        tokenId64985: 'market-purchased; historical lock-date price is paid-capital cost basis',
        tokenId69194: 'owner-confirmed airdrop; cost basis = 0; current value contributes fully to company performance'
      },
      discoveryDiagnostics: [...new Set([...(mint.diagnostics || []), ...(acq.diagnostics || [])])]
    };
  });
}

async function discoverYieldBasis() {
  const wallet = COMPANY.wallets.yieldBasis.address;
  return await withProvider('ethereum', async provider => {
    const abi = [
      'function locked(address) view returns (int256 amount,uint256 end)',
      'function balanceOf(address owner) view returns (uint256)'
    ];
    const ve = new Contract(ADDR.yieldBasis.votingEscrow, abi, provider);
    const locked = await ve.locked(wallet);
    const amountRaw = positiveBigInt(locked.amount);
    const nftBalance = safeNumber(await ve.balanceOf(wallet));

    const mint = await earliestMintToWallet({
      chain: 'ethereum', provider,
      contract: ADDR.yieldBasis.votingEscrow,
      wallet,
      blockscoutBase: 'https://eth.blockscout.com'
    });
    let entryPrice = null;
    if (mint.first?.timestamp) {
      entryPrice = await marketHistory({
        coingeckoId: 'yield-basis',
        llamaChain: 'ethereum',
        token: ADDR.yieldBasis.token,
        event: mint.first,
        symbol: 'YB'
      });
    }
    return {
      wallet,
      token: ADDR.yieldBasis.token,
      votingEscrow: ADDR.yieldBasis.votingEscrow,
      feeDistributor: ADDR.yieldBasis.feeDistributor,
      veNftBalance: nftBalance,
      expectedTokenIdFromAddress: BigInt(wallet).toString(),
      economicPrincipalYb: Number(formatUnits(amountRaw, 18)),
      lockEnd: BigInt(locked.end) > 0n ? isoFromTs(locked.end) : null,
      firstLock: mint.first,
      firstLockCandidates: mint.candidates,
      entryPrice,
      discoveryDiagnostics: mint.diagnostics
    };
  });
}

function buildProposedBook(aero, velo, yb, currentPrices) {
  const a = aero?.result || null;
  const v = velo?.result || null;
  const y = yb?.result || null;

  const aQty = safeNumber(a?.economicPrincipalAero);
  const vQty = safeNumber(v?.economicPrincipalVelo);
  const yQty = safeNumber(y?.economicPrincipalYb);
  const aMarketEntry = safeNumber(a?.entryPrice?.usd);
  const vEntry = safeNumber(v?.entryPrice?.usd);
  const yEntry = safeNumber(y?.entryPrice?.usd);

  const aeroPaidPosition = (a?.positions || []).find(x => x.tokenId === '64985') || null;
  const aeroAirdropPosition = (a?.positions || []).find(x => x.tokenId === '69194') || null;
  const aeroPaidQty = safeNumber(aeroPaidPosition?.economicPrincipalAero);
  const aeroAirdropQty = safeNumber(aeroAirdropPosition?.economicPrincipalAero);

  const rows = [];

  if (aQty !== null && aQty > 0) {
    const paidCost = (aeroPaidQty !== null && aMarketEntry !== null) ? aeroPaidQty * aMarketEntry : null;
    const effectiveEntry = paidCost !== null && aQty > 0 ? paidCost / aQty : null;
    rows.push({
      id: 'aerodrome-finance',
      symbol: 'AERO / veAERO',
      qty: aQty,
      entry: effectiveEntry,
      costBasisOverrideUsd: paidCost,
      classification: 'productive',
      walletAlias: COMPANY.wallets.aerodrome.alias,
      publicAggregation: 'one AERO / veAERO line',
      acquisitionBreakdown: [
        {
          tokenId: '64985',
          qty: aeroPaidQty,
          acquisition: 'market-purchased',
          entry: aMarketEntry,
          costBasisUsd: paidCost,
          entryMethod: 'historical AERO market price at first verified veAERO lock'
        },
        {
          tokenId: '69194',
          qty: aeroAirdropQty,
          acquisition: 'airdrop',
          entry: 0,
          costBasisUsd: 0,
          entryMethod: 'owner-confirmed airdrop; zero acquisition cost'
        }
      ],
      entryMethod: 'weighted effective entry for one public AERO line; internal paid + airdrop cost basis preserved'
    });
  }

  if (vQty !== null && vQty > 0) rows.push({
    id: 'velodrome-finance',
    symbol: 'VELO / veVELO',
    qty: vQty,
    entry: vEntry,
    classification: 'productive',
    walletAlias: COMPANY.wallets.aerodrome.alias,
    entryMethod: 'historical VELO market price at first verified veVELO lock/acquisition'
  });

  if (yQty !== null && yQty > 0) rows.push({
    id: 'yield-basis',
    symbol: 'YB / veYB',
    qty: yQty,
    entry: yEntry,
    classification: 'productive',
    walletAlias: COMPANY.wallets.yieldBasis.alias,
    entryMethod: 'historical YB market price at first verified veYB lock'
  });

  const enriched = rows.map(r => {
    const px = safeNumber(currentPrices?.[r.id]);
    const currentValue = px !== null ? r.qty * px : null;
    const costBasis = r.costBasisOverrideUsd !== undefined
      ? safeNumber(r.costBasisOverrideUsd)
      : (r.entry !== null ? r.qty * r.entry : null);
    return {
      ...r,
      currentPriceUsdAtDiscovery: px,
      currentValueUsdAtDiscovery: currentValue,
      costBasisUsd: costBasis,
      performanceUsdAtDiscovery: currentValue !== null && costBasis !== null ? currentValue - costBasis : null
    };
  });

  const valued = enriched.filter(r => r.currentValueUsdAtDiscovery !== null);
  const costed = enriched.filter(r => r.costBasisUsd !== null);
  const totalCurrent = valued.length === enriched.length ? enriched.reduce((s,r)=>s+r.currentValueUsdAtDiscovery,0) : null;
  const totalCost = costed.length === enriched.length ? enriched.reduce((s,r)=>s+r.costBasisUsd,0) : null;

  return {
    positions: enriched,
    totalCurrentValueUsdAtDiscovery: totalCurrent,
    totalCostBasisUsd: totalCost,
    performanceUsdAtDiscovery: totalCurrent !== null && totalCost !== null ? totalCurrent - totalCost : null,
    performancePctAtDiscovery: totalCurrent !== null && totalCost !== null && totalCost > 0
      ? (totalCurrent / totalCost - 1) * 100 : null
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const errors = {};
  let aerodrome = null, velodrome = null, yieldBasis = null;
  try { aerodrome = await discoverAerodrome(); } catch (e) { errors.aerodrome = errMsg(e); }
  try { velodrome = await discoverVelodrome(); } catch (e) { errors.velodrome = errMsg(e); }
  try { yieldBasis = await discoverYieldBasis(); } catch (e) { errors.yieldBasis = errMsg(e); }
  const currentPrices = await cgCurrent(['aerodrome-finance','velodrome-finance','yield-basis']);
  const proposedCompanyBook = buildProposedBook(aerodrome, velodrome, yieldBasis, currentPrices);
  const founded = aerodrome?.result?.firstLock || null;

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    purpose: 'Company #006 deterministic onboarding discovery v1.2: resilient veVELO current-state + Blockscout-v2 history; AERO paid/airdrop + veYB; no production metrics are changed by this file.',
    company: {
      registry: COMPANY.registry,
      name: COMPANY.name,
      foundingRule: 'first verified veAERO lock on Aerodrome wallet',
      foundedAt: founded?.foundedAt || null,
      foundedISO: founded?.foundedISO || null,
      wallets: Object.values(COMPANY.wallets)
    },
    aerodrome: aerodrome?.result || null,
    velodrome: velodrome?.result || null,
    yieldBasis: yieldBasis?.result || null,
    proposedCompanyBook,
    knownAdapterReuse: {
      productivity: ['aerodrome_veaero','velodrome_vevelo','yieldbasis_veyb'],
      rewards: [
        { route: 'aerodrome-ve', walletAlias: COMPANY.wallets.aerodrome.alias },
        { route: 'velodrome-ve-direct', walletAlias: COMPANY.wallets.aerodrome.alias },
        { route: 'yield-basis-fees', walletAlias: COMPANY.wallets.yieldBasis.alias }
      ],
      note: 'Company #006 should use wallet-scoped reward routes rather than running every route against every company wallet.'
    },
    errors
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`Company #006 discovery written: ${OUTPUT}`);
  console.log(`Founding date: ${output.company.foundedISO || 'unresolved'}`);
  console.log(`AERO principal: ${output.aerodrome?.economicPrincipalAero ?? 'unresolved'}`);
  console.log(`VELO principal: ${output.velodrome?.economicPrincipalVelo ?? 'unresolved'}`);
  console.log(`YB principal: ${output.yieldBasis?.economicPrincipalYb ?? 'unresolved'}`);
  if (Object.keys(errors).length) console.warn('Discovery errors:', errors);
}

main().catch(e => {
  console.error(errMsg(e));
  process.exit(1);
});
