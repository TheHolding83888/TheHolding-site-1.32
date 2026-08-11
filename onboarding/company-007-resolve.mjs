import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Interface, formatUnits, getAddress } from 'ethers';

const VERSION = '1.1-targeted-resolver';
const YB_RESOLVER_VERSION = '1.8-canonical-quantity-source-mesh';
const OUTPUT_PATH = process.env.COMPANY_007_RESOLVE_OUTPUT
  || path.resolve('companies/company-007-resolve.json');

const YB_MARKETS = [
  { symbol: 'yb-WBTC', family: 'BTC', lt: getAddress('0x651d4b8168488fa163d85304662e8278d4c55baa') },
  { symbol: 'yb-WETH', family: 'ETH', lt: getAddress('0x2b9c9f3bdceb5d8e36a4704f08a78fca53343cea') }
];

const LT_IFACE = new Interface(['function pricePerShare() view returns (uint256)']);

function uniq(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function nowIso() { return new Date().toISOString(); }
function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function errorText(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .replace(/apikey=[^&\s]+/gi, 'apikey=[redacted]');
}
function stableHash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function blockTag(n) {
  const b = BigInt(n);
  if (b < 0n) throw new Error(`negative block number: ${n}`);
  return `0x${b.toString(16)}`; // Ethereum JSON-RPC QUANTITY: minimal hex, no leading zero digits.
}
function positiveBigInt(x) {
  try {
    const b = BigInt(x);
    return b > 0n ? b : 0n;
  } catch { return 0n; }
}
function configuredUrls() {
  return uniq([
    process.env.ETH_ARCHIVE_RPC_URL,
    process.env.ETH_ARCHIVE_RPC_URL_2,
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2
  ]);
}
function safeHost(url) {
  if (configuredUrls().includes(url)) return 'configured';
  try { return new URL(url).hostname; } catch { return 'configured'; }
}

const HEADER_RPCS = uniq([
  process.env.ETH_RPC_URL,
  process.env.ETH_RPC_URL_2,
  process.env.ETH_ARCHIVE_RPC_URL,
  process.env.ETH_ARCHIVE_RPC_URL_2,
  'https://eth.merkle.io',
  'https://eth.blockscout.com/api/eth-rpc',
  'https://rpc.flashbots.net',
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org'
]);

const HISTORY_RPC_SOURCES = [
  ...configuredUrls().map(url => ({ kind: 'rpc', url, label: 'ethereum-history:configured' })),
  { kind: 'rpc', url: 'https://eth.merkle.io', label: 'ethereum-history:eth.merkle.io' },
  { kind: 'rpc', url: 'https://eth.blockscout.com/api/eth-rpc', label: 'ethereum-history:eth.blockscout.com' }
];

async function rpc(url, method, params = [], timeoutMs = 7000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'user-agent': 'The-Holding-Company-007-YB-History/1.8'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText || ''}`.trim());
    const j = await r.json();
    if (j?.error) throw new Error(`RPC ${j.error.code}: ${j.error.message || 'unknown error'}`);
    if (j?.result == null) throw new Error(`RPC ${method}: null result`);
    return j.result;
  } finally {
    clearTimeout(timer);
  }
}

async function etherscanHistoricalCall(market, blockNumber) {
  const key = String(process.env.ETHERSCAN_API_KEY || '').trim();
  if (!key) throw new Error('ETHERSCAN_API_KEY not configured');
  const data = LT_IFACE.encodeFunctionData('pricePerShare', []);
  const q = new URLSearchParams({
    chainid: '1',
    module: 'proxy',
    action: 'eth_call',
    to: market.lt,
    data,
    tag: blockTag(blockNumber),
    apikey: key
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(`https://api.etherscan.io/v2/api?${q.toString()}`, {
      headers: { accept: 'application/json', 'user-agent': 'The-Holding-Company-007-YB-History/1.8' },
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText || ''}`.trim());
    const j = await r.json();
    if (j?.error) throw new Error(`Etherscan RPC ${j.error.code}: ${j.error.message || 'unknown error'}`);
    if (!j?.result || j.result === '0x') throw new Error(`Etherscan eth_call returned no result`);
    return j.result;
  } finally {
    clearTimeout(timer);
  }
}

async function getBlock(url, number) {
  const b = await rpc(url, 'eth_getBlockByNumber', [blockTag(number), false], 6000);
  if (!b?.number || !b?.timestamp) throw new Error(`block ${number} unavailable`);
  return { number: Number(BigInt(b.number)), timestamp: Number(BigInt(b.timestamp)) };
}

async function locateHistoricalBlock(latestBlock, latestTimestamp, targetTimestamp) {
  const diagnostics = [];
  const expectedBlocks = Math.round((latestTimestamp - targetTimestamp) / 12);
  const initialEstimate = Math.max(0, latestBlock - expectedBlocks);

  for (const url of HEADER_RPCS) {
    const label = `ethereum-header:${safeHost(url)}`;
    try {
      let estimate = initialEstimate;
      let candidate = null;
      for (let i = 0; i < 6; i++) {
        candidate = await getBlock(url, estimate);
        const delta = targetTimestamp - candidate.timestamp;
        if (Math.abs(delta) <= 24) break;
        estimate = Math.max(0, Math.min(latestBlock, Math.round(estimate + delta / 12)));
      }
      if (!candidate) throw new Error('no candidate block');

      let lo = Math.max(0, candidate.number - 384);
      let hi = Math.min(latestBlock, candidate.number + 384);
      const loBlock = await getBlock(url, lo);
      const hiBlock = await getBlock(url, hi);
      if (loBlock.timestamp > targetTimestamp || hiBlock.timestamp <= targetTimestamp) {
        lo = Math.max(0, initialEstimate - 12000);
        hi = Math.min(latestBlock, initialEstimate + 12000);
      }

      let best = null;
      for (let i = 0; i < 18 && lo <= hi; i++) {
        const mid = Math.floor((lo + hi) / 2);
        const b = await getBlock(url, mid);
        if (b.timestamp <= targetTimestamp) {
          best = b;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (!best) throw new Error('target block not bracketed');
      return { block: best, provider: label, diagnostics };
    } catch (e) {
      diagnostics.push(`${label}: ${errorText(e)}`);
    }
  }
  return { block: null, provider: null, diagnostics };
}

function decodePps(out, ppsNow) {
  const raw = positiveBigInt(LT_IFACE.decodeFunctionResult('pricePerShare', out)[0]);
  if (raw <= 0n) throw new Error('historical PPS is non-positive');
  const pps = Number(formatUnits(raw, 18));
  if (!(pps > 0) || !Number.isFinite(pps)) throw new Error('historical PPS decode invalid');
  const ratio = ppsNow / pps;
  if (!(ratio > 0.5 && ratio < 2)) throw new Error(`historical PPS sanity ratio out of bounds: ${ratio}`);
  return { raw, pps };
}

async function historicalPps(market, blockNumber, ppsNow) {
  const diagnostics = [];
  const data = LT_IFACE.encodeFunctionData('pricePerShare', []);
  const tag = blockTag(blockNumber);

  // Direct historical eth_call is the actual capability we need. Do not gate on eth_getCode:
  // some gateways proxy eth_call correctly but reject secondary historical methods.
  for (const source of HISTORY_RPC_SOURCES) {
    try {
      const out = await rpc(source.url, 'eth_call', [{ to: market.lt, data }, tag], 9000);
      const decoded = decodePps(out, ppsNow);
      return { ...decoded, provider: source.label, diagnostics };
    } catch (e) {
      diagnostics.push(`${source.label}: ${errorText(e)}`);
    }
  }

  // Etherscan's official proxy API accepts an explicit hex block tag. Optional: skipped when no key exists.
  try {
    const out = await etherscanHistoricalCall(market, blockNumber);
    const decoded = decodePps(out, ppsNow);
    return { ...decoded, provider: 'ethereum-history:etherscan-proxy', diagnostics };
  } catch (e) {
    diagnostics.push(`ethereum-history:etherscan-proxy: ${errorText(e)}`);
  }

  return { raw: 0n, pps: null, provider: null, diagnostics };
}

function validateBaseline(d) {
  if (d?.version !== VERSION) throw new Error(`baseline version mismatch: ${d?.version}`);
  if (d?.company?.registry !== '007') throw new Error('baseline registry is not 007');
  if (d?.company?.name !== "Rook's portfolio") throw new Error('baseline company name mismatch');
  for (const key of ['crv', 'link', 'zk', 'votium']) {
    if (d?.results?.[key]?.status !== 'ok') throw new Error(`baseline ${key} is not ok`);
  }
  if (d?.results?.votium?.completeCurrentRootScan !== true) {
    throw new Error('baseline Votium current-root scan is not complete');
  }
  const yb = d?.results?.yieldBasis;
  if (!yb || !Array.isArray(yb.positions) || yb.positions.length !== 2) {
    throw new Error('baseline Yield Basis positions missing');
  }
  if (!(Number(yb.latestBlock) > 0) || !(Number(yb.latestTimestamp) > 0)) {
    throw new Error('baseline Yield Basis latest block/timestamp missing');
  }
  for (const p of yb.positions) {
    if (!(Number(p.ppsNow) > 0)) throw new Error(`baseline ${p.market} current PPS missing`);
  }
}

async function resolveHistoryOnly(baseline) {
  const prior = baseline.results.yieldBasis;
  const latestBlock = Number(prior.latestBlock);
  const latestTimestamp = Number(prior.latestTimestamp);
  const targetTimestamp = latestTimestamp - 30 * 86400;
  const blockLookup = await locateHistoricalBlock(latestBlock, latestTimestamp, targetTimestamp);
  const priorByMarket = new Map(prior.positions.map(p => [p.market, p]));

  if (!blockLookup.block) {
    return {
      ...prior,
      status: 'warming',
      yieldBasisResolverVersion: YB_RESOLVER_VERSION,
      recoveryMode: 'historical-source-mesh canonical-quantity diagnostic-safe; validated current PPS preserved',
      historicalBlockProvider: null,
      historicalBlockDiagnostics: blockLookup.diagnostics,
      sourceMeshExhausted: true,
      sourceMeshError: `historical block lookup failed: ${blockLookup.diagnostics.join(' | ')}`
    };
  }

  const elapsedSeconds = latestTimestamp - blockLookup.block.timestamp;
  const elapsedDays = elapsedSeconds / 86400;
  const positions = [];

  for (const market of YB_MARKETS) {
    const previous = priorByMarket.get(market.symbol);
    if (!previous) throw new Error(`baseline market missing: ${market.symbol}`);
    const ppsNow = Number(previous.ppsNow);
    const hist = await historicalPps(market, blockLookup.block.number, ppsNow);
    const ppsPast = hist.pps;
    let apy = null;
    let status = 'warming';
    let historyError = null;

    if (ppsPast != null && ppsPast > 0 && ppsNow > 0 && elapsedDays > 0) {
      apy = (Math.pow(ppsNow / ppsPast, 365 / elapsedDays) - 1) * 100;
      status = 'ok';
    } else {
      historyError = `historical PPS source mesh exhausted: ${hist.diagnostics.join(' | ')}`;
    }

    positions.push({
      ...previous,
      pps30dAgo: ppsPast == null ? null : round(ppsPast, 12),
      historicalBlock: ppsPast == null ? null : blockLookup.block.number,
      historicalTimestamp: ppsPast == null ? null : blockLookup.block.timestamp,
      elapsedDays: round(elapsedDays, 6),
      fundamentalTradingApy30dPct: apy == null ? null : round(apy, 6),
      productivityStatus: status,
      productivityMethod: 'validated baseline PPS_now vs historical LT.pricePerShare over bounded trailing-30-day interval; annualized; emissions excluded',
      historicalProvider: hist.provider,
      historicalDiagnostics: hist.diagnostics,
      historyError
    });
  }

  const ok = positions.every(p => p.productivityStatus === 'ok');
  return {
    ...prior,
    status: ok ? 'ok' : 'warming',
    positions,
    yieldBasisResolverVersion: YB_RESOLVER_VERSION,
    recoveryMode: 'historical-source-mesh + canonical JSON-RPC quantity block tags; configured RPCs + official public Merkle/Blockscout + optional Etherscan proxy; validated current PPS preserved',
    historicalBlockProvider: blockLookup.provider,
    historicalBlockDiagnostics: blockLookup.diagnostics,
    sourceMeshExhausted: !ok,
    blockTagEncoding: 'ethereum-json-rpc-quantity-no-leading-zero',
    methodology: {
      ...prior.methodology,
      emissionsIncluded: false,
      redemptionPpsUsedForApr: false,
      note: 'FT APY uses validated baseline PPS_now and trailing-30-day historical LT.pricePerShare. Historical sources are accepted only after a successful direct historical eth_call returning a positive, sane PPS. Emissions and redemption PPS remain excluded.'
    }
  };
}

async function main() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    throw new Error(`Missing resolver baseline at ${OUTPUT_PATH}. Workflow must restore last-known-good baseline first.`);
  }
  const baseline = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  validateBaseline(baseline);

  const preservedBefore = Object.fromEntries(
    ['crv', 'link', 'zk', 'votium'].map(k => [k, stableHash(baseline.results[k])])
  );

  const startedAt = nowIso();
  const yieldBasis = await resolveHistoryOnly(baseline);
  const output = structuredClone(baseline);
  output.generatedAt = nowIso();
  output.startedAt = startedAt;
  output.results.yieldBasis = yieldBasis;
  output.productionReadiness = {
    ...(output.productionReadiness || {}),
    crvResolved: true,
    linkResolved: true,
    zkResolved: true,
    yieldBasisProductivityResolved: yieldBasis.status === 'ok',
    votiumResolved: true,
    readyForFinalIntegrator: yieldBasis.status === 'ok',
    note: yieldBasis.status === 'ok'
      ? 'YB historical source mesh resolved both markets. CRV/LINK/ZK/Votium preserved exactly.'
      : 'YB source mesh exhausted without a reproducible historical PPS. CRV/LINK/ZK/Votium preserved exactly; warming retained rather than inventing a value.'
  };
  output.recovery = {
    mode: 'yield-basis-history-only-source-mesh',
    resolverVersion: YB_RESOLVER_VERSION,
    preservedResultSha256: preservedBefore
  };

  for (const key of ['crv', 'link', 'zk', 'votium']) {
    if (stableHash(output.results[key]) !== preservedBefore[key]) {
      throw new Error(`Preservation guard failed: ${key} changed`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Company #007 YB source-mesh resolver written: ${OUTPUT_PATH}`);
  console.log(`Yield Basis: ${yieldBasis.status}`);
  for (const p of yieldBasis.positions || []) {
    console.log(`${p.market}: PPS30d=${p.pps30dAgo ?? 'warming'} FT_APY=${p.fundamentalTradingApy30dPct ?? 'warming'} provider=${p.historicalProvider ?? 'none'}`);
  }
  console.log(`sourceMeshExhausted=${yieldBasis.sourceMeshExhausted === true}`);
  console.log(`readyForFinalIntegrator=${output.productionReadiness.readyForFinalIntegrator}`);
}

main().catch(err => {
  console.error(`Company #007 YB source-mesh resolver failed: ${errorText(err)}`);
  process.exitCode = 1;
});
