from pathlib import Path

view_path=Path('reporting/canonical-earned-income-view.mjs')
s=view_path.read_text()

old="""  'historical-onchain-velodrome-twap-chainlink-at-boundary',
  'historical-onchain-slipstream-twap-chainlink-at-boundary'
]);"""
new="""  'historical-onchain-velodrome-twap-chainlink-at-boundary',
  'historical-onchain-slipstream-twap-chainlink-at-boundary',
  'historical-onchain-aerodrome-twap-chainlink-at-boundary',
  'historical-onchain-velodrome-discovered-twap-chainlink-at-boundary'
]);"""
if s.count(old)!=1:
    raise SystemExit(f'source-family allowlist anchor count {s.count(old)} != 1')
s=s.replace(old,new,1)

anchor="""  if (family === 'historical-onchain-slipstream-twap-chainlink-at-boundary') {
    if (
      resolution?.sourceStatus !== 'historical-onchain-slipstream-twap-chainlink-price' ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken0 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken1 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteToken || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteChainlinkContract || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteRoundId || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteAnsweredInRound || '')) ||
      !Number.isSafeInteger(Number(resolution?.twapSeconds)) || Number(resolution.twapSeconds) <= 0 ||
      !Number.isSafeInteger(Number(resolution?.averageTick)) ||
      resolution?.stablecoinPegAssumptionUsed !== false ||
      !finite(resolution?.quoteTokenAmount) || Number(resolution.quoteTokenAmount) <= 0 ||
      !finite(resolution?.quotePriceUsd) || Number(resolution.quotePriceUsd) <= 0
    ) return false;
    const quoteObservedMs = Date.parse(resolution?.quoteObservedAt || '');
    if (!Number.isFinite(quoteObservedMs) || quoteObservedMs !== observedMs || quoteObservedMs > blockMs) return false;
    try {
      if (BigInt(resolution.quoteRoundId) <= 0n || BigInt(resolution.quoteAnsweredInRound) < BigInt(resolution.quoteRoundId)) return false;
    } catch { return false; }
    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  return false;
}"""
replacement="""  if (family === 'historical-onchain-slipstream-twap-chainlink-at-boundary') {
    if (
      resolution?.sourceStatus !== 'historical-onchain-slipstream-twap-chainlink-price' ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken0 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken1 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteToken || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteChainlinkContract || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteRoundId || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteAnsweredInRound || '')) ||
      !Number.isSafeInteger(Number(resolution?.twapSeconds)) || Number(resolution.twapSeconds) <= 0 ||
      !Number.isSafeInteger(Number(resolution?.averageTick)) ||
      resolution?.stablecoinPegAssumptionUsed !== false ||
      !finite(resolution?.quoteTokenAmount) || Number(resolution.quoteTokenAmount) <= 0 ||
      !finite(resolution?.quotePriceUsd) || Number(resolution.quotePriceUsd) <= 0
    ) return false;
    const quoteObservedMs = Date.parse(resolution?.quoteObservedAt || '');
    if (!Number.isFinite(quoteObservedMs) || quoteObservedMs !== observedMs || quoteObservedMs > blockMs) return false;
    try {
      if (BigInt(resolution.quoteRoundId) <= 0n || BigInt(resolution.quoteAnsweredInRound) < BigInt(resolution.quoteRoundId)) return false;
    } catch { return false; }
    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  if (family === 'historical-onchain-aerodrome-twap-chainlink-at-boundary') {
    if (
      resolution?.sourceStatus !== 'historical-onchain-aerodrome-discovered-twap-chainlink-price' ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolFactory || '')) ||
      !Number.isSafeInteger(Number(resolution?.tickSpacing)) || Number(resolution.tickSpacing) <= 0 ||
      String(resolution?.routeSelection || '') !== 'highest-active-liquidity-at-historical-boundary' ||
      !Number.isSafeInteger(Number(resolution?.routeCandidateCount)) || Number(resolution.routeCandidateCount) < 1 ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken0 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken1 || '')) ||
      !/^\\d+$/.test(String(resolution?.poolLiquidity || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.rewardToken || '')) ||
      !Number.isSafeInteger(Number(resolution?.rewardTokenDecimals)) || Number(resolution.rewardTokenDecimals) < 0 || Number(resolution.rewardTokenDecimals) > 255 ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteToken || '')) ||
      String(resolution?.quoteTokenSymbol || '') !== 'USDC' ||
      !Number.isSafeInteger(Number(resolution?.twapSeconds)) || Number(resolution.twapSeconds) <= 0 ||
      !Number.isSafeInteger(Number(resolution?.averageTick)) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteChainlinkContract || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteRoundId || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteAnsweredInRound || '')) ||
      resolution?.stablecoinPegAssumptionUsed !== false ||
      !finite(resolution?.quoteTokenAmount) || Number(resolution.quoteTokenAmount) <= 0 ||
      !finite(resolution?.quotePriceUsd) || Number(resolution.quotePriceUsd) <= 0
    ) return false;
    try {
      if (BigInt(resolution.poolLiquidity) <= 0n || BigInt(resolution.quoteRoundId) <= 0n || BigInt(resolution.quoteAnsweredInRound) < BigInt(resolution.quoteRoundId)) return false;
    } catch { return false; }
    const quoteObservedMs = Date.parse(resolution?.quoteObservedAt || '');
    if (!Number.isFinite(quoteObservedMs) || quoteObservedMs !== observedMs || quoteObservedMs > blockMs) return false;
    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  if (family === 'historical-onchain-velodrome-discovered-twap-chainlink-at-boundary') {
    if (
      resolution?.sourceStatus !== 'historical-onchain-velodrome-discovered-twap-chainlink-price' ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolFactory || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken0 || '')) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.poolToken1 || '')) ||
      typeof resolution?.poolStable !== 'boolean' ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.rewardToken || '')) ||
      !Number.isSafeInteger(Number(resolution?.rewardTokenDecimals)) || Number(resolution.rewardTokenDecimals) < 0 || Number(resolution.rewardTokenDecimals) > 255 ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteToken || '')) ||
      String(resolution?.quoteTokenSymbol || '') !== 'USDC' ||
      !/^\\d+$/.test(String(resolution?.quoteAmountOutRaw || '')) ||
      !Number.isSafeInteger(Number(resolution?.twapGranularity)) || Number(resolution.twapGranularity) <= 0 ||
      !Number.isSafeInteger(Number(resolution?.observationLength)) || Number(resolution.observationLength) <= Number(resolution.twapGranularity) ||
      !/^0x[0-9a-f]{40}$/i.test(String(resolution?.quoteChainlinkContract || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteRoundId || '')) ||
      !/^\\d+$/.test(String(resolution?.quoteAnsweredInRound || '')) ||
      resolution?.stablecoinPegAssumptionUsed !== false ||
      !finite(resolution?.quoteTokenAmount) || Number(resolution.quoteTokenAmount) <= 0 ||
      !finite(resolution?.quotePriceUsd) || Number(resolution.quotePriceUsd) <= 0
    ) return false;
    try {
      if (BigInt(resolution.quoteAmountOutRaw) <= 0n || BigInt(resolution.quoteRoundId) <= 0n || BigInt(resolution.quoteAnsweredInRound) < BigInt(resolution.quoteRoundId)) return false;
    } catch { return false; }
    const quoteObservedMs = Date.parse(resolution?.quoteObservedAt || '');
    if (!Number.isFinite(quoteObservedMs) || quoteObservedMs !== observedMs || quoteObservedMs > blockMs) return false;
    const derived = round(Number(resolution.quoteTokenAmount) * Number(resolution.quotePriceUsd), 12);
    if (!finite(derived) || Math.abs(Number(derived) - Number(resolution.valuationUnitUsd)) > 0.00000002) return false;
    return true;
  }

  return false;
}"""
if s.count(anchor)!=1:
    raise SystemExit(f'historical validator anchor count {s.count(anchor)} != 1')
s=s.replace(anchor,replacement,1)

sem_old="""      exactHistoricalOnchainVelodromeTwapChainlinkResolutionAllowed: true,
      exactHistoricalOnchainSlipstreamTwapChainlinkResolutionAllowed: true,
      legacyDirectChainlinkMissingPegMetadataAccepted: true,"""
sem_new="""      exactHistoricalOnchainVelodromeTwapChainlinkResolutionAllowed: true,
      exactHistoricalOnchainSlipstreamTwapChainlinkResolutionAllowed: true,
      exactHistoricalOnchainAerodromeDiscoveredTwapChainlinkResolutionAllowed: true,
      exactHistoricalOnchainVelodromeDiscoveredTwapChainlinkResolutionAllowed: true,
      legacyDirectChainlinkMissingPegMetadataAccepted: true,"""
if s.count(sem_old)!=1:
    raise SystemExit(f'semantics anchor count {s.count(sem_old)} != 1')
s=s.replace(sem_old,sem_new,1)
view_path.write_text(s)

verify_path=Path('reporting/verify-p5-discovered-valuation-admission.mjs')
v=verify_path.read_text()
import_old="import { historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';"
import_new=import_old+"\nimport { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';"
if v.count(import_old)!=1 or 'buildCanonicalEarnedIncomeView' in v:
    raise SystemExit('verification import anchor drift')
v=v.replace(import_old,import_new,1)

proof_anchor="""assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.stablecoinPegAssumptionUsed===false),true);

const badAero="""
proof_insert="""assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.stablecoinPegAssumptionUsed===false),true);

const canonicalLedger=events=>({
  version:'0.1-canonical-income-ledger',
  generatedAt:'2026-09-14T00:00:00.000Z',
  semantics:{unknownIsNotZero:true,referenceAprCanBackfillEarnedIncome:false},
  events
});
const canonicalView=buildCanonicalEarnedIncomeView(canonicalLedger(resolved.ledger.events));
assert.equal(canonicalView.recognized.length,2);
assert.equal(canonicalView.unresolved.length,0);
assert.deepEqual(canonicalView.recognized.map(x=>x.usdValue),[6,12]);
assert.equal(canonicalView.semantics.exactHistoricalOnchainAerodromeDiscoveredTwapChainlinkResolutionAllowed,true);
assert.equal(canonicalView.semantics.exactHistoricalOnchainVelodromeDiscoveredTwapChainlinkResolutionAllowed,true);

for(const [label,mutate] of [
  ['wrong-block',event=>{event.valuationResolution.sourceBlockNumber+=1;}],
  ['explicit-peg',event=>{event.valuationResolution.stablecoinPegAssumptionUsed=true;}],
  ['wrong-route-factory',event=>{event.valuationResolution.poolFactory='0xdddddddddddddddddddddddddddddddddddddddd';}]
]){
  const bad=structuredClone(resolved.ledger.events[0]);
  mutate(bad);
  const view=buildCanonicalEarnedIncomeView(canonicalLedger([bad]));
  assert.equal(view.recognized.length,0,`${label} must not be recognized`);
  assert.equal(view.unresolved.length,1,`${label} must remain unresolved`);
  assert.equal(view.unresolved[0].reason,'canonical-event-usd-valuation-incomplete');
}
const badVeloConsumer=structuredClone(resolved.ledger.events[1]);
badVeloConsumer.valuationResolution.quoteAmountOutRaw='0';
const badVeloView=buildCanonicalEarnedIncomeView(canonicalLedger([badVeloConsumer]));
assert.equal(badVeloView.recognized.length,0);
assert.equal(badVeloView.unresolved[0]?.reason,'canonical-event-usd-valuation-incomplete');

const badAero="""
if v.count(proof_anchor)!=1:
    raise SystemExit(f'verification insertion anchor count {v.count(proof_anchor)} != 1')
v=v.replace(proof_anchor,proof_insert,1)

log_old="""  stablecoinPegAssumptionUsed:false,
  executionAuthority:'none'
});"""
log_new="""  stablecoinPegAssumptionUsed:false,
  canonicalConsumerRecognizedDiscoveredValuations:true,
  malformedConsumerProofFailsClosed:true,
  executionAuthority:'none'
});"""
if v.count(log_old)!=1:
    raise SystemExit(f'verification log anchor count {v.count(log_old)} != 1')
v=v.replace(log_old,log_new,1)
verify_path.write_text(v)
