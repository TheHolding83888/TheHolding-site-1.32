#!/usr/bin/env node
import assert from 'node:assert/strict';
import { historicalOptimismVelodromeTwapRouteForToken } from './historical-canonical-price.mjs';
import {
  historicalValuationSourceValid,
  resolvedUsdValue,
  recognitionDecision
} from './canonical-earned-income-view.mjs';
import { historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';

const tarotToken='0x1F514A61bcde34F94Bc39731235690ab9da737F7';
const holder='0xefda6d86c6ea8bb80cf6456214432d45f14d06d4';
const rewardContract='0x19762e856e189d7569ab1440f26082c232bfec70';
const openingBlock=154971811;
const closingBlock=156311011;
const boundaryAt='2026-09-01T00:00:00.000Z';
const blockTimestamp='2026-08-31T23:59:58.000Z';
const observedAt='2026-08-31T23:55:00.000Z';
const route=historicalOptimismVelodromeTwapRouteForToken(tarotToken);

assert.ok(route,'canonical TAROT historical route missing');
assert.equal(route.poolStable,false,'TAROT canonical route must remain the proven volatile pool');

const lane=`velodrome|defitea.eth|${holder}|32671|voting-reward|${rewardContract}|${tarotToken.toLowerCase()}`;
const amount=0.008384424073;
const quoteTokenAmount=0.0295;
const quotePriceUsd=0.9999;
const valuationUnitUsd=quoteTokenAmount*quotePriceUsd;
const event={
  eventKey:`ve33:${lane}:${openingBlock}:${closingBlock}`,
  company:'defitea.eth',
  family:'accrued-entitlement',
  route:'velodrome-ve',
  protocol:'Velodrome',
  chain:'Optimism',
  chainId:10,
  economicDate:'2026-08-31',
  periodStart:'2026-08-01T00:00:00.000Z',
  periodEnd:boundaryAt,
  asset:'TAROT',
  token:tarotToken,
  amount,
  usdValue:null,
  sourceFile:'reporting/ve33-accounting-evidence.json',
  sourceIdentity:`${lane}|${openingBlock}->${lane}|${closingBlock}`,
  unknownIsNotZero:true,
  executionAuthority:'none',
  immutableEconomicFieldsHash:'volatile-tarot-regression-sentinel'
};

const valuationResolution={
  version:'0.1-canonical-historical-valuation-resolution',
  resolvesUsdValue:true,
  economicFieldsMutated:false,
  referenceAprUsed:false,
  currentPriceUsed:false,
  unknownIsNotZero:true,
  executionAuthority:'none',
  originalUsdValue:null,
  boundaryAt,
  observedAt,
  valuationUnitUsd,
  resolvedUsdValue:amount*valuationUnitUsd,
  sourceFamily:'historical-onchain-velodrome-twap-chainlink-at-boundary',
  sourceStatus:'historical-onchain-velodrome-twap-chainlink-price',
  sourceChainId:10,
  sourceBlockNumber:closingBlock,
  sourceBlockTimestamp:blockTimestamp,
  exactHistoricalBlock:true,
  sourceContract:route.pool,
  quoteToken:route.quoteToken,
  quoteChainlinkContract:route.quoteChainlinkFeed,
  quoteRoundId:'42',
  quoteAnsweredInRound:'42',
  quoteObservedAt:observedAt,
  twapGranularity:route.twapGranularity,
  observationLength:200,
  poolStable:false,
  stablecoinPegAssumptionUsed:false,
  quoteTokenAmount,
  quotePriceUsd,
  identityBound:true,
  identityToken:tarotToken.toLowerCase()
};

const resolved={...event,valuationResolution};
const boundaryMs=Date.parse(boundaryAt);
const observedMs=Date.parse(observedAt);
assert.equal(historicalValuationSourceMatchesVe33Identity(resolved,valuationResolution),true,'canonical volatile TAROT route must match immutable ve33 identity');
assert.equal(historicalValuationSourceValid(resolved,valuationResolution,boundaryMs,observedMs),true,'owner-facing validator must accept the canonical volatile TAROT proof');
assert.ok(Number(resolvedUsdValue(resolved))>0,'canonical volatile TAROT proof must resolve a positive USD value');
assert.equal(recognitionDecision(resolved).status,'recognized','canonical volatile TAROT event must be owner-facing recognized income');

const wrongPoolType={...valuationResolution,poolStable:true};
assert.equal(historicalValuationSourceMatchesVe33Identity({...event,valuationResolution:wrongPoolType},wrongPoolType),false,'wrong stable/volatile pool identity must fail closed');
assert.equal(resolvedUsdValue({...event,valuationResolution:wrongPoolType}),null,'wrong stable/volatile pool identity must not resolve USD');

console.log('ve33 volatile TAROT historical valuation regression PASS');
