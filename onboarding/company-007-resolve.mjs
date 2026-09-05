import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Interface, formatUnits, getAddress } from 'ethers';

const VERSION = '1.1-targeted-resolver';
const YB_RESOLVER_VERSION = '1.9-current-state-active-set';
const CURRENT_STATE_VERSION = '0.1-yblp-current-state-quorum';
const OUTPUT_PATH = process.env.COMPANY_007_RESOLVE_OUTPUT
  || path.resolve('companies/company-007-resolve.json');
const CURRENT_STATE_PATH = process.env.COMPANY_007_YBLP_CURRENT_STATE
  || path.resolve('companies/company-007-yblp-current-state.json');

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
  return `0x${b.toString(16)}`;
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
        'user-agent': 'The-Holding-Company-007-YB-History/1.9'
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
      headers: { accept: 'application/json', 'user-agent': 'The-Holding-Company-007-YB-History/1.9' },
      signal: ctrl.signal,
      cache: 'no-store'
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText || ''}`.trim());
    const j = await r.json();
    if (j?.error) throw new Error(`Etherscan RPC ${j.error.code}: ${j.error.message || 'unknown error'}`);
    if (!j?.result || j.result === '0x') throw new Error('Etherscan eth_call returned no result');
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

function decodePps(out, ppsNow = null) {
  const raw = positiveBigInt(LT_IFACE.decodeFunctionResult('pricePerShare', out)[0]);
  if (raw <= 0n) throw new Error('PPS is non-positive');
  const pps = Number(formatUnits(raw, 18));
  if (!(pps > 0) || !Number.isFinite(pps)) throw new Error('PPS decode invalid');
  if (ppsNow != null) {
    const ratio = ppsNow / pps;
    if (!(ratio > 0.5 && ratio < 2)) throw new Error(`historical PPS sanity ratio out of bounds: ${ratio}`);
  }
  return { raw, pps };
}

async function historicalPps(market, blockNumber, ppsNow) {
  const diagnostics = [];
  const data = LT_IFACE.encodeFunctionData('pricePerShare', []);
  const tag = blockTag(blockNumber);

  for (const source of HISTORY_RPC_SOURCES) {
    try {
      const out = await rpc(source.url, 'eth_call', [{ to: market.lt, data }, tag], 9000);
      const decoded = decodePps(out, ppsNow);
      return { ...decoded, provider: source.label, diagnostics };
    } catch (e) {
      diagnostics.push(`${source.label}: ${errorText(e)}`);
    }
  }

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
}

function validateCurrentState(d) {
  if (d?.version !== CURRENT_STATE_VERSION || d?.status !== 'ok') {
    throw new Error('Company #007 YBLP current-state proof missing or incomplete');
  }
  if (d?.company?.registry !== '007' || d?.company?.name !== "Rook's portfolio") {
    throw new Error('Company #007 YBLP current-state identity mismatch');
  }
  if (d?.semantics?.unknownIsNotZero !== true || d?.semantics?.historyMustBePreserved !== true) {
    throw new Error('Company #007 YBLP current-state semantic boundary mismatch');
  }
  if (d?.authority?.readOnly !== true || d?.authority?.executionAuthority !== 'none' || d?.authority?.capitalExecution !== false) {
    throw new Error('Company #007 YBLP current-state authority expanded');
  }
  if (!(Number(d?.quorum?.matching) >= Number(d?.quorum?.required)) || Number(d?.quorum?.required) < 2) {
    throw new Error('Company #007 YBLP current-state quorum invalid');
  }
  if (!Array.isArray(d?.markets) || !d.markets.length) throw new Error('Company #007 YBLP market universe missing');
  for (const market of d.markets) {
    if (!['BTC', 'ETH'].includes(market?.family)) throw new Error(`unexpected YBLP family: ${market?.family}`);
    if (!['active', 'verified-zero'].includes(market?.currentState)) throw new Error(`invalid YBLP currentState: ${market?.market}`);
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(market?.lt || ''))) throw new Error(`invalid YBLP LT: ${market?.market}`);
    if (!/^0x[0-9a-fA-F]{40}$/.test(String(market?.gauge || ''))) throw new Error(`invalid YBLP gauge: ${market?.market}`);
    if (market.currentState === 'active' && !(market.activeHoldings || []).length) throw new Error(`active YBLP market lacks holdings: ${market.market}`);
    if (market.currentState === 'verified-zero' && (market.activeHoldings || []).length) throw new Error(`verified-zero YBLP market has active holdings: ${market.market}`);
  }
}

function activeMarketsFromCurrentState(currentState) {
  return currentState.markets
    .filter(x => x.currentState === 'active')
    .map(x => ({
      symbol: x.market,
      family: x.family,
      version: x.version || null,
      lt: getAddress(x.lt),
      gauge: getAddress(x.gauge),
      activeHoldings: x.activeHoldings || []
    }));
}

async function currentPpsSnapshot(markets) {
  const diagnostics = [];
  if (!markets.length) return { block: null, provider: null, positions: [], diagnostics };
  const data = LT_IFACE.encodeFunctionData('pricePerShare', []);

  for (const url of HEADER_RPCS) {
    const label = `ethereum-current:${safeHost(url)}`;
    try {
      const latestHex = await rpc(url, 'eth_blockNumber', [], 6000);
      const latestBlock = Number(BigInt(latestHex));
      const block = await getBlock(url, latestBlock);
      const positions = [];
      for (const market of markets) {
        const out = await rpc(url, 'eth_call', [{ to: market.lt, data }, blockTag(latestBlock)], 9000);
        const decoded = decodePps(out);
        positions.push({ ...market, ppsNow: decoded.pps, ppsNowRaw: decoded.raw.toString() });
      }
      return { block, provider: label, positions, diagnostics };
    } catch (e) {
      diagnostics.push(`${label}: ${errorText(e)}`);
    }
  }
  return { block: null, provider: null, positions: [], diagnostics };
}

async function resolveCurrentActiveSet(currentState) {
  const activeMarkets = activeMarketsFromCurrentState(currentState);
  const verifiedZeroMarkets = currentState.markets
    .filter(x => x.currentState === 'verified-zero')
    .map(x => ({ market: x.market, family: x.family, version: x.version || null, lt: x.lt, gauge: x.gauge }));

  if (!activeMarkets.length) {
    return {
      status: 'ok',
      chain: 'Ethereum',
      latestBlock: null,
      latestTimestamp: null,
      referenceWindowDays: 30,
      positions: [],
      verifiedZeroMarkets,
      currentStateProofGeneratedAt: currentState.generatedAt,
      currentStateQuorum: currentState.quorum,
      yieldBasisResolverVersion: YB_RESOLVER_VERSION,
      recoveryMode: 'current-state-active-set; no active YBLP positions; historical records preserved outside current inventory',
      sourceMeshExhausted: false,
      blockTagEncoding: 'ethereum-json-rpc-quantity-no-leading-zero',
      methodology: {
        canonicalMetric: 'FT APY (30D) / Fundamental Trading APY',
        formula: '(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
        emissionsIncluded: false,
        redemptionPpsUsedForApr: false,
        currentStateProofIsIncomeAuthority: false,
        note: 'No active Yield Basis LP mechanism is present in the proven current inventory. Historical positions and prior income remain preserved; verified zero is not rewritten as historical absence.'
      }
    };
  }

  const current = await currentPpsSnapshot(activeMarkets);
  if (!current.block || current.positions.length !== activeMarkets.length) {
    return {
      status: 'warming',
      chain: 'Ethereum',
      latestBlock: null,
      latestTimestamp: null,
      referenceWindowDays: 30,
      positions: activeMarkets.map(x => ({
        market: x.symbol,
        family: x.family,
        marketVersion: x.version,
        lt: x.lt,
        gauge: x.gauge,
        activeHoldings: x.activeHoldings,
        ppsNow: null,
        pps30dAgo: null,
        fundamentalTradingApy30dPct: null,
        productivityStatus: 'warming',
        historyError: `current PPS source mesh exhausted: ${current.diagnostics.join(' | ')}`
      })),
      verifiedZeroMarkets,
      currentStateProofGeneratedAt: currentState.generatedAt,
      currentStateQuorum: currentState.quorum,
      yieldBasisResolverVersion: YB_RESOLVER_VERSION,
      recoveryMode: 'current-state-active-set; current PPS source mesh exhausted; UNKNOWN retained',
      currentPpsDiagnostics: current.diagnostics,
      sourceMeshExhausted: true,
      blockTagEncoding: 'ethereum-json-rpc-quantity-no-leading-zero',
      methodology: {
        canonicalMetric: 'FT APY (30D) / Fundamental Trading APY',
        formula: '(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
        emissionsIncluded: false,
        redemptionPpsUsedForApr: false,
        currentStateProofIsIncomeAuthority: false,
        note: 'Active-set identity is proven, but APR remains UNKNOWN until current and historical PPS are reproducibly observed.'
      }
    };
  }

  const latestBlock = current.block.number;
  const latestTimestamp = current.block.timestamp;
  const targetTimestamp = latestTimestamp - 30 * 86400;
  const blockLookup = await locateHistoricalBlock(latestBlock, latestTimestamp, targetTimestamp);

  if (!blockLookup.block) {
    return {
      status: 'warming',
      chain: 'Ethereum',
      latestBlock,
      latestTimestamp,
      referenceWindowDays: 30,
      positions: current.positions.map(x => ({
        market: x.symbol,
        family: x.family,
        marketVersion: x.version,
        lt: x.lt,
        gauge: x.gauge,
        activeHoldings: x.activeHoldings,
        ppsNow: round(x.ppsNow, 12),
        pps30dAgo: null,
        fundamentalTradingApy30dPct: null,
        productivityStatus: 'warming',
        historyError: `historical block lookup failed: ${blockLookup.diagnostics.join(' | ')}`
      })),
      verifiedZeroMarkets,
      currentStateProofGeneratedAt: currentState.generatedAt,
      currentStateQuorum: currentState.quorum,
      yieldBasisResolverVersion: YB_RESOLVER_VERSION,
      recoveryMode: 'current-state-active-set; historical block source mesh exhausted; UNKNOWN retained',
      currentPpsProvider: current.provider,
      currentPpsDiagnostics: current.diagnostics,
      historicalBlockProvider: null,
      historicalBlockDiagnostics: blockLookup.diagnostics,
      sourceMeshExhausted: true,
      blockTagEncoding: 'ethereum-json-rpc-quantity-no-leading-zero',
      methodology: {
        canonicalMetric: 'FT APY (30D) / Fundamental Trading APY',
        formula: '(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
        emissionsIncluded: false,
        redemptionPpsUsedForApr: false,
        currentStateProofIsIncomeAuthority: false,
        note: 'Current active set and current PPS are proven; historical PPS is unavailable, so Reference APY remains UNKNOWN.'
      }
    };
  }

  const elapsedSeconds = latestTimestamp - blockLookup.block.timestamp;
  const elapsedDays = elapsedSeconds / 86400;
  const positions = [];

  for (const market of current.positions) {
    const hist = await historicalPps(market, blockLookup.block.number, market.ppsNow);
    const ppsPast = hist.pps;
    let apy = null;
    let status = 'warming';
    let historyError = null;
    if (ppsPast != null && ppsPast > 0 && market.ppsNow > 0 && elapsedDays > 0) {
      apy = (Math.pow(market.ppsNow / ppsPast, 365 / elapsedDays) - 1) * 100;
      status = 'ok';
    } else {
      historyError = `historical PPS source mesh exhausted: ${hist.diagnostics.join(' | ')}`;
    }
    positions.push({
      market: market.symbol,
      family: market.family,
      marketVersion: market.version,
      lt: market.lt,
      gauge: market.gauge,
      activeHoldings: market.activeHoldings,
      ppsNow: round(market.ppsNow, 12),
      ppsNowRaw: market.ppsNowRaw,
      pps30dAgo: ppsPast == null ? null : round(ppsPast, 12),
      historicalBlock: ppsPast == null ? null : blockLookup.block.number,
      historicalTimestamp: ppsPast == null ? null : blockLookup.block.timestamp,
      elapsedDays: round(elapsedDays, 6),
      fundamentalTradingApy30dPct: apy == null ? null : round(apy, 6),
      productivityStatus: status,
      productivityMethod: 'proven current active-set LT.pricePerShare now vs historical LT.pricePerShare over bounded trailing-30-day interval; annualized; emissions excluded',
      currentProvider: current.provider,
      historicalProvider: hist.provider,
      historicalDiagnostics: hist.diagnostics,
      historyError
    });
  }

  const ok = positions.every(p => p.productivityStatus === 'ok');
  return {
    status: ok ? 'ok' : 'warming',
    chain: 'Ethereum',
    latestBlock,
    latestTimestamp,
    referenceWindowDays: 30,
    positions,
    verifiedZeroMarkets,
    currentStateProofGeneratedAt: currentState.generatedAt,
    currentStateQuorum: currentState.quorum,
    yieldBasisResolverVersion: YB_RESOLVER_VERSION,
    recoveryMode: 'proven current-state active set + live current PPS + historical source mesh; stale closed positions excluded from current inventory only',
    currentPpsProvider: current.provider,
    currentPpsDiagnostics: current.diagnostics,
    historicalBlockProvider: blockLookup.provider,
    historicalBlockDiagnostics: blockLookup.diagnostics,
    sourceMeshExhausted: !ok,
    blockTagEncoding: 'ethereum-json-rpc-quantity-no-leading-zero',
    methodology: {
      canonicalMetric: 'FT APY (30D) / Fundamental Trading APY',
      formula: '(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
      emissionsIncluded: false,
      redemptionPpsUsedForApr: false,
      currentStateProofIsIncomeAuthority: false,
      currentInventoryDoesNotRewriteHistory: true,
      unknownIsNotZero: true,
      note: 'Only YBLP mechanisms proven active by the independent current-state quorum enter the current resolver. Verified-zero mechanisms leave current inventory but remain historical facts. Reference APY never becomes period-income authority.'
    }
  };
}

async function main() {
  if (!fs.existsSync(OUTPUT_PATH)) {
    throw new Error(`Missing resolver baseline at ${OUTPUT_PATH}. Workflow must preserve a last-known-good non-YB baseline.`);
  }
  if (!fs.existsSync(CURRENT_STATE_PATH)) {
    throw new Error(`Missing current-state proof at ${CURRENT_STATE_PATH}. Run Discover Company #007 first; UNKNOWN != 0.`);
  }

  const baseline = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
  const currentState = JSON.parse(fs.readFileSync(CURRENT_STATE_PATH, 'utf8'));
  validateBaseline(baseline);
  validateCurrentState(currentState);

  const preservedBefore = Object.fromEntries(
    ['crv', 'link', 'zk', 'votium'].map(k => [k, stableHash(baseline.results[k])])
  );

  const startedAt = nowIso();
  const yieldBasis = await resolveCurrentActiveSet(currentState);
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
      ? `YB current active set resolved (${yieldBasis.positions.length} active mechanism(s)); verified-zero mechanisms excluded from current inventory without rewriting history.`
      : 'YB active-set identity is preserved, but a current/historical PPS source remains unavailable. UNKNOWN retained; CRV/LINK/ZK/Votium preserved exactly.'
  };
  output.recovery = {
    mode: 'yield-basis-current-active-set-source-mesh',
    resolverVersion: YB_RESOLVER_VERSION,
    currentStateProof: CURRENT_STATE_PATH.replaceAll('\\', '/'),
    preservedResultSha256: preservedBefore
  };

  for (const key of ['crv', 'link', 'zk', 'votium']) {
    if (stableHash(output.results[key]) !== preservedBefore[key]) {
      throw new Error(`Preservation guard failed: ${key} changed`);
    }
  }

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');
  console.log(`Company #007 YB active-set resolver written: ${OUTPUT_PATH}`);
  console.log(`Yield Basis: ${yieldBasis.status}; active=${yieldBasis.positions.length}; verifiedZero=${yieldBasis.verifiedZeroMarkets.length}`);
  for (const p of yieldBasis.positions || []) {
    console.log(`${p.market}: PPS30d=${p.pps30dAgo ?? 'warming'} FT_APY=${p.fundamentalTradingApy30dPct ?? 'warming'} provider=${p.historicalProvider ?? 'none'}`);
  }
  console.log(`sourceMeshExhausted=${yieldBasis.sourceMeshExhausted === true}`);
  console.log(`readyForFinalIntegrator=${output.productionReadiness.readyForFinalIntegrator}`);
}

main().catch(err => {
  console.error(`Company #007 YB active-set resolver failed: ${errorText(err)}`);
  process.exitCode = 1;
});
