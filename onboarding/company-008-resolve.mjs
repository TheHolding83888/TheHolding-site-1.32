import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  formatUnits,
  getAddress,
  id
} from 'ethers';

const VERSION = '1.0-company-008-targeted-unresolved';
const WALLET = getAddress('0xe4b9c9ced406baffe406e63f83d39daaef150596');
const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT
  || path.resolve('companies/company-008-resolve.json');

const RPC = {
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
};

const TARGETS = {
  avalancheBtcB: {
    chain: 'avalanche',
    underlying: getAddress('0x152b9d0FdC40C096757F570A51E494bD4B943E50'),
    expectedApprox: 0.0435,
    // Snowtrace labels this current market as BENQI qiBTC.b.
    qiToken: getAddress('0x89a415b3D20098E6A6C8f7a59001C67BD3129821')
  },
  lombard: {
    lbtcv: getAddress('0x5401b8620E5FB570064CA9114fd1e135fd77D57c'),
    btce: getAddress('0x3a4baaBf4DC9910596821615e848f0e6545762F3'),
    ethereumWbtc: getAddress('0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599'),
    baseWbtc: getAddress('0x0555e30da8f98308EdB960aa94c0Db47230d2B9c'),
    ethereumExpectedApprox: 0.0028,
    baseExpectedApprox: 0.0048
  },
  baseWeth: {
    token: getAddress('0x4200000000000000000000000000000000000006'),
    expectedApprox: 0.1606
  }
};

const BLOCKSCOUT = {
  ethereum: 'https://eth.blockscout.com',
  base: 'https://base.blockscout.com'
};

function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]');
}
function round(x, d = 12) {
  const n = Number(x);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}
function positive(x) {
  try {
    const n = BigInt(x);
    return n > 0n ? n : 0n;
  } catch { return 0n; }
}
function lower(x) { return String(x || '').toLowerCase(); }
function uniq(xs) { return [...new Set((xs || []).filter(Boolean))]; }

async function fetchJson(url, timeoutMs = 25000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      cache: 'no-store',
      signal: ctrl.signal,
      headers: { 'user-agent': 'The-Holding-Company-008-Resolver/1.0' }
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

async function withProvider(chain, fn) {
  const errors = [];
  for (const url of RPC[chain] || []) {
    const p = new JsonRpcProvider(url);
    try {
      return { result: await fn(p), errors };
    } catch (e) {
      errors.push(errMsg(e));
    }
  }
  return { result: null, errors };
}

async function tokenMeta(provider, address) {
  const c = new Contract(address, [
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function balanceOf(address) view returns (uint256)'
  ], provider);
  let symbol = null;
  let decimals = 18;
  try { symbol = await c.symbol(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}
  let raw = 0n;
  try { raw = positive(await c.balanceOf(WALLET)); } catch {}
  return {
    address: getAddress(address),
    symbol,
    decimals,
    raw: raw.toString(),
    balance: Number(formatUnits(raw, decimals))
  };
}

async function resolveBenqiBtcB() {
  const r = await withProvider('avalanche', async provider => {
    const qi = new Contract(TARGETS.avalancheBtcB.qiToken, [
      'function symbol() view returns (string)',
      'function decimals() view returns (uint8)',
      'function underlying() view returns (address)',
      'function balanceOf(address) view returns (uint256)',
      'function balanceOfUnderlying(address) returns (uint256)',
      'function exchangeRateStored() view returns (uint256)'
    ], provider);

    let symbol = null;
    let qDecimals = 8;
    let underlying = null;
    let sharesRaw = 0n;
    let exchangeRateRaw = 0n;
    let underlyingRaw = 0n;
    let balanceMethod = null;

    try { symbol = await qi.symbol(); } catch {}
    try { qDecimals = Number(await qi.decimals()); } catch {}
    try { underlying = getAddress(await qi.underlying()); } catch {}
    try { sharesRaw = positive(await qi.balanceOf(WALLET)); } catch {}
    try { exchangeRateRaw = positive(await qi.exchangeRateStored()); } catch {}

    // Primary: Compound/BENQI-style balanceOfUnderlying through eth_call.
    try {
      underlyingRaw = positive(await qi.balanceOfUnderlying.staticCall(WALLET));
      if (underlyingRaw > 0n) balanceMethod = 'qiBTC.b.balanceOfUnderlying.staticCall';
    } catch {}

    // Fallback: qToken exchange-rate math.
    if (underlyingRaw === 0n && sharesRaw > 0n && exchangeRateRaw > 0n) {
      let uDecimals = 8;
      try {
        const u = new Contract(TARGETS.avalancheBtcB.underlying, [
          'function decimals() view returns (uint8)'
        ], provider);
        uDecimals = Number(await u.decimals());
      } catch {}
      const scaleExp = 18 + uDecimals - qDecimals;
      const scale = 10n ** BigInt(scaleExp);
      underlyingRaw = (sharesRaw * exchangeRateRaw) / scale;
      balanceMethod = 'qiToken.balanceOf × exchangeRateStored';
    }

    const underlyingDecimals = 8;
    const btcEquivalent = Number(formatUnits(underlyingRaw, underlyingDecimals));
    return {
      status: btcEquivalent > 0 ? 'ok' : 'no-position',
      protocol: 'BENQI',
      chain: 'Avalanche',
      qiToken: TARGETS.avalancheBtcB.qiToken,
      qiSymbol: symbol,
      underlying,
      expectedUnderlying: TARGETS.avalancheBtcB.underlying,
      qTokenShares: Number(formatUnits(sharesRaw, qDecimals)),
      exchangeRateRaw: exchangeRateRaw.toString(),
      btcBEquivalent: round(btcEquivalent),
      balanceMethod,
      ownerObservedApprox: TARGETS.avalancheBtcB.expectedApprox,
      deltaVsOwnerObserved: round(btcEquivalent - TARGETS.avalancheBtcB.expectedApprox),
      matched: Math.abs(btcEquivalent - TARGETS.avalancheBtcB.expectedApprox) <= 0.00087
    };
  });
  return { ...(r.result || { status: 'unavailable' }), diagnostics: r.errors };
}

async function tryCall(contract, method, args = []) {
  try {
    const v = await contract[method](...args);
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, error: errMsg(e) };
  }
}

async function resolveLombardOn(chain, expectedApprox, depositToken) {
  const r = await withProvider(chain, async provider => {
    const receiptTokens = [];
    for (const [kind, address] of [
      ['LBTCv', TARGETS.lombard.lbtcv],
      ['BTCe', TARGETS.lombard.btce]
    ]) {
      const meta = await tokenMeta(provider, address);
      if (meta.balance <= 0) {
        receiptTokens.push({ kind, ...meta, status: 'zero' });
        continue;
      }

      const c = new Contract(address, [
        'function asset() view returns (address)',
        'function underlying() view returns (address)',
        'function convertToAssets(uint256) view returns (uint256)',
        'function previewRedeem(uint256) view returns (uint256)',
        'function pricePerShare() view returns (uint256)',
        'function getPricePerFullShare() view returns (uint256)',
        'function getRate() view returns (uint256)',
        'function totalAssets() view returns (uint256)',
        'function totalSupply() view returns (uint256)'
      ], provider);

      const probes = {};
      for (const m of ['asset','underlying','pricePerShare','getPricePerFullShare','getRate','totalAssets','totalSupply']) {
        probes[m] = await tryCall(c, m);
      }
      probes.convertToAssets = await tryCall(c, 'convertToAssets', [BigInt(meta.raw)]);
      probes.previewRedeem = await tryCall(c, 'previewRedeem', [BigInt(meta.raw)]);

      let resolvedUnderlyingRaw = 0n;
      let method = null;
      for (const [name, probe] of [
        ['convertToAssets', probes.convertToAssets],
        ['previewRedeem', probes.previewRedeem]
      ]) {
        if (probe.ok) {
          const x = positive(probe.value);
          if (x > 0n) {
            resolvedUnderlyingRaw = x;
            method = `${kind}.${name}(shares)`;
            break;
          }
        }
      }

      // If ERC-4626-like methods are absent, do NOT assume 1:1.
      let underlyingAddress = null;
      for (const k of ['asset','underlying']) {
        if (probes[k]?.ok) {
          try { underlyingAddress = getAddress(probes[k].value); } catch {}
          if (underlyingAddress) break;
        }
      }
      let underlyingDecimals = 8;
      let underlyingSymbol = null;
      if (underlyingAddress) {
        const u = await tokenMeta(provider, underlyingAddress);
        underlyingDecimals = u.decimals;
        underlyingSymbol = u.symbol;
      }

      receiptTokens.push({
        kind,
        ...meta,
        status: resolvedUnderlyingRaw > 0n ? 'resolved' : 'shares-found-needs-conversion',
        underlyingAddress,
        underlyingSymbol,
        resolvedUnderlyingAmount: resolvedUnderlyingRaw > 0n
          ? Number(formatUnits(resolvedUnderlyingRaw, underlyingDecimals))
          : null,
        conversionMethod: method,
        probes: Object.fromEntries(Object.entries(probes).map(([k,v]) => [
          k,
          v.ok
            ? { ok: true, value: typeof v.value === 'bigint' ? v.value.toString() : String(v.value) }
            : { ok: false, error: v.error }
        ]))
      });
    }

    const directDepositToken = await tokenMeta(provider, depositToken);

    // A protocol label can describe the underlying even when the wallet actually
    // holds a receipt token. Do not double count direct WBTC + receipt exposure.
    const resolvedCandidates = receiptTokens
      .filter(x => x.status === 'resolved' && Number.isFinite(x.resolvedUnderlyingAmount))
      .map(x => x.resolvedUnderlyingAmount);

    const resolvedUnderlying = resolvedCandidates.length === 1
      ? resolvedCandidates[0]
      : (resolvedCandidates.length > 1 ? null : 0);

    return {
      chain: chain === 'ethereum' ? 'Ethereum' : 'Base',
      protocol: 'Lombard / Veda',
      officialContracts: {
        LBTCv: TARGETS.lombard.lbtcv,
        BTCe: TARGETS.lombard.btce
      },
      depositAsset: depositToken,
      directDepositTokenBalance: directDepositToken.balance,
      receiptTokens,
      resolvedUnderlying,
      multipleResolvedCandidates: resolvedCandidates.length > 1,
      ownerObservedApprox: expectedApprox,
      matched: resolvedUnderlying !== null && resolvedUnderlying > 0
        ? Math.abs(resolvedUnderlying - expectedApprox) <= Math.max(0.00015, expectedApprox * 0.03)
        : false
    };
  });
  return { ...(r.result || { status: 'unavailable' }), diagnostics: r.errors };
}

async function blockscoutTokenBalances(chain) {
  const base = BLOCKSCOUT[chain];
  if (!base) return [];
  try {
    const j = await fetchJson(`${base}/api/v2/addresses/${WALLET}/token-balances`);
    return Array.isArray(j) ? j : (j?.items || []);
  } catch {
    return [];
  }
}

async function resolveBaseWethGenericReceipts() {
  const balances = await blockscoutTokenBalances('base');
  const r = await withProvider('base', async provider => {
    const candidates = [];
    for (const item of balances) {
      const token = item?.token || item || {};
      const address = token?.address || token?.token_address || item?.token_address;
      if (!address) continue;

      let checksum;
      try { checksum = getAddress(address); } catch { continue; }
      if (lower(checksum) === lower(TARGETS.baseWeth.token)) continue;

      const meta = await tokenMeta(provider, checksum);
      if (meta.balance <= 0) continue;

      const c = new Contract(checksum, [
        'function asset() view returns (address)',
        'function underlying() view returns (address)',
        'function convertToAssets(uint256) view returns (uint256)',
        'function previewRedeem(uint256) view returns (uint256)',
        'function balanceOfUnderlying(address) returns (uint256)'
      ], provider);

      let underlying = null;
      for (const m of ['asset','underlying']) {
        const p = await tryCall(c, m);
        if (p.ok) {
          try { underlying = getAddress(p.value); } catch {}
          if (underlying) break;
        }
      }

      const pointsToWeth = underlying && lower(underlying) === lower(TARGETS.baseWeth.token);
      if (!pointsToWeth) continue;

      let amountRaw = 0n;
      let method = null;
      for (const [m,args] of [
        ['convertToAssets',[BigInt(meta.raw)]],
        ['previewRedeem',[BigInt(meta.raw)]],
        ['balanceOfUnderlying',[WALLET]]
      ]) {
        const p = m === 'balanceOfUnderlying'
          ? await (async () => {
              try {
                const v = await c.balanceOfUnderlying.staticCall(WALLET);
                return { ok: true, value: v };
              } catch (e) { return { ok: false, error: errMsg(e) }; }
            })()
          : await tryCall(c, m, args);
        if (p.ok && positive(p.value) > 0n) {
          amountRaw = positive(p.value);
          method = `${meta.symbol || checksum}.${m}`;
          break;
        }
      }

      candidates.push({
        receiptToken: checksum,
        receiptSymbol: meta.symbol,
        receiptBalance: meta.balance,
        underlying,
        wethEquivalent: amountRaw > 0n ? Number(formatUnits(amountRaw, 18)) : null,
        conversionMethod: method
      });
    }

    return {
      protocol: 'generic receipt-token probe',
      chain: 'Base',
      WETH: TARGETS.baseWeth.token,
      ownerObservedApprox: TARGETS.baseWeth.expectedApprox,
      candidates,
      uniquelyResolvedWethEquivalent: candidates.filter(x => x.wethEquivalent > 0).length === 1
        ? candidates.find(x => x.wethEquivalent > 0).wethEquivalent
        : null
    };
  });
  return { ...(r.result || { status: 'unavailable' }), diagnostics: r.errors };
}

async function recentTokenCounterparties(chain, tokenAddress, limit = 50) {
  const base = BLOCKSCOUT[chain];
  if (!base) return { items: [], diagnostics: ['Blockscout unavailable for chain'] };
  try {
    const url = `${base}/api/v2/addresses/${WALLET}/token-transfers?token=${tokenAddress}`;
    const j = await fetchJson(url);
    const items = (j?.items || []).slice(0, limit);
    const counterparties = [];
    for (const x of items) {
      const from = x?.from?.hash || x?.from?.address_hash || x?.from;
      const to = x?.to?.hash || x?.to?.address_hash || x?.to;
      let cp = null;
      if (lower(from) === lower(WALLET)) cp = to;
      else if (lower(to) === lower(WALLET)) cp = from;
      if (!cp) continue;
      counterparties.push({
        counterparty: cp,
        from,
        to,
        txHash: x?.tx_hash || x?.transaction_hash || x?.transaction_hash,
        timestamp: x?.timestamp || null,
        method: x?.method || null,
        tokenSymbol: x?.token?.symbol || null,
        total: x?.total || null
      });
    }
    return { items: counterparties, diagnostics: [] };
  } catch (e) {
    return { items: [], diagnostics: [errMsg(e)] };
  }
}

async function main() {
  const startedAt = new Date().toISOString();

  const [
    benqi,
    lombardEth,
    lombardBase,
    baseWethReceipts,
    baseWbtcTransfers,
    ethWbtcTransfers,
    baseWethTransfers
  ] = await Promise.all([
    resolveBenqiBtcB(),
    resolveLombardOn('ethereum', TARGETS.lombard.ethereumExpectedApprox, TARGETS.lombard.ethereumWbtc),
    resolveLombardOn('base', TARGETS.lombard.baseExpectedApprox, TARGETS.lombard.baseWbtc),
    resolveBaseWethGenericReceipts(),
    recentTokenCounterparties('base', TARGETS.lombard.baseWbtc),
    recentTokenCounterparties('ethereum', TARGETS.lombard.ethereumWbtc),
    recentTokenCounterparties('base', TARGETS.baseWeth.token)
  ]);

  const resolved = {
    avalancheBtcB: benqi?.matched === true,
    lombardEthereumWbtc: lombardEth?.matched === true,
    lombardBaseWbtc: lombardBase?.matched === true,
    baseWeth: (() => {
      const n = Number(baseWethReceipts?.uniquelyResolvedWethEquivalent);
      return Number.isFinite(n) && Math.abs(n - TARGETS.baseWeth.expectedApprox) <= 0.003212;
    })()
  };

  const unresolved = Object.entries(resolved).filter(([,ok]) => !ok).map(([k]) => k);

  const output = {
    version: VERSION,
    generatedAt: new Date().toISOString(),
    startedAt,
    company: {
      registry: '008',
      name: '1milliondollar.eth',
      wallet: WALLET
    },
    purpose: 'target only the four unresolved owner-reconciliation components from discovery v1.3.2; no broad archaeology',
    expectedApprox: {
      avalancheBtcB: 0.0435,
      lombardBaseWbtc: 0.0048,
      lombardEthereumWbtc: 0.0028,
      baseWeth: 0.1606
    },
    results: {
      benqiAvalancheBtcB: benqi,
      lombardEthereum: lombardEth,
      lombardBase,
      baseWethGenericReceipts: baseWethReceipts,
      transferContext: {
        baseWbtc: baseWbtcTransfers,
        ethereumWbtc: ethWbtcTransfers,
        baseWeth: baseWethTransfers
      }
    },
    resolution: {
      ...resolved,
      unresolved,
      allResolved: unresolved.length === 0
    },
    nextStep: unresolved.length === 0
      ? 'merge resolved quantities into Company #008 Company Book and proceed to production integration'
      : 'use transfer counterparties / receipt-token probes to target only remaining protocol contracts'
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Company #008 targeted resolver written: ${OUTPUT}`);
  console.log(`Version: ${VERSION}`);
  console.log(`BENQI BTC.b matched: ${resolved.avalancheBtcB}`);
  console.log(`Lombard Base WBTC matched: ${resolved.lombardBaseWbtc}`);
  console.log(`Lombard Ethereum WBTC matched: ${resolved.lombardEthereumWbtc}`);
  console.log(`Base WETH matched: ${resolved.baseWeth}`);
  console.log(`Unresolved: ${unresolved.join(', ') || 'none'}`);
}

main().catch(err => {
  console.error(`Company #008 targeted resolver failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
