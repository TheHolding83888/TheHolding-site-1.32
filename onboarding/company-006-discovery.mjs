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

const VERSION = '1.0';
const OUTPUT = process.env.COMPANY_006_DISCOVERY_OUTPUT || path.resolve('companies/company-006-discovery.json');
const CG_KEY = process.env.COINGECKO_API_KEY || '';

const COMPANY = {
  registry: '006',
  name: 'aerocrvyb.eth',
  wallets: {
    aerodrome: {
      alias: 'Aerodrome wallet',
      address: getAddress('0xa641752824d512fa8683758c6b2d8a04ea46dcd0'),
      chain: 'Base',
      route: 'aerodrome-ve'
    },
    yieldBasis: {
      alias: 'Yield Basis wallet',
      address: getAddress('0x6c6543eba07946706fd10a1064fa773326b5f5a9'),
      chain: 'Ethereum',
      route: 'yield-basis-fees'
    }
  }
};

const ADDR = {
  aerodrome: {
    token: getAddress('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),
    votingEscrow: getAddress('0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4')
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
    const provider = new JsonRpcProvider(url, undefined, { staticNetwork: false });
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
    const secret = [process.env.BASE_RPC_URL, process.env.BASE_RPC_URL_2, process.env.ETH_RPC_URL].filter(Boolean).includes(url);
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
    let entryPrice = null;
    if (mint.first?.foundedISO) {
      try { entryPrice = await cgHistory('aerodrome-finance', mint.first.foundedISO); }
      catch (e) { entryPrice = { coingeckoId: 'aerodrome-finance', date: mint.first.foundedISO, usd: null, status: 'unavailable', error: errMsg(e) }; }
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
      entryPrice,
      discoveryDiagnostics: mint.diagnostics
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
    if (mint.first?.foundedISO) {
      try { entryPrice = await cgHistory('yield-basis', mint.first.foundedISO); }
      catch (e) { entryPrice = { coingeckoId: 'yield-basis', date: mint.first.foundedISO, usd: null, status: 'unavailable', error: errMsg(e) }; }
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

function buildProposedBook(aero, yb, currentPrices) {
  const aQty = safeNumber(aero?.result?.economicPrincipalAero);
  const yQty = safeNumber(yb?.result?.economicPrincipalYb);
  const aEntry = safeNumber(aero?.result?.entryPrice?.usd);
  const yEntry = safeNumber(yb?.result?.entryPrice?.usd);
  const rows = [];
  if (aQty !== null && aQty > 0) rows.push({
    id: 'aerodrome-finance', symbol: 'AERO / veAERO', qty: aQty,
    entry: aEntry, classification: 'productive', walletAlias: COMPANY.wallets.aerodrome.alias,
    entryMethod: 'daily AERO market price on first verified veAERO lock date'
  });
  if (yQty !== null && yQty > 0) rows.push({
    id: 'yield-basis', symbol: 'YB / veYB', qty: yQty,
    entry: yEntry, classification: 'productive', walletAlias: COMPANY.wallets.yieldBasis.alias,
    entryMethod: 'daily YB market price on first verified veYB lock date'
  });
  const enriched = rows.map(r => {
    const px = safeNumber(currentPrices?.[r.id]);
    const currentValue = px !== null ? r.qty * px : null;
    const costBasis = r.entry !== null ? r.qty * r.entry : null;
    return { ...r, currentPriceUsdAtDiscovery: px, currentValueUsdAtDiscovery: currentValue, costBasisUsd: costBasis, performanceUsdAtDiscovery: currentValue !== null && costBasis !== null ? currentValue - costBasis : null };
  });
  const totalCurrent = enriched.reduce((s,r)=>s+(r.currentValueUsdAtDiscovery || 0),0);
  const totalCost = enriched.reduce((s,r)=>s+(r.costBasisUsd || 0),0);
  return {
    positions: enriched,
    totalCurrentValueUsdAtDiscovery: totalCurrent || null,
    totalCostBasisUsd: totalCost || null,
    performanceUsdAtDiscovery: totalCurrent && totalCost ? totalCurrent - totalCost : null,
    performancePctAtDiscovery: totalCurrent && totalCost ? (totalCurrent / totalCost - 1) * 100 : null
  };
}

async function main() {
  const startedAt = new Date().toISOString();
  const errors = {};
  let aerodrome = null, yieldBasis = null;
  try { aerodrome = await discoverAerodrome(); } catch (e) { errors.aerodrome = errMsg(e); }
  try { yieldBasis = await discoverYieldBasis(); } catch (e) { errors.yieldBasis = errMsg(e); }
  const currentPrices = await cgCurrent(['aerodrome-finance','yield-basis']);
  const proposedCompanyBook = buildProposedBook(aerodrome, yieldBasis, currentPrices);
  const founded = aerodrome?.result?.firstLock || null;

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    purpose: 'Company #006 deterministic onboarding discovery; no production metrics are changed by this file.',
    company: {
      registry: COMPANY.registry,
      name: COMPANY.name,
      foundingRule: 'first verified veAERO lock on Aerodrome wallet',
      foundedAt: founded?.foundedAt || null,
      foundedISO: founded?.foundedISO || null,
      wallets: Object.values(COMPANY.wallets)
    },
    aerodrome: aerodrome?.result || null,
    yieldBasis: yieldBasis?.result || null,
    proposedCompanyBook,
    knownAdapterReuse: {
      productivity: ['aerodrome_veaero','yieldbasis_veyb'],
      rewards: [
        { route: 'aerodrome-ve', walletAlias: COMPANY.wallets.aerodrome.alias },
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
  console.log(`YB principal: ${output.yieldBasis?.economicPrincipalYb ?? 'unresolved'}`);
  if (Object.keys(errors).length) console.warn('Discovery errors:', errors);
}

main().catch(e => {
  console.error(errMsg(e));
  process.exit(1);
});
