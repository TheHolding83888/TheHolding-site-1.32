import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  getAddress
} from 'ethers';

const VERSION = '1.1-company-008-stable-wrapper-reconciliation';
const DISCOVERY_PATH = process.env.COMPANY_008_DISCOVERY_INPUT
  || path.resolve('companies/company-008-discovery.json');
const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT
  || path.resolve('companies/company-008-resolve.json');

const COMPANY = Object.freeze({
  registry: '008',
  name: 'Monetra.eth',
  wallet: getAddress('0x888D39aeE2AEC979c81f125EA94BB3cEB60F6bBB'),
  category: 'Stable Capital'
});

// Owner-supplied screenshot evidence is a reconciliation aid only.
// It is NEVER used to manufacture onchain balances or USD values.
const OWNER_EVIDENCE = Object.freeze({
  source: 'owner-supplied DeBank screenshots + owner note, 2026-08-12',
  screenshotRowsUsd: [
    { protocol: 'f(x) Protocol', usdApprox: 10.06 },
    { protocol: 'Liquity V2', usdApprox: 10.05 },
    { protocol: 'Inverse', usdApprox: 10.04 },
    { protocol: 'Yearn V3', usdApprox: 10.03 },
    { protocol: 'Sky', usdApprox: 10.03 },
    { protocol: 'Aave V3', usdApprox: 10.02, note: 'one of two Aave-labelled positions' },
    { protocol: 'Curve', usdApprox: 10.01 },
    { protocol: 'Lido', usdApprox: 10.01 },
    { protocol: 'Aave V3', usdApprox: 9.98, note: 'second Aave-labelled position' }
  ],
  additionalOwnerObserved: [
    { protocol: 'Frax Finance', asset: 'sfrxUSD', usdApprox: null, note: 'direct wallet balance; value not supplied as an exact screenshot number' }
  ],
  stableStrategyUsdApprox: 100,
  totalWalletDefiInclGasUsdApprox: 108,
  principle: 'owner values are sanity checks only; resolver values must come from reproducible reads'
});

const KNOWN = Object.freeze({
  // Official/current protocol addresses used only for identification/special handling.
  fxSAVE: getAddress('0x7743e50F534a7f9F1791DdE7dCD89F7783Eefc39'),
  fxSP: getAddress('0x65C9A641afCEB9C0E6034e558A319488FA0FA3be'),
  fxUSD: getAddress('0x085780639CC2cACd35E474e71f4d000e2405d8f6'),
  sBOLD: getAddress('0x50bd66d59911f5e086ec87ae43c811e0d059dd11'),
  scrvUSD: getAddress('0x0655977FEb2f289A4aB78af67BAB0d17aAb84367'),
  crvUSD: getAddress('0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E'),
  sGHO: getAddress('0xE1753F2e00940cC31213dd92013cF019DFE4ca1d'),
  sfrxUSD: getAddress('0xcf62F905562626CfcDD2261162a51fd02Fc9c5b6'),
  frxUSD: getAddress('0xCAcd6fd266aF91b8AeD52aCCc382b4e165586E29')
});

const CHAIN = Object.freeze({
  ethereum: { label: 'Ethereum', llama: 'ethereum' },
  base: { label: 'Base', llama: 'base' }
});

const BLOCKSCOUT = Object.freeze({
  ethereum: 'https://eth.blockscout.com',
  base: 'https://base.blockscout.com'
});

const RPC = Object.freeze({
  ethereum: unique([
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com'
  ]),
  base: unique([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ])
});

function unique(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function lower(x) { return String(x || '').toLowerCase(); }
function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .slice(0, 1000);
}
function positiveBigInt(x) {
  try {
    const n = BigInt(x);
    return n > 0n ? n : 0n;
  } catch { return 0n; }
}
function sha256Text(x) {
  return crypto.createHash('sha256').update(String(x)).digest('hex');
}
function txAddress(x) {
  if (!x) return null;
  if (typeof x === 'string') return x;
  return x.hash || x.address || x.address_hash || null;
}
function tokenAddress(x) {
  const token = x?.token || x || {};
  return token.address
    || token.address_hash
    || token.token_address
    || x?.address_hash
    || x?.token_address
    || null;
}
function canonicalAddress(x) {
  try { return getAddress(x); } catch { return null; }
}
function stableSymbol(symbol) {
  const s = String(symbol || '').toUpperCase().replace(/[^A-Z0-9.+-]/g, '');
  return new Set([
    'USDC','USDC.E','USDT','USDT.E','DAI','CRVUSD','GHO','USDS','FRXUSD',
    'LUSD','DOLA','BOLD','FXUSD','PYUSD','USDP','TUSD','FDUSD','RLUSD','REUSD',
    'MUSD','USDE','USD0','USD0++','USUALUSD'
  ]).has(s);
}
function isKnownSavingsSymbol(symbol) {
  const s = lower(symbol).replace(/[^a-z0-9]/g, '');
  return ['fxsave','sbold','sdola','susds','stusds','sgho','scrvusd','sfrxusd'].includes(s)
    || s.startsWith('yv');
}
function iso(x) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

async function fetchJson(url, options = {}, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...options,
      signal: ctrl.signal,
      cache: 'no-store',
      headers: {
        'user-agent': 'The-Holding-Monetra-Stable-Resolver/1.1',
        ...(options.headers || {})
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function withProvider(chain, fn) {
  const errors = [];
  for (const url of RPC[chain] || []) {
    const provider = new JsonRpcProvider(url);
    try {
      const result = await fn(provider);
      return { result, provider: `${chain}:${new URL(url).hostname}`, errors };
    } catch (e) {
      errors.push(`${chain}: ${errMsg(e)}`);
    }
  }
  return { result: null, provider: null, errors };
}

async function tokenMeta(provider, address, hint = {}) {
  const c = new Contract(address, [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)'
  ], provider);
  let symbol = hint.symbol || null;
  let name = hint.name || null;
  let decimals = Number(hint.decimals ?? 18);
  try { symbol = await c.symbol(); } catch {}
  try { name = await c.name(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  return { address: getAddress(address), symbol, name, decimals };
}

async function llamaPrice(chain, address) {
  try {
    const key = `${CHAIN[chain].llama}:${lower(address)}`;
    const j = await fetchJson(`https://coins.llama.fi/prices/current/${encodeURIComponent(key)}`, {}, 15000);
    const hit = j?.coins?.[key] || j?.coins?.[`${CHAIN[chain].llama}:${address}`];
    const price = Number(hit?.price);
    return Number.isFinite(price) && price > 0
      ? { status: 'ok', priceUsd: price, source: `defillama-contract:${CHAIN[chain].llama}` }
      : { status: 'unavailable', priceUsd: null, source: 'defillama-contract' };
  } catch (e) {
    return { status: 'unavailable', priceUsd: null, source: 'defillama-contract', error: errMsg(e) };
  }
}

async function blockscoutTokenBalances(chain) {
  const base = BLOCKSCOUT[chain];
  try {
    const j = await fetchJson(`${base}/api/v2/addresses/${COMPANY.wallet}/token-balances`, {}, 25000);
    return { status: 'ok', items: Array.isArray(j) ? j : (j?.items || []) };
  } catch (e) {
    return { status: 'unavailable', items: [], error: errMsg(e) };
  }
}

function nextUrl(baseUrl, params) {
  const u = new URL(baseUrl);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== null && v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function blockscoutPaged(url, maxPages = 100) {
  const items = [];
  let current = url;
  let pages = 0;
  const seen = new Set();
  while (current && pages < maxPages && !seen.has(current)) {
    seen.add(current);
    const j = await fetchJson(current, {}, 25000);
    items.push(...(j?.items || []));
    pages += 1;
    current = j?.next_page_params ? nextUrl(url, j.next_page_params) : null;
  }
  return { items, pages, truncated: Boolean(current) };
}

async function ethereumTokenHistory() {
  const url = `${BLOCKSCOUT.ethereum}/api/v2/addresses/${COMPANY.wallet}/token-transfers?type=ERC-20`;
  try {
    const r = await blockscoutPaged(url, 100);
    return { status: 'ok', ...r };
  } catch (e) {
    return { status: 'unavailable', items: [], pages: 0, truncated: false, error: errMsg(e) };
  }
}

function earliestInbound(history, address) {
  const wallet = lower(COMPANY.wallet);
  const token = lower(address);
  const rows = (history?.items || []).filter(tf => {
    const addr = lower(tokenAddress(tf));
    const to = lower(txAddress(tf.to));
    return addr === token && to === wallet && iso(tf.timestamp);
  }).map(tf => ({
    timestamp: iso(tf.timestamp),
    block: Number(tf.block_number || tf.block || 0) || null,
    txHash: tf.transaction_hash || tf.transactionHash || null,
    from: txAddress(tf.from),
    token: canonicalAddress(tokenAddress(tf))
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return rows[0] || null;
}

function classifyProtocol(meta, address) {
  const a = lower(address);
  const symbol = lower(meta?.symbol).replace(/[^a-z0-9]/g, '');
  const name = lower(meta?.name);

  if (a === lower(KNOWN.fxSAVE) || symbol === 'fxsave' || name.includes('f(x)') || name.includes('fx save')) {
    return { protocol: 'f(x) Protocol', positionType: 'Savings Stable', hintKey: 'f(x) Protocol' };
  }
  if (a === lower(KNOWN.sBOLD) || symbol === 'sbold' || name.includes('sbold')) {
    return { protocol: 'Liquity V2', positionType: 'Savings Stable', hintKey: 'Liquity V2' };
  }
  if (symbol === 'sdola' || name.includes('sdola') || name.includes('savings dola')) {
    return { protocol: 'Inverse', positionType: 'Savings Stable', hintKey: 'Inverse' };
  }
  if (symbol.startsWith('yv') || name.includes('yearn') || name.includes('yvault')) {
    return { protocol: 'Yearn V3', positionType: 'Stable Vault', hintKey: 'Yearn V3' };
  }
  if (symbol === 'susds' || symbol === 'stusds' || name.includes('savings usds') || name.includes('staked usds')) {
    return { protocol: 'Sky', positionType: 'Savings Stable', hintKey: 'Sky' };
  }
  if (a === lower(KNOWN.sGHO) || symbol === 'sgho' || name.includes('savings gho')) {
    return { protocol: 'Aave', positionType: 'Savings Stable', hintKey: 'Aave V3' };
  }
  if (a === lower(KNOWN.scrvUSD) || symbol === 'scrvusd' || name.includes('savings crvusd')) {
    return { protocol: 'Curve', positionType: 'Savings Stable', hintKey: 'Curve' };
  }
  if (a === lower(KNOWN.sfrxUSD) || symbol === 'sfrxusd' || name.includes('staked frax usd') || name.includes('staked frxusd')) {
    return { protocol: 'Frax Finance', positionType: 'Savings Stable', hintKey: 'Frax Finance' };
  }
  if (symbol === 'steth' || symbol === 'wsteth' || name.includes('staked ether') || name.includes('wrapped steth')) {
    return { protocol: 'Lido', positionType: 'Liquid Staking', hintKey: 'Lido', explicitlyNonStable: true };
  }
  return { protocol: null, positionType: null, hintKey: null };
}

async function detectErc4626(provider, address, shareRaw, shareDecimals) {
  const c = new Contract(address, [
    'function asset() view returns (address)',
    'function previewRedeem(uint256 shares) view returns (uint256)',
    'function convertToAssets(uint256 shares) view returns (uint256)',
    'function totalAssets() view returns (uint256)'
  ], provider);
  try {
    const asset = getAddress(await c.asset());
    const assetMeta = await tokenMeta(provider, asset);
    let assetsRaw = 0n;
    let method = null;
    try {
      assetsRaw = positiveBigInt(await c.previewRedeem(shareRaw));
      method = 'previewRedeem';
    } catch {
      assetsRaw = positiveBigInt(await c.convertToAssets(shareRaw));
      method = 'convertToAssets';
    }
    let totalAssetsRaw = null;
    try { totalAssetsRaw = positiveBigInt(await c.totalAssets()).toString(); } catch {}
    return {
      status: 'ok',
      standard: 'ERC-4626-compatible',
      asset,
      assetMeta,
      shareDecimals,
      redeemableRaw: assetsRaw.toString(),
      redeemable: Number(formatUnits(assetsRaw, assetMeta.decimals)),
      method,
      totalAssetsRaw
    };
  } catch (e) {
    return { status: 'not-detected', error: errMsg(e) };
  }
}

async function valueTokenRecursive(provider, chain, address, raw, decimals, depth = 0, visited = new Set()) {
  const key = lower(address);
  if (depth > 3 || visited.has(key)) {
    return { status: 'unresolved', reason: 'valuation recursion boundary reached' };
  }
  const nextVisited = new Set(visited);
  nextVisited.add(key);

  const meta = await tokenMeta(provider, address, { decimals });
  const amount = Number(formatUnits(raw, meta.decimals));

  if (stableSymbol(meta.symbol)) {
    const price = await llamaPrice(chain, address);
    if (price.priceUsd != null) {
      return {
        status: 'ok',
        terminalType: 'stable-asset',
        terminal: address,
        terminalSymbol: meta.symbol,
        terminalAmount: amount,
        price,
        valueUsd: amount * price.priceUsd,
        path: [{ token: address, symbol: meta.symbol, amount }]
      };
    }
    return {
      status: 'unpriced',
      terminalType: 'stable-asset',
      terminal: address,
      terminalSymbol: meta.symbol,
      terminalAmount: amount,
      price,
      path: [{ token: address, symbol: meta.symbol, amount }]
    };
  }

  const vault = await detectErc4626(provider, address, raw, meta.decimals);
  if (vault.status === 'ok' && positiveBigInt(vault.redeemableRaw) > 0n) {
    const inner = await valueTokenRecursive(
      provider,
      chain,
      vault.asset,
      BigInt(vault.redeemableRaw),
      vault.assetMeta.decimals,
      depth + 1,
      nextVisited
    );
    return {
      ...inner,
      path: [
        {
          token: address,
          symbol: meta.symbol,
          amount,
          standard: 'ERC-4626',
          redeemMethod: vault.method,
          redeemableToken: vault.asset,
          redeemableSymbol: vault.assetMeta.symbol,
          redeemableAmount: vault.redeemable
        },
        ...(inner.path || [])
      ],
      immediateVault: vault
    };
  }

  // Special/provisional fallback for known stable savings wrappers whose first redemption leg
  // is not itself a canonical dollar stable (notably fxSAVE -> fxSP).
  const protocol = classifyProtocol(meta, address);
  if (protocol.protocol && !protocol.explicitlyNonStable) {
    const price = await llamaPrice(chain, address);
    if (price.priceUsd != null) {
      return {
        status: 'ok-provisional-wrapper-price',
        terminalType: 'known-stable-strategy-wrapper-market-price',
        terminal: address,
        terminalSymbol: meta.symbol,
        terminalAmount: amount,
        price,
        valueUsd: amount * price.priceUsd,
        path: [{ token: address, symbol: meta.symbol, amount, fallback: 'wrapper-market-price' }],
        reason: 'economic redemption path requires a protocol-specific adapter; market price is used only for current-state reconciliation'
      };
    }
  }

  return {
    status: 'unresolved',
    terminal: address,
    terminalSymbol: meta.symbol,
    terminalAmount: amount,
    path: [{ token: address, symbol: meta.symbol, amount }],
    reason: vault.error || 'not a verified stable asset / ERC-4626 stable path'
  };
}

function priorAavePositions(discovery) {
  const rows = discovery?.stableCapital?.positions || [];
  return rows.filter(p => lower(p.protocol).includes('aave'));
}

function priorAaveATokens(discovery) {
  return new Set(priorAavePositions(discovery).map(p => lower(p.aToken)).filter(Boolean));
}

async function discoverDirectPositions(discovery, history) {
  const stablePositions = [];
  const nonStableDiagnostics = [];
  const unresolved = [];
  const diagnostics = [];
  const aTokens = priorAaveATokens(discovery);

  for (const chain of ['ethereum', 'base']) {
    const balances = await blockscoutTokenBalances(chain);
    if (balances.status !== 'ok') {
      diagnostics.push(`${chain}: Blockscout token balances ${balances.error || balances.status}`);
      continue;
    }
    const pwrap = await withProvider(chain, async provider => provider);
    const provider = pwrap.result;
    diagnostics.push(...(pwrap.errors || []));
    if (!provider) continue;

    for (const item of balances.items) {
      const addrRaw = tokenAddress(item);
      const address = canonicalAddress(addrRaw);
      if (!address) continue;
      if (aTokens.has(lower(address))) continue; // already represented by Aave supplied position

      const token = item?.token || item || {};
      const decimals = Number(token.decimals ?? item.decimals ?? 18);
      const raw = positiveBigInt(item.value ?? item.balance ?? 0);
      if (raw <= 0n) continue;

      const meta = await tokenMeta(provider, address, {
        symbol: token.symbol || item.symbol,
        name: token.name || item.name,
        decimals
      });
      const amount = Number(formatUnits(raw, meta.decimals));
      const classification = classifyProtocol(meta, address);

      if (classification.explicitlyNonStable) {
        const price = await llamaPrice(chain, address);
        nonStableDiagnostics.push({
          id: `${chain}:${lower(address)}`,
          chain: CHAIN[chain].label,
          protocol: classification.protocol,
          positionType: classification.positionType,
          token: address,
          symbol: meta.symbol,
          name: meta.name,
          amount: round(amount),
          price,
          valueUsd: price.priceUsd != null ? round(amount * price.priceUsd, 6) : null,
          stableCapitalEligible: false,
          mandateTreatment: 'excluded: ETH-denominated liquid staking exposure is not Stable Capital',
          ownerHintMatched: classification.hintKey,
          firstObservedInbound: chain === 'ethereum' ? earliestInbound(history, address) : null
        });
        continue;
      }

      const valuation = await valueTokenRecursive(provider, chain, address, raw, meta.decimals);
      const directStable = stableSymbol(meta.symbol);
      const knownStableWrapper = Boolean(classification.protocol && !classification.explicitlyNonStable) || isKnownSavingsSymbol(meta.symbol);
      const resolvedStableStrategy = valuation.status === 'ok'
        || valuation.status === 'ok-provisional-wrapper-price'
        || directStable;

      if (resolvedStableStrategy && (knownStableWrapper || directStable || valuation.terminalType === 'stable-asset')) {
        const vaultStep = (valuation.path || []).find(x => x.standard === 'ERC-4626') || null;
        const isLiquid = directStable && !(valuation.path || []).some(x => x.standard === 'ERC-4626');
        stablePositions.push({
          id: `${chain}:${lower(address)}`,
          chain: CHAIN[chain].label,
          protocol: classification.protocol || (isLiquid ? 'Wallet' : 'ERC-4626 Vault'),
          positionType: classification.positionType || (isLiquid ? 'Liquid Stable Principal' : 'Stable Vault'),
          wrapper: isLiquid ? null : address,
          token: isLiquid ? address : null,
          wrapperSymbol: isLiquid ? null : meta.symbol,
          symbol: isLiquid ? meta.symbol : null,
          name: meta.name,
          sharesOrBalance: round(amount),
          shareRaw: raw.toString(),
          underlying: vaultStep?.redeemableToken || valuation.terminal || null,
          underlyingSymbol: vaultStep?.redeemableSymbol || valuation.terminalSymbol || null,
          redeemableUnderlying: vaultStep?.redeemableAmount ?? valuation.terminalAmount ?? null,
          economicValuation: valuation,
          valueUsd: round(valuation.valueUsd, 6),
          valuationStatus: valuation.status,
          valuationCanonical: valuation.status === 'ok',
          incomeMode: isLiquid ? 'liquid-principal' : 'embedded-yield',
          productive: !isLiquid,
          ownerHintMatched: classification.hintKey,
          history: {
            firstObservedInbound: chain === 'ethereum' ? earliestInbound(history, address) : null,
            currentCheckpoint: {
              timestamp: new Date().toISOString(),
              sharesOrBalance: round(amount),
              economicValueUsd: round(valuation.valueUsd, 6),
              terminalUnderlying: valuation.terminal || null,
              terminalUnderlyingSymbol: valuation.terminalSymbol || null,
              terminalUnderlyingAmount: valuation.terminalAmount ?? null
            }
          }
        });
        continue;
      }

      // Ignore tiny unrelated dust unless it matches an owner hint / stable-like identity.
      const wrapperPrice = await llamaPrice(chain, address);
      const approxUsd = wrapperPrice.priceUsd != null ? amount * wrapperPrice.priceUsd : null;
      if (classification.protocol || isKnownSavingsSymbol(meta.symbol) || stableSymbol(meta.symbol) || (Number.isFinite(approxUsd) && approxUsd >= 2)) {
        unresolved.push({
          chain: CHAIN[chain].label,
          token: address,
          symbol: meta.symbol,
          name: meta.name,
          amount: round(amount),
          wrapperMarketPrice: wrapperPrice,
          approxUsd: round(approxUsd, 6),
          ownerHintMatched: classification.hintKey,
          reason: valuation.reason || 'current token exists but stable economic path is not yet verified',
          valuation
        });
      }
    }
  }

  return { stablePositions, nonStableDiagnostics, unresolved, diagnostics };
}

function summarize(positions) {
  let totalUsd = 0;
  let productiveUsd = 0;
  let liquidUsd = 0;
  let priced = 0;
  const byProtocol = {};
  const byType = {};
  const byStable = {};
  for (const p of positions) {
    const v = Number(p.valueUsd);
    if (Number.isFinite(v)) {
      totalUsd += v;
      priced += 1;
      if (p.incomeMode === 'liquid-principal') liquidUsd += v;
      else productiveUsd += v;
      byProtocol[p.protocol || 'Unknown'] = (byProtocol[p.protocol || 'Unknown'] || 0) + v;
      byType[p.positionType || 'Unknown'] = (byType[p.positionType || 'Unknown'] || 0) + v;
      byStable[p.underlyingSymbol || p.symbol || p.wrapperSymbol || 'Unknown'] = (byStable[p.underlyingSymbol || p.symbol || p.wrapperSymbol || 'Unknown'] || 0) + v;
    }
  }
  for (const obj of [byProtocol, byType, byStable]) {
    for (const k of Object.keys(obj)) obj[k] = round(obj[k], 6);
  }
  return {
    totalUsd: round(totalUsd, 6),
    productiveUsd: round(productiveUsd, 6),
    liquidUsd: round(liquidUsd, 6),
    positionCount: positions.length,
    pricedPositions: priced,
    byProtocol,
    byType,
    byStable
  };
}

function ownerHintCoverage(positions, nonStableDiagnostics, unresolved) {
  const rows = [...positions, ...nonStableDiagnostics, ...unresolved];
  const count = key => rows.filter(x => x.ownerHintMatched === key).length;
  const exact = key => rows.filter(x => x.ownerHintMatched === key);
  const checks = {
    'f(x) Protocol': count('f(x) Protocol') >= 1,
    'Liquity V2': count('Liquity V2') >= 1,
    'Inverse': count('Inverse') >= 1,
    'Yearn V3': count('Yearn V3') >= 1,
    'Sky': count('Sky') >= 1,
    'Aave V3': count('Aave V3') >= 1, // second Aave leg is added from preserved Aave supplied position below
    'Curve': count('Curve') >= 1,
    'Lido': count('Lido') >= 1,
    'Frax Finance': count('Frax Finance') >= 1
  };
  return { checks, evidence: Object.fromEntries(Object.keys(checks).map(k => [k, exact(k)])) };
}

function assertDiscovery(discovery) {
  if (discovery?.version !== '1.0-company-008-monetra-stable-capital-discovery') {
    throw new Error(`expected Monetra discovery v1.0, got ${discovery?.version}`);
  }
  if (discovery?.company?.registry !== COMPANY.registry) throw new Error('discovery registry mismatch');
  if (discovery?.company?.name !== COMPANY.name) throw new Error('discovery company mismatch');
  if (lower(discovery?.company?.wallet) !== lower(COMPANY.wallet)) throw new Error('discovery wallet mismatch');
  if (!discovery?.company?.founding?.date) throw new Error('founding must already be resolved before v1.1');
  const prior = priorAavePositions(discovery);
  if (!prior.length) throw new Error('expected preserved Aave stable position from v1.0');
}

async function main() {
  const startedAt = new Date().toISOString();
  if (!fs.existsSync(DISCOVERY_PATH)) throw new Error(`missing input ${DISCOVERY_PATH}`);
  const discoveryText = fs.readFileSync(DISCOVERY_PATH, 'utf8');
  const discovery = JSON.parse(discoveryText);
  assertDiscovery(discovery);

  const history = await ethereumTokenHistory();
  const direct = await discoverDirectPositions(discovery, history);

  // Preserve the solved Aave supplied position(s) from discovery. This resolver is intentionally
  // about the missing wrapper/savings layer, not about re-researching the already solved lending leg.
  const aavePreserved = priorAavePositions(discovery).map(p => ({
    ...p,
    preservation: {
      source: 'company-008-discovery.json v1.0',
      treatment: 'preserved solved lending position; not re-researched in wrapper resolver'
    },
    ownerHintMatched: 'Aave V3'
  }));

  // De-duplicate by economic position id. Direct token scan intentionally skips preserved aTokens.
  const stablePositions = [...aavePreserved, ...direct.stablePositions];
  const summary = summarize(stablePositions);

  const coverage = ownerHintCoverage(stablePositions, direct.nonStableDiagnostics, direct.unresolved);
  // Screenshot shows two Aave rows; one is the preserved lending deposit, the other can be sGHO.
  const aaveEvidenceCount = [
    ...stablePositions,
    ...direct.nonStableDiagnostics,
    ...direct.unresolved
  ].filter(x => x.ownerHintMatched === 'Aave V3').length;
  coverage.checks['Aave V3'] = aaveEvidenceCount >= 2;

  const missingHints = Object.entries(coverage.checks).filter(([, ok]) => !ok).map(([k]) => k);
  const canonicalUnpriced = stablePositions.filter(p => p.valueUsd == null);
  const provisionalValuations = stablePositions.filter(p => p.valuationCanonical === false);
  const stableDelta = summary.totalUsd - OWNER_EVIDENCE.stableStrategyUsdApprox;
  const lido = direct.nonStableDiagnostics.filter(x => x.protocol === 'Lido');

  const stableBookReady = missingHints.length === 0
    && direct.unresolved.filter(x => x.ownerHintMatched).length === 0
    && canonicalUnpriced.length === 0;

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    company: {
      registry: COMPANY.registry,
      name: COMPANY.name,
      wallet: COMPANY.wallet,
      category: COMPANY.category,
      founding: discovery.company.founding
    },
    preservation: {
      discoveryInputVersion: discovery.version,
      discoveryInputSha256: sha256Text(discoveryText),
      foundedDatePreserved: discovery.company.founding.date,
      foundingEvidencePreserved: true,
      priorAaveStablePositionsPreserved: aavePreserved.length,
      principle: 'v1.1 does not reopen solved founding/Aave work; it resolves the missing stable-wrapper layer'
    },
    ownerEvidence: OWNER_EVIDENCE,
    parserFix: {
      issue: 'Blockscout V2 token objects use address_hash; v1.0 looked primarily for address/token_address and could silently skip current wrapper tokens.',
      correctedAddressPriority: ['token.address','token.address_hash','token.token_address','item.address_hash','item.token_address'],
      historicalTransferAddressFixApplied: true
    },
    stableCapital: {
      positions: stablePositions,
      summary,
      reconciliation: {
        ownerStableStrategyUsdApprox: OWNER_EVIDENCE.stableStrategyUsdApprox,
        reproducedStableCapitalUsd: summary.totalUsd,
        deltaVsOwnerApproxUsd: round(stableDelta, 6),
        withinLoose15UsdBand: Math.abs(stableDelta) <= 15,
        note: 'owner target is diagnostic only. If Lido is ETH-denominated it is correctly excluded even if this makes Stable Capital lower than the DeBank total.'
      },
      provisionalValuations: provisionalValuations.map(p => ({ id: p.id, protocol: p.protocol, valueUsd: p.valueUsd, valuationStatus: p.valuationStatus })),
      unresolved: direct.unresolved
    },
    nonStableDiagnostics: direct.nonStableDiagnostics,
    mandateReview: {
      lidoPositions: lido,
      rule: 'stETH/wstETH are ETH-denominated productive assets, not stable capital; exclude unless the Stable Capital mandate is intentionally changed.',
      lidoClassified: lido.length > 0
    },
    ownerHintCoverage: {
      checks: coverage.checks,
      missingHints,
      aaveEvidenceCount,
      note: 'Aave screenshot family is complete only when both the preserved lending deposit and the separate savings/other Aave position are reproduced/classified.'
    },
    history: {
      ethereumTokenTransfers: {
        status: history.status,
        pages: history.pages,
        truncated: history.truncated,
        parserUsesAddressHash: true,
        error: history.error || null
      },
      checkpointSeed: stablePositions.map(p => ({
        id: p.id,
        protocol: p.protocol,
        positionType: p.positionType,
        incomeMode: p.incomeMode,
        firstObservedActivity: p.history?.firstObservedInbound
          || p.history?.firstObservedInboundShareTransfer
          || p.history?.firstObservedInboundATokenTransfer
          || p.history?.firstObservedInboundTransfer
          || null,
        currentCheckpoint: p.history?.currentCheckpoint || null
      }))
    },
    diagnostics: direct.diagnostics,
    productionReadiness: {
      foundingResolved: true,
      preservedAaveResolved: aavePreserved.length > 0,
      ownerHintsAllClassified: missingHints.length === 0,
      stableCapitalBookReady: stableBookReady,
      pageIntegrationReady: false,
      productivityIntegrationReady: false,
      rewardsIntegrationReady: false,
      reportingIntegrationReady: false,
      note: stableBookReady
        ? 'Current-state Stable Capital inventory is reconciled enough for adapter design review. Do not patch public layers until economic mechanisms/valuation modes are reviewed.'
        : 'Keep public analytical integration closed. Resolve remaining owner-hinted wrappers/provisional economic valuation first.'
    },
    nextStep: stableBookReady
      ? 'Review exact wrapper mechanisms and promote reusable Stable Capital adapters: ERC-4626 Embedded Yield history, Aave lending, protocol-specific exceptions, then integrate Passport/Monetra/Yield Reports.'
      : 'Use only the unresolved/provisional rows for the next narrow pass; do not repeat founding or Aave lending discovery.'
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Monetra Company #008 stable resolver written: ${OUTPUT}`);
  console.log(`Version: ${VERSION}`);
  console.log(`Founded preserved: ${output.company.founding.date}`);
  console.log(`Stable positions: ${stablePositions.length}`);
  console.log(`Stable Capital USD: ${summary.totalUsd}`);
  console.log(`Productive Stable USD: ${summary.productiveUsd}`);
  console.log(`Non-stable diagnostics: ${direct.nonStableDiagnostics.length}`);
  console.log(`Unresolved: ${direct.unresolved.length}`);
  console.log(`Missing owner hints: ${missingHints.join(', ') || 'none'}`);
  console.log(`Aave evidence count: ${aaveEvidenceCount}`);
  console.log(`Stable Capital Book ready: ${stableBookReady}`);
}

main().catch(err => {
  console.error(`Monetra Company #008 resolver failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
