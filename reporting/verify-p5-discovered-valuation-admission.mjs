#!/usr/bin/env node
import assert from 'node:assert/strict';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';
import {
  AERODROME_SLIPSTREAM_FACTORIES,
  CANONICAL_TICK_SPACINGS,
  BASE_NATIVE_USDC,
  DEFAULT_TWAP_SECONDS
} from './historical-aerodrome-usdc-route.mjs';
import {
  BASE_NATIVE_USDC_CHAINLINK_FEED,
  BASE_AERO_TOKEN,
  BASE_AERO_CHAINLINK_FEED
} from './historical-aerodrome-discovered-price.mjs';
import {
  OPTIMISM_VELODROME_V2_FACTORY,
  OPTIMISM_NATIVE_USDC,
  DEFAULT_TWAP_GRANULARITY
} from './historical-velodrome-usdc-route.mjs';
import { OPTIMISM_NATIVE_USDC_CHAINLINK_FEED } from './historical-velodrome-discovered-price.mjs';

const boundaryAt='2026-09-01T00:00:00.000Z';
const observedAt='2026-08-31T23:58:30.000Z';
const blockAt='2026-08-31T23:59:00.000Z';
const wallet='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const rewardContract='0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const pool='0xcccccccccccccccccccccccccccccccccccccccc';
const AERO_USDC_REWARD_TOKEN='0x1111111111111111111111111111111111111111';
const VELO_TOKEN='0x2222222222222222222222222222222222222222';
const AERO_QUOTE_REWARD_TOKEN='0x3333333333333333333333333333333333333333';

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

const aeroUsdcEvent=event('aerodrome',AERO_USDC_REWARD_TOKEN,8453);
const aeroQuoteEvent=event('aerodrome',AERO_QUOTE_REWARD_TOKEN,8453);
const veloEvent=event('velodrome',VELO_TOKEN,10);

function aeroUsdcProof(){return {
  ok:true,status:'historical-onchain-aerodrome-discovered-twap-chainlink-price',
  sourceFamily:'historical-onchain-aerodrome-twap-chainlink-at-boundary',assetId:null,priceUsd:2,
  observedAt,chainId:8453,sourceBlockNumber:200,sourceBlockTimestamp:blockAt,sourceContract:pool,rpcEndpointId:'test',
  exactHistoricalBlock:true,poolFactory:AERODROME_SLIPSTREAM_FACTORIES[0],tickSpacing:CANONICAL_TICK_SPACINGS[0],
  routeSelection:'highest-active-liquidity-at-historical-boundary',routeCandidateCount:1,poolToken0:AERO_USDC_REWARD_TOKEN,poolToken1:BASE_NATIVE_USDC,
  poolLiquidity:'1000',rewardToken:AERO_USDC_REWARD_TOKEN,rewardTokenDecimals:18,quoteToken:BASE_NATIVE_USDC,quoteTokenSymbol:'USDC',
  quoteTokenAmount:2,twapSeconds:DEFAULT_TWAP_SECONDS,averageTick:0,quoteChainlinkContract:BASE_NATIVE_USDC_CHAINLINK_FEED,
  quoteRoundId:'1',quoteAnsweredInRound:'1',quoteObservedAt:observedAt,quotePriceUsd:1,
  sourceFile:'reporting/historical-aerodrome-discovered-price.mjs',stablecoinPegAssumptionUsed:false,currentPriceUsed:false,
  referenceAprUsed:false,executionAuthority:'none'
};}

function aeroQuoteProof(){return {
  ok:true,status:'historical-onchain-aerodrome-discovered-twap-chainlink-price',
  sourceFamily:'historical-onchain-aerodrome-twap-chainlink-at-boundary',assetId:null,priceUsd:1,
  observedAt,chainId:8453,sourceBlockNumber:200,sourceBlockTimestamp:blockAt,sourceContract:pool,rpcEndpointId:'test',
  exactHistoricalBlock:true,poolFactory:AERODROME_SLIPSTREAM_FACTORIES[0],tickSpacing:CANONICAL_TICK_SPACINGS[0],
  routeSelection:'highest-active-liquidity-at-historical-boundary',routeCandidateCount:1,poolToken0:AERO_QUOTE_REWARD_TOKEN,poolToken1:BASE_AERO_TOKEN,
  poolLiquidity:'900',rewardToken:AERO_QUOTE_REWARD_TOKEN,rewardTokenDecimals:18,quoteToken:BASE_AERO_TOKEN,quoteTokenSymbol:'AERO',
  quoteTokenAmount:2,twapSeconds:DEFAULT_TWAP_SECONDS,averageTick:0,quoteChainlinkContract:BASE_AERO_CHAINLINK_FEED,
  quoteRoundId:'2',quoteAnsweredInRound:'2',quoteObservedAt:observedAt,quotePriceUsd:0.5,
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

const proofByToken=new Map([
  [AERO_USDC_REWARD_TOKEN.toLowerCase(),aeroUsdcProof()],
  [AERO_QUOTE_REWARD_TOKEN.toLowerCase(),aeroQuoteProof()],
  [VELO_TOKEN.toLowerCase(),veloProof()]
]);
const resolved=await annotateHistoricalValuationResolution({events:[aeroUsdcEvent,aeroQuoteEvent,veloEvent]}, {
  resolver:async ({token})=>structuredClone(proofByToken.get(String(token).toLowerCase()))
});
assert.equal(resolved.eligibleEventCount,3);
assert.equal(resolved.resolvedEventCount,3);
assert.equal(resolved.unresolvedEventCount,0);
assert.equal(resolved.ledger.events[0].valuationResolution?.resolvedUsdValue,6);
assert.equal(resolved.ledger.events[1].valuationResolution?.resolvedUsdValue,3);
assert.equal(resolved.ledger.events[2].valuationResolution?.resolvedUsdValue,12);
assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.exactHistoricalBlock===true),true);
assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.currentPriceUsed===false),true);
assert.equal(resolved.ledger.events.every(x=>x.valuationResolution?.stablecoinPegAssumptionUsed===false),true);

const badAero={...aeroUsdcProof(),poolFactory:'0xdddddddddddddddddddddddddddddddddddddddd'};
const badResolved=await annotateHistoricalValuationResolution({events:[aeroUsdcEvent]}, {resolver:async()=>badAero});
assert.equal(badResolved.resolvedEventCount,0);
assert.equal(badResolved.unresolvedEventCount,1);
assert.equal(badResolved.unresolvedStatuses['historical-valuation-source-identity-mismatch'],1);

const badQuoteFeed={...aeroQuoteProof(),quoteChainlinkContract:BASE_NATIVE_USDC_CHAINLINK_FEED};
const badQuoteResolved=await annotateHistoricalValuationResolution({events:[aeroQuoteEvent]}, {resolver:async()=>badQuoteFeed});
assert.equal(badQuoteResolved.resolvedEventCount,0);
assert.equal(badQuoteResolved.unresolvedEventCount,1);
assert.equal(badQuoteResolved.unresolvedStatuses['historical-valuation-source-identity-mismatch'],1);

assert.equal(historicalValuationSourceMatchesVe33Identity(aeroUsdcEvent,{...resolved.ledger.events[0].valuationResolution,sourceChainId:10}),false);
assert.equal(historicalValuationSourceMatchesVe33Identity(aeroQuoteEvent,{...resolved.ledger.events[1].valuationResolution,quoteToken:BASE_NATIVE_USDC}),false);
assert.equal(historicalValuationSourceMatchesVe33Identity(veloEvent,{...resolved.ledger.events[2].valuationResolution,quoteToken:BASE_NATIVE_USDC}),false);

console.log('P5 discovered historical valuation admission PASS',{
  resolved:resolved.resolvedEventCount,
  approvedAerodromeQuotes:['USDC','AERO'],
  badFactoryFailsClosed:badResolved.unresolvedEventCount===1,
  wrongQuoteFeedFailsClosed:badQuoteResolved.unresolvedEventCount===1,
  wrongChainFailsClosed:true,
  wrongQuoteTokenFailsClosed:true,
  currentPriceUsed:false,
  stablecoinPegAssumptionUsed:false,
  executionAuthority:'none'
});
