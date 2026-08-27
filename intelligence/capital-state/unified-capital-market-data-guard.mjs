#!/usr/bin/env node
/**
 * Unified Capital · canonical Market Data consumer guard v0.1
 *
 * Accepts the canonical per-asset authority contract produced by Market Data:
 * onchain is primary, a bounded CoinGecko lane is allowed only as explicit
 * fallback, and UNKNOWN is never accepted. ICP remains onchain-required for
 * the existing Company #005/#006 capital parity proof.
 *
 * Read-only validation only. No execution, wallet, dispatch, or methodology
 * mutation authority.
 */
import fs from 'node:fs';

const path = process.argv[2] || 'intelligence/market-data/market-data.json';
const m = JSON.parse(fs.readFileSync(path, 'utf8'));
const prices = m.prices || {};
const entries = Object.entries(prices);
const count = entries.length;

function assert(ok, message) {
  if (!ok) throw new Error(message);
}

assert(m.semantics?.perAssetAuthoritySelectionApplied === true, 'Unified Capital refuses non-materialized Market Data');
assert(count === 26, `Canonical Market Data asset count mismatch: ${count}`);
assert(Number(m.authority?.unknownCount) === 0, 'Canonical Market Data contains UNKNOWN assets');
assert(
  Number(m.authority?.onchainSelectedAssetCount) + Number(m.authority?.coingeckoSelectedAssetCount) === count,
  'Canonical Market Data selected-lane coverage mismatch'
);

for (const [id, row] of entries) {
  const lane = row?.authority?.selectedLane;
  assert(row?.authority?.requestedPrimary === 'onchain', `${id}: onchain-primary request contract missing`);
  assert(['onchain', 'coingecko-lane'].includes(lane), `${id}: invalid canonical selected lane`);
  assert(Number.isFinite(Number(row?.usd)) && Number(row.usd) > 0, `${id}: finite positive canonical price unavailable`);
  if (lane === 'onchain') {
    assert(row.authority?.fallbackUsed === false, `${id}: onchain row cannot be marked fallback`);
    assert(String(row?.source || '').startsWith('onchain-'), `${id}: onchain provenance missing`);
  } else {
    assert(row.authority?.fallbackUsed === true, `${id}: CoinGecko lane is allowed only as explicit fallback`);
  }
}

const icp = prices['internet-computer'];
assert(
  icp?.authority?.selectedLane === 'onchain' &&
  icp?.authority?.fallbackUsed === false &&
  String(icp?.source || '').startsWith('onchain-') &&
  Number(icp?.usd) > 0,
  'ICP canonical onchain price unavailable'
);

assert(m.authority?.executionAuthority === 'none', 'Market Data execution authority drift');
assert(m.authority?.capitalExecution === false, 'Market Data capital execution authority drift');
assert(m.authority?.policyMutationAuthority === false, 'Market Data policy mutation authority drift');

console.log('Unified Capital canonical Market Data consumer contract PASS', {
  generatedAt: m.generatedAt,
  assetCount: count,
  onchainSelectedAssetCount: Number(m.authority?.onchainSelectedAssetCount),
  coingeckoFallbackAssetCount: Number(m.authority?.coingeckoSelectedAssetCount),
  unknownCount: Number(m.authority?.unknownCount),
  icpUsd: Number(icp.usd),
  icpSource: icp.source
});
