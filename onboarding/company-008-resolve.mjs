import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Contract, JsonRpcProvider, formatUnits, getAddress } from 'ethers';

const VERSION = '1.2-company-008-stable-final-three-reconciliation';
const INPUT = process.env.COMPANY_008_RESOLVE_INPUT || path.resolve('companies/company-008-resolve.json');
const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT || path.resolve('companies/company-008-resolve.json');
const WALLET = getAddress('0x888D39aeE2AEC979c81f125EA94BB3cEB60F6bBB');
const EXPECTED_PRIOR = '1.1-company-008-stable-wrapper-reconciliation';

const ADDR = Object.freeze({
  bold: getAddress('0x6440f144b7e50D6a8439336510312d2F54beB01D'),
  weth: getAddress('0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'),
  wsteth: getAddress('0x7f39C581F595B53c5cb19BD0b3f8dA6c935E2Ca0'),
  reth: getAddress('0xae78736Cd615f374D3085123A210448E74Fc6393'),
  liquitySpWeth: getAddress('0x5721cbbd64fc7ae3ef44a0a3f9a790a9264cf9bf'),
  liquitySpWsteth: getAddress('0x9502b7c397e9aa22fe9db7ef7daf21cd2aebe56b'),
  liquitySpReth: getAddress('0xd442e41019b7f5c4dd78f50dc03726c446148695'),
  earnUsdShareManager: getAddress('0x4Ce1ac8F43E0E5BD7A346A98aF777bF8fbeA1981'),
  earnUsdVault: getAddress('0x014e6DA8F283C4aF65B2AA0f201438680A004452'),
  earnUsdOracle: getAddress('0x827044735c9708a2cf850e7Ea37EBa43bc786028'),
  sfrxUsd: getAddress('0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6'),
  frxUsd: getAddress('0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29'),
  ysyBold: getAddress('0x23346B04a7f55b8760E5860AA5A77383D63491cD'),
  fxSave: getAddress('0x7743e50F534a7f9F1791DdE7dCD89F7783Eefc39'),
  fxSp: getAddress('0x65C9A641afCEB9C0E6034e558A319488FA0FA3be')
});

const SP_BRANCHES = Object.freeze([
  { id: 'weth', label: 'WETH', stabilityPool: ADDR.liquitySpWeth, collateral: ADDR.weth, collateralSymbol: 'WETH' },
  { id: 'wsteth', label: 'wstETH', stabilityPool: ADDR.liquitySpWsteth, collateral: ADDR.wsteth, collateralSymbol: 'wstETH' },
  { id: 'reth', label: 'rETH', stabilityPool: ADDR.liquitySpReth, collateral: ADDR.reth, collateralSymbol: 'rETH' }
]);

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
function err(e) { return String(e?.shortMessage || e?.message || e || 'unknown').slice(0, 1000); }
function positive(x) { try { const n = BigInt(x); return n > 0n ? n : 0n; } catch { return 0n; } }

async function fetchJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: 'no-store', headers: { 'user-agent': 'The-Holding-Monetra-Stable-Resolver/1.2' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function withProvider(fn) {
  const errors = [];
  for (const url of RPC_URLS) {
    const provider = new JsonRpcProvider(url);
    try {
      const result = await fn(provider);
      return { result, provider: new URL(url).hostname, errors };
    } catch (e) {
      errors.push(`${new URL(url).hostname}: ${err(e)}`);
    }
  }
  return { result: null, provider: null, errors };
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

async function tokenInfo(provider, address) {
  const c = new Contract(address, [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)'
  ], provider);
  let symbol = null, name = null, decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { name = await c.name(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  return { address, symbol, name, decimals };
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
function transferTimestamp(tf) {
  return tf?.timestamp || tf?.block_timestamp || null;
}
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
    token
  };
}
function earliestBoldDepositToSp(history, sp) {
  const rows = (history?.items || []).filter(tf => lower(tokenAddr(tf)) === lower(ADDR.bold) && lower(addrFrom(tf.from)) === lower(WALLET) && lower(addrFrom(tf.to)) === lower(sp));
  rows.sort((a, b) => new Date(transferTimestamp(a) || 0) - new Date(transferTimestamp(b) || 0));
  const r = rows[0];
  if (!r) return null;
  return {
    timestamp: transferTimestamp(r),
    block: Number(r.block_number ?? r.block ?? 0) || null,
    txHash: r.transaction_hash || r.tx_hash || r.hash || null,
    token: ADDR.bold,
    to: sp
  };
}

async function resolveFrax(provider, history) {
  const c = new Contract(ADDR.sfrxUsd, [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function asset() view returns (address)',
    'function previewRedeem(uint256) view returns (uint256)',
    'function convertToAssets(uint256) view returns (uint256)'
  ], provider);
  const shareRaw = positive(await c.balanceOf(WALLET));
  if (shareRaw <= 0n) return { status: 'absent' };
  let decimals = 18;
  try { decimals = Number(await c.decimals()); } catch {}
  let asset = ADDR.frxUsd;
  try { asset = getAddress(await c.asset()); } catch {}
  let assetsRaw = 0n;
  let method = null;
  try { assetsRaw = positive(await c.previewRedeem(shareRaw)); method = 'previewRedeem'; }
  catch { assetsRaw = positive(await c.convertToAssets(shareRaw)); method = 'convertToAssets'; }
  const assetMeta = await tokenInfo(provider, asset);
  const shares = Number(formatUnits(shareRaw, decimals));
  const assets = Number(formatUnits(assetsRaw, assetMeta.decimals));
  const price = await llamaPrice(asset);
  const valueUsd = price.priceUsd != null ? assets * price.priceUsd : null;
  return {
    status: valueUsd != null ? 'ok' : 'unpriced',
    position: {
      id: `ethereum:${lower(ADDR.sfrxUsd)}`,
      chain: 'Ethereum',
      protocol: 'Frax Finance',
      positionType: 'Savings Stable',
      wrapper: ADDR.sfrxUsd,
      token: null,
      wrapperSymbol: 'sfrxUSD',
      symbol: null,
      name: 'Staked Frax USD',
      sharesOrBalance: round(shares),
      shareRaw: shareRaw.toString(),
      underlying: asset,
      underlyingSymbol: assetMeta.symbol || 'frxUSD',
      redeemableUnderlying: round(assets),
      economicValuation: {
        status: valueUsd != null ? 'ok' : 'unpriced',
        terminalType: 'stable-asset',
        terminal: asset,
        terminalSymbol: assetMeta.symbol || 'frxUSD',
        terminalAmount: round(assets),
        price,
        valueUsd: valueUsd != null ? round(valueUsd, 12) : null,
        path: [{ token: ADDR.sfrxUsd, symbol: 'sfrxUSD', amount: round(shares), standard: 'ERC-4626-like', redeemMethod: method, redeemableToken: asset, redeemableSymbol: assetMeta.symbol || 'frxUSD', redeemableAmount: round(assets) }, { token: asset, symbol: assetMeta.symbol || 'frxUSD', amount: round(assets) }]
      },
      valueUsd: valueUsd != null ? round(valueUsd, 6) : null,
      valuationStatus: valueUsd != null ? 'ok' : 'unpriced',
      valuationCanonical: valueUsd != null,
      incomeMode: 'embedded-yield',
      productive: true,
      ownerHintMatched: 'Frax Finance',
      history: {
        firstObservedInbound: earliestTokenInbound(history, ADDR.sfrxUsd),
        currentCheckpoint: { timestamp: new Date().toISOString(), sharesOrBalance: round(shares), economicValueUsd: valueUsd != null ? round(valueUsd, 6) : null, terminalUnderlying: asset, terminalUnderlyingSymbol: assetMeta.symbol || 'frxUSD', terminalUnderlyingAmount: round(assets) }
      },
      methodology: 'sfrxUSD share balance -> protocol previewRedeem/convertToAssets -> frxUSD -> USD price'
    }
  };
}

async function resolveLidoEarnUsd(provider, history) {
  const c = new Contract(ADDR.earnUsdShareManager, [
    'function sharesOf(address) view returns (uint256)',
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ], provider);
  let raw = 0n;
  let balanceMethod = null;
  try { raw = positive(await c.sharesOf(WALLET)); balanceMethod = 'ShareManager.sharesOf'; } catch {}
  if (raw <= 0n) {
    try { raw = positive(await c.balanceOf(WALLET)); balanceMethod = 'ERC20.balanceOf'; } catch {}
  }
  if (raw <= 0n) return { status: 'absent' };
  let decimals = 18;
  try { decimals = Number(await c.decimals()); } catch {}
  const shares = Number(formatUnits(raw, decimals));
  const price = await llamaPrice(ADDR.earnUsdShareManager);
  const valueUsd = price.priceUsd != null ? shares * price.priceUsd : null;
  return {
    status: valueUsd != null ? 'ok-current-market' : 'unpriced',
    position: {
      id: `ethereum:${lower(ADDR.earnUsdShareManager)}`,
      chain: 'Ethereum',
      protocol: 'Lido Earn',
      positionType: 'Agent / Curator Managed Stable Vault',
      wrapper: ADDR.earnUsdShareManager,
      token: null,
      wrapperSymbol: 'earnUSD',
      symbol: null,
      name: 'Lido Earn USD',
      sharesOrBalance: round(shares),
      shareRaw: raw.toString(),
      underlying: null,
      underlyingSymbol: 'USD-denominated strategy basket',
      redeemableUnderlying: null,
      economicValuation: {
        status: valueUsd != null ? 'ok-current-market' : 'unpriced',
        terminalType: 'stable-strategy-share',
        terminal: ADDR.earnUsdShareManager,
        terminalSymbol: 'earnUSD',
        terminalAmount: round(shares),
        price,
        valueUsd: valueUsd != null ? round(valueUsd, 12) : null,
        canonicalCurrentBookValuation: valueUsd != null,
        navHistoryBoundary: 'current Stable Capital TVL may use reproducible contract market price; Embedded Yield history will use official Lido/Mellow oracle share accounting, not market-price drift'
      },
      valueUsd: valueUsd != null ? round(valueUsd, 6) : null,
      valuationStatus: valueUsd != null ? 'ok-current-market' : 'unpriced',
      valuationCanonical: valueUsd != null,
      incomeMode: 'agent-managed-embedded-yield',
      productive: true,
      ownerHintMatched: 'Lido',
      history: {
        firstObservedInbound: earliestTokenInbound(history, ADDR.earnUsdShareManager),
        currentCheckpoint: { timestamp: new Date().toISOString(), sharesOrBalance: round(shares), economicValueUsd: valueUsd != null ? round(valueUsd, 6) : null, priceSource: price.source || null }
      },
      officialArchitecture: {
        vault: ADDR.earnUsdVault,
        shareManager: ADDR.earnUsdShareManager,
        oracle: ADDR.earnUsdOracle,
        balanceMethod,
        deposits: 'USDC/USDT; shares reflected by ShareManager; strategies curated through Lido Earn/Mellow; returns auto-compound into share value',
        withdrawals: 'queue-based USDC withdrawal'
      }
    }
  };
}

async function tryCall(contract, method, args = []) {
  try { return { ok: true, value: await contract[method](...args) }; }
  catch (e) { return { ok: false, error: err(e) }; }
}

async function resolveLiquity(provider, history) {
  const boldPrice = await llamaPrice(ADDR.bold);
  const branches = [];
  const positions = [];
  const accruedRewards = [];
  for (const b of SP_BRANCHES) {
    const c = new Contract(b.stabilityPool, [
      'function getCompoundedBoldDeposit(address) view returns (uint256)',
      'function getDepositorYieldGain(address) view returns (uint256)',
      'function getDepositorCollGain(address) view returns (uint256)'
    ], provider);
    const dep = await tryCall(c, 'getCompoundedBoldDeposit', [WALLET]);
    const y = await tryCall(c, 'getDepositorYieldGain', [WALLET]);
    const cg = await tryCall(c, 'getDepositorCollGain', [WALLET]);
    const depRaw = dep.ok ? positive(dep.value) : 0n;
    const yieldRaw = y.ok ? positive(y.value) : 0n;
    const collRaw = cg.ok ? positive(cg.value) : 0n;
    const branch = {
      branch: b.label,
      stabilityPool: b.stabilityPool,
      compoundedBoldDeposit: round(Number(formatUnits(depRaw, 18))),
      boldYieldGain: y.ok ? round(Number(formatUnits(yieldRaw, 18))) : null,
      collateralGain: cg.ok ? round(Number(formatUnits(collRaw, 18))) : null,
      collateralSymbol: b.collateralSymbol,
      probes: { deposit: dep.ok ? 'ok' : dep.error, yieldGain: y.ok ? 'ok' : y.error, collateralGain: cg.ok ? 'ok' : cg.error }
    };
    branches.push(branch);
    if (depRaw > 0n) {
      const deposit = Number(formatUnits(depRaw, 18));
      const valueUsd = boldPrice.priceUsd != null ? deposit * boldPrice.priceUsd : null;
      positions.push({
        id: `ethereum:liquity-v2-sp:${b.id}`,
        chain: 'Ethereum',
        protocol: 'Liquity V2',
        positionType: 'Stability Pool Deposit',
        wrapper: null,
        token: ADDR.bold,
        wrapperSymbol: null,
        symbol: 'BOLD',
        name: `Liquity V2 ${b.label} Stability Pool`,
        sharesOrBalance: round(deposit),
        shareRaw: depRaw.toString(),
        underlying: ADDR.bold,
        underlyingSymbol: 'BOLD',
        redeemableUnderlying: round(deposit),
        economicValuation: { status: valueUsd != null ? 'ok' : 'unpriced', terminalType: 'stable-asset', terminal: ADDR.bold, terminalSymbol: 'BOLD', terminalAmount: round(deposit), price: boldPrice, valueUsd: valueUsd != null ? round(valueUsd, 12) : null, path: [{ protocol: 'Liquity V2', stabilityPool: b.stabilityPool, method: 'getCompoundedBoldDeposit', token: ADDR.bold, symbol: 'BOLD', amount: round(deposit) }] },
        valueUsd: valueUsd != null ? round(valueUsd, 6) : null,
        valuationStatus: valueUsd != null ? 'ok' : 'unpriced',
        valuationCanonical: valueUsd != null,
        incomeMode: 'stability-pool-yield-with-separate-claimables',
        productive: true,
        ownerHintMatched: 'Liquity V2',
        history: { firstObservedActivity: earliestBoldDepositToSp(history, b.stabilityPool), currentCheckpoint: { timestamp: new Date().toISOString(), compoundedBoldDeposit: round(deposit), economicValueUsd: valueUsd != null ? round(valueUsd, 6) : null, boldPriceUsd: boldPrice.priceUsd } },
        rewardBoundary: 'unclaimed BOLD yield and collateral liquidation gains are Accrued Rewards, not Stable Capital principal'
      });
    }
    if (yieldRaw > 0n) {
      const amount = Number(formatUnits(yieldRaw, 18));
      accruedRewards.push({ protocol: 'Liquity V2', route: `liquity-v2-sp-${b.id}`, kind: 'BOLD yield gain', token: ADDR.bold, symbol: 'BOLD', amount: round(amount), price: boldPrice, usdValue: boldPrice.priceUsd != null ? round(amount * boldPrice.priceUsd, 6) : null, classification: 'accrued-claimable' });
    }
    if (collRaw > 0n) {
      const collMeta = await tokenInfo(provider, b.collateral);
      const amount = Number(formatUnits(collRaw, collMeta.decimals));
      const p = await llamaPrice(b.collateral);
      accruedRewards.push({ protocol: 'Liquity V2', route: `liquity-v2-sp-${b.id}`, kind: 'liquidation collateral gain', token: b.collateral, symbol: collMeta.symbol || b.collateralSymbol, amount: round(amount), price: p, usdValue: p.priceUsd != null ? round(amount * p.priceUsd, 6) : null, classification: 'accrued-claimable-nonstable-collateral' });
    }
  }
  return { status: positions.length ? 'ok' : 'absent', branches, positions, accruedRewards, boldPrice };
}

function reclassifyYearn(p) {
  if (lower(p?.wrapper) !== lower(ADDR.ysyBold) && lower(p?.wrapperSymbol) !== 'ysybold') return p;
  return {
    ...p,
    protocol: 'Yearn V3',
    positionType: 'Auto-Compounding Stable Vault',
    ownerHintMatched: 'Yearn V3',
    incomeMode: 'embedded-yield',
    methodologyNote: 'ysyBOLD is Yearn yBOLD Auto-Compounder; yBOLD represents BOLD routed across Liquity V2 Stability Pools; ysyBOLD value grows as rewards are harvested and re-deposited.'
  };
}

function summarize(positions) {
  const priced = positions.filter(p => Number.isFinite(Number(p.valueUsd)));
  const totalUsd = priced.reduce((s, p) => s + Number(p.valueUsd), 0);
  const byProtocol = {};
  const byType = {};
  const byStable = {};
  for (const p of priced) {
    byProtocol[p.protocol] = round((byProtocol[p.protocol] || 0) + Number(p.valueUsd), 6);
    byType[p.positionType] = round((byType[p.positionType] || 0) + Number(p.valueUsd), 6);
    const sym = p.underlyingSymbol || p.symbol || p.wrapperSymbol || 'Unknown';
    byStable[sym] = round((byStable[sym] || 0) + Number(p.valueUsd), 6);
  }
  return { totalUsd: round(totalUsd, 6), productiveUsd: round(positions.filter(p => p.productive).reduce((s, p) => s + Number(p.valueUsd || 0), 0), 6), liquidUsd: round(positions.filter(p => !p.productive).reduce((s, p) => s + Number(p.valueUsd || 0), 0), 6), positionCount: positions.length, pricedPositions: priced.length, byProtocol, byType, byStable };
}

function upsert(positions, p) {
  const i = positions.findIndex(x => x.id === p.id || (p.wrapper && lower(x.wrapper) === lower(p.wrapper)));
  if (i >= 0) positions[i] = p; else positions.push(p);
}

async function main() {
  if (!fs.existsSync(INPUT)) throw new Error(`missing prior resolver input: ${INPUT}`);
  const priorText = fs.readFileSync(INPUT, 'utf8');
  const prior = JSON.parse(priorText);
  if (prior.version !== EXPECTED_PRIOR) throw new Error(`expected ${EXPECTED_PRIOR}, got ${prior.version}`);
  if (prior.company?.registry !== '008' || prior.company?.name !== 'Monetra.eth' || lower(prior.company?.wallet) !== lower(WALLET)) throw new Error('Company #008 identity mismatch');
  if (prior.company?.founding?.date !== '2026-05-27') throw new Error('founding regression');
  if (!Array.isArray(prior.stableCapital?.positions) || prior.stableCapital.positions.length < 7) throw new Error('prior solved stable positions missing');

  const startedAt = new Date().toISOString();
  let history = { items: [], pages: 0, error: null };
  try { history = { ...(await tokenHistory()), error: null }; } catch (e) { history.error = err(e); }

  const probe = await withProvider(async provider => {
    const positions = prior.stableCapital.positions.map(reclassifyYearn);
    const frax = await resolveFrax(provider, history);
    const lido = await resolveLidoEarnUsd(provider, history);
    const liquity = await resolveLiquity(provider, history);
    if (frax.position) upsert(positions, frax.position);
    if (lido.position) upsert(positions, lido.position);
    for (const p of liquity.positions || []) upsert(positions, p);
    return { positions, frax, lido, liquity };
  });
  if (!probe.result) throw new Error(`all Ethereum RPC providers failed: ${(probe.errors || []).join(' | ')}`);

  const { positions, frax, lido, liquity } = probe.result;
  const summary = summarize(positions);
  const ownerTarget = Number(prior.ownerEvidence?.stableStrategyUsdApprox || 100);
  const delta = summary.totalUsd - ownerTarget;
  const checks = {
    'f(x) Protocol': positions.some(p => p.ownerHintMatched === 'f(x) Protocol'),
    'Liquity V2': positions.some(p => p.ownerHintMatched === 'Liquity V2'),
    'Inverse': positions.some(p => p.ownerHintMatched === 'Inverse'),
    'Yearn V3': positions.some(p => p.ownerHintMatched === 'Yearn V3'),
    'Sky': positions.some(p => p.ownerHintMatched === 'Sky'),
    'Aave V3': positions.filter(p => p.ownerHintMatched === 'Aave V3').length >= 2,
    'Curve': positions.some(p => p.ownerHintMatched === 'Curve'),
    'Lido': positions.some(p => p.ownerHintMatched === 'Lido'),
    'Frax Finance': positions.some(p => p.ownerHintMatched === 'Frax Finance')
  };
  const missingHints = Object.entries(checks).filter(([, ok]) => !ok).map(([k]) => k);
  const unpriced = positions.filter(p => p.valueUsd == null);
  const currentBookReady = missingHints.length === 0 && unpriced.length === 0 && Math.abs(delta) <= 15;
  const previousFx = positions.find(p => p.ownerHintMatched === 'f(x) Protocol');
  const fxCanonical = Boolean(previousFx?.valuationCanonical);

  const output = {
    ...prior,
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    purpose: 'close the final Monetra Stable Capital current-state delta without reopening solved founding/Aave/wrapper work; resolve direct Liquity V2 Stability Pool, Lido earnUSD, Frax sfrxUSD and Yearn identity',
    preservation: {
      ...(prior.preservation || {}),
      priorResolverVersion: prior.version,
      priorResolverSha256: sha256(priorText),
      foundedDatePreserved: prior.company.founding.date,
      priorStablePositionCount: prior.stableCapital.positions.length,
      principle: 'v1.2 is a narrow continuation: preserve solved v1.1 positions; add only final missing mechanisms and reclassify Yearn'
    },
    resolutionV12: {
      provider: probe.provider,
      providerErrorsBeforeSuccess: probe.errors,
      tokenHistory: { pages: history.pages, error: history.error },
      yearn: { status: positions.some(p => p.ownerHintMatched === 'Yearn V3') ? 'ok' : 'missing', wrapper: ADDR.ysyBold, canonicalIdentity: 'Yearn yBOLD Auto-Compounder / ysyBOLD' },
      frax,
      lido,
      liquity,
      fxSaveBoundary: {
        status: fxCanonical ? 'canonical' : 'current-book-priced-history-adapter-pending',
        currentBookTreatment: 'preserve reproducible current valuation from v1.1; do not use wrapper market-price changes as Embedded Yield history',
        historyRequirement: 'future Embedded Yield ledger must use fxSAVE share economics / fxSP economic exit accounting rather than market-price drift'
      }
    },
    stableCapital: {
      ...prior.stableCapital,
      positions,
      summary,
      reconciliation: {
        ownerStableStrategyUsdApprox: ownerTarget,
        reproducedStableCapitalUsd: summary.totalUsd,
        deltaVsOwnerApproxUsd: round(delta, 6),
        withinLoose15UsdBand: Math.abs(delta) <= 15,
        note: 'owner target is diagnostic only; current book is accepted only from reproduced positions, never forced to the target'
      },
      unresolved: [],
      accruedRewardsCandidates: liquity.accruedRewards || []
    },
    nonStableDiagnostics: prior.nonStableDiagnostics || [],
    mandateReview: {
      lidoPositions: positions.filter(p => p.ownerHintMatched === 'Lido').map(p => ({ id: p.id, protocol: p.protocol, symbol: p.wrapperSymbol, valueUsd: p.valueUsd, stableCapitalEligible: true })),
      rule: 'Lido earnUSD is USD-denominated Stable Capital; stETH/wstETH would remain excluded if encountered separately.',
      lidoClassified: positions.some(p => p.ownerHintMatched === 'Lido')
    },
    ownerHintCoverage: {
      checks,
      missingHints,
      aaveEvidenceCount: positions.filter(p => p.ownerHintMatched === 'Aave V3').length,
      note: 'Yearn is recognized by ysyBOLD identity; Lido by earnUSD ShareManager; Frax by direct sfrxUSD read; Liquity by branch StabilityPool state.'
    },
    history: {
      ...(prior.history || {}),
      v12CheckpointSeed: positions.map(p => ({ id: p.id, protocol: p.protocol, positionType: p.positionType, incomeMode: p.incomeMode, firstObservedActivity: p.history?.firstObservedInbound || p.history?.firstObservedActivity || null, currentCheckpoint: p.history?.currentCheckpoint || null }))
    },
    productionReadiness: {
      stableCapitalBookReady: currentBookReady,
      currentStateReconciled: currentBookReady,
      embeddedYieldLedgerSeedReady: currentBookReady,
      embeddedYieldHistoryReady: false,
      productivityIntegrationReady: false,
      rewardsIntegrationReady: false,
      pageIntegrationReady: false,
      reportingIntegrationReady: false,
      rationale: currentBookReady
        ? 'current Stable Capital book reconciled; next phase is Reference APY + Embedded Yield methodology/adapters before public analytical integration'
        : `current book still not closed; missing=${missingHints.join(',') || 'none'} unpriced=${unpriced.length} delta=${round(delta, 6)}`
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(JSON.stringify({ version: output.version, stableCapitalUsd: output.stableCapital.summary.totalUsd, positionCount: output.stableCapital.summary.positionCount, delta: output.stableCapital.reconciliation.deltaVsOwnerApproxUsd, missingHints, bookReady: output.productionReadiness.stableCapitalBookReady, liquityBranches: output.resolutionV12.liquity.branches.map(x => [x.branch, x.compoundedBoldDeposit]), frax: output.resolutionV12.frax.status, lido: output.resolutionV12.lido.status }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
