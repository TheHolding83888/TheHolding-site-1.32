#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,
  OPTIMISM_NATIVE_USDC_CHAINLINK_FEED,
  isHistoricalVelodromeVe33Identity,
  closingBlockFromHistoricalVe33Identity,
  historicalOptimismVelodromeDiscoveredPriceAtBoundary
} from './historical-velodrome-discovered-price.mjs';
import {
  SELECTORS,
  OPTIMISM_VELODROME_V2_FACTORY,
  OPTIMISM_NATIVE_USDC,
  encodeGetPool
} from './historical-velodrome-usdc-route.mjs';

assert.equal(VERSION,'0.1-velodrome-discovered-twap-plus-chainlink-usd');
assert.equal(isHistoricalVelodromeVe33Identity({eventKey:'ve33:velodrome|x:1:2'}),true);
assert.equal(isHistoricalVelodromeVe33Identity({eventKey:'ve33:aerodrome|x:1:2'}),false);
assert.equal(closingBlockFromHistoricalVe33Identity({eventKey:'ve33:velodrome|x:123:456'}),456);

const reward='0x1111111111111111111111111111111111111111';
const pool='0x2222222222222222222222222222222222222222';
const block=156311011;
const boundary='2026-09-01T00:00:00.000Z';
const boundarySeconds=Math.floor(Date.parse(boundary)/1000);
const blockTag=`0x${BigInt(block).toString(16)}`;
const eventKey=`ve33:velodrome|owner|token|lane|reward:${block-100}:${block}`;
const network={chainId:10,rpcFailover:[{id:'test-optimism',url:'https://optimism.example'}]};
const registry={networks:{optimism:network}};
const word=value=>BigInt(value).toString(16).padStart(64,'0');
const addressWord=value=>String(value).toLowerCase().replace(/^0x/,'').padStart(64,'0');
const addressResult=value=>`0x${addressWord(value)}`;
const uintResult=value=>`0x${word(value)}`;
const boolResult=value=>uintResult(value?1:0);
const getPoolFalse=encodeGetPool(reward,OPTIMISM_NATIVE_USDC,false).toLowerCase();
const getPoolTrue=encodeGetPool(reward,OPTIMISM_NATIVE_USDC,true).toLowerCase();

const rpcCall=async({endpoint,method,params})=>{
  assert.equal(endpoint.id,'test-optimism');
  if(method==='eth_getBlockByNumber'){
    assert.equal(params[0],blockTag);
    return{number:blockTag,timestamp:`0x${BigInt(boundarySeconds-2).toString(16)}`};
  }
  assert.equal(method,'eth_call');
  assert.equal(params[1],blockTag,'all discovered-route reads must stay on the exact close block');
  const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
  if(to===reward.toLowerCase()&&data===SELECTORS.decimals)return uintResult(18);
  if(to===OPTIMISM_VELODROME_V2_FACTORY.toLowerCase()){
    if(data===getPoolFalse)return addressResult(pool);
    if(data===getPoolTrue)return addressResult('0x0000000000000000000000000000000000000000');
  }
  if(to===pool.toLowerCase()){
    if(data===SELECTORS.token0)return addressResult(reward);
    if(data===SELECTORS.token1)return addressResult(OPTIMISM_NATIVE_USDC);
    if(data===SELECTORS.stable)return boolResult(false);
    if(data===SELECTORS.observationLength)return uintResult(96);
    if(data.startsWith(SELECTORS.quote))return uintResult(1250000n);
  }
  throw new Error(`unexpected call ${to} ${data}`);
};

let resolverCalls=0;
const usdcUsdResolver=async args=>{
  resolverCalls+=1;
  assert.equal(args.token.toLowerCase(),OPTIMISM_NATIVE_USDC.toLowerCase());
  assert.equal(args.eventKey,eventKey);
  assert.equal(args.onchainRegistry,registry);
  return{
    ok:true,status:'historical-onchain-chainlink-price',assetId:'usd-coin',symbol:'USDC',
    priceUsd:0.9998,observedAt:'2026-08-31T23:59:30.000Z',ageMinutes:0.5,maxAgeMinutes:1500,
    chainId:10,sourceBlockNumber:block,sourceContract:OPTIMISM_NATIVE_USDC_CHAINLINK_FEED,
    roundId:'123',answeredInRound:'123'
  };
};

const result=await historicalOptimismVelodromeDiscoveredPriceAtBoundary({
  token:reward,boundaryAt:boundary,eventKey,onchainRegistry:registry,rpcCall,usdcUsdResolver
});
assert.equal(result.ok,true);
assert.equal(result.status,'historical-onchain-velodrome-discovered-twap-chainlink-price');
assert.equal(result.sourceContract.toLowerCase(),pool.toLowerCase());
assert.equal(result.quoteTokenAmount,1.25);
assert.equal(result.priceUsd,1.25*0.9998);
assert.equal(result.sourceBlockNumber,block);
assert.equal(result.quoteChainlinkContract.toLowerCase(),OPTIMISM_NATIVE_USDC_CHAINLINK_FEED.toLowerCase());
assert.equal(result.exactHistoricalBlock,true);
assert.equal(result.stablecoinPegAssumptionUsed,false);
assert.equal(result.currentPriceUsed,false);
assert.equal(result.referenceAprUsed,false);
assert.equal(result.executionAuthority,'none');
assert.equal(resolverCalls,1);

resolverCalls=0;
const ineligible=await historicalOptimismVelodromeDiscoveredPriceAtBoundary({
  token:reward,boundaryAt:boundary,eventKey:`ve33:aerodrome|owner|token|lane|reward:${block-100}:${block}`,
  onchainRegistry:registry,rpcCall,usdcUsdResolver
});
assert.equal(ineligible.ok,false);
assert.equal(ineligible.status,'historical-velodrome-discovery-identity-not-eligible');
assert.equal(resolverCalls,0,'non-Velodrome identities must never enter discovered historical pricing');

const mismatchedQuote=await historicalOptimismVelodromeDiscoveredPriceAtBoundary({
  token:reward,boundaryAt:boundary,eventKey,onchainRegistry:registry,rpcCall,
  usdcUsdResolver:async()=>({ok:true,priceUsd:1,chainId:10,sourceBlockNumber:block-1,sourceContract:OPTIMISM_NATIVE_USDC_CHAINLINK_FEED})
});
assert.equal(mismatchedQuote.ok,false);
assert.equal(mismatchedQuote.status,'historical-velodrome-quote-token-proof-mismatch');

console.log('Historical Velodrome discovered reward USD composition validation OK');
