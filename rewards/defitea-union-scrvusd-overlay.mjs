import fs from 'node:fs';
import path from 'node:path';
import {
  Contract,
  JsonRpcProvider,
  ZeroAddress,
  concat,
  formatUnits,
  getAddress,
  keccak256,
  solidityPackedKeccak256
} from 'ethers';

const VERSION = '0.1-defitea-votium-union-scrvusd-member-proof';
const OUTPUT = process.env.REWARDS_OUTPUT || path.resolve('companies/rewards-data.json');
const DEFITEA = getAddress('0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3');
const VOTIUM_REGISTRY = getAddress('0x92e6e43f99809df84ed2d533e1fd8017eb966ee2');
const UNION_FORWARD = getAddress('0xcc2a0f5e95c88aabd7b8e0db5c5252820cd47f91');
const UNION_ZAP_V9 = getAddress('0xd52ca71aafa4d2590aac1e35e3005242dd31e5ed');
const ASSET_REGISTRY = getAddress('0xcfa23b8f9062369b21049b9f4a4ce79d640d1873');
const SCRVUSD_DISTRIBUTOR = getAddress('0x17ac69dd3fb8f22b4f52dbdb8a3a0eb059367efc');
const SCRVUSD = getAddress('0x0655977FEb2f289A4aB78af67BAB0d17aAb84367');
const CRVUSD = getAddress('0xf939E0A03FB07F59A73314E73794Be0E57ac1b4E');
const API_BASE = 'https://api.llama.airforce';

const RPC_URLS = [...new Set([
  process.env.ETH_RPC_URL,
  'https://ethereum-rpc.publicnode.com',
  'https://eth.llamarpc.com'
].filter(Boolean))];

const VOTIUM_REGISTRY_ABI = [
  'function registry(address) view returns (tuple(uint256 start,address to,uint256 expiration))'
];
const UNION_ZAP_ABI = ['function outputTokens(uint256) view returns (address)'];
const ASSET_REGISTRY_ABI = [
  'function getAllocations(address[] members) view returns (uint16[16][] allocations)'
];
const DISTRIBUTOR_ABI = [
  'function token() view returns (address)',
  'function merkleRoot() view returns (bytes32)',
  'function week() view returns (uint32)',
  'function frozen() view returns (bool)',
  'function isClaimed(uint256 index) view returns (bool)'
];
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)'
];
const ERC4626_ABI = [
  ...ERC20_ABI,
  'function convertToAssets(uint256 shares) view returns (uint256)'
];

function round(v, dp = 10) {
  if (!Number.isFinite(Number(v))) return null;
  return Number(Number(v).toFixed(dp));
}
function finite(v) { return v !== null && v !== undefined && Number.isFinite(Number(v)); }
function sameAddress(a, b) {
  try { return getAddress(a) === getAddress(b); } catch { return false; }
}
function hashPair(a, b) {
  return keccak256(String(a).toLowerCase() < String(b).toLowerCase() ? concat([a, b]) : concat([b, a]));
}
function verifyMerkle({ index, account, amount, proof }, root) {
  let hash = solidityPackedKeccak256(['uint256', 'address', 'uint256'], [BigInt(index), getAddress(account), BigInt(amount)]);
  for (const p of proof || []) hash = hashPair(hash, p);
  return String(hash).toLowerCase() === String(root).toLowerCase();
}
async function fetchJson(url, { allow404 = false, timeoutMs = 15000 } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (res.status === 404 && allow404) return { found: false, data: null, status: 404 };
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { found: true, data: await res.json(), status: res.status };
  } finally { clearTimeout(timer); }
}
async function provider() {
  let last;
  for (const url of RPC_URLS) {
    try {
      const p = new JsonRpcProvider(url, 1, { staticNetwork: true });
      await p.getBlockNumber();
      return p;
    } catch (e) { last = e; }
  }
  throw last || new Error('No Ethereum RPC available');
}
async function outputTokens(zap) {
  const out = [];
  for (let i = 0; i < 16; i++) {
    try {
      const token = getAddress(await zap.outputTokens(i));
      if (!token || token === ZeroAddress) break;
      out.push(token);
    } catch { break; }
  }
  return out;
}
async function crvUsdPrice() {
  const key = `ethereum:${CRVUSD.toLowerCase()}`;
  const { data } = await fetchJson(`https://coins.llama.fi/prices/current/${key}`);
  const row = data?.coins?.[key];
  const price = Number(row?.price);
  if (!(price > 0) || !Number.isFinite(price)) throw new Error('crvUSD price unavailable');
  return { price, source: 'DefiLlama contract price' };
}
function aggregateTokenSummary(rewards) {
  const map = new Map();
  for (const r of rewards || []) {
    const key = `${r.symbol}|${r.token}`;
    if (!map.has(key)) map.set(key, { symbol: r.symbol, token: r.token, amount: 0, usdValue: 0, usdComplete: true });
    const x = map.get(key);
    x.amount += Number(r.amount || 0);
    if (finite(r.usdValue)) x.usdValue += Number(r.usdValue); else x.usdComplete = false;
  }
  return [...map.values()].map(x => ({
    symbol: x.symbol,
    token: x.token,
    amount: round(x.amount, 10),
    usdValue: x.usdComplete ? round(x.usdValue, 6) : null
  }));
}
function recomputeCompany(c) {
  const rewards = c.rewards || [];
  const sources = c.sources || [];
  const routeCount = Number(c.routeCount || 0);
  const completeRoutes = sources.filter(s => s.status === 'ok').length;
  const measuredRoutes = sources.filter(s => s.status === 'ok' || s.status === 'partial').length;
  const pendingRoutes = sources.filter(s => s.status !== 'ok').length;
  const unpricedRewards = rewards.filter(r => !finite(r.usdValue)).length;
  const totalUsd = rewards.reduce((sum, r) => sum + (finite(r.usdValue) ? Number(r.usdValue) : 0), 0);
  const allRoutesComplete = routeCount > 0 && completeRoutes === routeCount;
  c.totalUsd = round(totalUsd, 6);
  c.totalUsdIsComplete = allRoutesComplete && unpricedRewards === 0;
  c.routeCoverage = routeCount ? round(measuredRoutes / routeCount, 6) : 0;
  c.completeRouteCoverage = routeCount ? round(completeRoutes / routeCount, 6) : 0;
  c.measuredRoutes = measuredRoutes;
  c.completeRoutes = completeRoutes;
  c.pendingRoutes = pendingRoutes;
  c.unpricedRewards = unpricedRewards;
  c.rewardTokens = aggregateTokenSummary(rewards);
  c.status = c.totalUsdIsComplete ? 'ok' : measuredRoutes > 0 ? 'partial' : 'warming';
}

async function main() {
  const data = JSON.parse(fs.readFileSync(OUTPUT, 'utf8'));
  const company = data.companies?.['defitea.eth'];
  if (!company) throw new Error('Defitea rewards company missing');
  const p = await provider();
  const now = new Date().toISOString();

  // Idempotence: remove only rows produced by this overlay. Direct Votium rows stay intact.
  company.rewards = (company.rewards || []).filter(r => r.route !== 'votium-union-scrvusd');

  const registry = new Contract(VOTIUM_REGISTRY, VOTIUM_REGISTRY_ABI, p);
  const zap = new Contract(UNION_ZAP_V9, UNION_ZAP_ABI, p);
  const assetRegistry = new Contract(ASSET_REGISTRY, ASSET_REGISTRY_ABI, p);
  const distributor = new Contract(SCRVUSD_DISTRIBUTOR, DISTRIBUTOR_ABI, p);
  const scrv = new Contract(SCRVUSD, ERC4626_ABI, p);

  const [forward, outputs, allocationsResult, distributorToken, merkleRoot, week, frozen, symbol, decimals] = await Promise.all([
    registry.registry(DEFITEA),
    outputTokens(zap),
    assetRegistry.getAllocations([DEFITEA]),
    distributor.token(),
    distributor.merkleRoot(),
    distributor.week(),
    distributor.frozen(),
    scrv.symbol(),
    scrv.decimals()
  ]);

  if (!sameAddress(distributorToken, SCRVUSD)) throw new Error(`scrvUSD distributor token mismatch: ${distributorToken}`);
  const allocations = Array.from(allocationsResult?.[0] || []).map(Number);
  if (allocations.length !== 16) throw new Error(`Union allocation vector length ${allocations.length} != 16`);
  const scrvIndex = outputs.findIndex(t => sameAddress(t, SCRVUSD));
  const scrvWeight = scrvIndex >= 0 ? Number(allocations[scrvIndex] || 0) : null;
  const totalWeight = allocations.reduce((s, x) => s + Number(x || 0), 0);
  const scrvSharePct = scrvWeight !== null && totalWeight > 0 ? round(scrvWeight / totalWeight * 100, 6) : null;

  const forwardTo = getAddress(forward.to);
  const forwardingConfigured = sameAddress(forwardTo, UNION_FORWARD);
  const nowSec = Math.floor(Date.now() / 1000);
  const start = Number(forward.start || 0);
  const expiration = Number(forward.expiration || 0);
  const forwardingEffective = forwardingConfigured && start <= nowSec && (expiration === 0 || expiration > nowSec);

  const claimUrl = `${API_BASE}/airdrop/scrvusd/${DEFITEA}`;
  let api;
  try { api = await fetchJson(claimUrl, { allow404: true, timeoutMs: 15000 }); }
  catch (e) { api = { found: null, data: null, status: null, error: e.message }; }

  let entitlement = null;
  let unionReward = null;
  let state = 'warming';
  let reason = null;

  if (api.found === true) {
    const claim = api.data || {};
    if (claim.index === undefined || claim.amount === undefined || !Array.isArray(claim.proof)) throw new Error('Union scrvUSD API claim schema invalid');
    const proofValid = verifyMerkle({ index: claim.index, account: DEFITEA, amount: claim.amount, proof: claim.proof }, merkleRoot);
    if (!proofValid) throw new Error('Union scrvUSD API proof does not match onchain merkleRoot');
    const claimed = Boolean(await distributor.isClaimed(BigInt(claim.index)));
    const amountRaw = BigInt(claim.amount);
    const amount = Number(formatUnits(amountRaw, Number(decimals)));
    const assetsRaw = amountRaw > 0n ? await scrv.convertToAssets(amountRaw) : 0n;
    const redeemAmount = Number(formatUnits(assetsRaw, 18));
    let price = null;
    let priceSource = null;
    let usdValue = null;
    try {
      const q = await crvUsdPrice();
      price = q.price;
      priceSource = q.source;
      usdValue = round(redeemAmount * price, 6);
    } catch (e) { priceSource = `unpriced: ${e.message}`; }

    entitlement = {
      status: claimed ? 'claimed' : 'unclaimed',
      index: String(claim.index),
      amountRaw: amountRaw.toString(),
      amount: round(amount, 12),
      proofValid: true,
      claimed,
      merkleRoot,
      distributorWeek: Number(week),
      distributorFrozen: Boolean(frozen),
      redeemAsset: CRVUSD,
      redeemAmountRaw: assetsRaw.toString(),
      redeemAmount: round(redeemAmount, 12),
      usdValue,
      priceSource
    };
    if (!claimed && amountRaw > 0n) {
      unionReward = {
        protocol: 'The Union · vlCVX',
        route: 'votium-union-scrvusd',
        chain: 'Ethereum',
        token: SCRVUSD,
        symbol: String(symbol || 'scrvUSD'),
        amountRaw: amountRaw.toString(),
        decimals: Number(decimals),
        amount: round(amount, 10),
        classification: 'unclaimed',
        source: 'Llama Airforce official member airdrop + onchain Merkle proof/claimed-state',
        usdValue,
        priceUsd: price,
        priceMethod: price ? `ERC4626 convertToAssets(crvUSD) × ${priceSource}` : null,
        details: {
          wallet: DEFITEA,
          walletAlias: 'defitea.eth',
          sourceVlCvx: true,
          delegationPath: 'vlCVX → Votium → The Union → scrvUSD',
          forwardingRegistry: VOTIUM_REGISTRY,
          forwardingTarget: forwardTo,
          unionForwardingAddress: UNION_FORWARD,
          forwardingEffective,
          allocationRegistry: ASSET_REGISTRY,
          allocationOutputIndex: scrvIndex,
          allocationWeight: scrvWeight,
          allocationTotalWeight: totalWeight,
          allocationSharePct: scrvSharePct,
          distributor: SCRVUSD_DISTRIBUTOR,
          distributorWeek: Number(week),
          merkleIndex: String(claim.index),
          merkleRoot,
          proofValid: true,
          claimed: false,
          airdropId: 'scrvusd',
          redeemSymbol: 'crvUSD',
          redeemAmount: round(redeemAmount, 12),
          redemptionPricePlatform: 'ethereum',
          redemptionPriceContract: CRVUSD,
          unknownIsNotZero: true
        }
      };
      company.rewards.push(unionReward);
      state = 'measured';
    } else {
      state = claimed ? 'claimed' : 'measured-zero-entitlement';
    }
  } else if (api.found === false) {
    state = 'warming';
    reason = forwardingEffective
      ? 'Union forwarding/allocation are observable but the current scrvUSD member airdrop has not published an entitlement for this wallet yet. 404 is not interpreted as zero.'
      : 'No current scrvUSD member entitlement and Union forwarding is not yet proven effective.';
  } else {
    state = 'partial';
    reason = `Official Union member airdrop endpoint unavailable: ${api.error || 'unknown error'}`;
  }

  const oldSourceIndex = (company.sources || []).findIndex(s => s.route === 'votium-union');
  const oldSource = oldSourceIndex >= 0 ? company.sources[oldSourceIndex] : null;
  const unionSource = {
    protocol: 'Convex / Votium / The Union',
    route: 'votium-union',
    status: state === 'measured' || state === 'claimed' || state === 'measured-zero-entitlement' ? (oldSource?.status === 'ok' ? 'ok' : 'partial') : state === 'partial' ? 'partial' : 'warming',
    chain: 'Ethereum',
    metric: 'direct Votium current Merkle + Union forwarding/allocation + scrvUSD member Merkle entitlement',
    note: reason || (state === 'measured'
      ? 'Union scrvUSD entitlement is locally Merkle-verified against the live distributor root and onchain isClaimed=false.'
      : state === 'claimed'
        ? 'The current Union scrvUSD entitlement is proven but already claimed; it is excluded from Unclaimed rewards.'
        : 'Union scrvUSD member-level state measured without a positive unclaimed entitlement.'),
    details: {
      directVotium: oldSource ? { status: oldSource.status, metric: oldSource.metric, note: oldSource.note, details: oldSource.details || null } : null,
      union: {
        capability: VERSION,
        wallet: DEFITEA,
        forwarding: {
          registry: VOTIUM_REGISTRY,
          to: forwardTo,
          expectedUnionForward: UNION_FORWARD,
          configured: forwardingConfigured,
          effective: forwardingEffective,
          start,
          expiration
        },
        allocation: {
          registry: ASSET_REGISTRY,
          unionZap: UNION_ZAP_V9,
          outputTokens: outputs,
          weights: allocations,
          totalWeight,
          scrvUsdOutputIndex: scrvIndex,
          scrvUsdWeight: scrvWeight,
          scrvUsdSharePct: scrvSharePct,
          scrvUsdSelected: scrvWeight !== null ? scrvWeight > 0 : null
        },
        airdrop: {
          api: `${API_BASE}/airdrop/scrvusd/{address}`,
          apiStatus: api.status,
          entitlement,
          unknownIsNotZero: true,
          rolloverAware: true
        },
        contracts: {
          distributor: SCRVUSD_DISTRIBUTOR,
          token: SCRVUSD,
          underlying: CRVUSD,
          distributorWeek: Number(week),
          distributorFrozen: Boolean(frozen),
          merkleRoot
        },
        state
      },
      unknownIsNotZero: true
    }
  };
  if (oldSourceIndex >= 0) company.sources[oldSourceIndex] = unionSource;
  else company.sources.push(unionSource);

  company.updatedAt = now;
  recomputeCompany(company);
  data.methodology = data.methodology || {};
  data.methodology.convex = 'Direct Votium wallet Merkle claims are measured independently. For The Union, Votium registry forwarding and Union AssetRegistry allocation are read onchain; scrvUSD member entitlement is accepted only from Llama Airforce official airdrop data after local Merkle verification against the live scrvUSD distributor and onchain isClaimed=false. API 404/absent entitlement remains warming (unknown != zero). Union scrvUSD is valued through ERC4626 convertToAssets into crvUSD, not a hardcoded $1 share price.';
  data.diagnostics = data.diagnostics || {};
  data.diagnostics.defiteaUnion = {
    capability: VERSION,
    generatedAt: now,
    executionAuthority: 'none',
    wallet: DEFITEA,
    state,
    forwardingEffective,
    scrvUsdAllocationSharePct: scrvSharePct,
    entitlementStatus: entitlement?.status || (api.found === false ? 'not-published' : 'unknown'),
    unclaimedScrvUsdAmount: unionReward?.amount ?? null,
    unclaimedScrvUsdUsd: unionReward?.usdValue ?? null,
    unknownIsNotZero: true,
    claimTransactionAuthority: 'none'
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2) + '\n');
  console.log('Defitea Union scrvUSD overlay PASS', data.diagnostics.defiteaUnion);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
