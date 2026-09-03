#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { Contract, Interface, JsonRpcProvider, formatUnits, getAddress } from 'ethers';
import { buildLedger } from './classifier.mjs';

const ROOT = process.cwd();
const OUT = process.env.REALISED_CASH_FLOW_OUTPUT || path.join(ROOT, 'intelligence/realised-cash-flow/realised-cash-flow.json');
const VERSION = '0.2.3-yield-basis-live-realised-cash-flow-resilient-logs';
const ADAPTER_ID = 'yield-basis-fee-distributor-claim';
const CHAIN_ID = 1;
const FEE_DISTRIBUTOR = getAddress('0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90');
const DEPLOY_TX = '0xcd7321d6f67dc74f861266e56a7fee8285c3f5af663619ebb96581a083f0ef62';
const WINDOW = Math.max(1000, Math.min(20_000, Number(process.env.YB_LOG_WINDOW || 5000)));
const MIN_SPLIT_WINDOW = Math.max(100, Math.min(WINDOW, Number(process.env.YB_LOG_MIN_WINDOW || 250)));
const RPC_TIMEOUT_MS = Math.max(5000, Math.min(30_000, Number(process.env.YB_RPC_TIMEOUT_MS || 12_000)));
const STATE_RPC_URL = String(process.env.ETH_STATE_RPC_URL || 'https://ethereum-rpc.publicnode.com').trim();
const LOGS_RPC_URL = String(process.env.ETH_LOGS_RPC_URL || process.env.ETH_RPC_URL || 'https://rpc.flashbots.net').trim();
const LOG_RPC_URLS = [...new Set([
  LOGS_RPC_URL,
  String(process.env.ETH_RPC_URL || '').trim(),
  'https://rpc.flashbots.net',
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://1rpc.io/eth'
].filter(Boolean))];
const ALL_RPC_URLS = [...new Set([STATE_RPC_URL, ...LOG_RPC_URLS])];

const CLAIM_IFACE = new Interface(['event Claim(address indexed user,address indexed token,uint256 amount)']);
const ERC20_IFACE = new Interface([
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
]);
const CLAIM_TOPIC = CLAIM_IFACE.getEvent('Claim').topicHash;
const TRANSFER_TOPIC = ERC20_IFACE.getEvent('Transfer').topicHash;

const COMPANIES = [
  { company: 'dinaz.eth', wallets: [{ alias: 'dinaz.eth', address: '0xcA2Ea0ef8eF6937e01EB9c72AEcaC24Dd1Ea7cEc' }] },
  { company: 'defitea.eth', wallets: [
    { alias: 'defitea.eth', address: '0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3' },
    { alias: 'Defitea Operations', address: '0x6640C1AF0BF7e77fa223d4Af2F779e55dcFB8D2d' }
  ] },
  { company: 'aerocrvyb.eth', wallets: [{ alias: 'Yield Basis wallet', address: '0x6c6543eBA07946706Fd10a1064FA773326B5f5a9' }] },
  { company: '1milliondollar.eth', wallets: [{ alias: '1milliondollar.eth', address: '0xe4b9c9ced406baffe406e63f83d39daaef150596' }] }
].map(c => ({ ...c, wallets: c.wallets.map(w => ({ ...w, address: getAddress(w.address) })) }));

const WALLET_INDEX = new Map();
for (const company of COMPANIES) {
  for (const wallet of company.wallets) {
    const key = wallet.address.toLowerCase();
    if (WALLET_INDEX.has(key)) throw new Error(`Duplicate company boundary wallet: ${wallet.address}`);
    WALLET_INDEX.set(key, { company: company.company, ...wallet });
  }
}
const TRACKED_USER_TOPICS = [...WALLET_INDEX.keys()].map(address => `0x${address.slice(2).padStart(64, '0')}`);

function rpcLabel(url, role) {
  try { return `${role}:${new URL(url).hostname}`; }
  catch { return `${role}:configured`; }
}
function redact(value) {
  let text = String(value ?? '');
  for (const url of ALL_RPC_URLS) if (url) text = text.split(url).join('[ethereum-rpc]');
  return text;
}
function rpcInt(value, label = 'RPC integer') {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(n) || n < 0) throw new Error(`Invalid ${label}: ${String(value)}`);
  return n;
}
function blockHex(blockNumber) {
  if (!Number.isSafeInteger(blockNumber) || blockNumber < 0) throw new Error(`Invalid block number: ${blockNumber}`);
  return `0x${blockNumber.toString(16)}`;
}
async function rawRpc(url, method, params = [], timeoutMs = RPC_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json();
    if (!body || body.error) throw new Error(body?.error?.message || 'JSON-RPC error');
    if (!Object.prototype.hasOwnProperty.call(body, 'result')) throw new Error('JSON-RPC result missing');
    return body.result;
  } catch (error) {
    const message = error?.name === 'AbortError' ? `timeout after ${timeoutMs}ms` : (error?.message || String(error));
    throw new Error(`${rpcLabel(url, 'rpc')} ${method} failed: ${redact(message)}`);
  } finally {
    clearTimeout(timer);
  }
}
async function connectEndpoint(url, role) {
  const provider = new JsonRpcProvider(url, CHAIN_ID, { staticNetwork: true });
  const network = await Promise.race([
    provider.getNetwork(),
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${role} RPC network timeout`)), 10_000))
  ]);
  if (Number(network.chainId) !== CHAIN_ID) throw new Error(`${role} RPC wrong chainId ${network.chainId}`);
  const latestBlock = await provider.getBlockNumber();
  if (!Number.isInteger(latestBlock) || latestBlock <= 0) throw new Error(`${role} RPC invalid latest block`);
  return { provider, latestBlock, label: rpcLabel(url, role) };
}
async function probeLogsEndpoints(stateLatestBlock) {
  const healthy = [];
  const failures = [];
  for (const url of LOG_RPC_URLS) {
    try {
      const chainId = rpcInt(await rawRpc(url, 'eth_chainId'), 'chainId');
      if (chainId !== CHAIN_ID) throw new Error(`wrong chainId ${chainId}`);
      const latestBlock = rpcInt(await rawRpc(url, 'eth_blockNumber'), 'latest block');
      const headLagBlocks = Math.abs(stateLatestBlock - latestBlock);
      if (headLagBlocks > 64) throw new Error(`head divergence ${headLagBlocks} > 64`);
      healthy.push({ url, latestBlock, headLagBlocks, label: rpcLabel(url, 'logs') });
    } catch (error) {
      failures.push(`${rpcLabel(url, 'logs')}: ${redact(error?.message || error)}`);
    }
  }
  if (!healthy.length) throw new Error(`No coherent Ethereum historical-log endpoint available. ${failures.join(' | ')}`);
  healthy.sort((a, b) => a.headLagBlocks - b.headLagBlocks);
  return { healthy, failures };
}
async function connectEvidencePlane() {
  const state = await connectEndpoint(STATE_RPC_URL, 'state');
  const logs = await probeLogsEndpoints(state.latestBlock);
  const latestBlock = Math.min(state.latestBlock, ...logs.healthy.map(x => x.latestBlock));
  const headLagBlocks = Math.max(...logs.healthy.map(x => Math.abs(state.latestBlock - x.latestBlock)));
  return { state, logs, latestBlock, headLagBlocks };
}
async function proveDeployment(stateProvider, latestBlock) {
  const receipt = await stateProvider.getTransactionReceipt(DEPLOY_TX);
  if (!receipt) throw new Error('Yield Basis FeeDistributor deployment receipt unavailable');
  if (Number(receipt.status) !== 1) throw new Error('Yield Basis FeeDistributor deployment transaction is not successful');
  if (!receipt.contractAddress || getAddress(receipt.contractAddress) !== FEE_DISTRIBUTOR) throw new Error(`Deployment contract mismatch: ${receipt.contractAddress || 'null'}`);
  const deploymentBlock = Number(receipt.blockNumber);
  if (!Number.isInteger(deploymentBlock) || deploymentBlock <= 0 || deploymentBlock > latestBlock) throw new Error(`Invalid deployment block: ${receipt.blockNumber}`);
  const code = await stateProvider.getCode(FEE_DISTRIBUTOR, latestBlock);
  if (!code || code === '0x') throw new Error('Configured Yield Basis FeeDistributor has no runtime code');
  return { deploymentBlock, deploymentTx: DEPLOY_TX, contractAddress: FEE_DISTRIBUTOR };
}
function normalizeRawLog(log) {
  if (!log || typeof log !== 'object' || !Array.isArray(log.topics) || typeof log.data !== 'string') throw new Error('Malformed eth_getLogs row');
  return {
    ...log,
    blockNumber: rpcInt(log.blockNumber, 'log blockNumber'),
    logIndex: rpcInt(log.logIndex, 'logIndex'),
    index: rpcInt(log.logIndex, 'logIndex')
  };
}
function createScanStats(endpoints) {
  return {
    topLevelWindows: 0,
    successfulLeafWindows: 0,
    requestAttemptCount: 0,
    splitCount: 0,
    minimumSuccessfulWindow: null,
    successCounts: Object.fromEntries(endpoints.map(x => [x.label, 0])),
    preferredEndpointIndex: 0
  };
}
async function requestLogsFromEndpoint(endpoint, fromBlock, toBlock, stats) {
  stats.requestAttemptCount += 1;
  const result = await rawRpc(endpoint.url, 'eth_getLogs', [{
    address: FEE_DISTRIBUTOR,
    topics: [CLAIM_TOPIC, TRACKED_USER_TOPICS],
    fromBlock: blockHex(fromBlock),
    toBlock: blockHex(toBlock)
  }]);
  if (!Array.isArray(result)) throw new Error('eth_getLogs result is not an array');
  return result.map(normalizeRawLog);
}
async function getLogsRangeResilient(endpoints, fromBlock, toBlock, stats) {
  const errors = [];
  for (let offset = 0; offset < endpoints.length; offset += 1) {
    const index = (stats.preferredEndpointIndex + offset) % endpoints.length;
    const endpoint = endpoints[index];
    try {
      const logs = await requestLogsFromEndpoint(endpoint, fromBlock, toBlock, stats);
      stats.preferredEndpointIndex = index;
      stats.successfulLeafWindows += 1;
      const width = toBlock - fromBlock + 1;
      stats.minimumSuccessfulWindow = stats.minimumSuccessfulWindow === null ? width : Math.min(stats.minimumSuccessfulWindow, width);
      stats.successCounts[endpoint.label] = (stats.successCounts[endpoint.label] || 0) + 1;
      return logs;
    } catch (error) {
      errors.push(`${endpoint.label}: ${redact(error?.message || error)}`);
    }
  }

  const width = toBlock - fromBlock + 1;
  if (width > MIN_SPLIT_WINDOW) {
    const mid = Math.floor((fromBlock + toBlock) / 2);
    stats.splitCount += 1;
    const left = await getLogsRangeResilient(endpoints, fromBlock, mid, stats);
    const right = await getLogsRangeResilient(endpoints, mid + 1, toBlock, stats);
    return [...left, ...right];
  }
  throw new Error(`Claim log range failed closed at ${fromBlock}-${toBlock} after all coherent providers: ${errors.join(' | ')}`);
}
async function collectClaimLogs(endpoints, fromBlock, latestBlock) {
  const logs = [];
  const stats = createScanStats(endpoints);
  for (let from = fromBlock; from <= latestBlock; from += WINDOW) {
    const to = Math.min(latestBlock, from + WINDOW - 1);
    stats.topLevelWindows += 1;
    logs.push(...await getLogsRangeResilient(endpoints, from, to, stats));
    if (stats.topLevelWindows % 100 === 0) {
      console.log(`Yield Basis tracked-user historical scan: window=${stats.topLevelWindows} through=${to} claims=${logs.length} attempts=${stats.requestAttemptCount} splits=${stats.splitCount}`);
    }
  }
  logs.sort((a, b) => a.blockNumber - b.blockNumber || a.logIndex - b.logIndex);
  const physicalIds = new Set();
  for (const log of logs) {
    const id = `${String(log.transactionHash).toLowerCase()}:${log.logIndex}`;
    if (physicalIds.has(id)) throw new Error(`Duplicate physical Claim log returned by historical transport: ${id}`);
    physicalIds.add(id);
  }
  return { logs, stats };
}
function parseClaim(log) {
  const parsed = CLAIM_IFACE.parseLog({ topics: log.topics, data: log.data });
  if (!parsed || parsed.name !== 'Claim') throw new Error(`Could not parse Claim log ${log.transactionHash}:${log.logIndex}`);
  return {
    user: getAddress(parsed.args.user), token: getAddress(parsed.args.token), amountRaw: BigInt(parsed.args.amount),
    transactionHash: String(log.transactionHash).toLowerCase(), logIndex: log.logIndex, blockNumber: log.blockNumber
  };
}
function directCompanyClaims(allLogs) {
  const matched = [];
  for (const log of allLogs) {
    const claim = parseClaim(log);
    const owner = WALLET_INDEX.get(claim.user.toLowerCase());
    if (owner) matched.push({ ...claim, owner });
  }
  if (matched.length !== allLogs.length) throw new Error(`Tracked-user topic filter returned ${allLogs.length - matched.length} unowned Claim logs`);
  return matched;
}
function parseTransfer(log) {
  if (String(log?.topics?.[0] || '').toLowerCase() !== TRANSFER_TOPIC.toLowerCase()) return null;
  try {
    const parsed = ERC20_IFACE.parseLog(log);
    if (!parsed || parsed.name !== 'Transfer') return null;
    return { from: getAddress(parsed.args.from), to: getAddress(parsed.args.to), value: BigInt(parsed.args.value), logIndex: Number(log.index ?? log.logIndex) };
  } catch { return null; }
}
async function proveValueReceipt(stateProvider, claim) {
  const receipt = await stateProvider.getTransactionReceipt(claim.transactionHash);
  if (!receipt || Number(receipt.status) !== 1) throw new Error(`Claim tx receipt unavailable or unsuccessful: ${claim.transactionHash}`);
  const matches = receipt.logs
    .filter(log => String(log.address || '').toLowerCase() === claim.token.toLowerCase())
    .map(parseTransfer).filter(Boolean)
    .filter(x => x.from.toLowerCase() === FEE_DISTRIBUTOR.toLowerCase() && x.to.toLowerCase() === claim.owner.address.toLowerCase() && x.value === claim.amountRaw);
  if (matches.length !== 1) throw new Error(`Expected exactly one matching payout Transfer for ${claim.transactionHash}:${claim.logIndex}; got ${matches.length}`);
  return matches[0];
}
const tokenMetaCache = new Map();
async function tokenMeta(stateProvider, token, blockTag) {
  const address = getAddress(token);
  const key = address.toLowerCase();
  if (tokenMetaCache.has(key)) return tokenMetaCache.get(key);
  const contract = new Contract(address, ERC20_IFACE.fragments, stateProvider);
  let symbol = 'TOKEN'; let decimals = 18;
  try { symbol = String(await contract.symbol({ blockTag })); } catch {}
  try { decimals = Number(await contract.decimals({ blockTag })); } catch {}
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) throw new Error(`Invalid token decimals for ${address}`);
  const meta = { address, symbol, decimals }; tokenMetaCache.set(key, meta); return meta;
}
const blockTimeCache = new Map();
async function blockTimestamp(stateProvider, blockNumber) {
  if (blockTimeCache.has(blockNumber)) return blockTimeCache.get(blockNumber);
  const block = await stateProvider.getBlock(blockNumber);
  if (!block || !Number.isFinite(Number(block.timestamp))) throw new Error(`Missing block ${blockNumber}`);
  const timestamp = new Date(Number(block.timestamp) * 1000).toISOString(); blockTimeCache.set(blockNumber, timestamp); return timestamp;
}

async function main() {
  const startedAt = new Date().toISOString();
  const evidence = await connectEvidencePlane();
  const deployment = await proveDeployment(evidence.state.provider, evidence.latestBlock);
  const scan = await collectClaimLogs(evidence.logs.healthy, deployment.deploymentBlock, evidence.latestBlock);
  const matched = directCompanyClaims(scan.logs);
  const candidatesByCompany = new Map(COMPANIES.map(x => [x.company, []]));
  const proofsByCompany = new Map(COMPANIES.map(x => [x.company, []]));

  for (const claim of matched) {
    const transfer = await proveValueReceipt(evidence.state.provider, claim);
    const meta = await tokenMeta(evidence.state.provider, claim.token, claim.blockNumber);
    const timestamp = await blockTimestamp(evidence.state.provider, claim.blockNumber);
    const amountText = formatUnits(claim.amountRaw, meta.decimals);
    const amount = Number(amountText);
    if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid normalized amount for ${claim.transactionHash}:${claim.logIndex}`);
    candidatesByCompany.get(claim.owner.company).push({
      adapterId: ADAPTER_ID, company: claim.owner.company, beneficiary: claim.owner.address, protocol: 'Yield Basis', chainId: CHAIN_ID,
      transactionHash: claim.transactionHash, logIndex: claim.logIndex, timestamp, direction: 'in', asset: meta.symbol, token: meta.address, amount,
      economicKind: 'protocol-fee-payout', evidenceTier: 'A', protocolSemanticsVerified: true, companyBoundaryVerified: true,
      valueReceivedVerified: true, principalOrInternalContradiction: false, valuationStatus: 'not-valued', usdValue: null,
      source: `onchain: Yield Basis FeeDistributor Claim + exact ERC20 Transfer, block ${claim.blockNumber}`
    });
    proofsByCompany.get(claim.owner.company).push({
      chainId: CHAIN_ID, contract: FEE_DISTRIBUTOR, transactionHash: claim.transactionHash, claimLogIndex: claim.logIndex,
      transferLogIndex: transfer.logIndex, blockNumber: claim.blockNumber, timestamp, claimUser: claim.user, beneficiary: claim.owner.address,
      walletAlias: claim.owner.alias, token: meta.address, symbol: meta.symbol, decimals: meta.decimals, amountRaw: claim.amountRaw.toString(),
      amount: amountText, matchingTransfer: { from: transfer.from, to: transfer.to, valueRaw: transfer.value.toString() }
    });
  }

  const companies = {};
  for (const company of COMPANIES) {
    const candidates = candidatesByCompany.get(company.company) || [];
    const ledger = buildLedger(candidates, {
      generatedAt: new Date().toISOString(), scope: `${company.company}:yield-basis-direct-claim-lane`, coverageComplete: false,
      coverageDeclaration: `Yield Basis direct Claim.user=company-wallet history is completely scanned from proven FeeDistributor deployment block ${deployment.deploymentBlock} through block ${evidence.latestBlock}. Overall company Realised Cash Flow remains incomplete.`
    });
    companies[company.company] = {
      status: ledger.status,
      adapterCoverage: {
        adapterId: ADAPTER_ID, status: 'measured', completeForDeclaredLane: true,
        declaredLane: 'Claim.user is an exact canonical company wallet and the same successful tx contains exactly one matching FeeDistributor ERC20 Transfer to that wallet',
        excluded: ['claims where economic ownership exists but Claim.user differs from the receiving company boundary unless separately proven','other Yield Basis realised-income mechanisms','all non-Yield-Basis realised-income mechanisms']
      },
      wallets: company.wallets, directClaimEventCount: candidates.length, proofs: proofsByCompany.get(company.company) || [], ledger
    };
  }

  const allIncomeRows = Object.values(companies).flatMap(x => x.ledger.rows || []).filter(x => x.countedAsRealisedCashFlow);
  const endpointLabels = evidence.logs.healthy.map(x => x.label);
  const output = {
    version: VERSION, generatedAt: new Date().toISOString(), startedAt,
    status: allIncomeRows.length ? 'partial' : 'unknown',
    scope: 'Realised Cash Flow evidence plane; first live adapter is Yield Basis direct FeeDistributor claims for supported Holding company wallets.',
    methodology: {
      primaryRule: 'receipt alone is not income',
      liveLaneRule: 'count only when official Claim semantics and an exact same-transaction ERC20 payout to the exact company wallet both agree',
      valuationRule: 'historical token quantity is factual; USD remains null until block/timestamp-bound valuation is separately proven',
      overallCoverageComplete: false, askPromotionEligible: false
    },
    source: {
      protocol: 'Yield Basis', chainId: CHAIN_ID, contract: FEE_DISTRIBUTOR,
      event: 'Claim(address indexed user,address indexed token,uint256 amount)', deploymentTx: DEPLOY_TX,
      deploymentBlock: deployment.deploymentBlock, deploymentReceiptVerified: true,
      upstreamRepository: 'yield-basis/yb-core', upstreamTreeSha: '0c46a683f1187d2be1929f18dba44ad5dfd39006',
      upstreamPath: 'contracts/dao/FeeDistributor.vy', upstreamBlobSha: '8456fa2298f30692694f1e0f810b7cd404990fc7',
      productionAddressAlsoPresentInOfficialScripts: true, compilerReproducedBytecodeBindingClaimed: false
    },
    scan: {
      fromBlock: deployment.deploymentBlock, toBlock: evidence.latestBlock, complete: true,
      startRule: 'exact successful contract-creation receipt for the configured FeeDistributor',
      queryScope: 'Claim event + exact tracked Claim.user topic OR filter',
      trackedUserCount: TRACKED_USER_TOPICS.length,
      requestedWindow: WINDOW,
      minimumSplitWindow: MIN_SPLIT_WINDOW,
      topLevelWindowCount: scan.stats.topLevelWindows,
      windowCount: scan.stats.successfulLeafWindows,
      requestAttemptCount: scan.stats.requestAttemptCount,
      splitCount: scan.stats.splitCount,
      minimumSuccessfulWindow: scan.stats.minimumSuccessfulWindow,
      allContractClaimLogCount: null,
      allContractClaimLogCountMeasured: false,
      trackedUserClaimLogCount: scan.logs.length,
      matchedDirectCompanyClaimLogCount: matched.length,
      providers: {
        state: evidence.state.label,
        historicalLogs: 'logs:multi-provider-failover',
        endpoints: endpointLabels,
        successCounts: scan.stats.successCounts,
        headLagBlocks: evidence.headLagBlocks
      }
    },
    summary: {
      companyCount: COMPANIES.length, companiesWithDirectClaims: Object.values(companies).filter(x => x.directClaimEventCount > 0).length,
      realisedIncomeEventCount: allIncomeRows.length, realisedCashFlowUsd: null,
      note: 'USD aggregate is intentionally null because v0.2 does not fabricate historical wrapper/reward-token valuation.'
    },
    companies,
    authority: { modelCall: false, walletSigning: false, claiming: false, transactions: false, capitalMovement: false, executionAuthority: 'none' }
  };
  fs.writeFileSync(OUT, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({
    status: output.status, generatedAt: output.generatedAt, deploymentBlock: deployment.deploymentBlock, toBlock: evidence.latestBlock,
    scanWindows: scan.stats.successfulLeafWindows, topLevelWindows: scan.stats.topLevelWindows, attempts: scan.stats.requestAttemptCount,
    trackedUserClaims: scan.logs.length, matchedCompanyClaims: matched.length,
    companiesWithClaims: output.summary.companiesWithDirectClaims, realisedIncomeEvents: output.summary.realisedIncomeEventCount,
    providers: output.scan.providers, executionAuthority: 'none'
  }, null, 2));
}

main().catch(error => { console.error(redact(error?.stack || error?.message || error)); process.exit(1); });
