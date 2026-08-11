import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  Interface,
  formatUnits,
  getAddress,
  toBeHex
} from 'ethers';

const VERSION = '1.1-targeted-resolver';
const YB_RESOLVER_VERSION = '1.3-yb-only-bounded-recovery';
const OUTPUT_PATH = process.env.COMPANY_007_RESOLVE_OUTPUT
  || path.resolve('companies/company-007-resolve.json');

const WALLETS = [
  getAddress('0x7ec6331188468269dc7c1cf6a84c972632178b1e'),
  getAddress('0x9c548960bd053c8465f298a711b6343ae0360309')
];

const YB_MARKETS = [
  {
    symbol: 'yb-WBTC',
    family: 'BTC',
    lt: getAddress('0x651d4b8168488fa163d85304662e8278d4c55baa'),
    underlyingDecimals: 8
  },
  {
    symbol: 'yb-WETH',
    family: 'ETH',
    lt: getAddress('0x2b9c9f3bdceb5d8e36a4704f08a78fca53343cea'),
    underlyingDecimals: 18
  }
];

const CURRENT_ETH_RPC = uniq([
  process.env.ETH_RPC_URL,
  process.env.ETH_RPC_URL_2,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://eth.llamarpc.com'
]);

const ARCHIVE_ETH_RPC = uniq([
  process.env.ETH_ARCHIVE_RPC_URL,
  process.env.ETH_ARCHIVE_RPC_URL_2,
  'https://eth.drpc.org',
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com',
  'https://rpc.flashbots.net'
]);

const LT_IFACE = new Interface([
  'function pricePerShare() view returns (uint256)',
  'function preview_withdraw(uint256 shares) view returns (uint256)',
  'function balanceOf(address) view returns (uint256)'
]);

function uniq(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}

function errorText(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]');
}

function safeHost(url) {
  const secrets = [
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    process.env.ETH_ARCHIVE_RPC_URL,
    process.env.ETH_ARCHIVE_RPC_URL_2
  ].filter(Boolean);
  if (secrets.includes(url)) return 'configured';
  try { return new URL(url).hostname; } catch { return 'configured'; }
}

function positiveBigInt(x) {
  try {
    const b = BigInt(x);
    return b > 0n ? b : 0n;
  } catch {
    return 0n;
  }
}

function blockTag(n) {
  return toBeHex(Number(n));
}

function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function rpc(url, method, params = [], timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'user-agent': 'The-Holding-Company-007-YB-Recovery/1.3'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method,
        params
      }),
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    const j = await r.json();
    if (j?.error) throw new Error(`RPC ${j.error.code}: ${j.error.message || 'unknown error'}`);
    if (j?.result == null) throw new Error(`RPC ${method}: null result`);
    return j.result;
  } finally {
    clearTimeout(timer);
  }
}

async function getBlock(url, numberOrTag) {
  const tag = numberOrTag === 'latest' ? 'latest' : blockTag(numberOrTag);
  const b = await rpc(url, 'eth_getBlockByNumber', [tag, false], 7000);
  if (!b?.number || !b?.timestamp) throw new Error(`block ${tag} unavailable`);
  return {
    number: Number(BigInt(b.number)),
    timestamp: Number(BigInt(b.timestamp))
  };
}

async function chooseCurrentProvider() {
  const diagnostics = [];
  for (const url of CURRENT_ETH_RPC) {
    try {
      const latest = await getBlock(url, 'latest');
      return { url, latest, diagnostics };
    } catch (e) {
      diagnostics.push(`ethereum-current:${safeHost(url)}: ${errorText(e)}`);
    }
  }
  throw new Error(`Ethereum current providers exhausted: ${diagnostics.join(' | ')}`);
}

async function findBlockAtOrBefore(url, latest, targetTs) {
  if (latest.timestamp <= targetTs) return latest;

  // Start near the expected 30-day Ethereum distance, then converge by timestamp.
  let estimate = Math.max(0, latest.number - 216000);
  let candidate = null;

  for (let i = 0; i < 6; i++) {
    candidate = await getBlock(url, estimate);
    const delta = targetTs - candidate.timestamp;
    if (Math.abs(delta) <= 24) break;
    estimate = Math.max(0, Math.min(
      latest.number,
      Math.round(estimate + delta / 12)
    ));
  }

  if (!candidate) candidate = await getBlock(url, estimate);

  let lo = Math.max(0, candidate.number - 256);
  let hi = Math.min(latest.number, candidate.number + 256);
  let best = null;

  // Ensure the bracket actually contains the target.
  const loBlock = await getBlock(url, lo);
  const hiBlock = await getBlock(url, hi);
  if (loBlock.timestamp > targetTs || hiBlock.timestamp <= targetTs) {
    // Fall back to a bounded wider band if the estimate was unusually off.
    lo = Math.max(0, latest.number - 240000);
    hi = latest.number;
  }

  for (let i = 0; i < 20 && lo <= hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await getBlock(url, mid);
    if (b.timestamp <= targetTs) {
      best = b;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  if (!best) throw new Error('unable to locate bounded 30-day Ethereum block');
  return best;
}

async function ethCall(url, to, data, tag = 'latest', timeoutMs = 7000) {
  return rpc(url, 'eth_call', [{ to, data }, tag], timeoutMs);
}

async function currentMarketReads(url, market) {
  const ppsData = LT_IFACE.encodeFunctionData('pricePerShare', []);
  const redeemData = LT_IFACE.encodeFunctionData('preview_withdraw', [10n ** 18n]);
  const balanceData = WALLETS.map(w => LT_IFACE.encodeFunctionData('balanceOf', [w]));

  const [ppsHex, redemptionHex, ...balanceHexes] = await Promise.all([
    ethCall(url, market.lt, ppsData),
    ethCall(url, market.lt, redeemData),
    ...balanceData.map(d => ethCall(url, market.lt, d))
  ]);

  const ppsNowRaw = positiveBigInt(LT_IFACE.decodeFunctionResult('pricePerShare', ppsHex)[0]);
  const redemptionRaw = positiveBigInt(LT_IFACE.decodeFunctionResult('preview_withdraw', redemptionHex)[0]);
  const walletShares = balanceHexes.reduce((acc, hex) => {
    const v = positiveBigInt(LT_IFACE.decodeFunctionResult('balanceOf', hex)[0]);
    return acc + v;
  }, 0n);

  if (ppsNowRaw <= 0n) throw new Error(`${market.symbol}: current PPS is non-positive`);

  return { ppsNowRaw, redemptionRaw, walletShares };
}

async function historicalPps(market, blockNumber) {
  const diagnostics = [];
  const ppsData = LT_IFACE.encodeFunctionData('pricePerShare', []);
  const tag = blockTag(blockNumber);

  for (const url of ARCHIVE_ETH_RPC) {
    const label = `ethereum-archive:${safeHost(url)}`;
    try {
      const code = await rpc(url, 'eth_getCode', [market.lt, tag], 6500);
      if (!code || code === '0x') {
        throw new Error(`LT contract code unavailable at block ${blockNumber}`);
      }

      const ppsHex = await ethCall(url, market.lt, ppsData, tag, 6500);
      const raw = positiveBigInt(LT_IFACE.decodeFunctionResult('pricePerShare', ppsHex)[0]);
      if (raw <= 0n) throw new Error('historical PPS is non-positive');

      return { raw, provider: label, diagnostics };
    } catch (e) {
      diagnostics.push(`${label}: ${errorText(e)}`);
    }
  }

  return { raw: 0n, provider: null, diagnostics };
}

function validateBaseline(d) {
  if (d?.version !== VERSION) throw new Error(`baseline version mismatch: ${d?.version}`);
  if (d?.company?.registry !== '007') throw new Error('baseline registry is not 007');
  if (d?.company?.name !== "Rook's portfolio") throw new Error('baseline company name mismatch');

  for (const key of ['crv', 'link', 'zk', 'votium']) {
    if (d?.results?.[key]?.status !== 'ok') {
      throw new Error(`baseline ${key} is not ok`);
    }
  }
  if (d?.results?.votium?.completeCurrentRootScan !== true) {
    throw new Error('baseline Votium current-root scan is not complete');
  }
  if (!d?.results?.yieldBasis) throw new Error('baseline Yield Basis result missing');
}

async function resolveYieldBasis(baseline) {
  const current = await chooseCurrentProvider();
  const targetTs = current.latest.timestamp - 30 * 86400;
  const pastBlock = await findBlockAtOrBefore(current.url, current.latest, targetTs);
  const elapsedSeconds = current.latest.timestamp - pastBlock.timestamp;
  const elapsedDays = elapsedSeconds / 86400;

  const previousByMarket = new Map(
    (baseline?.results?.yieldBasis?.positions || []).map(x => [x.market, x])
  );

  const positions = await Promise.all(YB_MARKETS.map(async market => {
    const currentReads = await currentMarketReads(current.url, market);
    const historical = await historicalPps(market, pastBlock.number);

    const ppsNow = Number(formatUnits(currentReads.ppsNowRaw, 18));
    const ppsPast = historical.raw > 0n
      ? Number(formatUnits(historical.raw, 18))
      : null;
    const redemptionOneShare = Number(formatUnits(
      currentReads.redemptionRaw,
      market.underlyingDecimals
    ));

    let apy = null;
    let productivityStatus = 'warming';
    let historyError = null;

    if (ppsPast != null && ppsPast > 0 && ppsNow > 0) {
      const ratio = ppsNow / ppsPast;
      apy = (Math.pow(ratio, 365 / elapsedDays) - 1) * 100;
      productivityStatus = 'ok';
    } else {
      historyError = historical.diagnostics.length
        ? `archive providers exhausted: ${historical.diagnostics.join(' | ')}`
        : 'historical PPS unavailable';
    }

    const trdPct = ppsNow > 0
      ? (redemptionOneShare / ppsNow - 1) * 100
      : null;

    const previous = previousByMarket.get(market.symbol) || {};

    return {
      market: market.symbol,
      family: market.family,
      lt: market.lt,
      directShares: Number(formatUnits(currentReads.walletShares, 18)),
      mode: 'unstaked-plain',
      ppsNow: round(ppsNow, 12),
      pps30dAgo: ppsPast == null ? null : round(ppsPast, 12),
      historicalBlock: ppsPast == null ? null : pastBlock.number,
      historicalTimestamp: ppsPast == null ? null : pastBlock.timestamp,
      elapsedDays: round(elapsedDays, 6),
      fundamentalTradingApy30dPct: apy == null ? null : round(apy, 6),
      redemptionPerShareUnderlying: round(redemptionOneShare, 12),
      trdPct: round(trdPct, 6),
      productivityStatus,
      productivityMethod: 'onchain LT.pricePerShare growth over bounded 30-day block interval; annualized; emissions excluded',
      historicalProvider: historical.provider,
      historicalDiagnostics: historical.diagnostics,
      historyError,
      priorResolverCrossCheck: {
        priorDirectShares: previous.directShares ?? null,
        priorPpsNow: previous.ppsNow ?? null
      }
    };
  }));

  const allOk = positions.every(x => x.productivityStatus === 'ok');

  return {
    status: allOk ? 'ok' : 'warming',
    chain: 'Ethereum',
    latestBlock: current.latest.number,
    latestTimestamp: current.latest.timestamp,
    referenceWindowDays: 30,
    positions,
    yieldBasisResolverVersion: YB_RESOLVER_VERSION,
    recoveryMode: 'yield-basis-only; CRV/LINK/ZK/Votium preserved from last-known-good resolver baseline',
    methodology: {
      canonicalMetric: 'FT APY (30D) / Fundamental Trading APY',
      formula: '(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
      emissionsIncluded: false,
      redemptionPpsUsedForApr: false,
      note: 'pricePerShare is fundamental value. preview_withdraw is used only for current redemption/TRD. Historical PPS uses bounded independent archive-provider failover with hard per-RPC timeouts.'
    },
    diagnostics: current.diagnostics,
    provider: `ethereum-current:${safeHost(current.url)}`,
    discoveryCrossCheck: baseline?.results?.yieldBasis?.discoveryCrossCheck || []
  };
}

async function main() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    throw new Error(`Missing resolver baseline at ${OUTPUT_PATH}. Workflow must restore last-known-good baseline first.`);
  }

  const baseline = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  validateBaseline(baseline);

  const preservedBefore = {
    crv: stableHash(baseline.results.crv),
    link: stableHash(baseline.results.link),
    zk: stableHash(baseline.results.zk),
    votium: stableHash(baseline.results.votium)
  };

  const startedAt = nowIso();
  const yieldBasis = await resolveYieldBasis(baseline);

  const output = structuredClone(baseline);
  output.generatedAt = nowIso();
  output.startedAt = startedAt;
  output.results.yieldBasis = yieldBasis;
  output.productionReadiness = {
    ...(output.productionReadiness || {}),
    crvResolved: output.results.crv?.status === 'ok',
    linkResolved: output.results.link?.status === 'ok',
    zkResolved: output.results.zk?.status === 'ok',
    yieldBasisProductivityResolved: yieldBasis.status === 'ok',
    votiumResolved: output.results.votium?.status === 'ok',
    readyForFinalIntegrator:
      output.results.crv?.status === 'ok'
      && output.results.link?.status === 'ok'
      && output.results.zk?.status === 'ok'
      && yieldBasis.status === 'ok'
      && output.results.votium?.status === 'ok',
    note: 'YB-only recovery run. CRV/LINK/ZK/Votium are preserved exactly from the validated baseline; Yield Basis remains warming unless historical PPS is reproducible.'
  };
  output.recovery = {
    mode: 'yield-basis-only',
    resolverVersion: YB_RESOLVER_VERSION,
    preservedResultSha256: preservedBefore
  };

  // Fail closed if this narrow worker mutated any previously solved result.
  for (const key of ['crv', 'link', 'zk', 'votium']) {
    const after = stableHash(output.results[key]);
    if (after !== preservedBefore[key]) {
      throw new Error(`Preservation guard failed: ${key} changed during YB-only recovery`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(`Company #007 YB-only resolver written: ${OUTPUT_PATH}`);
  console.log(`Yield Basis: ${yieldBasis.status}`);
  for (const p of yieldBasis.positions || []) {
    console.log(
      `  ${p.market}: PPS30d=${p.pps30dAgo ?? 'warming'} `
      + `FT APY 30D=${p.fundamentalTradingApy30dPct ?? 'warming'}% `
      + `provider=${p.historicalProvider ?? 'none'}`
    );
  }
  console.log(`readyForFinalIntegrator=${output.productionReadiness.readyForFinalIntegrator}`);
}

main().catch(err => {
  console.error(`Company #007 YB-only resolver failed: ${errorText(err)}`);
  process.exitCode = 1;
});
