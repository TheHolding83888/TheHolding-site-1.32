#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, JsonRpcProvider, ZeroAddress, formatUnits, getAddress } from 'ethers';

const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const GOVERNANCE = getAddress('0x807DEf5E7d057DF05C796F4bc75C3Fe82Bd6EeE1');
const STAKING_V1 = getAddress('0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d');
const LUSD = getAddress('0x5f98805A4E8be255a32880FDeC7F6728C6568bA0');
const DEFITEA = getAddress('0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3');
const RPCS = [...new Set([
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com'
].filter(Boolean))];
const GOVERNANCE_ABI = ['function deriveUserProxyAddress(address _user) view returns (address)'];
const STAKING_ABI = [
  'function getPendingETHGain(address _user) view returns (uint256)',
  'function getPendingLUSDGain(address _user) view returns (uint256)'
];
const USER_PROXY_ABI = ['function staked() view returns (uint256)'];
const VERSION = '0.1-liquity-v2-userproxy-claimable';

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
const round = (v, d = 10) => finite(v) ? Number(Number(v).toFixed(d)) : null;

async function providerWithFallback() {
  let last;
  for (const url of RPCS) {
    const provider = new JsonRpcProvider(url, 1, { staticNetwork: true });
    try {
      await provider.getBlockNumber();
      return { provider, endpointClass: url === process.env.ETH_RPC_URL ? 'configured-secret' : 'public-fallback' };
    } catch (e) {
      last = e;
      try { provider.destroy(); } catch {}
    }
  }
  throw last || new Error('No working Ethereum RPC');
}

async function fetchJson(url, timeoutMs = 12000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPrices() {
  const keys = [`coingecko:ethereum`, `ethereum:${LUSD.toLowerCase()}`];
  try {
    const json = await fetchJson(`https://coins.llama.fi/prices/current/${keys.join(',')}`);
    const eth = Number(json?.coins?.[keys[0]]?.price);
    const lusd = Number(json?.coins?.[keys[1]]?.price);
    return {
      ETH: eth > 0 ? { price: eth, method: 'DefiLlama coingecko:ethereum' } : null,
      LUSD: lusd > 0 ? { price: lusd, method: 'DefiLlama Ethereum contract price' } : null
    };
  } catch (e) {
    return { ETH: null, LUSD: null, issue: e.message };
  }
}

function tokenSummary(rewards) {
  const m = new Map();
  for (const r of rewards || []) {
    const key = `${r.symbol}|${r.token}`;
    if (!m.has(key)) m.set(key, { symbol: r.symbol, token: r.token, amount: 0, usdValue: 0, usdComplete: true });
    const x = m.get(key);
    x.amount += Number(r.amount || 0);
    if (finite(r.usdValue)) x.usdValue += Number(r.usdValue); else x.usdComplete = false;
  }
  return [...m.values()].map(x => ({
    symbol: x.symbol,
    token: x.token,
    amount: round(x.amount, 10),
    usdValue: x.usdComplete ? round(x.usdValue, 6) : null
  }));
}

function recomputeCompany(c) {
  const rewards = c.rewards || [];
  const sources = c.sources || [];
  const routeCount = Number(c.routeCount || sources.length || 0);
  const completeSources = sources.filter(s => s.status === 'ok').length;
  const measuredSources = sources.filter(s => s.status === 'ok' || s.status === 'partial').length;
  const unpriced = rewards.filter(r => !finite(r.usdValue)).length;
  c.totalUsd = round(rewards.reduce((sum, r) => sum + (finite(r.usdValue) ? Number(r.usdValue) : 0), 0), 6);
  c.totalUsdIsComplete = routeCount > 0 && completeSources === routeCount && unpriced === 0;
  c.routeCoverage = routeCount ? round(measuredSources / routeCount, 6) : 0;
  c.completeRouteCoverage = routeCount ? round(completeSources / routeCount, 6) : 0;
  c.measuredRoutes = measuredSources;
  c.completeRoutes = completeSources;
  c.pendingRoutes = sources.filter(s => s.status !== 'ok').length;
  c.unpricedRewards = unpriced;
  c.rewardTokens = tokenSummary(rewards);
  c.status = c.totalUsdIsComplete ? 'ok' : measuredSources > 0 ? 'partial' : 'warming';
}

const data = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
const company = data.companies?.['defitea.eth'];
if (!company) throw new Error('Defitea Rewards state missing');
const wallets = Array.isArray(company.wallets) ? company.wallets.filter(w => w?.address) : [];
if (!wallets.some(w => getAddress(w.address) === DEFITEA)) throw new Error('Canonical defitea.eth wallet missing');

const { provider, endpointClass } = await providerWithFallback();
try {
  const governance = new Contract(GOVERNANCE, GOVERNANCE_ABI, provider);
  const staking = new Contract(STAKING_V1, STAKING_ABI, provider);
  const accountReads = [];
  const issues = [];

  for (const wallet of wallets) {
    const owner = getAddress(wallet.address);
    const direct = { wallet: owner, walletAlias: wallet.alias || null, account: owner, accountKind: 'direct-v1', stakedLqty: null };
    accountReads.push(direct);

    try {
      const proxy = getAddress(await governance.deriveUserProxyAddress(owner));
      const code = await provider.getCode(proxy);
      if (code && code !== '0x') {
        let stakedLqty = null;
        try {
          stakedLqty = Number(formatUnits(await new Contract(proxy, USER_PROXY_ABI, provider).staked(), 18));
        } catch (e) {
          issues.push(`${wallet.alias || owner}: UserProxy.staked read failed: ${e.shortMessage || e.message}`);
        }
        accountReads.push({ wallet: owner, walletAlias: wallet.alias || null, account: proxy, accountKind: 'liquity-v2-userproxy', stakedLqty });
      }
    } catch (e) {
      issues.push(`${wallet.alias || owner}: deriveUserProxyAddress failed: ${e.shortMessage || e.message}`);
    }
  }

  const primaryProxy = accountReads.find(x => x.wallet === DEFITEA && x.accountKind === 'liquity-v2-userproxy');
  if (!primaryProxy) throw new Error('Defitea Liquity V2 UserProxy is not deployed; refusing silent zero');
  if (!(Number(primaryProxy.stakedLqty) > 0)) throw new Error('Defitea Liquity V2 UserProxy has no proven staked LQTY; refusing silent zero');

  let totalEthRaw = 0n;
  let totalLusdRaw = 0n;
  for (const row of accountReads) {
    try {
      const [ethRaw, lusdRaw] = await Promise.all([
        staking.getPendingETHGain(row.account),
        staking.getPendingLUSDGain(row.account)
      ]);
      row.pendingEthRaw = ethRaw.toString();
      row.pendingEth = round(Number(formatUnits(ethRaw, 18)), 12);
      row.pendingLusdRaw = lusdRaw.toString();
      row.pendingLusd = round(Number(formatUnits(lusdRaw, 18)), 12);
      totalEthRaw += ethRaw;
      totalLusdRaw += lusdRaw;
    } catch (e) {
      row.readError = e.shortMessage || e.message;
      issues.push(`${row.walletAlias || row.wallet}/${row.accountKind}: pending read failed: ${row.readError}`);
    }
  }

  const prices = await fetchPrices();
  if (prices.issue) issues.push(`pricing: ${prices.issue}`);
  company.rewards = (company.rewards || []).filter(r => r.route !== 'liquity-staking');

  const rewardDetails = {
    governance: GOVERNANCE,
    stakingV1: STAKING_V1,
    wallet: DEFITEA,
    walletAlias: 'defitea.eth',
    userProxy: primaryProxy.account,
    userProxyStakedLqty: round(primaryProxy.stakedLqty, 10),
    accountBreakdown: accountReads,
    unknownIsNotZero: true,
    rewardState: 'Claimable'
  };

  if (totalEthRaw > 0n) {
    const amount = Number(formatUnits(totalEthRaw, 18));
    const price = prices.ETH?.price ?? null;
    company.rewards.push({
      protocol: 'Liquity', route: 'liquity-staking', chain: 'Ethereum', token: 'native:ETH', symbol: 'ETH',
      amountRaw: totalEthRaw.toString(), decimals: 18, amount: round(amount, 10), classification: 'unclaimed',
      source: 'onchain: Liquity V1 LQTYStaking pending gain across wallet + V2 UserProxy',
      usdValue: price ? round(amount * price, 6) : null, priceUsd: price, priceMethod: prices.ETH?.method || null,
      details: rewardDetails
    });
  }

  if (totalLusdRaw > 0n) {
    const amount = Number(formatUnits(totalLusdRaw, 18));
    const price = prices.LUSD?.price ?? null;
    company.rewards.push({
      protocol: 'Liquity', route: 'liquity-staking', chain: 'Ethereum', token: LUSD, symbol: 'LUSD',
      amountRaw: totalLusdRaw.toString(), decimals: 18, amount: round(amount, 10), classification: 'unclaimed',
      source: 'onchain: Liquity V1 LQTYStaking pending gain across wallet + V2 UserProxy',
      usdValue: price ? round(amount * price, 6) : null, priceUsd: price, priceMethod: prices.LUSD?.method || null,
      details: rewardDetails
    });
  }

  const sourceIndex = (company.sources || []).findIndex(s => s.route === 'liquity-staking');
  const sourceStatus = issues.some(x => /pending read failed|deriveUserProxyAddress failed|UserProxy\.staked read failed/.test(x)) ? 'partial' : 'ok';
  const source = {
    protocol: 'Liquity', route: 'liquity-staking', status: sourceStatus, chain: 'Ethereum',
    metric: 'LQTYStaking pending ETH + LUSD across direct wallet and Liquity V2 UserProxy',
    note: 'Liquity V2 Governance stakes LQTY through a deterministic UserProxy. Claimable V1 ETH/LUSD fees are therefore read from both the company wallet and every deployed UserProxy; amounts are aggregated once without treating absent rewards as unknown capital.',
    details: {
      governance: GOVERNANCE,
      stakingV1: STAKING_V1,
      primaryUserProxy: primaryProxy.account,
      primaryUserProxyStakedLqty: round(primaryProxy.stakedLqty, 10),
      rewardAccounts: accountReads,
      issues,
      unknownIsNotZero: true,
      rewardState: 'Claimable'
    }
  };
  if (sourceIndex >= 0) company.sources[sourceIndex] = source;
  else (company.sources ||= []).push(source);

  company.updatedAt = new Date().toISOString();
  recomputeCompany(company);
  data.methodology = data.methodology || {};
  data.methodology.liquity = 'Liquity V2 Governance stakes LQTY through a deterministic UserProxy which itself holds the immutable V1 LQTYStaking position. Rewards collector derives every wallet UserProxy from the live Governance contract, verifies deployed code and staked state, then reads V1 pending ETH/LUSD gains from both direct wallet and deployed UserProxy accounts. Positive gains are aggregated once as current Unclaimed; unknown is never coerced to zero.';
  data.diagnostics = data.diagnostics || {};
  data.diagnostics.liquityV2UserProxy = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    governance: GOVERNANCE,
    stakingV1: STAKING_V1,
    primaryWallet: DEFITEA,
    primaryUserProxy: primaryProxy.account,
    primaryUserProxyStakedLqty: round(primaryProxy.stakedLqty, 10),
    accountCount: accountReads.length,
    totalPendingEth: round(Number(formatUnits(totalEthRaw, 18)), 12),
    totalPendingLusd: round(Number(formatUnits(totalLusdRaw, 18)), 12),
    rpcEndpointClass: endpointClass,
    sourceStatus,
    issues,
    unknownIsNotZero: true,
    executionAuthority: 'none'
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n');
  console.log('LIQUITY V2 USERPROXY REWARDS PASS', data.diagnostics.liquityV2UserProxy);
} finally {
  try { provider.destroy(); } catch {}
}
