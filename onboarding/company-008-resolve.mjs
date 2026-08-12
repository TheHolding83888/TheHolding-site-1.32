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

const VERSION = '1.4-company-008-aerodrome-ve-rewards-weth-final-pass';
const WALLET = canonicalAddress('0xe4b9c9ced406baffe406e63f83d39daaef150596');

const OUTPUT = process.env.COMPANY_008_RESOLVE_OUTPUT
  || path.resolve('companies/company-008-resolve.json');

const PREVIOUS_RESOLVER_FILE = path.resolve('companies/company-008-resolve.json');
const DISCOVERY_FILE = path.resolve('companies/company-008-discovery.json');

const BASE_RPC_URLS = [
  process.env.BASE_RPC_URL,
  process.env.BASE_RPC_URL_2,
  'https://base-rpc.publicnode.com',
  'https://mainnet.base.org'
].filter(Boolean);

const TARGET = Object.freeze({
  baseWeth: canonicalAddress('0x4200000000000000000000000000000000000006'),
  lpSugar: canonicalAddress('0x69dd9db6d8f8e7d83887a704f447b1a584b599a1'),
  rewardsSugar: canonicalAddress('0x1b121efdaf4abb8785a315c51d29bce0552a7678')
});

const EXPECTED_BASE_WETH = 0.1606;
const TOLERANCE = Math.max(0.001, EXPECTED_BASE_WETH * 0.03);
const MATERIAL_WETH = 0.001;
const PAGE_SIZE = 250;
const MAX_POOLS_SCAN = 1000;

const REWARD_TUPLE =
  '(uint256 venft_id,address lp,uint256 amount,address token,address fee,address bribe)';

function errMsg(e) {
  return String(e?.shortMessage || e?.message || e || 'unknown error')
    .replace(/https?:\/\/[^\s)]+/g, '[url-redacted]')
    .slice(0, 1200);
}

function lower(value) {
  return String(value || '').toLowerCase();
}

function round(value, digits = 12) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : null;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function readPreviousV13() {
  try {
    const d = readJson(PREVIOUS_RESOLVER_FILE);

    if (d?.version !== '1.3-company-008-aerodrome-sugar-base-weth-final') {
      return {
        status: 'unexpected-version',
        version: d?.version || null
      };
    }

    const btc = Number(d?.finalCandidateTotals?.btc);
    const ethNativeSubtotal = Number(d?.preservedResolved?.ethNativeSubtotal);

    if (!Number.isFinite(btc) || btc <= 0) {
      return { status: 'btc-invalid', version: d.version };
    }

    if (!Number.isFinite(ethNativeSubtotal) || ethNativeSubtotal < 0) {
      return { status: 'eth-native-invalid', version: d.version };
    }

    if (
      d?.resolution?.lombardEthereumWbtc !== true
      || d?.resolution?.lombardBaseWbtc !== true
      || d?.resolution?.avalancheBtcB !== true
    ) {
      return { status: 'previous-resolutions-not-preserved', version: d.version };
    }

    return {
      status: 'ok',
      version: d.version,
      btc,
      ethNativeSubtotal,
      previousResolution: d.resolution,
      previousAerodromeSlipstream: d?.results?.baseWethAerodromeSlipstream || null,
      preservedResolved: d?.preservedResolved || null
    };
  } catch (e) {
    return { status: 'unavailable', error: errMsg(e) };
  }
}

function readAerodromeIdsFromDiscovery() {
  const d = readJson(DISCOVERY_FILE);

  if (d?.company?.registry !== '008') {
    throw new Error('Company #008 discovery registry mismatch');
  }

  const positions = Array.isArray(d?.discovery?.aerodrome?.positions)
    ? d.discovery.aerodrome.positions
    : [];

  const directVenftIds = [...new Set(
    positions
      .map(x => String(x?.tokenId || ''))
      .filter(x => /^\d+$/.test(x) && BigInt(x) > 0n)
  )];

  const managedVenftIds = [...new Set(
    positions
      .map(x => String(x?.managedTokenId || ''))
      .filter(x => /^\d+$/.test(x) && BigInt(x) > 0n)
  )];

  if (directVenftIds.length === 0) {
    throw new Error('No Aerodrome veNFT ids found in discovery');
  }

  return {
    discoveryVersion: d.version,
    directVenftIds,
    managedVenftIds,
    aerodrome: d.discovery.aerodrome
  };
}

async function withBaseProvider(fn) {
  const errors = [];

  for (const url of BASE_RPC_URLS) {
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

function normalizeReward(raw, sourceVenftId) {
  const venftId = BigInt(raw.venft_id ?? raw[0]).toString();
  const lp = canonicalAddress(raw.lp ?? raw[1]);
  const amountRaw = BigInt(raw.amount ?? raw[2]).toString();
  const token = canonicalAddress(raw.token ?? raw[3]);
  const fee = canonicalAddress(raw.fee ?? raw[4]);
  const bribe = canonicalAddress(raw.bribe ?? raw[5]);

  return {
    sourceVenftId: String(sourceVenftId),
    venftId,
    lp,
    amountRaw,
    token,
    fee,
    bribe,
    kind: lower(fee) !== '0x0000000000000000000000000000000000000000'
      ? 'fees'
      : 'incentives'
  };
}

function dedupeRewards(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = [
      row.venftId,
      lower(row.lp),
      lower(row.token),
      lower(row.fee),
      lower(row.bribe)
    ].join(':');

    const current = map.get(key);
    if (!current || BigInt(row.amountRaw) > BigInt(current.amountRaw)) {
      map.set(key, row);
    }
  }

  return [...map.values()];
}

async function getPoolCount() {
  const wrapped = await withBaseProvider(async provider => {
    const code = await provider.getCode(TARGET.lpSugar);
    if (code === '0x') throw new Error('LpSugar has no bytecode');

    const sugar = new Contract(
      TARGET.lpSugar,
      ['function count() view returns (uint256)'],
      provider
    );

    return Number(await sugar.count());
  });

  if (!Number.isFinite(wrapped.result) || wrapped.result <= 0) {
    return {
      status: 'unavailable',
      count: null,
      diagnostics: wrapped.errors
    };
  }

  return {
    status: 'ok',
    count: wrapped.result,
    diagnostics: wrapped.errors
  };
}

async function scanVenftRewards(venftId, poolCount) {
  const scanLimit = Math.min(poolCount, MAX_POOLS_SCAN);
  const rows = [];
  const pages = [];
  let complete = true;

  for (let offset = 0; offset < scanLimit; offset += PAGE_SIZE) {
    const limit = Math.min(PAGE_SIZE, scanLimit - offset);

    const wrapped = await withBaseProvider(async provider => {
      const code = await provider.getCode(TARGET.rewardsSugar);
      if (code === '0x') throw new Error('RewardsSugar has no bytecode');

      const sugar = new Contract(
        TARGET.rewardsSugar,
        [`function rewards(uint256,uint256,uint256) view returns (${REWARD_TUPLE}[])`],
        provider
      );

      return await sugar.rewards(limit, offset, BigInt(venftId));
    });

    if (!wrapped.result) {
      complete = false;
      pages.push({
        offset,
        limit,
        ok: false,
        errors: wrapped.errors
      });
      continue;
    }

    const pageRows = Array.from(wrapped.result).map(raw =>
      normalizeReward(raw, venftId)
    );

    rows.push(...pageRows);
    pages.push({
      offset,
      limit,
      ok: true,
      rewardRows: pageRows.length,
      providerErrorsBeforeSuccess: wrapped.errors
    });
  }

  if (poolCount > MAX_POOLS_SCAN) {
    complete = false;
  }

  return {
    venftId: String(venftId),
    poolCount,
    scannedPools: scanLimit,
    maxPoolsScan: MAX_POOLS_SCAN,
    complete,
    pages,
    rewards: dedupeRewards(rows)
  };
}

async function enrichRewardRows(rows) {
  const uniqueTokens = [...new Set(rows.map(x => lower(x.token)))];
  const meta = new Map();

  await withBaseProvider(async provider => {
    for (const tokenLower of uniqueTokens) {
      const token = canonicalAddress(tokenLower);
      const c = new Contract(token, [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)'
      ], provider);

      let symbol = null;
      let decimals = 18;
      try { symbol = await c.symbol(); } catch {}
      try { decimals = Number(await c.decimals()); } catch {}

      meta.set(tokenLower, { symbol, decimals });
    }
    return true;
  });

  return rows.map(row => {
    const m = meta.get(lower(row.token)) || { symbol: null, decimals: 18 };
    const amount = Number(formatUnits(BigInt(row.amountRaw), m.decimals));

    return {
      ...row,
      symbol: m.symbol,
      decimals: m.decimals,
      amount: round(amount)
    };
  });
}

function sumWeth(rows) {
  return rows
    .filter(x => lower(x.token) === lower(TARGET.baseWeth))
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);
}

async function main() {
  const startedAt = new Date().toISOString();

  const previous = readPreviousV13();
  if (previous.status !== 'ok') {
    throw new Error(
      `Previous v1.3 resolver state unavailable: ${JSON.stringify(previous)}`
    );
  }

  const ids = readAerodromeIdsFromDiscovery();
  const poolCountResult = await getPoolCount();

  if (poolCountResult.status !== 'ok') {
    throw new Error(
      `Aerodrome LpSugar pool count unavailable: ${JSON.stringify(poolCountResult)}`
    );
  }

  const directScans = [];
  for (const id of ids.directVenftIds) {
    directScans.push(await scanVenftRewards(id, poolCountResult.count));
  }

  const managedScans = [];
  for (const id of ids.managedVenftIds) {
    managedScans.push(await scanVenftRewards(id, poolCountResult.count));
  }

  const directRowsRaw = dedupeRewards(directScans.flatMap(x => x.rewards));
  const managedRowsRaw = dedupeRewards(managedScans.flatMap(x => x.rewards));

  const directRows = await enrichRewardRows(directRowsRaw);
  const managedRows = await enrichRewardRows(managedRowsRaw);

  const directWeth = sumWeth(directRows);
  const managedWeth = sumWeth(managedRows);

  const directComplete = directScans.every(x => x.complete);
  const managedComplete = managedScans.every(x => x.complete);
  const completeScan = directComplete && managedComplete;

  const directMatched =
    directWeth > 0
    && Math.abs(directWeth - EXPECTED_BASE_WETH) <= TOLERANCE;

  const managedMatched =
    managedWeth > 0
    && Math.abs(managedWeth - EXPECTED_BASE_WETH) <= TOLERANCE;

  const materialDirect = directWeth >= MATERIAL_WETH;
  const materialManaged = managedWeth >= MATERIAL_WETH;

  let accountingMode = 'unresolved';
  let fallbackFoundationWeth = 0;
  let accruedWethCandidate = 0;
  let finalEth = previous.ethNativeSubtotal;
  let companyBookReady = false;
  let authoritativeOnchain = false;
  let unresolved = ['baseWeth'];

  if (completeScan && directMatched) {
    accountingMode = 'aerodrome-direct-venft-accrued-rewards';
    accruedWethCandidate = directWeth;
    finalEth = previous.ethNativeSubtotal;
    companyBookReady = true;
    authoritativeOnchain = true;
    unresolved = [];
  } else if (completeScan && managedMatched) {
    accountingMode = 'managed-relay-level-weth-boundary-review';
    accruedWethCandidate = 0;
    finalEth = previous.ethNativeSubtotal;
    companyBookReady = false;
    authoritativeOnchain = false;
    unresolved = ['baseWethManagedRelayAttribution'];
  } else if (
    completeScan
    && !materialDirect
    && !materialManaged
  ) {
    // Explicit owner-authorized final fallback:
    // after one final Aerodrome reward pass, treat the observed WETH as
    // owner-declared foundation exposure if no material onchain reward source explains it.
    accountingMode = 'owner-declared-foundation-fallback';
    fallbackFoundationWeth = EXPECTED_BASE_WETH;
    finalEth = previous.ethNativeSubtotal + fallbackFoundationWeth;
    companyBookReady = true;
    authoritativeOnchain = false;
    unresolved = [];
  } else if (completeScan && (materialDirect || materialManaged)) {
    accountingMode = 'material-weth-rewards-found-but-no-exact-reconciliation';
    accruedWethCandidate = directWeth;
    finalEth = previous.ethNativeSubtotal;
    companyBookReady = false;
    authoritativeOnchain = false;
    unresolved = ['baseWethAccountingBoundary'];
  }

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
      'one final bounded Company #008 Base WETH pass: test whether the DeBank-observed Aerodrome WETH is current veNFT fee/incentive rewards; if a complete official RewardsSugar scan finds no material WETH source, apply the owner-authorized foundation fallback',

    officialSources: {
      lpSugar: TARGET.lpSugar,
      rewardsSugar: TARGET.rewardsSugar,
      sourceFamily: 'official velodrome-finance/sugar Base deployments + onchain RewardsSugar'
    },

    preservedResolved: {
      previousResolverVersion: previous.version,
      btc: previous.btc,
      ethNativeSubtotal: previous.ethNativeSubtotal,
      previousResolution: previous.previousResolution,
      previousAerodromeSlipstream: previous.previousAerodromeSlipstream,
      previousPreservedResolved: previous.preservedResolved
    },

    aerodromeContext: {
      discoveryVersion: ids.discoveryVersion,
      directVenftIds: ids.directVenftIds,
      managedVenftIds: ids.managedVenftIds,
      expectedBaseWethOwnerObserved: EXPECTED_BASE_WETH,
      tolerance: round(TOLERANCE),
      poolCount: poolCountResult.count,
      scanCap: MAX_POOLS_SCAN
    },

    results: {
      directVenftRewards: {
        complete: directComplete,
        scans: directScans.map(x => ({
          venftId: x.venftId,
          poolCount: x.poolCount,
          scannedPools: x.scannedPools,
          complete: x.complete,
          pages: x.pages,
          rewardCount: x.rewards.length
        })),
        rewards: directRows,
        wethTotal: round(directWeth),
        matchedOwnerObserved: directMatched
      },
      managedRelayDiagnostic: {
        note:
          'Managed veNFT rewards are diagnostic only. Relay-level WETH must not be assigned to the company as claimable without a reproducible per-account attribution path.',
        complete: managedComplete,
        scans: managedScans.map(x => ({
          venftId: x.venftId,
          poolCount: x.poolCount,
          scannedPools: x.scannedPools,
          complete: x.complete,
          pages: x.pages,
          rewardCount: x.rewards.length
        })),
        rewards: managedRows,
        wethTotal: round(managedWeth),
        matchedOwnerObserved: managedMatched
      }
    },

    classification: {
      completeOfficialRewardScan: completeScan,
      accountingMode,
      directWethRewards: round(directWeth),
      managedRelayWethDiagnostic: round(managedWeth),
      ownerDeclaredFoundationFallbackWeth: round(fallbackFoundationWeth),
      accruedRewardsWethCandidate: round(accruedWethCandidate),
      explanation: accountingMode === 'aerodrome-direct-venft-accrued-rewards'
        ? 'Observed WETH is explained by current direct veNFT Aerodrome fee/incentive rewards; keep it out of foundation ETH and carry it into Accrued Rewards.'
        : accountingMode === 'owner-declared-foundation-fallback'
          ? 'A complete final official Aerodrome reward scan found no material WETH source. Per explicit owner instruction, carry 0.1606 WETH as owner-declared foundation ETH exposure, clearly marked as owner-observed rather than onchain-reproduced.'
          : accountingMode === 'managed-relay-level-weth-boundary-review'
            ? 'The WETH appears at managed Relay level. Do not classify it as company principal or claimable reward until per-account attribution is reproducible.'
            : accountingMode === 'material-weth-rewards-found-but-no-exact-reconciliation'
              ? 'Material WETH rewards exist but do not reconcile to the owner-observed amount. Do not silently combine principal and rewards.'
              : 'The final scan was incomplete or inconclusive; no fallback applied.'
    },

    resolution: {
      lombardEthereumWbtc: true,
      lombardBaseWbtc: true,
      avalancheBtcB: true,
      baseWethAccountingResolved: unresolved.length === 0,
      unresolved,
      allResolved: unresolved.length === 0
    },

    finalCandidateTotals: {
      btc: round(previous.btc),
      eth: round(finalEth),
      companyBookQuantityReady: companyBookReady,
      authoritativeOnchainBalanceDiscovery: authoritativeOnchain,
      ethSource: accountingMode === 'owner-declared-foundation-fallback'
        ? 'verified native ETH subtotal + owner-declared Base WETH fallback'
        : 'verified native ETH subtotal only'
    },

    metricBoundary: {
      foundationBalance:
        'Only WETH classified as principal/foundation enters ETH Company Balance. Direct veNFT rewards never enter foundation principal.',
      accruedRewards:
        'Direct veNFT WETH fees/incentives are Accrued Rewards candidates, separate from ETH foundation balance.',
      managedRelay:
        'Managed Relay-level rewards are diagnostic until per-account attribution is reproducible.',
      fallback:
        'Owner-declared fallback is permitted only after a complete final official Aerodrome reward scan finds no material WETH source; it remains explicitly labeled owner-observed, not onchain-reproduced.'
    },

    nextStep: unresolved.length === 0
      ? (
          accountingMode === 'aerodrome-direct-venft-accrued-rewards'
            ? 'Company #008 Base WETH classification closed as Aerodrome Accrued Rewards; integrate reward candidate and keep foundation ETH at native subtotal.'
            : 'Company #008 BTC/ETH Company Book quantities can close using the explicit owner-declared WETH foundation fallback; preserve the provenance label in production integration.'
        )
      : 'Do not run another broad discovery pass. Review only the emitted Aerodrome WETH reward boundary evidence.'
  };

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Company #008 targeted resolver v1.4 written: ${OUTPUT}`);
  console.log(`Aerodrome pools: ${poolCountResult.count}`);
  console.log(`Direct veNFT WETH rewards: ${round(directWeth)}`);
  console.log(`Managed Relay WETH diagnostic: ${round(managedWeth)}`);
  console.log(`Accounting mode: ${accountingMode}`);
  console.log(`Final BTC: ${output.finalCandidateTotals.btc}`);
  console.log(`Final ETH: ${output.finalCandidateTotals.eth}`);
  console.log(`Company Book quantity ready: ${companyBookReady}`);
  console.log(`Unresolved: ${unresolved.join(', ') || 'none'}`);
}

main().catch(err => {
  console.error(`Company #008 targeted resolver v1.4 failed: ${errMsg(err)}`);
  process.exitCode = 1;
});
