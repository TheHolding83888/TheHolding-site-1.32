import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION = '1.3-company-008-stable-diagnostic-safe-sbold';
const EXPECTED_PRIOR = '1.1-company-008-stable-wrapper-reconciliation';
const INPUT = process.env.COMPANY_008_RESOLVE_INPUT || path.resolve('companies/company-008-resolve.json');
const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT || path.resolve('companies/company-008-resolve.json');

// Canonicalize every literal from lowercase. This deliberately avoids ethers v6
// mixed-case checksum fail-fast errors during module initialization.
const A = (x) => getAddress(String(x).toLowerCase());
const WALLET = A('0x888d39aee2aec979c81f125ea94bb3ceb60f6bbb');
const ADDR = Object.freeze({
  bold: A('0x6440f144b7e50d6a8439336510312d2f54beb01d'),
  weth: A('0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'),
  wsteth: A('0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0'),
  reth: A('0xae78736cd615f374d3085123a210448e74fc6393'),
  // Liquity V2 Stability Pools. Direct-SP probing is diagnostic-safe; sBOLD is
  // also probed because Liquity officially documents it as an ERC-4626 vault.
  liquitySpWeth: A('0x5721cbbd64fc7ae3ef44a0a3f9a790a9264cf9bf'),
  liquitySpWsteth: A('0x9502b7c397e9aa22fe9db7ef7daf21cd2aebe56b'),
  liquitySpReth: A('0xd442e41019b7f5c4dd78f50dc03726c446148695'),
  sBold: A('0x50bd66d59911f5e086ec87ae43c811e0d059dd11'),
  // Lido Earn USD official deployment.
  earnUsdShareManager: A('0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981'),
  earnUsdVault: A('0x014e6da8f283c4af65b2aa0f201438680a004452'),
  earnUsdOracle: A('0x827044735c9708a2cf850e7ea37eba43bc786028'),
  // Frax current Ethereum sfrxUSD / frxUSD.
  sfrxUsd: A('0xcf62f905562626cfcdd2261162a51fd02fc9c5b6'),
  frxUsd: A('0xcacd6fd266af91b8aed52accc382b4e165586e29'),
  ysyBold: A('0x23346b04a7f55b8760e5860aa5a77383d63491cd')
});

const RPC_URLS = [
  process.env.ETH_RPC_URL,
  process.env.ETH_RPC_URL_2,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com'
].filter(Boolean);

function lower(x) { return String(x || '').toLowerCase(); }
function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function sha256(x) { return crypto.createHash('sha256').update(String(x)).digest('hex'); }
function err(e) { return String(e?.shortMessage || e?.message || e || 'unknown').slice(0, 1200); }
function positive(x) { try { const n = BigInt(x); return n > 0n ? n : 0n; } catch { return 0n; } }

async function fetchJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'The-Holding-Monetra-Stable-Resolver/1.3' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function selectProvider() {
  const errors = [];
  for (const url of RPC_URLS) {
    const provider = new JsonRpcProvider(url);
    try {
      const block = await provider.getBlockNumber();
      return { provider, providerHost: new URL(url).hostname, block, errors };
    } catch (e) {
      errors.push(`${new URL(url).hostname}: ${err(e)}`);
    }
  }
  return { provider: null, providerHost: null, block: null, errors };
}

async function llamaPrice(address) {
  const key = `ethereum:${lower(address)}`;
  try {
    const j = await fetchJson(`https://coins.llama.fi/prices/current/${encodeURIComponent(key)}`, 15000);
    const hit = j?.coins?.[key] || j?.coins?.[`ethereum:${address}`];
    const price = Number(hit?.price);
    if (Number.isFinite(price) && price > 0) return { status: 'ok', priceUsd: price, source: 'defillama-contract:ethereum' };
    return { status: 'unavailable', priceUsd: null, source: 'defillama-contract:ethereum' };
  } catch (e) {
    return { status: 'unavailable', priceUsd: null, source: 'defillama-contract:ethereum', error: err(e) };
  }
}

async function tokenMeta(provider, address) {
  const c = new Contract(address, [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)'
  ], provider);
  let symbol = null, name = null, decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { name = await c.name(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  return { address: A(address), symbol, name, decimals };
}

async function tokenHistory() {
  const base = `https://eth.blockscout.com/api/v2/addresses/${WALLET}/token-transfers?type=ERC-20`;
  const items = [];
  let url = base;
  let pages = 0;
  const seen = new Set();
  while (url && pages < 100 && !seen.has(url)) {
    seen.add(url);
    const j = await fetchJson(url, 25000);
    items.push(...(j?.items || []));
    pages += 1;
    if (!j?.next_page_params) break;
    const u = new URL(base);
    for (const [k, v] of Object.entries(j.next_page_params)) if (v != null) u.searchParams.set(k, String(v));
    url = u.toString();
  }
  return { items, pages };
}

function addrFrom(x) {
  if (!x) return null;
  if (typeof x === 'string') return x;
  return x.hash || x.address || x.address_hash || null;
}
function tokenAddr(tf) {
  const t = tf?.token || {};
  return t.address || t.address_hash || t.token_address || tf?.address_hash || tf?.token_address || null;
}
function transferTimestamp(tf) { return tf?.timestamp || tf?.block_timestamp || null; }
function earliestTokenInbound(history, token) {
  const rows = (history?.items || []).filter(tf => lower(tokenAddr(tf)) === lower(token) && lower(addrFrom(tf.to)) === lower(WALLET));
  rows.sort((a, b) => new Date(transferTimestamp(a) || 0) - new Date(transferTimestamp(b) || 0));
  const r = rows[0];
  if (!r) return null;
  return {
    timestamp: transferTimestamp(r),
    block: Number(r.block_number ?? r.block ?? 0) || null,
    txHash: r.transaction_hash || r.tx_hash || r.hash || null,
    from: addrFrom(r.from),
    token: A(token)
  };
}
function earliestBoldDepositToSp(history, sp) {
  const rows = (history?.items || []).filter(tf => lower(tokenAddr(tf)) === lower(ADDR.bold) && lower(addrFrom(tf.from)) === lower(WALLET) && lower(addrFrom(tf.to)) === lower(sp));
  rows.sort((a, b) => new Date(transferTimestamp(a) || 0) - new Date(transferTimestamp(b) || 0));
  const r = rows[0];
  if (!r) return null;
  return { timestamp: transferTimestamp(r), block: Number(r.block_number ?? r.block ?? 0) || null, txHash: r.transaction_hash || r.tx_hash || r.hash || null, token: ADDR.bold, to: A(sp) };
}

async function safeModule(label, fn) {
  try {
    const result = await fn();
    return { ok: true, label, result, error: null };
  } catch (e) {
    return { ok: false, label, result: null, error: err(e) };
  }
}

async function resolve4626Like({ provider, history, wrapper, fallbackAsset, protocol, positionType, name, wrapperSymbol, ownerHintMatched, incomeMode, allowWrapperPriceFallback = true, methodologyNote = null }) {
  const c = new Contract(wrapper, [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function asset() view returns (address)',
    'function previewRedeem(uint256) view returns (uint256)',
    'function convertToAssets(uint256) view returns (uint256)'
  ], provider);
  const balanceProbe = await safeModule(`${wrapperSymbol}.balanceOf`, () => c.balanceOf(WALLET));
  if (!balanceProbe.ok) return { status: 'probe-error', error: balanceProbe.error, wrapper };
  const shareRaw = positive(balanceProbe.result);
  if (shareRaw <= 0n) return { status: 'absent', wrapper };

  let decimals = 18;
  try { decimals = Number(await c.decimals()); } catch {}
  const shares = Number(formatUnits(shareRaw, decimals));
  let asset = fallbackAsset ? A(fallbackAsset) : null;
  try { asset = A(await c.asset()); } catch {}

  let assetsRaw = 0n;
  let redeemMethod = null;
  let redeemError = null;
  try {
    assetsRaw = positive(await c.previewRedeem(shareRaw));
    redeemMethod = 'previewRedeem';
  } catch (e1) {
    try {
      assetsRaw = positive(await c.convertToAssets(shareRaw));
      redeemMethod = 'convertToAssets';
    } catch (e2) {
      redeemError = `${err(e1)} | ${err(e2)}`;
    }
  }

  if (asset && assetsRaw > 0n) {
    const assetMeta = await tokenMeta(provider, asset);
    const assets = Number(formatUnits(assetsRaw, assetMeta.decimals));
    const price = await llamaPrice(asset);
    const valueUsd = price.priceUsd != null ? assets * price.priceUsd : null;
    return {
      status: valueUsd != null ? 'ok' : 'unpriced',
      position: {
        id: `ethereum:${lower(wrapper)}`,
        chain: 'Ethereum', protocol, positionType, wrapper: A(wrapper), token: null,
        wrapperSymbol, symbol: null, name,
        sharesOrBalance: round(shares), shareRaw: shareRaw.toString(),
        underlying: asset, underlyingSymbol: assetMeta.symbol || null,
        redeemableUnderlying: round(assets),
        economicValuation: {
          status: valueUsd != null ? 'ok' : 'unpriced', terminalType: 'stable-asset', terminal: asset,
          terminalSymbol: assetMeta.symbol || null, terminalAmount: round(assets), price,
          valueUsd: valueUsd != null ? round(valueUsd, 12) : null,
          path: [
            { token: A(wrapper), symbol: wrapperSymbol, amount: round(shares), standard: 'ERC-4626-like', redeemMethod, redeemableToken: asset, redeemableSymbol: assetMeta.symbol || null, redeemableAmount: round(assets) },
            { token: asset, symbol: assetMeta.symbol || null, amount: round(assets) }
          ]
        },
        valueUsd: valueUsd != null ? round(valueUsd, 6) : null,
        valuationStatus: valueUsd != null ? 'ok' : 'unpriced', valuationCanonical: valueUsd != null,
        incomeMode, productive: true, ownerHintMatched,
        history: {
          firstObservedInbound: earliestTokenInbound(history, wrapper),
          currentCheckpoint: { timestamp: new Date().toISOString(), sharesOrBalance: round(shares), economicValueUsd: valueUsd != null ? round(valueUsd, 6) : null, terminalUnderlying: asset, terminalUnderlyingSymbol: assetMeta.symbol || null, terminalUnderlyingAmount: round(assets) }
        },
        methodology: methodologyNote || `${wrapperSymbol} balance -> ${redeemMethod} -> underlying -> USD`
      }
    };
  }

  if (allowWrapperPriceFallback) {
    const wrapperPrice = await llamaPrice(wrapper);
    const valueUsd = wrapperPrice.priceUsd != null ? shares * wrapperPrice.priceUsd : null;
    return {
      status: valueUsd != null ? 'ok-provisional-wrapper-price' : 'unresolved',
      position: valueUsd != null ? {
        id: `ethereum:${lower(wrapper)}`, chain: 'Ethereum', protocol, positionType,
        wrapper: A(wrapper), token: null, wrapperSymbol, symbol: null, name,
        sharesOrBalance: round(shares), shareRaw: shareRaw.toString(), underlying: asset,
        underlyingSymbol: null, redeemableUnderlying: null,
        economicValuation: { status: 'ok-provisional-wrapper-price', terminalType: 'wrapper-market', terminal: A(wrapper), terminalSymbol: wrapperSymbol, terminalAmount: round(shares), price: wrapperPrice, valueUsd: round(valueUsd, 12), redeemError },
        valueUsd: round(valueUsd, 6), valuationStatus: 'ok-provisional-wrapper-price', valuationCanonical: false,
        incomeMode, productive: true, ownerHintMatched,
        history: { firstObservedInbound: earliestTokenInbound(history, wrapper), currentCheckpoint: { timestamp: new Date().toISOString(), sharesOrBalance: round(shares), economicValueUsd: round(valueUsd, 6), priceSource: wrapperPrice.source || null } },
        methodology: methodologyNote || `${wrapperSymbol} direct balance; current-book fallback uses wrapper market price because canonical redemption read failed`,
        diagnostic: { redeemError }
      } : null,
      error: redeemError
    };
  }

  return { status: 'unresolved', wrapper, shares: round(shares), error: redeemError };
}

function lidoFallbackFromPrior(prior) {
  const rows = prior?.stableCapital?.unresolved || [];
  const r = rows.find(x => lower(x?.token) === lower(ADDR.earnUsdShareManager) || lower(x?.symbol) === 'earnusd');
  if (!r || !Number.isFinite(Number(r.amount))) return null;
  const amount = Number(r.amount);
  const price = r.wrapperMarketPrice || null;
  const valueUsd = Number.isFinite(Number(r.approxUsd)) ? Number(r.approxUsd) : (Number.isFinite(Number(price?.priceUsd)) ? amount * Number(price.priceUsd) : null);
  if (valueUsd == null) return null;
  return {
    id: `ethereum:${lower(ADDR.earnUsdShareManager)}`,
    chain: 'Ethereum', protocol: 'Lido Earn', positionType: 'Agent / Curator Managed Stable Vault',
    wrapper: ADDR.earnUsdShareManager, token: null, wrapperSymbol: 'earnUSD', symbol: null,
    name: 'Lido Earn USD', sharesOrBalance: round(amount), shareRaw: null,
    underlying: null, underlyingSymbol: 'USD-denominated strategy basket', redeemableUnderlying: null,
    economicValuation: { status: 'ok-preserved-current-market', terminalType: 'stable-strategy-share', terminal: ADDR.earnUsdShareManager, terminalSymbol: 'earnUSD', terminalAmount: round(amount), price, valueUsd: round(valueUsd, 12), sourceBoundary: 'preserved reproducible v1.1 Blockscout + DeFiLlama observation' },
    valueUsd: round(valueUsd, 6), valuationStatus: 'ok-preserved-current-market', valuationCanonical: true,
    incomeMode: 'agent-managed-embedded-yield', productive: true, ownerHintMatched: 'Lido',
    history: { firstObservedInbound: r?.history?.firstObservedInbound || null, currentCheckpoint: { timestamp: new Date().toISOString(), sharesOrBalance: round(amount), economicValueUsd: round(valueUsd, 6), preservedFrom: EXPECTED_PRIOR } },
    officialArchitecture: { vault: ADDR.earnUsdVault, shareManager: ADDR.earnUsdShareManager, oracle: ADDR.earnUsdOracle },
    methodology: 'current Stable Capital valuation preserves v1.1 reproducible earnUSD balance/price; Embedded Yield history must use official Lido/Mellow share/oracle accounting'
  };
}

async function resolveLido(provider, history, prior) {
  const c = new Contract(ADDR.earnUsdShareManager, [
    'function sharesOf(address) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)'
  ], provider);
  let raw = 0n;
  let balanceMethod = null;
  let liveErrors = [];
  try { raw = positive(await c.sharesOf(WALLET)); balanceMethod = 'ShareManager.sharesOf'; } catch (e) { liveErrors.push(err(e)); }
  if (raw <= 0n) {
    try { raw = positive(await c.balanceOf(WALLET)); balanceMethod = 'ERC20.balanceOf'; } catch (e) { liveErrors.push(err(e)); }
  }
  if (raw > 0n) {
    let decimals = 18;
    try { decimals = Number(await c.decimals()); } catch {}
    const shares = Number(formatUnits(raw, decimals));
    const price = await llamaPrice(ADDR.earnUsdShareManager);
    const valueUsd = price.priceUsd != null ? shares * price.priceUsd : null;
    if (valueUsd != null) {
      return {
        status: 'ok-current-market', source: 'fresh-rpc',
        position: {
          id: `ethereum:${lower(ADDR.earnUsdShareManager)}`, chain: 'Ethereum', protocol: 'Lido Earn',
          positionType: 'Agent / Curator Managed Stable Vault', wrapper: ADDR.earnUsdShareManager,
          token: null, wrapperSymbol: 'earnUSD', symbol: null, name: 'Lido Earn USD',
          sharesOrBalance: round(shares), shareRaw: raw.toString(), underlying: null,
          underlyingSymbol: 'USD-denominated strategy basket', redeemableUnderlying: null,
          economicValuation: { status: 'ok-current-market', terminalType: 'stable-strategy-share', terminal: ADDR.earnUsdShareManager, terminalSymbol: 'earnUSD', terminalAmount: round(shares), price, valueUsd: round(valueUsd, 12) },
          valueUsd: round(valueUsd, 6), valuationStatus: 'ok-current-market', valuationCanonical: true,
          incomeMode: 'agent-managed-embedded-yield', productive: true, ownerHintMatched: 'Lido',
          history: { firstObservedInbound: earliestTokenInbound(history, ADDR.earnUsdShareManager), currentCheckpoint: { timestamp: new Date().toISOString(), sharesOrBalance: round(shares), economicValueUsd: round(valueUsd, 6), priceSource: price.source || null } },
          officialArchitecture: { vault: ADDR.earnUsdVault, shareManager: ADDR.earnUsdShareManager, oracle: ADDR.earnUsdOracle, balanceMethod },
          methodology: 'current Stable Capital uses current earnUSD share value; Embedded Yield history will use official Lido/Mellow share/oracle accounting'
        },
        liveErrors
      };
    }
  }
  const fallback = lidoFallbackFromPrior(prior);
  if (fallback) return { status: 'ok-preserved-v11', source: 'prior-reproducible-evidence', position: fallback, liveErrors };
  return { status: 'unresolved', source: null, position: null, liveErrors };
}

async function resolveLiquityDirect(provider, history) {
  const branches = [
    { id: 'weth', label: 'WETH', stabilityPool: ADDR.liquitySpWeth, collateral: ADDR.weth, collateralSymbol: 'WETH' },
    { id: 'wsteth', label: 'wstETH', stabilityPool: ADDR.liquitySpWsteth, collateral: ADDR.wsteth, collateralSymbol: 'wstETH' },
    { id: 'reth', label: 'rETH', stabilityPool: ADDR.liquitySpReth, collateral: ADDR.reth, collateralSymbol: 'rETH' }
  ];
  const boldPrice = await llamaPrice(ADDR.bold);
  const branchDiagnostics = [];
  const positions = [];
  const accruedRewards = [];

  for (const b of branches) {
    const c = new Contract(b.stabilityPool, [
      'function getCompoundedBoldDeposit(address) view returns (uint256)',
      'function getDepositorYieldGain(address) view returns (uint256)',
      'function getDepositorCollGain(address) view returns (uint256)'
    ], provider);
    const dep = await safeModule('deposit', () => c.getCompoundedBoldDeposit(WALLET));
    const y = await safeModule('yield', () => c.getDepositorYieldGain(WALLET));
    const cg = await safeModule('coll', () => c.getDepositorCollGain(WALLET));
    const depRaw = dep.ok ? positive(dep.result) : 0n;
    const yieldRaw = y.ok ? positive(y.result) : 0n;
    const collRaw = cg.ok ? positive(cg.result) : 0n;
    branchDiagnostics.push({ branch: b.label, stabilityPool: b.stabilityPool, compoundedBoldDeposit: round(Number(formatUnits(depRaw,18))), probes: { deposit: dep.ok ? 'ok' : dep.error, yieldGain: y.ok ? 'ok' : y.error, collateralGain: cg.ok ? 'ok' : cg.error } });
    if (depRaw > 0n) {
      const deposit = Number(formatUnits(depRaw,18));
      const valueUsd = boldPrice.priceUsd != null ? deposit * boldPrice.priceUsd : null;
      positions.push({
        id: `ethereum:liquity-v2-sp:${b.id}`, chain: 'Ethereum', protocol: 'Liquity V2', positionType: 'Stability Pool Deposit',
        wrapper: null, token: ADDR.bold, wrapperSymbol: null, symbol: 'BOLD', name: `Liquity V2 ${b.label} Stability Pool`,
        sharesOrBalance: round(deposit), shareRaw: depRaw.toString(), underlying: ADDR.bold, underlyingSymbol: 'BOLD', redeemableUnderlying: round(deposit),
        economicValuation: { status: valueUsd != null ? 'ok' : 'unpriced', terminalType: 'stable-asset', terminal: ADDR.bold, terminalSymbol: 'BOLD', terminalAmount: round(deposit), price: boldPrice, valueUsd: valueUsd != null ? round(valueUsd,12) : null },
        valueUsd: valueUsd != null ? round(valueUsd,6) : null, valuationStatus: valueUsd != null ? 'ok' : 'unpriced', valuationCanonical: valueUsd != null,
        incomeMode: 'stability-pool-yield-with-separate-claimables', productive: true, ownerHintMatched: 'Liquity V2',
        history: { firstObservedActivity: earliestBoldDepositToSp(history,b.stabilityPool), currentCheckpoint: { timestamp: new Date().toISOString(), compoundedBoldDeposit: round(deposit), economicValueUsd: valueUsd != null ? round(valueUsd,6) : null } },
        rewardBoundary: 'direct SP BOLD yield and collateral liquidation gains are tracked as separate Accrued Rewards'
      });
    }
    if (yieldRaw > 0n) {
      const amount = Number(formatUnits(yieldRaw,18));
      accruedRewards.push({ protocol:'Liquity V2', route:`liquity-v2-sp-${b.id}`, kind:'BOLD yield gain', token:ADDR.bold, symbol:'BOLD', amount:round(amount), price:boldPrice, usdValue:boldPrice.priceUsd!=null?round(amount*boldPrice.priceUsd,6):null, classification:'accrued-claimable' });
    }
    if (collRaw > 0n) {
      const meta = await tokenMeta(provider,b.collateral);
      const amount = Number(formatUnits(collRaw,meta.decimals));
      const p = await llamaPrice(b.collateral);
      accruedRewards.push({ protocol:'Liquity V2', route:`liquity-v2-sp-${b.id}`, kind:'liquidation collateral gain', token:b.collateral, symbol:meta.symbol||b.collateralSymbol, amount:round(amount), price:p, usdValue:p.priceUsd!=null?round(amount*p.priceUsd,6):null, classification:'accrued-claimable-nonstable-collateral' });
    }
  }
  return { status: positions.length ? 'ok' : 'absent', branches: branchDiagnostics, positions, accruedRewards, boldPrice };
}

function reclassifyYearn(p) {
  if (lower(p?.wrapper) !== lower(ADDR.ysyBold) && lower(p?.wrapperSymbol) !== 'ysybold') return p;
  return { ...p, protocol: 'Yearn V3', positionType: 'Auto-Compounding Stable Vault', ownerHintMatched: 'Yearn V3', incomeMode: 'embedded-yield', methodologyNote: 'ysyBOLD is Yearn yBOLD Auto-Compounder; yBOLD routes BOLD across Liquity V2 Stability Pools; value accrues through auto-compounding.' };
}
function upsert(positions, p) {
  if (!p) return;
  const i = positions.findIndex(x => x.id === p.id || (p.wrapper && lower(x.wrapper) === lower(p.wrapper)));
  if (i >= 0) positions[i] = p; else positions.push(p);
}
function summarize(positions) {
  const priced = positions.filter(p => Number.isFinite(Number(p.valueUsd)));
  const totalUsd = priced.reduce((s,p)=>s+Number(p.valueUsd),0);
  const byProtocol={}, byType={}, byStable={};
  for (const p of priced) {
    byProtocol[p.protocol]=round((byProtocol[p.protocol]||0)+Number(p.valueUsd),6);
    byType[p.positionType]=round((byType[p.positionType]||0)+Number(p.valueUsd),6);
    const sym=p.underlyingSymbol||p.symbol||p.wrapperSymbol||'Unknown';
    byStable[sym]=round((byStable[sym]||0)+Number(p.valueUsd),6);
  }
  return { totalUsd:round(totalUsd,6), productiveUsd:round(positions.filter(p=>p.productive).reduce((s,p)=>s+Number(p.valueUsd||0),0),6), liquidUsd:round(positions.filter(p=>!p.productive).reduce((s,p)=>s+Number(p.valueUsd||0),0),6), positionCount:positions.length, pricedPositions:priced.length, byProtocol, byType, byStable };
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`missing prior resolver input: ${INPUT}`);
  const priorText = fs.readFileSync(INPUT,'utf8');
  const prior = JSON.parse(priorText);
  if (prior.version !== EXPECTED_PRIOR) throw new Error(`expected ${EXPECTED_PRIOR}, got ${prior.version}`);
  if (prior.company?.registry !== '008' || prior.company?.name !== 'Monetra.eth' || lower(prior.company?.wallet) !== lower(WALLET)) throw new Error('Company #008 identity mismatch');
  if (prior.company?.founding?.date !== '2026-05-27') throw new Error('founding regression');
  if (!Array.isArray(prior.stableCapital?.positions) || prior.stableCapital.positions.length < 7) throw new Error('prior solved stable positions missing');

  const startedAt = new Date().toISOString();
  let history = { items:[], pages:0, error:null };
  try { history = { ...(await tokenHistory()), error:null }; } catch (e) { history.error = err(e); }

  const selected = await selectProvider();
  if (!selected.provider) throw new Error(`no usable Ethereum RPC provider: ${selected.errors.join(' | ')}`);
  const provider = selected.provider;

  const positions = prior.stableCapital.positions.map(reclassifyYearn);
  const fraxM = await safeModule('Frax sfrxUSD', () => resolve4626Like({ provider, history, wrapper:ADDR.sfrxUsd, fallbackAsset:ADDR.frxUsd, protocol:'Frax Finance', positionType:'Savings Stable', name:'Staked Frax USD', wrapperSymbol:'sfrxUSD', ownerHintMatched:'Frax Finance', incomeMode:'embedded-yield', allowWrapperPriceFallback:true, methodologyNote:'sfrxUSD balance -> protocol ERC-4626-like redemption when available -> frxUSD; wrapper-price fallback is current-book only' }));
  const sBoldM = await safeModule('Liquity sBOLD', () => resolve4626Like({ provider, history, wrapper:ADDR.sBold, fallbackAsset:ADDR.bold, protocol:'Liquity V2', positionType:'Auto-Compounding Stability Pool Vault', name:'sBOLD', wrapperSymbol:'sBOLD', ownerHintMatched:'Liquity V2', incomeMode:'embedded-yield', allowWrapperPriceFallback:true, methodologyNote:'sBOLD is the K3 Capital ERC-4626 auto-compounding Liquity V2 Stability Pool vault; exchange-rate growth is Embedded Yield' }));
  const lidoM = await safeModule('Lido earnUSD', () => resolveLido(provider,history,prior));
  const liqM = await safeModule('Liquity direct SP', () => resolveLiquityDirect(provider,history));

  const frax = fraxM.result || { status:'module-error', error:fraxM.error };
  const sBold = sBoldM.result || { status:'module-error', error:sBoldM.error };
  const lido = lidoM.result || { status:'module-error', error:lidoM.error };
  const liquityDirect = liqM.result || { status:'module-error', error:liqM.error, branches:[], positions:[], accruedRewards:[] };

  if (frax?.position) upsert(positions,frax.position);
  if (sBold?.position) upsert(positions,sBold.position);
  if (lido?.position) upsert(positions,lido.position);
  for (const p of (liquityDirect?.positions||[])) upsert(positions,p);

  const summary = summarize(positions);
  const ownerTarget = Number(prior.ownerEvidence?.stableStrategyUsdApprox || 100);
  const delta = summary.totalUsd - ownerTarget;
  const checks = {
    'f(x) Protocol': positions.some(p=>p.ownerHintMatched==='f(x) Protocol'),
    'Liquity V2': positions.some(p=>p.ownerHintMatched==='Liquity V2'),
    'Inverse': positions.some(p=>p.ownerHintMatched==='Inverse'),
    'Yearn V3': positions.some(p=>p.ownerHintMatched==='Yearn V3'),
    'Sky': positions.some(p=>p.ownerHintMatched==='Sky'),
    'Aave V3': positions.filter(p=>p.ownerHintMatched==='Aave V3').length>=2,
    'Curve': positions.some(p=>p.ownerHintMatched==='Curve'),
    'Lido': positions.some(p=>p.ownerHintMatched==='Lido'),
    'Frax Finance': positions.some(p=>p.ownerHintMatched==='Frax Finance')
  };
  const missingHints = Object.entries(checks).filter(([,ok])=>!ok).map(([k])=>k);
  const unpriced = positions.filter(p=>p.valueUsd==null);
  const currentBookReady = missingHints.length===0 && unpriced.length===0 && Math.abs(delta)<=15;

  const unresolved = [];
  for (const [label,m] of [['Frax Finance',frax],['Liquity sBOLD',sBold],['Lido',lido],['Liquity direct SP',liquityDirect]]) {
    if (!m || ['absent','unresolved','unpriced','probe-error','module-error'].includes(m.status)) unresolved.push({ mechanism:label, status:m?.status||'unknown', error:m?.error||null });
  }
  for (const h of missingHints) if (!unresolved.some(x=>x.mechanism===h)) unresolved.push({ mechanism:h, status:'owner-hint-not-reproduced', error:null });

  const output = {
    ...prior,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    purpose: 'diagnostic-safe close of Monetra Stable Capital current book: preserve solved v1.1 positions, add sBOLD, Frax, Lido and direct Liquity evidence without turning unresolved economics into a red workflow',
    preservation: { ...(prior.preservation||{}), priorResolverVersion:prior.version, priorResolverSha256:sha256(priorText), foundedDatePreserved:prior.company.founding.date, priorStablePositionCount:prior.stableCapital.positions.length, principle:'known v1.1 positions are immutable inputs to this narrow resolver; protocol-specific misses are diagnostics, not fatal workflow errors' },
    resolutionV13: {
      provider:selected.providerHost,
      providerBlock:selected.block,
      providerErrorsBeforeSuccess:selected.errors,
      tokenHistory:{pages:history.pages,error:history.error},
      yearn:{status:checks['Yearn V3']?'ok':'missing',wrapper:ADDR.ysyBold,canonicalIdentity:'Yearn yBOLD Auto-Compounder / ysyBOLD'},
      frax,
      lido,
      liquity:{ sBold, direct:liquityDirect },
      moduleExecution:{ frax:{ok:fraxM.ok,error:fraxM.error}, sBold:{ok:sBoldM.ok,error:sBoldM.error}, lido:{ok:lidoM.ok,error:lidoM.error}, liquityDirect:{ok:liqM.ok,error:liqM.error} },
      engineeringGuard:'all literal EVM addresses are canonicalized from lowercase; each special protocol resolver is failure-isolated; diagnostic output is always publishable if structural invariants hold'
    },
    stableCapital: {
      ...prior.stableCapital,
      positions,
      summary,
      reconciliation:{ ownerStableStrategyUsdApprox:ownerTarget, reproducedStableCapitalUsd:summary.totalUsd, deltaVsOwnerApproxUsd:round(delta,6), withinLoose15UsdBand:Math.abs(delta)<=15, note:'owner target is diagnostic only; no value is forced to the target' },
      unresolved,
      accruedRewardsCandidates:liquityDirect?.accruedRewards||[]
    },
    mandateReview:{ lidoPositions:positions.filter(p=>p.ownerHintMatched==='Lido').map(p=>({id:p.id,protocol:p.protocol,symbol:p.wrapperSymbol,valueUsd:p.valueUsd,stableCapitalEligible:true})), rule:'Lido earnUSD is USD-denominated Stable Capital; stETH/wstETH would remain excluded if encountered separately.', lidoClassified:checks.Lido },
    ownerHintCoverage:{ checks,missingHints,aaveEvidenceCount:positions.filter(p=>p.ownerHintMatched==='Aave V3').length,note:'A green resolver run means the diagnostic collector executed and published; economic completeness is expressed by stableCapitalBookReady, not by workflow color.' },
    history:{ ...(prior.history||{}), v13CheckpointSeed:positions.map(p=>({id:p.id,protocol:p.protocol,positionType:p.positionType,incomeMode:p.incomeMode,firstObservedActivity:p.history?.firstObservedInbound||p.history?.firstObservedActivity||null,currentCheckpoint:p.history?.currentCheckpoint||null})) },
    productionReadiness:{ stableCapitalBookReady:currentBookReady,currentStateReconciled:currentBookReady,embeddedYieldLedgerSeedReady:currentBookReady,embeddedYieldHistoryReady:false,productivityIntegrationReady:false,rewardsIntegrationReady:false,pageIntegrationReady:false,reportingIntegrationReady:false,rationale:currentBookReady?'current Stable Capital book reconciled; next phase is Reference APY + Embedded Yield adapters/history':'diagnostic resolver completed but current book remains open; inspect missingHints/unresolved instead of rerunning archaeology blindly' }
  };

  fs.mkdirSync(path.dirname(OUTPUT),{recursive:true});
  fs.writeFileSync(OUTPUT,JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify({version:output.version,stableCapitalUsd:summary.totalUsd,positionCount:summary.positionCount,delta:round(delta,6),missingHints,unresolved,bookReady:currentBookReady,frax:frax.status,lido:lido.status,sBold:sBold.status,directLiquity:liquityDirect.status},null,2));
}

main().catch(e=>{ console.error(e); process.exit(1); });
