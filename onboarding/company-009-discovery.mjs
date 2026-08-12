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

const VERSION = '1.3.2-company-009-owner-reconciliation-official-aave';
const OUTPUT = process.env.COMPANY_009_DISCOVERY_OUTPUT
  || path.resolve('companies/company-009-discovery.json');

const COMPANY = {
  registry: '009',
  name: '1milliondollar.eth',
  foundedAt: '2024-12-12',
  foundingMethod: 'owner-declared',
  foundingConfidence: 'declared',
  architecture: 'The Holding Standard',
  wallet: getAddress('0xe4b9c9ced406baffe406e63f83d39daaef150596'),
  debank: 'https://debank.com/profile/0xe4b9c9ced406baffe406e63f83d39daaef150596'
};

/*
  Owner entry prices intentionally remain null until supplied.
  Never infer them from first transfers, current prices, DeBank, or protocol deposits.
*/
const ENTRY = Object.freeze({
  BTC: null,
  ETH: null,
  AERO: null,
  CRV: null,
  YB: null
});

function unique(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]');
}
function lower(x) { return String(x || '').toLowerCase(); }
function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function safeNum(x) {
  if (x === null || x === undefined || x === '') return null;
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function positiveBigInt(x) {
  try {
    const n = BigInt(x);
    return n > 0n ? n : 0n;
  } catch {
    return 0n;
  }
}
function sum(xs) {
  return (xs || []).reduce((a, b) => a + (Number(b) || 0), 0);
}
function safeHost(url) {
  try {
    const configured = [
      process.env.ETH_RPC_URL, process.env.ETH_RPC_URL_2,
      process.env.BASE_RPC_URL, process.env.BASE_RPC_URL_2,
      process.env.ARBITRUM_RPC_URL, process.env.OPTIMISM_RPC_URL,
      process.env.AVALANCHE_RPC_URL
    ].filter(Boolean);
    return configured.includes(url) ? 'configured' : new URL(url).hostname;
  } catch {
    return 'configured';
  }
}
async function fetchJson(url, options = {}, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      ...options,
      cache: 'no-store',
      signal: ctrl.signal,
      headers: {
        'user-agent': 'The-Holding-Company-008-Discovery/1.0',
        ...(options.headers || {})
      }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const RPC = {
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
  ]),
  arbitrum: unique([
    process.env.ARBITRUM_RPC_URL,
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc'
  ]),
  optimism: unique([
    process.env.OPTIMISM_RPC_URL,
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io'
  ]),
  avalanche: unique([
    process.env.AVALANCHE_RPC_URL,
    'https://avalanche-c-chain-rpc.publicnode.com',
    'https://api.avax.network/ext/bc/C/rpc'
  ]),
  polygon: unique([
    process.env.POLYGON_RPC_URL,
    'https://polygon-bor-rpc.publicnode.com',
    'https://polygon-rpc.com'
  ]),
  zksync: unique([
    process.env.ZKSYNC_RPC_URL,
    'https://mainnet.era.zksync.io'
  ]),
  linea: unique([
    process.env.LINEA_RPC_URL,
    'https://rpc.linea.build'
  ]),
  scroll: unique([
    process.env.SCROLL_RPC_URL,
    'https://rpc.scroll.io'
  ]),
  blast: unique([
    process.env.BLAST_RPC_URL,
    'https://rpc.blast.io'
  ]),
  mode: unique([
    process.env.MODE_RPC_URL,
    'https://mainnet.mode.network'
  ]),
  zora: unique([
    process.env.ZORA_RPC_URL,
    'https://rpc.zora.energy'
  ])
};

const CHAIN = {
  ethereum: { id: 1, label: 'Ethereum' },
  base: { id: 8453, label: 'Base' },
  arbitrum: { id: 42161, label: 'Arbitrum' },
  optimism: { id: 10, label: 'Optimism' },
  avalanche: { id: 43114, label: 'Avalanche' },
  polygon: { id: 137, label: 'Polygon' },
  zksync: { id: 324, label: 'ZKsync Era' },
  linea: { id: 59144, label: 'Linea' },
  scroll: { id: 534352, label: 'Scroll' },
  blast: { id: 81457, label: 'Blast' },
  mode: { id: 34443, label: 'Mode' },
  zora: { id: 7777777, label: 'Zora' }
};

const BLOCKSCOUT = {
  ethereum: 'https://eth.blockscout.com',
  base: 'https://base.blockscout.com',
  arbitrum: 'https://arbitrum.blockscout.com',
  optimism: 'https://optimism.blockscout.com'
};

function wrapperCandidateFamily(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (s.includes('BTC')) return 'BTC';
  if (s.includes('ETH')) return 'ETH';
  return null;
}

async function discoverWalletWrapperCandidates() {
  const candidates = [];
  const diagnostics = [];
  const known = new Set(
    Object.values(TOKENS).flat().map(x => lower(x.address))
  );
  for (const [chain, base] of Object.entries(BLOCKSCOUT)) {
    try {
      const items = await fetchJson(
        `${base}/api/v2/addresses/${COMPANY.wallet}/token-balances`,
        {},
        25000
      );
      for (const item of Array.isArray(items) ? items : (items?.items || [])) {
        const token = item?.token || item || {};
        const address = token?.address || token?.token_address || item?.token_address;
        const symbol = token?.symbol || item?.symbol;
        const family = wrapperCandidateFamily(symbol);
        if (!address || !family || known.has(lower(address))) continue;
        candidates.push({
          chain: CHAIN[chain]?.label || chain,
          familyCandidate: family,
          symbol: symbol || null,
          token: address,
          rawBalance: String(item?.value ?? item?.balance ?? ''),
          treatment: 'candidate-only; NOT counted until wrapper economics and conversion rate are verified'
        });
      }
    } catch (e) {
      diagnostics.push(`${chain}: ${errMsg(e)}`);
    }
  }
  return { candidates, diagnostics };
}

async function withProvider(chain, fn) {
  const errors = [];
  for (const url of RPC[chain] || []) {
    const provider = new JsonRpcProvider(url);
    try {
      const result = await fn(provider);
      return { result, provider: `${chain}:${safeHost(url)}`, errors };
    } catch (e) {
      errors.push(`${chain}:${safeHost(url)}: ${errMsg(e)}`);
    }
  }
  throw new Error(`${chain} providers exhausted: ${errors.join(' | ')}`);
}
async function safeProvider(chain, fn) {
  try {
    return await withProvider(chain, fn);
  } catch (e) {
    return { result: null, provider: null, errors: [errMsg(e)] };
  }
}

const TOKENS = {
  ethereum: [
    { symbol: 'WBTC', family: 'BTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', conversion: 'one-to-one' },
    { symbol: 'cbBTC', family: 'BTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', conversion: 'one-to-one' },
    { symbol: 'tBTC', family: 'BTC', address: '0x18084fbA666a33d37592fA2633fD49a74DD93a88', conversion: 'one-to-one' },
    { symbol: 'LBTC', family: 'BTC', address: '0x8236a87084f8B84306f72007F36F2618A5634494', conversion: 'lbtc-ratio' },
    { symbol: 'BTC.b', family: 'BTC', address: '0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072', conversion: 'one-to-one' },
    { symbol: 'WETH', family: 'ETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', conversion: 'one-to-one' },
    { symbol: 'stETH', family: 'ETH', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', conversion: 'one-to-one' },
    { symbol: 'wstETH', family: 'ETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', conversion: 'wsteth' },
    { symbol: 'rETH', family: 'ETH', address: '0xae78736Cd615f374D3085123A210448E74Fc6393', conversion: 'reth' },
    { symbol: 'cbETH', family: 'ETH', address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', conversion: 'cbeth' }
  ],
  base: [
    { symbol: 'cbBTC', family: 'BTC', address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', conversion: 'one-to-one' },
    { symbol: 'WBTC', family: 'BTC', address: '0x0555e30da8f98308EdB960aa94c0Db47230d2B9c', conversion: 'one-to-one' },
    { symbol: 'LBTC', family: 'BTC', address: '0xecAc9C5F704e954931349Da37F60E39f515c11c1', conversion: 'lbtc-ratio' },
    { symbol: 'WETH', family: 'ETH', address: '0x4200000000000000000000000000000000000006', conversion: 'one-to-one' },
    { symbol: 'cbETH', family: 'ETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfcA38d5a61E4F', conversion: 'cbeth' },
    { symbol: 'AERO', family: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', conversion: 'one-to-one' }
  ],
  arbitrum: [
    { symbol: 'WBTC', family: 'BTC', address: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', conversion: 'one-to-one' },
    { symbol: 'WETH', family: 'ETH', address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', conversion: 'one-to-one' }
  ],
  optimism: [
    { symbol: 'WBTC', family: 'BTC', address: '0x68f180fcCe6836688e9084f035309E29BF0A2095', conversion: 'one-to-one' },
    { symbol: 'WETH', family: 'ETH', address: '0x4200000000000000000000000000000000000006', conversion: 'one-to-one' }
  ],
  avalanche: [
    { symbol: 'BTC.b', family: 'BTC', address: '0x152b9d0FdC40C096757F570A51E494bD4B943E50', conversion: 'one-to-one' },
    { symbol: 'LBTC', family: 'BTC', address: '0xecAc9C5F704e954931349Da37F60E39f515c11c1', conversion: 'lbtc-ratio' },
    { symbol: 'WBTC.e', family: 'BTC', address: '0x50b7545627a5162F82A992c33b87aDc75187B218', conversion: 'one-to-one' }
  ],
  polygon: [
    { symbol: 'WBTC', family: 'BTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', conversion: 'one-to-one' },
    { symbol: 'WETH', family: 'ETH', address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', conversion: 'one-to-one' }
  ],
  zksync: [],
  linea: [],
  scroll: [],
  blast: [],
  mode: [],
  zora: []
};

const AAVE_DATA_PROVIDER = {
  ethereum: AaveV3Ethereum.AAVE_PROTOCOL_DATA_PROVIDER,
  base: AaveV3Base.AAVE_PROTOCOL_DATA_PROVIDER,
  arbitrum: AaveV3Arbitrum.AAVE_PROTOCOL_DATA_PROVIDER,
  optimism: AaveV3Optimism.AAVE_PROTOCOL_DATA_PROVIDER,
  avalanche: AaveV3Avalanche.AAVE_PROTOCOL_DATA_PROVIDER,
  polygon: AaveV3Polygon.AAVE_PROTOCOL_DATA_PROVIDER
};

const AERODROME = {
  token: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  votingEscrow: '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4'
};

const YIELD_BASIS = {
  token: '0x01791F726B4103694969820be083196cC7c045fF',
  votingEscrow: '0x8235c179E9e84688FBd8B12295EfC26834dAC211',
  feeDistributor: '0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90'
};

const LOMBARD = {
  lbtcEthereum: '0x8236a87084f8B84306f72007F36F2618A5634494',
  lbtcBase: '0xecAc9C5F704e954931349Da37F60E39f515c11c1',
  btcbEthereum: '0xB0F70C0bD6FD87dbEb7C10dC692a2a6106817072',
  btcocEthereum: '0xf14F678d9c05798ba61652a950a05D74aD2E0A6C'
};

const CVXCRV = '0x62B9c7356A2Dc64a1969e19C23e4f579F9810AA7';

async function erc20Meta(provider, address) {
  const c = new Contract(address, [
    'function decimals() view returns (uint8)',
    'function symbol() view returns (string)'
  ], provider);
  let decimals = 18;
  let symbol = null;
  try { decimals = Number(await c.decimals()); } catch {}
  try { symbol = await c.symbol(); } catch {}
  return { address: getAddress(address), decimals, symbol };
}
async function erc20Balance(provider, address, wallet) {
  const meta = await erc20Meta(provider, address);
  const c = new Contract(address, ['function balanceOf(address) view returns (uint256)'], provider);
  const raw = positiveBigInt(await c.balanceOf(wallet));
  return {
    ...meta,
    raw: raw.toString(),
    amount: Number(formatUnits(raw, meta.decimals))
  };
}

async function discoverLombardExchangeRatio() {
  const out = {
    source: 'official Lombard SDK api.exchangeRatio()',
    status: 'unavailable',
    btcPerLbtc: null,
    lbtcPerBtc: null,
    error: null
  };
  try {
    const mod = await import('@lombard.finance/sdk');
    const config = mod.createConfig({ env: mod.Env.prod });
    const sdk = mod.createLombardSDK(config);
    const ratios = await sdk.api.exchangeRatio();
    const lbtc = ratios?.LBTC || ratios?.lbtc || null;
    const btcPerLbtc = safeNum(lbtc?.BTCTokenRatio);
    const lbtcPerBtc = safeNum(lbtc?.tokenBTCRatio);
    if (btcPerLbtc !== null && btcPerLbtc > 0) {
      out.status = 'ok';
      out.btcPerLbtc = btcPerLbtc;
      out.lbtcPerBtc = lbtcPerBtc;
    } else {
      out.error = 'LBTC BTCTokenRatio missing from SDK response';
    }
  } catch (e) {
    out.error = errMsg(e);
  }
  return out;
}

async function wrapperRate(provider, token, conversion, lbtc) {
  if (conversion === 'one-to-one') return { status: 'ok', rate: 1, method: '1:1 canonical wrapper' };
  if (conversion === 'lbtc-ratio') {
    const r = safeNum(lbtc?.btcPerLbtc);
    return r && r > 0
      ? { status: 'ok', rate: r, method: 'official Lombard SDK BTC per LBTC' }
      : { status: 'warming', rate: null, method: 'official Lombard SDK ratio unavailable' };
  }
  try {
    const c = new Contract(token, [], provider);
    if (conversion === 'wsteth') {
      const x = new Contract(token, ['function stEthPerToken() view returns (uint256)'], provider);
      const raw = await x.stEthPerToken();
      return { status: 'ok', rate: Number(formatUnits(raw, 18)), method: 'wstETH.stEthPerToken()' };
    }
    if (conversion === 'reth') {
      const x = new Contract(token, ['function getExchangeRate() view returns (uint256)'], provider);
      const raw = await x.getExchangeRate();
      return { status: 'ok', rate: Number(formatUnits(raw, 18)), method: 'rETH.getExchangeRate()' };
    }
    if (conversion === 'cbeth') {
      const x = new Contract(token, ['function exchangeRate() view returns (uint256)'], provider);
      const raw = await x.exchangeRate();
      return { status: 'ok', rate: Number(formatUnits(raw, 18)), method: 'cbETH.exchangeRate()' };
    }
  } catch (e) {
    return { status: 'warming', rate: null, method: conversion, error: errMsg(e) };
  }
  return { status: 'warming', rate: null, method: conversion };
}

async function normalizeKnownAsset({ provider, tokenDef, amount, lbtc }) {
  const rate = await wrapperRate(provider, tokenDef.address, tokenDef.conversion, lbtc);
  const eq = rate.rate !== null ? Number(amount) * Number(rate.rate) : null;
  return {
    family: tokenDef.family,
    symbol: tokenDef.symbol,
    token: getAddress(tokenDef.address),
    amount: round(amount),
    conversion: rate,
    equivalentAmount: round(eq)
  };
}

async function discoverDirectBalances(lbtc) {
  const rows = [];
  const diagnostics = [];
  const chainStatus = {};
  for (const chain of Object.keys(RPC)) {
    const r = await safeProvider(chain, async provider => {
      const out = [];
      // Count native balance as ETH only on networks whose native gas asset is ETH.
      // Avalanche native balance is AVAX and must never enter the ETH Company Book row.
      if (['ethereum', 'base', 'arbitrum', 'optimism', 'zksync', 'linea', 'scroll', 'blast', 'mode', 'zora'].includes(chain)) {
        try {
          const raw = positiveBigInt(await provider.getBalance(COMPANY.wallet));
          if (raw > 0n) {
            out.push({
              chain: CHAIN[chain].label,
              protocol: 'Wallet',
              source: 'wallet-native',
              family: 'ETH',
              symbol: 'ETH',
              amount: Number(formatUnits(raw, 18)),
              equivalentAmount: Number(formatUnits(raw, 18)),
              conversion: { status: 'ok', rate: 1, method: 'native ETH' }
            });
          }
        } catch {}
      }
      for (const def of TOKENS[chain] || []) {
        try {
          const b = await erc20Balance(provider, def.address, COMPANY.wallet);
          if (positiveBigInt(b.raw) <= 0n) continue;
          const n = await normalizeKnownAsset({ provider, tokenDef: def, amount: b.amount, lbtc });
          out.push({
            chain: CHAIN[chain].label,
            protocol: def.symbol === 'LBTC' || def.symbol === 'BTC.b' ? 'Lombard' : 'Wallet',
            source: 'wallet-erc20',
            ...n
          });
        } catch {}
      }
      return out;
    });
    rows.push(...(r.result || []));
    diagnostics.push(...(r.errors || []));
    chainStatus[chain] = { ok: !!r.result, provider: r.provider, errors: r.errors || [] };
  }
  return { rows, chainStatus, diagnostics };
}

function tokenDefFor(chain, address, symbol = '') {
  const byAddress = (TOKENS[chain] || []).find(x => lower(x.address) === lower(address));
  if (byAddress) return byAddress;
  const s = String(symbol || '').toUpperCase();
  if (['WBTC','CBBTC','TBTC','BTC.B','BTCB','WBTC.E'].includes(s)) {
    return { symbol: symbol || s, family: 'BTC', address, conversion: 'one-to-one' };
  }
  if (s === 'LBTC') return { symbol: 'LBTC', family: 'BTC', address, conversion: 'lbtc-ratio' };
  if (['ETH','WETH','STETH'].includes(s)) return { symbol: symbol || s, family: 'ETH', address, conversion: 'one-to-one' };
  if (s === 'WSTETH') return { symbol: symbol || s, family: 'ETH', address, conversion: 'wsteth' };
  if (s === 'RETH') return { symbol: symbol || s, family: 'ETH', address, conversion: 'reth' };
  if (s === 'CBETH') return { symbol: symbol || s, family: 'ETH', address, conversion: 'cbeth' };
  return null;
}

async function discoverAave(lbtc) {
  const rows = [];
  const ignoredLiabilities = [];
  const diagnostics = [];
  const chainStatus = {};
  const ABI = [
    'function getUserReserveData(address asset,address user) view returns (uint256 currentATokenBalance,uint256 currentStableDebt,uint256 currentVariableDebt,uint256 principalStableDebt,uint256 scaledVariableDebt,uint256 stableBorrowRate,uint256 liquidityRate,uint40 stableRateLastUpdated,bool usageAsCollateralEnabled)'
  ];
  for (const [chain, providerAddress] of Object.entries(AAVE_DATA_PROVIDER)) {
    const r = await safeProvider(chain, async provider => {
      const dp = new Contract(providerAddress, ABI, provider);
      const localRows = [];
      const localDebts = [];
      for (const def of (TOKENS[chain] || []).filter(x => x.family === 'BTC' || x.family === 'ETH')) {
        try {
          const meta = await erc20Meta(provider, def.address);
          const d = await dp.getUserReserveData(def.address, COMPANY.wallet);
          const supplied = positiveBigInt(d.currentATokenBalance);
          const variableDebt = positiveBigInt(d.currentVariableDebt);
          const stableDebt = positiveBigInt(d.currentStableDebt);
          if (supplied > 0n) {
            const amount = Number(formatUnits(supplied, meta.decimals));
            const n = await normalizeKnownAsset({ provider, tokenDef: def, amount, lbtc });
            localRows.push({
              chain: CHAIN[chain].label,
              protocol: 'Aave',
              source: 'aave-supplied',
              usageAsCollateralEnabled: Boolean(d.usageAsCollateralEnabled),
              productiveForHoldingReferenceApr: false,
              ...n
            });
          }
          if (variableDebt > 0n || stableDebt > 0n) {
            localDebts.push({
              chain: CHAIN[chain].label,
              protocol: 'Aave',
              asset: def.symbol,
              variableDebt: Number(formatUnits(variableDebt, meta.decimals)),
              stableDebt: Number(formatUnits(stableDebt, meta.decimals)),
              treatment: 'diagnostic-only; NOT subtracted from public gross asset balance'
            });
          }
        } catch {}
      }
      return { rows: localRows, debts: localDebts };
    });
    rows.push(...(r.result?.rows || []));
    ignoredLiabilities.push(...(r.result?.debts || []));
    diagnostics.push(...(r.errors || []));
    chainStatus[chain] = { ok: !!r.result, provider: r.provider, errors: r.errors || [] };
  }
  return { rows, ignoredLiabilities, chainStatus, diagnostics };
}

function apiRawToAmount(value, decimals) {
  if (value === null || value === undefined || value === '') return 0;
  const s = String(value);
  if (s.includes('.') || s.toLowerCase().includes('e')) {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
  try {
    return Number(formatUnits(BigInt(s), Number(decimals || 18)));
  } catch {
    const n = Number(s);
    return Number.isFinite(n) ? n : 0;
  }
}

async function morphoQuery(chainId) {
  const query = `
    query Company008($address: String!, $chainId: Int!) {
      userByAddress(address: $address, chainId: $chainId) {
        address
        marketPositions {
          market {
            marketId
            loanAsset { address symbol decimals }
            collateralAsset { address symbol decimals }
          }
          state {
            supplyAssets
            supplyAssetsUsd
            borrowAssets
            borrowAssetsUsd
            collateral
            collateralUsd
          }
        }
        vaultPositions {
          vault {
            address
            name
            asset { address symbol decimals }
          }
          state {
            assets
            assetsUsd
            shares
          }
        }
        vaultV2Positions {
          vault {
            address
            name
            asset { address symbol decimals }
          }
          assets
          assetsUsd
          shares
        }
      }
    }`;
  return await fetchJson('https://api.morpho.org/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query,
      variables: { address: COMPANY.wallet.toLowerCase(), chainId }
    })
  }, 30000);
}

async function discoverMorpho(lbtc) {
  const rows = [];
  const ignoredLiabilities = [];
  const unresolvedWrapperCandidates = [];
  const diagnostics = [];
  const rawByChain = {};
  for (const chain of ['ethereum','base','arbitrum','optimism']) {
    try {
      const payload = await morphoQuery(CHAIN[chain].id);
      if (payload?.errors?.length) throw new Error(payload.errors.map(x => x.message).join(' | '));
      const u = payload?.data?.userByAddress;
      rawByChain[chain] = {
        marketPositionCount: u?.marketPositions?.length || 0,
        vaultPositionCount: u?.vaultPositions?.length || 0,
        vaultV2PositionCount: u?.vaultV2Positions?.length || 0
      };
      const providerResult = await safeProvider(chain, async provider => {
        const local = [];
        for (const p of u?.marketPositions || []) {
          const loan = p?.market?.loanAsset;
          const coll = p?.market?.collateralAsset;
          const supplyAmount = loan ? apiRawToAmount(p?.state?.supplyAssets, loan.decimals) : 0;
          const borrowAmount = loan ? apiRawToAmount(p?.state?.borrowAssets, loan.decimals) : 0;
          const collateralAmount = coll ? apiRawToAmount(p?.state?.collateral, coll.decimals) : 0;

          if (loan && supplyAmount > 0) {
            const def = tokenDefFor(chain, loan.address, loan.symbol);
            if (def) {
              const n = await normalizeKnownAsset({ provider, tokenDef: def, amount: supplyAmount, lbtc });
              local.push({
                chain: CHAIN[chain].label,
                protocol: 'Morpho',
                source: 'morpho-market-supply',
                marketId: p.market.marketId,
                usdValueApi: safeNum(p?.state?.supplyAssetsUsd),
                productiveForHoldingReferenceApr: false,
                ...n
              });
            } else if (wrapperCandidateFamily(loan.symbol)) {
              unresolvedWrapperCandidates.push({
                chain: CHAIN[chain].label, protocol: 'Morpho', source: 'morpho-market-supply',
                marketId: p.market.marketId, token: loan.address, symbol: loan.symbol,
                amount: round(supplyAmount), familyCandidate: wrapperCandidateFamily(loan.symbol),
                treatment: 'candidate-only; NOT counted until conversion is verified'
              });
            }
          }
          if (coll && collateralAmount > 0) {
            const def = tokenDefFor(chain, coll.address, coll.symbol);
            if (def) {
              const n = await normalizeKnownAsset({ provider, tokenDef: def, amount: collateralAmount, lbtc });
              local.push({
                chain: CHAIN[chain].label,
                protocol: 'Morpho',
                source: 'morpho-market-collateral',
                marketId: p.market.marketId,
                usdValueApi: safeNum(p?.state?.collateralUsd),
                productiveForHoldingReferenceApr: false,
                ...n
              });
            } else if (wrapperCandidateFamily(coll.symbol)) {
              unresolvedWrapperCandidates.push({
                chain: CHAIN[chain].label, protocol: 'Morpho', source: 'morpho-market-collateral',
                marketId: p.market.marketId, token: coll.address, symbol: coll.symbol,
                amount: round(collateralAmount), familyCandidate: wrapperCandidateFamily(coll.symbol),
                treatment: 'candidate-only; NOT counted until conversion is verified'
              });
            }
          }
          if (loan && borrowAmount > 0) {
            ignoredLiabilities.push({
              chain: CHAIN[chain].label,
              protocol: 'Morpho',
              marketId: p.market.marketId,
              asset: loan.symbol,
              amount: round(borrowAmount),
              usdValueApi: safeNum(p?.state?.borrowAssetsUsd),
              treatment: 'diagnostic-only; NOT subtracted from public gross asset balance'
            });
          }
        }

        for (const p of u?.vaultPositions || []) {
          const asset = p?.vault?.asset;
          const amount = asset ? apiRawToAmount(p?.state?.assets, asset.decimals) : 0;
          const def = asset ? tokenDefFor(chain, asset.address, asset.symbol) : null;
          if (def && amount > 0) {
            const n = await normalizeKnownAsset({ provider, tokenDef: def, amount, lbtc });
            local.push({
              chain: CHAIN[chain].label,
              protocol: 'Morpho',
              source: 'morpho-vault-v1',
              vault: p.vault.address,
              vaultName: p.vault.name,
              sharesRawOrApi: p?.state?.shares ?? null,
              usdValueApi: safeNum(p?.state?.assetsUsd),
              productiveForHoldingReferenceApr: false,
              ...n
            });
          } else if (asset && amount > 0 && wrapperCandidateFamily(asset.symbol)) {
            unresolvedWrapperCandidates.push({
              chain: CHAIN[chain].label, protocol: 'Morpho', source: 'morpho-vault-v1',
              vault: p.vault.address, vaultName: p.vault.name, token: asset.address,
              symbol: asset.symbol, amount: round(amount),
              familyCandidate: wrapperCandidateFamily(asset.symbol),
              treatment: 'candidate-only; NOT counted until conversion is verified'
            });
          }
        }
        for (const p of u?.vaultV2Positions || []) {
          const asset = p?.vault?.asset;
          const amount = asset ? apiRawToAmount(p?.assets, asset.decimals) : 0;
          const def = asset ? tokenDefFor(chain, asset.address, asset.symbol) : null;
          if (def && amount > 0) {
            const n = await normalizeKnownAsset({ provider, tokenDef: def, amount, lbtc });
            local.push({
              chain: CHAIN[chain].label,
              protocol: 'Morpho',
              source: 'morpho-vault-v2',
              vault: p.vault.address,
              vaultName: p.vault.name,
              sharesRawOrApi: p?.shares ?? null,
              usdValueApi: safeNum(p?.assetsUsd),
              productiveForHoldingReferenceApr: false,
              ...n
            });
          } else if (asset && amount > 0 && wrapperCandidateFamily(asset.symbol)) {
            unresolvedWrapperCandidates.push({
              chain: CHAIN[chain].label, protocol: 'Morpho', source: 'morpho-vault-v2',
              vault: p.vault.address, vaultName: p.vault.name, token: asset.address,
              symbol: asset.symbol, amount: round(amount),
              familyCandidate: wrapperCandidateFamily(asset.symbol),
              treatment: 'candidate-only; NOT counted until conversion is verified'
            });
          }
        }
        return local;
      });
      rows.push(...(providerResult.result || []));
      diagnostics.push(...(providerResult.errors || []));
    } catch (e) {
      diagnostics.push(`${chain}: ${errMsg(e)}`);
      rawByChain[chain] = { error: errMsg(e) };
    }
  }
  return {
    source: 'official Morpho GraphQL userByAddress',
    rows,
    ignoredLiabilities,
    unresolvedWrapperCandidates,
    rawByChain,
    diagnostics
  };
}

async function discoverLombardBtcoc(lbtc) {
  const r = await safeProvider('ethereum', async provider => {
    const vault = new Contract(LOMBARD.btcocEthereum, [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function asset() view returns (address)',
      'function convertToAssets(uint256 shares) view returns (uint256)',
      'function previewRedeem(uint256 shares) view returns (uint256)'
    ], provider);
    const sharesRaw = positiveBigInt(await vault.balanceOf(COMPANY.wallet));
    let shareDecimals = 18;
    try { shareDecimals = Number(await vault.decimals()); } catch {}
    if (sharesRaw <= 0n) {
      return {
        chain: 'Ethereum',
        protocol: 'Lombard',
        product: 'Bitcoin Onchain Credit',
        vault: getAddress(LOMBARD.btcocEthereum),
        shares: 0,
        underlying: null,
        btcEquivalent: 0,
        incomeMode: 'ERC-4626 share-value compounding',
        status: 'no-position'
      };
    }
    let asset = null;
    try { asset = getAddress(await vault.asset()); } catch {}
    let assetsRaw = 0n;
    try { assetsRaw = positiveBigInt(await vault.convertToAssets(sharesRaw)); } catch {
      try { assetsRaw = positiveBigInt(await vault.previewRedeem(sharesRaw)); } catch {}
    }
    const assetMeta = asset ? await erc20Meta(provider, asset) : null;
    const assetAmount = assetMeta ? Number(formatUnits(assetsRaw, assetMeta.decimals)) : null;
    const def = assetMeta ? tokenDefFor('ethereum', asset, assetMeta.symbol) : null;
    let btcEquivalent = null;
    let conversion = null;
    if (def && assetAmount !== null) {
      const n = await normalizeKnownAsset({ provider, tokenDef: def, amount: assetAmount, lbtc });
      btcEquivalent = n.family === 'BTC' ? n.equivalentAmount : null;
      conversion = n.conversion;
    }
    return {
      chain: 'Ethereum',
      protocol: 'Lombard',
      product: 'Bitcoin Onchain Credit',
      vault: getAddress(LOMBARD.btcocEthereum),
      shares: Number(formatUnits(sharesRaw, shareDecimals)),
      underlying: assetMeta ? {
        token: assetMeta.address,
        symbol: assetMeta.symbol,
        amount: round(assetAmount)
      } : null,
      btcEquivalent: round(btcEquivalent),
      conversion,
      incomeMode: 'ERC-4626 share-value compounding',
      claimableReward: false,
      note: 'Premium compounds into vault share value; do not add it as separate Accrued Rewards.',
      status: btcEquivalent !== null ? 'ok' : 'partial'
    };
  });
  return { ...(r.result || { status: 'unavailable' }), diagnostics: r.errors || [] };
}

async function discoverAerodrome() {
  const r = await safeProvider('base', async provider => {
    const token = new Contract(AERODROME.token, ['function balanceOf(address) view returns (uint256)'], provider);
    const ve = new Contract(AERODROME.votingEscrow, [
      'function balanceOf(address owner) view returns (uint256)',
      'function ownerToNFTokenIdList(address owner,uint256 index) view returns (uint256)',
      'function locked(uint256 tokenId) view returns (int128 amount,uint256 end,bool isPermanent)',
      'function idToManaged(uint256 tokenId) view returns (uint256)',
      'function weights(uint256 tokenId,uint256 managedTokenId) view returns (uint256)',
      'function escrowType(uint256 tokenId) view returns (uint8)'
    ], provider);

    const freeRaw = positiveBigInt(await token.balanceOf(COMPANY.wallet));
    let count = 0;
    try { count = Number(await ve.balanceOf(COMPANY.wallet)); } catch {}
    const positions = [];
    let productiveRaw = 0n;
    for (let i = 0; i < count; i++) {
      const tokenId = await ve.ownerToNFTokenIdList(COMPANY.wallet, i);
      let managedId = 0n;
      let lockedRaw = 0n;
      let end = 0n;
      let isPermanent = false;
      let managedWeightRaw = 0n;
      let escrowType = null;
      try { managedId = positiveBigInt(await ve.idToManaged(tokenId)); } catch {}
      try {
        const l = await ve.locked(tokenId);
        lockedRaw = positiveBigInt(l.amount);
        end = positiveBigInt(l.end);
        isPermanent = Boolean(l.isPermanent);
      } catch {}
      try { escrowType = Number(await ve.escrowType(tokenId)); } catch {}
      if (managedId > 0n) {
        try { managedWeightRaw = positiveBigInt(await ve.weights(tokenId, managedId)); } catch {}
      }
      const economicRaw = managedWeightRaw > 0n ? managedWeightRaw : lockedRaw;
      productiveRaw += economicRaw;
      positions.push({
        tokenId: tokenId.toString(),
        custodyMode: managedId > 0n ? 'managed-veNFT' : 'direct-veNFT',
        managedTokenId: managedId.toString(),
        directLockedAero: Number(formatUnits(lockedRaw, 18)),
        managedWeightAero: Number(formatUnits(managedWeightRaw, 18)),
        economicPrincipalAero: Number(formatUnits(economicRaw, 18)),
        escrowType,
        lockEndUnix: end > 0n ? Number(end) : null,
        isPermanent
      });
    }
    return {
      chain: 'Base',
      wallet: COMPANY.wallet,
      freeAero: Number(formatUnits(freeRaw, 18)),
      productiveVeAero: Number(formatUnits(productiveRaw, 18)),
      totalAeroExposure: Number(formatUnits(freeRaw + productiveRaw, 18)),
      veNftCount: count,
      positions,
      productivityAdapters: {
        direct: 'known:aerodrome_veaero',
        managed: 'known:aerodrome_veaero / Relay-compatible custody adapter'
      },
      rewardsRoutes: {
        direct: 'known:aerodrome-ve',
        managed: 'known:aerodrome-relay'
      }
    };
  });
  return { ...(r.result || {}), diagnostics: r.errors || [] };
}

async function discoverYieldBasisVeYb() {
  const r = await safeProvider('ethereum', async provider => {
    const token = new Contract(YIELD_BASIS.token, ['function balanceOf(address) view returns (uint256)'], provider);
    const ve = new Contract(YIELD_BASIS.votingEscrow, [
      'function locked(address) view returns (int256 amount,uint256 end)',
      'function balanceOf(address owner) view returns (uint256)'
    ], provider);
    const freeRaw = positiveBigInt(await token.balanceOf(COMPANY.wallet));
    let lockedRaw = 0n;
    let end = 0n;
    let veNftBalance = 0;
    try {
      const l = await ve.locked(COMPANY.wallet);
      lockedRaw = positiveBigInt(l.amount);
      end = positiveBigInt(l.end);
    } catch {}
    try { veNftBalance = Number(await ve.balanceOf(COMPANY.wallet)); } catch {}
    return {
      chain: 'Ethereum',
      wallet: COMPANY.wallet,
      freeYb: Number(formatUnits(freeRaw, 18)),
      productiveVeYb: Number(formatUnits(lockedRaw, 18)),
      totalYbExposure: Number(formatUnits(freeRaw + lockedRaw, 18)),
      veNftBalance,
      lockEndUnix: end > 0n ? Number(end) : null,
      token: getAddress(YIELD_BASIS.token),
      votingEscrow: getAddress(YIELD_BASIS.votingEscrow),
      feeDistributor: getAddress(YIELD_BASIS.feeDistributor),
      productivityAdapter: 'known:yieldbasis_veyb',
      rewardsRoute: 'known:yield-basis-fees',
      rewardUiLabel: 'Yield Basis · veYB'
    };
  });
  return { ...(r.result || {}), diagnostics: r.errors || [] };
}

async function discoverBeefyCvxCrv() {
  const result = {
    source: 'official Beefy API + Ethereum vault onchain reads',
    status: 'unavailable',
    vaultId: 'convex-staked-cvxCRV',
    vaultMeta: null,
    shares: null,
    underlyingCvxCrv: null,
    ppfs: null,
    currentApy: null,
    incomeMode: 'compounded-embedded',
    separateClaimableRewards: false,
    diagnostics: []
  };

  let vaults = null;
  let apys = null;
  try { vaults = await fetchJson('https://api.beefy.finance/vaults', {}, 30000); }
  catch (e) { result.diagnostics.push(`Beefy vault API: ${errMsg(e)}`); }
  try { apys = await fetchJson('https://api.beefy.finance/apy', {}, 30000); }
  catch (e) { result.diagnostics.push(`Beefy APY API: ${errMsg(e)}`); }

  const list = Array.isArray(vaults) ? vaults : Object.values(vaults || {});
  const meta = list.find(v => v?.id === result.vaultId) || null;
  if (!meta) {
    result.status = 'warming';
    result.diagnostics.push('Beefy convex-staked-cvxCRV vault not found in official vault API');
    return result;
  }

  result.vaultMeta = {
    id: meta.id,
    name: meta.name || null,
    chain: meta.chain || meta.network || null,
    status: meta.status || null,
    earnContractAddress: meta.earnContractAddress || meta.vaultAddress || meta.address || null,
    tokenAddress: meta.tokenAddress || meta.wantAddress || null,
    token: meta.token || null,
    oracleId: meta.oracleId || null
  };
  result.currentApy = safeNum(apys?.[result.vaultId]);

  const vaultAddress = result.vaultMeta.earnContractAddress;
  if (!vaultAddress) {
    result.status = 'partial';
    result.diagnostics.push('Beefy vault address missing from API metadata');
    return result;
  }

  const r = await safeProvider('ethereum', async provider => {
    const vault = new Contract(vaultAddress, [
      'function balanceOf(address) view returns (uint256)',
      'function decimals() view returns (uint8)',
      'function totalSupply() view returns (uint256)',
      'function getPricePerFullShare() view returns (uint256)',
      'function pricePerShare() view returns (uint256)',
      'function convertToAssets(uint256 shares) view returns (uint256)',
      'function want() view returns (address)',
      'function token() view returns (address)'
    ], provider);

    let shareDecimals = 18;
    try { shareDecimals = Number(await vault.decimals()); } catch {}
    const sharesRaw = positiveBigInt(await vault.balanceOf(COMPANY.wallet));
    let want = result.vaultMeta.tokenAddress;
    if (!want) {
      try { want = await vault.want(); } catch {
        try { want = await vault.token(); } catch {}
      }
    }
    if (want) want = getAddress(want);

    let wantDecimals = 18;
    let wantSymbol = 'cvxCRV';
    if (want) {
      const m = await erc20Meta(provider, want);
      wantDecimals = m.decimals;
      wantSymbol = m.symbol || wantSymbol;
    }

    let underlyingRaw = 0n;
    let valuationMethod = null;
    let ppfsRaw = null;

    if (sharesRaw > 0n) {
      try {
        underlyingRaw = positiveBigInt(await vault.convertToAssets(sharesRaw));
        valuationMethod = 'vault.convertToAssets(shares)';
      } catch {}
    }

    try {
      ppfsRaw = positiveBigInt(await vault.getPricePerFullShare());
      if (!valuationMethod && sharesRaw > 0n && ppfsRaw > 0n) {
        const shareAmount = Number(formatUnits(sharesRaw, shareDecimals));
        const ppfs = Number(formatUnits(ppfsRaw, 18));
        const underlying = shareAmount * ppfs;
        underlyingRaw = BigInt(Math.round(underlying * (10 ** Math.min(wantDecimals, 15)))) *
          (10n ** BigInt(Math.max(0, wantDecimals - 15)));
        valuationMethod = 'share balance × getPricePerFullShare()';
      }
    } catch {
      try {
        ppfsRaw = positiveBigInt(await vault.pricePerShare());
      } catch {}
    }

    const shares = Number(formatUnits(sharesRaw, shareDecimals));
    const underlying = underlyingRaw > 0n ? Number(formatUnits(underlyingRaw, wantDecimals)) : 0;
    const ppfs = ppfsRaw && ppfsRaw > 0n ? Number(formatUnits(ppfsRaw, 18)) : (
      shares > 0 ? underlying / shares : null
    );

    return {
      vaultAddress: getAddress(vaultAddress),
      wantToken: want,
      wantSymbol,
      shares: round(shares),
      underlyingCvxCrv: round(underlying),
      ppfs: round(ppfs, 18),
      valuationMethod
    };
  });

  result.diagnostics.push(...(r.errors || []));
  if (!r.result) {
    result.status = 'partial';
    return result;
  }
  Object.assign(result, r.result);
  result.status = 'ok';
  result.wantMatchesCanonicalCvxCrv = lower(result.wantToken) === lower(CVXCRV);
  result.productivityPlan = {
    classification: 'Beefy auto-compounded cvxCRV',
    currentState: 'vault shares are redeemable for underlying cvxCRV; harvested Convex rewards are reinvested back into the vault',
    accounting: 'current underlying cvxCRV belongs on the company balance sheet as CRV / cvxCRV economic exposure',
    rewards: 'do NOT add harvested rewards as separate Accrued Rewards when they are already compounded into vault share value',
    nextMeasurement: 'store PPFS/share checkpoints and measure non-overlapping share-value growth; historical deposit-flow adjustment is required to quantify cumulative compounded cvxCRV since inception'
  };
  return result;
}

async function currentPrices() {
  const ids = ['bitcoin','ethereum','aerodrome-finance','curve-dao-token','convex-crv','yield-basis'];
  try {
    const q = encodeURIComponent(ids.join(','));
    const j = await fetchJson(`https://api.coingecko.com/api/v3/simple/price?ids=${q}&vs_currencies=usd`, {}, 20000);
    return Object.fromEntries(ids.map(id => [id, safeNum(j?.[id]?.usd)]));
  } catch (e) {
    return { error: errMsg(e) };
  }
}

function aggregateFamily(rows, family) {
  const selected = (rows || []).filter(r => r.family === family);
  const known = selected.filter(r => safeNum(r.equivalentAmount) !== null);
  const unresolved = selected.filter(r => safeNum(r.equivalentAmount) === null);
  return {
    equivalent: round(sum(known.map(r => r.equivalentAmount))),
    complete: unresolved.length === 0,
    unresolved: unresolved.map(r => ({
      chain: r.chain, protocol: r.protocol, symbol: r.symbol, amount: r.amount,
      conversion: r.conversion
    }))
  };
}


const OWNER_OBSERVED_RECONCILIATION = Object.freeze([
  {
    family: 'BTC', chain: 'Avalanche', symbol: 'BTC.b',
    token: '0x152b9d0FdC40C096757F570A51E494bD4B943E50',
    observedApprox: 0.0435,
    note: 'owner-observed current component'
  },
  {
    family: 'BTC', chain: 'Base', symbol: 'cbBTC',
    token: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf',
    observedApprox: 0.0090,
    note: 'owner sees two current components around 0.0070 + 0.0020'
  },
  {
    family: 'BTC', chain: 'Base', symbol: 'WBTC',
    token: '0x0555e30da8f98308EdB960aa94c0Db47230d2B9c',
    observedApprox: 0.0048,
    note: 'owner labels this component Lombard'
  },
  {
    family: 'BTC', chain: 'Ethereum', symbol: 'WBTC',
    token: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    observedApprox: 0.0028,
    note: 'owner labels this component Lombard'
  },
  {
    family: 'BTC', chain: 'Polygon', symbol: 'WBTC',
    token: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
    observedApprox: 0.0053,
    note: 'owner-observed current Polygon WBTC'
  },
  {
    family: 'BTC', chain: 'Arbitrum', symbol: 'WBTC',
    token: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
    observedApprox: 0.0073,
    note: 'owner-observed current Arbitrum WBTC'
  },
  {
    family: 'ETH', chain: 'Base', symbol: 'WETH',
    token: '0x4200000000000000000000000000000000000006',
    observedApprox: 0.1606,
    note: 'owner-observed current Base WETH'
  }
]);

function reconcileOwnerObserved(rows) {
  const items = OWNER_OBSERVED_RECONCILIATION.map(item => {
    const matchedRows = (rows || []).filter(r =>
      r.family === item.family &&
      r.chain === item.chain &&
      lower(r.token) === lower(item.token)
    );
    const discovered = sum(matchedRows.map(r => r.amount));
    const tolerance = Math.max(0.00015, item.observedApprox * 0.02);
    const delta = discovered - item.observedApprox;
    const matched = Math.abs(delta) <= tolerance;
    return {
      ...item,
      discovered: round(discovered),
      deltaVsObservedApprox: round(delta),
      tolerance: round(tolerance),
      matched,
      matchedRows: matchedRows.map(r => ({
        protocol: r.protocol,
        source: r.source,
        amount: r.amount,
        equivalentAmount: r.equivalentAmount
      }))
    };
  });
  return {
    expectedApproxBtcFromOwnerList: round(sum(
      OWNER_OBSERVED_RECONCILIATION.filter(x => x.family === 'BTC').map(x => x.observedApprox)
    )),
    expectedApproxEthTokenFromOwnerList: round(sum(
      OWNER_OBSERVED_RECONCILIATION.filter(x => x.family === 'ETH').map(x => x.observedApprox)
    )),
    items,
    unresolved: items.filter(x => !x.matched),
    btcMatched: items.filter(x => x.family === 'BTC').every(x => x.matched),
    ethMatched: items.filter(x => x.family === 'ETH').every(x => x.matched)
  };
}

function buildCompanyBook({ allAssetRows, btcoc, aerodrome, yieldBasis, beefy, prices }) {
  const rows = [...allAssetRows];
  if (btcoc?.btcEquivalent > 0) {
    rows.push({
      chain: 'Ethereum',
      protocol: 'Lombard',
      source: 'btcoc-erc4626',
      family: 'BTC',
      symbol: 'BTCoc',
      amount: btcoc.shares,
      equivalentAmount: btcoc.btcEquivalent,
      conversion: btcoc.conversion
    });
  }

  const btc = aggregateFamily(rows, 'BTC');
  const eth = aggregateFamily(rows, 'ETH');
  const aeroQty = safeNum(aerodrome?.totalAeroExposure);
  const aeroProductive = safeNum(aerodrome?.productiveVeAero);
  const ybQty = safeNum(yieldBasis?.totalYbExposure);
  const ybProductive = safeNum(yieldBasis?.productiveVeYb);
  const cvxCrvQty = safeNum(beefy?.underlyingCvxCrv);

  const priceMap = {
    BTC: safeNum(prices?.bitcoin),
    ETH: safeNum(prices?.ethereum),
    AERO: safeNum(prices?.['aerodrome-finance']),
    CRV: safeNum(prices?.['convex-crv']), // current value of wrapped position, NOT CRV spot
    YB: safeNum(prices?.['yield-basis'])
  };

  const book = [
    {
      symbol: 'BTC',
      id: 'bitcoin',
      quantity: btc.equivalent,
      quantityComplete: btc.complete,
      entryUsd: ENTRY.BTC,
      costBasisUsd: null,
      currentPriceUsdAtDiscovery: priceMap.BTC,
      currentValueUsdAtDiscovery: priceMap.BTC !== null ? round(btc.equivalent * priceMap.BTC, 6) : null,
      classification: 'foundation / reserve',
      productiveQuantity: 0,
      internalBreakdown: rows.filter(r => r.family === 'BTC'),
      unresolvedConversions: btc.unresolved
    },
    {
      symbol: 'ETH',
      id: 'ethereum',
      quantity: eth.equivalent,
      quantityComplete: eth.complete,
      entryUsd: ENTRY.ETH,
      costBasisUsd: null,
      currentPriceUsdAtDiscovery: priceMap.ETH,
      currentValueUsdAtDiscovery: priceMap.ETH !== null ? round(eth.equivalent * priceMap.ETH, 6) : null,
      classification: 'foundation / reserve',
      productiveQuantity: 0,
      internalBreakdown: rows.filter(r => r.family === 'ETH'),
      unresolvedConversions: eth.unresolved
    },
    {
      symbol: 'AERO / veAERO',
      id: 'aerodrome-finance',
      quantity: round(aeroQty),
      quantityComplete: aeroQty !== null,
      entryUsd: ENTRY.AERO,
      costBasisUsd: null,
      currentPriceUsdAtDiscovery: priceMap.AERO,
      currentValueUsdAtDiscovery: aeroQty !== null && priceMap.AERO !== null ? round(aeroQty * priceMap.AERO, 6) : null,
      classification: 'productive',
      productiveQuantity: round(aeroProductive),
      internalBreakdown: {
        freeAero: round(aerodrome?.freeAero),
        veAero: round(aerodrome?.productiveVeAero),
        positions: aerodrome?.positions || []
      }
    },
    {
      symbol: 'CRV / cvxCRV',
      id: 'convex-crv',
      economicAsset: 'CRV',
      currentValuationAsset: 'cvxCRV',
      quantity: round(cvxCrvQty),
      quantityComplete: beefy?.status === 'ok',
      entryUsd: ENTRY.CRV,
      costBasisUsd: null,
      currentPriceUsdAtDiscovery: priceMap.CRV,
      currentCrvSpotUsdAtDiscovery: safeNum(prices?.['curve-dao-token']),
      currentValueUsdAtDiscovery: cvxCrvQty !== null && priceMap.CRV !== null ? round(cvxCrvQty * priceMap.CRV, 6) : null,
      classification: 'productive / auto-compounded',
      productiveQuantity: round(cvxCrvQty),
      valuationRule: 'quantity is underlying cvxCRV economic principal; current value uses cvxCRV market value, not an assumed 1:1 CRV spot price',
      internalBreakdown: beefy
    },
    {
      symbol: 'YB / veYB',
      id: 'yield-basis',
      quantity: round(ybQty),
      quantityComplete: ybQty !== null,
      entryUsd: ENTRY.YB,
      costBasisUsd: null,
      currentPriceUsdAtDiscovery: priceMap.YB,
      currentValueUsdAtDiscovery: ybQty !== null && priceMap.YB !== null ? round(ybQty * priceMap.YB, 6) : null,
      classification: 'productive',
      productiveQuantity: round(ybProductive),
      internalBreakdown: {
        freeYb: round(yieldBasis?.freeYb),
        veYb: round(yieldBasis?.productiveVeYb),
        lockEndUnix: yieldBasis?.lockEndUnix ?? null
      }
    }
  ];

  for (const row of book) {
    row.performanceUsdAtDiscovery = null;
    row.performancePctAtDiscovery = null;
    row.entryStatus = 'waiting-for-owner-average-entry';
  }
  return { book, normalizedRows: rows };
}

async function main() {
  const startedAt = new Date().toISOString();

  const lombardRatio = await discoverLombardExchangeRatio();

  const [
    direct,
    wrapperCandidates,
    aave,
    morpho,
    btcoc,
    aerodrome,
    yieldBasis,
    beefy,
    prices
  ] = await Promise.all([
    discoverDirectBalances(lombardRatio),
    discoverWalletWrapperCandidates(),
    discoverAave(lombardRatio),
    discoverMorpho(lombardRatio),
    discoverLombardBtcoc(lombardRatio),
    discoverAerodrome(),
    discoverYieldBasisVeYb(),
    discoverBeefyCvxCrv(),
    currentPrices()
  ]);

  const allAssetRows = [
    ...(direct.rows || []),
    ...(aave.rows || []),
    ...(morpho.rows || [])
  ];

  const { book: proposedCompanyBook, normalizedRows } = buildCompanyBook({
    allAssetRows,
    btcoc,
    aerodrome,
    yieldBasis,
    beefy,
    prices
  });

  const ownerObservedReconciliation = reconcileOwnerObserved(normalizedRows);
  const btcBookForReconcile = proposedCompanyBook.find(x => x.symbol === 'BTC');
  const ethBookForReconcile = proposedCompanyBook.find(x => x.symbol === 'ETH');
  if (btcBookForReconcile && !ownerObservedReconciliation.btcMatched) {
    btcBookForReconcile.quantityComplete = false;
  }
  if (ethBookForReconcile && !ownerObservedReconciliation.ethMatched) {
    ethBookForReconcile.quantityComplete = false;
  }

  const ignoredLiabilities = [
    ...(aave.ignoredLiabilities || []),
    ...(morpho.ignoredLiabilities || [])
  ];

  const btcBook = proposedCompanyBook.find(x => x.symbol === 'BTC');
  const ethBook = proposedCompanyBook.find(x => x.symbol === 'ETH');

  const protocolFingerprint = unique([
    'Bitcoin',
    'Ethereum',
    ...(aave.rows?.length ? ['Aave'] : []),
    ...(morpho.rows?.length || Object.values(morpho.rawByChain || {}).some(x => (x.marketPositionCount || x.vaultPositionCount || x.vaultV2PositionCount)) ? ['Morpho'] : []),
    ...(normalizedRows.some(x => x.protocol === 'Lombard') || btcoc?.shares > 0 ? ['Lombard'] : []),
    ...(safeNum(aerodrome?.totalAeroExposure) > 0 ? ['Aero'] : []),
    ...(safeNum(yieldBasis?.totalYbExposure) > 0 ? ['Yield Basis'] : []),
    ...(safeNum(beefy?.shares) > 0 ? ['Beefy','Convex','Curve'] : [])
  ]);

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    purpose: 'bounded current-state fingerprint for Company #009; aggregate all discovered BTC/ETH economic exposure; reconcile owner-observed components; Polygon + Avalanche Aave coverage; native-ETH multichain sweep; isolate unresolved Lombard/Beefy mechanics; no entry-price invention',
    company: {
      registry: COMPANY.registry,
      name: COMPANY.name,
      foundedAt: COMPANY.foundedAt,
      founding: {
        date: COMPANY.foundedAt,
        method: COMPANY.foundingMethod,
        confidence: COMPANY.foundingConfidence,
        note: 'Owner-declared founding date; do not overwrite with wallet or protocol history.'
      },
      architecture: COMPANY.architecture,
      wallet: COMPANY.wallet,
      debank: COMPANY.debank
    },
    accountingPolicy: {
      publicArchitecture: 'The Holding Standard',
      foundationAssets: ['BTC','ETH'],
      publicBalanceRows: ['BTC','ETH','AERO / veAERO','CRV / cvxCRV','YB / veYB'],
      btcAggregation: 'one BTC-equivalent public row across direct canonical wrappers, Aave, Morpho, Lombard and recognized yield-bearing wrappers using verified conversion rates',
      ethAggregation: 'one ETH-equivalent public row across direct/native ETH, canonical wrappers, Aave and Morpho using verified conversion rates',
      liabilities: 'Aave/Morpho borrow positions are diagnostic only and are NOT subtracted from gross public balance',
      aaveMorphoProductivity: 'lending/borrow yield is excluded from Reference APR by current owner instruction; supplied/collateral principal remains part of gross balance',
      beefyCvxCrv: 'current underlying cvxCRV is represented as CRV / cvxCRV economic exposure; current valuation uses cvxCRV market price; auto-compounded rewards are embedded in vault share value',
      entryPrices: ENTRY,
      performance: 'pending until owner supplies average entry prices for BTC, ETH, AERO, CRV and YB'
    },
    discovery: {
      lombardExchangeRatio: lombardRatio,
      directSelectedBalances: direct,
      walletWrapperCandidates: wrapperCandidates,
      aave,
      morpho,
      lombardBtcoc: btcoc,
      aerodrome,
      yieldBasisVeYb: yieldBasis,
      beefyCvxCrv: beefy,
      currentPrices,
      ownerObservedReconciliation
    },
    proposedCompanyBook,
    protocolFingerprint,
    ignoredLiabilities,
    knownAdapterReuse: {
      productivity: [
        'Aero: reuse known direct/managed veAERO adapter based on discovered custody mode',
        'Yield Basis veYB: reuse yieldbasis_veyb',
        'BTC/ETH Aave and Morpho: balance only; Reference APR excluded by owner instruction'
      ],
      rewards: [
        'Aero: reuse aerodrome-ve or aerodrome-relay based on custody mode',
        'Yield Basis veYB: reuse yield-basis-fees with UI label Yield Basis · veYB'
      ]
    },
    newMechanismDelta: {
      morpho: {
        lane: 'A/B',
        status: 'current position discovery via official Morpho API; debt diagnostic-only',
        graphNode: 'Morpho'
      },
      lombard: {
        lane: 'B',
        status: 'LBTC is normalized with official BTC-per-LBTC exchange rate; BTCoc is ERC-4626 share-value compounding',
        graphNode: 'Lombard'
      },
      beefyCvxCrv: {
        lane: 'C',
        status: beefy?.status || 'unavailable',
        mechanism: 'Beefy vault auto-compounds Convex cvxCRV rewards back into cvxCRV',
        currentTracking: 'vault shares + current underlying cvxCRV + current PPFS',
        nextNarrowTask: 'derive reproducible historical compounded cvxCRV / trailing PPFS return without double-counting deposits and withdrawals'
      }
    },
    pageIntegrationPlan: {
      companyCard: 'Registry 008 · 1milliondollar.eth · The Holding Standard',
      passport: 'The Holding Standard; foundation BTC + ETH; productive veAERO, Beefy cvxCRV, veYB as discovered',
      graph: {
        newCompanyNode: '1milliondollar.eth',
        companyProtocolsFromDiscovery: protocolFingerprint,
        addYellowNode: ['Morpho'],
        independentExistingGraphPatch: {
          yellowNode: 'Llamalend',
          connectToCompany: 'YieldRing.eth'
        }
      },
      waitForOwnerEntryPricesBeforePerformance: true
    },
    productionReadiness: {
      btcQuantityComplete: Boolean(btcBook?.quantityComplete)
        && ownerObservedReconciliation.btcMatched
        && !(wrapperCandidates?.candidates || []).some(x => x.familyCandidate === 'BTC')
        && !(morpho?.unresolvedWrapperCandidates || []).some(x => x.familyCandidate === 'BTC'),
      ethQuantityComplete: Boolean(ethBook?.quantityComplete)
        && ownerObservedReconciliation.ethMatched
        && !(wrapperCandidates?.candidates || []).some(x => x.familyCandidate === 'ETH')
        && !(morpho?.unresolvedWrapperCandidates || []).some(x => x.familyCandidate === 'ETH'),
      ownerObservedBtcReconciliationMatched: ownerObservedReconciliation.btcMatched,
      ownerObservedEthReconciliationMatched: ownerObservedReconciliation.ethMatched,
      aerodromeResolved: safeNum(aerodrome?.totalAeroExposure) !== null,
      yieldBasisResolved: safeNum(yieldBasis?.totalYbExposure) !== null,
      beefyResolved: beefy?.status === 'ok' || (beefy?.status === 'no-position'),
      entryPricesComplete: false,
      readyForFinalPageIntegration: false,
      note: 'Final page/index Performance integration intentionally waits for owner average entries. A partial source is never silently treated as zero.'
    },
    diagnostics: {
      direct: direct.diagnostics || [],
      walletWrapperCandidates: wrapperCandidates.diagnostics || [],
      aave: aave.diagnostics || [],
      morpho: morpho.diagnostics || [],
      lombard: unique([lombardRatio.error, ...(btcoc.diagnostics || [])].filter(Boolean)),
      aerodrome: aerodrome.diagnostics || [],
      yieldBasis: yieldBasis.diagnostics || [],
      beefy: beefy.diagnostics || []
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Company #009 discovery written: ${OUTPUT}`);
  console.log(`Version: ${VERSION}`);
  console.log(`BTC-equivalent: ${btcBook?.quantity ?? 'unresolved'} | complete=${btcBook?.quantityComplete}`);
  console.log(`ETH-equivalent: ${ethBook?.quantity ?? 'unresolved'} | complete=${ethBook?.quantityComplete}`);
  console.log(`AERO / veAERO: ${proposedCompanyBook.find(x => x.symbol === 'AERO / veAERO')?.quantity ?? 'unresolved'}`);
  console.log(`CRV / cvxCRV via Beefy: ${proposedCompanyBook.find(x => x.symbol === 'CRV / cvxCRV')?.quantity ?? 'unresolved'}`);
  console.log(`YB / veYB: ${proposedCompanyBook.find(x => x.symbol === 'YB / veYB')?.quantity ?? 'unresolved'}`);
  console.log(`Ignored liabilities: ${ignoredLiabilities.length}`);
  console.log(`Protocols: ${protocolFingerprint.join(', ')}`);
  console.log(`Owner-observed BTC reconciliation: ${ownerObservedReconciliation.btcMatched ? 'MATCHED' : 'UNRESOLVED'}`);
  console.log(`Owner-observed ETH reconciliation: ${ownerObservedReconciliation.ethMatched ? 'MATCHED' : 'UNRESOLVED'}`);
  for (const x of ownerObservedReconciliation.unresolved) {
    console.log(`UNRESOLVED ${x.family} ${x.chain} ${x.symbol}: observed≈${x.observedApprox}, discovered=${x.discovered}`);
  }
}

main().catch(err => {
  console.error(`Company #009 discovery failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
