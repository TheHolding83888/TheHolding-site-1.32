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

const VERSION = '1.1-company-008-veda-accountant-holdings-mesh';
const WALLET = canonicalAddress('0xe4b9c9ced406baffe406e63f83d39daaef150596');

const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT
  || path.resolve('companies/company-008-resolve.json');

const DISCOVERY_FILE = path.resolve('companies/company-008-discovery.json');

const RPC = Object.freeze({
  ethereum: [
    process.env.ETH_RPC_URL,
    process.env.ETH_RPC_URL_2,
    'https://ethereum-rpc.publicnode.com',
    'https://eth.llamarpc.com'
  ].filter(Boolean),
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

const CHAIN_ID = Object.freeze({
  ethereum: 1,
  base: 8453,
  avalanche: 43114
});

const T = Object.freeze({
  lbtcv: canonicalAddress('0x5401b8620e5fb570064ca9114fd1e135fd77d57c'),
  lombardAccountantCandidate: canonicalAddress('0x28634d0c5edc67cf2450e74dea49b90a4ff93dce'),

  ethereumWbtc: canonicalAddress('0x2260fac5e5542a773aa44fbcfedf7c193bc2c599'),
  baseWbtc: canonicalAddress('0x0555e30da8f98308edb960aa94c0db47230d2b9c'),

  baseWeth: canonicalAddress('0x4200000000000000000000000000000000000006'),
  liquidEthVaultCandidate: canonicalAddress('0xf0bb20865277abd641a307ece5ee04e79073416c'),
  liquidEthAccountantCandidate: canonicalAddress('0x0d05d94a5f1e76c18fbeb7a13d17c8a314088198'),

  avalancheBtcB: canonicalAddress('0x152b9d0fdc40c096757f570a51e494bd4b943e50')
});

const EXPECTED = Object.freeze({
  avalancheBtcB: 0.0435,
  lombardEthereumWbtc: 0.0028,
  lombardBaseWbtc: 0.0048,
  baseWeth: 0.1606
});

const KNOWN_FROM_DISCOVERY = Object.freeze({
  btcSubtotalBeforeUnresolved: 0.02160392,
  nativeEthSubtotalBeforeUnresolved: 0.006426130614
});

function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .slice(0, 800);
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

function lower(value) {
  return String(value || '').toLowerCase();
}

async function fetchJson(url, timeoutMs = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'user-agent': 'The-Holding-Company-008-Resolver/1.1' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
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
    if (!fn) return { ok: false, error: 'method unavailable in local ABI' };
    const value = staticCall
      ? await fn.staticCall(...args)
      : await fn(...args);
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
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

function serializeProbe(probe) {
  if (!probe?.ok) return { ok: false, error: probe?.error || 'unknown' };
  const value = probe.value;
  if (typeof value === 'bigint') return { ok: true, value: value.toString() };
  if (Array.isArray(value)) {
    return {
      ok: true,
      value: value.map(x => typeof x === 'bigint' ? x.toString() : String(x))
    };
  }
  return { ok: true, value: String(value) };
}

async function resolveBoringVault({
  chain,
  label,
  vaultAddress,
  accountantAddress,
  quoteAddress,
  expectedApprox
}) {
  const wrapped = await withProvider(chain, async provider => {
    const vaultCode = await provider.getCode(vaultAddress);
    const accountantCode = await provider.getCode(accountantAddress);

    const share = await tokenMeta(provider, vaultAddress);

    const accountant = new Contract(accountantAddress, [
      'function vault() view returns (address)',
      'function base() view returns (address)',
      'function decimals() view returns (uint8)',
      'function getRate() view returns (uint256)',
      'function getRateSafe() view returns (uint256)',
      'function getRateInQuote(address) view returns (uint256)',
      'function getRateInQuoteSafe(address) view returns (uint256)',
      'function accountantState() view returns (address,uint96,uint128,uint128,uint96,uint16,uint16,uint64,bool,uint24,uint16,uint16)'
    ], provider);

    const quote = await tokenMeta(provider, quoteAddress);

    const probes = {
      vault: await callMaybe(accountant, 'vault'),
      base: await callMaybe(accountant, 'base'),
      decimals: await callMaybe(accountant, 'decimals'),
      getRate: await callMaybe(accountant, 'getRate'),
      getRateSafe: await callMaybe(accountant, 'getRateSafe'),
      getRateInQuote: await callMaybe(accountant, 'getRateInQuote', [quoteAddress]),
      getRateInQuoteSafe: await callMaybe(accountant, 'getRateInQuoteSafe', [quoteAddress]),
      accountantState: await callMaybe(accountant, 'accountantState')
    };

    let accountantVault = null;
    let base = null;
    let rateDecimals = null;
    let isPaused = null;

    if (probes.vault.ok) {
      try { accountantVault = canonicalAddress(probes.vault.value); } catch {}
    }
    if (probes.base.ok) {
      try { base = canonicalAddress(probes.base.value); } catch {}
    }
    if (probes.decimals.ok) {
      try { rateDecimals = Number(probes.decimals.value); } catch {}
    }
    if (probes.accountantState.ok && Array.isArray(probes.accountantState.value)) {
      try { isPaused = Boolean(probes.accountantState.value[8]); } catch {}
    }

    const vaultMatch = accountantVault && lower(accountantVault) === lower(vaultAddress);

    let quoteRateRaw = 0n;
    let rateMethod = null;

    for (const [method, probe] of [
      ['getRateInQuoteSafe', probes.getRateInQuoteSafe],
      ['getRateInQuote', probes.getRateInQuote]
    ]) {
      if (probe.ok && positiveBigInt(probe.value) > 0n) {
        quoteRateRaw = positiveBigInt(probe.value);
        rateMethod = `Accountant.${method}(quote)`;
        break;
      }
    }

    if (quoteRateRaw === 0n && base && lower(base) === lower(quoteAddress)) {
      for (const [method, probe] of [
        ['getRateSafe', probes.getRateSafe],
        ['getRate', probes.getRate]
      ]) {
        if (probe.ok && positiveBigInt(probe.value) > 0n) {
          quoteRateRaw = positiveBigInt(probe.value);
          rateMethod = `Accountant.${method}() [base == quote]`;
          break;
        }
      }
    }

    let quoteRaw = 0n;
    if (share.raw !== '0' && quoteRateRaw > 0n) {
      const oneShare = 10n ** BigInt(share.decimals);
      quoteRaw = (BigInt(share.raw) * quoteRateRaw) / oneShare;
    }

    const quoteEquivalent = quoteRaw > 0n
      ? Number(formatUnits(quoteRaw, quote.decimals))
      : null;

    const tolerance = Math.max(0.00015, expectedApprox * 0.03);
    const matched = Number.isFinite(quoteEquivalent)
      && Math.abs(quoteEquivalent - expectedApprox) <= tolerance;

    return {
      label,
      chain,
      vault: vaultAddress,
      vaultCodeExists: vaultCode !== '0x',
      share,
      accountant: accountantAddress,
      accountantCodeExists: accountantCode !== '0x',
      accountantVault,
      vaultMatch: Boolean(vaultMatch),
      base,
      accountantDecimals: rateDecimals,
      isPaused,
      quote: {
        address: quoteAddress,
        symbol: quote.symbol,
        decimals: quote.decimals
      },
      rateMethod,
      quoteRateRaw: quoteRateRaw.toString(),
      quoteEquivalent: round(quoteEquivalent),
      ownerObservedApprox: expectedApprox,
      tolerance: round(tolerance),
      deltaVsOwnerObserved: Number.isFinite(quoteEquivalent)
        ? round(quoteEquivalent - expectedApprox)
        : null,
      matched,
      status: matched
        ? 'ok'
        : (share.balance > 0 && vaultMatch && quoteRateRaw > 0n
            ? 'resolved-but-outside-owner-tolerance'
            : 'unresolved'),
      probes: Object.fromEntries(
        Object.entries(probes).map(([key, value]) => [key, serializeProbe(value)])
      )
    };
  });

  return wrapped.result || {
    label,
    chain,
    status: 'unavailable',
    matched: false,
    diagnostics: wrapped.errors
  };
}

async function routescanHoldings(chain, maxPages = 3) {
  const chainId = CHAIN_ID[chain];
  const base = `https://api.routescan.io/v2/network/mainnet/evm/${chainId}/address/${WALLET}/erc20-holdings`;
  const items = [];
  const diagnostics = [];
  let next = null;

  for (let page = 0; page < maxPages; page++) {
    let url = `${base}?limit=100`;
    if (next) url += `&next=${encodeURIComponent(next)}`;

    try {
      const data = await fetchJson(url);
      if (Array.isArray(data?.items)) items.push(...data.items);

      const candidateNext = data?.link?.nextToken || data?.link?.next || null;
      if (!candidateNext || candidateNext === next) break;

      if (/^https?:\/\//i.test(String(candidateNext))) {
        try {
          const u = new URL(candidateNext);
          next = u.searchParams.get('next') || u.searchParams.get('cursor') || null;
        } catch {
          next = null;
        }
      } else {
        next = String(candidateNext);
      }

      if (!next) break;
    } catch (e) {
      diagnostics.push(errMsg(e));
      break;
    }
  }

  const normalized = items.map(item => {
    const decimals = Number(item?.tokenDecimals ?? 18);
    const raw = positiveBigInt(item?.tokenQuantity ?? 0);
    const quantity = raw > 0n ? Number(formatUnits(raw, decimals)) : 0;
    const usd = Number(item?.tokenValueInUsd);

    return {
      chainId: String(item?.chainId ?? chainId),
      tokenAddress: (() => {
        try { return canonicalAddress(item?.tokenAddress); }
        catch { return item?.tokenAddress || null; }
      })(),
      tokenName: item?.tokenName || null,
      tokenSymbol: item?.tokenSymbol || null,
      tokenDecimals: decimals,
      tokenQuantityRaw: raw.toString(),
      tokenQuantity: round(quantity),
      tokenPrice: item?.tokenPrice ?? null,
      tokenValueInUsd: Number.isFinite(usd) ? usd : null,
      updatedAtBlock: item?.updatedAtBlock ?? null
    };
  }).filter(x => positiveBigInt(x.tokenQuantityRaw) > 0n);

  return {
    chain,
    chainId,
    source: 'Routescan keyless current ERC20 holdings',
    itemCount: normalized.length,
    diagnostics,
    items: normalized
  };
}

function isMaterialHolding(item) {
  const usd = Number(item?.tokenValueInUsd);
  if (Number.isFinite(usd) && usd >= 10) return true;

  const text = `${item?.tokenSymbol || ''} ${item?.tokenName || ''}`.toLowerCase();
  return /(btc|wbtc|lbtc|btc\.b|eth|weth|vault|receipt|share|qi|aave|morpho|benqi)/i.test(text);
}

async function probeReceiptCandidate(provider, holding, targetUnderlying) {
  let tokenAddress;
  try {
    tokenAddress = canonicalAddress(holding.tokenAddress);
  } catch {
    return { ...holding, probeStatus: 'invalid-address' };
  }

  const shareMeta = await tokenMeta(provider, tokenAddress);

  const contract = new Contract(tokenAddress, [
    'function asset() view returns (address)',
    'function underlying() view returns (address)',
    'function balanceOfUnderlying(address) returns (uint256)',
    'function exchangeRateStored() view returns (uint256)',
    'function convertToAssets(uint256) view returns (uint256)',
    'function previewRedeem(uint256) view returns (uint256)'
  ], provider);

  const assetProbe = await callMaybe(contract, 'asset');
  const underlyingProbe = await callMaybe(contract, 'underlying');

  let underlying = null;
  for (const probe of [assetProbe, underlyingProbe]) {
    if (probe.ok) {
      try { underlying = canonicalAddress(probe.value); } catch {}
      if (underlying) break;
    }
  }

  const pointsToTarget = underlying && lower(underlying) === lower(targetUnderlying);

  let resolvedUnderlyingRaw = 0n;
  let method = null;

  if (pointsToTarget) {
    const balanceUnderlying = await callMaybe(
      contract,
      'balanceOfUnderlying',
      [WALLET],
      true
    );

    if (balanceUnderlying.ok && positiveBigInt(balanceUnderlying.value) > 0n) {
      resolvedUnderlyingRaw = positiveBigInt(balanceUnderlying.value);
      method = 'balanceOfUnderlying.staticCall';
    }

    if (resolvedUnderlyingRaw === 0n && BigInt(shareMeta.raw) > 0n) {
      for (const methodName of ['convertToAssets', 'previewRedeem']) {
        const probe = await callMaybe(contract, methodName, [BigInt(shareMeta.raw)]);
        if (probe.ok && positiveBigInt(probe.value) > 0n) {
          resolvedUnderlyingRaw = positiveBigInt(probe.value);
          method = methodName;
          break;
        }
      }
    }

    if (resolvedUnderlyingRaw === 0n && BigInt(shareMeta.raw) > 0n) {
      const exchangeRate = await callMaybe(contract, 'exchangeRateStored');
      if (exchangeRate.ok && positiveBigInt(exchangeRate.value) > 0n) {
        let underlyingDecimals = 8;
        try {
          const underlyingMeta = await tokenMeta(provider, targetUnderlying);
          underlyingDecimals = underlyingMeta.decimals;
        } catch {}

        const scaleExp = 18 + underlyingDecimals - shareMeta.decimals;
        if (scaleExp >= 0) {
          const scale = 10n ** BigInt(scaleExp);
          resolvedUnderlyingRaw =
            (BigInt(shareMeta.raw) * positiveBigInt(exchangeRate.value)) / scale;
          method = 'balanceOf × exchangeRateStored';
        }
      }
    }
  }

  let targetDecimals = 8;
  try {
    const targetMeta = await tokenMeta(provider, targetUnderlying);
    targetDecimals = targetMeta.decimals;
  } catch {}

  return {
    ...holding,
    onchainShareMeta: shareMeta,
    assetProbe: serializeProbe(assetProbe),
    underlyingProbe: serializeProbe(underlyingProbe),
    resolvedUnderlyingAddress: underlying,
    pointsToTarget: Boolean(pointsToTarget),
    resolvedUnderlyingRaw: resolvedUnderlyingRaw.toString(),
    resolvedUnderlyingAmount: resolvedUnderlyingRaw > 0n
      ? round(Number(formatUnits(resolvedUnderlyingRaw, targetDecimals)))
      : null,
    conversionMethod: method,
    probeStatus: pointsToTarget
      ? (resolvedUnderlyingRaw > 0n ? 'resolved' : 'target-underlying-no-conversion')
      : 'not-target-underlying'
  };
}

async function resolveAvalancheBtcBByCurrentHoldings() {
  const holdings = await routescanHoldings('avalanche');

  const wrapped = await withProvider('avalanche', async provider => {
    const candidates = holdings.items
      .filter(isMaterialHolding)
      .sort((a, b) => (Number(b.tokenValueInUsd) || 0) - (Number(a.tokenValueInUsd) || 0))
      .slice(0, 35);

    const probed = [];
    for (const candidate of candidates) {
      probed.push(await probeReceiptCandidate(provider, candidate, T.avalancheBtcB));
    }

    const resolved = probed.filter(
      x => Number.isFinite(x.resolvedUnderlyingAmount) && x.resolvedUnderlyingAmount > 0
    );

    const aggregate = resolved.reduce(
      (sum, x) => sum + x.resolvedUnderlyingAmount,
      0
    );

    const tolerance = Math.max(0.0005, EXPECTED.avalancheBtcB * 0.03);
    const matched = aggregate > 0
      && Math.abs(aggregate - EXPECTED.avalancheBtcB) <= tolerance;

    return {
      chain: 'Avalanche',
      targetUnderlying: T.avalancheBtcB,
      ownerObservedApprox: EXPECTED.avalancheBtcB,
      benqiAlreadyEliminated: true,
      currentHoldings: holdings,
      probedCandidates: probed,
      resolvedComponents: resolved.map(x => ({
        tokenAddress: x.tokenAddress,
        tokenSymbol: x.tokenSymbol,
        tokenName: x.tokenName,
        resolvedUnderlyingAmount: x.resolvedUnderlyingAmount,
        conversionMethod: x.conversionMethod
      })),
      btcBEquivalent: round(aggregate),
      tolerance: round(tolerance),
      matched,
      status: matched
        ? 'ok'
        : (aggregate > 0
            ? 'partial-or-outside-owner-tolerance'
            : 'unresolved')
    };
  });

  if (!wrapped.result) {
    return {
      chain: 'Avalanche',
      status: 'unavailable',
      matched: false,
      currentHoldings: holdings,
      diagnostics: wrapped.errors
    };
  }

  return {
    ...wrapped.result,
    diagnostics: wrapped.errors
  };
}

function extractDiscoveryKnownSubtotals() {
  try {
    const d = JSON.parse(fs.readFileSync(DISCOVERY_FILE, 'utf8'));
    const btc = (d?.proposedCompanyBook || []).find(x => x.symbol === 'BTC');
    const eth = (d?.proposedCompanyBook || []).find(x => x.symbol === 'ETH');

    return {
      discoveryVersion: d?.version || null,
      btcFromDiscovery: Number.isFinite(Number(btc?.quantity))
        ? Number(btc.quantity)
        : KNOWN_FROM_DISCOVERY.btcSubtotalBeforeUnresolved,
      ethFromDiscovery: Number.isFinite(Number(eth?.quantity))
        ? Number(eth.quantity)
        : KNOWN_FROM_DISCOVERY.nativeEthSubtotalBeforeUnresolved
    };
  } catch {
    return {
      discoveryVersion: null,
      btcFromDiscovery: KNOWN_FROM_DISCOVERY.btcSubtotalBeforeUnresolved,
      ethFromDiscovery: KNOWN_FROM_DISCOVERY.nativeEthSubtotalBeforeUnresolved
    };
  }
}

async function main() {
  const startedAt = new Date().toISOString();

  const [
    lombardEthereum,
    lombardBase,
    liquidEthBase,
    avalancheBtcB
  ] = await Promise.all([
    resolveBoringVault({
      chain: 'ethereum',
      label: 'Lombard LBTCv',
      vaultAddress: T.lbtcv,
      accountantAddress: T.lombardAccountantCandidate,
      quoteAddress: T.ethereumWbtc,
      expectedApprox: EXPECTED.lombardEthereumWbtc
    }),
    resolveBoringVault({
      chain: 'base',
      label: 'Lombard LBTCv',
      vaultAddress: T.lbtcv,
      accountantAddress: T.lombardAccountantCandidate,
      quoteAddress: T.baseWbtc,
      expectedApprox: EXPECTED.lombardBaseWbtc
    }),
    resolveBoringVault({
      chain: 'base',
      label: 'Veda Liquid ETH candidate',
      vaultAddress: T.liquidEthVaultCandidate,
      accountantAddress: T.liquidEthAccountantCandidate,
      quoteAddress: T.baseWeth,
      expectedApprox: EXPECTED.baseWeth
    }),
    resolveAvalancheBtcBByCurrentHoldings()
  ]);

  const baseHoldings = await routescanHoldings('base');

  const materialBaseHoldings = baseHoldings.items
    .filter(isMaterialHolding)
    .sort((a, b) => (Number(b.tokenValueInUsd) || 0) - (Number(a.tokenValueInUsd) || 0))
    .slice(0, 50);

  const known = extractDiscoveryKnownSubtotals();

  const resolution = {
    avalancheBtcB: avalancheBtcB?.matched === true,
    lombardEthereumWbtc: lombardEthereum?.matched === true,
    lombardBaseWbtc: lombardBase?.matched === true,
    baseWeth: liquidEthBase?.matched === true
  };

  const unresolved = Object.entries(resolution)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  const lombardResolvedBtc =
    (Number(lombardEthereum?.quoteEquivalent) || 0)
    + (Number(lombardBase?.quoteEquivalent) || 0);

  const avalancheResolvedBtc = Number(avalancheBtcB?.btcBEquivalent) || 0;
  const baseWethResolved = Number(liquidEthBase?.quoteEquivalent) || 0;

  const provisionalTotals = {
    btcIfCurrentResolvedComponentsAccepted: round(
      known.btcFromDiscovery + lombardResolvedBtc + avalancheResolvedBtc
    ),
    ethIfCurrentResolvedComponentsAccepted: round(
      known.ethFromDiscovery + baseWethResolved
    ),
    authoritative: unresolved.length === 0
  };

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
      'resolve only remaining Company #008 BTC/ETH reconciliation delta via verified Veda Accountant rates and current holdings enumeration; no broad archaeology',
    methodology: {
      boringVault:
        'share balance × Accountant rate per ONE_SHARE; verify Accountant.vault() before accepting',
      currentHoldings:
        'Routescan keyless current ERC20 holdings; receipt probes only on material/current candidates',
      ownerObserved:
        'rounded owner values are reconciliation targets only, never accounting source',
      antiDoubleCount:
        'do not add direct underlying and receipt-equivalent for the same economic position'
    },
    knownFromDiscovery: known,
    expectedApprox: EXPECTED,
    results: {
      lombardEthereum,
      lombardBase,
      baseWethVedaCandidate: liquidEthBase,
      avalancheBtcBCurrentHoldings: avalancheBtcB,
      baseCurrentHoldings: {
        ...baseHoldings,
        items: materialBaseHoldings
      }
    },
    resolution: {
      ...resolution,
      unresolved,
      allResolved: unresolved.length === 0
    },
    provisionalTotals,
    nextStep: unresolved.length === 0
      ? 'reconcile final Company #008 BTC/ETH totals and proceed to production integration'
      : 'target only remaining unresolved mechanism(s) using the current-holdings evidence emitted by this resolver'
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Company #008 targeted resolver v1.1 written: ${OUTPUT}`);
  console.log(`Lombard Ethereum matched: ${resolution.lombardEthereumWbtc}`);
  console.log(`Lombard Base matched: ${resolution.lombardBaseWbtc}`);
  console.log(`Base WETH matched: ${resolution.baseWeth}`);
  console.log(`Avalanche BTC.b matched: ${resolution.avalancheBtcB}`);
  console.log(`Unresolved: ${unresolved.join(', ') || 'none'}`);
  console.log(`Provisional BTC: ${provisionalTotals.btcIfCurrentResolvedComponentsAccepted}`);
  console.log(`Provisional ETH: ${provisionalTotals.ethIfCurrentResolvedComponentsAccepted}`);
}

main().catch(err => {
  console.error(`Company #008 targeted resolver v1.1 failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
