#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  discoverHistoricalAerodromeUsdcRoute,
  BASE_NATIVE_USDC
} from './historical-aerodrome-usdc-route.mjs';
import { decodeChainlinkRoundData, decodeUint256 } from '../intelligence/market-data/onchain-price-resolver-core.mjs';

export const VERSION='0.2-aerodrome-approved-quote-twap-plus-chainlink-usd';
export const ONCHAIN_PRICE_REGISTRY_REPO_PATH='intelligence/market-data/onchain-price-source-registry.json';
export const BASE_NATIVE_USDC_CHAINLINK_FEED='0x7e860098F58bBFC8648a4311b374B1D669a2bc6B';
export const BASE_AERO_TOKEN='0x940181a94A35A4569E4529A3CDfB74e38FD98631';
export const BASE_AERO_CHAINLINK_FEED='0x4EC5970fC728C5f65ba413992CD5fF6FD70fcfF0';
export const MAX_BOUNDARY_BLOCK_LAG_SECONDS=120;
export const HISTORICAL_AERODROME_APPROVED_QUOTE_ROUTES=Object.freeze([
  Object.freeze({
    token:BASE_NATIVE_USDC,symbol:'USDC',decimals:6,assetId:'usd-coin',
    chainlinkFeed:BASE_NATIVE_USDC_CHAINLINK_FEED,maxAgeSeconds:90000,canonicalResolver:true
  }),
  Object.freeze({
    token:BASE_AERO_TOKEN,symbol:'AERO',decimals:18,assetId:'aerodrome-finance',
    chainlinkFeed:BASE_AERO_CHAINLINK_FEED,maxAgeSeconds:7200,canonicalResolver:false
  })
]);

const lower=value=>String(value||'').toLowerCase();
const hexQuantity=value=>`0x${BigInt(value).toString(16)}`;

export function historicalAerodromeApprovedQuoteRouteForToken(token){
  return HISTORICAL_AERODROME_APPROVED_QUOTE_ROUTES.find(route=>lower(route.token)===lower(token))||null;
}

export function isHistoricalAerodromeVe33Identity({eventKey,sourceIdentity}={}){
  const event=String(eventKey||'').toLowerCase();
  const source=String(sourceIdentity||'').toLowerCase();
  return event.startsWith('ve33:aerodrome|')||source.startsWith('aerodrome|');
}

export function closingBlockFromHistoricalAerodromeIdentity({eventKey,sourceIdentity}={}){
  const eventMatch=String(eventKey||'').match(/:(\d+):(\d+)$/);
  if(eventMatch){
    const n=Number(eventMatch[2]);
    return Number.isSafeInteger(n)&&n>0?n:null;
  }
  const sourceMatch=String(sourceIdentity||'').match(/\|(\d+)->[^\n]*\|(\d+)$/);
  if(sourceMatch){
    const n=Number(sourceMatch[2]);
    return Number.isSafeInteger(n)&&n>0?n:null;
  }
  return null;
}

async function readRegistry(root){
  return JSON.parse(await fs.readFile(path.join(root,ONCHAIN_PRICE_REGISTRY_REPO_PATH),'utf8'));
}

async function exactHistoricalBaseChainlinkQuoteUsd({
  quoteRoute,
  sourceBlockNumber,
  boundaryAt,
  network,
  rpcCall,
  fetchImpl=fetch
}={}){
  if(!quoteRoute||!/^0x[0-9a-f]{40}$/i.test(String(quoteRoute.chainlinkFeed||''))){
    return{ok:false,status:'historical-aerodrome-quote-route-invalid',assetId:quoteRoute?.assetId||null};
  }
  if(!Number.isSafeInteger(Number(sourceBlockNumber))||Number(sourceBlockNumber)<=0){
    return{ok:false,status:'invalid-source-block',assetId:quoteRoute.assetId};
  }
  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary',assetId:quoteRoute.assetId};
  if(Number(network?.chainId)!==8453||!Array.isArray(network?.rpcFailover)||network.rpcFailover.length===0){
    return{ok:false,status:'base-historical-rpc-fabric-unavailable',assetId:quoteRoute.assetId};
  }
  if(typeof rpcCall!=='function')return{ok:false,status:'historical-rpc-call-unavailable',assetId:quoteRoute.assetId};

  const blockTag=hexQuantity(sourceBlockNumber),attempts=[];
  for(const endpoint of network.rpcFailover){
    try{
      const block=await rpcCall({endpoint,method:'eth_getBlockByNumber',params:[blockTag,false],fetchImpl});
      if(lower(block?.number)!==lower(blockTag))return{ok:false,status:'closing-block-rpc-mismatch',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      const blockTimestampSeconds=Number(BigInt(block?.timestamp||'0x0'));
      const blockTimestampMs=blockTimestampSeconds*1000;
      if(!(Number.isFinite(blockTimestampMs)&&blockTimestampMs>0))return{ok:false,status:'historical-chainlink-block-time-invalid',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      if(blockTimestampMs>boundaryMs)return{ok:false,status:'historical-chainlink-block-after-accounting-boundary',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      const boundaryLagSeconds=(boundaryMs-blockTimestampMs)/1000;
      if(boundaryLagSeconds>MAX_BOUNDARY_BLOCK_LAG_SECONDS){
        return{ok:false,status:'historical-chainlink-block-too-far-from-accounting-boundary',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber),boundaryLagSeconds:Number(boundaryLagSeconds.toFixed(3))};
      }

      const[decimalsHex,roundHex]=await Promise.all([
        rpcCall({endpoint,method:'eth_call',params:[{to:quoteRoute.chainlinkFeed,data:'0x313ce567'},blockTag],fetchImpl}),
        rpcCall({endpoint,method:'eth_call',params:[{to:quoteRoute.chainlinkFeed,data:'0xfeaf968c'},blockTag],fetchImpl})
      ]);
      const decimals=Number(decodeUint256(decimalsHex));
      if(!Number.isInteger(decimals)||decimals<0||decimals>36)return{ok:false,status:'historical-chainlink-decimals-invalid',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      const round=decodeChainlinkRoundData(roundHex);
      if(!(round.answer>0n)||round.roundId<=0n||round.answeredInRound<round.roundId){
        return{ok:false,status:'historical-chainlink-round-integrity-invalid',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      }
      const observedAtMs=Number(round.updatedAt)*1000;
      if(!(Number.isFinite(observedAtMs)&&observedAtMs>0)||observedAtMs>blockTimestampMs||observedAtMs>boundaryMs){
        return{ok:false,status:'historical-chainlink-observation-time-invalid',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      }
      const ageSeconds=(boundaryMs-observedAtMs)/1000;
      if(ageSeconds>Number(quoteRoute.maxAgeSeconds)){
        return{ok:false,status:'historical-onchain-chainlink-price-stale',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber),observedAt:new Date(observedAtMs).toISOString(),ageSeconds:Number(ageSeconds.toFixed(3)),maxAgeSeconds:Number(quoteRoute.maxAgeSeconds)};
      }
      const priceUsd=Number(round.answer)/10**decimals;
      if(!(Number.isFinite(priceUsd)&&priceUsd>0))return{ok:false,status:'historical-chainlink-price-not-finite-positive',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber)};
      return{
        ok:true,status:'historical-onchain-chainlink-price',sourceFamily:'historical-onchain-chainlink-at-boundary',
        assetId:quoteRoute.assetId,symbol:quoteRoute.symbol,priceUsd,
        observedAt:new Date(observedAtMs).toISOString(),ageMinutes:Number((ageSeconds/60).toFixed(6)),maxAgeMinutes:Number((Number(quoteRoute.maxAgeSeconds)/60).toFixed(6)),
        chainId:8453,sourceBlockNumber:Number(sourceBlockNumber),sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),
        sourceContract:quoteRoute.chainlinkFeed,roundId:round.roundId.toString(),answeredInRound:round.answeredInRound.toString(),
        rpcEndpointId:endpoint?.id||null,exactHistoricalBlock:true,stablecoinPegAssumptionUsed:false,currentPriceUsed:false,referenceAprUsed:false,
        executionAuthority:'none'
      };
    }catch(error){
      attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});
    }
  }
  return{ok:false,status:'historical-aerodrome-quote-chainlink-rpc-unavailable',assetId:quoteRoute.assetId,sourceBlockNumber:Number(sourceBlockNumber),attempts};
}

export async function historicalBaseAerodromeDiscoveredPriceAtBoundary({
  token,
  boundaryAt,
  eventKey=null,
  sourceIdentity=null,
  root,
  onchainRegistry=null,
  rpcCall,
  fetchImpl=fetch,
  usdcUsdResolver
}={}){
  if(!isHistoricalAerodromeVe33Identity({eventKey,sourceIdentity})){
    return{ok:false,status:'historical-aerodrome-discovery-identity-not-eligible',assetId:null};
  }
  const sourceBlockNumber=closingBlockFromHistoricalAerodromeIdentity({eventKey,sourceIdentity});
  if(!sourceBlockNumber)return{ok:false,status:'ve33-closing-block-proof-missing',assetId:null};

  let registry=onchainRegistry;
  try{
    if(!registry)registry=await readRegistry(root);
  }catch(error){
    return{ok:false,status:'onchain-price-registry-unavailable',assetId:null,sourceBlockNumber,error:error?.message||String(error)};
  }
  const network=registry?.networks?.base;
  const attempts=[];

  for(const quoteRoute of HISTORICAL_AERODROME_APPROVED_QUOTE_ROUTES){
    const route=await discoverHistoricalAerodromeUsdcRoute({
      token,
      sourceBlockNumber,
      boundaryAt,
      network,
      rpcCall,
      fetchImpl,
      quoteToken:quoteRoute.token,
      quoteTokenDecimals:quoteRoute.decimals
    });
    if(route?.ok!==true){
      attempts.push({quoteToken:quoteRoute.token,quoteSymbol:quoteRoute.symbol,routeStatus:route?.status||null});
      continue;
    }

    let quoteUsd;
    if(quoteRoute.canonicalResolver){
      if(typeof usdcUsdResolver!=='function'){
        attempts.push({quoteToken:quoteRoute.token,quoteSymbol:quoteRoute.symbol,routeStatus:route.status,quoteStatus:'historical-aerodrome-usdc-usd-resolver-missing'});
        continue;
      }
      quoteUsd=await usdcUsdResolver({
        token:quoteRoute.token,
        boundaryAt,
        eventKey,
        sourceIdentity,
        root,
        onchainRegistry:registry,
        rpcCall,
        fetchImpl
      });
    }else{
      quoteUsd=await exactHistoricalBaseChainlinkQuoteUsd({quoteRoute,sourceBlockNumber,boundaryAt,network,rpcCall,fetchImpl});
    }

    if(quoteUsd?.ok!==true){
      attempts.push({quoteToken:quoteRoute.token,quoteSymbol:quoteRoute.symbol,routeStatus:route.status,quoteStatus:quoteUsd?.status||null,quoteAssetId:quoteUsd?.assetId||null});
      continue;
    }
    if(
      lower(quoteUsd.sourceContract)!==lower(quoteRoute.chainlinkFeed)||
      Number(quoteUsd.sourceBlockNumber)!==Number(sourceBlockNumber)||
      Number(quoteUsd.chainId)!==8453
    ){
      attempts.push({quoteToken:quoteRoute.token,quoteSymbol:quoteRoute.symbol,routeStatus:route.status,quoteStatus:'historical-aerodrome-quote-token-proof-mismatch'});
      continue;
    }

    const priceUsd=Number(route.quoteTokenAmount)*Number(quoteUsd.priceUsd);
    if(!(Number.isFinite(priceUsd)&&priceUsd>0)){
      attempts.push({quoteToken:quoteRoute.token,quoteSymbol:quoteRoute.symbol,routeStatus:route.status,quoteStatus:'historical-aerodrome-derived-price-not-finite-positive'});
      continue;
    }

    return{
      ok:true,
      status:'historical-onchain-aerodrome-discovered-twap-chainlink-price',
      sourceFamily:'historical-onchain-aerodrome-twap-chainlink-at-boundary',
      assetId:null,
      symbol:null,
      priceUsd,
      observedAt:quoteUsd.observedAt,
      ageMinutes:quoteUsd.ageMinutes,
      maxAgeMinutes:quoteUsd.maxAgeMinutes,
      chainId:8453,
      sourceBlockNumber:Number(sourceBlockNumber),
      sourceBlockTimestamp:route.sourceBlockTimestamp,
      sourceContract:route.pool,
      rpcEndpointId:route.rpcEndpointId||null,
      exactHistoricalBlock:true,
      poolFactory:route.factory,
      tickSpacing:route.tickSpacing,
      routeSelection:route.routeSelection,
      routeCandidateCount:route.candidateCount,
      poolToken0:route.token0,
      poolToken1:route.token1,
      poolLiquidity:route.liquidity,
      rewardToken:route.token,
      rewardTokenDecimals:route.tokenDecimals,
      quoteToken:route.quoteToken,
      quoteTokenSymbol:quoteRoute.symbol,
      quoteTokenAmount:route.quoteTokenAmount,
      twapSeconds:route.twapSeconds,
      averageTick:route.averageTick,
      quoteChainlinkContract:quoteUsd.sourceContract,
      quoteRoundId:quoteUsd.roundId,
      quoteAnsweredInRound:quoteUsd.answeredInRound,
      quoteObservedAt:quoteUsd.observedAt,
      quotePriceUsd:quoteUsd.priceUsd,
      quoteAssetId:quoteUsd.assetId||quoteRoute.assetId,
      quoteRoutePriority:HISTORICAL_AERODROME_APPROVED_QUOTE_ROUTES.findIndex(x=>lower(x.token)===lower(quoteRoute.token)),
      sourceFile:'reporting/historical-aerodrome-discovered-price.mjs',
      priceSource:'onchain-aerodrome-slipstream-factory-discovered-twap-plus-chainlink-quote-exact-historical-block',
      stablecoinPegAssumptionUsed:false,
      currentPriceUsed:false,
      referenceAprUsed:false,
      executionAuthority:'none'
    };
  }

  return{
    ok:false,status:'historical-aerodrome-approved-quote-routes-unavailable',assetId:null,
    sourceBlockNumber:Number(sourceBlockNumber),approvedQuoteCount:HISTORICAL_AERODROME_APPROVED_QUOTE_ROUTES.length,attempts
  };
}
