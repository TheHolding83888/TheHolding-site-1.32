#!/usr/bin/env node
/**
 * THE HOLDING · STABLE CAPITAL INTELLIGENCE LAYER v0.4
 *
 * Registry #008 / Monetra.eth reference implementation.
 *
 * Outputs:
 *   /companies/stable-capital-data.json
 *   /companies/embedded-yield-ledger.json
 *
 * Hard accounting boundaries:
 * - Reference annual yield = current/normalized productive capacity.
 * - Embedded Yield = value already accruing inside a balance/share position.
 * - Accrued Claimable Rewards = separately claimable protocol-side value.
 * - Realised Cash Flow = outside this collector until actually received/withdrawn.
 * - Stablecoin price/depeg effect is measured separately from strategy income.
 *
 * A GREEN workflow means the collector executed and published diagnostics.
 * It does NOT mean 100% economic/rate coverage. Read `summary.fullCoverage`.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  getAddress
} from 'ethers';
import { AaveV3Base } from '@aave-dao/aave-address-book';

const VERSION = '0.4-monetra-recurring-full-coverage';
const METHODOLOGY = '1.3-stable-capital-recurring-full-coverage';
const LEDGER_VERSION = '0.4-flow-aware-recurring-checkpoints';
const RESOLVER_REQUIRED = '1.4-company-008-fraxtal-sfrxusd-close';

const ROOT = path.resolve(process.cwd());
const RESOLVER_FILE = process.env.MONETRA_RESOLVER_FILE || path.join(ROOT, 'companies', 'company-008-resolve.json');
const DATA_FILE = process.env.STABLE_CAPITAL_DATA_FILE || path.join(ROOT, 'companies', 'stable-capital-data.json');
const LEDGER_FILE = process.env.EMBEDDED_YIELD_LEDGER_FILE || path.join(ROOT, 'companies', 'embedded-yield-ledger.json');

const WALLET = addr('0x888d39aee2aec979c81f125ea94bb3ceb60f6bbb');
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
const RAY = 1e27;
const ONE = 10n ** 18n;
const SP_YIELD_SPLIT = 0.75; // Liquity V2 protocol constant: 75% of branch interest to Stability Pool.

const ADDR = Object.freeze({
  baseUsdc: addr('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'),
  scrvusd: addr('0x0655977feb2f289a4ab78af67bab0d17aab84367'),
  fxsave: addr('0x7743e50f534a7f9f1791dde7dcd89f7783eefc39'),
  fxusdBasePool: addr('0x65c9a641afceb9c0e6034e558a319488fa0fa3be'),
  fxusd: addr('0x085780639cc2cacd35e474e71f4d000e2405d8f6'),
  usdc: addr('0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'),
  sdola: addr('0xb45ad160634c528cc3d2926d9807104fa3157305'),
  susds: addr('0xa3931d71877c0e7a3148cb7eb4463524fec27fbd'),
  sgho: addr('0xe1753f2e00940cc31213dd92013cf019dfe4ca1d'),
  ysybold: addr('0x23346b04a7f55b8760e5860aa5a77383d63491cd'),
  lidoEarnUsd: addr('0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981'),
  liquitySpWeth: addr('0x5721cbbd64fc7ae3ef44a0a3f9a790a9264cf9bf'),
  bold: addr('0x6440f144b7e50d6a8439336510312d2f54beb01d'),
  fraxtalSfrxusd: addr('0xfc00000000000000000000000000000000000008'),
  fraxtalFrxusd: addr('0xfc00000000000000000000000000000000000001'),
  fraxtalStakeUnstake: addr('0xbfc4d34db83553725ec6c768da71d2d9c1456b55')
});

const OFFICIAL = Object.freeze({
  curve: 'https://www.curve.finance/crvusd/ethereum/scrvUSD',
  fx: 'https://fx.aladdin.club/v2/fxsave',
  fxSdk: 'https://github.com/AladdinDAO/fx-sdk/blob/main/src/core/fxsave.ts',
  fxSdkContracts: 'https://github.com/AladdinDAO/fx-sdk/blob/main/src/configs/contracts.ts',
  inverse: 'https://www.inverse.finance/',
  inverseSdola: 'https://www.inverse.finance/sDOLA',
  sky: 'https://sky.money/susds',
  sgho: 'https://app.aave.com/sgho/',
  yearn: 'https://yearn.fi/vaults/1/0x9f4330700a36b29952869fac9b33f45eedd8a3d8',
  lido: 'https://stake.lido.fi/earn/usd',
  lidoHome: 'https://lido.fi/',
  frax: 'https://frax.com/earn',
  fraxDocs: 'https://docs.frax.com/frxusd/stake-and-unstake-quickstart-fraxtal',
  liquityDocs: 'https://docs.liquity.org/v2-faq/bold-and-earn'
});

const RPC = Object.freeze({
  ethereum: unique([
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com',
    'https://eth.blockscout.com/api/eth-rpc'
  ]),
  base: unique([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ]),
  fraxtal: unique([
    process.env.FRAXTAL_RPC_URL,
    process.env.FRAXTAL_RPC_URL_2,
    'https://fraxtal.gateway.tenderly.co',
    'https://rpc.frax.com'
  ])
});

const HISTORY_RPC = Object.freeze({
  ethereum: unique([
    process.env.ETH_ARCHIVE_RPC_URL,
    process.env.ETH_RPC_URL,
    'https://eth.blockscout.com/api/eth-rpc'
  ])
});

function addr(x) { return getAddress(String(x).toLowerCase()); }
function unique(xs) { return [...new Set(xs.filter(Boolean))]; }
function lower(x) { return String(x || '').toLowerCase(); }
function round(x, d = 8) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function isoNow() { return new Date().toISOString(); }
function dayKey(ts = Date.now()) { return new Date(ts).toISOString().slice(0, 10); }
function sha256(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function errorText(e) { return String(e?.shortMessage || e?.message || e || 'unknown error').slice(0, 1600); }
function finite(x) { return Number.isFinite(Number(x)); }
function safeBig(x) { try { return BigInt(x); } catch { return 0n; } }

async function fetchText(url, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'user-agent': 'The-Holding-Stable-Capital-Intelligence/0.1' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = 15000) {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text);
}

function stripHtml(text) {
  return String(text)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function allPercentMatches(text, regex) {
  const vals = [];
  for (const m of String(text).matchAll(regex)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0 && n < 200) vals.push(n);
  }
  return [...new Set(vals.map(v => round(v, 6)))];
}

function selectedOfficialRate({ protocol, url, text, patterns, rateType = 'APY', note = null }) {
  const hay = stripHtml(text);
  const values = [];
  for (const rx of patterns) values.push(...allPercentMatches(hay, rx));
  const uniq = [...new Set(values)];
  if (uniq.length === 1) {
    return {
      status: 'ok',
      protocol,
      annualYieldPct: uniq[0],
      rawRatePct: uniq[0],
      rawRateType: rateType,
      normalizedRateType: 'annual-yield',
      sourceType: 'official-frontend',
      source: url,
      note
    };
  }
  return {
    status: uniq.length > 1 ? 'warming-ambiguous' : 'warming-unavailable',
    protocol,
    annualYieldPct: null,
    rawRatePct: null,
    rawRateType: rateType,
    normalizedRateType: 'annual-yield',
    sourceType: 'official-frontend',
    source: url,
    candidates: uniq,
    note: uniq.length > 1
      ? `Multiple distinct positive ${rateType} candidates found; refusing to choose.`
      : `No unambiguous positive ${rateType} found.`,
    parserContext: hay.slice(0, 800)
  };
}

async function withProvider(chain, fn) {
  const attempts = [];
  for (const url of RPC[chain] || []) {
    let provider;
    try {
      const chainId = chain === 'ethereum' ? 1 : chain === 'base' ? 8453 : 252;
      provider = new JsonRpcProvider(url, chainId, { staticNetwork: true });
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== chainId) throw new Error(`wrong chain ${network.chainId}`);
      const value = await fn(provider, url);
      return { ok: true, value, providerUrl: url, attempts };
    } catch (e) {
      attempts.push({ url, error: errorText(e) });
      try { provider?.destroy?.(); } catch {}
    }
  }
  return { ok: false, error: 'all providers failed', attempts };
}

async function withArchiveProvider(fn) {
  const attempts = [];
  for (const url of HISTORY_RPC.ethereum) {
    let provider;
    try {
      provider = new JsonRpcProvider(url, 1, { staticNetwork: true });
      const value = await fn(provider, url);
      return { ok: true, value, providerUrl: url, attempts };
    } catch (e) {
      attempts.push({ url, error: errorText(e) });
      try { provider?.destroy?.(); } catch {}
    }
  }
  return { ok: false, error: 'all archive providers failed', attempts };
}

async function tokenMeta(provider, token, blockTag) {
  const c = new Contract(token, [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)',
    'function name() view returns (string)'
  ], provider);
  const ov = blockTag == null ? {} : { blockTag };
  let decimals = 18, symbol = null, name = null;
  try { decimals = Number(await c.decimals(ov)); } catch {}
  try { symbol = await c.symbol(ov); } catch {}
  try { name = await c.name(ov); } catch {}
  return { address: addr(token), decimals, symbol, name };
}

async function llamaPrice(chain, token) {
  const key = `${chain}:${lower(token)}`;
  try {
    const j = await fetchJson(`https://coins.llama.fi/prices/current/${encodeURIComponent(key)}`);
    const hit = j?.coins?.[key] || Object.values(j?.coins || {})[0];
    const px = Number(hit?.price);
    if (Number.isFinite(px) && px > 0) {
      return { status: 'ok', priceUsd: px, source: `defillama-contract:${chain}`, timestamp: hit?.timestamp || null };
    }
  } catch (e) {
    return { status: 'unavailable', priceUsd: null, source: `defillama-contract:${chain}`, error: errorText(e) };
  }
  return { status: 'unavailable', priceUsd: null, source: `defillama-contract:${chain}` };
}

async function currentErc4626Snapshot(provider, wrapper, wallet, chain = 'ethereum', maxDepth = 3) {
  const wrapperMeta = await tokenMeta(provider, wrapper);
  const erc20 = new Contract(wrapper, ['function balanceOf(address) view returns (uint256)'], provider);
  const shareRaw = safeBig(await erc20.balanceOf(wallet));
  const shares = Number(formatUnits(shareRaw, wrapperMeta.decimals));

  async function redeem(token, raw, depth, pathRows) {
    if (depth > maxDepth) return { terminal: token, raw, meta: await tokenMeta(provider, token), pathRows, canonical: false, reason: 'max-depth' };
    const c = new Contract(token, [
      'function asset() view returns (address)',
      'function previewRedeem(uint256) view returns (uint256)',
      'function convertToAssets(uint256) view returns (uint256)'
    ], provider);
    let asset;
    try { asset = addr(await c.asset()); }
    catch {
      return { terminal: token, raw, meta: await tokenMeta(provider, token), pathRows, canonical: true };
    }
    let out = 0n, method = null;
    try { out = safeBig(await c.previewRedeem(raw)); method = 'previewRedeem'; }
    catch {
      try { out = safeBig(await c.convertToAssets(raw)); method = 'convertToAssets'; }
      catch (e) {
        return { terminal: token, raw, meta: await tokenMeta(provider, token), pathRows, canonical: false, reason: errorText(e) };
      }
    }
    const fromMeta = await tokenMeta(provider, token);
    const assetMeta = await tokenMeta(provider, asset);
    pathRows.push({
      token: addr(token), symbol: fromMeta.symbol, raw: raw.toString(),
      amount: Number(formatUnits(raw, fromMeta.decimals)),
      redeemMethod: method, redeemableToken: asset,
      redeemableSymbol: assetMeta.symbol, redeemableRaw: out.toString(),
      redeemableAmount: Number(formatUnits(out, assetMeta.decimals))
    });
    return redeem(asset, out, depth + 1, pathRows);
  }

  const red = await redeem(wrapper, shareRaw, 0, []);
  const terminalAmount = Number(formatUnits(red.raw, red.meta.decimals));
  const p = await llamaPrice(chain, red.terminal);
  const valueUsd = finite(p.priceUsd) ? terminalAmount * p.priceUsd : null;
  return {
    shareRaw: shareRaw.toString(),
    sharesOrBalance: round(shares, 12),
    terminal: red.terminal,
    terminalSymbol: red.meta.symbol,
    terminalAmount: round(terminalAmount, 12),
    terminalPriceUsd: p.priceUsd,
    valueUsd: finite(valueUsd) ? round(valueUsd, 8) : null,
    redemptionCanonical: red.canonical,
    path: red.pathRows,
    reason: red.reason || null,
    flowFingerprint: `shares:${shareRaw.toString()}`
  };
}


async function findBlockAtOrBefore(provider, targetTs) {
  const latest = await provider.getBlock('latest');
  if (!latest) throw new Error('latest block unavailable');
  if (Number(latest.timestamp) <= targetTs) return latest;

  let low = 0;
  let high = Number(latest.number);
  let best = 0;

  // Binary search is deliberately RPC-native. v0.1 depended on a Blockscout
  // timestamp endpoint which can be unavailable even while archive eth_call works.
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const block = await provider.getBlock(mid);
    if (!block) {
      high = mid - 1;
      continue;
    }
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

async function historicalUnitRate(wrapper, days = 7, maxDepth = 3) {
  const targetTs = Math.floor(Date.now() / 1000) - days * 86400;

  const call = await withArchiveProvider(async (provider, url) => {
    const histBlock = await findBlockAtOrBefore(provider, targetTs);
    const targetBlock = Number(histBlock.number);
    const wMetaNow = await tokenMeta(provider, wrapper);
    const unit = 10n ** BigInt(wMetaNow.decimals);

    async function redeemAt(token, raw, blockTag, depth) {
      if (depth > maxDepth) throw new Error('historical redeem max depth');
      const c = new Contract(token, [
        'function asset() view returns (address)',
        'function previewRedeem(uint256) view returns (uint256)',
        'function convertToAssets(uint256) view returns (uint256)'
      ], provider);
      let asset;
      try { asset = addr(await c.asset({ blockTag })); }
      catch {
        const m = await tokenMeta(provider, token, blockTag);
        return { token, raw, meta: m };
      }
      let out;
      try { out = safeBig(await c.previewRedeem(raw, { blockTag })); }
      catch { out = safeBig(await c.convertToAssets(raw, { blockTag })); }
      return redeemAt(asset, out, blockTag, depth + 1);
    }

    const now = await redeemAt(wrapper, unit, 'latest', 0);
    const then = await redeemAt(wrapper, unit, targetBlock, 0);
    if (lower(now.token) !== lower(then.token)) throw new Error('terminal token changed across history window');

    const nowAmt = Number(formatUnits(now.raw, now.meta.decimals));
    const thenAmt = Number(formatUnits(then.raw, then.meta.decimals));
    if (!(nowAmt > 0 && thenAmt > 0)) throw new Error('invalid historical redemption amounts');

    const latestBlock = await provider.getBlock('latest');
    const elapsedDays = (Number(latestBlock.timestamp) - Number(histBlock.timestamp)) / 86400;
    if (!(elapsedDays > 0.5)) throw new Error('historical interval too short');

    const annualYieldPct = (Math.pow(nowAmt / thenAmt, 365 / elapsedDays) - 1) * 100;
    return {
      annualYieldPct,
      nowTerminalPerUnitShare: nowAmt,
      historicalTerminalPerUnitShare: thenAmt,
      terminalSymbol: now.meta.symbol,
      latestBlock: Number(latestBlock.number),
      historicalBlock: targetBlock,
      historicalTimestamp: Number(histBlock.timestamp),
      elapsedDays,
      provider: new URL(url).hostname
    };
  });

  if (!call.ok) {
    return {
      status: 'warming-archive-unavailable',
      annualYieldPct: null,
      days,
      targetTimestamp: targetTs,
      attempts: call.attempts
    };
  }
  const r = call.value;
  if (!finite(r.annualYieldPct) || r.annualYieldPct < -50 || r.annualYieldPct > 200) {
    return { status: 'warming-rate-out-of-bounds', annualYieldPct: null, ...r };
  }
  return {
    status: 'ok',
    protocol: null,
    annualYieldPct: round(r.annualYieldPct, 6),
    rawRatePct: round(r.annualYieldPct, 6),
    rawRateType: `${round(r.elapsedDays, 3)}d-share-growth-annualized`,
    normalizedRateType: 'APY',
    sourceType: 'onchain-historical-share-growth',
    source: `ethereum-history:${r.provider}`,
    methodology: 'Annualized growth in redeemable terminal stable units per one vault share; token market price excluded. Historical block resolved directly by RPC timestamp binary search.',
    ...r
  };
}

async function historicalFraxtalSfrxUsdRate(days = 7) {
  const targetTs = Math.floor(Date.now() / 1000) - days * 86400;
  const res = await withProvider('fraxtal', async (provider, url) => {
    const histBlock = await findBlockAtOrBefore(provider, targetTs);
    const latest = await provider.getBlock('latest');
    const redeemer = new Contract(ADDR.fraxtalStakeUnstake, [
      'function pricePerShare() view returns (uint256)',
      'function previewRedeem(uint256) view returns (uint256)',
      'function convertToAssets(uint256) view returns (uint256)'
    ], provider);

    let nowPps = null, thenPps = null, method = null;
    try {
      nowPps = safeBig(await redeemer.pricePerShare());
      thenPps = safeBig(await redeemer.pricePerShare({ blockTag: Number(histBlock.number) }));
      method = 'pricePerShare';
    } catch {
      try {
        nowPps = safeBig(await redeemer.convertToAssets(ONE));
        thenPps = safeBig(await redeemer.convertToAssets(ONE, { blockTag: Number(histBlock.number) }));
        method = 'convertToAssets(1e18)';
      } catch {
        nowPps = safeBig(await redeemer.previewRedeem(ONE));
        thenPps = safeBig(await redeemer.previewRedeem(ONE, { blockTag: Number(histBlock.number) }));
        method = 'previewRedeem(1e18)';
      }
    }

    if (nowPps <= 0n || thenPps <= 0n) throw new Error('invalid Fraxtal sfrxUSD PPS');
    const now = Number(formatUnits(nowPps, 18));
    const then = Number(formatUnits(thenPps, 18));
    const elapsedDays = (Number(latest.timestamp) - Number(histBlock.timestamp)) / 86400;
    const apy = (Math.pow(now / then, 365 / elapsedDays) - 1) * 100;

    return {
      annualYieldPct: apy,
      nowPps: now,
      historicalPps: then,
      elapsedDays,
      latestBlock: Number(latest.number),
      historicalBlock: Number(histBlock.number),
      provider: new URL(url).hostname,
      method
    };
  });

  if (!res.ok) {
    return { status: 'warming-fraxtal-history', protocol: 'Frax Finance', annualYieldPct: null, attempts: res.attempts };
  }
  const r = res.value;
  if (!finite(r.annualYieldPct) || r.annualYieldPct < -50 || r.annualYieldPct > 200) {
    return { status: 'warming-rate-out-of-bounds', protocol: 'Frax Finance', annualYieldPct: null, ...r };
  }
  return {
    status: 'ok',
    protocol: 'Frax Finance',
    annualYieldPct: round(r.annualYieldPct, 6),
    rawRatePct: round(r.annualYieldPct, 6),
    rawRateType: `${round(r.elapsedDays, 3)}d-fraxtal-pps-growth-annualized`,
    normalizedRateType: 'APY',
    sourceType: 'onchain-fraxtal-redeemer-pps-growth',
    source: OFFICIAL.fraxDocs,
    methodology: 'Annualized growth of the official FraxtalERC4626MintRedeemer sfrxUSD/frxUSD price-per-share. No wrapper market price is used.',
    ...r
  };
}

function aaveRayToApy(rateRay) {
  const r = Number(rateRay) / RAY;
  if (!Number.isFinite(r) || r < 0) return null;
  return (Math.pow(1 + r / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
}

async function rateAaveBaseUsdc() {
  const res = await withProvider('base', async provider => {
    const dp = new Contract(AaveV3Base.AAVE_PROTOCOL_DATA_PROVIDER, [
      'function getUserReserveData(address asset,address user) view returns (uint256 currentATokenBalance,uint256 currentStableDebt,uint256 currentVariableDebt,uint256 principalStableDebt,uint256 scaledVariableDebt,uint256 stableBorrowRate,uint256 liquidityRate,uint40 stableRateLastUpdated,bool usageAsCollateralEnabled)'
    ], provider);
    const user = await dp.getUserReserveData(ADDR.baseUsdc, WALLET);
    const liquidityRateRay = safeBig(user.liquidityRate ?? user[6]);
    const apy = aaveRayToApy(liquidityRateRay);
    const bal = Number(formatUnits(safeBig(user.currentATokenBalance ?? user[0]), 6));
    return { apy, liquidityRateRay: liquidityRateRay.toString(), currentUnderlyingEquivalent: bal };
  });
  if (!res.ok || !finite(res.value?.apy)) {
    return { status: 'warming-provider', annualYieldPct: null, source: 'Aave V3 Base onchain', attempts: res.attempts };
  }
  return {
    status: 'ok',
    protocol: 'Aave v3',
    annualYieldPct: round(res.value.apy, 6),
    rawRatePct: round(res.value.apy, 6),
    rawRateType: 'APY',
    normalizedRateType: 'APY',
    sourceType: 'onchain-current-liquidity-rate',
    source: 'Aave V3 Base AAVE_PROTOCOL_DATA_PROVIDER',
    provider: res.providerUrl ? new URL(res.providerUrl).hostname : null,
    currentUnderlyingEquivalent: round(res.value.currentUnderlyingEquivalent, 12),
    liquidityRateRay: res.value.liquidityRateRay,
    methodology: 'Aave liquidityRate RAY normalized with per-second compounding, matching existing The Holding Aave adapter.'
  };
}


function contextualRateCandidates(raw, needle, {
  span = 24000,
  percentPatterns = [],
  decimalPatterns = []
} = {}) {
  const text = String(raw || '');
  const lowerText = text.toLowerCase();
  const n = lowerText.indexOf(String(needle).toLowerCase());
  const contexts = [];
  if (n >= 0) {
    contexts.push(text.slice(Math.max(0, n - 2500), Math.min(text.length, n + span)));
  }
  contexts.push(text);

  const pct = [];
  for (const ctx of contexts) {
    for (const rx of percentPatterns) {
      for (const m of ctx.matchAll(rx)) {
        const v = Number(m[1]);
        if (Number.isFinite(v) && v > 0 && v < 100) pct.push(round(v, 6));
      }
    }
    for (const rx of decimalPatterns) {
      for (const m of ctx.matchAll(rx)) {
        const v = Number(m[1]);
        if (Number.isFinite(v) && v > 0 && v < 1) pct.push(round(v * 100, 6));
      }
    }
  }
  return [...new Set(pct)];
}

async function rateCurve() {
  // scrvUSD is an unmodified Yearn V3 vault. Its economically clean reference
  // rate is share growth in redeemable crvUSD, not wrapper market-price movement.
  const hist = await historicalUnitRate(ADDR.scrvusd, 7, 2);
  if (hist.status === 'ok') return { ...hist, protocol: 'Curve', canonicalProduct: 'scrvUSD' };

  try {
    const text = await fetchText(OFFICIAL.curve);
    const r = selectedOfficialRate({
      protocol: 'Curve',
      url: OFFICIAL.curve,
      text,
      rateType: 'APY',
      patterns: [
        /Current projected APY\s*([0-9]+(?:\.[0-9]+)?)\s*%/gi,
        /projected APY\s*([0-9]+(?:\.[0-9]+)?)\s*%/gi
      ],
      note: 'Official projected APY fallback when archive share-growth is unavailable.'
    });
    if (r.status === 'ok') return r;
  } catch {}
  return { ...hist, protocol: 'Curve', officialFallback: OFFICIAL.curve };
}

async function fxSaveEconomicNavAt(provider, shareRaw, blockTag = 'latest') {
  const fxSave = new Contract(ADDR.fxsave, [
    'function convertToAssets(uint256) view returns (uint256)'
  ], provider);
  const basePool = new Contract(ADDR.fxusdBasePool, [
    'function previewRedeem(uint256) view returns (uint256 amountYieldOut,uint256 amountStableOut)'
  ], provider);

  const ov = blockTag === 'latest' ? {} : { blockTag };
  const basePoolRaw = safeBig(await fxSave.convertToAssets(shareRaw, ov));
  if (basePoolRaw <= 0n) throw new Error('fxSAVE convertToAssets returned zero');

  const preview = await basePool.previewRedeem(basePoolRaw, ov);
  const fxUsdRaw = safeBig(preview.amountYieldOut ?? preview[0]);
  const usdcRaw = safeBig(preview.amountStableOut ?? preview[1]);

  const fxUsdAmount = Number(formatUnits(fxUsdRaw, 18));
  const usdcAmount = Number(formatUnits(usdcRaw, 6));
  const nominalStableNav = fxUsdAmount + usdcAmount;
  if (!(nominalStableNav > 0)) throw new Error('fxSAVE terminal stable NAV is zero');

  return {
    shareRaw: shareRaw.toString(),
    basePoolRaw: basePoolRaw.toString(),
    basePoolAmount: Number(formatUnits(basePoolRaw, 18)),
    fxUsdRaw: fxUsdRaw.toString(),
    fxUsdAmount,
    usdcRaw: usdcRaw.toString(),
    usdcAmount,
    nominalStableNav,
    terminal: 'fxUSD+USDC',
    source: 'fxSAVE.convertToAssets → FxUSDBasePool.previewRedeem'
  };
}

async function fxSaveHistoricalEconomicRate(days = 7) {
  const targetTs = Math.floor(Date.now() / 1000) - days * 86400;
  const call = await withArchiveProvider(async (provider, url) => {
    const histBlock = await findBlockAtOrBefore(provider, targetTs);
    const latestBlock = await provider.getBlock('latest');
    const unitShare = 10n ** 18n; // official SDK documents fxSAVE shares as 18 decimals.

    const [nowNav, thenNav] = await Promise.all([
      fxSaveEconomicNavAt(provider, unitShare, 'latest'),
      fxSaveEconomicNavAt(provider, unitShare, Number(histBlock.number))
    ]);

    const elapsedDays = (Number(latestBlock.timestamp) - Number(histBlock.timestamp)) / 86400;
    if (!(elapsedDays > 0.5)) throw new Error('fxSAVE historical interval too short');

    const annualYieldPct = (Math.pow(nowNav.nominalStableNav / thenNav.nominalStableNav, 365 / elapsedDays) - 1) * 100;
    return {
      annualYieldPct,
      elapsedDays,
      latestBlock: Number(latestBlock.number),
      historicalBlock: Number(histBlock.number),
      historicalTimestamp: Number(histBlock.timestamp),
      provider: new URL(url).hostname,
      currentNominalStableNavPerShare: nowNav.nominalStableNav,
      historicalNominalStableNavPerShare: thenNav.nominalStableNav,
      currentBreakdown: { fxUSD: nowNav.fxUsdAmount, USDC: nowNav.usdcAmount },
      historicalBreakdown: { fxUSD: thenNav.fxUsdAmount, USDC: thenNav.usdcAmount }
    };
  });

  if (!call.ok) {
    return {
      status: 'warming-fxsave-archive-unavailable',
      protocol: 'f(x) Protocol',
      annualYieldPct: null,
      attempts: call.attempts,
      source: OFFICIAL.fxSdk
    };
  }

  const r = call.value;
  if (!finite(r.annualYieldPct) || r.annualYieldPct < -50 || r.annualYieldPct > 200) {
    return { status: 'warming-rate-out-of-bounds', protocol: 'f(x) Protocol', annualYieldPct: null, ...r };
  }

  return {
    status: 'ok',
    protocol: 'f(x) Protocol',
    annualYieldPct: round(r.annualYieldPct, 6),
    rawRatePct: round(r.annualYieldPct, 6),
    rawRateType: `${round(r.elapsedDays, 3)}d-economic-NAV-growth-annualized`,
    normalizedRateType: 'APY',
    sourceType: 'onchain-historical-dual-stable-economic-nav',
    source: OFFICIAL.fxSdk,
    contractsSource: OFFICIAL.fxSdkContracts,
    methodology: 'Annualized growth of nominal stable redemption value per one fxSAVE share: fxSAVE.convertToAssets → FxUSDBasePool.previewRedeem → fxUSD + USDC. Stablecoin market-price/depeg movement is excluded from Reference APY.',
    ...r
  };
}

async function currentFxSaveCanonicalSnapshot(provider) {
  const token = new Contract(ADDR.fxsave, ['function balanceOf(address) view returns (uint256)'], provider);
  const shareRaw = safeBig(await token.balanceOf(WALLET));
  if (shareRaw <= 0n) throw new Error('Monetra fxSAVE balance is zero');

  const nav = await fxSaveEconomicNavAt(provider, shareRaw, 'latest');
  const [fxUsdPrice, usdcPrice] = await Promise.all([
    llamaPrice('ethereum', ADDR.fxusd),
    llamaPrice('ethereum', ADDR.usdc)
  ]);

  const fxPx = finite(fxUsdPrice.priceUsd) ? Number(fxUsdPrice.priceUsd) : 1;
  const usdcPx = finite(usdcPrice.priceUsd) ? Number(usdcPrice.priceUsd) : 1;
  const economicValueUsd = nav.fxUsdAmount * fxPx + nav.usdcAmount * usdcPx;
  const effectiveBasketPrice = nav.nominalStableNav > 0 ? economicValueUsd / nav.nominalStableNav : 1;

  return {
    sharesOrBalance: Number(formatUnits(shareRaw, 18)),
    shareRaw: shareRaw.toString(),
    underlyingAmount: round(nav.nominalStableNav, 12),
    terminalSymbol: 'fxUSD+USDC',
    terminalPriceUsd: round(effectiveBasketPrice, 10),
    economicValueUsd: round(economicValueUsd, 8),
    flowFingerprint: `shares:${shareRaw.toString()}`,
    ledgerComparable: true,
    valuationCanonical: true,
    stableComponents: {
      fxUSD: { amount: round(nav.fxUsdAmount, 12), priceUsd: fxUsdPrice.priceUsd, priceSource: fxUsdPrice.source },
      USDC: { amount: round(nav.usdcAmount, 12), priceUsd: usdcPrice.priceUsd, priceSource: usdcPrice.source }
    },
    basePoolAmount: round(nav.basePoolAmount, 12),
    redemptionPath: [
      { from: 'fxSAVE', method: 'convertToAssets', to: 'fxSP / FxUSDBasePool', amount: round(nav.basePoolAmount, 12) },
      { from: 'fxSP / FxUSDBasePool', method: 'previewRedeem', to: 'fxUSD + USDC', fxUSD: round(nav.fxUsdAmount, 12), USDC: round(nav.usdcAmount, 12) }
    ],
    note: 'Canonical economic NAV from the same read path used by the official AladdinDAO fx-sdk. Reference yield uses nominal stable units; current USD book value applies current fxUSD/USDC prices separately.'
  };
}

async function rateFx() {
  const canonical = await fxSaveHistoricalEconomicRate(7);
  if (canonical.status === 'ok') return canonical;

  // Do not promote an HTML number to full coverage if the canonical economic-NAV
  // history cannot be reproduced. Keep the official page only as a diagnostic hint.
  try {
    const raw = await fetchText(OFFICIAL.fx);
    const visible = stripHtml(raw);
    const candidates = contextualRateCandidates(visible, 'fxSAVE', {
      percentPatterns: [/(?:fxSAVE|fxsave)[\s\S]{0,1800}?APY[^0-9]{0,80}([0-9]+(?:\.[0-9]+)?)\s*%/gi]
    }).filter(v => v > 0 && v < 50);
    return { ...canonical, officialPageCandidates: [...new Set(candidates)], officialPage: OFFICIAL.fx };
  } catch {
    return { ...canonical, officialPage: OFFICIAL.fx };
  }
}

async function rateInverse() {
  try {
    const text = await fetchText(OFFICIAL.inverse);
    const r = selectedOfficialRate({
      protocol: 'Inverse',
      url: OFFICIAL.inverse,
      text,
      rateType: 'APY',
      patterns: [/sDOLA APY\s*([0-9]+(?:\.[0-9]+)?)\s*%/gi],
      note: 'Official Inverse sDOLA APY; ambiguous hydration values are rejected.'
    });
    if (r.status === 'ok') return r;
  } catch {}
  const hist = await historicalUnitRate(ADDR.sdola, 7, 2);
  return { ...hist, protocol: 'Inverse', fallbackFrom: OFFICIAL.inverse };
}

async function rateSky() {
  try {
    const text = await fetchText(OFFICIAL.sky);
    return selectedOfficialRate({
      protocol: 'Sky',
      url: OFFICIAL.sky,
      text,
      rateType: 'APY',
      patterns: [
        /currently\s*([0-9]+(?:\.[0-9]+)?)\s*%\s*APY/gi,
        /Sky Savings Rate.{0,120}?([0-9]+(?:\.[0-9]+)?)\s*%\s*APY/gi
      ],
      note: 'Governance-set current Sky Savings Rate for sUSDS.'
    });
  } catch (e) {
    const hist = await historicalUnitRate(ADDR.susds, 7, 2);
    return { ...hist, protocol: 'Sky', fallbackReason: errorText(e) };
  }
}

async function rateSGho() {
  const hist = await historicalUnitRate(ADDR.sgho, 7, 2);
  if (hist.status === 'ok') {
    return {
      ...hist,
      protocol: 'Aave · sGHO',
      canonicalProduct: 'sGHO',
      note: 'Reference APY from canonical sGHO redeemable-GHO share growth; avoids brittle application scraping.'
    };
  }
  try {
    const raw = await fetchText(OFFICIAL.sgho);
    const values = contextualRateCandidates(raw, 'sGHO', {
      percentPatterns: [/earn[^0-9]{0,80}([0-9]+(?:\.[0-9]+)?)\s*%\s*APR/gi]
    });
    if (values.length === 1) {
      return {
        status: 'ok', protocol: 'Aave · sGHO', annualYieldPct: values[0],
        rawRatePct: values[0], rawRateType: 'APR', normalizedRateType: 'annual-yield',
        normalization: 'APR used as one-year annual yield with no invented compounding.',
        sourceType: 'official-application-payload', source: OFFICIAL.sgho
      };
    }
  } catch {}
  return { ...hist, protocol: 'Aave · sGHO', fallbackFrom: OFFICIAL.sgho };
}

async function rateYearn() {
  // ysyBOLD is nested: ysyBOLD → yBOLD → BOLD. The nested redemption engine
  // measures the full terminal BOLD-per-share growth, including auto-compounding.
  const hist = await historicalUnitRate(ADDR.ysybold, 7, 3);
  if (hist.status === 'ok') {
    return {
      ...hist,
      protocol: 'Yearn V3',
      canonicalProduct: 'ysyBOLD / yBOLD Auto-Compounder',
      note: 'Nested canonical share growth in terminal BOLD.'
    };
  }
  try {
    const raw = await fetchText(OFFICIAL.yearn);
    const visible = stripHtml(raw);
    const values = contextualRateCandidates(visible, 'APY', {
      percentPatterns: [/Est\.?\s*APY[^0-9]{0,60}([0-9]+(?:\.[0-9]+)?)\s*%/gi]
    });
    if (values.length === 1) {
      return {
        status: 'ok', protocol: 'Yearn V3', annualYieldPct: values[0],
        rawRatePct: values[0], rawRateType: 'Est. APY', normalizedRateType: 'APY',
        sourceType: 'official-frontend', source: OFFICIAL.yearn
      };
    }
  } catch {}
  return { ...hist, protocol: 'Yearn V3', fallbackFrom: OFFICIAL.yearn };
}

async function rateLido() {
  // lido.fi exposes the EarnUSD APY server-side more reliably than the app shell.
  for (const url of [OFFICIAL.lidoHome, OFFICIAL.lido]) {
    try {
      const raw = await fetchText(url);
      const visible = stripHtml(raw);
      let values = contextualRateCandidates(visible, 'EarnUSD', {
        span: 5000,
        percentPatterns: [
          /EarnUSD[\s\S]{0,1200}?([0-9]+(?:\.[0-9]+)?)\s*%\s*APY/gi,
          /APY\*?\s*\([^)]*avg\.\)[^0-9]{0,80}([0-9]+(?:\.[0-9]+)?)\s*%/gi
        ]
      });
      values.push(...contextualRateCandidates(raw, 'EarnUSD', {
        span: 10000,
        percentPatterns: [/EarnUSD[\s\S]{0,3000}?([0-9]+(?:\.[0-9]+)?)\s*%[\s\S]{0,120}?APY/gi]
      }));
      values = [...new Set(values)].filter(v => v > 0 && v < 50);
      if (values.length === 1) {
        return {
          status: 'ok',
          protocol: 'Lido Earn',
          annualYieldPct: values[0],
          rawRatePct: values[0],
          rawRateType: '14d avg APY',
          normalizedRateType: 'APY',
          sourceType: 'official-lido-product-page',
          source: url,
          note: 'Official EarnUSD trailing-average APY. The product page explicitly labels this as APY and the Earn app describes it as a 14-day average.'
        };
      }
    } catch {}
  }
  return {
    status: 'warming-official-rate-unavailable',
    protocol: 'Lido Earn',
    annualYieldPct: null,
    source: OFFICIAL.lidoHome,
    note: 'No unambiguous EarnUSD APY could be reproduced from official Lido pages.'
  };
}

async function rateLiquity() {
  const res = await withProvider('ethereum', async provider => {
    const sp = new Contract(ADDR.liquitySpWeth, [
      'function activePool() view returns (address)',
      'function getTotalBoldDeposits() view returns (uint256)',
      'function getCompoundedBoldDeposit(address) view returns (uint256)',
      'function getDepositorYieldGain(address) view returns (uint256)',
      'function getDepositorCollGain(address) view returns (uint256)'
    ], provider);
    const activePool = addr(await sp.activePool());
    const totalBoldDeposits = safeBig(await sp.getTotalBoldDeposits());
    const userDeposit = safeBig(await sp.getCompoundedBoldDeposit(WALLET));
    const userYield = safeBig(await sp.getDepositorYieldGain(WALLET));
    const userCollGain = safeBig(await sp.getDepositorCollGain(WALLET));

    const ap = new Contract(activePool, [
      'function aggWeightedDebtSum() view returns (uint256)'
    ], provider);
    const weighted = safeBig(await ap.aggWeightedDebtSum());
    if (totalBoldDeposits <= 0n || weighted <= 0n) throw new Error('invalid Liquity aggregate state');

    const annualInterestBold = Number(weighted) / 1e18 / 1e18 * SP_YIELD_SPLIT;
    const totalDepositsBold = Number(totalBoldDeposits) / 1e18;
    const aprPct = annualInterestBold / totalDepositsBold * 100;

    return {
      activePool, weighted: weighted.toString(), totalBoldDeposits: totalBoldDeposits.toString(),
      userDeposit: Number(formatUnits(userDeposit, 18)),
      userYield: Number(formatUnits(userYield, 18)),
      userCollGain: Number(formatUnits(userCollGain, 18)),
      aprPct
    };
  });

  if (!res.ok || !finite(res.value?.aprPct) || res.value.aprPct < 0 || res.value.aprPct > 100) {
    return { status: 'warming-onchain-rate', protocol: 'Liquity V2', annualYieldPct: null, source: 'Liquity V2 WETH Stability Pool onchain', attempts: res.attempts };
  }
  return {
    status: 'ok',
    protocol: 'Liquity V2',
    annualYieldPct: round(res.value.aprPct, 6),
    rawRatePct: round(res.value.aprPct, 6),
    rawRateType: 'APR',
    normalizedRateType: 'annual-yield',
    normalization: 'No compounding assumed for direct Stability Pool claimable BOLD yield; numeric APR is used as one-year annual yield.',
    sourceType: 'onchain-current-borrower-interest-component',
    source: OFFICIAL.liquityDocs,
    provider: res.providerUrl ? new URL(res.providerUrl).hostname : null,
    methodology: '75% of WETH branch borrower annual interest (aggWeightedDebtSum) divided by current Stability Pool BOLD deposits. Liquidation collateral gains are variable and excluded from this conservative reference rate.',
    diagnostics: res.value
  };
}

async function rateFrax() {
  const hist = await historicalFraxtalSfrxUsdRate(7);
  if (hist.status === 'ok') return hist;

  // Official frontend remains only a fallback; if it exposes multiple percentages,
  // do not guess between them.
  try {
    const raw = await fetchText(OFFICIAL.frax);
    const visible = stripHtml(raw);
    const values = contextualRateCandidates(visible, 'sfrxUSD', {
      span: 3500,
      percentPatterns: [/sfrxUSD[\s\S]{0,1200}?([0-9]+(?:\.[0-9]+)?)\s*%/gi]
    }).filter(v => v > 0 && v < 50);
    if (values.length === 1) {
      return {
        status: 'ok', protocol: 'Frax Finance', annualYieldPct: values[0],
        rawRatePct: values[0], rawRateType: 'APY', normalizedRateType: 'APY',
        sourceType: 'official-frontend', source: OFFICIAL.frax,
        note: 'Official Frax Earn fallback; primary Fraxtal PPS history was unavailable.'
      };
    }
  } catch {}
  return { ...hist, protocol: 'Frax Finance', officialFallback: OFFICIAL.frax };
}

async function currentSnapshots(resolver) {
  const byId = Object.fromEntries(resolver.stableCapital.positions.map(p => [p.id, p]));
  const result = {};

  // Aave lending: current user reserve data and stable price.
  {
    const r = await withProvider('base', async provider => {
      const dp = new Contract(AaveV3Base.AAVE_PROTOCOL_DATA_PROVIDER, [
        'function getUserReserveData(address asset,address user) view returns (uint256 currentATokenBalance,uint256 currentStableDebt,uint256 currentVariableDebt,uint256 principalStableDebt,uint256 scaledVariableDebt,uint256 stableBorrowRate,uint256 liquidityRate,uint40 stableRateLastUpdated,bool usageAsCollateralEnabled)',
        'function getReserveTokensAddresses(address asset) view returns (address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress)'
      ], provider);
      const user = await dp.getUserReserveData(ADDR.baseUsdc, WALLET);
      const tokens = await dp.getReserveTokensAddresses(ADDR.baseUsdc);
      const aToken = addr(tokens.aTokenAddress ?? tokens[0]);
      const a = new Contract(aToken, ['function scaledBalanceOf(address) view returns (uint256)'], provider);
      const scaled = safeBig(await a.scaledBalanceOf(WALLET));
      const balRaw = safeBig(user.currentATokenBalance ?? user[0]);
      const amount = Number(formatUnits(balRaw, 6));
      const price = await llamaPrice('base', ADDR.baseUsdc);
      return {
        sharesOrBalance: amount,
        underlyingAmount: amount,
        terminalSymbol: 'USDC',
        terminalPriceUsd: price.priceUsd,
        economicValueUsd: finite(price.priceUsd) ? amount * price.priceUsd : null,
        flowFingerprint: `scaled:${scaled.toString()}`,
        scaledBalanceRaw: scaled.toString(),
        rawBalance: balRaw.toString(),
        ledgerComparable: true,
        valuationCanonical: true
      };
    });
    const id = 'base:aave:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
    result[id] = r.ok ? r.value : snapshotFallback(byId[id], 'Aave refresh unavailable', r.attempts);
  }

  const generic = [
    ['ethereum:0x0655977feb2f289a4ab78af67bab0d17aab84367', ADDR.scrvusd],
    ['ethereum:0xb45ad160634c528cc3d2926d9807104fa3157305', ADDR.sdola],
    ['ethereum:0xa3931d71877c0e7a3148cb7eb4463524fec27fbd', ADDR.susds],
    ['ethereum:0xe1753f2e00940cc31213dd92013cf019dfe4ca1d', ADDR.sgho],
    ['ethereum:0x23346b04a7f55b8760e5860aa5a77383d63491cd', ADDR.ysybold]
  ];
  const eth = await withProvider('ethereum', async provider => {
    const rows = {};
    for (const [id, token] of generic) {
      try {
        const s = await currentErc4626Snapshot(provider, token, WALLET, 'ethereum', 3);
        const fx = lower(token) === lower(ADDR.fxsave);
        rows[id] = {
          sharesOrBalance: s.sharesOrBalance,
          shareRaw: s.shareRaw,
          underlyingAmount: s.terminalAmount,
          terminalSymbol: s.terminalSymbol,
          terminalPriceUsd: s.terminalPriceUsd,
          economicValueUsd: s.valueUsd,
          flowFingerprint: s.flowFingerprint,
          ledgerComparable: s.redemptionCanonical && !fx,
          valuationCanonical: s.redemptionCanonical && !fx,
          path: s.path,
          note: fx ? 'fxSAVE remains non-comparable for Embedded Yield until fxSP terminal economic redemption is canonical.' : null
        };
      } catch (e) {
        rows[id] = snapshotFallback(byId[id], errorText(e));
      }
    }
    return rows;
  });
  for (const [id] of generic) {
    result[id] = eth.ok ? eth.value[id] : snapshotFallback(byId[id], 'Ethereum refresh unavailable', eth.attempts);
  }

  // f(x) fxSAVE: canonical dual-stable economic NAV.
  {
    const r = await withProvider('ethereum', async provider => currentFxSaveCanonicalSnapshot(provider));
    const id = 'ethereum:0x7743e50f534a7f9f1791dde7dcd89f7783eefc39';
    result[id] = r.ok
      ? r.value
      : snapshotFallback(byId[id], 'Canonical f(x) NAV refresh unavailable', r.attempts);
  }

  // Lido Earn: current share token balance + market price. First checkpoint only;
  // embedded income waits for canonical Mellow/Lido share-oracle accounting.
  {
    const r = await withProvider('ethereum', async provider => {
      const m = await tokenMeta(provider, ADDR.lidoEarnUsd);
      const c = new Contract(ADDR.lidoEarnUsd, ['function balanceOf(address) view returns (uint256)'], provider);
      const raw = safeBig(await c.balanceOf(WALLET));
      const shares = Number(formatUnits(raw, m.decimals));
      const p = await llamaPrice('ethereum', ADDR.lidoEarnUsd);
      return {
        sharesOrBalance: shares, shareRaw: raw.toString(),
        underlyingAmount: null, terminalSymbol: 'USD strategy NAV',
        terminalPriceUsd: null, economicValueUsd: finite(p.priceUsd) ? shares * p.priceUsd : null,
        flowFingerprint: `shares:${raw.toString()}`,
        ledgerComparable: false, valuationCanonical: true,
        note: 'Checkpoint seeded; future Embedded Yield uses official Lido/Mellow share-oracle accounting, not wrapper market-price movement.'
      };
    });
    const id = 'ethereum:0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981';
    result[id] = r.ok ? r.value : snapshotFallback(byId[id], 'Lido refresh unavailable', r.attempts);
  }

  // Liquity direct WETH SP. Yield is separate claimable; principal checkpoint is not Embedded Yield.
  {
    const r = await withProvider('ethereum', async provider => {
      const sp = new Contract(ADDR.liquitySpWeth, [
        'function getCompoundedBoldDeposit(address) view returns (uint256)',
        'function getDepositorYieldGain(address) view returns (uint256)',
        'function getDepositorCollGain(address) view returns (uint256)'
      ], provider);
      const dep = safeBig(await sp.getCompoundedBoldDeposit(WALLET));
      const yieldGain = safeBig(await sp.getDepositorYieldGain(WALLET));
      const collGain = safeBig(await sp.getDepositorCollGain(WALLET));
      const amount = Number(formatUnits(dep, 18));
      const p = await llamaPrice('ethereum', ADDR.bold);
      return {
        sharesOrBalance: amount, underlyingAmount: amount, terminalSymbol: 'BOLD',
        terminalPriceUsd: p.priceUsd, economicValueUsd: finite(p.priceUsd) ? amount * p.priceUsd : null,
        flowFingerprint: `spPrincipal:${dep.toString()}`,
        ledgerComparable: false, valuationCanonical: true,
        accruedClaimable: {
          protocol: 'Liquity V2', symbol: 'BOLD',
          amount: Number(formatUnits(yieldGain, 18)),
          usdValue: finite(p.priceUsd) ? Number(formatUnits(yieldGain, 18)) * p.priceUsd : null,
          collateralGainRaw: collGain.toString()
        },
        note: 'Direct Stability Pool interest/liquidation gains are separate Accrued Rewards, not Embedded Yield inside principal.'
      };
    });
    const id = 'ethereum:liquity-v2-sp:weth';
    result[id] = r.ok ? r.value : snapshotFallback(byId[id], 'Liquity refresh unavailable', r.attempts);
  }

  // Fraxtal sfrxUSD: the token itself is bridged, while canonical ERC-4626
  // conversion lives in FraxtalERC4626MintRedeemer.
  {
    const r = await withProvider('fraxtal', async provider => {
      const m = await tokenMeta(provider, ADDR.fraxtalSfrxusd);
      const token = new Contract(ADDR.fraxtalSfrxusd, ['function balanceOf(address) view returns (uint256)'], provider);
      const raw = safeBig(await token.balanceOf(WALLET));
      const shares = Number(formatUnits(raw, m.decimals));

      const redeemer = new Contract(ADDR.fraxtalStakeUnstake, [
        'function pricePerShare() view returns (uint256)',
        'function convertToAssets(uint256) view returns (uint256)',
        'function previewRedeem(uint256) view returns (uint256)'
      ], provider);
      let assetsRaw = 0n, method = null;
      try { assetsRaw = safeBig(await redeemer.convertToAssets(raw)); method = 'convertToAssets'; }
      catch {
        try { assetsRaw = safeBig(await redeemer.previewRedeem(raw)); method = 'previewRedeem'; }
        catch {
          const pps = safeBig(await redeemer.pricePerShare());
          assetsRaw = raw * pps / ONE;
          method = 'pricePerShare';
        }
      }

      const underlyingAmount = Number(formatUnits(assetsRaw, 18));
      const px = await llamaPrice('fraxtal', ADDR.fraxtalFrxusd);
      return {
        sharesOrBalance: shares,
        shareRaw: raw.toString(),
        underlyingAmount,
        terminalSymbol: 'frxUSD',
        terminalPriceUsd: px.priceUsd,
        economicValueUsd: finite(px.priceUsd) ? underlyingAmount * px.priceUsd : underlyingAmount,
        flowFingerprint: `shares:${raw.toString()}`,
        ledgerComparable: true,
        valuationCanonical: true,
        redemptionMethod: method,
        note: 'Canonical current NAV via official FraxtalERC4626MintRedeemer; no sfrxUSD market price used.'
      };
    });
    const id = 'fraxtal:0xfc00000000000000000000000000000000000008';
    result[id] = r.ok ? r.value : snapshotFallback(byId[id], 'Frax canonical refresh unavailable', r.attempts);
  }

  return result;
}

function snapshotFallback(position, note, diagnostics = null) {
  const cp = position?.history?.currentCheckpoint || {};
  const shares = cp.sharesOrBalance ?? cp.underlyingEquivalent ?? cp.compoundedBoldDeposit ?? position?.sharesOrBalance ?? position?.currentUnderlyingEquivalent ?? null;
  const amount = cp.terminalUnderlyingAmount ?? cp.redeemableUnderlying ?? cp.underlyingEquivalent ?? cp.compoundedBoldDeposit ?? position?.redeemableUnderlying ?? position?.currentUnderlyingEquivalent ?? null;
  const price = position?.economicValuation?.price?.priceUsd ?? position?.price?.priceUsd ?? null;
  return {
    sharesOrBalance: shares,
    underlyingAmount: amount,
    terminalSymbol: cp.terminalUnderlyingSymbol ?? position?.economicValuation?.terminalSymbol ?? position?.underlyingSymbol ?? position?.symbol ?? null,
    terminalPriceUsd: price,
    economicValueUsd: position?.valueUsd ?? null,
    flowFingerprint: null,
    ledgerComparable: false,
    valuationCanonical: false,
    source: 'resolver-snapshot-fallback',
    note,
    diagnostics
  };
}

async function collectRates() {
  const specs = [
    ['base:aave:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', rateAaveBaseUsdc],
    ['ethereum:0x0655977feb2f289a4ab78af67bab0d17aab84367', rateCurve],
    ['ethereum:0x7743e50f534a7f9f1791dde7dcd89f7783eefc39', rateFx],
    ['ethereum:0xb45ad160634c528cc3d2926d9807104fa3157305', rateInverse],
    ['ethereum:0xa3931d71877c0e7a3148cb7eb4463524fec27fbd', rateSky],
    ['ethereum:0xe1753f2e00940cc31213dd92013cf019dfe4ca1d', rateSGho],
    ['ethereum:0x23346b04a7f55b8760e5860aa5a77383d63491cd', rateYearn],
    ['ethereum:0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981', rateLido],
    ['ethereum:liquity-v2-sp:weth', rateLiquity],
    ['fraxtal:0xfc00000000000000000000000000000000000008', rateFrax]
  ];
  const rows = {};
  for (const [id, fn] of specs) {
    try { rows[id] = await fn(); }
    catch (e) { rows[id] = { status: 'error', annualYieldPct: null, error: errorText(e) }; }
  }
  return rows;
}

function productiveRule(position) {
  // Corrects the v1.4 resolver summary classification bug: Stable Lending is productive
  // even when the preserved discovery position lacks `productive:true`.
  if (position?.positionType === 'Stable Lending') return true;
  if (position?.productive === true) return true;
  return ['embedded-yield', 'lending-embedded', 'agent-managed-embedded-yield', 'stability-pool-yield-with-separate-claimables']
    .includes(position?.incomeMode);
}

function buildStableData(resolver, rates, snapshots, prior) {
  const generatedAt = isoNow();
  const rows = resolver.stableCapital.positions.map(p => {
    const reference = rates[p.id] || { status: 'warming-no-adapter', annualYieldPct: null };
    const snap = snapshots[p.id] || snapshotFallback(p, 'missing current snapshot');
    return {
      id: p.id,
      protocol: p.protocol,
      chain: p.chain,
      positionType: p.positionType,
      wrapperSymbol: p.wrapperSymbol || null,
      underlyingSymbol: p.underlyingSymbol || p.symbol || null,
      incomeMode: p.incomeMode,
      productive: productiveRule(p),
      valueUsd: finite(snap.economicValueUsd) ? round(snap.economicValueUsd, 8) : (finite(p.valueUsd) ? Number(p.valueUsd) : null),
      resolverValueUsd: finite(p.valueUsd) ? Number(p.valueUsd) : null,
      currentSnapshot: {
        timestamp: generatedAt,
        sharesOrBalance: snap.sharesOrBalance ?? null,
        underlyingAmount: snap.underlyingAmount ?? null,
        terminalSymbol: snap.terminalSymbol ?? null,
        terminalPriceUsd: snap.terminalPriceUsd ?? null,
        economicValueUsd: snap.economicValueUsd ?? null,
        flowFingerprint: snap.flowFingerprint ?? null,
        ledgerComparable: !!snap.ledgerComparable,
        valuationCanonical: !!snap.valuationCanonical,
        accruedClaimable: snap.accruedClaimable || null,
        note: snap.note || null
      },
      reference
    };
  });

  const productive = rows.filter(r => r.productive && finite(r.valueUsd));
  const covered = productive.filter(r => r.reference?.status === 'ok' && finite(r.reference.annualYieldPct));
  const productiveUsd = productive.reduce((s, r) => s + Number(r.valueUsd), 0);
  const coveredUsd = covered.reduce((s, r) => s + Number(r.valueUsd), 0);
  const weighted = coveredUsd > 0
    ? covered.reduce((s, r) => s + Number(r.valueUsd) * Number(r.reference.annualYieldPct), 0) / coveredUsd
    : null;
  const coverage = productiveUsd > 0 ? coveredUsd / productiveUsd : 0;
  const fullCoverage = productive.length === 10 && covered.length === 10 && coverage > 0.999999;

  const history = Array.isArray(prior?.history) ? [...prior.history] : [];
  if (fullCoverage) {
    const obs = {
      date: dayKey(),
      timestamp: generatedAt,
      registry: '008',
      company: 'Monetra.eth',
      referenceAnnualYieldPct: round(weighted, 6),
      referenceApyPct: round(weighted, 6),
      productiveStableCapitalUsd: round(productiveUsd, 6),
      coverage: 1,
      positionCount: 10,
      methodologyVersion: METHODOLOGY
    };
    const idx = history.findIndex(x => x.date === obs.date);
    if (idx >= 0) history[idx] = obs; else history.push(obs);
  }

  return {
    version: VERSION,
    methodologyVersion: METHODOLOGY,
    generatedAt,
    company: {
      registry: '008',
      name: 'Monetra.eth',
      wallet: WALLET,
      foundedAt: resolver.company?.founding?.foundedAt || null,
      foundedDate: resolver.company?.founding?.date || null,
      category: 'Stable Capital'
    },
    sourceResolver: {
      file: '/companies/company-008-resolve.json',
      version: resolver.version,
      generatedAt: resolver.generatedAt,
      sha256: sha256(JSON.stringify(resolver))
    },
    methodology: {
      headline: 'Stable Capital Reference APY',
      formula: 'capital-weighted current annualized yield across productive Stable Capital positions with valid reference rates',
      productiveCorrection: 'Stable Lending is productive even when an older resolver row omitted productive:true.',
      unknownTreatment: 'warming/error positions are excluded from numerator and denominator; never treated as 0%',
      fullCoverageGate: 'Monetra enters the weighted Composite Index only after all 10 current Stable Capital positions have valid reference annual yield.',
      rateConvention: 'Protocol APY is used directly. Protocol APR is preserved and used as one-year annual yield only when no compounding is assumed; no arbitrary compounding frequency is invented.',
      embeddedBoundary: 'Reference APY is capacity, not earned income. Earned Embedded Yield comes only from checkpoint deltas adjusted for flows.',
      fxSaveCanonicalNav: 'fxSAVE economic NAV = convertToAssets(fxSAVE shares) into FxUSDBasePool shares, then previewRedeem into fxUSD + USDC. Reference APY uses nominal stable units so depeg is excluded; current TVL applies current component prices.'
    },
    positions: rows,
    summary: {
      stableCapitalUsd: round(rows.filter(r => finite(r.valueUsd)).reduce((s, r) => s + Number(r.valueUsd), 0), 6),
      productiveStableCapitalUsd: round(productiveUsd, 6),
      coveredProductiveStableCapitalUsd: round(coveredUsd, 6),
      uncoveredProductiveStableCapitalUsd: round(productiveUsd - coveredUsd, 6),
      coverage: round(coverage, 8),
      fullCoverage,
      referenceAnnualYieldPct: finite(weighted) ? round(weighted, 6) : null,
      referenceApyPct: fullCoverage && finite(weighted) ? round(weighted, 6) : null,
      positionCount: rows.length,
      productivePositionCount: productive.length,
      coveredPositionCount: covered.length,
      warmingPositionIds: productive.filter(r => r.reference?.status !== 'ok').map(r => r.id)
    },
    history,
    readiness: {
      centralProductivityBridgeReady: fullCoverage,
      compositeIndexAdmissionReady: fullCoverage,
      removeMeasuringFromPassport: fullCoverage,
      firstFullCoverageObservationRecorded: fullCoverage,
      note: fullCoverage
        ? 'Stable Capital Reference APY is complete; next patch may bridge Monetra into central Productivity and Composite Index.'
        : 'Collector executed, but one or more rate adapters remain warming. Fix only listed adapters; do not restart wallet discovery.'
    }
  };
}

function comparableInterval(prev, curr) {
  if (!prev || !curr) return { status: 'warming-first-checkpoint', incomeUsd: null, stablePriceEffectUsd: null };
  if (!prev.ledgerComparable || !curr.ledgerComparable) {
    return { status: 'warming-noncanonical-checkpoint', incomeUsd: null, stablePriceEffectUsd: null };
  }
  if (!prev.flowFingerprint || !curr.flowFingerprint || prev.flowFingerprint !== curr.flowFingerprint) {
    return { status: 'needs-flow-reconciliation', incomeUsd: null, stablePriceEffectUsd: null };
  }
  if (!finite(prev.underlyingAmount) || !finite(curr.underlyingAmount)) {
    return { status: 'warming-underlying-unavailable', incomeUsd: null, stablePriceEffectUsd: null };
  }
  const prevPrice = finite(prev.terminalPriceUsd) ? Number(prev.terminalPriceUsd) : 1;
  const currPrice = finite(curr.terminalPriceUsd) ? Number(curr.terminalPriceUsd) : 1;
  const incomeUnderlying = Number(curr.underlyingAmount) - Number(prev.underlyingAmount);
  const incomeUsd = incomeUnderlying * currPrice;
  const priceEffectUsd = Number(prev.underlyingAmount) * (currPrice - prevPrice);
  return {
    status: 'ok',
    incomeUnderlying: round(incomeUnderlying, 12),
    incomeUsd: round(incomeUsd, 8),
    stablePriceEffectUsd: round(priceEffectUsd, 8),
    note: 'Share/scaled-balance flow fingerprint unchanged; redeemable underlying growth is strategy income. Stablecoin price effect is reported separately.'
  };
}

function buildLedger(resolver, stableData, priorLedger) {
  const now = stableData.generatedAt;
  const positions = {};
  const oldPositions = priorLedger?.positions || {};

  for (const row of stableData.positions) {
    const prior = oldPositions[row.id] || null;
    const cps = Array.isArray(prior?.checkpoints) ? [...prior.checkpoints] : [];
    const curr = {
      date: dayKey(now),
      timestamp: now,
      sharesOrBalance: row.currentSnapshot.sharesOrBalance,
      underlyingAmount: row.currentSnapshot.underlyingAmount,
      terminalSymbol: row.currentSnapshot.terminalSymbol,
      terminalPriceUsd: row.currentSnapshot.terminalPriceUsd,
      economicValueUsd: row.currentSnapshot.economicValueUsd,
      flowFingerprint: row.currentSnapshot.flowFingerprint,
      ledgerComparable: row.currentSnapshot.ledgerComparable,
      valuationCanonical: row.currentSnapshot.valuationCanonical,
      referenceAnnualYieldPct: row.reference?.annualYieldPct ?? null
    };
    const oldSameDay = cps.findIndex(x => x.date === curr.date);
    const prev = oldSameDay >= 0 ? cps[oldSameDay - 1] : cps[cps.length - 1];
    const interval = comparableInterval(prev, curr);
    if (oldSameDay >= 0) cps[oldSameDay] = curr; else cps.push(curr);

    positions[row.id] = {
      positionId: row.id,
      protocol: row.protocol,
      chain: row.chain,
      positionType: row.positionType,
      incomeMode: row.incomeMode,
      firstObservedActivity: resolver.stableCapital.positions.find(p => p.id === row.id)?.history?.firstObservedInbound
        || resolver.stableCapital.positions.find(p => p.id === row.id)?.history?.firstObservedActivity
        || null,
      trackingStartedAt: prior?.trackingStartedAt || now,
      accounting: {
        embeddedYieldEligible: row.incomeMode !== 'stability-pool-yield-with-separate-claimables',
        flowRule: 'Income is computed only when share/scaled-balance fingerprint is unchanged. Changed fingerprint requires deposit/withdrawal reconciliation before income is recognized.',
        stablePriceRule: 'Stablecoin/depeg price effect is separate from strategy income.',
        currentComparable: row.currentSnapshot.ledgerComparable
      },
      checkpoints: cps.slice(-400),
      latestInterval: interval
    };
  }

  const accruedClaimable = [];
  const liq = stableData.positions.find(p => p.id === 'ethereum:liquity-v2-sp:weth')?.currentSnapshot;
  if (liq?.accruedClaimable && Number(liq.accruedClaimable.amount || 0) > 0) {
    accruedClaimable.push({
      ...liq.accruedClaimable,
      classification: 'accrued-claimable',
      source: 'same-run-liquity-stability-pool',
      snapshotAt: now
    });
  } else {
    const resolverRewards = Array.isArray(resolver.stableCapital?.accruedRewardsCandidates)
      ? resolver.stableCapital.accruedRewardsCandidates
      : [];
    for (const r of resolverRewards) accruedClaimable.push({
      ...r,
      source: 'resolver-fallback',
      snapshotAt: now
    });
  }

  const allIntervals = Object.values(positions)
    .map(p => ({ ...p.latestInterval, timestamp: now, positionId: p.positionId }))
    .filter(x => x.status === 'ok' && finite(x.incomeUsd));

  function sumWindow(start) {
    // v0.4 records recurring daily checkpoints and recognizes only flow-safe comparable intervals; Historical daily interval aggregation
    // grows automatically as checkpoints accumulate; no pre-tracking history is invented.
    const eligible = allIntervals.filter(x => new Date(x.timestamp) >= start);
    if (!eligible.length) return null;
    return round(eligible.reduce((s, x) => s + Number(x.incomeUsd), 0), 8);
  }
  const d = new Date(now);
  const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const quarterStart = new Date(Date.UTC(d.getUTCFullYear(), Math.floor(d.getUTCMonth()/3)*3, 1));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));

  const anyPrior = !!priorLedger;
  return {
    version: LEDGER_VERSION,
    generatedAt: now,
    company: { registry: '008', name: 'Monetra.eth', wallet: WALLET },
    methodology: {
      identity: 'Embedded Yield Ledger',
      equation: 'Ending redeemable NAV − Beginning redeemable NAV − Contributions + Withdrawals',
      firstRunRule: 'First run seeds checkpoints only. It does not fabricate MTD/QTD/YTD income from current APY.',
      noOverlapRule: 'Never add overlapping rolling APY windows to manufacture quarterly/yearly earned income.',
      depegRule: 'Stable price/depeg effect is reported separately from strategy yield.',
      claimableRule: 'Separately claimable rewards remain Accrued Rewards and are not embedded income.'
    },
    trackingStartedAt: priorLedger?.trackingStartedAt || now,
    positions,
    accruedClaimable,
    aggregate: {
      status: anyPrior && allIntervals.length ? 'observing' : 'warming',
      embeddedIncomeMtdUsd: anyPrior ? sumWindow(monthStart) : null,
      embeddedIncomeQtdUsd: anyPrior ? sumWindow(quarterStart) : null,
      embeddedIncomeYtdUsd: anyPrior ? sumWindow(yearStart) : null,
      embeddedIncomeSinceTrackingUsd: anyPrior && allIntervals.length
        ? round(allIntervals.reduce((s, x) => s + Number(x.incomeUsd), 0), 8)
        : null,
      stablePriceEffectSinceTrackingUsd: anyPrior && allIntervals.length
        ? round(allIntervals.reduce((s, x) => s + Number(x.stablePriceEffectUsd || 0), 0), 8)
        : null,
      note: anyPrior
        ? 'Only flow-safe comparable intervals are recognized. Other intervals remain warming/needs-flow-reconciliation.'
        : 'Initial checkpoint established. Earned income remains null until a second comparable observation exists.'
    }
  };
}

async function main() {
  if (!fs.existsSync(RESOLVER_FILE)) throw new Error(`Missing Monetra resolver: ${RESOLVER_FILE}`);
  const resolverText = fs.readFileSync(RESOLVER_FILE, 'utf8');
  const resolver = JSON.parse(resolverText);
  if (resolver.version !== RESOLVER_REQUIRED) throw new Error(`Expected ${RESOLVER_REQUIRED}, got ${resolver.version}`);
  if (resolver.company?.registry !== '008' || resolver.company?.name !== 'Monetra.eth' || lower(resolver.company?.wallet) !== lower(WALLET)) {
    throw new Error('Monetra identity invariant failed');
  }
  if (!resolver.productionReadiness?.stableCapitalBookReady) throw new Error('Stable Capital current book is not ready');
  if (!Array.isArray(resolver.stableCapital?.positions) || resolver.stableCapital.positions.length !== 10) {
    throw new Error(`Expected 10 stable positions, got ${resolver.stableCapital?.positions?.length}`);
  }

  const priorData = fs.existsSync(DATA_FILE) ? JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) : null;
  const priorLedger = fs.existsSync(LEDGER_FILE) ? JSON.parse(fs.readFileSync(LEDGER_FILE, 'utf8')) : null;

  const [rates, snapshots] = await Promise.all([
    collectRates(),
    currentSnapshots(resolver)
  ]);

  const stableData = buildStableData(resolver, rates, snapshots, priorData);
  const ledger = buildLedger(resolver, stableData, priorLedger);

  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(stableData, null, 2) + '\n');
  fs.writeFileSync(LEDGER_FILE, JSON.stringify(ledger, null, 2) + '\n');

  console.log(JSON.stringify({
    version: stableData.version,
    methodologyVersion: stableData.methodologyVersion,
    stableCapitalUsd: stableData.summary.stableCapitalUsd,
    productiveStableCapitalUsd: stableData.summary.productiveStableCapitalUsd,
    coverage: stableData.summary.coverage,
    fullCoverage: stableData.summary.fullCoverage,
    referenceAnnualYieldPct: stableData.summary.referenceAnnualYieldPct,
    referenceApyPct: stableData.summary.referenceApyPct,
    coveredPositionCount: stableData.summary.coveredPositionCount,
    warmingPositionIds: stableData.summary.warmingPositionIds,
    ledgerStatus: ledger.aggregate.status,
    ledgerTrackingStartedAt: ledger.trackingStartedAt
  }, null, 2));
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
