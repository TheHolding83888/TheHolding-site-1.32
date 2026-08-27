#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, Interface, JsonRpcProvider, ZeroAddress, formatUnits, getAddress, id, zeroPadValue } from 'ethers';

const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const TRACKING_SINCE = process.env.FORTY_ACRES_RECEIVED_SINCE || '2026-08-01T00:00:00.000Z';
const RPC_URLS = [...new Set([
  process.env.OPTIMISM_RPC_URL,
  'https://optimism-rpc.publicnode.com',
  'https://mainnet.optimism.io'
].filter(Boolean))];
const CHUNK = 250_000;
const OPTIMISM_BLOCK_SECONDS = 2;
const RECENT_SCAN_MARGIN_BLOCKS = 50_000;
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');
const REWARDS_IFACE = new Interface([
  'event RewardsProcessed(uint256 epoch,uint256 indexed tokenId,uint256 rewardsAmount,address user,address asset)'
]);
const REWARDS_TOPIC = REWARDS_IFACE.getEvent('RewardsProcessed').topicHash;
const PORTFOLIO_ABI = [
  'function getRecipient() view returns (address)',
  'function getRewardsToken() view returns (address)'
];
const ERC20_ABI = [
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const data = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
if (!data?.companies || typeof data.companies !== 'object') throw new Error('Rewards companies state missing');
const trackingTs = Date.parse(TRACKING_SINCE);
if (!Number.isFinite(trackingTs)) throw new Error('Invalid FORTY_ACRES_RECEIVED_SINCE');

function finite(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
}

function topicAddress(address) {
  return zeroPadValue(getAddress(address), 32);
}

function walk(value, fn, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  fn(value);
  if (Array.isArray(value)) {
    for (const x of value) walk(x, fn, seen);
  } else {
    for (const x of Object.values(value)) walk(x, fn, seen);
  }
}

function discoverFortyAcres(companyName, company) {
  const discovered = new Map();
  walk(company, node => {
    if (String(node?.custodyContext || '').toLowerCase() !== '40acres') return;
    const portfolio = node.holderAddress || node.portfolio || node.fortyAcresPortfolio || null;
    const wallet = node.wallet || company.address || null;
    const payoutToken = node.fortyAcresPayoutToken || null;
    if (!portfolio || !wallet || !payoutToken) return;
    let key;
    try {
      key = [getAddress(portfolio), getAddress(wallet), getAddress(payoutToken)].join(':').toLowerCase();
    } catch {
      return;
    }
    if (!discovered.has(key)) {
      discovered.set(key, {
        company: companyName,
        portfolio: getAddress(portfolio),
        ownerWallet: getAddress(wallet),
        payoutToken: getAddress(payoutToken),
        payoutSymbolHint: node.fortyAcresPayoutSymbol || null,
        strategy: node.fortyAcresStrategy || null,
        factory: node.fortyAcresFactory || null,
        custodyContext: '40acres'
      });
    }
  });
  return [...discovered.values()];
}

async function recentScanStart(provider, timestampMs, latestBlock) {
  const latest = await provider.getBlock(latestBlock);
  if (!latest) throw new Error(`Latest Optimism block ${latestBlock} unavailable`);
  const targetSeconds = Math.floor(timestampMs / 1000);
  const elapsedSeconds = Math.max(0, Number(latest.timestamp) - targetSeconds);
  const expectedBlocks = Math.ceil(elapsedSeconds / OPTIMISM_BLOCK_SECONDS);
  // Optimism Bedrock has a stable two-second cadence. Start with a generous
  // recent-history margin, then enforce the exact timestamp boundary per payout.
  // This avoids querying archive-era block headers just to locate an August window.
  return Math.max(0, latestBlock - expectedBlocks - RECENT_SCAN_MARGIN_BLOCKS);
}

async function providerWithFallback(timestampMs) {
  let lastError = null;
  for (const url of RPC_URLS) {
    const provider = new JsonRpcProvider(url, 10, { staticNetwork: true });
    try {
      const latestBlock = await provider.getBlockNumber();
      const fromBlock = await recentScanStart(provider, timestampMs, latestBlock);
      // A latest-block ping is not enough for this ledger: it reads historical
      // August logs. Prove that the endpoint actually serves the required archive
      // window before selecting it, so a current-only RPC cannot fail the full run.
      await provider.getLogs({ topics: [REWARDS_TOPIC], fromBlock, toBlock: fromBlock });
      return {
        provider,
        latestBlock,
        fromBlock,
        endpointClass: url.includes('publicnode') ? 'publicnode' : url.includes('optimism.io') ? 'optimism-public' : 'configured-secret'
      };
    } catch (err) {
      lastError = err;
      try { provider.destroy(); } catch {}
    }
  }
  throw lastError || new Error('No archive-capable Optimism RPC');
}

async function getLogsAdaptive(provider, filter, fromBlock, toBlock) {
  try {
    return await provider.getLogs({ ...filter, fromBlock, toBlock });
  } catch (err) {
    if (fromBlock >= toBlock) throw err;
    const mid = Math.floor((fromBlock + toBlock) / 2);
    const left = await getLogsAdaptive(provider, filter, fromBlock, mid);
    const right = await getLogsAdaptive(provider, filter, mid + 1, toBlock);
    return [...left, ...right];
  }
}

async function getLogsChunked(provider, filter, fromBlock, toBlock) {
  const out = [];
  for (let start = fromBlock; start <= toBlock; start += CHUNK) {
    const end = Math.min(toBlock, start + CHUNK - 1);
    out.push(...await getLogsAdaptive(provider, filter, start, end));
  }
  return out;
}

async function resolveRecipientAndToken(provider, route) {
  const portfolio = new Contract(route.portfolio, PORTFOLIO_ABI, provider);
  let recipient = route.ownerWallet;
  let recipientMethod = 'owner-wallet-fallback';
  try {
    const configured = getAddress(await portfolio.getRecipient());
    if (configured !== ZeroAddress) {
      recipient = configured;
      recipientMethod = '40acres-getRecipient';
    }
  } catch {}

  let payoutToken = route.payoutToken;
  try {
    const live = getAddress(await portfolio.getRewardsToken());
    if (live !== ZeroAddress) payoutToken = live;
  } catch {}

  const token = new Contract(payoutToken, ERC20_ABI, provider);
  const [decimalsRaw, symbolRaw] = await Promise.all([
    token.decimals().catch(() => 6),
    token.symbol().catch(() => route.payoutSymbolHint || 'TOKEN')
  ]);
  return {
    recipient,
    recipientMethod,
    payoutToken,
    decimals: Number(decimalsRaw),
    symbol: String(symbolRaw || route.payoutSymbolHint || 'TOKEN')
  };
}

async function collectRoute(provider, route, fromBlock, toBlock) {
  const resolved = await resolveRecipientAndToken(provider, route);
  const rewardsLogs = await getLogsChunked(provider, {
    address: route.portfolio,
    topics: [REWARDS_TOPIC]
  }, fromBlock, toBlock);
  const rewardTxs = new Set(rewardsLogs.map(x => String(x.transactionHash).toLowerCase()));

  const recipients = [...new Set([route.ownerWallet, resolved.recipient].filter(Boolean).map(x => getAddress(x)))];
  const transferLogs = [];
  for (const recipient of recipients) {
    const logs = await getLogsChunked(provider, {
      address: resolved.payoutToken,
      topics: [TRANSFER_TOPIC, topicAddress(route.portfolio), topicAddress(recipient)]
    }, fromBlock, toBlock);
    transferLogs.push(...logs.map(x => ({ ...x, recipient })));
  }

  const seen = new Set();
  const transfers = [];
  for (const log of transferLogs) {
    const key = `${log.transactionHash}:${log.index}`;
    if (seen.has(key) || !rewardTxs.has(String(log.transactionHash).toLowerCase())) continue;
    seen.add(key);
    const raw = BigInt(log.data);
    const amount = Number(formatUnits(raw, resolved.decimals));
    if (!(amount > 0)) continue;
    const block = await provider.getBlock(log.blockNumber);
    if (!block) throw new Error(`Payout block ${log.blockNumber} unavailable`);
    const timestampMs = Number(block.timestamp) * 1000;
    if (timestampMs < trackingTs) continue;
    transfers.push({
      txHash: log.transactionHash,
      blockNumber: log.blockNumber,
      logIndex: log.index,
      timestamp: new Date(timestampMs).toISOString(),
      recipient: getAddress(log.recipient),
      amount,
      symbol: resolved.symbol,
      token: resolved.payoutToken,
      chain: 'Optimism',
      usdValue: resolved.symbol.toUpperCase() === 'USDC' ? amount : null,
      usdMethod: resolved.symbol.toUpperCase() === 'USDC' ? 'native-usdc-par' : 'unpriced'
    });
  }
  transfers.sort((a, b) => (a.blockNumber - b.blockNumber) || (a.logIndex - b.logIndex));
  const amount = transfers.reduce((sum, x) => sum + x.amount, 0);
  const usdValue = transfers.reduce((sum, x) => sum + (finite(x.usdValue) ? Number(x.usdValue) : 0), 0);
  const usdComplete = transfers.every(x => finite(x.usdValue));

  return {
    protocol: '40 Acres · veVELO',
    route: 'forty-acres-velodrome-received',
    state: 'Received',
    classification: 'received',
    chain: 'Optimism',
    strategy: route.strategy,
    portfolio: route.portfolio,
    ownerWallet: route.ownerWallet,
    recipient: resolved.recipient,
    recipientMethod: resolved.recipientMethod,
    factory: route.factory,
    payoutToken: resolved.payoutToken,
    symbol: resolved.symbol,
    trackingSince: TRACKING_SINCE,
    throughBlock: toBlock,
    transferCount: transfers.length,
    amount,
    usdValue: usdComplete ? usdValue : null,
    usdValueIsComplete: usdComplete,
    transfers,
    proof: 'ERC20 Transfer(portfolio→company recipient) AND same-tx 40 Acres RewardsProcessed event',
    claimableApplicable: false,
    includedInClaimableTotal: false,
    includedInMeasuredEarnedTotal: false,
    executionAuthority: 'none'
  };
}

const discoveredByCompany = {};
let discoveredRouteCount = 0;
for (const [companyName, company] of Object.entries(data.companies)) {
  const routes = discoverFortyAcres(companyName, company);
  if (routes.length) {
    discoveredByCompany[companyName] = routes;
    discoveredRouteCount += routes.length;
  }
}

const { provider, endpointClass, latestBlock, fromBlock } = await providerWithFallback(trackingTs);
try {
  let companiesWithReceived = 0;
  let receivedTransferCount = 0;
  let receivedUsd = 0;

  for (const [companyName, routes] of Object.entries(discoveredByCompany)) {
    const company = data.companies[companyName];
    const rows = [];
    for (const route of routes) rows.push(await collectRoute(provider, route, fromBlock, latestBlock));
    company.receivedIncome = rows;
    company.receivedIncomeTrackingSince = TRACKING_SINCE;
    company.receivedIncomeUsd = rows.every(x => x.usdValueIsComplete === true)
      ? rows.reduce((sum, x) => sum + Number(x.usdValue || 0), 0)
      : null;
    company.receivedIncomeUsdIsComplete = rows.every(x => x.usdValueIsComplete === true);
    company.receivedIncomeTransferCount = rows.reduce((sum, x) => sum + Number(x.transferCount || 0), 0);
    company.receivedIncomeTokens = [...new Set(rows.filter(x => Number(x.amount) > 0).map(x => x.symbol))];
    if (company.receivedIncomeTransferCount > 0) companiesWithReceived += 1;
    receivedTransferCount += company.receivedIncomeTransferCount;
    if (finite(company.receivedIncomeUsd)) receivedUsd += Number(company.receivedIncomeUsd);
  }

  // Companies without proven 40 Acres custody must not inherit a guessed Received route.
  for (const [companyName, company] of Object.entries(data.companies)) {
    if (!discoveredByCompany[companyName]) {
      delete company.receivedIncome;
      delete company.receivedIncomeTrackingSince;
      delete company.receivedIncomeUsd;
      delete company.receivedIncomeUsdIsComplete;
      delete company.receivedIncomeTransferCount;
      delete company.receivedIncomeTokens;
    }
  }

  const defitea = data.companies?.['defitea.eth'];
  if (discoveredByCompany['defitea.eth']) {
    if (!(Number(defitea?.receivedIncomeTransferCount) > 0) || !(Number(defitea?.receivedIncomeUsd) > 0)) {
      throw new Error('Defitea 40 Acres custody is proven but no August Received payout was proven; refusing silent zero');
    }
  }

  data.methodology = data.methodology || {};
  data.methodology.fortyAcresReceivedIncome = 'Received is a separate historical lifecycle from Unclaimed. A receipt is admitted only when an ERC20 payout transfer from a proven 40 Acres Portfolio to the company owner/configured recipient occurs in the same transaction as that Portfolio emitting RewardsProcessed. Tracking begins 2026-08-01. Received never changes current claimable totals, TVL, principal or execution authority.';
  data.diagnostics = data.diagnostics || {};
  data.diagnostics.fortyAcresReceived = {
    version: '0.1-august-received-lifecycle',
    generatedAt: new Date().toISOString(),
    trackingSince: TRACKING_SINCE,
    chain: 'Optimism',
    rpcEndpointClass: endpointClass,
    fromBlock,
    throughBlock: latestBlock,
    discoveredCompanies: Object.keys(discoveredByCompany),
    discoveredRouteCount,
    companiesWithReceived,
    receivedTransferCount,
    receivedUsd,
    unknownIsNotZero: true,
    claimableIsolation: true,
    executionAuthority: 'none'
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n');
  console.log('40 ACRES RECEIVED LEDGER PASS', data.diagnostics.fortyAcresReceived);
} finally {
  try { provider.destroy(); } catch {}
}
