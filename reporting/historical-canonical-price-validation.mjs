#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import {
  VERSION,HISTORICAL_TOKEN_ASSET_IDS,HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS,HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES,
  canonicalAssetIdForHistoricalToken,historicalOptimismChainlinkRouteForToken,historicalOptimismVelodromeTwapRouteForToken,closingBlockFromVe33Identity,
  selectHistoricalCanonicalPrice,historicalCanonicalPriceAtBoundary
} from './historical-canonical-price.mjs';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { recognitionDecision, resolvedUsdValue } from './canonical-earned-income-view.mjs';
import { ve33EventIdentity, historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';

assert.equal(VERSION,'0.2-historical-canonical-market-or-exact-chainlink-price');
assert.equal(Object.keys(HISTORICAL_TOKEN_ASSET_IDS).length,4);
assert.equal(Object.keys(HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS).length,4);
assert.equal(Object.keys(HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES).length,1);
assert.equal(canonicalAssetIdForHistoricalToken('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),'aerodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db'),'velodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x4200000000000000000000000000000000000006'),'ethereum');
assert.equal(canonicalAssetIdForHistoricalToken('0x68f180fcCe6836688e9084f035309E29Bf0A2095'),'bitcoin');
assert.equal(canonicalAssetIdForHistoricalToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'),null);
assert.equal(historicalOptimismChainlinkRouteForToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85')?.assetId,'usd-coin');
assert.equal(historicalOptimismChainlinkRouteForToken('0x4200000000000000000000000000000000000042')?.assetId,'optimism');
assert.equal(historicalOptimismChainlinkRouteForToken('0x94b008aa00579c1307B0ef2c499ad98a8ce58e58')?.assetId,'tether');
assert.equal(historicalOptimismChainlinkRouteForToken('0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb')?.assetId,'wrapped-steth');
const msUsdToken='0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0';
const usdcToken='0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const msUsdRoute=historicalOptimismVelodromeTwapRouteForToken(msUsdToken);
assert.equal(historicalOptimismChainlinkRouteForToken(msUsdToken),null,'msUSD must not masquerade as a direct Chainlink-priced token');
assert.equal(msUsdRoute?.assetId,'metronome-synth-usd');
assert.equal(msUsdRoute?.quoteToken.toLowerCase(),usdcToken.toLowerCase());
assert.equal(msUsdRoute?.twapGranularity,48);
assert.equal(closingBlockFromVe33Identity({eventKey:'ve33:synthetic:154971811:156311011'}),156311011);
assert.equal(closingBlockFromVe33Identity({sourceIdentity:'lane|154971811->lane|156311011'}),156311011);
assert.equal(closingBlockFromVe33Identity({eventKey:'ve33:synthetic:no-block'}),null);

const snapshot={
  version:'1.2-market-data-truthful-canonical-provenance',generatedAt:'2026-08-31T23:52:57.601Z',observedAt:'2026-08-31T23:52:53.619Z',status:'ok',prices:{
    bitcoin:{assetId:'bitcoin',symbol:'BTC',providerId:'bitcoin',usd:78537.9,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'},
    ethereum:{assetId:'ethereum',symbol:'ETH',providerId:'ethereum',usd:2466.06838126,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'},
    'aerodrome-finance':{assetId:'aerodrome-finance',symbol:'AERO',providerId:'aerodrome-finance',usd:0.47301682,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-chainlink-v3'},
    'velodrome-finance':{assetId:'velodrome-finance',symbol:'VELO',providerId:'velodrome-finance',usd:0.021860940606858108,status:'fresh',observedAt:'2026-08-31T23:52:53.619Z',source:'onchain-velodrome-v2-twap-relative'}
  }
};
const aero=selectHistoricalCanonicalPrice({snapshot,token:'0x940181a94A35A4569E4529a3cdfb74e38fd98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(aero.ok,true);assert.equal(aero.assetId,'aerodrome-finance');assert.equal(aero.priceUsd,0.47301682);assert.ok(aero.ageMinutes>7&&aero.ageMinutes<8);
const velo=selectHistoricalCanonicalPrice({snapshot,token:'0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25});
assert.equal(velo.ok,true);assert.equal(velo.assetId,'velodrome-finance');
const tooOld=selectHistoricalCanonicalPrice({snapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T01:00:00.000Z',maxAgeMinutes:25});
assert.equal(tooOld.ok,false);assert.equal(tooOld.status,'canonical-price-too-old-for-accounting-boundary');
const futureSnapshot=structuredClone(snapshot);futureSnapshot.prices['aerodrome-finance'].observedAt='2026-09-01T00:00:01.000Z';
assert.equal(selectHistoricalCanonicalPrice({snapshot:futureSnapshot,token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',boundaryAt:'2026-09-01T00:00:00.000Z',maxAgeMinutes:25}).status,'canonical-price-observed-after-accounting-boundary');

const boundary='2026-09-01T00:00:00.000Z';
const boundarySeconds=Math.floor(Date.parse(boundary)/1000);
const openingBlock=154971811,closingBlock=156311011,blockTag=`0x${BigInt(closingBlock).toString(16)}`;
const abiWord=value=>BigInt(value).toString(16).padStart(64,'0');
const encodeRoundData=({roundId,answer,startedAt,updatedAt,answeredInRound})=>`0x${abiWord(roundId)}${abiWord(answer)}${abiWord(startedAt)}${abiWord(updatedAt)}${abiWord(answeredInRound)}`;
const registry={networks:{optimism:{chainId:10,rpcFailover:[{id:'test-optimism',url:'https://optimism.example'}]}}};
const poolIface=new Interface([
  'function token0() view returns (address)','function token1() view returns (address)','function stable() view returns (bool)',
  'function observationLength() view returns (uint256)','function quote(address tokenIn,uint256 amountIn,uint256 granularity) view returns (uint256 amountOut)'
]);
const poolCalls={
  token0:poolIface.encodeFunctionData('token0'),token1:poolIface.encodeFunctionData('token1'),stable:poolIface.encodeFunctionData('stable'),
  observationLength:poolIface.encodeFunctionData('observationLength'),quote:poolIface.encodeFunctionData('quote',[msUsdToken,10n**18n,48])
};
function exactHistoricalRpc({usdcAnswer=99990000n,quoteRaw=850000n,observationLength=200,blockTimestamp=boundarySeconds-2,updatedAt=BigInt(boundarySeconds-300)}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-optimism');
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],blockTag);assert.equal(params[1],false);return{number:blockTag,timestamp:`0x${BigInt(blockTimestamp).toString(16)}`};}
    if(method!=='eth_call')throw new Error(`unexpected RPC method ${method}`);
    assert.equal(params[1],blockTag,'historical call escaped exact ve33 closing block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    if(to===String(msUsdRoute.pool).toLowerCase()){
      if(data===poolCalls.token0.toLowerCase())return poolIface.encodeFunctionResult('token0',[msUsdToken]);
      if(data===poolCalls.token1.toLowerCase())return poolIface.encodeFunctionResult('token1',[usdcToken]);
      if(data===poolCalls.stable.toLowerCase())return poolIface.encodeFunctionResult('stable',[true]);
      if(data===poolCalls.observationLength.toLowerCase())return poolIface.encodeFunctionResult('observationLength',[observationLength]);
      if(data===poolCalls.quote.toLowerCase())return poolIface.encodeFunctionResult('quote',[quoteRaw]);
    }
    if(to===String(msUsdRoute.quoteChainlinkFeed).toLowerCase()){
      if(data==='0x313ce567')return`0x${abiWord(8)}`;
      if(data==='0xfeaf968c')return encodeRoundData({roundId:42n,answer:usdcAnswer,startedAt:updatedAt-60n,updatedAt,answeredInRound:42n});
    }
    throw new Error(`unexpected historical eth_call ${to} ${data}`);
  };
}

const historicalUsdc=await historicalCanonicalPriceAtBoundary({token:usdcToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc()});
assert.equal(historicalUsdc.ok,true);assert.equal(historicalUsdc.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(historicalUsdc.priceUsd,0.9999);assert.equal(historicalUsdc.sourceBlockNumber,closingBlock);
const historicalMsUsd=await historicalCanonicalPriceAtBoundary({token:msUsdToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc()});
assert.equal(historicalMsUsd.ok,true);assert.equal(historicalMsUsd.status,'historical-onchain-velodrome-twap-chainlink-price');assert.equal(historicalMsUsd.sourceFamily,'historical-onchain-velodrome-twap-chainlink-at-boundary');assert.equal(historicalMsUsd.sourceBlockNumber,closingBlock);assert.equal(historicalMsUsd.sourceContract.toLowerCase(),msUsdRoute.pool.toLowerCase());assert.equal(historicalMsUsd.quoteChainlinkContract.toLowerCase(),msUsdRoute.quoteChainlinkFeed.toLowerCase());assert.equal(historicalMsUsd.quoteToken.toLowerCase(),usdcToken.toLowerCase());assert.equal(historicalMsUsd.quoteTokenAmount,0.85);assert.equal(historicalMsUsd.quotePriceUsd,0.9999);assert.ok(Math.abs(historicalMsUsd.priceUsd-0.849915)<1e-12);assert.equal(historicalMsUsd.stablecoinPegAssumptionUsed,false);assert.equal(historicalMsUsd.currentPriceUsed,false);assert.equal(historicalMsUsd.referenceAprUsed,false);
const insufficientObservations=await historicalCanonicalPriceAtBoundary({token:msUsdToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc({observationLength:48})});
assert.equal(insufficientObservations.ok,false);assert.equal(insufficientObservations.status,'historical-velodrome-observation-history-insufficient');

const holder='0xefda6d86c6ea8bb80cf6456214432d45f14d06d4',rewardContract='0x7bf3f583f6c0a3173b44b149c5425f63d2321e02';
function ve33Fixture({token,asset,amount,immutable='immutable-sentinel',mutableToken=token}){
  const identityToken=String(token).toLowerCase();const lane=`velodrome|defitea.eth|${holder}|32671|voting-reward|${rewardContract}|${identityToken}`;
  return{eventKey:`ve33:${lane}:${openingBlock}:${closingBlock}`,company:'defitea.eth',family:'accrued-entitlement',route:'velodrome-ve',protocol:'Velodrome',chain:'Optimism',chainId:10,economicDate:'2026-08-31',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:boundary,asset,token:mutableToken,amount,amountRaw:String(Math.round(Number(amount)*1e12)),usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${lane}|${openingBlock}->${lane}|${closingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:immutable};
}

const immutableUsdcEvent=ve33Fixture({token:usdcToken,asset:'USDC',amount:0.3,immutable:'immutable-usdc-sentinel'});
const usdcLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[immutableUsdcEvent]},{resolver:async()=>historicalUsdc});
assert.equal(usdcLedger.resolvedEventCount,1);assert.equal(historicalValuationSourceMatchesVe33Identity(usdcLedger.ledger.events[0],usdcLedger.ledger.events[0].valuationResolution),true);assert.equal(recognitionDecision(usdcLedger.ledger.events[0]).status,'recognized');

const msUsdEvent=ve33Fixture({token:msUsdToken,asset:'msUSD',amount:0.003,immutable:'immutable-msusd-sentinel'});
const wrongMsUsdPrior={...msUsdEvent,valuationResolution:{...structuredClone(usdcLedger.ledger.events[0].valuationResolution),resolvedUsdValue:0.0029997,identityBound:false,identityToken:undefined}};
assert.equal(resolvedUsdValue(wrongMsUsdPrior),null,'msUSD must never inherit a USDC Chainlink proof');
const repairedMsUsd=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[wrongMsUsdPrior]},{resolver:async({token})=>{assert.equal(token.toLowerCase(),msUsdToken.toLowerCase());return historicalMsUsd;}});
assert.equal(repairedMsUsd.resolvedEventCount,1);assert.equal(repairedMsUsd.unresolvedEventCount,0);assert.equal(repairedMsUsd.legacyResolutionReplacedCount,1);
const repairedEvent=repairedMsUsd.ledger.events[0],r=repairedEvent.valuationResolution;
assert.equal(r.sourceFamily,'historical-onchain-velodrome-twap-chainlink-at-boundary');assert.equal(r.identityToken,msUsdToken.toLowerCase());assert.equal(r.sourceBlockNumber,closingBlock);assert.equal(r.sourceContract.toLowerCase(),msUsdRoute.pool.toLowerCase());assert.equal(r.quoteChainlinkContract.toLowerCase(),msUsdRoute.quoteChainlinkFeed.toLowerCase());assert.equal(r.stablecoinPegAssumptionUsed,false);assert.equal(historicalValuationSourceMatchesVe33Identity(repairedEvent,r),true);assert.ok(Number(resolvedUsdValue(repairedEvent))>0);assert.equal(recognitionDecision(repairedEvent).status,'recognized');

const staleMutableUsdc=ve33Fixture({token:usdcToken,asset:'USDC',amount:0.3,immutable:'immutable-stale-token-sentinel',mutableToken:msUsdToken});
assert.equal(ve33EventIdentity(staleMutableUsdc).eventTokenMatchesIdentity,false);
const identityBoundRepair=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[staleMutableUsdc]},{resolver:async({token})=>{assert.equal(token.toLowerCase(),usdcToken.toLowerCase());return historicalUsdc;}});
assert.equal(identityBoundRepair.resolvedEventCount,1);assert.equal(identityBoundRepair.identityMismatchEventCount,1);assert.equal(identityBoundRepair.ledger.events[0].token,msUsdToken);assert.equal(identityBoundRepair.ledger.events[0].valuationResolution.identityToken,usdcToken.toLowerCase());assert.equal(recognitionDecision(identityBoundRepair.ledger.events[0]).status,'recognized');

console.log('Historical canonical + exact-block Chainlink + msUSD Velodrome TWAP identity binding validation OK');