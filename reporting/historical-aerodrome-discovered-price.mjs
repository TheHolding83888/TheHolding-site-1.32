#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  discoverHistoricalAerodromeUsdcRoute,
  BASE_NATIVE_USDC
} from './historical-aerodrome-usdc-route.mjs';

export const VERSION='0.1-aerodrome-discovered-twap-plus-chainlink-usd';
export const ONCHAIN_PRICE_REGISTRY_REPO_PATH='intelligence/market-data/onchain-price-source-registry.json';
export const BASE_NATIVE_USDC_CHAINLINK_FEED='0x7e860098F58bBFC8648a4311b374B1D669a2bc6B';

const lower=value=>String(value||'').toLowerCase();

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
  if(typeof usdcUsdResolver!=='function')return{ok:false,status:'historical-aerodrome-usdc-usd-resolver-missing',assetId:null,sourceBlockNumber};

  let registry=onchainRegistry;
  try{
    if(!registry)registry=await readRegistry(root);
  }catch(error){
    return{ok:false,status:'onchain-price-registry-unavailable',assetId:null,sourceBlockNumber,error:error?.message||String(error)};
  }
  const network=registry?.networks?.base;
  const route=await discoverHistoricalAerodromeUsdcRoute({
    token,
    sourceBlockNumber,
    boundaryAt,
    network,
    rpcCall,
    fetchImpl
  });
  if(route?.ok!==true)return{...route,assetId:null};

  const quoteUsd=await usdcUsdResolver({
    token:BASE_NATIVE_USDC,
    boundaryAt,
    eventKey,
    sourceIdentity,
    root,
    onchainRegistry:registry,
    rpcCall,
    fetchImpl
  });
  if(quoteUsd?.ok!==true){
    return{
      ok:false,status:'historical-aerodrome-quote-token-usd-unavailable',assetId:null,sourceBlockNumber,
      quoteStatus:quoteUsd?.status||null,quoteAssetId:quoteUsd?.assetId||null
    };
  }
  if(
    lower(quoteUsd.sourceContract)!==lower(BASE_NATIVE_USDC_CHAINLINK_FEED)||
    Number(quoteUsd.sourceBlockNumber)!==Number(sourceBlockNumber)||
    Number(quoteUsd.chainId)!==8453
  ){
    return{ok:false,status:'historical-aerodrome-quote-token-proof-mismatch',assetId:null,sourceBlockNumber};
  }

  const priceUsd=Number(route.quoteTokenAmount)*Number(quoteUsd.priceUsd);
  if(!(Number.isFinite(priceUsd)&&priceUsd>0)){
    return{ok:false,status:'historical-aerodrome-derived-price-not-finite-positive',assetId:null,sourceBlockNumber};
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
    quoteTokenSymbol:'USDC',
    quoteTokenAmount:route.quoteTokenAmount,
    twapSeconds:route.twapSeconds,
    averageTick:route.averageTick,
    quoteChainlinkContract:quoteUsd.sourceContract,
    quoteRoundId:quoteUsd.roundId,
    quoteAnsweredInRound:quoteUsd.answeredInRound,
    quoteObservedAt:quoteUsd.observedAt,
    quotePriceUsd:quoteUsd.priceUsd,
    sourceFile:'reporting/historical-aerodrome-discovered-price.mjs',
    priceSource:'onchain-aerodrome-slipstream-factory-discovered-twap-plus-chainlink-quote-exact-historical-block',
    stablecoinPegAssumptionUsed:false,
    currentPriceUsed:false,
    referenceAprUsed:false,
    executionAuthority:'none'
  };
}
