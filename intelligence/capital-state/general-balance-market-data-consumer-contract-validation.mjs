import fs from 'node:fs';

const source = fs.readFileSync('intelligence/capital-state/general-company-balance-sheet.mjs', 'utf8');
const market = JSON.parse(fs.readFileSync('intelligence/market-data/market-data.json', 'utf8'));

function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}

requireCondition(market.semantics?.perAssetAuthoritySelectionApplied === true, 'Current Market Data is not canonical per-asset authority');
requireCondition(Object.keys(market.prices || {}).length === 26, 'Current Market Data asset count drift');
requireCondition(Number(market.authority?.unknownCount) === 0, 'Current Market Data contains UNKNOWN assets');
const onchainSelectedAssetCount = Number(market.authority?.onchainSelectedAssetCount);
const coingeckoSelectedAssetCount = Number(market.authority?.coingeckoSelectedAssetCount);
requireCondition(Number.isFinite(onchainSelectedAssetCount) && onchainSelectedAssetCount >= 0, 'Current Market Data onchain lane count invalid');
requireCondition(Number.isFinite(coingeckoSelectedAssetCount) && coingeckoSelectedAssetCount >= 0, 'Current Market Data fallback lane count invalid');
requireCondition(onchainSelectedAssetCount + coingeckoSelectedAssetCount === 26, 'Current Market Data lane coverage drift');
requireCondition(Number(market.coverage?.usableCoverage) === 1, 'Current physical Market Data is not fully usable');

requireCondition(!source.includes('general balance sheet requires 26/26 onchain-selected production Market Data'), 'Legacy 26/26 onchain-only General Balance blocker is still present');
requireCondition(source.includes("Number(market?.authority?.unknownCount)!==0"), 'General Balance UNKNOWN fail-closed guard missing');
requireCondition(source.includes('onchainCount+fallbackCount!==entries.length'), 'General Balance complete selected-lane coverage guard missing');
requireCondition(source.includes("Number(market?.coverage?.usableCoverage)!==1"), 'General Balance usableCoverage fail-closed guard missing');
requireCondition(source.includes("!['onchain','coingecko-lane'].includes(lane)"), 'General Balance bounded canonical lane allowlist missing');
requireCondition(source.includes("row?.authority?.requestedPrimary!=='onchain'"), 'General Balance onchain-primary request guard missing');
requireCondition(source.includes("row?.authority?.fallbackUsed!==false"), 'General Balance onchain non-fallback provenance guard missing');
requireCondition(source.includes("row?.authority?.fallbackUsed!==true"), 'General Balance explicit fallback marker guard missing');
requireCondition(source.includes("canonical-shared-market-data-coingecko-fallback"), 'General Balance shared fallback provenance label missing');
requireCondition(source.includes("canonical-shared-market-data-onchain"), 'General Balance shared onchain provenance label missing');
requireCondition(source.includes("executionAuthority:'none'"), 'General Balance executionAuthority boundary missing');

for (const [id, row] of Object.entries(market.prices || {})) {
  const lane = row?.authority?.selectedLane;
  requireCondition(row?.authority?.requestedPrimary === 'onchain', `${id}: current onchain-primary request missing`);
  requireCondition(['onchain', 'coingecko-lane'].includes(lane), `${id}: current selected lane invalid`);
  requireCondition(Number.isFinite(Number(row?.usd)) && Number(row.usd) > 0, `${id}: current canonical price invalid`);
  if (lane === 'onchain') {
    requireCondition(row.authority?.fallbackUsed === false && String(row.source || '').startsWith('onchain-'), `${id}: current onchain provenance invalid`);
  } else {
    requireCondition(row.authority?.fallbackUsed === true, `${id}: current CoinGecko fallback marker missing`);
  }
}

console.log('General Balance per-asset Market Data consumer regression contract PASS', {
  assetCount: 26,
  onchainSelectedAssetCount,
  coingeckoFallbackAssetCount: coingeckoSelectedAssetCount,
  unknownCount: Number(market.authority.unknownCount),
  usableCoverage: Number(market.coverage.usableCoverage),
  currentCanonicalLaneMixAccepted: true,
  oldOnchainOnlyBlockerRemoved: true,
  unknownStillFailsClosed: true,
  executionAuthority: 'none'
});
