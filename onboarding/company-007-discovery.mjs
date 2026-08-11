import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  keccak256,
  solidityPackedKeccak256,
  concat
} from 'ethers';

const VERSION = '1.1-targeted-resolver';
const DISCOVERY_PATH = process.env.COMPANY_007_DISCOVERY_INPUT
  || path.resolve('companies/company-007-discovery.json');
const OUTPUT_PATH = process.env.COMPANY_007_RESOLVE_OUTPUT
  || path.resolve('companies/company-007-resolve.json');

const WALLETS = [
  getAddress('0x7ec6331188468269dc7c1cf6a84c972632178b1e'),
  getAddress('0x9c548960bd053c8465f298a711b6343ae0360309')
];

const ENTRY = Object.freeze({
  CRV: 0.2129,
  LINK: 14.9,
  ZK: 0.14
});

const RPC = {
  ethereum: uniq([
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com'
  ]),
  base: uniq([
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ]),
  optimism: uniq([
    process.env.OPTIMISM_RPC_URL,
    'https://optimism-rpc.publicnode.com',
    'https://mainnet.optimism.io'
  ]),
  arbitrum: uniq([
    process.env.ARBITRUM_RPC_URL,
    'https://arbitrum-one-rpc.publicnode.com',
    'https://arb1.arbitrum.io/rpc'
  ]),
  zksync: uniq([
    process.env.ZKSYNC_RPC_URL,
    'https://mainnet.era.zksync.io'
  ])
};

const CHAIN_LABEL = {
  ethereum: 'Ethereum',
  base: 'Base',
  optimism: 'Optimism',
  arbitrum: 'Arbitrum',
  zksync: 'ZKsync Era'
};

const CRV = {
  token: getAddress('0xD533a949740bb3306d119CC777fa900bA034cd52'),
  votingEscrow: getAddress('0x5f3b5DfEb7B28CDbD7FAba78963EE202a494e2A2'),
  cvxCRV: getAddress('0x62B9c7356A2Dc64a1969e19C23e4f579F9810Aa7')
};

const LINK = {
  ethereum: getAddress('0x514910771AF9Ca656af840dff83E8264EcF986CA'),
  base: getAddress('0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196'),
  arbitrum: getAddress('0xf97f4df75117a78c1A5a0DBb814Af92458539FB4'),
  optimism: getAddress('0x350a791Bfc2C21F9Ed5d10980Dad2e2638ffa7f6'),
  zksync: getAddress('0x52869bae3E091e36b0915941577F2D47d8d8B534')
};

const ZK = {
  token: getAddress('0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3'),
  coingeckoId: 'zksync'
};

const VOTIUM = {
  repo: 'oo-00/Votium',
  branch: 'main',
  activeTokens:
    'https://raw.githubusercontent.com/oo-00/Votium/main/merkle/activeTokens.json',
  stash: getAddress('0x378Ba9B73309bE80BF4C2c027aAD799766a7ED5A')
};

const YB_MARKETS = [
  {
    symbol: 'yb-WBTC',
    family: 'BTC',
    lt: getAddress('0x651D4b8168488FA163D85304662E8278d4c55BAa'),
    underlyingDecimals: 8
  },
  {
    symbol: 'yb-WETH',
    family: 'ETH',
    lt: getAddress('0x2B9c9f3BdcEb5d8E36a4704F08a78Fca53343cEa'),
    underlyingDecimals: 18
  }
];

function uniq(xs) {
  return [...new Set((xs || []).map(x => String(x || '').trim()).filter(Boolean))];
}
function lower(x) {
  return String(x || '').toLowerCase();
}
function finite(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
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
    process.env.ETH_RPC_URL, process.env.ETH_RPC_URL_2,
    process.env.BASE_RPC_URL, process.env.BASE_RPC_URL_2,
    process.env.OPTIMISM_RPC_URL, process.env.ARBITRUM_RPC_URL,
    process.env.ZKSYNC_RPC_URL
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
function sum(xs) {
  return (xs || []).reduce((a, b) => a + (Number(b) || 0), 0);
}
function nowIso() { return new Date().toISOString(); }

async function fetchJson(url, opts = {}) {
  const timeoutMs = opts.timeoutMs || 15000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = {
      'user-agent': 'The-Holding-Company-007-Resolver/1.1',
      'accept': 'application/vnd.github+json',
      ...(opts.headers || {})
    };
    const r = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function fetchText(url, opts = {}) {
  const timeoutMs = opts.timeoutMs || 15000;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = {
      'user-agent': 'The-Holding-Company-007-Resolver/1.1',
      ...(opts.headers || {})
    };
    const r = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.statusText}`);
    return await r.text();
  } finally {
    clearTimeout(t);
  }
}

async function withProvider(chain, fn) {
  const errors = [];
  for (const url of RPC[chain] || []) {
    const provider = new JsonRpcProvider(url);
    try {
      const result = await fn(provider);
      return { result, provider: `${chain}:${safeHost(url)}`, errors };
    } catch (e) {
      errors.push(`${chain}:${safeHost(url)}: ${errorText(e)}`);
    }
  }
  throw new Error(`${chain} providers exhausted: ${errors.join(' | ')}`);
}

async function safeProvider(chain, fn) {
  try {
    return await withProvider(chain, fn);
  } catch (e) {
    return { result: null, provider: null, errors: [errorText(e)] };
  }
}

async function erc20Balance(provider, token, wallet, decimals = 18) {
  const c = new Contract(token, [
    'function balanceOf(address) view returns (uint256)'
  ], provider);
  const raw = positiveBigInt(await c.balanceOf(wallet));
  return {
    raw: raw.toString(),
    amount: Number(formatUnits(raw, decimals))
  };
}

async function resolveCRV() {
  const r = await safeProvider('ethereum', async provider => {
    const ve = new Contract(CRV.votingEscrow, [
      'function locked(address) view returns (int128 amount,uint256 end)',
      'function token() view returns (address)'
    ], provider);

    const underlying = getAddress(await ve.token());
    if (lower(underlying) !== lower(CRV.token)) {
      throw new Error(`veCRV token mismatch: ${underlying}`);
    }

    const rows = [];
    let directTotal = 0;
    let lockedTotal = 0;
    let cvxCrvCandidateTotal = 0;

    for (const wallet of WALLETS) {
      const direct = await erc20Balance(provider, CRV.token, wallet, 18);
      const cvxCrv = await erc20Balance(provider, CRV.cvxCRV, wallet, 18);

      let lockedRaw = 0n;
      let lockEnd = 0n;
      try {
        const x = await ve.locked(wallet);
        lockedRaw = positiveBigInt(x.amount);
        lockEnd = positiveBigInt(x.end);
      } catch {}

      const locked = Number(formatUnits(lockedRaw, 18));
      directTotal += direct.amount;
      lockedTotal += locked;
      cvxCrvCandidateTotal += cvxCrv.amount;

      rows.push({
        wallet,
        directCRV: round(direct.amount),
        veCRVLockedPrincipal: round(locked),
        veCRVLockEndUnix: lockEnd > 0n ? Number(lockEnd) : null,
        cvxCRVCandidate: round(cvxCrv.amount)
      });
    }

    const publicCandidateQuantity = directTotal + lockedTotal;
    return {
      status: 'ok',
      chain: 'Ethereum',
      crvToken: CRV.token,
      votingEscrow: CRV.votingEscrow,
      rows,
      directCRV: round(directTotal),
      veCRVLockedPrincipal: round(lockedTotal),
      publicCandidateQuantity: round(publicCandidateQuantity),
      entryUsd: ENTRY.CRV,
      costBasisUsd: round(publicCandidateQuantity * ENTRY.CRV, 6),
      cvxCRVCandidateNotAggregated: round(cvxCrvCandidateTotal),
      classificationDecision: lockedTotal > 0
        ? 'veCRV exists; resolver reports it separately. Do not change #007 productivity policy until final integration review.'
        : 'No veCRV lock detected. Public CRV candidate is direct CRV only.',
      note: 'cvxCRV is intentionally not collapsed into CRV without explicit economic-normalization approval.'
    };
  });

  return {
    ...(r.result || { status: 'partial' }),
    diagnostics: r.errors || [],
    provider: r.provider || null
  };
}

async function resolveLINK() {
  const rows = [];
  const diagnostics = [];
  let completeChains = 0;

  for (const [chain, token] of Object.entries(LINK)) {
    const r = await safeProvider(chain, async provider => {
      const chainRows = [];
      for (const wallet of WALLETS) {
        const b = await erc20Balance(provider, token, wallet, 18);
        chainRows.push({
          wallet,
          chain: CHAIN_LABEL[chain],
          token,
          amount: round(b.amount)
        });
      }
      return chainRows;
    });
    diagnostics.push(...(r.errors || []));
    if (r.result) {
      completeChains += 1;
      rows.push(...r.result);
    }
  }

  const quantity = sum(rows.map(x => x.amount));
  return {
    status: completeChains === Object.keys(LINK).length ? 'ok' : 'partial',
    chainsExpected: Object.keys(LINK).length,
    chainsMeasured: completeChains,
    rows,
    quantity: round(quantity),
    entryUsd: ENTRY.LINK,
    costBasisUsd: round(quantity * ENTRY.LINK, 6),
    diagnostics
  };
}

async function resolveZK(discovery) {
  const quantityFromDiscovery = Number(
    discovery?.proposedCompanyBook?.find?.(x => x.symbol === 'ZK')?.quantity || 0
  );

  let quantity = quantityFromDiscovery;
  const chainRead = await safeProvider('zksync', async provider => {
    let total = 0;
    const rows = [];
    for (const wallet of WALLETS) {
      const b = await erc20Balance(provider, ZK.token, wallet, 18);
      total += b.amount;
      rows.push({ wallet, amount: round(b.amount) });
    }
    return { total, rows };
  });
  if (chainRead.result) quantity = chainRead.result.total;

  let priceUsd = null;
  let priceError = null;
  try {
    const j = await fetchJson(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ZK.coingeckoId)}&vs_currencies=usd`,
      { timeoutMs: 12000 }
    );
    priceUsd = finite(j?.[ZK.coingeckoId]?.usd);
  } catch (e) {
    priceError = errorText(e);
  }

  const costBasisUsd = quantity * ENTRY.ZK;
  const currentValueUsd = priceUsd == null ? null : quantity * priceUsd;
  const performanceUsd = currentValueUsd == null ? null : currentValueUsd - costBasisUsd;
  const performancePct = currentValueUsd == null || costBasisUsd <= 0
    ? null : (currentValueUsd / costBasisUsd - 1) * 100;

  return {
    status: chainRead.result && priceUsd != null ? 'ok' : 'partial',
    chain: 'ZKsync Era',
    token: ZK.token,
    coingeckoId: ZK.coingeckoId,
    quantity: round(quantity),
    entryUsd: ENTRY.ZK,
    currentPriceUsd: priceUsd,
    costBasisUsd: round(costBasisUsd, 6),
    currentValueUsd: round(currentValueUsd, 6),
    performanceUsd: round(performanceUsd, 6),
    performancePct: round(performancePct, 6),
    walletRows: chainRead.result?.rows || [],
    diagnostics: [
      ...(chainRead.errors || []),
      ...(priceError ? [`CoinGecko: ${priceError}`] : [])
    ]
  };
}

async function findBlockAtOrBefore(provider, targetTs) {
  const latest = await provider.getBlock('latest');
  if (!latest) throw new Error('latest block unavailable');
  if (Number(latest.timestamp) <= targetTs) return latest;

  // 30 days on Ethereum is roughly 216k blocks. Search a generous recent band.
  let hi = Number(latest.number);
  let lo = Math.max(0, hi - 400000);

  const loBlock = await provider.getBlock(lo);
  if (!loBlock || Number(loBlock.timestamp) > targetTs) {
    throw new Error('30d block fell outside bounded 400k-block search range');
  }

  let best = loBlock;
  for (let i = 0; i < 24 && lo <= hi; i++) {
    const mid = Math.floor((lo + hi) / 2);
    const b = await provider.getBlock(mid);
    if (!b) throw new Error(`block ${mid} unavailable`);
    const ts = Number(b.timestamp);
    if (ts <= targetTs) {
      best = b;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return best;
}

async function resolveYieldBasisPps(discovery) {
  const r = await safeProvider('ethereum', async provider => {
    const latest = await provider.getBlock('latest');
    if (!latest) throw new Error('latest Ethereum block unavailable');

    const targetTs = Number(latest.timestamp) - 30 * 86400;
    const pastBlock = await findBlockAtOrBefore(provider, targetTs);
    const elapsedSeconds = Number(latest.timestamp) - Number(pastBlock.timestamp);
    const elapsedDays = elapsedSeconds / 86400;

    const positions = [];
    let allApy = true;

    for (const market of YB_MARKETS) {
      const lt = new Contract(market.lt, [
        'function pricePerShare() view returns (uint256)',
        'function preview_withdraw(uint256 shares) view returns (uint256)',
        'function balanceOf(address) view returns (uint256)'
      ], provider);

      let walletShares = 0n;
      for (const wallet of WALLETS) {
        try {
          walletShares += positiveBigInt(await lt.balanceOf(wallet));
        } catch {}
      }

      const ppsNowRaw = positiveBigInt(await lt.pricePerShare());
      const redemptionOneShareRaw = positiveBigInt(
        await lt.preview_withdraw(10n ** 18n)
      );

      let ppsPastRaw = 0n;
      let apy = null;
      let historyStatus = 'ok';
      let historyError = null;

      try {
        ppsPastRaw = positiveBigInt(
          await lt.pricePerShare({ blockTag: Number(pastBlock.number) })
        );
        if (ppsPastRaw <= 0n || ppsNowRaw <= 0n) {
          throw new Error('non-positive PPS');
        }
        const ratio = Number(ppsNowRaw) / Number(ppsPastRaw);
        apy = (Math.pow(ratio, 365 / elapsedDays) - 1) * 100;
      } catch (e) {
        historyStatus = 'warming';
        historyError = errorText(e);
        allApy = false;
      }

      const ppsNow = Number(formatUnits(ppsNowRaw, 18));
      const ppsPast = ppsPastRaw > 0n ? Number(formatUnits(ppsPastRaw, 18)) : null;
      const redemptionOneShare = Number(
        formatUnits(redemptionOneShareRaw, market.underlyingDecimals)
      );
      const trdPct = ppsNow > 0
        ? (redemptionOneShare / ppsNow - 1) * 100
        : null;

      positions.push({
        market: market.symbol,
        family: market.family,
        lt: market.lt,
        directShares: Number(formatUnits(walletShares, 18)),
        mode: 'unstaked-plain',
        ppsNow: round(ppsNow, 12),
        pps30dAgo: ppsPast == null ? null : round(ppsPast, 12),
        historicalBlock: ppsPast == null ? null : Number(pastBlock.number),
        historicalTimestamp: ppsPast == null ? null : Number(pastBlock.timestamp),
        elapsedDays: round(elapsedDays, 6),
        fundamentalTradingApy30dPct: apy == null ? null : round(apy, 6),
        redemptionPerShareUnderlying: round(redemptionOneShare, 12),
        trdPct: round(trdPct, 6),
        productivityStatus: historyStatus,
        productivityMethod: 'onchain LT.pricePerShare growth over bounded 30-day block interval; annualized; emissions excluded',
        historyError
      });
    }

    return {
      status: allApy ? 'ok' : 'warming',
      chain: 'Ethereum',
      latestBlock: Number(latest.number),
      latestTimestamp: Number(latest.timestamp),
      referenceWindowDays: 30,
      positions,
      methodology: {
        canonicalMetric: 'FT APY (30D) / Fundamental Trading APY',
        formula: '(PPS_now / PPS_30d_ago)^(365 / elapsed_days) - 1',
        emissionsIncluded: false,
        redemptionPpsUsedForApr: false,
        note: 'pricePerShare is fundamental value. preview_withdraw is used for current redemption/TRD, not for Fundamental Trading APY.'
      }
    };
  });

  return {
    ...(r.result || { status: 'warming', positions: [] }),
    diagnostics: r.errors || [],
    provider: r.provider || null,
    discoveryCrossCheck: (discovery?.discovery?.yieldBasis?.positions || []).map(x => ({
      market: x.market,
      custody: x.custody,
      directLtShares: x.directLtShares,
      gaugeShares: x.gaugeShares,
      totalUnderlying: x.totalUnderlying,
      productivityMode: x.productivityMode
    }))
  };
}

function rootFromJson(j, depth = 0) {
  if (!j || typeof j !== 'object' || depth > 5) return null;
  for (const key of ['merkleRoot', 'root']) {
    if (typeof j[key] === 'string' && /^0x[0-9a-fA-F]{64}$/.test(j[key])) {
      return j[key];
    }
  }
  if (Array.isArray(j)) {
    for (const v of j) {
      const x = rootFromJson(v, depth + 1);
      if (x) return x;
    }
    return null;
  }
  for (const v of Object.values(j)) {
    if (v && typeof v === 'object') {
      const x = rootFromJson(v, depth + 1);
      if (x) return x;
    }
  }
  return null;
}

function normalizeProof(p) {
  if (!Array.isArray(p)) return null;
  const out = p.filter(x => typeof x === 'string' && /^0x[0-9a-fA-F]{64}$/.test(x));
  return out.length === p.length ? out : null;
}

function normalizeLeafCandidate(obj, accountHint = null) {
  if (!obj || typeof obj !== 'object') return null;
  const account = obj.account || obj.address || obj.user || accountHint;
  const index = obj.index ?? obj.claimIndex ?? obj.idx;
  const amount = obj.amount ?? obj.value ?? obj.claimable;
  const proof = normalizeProof(obj.proof || obj.merkleProof || obj.merkle_proof);
  if (!account || index == null || amount == null || !proof) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(account))) return null;
  try {
    return {
      account: getAddress(account),
      index: BigInt(index).toString(),
      amountRaw: BigInt(amount).toString(),
      proof
    };
  } catch {
    return null;
  }
}

function findWalletLeaves(j, walletSet) {
  const results = [];
  const seen = new Set();

  function push(c) {
    if (!c || !walletSet.has(lower(c.account))) return;
    const key = `${lower(c.account)}|${c.index}|${c.amountRaw}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push(c);
  }

  function walk(node, depth = 0) {
    if (depth > 12 || node == null) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x, depth + 1);
      return;
    }
    if (typeof node !== 'object') return;

    push(normalizeLeafCandidate(node));

    for (const [k, v] of Object.entries(node)) {
      if (/^0x[0-9a-fA-F]{40}$/.test(k)) {
        push(normalizeLeafCandidate(v, k));
      }
      if (typeof v === 'object' && v !== null) walk(v, depth + 1);
    }
  }

  walk(j);
  return results;
}

function hashPair(a, b) {
  const A = lower(a);
  const B = lower(b);
  return keccak256(A < B ? concat([a, b]) : concat([b, a]));
}

function verifyVotiumProof(leaf, root) {
  let h = solidityPackedKeccak256(
    ['uint256', 'address', 'uint256'],
    [BigInt(leaf.index), leaf.account, BigInt(leaf.amountRaw)]
  );
  for (const p of leaf.proof) h = hashPair(h, p);
  return lower(h) === lower(root);
}

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN || '';
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    'x-github-api-version': '2022-11-28'
  };
}

async function githubCodeSearch(wallet) {
  const q = `${wallet} repo:${VOTIUM.repo} path:merkle`;
  const url = `https://api.github.com/search/code?q=${encodeURIComponent(q)}&per_page=100`;
  const j = await fetchJson(url, {
    timeoutMs: 20000,
    headers: githubHeaders()
  });
  return Array.isArray(j?.items) ? j.items : [];
}

function currentAggregatePath(symbol) {
  return `merkle/${symbol}/${symbol}.json`;
}

async function getVotiumTokenStates(provider, activeTokens) {
  const stash = new Contract(VOTIUM.stash, [
    'function merkleRoot(address token) view returns (bytes32)',
    'function update(address token) view returns (uint256)',
    'function isClaimed(address token,uint256 index) view returns (bool)'
  ], provider);

  const states = [];
  const concurrency = 8;
  let cursor = 0;

  async function worker() {
    while (cursor < activeTokens.length) {
      const i = cursor++;
      const t = activeTokens[i];
      try {
        const [root, update] = await Promise.all([
          stash.merkleRoot(t.value),
          stash.update(t.value)
        ]);
        states[i] = {
          ...t,
          token: getAddress(String(t.value).toLowerCase()),
          onchainRoot: root,
          update: Number(update),
          hasRoot: !/^0x0{64}$/i.test(root)
        };
      } catch (e) {
        states[i] = {
          ...t,
          token: getAddress(String(t.value).toLowerCase()),
          onchainRoot: null,
          update: null,
          hasRoot: null,
          error: errorText(e)
        };
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { stash, states };
}

async function fetchVotiumAggregate(symbol) {
  const safe = encodeURIComponent(symbol);
  const url = `https://raw.githubusercontent.com/${VOTIUM.repo}/${VOTIUM.branch}/merkle/${safe}/${safe}.json`;
  const txt = await fetchText(url, { timeoutMs: 18000 });
  return { url, json: JSON.parse(txt) };
}

async function resolveVotium() {
  const r = await safeProvider('ethereum', async provider => {
    const activeTokensRaw = await fetchJson(VOTIUM.activeTokens, { timeoutMs: 18000 });
    if (!Array.isArray(activeTokensRaw)) throw new Error('activeTokens.json is not an array');

    const activeTokens = activeTokensRaw
      .filter(x => x?.value && x?.symbol && Number.isFinite(Number(x.decimals)))
      .map(x => ({
        value: getAddress(String(x.value).toLowerCase()),
        label: x.label || null,
        symbol: String(x.symbol),
        decimals: Number(x.decimals)
      }));

    const { stash, states } = await getVotiumTokenStates(provider, activeTokens);
    const stateErrors = states.filter(x => x?.error);
    const rooted = states.filter(x => x?.hasRoot === true);

    // Fast hint: authenticated GitHub code search identifies likely token folders.
    // It is only an optimization. Completeness still comes from the bounded
    // current-root aggregate scan below.
    const hintedSymbols = new Set();
    const searchDiagnostics = [];
    for (const wallet of WALLETS) {
      try {
        const hits = await githubCodeSearch(wallet);
        for (const hit of hits) {
          const p = String(hit?.path || '');
          const parts = p.split('/');
          if (parts[0] === 'merkle' && parts.length >= 3) hintedSymbols.add(parts[1]);
        }
      } catch (e) {
        searchDiagnostics.push(`${wallet}: ${errorText(e)}`);
      }
    }

    const sortedStates = [...rooted].sort((a, b) => {
      const ah = hintedSymbols.has(a.symbol) ? 0 : 1;
      const bh = hintedSymbols.has(b.symbol) ? 0 : 1;
      return ah - bh;
    });

    const walletSet = new Set(WALLETS.map(lower));
    const tokenResults = [];
    const scanErrors = [];
    const started = Date.now();
    const GLOBAL_BUDGET_MS = 95000;
    const concurrency = 5;
    let cursor = 0;

    async function scanWorker() {
      while (cursor < sortedStates.length) {
        if (Date.now() - started > GLOBAL_BUDGET_MS) return;
        const i = cursor++;
        const state = sortedStates[i];
        try {
          const { json } = await fetchVotiumAggregate(state.symbol);
          const fileRoot = rootFromJson(json);
          const rootMatches = Boolean(
            fileRoot && state.onchainRoot && lower(fileRoot) === lower(state.onchainRoot)
          );
          const leaves = findWalletLeaves(json, walletSet);
          const checkedLeaves = [];

          for (const leaf of leaves) {
            const proofValid = rootMatches
              ? verifyVotiumProof(leaf, state.onchainRoot)
              : false;
            let claimed = null;
            if (proofValid) {
              try {
                claimed = Boolean(await stash.isClaimed(state.token, BigInt(leaf.index)));
              } catch {}
            }
            checkedLeaves.push({
              ...leaf,
              proofValid,
              claimed
            });
          }

          tokenResults.push({
            token: state.token,
            symbol: state.symbol,
            label: state.label,
            decimals: state.decimals,
            update: state.update,
            onchainRoot: state.onchainRoot,
            fileRoot,
            rootMatches,
            leaves: checkedLeaves,
            hintedByCodeSearch: hintedSymbols.has(state.symbol)
          });
        } catch (e) {
          scanErrors.push({
            token: state.token,
            symbol: state.symbol,
            error: errorText(e)
          });
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => scanWorker()));

    const budgetExceeded = cursor < sortedStates.length;
    const validUnclaimed = [];

    for (const t of tokenResults) {
      for (const leaf of t.leaves || []) {
        if (t.rootMatches && leaf.proofValid && leaf.claimed === false) {
          validUnclaimed.push({
            token: t.token,
            symbol: t.symbol,
            label: t.label,
            decimals: t.decimals,
            update: t.update,
            wallet: leaf.account,
            index: leaf.index,
            amountRaw: leaf.amountRaw,
            amount: Number(formatUnits(BigInt(leaf.amountRaw), t.decimals)),
            onchainRoot: t.onchainRoot,
            proofValid: true,
            claimed: false
          });
        }
      }
    }

    // Best-effort current USD prices. Amount validity does not depend on pricing.
    const priceMap = {};
    const labels = [...new Set(validUnclaimed.map(x => x.label).filter(Boolean))];
    if (labels.length) {
      try {
        const j = await fetchJson(
          `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(labels.join(','))}&vs_currencies=usd`,
          { timeoutMs: 15000 }
        );
        for (const label of labels) {
          const p = finite(j?.[label]?.usd);
          if (p != null) priceMap[label] = p;
        }
      } catch {}
    }

    const rewards = validUnclaimed.map(x => {
      const priceUsd = x.label ? priceMap[x.label] ?? null : null;
      return {
        ...x,
        priceUsd,
        usdValue: priceUsd == null ? null : round(x.amount * priceUsd, 6)
      };
    });

    const complete =
      !budgetExceeded
      && stateErrors.length === 0
      && scanErrors.length === 0
      && tokenResults.length === rooted.length
      && tokenResults.every(x => x.rootMatches === true);

    return {
      status: complete ? 'ok' : 'partial',
      protocol: 'Votium',
      chain: 'Ethereum',
      stash: VOTIUM.stash,
      activeTokens: activeTokens.length,
      rootedTokens: rooted.length,
      currentAggregateFilesScanned: tokenResults.length,
      currentAggregateFilesExpected: rooted.length,
      budgetExceeded,
      codeSearchHintedSymbols: [...hintedSymbols],
      searchDiagnostics,
      stateErrors,
      scanErrors,
      rewards,
      rewardCount: rewards.length,
      rewardSymbols: [...new Set(rewards.map(x => x.symbol))],
      pricedUsd: round(sum(rewards.map(x => x.usdValue)), 6),
      unpricedRewards: rewards.filter(x => x.usdValue == null).length,
      completeCurrentRootScan: complete,
      zeroIsDefensible: complete && rewards.length === 0,
      methodology: [
        'official oo-00/Votium activeTokens current set',
        'onchain MultiMerkleStash merkleRoot/update',
        'current aggregate Merkle file',
        'file root must equal onchain root',
        'local keccak256(index, account, amount) Merkle proof verification',
        'onchain isClaimed(token,index) must be false',
        'only then count as current Accrued Rewards'
      ]
    };
  });

  return {
    ...(r.result || {
      status: 'partial',
      protocol: 'Votium',
      rewards: [],
      completeCurrentRootScan: false,
      zeroIsDefensible: false
    }),
    diagnostics: r.errors || [],
    provider: r.provider || null
  };
}

async function main() {
  if (!fs.existsSync(DISCOVERY_PATH)) {
    throw new Error(`Missing discovery input: ${DISCOVERY_PATH}`);
  }
  const discovery = JSON.parse(fs.readFileSync(DISCOVERY_PATH, 'utf8'));
  if (discovery?.version !== '1.0-current-state-fast') {
    throw new Error(`Unexpected discovery version: ${discovery?.version}`);
  }
  if (discovery?.company?.registry !== '007') {
    throw new Error('Discovery registry is not 007');
  }

  const startedAt = nowIso();

  const [crv, link, zk, yieldBasis, votium] = await Promise.all([
    resolveCRV(),
    resolveLINK(),
    resolveZK(discovery),
    resolveYieldBasisPps(discovery),
    resolveVotium()
  ]);

  const output = {
    version: VERSION,
    generatedAt: nowIso(),
    startedAt,
    company: {
      registry: '007',
      name: "Rook's portfolio",
      foundedAt: '2026-01-08',
      wallets: WALLETS
    },
    purpose: 'targeted resolution only: CRV, LINK, ZK current price, Yield Basis unstaked yb-LP Productivity, Votium current unclaimed',
    noHistoricalArchaeology: true,
    results: {
      crv,
      link,
      zk,
      yieldBasis,
      votium
    },
    productionReadiness: {
      crvResolved: crv.status === 'ok',
      linkResolved: link.status === 'ok',
      zkResolved: zk.status === 'ok',
      yieldBasisProductivityResolved: yieldBasis.status === 'ok',
      votiumResolved: votium.status === 'ok',
      readyForFinalIntegrator:
        crv.status === 'ok'
        && link.status === 'ok'
        && zk.status === 'ok'
        && yieldBasis.status === 'ok'
        && votium.status === 'ok',
      note: 'A partial Votium or warming Yield Basis result must not be silently converted to zero/APR. Known Company #007 balance and existing known adapters remain valid.'
    }
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2) + '\n');

  console.log(`Company #007 targeted resolver written: ${OUTPUT_PATH}`);
  console.log(`CRV: ${crv.status} qty=${crv.publicCandidateQuantity ?? 'n/a'}`);
  console.log(`LINK: ${link.status} qty=${link.quantity ?? 'n/a'}`);
  console.log(`ZK: ${zk.status} qty=${zk.quantity ?? 'n/a'} price=${zk.currentPriceUsd ?? 'n/a'}`);
  console.log(`Yield Basis: ${yieldBasis.status}`);
  for (const p of yieldBasis.positions || []) {
    console.log(`  ${p.market}: FT APY 30D=${p.fundamentalTradingApy30dPct ?? 'warming'}%`);
  }
  console.log(`Votium: ${votium.status} rewards=${votium.rewardCount ?? 0} USD=${votium.pricedUsd ?? 0}`);
}

main().catch(err => {
  console.error(`Company #007 targeted resolver failed: ${errorText(err)}`);
  process.exitCode = 1;
});
