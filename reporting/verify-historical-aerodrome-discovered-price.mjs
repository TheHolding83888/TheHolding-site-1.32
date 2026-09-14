#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  AERODROME_SLIPSTREAM_FACTORIES,
  BASE_NATIVE_USDC,
  SELECTORS,
  encodeGetPool,
  discoverHistoricalAerodromeUsdcRoute
} from './historical-aerodrome-usdc-route.mjs';
import {
  BASE_NATIVE_USDC_CHAINLINK_FEED,
  historicalBaseAerodromeDiscoveredPriceAtBoundary,
  isHistoricalAerodromeVe33Identity
} from './historical-aerodrome-discovered-price.mjs';

const TOKEN='0x1111111111111111111111111111111111111111';
const POOL_HIGH='0x2222222222222222222222222222222222222222';
const POOL_LOW='0x3333333333333333333333333333333333333333';
const SOURCE_BLOCK=12345;
const BLOCK_AT='2026-09-14T09:10:00.000Z';
const BOUNDARY_AT='2026-09-14T09:10:10.000Z';
const EVENT_KEY=`ve33:aerodrome|mock:1:${SOURCE_BLOCK}`;

const word=value=>{
  const n=BigInt(value),mod=1n<<256n,v=n<0n?mod+n:n;
  return v.toString(16).padStart(64,'0');
};
const addressResult=value=>`0x${String(value).toLowerCase().replace(/^0x/,'').padStart(64,'0')}`;
const uintResult=value=>`0x${word(value)}`;
const observeResult=avgTick=>{
  const cumulative=BigInt(avgTick)*300n;
  // observe(uint32[]) returns (int56[] tickCumulatives, uint160[] secondsPerLiquidity...)
  // The production decoder needs only the first dynamic array, while this mock
  // still emits valid offsets and a second empty array.
  return `0x${word(64)}${word(160)}${word(2)}${word(0)}${word(cumulative)}${word(0)}`;
};

const factory=AERODROME_SLIPSTREAM_FACTORIES[0];
const getPoolHigh=encodeGetPool(TOKEN,BASE_NATIVE_USDC,50).toLowerCase();
const getPoolLow=encodeGetPool(TOKEN,BASE_NATIVE_USDC,200).toLowerCase();
const blockTimestamp=Math.floor(Date.parse(BLOCK_AT)/1000);

async function rpcCall({method,params}){
  if(method==='eth_getBlockByNumber')return{number:'0x3039',timestamp:`0x${blockTimestamp.toString(16)}`};
  assert.equal(method,'eth_call');
  const[{to,data}]=params,toLower=String(to).toLowerCase(),call=String(data).toLowerCase();
  if(toLower===TOKEN.toLowerCase()&&call===SELECTORS.decimals)return uintResult(18);
  if(toLower===factory.toLowerCase()){
    if(call===getPoolHigh)return addressResult(POOL_HIGH);
    if(call===getPoolLow)return addressResult(POOL_LOW);
    if(call.startsWith(SELECTORS.getPool))return addressResult('0x0000000000000000000000000000000000000000');
  }
  if(AERODROME_SLIPSTREAM_FACTORIES.some(x=>x.toLowerCase()===toLower)&&call.startsWith(SELECTORS.getPool)){
    return addressResult('0x0000000000000000000000000000000000000000');
  }
  if([POOL_HIGH,POOL_LOW].some(x=>x.toLowerCase()===toLower)){
    if(call===SELECTORS.token0)return addressResult(TOKEN);
    if(call===SELECTORS.token1)return addressResult(BASE_NATIVE_USDC);
    if(call===SELECTORS.liquidity)return uintResult(toLower===POOL_HIGH.toLowerCase()?1000:500);
    if(call.startsWith(SELECTORS.observe))return observeResult(-276324);
  }
  throw new Error(`unexpected mock RPC call ${method} ${to} ${data}`);
}

const network={chainId:8453,rpcFailover:[{id:'mock-base-archive',url:'mock://base'}]};
const route=await discoverHistoricalAerodromeUsdcRoute({
  token:TOKEN,sourceBlockNumber:SOURCE_BLOCK,boundaryAt:BOUNDARY_AT,network,rpcCall
});
assert.equal(route.ok,true);
assert.equal(route.pool.toLowerCase(),POOL_HIGH.toLowerCase());
assert.equal(route.tickSpacing,50);
assert.equal(route.candidateCount,2);
assert.equal(route.routeSelection,'highest-active-liquidity-at-historical-boundary');
assert.equal(route.exactHistoricalBlock,true);
assert.equal(route.stablecoinPegAssumptionUsed,false);
assert.equal(route.currentPriceUsed,false);
assert.ok(route.quoteTokenAmount>0);

assert.equal(isHistoricalAerodromeVe33Identity({eventKey:EVENT_KEY}),true);
assert.equal(isHistoricalAerodromeVe33Identity({eventKey:'ve33:velodrome|mock:1:12345'}),false);

const result=await historicalBaseAerodromeDiscoveredPriceAtBoundary({
  token:TOKEN,
  boundaryAt:BOUNDARY_AT,
  eventKey:EVENT_KEY,
  root:'.',
  onchainRegistry:{networks:{base:network}},
  rpcCall,
  usdcUsdResolver:async args=>({
    ok:true,status:'historical-onchain-chainlink-price',assetId:'usd-coin',symbol:'USDC',
    priceUsd:1.0002,observedAt:BLOCK_AT,ageMinutes:0.1,maxAgeMinutes:1500,
    chainId:8453,sourceBlockNumber:SOURCE_BLOCK,sourceContract:BASE_NATIVE_USDC_CHAINLINK_FEED,
    roundId:'10',answeredInRound:'10',executionAuthority:'none',resolverArgs:args
  })
});
assert.equal(result.ok,true);
assert.equal(result.status,'historical-onchain-aerodrome-discovered-twap-chainlink-price');
assert.equal(result.sourceContract.toLowerCase(),POOL_HIGH.toLowerCase());
assert.equal(result.quoteChainlinkContract.toLowerCase(),BASE_NATIVE_USDC_CHAINLINK_FEED.toLowerCase());
assert.equal(result.sourceBlockNumber,SOURCE_BLOCK);
assert.equal(result.exactHistoricalBlock,true);
assert.equal(result.stablecoinPegAssumptionUsed,false);
assert.equal(result.currentPriceUsed,false);
assert.equal(result.referenceAprUsed,false);
assert.equal(result.executionAuthority,'none');
assert.ok(result.priceUsd>0);

console.log(JSON.stringify({ok:true,routeStatus:route.status,priceStatus:result.status,pool:result.sourceContract,tickSpacing:result.tickSpacing,priceUsd:result.priceUsd},null,2));
