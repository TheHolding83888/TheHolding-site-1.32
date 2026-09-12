#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import {
  VERSION,HISTORICAL_TOKEN_ASSET_IDS,HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS,HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS,HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES,HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES,
  canonicalAssetIdForHistoricalToken,historicalOptimismChainlinkRouteForToken,historicalBaseChainlinkRouteForToken,historicalChainlinkRouteForToken,historicalOptimismVelodromeTwapRouteForToken,historicalBaseSlipstreamTwapRouteForToken,closingBlockFromVe33Identity,
  selectHistoricalCanonicalPrice,historicalCanonicalPriceAtBoundary
} from './historical-canonical-price.mjs';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { recognitionDecision, resolvedUsdValue } from './canonical-earned-income-view.mjs';
import { ve33EventIdentity, historicalValuationSourceMatchesVe33Identity } from './ve33-historical-valuation-identity.mjs';

assert.equal(VERSION,'0.2-historical-canonical-market-or-exact-chainlink-price');
assert.equal(Object.keys(HISTORICAL_TOKEN_ASSET_IDS).length,4);
assert.equal(Object.keys(HISTORICAL_OPTIMISM_CHAINLINK_TOKEN_FEEDS).length,5);
assert.equal(Object.keys(HISTORICAL_BASE_CHAINLINK_TOKEN_FEEDS).length,1);
assert.equal(Object.keys(HISTORICAL_BASE_SLIPSTREAM_TWAP_TOKEN_ROUTES).length,1);
assert.equal(Object.keys(HISTORICAL_OPTIMISM_VELODROME_TWAP_TOKEN_ROUTES).length,3);
assert.equal(canonicalAssetIdForHistoricalToken('0x940181a94A35A4569E4529A3CDfB74e38FD98631'),'aerodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db'),'velodrome-finance');
assert.equal(canonicalAssetIdForHistoricalToken('0x4200000000000000000000000000000000000006'),'ethereum');
assert.equal(canonicalAssetIdForHistoricalToken('0x68f180fcCe6836688e9084f035309E29Bf0A2095'),'bitcoin');
assert.equal(canonicalAssetIdForHistoricalToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85'),null);
assert.equal(historicalOptimismChainlinkRouteForToken('0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85')?.assetId,'usd-coin');
assert.equal(historicalOptimismChainlinkRouteForToken('0x4200000000000000000000000000000000000042')?.assetId,'optimism');
assert.equal(historicalOptimismChainlinkRouteForToken('0x94b008aa00579c1307B0ef2c499ad98a8ce58e58')?.assetId,'tether');
assert.equal(historicalOptimismChainlinkRouteForToken('0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb')?.assetId,'wrapped-steth');
const baseUsdcToken='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const baseUsdcRoute=historicalBaseChainlinkRouteForToken(baseUsdcToken);
assert.equal(baseUsdcRoute?.assetId,'usd-coin');
assert.equal(baseUsdcRoute?.network,'base');
assert.equal(baseUsdcRoute?.chainId,8453);
assert.equal(baseUsdcRoute?.contract.toLowerCase(),'0x7e860098f58bbfc8648a4311b374b1d669a2bc6b');
assert.equal(historicalChainlinkRouteForToken(baseUsdcToken,8453)?.contract.toLowerCase(),baseUsdcRoute.contract.toLowerCase());
assert.equal(historicalChainlinkRouteForToken(baseUsdcToken,10),null,'Base USDC proof must not cross chain identity');
const snxToken='0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4';
const snxRoute=historicalOptimismChainlinkRouteForToken(snxToken);
assert.equal(snxRoute?.assetId,'synthetix-network-token');
assert.equal(snxRoute?.chainId,10);
assert.equal(snxRoute?.contract.toLowerCase(),'0x2fcf37343e916eaed1f1ddaaf84458a359b53877');
assert.equal(snxRoute?.maxAgeSeconds,1200);
const laptopToken='0xB095274743941e953c746F9C228DA9c18Bb6ec29';
const laptopRoute=historicalBaseSlipstreamTwapRouteForToken(laptopToken);
assert.equal(laptopRoute?.assetId,'laptop');
assert.equal(laptopRoute?.chainId,8453);
assert.equal(laptopRoute?.pool.toLowerCase(),'0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c');
assert.equal(laptopRoute?.quoteToken.toLowerCase(),baseUsdcToken.toLowerCase());
assert.equal(laptopRoute?.quoteChainlinkFeed.toLowerCase(),baseUsdcRoute.contract.toLowerCase());
assert.equal(laptopRoute?.twapSeconds,300);
const msUsdToken='0x9dAbAE7274D28A45F0B65Bf8ED201A5731492ca0';
const alUsdToken='0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A';
const tarotToken='0x1F514A61bcde34F94Bc39731235690ab9da737F7';
const usdcToken='0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
const msUsdRoute=historicalOptimismVelodromeTwapRouteForToken(msUsdToken);
const alUsdRoute=historicalOptimismVelodromeTwapRouteForToken(alUsdToken);
const tarotRoute=historicalOptimismVelodromeTwapRouteForToken(tarotToken);
assert.equal(historicalOptimismChainlinkRouteForToken(msUsdToken),null,'msUSD must not masquerade as a direct Chainlink-priced token');
assert.equal(historicalOptimismChainlinkRouteForToken(alUsdToken),null,'alUSD must use exact-block Velodrome quote proof');
assert.equal(historicalOptimismChainlinkRouteForToken(tarotToken),null,'TAROT must use exact-block Velodrome quote proof');
assert.equal(msUsdRoute?.assetId,'metronome-synth-usd');
assert.equal(msUsdRoute?.quoteToken.toLowerCase(),usdcToken.toLowerCase());
assert.equal(msUsdRoute?.twapGranularity,48);
assert.equal(alUsdRoute?.assetId,'alchemix-usd');
assert.equal(alUsdRoute?.pool.toLowerCase(),'0x124d69daeda338b1b31ffc8e429e39c9a991164e');
assert.equal(alUsdRoute?.quoteToken.toLowerCase(),usdcToken.toLowerCase());
assert.equal(alUsdRoute?.poolStable,true);
assert.equal(alUsdRoute?.twapGranularity,48);
assert.equal(tarotRoute?.assetId,'tarot');
assert.equal(tarotRoute?.pool.toLowerCase(),'0x707ba27189e8bf89e43b2198e6b88aac4720124f');
assert.equal(tarotRoute?.quoteToken.toLowerCase(),usdcToken.toLowerCase());
assert.equal(tarotRoute?.poolStable,false);
assert.equal(tarotRoute?.twapGranularity,48);
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
const baseOpeningBlock=49376526,baseClosingBlock=50715726,baseBlockTag=`0x${BigInt(baseClosingBlock).toString(16)}`;
const abiWord=value=>BigInt(value).toString(16).padStart(64,'0');
const encodeRoundData=({roundId,answer,startedAt,updatedAt,answeredInRound})=>`0x${abiWord(roundId)}${abiWord(answer)}${abiWord(startedAt)}${abiWord(updatedAt)}${abiWord(answeredInRound)}`;
const registry={networks:{optimism:{chainId:10,rpcFailover:[{id:'test-optimism',url:'https://optimism.example'}]}}};
const baseRegistry={networks:{base:{chainId:8453,rpcFailover:[{id:'test-base',url:'https://base.example'}]}}};
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
function exactBaseHistoricalRpc({usdcAnswer=99980000n,blockTimestamp=boundarySeconds-2,updatedAt=BigInt(boundarySeconds-240)}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-base');
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],baseBlockTag);assert.equal(params[1],false);return{number:baseBlockTag,timestamp:`0x${BigInt(blockTimestamp).toString(16)}`};}
    if(method!=='eth_call')throw new Error(`unexpected Base RPC method ${method}`);
    assert.equal(params[1],baseBlockTag,'Base historical call escaped exact ve33 closing block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    assert.equal(to,baseUsdcRoute.contract.toLowerCase(),'Base USDC historical proof used wrong Chainlink feed');
    if(data==='0x313ce567')return`0x${abiWord(8)}`;
    if(data==='0xfeaf968c')return encodeRoundData({roundId:77n,answer:usdcAnswer,startedAt:updatedAt-60n,updatedAt,answeredInRound:77n});
    throw new Error(`unexpected Base historical eth_call ${to} ${data}`);
  };
}

const laptopClosingBlock=51109971,laptopOpeningBlock=50715726,laptopBoundary='2026-09-10T03:01:29.000Z',laptopBoundarySeconds=Math.floor(Date.parse(laptopBoundary)/1000),laptopBlockTag=`0x${BigInt(laptopClosingBlock).toString(16)}`;
const snxClosingBlock=156807818,snxOpeningBlock=156311011,snxBoundary='2026-09-12T12:00:13.000Z',snxBoundarySeconds=Math.floor(Date.parse(snxBoundary)/1000),snxBlockTag=`0x${BigInt(snxClosingBlock).toString(16)}`;
const slipstreamIface=new Interface(['function token0() view returns (address)','function token1() view returns (address)','function observe(uint32[]) view returns (int56[] tickCumulatives,uint160[] secondsPerLiquidityCumulativeX128s)']);
function exactLaptopHistoricalRpc({avgTick=275745,usdcAnswer=99990000n,updatedAt=BigInt(laptopBoundarySeconds-240)}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-base');
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],laptopBlockTag);return{number:laptopBlockTag,timestamp:`0x${BigInt(laptopBoundarySeconds).toString(16)}`};}
    if(method!=='eth_call')throw new Error(`unexpected LAPTOP RPC method ${method}`);
    assert.equal(params[1],laptopBlockTag,'LAPTOP historical call escaped exact ve33 closing block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    if(to===laptopRoute.pool.toLowerCase()){
      if(data==='0x0dfe1681')return slipstreamIface.encodeFunctionResult('token0',[baseUsdcToken]);
      if(data==='0xd21220a7')return slipstreamIface.encodeFunctionResult('token1',[laptopToken]);
      if(data.startsWith('0x883bdbfd'))return slipstreamIface.encodeFunctionResult('observe',[[0n,BigInt(avgTick)*300n],[0n,0n]]);
    }
    if(to===baseUsdcRoute.contract.toLowerCase()){
      if(data==='0x313ce567')return`0x${abiWord(8)}`;
      if(data==='0xfeaf968c')return encodeRoundData({roundId:88n,answer:usdcAnswer,startedAt:updatedAt-60n,updatedAt,answeredInRound:88n});
    }
    throw new Error(`unexpected LAPTOP historical eth_call ${to} ${data}`);
  };
}
function exactSnxHistoricalRpc({answer=123456789n,updatedAt=BigInt(snxBoundarySeconds-300)}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-optimism');
    if(method==='eth_getBlockByNumber'){assert.equal(params[0],snxBlockTag);return{number:snxBlockTag,timestamp:`0x${BigInt(snxBoundarySeconds).toString(16)}`};}
    if(method!=='eth_call')throw new Error(`unexpected SNX RPC method ${method}`);
    assert.equal(params[1],snxBlockTag,'SNX historical call escaped exact ve33 closing block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    assert.equal(to,snxRoute.contract.toLowerCase(),'SNX proof used wrong Chainlink feed');
    if(data==='0x313ce567')return`0x${abiWord(8)}`;
    if(data==='0xfeaf968c')return encodeRoundData({roundId:99n,answer,startedAt:updatedAt-60n,updatedAt,answeredInRound:99n});
    throw new Error(`unexpected SNX historical eth_call ${to} ${data}`);
  };
}

const historicalLaptop=await historicalCanonicalPriceAtBoundary({token:laptopToken,boundaryAt:laptopBoundary,eventKey:`ve33:synthetic:${laptopOpeningBlock}:${laptopClosingBlock}`,onchainRegistry:baseRegistry,rpcCall:exactLaptopHistoricalRpc()});
assert.equal(historicalLaptop.ok,true);assert.equal(historicalLaptop.sourceFamily,'historical-onchain-slipstream-twap-chainlink-at-boundary');assert.equal(historicalLaptop.sourceBlockNumber,laptopClosingBlock);assert.equal(historicalLaptop.sourceContract.toLowerCase(),laptopRoute.pool.toLowerCase());assert.equal(historicalLaptop.twapSeconds,300);assert.equal(historicalLaptop.averageTick,275745);assert.equal(historicalLaptop.stablecoinPegAssumptionUsed,false);assert.equal(historicalLaptop.currentPriceUsed,false);assert.equal(historicalLaptop.referenceAprUsed,false);assert.ok(historicalLaptop.priceUsd>1.05&&historicalLaptop.priceUsd<1.07);
const historicalSnx=await historicalCanonicalPriceAtBoundary({token:snxToken,boundaryAt:snxBoundary,eventKey:`ve33:synthetic:${snxOpeningBlock}:${snxClosingBlock}`,onchainRegistry:registry,rpcCall:exactSnxHistoricalRpc()});
assert.equal(historicalSnx.ok,true);assert.equal(historicalSnx.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(historicalSnx.sourceBlockNumber,snxClosingBlock);assert.equal(historicalSnx.chainId,10);assert.equal(historicalSnx.sourceContract.toLowerCase(),snxRoute.contract.toLowerCase());assert.equal(historicalSnx.priceUsd,1.23456789);

const historicalUsdc=await historicalCanonicalPriceAtBoundary({token:usdcToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc()});
assert.equal(historicalUsdc.ok,true);assert.equal(historicalUsdc.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(historicalUsdc.priceUsd,0.9999);assert.equal(historicalUsdc.sourceBlockNumber,closingBlock);
const historicalBaseUsdc=await historicalCanonicalPriceAtBoundary({token:baseUsdcToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${baseOpeningBlock}:${baseClosingBlock}`,onchainRegistry:baseRegistry,rpcCall:exactBaseHistoricalRpc()});
assert.equal(historicalBaseUsdc.ok,true);assert.equal(historicalBaseUsdc.sourceFamily,'historical-onchain-chainlink-at-boundary');assert.equal(historicalBaseUsdc.priceUsd,0.9998);assert.equal(historicalBaseUsdc.sourceBlockNumber,baseClosingBlock);assert.equal(historicalBaseUsdc.chainId,8453);assert.equal(historicalBaseUsdc.sourceContract.toLowerCase(),baseUsdcRoute.contract.toLowerCase());assert.equal(historicalBaseUsdc.stablecoinPegAssumptionUsed,false);assert.equal(historicalBaseUsdc.currentPriceUsed,false);assert.equal(historicalBaseUsdc.referenceAprUsed,false);
const historicalMsUsd=await historicalCanonicalPriceAtBoundary({token:msUsdToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc()});
assert.equal(historicalMsUsd.ok,true);assert.equal(historicalMsUsd.status,'historical-onchain-velodrome-twap-chainlink-price');assert.equal(historicalMsUsd.sourceFamily,'historical-onchain-velodrome-twap-chainlink-at-boundary');assert.equal(historicalMsUsd.sourceBlockNumber,closingBlock);assert.equal(historicalMsUsd.sourceContract.toLowerCase(),msUsdRoute.pool.toLowerCase());assert.equal(historicalMsUsd.quoteChainlinkContract.toLowerCase(),msUsdRoute.quoteChainlinkFeed.toLowerCase());assert.equal(historicalMsUsd.quoteToken.toLowerCase(),usdcToken.toLowerCase());assert.equal(historicalMsUsd.quoteTokenAmount,0.85);assert.equal(historicalMsUsd.quotePriceUsd,0.9999);assert.ok(Math.abs(historicalMsUsd.priceUsd-0.849915)<1e-12);assert.equal(historicalMsUsd.stablecoinPegAssumptionUsed,false);assert.equal(historicalMsUsd.currentPriceUsed,false);assert.equal(historicalMsUsd.referenceAprUsed,false);
const insufficientObservations=await historicalCanonicalPriceAtBoundary({token:msUsdToken,boundaryAt:boundary,eventKey:`ve33:synthetic:${openingBlock}:${closingBlock}`,onchainRegistry:registry,rpcCall:exactHistoricalRpc({observationLength:48})});
assert.equal(insufficientObservations.ok,false);assert.equal(insufficientObservations.status,'historical-velodrome-observation-history-insufficient');

const holder='0xefda6d86c6ea8bb80cf6456214432d45f14d06d4',rewardContract='0x7bf3f583f6c0a3173b44b149c5425f63d2321e02';
function ve33Fixture({token,asset,amount,immutable='immutable-sentinel',mutableToken=token}){
  const identityToken=String(token).toLowerCase();const lane=`velodrome|defitea.eth|${holder}|32671|voting-reward|${rewardContract}|${identityToken}`;
  return{eventKey:`ve33:${lane}:${openingBlock}:${closingBlock}`,company:'defitea.eth',family:'accrued-entitlement',route:'velodrome-ve',protocol:'Velodrome',chain:'Optimism',chainId:10,economicDate:'2026-08-31',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:boundary,asset,token:mutableToken,amount,amountRaw:String(Math.round(Number(amount)*1e12)),usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${lane}|${openingBlock}->${lane}|${closingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:immutable};
}
function baseVe33Fixture({amount=2.494371,chainId=8453,chain='Base'}){
  const holder='0xa641752824d512fa8683758c6b2d8a04ea46dcd0',reward='0x25dc2a616288e79bb3de121070a1bcf01fc8a82b',token=baseUsdcToken.toLowerCase();
  const lane=`aerodrome|aerocvxyb.eth|${holder}|64985|voting-reward|${reward}|${token}`;
  return{eventKey:`ve33:${lane}:${baseOpeningBlock}:${baseClosingBlock}`,company:'aerocvxyb.eth',family:'accrued-entitlement',route:'aerodrome-ve',protocol:'Aerodrome',chain,chainId,economicDate:'2026-08-31',periodStart:'2026-08-01T00:00:00.000Z',periodEnd:boundary,asset:'USDC',token:baseUsdcToken,amount,amountRaw:'2494371',usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${lane}|${baseOpeningBlock}->${lane}|${baseClosingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:'immutable-base-usdc-sentinel'};
}

const immutableUsdcEvent=ve33Fixture({token:usdcToken,asset:'USDC',amount:0.3,immutable:'immutable-usdc-sentinel'});
const usdcLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[immutableUsdcEvent]},{resolver:async()=>historicalUsdc});
assert.equal(usdcLedger.resolvedEventCount,1);assert.equal(historicalValuationSourceMatchesVe33Identity(usdcLedger.ledger.events[0],usdcLedger.ledger.events[0].valuationResolution),true);assert.equal(recognitionDecision(usdcLedger.ledger.events[0]).status,'recognized');

const baseUsdcEvent=baseVe33Fixture({});
const baseUsdcLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[baseUsdcEvent]},{resolver:async({token})=>{assert.equal(token.toLowerCase(),baseUsdcToken.toLowerCase());return historicalBaseUsdc;}});
assert.equal(baseUsdcLedger.resolvedEventCount,1);assert.equal(baseUsdcLedger.unresolvedEventCount,0);
const baseResolution=baseUsdcLedger.ledger.events[0].valuationResolution;
assert.equal(baseResolution.sourceChainId,8453);assert.equal(baseResolution.sourceBlockNumber,baseClosingBlock);assert.equal(baseResolution.sourceContract.toLowerCase(),baseUsdcRoute.contract.toLowerCase());assert.equal(baseResolution.stablecoinPegAssumptionUsed,false);assert.equal(historicalValuationSourceMatchesVe33Identity(baseUsdcLedger.ledger.events[0],baseResolution),true);assert.equal(recognitionDecision(baseUsdcLedger.ledger.events[0]).status,'recognized');
const wrongChainBaseUsdc={...baseUsdcEvent,chain:'Optimism',chainId:10};
assert.equal(historicalValuationSourceMatchesVe33Identity(wrongChainBaseUsdc,baseResolution),false,'Base Chainlink proof must fail closed on wrong event chain');

const laptopHolder='0x58603461149fc2a800a56d421e77dcbba2d83ca8',laptopReward='0x7591a0d4a21170a8bb3c02bf89f13d7757aebade';
const laptopLane=`aerodrome|0x5860...83CA8.eth|${laptopHolder}|1938|voting-reward|${laptopReward}|${laptopToken.toLowerCase()}`;
const laptopEvent={eventKey:`ve33:${laptopLane}:${laptopOpeningBlock}:${laptopClosingBlock}`,company:'0x5860...83CA8.eth',family:'accrued-entitlement',route:'aerodrome-ve',protocol:'Aerodrome',chain:'Base',chainId:8453,economicDate:'2026-09-10',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:laptopBoundary,asset:'LAPTOP',token:laptopToken,amount:67.615020175016,amountRaw:'67615020175015840449',usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${laptopLane}|${laptopOpeningBlock}->${laptopLane}|${laptopClosingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:'immutable-real-laptop-sentinel'};
const laptopLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[laptopEvent]},{resolver:async(args)=>historicalCanonicalPriceAtBoundary({...args,onchainRegistry:baseRegistry,rpcCall:exactLaptopHistoricalRpc()})});
assert.equal(laptopLedger.resolvedEventCount,1,'intraperiod LAPTOP event must be eligible for exact historical valuation');assert.equal(laptopLedger.unresolvedEventCount,0);const laptopResolved=laptopLedger.ledger.events[0],laptopResolution=laptopResolved.valuationResolution;assert.equal(laptopResolved.usdValue,null,'immutable event USD must stay null');assert.equal(laptopResolved.immutableEconomicFieldsHash,'immutable-real-laptop-sentinel');assert.equal(laptopResolution.sourceFamily,'historical-onchain-slipstream-twap-chainlink-at-boundary');assert.equal(laptopResolution.sourceBlockNumber,laptopClosingBlock);assert.equal(laptopResolution.twapSeconds,300);assert.equal(laptopResolution.stablecoinPegAssumptionUsed,false);assert.equal(historicalValuationSourceMatchesVe33Identity(laptopResolved,laptopResolution),true);assert.equal(recognitionDecision(laptopResolved).status,'recognized');
const snxHolder='0xefda6d86c6ea8bb80cf6456214432d45f14d06d4',snxReward='0x3ecaad2d3996df95d415d4c1c0f7587b22dbd901';
const snxLane=`velodrome|defitea.eth|${snxHolder}|32671|voting-reward|${snxReward}|${snxToken.toLowerCase()}`;
const snxEvent={eventKey:`ve33:${snxLane}:${snxOpeningBlock}:${snxClosingBlock}`,company:'defitea.eth',family:'accrued-entitlement',route:'velodrome-ve',protocol:'Velodrome',chain:'Optimism',chainId:10,economicDate:'2026-09-12',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:snxBoundary,asset:'SNX',token:snxToken,amount:2.80734254553,amountRaw:'2807342545529763243',usdValue:null,valuationStatus:'unvalued-fail-closed',sourceFile:'reporting/ve33-accounting-evidence.json',sourceFamily:'ve(3,3) factual accrual evidence',sourceIdentity:`${snxLane}|${snxOpeningBlock}->${snxLane}|${snxClosingBlock}`,unknownIsNotZero:true,executionAuthority:'none',immutableEconomicFieldsHash:'immutable-real-snx-sentinel'};
const snxLedger=await annotateHistoricalValuationResolution({version:'0.1-canonical-income-ledger',events:[snxEvent]},{resolver:async(args)=>historicalCanonicalPriceAtBoundary({...args,onchainRegistry:registry,rpcCall:exactSnxHistoricalRpc()})});
assert.equal(snxLedger.resolvedEventCount,1,'intraperiod SNX event must be eligible for exact historical valuation');assert.equal(snxLedger.unresolvedEventCount,0);assert.equal(snxLedger.ledger.events[0].usdValue,null);assert.equal(snxLedger.ledger.events[0].immutableEconomicFieldsHash,'immutable-real-snx-sentinel');assert.equal(historicalValuationSourceMatchesVe33Identity(snxLedger.ledger.events[0],snxLedger.ledger.events[0].valuationResolution),true);assert.equal(recognitionDecision(snxLedger.ledger.events[0]).status,'recognized');

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

console.log('Historical canonical + intraperiod multi-chain Chainlink + Velodrome/Slipstream TWAP identity binding validation OK');
