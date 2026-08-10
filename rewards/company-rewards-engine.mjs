import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const VERSION = '0.1';
const COLLECTOR_VERSION = '0.1-protocol-accrual';
const METHODOLOGY_VERSION = '0.1-earned-inside-protocols';
const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const CG_KEY = process.env.COINGECKO_API_KEY || '';
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = new Date().toISOString();

const RPC = {
  ethereum: [
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com'
  ],
  base: [
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ],
  fraxtal: [
    'https://rpc.frax.com'
  ]
};

const ADDR = {
  aerodrome: {
    aero: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    votingEscrow: '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4'
  },
  curve: {
    crvUsdFeeDistributor: '0xD16d5eC345Dd86Fb63C6a9C43c517210F1027914',
    crvUsd: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E'
  },
  frax: {
    yieldDistributor: '0x21359d1697e610e25C8229B2C57907378eD09A2E'
  },
  yieldBasis: {
    feeDistributor: '0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90',
    factory: '0x370a449FeBb9411c95bf897021377fe0B7D100c0'
  }
};

const COMPANIES = [
  {
    name: '05081966.eth',
    ens: '05081966.eth',
    fallbackAddress: '0x7CdF49f589038242e77847573604441E383f5429',
    routes: ['aerodrome-relay', 'curve-fees', 'frax-yield']
  },
  {
    name: 'YieldRing.eth',
    ens: 'yieldring.eth',
    fallbackAddress: null,
    routes: ['aerodrome-relay', 'frax-yield', 'votium-union']
  },
  {
    name: 'dinaz.eth',
    ens: 'dinaz.eth',
    fallbackAddress: '0xcA2Ea0ef8eF6937e01EB9c72AEcaC24Dd1Ea7cEc',
    routes: ['yield-basis-fees']
  }
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];
const AERO_VE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerToNFTokenIdList(address owner, uint256 index) view returns (uint256)',
  'function idToManaged(uint256 tokenId) view returns (uint256)',
  'function managedToLocked(uint256 managedTokenId) view returns (address)'
];
const MANAGED_REWARD_ABI = [
  'function earned(address token, uint256 tokenId) view returns (uint256)'
];
const CURVE_FEE_DISTRIBUTOR_ABI = [
  'function claim(address _addr) returns (uint256)'
];
const FRAX_YIELD_DISTRIBUTOR_ABI = [
  'function earned(address _account) view returns (uint256)',
  'function emittedTokenAddress() view returns (address)'
];
const YB_FEE_DISTRIBUTOR_ABI = [
  'function preview_claim(address receiver, uint256 epoch_count, bool use_vest) returns (address[] tokens, uint256[] amounts)'
];
const YB_FACTORY_ABI = [
  'function market_count() view returns (uint256)',
  'function markets(uint256 i) view returns (address asset_token, address cryptopool, address amm, address lt, address price_oracle, address virtual_pool, address staker)'
];
const YB_LT_ABI = [
  'function preview_withdraw(uint256 shares) view returns (uint256)'
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const n = x => Number(x);
const round = (x, digits = 8) => Number.isFinite(Number(x)) ? Number(Number(x).toFixed(digits)) : null;

function readPrevious() {
  try {
    const v = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

async function providerFrom(urls, label) {
  let last;
  for (const url of urls) {
    try {
      const p = new JsonRpcProvider(url);
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} RPC timeout`)), 9000))
      ]);
      p.__holdingRpc = url;
      return p;
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error(`No ${label} RPC available`);
}

async function tokenMeta(provider, address) {
  const c = new Contract(address, ERC20_ABI, provider);
  let symbol = 'TOKEN', decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  return { address: getAddress(address), symbol, decimals };
}

async function resolveCompany(ethProvider, company) {
  let resolved = null;
  try { resolved = await ethProvider.resolveName(company.ens.toLowerCase()); } catch {}
  if (resolved) {
    return {
      address: getAddress(resolved),
      resolution: 'ens',
      ens: company.ens,
      fallbackMatched: company.fallbackAddress ? getAddress(resolved) === getAddress(company.fallbackAddress) : null
    };
  }
  if (company.fallbackAddress) {
    return {
      address: getAddress(company.fallbackAddress),
      resolution: 'fallback',
      ens: company.ens,
      fallbackMatched: null
    };
  }
  throw new Error(`Could not resolve ${company.ens}`);
}

function rewardBase({ protocol, route, chain, token, amountRaw, decimals, amount, classification, source, details = {} }) {
  return {
    protocol,
    route,
    chain,
    token: getAddress(token),
    symbol: details.displaySymbol || details.symbol || 'TOKEN',
    amountRaw: String(amountRaw),
    decimals,
    amount: round(amount, 10),
    classification,
    source,
    usdValue: null,
    priceUsd: null,
    priceMethod: null,
    details
  };
}

async function collectAerodrome(address, baseProvider) {
  const ve = new Contract(ADDR.aerodrome.votingEscrow, AERO_VE_ABI, baseProvider);
  const nftCount = Number(await ve.balanceOf(address));
  let total = 0n;
  const positions = [];

  for (let i = 0; i < nftCount; i++) {
    const tokenId = await ve.ownerToNFTokenIdList(address, i);
    let managedId = 0n;
    try { managedId = await ve.idToManaged(tokenId); } catch {}
    if (managedId === 0n) continue;

    let rewardContract = ZeroAddress;
    try { rewardContract = await ve.managedToLocked(managedId); } catch {}
    if (!rewardContract || rewardContract === ZeroAddress) continue;

    const r = new Contract(rewardContract, MANAGED_REWARD_ABI, baseProvider);
    const earned = await r.earned(ADDR.aerodrome.aero, tokenId);
    total += earned;
    positions.push({
      tokenId: tokenId.toString(),
      managedTokenId: managedId.toString(),
      lockedManagedReward: getAddress(rewardContract),
      accruedAeroRaw: earned.toString()
    });
  }

  const amount = n(formatUnits(total, 18));
  return {
    source: {
      protocol: 'Aerodrome', route: 'aerodrome-relay', status: 'ok',
      chain: 'Base', metric: 'LockedManagedReward.earned(AERO, veNFT)',
      note: 'Relay-compounded AERO remains locked inside the managed veNFT until withdrawal.'
    },
    rewards: total > 0n ? [rewardBase({
      protocol: 'Aerodrome', route: 'aerodrome-relay', chain: 'Base',
      token: ADDR.aerodrome.aero, amountRaw: total, decimals: 18, amount,
      classification: 'compounded-locked',
      source: 'onchain: LockedManagedReward.earned',
      details: { symbol: 'AERO', veNfts: positions, coingeckoId: 'aerodrome-finance' }
    })] : [],
    details: { veNftCount: nftCount, managedPositions: positions.length }
  };
}

async function collectCurve(address, ethProvider) {
  const fd = new Contract(ADDR.curve.crvUsdFeeDistributor, CURVE_FEE_DISTRIBUTOR_ABI, ethProvider);
  const raw = await fd.claim.staticCall(address);
  const amount = n(formatUnits(raw, 18));
  return {
    source: {
      protocol: 'Curve', route: 'curve-fees', status: 'ok', chain: 'Ethereum',
      metric: 'crvUSD FeeDistributor claim simulation'
    },
    rewards: raw > 0n ? [rewardBase({
      protocol: 'Curve', route: 'curve-fees', chain: 'Ethereum',
      token: ADDR.curve.crvUsd, amountRaw: raw, decimals: 18, amount,
      classification: 'unclaimed', source: 'onchain: FeeDistributor.claim staticCall',
      details: { symbol: 'crvUSD', fixedUsdPrice: 1 }
    })] : []
  };
}

async function collectFrax(address, fraxtalProvider) {
  const yd = new Contract(ADDR.frax.yieldDistributor, FRAX_YIELD_DISTRIBUTOR_ABI, fraxtalProvider);
  const [raw, emitted] = await Promise.all([
    yd.earned(address),
    yd.emittedTokenAddress()
  ]);
  const meta = await tokenMeta(fraxtalProvider, emitted);
  const amount = n(formatUnits(raw, meta.decimals));
  const cgId = /^(FRAX|FXS)$/i.test(meta.symbol) ? 'frax-share' : null;
  return {
    source: {
      protocol: 'Frax', route: 'frax-yield', status: 'ok', chain: 'Fraxtal',
      metric: 'YieldDistributor.earned(account)'
    },
    rewards: raw > 0n ? [rewardBase({
      protocol: 'Frax', route: 'frax-yield', chain: 'Fraxtal',
      token: emitted, amountRaw: raw, decimals: meta.decimals, amount,
      classification: 'unclaimed', source: 'onchain: YieldDistributor.earned',
      details: { symbol: meta.symbol, coingeckoId: cgId, emittedToken: getAddress(emitted) }
    })] : []
  };
}

async function discoverYieldBasisMarkets(ethProvider) {
  const factory = new Contract(ADDR.yieldBasis.factory, YB_FACTORY_ABI, ethProvider);
  const count = Number(await factory.market_count());
  const byLt = new Map();
  for (let i = 0; i < count; i++) {
    try {
      const m = await factory.markets(i);
      const asset = getAddress(m.asset_token ?? m[0]);
      const lt = getAddress(m.lt ?? m[3]);
      byLt.set(lt.toLowerCase(), { index: i, asset, lt });
    } catch {}
  }
  return byLt;
}

async function collectYieldBasis(address, ethProvider) {
  const fd = new Contract(ADDR.yieldBasis.feeDistributor, YB_FEE_DISTRIBUTOR_ABI, ethProvider);
  const [tokens, amounts] = await fd.preview_claim.staticCall(address, 50, false);
  const markets = await discoverYieldBasisMarkets(ethProvider);
  const rewards = [];

  for (let i = 0; i < tokens.length; i++) {
    const raw = amounts[i];
    if (raw === 0n) continue;
    const token = getAddress(tokens[i]);
    const meta = await tokenMeta(ethProvider, token);
    const amount = n(formatUnits(raw, meta.decimals));
    const market = markets.get(token.toLowerCase());
    const details = { symbol: meta.symbol };

    if (market) {
      const assetMeta = await tokenMeta(ethProvider, market.asset);
      const lt = new Contract(token, YB_LT_ABI, ethProvider);
      let redemptionRaw = null;
      try { redemptionRaw = await lt.preview_withdraw(raw); } catch {}
      if (redemptionRaw !== null) {
        details.redeemAsset = market.asset;
        details.redeemSymbol = assetMeta.symbol;
        details.redeemDecimals = assetMeta.decimals;
        details.redeemAmountRaw = redemptionRaw.toString();
        details.redeemAmount = round(n(formatUnits(redemptionRaw, assetMeta.decimals)), 12);
        details.priceByEthereumContract = market.asset;
        details.marketIndex = market.index;
      }
    }

    rewards.push(rewardBase({
      protocol: 'Yield Basis', route: 'yield-basis-fees', chain: 'Ethereum',
      token, amountRaw: raw, decimals: meta.decimals, amount,
      classification: 'unclaimed', source: 'onchain: FeeDistributor.preview_claim', details
    }));
  }

  return {
    source: {
      protocol: 'Yield Basis', route: 'yield-basis-fees', status: 'ok', chain: 'Ethereum',
      metric: 'FeeDistributor.preview_claim(receiver, 50, false)'
    },
    rewards
  };
}

function unionPendingSource() {
  return {
    source: {
      protocol: 'Convex / Votium / The Union',
      route: 'votium-union',
      status: 'warming',
      chain: 'Ethereum',
      metric: null,
      note: 'Union forwards and consolidates Votium rewards, but its per-member accounting implementation is not exposed in the public frontend repository. Excluded until a reproducible member-level read path is validated.'
    },
    rewards: []
  };
}

async function fetchJson(url, headers = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function applyPrices(rewards) {
  const headers = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {};
  const ids = [...new Set(rewards.map(r => r.details?.coingeckoId).filter(Boolean))];
  const ethContracts = [...new Set(rewards.map(r => r.details?.priceByEthereumContract).filter(Boolean).map(a => a.toLowerCase()))];
  const idPrices = {};
  const ethPrices = {};

  if (ids.length) {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(ids.join(',')) + '&vs_currencies=usd';
      const data = await fetchJson(url, headers);
      ids.forEach(id => { if (Number.isFinite(Number(data?.[id]?.usd))) idPrices[id] = Number(data[id].usd); });
    } catch (e) {
      console.warn('CoinGecko id pricing failed:', e.message);
    }
  }

  if (ethContracts.length) {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=' + encodeURIComponent(ethContracts.join(',')) + '&vs_currencies=usd';
      const data = await fetchJson(url, headers);
      ethContracts.forEach(a => { if (Number.isFinite(Number(data?.[a]?.usd))) ethPrices[a] = Number(data[a].usd); });
    } catch (e) {
      console.warn('CoinGecko contract pricing failed:', e.message);
    }
  }

  for (const r of rewards) {
    const fixed = r.details?.fixedUsdPrice;
    const cgId = r.details?.coingeckoId;
    const asset = r.details?.priceByEthereumContract?.toLowerCase();
    if (Number.isFinite(Number(fixed))) {
      r.priceUsd = Number(fixed);
      r.usdValue = round(r.amount * r.priceUsd, 6);
      r.priceMethod = 'fixed-usd-assumption';
    } else if (cgId && Number.isFinite(idPrices[cgId])) {
      r.priceUsd = idPrices[cgId];
      r.usdValue = round(r.amount * r.priceUsd, 6);
      r.priceMethod = `coingecko:${cgId}`;
    } else if (asset && Number.isFinite(ethPrices[asset]) && Number.isFinite(Number(r.details?.redeemAmount))) {
      r.priceUsd = ethPrices[asset];
      r.usdValue = round(Number(r.details.redeemAmount) * r.priceUsd, 6);
      r.priceMethod = `redemption-value:${r.details.redeemSymbol || 'asset'}@coingecko-contract`;
    }
  }
}

function aggregateTokenSummary(rewards) {
  const m = new Map();
  for (const r of rewards) {
    const key = `${r.symbol}|${r.token}`;
    if (!m.has(key)) m.set(key, { symbol: r.symbol, token: r.token, amount: 0, usdValue: 0, usdComplete: true });
    const x = m.get(key);
    x.amount += Number(r.amount || 0);
    if (Number.isFinite(Number(r.usdValue))) x.usdValue += Number(r.usdValue);
    else x.usdComplete = false;
  }
  return [...m.values()].map(x => ({
    symbol: x.symbol,
    token: x.token,
    amount: round(x.amount, 10),
    usdValue: x.usdComplete ? round(x.usdValue, 6) : null
  }));
}

async function collectRoute(route, address, providers) {
  switch (route) {
    case 'aerodrome-relay': return await collectAerodrome(address, providers.base);
    case 'curve-fees': return await collectCurve(address, providers.ethereum);
    case 'frax-yield': return await collectFrax(address, providers.fraxtal);
    case 'yield-basis-fees': return await collectYieldBasis(address, providers.ethereum);
    case 'votium-union': return unionPendingSource();
    default: throw new Error(`Unknown route ${route}`);
  }
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const previous = readPrevious();

  const providers = {
    ethereum: await providerFrom(RPC.ethereum, 'Ethereum'),
    base: await providerFrom(RPC.base, 'Base'),
    fraxtal: await providerFrom(RPC.fraxtal, 'Fraxtal')
  };

  const companies = {};
  const engineErrors = {};

  for (const c of COMPANIES) {
    let identity;
    try {
      identity = await resolveCompany(providers.ethereum, c);
    } catch (e) {
      companies[c.name] = {
        status: 'warming', ens: c.ens, address: null, resolution: null,
        totalUsd: null, rewards: [], rewardTokens: [], sources: [],
        reason: e.message, updatedAt: NOW
      };
      engineErrors[`${c.name}:ens`] = e.message;
      continue;
    }

    const rewards = [];
    const sources = [];
    for (const route of c.routes) {
      try {
        const out = await collectRoute(route, identity.address, providers);
        sources.push(out.source);
        rewards.push(...(out.rewards || []));
      } catch (e) {
        console.warn(`${c.name} ${route}:`, e.message);
        sources.push({ protocol: route, route, status: 'error', metric: null, note: e.message });
        engineErrors[`${c.name}:${route}`] = e.message;
      }
      await sleep(80);
    }

    await applyPrices(rewards);
    const measuredSources = sources.filter(s => s.status === 'ok').length;
    const routeCount = c.routes.length;
    const pendingSources = sources.filter(s => s.status !== 'ok').length;
    const unpriced = rewards.filter(r => !Number.isFinite(Number(r.usdValue))).length;
    const totalUsd = rewards.reduce((s, r) => s + (Number.isFinite(Number(r.usdValue)) ? Number(r.usdValue) : 0), 0);
    const status = measuredSources === routeCount && unpriced === 0 ? 'ok' : measuredSources > 0 ? 'partial' : 'warming';

    companies[c.name] = {
      status,
      ens: c.ens,
      address: identity.address,
      resolution: identity.resolution,
      fallbackMatched: identity.fallbackMatched,
      totalUsd: round(totalUsd, 6),
      totalUsdIsComplete: status === 'ok',
      routeCoverage: routeCount ? round(measuredSources / routeCount, 6) : 0,
      measuredRoutes: measuredSources,
      routeCount,
      pendingRoutes: pendingSources,
      unpricedRewards: unpriced,
      rewards,
      rewardTokens: aggregateTokenSummary(rewards),
      sources,
      updatedAt: NOW
    };
  }

  const history = Array.isArray(previous.history) ? previous.history.slice() : [];
  const snapshot = {
    date: TODAY,
    generatedAt: NOW,
    companies: Object.fromEntries(Object.entries(companies).map(([name, c]) => [name, {
      status: c.status,
      totalUsd: c.totalUsd,
      totalUsdIsComplete: c.totalUsdIsComplete,
      rewardTokens: c.rewardTokens
    }]))
  };
  const filtered = history.filter(h => h && h.date !== TODAY);
  filtered.push(snapshot);
  const trimmedHistory = filtered.slice(-400);

  const output = {
    version: VERSION,
    collectorVersion: COLLECTOR_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    generatedAt: NOW,
    date: TODAY,
    scope: 'protocol-side accrued rewards for personal onchain companies',
    methodology: {
      definition: 'Rewards already earned by a company inside protocol contracts but not yet freely held in the company wallet.',
      aerodrome: 'Relay-compounded AERO read from LockedManagedReward.earned(AERO, veNFT). Classified as compounded-locked because it remains inside the managed veNFT until withdrawal.',
      curve: 'Claimable crvUSD simulated against the official FeeDistributor with eth_call/staticCall. No transaction is sent.',
      frax: 'Claimable emitted token read from Fraxtal YieldDistributor.earned(account); reward token is discovered from emittedTokenAddress().',
      yieldBasis: 'Claimable multi-token veYB admin fees read with FeeDistributor.preview_claim. yb-LP rewards are valued at current realistic redemption value via LT.preview_withdraw and the underlying asset USD price.',
      union: 'Votium/The Union is intentionally excluded from totals until a reproducible member-level read path is validated. The public Union implementation is private; no reward amount is guessed.',
      tvlTreatment: 'Accrued rewards are displayed separately and are not added to Company TVL in v0.1.'
    },
    rpc: {
      ethereum: providers.ethereum.__holdingRpc,
      base: providers.base.__holdingRpc,
      fraxtal: providers.fraxtal.__holdingRpc
    },
    companies,
    engineErrors,
    history: trimmedHistory
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`Company Rewards v${VERSION} written to ${OUTPUT}`);
  for (const [name, c] of Object.entries(companies)) {
    const suffix = c.totalUsdIsComplete ? '' : '+';
    console.log(`${name}: ${c.status} · $${Number(c.totalUsd || 0).toFixed(2)}${suffix} · ${c.rewardTokens.map(t => t.symbol).join(', ') || 'no accrued rewards'}`);
  }
  if (Object.keys(engineErrors).length) console.log('engineErrors:', engineErrors);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
