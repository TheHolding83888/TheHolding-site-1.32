#!/usr/bin/env node
import {
  canonicalAssetIdForHistoricalToken,
  historicalChainlinkRouteForToken,
  historicalOptimismVelodromeTwapRouteForToken,
  historicalBaseSlipstreamTwapRouteForToken
} from './historical-canonical-price.mjs';
import {
  AERODROME_SLIPSTREAM_FACTORIES, CANONICAL_TICK_SPACINGS, DEFAULT_TWAP_SECONDS
} from './historical-aerodrome-usdc-route.mjs';
import { historicalAerodromeApprovedQuoteRouteForToken } from './historical-aerodrome-discovered-price.mjs';
import {
  OPTIMISM_VELODROME_V2_FACTORY, OPTIMISM_NATIVE_USDC, DEFAULT_TWAP_GRANULARITY
} from './historical-velodrome-usdc-route.mjs';
import { OPTIMISM_NATIVE_USDC_CHAINLINK_FEED } from './historical-velodrome-discovered-price.mjs';

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
  if(family==='historical-onchain-aerodrome-twap-chainlink-at-boundary'){
    const pair=new Set([lower(resolution?.poolToken0),lower(resolution?.poolToken1)]);
    const factoryOk=AERODROME_SLIPSTREAM_FACTORIES.map(lower).includes(lower(resolution?.poolFactory));
    const spacingOk=CANONICAL_TICK_SPACINGS.includes(Number(resolution?.tickSpacing));
    const quoteRoute=historicalAerodromeApprovedQuoteRouteForToken(resolution?.quoteToken);
    return Boolean(quoteRoute)&&
      Number(event?.chainId)===8453&&Number(resolution?.sourceChainId)===8453&&
      lower(resolution?.rewardToken)===identity.token&&factoryOk&&spacingOk&&
      String(resolution?.routeSelection||'')==='highest-active-liquidity-at-historical-boundary'&&
      Number.isInteger(Number(resolution?.routeCandidateCount))&&Number(resolution?.routeCandidateCount)>=1&&
      pair.size===2&&pair.has(identity.token)&&pair.has(lower(quoteRoute.token))&&
      lower(resolution?.quoteToken)===lower(quoteRoute.token)&&
      String(resolution?.quoteTokenSymbol||'')===String(quoteRoute.symbol)&&
      lower(resolution?.quoteChainlinkContract)===lower(quoteRoute.chainlinkFeed)&&
      Number(resolution?.twapSeconds)===Number(DEFAULT_TWAP_SECONDS)&&Number.isSafeInteger(Number(resolution?.averageTick))&&
      resolution?.stablecoinPegAssumptionUsed===false&&
      String(resolution?.sourceStatus||'')==='historical-onchain-aerodrome-discovered-twap-chainlink-price';
  }
  if(family==='historical-onchain-velodrome-discovered-twap-chainlink-at-boundary'){
    const pair=new Set([lower(resolution?.poolToken0),lower(resolution?.poolToken1)]);
    return Number(event?.chainId)===10&&Number(resolution?.sourceChainId)===10&&
      lower(resolution?.rewardToken)===identity.token&&
      lower(resolution?.poolFactory)===lower(OPTIMISM_VELODROME_V2_FACTORY)&&
      pair.size===2&&pair.has(identity.token)&&pair.has(lower(OPTIMISM_NATIVE_USDC))&&
      lower(resolution?.quoteToken)===lower(OPTIMISM_NATIVE_USDC)&&
      lower(resolution?.quoteChainlinkContract)===lower(OPTIMISM_NATIVE_USDC_CHAINLINK_FEED)&&
      Number(resolution?.twapGranularity)===Number(DEFAULT_TWAP_GRANULARITY)&&
      Number.isSafeInteger(Number(resolution?.observationLength))&&Number(resolution?.observationLength)>Number(DEFAULT_TWAP_GRANULARITY)&&
      typeof resolution?.poolStable==='boolean'&&resolution?.stablecoinPegAssumptionUsed===false&&
      String(resolution?.sourceStatus||'')==='historical-onchain-velodrome-discovered-twap-chainlink-price';
  }
  return false;
}
