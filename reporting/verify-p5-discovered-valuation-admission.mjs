#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';
import {
  AERODROME_SLIPSTREAM_FACTORIES,
  CANONICAL_TICK_SPACINGS,
  BASE_NATIVE_USDC,
  DEFAULT_TWAP_SECONDS
} from './historical-aerodrome-usdc-route.mjs';
import {
  OPTIMISM_VELODROME_V2_FACTORY,
  OPTIMISM_NATIVE_USDC,
  DEFAULT_TWAP_GRANULARITY
} from './historical-velodrome-usdc-route.mjs';
import { BASE_NATIVE_USDC_CHAINLINK_FEED } from './historical-aerodrome-discovered-price.mjs';
import { OPTIMISM_NATIVE_USDC_CHAINLINK_FEED } from './historical-velodrome-discovered-price.mjs';

const boundaryAt='2026-09-01T00:00:00.000Z';
const observedAt='2026-08-31T23:58:30.000Z';
const blockAt='2026-08-31T23:59:00.000Z';
const wallet='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const rewardContract='0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const pool='0xcccccccccccccccccccccccccccccccccccccccc';
const AERO_TOKEN='0x1111111111111111111111111111111111111111';
const VELO_TOKEN='0x2222222222222222222222222222222222222222';

function event(protocol,token,chainId){
  const lane=`${protocol}|Synthetic.eth|${wallet}|123|voting-reward|${rewardContract}|${token}`;
  return {
    eventKey:`ve33:${lane}:100:200`,
    company:'Synthetic.eth',family:'accrued-entitlement',protocol:protocol==='aerodrome'?'Aerodrome':'Velodrome',
    route:protocol==='aerodrome'?'aerodrome-ve':'velodrome-ve',chainId,token,asset:'TEST',amount:3,
    usdValue:null,valuationStatus:'unvalued-fail-closed',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:boundaryAt,
    sourceIdentity:`${lane}|100->${lane}|200`,sourceFile:'reporting/ve33-accounting-evidence.json',
    unknownIsNotZero:true,executionAuthority:'none'
  };
}

const aeroEvent=event('aerodrome',AERO_TOKEN,8453);
const veloEvent=event('velodrome',VELO_TOKEN,10);

function aeroProof(){return {
  ok:true,status:'historical-onchain-aerodrome-discovered-twap-chainlink-price',
  sourceFamily:'historical-onchain-aerodrome-twap-chainlink-at-boundary',assetId:null,priceUsd:2,
  observedAt,chainId:8453,sourceBlockNumber:200,sourceBlockTimestamp:blockAt,sourceContract:pool,rpcEndpointId:'test',
  exactHistoricalBlock:true,poolFactory:AERODROME_SLIPSTREAM_FACTORIES[0],tickSpacing:CANONICAL_TICK_SPACINGS[0],
  routeSelection:'highest-active-liquidity-at-historical-boundary',routeCandidateCount:1,poolToken0:AERO_TOKEN,poolToken1:BASE_NATIVE_USDC,
  poolLiquidity:'1000',rewardToken:AERO_TOKEN,rewardTokenDecimals:18,quoteToken:BASE_NATIVE_USDC,quoteTokenSymbol:'USDC',
  quoteTokenAmount:2,twapSeconds:DEFAULT_TWAP_SECONDS,averageTick:0,quoteChainlinkContract:BASE_NATIVE_USDC_CHAINLINK_FEED,
  quoteRoundId:'1',quoteAnsweredInRound:'1',quoteObservedAt:observedAt,quotePriceUsd:1,
  sourceFile:'reporting/historical-aerodrome-discovered-price.mjs',stablecoinPegAssumptionUsed:false,currentPriceUsed:false,
  referenceAprUsed:false,executionAuthority:'none'
};}

function veloProof(){return {
  ok:true,status:'historical-onchain-velodrome-discovered-twap-chainlink-price',
  sourceFamily:'historical-onchain-velodrome-discovered-twap-chainlink-at-boundary',assetId:null,priceUsd:4,
  observedAt,chainId:10,sourceBlockNumber:200,sourceBlockTimestamp:blockAt,sourceContract:pool,rpcEndpointId:'test',
  exactHistoricalBlock:true,poolFactory:OPTIMISM_VELODROME_V2_FACTORY,poolStable:false,poolToken0:VELO_TOKEN,poolToken1:OPTIMISM_NATIVE_USDC,
  rewardToken:VELO_TOKEN,rewardTokenDecimals:18,quoteToken:OPTIMISM_NATIVE_USDC,quoteTokenSymbol:'USDC',quoteAmountOutRaw:'4000000',
  quoteTokenAmount:4,twapGranularity:DEFAULT_TWAP_GRANULARITY,observationLength:DEFAULT_TWAP_GRANULARITY+5,
  quoteChainlinkContract:OPTIMISM_NATIVE_USDC_CHAINLINK_FEED,quoteRoundId:'1',quoteAnsweredInRound:'1',quoteObservedAt:observedAt,
  quotePriceUsd:1,sourceFile:'reporting/historical-velodrome-discovered-price.mjs',stablecoinPegAssumptionUsed:false,currentPriceUsed:false,
  referenceAprUsed:false,executionAuthority:'none'
};}

const proofByToken=new Map([[AERO_TOKEN.toLowerCase(),aeroProof()],[VELO_TOKEN.toLowerCase(),veloProof()]]);
const resolved=await annotateHistoricalValuationResolution({events:[aeroEvent,veloEvent]}, {
  resolver:async ({token})=>structuredClone(proofByToken.get(String(token).toLowerCase()))
});
assert.equal(resolved.eligibleEventCount,2);
assert.equal(resolved.resolvedEventCount,2);
assert.equal(resolved.unresolvedEventCount,0);
assert.equal(resolved.ledger.events[0].valuationResolution?.resolvedUsdValue,6);
assert.equal(resolved.ledger.events[1].valuationResolution?.resolvedUsdValue,12);
assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.exactHistoricalBlock===true),true);
assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.currentPriceUsed===false),true);
assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.stablecoinPegAssumptionUsed===false),true);

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

const badAero={...aeroProof(),poolFactory:'0xdddddddddddddddddddddddddddddddddddddddd'};
const badResolved=await annotateHistoricalValuationResolution({events:[aeroEvent]}, {resolver:async()=>badAero});
assert.equal(badResolved.resolvedEventCount,0);
assert.equal(badResolved.unresolvedEventCount,1);
assert.equal(badResolved.unresolvedStatuses['historical-valuation-source-identity-mismatch'],1);

assert.equal(historicalValuationSourceMatchesVe33Identity(aeroEvent,{...resolved.ledger.events[0].valuationResolution,sourceChainId:10}),false);
assert.equal(historicalValuationSourceMatchesVe33Identity(veloEvent,{...resolved.ledger.events[1].valuationResolution,quoteToken:BASE_NATIVE_USDC}),false);

// Temporary read-only production diagnostic: expose only the unresolved target
// events that currently keep the P5 final audit actionable. This is removed
// once the exact failure class is identified.
const liveLedger=JSON.parse(await fs.readFile('reporting/income-ledger.json','utf8'));
const liveView=buildCanonicalEarnedIncomeView(liveLedger);
const targetUnresolved=(liveView.unresolved||[])
  .filter(row=>String(row?.company||'')==='aerocvxyb.eth')
  .map(row=>({
    eventKey:row.eventKey||null,
    company:row.company||null,
    family:row.family||null,
    protocol:row.protocol||null,
    route:row.route||null,
    chainId:row.chainId??null,
    token:row.token||null,
    asset:row.asset||null,
    amount:row.amount??null,
    usdValue:row.usdValue??null,
    economicDate:row.economicDate||null,
    periodStart:row.periodStart||null,
    periodEnd:row.periodEnd||null,
    reason:row.reason||null,
    valuationStatus:row.valuationStatus||null,
    valuationResolution:row.valuationResolution||null,
    sourceIdentity:row.sourceIdentity||null,
    sourceFile:row.sourceFile||null
  }));
console.log('P5 TARGET unresolved aerocvxyb.eth',JSON.stringify(targetUnresolved,null,2));

console.log('P5 discovered historical valuation admission PASS',{
  resolved:resolved.resolvedEventCount,
  badFactoryFailsClosed:badResolved.unresolvedEventCount===1,
  wrongChainFailsClosed:true,
  wrongQuoteTokenFailsClosed:true,
  currentPriceUsed:false,
  stablecoinPegAssumptionUsed:false,
  canonicalConsumerRecognizedDiscoveredValuations:true,
  malformedConsumerProofFailsClosed:true,
  executionAuthority:'none'
});
