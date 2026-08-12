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

const VERSION = '1.3-company-008-aerodrome-sugar-base-weth-final';
const WALLET = canonicalAddress('0xe4b9c9ced406baffe406e63f83d39daaef150596');

const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT
  || path.resolve('companies/company-008-resolve.json');

const PREVIOUS_RESOLVER_FILE = path.resolve('companies/company-008-resolve.json');

const BASE_RPC_URLS = [
  process.env.BASE_RPC_URL,
  process.env.BASE_RPC_URL_2,
  'https://base-rpc.publicnode.com',
  'https://mainnet.base.org'
].filter(Boolean);

const TARGET = Object.freeze({
  baseWeth: canonicalAddress('0x4200000000000000000000000000000000000006'),
  sugar: canonicalAddress('0x69dd9db6d8f8e7d83887a704f447b1a584b599a1'),
  knownSlipstreamNfpmV1: canonicalAddress('0x827922686190790b37229fd06084350e74485b72'),
  knownWethUsdcPool: canonicalAddress('0xb2cc224c1c9fee385f8ad6a55b4d94e92359dc59')
});

const EXPECTED_BASE_WETH = 0.1606;
const ZERO = canonicalAddress('0x0000000000000000000000000000000000000000');

const POSITION_TUPLE =
  '(uint256 id,address lp,uint256 liquidity,uint256 staked,uint256 amount0,uint256 amount1,uint256 staked0,uint256 staked1,uint256 unstaked_earned0,uint256 unstaked_earned1,uint256 emissions_earned,int24 tick_lower,int24 tick_upper,uint160 sqrt_ratio_lower,uint160 sqrt_ratio_upper,address locker,uint32 unlocks_at,address alm)';

function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .slice(0, 1000);
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

function readPreviousV12() {
  try {
    const d = JSON.parse(fs.readFileSync(PREVIOUS_RESOLVER_FILE, 'utf8'));

    if (d?.version !== '1.2-company-008-atoken-base-holdings-final-delta') {
      return {
        status: 'unexpected-version',
        version: d?.version || null
      };
    }

    if (d?.resolution?.avalancheBtcB !== true) {
      return {
        status: 'avalanche-not-resolved',
        version: d.version
      };
    }

    if (
      d?.resolution?.lombardEthereumWbtc !== true
      || d?.resolution?.lombardBaseWbtc !== true
    ) {
      return {
        status: 'lombard-not-preserved',
        version: d.version
      };
    }

    const btc = Number(d?.finalCandidateTotals?.btc);

    if (!Number.isFinite(btc) || btc <= 0) {
      return {
        status: 'btc-total-invalid',
        version: d.version
      };
    }

    return {
      status: 'ok',
      version: d.version,
      btc,
      ethNativeSubtotal: Number(d?.discoveryBaseline?.ethNativeSubtotal) || 0,
      preservedResolved: {
        lombardEthereum: d?.preservedResolved?.lombardEthereum || null,
        lombardBase: d?.preservedResolved?.lombardBase || null,
        avalancheAaveBtcB: d?.results?.avalancheAaveBtcB || null
      }
    };
  } catch (e) {
    return {
      status: 'unavailable',
      error: errMsg(e)
    };
  }
}

async function withBaseProvider(fn) {
  const errors = [];

  for (const url of BASE_RPC_URLS) {
    const provider = new JsonRpcProvider(url);

    try {
      return {
        result: await fn(provider),
        errors
      };
    } catch (e) {
      errors.push(errMsg(e));
    }
  }

  return {
    result: null,
    errors
  };
}

async function callMaybe(contract, method, args = []) {
  try {
    const value = await contract[method](...args);
    return { ok: true, value };
  } catch (e) {
    return {
      ok: false,
      error: errMsg(e)
    };
  }
}

async function tokenMeta(provider, address) {
  const c = new Contract(address, [
    'function symbol() view returns (string)',
    'function name() view returns (string)',
    'function decimals() view returns (uint8)'
  ], provider);

  let symbol = null;
  let name = null;
  let decimals = 18;

  try { symbol = await c.symbol(); } catch {}
  try { name = await c.name(); } catch {}
  try { decimals = Number(await c.decimals()); } catch {}

  return {
    address: canonicalAddress(address),
    symbol,
    name,
    decimals
  };
}

async function poolMeta(provider, poolAddress) {
  const pool = new Contract(poolAddress, [
    'function token0() view returns (address)',
    'function token1() view returns (address)',
    'function tickSpacing() view returns (int24)'
  ], provider);

  let token0 = null;
  let token1 = null;
  let tickSpacing = null;

  try { token0 = canonicalAddress(await pool.token0()); } catch {}
  try { token1 = canonicalAddress(await pool.token1()); } catch {}
  try { tickSpacing = Number(await pool.tickSpacing()); } catch {}

  const token0Meta = token0 ? await tokenMeta(provider, token0) : null;
  const token1Meta = token1 ? await tokenMeta(provider, token1) : null;

  return {
    pool: canonicalAddress(poolAddress),
    token0,
    token1,
    token0Meta,
    token1Meta,
    tickSpacing
  };
}

function normalizePosition(raw, sourceMethod) {
  return {
    sourceMethod,
    id: positiveBigInt(raw.id ?? raw[0]).toString(),
    lp: canonicalAddress(raw.lp ?? raw[1]),
    liquidity: positiveBigInt(raw.liquidity ?? raw[2]).toString(),
    staked: positiveBigInt(raw.staked ?? raw[3]).toString(),
    amount0Raw: positiveBigInt(raw.amount0 ?? raw[4]).toString(),
    amount1Raw: positiveBigInt(raw.amount1 ?? raw[5]).toString(),
    staked0Raw: positiveBigInt(raw.staked0 ?? raw[6]).toString(),
    staked1Raw: positiveBigInt(raw.staked1 ?? raw[7]).toString(),
    unstakedEarned0Raw: positiveBigInt(raw.unstaked_earned0 ?? raw[8]).toString(),
    unstakedEarned1Raw: positiveBigInt(raw.unstaked_earned1 ?? raw[9]).toString(),
    emissionsEarnedRaw: positiveBigInt(raw.emissions_earned ?? raw[10]).toString(),
    tickLower: Number(raw.tick_lower ?? raw[11]),
    tickUpper: Number(raw.tick_upper ?? raw[12]),
    sqrtRatioLower: positiveBigInt(raw.sqrt_ratio_lower ?? raw[13]).toString(),
    sqrtRatioUpper: positiveBigInt(raw.sqrt_ratio_upper ?? raw[14]).toString(),
    locker: canonicalAddress(raw.locker ?? raw[15]),
    unlocksAt: Number(raw.unlocks_at ?? raw[16]),
    alm: canonicalAddress(raw.alm ?? raw[17])
  };
}

function richness(position) {
  return [
    position.liquidity,
    position.staked,
    position.amount0Raw,
    position.amount1Raw,
    position.staked0Raw,
    position.staked1Raw,
    position.unstakedEarned0Raw,
    position.unstakedEarned1Raw
  ].reduce((sum, x) => sum + positiveBigInt(x), 0n);
}

function dedupePositions(positions) {
  const map = new Map();

  for (const p of positions) {
    const key = `${lower(p.lp)}:${p.id}`;

    const current = map.get(key);

    if (!current || richness(p) > richness(current)) {
      map.set(key, p);
    }
  }

  return [...map.values()];
}

async function fetchSugarPositions(provider) {
  const sugarCode = await provider.getCode(TARGET.sugar);

  if (sugarCode === '0x') {
    throw new Error('Aerodrome Sugar contract has no bytecode');
  }

  const sugar = new Contract(TARGET.sugar, [
    `function positions(uint256,uint256,address) view returns (${POSITION_TUPLE}[])`,
    `function positionsUnstakedConcentrated(uint256,uint256,address) view returns (${POSITION_TUPLE}[])`
  ], provider);

  const probes = {
    positions: await callMaybe(sugar, 'positions', [250, 0, WALLET]),
    legacyUnstaked: await callMaybe(
      sugar,
      'positionsUnstakedConcentrated',
      [250, 0, WALLET]
    )
  };

  const rows = [];

  if (probes.positions.ok && Array.isArray(probes.positions.value)) {
    for (const raw of probes.positions.value) {
      rows.push(normalizePosition(raw, 'LpSugar.positions'));
    }
  }

  if (probes.legacyUnstaked.ok && Array.isArray(probes.legacyUnstaked.value)) {
    for (const raw of probes.legacyUnstaked.value) {
      rows.push(
        normalizePosition(
          raw,
          'LpSugar.positionsUnstakedConcentrated'
        )
      );
    }
  }

  return {
    sugar: TARGET.sugar,
    sugarCodeExists: true,
    probes: {
      positions: probes.positions.ok
        ? { ok: true, count: probes.positions.value.length }
        : { ok: false, error: probes.positions.error },
      legacyUnstaked: probes.legacyUnstaked.ok
        ? { ok: true, count: probes.legacyUnstaked.value.length }
        : { ok: false, error: probes.legacyUnstaked.error }
    },
    positions: dedupePositions(rows)
  };
}

async function resolveAerodromeWeth() {
  const wrapped = await withBaseProvider(async provider => {
    const sugar = await fetchSugarPositions(provider);

    const poolCache = new Map();
    const enriched = [];

    for (const position of sugar.positions) {
      const key = lower(position.lp);

      let meta = poolCache.get(key);

      if (!meta) {
        meta = await poolMeta(provider, position.lp);
        poolCache.set(key, meta);
      }

      const token0Decimals = meta?.token0Meta?.decimals ?? 18;
      const token1Decimals = meta?.token1Meta?.decimals ?? 18;

      const amount0 =
        Number(formatUnits(BigInt(position.amount0Raw), token0Decimals));
      const amount1 =
        Number(formatUnits(BigInt(position.amount1Raw), token1Decimals));
      const staked0 =
        Number(formatUnits(BigInt(position.staked0Raw), token0Decimals));
      const staked1 =
        Number(formatUnits(BigInt(position.staked1Raw), token1Decimals));
      const fee0 =
        Number(formatUnits(BigInt(position.unstakedEarned0Raw), token0Decimals));
      const fee1 =
        Number(formatUnits(BigInt(position.unstakedEarned1Raw), token1Decimals));

      let principalWeth = 0;
      let unclaimedFeeWeth = 0;

      if (meta?.token0 && lower(meta.token0) === lower(TARGET.baseWeth)) {
        principalWeth += amount0 + staked0;
        unclaimedFeeWeth += fee0;
      }

      if (meta?.token1 && lower(meta.token1) === lower(TARGET.baseWeth)) {
        principalWeth += amount1 + staked1;
        unclaimedFeeWeth += fee1;
      }

      enriched.push({
        ...position,
        poolMeta: meta,
        amounts: {
          amount0: round(amount0),
          amount1: round(amount1),
          staked0: round(staked0),
          staked1: round(staked1),
          unstakedEarned0: round(fee0),
          unstakedEarned1: round(fee1)
        },
        weth: {
          principal: round(principalWeth),
          unclaimedFees: round(unclaimedFeeWeth),
          grossIncludingUnclaimedFees: round(
            principalWeth + unclaimedFeeWeth
          )
        },
        knownWethUsdcPool:
          lower(position.lp) === lower(TARGET.knownWethUsdcPool)
      });
    }

    const wethPositions = enriched.filter(
      x => Number(x?.weth?.principal) > 0
        || Number(x?.weth?.unclaimedFees) > 0
    );

    const principalWeth = wethPositions.reduce(
      (sum, x) => sum + Number(x.weth.principal || 0),
      0
    );

    const unclaimedFeeWeth = wethPositions.reduce(
      (sum, x) => sum + Number(x.weth.unclaimedFees || 0),
      0
    );

    const grossIncludingFees = principalWeth + unclaimedFeeWeth;

    const tolerance = Math.max(
      0.001,
      EXPECTED_BASE_WETH * 0.03
    );

    const principalMatched =
      principalWeth > 0
      && Math.abs(principalWeth - EXPECTED_BASE_WETH) <= tolerance;

    const grossMatched =
      grossIncludingFees > 0
      && Math.abs(grossIncludingFees - EXPECTED_BASE_WETH) <= tolerance;

    const status = principalMatched
      ? 'ok'
      : (
          grossMatched
            ? 'boundary-review-principal-vs-unclaimed-fees'
            : 'unresolved'
        );

    return {
      chain: 'Base',
      protocol: 'Aerodrome Slipstream',
      ownerObservedApprox: EXPECTED_BASE_WETH,
      methodology: {
        source:
          'official Aerodrome/Velodrome LpSugar onchain positions API',
        principal:
          'WETH principal = amount side + staked side for each current position',
        accruedFees:
          'unstaked_earned WETH is tracked separately and NOT added to Company Balance principal',
        antiDoubleCount:
          'legacy and current Sugar position methods are deduplicated by pool + NFT id'
      },
      knownContext: {
        slipstreamNfpmV1: TARGET.knownSlipstreamNfpmV1,
        wethUsdcPool: TARGET.knownWethUsdcPool
      },
      sugar,
      wethPositions,
      totals: {
        principalWeth: round(principalWeth),
        unclaimedFeeWeth: round(unclaimedFeeWeth),
        grossIncludingUnclaimedFees: round(grossIncludingFees)
      },
      tolerance: round(tolerance),
      deltaPrincipalVsOwnerObserved: principalWeth > 0
        ? round(principalWeth - EXPECTED_BASE_WETH)
        : null,
      deltaGrossVsOwnerObserved: grossIncludingFees > 0
        ? round(grossIncludingFees - EXPECTED_BASE_WETH)
        : null,
      principalMatched,
      grossMatched,
      matched: principalMatched,
      status
    };
  });

  return wrapped.result || {
    chain: 'Base',
    protocol: 'Aerodrome Slipstream',
    matched: false,
    status: 'unavailable',
    diagnostics: wrapped.errors
  };
}

async function main() {
  const startedAt = new Date().toISOString();

  const previous = readPreviousV12();

  if (previous.status !== 'ok') {
    throw new Error(
      `Previous v1.2 resolver state unavailable: ${JSON.stringify(previous)}`
    );
  }

  const aerodromeWeth = await resolveAerodromeWeth();

  const baseWethResolved = aerodromeWeth?.matched === true;

  const finalEth =
    previous.ethNativeSubtotal
    + Number(aerodromeWeth?.totals?.principalWeth || 0);

  const unresolved = baseWethResolved
    ? []
    : ['baseWeth'];

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
      'close only final Company #008 Base WETH delta by reading current Aerodrome Slipstream LP positions from the official onchain Sugar contract',

    preservedResolved: {
      previousResolverVersion: previous.version,
      btc: previous.btc,
      ethNativeSubtotal: previous.ethNativeSubtotal,
      ...previous.preservedResolved
    },

    results: {
      baseWethAerodromeSlipstream: aerodromeWeth
    },

    resolution: {
      lombardEthereumWbtc: true,
      lombardBaseWbtc: true,
      avalancheBtcB: true,
      baseWeth: baseWethResolved,
      unresolved,
      allResolved: unresolved.length === 0
    },

    finalCandidateTotals: {
      btc: round(previous.btc),
      eth: round(finalEth),
      authoritativeBalanceDiscovery: unresolved.length === 0
    },

    metricBoundary: {
      companyBalance:
        'Aerodrome LP WETH principal is included in ETH economic exposure only when principal reconciliation passes',
      accruedRewards:
        'unclaimed Slipstream trading fees are separate accrued protocol value and are not included in Company Balance principal',
      emissions:
        'any Sugar emissions_earned value is a separate reward candidate and must not be folded into ETH principal'
    },

    nextStep: unresolved.length === 0
      ? 'Company #008 BTC/ETH balance discovery closed; carry Aerodrome LP fee/emission findings into Rewards/Productivity integration'
      : (
          aerodromeWeth?.status === 'boundary-review-principal-vs-unclaimed-fees'
            ? 'resolve accounting boundary using emitted principal and fee components; do not combine them silently'
            : 'target only Base WETH using the exact Aerodrome/Sugar evidence emitted here'
        )
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });

  fs.writeFileSync(
    OUTPUT,
    JSON.stringify(output, null, 2) + '\n'
  );

  console.log(
    `Company #008 targeted resolver v1.3 written: ${OUTPUT}`
  );
  console.log(
    `Aerodrome WETH principal: ${aerodromeWeth?.totals?.principalWeth ?? null}`
  );
  console.log(
    `Aerodrome WETH unclaimed fees: ${aerodromeWeth?.totals?.unclaimedFeeWeth ?? null}`
  );
  console.log(
    `Base WETH matched: ${baseWethResolved}`
  );
  console.log(
    `Final BTC: ${output.finalCandidateTotals.btc}`
  );
  console.log(
    `Final ETH: ${output.finalCandidateTotals.eth}`
  );
  console.log(
    `Unresolved: ${unresolved.join(', ') || 'none'}`
  );
}

main().catch(err => {
  console.error(
    `Company #008 targeted resolver v1.3 failed: ${errMsg(err)}`
  );
  process.exitCode = 1;
});
