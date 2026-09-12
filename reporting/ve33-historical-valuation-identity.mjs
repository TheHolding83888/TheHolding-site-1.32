#!/usr/bin/env node
import {
  canonicalAssetIdForHistoricalToken,
  historicalChainlinkRouteForToken,
  historicalOptimismVelodromeTwapRouteForToken,
  historicalBaseSlipstreamTwapRouteForToken
} from './historical-canonical-price.mjs';

const lower=v=>String(v||'').toLowerCase();
const address=/^0x[0-9a-f]{40}$/i;

export function ve33EventIdentity(event){
  const eventKey=String(event?.eventKey||'');
  const match=eventKey.match(/^ve33:(.+):(\d+):(\d+)$/);
  if(!match)return{ok:false,status:'ve33-event-key-identity-invalid',token:null};
  const laneKey=match[1],openBlock=Number(match[2]),closeBlock=Number(match[3]);
  if(!Number.isSafeInteger(openBlock)||openBlock<=0||!Number.isSafeInteger(closeBlock)||closeBlock<=openBlock){
    return{ok:false,status:'ve33-event-block-identity-invalid',token:null};
  }
  const laneParts=laneKey.split('|');
  const token=lower(laneParts.at(-1));
  if(laneParts.length<7||!address.test(token))return{ok:false,status:'ve33-event-token-identity-invalid',token:null};
  const expectedSourceIdentity=`${laneKey}|${openBlock}->${laneKey}|${closeBlock}`;
  if(String(event?.sourceIdentity||'')!==expectedSourceIdentity){
    return{ok:false,status:'ve33-source-identity-parity-invalid',token,openBlock,closeBlock,laneKey};
  }
  return{
    ok:true,status:'ve33-identity-bound',token,openBlock,closeBlock,laneKey,
    eventTokenMatchesIdentity:address.test(String(event?.token||''))&&lower(event.token)===token,
    expectedSourceIdentity
  };
}

export function historicalValuationSourceMatchesVe33Identity(event,resolution){
  const identity=ve33EventIdentity(event);
  if(!identity.ok)return false;
  if(resolution?.identityBound===true&&lower(resolution?.identityToken)!==identity.token)return false;
  const family=String(resolution?.sourceFamily||'');
  if(family==='canonical-market-data-git-history'){
    const expectedAssetId=canonicalAssetIdForHistoricalToken(identity.token);
    return Boolean(expectedAssetId)&&
      String(resolution?.sourceAssetId||'')===expectedAssetId&&
      String(resolution?.sourceStatus||'')==='historical-canonical-market-price';
  }
  if(family==='historical-onchain-chainlink-at-boundary'){
    // Exact Chainlink proofs are chain-bound as well as token-bound: a proof
    // produced on one network can never satisfy the same token identity on another.
    const route=historicalChainlinkRouteForToken(identity.token,event?.chainId);
    return Boolean(route)&&
      Number(event?.chainId)===Number(route.chainId)&&
      Number(resolution?.sourceChainId)===Number(route.chainId)&&
      String(resolution?.sourceAssetId||'')===String(route.assetId)&&
      lower(resolution?.sourceContract)===lower(route.contract)&&
      resolution?.stablecoinPegAssumptionUsed!==true&&
      String(resolution?.sourceStatus||'')==='historical-onchain-chainlink-price';
  }
  if(family==='historical-onchain-velodrome-twap-chainlink-at-boundary'){
    const route=historicalOptimismVelodromeTwapRouteForToken(identity.token);
    return Boolean(route)&&
      Number(event?.chainId)===Number(route.chainId)&&
      Number(resolution?.sourceChainId)===Number(route.chainId)&&
      String(resolution?.sourceAssetId||'')===String(route.assetId)&&
      lower(resolution?.sourceContract)===lower(route.pool)&&
      lower(resolution?.quoteToken)===lower(route.quoteToken)&&
      lower(resolution?.quoteChainlinkContract)===lower(route.quoteChainlinkFeed)&&
      Number(resolution?.twapGranularity)===Number(route.twapGranularity)&&
      resolution?.poolStable===route.poolStable&&
      resolution?.stablecoinPegAssumptionUsed===false&&
      String(resolution?.sourceStatus||'')==='historical-onchain-velodrome-twap-chainlink-price';
  }
  if(family==='historical-onchain-slipstream-twap-chainlink-at-boundary'){
    const route=historicalBaseSlipstreamTwapRouteForToken(identity.token);
    const pair=new Set([lower(resolution?.poolToken0),lower(resolution?.poolToken1)]);
    return Boolean(route)&&
      Number(event?.chainId)===Number(route.chainId)&&
      Number(resolution?.sourceChainId)===Number(route.chainId)&&
      String(resolution?.sourceAssetId||'')===String(route.assetId)&&
      lower(resolution?.sourceContract)===lower(route.pool)&&
      lower(resolution?.quoteToken)===lower(route.quoteToken)&&
      lower(resolution?.quoteChainlinkContract)===lower(route.quoteChainlinkFeed)&&
      Number(resolution?.twapSeconds)===Number(route.twapSeconds)&&
      Number.isSafeInteger(Number(resolution?.averageTick))&&
      pair.size===2&&pair.has(lower(route.token))&&pair.has(lower(route.quoteToken))&&
      resolution?.stablecoinPegAssumptionUsed===false&&
      String(resolution?.sourceStatus||'')==='historical-onchain-slipstream-twap-chainlink-price';
  }
  return false;
}
