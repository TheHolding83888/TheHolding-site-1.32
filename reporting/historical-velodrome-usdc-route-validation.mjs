#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,SELECTORS,OPTIMISM_VELODROME_V2_FACTORY,OPTIMISM_NATIVE_USDC,
  encodeGetPool,discoverHistoricalVelodromeUsdcRoute
} from './historical-velodrome-usdc-route.mjs';

assert.equal(VERSION,'0.1-exact-block-velodrome-usdc-route-discovery');
assert.equal(SELECTORS.getPool,'0x79bc57d5');
assert.equal(OPTIMISM_VELODROME_V2_FACTORY.toLowerCase(),'0xf1046053aa5682b4f9a81b5481394da16be5ff5a');
assert.equal(OPTIMISM_NATIVE_USDC.toLowerCase(),'0x0b2c639c533813f4aa9d7837caf62653d097ff85');

const reward='0x1111111111111111111111111111111111111111';
const volatilePool='0x2222222222222222222222222222222222222222';
const stablePool='0x3333333333333333333333333333333333333333';
const block=156311011;
const boundary='2026-09-01T00:00:00.000Z';
const boundarySeconds=Math.floor(Date.parse(boundary)/1000);
const blockTag=`0x${BigInt(block).toString(16)}`;
const network={chainId:10,rpcFailover:[{id:'test-optimism',url:'https://optimism.example'}]};
const word=value=>BigInt(value).toString(16).padStart(64,'0');
const addressWord=value=>String(value).toLowerCase().replace(/^0x/,'').padStart(64,'0');
const addressResult=value=>`0x${addressWord(value)}`;
const uintResult=value=>`0x${word(value)}`;
const boolResult=value=>uintResult(value?1:0);
const getPoolFalse=encodeGetPool(reward,OPTIMISM_NATIVE_USDC,false).toLowerCase();
const getPoolTrue=encodeGetPool(reward,OPTIMISM_NATIVE_USDC,true).toLowerCase();
assert.equal(getPoolFalse.slice(0,10),'0x79bc57d5');
assert.equal(getPoolTrue.slice(-64),word(1));

function rpcFixture({volatile=true,stable=false,volatileQuote=1250000n,stableQuote=900000n,observationLength=96}={}){
  return async({endpoint,method,params})=>{
    assert.equal(endpoint.id,'test-optimism');
    if(method==='eth_getBlockByNumber'){
      assert.equal(params[0],blockTag);assert.equal(params[1],false);
      return{number:blockTag,timestamp:`0x${BigInt(boundarySeconds-2).toString(16)}`};
    }
    assert.equal(method,'eth_call');assert.equal(params[1],blockTag,'all discovery reads must stay on the exact close block');
    const to=String(params[0]?.to||'').toLowerCase(),data=String(params[0]?.data||'').toLowerCase();
    if(to===reward.toLowerCase()&&data===SELECTORS.decimals)return uintResult(18);
    if(to===OPTIMISM_VELODROME_V2_FACTORY.toLowerCase()){
      if(data===getPoolFalse)return addressResult(volatile?volatilePool:'0x0000000000000000000000000000000000000000');
      if(data===getPoolTrue)return addressResult(stable?stablePool:'0x0000000000000000000000000000000000000000');
    }
    const isVolatile=to===volatilePool.toLowerCase(),isStable=to===stablePool.toLowerCase();
    if(isVolatile||isStable){
      if(data===SELECTORS.token0)return addressResult(reward);
      if(data===SELECTORS.token1)return addressResult(OPTIMISM_NATIVE_USDC);
      if(data===SELECTORS.stable)return boolResult(isStable);
      if(data===SELECTORS.observationLength)return uintResult(observationLength);
      if(data.startsWith(SELECTORS.quote))return uintResult(isStable?stableQuote:volatileQuote);
    }
    throw new Error(`unexpected call ${to} ${data}`);
  };
}

const proven=await discoverHistoricalVelodromeUsdcRoute({token:reward,sourceBlockNumber:block,boundaryAt:boundary,network,rpcCall:rpcFixture()});
assert.equal(proven.ok,true);
assert.equal(proven.status,'historical-velodrome-usdc-route-proven');
assert.equal(proven.pool.toLowerCase(),volatilePool.toLowerCase());
assert.equal(proven.poolStable,false);
assert.equal(proven.quoteTokenAmount,1.25);
assert.equal(proven.sourceBlockNumber,block);
assert.equal(proven.exactHistoricalBlock,true);
assert.equal(proven.stablecoinPegAssumptionUsed,false);
assert.equal(proven.currentPriceUsed,false);
assert.equal(proven.referenceAprUsed,false);
assert.equal(proven.executionAuthority,'none');

const missing=await discoverHistoricalVelodromeUsdcRoute({token:reward,sourceBlockNumber:block,boundaryAt:boundary,network,rpcCall:rpcFixture({volatile:false,stable:false})});
assert.equal(missing.ok,false);
assert.equal(missing.status,'historical-velodrome-usdc-route-unavailable');

const insufficient=await discoverHistoricalVelodromeUsdcRoute({token:reward,sourceBlockNumber:block,boundaryAt:boundary,network,rpcCall:rpcFixture({observationLength:48})});
assert.equal(insufficient.ok,false);
assert.equal(insufficient.status,'historical-velodrome-usdc-route-unavailable');

const ambiguous=await discoverHistoricalVelodromeUsdcRoute({token:reward,sourceBlockNumber:block,boundaryAt:boundary,network,rpcCall:rpcFixture({volatile:true,stable:true})});
assert.equal(ambiguous.ok,false);
assert.equal(ambiguous.status,'historical-velodrome-usdc-route-ambiguous');
assert.equal(ambiguous.candidatePools.length,2);

const wrongNetwork=await discoverHistoricalVelodromeUsdcRoute({token:reward,sourceBlockNumber:block,boundaryAt:boundary,network:{chainId:8453,rpcFailover:[{id:'base'}]},rpcCall:rpcFixture()});
assert.equal(wrongNetwork.ok,false);
assert.equal(wrongNetwork.status,'optimism-historical-rpc-fabric-unavailable');

console.log('Historical Velodrome exact-block USDC route discovery validation OK');
