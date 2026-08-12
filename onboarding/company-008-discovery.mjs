import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  getAddress
} from 'ethers';
import {
  AaveV3Ethereum,
  AaveV3Base,
  AaveV3Arbitrum,
  AaveV3Optimism,
  AaveV3Avalanche,
  AaveV3Polygon
} from '@aave-dao/aave-address-book';

const VERSION = '1.0-company-008-monetra-stable-capital-discovery';
const OUTPUT = process.env.COMPANY_008_DISCOVERY_OUTPUT
  || path.resolve('companies/company-008-discovery.json');

const COMPANY = Object.freeze({
  registry: '008',
  name: 'Monetra.eth',
  wallet: getAddress('0x888D39aeE2AEC979c81f125EA94BB3cEB60F6bBB'),
  category: 'Stable Capital',
  architecture: 'Stable Capital',
  debank: 'https://debank.com/profile/0x888D39aeE2AEC979c81f125EA94BB3cEB60F6bBB'
});

const OWNER_SANITY = Object.freeze({
  walletAndDefiUsdApprox: 108,
  stableStrategyUsdApprox: 100,
  note: 'Sanity target only; never force discovery values to match owner observation.'
});

const RAY = 1e27;
const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

function lower(x) { return String(x || '').toLowerCase(); }
function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function positiveBigInt(x) {
  try {
    const n = BigInt(x);
    return n > 0n ? n : 0n;
  } catch {
    return 0n;
  }
}
function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .slice(0, 1200);
}
function uniq(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function iso(x) {
  if (!x) return null;
  const d = new Date(x);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function stableSymbol(symbol) {
  const s = String(symbol || '').toUpperCase().replace(/[^A-Z0-9.]/g, '');
  return new Set([
    'USDC','USDC.E','USDT','USDT.E','DAI','CRVUSD','GHO','USDS','SUSDS',
    'USDE','SUSDE','FRAX','SFRXUSD','FRXUSD','LUSD','REUSD','MUSD','DOLA',
    'PYUSD','USDP','TUSD','FDUSD','USD0','USD0++','RLUSD','USUALUSD','BOLD'
  ]).has(s);
}
function isStablePrice(price) {
  const p = Number(price);
  return Number.isFinite(p) && p >= 0.90 && p <= 1.10;
}
function aaveRayToApy(rateRay) {
  const r = Number(rateRay) / RAY;
  if (!Number.isFinite(r) || r < 0) return null;
  return (Math.pow(1 + r / SECONDS_PER_YEAR, SECONDS_PER_YEAR) - 1) * 100;
}

const RPC = {
  ethereum: uniq([
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com'
  ]),
  base: uniq([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ]),
  arbitrum: uniq([
    process.env.ARBITRUM_RPC_URL,
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc'
  ]),
  optimism: uniq([
    process.env.OPTIMISM_RPC_URL,
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io'
  ]),
  avalanche: uniq([
    process.env.AVALANCHE_RPC_URL,
    'https://avalanche-c-chain-rpc.publicnode.com',
    'https://api.avax.network/ext/bc/C/rpc'
  ]),
  polygon: uniq([
    process.env.POLYGON_RPC_URL,
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon-rpc.com'
  ])
};

const CHAIN = Object.freeze({
  ethereum: { id: 1, label: 'Ethereum', llama: 'ethereum', native: 'ETH' },
  base: { id: 8453, label: 'Base', llama: 'base', native: 'ETH' },
  arbitrum: { id: 42161, label: 'Arbitrum', llama: 'arbitrum', native: 'ETH' },
  optimism: { id: 10, label: 'Optimism', llama: 'optimism', native: 'ETH' },
  avalanche: { id: 43114, label: 'Avalanche', llama: 'avax', native: 'AVAX' },
  polygon: { id: 137, label: 'Polygon', llama: 'polygon', native: 'POL' }
});

const BLOCKSCOUT = Object.freeze({
  ethereum: 'https://eth.blockscout.com',
  base: 'https://base.blockscout.com',
  arbitrum: 'https://arbitrum.blockscout.com',
  optimism: 'https://optimism.blockscout.com'
});

const AAVE = Object.freeze({
  ethereum: AaveV3Ethereum,
  base: AaveV3Base,
  arbitrum: AaveV3Arbitrum,
  optimism: AaveV3Optimism,
  avalanche: AaveV3Avalanche,
  polygon: AaveV3Polygon
});

const KNOWN = Object.freeze({
  scrvUSD: getAddress('0x0655977FEb2f289A4aB78af67BAB0d17aAb84367'),
  crvUSD: getAddress('0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E')
});

async function fetchJson(url, options = {}, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        'user-agent': 'The-Holding-Monetra-Stable-Discovery/1.0',
        ...(options.headers || {})
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
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

async function erc20Meta(provider, address) {
  const c = new Contract(address, [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)'
  ], provider);
  let symbol = null;
  let name = null;
  let decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { name = await c.name(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  return { address: getAddress(address), symbol, name, decimals };
}

async function llamaPrice(chain, address) {
  try {
    const key = `${CHAIN[chain].llama}:${lower(address)}`;
    const j = await fetchJson(
      `https://coins.llama.fi/prices/current/${encodeURIComponent(key)}`,
      {},
      15000
    );
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
  if (!base) return { items: [], status: 'unsupported', error: null };
  try {
    const j = await fetchJson(`${base}/api/v2/addresses/${COMPANY.wallet}/token-balances`);
    return { items: Array.isArray(j) ? j : (j?.items || []), status: 'ok', error: null };
  } catch (e) {
    return { items: [], status: 'unavailable', error: errMsg(e) };
  }
}

function nextUrl(baseUrl, params) {
  const u = new URL(baseUrl);
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== null && v !== undefined) u.searchParams.set(k, String(v));
  }
  return u.toString();
}

async function blockscoutPaged(url, maxPages = 80) {
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

async function ethereumHistory() {
  const base = BLOCKSCOUT.ethereum;
  const out = {
    status: 'unavailable',
    transactions: [],
    tokenTransfers: [],
    pages: {},
    diagnostics: []
  };
  try {
    const txs = await blockscoutPaged(
      `${base}/api/v2/addresses/${COMPANY.wallet}/transactions?filter=to`,
      100
    );
    out.transactions = txs.items;
    out.pages.transactions = { pages: txs.pages, truncated: txs.truncated };
  } catch (e) {
    out.diagnostics.push(`transactions: ${errMsg(e)}`);
  }
  try {
    const tfs = await blockscoutPaged(
      `${base}/api/v2/addresses/${COMPANY.wallet}/token-transfers?type=ERC-20`,
      100
    );
    out.tokenTransfers = tfs.items;
    out.pages.tokenTransfers = { pages: tfs.pages, truncated: tfs.truncated };
  } catch (e) {
    out.diagnostics.push(`token-transfers: ${errMsg(e)}`);
  }
  out.status = out.transactions.length || out.tokenTransfers.length ? 'ok' : 'partial';
  return out;
}

function txAddress(x) {
  if (!x) return null;
  if (typeof x === 'string') return x;
  return x.hash || x.address || null;
}

function firstEconomicFunding(history) {
  const wallet = lower(COMPANY.wallet);
  const native = [];
  for (const tx of history.transactions || []) {
    const to = lower(txAddress(tx.to));
    const value = positiveBigInt(tx.value || 0);
    const ts = iso(tx.timestamp);
    const success = tx.status === 'ok' || tx.status === true || tx.status === 'success' || tx.status === null || tx.status === undefined;
    if (to === wallet && value > 0n && ts && success) {
      native.push({
        kind: 'native-funding',
        timestamp: ts,
        block: Number(tx.block || tx.block_number || 0) || null,
        txHash: tx.hash || null,
        amountEth: Number(formatUnits(value, 18)),
        from: txAddress(tx.from)
      });
    }
  }
  native.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const stable = [];
  for (const tf of history.tokenTransfers || []) {
    const to = lower(txAddress(tf.to));
    if (to !== wallet) continue;
    const token = tf.token || {};
    const symbol = token.symbol || tf.token_symbol || null;
    if (!stableSymbol(symbol)) continue;
    const ts = iso(tf.timestamp);
    if (!ts) continue;
    stable.push({
      kind: 'stable-token-funding',
      timestamp: ts,
      block: Number(tf.block_number || tf.block || 0) || null,
      txHash: tf.transaction_hash || tf.transactionHash || null,
      token: token.address || tf.token_address || null,
      symbol,
      from: txAddress(tf.from)
    });
  }
  stable.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  const firstNative = native[0] || null;
  const firstStable = stable[0] || null;
  const candidates = [firstNative, firstStable].filter(Boolean)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const selected = candidates[0] || null;

  return {
    status: selected ? 'ok' : 'unresolved',
    selected,
    firstNative,
    firstStable,
    rule: 'earliest reproducible positive inbound native funding or stable-token funding on Ethereum; gas funding is allowed to establish company origin even though gas ETH is excluded from Stable Capital TVL',
    confidence: selected && !history.pages?.transactions?.truncated && !history.pages?.tokenTransfers?.truncated
      ? 'high'
      : (selected ? 'medium' : 'unresolved')
  };
}

async function detectErc4626(provider, tokenAddress, shareRaw, shareDecimals) {
  const c = new Contract(tokenAddress, [
    'function asset() view returns (address)',
    'function convertToAssets(uint256 shares) view returns (uint256)',
    'function previewRedeem(uint256 shares) view returns (uint256)',
    'function totalAssets() view returns (uint256)'
  ], provider);
  try {
    const asset = getAddress(await c.asset());
    const assetMeta = await erc20Meta(provider, asset);
    let assetsRaw = 0n;
    let method = null;
    try {
      assetsRaw = positiveBigInt(await c.previewRedeem(shareRaw));
      method = 'previewRedeem(shares)';
    } catch {
      assetsRaw = positiveBigInt(await c.convertToAssets(shareRaw));
      method = 'convertToAssets(shares)';
    }
    let totalAssetsRaw = null;
    try { totalAssetsRaw = positiveBigInt(await c.totalAssets()).toString(); } catch {}
    return {
      status: 'ok',
      standard: 'ERC-4626-compatible',
      asset,
      assetMeta,
      shareDecimals,
      redeemableUnderlyingRaw: assetsRaw.toString(),
      redeemableUnderlying: Number(formatUnits(assetsRaw, assetMeta.decimals)),
      valuationMethod: method,
      totalAssetsRaw
    };
  } catch (e) {
    return { status: 'not-detected', error: errMsg(e) };
  }
}

function earliestTokenTransfer(history, tokenAddress) {
  const wallet = lower(COMPANY.wallet);
  const token = lower(tokenAddress);
  const rows = (history.tokenTransfers || []).filter(tf => {
    const addr = lower(tf?.token?.address || tf?.token_address);
    const to = lower(txAddress(tf.to));
    return addr === token && to === wallet && iso(tf.timestamp);
  }).map(tf => ({
    timestamp: iso(tf.timestamp),
    block: Number(tf.block_number || tf.block || 0) || null,
    txHash: tf.transaction_hash || tf.transactionHash || null,
    from: txAddress(tf.from)
  })).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  return rows[0] || null;
}

async function discoverWalletStablePositions(history) {
  const results = [];
  const unresolved = [];
  const diagnostics = [];

  for (const chain of ['ethereum', 'base', 'arbitrum', 'optimism']) {
    const balances = await blockscoutTokenBalances(chain);
    if (balances.status !== 'ok') {
      diagnostics.push(`${chain}: ${balances.error || balances.status}`);
      continue;
    }
    const providerWrap = await withProvider(chain, async provider => provider);
    const provider = providerWrap.result;
    if (!provider) {
      diagnostics.push(`${chain}: RPC unavailable`);
      continue;
    }

    for (const item of balances.items) {
      const token = item?.token || item || {};
      const address = token?.address || token?.token_address || item?.token_address;
      if (!address) continue;
      const decimals = Number(token?.decimals ?? item?.decimals ?? 18);
      const raw = positiveBigInt(item?.value ?? item?.balance ?? 0);
      if (raw <= 0n) continue;
      const symbol = token?.symbol || item?.symbol || null;
      const amount = Number(formatUnits(raw, decimals));

      let vault = null;
      try {
        vault = await detectErc4626(provider, getAddress(address), raw, decimals);
      } catch {}

      if (vault?.status === 'ok') {
        const underlyingPrice = await llamaPrice(chain, vault.asset);
        const underlyingIsStable = stableSymbol(vault.assetMeta?.symbol)
          || isStablePrice(underlyingPrice.priceUsd);
        if (underlyingIsStable) {
          const usd = underlyingPrice.priceUsd != null
            ? vault.redeemableUnderlying * underlyingPrice.priceUsd
            : null;
          results.push({
            id: `${chain}:${lower(address)}`,
            chain: CHAIN[chain].label,
            protocol: lower(address) === lower(KNOWN.scrvUSD) ? 'Curve' : 'ERC-4626 Vault',
            positionType: lower(address) === lower(KNOWN.scrvUSD) ? 'Savings Stable' : 'Stable Vault',
            wrapper: getAddress(address),
            wrapperSymbol: symbol,
            shares: round(amount),
            shareRaw: raw.toString(),
            underlying: vault.asset,
            underlyingSymbol: vault.assetMeta?.symbol || null,
            redeemableUnderlying: round(vault.redeemableUnderlying),
            price: underlyingPrice,
            valueUsd: round(usd, 6),
            incomeMode: 'embedded-yield',
            claimableBoundary: 'embedded yield is part of redeemable underlying value; separate claimables require a separate protocol route',
            referenceApyStatus: 'adapter-pending',
            history: {
              firstObservedInboundShareTransfer: chain === 'ethereum'
                ? earliestTokenTransfer(history, address)
                : null,
              currentCheckpoint: {
                timestamp: new Date().toISOString(),
                shares: round(amount),
                redeemableUnderlying: round(vault.redeemableUnderlying),
                underlyingPriceUsd: underlyingPrice.priceUsd
              }
            },
            evidence: vault
          });
          continue;
        }
      }

      const price = await llamaPrice(chain, address);
      const directStable = stableSymbol(symbol) && (isStablePrice(price.priceUsd) || price.priceUsd == null);
      if (directStable) {
        const usd = price.priceUsd != null ? amount * price.priceUsd : null;
        results.push({
          id: `${chain}:${lower(address)}`,
          chain: CHAIN[chain].label,
          protocol: 'Wallet',
          positionType: 'Liquid Stable',
          token: getAddress(address),
          symbol,
          amount: round(amount),
          price,
          valueUsd: round(usd, 6),
          incomeMode: 'liquid-principal',
          productive: false,
          history: {
            firstObservedInboundTransfer: chain === 'ethereum'
              ? earliestTokenTransfer(history, address)
              : null,
            currentCheckpoint: {
              timestamp: new Date().toISOString(),
              amount: round(amount),
              priceUsd: price.priceUsd
            }
          }
        });
      } else if (stableSymbol(symbol) || isStablePrice(price.priceUsd)) {
        unresolved.push({
          chain: CHAIN[chain].label,
          token: getAddress(address),
          symbol,
          amount: round(amount),
          observedPriceUsd: price.priceUsd,
          reason: 'stable-like wallet token not promoted automatically; wrapper/economic mechanism not verified'
        });
      }
    }
  }

  return { positions: results, unresolved, diagnostics };
}

async function discoverNativeGas() {
  const rows = [];
  for (const chain of ['ethereum','base','arbitrum','optimism']) {
    const r = await withProvider(chain, async provider => {
      const raw = positiveBigInt(await provider.getBalance(COMPANY.wallet));
      return { chain: CHAIN[chain].label, symbol: 'ETH', amount: Number(formatUnits(raw, 18)) };
    });
    if (r.result?.amount > 0) rows.push(r.result);
  }
  return {
    excludedFromStableCapitalTvl: true,
    rows,
    treatment: 'gas/reserve only; excluded from Monetra Stable Capital TVL unless explicitly reclassified later'
  };
}

async function discoverAaveStablePositions(history) {
  const positions = [];
  const unresolved = [];
  const diagnostics = [];

  const dataProviderAbi = [
    'function getAllReservesTokens() view returns ((string symbol,address tokenAddress)[])',
    'function getReserveTokensAddresses(address asset) view returns (address aTokenAddress,address stableDebtTokenAddress,address variableDebtTokenAddress)',
    'function getUserReserveData(address asset,address user) view returns (uint256 currentATokenBalance,uint256 currentStableDebt,uint256 currentVariableDebt,uint256 principalStableDebt,uint256 scaledVariableDebt,uint256 stableBorrowRate,uint256 liquidityRate,uint40 stableRateLastUpdated,bool usageAsCollateralEnabled)'
  ];

  for (const [chain, book] of Object.entries(AAVE)) {
    const providerAddress = book?.AAVE_PROTOCOL_DATA_PROVIDER;
    const poolAddress = book?.POOL;
    if (!providerAddress || !poolAddress) continue;

    const r = await withProvider(chain, async provider => {
      const dp = new Contract(providerAddress, dataProviderAbi, provider);
      const reserves = await dp.getAllReservesTokens();
      const local = [];
      const localUnresolved = [];

      for (const reserve of reserves) {
        const asset = getAddress(reserve.tokenAddress ?? reserve[1]);
        const reserveSymbol = reserve.symbol ?? reserve[0];
        let user;
        try { user = await dp.getUserReserveData(asset, COMPANY.wallet); } catch { continue; }
        const suppliedRaw = positiveBigInt(user.currentATokenBalance ?? user[0]);
        if (suppliedRaw <= 0n) continue;

        const meta = await erc20Meta(provider, asset);
        const supplied = Number(formatUnits(suppliedRaw, meta.decimals));
        const price = await llamaPrice(chain, asset);
        const looksStable = stableSymbol(meta.symbol || reserveSymbol) || isStablePrice(price.priceUsd);

        const tokenAddresses = await dp.getReserveTokensAddresses(asset);
        const aToken = getAddress(tokenAddresses.aTokenAddress ?? tokenAddresses[0]);
        const aTokenContract = new Contract(aToken, [
          'function scaledBalanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ], provider);
        let scaledBalanceRaw = null;
        try { scaledBalanceRaw = positiveBigInt(await aTokenContract.scaledBalanceOf(COMPANY.wallet)).toString(); } catch {}

        const pool = new Contract(poolAddress, [
          'function getReserveNormalizedIncome(address asset) view returns (uint256)'
        ], provider);
        let normalizedIncomeRay = null;
        try { normalizedIncomeRay = positiveBigInt(await pool.getReserveNormalizedIncome(asset)).toString(); } catch {}

        const liquidityRateRay = positiveBigInt(user.liquidityRate ?? user[6]);
        const apy = aaveRayToApy(liquidityRateRay);
        const usd = price.priceUsd != null ? supplied * price.priceUsd : null;

        const row = {
          id: `${chain}:aave:${lower(asset)}`,
          chain: CHAIN[chain].label,
          protocol: 'Aave v3',
          positionType: 'Stable Lending',
          underlying: asset,
          underlyingSymbol: meta.symbol || reserveSymbol || null,
          aToken,
          currentUnderlyingEquivalent: round(supplied),
          currentATokenBalanceRaw: suppliedRaw.toString(),
          scaledBalanceRaw,
          normalizedIncomeRay,
          liquidityRateRay: liquidityRateRay.toString(),
          referenceApyPct: round(apy, 6),
          price,
          valueUsd: round(usd, 6),
          incomeMode: 'lending-embedded',
          claimableBoundary: 'supplier interest accrues inside aToken/underlying-equivalent balance; external incentives must be tracked separately',
          collateralEnabled: Boolean(user.usageAsCollateralEnabled ?? user[8]),
          history: {
            firstObservedInboundATokenTransfer: chain === 'ethereum'
              ? earliestTokenTransfer(history, aToken)
              : null,
            currentCheckpoint: {
              timestamp: new Date().toISOString(),
              underlyingEquivalent: round(supplied),
              scaledBalanceRaw,
              normalizedIncomeRay,
              underlyingPriceUsd: price.priceUsd
            }
          }
        };

        if (looksStable) local.push(row);
        else localUnresolved.push({
          ...row,
          reason: 'Aave supplied asset is not promoted into Stable Capital because stable classification was not verified'
        });
      }
      return { local, localUnresolved };
    });

    if (r.result) {
      positions.push(...r.result.local);
      unresolved.push(...r.result.localUnresolved);
    }
    diagnostics.push(...(r.errors || []));
  }

  return { positions, unresolved, diagnostics };
}

function dedupePositions(rows) {
  const map = new Map();
  for (const row of rows || []) {
    const key = row.id || JSON.stringify([row.chain,row.protocol,row.wrapper,row.token,row.underlying]);
    const existing = map.get(key);
    if (!existing || Number(row.valueUsd || 0) > Number(existing.valueUsd || 0)) map.set(key, row);
  }
  return [...map.values()];
}

function aggregate(positions) {
  let totalUsd = 0;
  let pricedCount = 0;
  let productiveUsd = 0;
  let liquidUsd = 0;
  const byType = {};
  const byProtocol = {};
  const byStable = {};

  for (const p of positions) {
    const v = Number(p.valueUsd);
    if (Number.isFinite(v)) {
      totalUsd += v;
      pricedCount += 1;
      if (p.incomeMode !== 'liquid-principal') productiveUsd += v;
      else liquidUsd += v;
    }
    const type = p.positionType || 'Unknown';
    const protocol = p.protocol || 'Unknown';
    const stable = p.underlyingSymbol || p.symbol || 'Unknown';
    byType[type] = round((byType[type] || 0) + (Number.isFinite(v) ? v : 0), 6);
    byProtocol[protocol] = round((byProtocol[protocol] || 0) + (Number.isFinite(v) ? v : 0), 6);
    byStable[stable] = round((byStable[stable] || 0) + (Number.isFinite(v) ? v : 0), 6);
  }

  return {
    totalUsd: round(totalUsd, 6),
    productiveUsd: round(productiveUsd, 6),
    liquidUsd: round(liquidUsd, 6),
    pricedPositions: pricedCount,
    positionCount: positions.length,
    byType,
    byProtocol,
    byStable
  };
}

async function main() {
  const startedAt = new Date().toISOString();

  const [history, gas] = await Promise.all([
    ethereumHistory(),
    discoverNativeGas()
  ]);
  const founding = firstEconomicFunding(history);

  const [walletStable, aave] = await Promise.all([
    discoverWalletStablePositions(history),
    discoverAaveStablePositions(history)
  ]);

  const positions = dedupePositions([
    ...walletStable.positions,
    ...aave.positions
  ]);
  const summary = aggregate(positions);

  const stableDelta = summary.totalUsd - OWNER_SANITY.stableStrategyUsdApprox;
  const sanity = {
    ownerObserved: OWNER_SANITY,
    discoveredStableCapitalUsd: summary.totalUsd,
    deltaVsOwnerStableApproxUsd: round(stableDelta, 6),
    withinLoose20UsdBand: Math.abs(stableDelta) <= 20,
    note: 'Mismatch is diagnostic only; discovery values are never forced to owner target.'
  };

  const allUnresolved = [
    ...walletStable.unresolved,
    ...aave.unresolved
  ];

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    company: {
      ...COMPANY,
      founding: {
        foundedAt: founding.selected?.timestamp || null,
        date: founding.selected?.timestamp?.slice(0, 10) || null,
        method: 'first-reproducible-economic-funding',
        confidence: founding.confidence,
        evidence: founding
      }
    },
    mandate: {
      family: 'Stable Capital',
      stableOnly: true,
      allowedPositionFamilies: [
        'Liquid Stable Principal',
        'Embedded Yield / Savings Stable',
        'Stable Lending',
        'Stable LP / Vault',
        'Claimable Stable Rewards',
        'Agent-Managed Stable Strategy'
      ],
      gasEthTreatment: 'excluded from Stable Capital TVL',
      principle: 'track economic mechanism, not token label alone'
    },
    accountingPolicy: {
      referenceApy: 'current productive capacity; never treated as earned historical income',
      embeddedYield: 'change in redeemable underlying/NAV adjusted for net contributions and withdrawals',
      accruedRewards: 'separate claimable protocol rewards only',
      realisedCashFlow: 'value actually withdrawn/claimed/received into treasury',
      stablePriceEffect: 'stablecoin depeg/price P&L must remain separate from strategy yield',
      monthlyHistory: 'exact checkpoint boundaries; never sum overlapping rolling APY windows'
    },
    discovery: {
      founding,
      gas,
      walletStable,
      aave,
      historyCoverage: {
        ethereum: history.pages,
        diagnostics: history.diagnostics
      }
    },
    stableCapital: {
      positions,
      summary,
      sanity,
      unresolved: allUnresolved
    },
    checkpointSeed: {
      methodology: 'position-level current checkpoint for future capital-flow-adjusted Embedded Yield ledger',
      positions: positions.map(p => ({
        id: p.id,
        protocol: p.protocol,
        positionType: p.positionType,
        incomeMode: p.incomeMode,
        firstObservedActivity: p.history?.firstObservedInboundShareTransfer
          || p.history?.firstObservedInboundATokenTransfer
          || p.history?.firstObservedInboundTransfer
          || null,
        currentCheckpoint: p.history?.currentCheckpoint || null
      }))
    },
    productionReadiness: {
      foundingResolved: Boolean(founding.selected),
      currentPositionsFound: positions.length > 0,
      stableCapitalUsdPriced: summary.pricedPositions === summary.positionCount && summary.positionCount > 0,
      stableCapitalCurrentStateComplete: positions.length > 0 && allUnresolved.length === 0,
      pageIntegrationReady: false,
      productivityIntegrationReady: false,
      rewardsIntegrationReady: false,
      note: 'This is data-only discovery. Integrate UI/Productivity/Rewards only after mechanisms and current-value reconciliation are reviewed.'
    },
    nextStep: 'Review exact stable positions and founding evidence. Reconcile roughly $100 stable strategy capital, then promote only verified mechanisms into reusable Stable Capital Productivity/Rewards/Reporting adapters.'
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Monetra Company #008 discovery written: ${OUTPUT}`);
  console.log(`Version: ${VERSION}`);
  console.log(`Founded: ${output.company.founding.date || 'unresolved'} (${output.company.founding.confidence})`);
  console.log(`Stable positions: ${positions.length}`);
  console.log(`Stable Capital USD: ${summary.totalUsd}`);
  console.log(`Productive Stable USD: ${summary.productiveUsd}`);
  console.log(`Unresolved stable-like candidates: ${allUnresolved.length}`);
  console.log(`Sanity delta vs owner ~$100: ${sanity.deltaVsOwnerStableApproxUsd}`);
}

main().catch(err => {
  console.error(`Monetra Company #008 discovery failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
