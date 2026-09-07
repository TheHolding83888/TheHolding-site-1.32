#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,HISTORICAL_TOKEN_ASSET_IDS,HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS,
  canonicalAssetIdForHistoricalToken,historicalOptimismChainlinkRouteForToken,closingBlockFromVe33Identity,
  selectHistoricalCanonicalPrice,historicalCanonicalPriceAtBoundary
} from './historical-canonical-price.mjs';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { recognitionDecision, resolvedUsdValue } from './canonical-earned-income-view.mjs';
import { ve33EventIdentity, historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';

assert.equal(VERSION,'0.2-historical-canonical-market-or-exact-chainlink-price');
assert.equal(Object.keys(HISTORICAL_TOKEN_ASSET_IDS).length,4);
assert.equal(Object.keys(HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS).length,4);
assert.equal(canonicalAssetIdForHistoricalToken('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),'aerodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db'),'velodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x4200000000000000000000000000000000000006'),'ethereum');
assert.equal(canonicalAssetIdForHistoricalToken('0x68f180fcCe6836688e9084f035309E29Bf0A2095'),'bitcoin');
assert.equal(canonicalAssetIdForHistoricalToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'),null);
assert.equal(canonicalAssetIdForHistoricalToken('0x1111111111111111111111111111111111111111'),null);
assert.equal(historicalOptimismChainlinkRouteForToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85')?.assetId,'usd-coin');
assert.equal(historicalOptimismChainlinkRouteForToken('0x4200000000000000000000000000000000000042')?.assetId,'optimism');
assert.equal(historicalOptimismChainlinkRouteForToken('0x94b008aa00579c1307B0ef2c499ad98a8ce58e58')?.assetId,'tether');
assert.equal(historicalOptimismChainlinkRouteForToken('0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb')?.assetId,'wrapped-steth');
assert.equal(historicalOptimismChainlinkRouteForToken('0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0'),null);
assert.equal(closingBlockFromVe33Identity({eventKey:'ve33:synthetic:154971811:156311011'}),156311011);
assert.equal(closingBlockFromVe33Identity({sourceIdentity:'lane|154971811->lane|156311011'}),156311011);
assert.equal(closingBlockFromVe33Identity({eventKey:'ve33:synthetic:no-block'}),null);

const snapshot={
  version:'1.2-market-data-truthful-canonical-provenance',
  generatedAt:'2026-08-31T23:52:57.601Z',
  observedAt:'2026-08-31T23:52:53.619Z',
  status:'ok',
  prices:{
    bitcoin:{assetId:'bitcoin',symbol:'BTC',providerId:'bitcoin',usd:78537.9,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'},
    ethereum:{assetId:'ethereum',symbol:'ETH',providerId:'ethereum',usd:2466.06838126,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'},
    'aerodrome-finance':{assetId:'aerodrome-finance',symbol:'AERO',providerId:'aerodrome-finance',usd:0.47301682,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'},
    'velodrome-finance':{assetId:'velodrome-finance',symbol:'VELO',providerId:'velodrome-finance',usd:0.021860940606858108,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-velodrome-v2-twap-relative'}
  }
};

const aero=selectHistoricalCanonicalPrice({snapshot,token:'0x940181a94A35A4569E4529a3cdfb74e38fd98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(aero.ok,true);assert.equal(aero.assetId,'aerodrome-finance');assert.equal(aero.priceUsd,0.47301682);assert.equal(aero.observedAt,'2026-08-31T23:52:53.619Z');assert.ok(aero.ageMinutes>7&&aero.ageMinutes<8);
const velo=selectHistoricalCanonicalPrice({snapshot,token:'0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(velo.ok,true);assert.equal(velo.assetId,'velodrome-finance');assert.equal(velo.priceUsd,0.021860940606858108);
const weth=selectHistoricalCanonicalPrice({snapshot,token:'0x4200000000000000000000000000000000000006',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(weth.ok,true);assert.equal(weth.assetId,'ethereum');assert.equal(weth.priceUsd,2466.06838126);assert.equal(weth.priceSource,'onchain-chainlink-v3');
const wbtc=selectHistoricalCanonicalPrice({snapshot,token:'0x68f180fcCe6836688e9084f035309E29Bf0A2095',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(wbtc.ok,true);assert.equal(wbtc.assetId,'bitcoin');assert.equal(wbtc.priceUsd,78537.9);assert.equal(wbtc.priceSource,'onchain-chainlink-v3');
const unsupportedStable=selectHistoricalCanonicalPrice({snapshot,token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(unsupportedStable.ok,false);assert.equal(unsupportedStable.status,'token-not-canonical-market-data-mapped');
const unknown=selectHistoricalCanonicalPrice({snapshot,token:'0x1111111111111111111111111111111111111111',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(unknown.ok,false);assert.equal(unknown.status,'token-not-canonical-market-data-mapped');
const tooOld=selectHistoricalCanonicalPrice({snapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T01:00:00.000Z',maxAgeMinutes:25});
assert.equal(tooOld.ok,false);assert.equal(tooOld.status,'canonical-price-too-old-for-accounting-boundary');
const futureSnapshot=structuredClone(snapshot);futureSnapshot.prices['aerodrome-finance'].observedAt='2026-09-01T00:00:01.000Z';
const future=selectHistoricalCanonicalPrice({snapshot:futureSnapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(future.ok,false);assert.equal(future.status,'canonical-price-observed-after-accounting-boundary');
const unknownStatus=structuredClone(snapshot);unknownStatus.prices['aerodrome-finance'].status='unknown';
const unusable=selectHistoricalCanonicalPrice({snapshot:unknownStatus,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(unusable.ok,false);assert.equal(unusable.status,'canonical-price-status-not-usable');

// Deterministic exact-block Chainlink proof: every feed read must be pinned to
// the already-proven ve33 closing block, never "latest" or a current price.
const chainlinkBoundary='2026-09-01T00:00:00.000Z';
const chainlinkBoundarySeconds=Math.floor(Date.parse(chainlinkBoundary)/1000);
const chainlinkOpeningBlock=154971811;
const chainlinkClosingBlock=156311011;
const chainlinkBlockTag=`0x${BigInt(chainlinkClosingBlock).toString(16)}`;
const abiWord=value=>BigInt(value).toString(16).padStart(64,'0');
const encodeRoundData=({roundId,answer,startedAt,updatedAt,answeredInRound})=>`0x${abiWord(roundId)}${abiWord(answer)}${abiWord(startedAt)}${abiWord(updatedAt)}${abiWord(answeredInRound)}`;
const optimismTestRegistry={networks:{optimism:{chainId:10,rpcFailover:[{id:'test-optimism',url:'https://optimism.example'}]}}};
function chainlinkRpc({answer=99990000n,updatedAt=BigInt(chainlinkBoundarySeconds-300),blockTimestamp=chainlinkBoundarySeconds-2}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-optimism');
    if(method==='eth_getBlockByNumber'){
      assert.equal(params[0],chainlinkBlockTag);assert.equal(params[1],false);
      return{number:chainlinkBlockTag,timestamp:`0x${BigInt(blockTimestamp).toString(16)}`};
    }
    if(method==='eth_call'){
      assert.equal(params[1],chainlinkBlockTag,'historical Chainlink call escaped exact ve33 closing block');
      if(params[0]?.data==='0x313ce567')return`0x${abiWord(8)}`;
      if(params[0]?.data==='0xfeaf968c')return encodeRoundData({roundId:42n,answer,startedAt:updatedAt-60n,updatedAt,answeredInRound:42n});
    }
    throw new Error(`unexpected RPC method ${method}`);
  };
}

const historicalUsdc=await historicalCanonicalPriceAtBoundary({token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',boundaryAt:chainlinkBoundary,eventKey:`ve33:synthetic:${chainlinkOpeningBlock}:${chainlinkClosingBlock}`,onchainRegistry:optimismTestRegistry,rpcCall:chainlinkRpc()});
assert.equal(historicalUsdc.ok,true);assert.equal(historicalUsdc.status,'historical-onchain-chainlink-price');assert.equal(historicalUsdc.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(historicalUsdc.assetId,'usd-coin');assert.equal(historicalUsdc.priceUsd,0.9999);assert.equal(historicalUsdc.chainId,10);assert.equal(historicalUsdc.sourceBlockNumber,chainlinkClosingBlock);assert.equal(historicalUsdc.exactHistoricalBlock,true);assert.equal(historicalUsdc.currentPriceUsed,false);assert.equal(historicalUsdc.referenceAprUsed,false);assert.equal(historicalUsdc.sourceContract.toLowerCase(),'0x16a9fa2fda030272ce99b29cf780dfa30361e0f3');assert.equal(historicalUsdc.roundId,'42');assert.equal(historicalUsdc.answeredInRound,'42');
const noClosingBlock=await historicalCanonicalPriceAtBoundary({token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',boundaryAt:chainlinkBoundary,eventKey:'ve33:synthetic:no-closing-block',onchainRegistry:optimismTestRegistry,rpcCall:chainlinkRpc()});
assert.equal(noClosingBlock.ok,false);assert.equal(noClosingBlock.status,'ve33-closing-block-proof-missing');
const staleHistoricalUsdc=await historicalCanonicalPriceAtBoundary({token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',boundaryAt:chainlinkBoundary,eventKey:`ve33:synthetic:${chainlinkOpeningBlock}:${chainlinkClosingBlock}`,onchainRegistry:optimismTestRegistry,rpcCall:chainlinkRpc({updatedAt:BigInt(chainlinkBoundarySeconds-100000)})});
assert.equal(staleHistoricalUsdc.ok,false);assert.equal(staleHistoricalUsdc.status,'historical-onchain-chainlink-price-stale');
const futureHistoricalUsdc=await historicalCanonicalPriceAtBoundary({token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',boundaryAt:chainlinkBoundary,eventKey:`ve33:synthetic:${chainlinkOpeningBlock}:${chainlinkClosingBlock}`,onchainRegistry:optimismTestRegistry,rpcCall:chainlinkRpc({updatedAt:BigInt(chainlinkBoundarySeconds+1)})});
assert.equal(futureHistoricalUsdc.ok,false);assert.equal(futureHistoricalUsdc.status,'historical-chainlink-observation-time-invalid');
const unsupportedMsUsd=await historicalCanonicalPriceAtBoundary({token:'0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0',boundaryAt:chainlinkBoundary,eventKey:`ve33:synthetic:${chainlinkOpeningBlock}:${chainlinkClosingBlock}`,onchainRegistry:optimismTestRegistry,rpcCall:chainlinkRpc()});
assert.equal(unsupportedMsUsd.ok,false);assert.equal(unsupportedMsUsd.status,'token-not-canonical-market-data-mapped');

const holder='0xefda6d86c6ea8bb80cf6456214432d45f14d06d4';
const rewardContract='0x7bf3f583f6c0a3173b44b149c5425f63d2321e02';
function ve33Fixture({token,asset,amount,immutable='immutable-sentinel',mutableToken=token}){
  const identityToken=String(token).toLowerCase();
  const lane=`velodrome|defitea.eth|${holder}|32671|voting-reward|${rewardContract}|${identityToken}`;
  return{
    eventKey:`ve33:${lane}:${chainlinkOpeningBlock}:${chainlinkClosingBlock}`,
    company:'defitea.eth',family:'accrued-entitlement',route:'velodrome-ve',protocol:'Velodrome',chain:'Optimism',chainId:10,
    economicDate:'2026-08-31',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:chainlinkBoundary,
    asset,token:mutableToken,amount,amountRaw:String(Math.round(Number(amount)*1e12)),usdValue:null,
    valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',
    sourceIdentity:`${lane}|${chainlinkOpeningBlock}->${lane}|${chainlinkClosingBlock}`,
    unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:immutable
  };
}

const immutableWethEvent=ve33Fixture({token:'0x4200000000000000000000000000000000000006',asset:'WETH',amount:0.000177916716});
assert.equal(ve33EventIdentity(immutableWethEvent).ok,true);
const resolvedLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[immutableWethEvent]},{resolver:async({token,boundaryAt})=>{
  assert.equal(token.toLowerCase(),'0x4200000000000000000000000000000000000006');assert.equal(boundaryAt,immutableWethEvent.periodEnd);
  return{ok:true,status:'historical-canonical-market-price',assetId:'ethereum',priceUsd:2466.06838126,observedAt:'2026-08-31T23:52:53.619Z',ageMinutes:7.10635,commitSha:'historical-commit',sourceFile:'intelligence/market-data/market-data.json',sourceFamily:'canonical-market-data-git-history'};
}});
assert.equal(resolvedLedger.resolvedEventCount,1);assert.equal(resolvedLedger.unresolvedEventCount,0);
const resolvedEvent=resolvedLedger.ledger.events[0];
assert.equal(resolvedEvent.usdValue,null,'immutable canonical event USD must remain unchanged');assert.equal(resolvedEvent.immutableEconomicFieldsHash,'immutable-sentinel','valuation metadata must not mutate immutable event hash');assert.equal(resolvedEvent.valuationResolution?.economicFieldsMutated,false);assert.equal(resolvedEvent.valuationResolution?.sourceFamily,'canonical-market-data-git-history');assert.equal(resolvedEvent.valuationResolution?.sourceAssetId,'ethereum');assert.equal(resolvedEvent.valuationResolution?.identityBound,true);assert.equal(resolvedEvent.valuationResolution?.identityToken,'0x4200000000000000000000000000000000000006');assert.ok(Number(resolvedEvent.valuationResolution?.resolvedUsdValue)>0);assert.equal(resolvedUsdValue(resolvedEvent),resolvedEvent.valuationResolution.resolvedUsdValue);assert.equal(recognitionDecision(resolvedEvent).status,'recognized');

const immutableUsdcEvent=ve33Fixture({token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',asset:'USDC',amount:0.3,immutable:'immutable-usdc-sentinel'});
const onchainResolvedLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[immutableUsdcEvent]},{resolver:async()=>historicalUsdc});
assert.equal(onchainResolvedLedger.resolvedEventCount,1);
const onchainResolvedEvent=onchainResolvedLedger.ledger.events[0];
assert.equal(onchainResolvedEvent.usdValue,null);assert.equal(onchainResolvedEvent.immutableEconomicFieldsHash,'immutable-usdc-sentinel');assert.equal(onchainResolvedEvent.valuationResolution?.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(onchainResolvedEvent.valuationResolution?.sourceChainId,10);assert.equal(onchainResolvedEvent.valuationResolution?.sourceBlockNumber,chainlinkClosingBlock);assert.equal(onchainResolvedEvent.valuationResolution?.exactHistoricalBlock,true);assert.equal(onchainResolvedEvent.valuationResolution?.sourceStatus,'historical-onchain-chainlink-price');assert.equal(onchainResolvedEvent.valuationResolution?.identityBound,true);assert.equal(historicalValuationSourceMatchesVe33Identity(onchainResolvedEvent,onchainResolvedEvent.valuationResolution),true);assert.equal(resolvedUsdValue(onchainResolvedEvent),onchainResolvedEvent.valuationResolution.resolvedUsdValue);assert.equal(recognitionDecision(onchainResolvedEvent).status,'recognized');

const malformedOnchainEvent=structuredClone(onchainResolvedEvent);malformedOnchainEvent.valuationResolution.exactHistoricalBlock=false;
assert.equal(resolvedUsdValue(malformedOnchainEvent),null);assert.equal(recognitionDecision(malformedOnchainEvent).status,'unresolved');
const wrongFeedEvent=structuredClone(onchainResolvedEvent);wrongFeedEvent.valuationResolution.sourceContract='0x0D276FC14719f9292D5C1eA2198673d1f4269246';
assert.equal(resolvedUsdValue(wrongFeedEvent),null,'price feed must match immutable reward-token identity');

const msUsdToken='0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0';
const unsupportedEvent=ve33Fixture({token:msUsdToken,asset:'msUSD',amount:0.003,immutable:'immutable-msusd-sentinel'});
const wrongMsUsdPrior={...unsupportedEvent,valuationResolution:{...structuredClone(onchainResolvedEvent.valuationResolution),resolvedUsdValue:0.0029997,identityBound:false,identityToken:undefined}};
assert.equal(resolvedUsdValue(wrongMsUsdPrior),null,'msUSD must never inherit a USDC Chainlink proof');
const unsupportedLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[wrongMsUsdPrior]},{resolver:async({token})=>{
  assert.equal(token.toLowerCase(),msUsdToken.toLowerCase(),'resolver must use immutable ve33 identity token');
  return{ok:false,status:'token-not-canonical-market-data-mapped',assetId:null};
}});
assert.equal(unsupportedLedger.resolvedEventCount,0);assert.equal(unsupportedLedger.unresolvedEventCount,1);assert.equal(unsupportedLedger.invalidPriorResolutionClearedCount,1);assert.equal(unsupportedLedger.ledger.events[0].valuationResolution,undefined,'invalid legacy cross-token valuation must be scrubbed back to UNKNOWN');assert.equal(recognitionDecision(unsupportedLedger.ledger.events[0]).status,'unresolved');

const staleMutableUsdc=ve33Fixture({token:'0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',asset:'USDC',amount:0.3,immutable:'immutable-stale-token-sentinel',mutableToken:msUsdToken});
assert.equal(ve33EventIdentity(staleMutableUsdc).eventTokenMatchesIdentity,false);
const identityBoundRepair=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[staleMutableUsdc]},{resolver:async({token})=>{
  assert.equal(token.toLowerCase(),'0x0b2c639c533813f4aa9d7837caf62653d097ff85','mutable event.token must not become price authority');return historicalUsdc;
}});
assert.equal(identityBoundRepair.resolvedEventCount,1);assert.equal(identityBoundRepair.identityMismatchEventCount,1);assert.equal(identityBoundRepair.ledger.events[0].token,msUsdToken,'non-economic stale token metadata is not silently rewritten');assert.equal(identityBoundRepair.ledger.events[0].valuationResolution.identityToken,'0x0b2c639c533813f4aa9d7837caf62653d097ff85');assert.equal(identityBoundRepair.ledger.events[0].valuationResolution.eventTokenMatchesIdentity,false);assert.equal(recognitionDecision(identityBoundRepair.ledger.events[0]).status,'recognized','immutable identity-bound USDC proof remains recognizable even if mutable token metadata is stale');

const alreadyValued={...immutableWethEvent,usdValue:1,valuationStatus:'historical-canonical-market-price-frozen-at-closing-accounting-boundary'};
const noRewrite=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[alreadyValued]},{resolver:async()=>{throw new Error('resolver must not run for already-valued event');}});
assert.equal(noRewrite.eligibleEventCount,0);assert.equal(noRewrite.ledger.events[0].usdValue,1,'closed numeric valuation must never be rewritten');

console.log('Historical canonical + exact onchain Chainlink market price identity binding validation OK');
