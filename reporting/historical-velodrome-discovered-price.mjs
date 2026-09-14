#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  discoverHistoricalVelodromeUsdcRoute,
  OPTIMISM_NATIVE_USDC
} from './historical-velodrome-usdc-route.mjs';

export const VERSION='0.1-velodrome-discovered-twap-plus-chainlink-usd';
export const ONCHAIN_PRICE_REGISTRY_REPO_PATH='intelligence/market-data/onchain-price-source-registry.json';
export const OPTIMISM_NATIVE_USDC_CHAINLINK_FEED='0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3';

const lower=value=>String(value||'').toLowerCase();

export function isHistoricalVelodromeVe33Identity({eventKey,sourceIdentity}={}){
  const event=String(eventKey||'').toLowerCase();
  const source=String(sourceIdentity||'').toLowerCase();
  return event.startsWith('ve33:velodrome|')||source.startsWith('velodrome|');
}

export function closingBlockFromHistoricalVe33Identity({eventKey,sourceIdentity}={}){
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

export async function historicalOptimismVelodromeDiscoveredPriceAtBoundary({
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
  if(!isHistoricalVelodromeVe33Identity({eventKey,sourceIdentity})){
    return{ok:false,status:'historical-velodrome-discovery-identity-not-eligible',assetId:null};
  }
  const sourceBlockNumber=closingBlockFromHistoricalVe33Identity({eventKey,sourceIdentity});
  if(!sourceBlockNumber)return{ok:false,status:'ve33-closing-block-proof-missing',assetId:null};
  if(typeof usdcUsdResolver!=='function')return{ok:false,status:'historical-velodrome-usdc-usd-resolver-missing',assetId:null,sourceBlockNumber};

  let registry=onchainRegistry;
  try{
    if(!registry)registry=await readRegistry(root);
  }catch(error){
    return{ok:false,status:'onchain-price-registry-unavailable',assetId:null,sourceBlockNumber,error:error?.message||String(error)};
  }
  const network=registry?.networks?.optimism;
  const route=await discoverHistoricalVelodromeUsdcRoute({
    token,
    sourceBlockNumber,
    boundaryAt,
    network,
    rpcCall,
    fetchImpl
  });
  if(route?.ok!==true)return{...route,assetId:null};

  const quoteUsd=await usdcUsdResolver({
    token:OPTIMISM_NATIVE_USDC,
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
      ok:false,status:'historical-velodrome-quote-token-usd-unavailable',assetId:null,sourceBlockNumber,
      quoteStatus:quoteUsd?.status||null,quoteAssetId:quoteUsd?.assetId||null
    };
  }
  if(
    lower(quoteUsd.sourceContract)!==lower(OPTIMISM_NATIVE_USDC_CHAINLINK_FEED)||
    Number(quoteUsd.sourceBlockNumber)!==Number(sourceBlockNumber)||
    Number(quoteUsd.chainId)!==10
  ){
    return{ok:false,status:'historical-velodrome-quote-token-proof-mismatch',assetId:null,sourceBlockNumber};
  }

  const priceUsd=Number(route.quoteTokenAmount)*Number(quoteUsd.priceUsd);
  if(!(Number.isFinite(priceUsd)&&priceUsd>0)){
    return{ok:false,status:'historical-velodrome-derived-price-not-finite-positive',assetId:null,sourceBlockNumber};
  }

  return{
    ok:true,
    status:'historical-onchain-velodrome-discovered-twap-chainlink-price',
    sourceFamily:'historical-onchain-velodrome-twap-chainlink-at-boundary',
    assetId:null,
    symbol:null,
    priceUsd,
    observedAt:quoteUsd.observedAt,
    ageMinutes:quoteUsd.ageMinutes,
    maxAgeMinutes:quoteUsd.maxAgeMinutes,
    chainId:10,
    sourceBlockNumber:Number(sourceBlockNumber),
    sourceBlockTimestamp:route.sourceBlockTimestamp,
    sourceContract:route.pool,
    rpcEndpointId:route.rpcEndpointId||null,
    exactHistoricalBlock:true,
    poolFactory:route.factory,
    poolStable:route.poolStable,
    poolToken0:route.token0,
    poolToken1:route.token1,
    rewardToken:route.token,
    rewardTokenDecimals:route.tokenDecimals,
    quoteToken:route.quoteToken,
    quoteTokenSymbol:'USDC',
    quoteAmountOutRaw:route.quoteAmountOutRaw,
    quoteTokenAmount:route.quoteTokenAmount,
    twapGranularity:route.twapGranularity,
    observationLength:route.observationLength,
    quoteChainlinkContract:quoteUsd.sourceContract,
    quoteRoundId:quoteUsd.roundId,
    quoteAnsweredInRound:quoteUsd.answeredInRound,
    quoteObservedAt:quoteUsd.observedAt,
    quotePriceUsd:quoteUsd.priceUsd,
    sourceFile:'reporting/historical-velodrome-discovered-price.mjs',
    priceSource:'onchain-velodrome-v2-factory-discovered-twap-plus-chainlink-quote-exact-historical-block',
    stablecoinPegAssumptionUsed:false,
    currentPriceUsed:false,
    referenceAprUsed:false,
    executionAuthority:'none'
  };
}
