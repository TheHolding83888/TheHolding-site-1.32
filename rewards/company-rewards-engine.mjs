import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const VERSION = '0.2.6';
const COLLECTOR_VERSION = '0.2.6-defitea-votemarket-proof-votes';
const METHODOLOGY_VERSION = '0.2.2-earned-inside-protocols-multiwallet';
const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const CG_KEY = process.env.COINGECKO_API_KEY || '';
const TODAY = new Date().toISOString().slice(0, 10);
const NOW = new Date().toISOString();

const RPC = {
  ethereum: ['https://ethereum-rpc.publicnode.com', 'https://eth.llamarpc.com'],
  base: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
  optimism: ['https://optimism-rpc.publicnode.com', 'https://mainnet.optimism.io'],
  arbitrum: ['https://arbitrum-one-rpc.publicnode.com', 'https://arb1.arbitrum.io/rpc'],
  polygon: ['https://polygon-bor-rpc.publicnode.com', 'https://polygon-rpc.com'],
  bsc: ['https://bsc-rpc.publicnode.com', 'https://bsc-dataseed.binance.org'],
  fraxtal: ['https://rpc.frax.com']
};

const CHAIN_META = {
  1: { key: 'ethereum', name: 'Ethereum', platform: 'ethereum' },
  10: { key: 'optimism', name: 'Optimism', platform: 'optimistic-ethereum' },
  56: { key: 'bsc', name: 'BNB Chain', platform: 'binance-smart-chain' },
  137: { key: 'polygon', name: 'Polygon', platform: 'polygon-pos' },
  8453: { key: 'base', name: 'Base', platform: 'base' },
  42161: { key: 'arbitrum', name: 'Arbitrum', platform: 'arbitrum-one' }
};

const ADDR = {
  aerodrome: {
    baseToken: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
    votingEscrow: '0xeBf418Fe2512e7E6bd9b87a8F0f294aCDC67e6B4',
    rewardsDistributor: '0x227f65131A261548b057215bB1D5Ab2997964C7d',
    voter: '0x16613524e02ad97eDfeF371bC883F2F5d6C480A5'
  },
  velodrome: {
    baseToken: '0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',
    votingEscrow: '0xFAf8FD17D9840595845582fCB047DF13f006787d',
    rewardsDistributor: '0x9D4736EC60715e71aFe72973f7885DCBC21EA99b',
    voter: '0x41C914ee0c7E1A5edCD0295623e6dC557B5aBf3C'
  },
  fortyAcres: {
    // Official Optimism / Velodrome production deployments.
    // A 40 Acres PortfolioFactory stores owner => portfolio, so Defitea's
    // veVELO can be discovered even when the veNFT is no longer owned directly
    // by either Defitea EOA.
    velodromeRelayerFactory: '0xCe904f1C3c9Bdf74d4DBD6a204058D1eb649140B',
    velodromeUsdcLoanFactory: '0x8A71e4BaB42DDC3d996FA4b4780919567e367924'
  },
  curve: {
    crvUsdFeeDistributor: '0xD16d5eC345Dd86Fb63C6a9C43c517210F1027914',
    crvUsd: '0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E'
  },
  frax: { yieldDistributor: '0x21359d1697e610e25C8229B2C57907378eD09A2E' },
  yieldBasis: {
    feeDistributor: '0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90',
    factory: '0x370a449FeBb9411c95bf897021377fe0B7D100c0'
  },
  fx: {
    feeDistributors: [
      { label: 'stETH fees', address: '0x851AAEA3A2757D457E1Ce88C3808C1690213e432', fallbackToken: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84' },
      { label: 'wstETH fees', address: '0xd116513EEa4Efe3908212AfBAeFC76cb29245681', fallbackToken: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0' }
    ]
  },
  venice: {
    vvv: '0xacfE6019Ed1A7Dc6f7B508C02d1b04ec88cC21bf',
    staking: '0x321b7ff75154472B18EDb199033fF4D116F340Ff'
  },
  liquity: {
    staking: '0x4f9fbb3f1e99b56e0fe2892e623ed36a76fc605d',
    lusd: '0x5f98805a4e8be255a32880fdec7f6728c6568ba0'
  },
  resupply: {
    staker: '0x22222222E9fE38F6f1FC8C61b25228adB4D8B953'
  }
};

const VE_PROTOCOLS = {
  aerodrome: {
    protocol: 'Aerodrome', route: 'aerodrome-ve', chain: 'Base', providerKey: 'base',
    baseToken: ADDR.aerodrome.baseToken, baseSymbol: 'AERO', coingeckoId: 'aerodrome-finance',
    votingEscrow: ADDR.aerodrome.votingEscrow,
    rewardsDistributor: ADDR.aerodrome.rewardsDistributor,
    voter: ADDR.aerodrome.voter,
    incentiveGetter: 'gaugeToBribe'
  },
  velodrome: {
    protocol: 'Velodrome', route: 'velodrome-ve', chain: 'Optimism', providerKey: 'optimism',
    baseToken: ADDR.velodrome.baseToken, baseSymbol: 'VELO', coingeckoId: 'velodrome-finance',
    votingEscrow: ADDR.velodrome.votingEscrow,
    rewardsDistributor: ADDR.velodrome.rewardsDistributor,
    voter: ADDR.velodrome.voter,
    incentiveGetter: 'gaugeToIncentive'
  }
};

const COMPANIES = [
  {
    name: '05081966.eth',
    wallets: [{ alias: '05081966.eth', ens: '05081966.eth', fallbackAddress: '0x7CdF49f589038242e77847573604441E383f5429' }],
    routes: ['aerodrome-relay', 'curve-fees', 'frax-yield']
  },
  {
    name: 'YieldRing.eth',
    wallets: [{ alias: 'YieldRing.eth', ens: 'yieldring.eth', fallbackAddress: null }],
    routes: ['aerodrome-relay', 'frax-yield', 'votium-union']
  },
  {
    name: 'dinaz.eth',
    wallets: [{ alias: 'dinaz.eth', ens: 'dinaz.eth', fallbackAddress: '0xcA2Ea0ef8eF6937e01EB9c72AEcaC24Dd1Ea7cEc' }],
    routes: ['yield-basis-fees']
  },
  {
    name: 'defitea.eth',
    wallets: [
      { alias: 'defitea.eth', ens: 'defitea.eth', fallbackAddress: '0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3' },
      { alias: 'Defitea Operations', address: '0x6640C1AF0BF7e77fa223d4Af2F779e55dcFB8D2d' }
    ],
    routes: [
      'aerodrome-ve',
      'velodrome-ve',
      'votium-union',
      'curve-fees',
      'votemarket-vecrv',
      'pendle-spendle',
      'fx-fees',
      'votemarket-vefxn',
      'yield-basis-fees',
      'frax-yield',
      'venice-staking',
      'liquity-staking',
      'resupply-staking'
    ]
  }
];

const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];
const VE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function ownerToNFTokenIdList(address owner, uint256 index) view returns (uint256)',
  'function idToManaged(uint256 tokenId) view returns (uint256)',
  'function managedToLocked(uint256 managedTokenId) view returns (address)',
  'function managedToFree(uint256 managedTokenId) view returns (address)'
];
const VOTING_REWARD_ABI = [
  'function rewardsListLength() view returns (uint256)',
  'function rewards(uint256 index) view returns (address)',
  'function earned(address token, uint256 tokenId) view returns (uint256)'
];
const REWARDS_DISTRIBUTOR_ABI = ['function claimable(uint256 tokenId) view returns (uint256)'];
const VOTER_ABI = [
  'function poolVote(uint256 tokenId, uint256 index) view returns (address)',
  'function gauges(address pool) view returns (address)',
  'function gaugeToFees(address gauge) view returns (address)',
  'function gaugeToBribe(address gauge) view returns (address)',
  'function gaugeToIncentive(address gauge) view returns (address)'
];
const CURVE_FEE_DISTRIBUTOR_ABI = ['function claim(address _addr) returns (uint256)'];
const GENERIC_FEE_DISTRIBUTOR_ABI = [
  'function claim(address _addr) returns (uint256)',
  'function token() view returns (address)'
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
const YB_LT_ABI = ['function preview_withdraw(uint256 shares) view returns (uint256)'];
const VENICE_STAKING_ABI = ['function pendingRewards(address _user) view returns (uint256)'];
const LIQUITY_STAKING_ABI = [
  'function getPendingETHGain(address _user) view returns (uint256)',
  'function getPendingLUSDGain(address _user) view returns (uint256)'
];
const RESUPPLY_STAKER_ABI = [
  'function rewardTokensLength() view returns (uint256)',
  'function rewardTokens(uint256 index) view returns (address)',
  'function earned(address account, address rewardToken) view returns (uint256)'
];
const FORTY_ACRES_FACTORY_ABI = [
  'function portfolios(address owner) view returns (address)',
  'function portfolioOf(address owner) view returns (address)'
];
const FORTY_ACRES_PORTFOLIO_ABI = [
  'function getRewardsToken() view returns (address)'
];
const VOTEMARKET_ABI = [
  'function campaignById(uint256) view returns (uint256 chainId,address gauge,address manager,address rewardToken,uint8 numberOfPeriods,uint256 maxRewardPerVote,uint256 totalRewardAmount,uint256 totalDistributed,uint256 startTimestamp,uint256 endTimestamp,address hook)',
  'function CLAIM_WINDOW_LENGTH() view returns (uint256)',
  'function ORACLE() view returns (address)',
  'function fee() view returns (uint256)',
  'function customFeeByManager(address manager) view returns (uint256)',
  'function isClosedCampaign(uint256 campaignId) view returns (bool)',
  'function isProtected(address account) view returns (bool)',
  'function recipients(address account) view returns (address)',
  'function whitelistOnly(uint256 campaignId) view returns (bool)',
  'function getAddressesByCampaign(uint256 campaignId) view returns (address[])',
  'function periodByCampaignId(uint256 campaignId,uint256 epoch) view returns (uint256 rewardPerPeriod,uint256 rewardPerVote,uint256 leftover,bool updated)',
  'function totalClaimedByAccount(uint256 campaignId,uint256 epoch,address account) view returns (uint256)'
];
const VOTEMARKET_ORACLE_LENS_ABI = [
  'error STATE_NOT_UPDATED()',
  'function isVoteValid(address account,address gauge,uint256 epoch) view returns (bool)',
  'function getAccountVotes(address account,address gauge,uint256 epoch) view returns (uint256)'
];

const VOTEMARKET = {
  proofBase: 'https://raw.githubusercontent.com/stake-dao/api/main/api/votemarket',
  weekSeconds: 7 * 24 * 60 * 60,
  // 64 weeks covers Defitea's current operating lifetime and is intentionally
  // broader than the documented six-month post-campaign claim window.
  lookbackWeeks: 64,
  concurrency: 16,
  supportedChainIds: new Set([10, 137, 8453, 42161])
};

const voteMarketJsonCache = new Map();
const voteMarketContractCache = new Map();
const voteMarketTokenMetaCache = new Map();
const voteMarketClaimWindowCache = new Map();

const sleep = ms => new Promise(r => setTimeout(r, ms));
const n = x => Number(x);
const hasFiniteNumber = x => x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
const round = (x, digits = 8) => hasFiniteNumber(x) ? Number(Number(x).toFixed(digits)) : null;
const isAddressLike = x => typeof x === 'string' && /^0x[0-9a-fA-F]{40}$/.test(x);

const COINGECKO_IDS = {
  AERO: 'aerodrome-finance',
  VELO: 'velodrome-finance',
  VVV: 'venice-token',
  PENDLE: 'pendle',
  SPENDLE: 'pendle',
  WFRAX: 'wrapped-frax',
  FRAX: 'frax',
  FXS: 'frax',
  WBTC: 'wrapped-bitcoin',
  CBBTC: 'coinbase-wrapped-btc',
  TBTC: 'tbtc',
  ETH: 'ethereum',
  WETH: 'weth',
  STETH: 'staked-ether',
  WSTETH: 'wrapped-steth'
};

function readPrevious() {
  try {
    const v = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
    return v && typeof v === 'object' ? v : {};
  } catch { return {}; }
}

async function providerFrom(urls, label) {
  let last;
  for (const url of urls || []) {
    try {
      const p = new JsonRpcProvider(url);
      await Promise.race([
        p.getBlockNumber(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} RPC timeout`)), 9000))
      ]);
      p.__holdingRpc = url;
      return p;
    } catch (e) { last = e; }
  }
  throw last || new Error(`No ${label} RPC available`);
}

function createProviderRegistry() {
  const cache = new Map();
  return {
    async get(key) {
      if (cache.has(key)) return cache.get(key);
      const pending = providerFrom(RPC[key], key);
      cache.set(key, pending);
      try {
        const provider = await pending;
        cache.set(key, provider);
        return provider;
      } catch (e) {
        cache.delete(key);
        throw e;
      }
    },
    rpcSummary() {
      const out = {};
      for (const [k, v] of cache.entries()) {
        if (v && typeof v.then !== 'function' && v.__holdingRpc) out[k] = v.__holdingRpc;
      }
      return out;
    }
  };
}

async function tokenMeta(provider, address) {
  const a = getAddress(address);
  const c = new Contract(a, ERC20_ABI, provider);
  let symbol = 'TOKEN', decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  return { address: a, symbol, decimals };
}

async function resolveWallet(ethProvider, spec) {
  if (spec.address) {
    return { alias: spec.alias || 'Wallet', ens: spec.ens || null, address: getAddress(spec.address), resolution: 'address', fallbackMatched: null };
  }
  let resolved = null;
  if (spec.ens) {
    try { resolved = await ethProvider.resolveName(spec.ens.toLowerCase()); } catch {}
  }
  if (resolved) {
    return {
      alias: spec.alias || spec.ens,
      ens: spec.ens,
      address: getAddress(resolved),
      resolution: 'ens',
      fallbackMatched: spec.fallbackAddress ? getAddress(resolved) === getAddress(spec.fallbackAddress) : null
    };
  }
  if (spec.fallbackAddress) {
    return {
      alias: spec.alias || spec.ens || 'Wallet',
      ens: spec.ens || null,
      address: getAddress(spec.fallbackAddress),
      resolution: 'fallback',
      fallbackMatched: null
    };
  }
  throw new Error(`Could not resolve ${spec.ens || spec.alias || 'wallet'}`);
}

function normalizeToken(token) {
  if (typeof token === 'string' && token.startsWith('native:')) return token;
  return getAddress(token);
}

function rewardBase({ protocol, route, chain, token, amountRaw, decimals, amount, classification, source, details = {} }) {
  return {
    protocol,
    route,
    chain,
    token: normalizeToken(token),
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

function tagWalletRewards(rewards, wallet) {
  return (rewards || []).map(r => ({
    ...r,
    details: { ...(r.details || {}), wallet: wallet.address, walletAlias: wallet.alias }
  }));
}

async function enumerateRewardContract(rewardAddress, tokenId, provider, context) {
  const out = [];
  if (!rewardAddress || rewardAddress === ZeroAddress) return { rewards: out, issue: null };
  const c = new Contract(rewardAddress, VOTING_REWARD_ABI, provider);
  let count;
  try { count = Math.min(Number(await c.rewardsListLength()), 32); }
  catch (e) { return { rewards: out, issue: `Could not enumerate ${context}: ${e.shortMessage || e.message}` }; }

  for (let i = 0; i < count; i++) {
    try {
      const token = getAddress(await c.rewards(i));
      const raw = await c.earned(token, tokenId);
      if (raw === 0n) continue;
      const meta = await tokenMeta(provider, token);
      out.push(rewardBase({
        protocol: context.protocol,
        route: context.route,
        chain: context.chain,
        token,
        amountRaw: raw,
        decimals: meta.decimals,
        amount: n(formatUnits(raw, meta.decimals)),
        classification: 'unclaimed',
        source: `onchain: ${context.kind}.earned`,
        details: {
          symbol: meta.symbol,
          tokenId: tokenId.toString(),
          rewardContract: getAddress(rewardAddress),
          rewardKind: context.kind,
          pricePlatform: context.pricePlatform,
          priceContract: token,
          coingeckoId: COINGECKO_IDS[String(meta.symbol || '').toUpperCase()] || null
        }
      }));
    } catch (e) {
      return { rewards: out, issue: `Partial ${context.kind} enumeration: ${e.shortMessage || e.message}` };
    }
  }
  return { rewards: out, issue: null };
}

async function collectVeProtocol(address, registry, kind) {
  const cfg = VE_PROTOCOLS[kind];
  const provider = await registry.get(cfg.providerKey);
  const ve = new Contract(cfg.votingEscrow, VE_ABI, provider);
  const nftCount = Number(await ve.balanceOf(address));
  const rewards = [];
  const positions = [];
  const issues = [];
  let managedCount = 0, directCount = 0;

  for (let i = 0; i < nftCount; i++) {
    const tokenId = await ve.ownerToNFTokenIdList(address, i);
    let managedId = 0n;
    try { managedId = await ve.idToManaged(tokenId); } catch {}

    if (managedId > 0n) {
      managedCount++;
      let lockedReward = ZeroAddress, freeReward = ZeroAddress;
      try { lockedReward = await ve.managedToLocked(managedId); } catch (e) { issues.push(`managedToLocked(${tokenId}) failed`); }
      try { freeReward = await ve.managedToFree(managedId); } catch {}

      let lockedRaw = 0n;
      if (lockedReward && lockedReward !== ZeroAddress) {
        try {
          const c = new Contract(lockedReward, VOTING_REWARD_ABI, provider);
          lockedRaw = await c.earned(cfg.baseToken, tokenId);
          if (lockedRaw > 0n) {
            rewards.push(rewardBase({
              protocol: cfg.protocol, route: cfg.route, chain: cfg.chain,
              token: cfg.baseToken, amountRaw: lockedRaw, decimals: 18,
              amount: n(formatUnits(lockedRaw, 18)), classification: 'compounded-locked',
              source: 'onchain: LockedManagedReward.earned',
              details: {
                symbol: cfg.baseSymbol, tokenId: tokenId.toString(), managedTokenId: managedId.toString(),
                lockedManagedReward: getAddress(lockedReward), coingeckoId: cfg.coingeckoId
              }
            }));
          }
        } catch (e) { issues.push(`Locked managed reward ${tokenId}: ${e.shortMessage || e.message}`); }
      }

      if (freeReward && freeReward !== ZeroAddress) {
        const free = await enumerateRewardContract(freeReward, tokenId, provider, {
          protocol: cfg.protocol, route: cfg.route, chain: cfg.chain,
          pricePlatform: CHAIN_META[cfg.providerKey === 'base' ? 8453 : 10].platform,
          kind: 'FreeManagedReward'
        });
        rewards.push(...free.rewards);
        if (free.issue) issues.push(free.issue);
      }

      positions.push({ tokenId: tokenId.toString(), mode: 'managed', managedTokenId: managedId.toString(), lockedManagedReward: lockedReward, freeManagedReward: freeReward, accruedBaseRaw: lockedRaw.toString() });
      continue;
    }

    directCount++;
    const rd = new Contract(cfg.rewardsDistributor, REWARDS_DISTRIBUTOR_ABI, provider);
    try {
      const raw = await rd.claimable(tokenId);
      if (raw > 0n) {
        rewards.push(rewardBase({
          protocol: cfg.protocol, route: cfg.route, chain: cfg.chain,
          token: cfg.baseToken, amountRaw: raw, decimals: 18,
          amount: n(formatUnits(raw, 18)), classification: 'compounded-locked',
          source: 'onchain: RewardsDistributor.claimable',
          details: { symbol: cfg.baseSymbol, tokenId: tokenId.toString(), coingeckoId: cfg.coingeckoId, rewardKind: 'rebase' }
        }));
      }
    } catch (e) { issues.push(`RewardsDistributor claimable ${tokenId}: ${e.shortMessage || e.message}`); }

    const voter = new Contract(cfg.voter, VOTER_ABI, provider);
    const pools = [];
    for (let j = 0; j < 50; j++) {
      try {
        const pool = getAddress(await voter.poolVote(tokenId, j));
        if (!pool || pool === ZeroAddress) break;
        pools.push(pool);
      } catch { break; }
    }
    for (const pool of [...new Set(pools)]) {
      try {
        const gauge = getAddress(await voter.gauges(pool));
        if (!gauge || gauge === ZeroAddress) continue;
        let feeReward = ZeroAddress, incentiveReward = ZeroAddress;
        try { feeReward = getAddress(await voter.gaugeToFees(gauge)); } catch {}
        try {
          incentiveReward = getAddress(cfg.incentiveGetter === 'gaugeToBribe'
            ? await voter.gaugeToBribe(gauge)
            : await voter.gaugeToIncentive(gauge));
        } catch {}

        for (const [rewardAddress, rewardKind] of [[feeReward, 'FeesVotingReward'], [incentiveReward, 'IncentiveVotingReward']]) {
          const part = await enumerateRewardContract(rewardAddress, tokenId, provider, {
            protocol: cfg.protocol, route: cfg.route, chain: cfg.chain,
            pricePlatform: cfg.providerKey === 'base' ? 'base' : 'optimistic-ethereum', kind: rewardKind
          });
          rewards.push(...part.rewards);
          if (part.issue) issues.push(part.issue);
        }
      } catch (e) { issues.push(`Voter pool ${pool}: ${e.shortMessage || e.message}`); }
    }
    positions.push({ tokenId: tokenId.toString(), mode: 'direct', currentVotedPools: pools });
  }

  // Direct NFTs can retain old unclaimed voting rewards from pools that are no longer
  // in current poolVote(). Those historical pools cannot be exhaustively discovered
  // from a cheap current-state read, so direct mode is intentionally partial.
  const directCaveat = directCount > 0;
  const status = directCaveat || issues.length ? 'partial' : 'ok';
  return {
    source: {
      protocol: cfg.protocol, route: cfg.route, status, chain: cfg.chain,
      metric: 'veNFT current accrued rewards + managed compounding',
      note: directCaveat
        ? 'Current direct-vote pools are measured, but old no-longer-voted pools may still contain unclaimed rewards. Managed/Relay positions are measured directly.'
        : issues.length ? 'Managed position measured with one or more non-fatal reward-enumeration gaps.' : 'Managed/Relay rewards measured from current protocol state.',
      details: { veNftCount: nftCount, managedPositions: managedCount, directPositions: directCount, issues }
    },
    rewards,
    details: { veNftCount: nftCount, positions }
  };
}


async function fortyAcresPortfolioForOwner(provider, factoryAddress, owner) {
  const factory = new Contract(factoryAddress, FORTY_ACRES_FACTORY_ABI, provider);
  try {
    const portfolio = getAddress(await factory.portfolios(owner));
    return portfolio !== ZeroAddress ? portfolio : null;
  } catch {
    try {
      const portfolio = getAddress(await factory.portfolioOf(owner));
      return portfolio !== ZeroAddress ? portfolio : null;
    } catch {
      return null;
    }
  }
}

function withHolderContext(rewards, extra) {
  return (rewards || []).map(r => ({
    ...r,
    details: { ...(r.details || {}), ...extra }
  }));
}

// Defitea's veVELO can be operated through 40 Acres. The veNFT then belongs to
// a 40 Acres portfolio account rather than to the Defitea EOA itself.
// Discover the account from official PortfolioFactory state, then read the same
// Velodrome reward contracts at the actual veNFT holder.
async function collectDefiteaVelodrome(address, registry) {
  const provider = await registry.get('optimism');
  const direct = await collectVeProtocol(address, registry, 'velodrome');

  const candidates = [
    { kind: 'relayer', factory: ADDR.fortyAcres.velodromeRelayerFactory },
    { kind: 'usdc-loan', factory: ADDR.fortyAcres.velodromeUsdcLoanFactory }
  ];
  const portfolioAccounts = [];
  const rewards = withHolderContext(direct.rewards, {
    holderAddress: address,
    custodyContext: 'direct-wallet'
  });
  const positionDetails = [];
  const issues = [];
  let totalVeNfts = Number(direct.details?.veNftCount || 0);

  for (const candidate of candidates) {
    let portfolio = null;
    try {
      portfolio = await fortyAcresPortfolioForOwner(provider, candidate.factory, address);
    } catch (e) {
      issues.push(`40 Acres ${candidate.kind} factory: ${e.shortMessage || e.message}`);
      continue;
    }
    if (!portfolio) continue;
    if (portfolioAccounts.some(x => x.address.toLowerCase() === portfolio.toLowerCase())) continue;

    let payoutToken = null;
    let payoutSymbol = null;
    try {
      const pa = new Contract(portfolio, FORTY_ACRES_PORTFOLIO_ABI, provider);
      const token = getAddress(await pa.getRewardsToken());
      if (token !== ZeroAddress) {
        payoutToken = token;
        try { payoutSymbol = (await tokenMeta(provider, token)).symbol; } catch {}
      }
    } catch {}

    let out;
    try {
      out = await collectVeProtocol(portfolio, registry, 'velodrome');
    } catch (e) {
      issues.push(`40 Acres ${candidate.kind} portfolio ${portfolio}: ${e.shortMessage || e.message}`);
      portfolioAccounts.push({
        kind: candidate.kind,
        factory: candidate.factory,
        address: portfolio,
        payoutToken,
        payoutSymbol,
        veNftCount: null,
        status: 'error'
      });
      continue;
    }

    const count = Number(out.details?.veNftCount || 0);
    totalVeNfts += count;
    portfolioAccounts.push({
      kind: candidate.kind,
      factory: candidate.factory,
      address: portfolio,
      payoutToken,
      payoutSymbol,
      veNftCount: count,
      status: out.source?.status || 'error'
    });
    positionDetails.push(...(out.details?.positions || []).map(pos => ({
      ...pos,
      holderAddress: portfolio,
      custodyContext: '40acres',
      fortyAcresStrategy: candidate.kind
    })));
    rewards.push(...withHolderContext(out.rewards, {
      holderAddress: portfolio,
      custodyContext: '40acres',
      fortyAcresStrategy: candidate.kind,
      fortyAcresFactory: candidate.factory,
      fortyAcresPayoutToken: payoutToken,
      fortyAcresPayoutSymbol: payoutSymbol
    }));
    if (Array.isArray(out.source?.details?.issues)) issues.push(...out.source.details.issues);
  }

  const directCount = Number(direct.details?.veNftCount || 0);
  const fortyAcresCount = portfolioAccounts.reduce(
    (s, x) => s + (Number.isFinite(Number(x.veNftCount)) ? Number(x.veNftCount) : 0), 0
  );
  const foundExpectedPosition = totalVeNfts > 0;

  // Current protocol accrual is measurable. Historical no-longer-voted pools
  // are not exhaustively enumerable from a cheap current-state read, so keep
  // a 40 Acres/direct-vote route partial rather than overstating completeness.
  let status;
  if (!foundExpectedPosition) status = issues.length ? 'error' : 'warming';
  else status = 'partial';

  const payoutSymbols = [...new Set(portfolioAccounts.map(x => x.payoutSymbol).filter(Boolean))];

  return {
    source: {
      protocol: 'Velodrome',
      route: 'velodrome-ve',
      status,
      chain: 'Optimism',
      metric: 'Velodrome veNFT current accrual at direct + 40 Acres portfolio holder',
      note: foundExpectedPosition
        ? `Defitea veVELO position discovered${fortyAcresCount ? ' through 40 Acres' : ''}. Current unprocessed Velodrome rewards are measured at the actual veNFT holder.${payoutSymbols.length ? ` Configured 40 Acres payout token: ${payoutSymbols.join(', ')}.` : ''} Already distributed wallet payouts are not counted as accrued rewards.`
        : 'Expected Defitea veVELO position was not found at either Defitea wallet or the known 40 Acres Velodrome portfolio factories; route remains warming rather than reporting a false zero.',
      details: {
        directWalletVeNftCount: directCount,
        fortyAcresVeNftCount: fortyAcresCount,
        totalVeNftCount: totalVeNfts,
        fortyAcresPortfolios: portfolioAccounts,
        positions: [
          ...(direct.details?.positions || []).map(pos => ({ ...pos, holderAddress: address, custodyContext: 'direct-wallet' })),
          ...positionDetails
        ],
        issues
      }
    },
    rewards
  };
}

// Existing personal-company Aerodrome route remains intentionally identical in scope:
// only Relay/managed compounded AERO is part of this route.
async function collectAerodromeRelay(address, registry) {
  const provider = await registry.get('base');
  const ve = new Contract(ADDR.aerodrome.votingEscrow, VE_ABI, provider);
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
    const r = new Contract(rewardContract, VOTING_REWARD_ABI, provider);
    const earned = await r.earned(ADDR.aerodrome.baseToken, tokenId);
    total += earned;
    positions.push({ tokenId: tokenId.toString(), managedTokenId: managedId.toString(), lockedManagedReward: getAddress(rewardContract), accruedAeroRaw: earned.toString() });
  }
  return {
    source: { protocol: 'Aerodrome', route: 'aerodrome-relay', status: 'ok', chain: 'Base', metric: 'LockedManagedReward.earned(AERO, veNFT)', note: 'Relay-compounded AERO remains locked inside the managed veNFT until withdrawal.' },
    rewards: total > 0n ? [rewardBase({
      protocol: 'Aerodrome', route: 'aerodrome-relay', chain: 'Base', token: ADDR.aerodrome.baseToken,
      amountRaw: total, decimals: 18, amount: n(formatUnits(total, 18)), classification: 'compounded-locked',
      source: 'onchain: LockedManagedReward.earned', details: { symbol: 'AERO', veNfts: positions, coingeckoId: 'aerodrome-finance' }
    })] : [],
    details: { veNftCount: nftCount, managedPositions: positions.length }
  };
}

async function collectCurveBase(address, registry) {
  const provider = await registry.get('ethereum');
  const fd = new Contract(ADDR.curve.crvUsdFeeDistributor, CURVE_FEE_DISTRIBUTOR_ABI, provider);
  const raw = await fd.claim.staticCall(address);
  return {
    source: { protocol: 'Curve', route: 'curve-fees', status: 'ok', chain: 'Ethereum', metric: 'crvUSD FeeDistributor claim simulation' },
    rewards: raw > 0n ? [rewardBase({
      protocol: 'Curve', route: 'curve-fees', chain: 'Ethereum', token: ADDR.curve.crvUsd,
      amountRaw: raw, decimals: 18, amount: n(formatUnits(raw, 18)), classification: 'unclaimed',
      source: 'onchain: FeeDistributor.claim staticCall', details: { symbol: 'crvUSD', fixedUsdPrice: 1 }
    })] : []
  };
}

function voteMarketCurrentEpoch() {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.floor(nowSeconds / VOTEMARKET.weekSeconds) * VOTEMARKET.weekSeconds;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length || 1) }, () => worker()));
  return results;
}

async function fetchVoteMarketJson(url, timeoutMs = 6000) {
  if (voteMarketJsonCache.has(url)) return voteMarketJsonCache.get(url);
  const pending = (async () => {
    let last = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: controller.signal });
        if (res.status === 404) return { status: 'missing', data: null, error: null };
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { status: 'ok', data: await res.json(), error: null };
      } catch (e) {
        last = e;
        if (attempt === 0) await sleep(250);
      } finally {
        clearTimeout(timer);
      }
    }
    return { status: 'error', data: null, error: last?.message || 'VoteMarket proof fetch failed' };
  })();
  voteMarketJsonCache.set(url, pending);
  return pending;
}

function objectAddressEntry(obj, address) {
  if (!obj || typeof obj !== 'object') return null;
  const target = address.toLowerCase();
  for (const [k, v] of Object.entries(obj)) {
    if (String(k).toLowerCase() === target) return v;
  }
  return null;
}

function objectHasAddress(obj, address) {
  return objectAddressEntry(obj, address) !== null;
}

function safeJsonBigInt(value) {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  return null;
}

function reconstructVoteMarketAccountVote(voteData, epoch) {
  if (!voteData || typeof voteData !== 'object') return { ok:false, reason:'missing-vote-data' };
  const slope = safeJsonBigInt(voteData.slope);
  const end = safeJsonBigInt(voteData.end);
  const lastVote = safeJsonBigInt(voteData.last_vote ?? voteData.lastVote);
  const epochBn = BigInt(epoch);
  if (slope === null || end === null || lastVote === null) return { ok:false, reason:'unsafe-or-missing-vote-fields' };
  if (slope === 0n || epochBn >= end || epochBn <= lastVote) {
    return { ok:true, valid:false, accountVote:0n, slope, end, lastVote };
  }
  return { ok:true, valid:true, accountVote:slope * (end - epochBn), slope, end, lastVote };
}

function voteMarketPlatformContract(provider, chainId, platform) {
  const key = `${chainId}:${platform.toLowerCase()}`;
  if (!voteMarketContractCache.has(key)) {
    voteMarketContractCache.set(key, new Contract(getAddress(platform), VOTEMARKET_ABI, provider));
  }
  return voteMarketContractCache.get(key);
}

async function voteMarketTokenMeta(provider, chainId, token) {
  const key = `${chainId}:${token.toLowerCase()}`;
  if (!voteMarketTokenMetaCache.has(key)) {
    voteMarketTokenMetaCache.set(key, tokenMeta(provider, token));
  }
  return voteMarketTokenMetaCache.get(key);
}

async function voteMarketClaimWindow(vm, chainId, platform) {
  const key = `${chainId}:${platform.toLowerCase()}`;
  if (!voteMarketClaimWindowCache.has(key)) {
    voteMarketClaimWindowCache.set(key, vm.CLAIM_WINDOW_LENGTH());
  }
  return voteMarketClaimWindowCache.get(key);
}

function parseVoteMarketCampaignId(composite, platform) {
  const value = String(composite || '');
  const prefix = `${String(platform).toLowerCase()}-`;
  if (!value.toLowerCase().startsWith(prefix)) return null;
  const id = value.slice(prefix.length);
  return /^\d+$/.test(id) ? BigInt(id) : null;
}

function findVoteMarketCandidates(votesData, address) {
  const candidates = [];
  const platforms = votesData?.platforms;
  if (!platforms || typeof platforms !== 'object') return candidates;
  for (const [platform, chains] of Object.entries(platforms)) {
    if (!isAddressLike(platform) || !chains || typeof chains !== 'object') continue;
    for (const [chainIdRaw, chainData] of Object.entries(chains)) {
      const chainId = Number(chainIdRaw);
      if (!Number.isInteger(chainId) || !VOTEMARKET.supportedChainIds.has(chainId)) continue;
      const gauges = chainData?.gauges;
      if (!gauges || typeof gauges !== 'object') continue;
      for (const [gauge, gaugeData] of Object.entries(gauges)) {
        if (!isAddressLike(gauge)) continue;
        const voteData = objectAddressEntry(gaugeData?.users, address);
        if (voteData) {
          candidates.push({ platform: getAddress(platform), chainId, gauge: getAddress(gauge), voteData });
        }
      }
    }
  }
  return candidates;
}

async function collectVoteMarket(address, registry, protocolKey, route) {
  const isCurve = protocolKey === 'curve';
  const protocol = isCurve ? 'VoteMarket · veCRV' : 'VoteMarket · veFXN';
  const currentEpoch = voteMarketCurrentEpoch();
  const epochs = Array.from({ length: VOTEMARKET.lookbackWeeks }, (_, i) => currentEpoch - i * VOTEMARKET.weekSeconds);
  const issues = [];
  const diagnostics = [];
  const rewards = [];
  let votesFilesRead = 0;
  let votesFilesMissing = 0;
  let proofFilesRead = 0;
  let eligiblePeriods = 0;
  let alreadyClaimedPeriods = 0;
  let measuredUnclaimedPeriods = 0;
  let periodNotUpdatedCount = 0;
  let oracleInvalidCount = 0;
  let ineligibleByCampaignRulesCount = 0;

  const voteFiles = await mapLimit(epochs, VOTEMARKET.concurrency, async epoch => {
    const url = `${VOTEMARKET.proofBase}/${epoch}/${protocolKey}/votes.json`;
    const fetched = await fetchVoteMarketJson(url);
    return { epoch, url, ...fetched };
  });

  const candidatePeriods = [];
  for (const item of voteFiles) {
    if (item.status === 'missing') {
      votesFilesMissing++;
      continue;
    }
    if (item.status === 'error') {
      issues.push(`votes ${item.epoch}: ${item.error}`);
      continue;
    }
    votesFilesRead++;
    for (const candidate of findVoteMarketCandidates(item.data, address)) {
      candidatePeriods.push({ epoch: item.epoch, ...candidate });
    }
  }

  const uniqueCandidatePeriods = [...new Map(candidatePeriods.map(x => [
    `${x.epoch}:${x.chainId}:${x.platform.toLowerCase()}:${x.gauge.toLowerCase()}`, x
  ])).values()];

  for (const candidate of uniqueCandidatePeriods) {
    const chainMeta = CHAIN_META[candidate.chainId];
    if (!chainMeta) {
      issues.push(`unsupported chain ${candidate.chainId} for epoch ${candidate.epoch}`);
      continue;
    }
    const proofUrl = `${VOTEMARKET.proofBase}/${candidate.epoch}/${protocolKey}/${candidate.platform.toLowerCase()}/${candidate.chainId}/${candidate.gauge.toLowerCase()}.json`;
    const proof = await fetchVoteMarketJson(proofUrl);
    if (proof.status !== 'ok') {
      issues.push(`proof ${candidate.epoch}/${candidate.chainId}/${candidate.gauge}: ${proof.status === 'missing' ? 'HTTP 404' : proof.error}`);
      continue;
    }
    proofFilesRead++;
    if (!objectHasAddress(proof.data?.users, address)) {
      issues.push(`proof user mismatch ${candidate.epoch}/${candidate.chainId}/${candidate.gauge}`);
      continue;
    }

    const activeIds = Array.isArray(proof.data?.active_campaigns_ids) ? proof.data.active_campaigns_ids : [];
    if (!activeIds.length) {
      issues.push(`proof has no active_campaigns_ids ${candidate.epoch}/${candidate.chainId}/${candidate.gauge}`);
      continue;
    }

    const provider = await registry.get(chainMeta.key);
    const vm = voteMarketPlatformContract(provider, candidate.chainId, candidate.platform);

    for (const compositeId of activeIds) {
      const campaignId = parseVoteMarketCampaignId(compositeId, candidate.platform);
      if (campaignId === null) {
        issues.push(`invalid campaign id ${compositeId}`);
        continue;
      }
      const dedupeKey = `${candidate.chainId}:${candidate.platform.toLowerCase()}:${campaignId}:${candidate.epoch}`;
      if (diagnostics.some(x => x.dedupeKey === dedupeKey)) continue;
      eligiblePeriods++;

      const diag = {
        dedupeKey,
        epoch: candidate.epoch,
        chainId: candidate.chainId,
        chain: chainMeta.name,
        platform: candidate.platform,
        gaugeFromProof: candidate.gauge,
        campaignId: campaignId.toString(),
        proofUrl,
        claimedRaw: null,
        calculatedClaimRaw: null,
        status: 'checking'
      };
      diagnostics.push(diag);

      try {
        const campaign = await vm.campaignById(campaignId);
        const rewardToken = getAddress(campaign.rewardToken ?? campaign[3]);
        const campaignGauge = getAddress(campaign.gauge ?? campaign[1]);
        const campaignGaugeChainId = Number(campaign.chainId ?? campaign[0]);
        const startTimestamp = Number(campaign.startTimestamp ?? campaign[8]);
        const endTimestamp = Number(campaign.endTimestamp ?? campaign[9]);
        const hook = getAddress(campaign.hook ?? campaign[10]);
        diag.rewardToken = rewardToken;
        diag.campaignGauge = campaignGauge;
        diag.campaignGaugeChainId = campaignGaugeChainId;
        diag.startTimestamp = startTimestamp;
        diag.endTimestamp = endTimestamp;
        diag.hook = hook;

        if (campaignGauge.toLowerCase() !== candidate.gauge.toLowerCase()) {
          throw new Error(`campaign gauge mismatch ${campaignGauge} != ${candidate.gauge}`);
        }
        if (candidate.epoch < startTimestamp || candidate.epoch >= endTimestamp) {
          diag.status = 'outside-campaign-window';
          continue;
        }

        const [isClosed, claimWindowRaw] = await Promise.all([
          vm.isClosedCampaign(campaignId),
          voteMarketClaimWindow(vm, candidate.chainId, candidate.platform)
        ]);
        diag.isClosed = Boolean(isClosed);
        diag.claimWindowSeconds = Number(claimWindowRaw);
        if (isClosed) {
          diag.status = 'closed';
          continue;
        }
        if (Number.isFinite(endTimestamp) && Math.floor(Date.now() / 1000) > endTimestamp + Number(claimWindowRaw)) {
          diag.status = 'claim-window-expired';
          continue;
        }

        const claimedRaw = await vm.totalClaimedByAccount(campaignId, BigInt(candidate.epoch), address);
        diag.claimedRaw = claimedRaw.toString();
        if (claimedRaw > 0n) {
          alreadyClaimedPeriods++;
          diag.status = 'already-claimed';
          continue;
        }

        // Reproduce Votemarket._canClaim and _calculateClaimAndFee using view-only state.
        // This avoids eth_call of claim(), which can revert while trying to mutate an
        // uninitialised period or transfer the reward token even though the underlying
        // claim amount is fully derivable from public contract state.
        const [period, oracleAddress, defaultFee, customFee, protectedAccount, recipient, whitelistMode, listedAddresses] = await Promise.all([
          vm.periodByCampaignId(campaignId, BigInt(candidate.epoch)),
          vm.ORACLE(),
          vm.fee(),
          vm.customFeeByManager(campaign.manager ?? campaign[2]),
          vm.isProtected(address),
          vm.recipients(address),
          vm.whitelistOnly(campaignId),
          vm.getAddressesByCampaign(campaignId)
        ]);

        const rewardPerPeriod = BigInt(period.rewardPerPeriod ?? period[0]);
        const rewardPerVote = BigInt(period.rewardPerVote ?? period[1]);
        const leftover = BigInt(period.leftover ?? period[2]);
        const periodUpdated = Boolean(period.updated ?? period[3]);
        diag.periodUpdated = periodUpdated;
        diag.rewardPerPeriodRaw = rewardPerPeriod.toString();
        diag.rewardPerVoteRaw = rewardPerVote.toString();
        diag.leftoverRaw = leftover.toString();
        diag.oracle = getAddress(oracleAddress);
        diag.defaultFeeRaw = defaultFee.toString();
        diag.customFeeRaw = customFee.toString();
        diag.isProtected = Boolean(protectedAccount);
        diag.recipient = getAddress(recipient);
        diag.whitelistOnly = Boolean(whitelistMode);

        const listed = new Set((listedAddresses || []).map(x => String(x).toLowerCase()));
        const isListed = listed.has(address.toLowerCase());
        diag.isListed = isListed;
        if ((whitelistMode && !isListed) || (!whitelistMode && isListed)) {
          ineligibleByCampaignRulesCount++;
          diag.status = whitelistMode ? 'not-whitelisted' : 'blacklisted';
          continue;
        }
        if (protectedAccount && String(recipient).toLowerCase() === '0x0000000000000000000000000000000000000000') {
          ineligibleByCampaignRulesCount++;
          diag.status = 'protected-no-recipient';
          continue;
        }

        if (!periodUpdated) {
          periodNotUpdatedCount++;
          diag.status = 'period-not-updated';
          continue;
        }

        // The official Stake DAO proof generator publishes the raw vote fields
        // (last_vote, slope, power, end) in votes.json for every eligible user.
        // OracleLens.getAccountVotes uses exactly: slope * (end - epoch), with the
        // same validity guards. Reconstruct from those first-party fields so an
        // OracleLens STATE_NOT_UPDATED() does not hide an otherwise measurable
        // accrued entitlement. When the Lens is populated, cross-check it onchain.
        const reconstructedVote = reconstructVoteMarketAccountVote(candidate.voteData, candidate.epoch);
        if (!reconstructedVote.ok) {
          issues.push(`campaign ${campaignId} epoch ${candidate.epoch} chain ${candidate.chainId}: ${reconstructedVote.reason}`);
          diag.status = 'vote-data-incomplete';
          diag.voteData = candidate.voteData || null;
          continue;
        }
        diag.voteSource = 'official-votes-json';
        diag.voteSlopeRaw = reconstructedVote.slope.toString();
        diag.voteEnd = reconstructedVote.end.toString();
        diag.voteLastVote = reconstructedVote.lastVote.toString();
        diag.oracleVoteValid = reconstructedVote.valid;
        diag.accountVoteRaw = reconstructedVote.accountVote.toString();
        if (!reconstructedVote.valid) {
          oracleInvalidCount++;
          diag.status = 'published-vote-invalid';
          continue;
        }

        let accountVote = reconstructedVote.accountVote;
        const oracle = new Contract(getAddress(oracleAddress), VOTEMARKET_ORACLE_LENS_ABI, provider);
        try {
          const [voteValidOnchain, accountVoteOnchain] = await Promise.all([
            oracle.isVoteValid(address, campaignGauge, BigInt(candidate.epoch)),
            oracle.getAccountVotes(address, campaignGauge, BigInt(candidate.epoch))
          ]);
          diag.oracleState = 'populated';
          diag.oracleVoteValidOnchain = Boolean(voteValidOnchain);
          diag.accountVoteOnchainRaw = accountVoteOnchain.toString();
          if (!voteValidOnchain || BigInt(accountVoteOnchain) !== accountVote) {
            issues.push(`campaign ${campaignId} epoch ${candidate.epoch} chain ${candidate.chainId}: published vote/onchain OracleLens mismatch`);
            diag.status = 'oracle-vote-mismatch';
            continue;
          }
        } catch (oracleError) {
          // OracleLens intentionally reverts STATE_NOT_UPDATED when its per-user
          // state has not yet been populated. This does not invalidate the official
          // proof generator's raw vote record; preserve it as the reproducible source.
          diag.oracleState = 'not-populated-or-unavailable';
          diag.oracleReadError = oracleError?.shortMessage || oracleError?.message || String(oracleError);
        }

        const grossRaw = (accountVote * rewardPerVote) / 1000000000000000000n;
        const feeRateRaw = BigInt(customFee) > 0n ? BigInt(customFee) : BigInt(defaultFee);
        const feeRaw = (grossRaw * feeRateRaw) / 1000000000000000000n;
        const raw = grossRaw - feeRaw;
        diag.grossClaimRaw = grossRaw.toString();
        diag.feeRateRaw = feeRateRaw.toString();
        diag.feeRaw = feeRaw.toString();
        diag.calculatedClaimRaw = raw.toString();
        if (raw === 0n) {
          diag.status = 'zero-unclaimed';
          continue;
        }

        const meta = await voteMarketTokenMeta(provider, candidate.chainId, rewardToken);
        measuredUnclaimedPeriods++;
        diag.status = 'measured-unclaimed';
        diag.symbol = meta.symbol;
        diag.decimals = meta.decimals;

        rewards.push(rewardBase({
          protocol,
          route,
          chain: chainMeta.name,
          token: rewardToken,
          amountRaw: raw,
          decimals: meta.decimals,
          amount: n(formatUnits(raw, meta.decimals)),
          classification: 'unclaimed',
          source: 'official Stake DAO proof feed + VoteMarket claimed-state + published vote reconstruction',
          details: {
            symbol: meta.symbol,
            protocolKey,
            epoch: candidate.epoch,
            epochDate: new Date(candidate.epoch * 1000).toISOString().slice(0, 10),
            chainId: candidate.chainId,
            platform: candidate.platform,
            campaignId: campaignId.toString(),
            gauge: campaignGauge,
            gaugeChainId: campaignGaugeChainId,
            hook,
            proofUrl,
            claimedRaw: '0',
            periodUpdated: true,
            oracle: getAddress(oracleAddress),
            accountVoteRaw: accountVote.toString(),
            rewardPerVoteRaw: rewardPerVote.toString(),
            grossClaimRaw: grossRaw.toString(),
            feeRateRaw: feeRateRaw.toString(),
            feeRaw: feeRaw.toString(),
            calculation: 'accountVotes * rewardPerVote / 1e18, less Votemarket fee',
            pricePlatform: chainMeta.platform,
            priceContract: rewardToken,
            coingeckoId: COINGECKO_IDS[String(meta.symbol || '').toUpperCase()] || null
          }
        }));
      } catch (e) {
        diag.status = 'incomplete';
        diag.error = e.shortMessage || e.message;
        issues.push(`campaign ${campaignId} epoch ${candidate.epoch} chain ${candidate.chainId}: ${diag.error}`);
      }
    }
  }

  const hasMeasuredFeed = votesFilesRead > 0;
  const unresolvedPeriods = periodNotUpdatedCount;
  const status = !hasMeasuredFeed
    ? (issues.length ? 'warming' : 'ok')
    : (issues.length || unresolvedPeriods > 0) ? 'partial' : 'ok';
  const note = status === 'ok'
    ? `Official VoteMarket proofs, published raw vote details and onchain claimed-state were checked across ${VOTEMARKET.lookbackWeeks} weekly epochs; unclaimed amounts reproduce the OracleLens/Votemarket vote formula with onchain cross-check when the Lens state is populated.`
    : status === 'partial'
      ? 'Measured VoteMarket rewards are retained, but one or more proof/onchain checks were incomplete; uncertain amounts are excluded.'
      : 'VoteMarket proof/onchain measurement could not be completed; no amount is guessed.';

  return {
    source: {
      protocol,
      route,
      status,
      chain: 'Multi-chain',
      metric: 'Official VoteMarket proof eligibility + claimed-state + first-party vote reconstruction',
      note,
      details: {
        protocolKey,
        proofBase: VOTEMARKET.proofBase,
        lookbackWeeks: VOTEMARKET.lookbackWeeks,
        lookbackFromEpoch: epochs[epochs.length - 1],
        lookbackToEpoch: currentEpoch,
        votesFilesRead,
        votesFilesMissing,
        candidateGaugePeriods: uniqueCandidatePeriods.length,
        proofFilesRead,
        eligiblePeriods,
        alreadyClaimedPeriods,
        measuredUnclaimedPeriods,
        periodNotUpdatedCount,
        unresolvedPeriods,
        oracleInvalidCount,
        ineligibleByCampaignRulesCount,
        amountIncludedInTotal: true,
        issues,
        diagnostics: diagnostics.map(({ dedupeKey, ...x }) => x)
      }
    },
    rewards
  };
}

async function collectFrax(address, registry) {
  const provider = await registry.get('fraxtal');
  const yd = new Contract(ADDR.frax.yieldDistributor, FRAX_YIELD_DISTRIBUTOR_ABI, provider);
  const [raw, emitted] = await Promise.all([yd.earned(address), yd.emittedTokenAddress()]);
  const meta = await tokenMeta(provider, emitted);
  const cgId = COINGECKO_IDS[String(meta.symbol || '').toUpperCase()] || null;
  return {
    source: { protocol: 'Frax', route: 'frax-yield', status: 'ok', chain: 'Fraxtal', metric: 'YieldDistributor.earned(account)' },
    rewards: raw > 0n ? [rewardBase({
      protocol: 'Frax', route: 'frax-yield', chain: 'Fraxtal', token: emitted,
      amountRaw: raw, decimals: meta.decimals, amount: n(formatUnits(raw, meta.decimals)), classification: 'unclaimed',
      source: 'onchain: YieldDistributor.earned', details: { symbol: meta.symbol, coingeckoId: cgId, emittedToken: getAddress(emitted) }
    })] : []
  };
}

async function discoverYieldBasisMarkets(registry) {
  const provider = await registry.get('ethereum');
  const factory = new Contract(ADDR.yieldBasis.factory, YB_FACTORY_ABI, provider);
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

let ybMarketCache = null;
async function collectYieldBasis(address, registry) {
  const provider = await registry.get('ethereum');
  const fd = new Contract(ADDR.yieldBasis.feeDistributor, YB_FEE_DISTRIBUTOR_ABI, provider);
  const [tokens, amounts] = await fd.preview_claim.staticCall(address, 50, false);
  if (!ybMarketCache) ybMarketCache = await discoverYieldBasisMarkets(registry);
  const rewards = [];
  for (let i = 0; i < tokens.length; i++) {
    const raw = amounts[i];
    if (raw === 0n) continue;
    const token = getAddress(tokens[i]);
    const meta = await tokenMeta(provider, token);
    const market = ybMarketCache.get(token.toLowerCase());
    const details = { symbol: meta.symbol };
    if (market) {
      const assetMeta = await tokenMeta(provider, market.asset);
      const lt = new Contract(token, YB_LT_ABI, provider);
      let redemptionRaw = null;
      try { redemptionRaw = await lt.preview_withdraw(raw); } catch {}
      if (redemptionRaw !== null) {
        details.redeemAsset = market.asset;
        details.redeemSymbol = assetMeta.symbol;
        details.redeemDecimals = assetMeta.decimals;
        details.redeemAmountRaw = redemptionRaw.toString();
        details.redeemAmount = round(n(formatUnits(redemptionRaw, assetMeta.decimals)), 12);
        details.pricePlatform = 'ethereum';
        details.redemptionPriceContract = market.asset;
        details.redemptionCoingeckoId = COINGECKO_IDS[String(assetMeta.symbol || '').toUpperCase()] || null;
        details.marketIndex = market.index;
      }
    }
    rewards.push(rewardBase({
      protocol: 'Yield Basis', route: 'yield-basis-fees', chain: 'Ethereum', token,
      amountRaw: raw, decimals: meta.decimals, amount: n(formatUnits(raw, meta.decimals)),
      classification: 'unclaimed', source: 'onchain: FeeDistributor.preview_claim', details
    }));
  }
  return { source: { protocol: 'Yield Basis', route: 'yield-basis-fees', status: 'ok', chain: 'Ethereum', metric: 'FeeDistributor.preview_claim(receiver, 50, false)' }, rewards };
}

function unionPendingSource() {
  return {
    source: {
      protocol: 'Convex / Votium / The Union', route: 'votium-union', status: 'warming', chain: 'Ethereum', metric: null,
      note: 'Votium → The Union is intentionally excluded until a reproducible member-level reward read is validated. No reward amount is guessed.'
    },
    rewards: []
  };
}

async function collectFxFees(address, registry) {
  const provider = await registry.get('ethereum');
  const rewards = [];
  const issues = [];
  for (const fdCfg of ADDR.fx.feeDistributors) {
    try {
      const fd = new Contract(fdCfg.address, GENERIC_FEE_DISTRIBUTOR_ABI, provider);
      const raw = await fd.claim.staticCall(address);
      if (raw === 0n) continue;
      let token;
      try { token = getAddress(await fd.token()); }
      catch (e) {
        if (fdCfg.fallbackToken) token = getAddress(fdCfg.fallbackToken);
        else {
          issues.push(`${fdCfg.label}: reward token getter unavailable`);
          continue;
        }
      }
      const meta = await tokenMeta(provider, token);
      rewards.push(rewardBase({
        protocol: 'f(x)', route: 'fx-fees', chain: 'Ethereum', token,
        amountRaw: raw, decimals: meta.decimals, amount: n(formatUnits(raw, meta.decimals)), classification: 'unclaimed',
        source: 'onchain: f(x) FeeDistributor.claim staticCall',
        details: { symbol: meta.symbol, distributor: getAddress(fdCfg.address), distributorLabel: fdCfg.label, coingeckoId: COINGECKO_IDS[String(meta.symbol || '').toUpperCase()] || null, pricePlatform: 'ethereum', priceContract: token }
      }));
    } catch (e) { issues.push(`${fdCfg.label}: ${e.shortMessage || e.message}`); }
  }
  return {
    source: {
      protocol: 'f(x)', route: 'fx-fees', status: issues.length ? 'partial' : 'ok', chain: 'Ethereum',
      metric: 'f(x) veFXN FeeDistributor claim simulations',
      note: issues.length ? 'Measured fee distributions are retained; one or more fee distributor reads were incomplete.' : 'Base veFXN fee distributions are measured independently from VoteMarket voting incentives.',
      details: { issues }
    }, rewards
  };
}

async function fetchJson(url, headers = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}

async function fetchJsonRetry(url, headers = {}, timeoutMs = 25000, attempts = 2) {
  let last;
  for (let i = 0; i < attempts; i++) {
    try { return await fetchJson(url, headers, timeoutMs); }
    catch (e) {
      last = e;
      if (i + 1 < attempts) await sleep(650 * (i + 1));
    }
  }
  throw last;
}

function apiAmount(raw, decimals = 18, preferAtomic = false) {
  if (raw === null || raw === undefined || raw === '') return { amount: 0, amountRaw: '0', atomic: false };
  const s = String(raw).trim();
  if (!s) return { amount: 0, amountRaw: '0', atomic: false };
  if (/^-?\d+$/.test(s)) {
    try {
      const bi = BigInt(s);
      // Pendle merkle reward `amount` values are contract-ready uint amounts, so
      // callers can force atomic interpretation. For less explicit API fields
      // (notably ethAccruedAmount), retain a conservative size heuristic.
      if (preferAtomic || bi > 1_000_000_000_000n || bi < -1_000_000_000_000n) {
        return { amount: n(formatUnits(bi, decimals)), amountRaw: s, atomic: true };
      }
    } catch {}
  }
  const value = Number(s);
  return { amount: Number.isFinite(value) ? value : 0, amountRaw: s, atomic: false };
}

async function collectPendle(address, registry) {
  const base = 'https://api-v2.pendle.finance/core';
  let dashboard = null, spendle = null;
  const issues = [];
  try { dashboard = await fetchJsonRetry(`${base}/v1/dashboard/merkle-rewards/${address}`, {}, 25000, 2); }
  catch (e) { issues.push(`Merkle rewards API: ${e.message}`); }
  try { spendle = await fetchJsonRetry(`${base}/v1/spendle/${address}`, {}, 25000, 2); }
  catch (e) { issues.push(`sPENDLE holder API: ${e.message}`); }

  const rewards = [];
  const claimable = Array.isArray(dashboard?.claimableRewards) ? dashboard.claimableRewards : [];
  for (const item of claimable) {
    try {
      const chainId = Number(item.chainId || 1);
      const metaChain = CHAIN_META[chainId];
      if (!metaChain || !isAddressLike(item.token)) {
        issues.push(`Unsupported Pendle reward chain/token: ${item.chainId}/${item.token}`);
        continue;
      }
      const provider = await registry.get(metaChain.key);
      const token = getAddress(item.token);
      const meta = await tokenMeta(provider, token);
      const parsed = apiAmount(item.amount, meta.decimals, true);
      if (!(parsed.amount > 0)) continue;
      rewards.push(rewardBase({
        protocol: 'Pendle', route: 'pendle-spendle', chain: metaChain.name, token,
        amountRaw: parsed.amountRaw, decimals: meta.decimals, amount: parsed.amount, classification: 'unclaimed',
        source: 'official Pendle API: dashboard merkle rewards',
        details: {
          symbol: meta.symbol, chainId, assetId: item.assetId || null,
          fromTimestamp: item.fromTimestamp || null, toTimestamp: item.toTimestamp || null,
          coingeckoId: COINGECKO_IDS[String(meta.symbol || '').toUpperCase()] || null,
          fixedUsdPrice: String(meta.symbol || '').toUpperCase() === 'REUSD' ? 1 : null,
          pricePlatform: metaChain.platform, priceContract: token, apiAmountAtomic: parsed.atomic
        }
      }));
    } catch (e) { issues.push(`Pendle reward parse: ${e.shortMessage || e.message}`); }
  }

  if (spendle && spendle.ethAccruedAmount !== null && spendle.ethAccruedAmount !== undefined) {
    const parsed = apiAmount(spendle.ethAccruedAmount, 18);
    if (parsed.amount > 0) {
      rewards.push(rewardBase({
        protocol: 'Pendle', route: 'pendle-spendle', chain: 'Ethereum', token: 'native:ETH',
        amountRaw: parsed.amountRaw, decimals: 18, amount: parsed.amount, classification: 'unclaimed',
        source: 'official Pendle API: sPENDLE accrued ETH fees',
        details: { symbol: 'ETH', coingeckoId: 'ethereum', apiAmountAtomic: parsed.atomic }
      }));
    }
  }

  const status = dashboard && spendle && issues.length === 0 ? 'ok' : (dashboard || spendle ? 'partial' : 'error');
  return {
    source: {
      protocol: 'Pendle', route: 'pendle-spendle', status, chain: 'Multi-chain',
      metric: 'Official sPENDLE holder + dashboard claimable rewards APIs',
      note: status === 'ok'
        ? 'Current claimable sPENDLE rewards are read from Pendle official APIs. Legacy vePENDLE participation is preserved by Pendle in the holder response.'
        : 'Pendle was only partially readable; measured rewards are retained and the total remains incomplete.',
      details: {
        claimableMerkleItems: claimable.length,
        hasLegacyVePendleData: Boolean(spendle?.vePendlePositionData),
        vePendlePositionData: spendle?.vePendlePositionData || null,
        legacyVePendleAmountRaw: spendle?.vePendlePositionData?.amount != null
          ? String(spendle.vePendlePositionData.amount) : null,
        legacyVePendleAmount: spendle?.vePendlePositionData?.amount != null
          ? n(formatUnits(BigInt(String(spendle.vePendlePositionData.amount)), 18)) : null,
        legacyVePendleExpiry: spendle?.vePendlePositionData?.expiry ?? null,
        issues
      }
    }, rewards
  };
}

async function collectVenice(address, registry) {
  const provider = await registry.get('base');
  const staking = new Contract(ADDR.venice.staking, VENICE_STAKING_ABI, provider);
  const raw = await staking.pendingRewards(address);
  return {
    source: { protocol: 'Venice', route: 'venice-staking', status: 'ok', chain: 'Base', metric: 'StakingV2.pendingRewards(user)' },
    rewards: raw > 0n ? [rewardBase({
      protocol: 'Venice', route: 'venice-staking', chain: 'Base', token: ADDR.venice.vvv,
      amountRaw: raw, decimals: 18, amount: n(formatUnits(raw, 18)), classification: 'unclaimed',
      source: 'onchain: Venice StakingV2.pendingRewards', details: { symbol: 'VVV', coingeckoId: 'venice-token' }
    })] : []
  };
}

async function collectLiquity(address, registry) {
  const provider = await registry.get('ethereum');
  const staking = new Contract(ADDR.liquity.staking, LIQUITY_STAKING_ABI, provider);
  const [ethRaw, lusdRaw] = await Promise.all([staking.getPendingETHGain(address), staking.getPendingLUSDGain(address)]);
  const rewards = [];
  if (ethRaw > 0n) {
    rewards.push(rewardBase({
      protocol: 'Liquity', route: 'liquity-staking', chain: 'Ethereum', token: 'native:ETH',
      amountRaw: ethRaw, decimals: 18, amount: n(formatUnits(ethRaw, 18)), classification: 'unclaimed',
      source: 'onchain: LQTYStaking.getPendingETHGain', details: { symbol: 'ETH', coingeckoId: 'ethereum' }
    }));
  }
  if (lusdRaw > 0n) {
    rewards.push(rewardBase({
      protocol: 'Liquity', route: 'liquity-staking', chain: 'Ethereum', token: ADDR.liquity.lusd,
      amountRaw: lusdRaw, decimals: 18, amount: n(formatUnits(lusdRaw, 18)), classification: 'unclaimed',
      source: 'onchain: LQTYStaking.getPendingLUSDGain', details: { symbol: 'LUSD', pricePlatform: 'ethereum', priceContract: ADDR.liquity.lusd }
    }));
  }
  return { source: { protocol: 'Liquity', route: 'liquity-staking', status: 'ok', chain: 'Ethereum', metric: 'LQTYStaking pending ETH + LUSD gains' }, rewards };
}

async function collectResupply(address, registry) {
  const provider = await registry.get('ethereum');
  const staker = new Contract(ADDR.resupply.staker, RESUPPLY_STAKER_ABI, provider);
  const count = Math.min(Number(await staker.rewardTokensLength()), 32);
  const rewards = [];
  for (let i = 0; i < count; i++) {
    const token = getAddress(await staker.rewardTokens(i));
    const raw = await staker.earned(address, token);
    if (raw === 0n) continue;
    const meta = await tokenMeta(provider, token);
    rewards.push(rewardBase({
      protocol: 'Resupply', route: 'resupply-staking', chain: 'Ethereum', token,
      amountRaw: raw, decimals: meta.decimals, amount: n(formatUnits(raw, meta.decimals)), classification: 'unclaimed',
      source: 'onchain: GovStaker.earned(account,rewardToken)',
      details: { symbol: meta.symbol, coingeckoId: COINGECKO_IDS[String(meta.symbol || '').toUpperCase()] || null, pricePlatform: 'ethereum', priceContract: token }
    }));
  }
  return { source: { protocol: 'Resupply', route: 'resupply-staking', status: 'ok', chain: 'Ethereum', metric: 'GovStaker dynamic reward tokens + earned(account,token)' }, rewards };
}

async function collectRoute(route, address, registry) {
  switch (route) {
    case 'aerodrome-relay': return collectAerodromeRelay(address, registry);
    case 'aerodrome-ve': return collectVeProtocol(address, registry, 'aerodrome');
    case 'velodrome-ve': return collectDefiteaVelodrome(address, registry);
    case 'curve-fees': return collectCurveBase(address, registry);
    case 'votemarket-vecrv': return collectVoteMarket(address, registry, 'curve', route);
    case 'frax-yield': return collectFrax(address, registry);
    case 'yield-basis-fees': return collectYieldBasis(address, registry);
    case 'votium-union': return unionPendingSource();
    case 'pendle-spendle': return collectPendle(address, registry);
    case 'fx-fees': return collectFxFees(address, registry);
    case 'votemarket-vefxn': return collectVoteMarket(address, registry, 'fxn', route);
    case 'venice-staking': return collectVenice(address, registry);
    case 'liquity-staking': return collectLiquity(address, registry);
    case 'resupply-staking': return collectResupply(address, registry);
    default: throw new Error(`Unknown route ${route}`);
  }
}

function mergeRouteSource(route, walletResults) {
  const sourceObjects = walletResults.map(x => x.source).filter(Boolean);
  const statuses = sourceObjects.map(s => s.status);
  const allOk = statuses.length > 0 && statuses.every(s => s === 'ok');
  const anyMeasured = statuses.some(s => s === 'ok' || s === 'partial');
  const allWarming = statuses.length > 0 && statuses.every(s => s === 'warming');
  const status = allOk ? 'ok' : anyMeasured ? 'partial' : allWarming ? 'warming' : 'error';
  const first = sourceObjects[0] || { protocol: route, route, chain: null, metric: null };
  let notes = [...new Set(sourceObjects.map(s => s.note).filter(Boolean))];

  // A Defitea veVELO position may live in a 40 Acres portfolio linked to only
  // one of the two company wallets. Once any linked wallet has a confirmed
  // veNFT, do not merge an unrelated wallet's "position not found" note into
  // the company-level source. Keep the route partial for the separate,
  // conservative historical-vote completeness reason.
  const velodromeFound = route === 'velodrome-ve' && sourceObjects.some(
    s => Number(s.details?.totalVeNftCount || 0) > 0
  );
  if (velodromeFound) {
    notes = notes.filter(note => !String(note).startsWith('Expected Defitea veVELO position was not found'));
  }

  const routeDetails = { ...(first.details || {}) };
  if (route === 'velodrome-ve') {
    routeDetails.directWalletVeNftCount = sourceObjects.reduce((sum, s) => sum + Number(s.details?.directWalletVeNftCount || 0), 0);
    routeDetails.fortyAcresVeNftCount = sourceObjects.reduce((sum, s) => sum + Number(s.details?.fortyAcresVeNftCount || 0), 0);
    routeDetails.totalVeNftCount = sourceObjects.reduce((sum, s) => sum + Number(s.details?.totalVeNftCount || 0), 0);
    routeDetails.fortyAcresPortfolios = sourceObjects.flatMap(s => Array.isArray(s.details?.fortyAcresPortfolios) ? s.details.fortyAcresPortfolios : []);
    routeDetails.positions = sourceObjects.flatMap(s => Array.isArray(s.details?.positions) ? s.details.positions : []);
    routeDetails.issues = sourceObjects.flatMap(s => Array.isArray(s.details?.issues) ? s.details.issues : []);
  }

  return {
    ...first,
    route,
    status,
    note: notes.join(' '),
    details: {
      ...routeDetails,
      walletResults: walletResults.map(x => ({
        wallet: x.wallet.address,
        walletAlias: x.wallet.alias,
        status: x.source?.status || 'error',
        rewardCount: (x.rewards || []).length,
        note: x.source?.note || null,
        details: x.source?.details || null
      }))
    }
  };
}

async function collectRouteAcrossWallets(route, wallets, registry) {
  if (route === 'votium-union') {
    const out = unionPendingSource();
    out.source.details = { wallets: wallets.map(w => ({ address: w.address, alias: w.alias })) };
    return out;
  }
  const walletResults = [];
  const rewards = [];
  for (const wallet of wallets) {
    try {
      const out = await collectRoute(route, wallet.address, registry);
      walletResults.push({ wallet, source: out.source, rewards: out.rewards || [] });
      rewards.push(...tagWalletRewards(out.rewards, wallet));
    } catch (e) {
      walletResults.push({
        wallet,
        source: { protocol: route, route, status: 'error', metric: null, note: e.shortMessage || e.message },
        rewards: []
      });
    }
    await sleep(70);
  }
  return { source: mergeRouteSource(route, walletResults), rewards };
}

async function applyPrices(rewards) {
  const headers = CG_KEY ? { 'x-cg-demo-api-key': CG_KEY } : {};
  const ids = [...new Set(rewards.flatMap(r => [r.details?.coingeckoId, r.details?.redemptionCoingeckoId]).filter(Boolean))];
  const idPrices = {};
  if (ids.length) {
    try {
      const url = 'https://api.coingecko.com/api/v3/simple/price?ids=' + encodeURIComponent(ids.join(',')) + '&vs_currencies=usd';
      const data = await fetchJson(url, headers, 15000);
      ids.forEach(id => { if (hasFiniteNumber(data?.[id]?.usd)) idPrices[id] = Number(data[id].usd); });
    } catch (e) { console.warn('CoinGecko id pricing failed:', e.message); }
  }

  const byPlatform = new Map();
  function addContract(platform, contract) {
    if (!platform || !isAddressLike(contract)) return;
    if (!byPlatform.has(platform)) byPlatform.set(platform, new Set());
    byPlatform.get(platform).add(contract.toLowerCase());
  }
  for (const r of rewards) {
    addContract(r.details?.pricePlatform, r.details?.priceContract);
    addContract(r.details?.pricePlatform || 'ethereum', r.details?.redemptionPriceContract);
    // Backward compatibility for v0.1.1 YB objects if old history/data is ever reused.
    addContract('ethereum', r.details?.priceByEthereumContract);
  }

  const contractPrices = new Map();
  for (const [platform, contracts] of byPlatform.entries()) {
    const arr = [...contracts];
    if (!arr.length) continue;
    try {
      const url = `https://api.coingecko.com/api/v3/simple/token_price/${platform}?contract_addresses=${encodeURIComponent(arr.join(','))}&vs_currencies=usd`;
      const data = await fetchJson(url, headers, 15000);
      const prices = {};
      for (const a of arr) if (hasFiniteNumber(data?.[a]?.usd)) prices[a] = Number(data[a].usd);
      contractPrices.set(platform, prices);
    } catch (e) { console.warn(`CoinGecko ${platform} contract pricing failed:`, e.message); }
  }

  for (const r of rewards) {
    // reUSD is treated at explicit 1:1 USD parity across every reward route,
    // including dynamically enumerated Resupply GovStaker rewards.
    const fixed = String(r.symbol || r.details?.symbol || '').toUpperCase() === 'REUSD'
      ? 1
      : r.details?.fixedUsdPrice;
    const cgId = r.details?.coingeckoId;
    const directPlatform = r.details?.pricePlatform;
    const directContract = r.details?.priceContract?.toLowerCase();
    const redemptionContract = (r.details?.redemptionPriceContract || r.details?.priceByEthereumContract)?.toLowerCase();
    const redemptionPlatform = r.details?.pricePlatform || 'ethereum';
    const redemptionCgId = r.details?.redemptionCoingeckoId;
    const redeemAmount = r.details?.redeemAmount;

    if (hasFiniteNumber(fixed)) {
      r.priceUsd = Number(fixed);
      r.usdValue = round(r.amount * r.priceUsd, 6);
      r.priceMethod = 'fixed-usd-assumption';
    } else if (cgId && hasFiniteNumber(idPrices[cgId])) {
      r.priceUsd = idPrices[cgId];
      r.usdValue = round(r.amount * r.priceUsd, 6);
      r.priceMethod = `coingecko:${cgId}`;
    } else if (directPlatform && directContract && hasFiniteNumber(contractPrices.get(directPlatform)?.[directContract])) {
      r.priceUsd = contractPrices.get(directPlatform)[directContract];
      r.usdValue = round(r.amount * r.priceUsd, 6);
      r.priceMethod = `coingecko-contract:${directPlatform}`;
    } else if (redemptionContract && hasFiniteNumber(contractPrices.get(redemptionPlatform)?.[redemptionContract]) && hasFiniteNumber(redeemAmount)) {
      r.priceUsd = contractPrices.get(redemptionPlatform)[redemptionContract];
      r.usdValue = round(Number(redeemAmount) * r.priceUsd, 6);
      r.priceMethod = `redemption-value:${r.details.redeemSymbol || 'asset'}@coingecko-contract`;
    } else if (redemptionCgId && hasFiniteNumber(idPrices[redemptionCgId]) && hasFiniteNumber(redeemAmount)) {
      r.priceUsd = idPrices[redemptionCgId];
      r.usdValue = round(Number(redeemAmount) * r.priceUsd, 6);
      r.priceMethod = `redemption-value:${r.details.redeemSymbol || 'asset'}@coingecko:${redemptionCgId}`;
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
    if (hasFiniteNumber(r.usdValue)) x.usdValue += Number(r.usdValue); else x.usdComplete = false;
  }
  return [...m.values()].map(x => ({ symbol: x.symbol, token: x.token, amount: round(x.amount, 10), usdValue: x.usdComplete ? round(x.usdValue, 6) : null }));
}

async function main() {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  const previous = readPrevious();
  const registry = createProviderRegistry();
  const ethProvider = await registry.get('ethereum');
  // Prewarm the three chains used by the already-production v0.1 companies.
  await registry.get('base');
  await registry.get('fraxtal');

  const companies = {};
  const engineErrors = {};

  for (const c of COMPANIES) {
    const wallets = [];
    for (const spec of c.wallets) {
      try { wallets.push(await resolveWallet(ethProvider, spec)); }
      catch (e) { engineErrors[`${c.name}:${spec.alias || spec.ens || 'wallet'}:identity`] = e.message; }
    }
    if (!wallets.length) {
      companies[c.name] = { status: 'warming', ens: c.name, address: null, wallets: [], totalUsd: null, rewards: [], rewardTokens: [], sources: [], reason: 'No company wallets resolved', updatedAt: NOW };
      continue;
    }

    const rewards = [];
    const sources = [];
    for (const route of c.routes) {
      try {
        const out = await collectRouteAcrossWallets(route, wallets, registry);
        sources.push(out.source);
        rewards.push(...(out.rewards || []));
        if (out.source?.status === 'error') engineErrors[`${c.name}:${route}`] = out.source.note || 'route error';
        for (const wr of out.source?.details?.walletResults || []) {
          if (wr.status === 'error') engineErrors[`${c.name}:${route}:${wr.walletAlias || wr.wallet}`] = wr.note || 'wallet route error';
        }
      } catch (e) {
        console.warn(`${c.name} ${route}:`, e.message);
        sources.push({ protocol: route, route, status: 'error', metric: null, note: e.message });
        engineErrors[`${c.name}:${route}`] = e.message;
      }
      await sleep(80);
    }

    await applyPrices(rewards);
    const completeSources = sources.filter(s => s.status === 'ok').length;
    const measuredSources = sources.filter(s => s.status === 'ok' || s.status === 'partial').length;
    const routeCount = c.routes.length;
    const pendingSources = sources.filter(s => s.status !== 'ok').length;
    const unpriced = rewards.filter(r => !hasFiniteNumber(r.usdValue)).length;
    const totalUsd = rewards.reduce((s, r) => s + (hasFiniteNumber(r.usdValue) ? Number(r.usdValue) : 0), 0);
    const allRoutesComplete = completeSources === routeCount;
    const status = allRoutesComplete && unpriced === 0 ? 'ok' : measuredSources > 0 ? 'partial' : 'warming';

    const primary = wallets[0];
    companies[c.name] = {
      status,
      ens: primary.ens || c.name,
      address: primary.address,
      resolution: primary.resolution,
      fallbackMatched: primary.fallbackMatched,
      wallets,
      totalUsd: round(totalUsd, 6),
      totalUsdIsComplete: allRoutesComplete && unpriced === 0,
      routeCoverage: routeCount ? round(measuredSources / routeCount, 6) : 0,
      completeRouteCoverage: routeCount ? round(completeSources / routeCount, 6) : 0,
      measuredRoutes: measuredSources,
      completeRoutes: completeSources,
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
      status: c.status, totalUsd: c.totalUsd, totalUsdIsComplete: c.totalUsdIsComplete, rewardTokens: c.rewardTokens
    }]))
  };
  const filtered = history.filter(h => h && h.date !== TODAY);
  filtered.push(snapshot);

  const output = {
    version: VERSION,
    collectorVersion: COLLECTOR_VERSION,
    methodologyVersion: METHODOLOGY_VERSION,
    generatedAt: NOW,
    date: TODAY,
    scope: 'protocol-side accrued rewards for Personal Onchain Companies and Defitea Fund',
    methodology: {
      definition: 'Rewards already earned inside protocol contracts but not yet freely held in the company/fund wallet.',
      multiWallet: 'Defitea rewards are measured independently for defitea.eth and the Defitea Operations wallet, then aggregated into one Defitea Passport. Every reward retains wallet provenance.',
      aerodromeVelodrome: 'Aerodrome managed/Relay rewards are read directly. Defitea Velodrome additionally discovers veNFT ownership through official 40 Acres Optimism portfolio factories, then reads current rewards at the actual holder. Already distributed 40 Acres wallet payouts are not counted as accrued rewards.',
      curve: 'Base crvUSD FeeDistributor claims are simulated. VoteMarket veCRV uses official Stake DAO proof membership, published raw vote details, VoteMarket claimed-state and period state to reproduce the Votemarket claim formula; OracleLens is used as an onchain cross-check when populated.',
      convex: 'Votium/The Union remains intentionally excluded until a reproducible member-level reward read is validated.',
      pendle: 'Per-wallet sPENDLE claimable merkle rewards and accrued ETH fees are read from Pendle official Core API. Legacy vePENDLE is normalized from vePendlePositionData for Passport display without adding it to TVL.',
      fx: 'Base veFXN FeeDistributor claims are simulated. VoteMarket veFXN uses official Stake DAO proof membership, published raw vote details, VoteMarket claimed-state and period state to reproduce the Votemarket claim formula; OracleLens is used as an onchain cross-check when populated.',
      yieldBasis: 'FeeDistributor.preview_claim is used; yb rewards are valued at current redemption value into underlying BTC assets.',
      frax: 'Fraxtal YieldDistributor.earned(account), with emitted reward token discovered onchain.',
      venice: 'StakingV2.pendingRewards(user) on Base.',
      liquity: 'LQTYStaking pending ETH and LUSD gains.',
      resupply: 'GovStaker reward tokens are dynamically enumerated and earned(account, token) is read onchain. reUSD is valued with an explicit 1:1 USD parity assumption.',
      tvlTreatment: 'Accrued Rewards remain separate from Company TVL and Treasury cash.'
    },
    rpc: registry.rpcSummary(),
    companies,
    engineErrors,
    history: filtered.slice(-400)
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');
  console.log(`Company Rewards v${VERSION} written to ${OUTPUT}`);
  for (const [name, c] of Object.entries(companies)) {
    const suffix = c.totalUsdIsComplete ? '' : '+';
    console.log(`${name}: ${c.status} · $${Number(c.totalUsd || 0).toFixed(2)}${suffix} · ${c.rewardTokens.map(t => t.symbol).join(', ') || 'no accrued rewards'} · routes ${c.completeRoutes || 0}/${c.routeCount || 0} complete`);
  }
  if (Object.keys(engineErrors).length) console.log('engineErrors:', engineErrors);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
