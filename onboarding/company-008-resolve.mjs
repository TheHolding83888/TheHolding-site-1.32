import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  getAddress
} from 'ethers';

function canonicalAddress(value) {
  return getAddress(String(value).toLowerCase());
}

const VERSION = '1.2-company-008-atoken-base-holdings-final-delta';
const WALLET = canonicalAddress('0xe4b9c9ced406baffe406e63f83d39daaef150596');

const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT
  || path.resolve('companies/company-008-resolve.json');

const PREVIOUS_RESOLVER_FILE = path.resolve('companies/company-008-resolve.json');
const DISCOVERY_FILE = path.resolve('companies/company-008-discovery.json');

const RPC = Object.freeze({
  base: [
    process.env.BASE_RPC_URL,
    process.env.BASE_RPC_URL_2,
    'https://base-rpc.publicnode.com',
    'https://mainnet.base.org'
  ].filter(Boolean),
  avalanche: [
    process.env.AVALANCHE_RPC_URL,
    'https://avalanche-c-chain-rpc.publicnode.com',
    'https://api.avax.network/ext/bc/C/rpc'
  ].filter(Boolean)
});

const TARGET = Object.freeze({
  avalancheBtcB: canonicalAddress('0x152b9d0fdc40c096757f570a51e494bd4b943e50'),
  avalancheABtcB: canonicalAddress('0x8ffdf2de812095b1d19cb146e4c004587c0a0692'),
  baseWeth: canonicalAddress('0x4200000000000000000000000000000000000006')
});

const EXPECTED = Object.freeze({
  avalancheBtcB: 0.0435,
  baseWeth: 0.1606
});

function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .slice(0, 900);
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function round(value, digits = 12) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
}

function positiveBigInt(value) {
  try {
    const n = BigInt(value);
    return n > 0n ? n : 0n;
  } catch {
    return 0n;
  }
}

async function fetchJson(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'user-agent': 'The-Holding-Company-008-Resolver/1.2'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function withProvider(chain, fn) {
  const errors = [];

  for (const url of RPC[chain] || []) {
    const provider = new JsonRpcProvider(url);

    try {
      const result = await fn(provider);
      return { result, errors };
    } catch (e) {
      errors.push(errMsg(e));
    }
  }

  return { result: null, errors };
}

async function callMaybe(contract, method, args = [], staticCall = false) {
  try {
    const fn = contract?.[method];

    if (!fn) {
      return { ok: false, error: 'method unavailable in local ABI' };
    }

    const value = staticCall
      ? await fn.staticCall(...args)
      : await fn(...args);

    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

function serializeProbe(probe) {
  if (!probe?.ok) {
    return { ok: false, error: probe?.error || 'unknown' };
  }

  const value = probe.value;

  if (typeof value === 'bigint') {
    return { ok: true, value: value.toString() };
  }

  return { ok: true, value: String(value) };
}

async function tokenMeta(provider, address, wallet = WALLET) {
  const token = new Contract(address, [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)'
  ], provider);

  let symbol = null;
  let name = null;
  let decimals = 18;
  let raw = 0n;

  try { symbol = await token.symbol(); } catch {}
  try { name = await token.name(); } catch {}
  try { decimals = Number(await token.decimals()); } catch {}
  try { raw = positiveBigInt(await token.balanceOf(wallet)); } catch {}

  return {
    address: canonicalAddress(address),
    symbol,
    name,
    decimals,
    raw: raw.toString(),
    balance: Number(formatUnits(raw, decimals))
  };
}

function readPreviousResolver() {
  try {
    const d = JSON.parse(fs.readFileSync(PREVIOUS_RESOLVER_FILE, 'utf8'));

    if (d?.version !== '1.1-company-008-veda-accountant-holdings-mesh') {
      return {
        status: 'unexpected-version',
        version: d?.version || null
      };
    }

    const eth = d?.results?.lombardEthereum;
    const base = d?.results?.lombardBase;

    if (eth?.matched !== true || base?.matched !== true) {
      return {
        status: 'previous-lombard-not-fully-resolved',
        version: d.version
      };
    }

    return {
      status: 'ok',
      version: d.version,
      lombardEthereum: {
        quoteEquivalent: Number(eth.quoteEquivalent),
        shareBalance: Number(eth?.share?.balance),
        accountant: eth.accountant,
        vault: eth.vault,
        rateMethod: eth.rateMethod
      },
      lombardBase: {
        quoteEquivalent: Number(base.quoteEquivalent),
        shareBalance: Number(base?.share?.balance),
        accountant: base.accountant,
        vault: base.vault,
        rateMethod: base.rateMethod
      }
    };
  } catch (e) {
    return {
      status: 'unavailable',
      error: errMsg(e)
    };
  }
}

function readDiscoveryKnownSubtotals() {
  try {
    const d = JSON.parse(fs.readFileSync(DISCOVERY_FILE, 'utf8'));

    const btc = (d?.proposedCompanyBook || [])
      .find(x => x.symbol === 'BTC');

    const eth = (d?.proposedCompanyBook || [])
      .find(x => x.symbol === 'ETH');

    return {
      status: 'ok',
      version: d?.version || null,
      btcSubtotal: Number(btc?.quantity) || 0,
      ethNativeSubtotal: Number(eth?.quantity) || 0
    };
  } catch (e) {
    return {
      status: 'unavailable',
      version: null,
      btcSubtotal: 0,
      ethNativeSubtotal: 0,
      error: errMsg(e)
    };
  }
}

async function resolveAvalancheAToken() {
  const wrapped = await withProvider('avalanche', async provider => {
    const meta = await tokenMeta(provider, TARGET.avalancheABtcB);

    const aToken = new Contract(TARGET.avalancheABtcB, [
      'function UNDERLYING_ASSET_ADDRESS() view returns (address)',
      'function POOL() view returns (address)',
      'function scaledBalanceOf(address) view returns (uint256)'
    ], provider);

    const underlyingProbe = await callMaybe(
      aToken,
      'UNDERLYING_ASSET_ADDRESS'
    );

    const poolProbe = await callMaybe(aToken, 'POOL');
    const scaledProbe = await callMaybe(
      aToken,
      'scaledBalanceOf',
      [WALLET]
    );

    let underlying = null;
    let pool = null;

    if (underlyingProbe.ok) {
      try {
        underlying = canonicalAddress(underlyingProbe.value);
      } catch {}
    }

    if (poolProbe.ok) {
      try {
        pool = canonicalAddress(poolProbe.value);
      } catch {}
    }

    let poolCodeExists = false;

    if (pool) {
      try {
        poolCodeExists = (await provider.getCode(pool)) !== '0x';
      } catch {}
    }

    const underlyingMatch =
      underlying
      && lower(underlying) === lower(TARGET.avalancheBtcB);

    const tolerance = Math.max(
      0.00015,
      EXPECTED.avalancheBtcB * 0.02
    );

    const matched =
      underlyingMatch
      && poolCodeExists
      && Math.abs(meta.balance - EXPECTED.avalancheBtcB) <= tolerance;

    return {
      protocol: 'Aave',
      chain: 'Avalanche',
      aToken: TARGET.avalancheABtcB,
      aTokenMeta: meta,
      underlying,
      expectedUnderlying: TARGET.avalancheBtcB,
      underlyingMatch: Boolean(underlyingMatch),
      pool,
      poolCodeExists,
      scaledBalanceRaw:
        scaledProbe.ok
          ? positiveBigInt(scaledProbe.value).toString()
          : null,
      btcBEquivalent: round(meta.balance),
      accountingMethod:
        'Aave aToken balanceOf(wallet), after UNDERLYING_ASSET_ADDRESS + POOL verification',
      ownerObservedApprox: EXPECTED.avalancheBtcB,
      tolerance: round(tolerance),
      deltaVsOwnerObserved: round(
        meta.balance - EXPECTED.avalancheBtcB
      ),
      matched,
      status: matched ? 'ok' : 'unresolved',
      probes: {
        underlying: serializeProbe(underlyingProbe),
        pool: serializeProbe(poolProbe),
        scaledBalance: serializeProbe(scaledProbe)
      }
    };
  });

  return wrapped.result || {
    protocol: 'Aave',
    chain: 'Avalanche',
    matched: false,
    status: 'unavailable',
    diagnostics: wrapped.errors
  };
}

async function routescanAllCurrentHoldings(maxPages = 10) {
  const base =
    `https://api.routescan.io/v2/network/mainnet/evm/all/address/${WALLET}/erc20-holdings`;

  const items = [];
  const diagnostics = [];
  let next = null;

  for (let page = 0; page < maxPages; page++) {
    let url = `${base}?limit=100`;

    if (next) {
      url += `&next=${encodeURIComponent(next)}`;
    }

    try {
      const data = await fetchJson(url);

      if (Array.isArray(data?.items)) {
        items.push(...data.items);
      }

      const candidateNext =
        data?.link?.nextToken
        || data?.link?.next
        || null;

      if (!candidateNext || candidateNext === next) {
        break;
      }

      if (/^https?:\/\//i.test(String(candidateNext))) {
        try {
          const u = new URL(candidateNext);
          next =
            u.searchParams.get('next')
            || u.searchParams.get('cursor')
            || null;
        } catch {
          next = null;
        }
      } else {
        next = String(candidateNext);
      }

      if (!next) {
        break;
      }
    } catch (e) {
      diagnostics.push(errMsg(e));
      break;
    }
  }

  const normalized = items.map(item => {
    const decimals = Number(item?.tokenDecimals ?? 18);
    const raw = positiveBigInt(item?.tokenQuantity ?? 0);

    return {
      chainId: String(item?.chainId ?? ''),
      tokenAddress: (() => {
        try {
          return canonicalAddress(item?.tokenAddress);
        } catch {
          return item?.tokenAddress || null;
        }
      })(),
      tokenName: item?.tokenName || null,
      tokenSymbol: item?.tokenSymbol || null,
      tokenDecimals: decimals,
      tokenQuantityRaw: raw.toString(),
      tokenQuantity:
        raw > 0n
          ? round(Number(formatUnits(raw, decimals)))
          : 0,
      tokenPrice: item?.tokenPrice ?? null,
      tokenValueInUsd:
        Number.isFinite(Number(item?.tokenValueInUsd))
          ? Number(item.tokenValueInUsd)
          : null,
      updatedAtBlock: item?.updatedAtBlock ?? null
    };
  }).filter(x => positiveBigInt(x.tokenQuantityRaw) > 0n);

  return {
    source: 'Routescan keyless all-chain current ERC20 holdings',
    itemCount: normalized.length,
    diagnostics,
    items: normalized
  };
}

function materialCandidate(item) {
  const usd = Number(item?.tokenValueInUsd);

  if (Number.isFinite(usd) && usd >= 5) {
    return true;
  }

  const text =
    `${item?.tokenSymbol || ''} ${item?.tokenName || ''}`
      .toLowerCase();

  return /(eth|weth|aave|morpho|vault|receipt|share|liquid|veda|ether|superform|beefy|moonwell)/i
    .test(text);
}

async function probeBaseWethCandidate(provider, holding) {
  let address;

  try {
    address = canonicalAddress(holding.tokenAddress);
  } catch {
    return {
      ...holding,
      probeStatus: 'invalid-address'
    };
  }

  const meta = await tokenMeta(provider, address);

  const c = new Contract(address, [
    'function UNDERLYING_ASSET_ADDRESS() view returns (address)',
    'function POOL() view returns (address)',
    'function asset() view returns (address)',
    'function underlying() view returns (address)',
    'function balanceOfUnderlying(address) returns (uint256)',
    'function convertToAssets(uint256) view returns (uint256)',
    'function previewRedeem(uint256) view returns (uint256)'
  ], provider);

  const probes = {
    aaveUnderlying:
      await callMaybe(c, 'UNDERLYING_ASSET_ADDRESS'),
    pool:
      await callMaybe(c, 'POOL'),
    asset:
      await callMaybe(c, 'asset'),
    underlying:
      await callMaybe(c, 'underlying')
  };

  let relation = null;
  let underlyingAddress = null;

  for (const [name, probe] of [
    ['UNDERLYING_ASSET_ADDRESS', probes.aaveUnderlying],
    ['asset', probes.asset],
    ['underlying', probes.underlying]
  ]) {
    if (!probe.ok) {
      continue;
    }

    try {
      const candidate = canonicalAddress(probe.value);

      if (lower(candidate) === lower(TARGET.baseWeth)) {
        relation = name;
        underlyingAddress = candidate;
        break;
      }
    } catch {}
  }

  if (!relation) {
    return {
      ...holding,
      onchainMeta: meta,
      relation: null,
      targetUnderlying: TARGET.baseWeth,
      resolvedWeth: null,
      conversionMethod: null,
      probeStatus: 'not-weth-underlying',
      probes: Object.fromEntries(
        Object.entries(probes)
          .map(([k, v]) => [k, serializeProbe(v)])
      )
    };
  }

  let resolvedRaw = 0n;
  let method = null;

  if (relation === 'UNDERLYING_ASSET_ADDRESS') {
    let pool = null;
    let poolCodeExists = false;

    if (probes.pool.ok) {
      try {
        pool = canonicalAddress(probes.pool.value);
      } catch {}
    }

    if (pool) {
      try {
        poolCodeExists = (await provider.getCode(pool)) !== '0x';
      } catch {}
    }

    const looksAave =
      poolCodeExists
      && (
        /aave/i.test(`${meta.name || ''} ${meta.symbol || ''}`)
        || /^a[A-Za-z0-9._-]+/.test(meta.symbol || '')
      );

    if (looksAave) {
      resolvedRaw = BigInt(meta.raw);
      method =
        'Aave-style aToken balanceOf(wallet) after UNDERLYING_ASSET_ADDRESS + POOL verification';
    }
  }

  if (resolvedRaw === 0n) {
    const balanceUnderlying =
      await callMaybe(
        c,
        'balanceOfUnderlying',
        [WALLET],
        true
      );

    if (
      balanceUnderlying.ok
      && positiveBigInt(balanceUnderlying.value) > 0n
    ) {
      resolvedRaw = positiveBigInt(balanceUnderlying.value);
      method = 'balanceOfUnderlying.staticCall';
    }
  }

  if (resolvedRaw === 0n && BigInt(meta.raw) > 0n) {
    for (const methodName of [
      'convertToAssets',
      'previewRedeem'
    ]) {
      const probe =
        await callMaybe(
          c,
          methodName,
          [BigInt(meta.raw)]
        );

      if (probe.ok && positiveBigInt(probe.value) > 0n) {
        resolvedRaw = positiveBigInt(probe.value);
        method = methodName;
        break;
      }
    }
  }

  const resolvedWeth =
    resolvedRaw > 0n
      ? Number(formatUnits(resolvedRaw, 18))
      : null;

  return {
    ...holding,
    onchainMeta: meta,
    relation,
    targetUnderlying: TARGET.baseWeth,
    resolvedWeth: round(resolvedWeth),
    conversionMethod: method,
    probeStatus:
      resolvedRaw > 0n
        ? 'resolved'
        : 'weth-underlying-but-conversion-unresolved',
    probes: Object.fromEntries(
      Object.entries(probes)
        .map(([k, v]) => [k, serializeProbe(v)])
    )
  };
}

async function resolveBaseWeth() {
  const holdings = await routescanAllCurrentHoldings();

  const baseItems =
    holdings.items
      .filter(x => x.chainId === '8453');

  const wrapped = await withProvider('base', async provider => {
    const candidates =
      baseItems
        .filter(materialCandidate)
        .sort(
          (a, b) =>
            (Number(b.tokenValueInUsd) || 0)
            - (Number(a.tokenValueInUsd) || 0)
        )
        .slice(0, 60);

    const probed = [];

    for (const candidate of candidates) {
      probed.push(
        await probeBaseWethCandidate(
          provider,
          candidate
        )
      );
    }

    const resolved =
      probed.filter(
        x =>
          Number.isFinite(x.resolvedWeth)
          && x.resolvedWeth > 0
      );

    const aggregate =
      resolved.reduce(
        (sum, x) => sum + x.resolvedWeth,
        0
      );

    const tolerance =
      Math.max(
        0.001,
        EXPECTED.baseWeth * 0.03
      );

    const matched =
      aggregate > 0
      && Math.abs(
        aggregate - EXPECTED.baseWeth
      ) <= tolerance;

    return {
      chain: 'Base',
      targetUnderlying: TARGET.baseWeth,
      ownerObservedApprox: EXPECTED.baseWeth,
      routescanEndpointMode:
        'all-chain endpoint, client-side filter chainId=8453',
      allChainHoldingsDiagnostics:
        holdings.diagnostics,
      baseHoldingCount: baseItems.length,
      baseHoldings: baseItems,
      probedCandidates: probed,
      resolvedComponents:
        resolved.map(x => ({
          tokenAddress: x.tokenAddress,
          tokenSymbol: x.tokenSymbol,
          tokenName: x.tokenName,
          relation: x.relation,
          resolvedWeth: x.resolvedWeth,
          conversionMethod: x.conversionMethod
        })),
      wethEquivalent: round(aggregate),
      tolerance: round(tolerance),
      deltaVsOwnerObserved:
        aggregate > 0
          ? round(
              aggregate - EXPECTED.baseWeth
            )
          : null,
      matched,
      status:
        matched
          ? 'ok'
          : (
              aggregate > 0
                ? 'partial-or-outside-owner-tolerance'
                : 'unresolved'
            )
    };
  });

  return wrapped.result || {
    chain: 'Base',
    targetUnderlying: TARGET.baseWeth,
    ownerObservedApprox: EXPECTED.baseWeth,
    matched: false,
    status: 'unavailable',
    routescanHoldings: holdings,
    diagnostics: wrapped.errors
  };
}

async function main() {
  const startedAt = new Date().toISOString();

  const previous = readPreviousResolver();
  const discovery = readDiscoveryKnownSubtotals();

  if (previous.status !== 'ok') {
    throw new Error(
      `Previous v1.1 resolver state unavailable: ${JSON.stringify(previous)}`
    );
  }

  if (discovery.status !== 'ok') {
    throw new Error(
      `Discovery baseline unavailable: ${JSON.stringify(discovery)}`
    );
  }

  const [
    avalanche,
    baseWeth
  ] = await Promise.all([
    resolveAvalancheAToken(),
    resolveBaseWeth()
  ]);

  const resolution = {
    lombardEthereumWbtc: true,
    lombardBaseWbtc: true,
    avalancheBtcB: avalanche?.matched === true,
    baseWeth: baseWeth?.matched === true
  };

  const unresolved =
    Object.entries(resolution)
      .filter(([, ok]) => !ok)
      .map(([key]) => key);

  const finalCandidateBtc =
    discovery.btcSubtotal
    + previous.lombardEthereum.quoteEquivalent
    + previous.lombardBase.quoteEquivalent
    + (Number(avalanche?.btcBEquivalent) || 0);

  const finalCandidateEth =
    discovery.ethNativeSubtotal
    + (Number(baseWeth?.wethEquivalent) || 0);

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,

    company: {
      registry: '008',
      name: '1milliondollar.eth',
      wallet: WALLET
    },

    purpose:
      'close only final Company #008 BTC/ETH delta: verify Avalanche Aave aToken and enumerate Base WETH receipt holdings using Routescan all-chain endpoint',

    methodology: {
      preserveSolvedState:
        'Lombard v1.1 results reused as already-resolved state; not re-researched',
      avalancheAave:
        'aToken balanceOf accepted only after UNDERLYING_ASSET_ADDRESS and POOL contract verification',
      baseHoldings:
        'Routescan documented all-chain ERC20 holdings endpoint; filter Base chainId client-side to avoid chain-specific endpoint failure',
      baseWeth:
        'resolve only receipt tokens whose onchain underlying relation is Base WETH; use Aave current balance or reproducible redemption conversion',
      ownerObserved:
        'rounded owner values are reconciliation targets only, never accounting source'
    },

    preservedResolved: {
      previousResolverVersion: previous.version,
      lombardEthereum: previous.lombardEthereum,
      lombardBase: previous.lombardBase
    },

    discoveryBaseline: discovery,

    expectedApprox: EXPECTED,

    results: {
      avalancheAaveBtcB: avalanche,
      baseWethCurrentHoldings: baseWeth
    },

    resolution: {
      ...resolution,
      unresolved,
      allResolved: unresolved.length === 0
    },

    finalCandidateTotals: {
      btc: round(finalCandidateBtc),
      eth: round(finalCandidateEth),
      authoritative: unresolved.length === 0
    },

    nextStep:
      unresolved.length === 0
        ? 'Company #008 BTC/ETH balance discovery closed; proceed to production integration'
        : 'target only the exact still-unresolved component(s)'
  };

  fs.mkdirSync(
    path.dirname(OUTPUT),
    { recursive: true }
  );

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(output, null, 2) + '\n'
  );

  console.log(
    `Company #008 targeted resolver v1.2 written: ${OUTPUT}`
  );
  console.log(
    `Avalanche Aave BTC.b matched: ${resolution.avalancheBtcB}`
  );
  console.log(
    `Base WETH matched: ${resolution.baseWeth}`
  );
  console.log(
    `Unresolved: ${unresolved.join(', ') || 'none'}`
  );
  console.log(
    `Final candidate BTC: ${output.finalCandidateTotals.btc}`
  );
  console.log(
    `Final candidate ETH: ${output.finalCandidateTotals.eth}`
  );
}

main().catch(err => {
  console.error(
    `Company #008 targeted resolver v1.2 failed: ${errMsg(err)}`
  );
  process.exitCode = 1;
});
