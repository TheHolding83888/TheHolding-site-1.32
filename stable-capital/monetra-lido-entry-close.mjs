#!/usr/bin/env node
/**
 * THE HOLDING · MONETRA LIDO EARNUSD TARGETED CLOSE v0.5
 *
 * Scope: ONLY the remaining Lido EarnUSD row in Company #008 Strategy Entry Ledger.
 *
 * Input:
 *   /companies/company-008-strategy-entry-ledger.json  (must be v0.4, 9/10 solved)
 *
 * Output:
 *   /companies/company-008-strategy-entry-ledger.json  (v0.5)
 *
 * Canonical Mellow mechanics used:
 * - ShareManager.sharesOf(account) = active + claimable shares.
 * - ShareManager.vault() -> ShareModule.
 * - ShareModule.oracle(), assetAt(), queueAt(), isDepositQueue().
 * - DepositQueue DepositRequested(account, referral, assets, timestamp) gives exact
 *   stable-token strategy entry principal.
 * - Oracle invariant: shares = assets * priceD18 / 1e18.
 *   Therefore current nominal asset units = shares * 1e18 / priceD18.
 *
 * No wrapper market price is used for Performance.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  Interface,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  id,
  zeroPadValue
} from 'ethers';

const VERSION = '0.5-monetra-lido-share-oracle-close';
const METHODOLOGY = '0.5-lido-depositqueue-sharemanager-oracle';
const ROOT = path.resolve(process.cwd());

const IN_FILE =
  process.env.MONETRA_STRATEGY_ENTRY_LEDGER_FILE ||
  path.join(ROOT, 'companies', 'company-008-strategy-entry-ledger.json');

const OUT_FILE = IN_FILE;

const WALLET = addr('0x888D39aeE2AEC979c81f125EA94BB3cEB60F6bBB');
const SHARE_MANAGER = addr('0x4Ce1ac8F43E0E5BD7A346A98aF777bF8fbeA1981');
const LIDO_ID = 'ethereum:0x4ce1ac8f43e0e5bd7a346a98af777bf8fbea1981';

const ONE = 10n ** 18n;
const DEPOSIT_REQUESTED_TOPIC = id('DepositRequested(address,address,uint224,uint32)');
const DEPOSIT_CANCELED_TOPIC = id('DepositRequestCanceled(address,uint256,uint32)');
const BURN_TOPIC = id('Burn(address,uint256)');
const TRANSFER_TOPIC = id('Transfer(address,address,uint256)');

const DEPOSIT_IFACE = new Interface([
  'event DepositRequested(address indexed account,address indexed referral,uint224 assets,uint32 timestamp)',
  'event DepositRequestCanceled(address indexed account,uint256 assets,uint32 timestamp)'
]);

const RPCS = unique([
  process.env.ETH_ARCHIVE_RPC_URL,
  process.env.ETH_RPC_URL,
  process.env.ETH_RPC_URL_2,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://eth.blockscout.com/api/eth-rpc'
]);

function addr(x) {
  try { return getAddress(String(x).toLowerCase()); }
  catch { return null; }
}
function lower(x) { return String(x || '').toLowerCase(); }
function unique(xs) { return [...new Set((xs || []).filter(Boolean))]; }
function finite(x) {
  return x !== null && x !== undefined && x !== '' && Number.isFinite(Number(x));
}
function round(x, d = 12) {
  return finite(x) ? Number(Number(x).toFixed(d)) : null;
}
function nowIso() { return new Date().toISOString(); }
function safeBig(x) { try { return BigInt(x); } catch { return 0n; } }
function errorText(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown').slice(0, 1800);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}
function topicAddress(a) { return zeroPadValue(a, 32); }

async function withProvider(fn) {
  const attempts = [];
  for (const url of RPCS) {
    let provider;
    try {
      provider = new JsonRpcProvider(url, 1, { staticNetwork: true });
      const net = await provider.getNetwork();
      if (Number(net.chainId) !== 1) throw new Error(`wrong chain ${net.chainId}`);
      const value = await fn(provider, url);
      try { provider.destroy?.(); } catch {}
      return { ok: true, value, providerUrl: url, attempts };
    } catch (e) {
      attempts.push({ url, error: errorText(e) });
      try { provider?.destroy?.(); } catch {}
    }
  }
  return { ok: false, error: 'all providers failed', attempts };
}

async function findBlockAtOrBefore(provider, targetTs) {
  const latest = await provider.getBlock('latest');
  if (!latest) throw new Error('latest block unavailable');
  let lo = 0;
  let hi = Number(latest.number);
  let best = 0;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await provider.getBlock(mid);
    if (!b) { hi = mid - 1; continue; }
    if (Number(b.timestamp) <= targetTs) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const out = await provider.getBlock(best);
  if (!out) throw new Error('historical block unavailable');
  return out;
}

async function getLogsAdaptive(provider, filter, fromBlock, toBlock, depth = 0) {
  try {
    return await provider.getLogs({ ...filter, fromBlock, toBlock });
  } catch (e) {
    if (fromBlock >= toBlock || depth >= 14) throw e;
    const mid = Math.floor((fromBlock + toBlock) / 2);
    const a = await getLogsAdaptive(provider, filter, fromBlock, mid, depth + 1);
    const b = await getLogsAdaptive(provider, filter, mid + 1, toBlock, depth + 1);
    return [...a, ...b];
  }
}

async function tokenMeta(provider, token) {
  const c = new Contract(token, [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)'
  ], provider);
  let symbol = null;
  let decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 36) {
    throw new Error(`invalid decimals for ${token}`);
  }
  return { symbol, decimals };
}

async function discoverArchitecture(provider) {
  const share = new Contract(SHARE_MANAGER, [
    'function vault() view returns (address)',
    'function sharesOf(address) view returns (uint256)',
    'function activeSharesOf(address) view returns (uint256)',
    'function claimableSharesOf(address) view returns (uint256)'
  ], provider);

  const vault = addr(await share.vault());
  if (!vault) throw new Error('ShareManager vault unavailable');

  const module = new Contract(vault, [
    'function oracle() view returns (address)',
    'function getAssetCount() view returns (uint256)',
    'function assetAt(uint256) view returns (address)',
    'function getQueueCount(address) view returns (uint256)',
    'function queueAt(address,uint256) view returns (address)',
    'function isDepositQueue(address) view returns (bool)'
  ], provider);

  const oracle = addr(await module.oracle());
  if (!oracle) throw new Error('ShareModule oracle unavailable');

  const assetCount = Number(await module.getAssetCount());
  if (!(assetCount > 0 && assetCount <= 20)) {
    throw new Error(`implausible assetCount ${assetCount}`);
  }

  const assets = [];
  for (let i = 0; i < assetCount; i++) {
    const asset = addr(await module.assetAt(i));
    if (!asset) continue;
    const meta = await tokenMeta(provider, asset);
    const queueCount = Number(await module.getQueueCount(asset));
    const queues = [];
    for (let j = 0; j < queueCount; j++) {
      const q = addr(await module.queueAt(asset, j));
      if (!q) continue;
      const isDeposit = Boolean(await module.isDepositQueue(q));
      if (isDeposit) queues.push(q);
    }
    assets.push({ asset, ...meta, queues });
  }

  if (!assets.some(a => a.queues.length)) {
    throw new Error('no dynamic Lido/Mellow deposit queues found');
  }

  const sharesRaw = safeBig(await share.sharesOf(WALLET));
  const activeSharesRaw = safeBig(await share.activeSharesOf(WALLET));
  const claimableSharesRaw = safeBig(await share.claimableSharesOf(WALLET));

  if (sharesRaw <= 0n) throw new Error('Monetra has no Lido shares');
  if (sharesRaw !== activeSharesRaw + claimableSharesRaw) {
    throw new Error('sharesOf invariant failed');
  }

  return {
    share,
    module,
    vault,
    oracle,
    assets,
    sharesRaw,
    activeSharesRaw,
    claimableSharesRaw
  };
}

async function scanQueueLifecycle(provider, queue, fromBlock, toBlock) {
  const requestLogs = await getLogsAdaptive(provider, {
    address: queue,
    topics: [DEPOSIT_REQUESTED_TOPIC, topicAddress(WALLET)]
  }, fromBlock, toBlock);

  const cancelLogs = await getLogsAdaptive(provider, {
    address: queue,
    topics: [DEPOSIT_CANCELED_TOPIC, topicAddress(WALLET)]
  }, fromBlock, toBlock);

  const requests = [];
  for (const l of requestLogs) {
    const p = DEPOSIT_IFACE.parseLog({ topics: l.topics, data: l.data });
    if (!p || p.name !== 'DepositRequested') continue;
    const b = await provider.getBlock(l.blockNumber);
    requests.push({
      txHash: l.transactionHash,
      block: Number(l.blockNumber),
      logIndex: Number(l.index ?? l.logIndex ?? 0),
      chainTimestamp: b ? new Date(Number(b.timestamp) * 1000).toISOString() : null,
      requestTimestamp: Number(p.args.timestamp),
      assetsRaw: safeBig(p.args.assets).toString(),
      referral: addr(p.args.referral)
    });
  }

  const cancels = [];
  for (const l of cancelLogs) {
    const p = DEPOSIT_IFACE.parseLog({ topics: l.topics, data: l.data });
    if (!p || p.name !== 'DepositRequestCanceled') continue;
    cancels.push({
      txHash: l.transactionHash,
      block: Number(l.blockNumber),
      logIndex: Number(l.index ?? l.logIndex ?? 0),
      assetsRaw: safeBig(p.args.assets).toString(),
      requestTimestamp: Number(p.args.timestamp)
    });
  }

  const canceledKeys = new Set(
    cancels.map(c => `${c.requestTimestamp}:${c.assetsRaw}`)
  );

  const effective = requests.filter(r =>
    !canceledKeys.has(`${r.requestTimestamp}:${r.assetsRaw}`)
  );

  return { requests, cancels, effective };
}

async function discoverEntry(provider, architecture, fromBlock) {
  const latest = await provider.getBlockNumber();
  const candidates = [];

  for (const a of architecture.assets) {
    for (const queue of a.queues) {
      const life = await scanQueueLifecycle(provider, queue, fromBlock, latest);
      for (const r of life.effective) {
        candidates.push({
          ...r,
          asset: a.asset,
          symbol: a.symbol,
          decimals: a.decimals,
          queue,
          principalNominalStable: Number(formatUnits(BigInt(r.assetsRaw), a.decimals)),
          requestCountOnQueue: life.requests.length,
          canceledCountOnQueue: life.cancels.length
        });
      }
    }
  }

  candidates.sort((a, b) =>
    a.block - b.block || a.logIndex - b.logIndex
  );

  if (!candidates.length) {
    throw new Error('no effective Monetra DepositRequested event found in dynamic Lido queues');
  }

  // Monetra was intentionally seeded with ~10 units once. Fail closed if the live
  // history no longer matches that bounded architecture.
  if (candidates.length !== 1) {
    throw new Error(`expected exactly one effective Lido deposit, found ${candidates.length}`);
  }

  const entry = candidates[0];
  if (!(entry.principalNominalStable > 9 && entry.principalNominalStable < 11)) {
    throw new Error(`Lido entry principal outside expected ~10 stable range: ${entry.principalNominalStable}`);
  }

  return { entry, allEffectiveDeposits: candidates };
}

async function scanShareOutflows(provider, fromBlock) {
  const latest = await provider.getBlockNumber();

  const burns = await getLogsAdaptive(provider, {
    address: SHARE_MANAGER,
    topics: [BURN_TOPIC, topicAddress(WALLET)]
  }, fromBlock, latest);

  // If the ShareManager is tokenized, detect direct outgoing transfers too.
  let outgoingTransfers = [];
  try {
    outgoingTransfers = await getLogsAdaptive(provider, {
      address: SHARE_MANAGER,
      topics: [TRANSFER_TOPIC, topicAddress(WALLET)]
    }, fromBlock, latest);
    outgoingTransfers = outgoingTransfers.filter(l => {
      const to = addr('0x' + String(l.topics?.[2] || '').slice(-40));
      return to && lower(to) !== lower(WALLET);
    });
  } catch {}

  return {
    burnCount: burns.length,
    outgoingTransferCount: outgoingTransfers.length,
    burns: burns.map(l => ({
      txHash: l.transactionHash,
      block: Number(l.blockNumber),
      raw: safeBig(l.data).toString()
    })),
    outgoingTransfers: outgoingTransfers.map(l => ({
      txHash: l.transactionHash,
      block: Number(l.blockNumber),
      to: addr('0x' + String(l.topics?.[2] || '').slice(-40)),
      raw: safeBig(l.data).toString()
    }))
  };
}

async function resolveCurrent(provider, architecture, entry) {
  const oracle = new Contract(architecture.oracle, [
    'function getReport(address) view returns (uint224 priceD18,uint32 timestamp,bool isSuspicious)'
  ], provider);

  const report = await oracle.getReport(entry.asset);
  const priceD18 = safeBig(report.priceD18 ?? report[0]);
  const timestamp = Number(report.timestamp ?? report[1]);
  const isSuspicious = Boolean(report.isSuspicious ?? report[2]);

  if (priceD18 <= 0n) throw new Error('Lido oracle priceD18 is zero');
  if (isSuspicious) throw new Error('Lido oracle report is suspicious');

  // Canonical Mellow invariant from IOracle:
  // shares = assets * priceD18 / 1e18
  // => assets = shares * 1e18 / priceD18
  const currentAssetsRaw = architecture.sharesRaw * ONE / priceD18;
  const currentNominal = Number(formatUnits(currentAssetsRaw, entry.decimals));

  if (!(currentNominal > 9 && currentNominal < 12)) {
    throw new Error(`implausible current Lido nominal amount ${currentNominal}`);
  }

  return {
    comparable: true,
    nominal: round(currentNominal, 12),
    principalInsidePosition: round(currentNominal, 12),
    claimableAdded: 0,
    symbol: entry.symbol || 'stable asset',
    basis: 'Mellow ShareManager.sharesOf / Oracle.getReport inverse conversion; wrapper market price excluded',
    sharesRaw: architecture.sharesRaw.toString(),
    activeSharesRaw: architecture.activeSharesRaw.toString(),
    claimableSharesRaw: architecture.claimableSharesRaw.toString(),
    oracle: architecture.oracle,
    oracleAsset: entry.asset,
    oraclePriceD18: priceD18.toString(),
    oracleReportTimestamp: timestamp,
    oracleReportIso: timestamp ? new Date(timestamp * 1000).toISOString() : null,
    oracleSuspicious: isSuspicious
  };
}

function recomputeSummary(rows) {
  const entryResolved = rows.filter(r => finite(r?.entry?.principalNominalStable));
  const comparable = rows.filter(r => r?.performance?.status === 'comparable');

  const principal = round(
    entryResolved.reduce((s, r) => s + Number(r.entry.principalNominalStable), 0),
    12
  );
  const comparablePrincipal = round(
    comparable.reduce((s, r) => s + Number(r.entry.principalNominalStable), 0),
    12
  );
  const current = round(
    comparable.reduce((s, r) => s + Number(r.current.nominal), 0),
    12
  );
  const income = round(Number(current || 0) - Number(comparablePrincipal || 0), 12);
  const returnPct =
    Number(comparablePrincipal) > 0
      ? round((Number(current) / Number(comparablePrincipal) - 1) * 100, 8)
      : null;

  const fullEntryReady = entryResolved.length === 10;
  const fullPerformanceReady = fullEntryReady && comparable.length === 10;

  return {
    strategyCount: 10,
    entryResolvedCount: entryResolved.length,
    currentNominalComparableCount: comparable.length,
    ownerApproxTenMatchedCount: rows.filter(r => r.ownerTargetApproximatelyTen === true).length,
    entryPrincipalNominalStableResolvedTotal: principal,
    comparablePrincipalNominalStable: comparablePrincipal,
    comparableCurrentNominalStable: current,
    comparableIncomeNominalStable: income,
    comparableReturnPct: returnPct,
    strategyInvestedNominalStableTotal: fullEntryReady ? principal : null,
    strategyCurrentNominalStableTotal: fullPerformanceReady ? current : null,
    strategyPerformanceNominalStable: fullPerformanceReady ? income : null,
    strategyPerformancePct: fullPerformanceReady ? returnPct : null,
    fullEntryReady,
    fullPerformanceReady,
    publicInvestedReady: fullEntryReady,
    publicPerformanceReady: fullPerformanceReady,
    note: fullPerformanceReady
      ? 'All 10 productive strategy entry principals and current nominal stable values are reproducibly comparable. Public Invested and Performance are ready for integration.'
      : 'Lido close did not fully resolve; public aggregate remains fail-closed.'
  };
}

async function main() {
  const startedAt = nowIso();
  const prior = readJson(IN_FILE);

  if (prior?.version !== '0.4-monetra-strategy-entry-targeted-close') {
    throw new Error(`expected v0.4 input, got ${prior?.version}`);
  }
  if (prior?.company?.registry !== '008' || prior?.company?.name !== 'Monetra.eth') {
    throw new Error('Company #008 identity mismatch');
  }
  if (!Array.isArray(prior.strategies) || prior.strategies.length !== 10) {
    throw new Error('expected 10 strategy rows');
  }

  const lidoPrior = prior.strategies.find(r => r.id === LIDO_ID);
  if (!lidoPrior) throw new Error('Lido row missing from v0.4 ledger');

  const nonLido = prior.strategies.filter(r => r.id !== LIDO_ID);
  if (nonLido.length !== 9) throw new Error('expected exactly 9 non-Lido rows');
  if (!nonLido.every(r =>
    finite(r?.entry?.principalNominalStable) &&
    r?.current?.comparable === true &&
    r?.performance?.status === 'comparable'
  )) {
    throw new Error('one of the nine previously solved strategies regressed');
  }

  const foundedAt = prior.company.foundedAt || '2026-05-27T05:46:11.000Z';
  const foundedTs = Math.floor(new Date(foundedAt).getTime() / 1000);

  const resolved = await withProvider(async (provider, url) => {
    const foundedBlock = Number((await findBlockAtOrBefore(provider, foundedTs)).number);
    const architecture = await discoverArchitecture(provider);
    const { entry, allEffectiveDeposits } =
      await discoverEntry(provider, architecture, foundedBlock);

    const shareOutflows = await scanShareOutflows(provider, entry.block);
    if (shareOutflows.burnCount > 0 || shareOutflows.outgoingTransferCount > 0) {
      throw new Error(
        `Lido share outflow detected: burns=${shareOutflows.burnCount}, transfers=${shareOutflows.outgoingTransferCount}`
      );
    }

    const current = await resolveCurrent(provider, architecture, entry);

    const performance = {
      status: 'comparable',
      incomeNominalStable: round(
        Number(current.nominal) - Number(entry.principalNominalStable),
        12
      ),
      returnPct: round(
        (Number(current.nominal) / Number(entry.principalNominalStable) - 1) * 100,
        8
      )
    };

    return {
      provider: new URL(url).hostname,
      foundedBlock,
      architecture: {
        shareManager: SHARE_MANAGER,
        vault: architecture.vault,
        oracle: architecture.oracle,
        assets: architecture.assets,
        sharesRaw: architecture.sharesRaw.toString(),
        activeSharesRaw: architecture.activeSharesRaw.toString(),
        claimableSharesRaw: architecture.claimableSharesRaw.toString()
      },
      entry: {
        txHash: entry.txHash,
        block: entry.block,
        timestamp: entry.chainTimestamp,
        requestTimestamp: entry.requestTimestamp,
        requestTimestampIso: new Date(entry.requestTimestamp * 1000).toISOString(),
        principalNominalStable: round(entry.principalNominalStable, 12),
        principalSymbol: entry.symbol || 'stable asset',
        confidence: 'high',
        evidence: {
          type: 'Mellow-DepositQueue-DepositRequested',
          asset: entry.asset,
          queue: entry.queue,
          referral: entry.referral,
          assetsRaw: entry.assetsRaw,
          assetDecimals: entry.decimals,
          requestCountOnQueue: entry.requestCountOnQueue,
          canceledCountOnQueue: entry.canceledCountOnQueue
        },
        receiptDiagnostics: null
      },
      current,
      performance,
      ownerTargetApproximatelyTen:
        Math.abs(Number(entry.principalNominalStable) - 10) <= 0.25,
      shareOutflows,
      allEffectiveDeposits
    };
  });

  if (!resolved.ok) {
    const out = {
      ...prior,
      version: VERSION,
      methodologyVersion: METHODOLOGY,
      generatedAt: nowIso(),
      startedAt,
      lidoTargetedClose: {
        status: 'diagnostic-unresolved',
        attempts: resolved.attempts,
        error: resolved.error,
        officialMechanics: [
          'ShareManager.sharesOf(account) includes active + claimable shares.',
          'DepositQueue DepositRequested is the exact strategy-entry principal.',
          'Oracle invariant: shares = assets * priceD18 / 1e18.'
        ]
      },
      summary: {
        ...prior.summary,
        fullEntryReady: false,
        fullPerformanceReady: false,
        publicInvestedReady: false,
        publicPerformanceReady: false,
        note: 'Lido targeted close remains unresolved; inspect lidoTargetedClose only.'
      }
    };
    writeJson(OUT_FILE, out);
    console.log(JSON.stringify(out.summary, null, 2));
    return;
  }

  const lido = {
    id: LIDO_ID,
    protocol: 'Lido Earn',
    chain: 'ethereum',
    mode: 'lido-deposit-queue',
    entry: resolved.value.entry,
    current: resolved.value.current,
    performance: resolved.value.performance,
    ownerTargetApproximatelyTen: resolved.value.ownerTargetApproximatelyTen
  };

  const rows = prior.strategies.map(r => r.id === LIDO_ID ? lido : r);
  const summary = recomputeSummary(rows);
  const unresolved = summary.fullPerformanceReady ? [] : [{
    id: LIDO_ID,
    protocol: 'Lido Earn',
    entryResolved: finite(lido?.entry?.principalNominalStable),
    currentComparable: lido?.current?.comparable === true,
    reason: 'Lido targeted close incomplete'
  }];

  const out = {
    ...prior,
    version: VERSION,
    methodologyVersion: METHODOLOGY,
    generatedAt: nowIso(),
    startedAt,
    correction: {
      ...prior.correction,
      v05LidoClose: [
        'Nine v0.4 strategy rows are copied unchanged and guarded against regression.',
        'Lido deposit asset and DepositQueue are discovered dynamically from the live ShareModule.',
        'Entry principal comes from the effective DepositRequested event, not wallet funding history.',
        'Current nominal value uses ShareManager.sharesOf and inverse Oracle priceD18 conversion.',
        'Share burns/outgoing transfers fail closed because they would require flow-adjusted performance.',
        'No market price is used for Lido strategy Performance.'
      ]
    },
    methodology: {
      ...prior.methodology,
      lido:
        'Lido/Mellow entry from DepositQueue DepositRequested; current nominal stable value from ShareManager.sharesOf and Oracle.getReport using the official shares = assets × priceD18 / 1e18 invariant.'
    },
    sourceDiagnostics: {
      ...prior.sourceDiagnostics,
      lidoV05: {
        status: 'ok',
        provider: resolved.value.provider,
        foundedBlock: resolved.value.foundedBlock,
        priorProviderAttempts: resolved.attempts
      }
    },
    summary,
    strategies: rows,
    unresolved,
    lidoTargetedClose: {
      status: summary.fullPerformanceReady ? 'closed' : 'partial',
      architecture: resolved.value.architecture,
      entry: resolved.value.entry,
      current: resolved.value.current,
      performance: resolved.value.performance,
      shareOutflows: resolved.value.shareOutflows,
      allEffectiveDeposits: resolved.value.allEffectiveDeposits,
      officialSourceCanon: {
        shareManager:
          'Mellow flexible-vaults ShareManager.sharesOf(account) = activeSharesOf + claimableSharesOf.',
        depositQueue:
          'Mellow DepositQueue emits DepositRequested(account, referral, assets, timestamp) and later converts request assets into shares.',
        oracle:
          'Mellow IOracle defines shares = assets * priceD18 / 1e18.'
      }
    },
    integrationContract: {
      ...prior.integrationContract,
      publicInvestedField: 'summary.strategyInvestedNominalStableTotal',
      publicPerformanceUsdLikeField: 'summary.strategyPerformanceNominalStable',
      publicPerformancePctField: 'summary.strategyPerformancePct',
      require:
        'summary.fullPerformanceReady === true && summary.publicInvestedReady === true && summary.publicPerformanceReady === true',
      desiredPassport:
        'Invested · Current Capital · APY · Claimable / Performance + Strategy Book details'
    }
  };

  if (summary.fullPerformanceReady !== true) {
    throw new Error('v0.5 expected to close all 10 strategies but did not');
  }

  writeJson(OUT_FILE, out);

  console.log('Monetra Lido EarnUSD Targeted Close v0.5');
  console.log('Lido entry:', JSON.stringify(lido.entry, null, 2));
  console.log('Lido current:', JSON.stringify(lido.current, null, 2));
  console.log('Lido performance:', JSON.stringify(lido.performance, null, 2));
  console.log('Aggregate:', JSON.stringify(summary, null, 2));
}

main().catch(e => {
  console.error('MONETRA LIDO CLOSE FATAL:', e);
  process.exitCode = 1;
});
