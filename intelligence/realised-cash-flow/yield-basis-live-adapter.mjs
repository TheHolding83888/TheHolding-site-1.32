#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';
import { buildLedger } from './classifier.mjs';

const ROOT = process.cwd();
const OUT = process.env.REALISED_CASH_FLOW_OUTPUT || path.join(ROOT, 'intelligence/realised-cash-flow/realised-cash-flow.json');
const VERSION = '0.2-yield-basis-live-realised-cash-flow';
const ADAPTER_ID = 'yield-basis-fee-distributor-claim';
const FEE_DISTRIBUTOR = getAddress('0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90');
const CHAIN_ID = 1;
const WINDOW = Number(process.env.YB_LOG_WINDOW || 500_000);
const RPCS = [...new Set([
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com'
].map(x => String(x || '').trim()).filter(Boolean))];

const CLAIM_IFACE = new Interface(['event Claim(address indexed user,address indexed token,uint256 amount)']);
const ERC20_IFACE = new Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]);
const CLAIM_TOPIC = CLAIM_IFACE.getEvent('Claim').topicHash;
const TRANSFER_TOPIC = ERC20_IFACE.getEvent('Transfer').topicHash;

// Scope is intentionally inherited from the already-live Rewards route registry.
// These are the canonical company beneficiaries for which The Holding currently
// queries Yield Basis FeeDistributor.preview_claim. v0.2 measures only the
// historical direct-Claim lane for these exact identities.
const COMPANIES = [
  {
    company: 'dinaz.eth',
    wallets: [
      { alias: 'dinaz.eth', address: '0xcA2Ea0ef8eF6937e01EB9c72AEcaC24Dd1Ea7cEc' }
    ]
  },
  {
    company: 'defitea.eth',
    wallets: [
      { alias: 'defitea.eth', address: '0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3' },
      { alias: 'Defitea Operations', address: '0x6640C1AF0BF7e77fa223d4Af2F779e55dcFB8D2d' }
    ]
  },
  {
    company: 'aerocrvyb.eth',
    wallets: [
      { alias: 'Yield Basis wallet', address: '0x6c6543eBA07946706Fd10a1064FA773326B5f5a9' }
    ]
  },
  {
    company: '1milliondollar.eth',
    wallets: [
      { alias: '1milliondollar.eth', address: '0xe4b9c9ced406baffe406e63f83d39daaef150596' }
    ]
  }
].map(c => ({
  ...c,
  wallets: c.wallets.map(w => ({ ...w, address: getAddress(w.address) }))
}));

const WALLET_INDEX = new Map();
for (const company of COMPANIES) {
  for (const wallet of company.wallets) {
    const key = wallet.address.toLowerCase();
    if (WALLET_INDEX.has(key)) throw new Error(`Duplicate company boundary wallet: ${wallet.address}`);
    WALLET_INDEX.set(key, { company: company.company, ...wallet });
  }
}

function safeRpcLabel(url) {
  try {
    const host = new URL(url).hostname;
    return process.env.ETH_RPC_URL && url === process.env.ETH_RPC_URL ? 'ethereum:configured' : `ethereum:${host}`;
  } catch { return 'ethereum:configured'; }
}

function redact(value) {
  let text = String(value ?? '');
  for (const url of RPCS) if (url) text = text.split(url).join(`[${safeRpcLabel(url)}]`);
  return text;
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function connectProvider() {
  let last = null;
  for (const url of RPCS) {
    try {
      const provider = new JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true });
      const network = await Promise.race([
        provider.getNetwork(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('RPC timeout')), 10_000))
      ]);
      if (Number(network.chainId) !== CHAIN_ID) throw new Error(`wrong chainId ${network.chainId}`);
      const block = await provider.getBlockNumber();
      if (!Number.isInteger(block) || block <= 0) throw new Error('invalid latest block');
      return { provider, url, latestBlock: block };
    } catch (error) {
      last = error;
    }
  }
  throw new Error(`No Ethereum RPC available: ${redact(last?.message || last)}`);
}

async function getLogsRange(provider, fromBlock, toBlock, depth = 0) {
  try {
    return await provider.getLogs({
      address: FEE_DISTRIBUTOR,
      topics: [CLAIM_TOPIC],
      fromBlock,
      toBlock
    });
  } catch (error) {
    const span = toBlock - fromBlock;
    if (span > 5_000 && depth < 20) {
      const mid = Math.floor((fromBlock + toBlock) / 2);
      const left = await getLogsRange(provider, fromBlock, mid, depth + 1);
      const right = await getLogsRange(provider, mid + 1, toBlock, depth + 1);
      return [...left, ...right];
    }
    throw new Error(`Claim log scan failed at ${fromBlock}-${toBlock}: ${redact(error?.shortMessage || error?.message || error)}`);
  }
}

async function collectAllClaimLogs(provider, latestBlock) {
  const logs = [];
  let windows = 0;
  for (let from = 0; from <= latestBlock; from += WINDOW) {
    const to = Math.min(latestBlock, from + WINDOW - 1);
    const chunk = await getLogsRange(provider, from, to);
    logs.push(...chunk);
    windows += 1;
    if (windows % 10 === 0) console.log(`Yield Basis Claim scan progress: ${to}/${latestBlock}, logs=${logs.length}`);
    await sleep(35);
  }
  return { logs, windows };
}

const tokenMetaCache = new Map();
async function tokenMeta(provider, token) {
  const address = getAddress(token);
  const key = address.toLowerCase();
  if (tokenMetaCache.has(key)) return tokenMetaCache.get(key);
  const contract = new (await import('ethers')).Contract(address, ERC20_IFACE.fragments, provider);
  let symbol = 'TOKEN';
  let decimals = 18;
  try { symbol = String(await contract.symbol()); } catch {}
  try { decimals = Number(await contract.decimals()); } catch {}
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error(`Invalid token decimals for ${address}`);
  const meta = { address, symbol, decimals };
  tokenMetaCache.set(key, meta);
  return meta;
}

function parseClaim(log) {
  const parsed = CLAIM_IFACE.parseLog(log);
  if (!parsed || parsed.name !== 'Claim') throw new Error(`Could not parse Claim log ${log.transactionHash}:${log.index}`);
  return {
    user: getAddress(parsed.args.user),
    token: getAddress(parsed.args.token),
    amountRaw: BigInt(parsed.args.amount),
    transactionHash: log.transactionHash,
    logIndex: Number(log.index ?? log.logIndex),
    blockNumber: Number(log.blockNumber)
  };
}

function parseTransfer(log) {
  if (String(log?.topics?.[0] || '').toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) return null;
  try {
    const parsed = ERC20_IFACE.parseLog(log);
    if (!parsed || parsed.name !== 'Transfer') return null;
    return {
      from: getAddress(parsed.args.from),
      to: getAddress(parsed.args.to),
      value: BigInt(parsed.args.value),
      logIndex: Number(log.index ?? log.logIndex)
    };
  } catch { return null; }
}

async function proveValueReceipt(provider, claim, expectedWallet) {
  const receipt = await provider.getTransactionReceipt(claim.transactionHash);
  if (!receipt || Number(receipt.status) !== 1) throw new Error(`Claim tx is not successful: ${claim.transactionHash}`);
  const candidates = receipt.logs
    .filter(log => String(log.address || '').toLowerCase() === claim.token.toLowerCase())
    .map(parseTransfer)
    .filter(Boolean)
    .filter(x =>
      x.from.toLowerCase() === FEE_DISTRIBUTOR.toLowerCase() &&
      x.to.toLowerCase() === expectedWallet.toLowerCase() &&
      x.value === claim.amountRaw
    );
  if (candidates.length !== 1) {
    throw new Error(`Expected exactly one matching payout Transfer for ${claim.transactionHash}:${claim.logIndex}; got ${candidates.length}`);
  }
  return candidates[0];
}

async function blockTimestamp(provider, blockNumber, cache) {
  if (cache.has(blockNumber)) return cache.get(blockNumber);
  const block = await provider.getBlock(blockNumber);
  if (!block || !Number.isFinite(Number(block.timestamp))) throw new Error(`Missing block ${blockNumber}`);
  const value = new Date(Number(block.timestamp) * 1000).toISOString();
  cache.set(blockNumber, value);
  return value;
}

function directCompanyClaims(allLogs) {
  const matched = [];
  for (const log of allLogs) {
    const claim = parseClaim(log);
    const owner = WALLET_INDEX.get(claim.user.toLowerCase());
    if (owner) matched.push({ ...claim, owner });
  }
  return matched;
}

async function main() {
  const startedAt = new Date().toISOString();
  const { provider, url, latestBlock } = await connectProvider();
  const code = await provider.getCode(FEE_DISTRIBUTOR);
  if (!code || code === '0x') throw new Error('Configured Yield Basis FeeDistributor has no deployed code');

  const scan = await collectAllClaimLogs(provider, latestBlock);
  const matched = directCompanyClaims(scan.logs);
  const blockTimes = new Map();
  const candidatesByCompany = new Map(COMPANIES.map(x => [x.company, []]));
  const proofsByCompany = new Map(COMPANIES.map(x => [x.company, []]));

  for (const claim of matched) {
    const transfer = await proveValueReceipt(provider, claim, claim.owner.address);
    const meta = await tokenMeta(provider, claim.token);
    const timestamp = await blockTimestamp(provider, claim.blockNumber, blockTimes);
    const amount = Number(formatUnits(claim.amountRaw, meta.decimals));
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid normalized amount for ${claim.transactionHash}:${claim.logIndex}`);

    const candidate = {
      adapterId: ADAPTER_ID,
      company: claim.owner.company,
      beneficiary: claim.owner.address,
      protocol: 'Yield Basis',
      chainId: CHAIN_ID,
      transactionHash: claim.transactionHash,
      logIndex: claim.logIndex,
      timestamp,
      direction: 'in',
      asset: meta.symbol,
      token: meta.address,
      amount,
      economicKind: 'protocol-fee-payout',
      evidenceTier: 'A',
      protocolSemanticsVerified: true,
      companyBoundaryVerified: true,
      valueReceivedVerified: true,
      principalOrInternalContradiction: false,
      valuationStatus: 'not-valued',
      usdValue: null,
      source: `onchain: Yield Basis FeeDistributor Claim + ERC20 Transfer, block ${claim.blockNumber}`
    };
    candidatesByCompany.get(claim.owner.company).push(candidate);
    proofsByCompany.get(claim.owner.company).push({
      chainId: CHAIN_ID,
      contract: FEE_DISTRIBUTOR,
      transactionHash: claim.transactionHash,
      claimLogIndex: claim.logIndex,
      transferLogIndex: transfer.logIndex,
      blockNumber: claim.blockNumber,
      timestamp,
      claimUser: claim.user,
      beneficiary: claim.owner.address,
      walletAlias: claim.owner.alias,
      token: meta.address,
      symbol: meta.symbol,
      decimals: meta.decimals,
      amountRaw: claim.amountRaw.toString(),
      amount,
      claimSemantics: 'official FeeDistributor _claim transfers token then emits Claim(user, token, amount)',
      matchingTransfer: {
        from: transfer.from,
        to: transfer.to,
        valueRaw: transfer.value.toString()
      }
    });
  }

  const companies = {};
  for (const company of COMPANIES) {
    const candidates = candidatesByCompany.get(company.company) || [];
    const ledger = buildLedger(candidates, {
      generatedAt: new Date().toISOString(),
      scope: `${company.company}:supported-yield-basis-direct-claim-lane`,
      coverageComplete: false,
      coverageDeclaration: 'Yield Basis direct Claim(user=company wallet) history is completely scanned from block 0 through scan.toBlock. Overall company Realised Cash Flow remains incomplete until all economically relevant payout adapters are supported.'
    });
    companies[company.company] = {
      status: ledger.status,
      adapterCoverage: {
        adapterId: ADAPTER_ID,
        status: 'measured',
        completeForDeclaredLane: true,
        declaredLane: 'direct FeeDistributor Claim where Claim.user is an exact canonical company wallet and the same tx contains exactly one matching FeeDistributor ERC20 Transfer to that wallet',
        excluded: [
          'claims economically owned by the company but emitted with a different Claim.user (for example vesting/cliff ownership) unless separately proven',
          'other Yield Basis income mechanisms',
          'all non-Yield-Basis realised-income mechanisms'
        ]
      },
      wallets: company.wallets,
      directClaimEventCount: candidates.length,
      proofs: proofsByCompany.get(company.company) || [],
      ledger
    };
  }

  const allIncomeRows = Object.values(companies).flatMap(x => x.ledger.rows || []).filter(x => x.countedAsRealisedCashFlow);
  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    status: allIncomeRows.length ? 'partial' : 'unknown',
    scope: 'Realised Cash Flow evidence plane; first live adapter is Yield Basis direct FeeDistributor claims for currently supported Holding company wallets.',
    methodology: {
      primaryRule: 'receipt alone is not income',
      liveLaneRule: 'count only when official Claim semantics and an exact same-transaction ERC20 payout to the company wallet both agree',
      valuationRule: 'historical token quantity is factual; USD remains null until block/timestamp-bound valuation is separately proven',
      overallCoverageComplete: false,
      askPromotionEligible: false
    },
    source: {
      protocol: 'Yield Basis',
      chainId: CHAIN_ID,
      contract: FEE_DISTRIBUTOR,
      event: 'Claim(address indexed user,address indexed token,uint256 amount)',
      upstreamRepository: 'yield-basis/yb-core',
      upstreamTreeSha: '0c46a683f1187d2be1929f18dba44ad5dfd39006',
      upstreamPath: 'contracts/dao/FeeDistributor.vy',
      upstreamBlobSha: '8456fa2298f30692694f1e0f810b7cd404990fc7',
      productionAddressAlsoPresentInOfficialScripts: true
    },
    scan: {
      fromBlock: 0,
      toBlock: latestBlock,
      complete: true,
      requestedWindow: WINDOW,
      windowCount: scan.windows,
      allContractClaimLogCount: scan.logs.length,
      matchedDirectCompanyClaimLogCount: matched.length,
      rpc: safeRpcLabel(url)
    },
    summary: {
      companyCount: COMPANIES.length,
      companiesWithDirectClaims: Object.values(companies).filter(x => x.directClaimEventCount > 0).length,
      realisedIncomeEventCount: allIncomeRows.length,
      realisedCashFlowUsd: null,
      note: 'USD aggregate is intentionally null because v0.2 does not fabricate historical wrapper-token valuation.'
    },
    companies,
    authority: {
      modelCall: false,
      walletSigning: false,
      claiming: false,
      transactions: false,
      capitalMovement: false,
      executionAuthority: 'none'
    }
  };

  fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: output.status,
    generatedAt: output.generatedAt,
    toBlock: latestBlock,
    allClaims: scan.logs.length,
    matchedCompanyClaims: matched.length,
    companiesWithClaims: output.summary.companiesWithDirectClaims,
    realisedIncomeEvents: output.summary.realisedIncomeEventCount,
    executionAuthority: 'none'
  }, null, 2));
}

main().catch(error => {
  console.error(redact(error?.stack || error?.message || error));
  process.exit(1);
});
