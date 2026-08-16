import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT_DIR = 'intelligence/risk';
const OUT_FILE = `${OUT_DIR}/health-factor-intelligence.json`;
const HISTORY_FILE = `${OUT_DIR}/health-factor-history.json`;
const VERSION = '0.1-health-factor-risk-intelligence';
const COLLECTOR_VERSION = '0.1-aave-v3-base-company-risk-collector';
const GET_USER_ACCOUNT_DATA_SELECTOR = 'bf92857c';
const AAVE_V3_BASE = Object.freeze({
  chain: 'Base',
  chainId: 8453,
  pool: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',
  poolAddressesProvider: '0xe20fCBdBfFC4Dd138cE8b2E6FBb6CB49777ad64D',
  addressBookSource: 'https://github.com/aave-dao/aave-address-book/blob/main/src/AaveV3Base.sol',
  rpcCandidates: [
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com'
  ]
});

const sha256 = value => crypto.createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const isAddress = value => /^0x[0-9a-fA-F]{40}$/.test(String(value || ''));

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function companyResolveFiles() {
  return fs.readdirSync('companies')
    .filter(name => /^company-\d{3}-resolve\.json$/.test(name))
    .map(name => path.join('companies', name))
    .sort();
}

function walk(value, visit) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (!isObject(value)) return;
  visit(value);
  for (const child of Object.values(value)) walk(child, visit);
}

function discoverTargets() {
  const targets = new Map();
  for (const file of companyResolveFiles()) {
    const doc = readJson(file);
    const company = isObject(doc.company) ? doc.company : {};
    const wallet = company.wallet;
    if (!isAddress(wallet)) continue;

    walk(doc, item => {
      const protocol = String(item.protocol || '').toLowerCase();
      const chain = String(item.chain || '').toLowerCase();
      const looksLikeResolvedAavePosition = protocol.includes('aave') && chain === 'base' && (
        isAddress(item.aToken) ||
        Object.prototype.hasOwnProperty.call(item, 'collateralEnabled') ||
        String(item.positionType || '').toLowerCase().includes('lending')
      );
      if (!looksLikeResolvedAavePosition) return;

      const key = `${String(company.registry || file).toLowerCase()}:${wallet.toLowerCase()}:base:aave-v3`;
      if (!targets.has(key)) {
        targets.set(key, {
          companyRegistry: company.registry || null,
          companyName: company.name || null,
          wallet,
          sourceFiles: new Set(),
          sourcePositionIds: new Set()
        });
      }
      const target = targets.get(key);
      target.sourceFiles.add(file);
      if (item.id) target.sourcePositionIds.add(String(item.id));
    });
  }

  return [...targets.values()].map(target => ({
    companyRegistry: target.companyRegistry,
    companyName: target.companyName,
    wallet: target.wallet,
    chain: AAVE_V3_BASE.chain,
    chainId: AAVE_V3_BASE.chainId,
    protocol: 'Aave v3',
    pool: AAVE_V3_BASE.pool,
    sourceFiles: [...target.sourceFiles].sort(),
    sourcePositionIds: [...target.sourcePositionIds].sort()
  }));
}

async function rpc(endpoint, method, params) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(12000)
  });
  if (!response.ok) throw new Error(`${endpoint} HTTP ${response.status}`);
  const payload = await response.json();
  if (payload.error) throw new Error(`${endpoint} ${method}: ${payload.error.message || JSON.stringify(payload.error)}`);
  if (payload.result == null) throw new Error(`${endpoint} ${method}: missing result`);
  return payload.result;
}

async function callWithFailover(method, params) {
  const errors = [];
  for (const endpoint of AAVE_V3_BASE.rpcCandidates) {
    try {
      const result = await rpc(endpoint, method, params);
      return { endpoint, result };
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }
  throw new Error(`all Base RPC candidates failed: ${errors.join(' | ')}`);
}

function encodeAddressCall(selector, address) {
  return `0x${selector}${address.slice(2).toLowerCase().padStart(64, '0')}`;
}

function decodeUint256Tuple(hex, count) {
  const raw = String(hex || '').replace(/^0x/, '');
  if (raw.length < count * 64) throw new Error(`short eth_call result: expected >= ${count * 64} hex chars, got ${raw.length}`);
  return Array.from({ length: count }, (_, index) => BigInt(`0x${raw.slice(index * 64, (index + 1) * 64)}`));
}

function healthFactorNumber(raw) {
  const integer = raw / 10n ** 18n;
  const fraction = raw % 10n ** 18n;
  return Number(integer) + Number(fraction) / 1e18;
}

function classifyHealthFactor(totalDebtBase, rawHealthFactor) {
  if (totalDebtBase === 0n) {
    return {
      debtPresent: false,
      healthFactorApplicable: false,
      healthFactor: null,
      state: 'no-debt',
      attention: 'none',
      reason: 'Aave account reports zero debt; protocol health factor is not economically applicable.'
    };
  }

  const hf = healthFactorNumber(rawHealthFactor);
  let state = 'higher-buffer-reference';
  let attention = 'contextual-review';
  if (hf < 1) {
    state = 'below-protocol-liquidation-threshold';
    attention = 'critical-review';
  } else if (hf < 1.5) {
    state = 'very-low-buffer';
    attention = 'high-review';
  } else if (hf < 1.8) {
    state = 'below-owner-ordinary-comfort-reference';
    attention = 'review';
  } else if (hf < 2.5) {
    state = 'ordinary-comfort-reference-regime-dependent';
    attention = 'contextual-review';
  }

  return {
    debtPresent: true,
    healthFactorApplicable: true,
    healthFactor: Number(hf.toFixed(6)),
    state,
    attention,
    reason: 'Mechanical HF observation plus owner-context reference bands; market regime is not inferred.'
  };
}

async function collectTarget(target) {
  const callData = encodeAddressCall(GET_USER_ACCOUNT_DATA_SELECTOR, target.wallet);
  const { endpoint, result } = await callWithFailover('eth_call', [{ to: AAVE_V3_BASE.pool, data: callData }, 'latest']);
  const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiquidationThreshold, ltv, healthFactor] = decodeUint256Tuple(result, 6);
  const block = await rpc(endpoint, 'eth_blockNumber', []);
  const assessment = classifyHealthFactor(totalDebtBase, healthFactor);

  return {
    ...target,
    observedAt: new Date().toISOString(),
    onchain: {
      status: 'ok',
      rpc: endpoint,
      blockNumber: Number(BigInt(block)),
      method: 'IPool.getUserAccountData(address)',
      selector: `0x${GET_USER_ACCOUNT_DATA_SELECTOR}`,
      totalCollateralBaseRaw: totalCollateralBase.toString(),
      totalDebtBaseRaw: totalDebtBase.toString(),
      availableBorrowsBaseRaw: availableBorrowsBase.toString(),
      currentLiquidationThresholdBps: Number(currentLiquidationThreshold),
      ltvBps: Number(ltv),
      healthFactorRaw: healthFactor.toString()
    },
    assessment,
    ownerContext: {
      unitId: 'owner-context:audio-owner-q:q7',
      ordinaryComfortReference: '~1.8–2+ contextually',
      weakerOrProlongedMarketMonitoringReference: '~1.5–2 situational',
      higherBufferReference: '~2.5–3 in stronger/overheated contexts',
      hardAutomaticThreshold: false,
      marketRegimeInferred: false,
      rule: 'References inform review; they are not autonomous borrow/repay instructions.'
    }
  };
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const startedAt = new Date().toISOString();
  const targets = discoverTargets();
  const observations = [];

  for (const target of targets) {
    try {
      observations.push(await collectTarget(target));
    } catch (error) {
      observations.push({
        ...target,
        observedAt: new Date().toISOString(),
        onchain: { status: 'unavailable', error: error.message },
        assessment: {
          debtPresent: null,
          healthFactorApplicable: null,
          healthFactor: null,
          state: 'unknown',
          attention: 'data-unavailable',
          reason: 'Live onchain read failed; unknown is preserved rather than converted to zero.'
        }
      });
    }
  }

  const okCount = observations.filter(x => x.onchain?.status === 'ok').length;
  const unavailableCount = observations.length - okCount;
  const generatedAt = new Date().toISOString();
  const state = {
    version: VERSION,
    collectorVersion: COLLECTOR_VERSION,
    startedAt,
    generatedAt,
    status: targets.length === 0 ? 'empty' : unavailableCount === 0 ? 'ok' : okCount > 0 ? 'partial' : 'unavailable',
    purpose: 'Canonical read-only company lending-risk primitive for real onchain collateral, debt and Health Factor state.',
    authority: {
      readOnly: true,
      executionAuthority: 'none',
      capitalExecution: false,
      automaticBorrow: false,
      automaticRepay: false,
      automaticLiquidationManagement: false,
      policyMutationAuthority: false,
      methodologyMutationAuthority: false
    },
    source: {
      discovery: 'canonical company-*-resolve.json files with resolved Base Aave positions',
      protocol: 'Aave v3 Base IPool.getUserAccountData(address)',
      pool: AAVE_V3_BASE.pool,
      poolAddressesProvider: AAVE_V3_BASE.poolAddressesProvider,
      addressBook: AAVE_V3_BASE.addressBookSource,
      rpcCandidates: AAVE_V3_BASE.rpcCandidates
    },
    semantics: {
      zeroDebt: 'When totalDebtBaseRaw is zero, healthFactor is reported as null/not-applicable even if the protocol returns a sentinel max uint.',
      unknown: 'RPC/read failure remains unknown and never becomes zero.',
      ownerContext: 'Owner HF ranges are review context, not autonomous capital rules.',
      regimeBoundary: 'This v0.1 does not infer market regime. It exposes live HF and reference-band comparison only.'
    },
    coverage: {
      discoveredTargetCount: targets.length,
      successfulTargetCount: okCount,
      unavailableTargetCount: unavailableCount,
      supportedMarkets: ['Aave v3 Base'],
      futureMarkets: 'must be added with official address provenance and independent validation'
    },
    observations
  };
  state.integrity = {
    observationHash: sha256(observations.map(x => ({ companyRegistry: x.companyRegistry, wallet: x.wallet, onchain: x.onchain, assessment: x.assessment }))),
    sourceFileHashes: Object.fromEntries([...new Set(targets.flatMap(x => x.sourceFiles))].sort().map(file => [file, sha256(fs.readFileSync(file, 'utf8'))]))
  };
  state.integrity.stateHash = sha256({ ...state, integrity: state.integrity });

  let history = { version: '0.1-health-factor-history', retention: { snapshots: 365 }, snapshots: [] };
  if (fs.existsSync(HISTORY_FILE)) {
    const prior = readJson(HISTORY_FILE);
    if (prior?.version === history.version && Array.isArray(prior.snapshots)) history = prior;
  }
  const snapshot = {
    generatedAt,
    status: state.status,
    targetCount: targets.length,
    okCount,
    unavailableCount,
    observations: observations.map(x => ({
      companyRegistry: x.companyRegistry,
      wallet: x.wallet,
      chain: x.chain,
      protocol: x.protocol,
      totalCollateralBaseRaw: x.onchain?.totalCollateralBaseRaw ?? null,
      totalDebtBaseRaw: x.onchain?.totalDebtBaseRaw ?? null,
      healthFactor: x.assessment?.healthFactor ?? null,
      state: x.assessment?.state ?? 'unknown'
    }))
  };
  snapshot.snapshotHash = sha256(snapshot);
  history.snapshots = [...history.snapshots.filter(x => x?.snapshotHash !== snapshot.snapshotHash), snapshot].slice(-history.retention.snapshots);
  history.lastUpdatedAt = generatedAt;

  fs.writeFileSync(OUT_FILE, `${JSON.stringify(state, null, 2)}\n`);
  fs.writeFileSync(HISTORY_FILE, `${JSON.stringify(history, null, 2)}\n`);

  console.log(JSON.stringify({
    version: state.version,
    status: state.status,
    coverage: state.coverage,
    observations: observations.map(x => ({ company: x.companyRegistry, debtPresent: x.assessment?.debtPresent, healthFactor: x.assessment?.healthFactor, state: x.assessment?.state, onchain: x.onchain?.status })),
    executionAuthority: state.authority.executionAuthority
  }, null, 2));

  if (targets.length < 1) throw new Error('No canonical Base Aave company target discovered; refusing to claim HF coverage.');
  if (okCount < 1) throw new Error('No live Aave Health Factor target was successfully read.');
}

await main();
