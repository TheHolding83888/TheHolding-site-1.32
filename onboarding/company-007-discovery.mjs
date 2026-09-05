import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  formatUnits,
  getAddress
} from 'ethers';

const VERSION = '1.0-current-state-fast';
const OUTPUT = process.env.COMPANY_007_DISCOVERY_OUTPUT
  || path.resolve('companies/company-007-discovery.json');

const COMPANY = {
  registry: '007',
  name: "Rook's portfolio",
  foundedAt: '2026-01-08',
  foundingMethod: 'owner-declared',
  foundingConfidence: 'declared',
  wallets: [
    {
      alias: 'Wallet 1',
      address: getAddress('0x7ec6331188468269dc7c1cf6a84c972632178b1e')
    },
    {
      alias: 'Wallet 2',
      address: getAddress('0x9c548960bd053c8465f298a711b6343ae0360309')
    }
  ]
};

const ENTRY = Object.freeze({
  BTC: 74452,
  ETH: 2582,
  AERO: 0.3296,
  CVX: 1.65,
  CRV: 0.2129,
  LINK: 14.9,
  ZK: 0.14
});

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
  optimism: unique([
    process.env.OPTIMISM_RPC_URL,
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io'
  ]),
  arbitrum: unique([
    process.env.ARBITRUM_RPC_URL,
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc'
  ]),
  zksync: unique([
    process.env.ZKSYNC_RPC_URL,
    'https://mainnet.era.zksync.io'
  ])
};

const CHAIN_LABEL = {
  ethereum: 'Ethereum',
  base: 'Base',
  optimism: 'Optimism',
  arbitrum: 'Arbitrum',
  zksync: 'ZKsync Era'
};

const TOKENS = {
  ethereum: {
    WBTC: ['0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'],
    cbBTC: ['0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'],
    tBTC: ['0x18084fbA666a33d37592fA2633fD49a74DD93a88'],
    WETH: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
    CVX: ['0x4e3FBD56CD56c3e72c1403e103b45d2B0D6B9D2B'],
    CRV: ['0xD533a949740bb3306d119CC777fa900bA034cd52'],
    LINK: ['0x514910771AF9Ca656af840dff83E8264EcF986CA']
  },
  base: {
    cbBTC: ['0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf'],
    WETH: ['0x4200000000000000000000000000000000000006'],
    AERO: ['0x940181a94A35A4569E4529A3CDfB74e38FD98631']
  },
  optimism: {
    WBTC: ['0x68f180fcCe6836688e9084f035309E29BF0A2095'],
    WETH: ['0x4200000000000000000000000000000000000006'],
    LINK: ['0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6']
  },
  arbitrum: {
    WBTC: ['0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f'],
    WETH: ['0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'],
    LINK: ['0xf97f4df75117a78c1A5a0DBb814Af92458539FB4']
  },
  zksync: {
    LINK: ['0x52869bae3E091e36b0915941577F2D47d8d8B534'],
    ZK: ['0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E']
  }
};

const AAVE_DATA_PROVIDER = {
  ethereum: '0x0a16f2FCC0D44FaE41cc54e079281D84A363bECD',
  base: '0x0F43731EB8d45A581f4a36DD74F5f358bc90C73A',
  optimism: '0x243Aa95cAC2a25651eda86e80bEe66114413c43b',
  arbitrum: '0x243Aa95cAC2a25651eda86e80bEe66114413c43b'
};

const AERODROME = {
  token: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
  votingEscrow: '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4'
};

const CONVEX = {
  token: '0x4e3FBD56CD56c3e72c1403e103b45d2B0D6B9D2B',
  lockerV2: '0x72a19342e8F1838460eBFCCEf09F6585e32db86E'
};

const CURVE = {
  crvUsdFactory: '0xC9332fdCB1C491Dcc683bAe86Fe3cb70360738BC',
  lendingFactory: '0xeA6876DDE9e3467564acBeE1Ed5bac88783205E0',
  crvUSD: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E'
};

// Current + known deprecated Yield Basis BTC/ETH markets.
// Discovery reads every generation because a user can still hold a legacy LT.
const YB_MARKETS = [
  {
    family: 'BTC', version: 'current', name: 'yb-WBTC',
    asset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    lt: '0x651D4b8168488FA163d85304662E8278d4c55BAa',
    gauge: '0xAa0b1d265F23972eafB7d088e963BD31403A58F5'
  },
  {
    family: 'ETH', version: 'current', name: 'yb-WETH',
    asset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    lt: '0x2B9c9f3BdcEb5d8E36a4704F08a78Fca53343cEa',
    gauge: '0xd829456FD63Ada7DE0657714A3A7A26DE403E3D8'
  },
  {
    family: 'BTC', version: 'deprecated-v2', name: 'yb-WBTC v2',
    asset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    lt: '0xfBF3C16676055776Ab9B286492D8f13e30e2E763',
    gauge: '0xbc56e3edB67b56d598aCE07668b138815F45d7aa'
  },
  {
    family: 'BTC', version: 'deprecated-legacy', name: 'yb-WBTC Legacy',
    asset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    lt: '0x6095a220C5567360d459462A25b1AD5aEAD45204',
    gauge: '0x37f45E64935e7B8383D2f034048B32770B04E8bd'
  },
  {
    family: 'ETH', version: 'deprecated-legacy', name: 'yb-WETH Legacy',
    asset: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    lt: '0x931d40dD07b25B91932b481B63631Ea86d236e09',
    gauge: '0xe4e656B5215a82009969219b1bAbB7c0757A3315'
  }
];

const YB_HYBRID_FACTORY = '0xBdC32268851C324c6185809271dfe6d8dab8dC5b';

const STAKE_DAO_VLCVX = {
  voterMerkle: 'https://raw.githubusercontent.com/stake-dao/bounties-report/main/bounties-reports/latest/vlCVX/vlcvx_merkle.json',
  delegatorMerkle: 'https://raw.githubusercontent.com/stake-dao/bounties-report/main/bounties-reports/latest/vlCVX/vlcvx_merkle_delegators.json'
};

function unique(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function safeNum(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}
function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[rpc-redacted]');
}
function safeHost(url) {
  const configured = Object.values(RPC).flat().filter(Boolean);
  try {
    const rawSecrets = [
      process.env.ETH_RPC_URL, process.env.ETH_RPC_URL_2,
      process.env.BASE_RPC_URL, process.env.BASE_RPC_URL_2,
      process.env.OPTIMISM_RPC_URL, process.env.ARBITRUM_RPC_URL,
      process.env.ZKSYNC_RPC_URL
    ].filter(Boolean);
    return rawSecrets.includes(url) ? 'configured' : new URL(url).hostname;
  } catch {
    return 'configured';
  }
}
function lower(a) {
  return String(a || '').toLowerCase();
}
function bnPositive(x) {
  try {
    const n = BigInt(x);
    return n > 0n ? n : 0n;
  } catch {
    return 0n;
  }
}
function sum(arr) {
  return (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
}
function round(x, d = 12) {
  if (!Number.isFinite(Number(x))) return null;
  return Number(Number(x).toFixed(d));
}
function classifyBtcSymbol(symbol) {
  return ['WBTC', 'CBBTC', 'TBTC'].includes(String(symbol || '').toUpperCase());
}
function normalizeFamilySymbol(symbol) {
  const s = String(symbol || '').toUpperCase();
  if (classifyBtcSymbol(s)) return 'BTC';
  if (s === 'WETH' || s === 'ETH') return 'ETH';
  return s;
}

async function withProvider(chain, fn) {
  const errors = [];
  for (const url of RPC[chain] || []) {
    const provider = new JsonRpcProvider(url);
    try {
      const result = await fn(provider);
      return {
        result,
        provider: `${chain}:${safeHost(url)}`,
        errors
      };
    } catch (e) {
      errors.push(`${chain}:${safeHost(url)}: ${errMsg(e)}`);
    } finally {
      provider.destroy();
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

async function fetchJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'user-agent': 'The-Holding-Company-007-Discovery/1.0' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

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

async function erc20Balance(provider, address, wallet, knownSymbol = null) {
  const meta = await erc20Meta(provider, address);
  const c = new Contract(address, ['function balanceOf(address) view returns (uint256)'], provider);
  const raw = await c.balanceOf(wallet);
  return {
    token: getAddress(address),
    symbol: knownSymbol || meta.symbol,
    decimals: meta.decimals,
    raw: raw.toString(),
    amount: Number(formatUnits(raw, meta.decimals))
  };
}

async function discoverDirectSelectedBalances() {
  const rows = [];
  const diagnostics = [];

  for (const chain of Object.keys(RPC)) {
    const r = await safeProvider(chain, async provider => {
      const out = [];
      for (const w of COMPANY.wallets) {
        // Every listed EVM chain here uses ETH as native gas token.
        try {
          const raw = await provider.getBalance(w.address);
          if (raw > 0n) {
            out.push({
              wallet: w.address,
              walletAlias: w.alias,
              chain: CHAIN_LABEL[chain],
              family: 'ETH',
              symbol: 'ETH',
              source: 'wallet-native',
              amount: Number(formatUnits(raw, 18))
            });
          }
        } catch {}

        for (const [symbol, addresses] of Object.entries(TOKENS[chain] || {})) {
          for (const token of addresses) {
            try {
              const b = await erc20Balance(provider, token, w.address, symbol);
              if (bnPositive(b.raw) > 0n) {
                out.push({
                  wallet: w.address,
                  walletAlias: w.alias,
                  chain: CHAIN_LABEL[chain],
                  family: normalizeFamilySymbol(symbol),
                  symbol,
                  source: 'wallet-erc20',
                  amount: b.amount,
                  token: b.token
                });
              }
            } catch {}
          }
        }
      }
      return out;
    });
    rows.push(...(r.result || []));
    diagnostics.push(...(r.errors || []));
  }
  return { rows, diagnostics };
}

async function discoverAave() {
  const rows = [];
  const ignoredLiabilities = [];
  const diagnostics = [];
  const ABI = [
    'function getUserReserveData(address asset,address user) view returns (uint256 currentATokenBalance,uint256 currentStableDebt,uint256 currentVariableDebt,uint256 principalStableDebt,uint256 scaledVariableDebt,uint256 stableBorrowRate,uint256 liquidityRate,uint40 stableRateLastUpdated,bool usageAsCollateralEnabled)'
  ];

  for (const [chain, providerAddress] of Object.entries(AAVE_DATA_PROVIDER)) {
    const r = await safeProvider(chain, async provider => {
      const dp = new Contract(providerAddress, ABI, provider);
      const chainRows = [];
      const debts = [];

      const selectedTokens = [];
      for (const [symbol, addresses] of Object.entries(TOKENS[chain] || {})) {
        if (normalizeFamilySymbol(symbol) !== 'BTC' && normalizeFamilySymbol(symbol) !== 'ETH') continue;
        for (const token of addresses) selectedTokens.push({ symbol, token });
      }

      for (const w of COMPANY.wallets) {
        for (const x of selectedTokens) {
          try {
            const meta = await erc20Meta(provider, x.token);
            const d = await dp.getUserReserveData(x.token, w.address);
            const supplied = bnPositive(d.currentATokenBalance);
            const variableDebt = bnPositive(d.currentVariableDebt);
            const stableDebt = bnPositive(d.currentStableDebt);

            if (supplied > 0n) {
              chainRows.push({
                wallet: w.address,
                walletAlias: w.alias,
                chain: CHAIN_LABEL[chain],
                protocol: 'Aave V3',
                family: normalizeFamilySymbol(x.symbol),
                symbol: x.symbol,
                token: getAddress(x.token),
                source: 'aave-supplied',
                amount: Number(formatUnits(supplied, meta.decimals)),
                productiveForHoldingReferenceApr: false,
                note: 'Included in gross selected-asset balance; supply yield intentionally excluded from #007 Reference APR by owner accounting rule.'
              });
            }

            if (variableDebt > 0n || stableDebt > 0n) {
              debts.push({
                wallet: w.address,
                walletAlias: w.alias,
                chain: CHAIN_LABEL[chain],
                protocol: 'Aave V3',
                asset: x.symbol,
                variableDebt: Number(formatUnits(variableDebt, meta.decimals)),
                stableDebt: Number(formatUnits(stableDebt, meta.decimals)),
                treatment: 'diagnostic-only; not subtracted from public gross selected-asset balance'
              });
            }
          } catch {}
        }
      }
      return { chainRows, debts };
    });
    rows.push(...(r.result?.chainRows || []));
    ignoredLiabilities.push(...(r.result?.debts || []));
    diagnostics.push(...(r.errors || []));
  }

  return { rows, ignoredLiabilities, diagnostics };
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

    const wallets = [];
    let totalFreeRaw = 0n;
    let totalEconomicVeRaw = 0n;

    for (const w of COMPANY.wallets) {
      let freeRaw = 0n;
      try { freeRaw = bnPositive(await token.balanceOf(w.address)); } catch {}
      totalFreeRaw += freeRaw;

      let count = 0;
      try { count = Number(await ve.balanceOf(w.address)); } catch {}
      const positions = [];

      for (let i = 0; i < count; i++) {
        const tokenId = await ve.ownerToNFTokenIdList(w.address, i);
        let managedId = 0n;
        let amountRaw = 0n;
        let end = 0n;
        let isPermanent = false;
        let escrowType = null;
        let managedWeightRaw = 0n;

        try { managedId = bnPositive(await ve.idToManaged(tokenId)); } catch {}
        try {
          const locked = await ve.locked(tokenId);
          amountRaw = bnPositive(locked.amount);
          end = bnPositive(locked.end);
          isPermanent = Boolean(locked.isPermanent);
        } catch {}
        try { escrowType = Number(await ve.escrowType(tokenId)); } catch {}
        if (managedId > 0n) {
          try { managedWeightRaw = bnPositive(await ve.weights(tokenId, managedId)); } catch {}
        }

        const economicRaw = managedWeightRaw > 0n ? managedWeightRaw : amountRaw;
        totalEconomicVeRaw += economicRaw;

        positions.push({
          tokenId: tokenId.toString(),
          escrowType,
          managedTokenId: managedId.toString(),
          directLockedAERO: Number(formatUnits(amountRaw, 18)),
          managedWeightAERO: Number(formatUnits(managedWeightRaw, 18)),
          economicPrincipalAERO: Number(formatUnits(economicRaw, 18)),
          isPermanent,
          lockEndUnix: end > 0n ? Number(end) : null,
          custodyMode: managedId > 0n ? 'managed-veNFT' : 'direct-veNFT'
        });
      }

      wallets.push({
        wallet: w.address,
        walletAlias: w.alias,
        freeAERO: Number(formatUnits(freeRaw, 18)),
        veNftCount: count,
        positions
      });
    }

    return {
      chain: 'Base',
      wallets,
      freeAERO: Number(formatUnits(totalFreeRaw, 18)),
      economicVeAERO: Number(formatUnits(totalEconomicVeRaw, 18)),
      totalAEROExposure: Number(formatUnits(totalFreeRaw + totalEconomicVeRaw, 18)),
      productiveAEROExposure: Number(formatUnits(totalEconomicVeRaw, 18)),
      adapterCompatibility: {
        direct: 'known:aerodrome-ve',
        managed: 'known:aerodrome-relay'
      }
    };
  });
  return { ...r.result, diagnostics: r.errors || [] };
}

async function discoverConvex() {
  const r = await safeProvider('ethereum', async provider => {
    const cvx = new Contract(CONVEX.token, ['function balanceOf(address) view returns (uint256)'], provider);
    const locker = new Contract(CONVEX.lockerV2, [
      'function lockedBalances(address) view returns (uint256 total,uint256 unlockable,uint256 locked,tuple(uint112 amount,uint32 unlockTime)[] lockData)'
    ], provider);

    const wallets = [];
    let freeRawTotal = 0n;
    let lockerTotalRawTotal = 0n;
    let lockedRawTotal = 0n;

    for (const w of COMPANY.wallets) {
      let freeRaw = 0n;
      try { freeRaw = bnPositive(await cvx.balanceOf(w.address)); } catch {}
      freeRawTotal += freeRaw;

      let lockedRaw = 0n;
      let totalRaw = 0n;
      let unlockableRaw = 0n;
      let lockData = [];
      try {
        const x = await locker.lockedBalances(w.address);
        totalRaw = bnPositive(x.total);
        unlockableRaw = bnPositive(x.unlockable);
        lockedRaw = bnPositive(x.locked);
        lockData = (x.lockData || []).map(v => ({
          amountCVX: Number(formatUnits(v.amount, 18)),
          unlockTime: Number(v.unlockTime)
        }));
      } catch {}
      lockerTotalRawTotal += totalRaw;
      lockedRawTotal += lockedRaw;

      wallets.push({
        wallet: w.address,
        walletAlias: w.alias,
        freeCVX: Number(formatUnits(freeRaw, 18)),
        lockerTotalCVX: Number(formatUnits(totalRaw, 18)),
        lockedCVX: Number(formatUnits(lockedRaw, 18)),
        unlockableCVX: Number(formatUnits(unlockableRaw, 18)),
        lockData
      });
    }

    return {
      chain: 'Ethereum',
      locker: CONVEX.lockerV2,
      wallets,
      freeCVX: Number(formatUnits(freeRawTotal, 18)),
      lockedCVX: Number(formatUnits(lockedRawTotal, 18)),
      totalCVXExposure: Number(formatUnits(freeRawTotal + lockerTotalRawTotal, 18)),
      productiveCVXExposure: Number(formatUnits(lockedRawTotal, 18)),
      unlockableNonProductiveCVX: Number(formatUnits(lockerTotalRawTotal - lockedRawTotal, 18)),
      productivityAdapter: 'known:convex_vlcvx',
      rewardsRoute: 'votium-union / current vlCVX distribution research'
    };
  });
  return { ...r.result, diagnostics: r.errors || [] };
}

async function discoverCurveLlamma() {
  const r = await safeProvider('ethereum', async provider => {
    const crvFactory = new Contract(CURVE.crvUsdFactory, [
      'function n_collaterals() view returns (uint256)',
      'function collaterals(uint256) view returns (address)',
      'function amms(uint256) view returns (address)',
      'function get_controller(address,uint256) view returns (address)'
    ], provider);
    const lendingFactory = new Contract(CURVE.lendingFactory, [
      'function market_count() view returns (uint256)',
      'function amms(uint256) view returns (address)',
      'function controllers(uint256) view returns (address)',
      'function borrowed_tokens(uint256) view returns (address)',
      'function collateral_tokens(uint256) view returns (address)'
    ], provider);

    const recognized = new Map();
    for (const [symbol, addresses] of Object.entries(TOKENS.ethereum || {})) {
      const fam = normalizeFamilySymbol(symbol);
      if (fam !== 'BTC' && fam !== 'ETH') continue;
      for (const a of addresses) recognized.set(lower(a), { family: fam, symbol });
    }

    const marketDefs = [];

    let n = 0;
    try { n = Number(await crvFactory.n_collaterals()); } catch {}
    for (let i = 0; i < n; i++) {
      try {
        const collateral = getAddress(await crvFactory.collaterals(i));
        const known = recognized.get(lower(collateral));
        if (!known) continue;
        const amm = getAddress(await crvFactory.amms(i));
        let controller = null;
        try { controller = getAddress(await crvFactory.get_controller(collateral, 0)); } catch {
          try { controller = getAddress(await crvFactory.get_controller(collateral, i)); } catch {}
        }
        marketDefs.push({
          factoryType: 'crvUSD',
          index: i,
          collateral,
          borrowedToken: CURVE.crvUSD,
          amm,
          controller,
          ...known
        });
      } catch {}
    }

    let m = 0;
    try { m = Number(await lendingFactory.market_count()); } catch {}
    for (let i = 0; i < m; i++) {
      try {
        const collateral = getAddress(await lendingFactory.collateral_tokens(i));
        const known = recognized.get(lower(collateral));
        if (!known) continue;
        const borrowedToken = getAddress(await lendingFactory.borrowed_tokens(i));
        const amm = getAddress(await lendingFactory.amms(i));
        const controller = getAddress(await lendingFactory.controllers(i));
        marketDefs.push({
          factoryType: 'LlamaLend',
          index: i,
          collateral,
          borrowedToken,
          amm,
          controller,
          ...known
        });
      } catch {}
    }

    const rows = [];
    const liabilities = [];

    for (const market of marketDefs) {
      let cMeta = { decimals: 18, symbol: market.symbol };
      let bMeta = { decimals: 18, symbol: null };
      try { cMeta = await erc20Meta(provider, market.collateral); } catch {}
      try { bMeta = await erc20Meta(provider, market.borrowedToken); } catch {}

      const amm = new Contract(market.amm, [
        'function get_sum_xy(address) view returns (uint256[2])',
        'function has_liquidity(address) view returns (bool)'
      ], provider);
      const ctrl = market.controller
        ? new Contract(market.controller, ['function debt(address) view returns (uint256)'], provider)
        : null;

      for (const w of COMPANY.wallets) {
        try {
          let has = true;
          try { has = Boolean(await amm.has_liquidity(w.address)); } catch {}
          if (!has) continue;
          const xy = await amm.get_sum_xy(w.address);
          const xRaw = bnPositive(xy[0]);
          const yRaw = bnPositive(xy[1]);

          if (yRaw > 0n) {
            rows.push({
              wallet: w.address,
              walletAlias: w.alias,
              chain: 'Ethereum',
              protocol: market.factoryType === 'crvUSD' ? 'Curve crvUSD' : 'Curve LlamaLend',
              family: market.family,
              symbol: cMeta.symbol || market.symbol,
              collateralToken: market.collateral,
              marketIndex: market.index,
              amm: market.amm,
              controller: market.controller,
              source: 'llamma-current-collateral-y',
              amount: Number(formatUnits(yRaw, cMeta.decimals)),
              softLiquidatedBorrowedAssetInsideAmm: Number(formatUnits(xRaw, bMeta.decimals)),
              softLiquidatedBorrowedSymbol: bMeta.symbol,
              productiveForHoldingReferenceApr: false,
              note: 'Only current LLAMMA collateral y enters selected BTC/ETH gross balance. Borrowed-side x is not a selected asset.'
            });
          }

          if (ctrl) {
            try {
              const debtRaw = bnPositive(await ctrl.debt(w.address));
              if (debtRaw > 0n) {
                liabilities.push({
                  wallet: w.address,
                  walletAlias: w.alias,
                  protocol: market.factoryType === 'crvUSD' ? 'Curve crvUSD' : 'Curve LlamaLend',
                  marketIndex: market.index,
                  debtToken: market.borrowedToken,
                  debtSymbol: bMeta.symbol,
                  debtAmount: Number(formatUnits(debtRaw, bMeta.decimals)),
                  treatment: 'diagnostic-only; not subtracted from public gross selected-asset balance'
                });
              }
            } catch {}
          }
        } catch {}
      }
    }

    return { rows, liabilities, marketsChecked: marketDefs };
  });

  return {
    rows: r.result?.rows || [],
    ignoredLiabilities: r.result?.liabilities || [],
    marketsChecked: r.result?.marketsChecked || [],
    diagnostics: r.errors || []
  };
}

async function resolveHybridVaultForDiscovery(factory, wallet) {
  let vault;
  try {
    vault = getAddress(await factory.user_to_vault(wallet));
  } catch (e) {
    throw new Error(`HybridVault user_to_vault unreadable for ${wallet}: ${errMsg(e)}`);
  }

  if (lower(vault) === lower(ZeroAddress)) return null;

  let owner;
  try {
    owner = getAddress(await factory.vault_to_user(vault));
  } catch (e) {
    throw new Error(`HybridVault vault_to_user unreadable for ${wallet} via ${vault}: ${errMsg(e)}`);
  }

  if (lower(owner) !== lower(wallet)) {
    throw new Error(`HybridVault inverse mapping mismatch for ${wallet}: user_to_vault=${vault}, vault_to_user=${owner}`);
  }

  return vault;
}

async function discoverHybridVaults(provider) {
  const factory = new Contract(YB_HYBRID_FACTORY, [
    'function user_to_vault(address) view returns (address)',
    'function vault_to_user(address) view returns (address)'
  ], provider);

  const out = [];
  for (const w of COMPANY.wallets) {
    const vault = await resolveHybridVaultForDiscovery(factory, w.address);
    if (vault) {
      out.push({
        owner: w.address,
        ownerAlias: w.alias,
        vault: getAddress(vault)
      });
    }
  }
  return out;
}

async function discoverYieldBasis() {
  const r = await safeProvider('ethereum', async provider => {
    const hybridVaults = await discoverHybridVaults(provider);
    const ownerByHolder = new Map();
    const holders = [];
    for (const w of COMPANY.wallets) {
      holders.push({ holder: w.address, wallet: w.address, walletAlias: w.alias, custody: 'wallet' });
      ownerByHolder.set(lower(w.address), w.address);
    }
    for (const h of hybridVaults) {
      holders.push({
        holder: h.vault,
        wallet: h.owner,
        walletAlias: h.ownerAlias,
        custody: 'Yield Basis HybridVault'
      });
      ownerByHolder.set(lower(h.vault), h.owner);
    }

    const positions = [];
    const familyTotals = { BTC: 0, ETH: 0 };
    const productiveByMode = {
      BTC: { unstakedUnderlying: 0, stakedUnderlying: 0 },
      ETH: { unstakedUnderlying: 0, stakedUnderlying: 0 }
    };

    for (const market of YB_MARKETS) {
      const lt = new Contract(market.lt, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function preview_withdraw(uint256 shares) view returns (uint256)'
      ], provider);
      const gauge = new Contract(market.gauge, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
        'function convertToAssets(uint256 shares) view returns (uint256)',
        'function previewRedeem(uint256 shares) view returns (uint256)'
      ], provider);
      const assetMeta = await erc20Meta(provider, market.asset);
      let ltDecimals = 18;
      let gaugeDecimals = 18;
      try { ltDecimals = Number(await lt.decimals()); } catch {}
      try { gaugeDecimals = Number(await gauge.decimals()); } catch {}

      for (const h of holders) {
        let directSharesRaw = 0n;
        let gaugeSharesRaw = 0n;
        let stakedLtRaw = 0n;

        try { directSharesRaw = bnPositive(await lt.balanceOf(h.holder)); } catch {}
        try { gaugeSharesRaw = bnPositive(await gauge.balanceOf(h.holder)); } catch {}

        if (gaugeSharesRaw > 0n) {
          try { stakedLtRaw = bnPositive(await gauge.convertToAssets(gaugeSharesRaw)); } catch {
            try { stakedLtRaw = bnPositive(await gauge.previewRedeem(gaugeSharesRaw)); } catch {}
          }
        }

        if (directSharesRaw <= 0n && stakedLtRaw <= 0n) continue;

        let directUnderlyingRaw = 0n;
        let stakedUnderlyingRaw = 0n;
        if (directSharesRaw > 0n) {
          try { directUnderlyingRaw = bnPositive(await lt.preview_withdraw(directSharesRaw)); } catch {}
        }
        if (stakedLtRaw > 0n) {
          try { stakedUnderlyingRaw = bnPositive(await lt.preview_withdraw(stakedLtRaw)); } catch {}
        }

        const directUnderlying = Number(formatUnits(directUnderlyingRaw, assetMeta.decimals));
        const stakedUnderlying = Number(formatUnits(stakedUnderlyingRaw, assetMeta.decimals));
        const totalUnderlying = directUnderlying + stakedUnderlying;

        familyTotals[market.family] += totalUnderlying;
        productiveByMode[market.family].unstakedUnderlying += directUnderlying;
        productiveByMode[market.family].stakedUnderlying += stakedUnderlying;

        positions.push({
          wallet: h.wallet,
          walletAlias: h.walletAlias,
          holder: h.holder,
          custody: h.custody,
          chain: 'Ethereum',
          protocol: 'Yield Basis',
          family: market.family,
          market: market.name,
          marketVersion: market.version,
          assetToken: getAddress(market.asset),
          lt: getAddress(market.lt),
          gauge: getAddress(market.gauge),
          directLtShares: Number(formatUnits(directSharesRaw, ltDecimals)),
          gaugeShares: Number(formatUnits(gaugeSharesRaw, gaugeDecimals)),
          stakedLtShares: Number(formatUnits(stakedLtRaw, ltDecimals)),
          directUnderlying,
          stakedUnderlying,
          totalUnderlying,
          redemptionMethod: 'gauge convertToAssets/previewRedeem -> LT shares -> LT.preview_withdraw',
          productivityMode: {
            unstaked: directUnderlying > 0 ? 'PPS / fee-growth productive' : null,
            staked: stakedUnderlying > 0 ? 'Gauge YB-emissions productive' : null
          }
        });
      }
    }

    return {
      chain: 'Ethereum',
      hybridVaultFactory: YB_HYBRID_FACTORY,
      hybridVaults,
      positions,
      underlyingTotals: {
        BTC: round(familyTotals.BTC),
        ETH: round(familyTotals.ETH)
      },
      productiveByMode: {
        BTC: {
          unstakedUnderlying: round(productiveByMode.BTC.unstakedUnderlying),
          stakedUnderlying: round(productiveByMode.BTC.stakedUnderlying)
        },
        ETH: {
          unstakedUnderlying: round(productiveByMode.ETH.unstakedUnderlying),
          stakedUnderlying: round(productiveByMode.ETH.stakedUnderlying)
        }
      },
      adapterStatus: 'new-productivity-adapter-required: yieldbasis-yblp; reward mechanics depend on staked/unstaked mode'
    };
  });

  return { ...r.result, diagnostics: r.errors || [] };
}

function findCaseInsensitiveClaim(claims, address) {
  const wanted = lower(address);
  for (const [k, v] of Object.entries(claims || {})) {
    if (lower(k) === wanted) return { address: k, claim: v };
  }
  return null;
}

async function discoverStakeDaoVlCvxCurrentMerkles() {
  const out = {
    source: 'Stake DAO official bounties-report latest vlCVX merkles',
    status: 'unavailable',
    voterMerkleRoot: null,
    delegatorMerkleRoot: null,
    wallets: [],
    note: 'Merkle presence is entitlement evidence only. It is NOT counted as unclaimed Accrued Rewards until claimed-state is reproducibly resolved.'
  };

  let voter = null;
  let delegator = null;
  const errors = [];

  try { voter = await fetchJson(STAKE_DAO_VLCVX.voterMerkle, 25000); } catch (e) { errors.push(`voter merkle: ${errMsg(e)}`); }
  try { delegator = await fetchJson(STAKE_DAO_VLCVX.delegatorMerkle, 25000); } catch (e) { errors.push(`delegator merkle: ${errMsg(e)}`); }

  out.voterMerkleRoot = voter?.merkleRoot || null;
  out.delegatorMerkleRoot = delegator?.merkleRoot || null;

  for (const w of COMPANY.wallets) {
    const voterClaim = voter ? findCaseInsensitiveClaim(voter.claims, w.address) : null;
    const delegatorClaim = delegator ? findCaseInsensitiveClaim(delegator.claims, w.address) : null;
    out.wallets.push({
      wallet: w.address,
      walletAlias: w.alias,
      voterMerkle: voterClaim ? {
        present: true,
        tokens: Object.fromEntries(Object.entries(voterClaim.claim?.tokens || {}).map(([token, x]) => [
          getAddress(token), { amountRaw: String(x.amount || '0'), proofLength: Array.isArray(x.proof) ? x.proof.length : 0 }
        ]))
      } : { present: false, tokens: {} },
      delegatorMerkle: delegatorClaim ? {
        present: true,
        tokens: Object.fromEntries(Object.entries(delegatorClaim.claim?.tokens || {}).map(([token, x]) => [
          getAddress(token), { amountRaw: String(x.amount || '0'), proofLength: Array.isArray(x.proof) ? x.proof.length : 0 }
        ]))
      } : { present: false, tokens: {} }
    });
  }

  out.status = voter || delegator ? 'entitlement-discovery-ok-claimed-state-pending' : 'unavailable';
  out.errors = errors;
  return out;
}

function selectedDirectRowsByFamily(directRows, family) {
  return (directRows || []).filter(x => x.family === family);
}

function buildCompanyBook({ direct, aave, curve, yieldBasis, aerodrome, convex }) {
  const directRows = direct.rows || [];
  const aaveRows = aave.rows || [];
  const curveRows = curve.rows || [];

  const btcDirect = sum(selectedDirectRowsByFamily(directRows, 'BTC').map(x => x.amount));
  const ethDirect = sum(selectedDirectRowsByFamily(directRows, 'ETH').map(x => x.amount));
  const btcAave = sum(aaveRows.filter(x => x.family === 'BTC').map(x => x.amount));
  const ethAave = sum(aaveRows.filter(x => x.family === 'ETH').map(x => x.amount));
  const btcCurve = sum(curveRows.filter(x => x.family === 'BTC').map(x => x.amount));
  const ethCurve = sum(curveRows.filter(x => x.family === 'ETH').map(x => x.amount));
  const btcYb = Number(yieldBasis?.underlyingTotals?.BTC || 0);
  const ethYb = Number(yieldBasis?.underlyingTotals?.ETH || 0);

  const directBySymbol = symbol => sum(
    directRows.filter(x => String(x.symbol).toUpperCase() === symbol).map(x => x.amount)
  );

  const quantities = {
    BTC: btcDirect + btcAave + btcCurve + btcYb,
    ETH: ethDirect + ethAave + ethCurve + ethYb,
    AERO: Number(aerodrome?.totalAEROExposure || directBySymbol('AERO') || 0),
    CVX: Number(convex?.totalCVXExposure || directBySymbol('CVX') || 0),
    CRV: directBySymbol('CRV'),
    LINK: directBySymbol('LINK'),
    ZK: directBySymbol('ZK')
  };

  const productive = {
    BTC: btcYb,
    ETH: ethYb,
    AERO: Number(aerodrome?.productiveAEROExposure || 0),
    CVX: Number(convex?.productiveCVXExposure || 0),
    CRV: 0,
    LINK: 0,
    ZK: 0
  };

  const breakdown = {
    BTC: {
      liquidOrWallet: round(btcDirect),
      aaveCollateralOrSupply: round(btcAave),
      curveLlammaCollateral: round(btcCurve),
      yieldBasisProductive: round(btcYb)
    },
    ETH: {
      liquidOrWallet: round(ethDirect),
      aaveCollateralOrSupply: round(ethAave),
      curveLlammaCollateral: round(ethCurve),
      yieldBasisProductive: round(ethYb)
    },
    AERO: {
      free: round(Number(aerodrome?.freeAERO || 0)),
      productiveVe: round(Number(aerodrome?.economicVeAERO || 0))
    },
    CVX: {
      free: round(Number(convex?.freeCVX || 0)),
      productiveLocked: round(Number(convex?.lockedCVX || 0))
    }
  };

  return ['BTC', 'ETH', 'AERO', 'CVX', 'CRV', 'LINK', 'ZK'].map(symbol => ({
    symbol,
    quantity: round(quantities[symbol]),
    entryUsd: ENTRY[symbol],
    costBasisUsd: round(quantities[symbol] * ENTRY[symbol], 6),
    productiveQuantity: round(productive[symbol]),
    nonProductiveQuantity: round(Math.max(0, quantities[symbol] - productive[symbol])),
    selectedForPublicBalance: true,
    ...(breakdown[symbol] ? { internalBreakdown: breakdown[symbol] } : {})
  }));
}

async function main() {
  const startedAt = new Date().toISOString();

  const [
    direct,
    aave,
    aerodrome,
    convex,
    curve,
    yieldBasis,
    stakeDaoVlCvx
  ] = await Promise.all([
    discoverDirectSelectedBalances(),
    discoverAave(),
    discoverAerodrome(),
    discoverConvex(),
    discoverCurveLlamma(),
    discoverYieldBasis(),
    discoverStakeDaoVlCvxCurrentMerkles()
  ]);

  const companyBook = buildCompanyBook({
    direct, aave, curve, yieldBasis, aerodrome, convex
  });

  const ignoredLiabilities = [
    ...(aave.ignoredLiabilities || []),
    ...(curve.ignoredLiabilities || [])
  ];

  const errors = {
    direct: direct.diagnostics || [],
    aave: aave.diagnostics || [],
    aerodrome: aerodrome?.diagnostics || [],
    convex: convex?.diagnostics || [],
    curve: curve.diagnostics || [],
    yieldBasis: yieldBasis?.diagnostics || [],
    votium: stakeDaoVlCvx?.errors || []
  };

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    purpose: 'bounded current-state fingerprint for Company #007; no historical archaeology',
    company: {
      registry: COMPANY.registry,
      name: COMPANY.name,
      foundedAt: COMPANY.foundedAt,
      founding: {
        date: COMPANY.foundedAt,
        method: COMPANY.foundingMethod,
        confidence: COMPANY.foundingConfidence,
        note: 'Owner-declared founding date; intentionally not replaced by wallet or position history.'
      },
      wallets: COMPANY.wallets
    },
    accountingPolicy: {
      selectedPublicAssets: Object.keys(ENTRY),
      fixedEntryPricesUsd: ENTRY,
      grossSelectedAssetBalance: true,
      liabilitiesTreatment: 'diagnostic only; borrowed loans are not subtracted from public gross selected-asset balance',
      btcEthAggregation: 'one public BTC row and one public ETH row across direct canonical wrappers, selected Aave/Curve collateral, and Yield Basis productive underlying',
      aaveCurveCollateralProductivity: 'excluded from #007 Reference APR by owner accounting convention',
      yieldBasisProductivity: 'included; current underlying redemption is part of BTC/ETH public quantity and only this BTC/ETH slice enters Reference APR'
    },
    discovery: {
      directSelectedBalances: direct,
      aave,
      aerodrome,
      convex,
      curveLlamma: curve,
      yieldBasis,
      votiumVlCvx: stakeDaoVlCvx
    },
    proposedCompanyBook: companyBook,
    ignoredLiabilities,
    adapterPlan: {
      productivity: {
        aerodrome: 'reuse existing Aerodrome veAERO/Relay adapter after custody mode is confirmed',
        convex: 'reuse existing convex_vlcvx adapter',
        yieldBasisLp: 'NEW generic adapter required; distinguish unstaked PPS-growth vs staked YB-emissions and weight only actual productive underlying',
        btcEthCollateral: 'nonproductive for #007 by explicit accounting rule',
        crvLinkZk: 'nonproductive unless owner later specifies a productive mechanism'
      },
      rewards: {
        aerodrome: 'reuse existing bounded operational Aerodrome route matching discovered direct/managed custody',
        convexVotium: 'current Stake DAO vlCVX merkle entitlement discovery included; exact claimed-state must be solved before counting Accrued Rewards',
        yieldBasisLp: 'if gauge-staked, research current YB emission claimable path as new route; unstaked PPS growth belongs to position value/productivity, not Accrued Rewards token inventory'
      }
    },
    nextStep: {
      ifGreen: [
        'validate quantities and custody modes from this JSON',
        'isolate only truly unknown Yield Basis LP / Votium claimed-state mechanisms',
        'build reusable adapters',
        'build final fail-closed Company #007 Production Integrator'
      ],
      noHistoricalBackfill: true
    },
    errors
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`Company #007 discovery written: ${OUTPUT}`);
  console.log(`Version: ${VERSION}`);
  console.log(`Company Book rows: ${companyBook.length}`);
  for (const row of companyBook) {
    console.log(`${row.symbol}: ${row.quantity} | productive ${row.productiveQuantity} | entry $${row.entryUsd}`);
  }
  if (ignoredLiabilities.length) {
    console.log(`Ignored liabilities (diagnostic only): ${ignoredLiabilities.length}`);
  }
}

main().catch(err => {
  console.error(`Company #007 discovery failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
