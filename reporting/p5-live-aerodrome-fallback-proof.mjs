#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  AERODROME_SLIPSTREAM_FACTORIES,
  CANONICAL_TICK_SPACINGS,
  encodeGetPool,
  encodeObserve,
  decodeAddress,
  decodeUint256,
  decodeTickCumulatives
} from './historical-aerodrome-usdc-route.mjs';

const registry=JSON.parse(await fs.readFile('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const registryNetwork=registry?.networks?.base;
const configuredRpc=String(process.env.BASE_RPC_URL||'').trim();
const registryEndpoints=Array.isArray(registryNetwork?.rpcFailover)?registryNetwork.rpcFailover:[];
const publicArchiveCandidates=[
  {id:'tenderly-public',url:'https://base.gateway.tenderly.co'}
];
const allEndpoints=[
  ...(configuredRpc?[{id:'configured-base-rpc',url:configuredRpc}]:[]),
  ...publicArchiveCandidates,
  ...registryEndpoints
];
const seen=new Set();
const network={...registryNetwork,rpcFailover:allEndpoints.filter(x=>x?.url&&!seen.has(x.url)&&(seen.add(x.url),true))};
const POOL='0xF099ceFE04717710dd2EC40f2e0c9C06134F5Eb5';
const TOWNS='0x00000000A22C618FD6b4D7e9A335C4B96B189A38';
const USDC='0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913';
const BLOCK=50715726;
const BLOCK_TAG=`0x${BigInt(BLOCK).toString(16)}`;
const SELECTORS={factory:'0xc45a0155',tickSpacing:'0xd0c93a7c',token0:'0x0dfe1681',token1:'0xd21220a7',liquidity:'0x1a686502'};
const lower=v=>String(v||'').toLowerCase();

async function rpcCall({endpoint,method,params}={}){
  const response=await fetch(endpoint.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(!response.ok)throw new Error(`${endpoint.id} HTTP ${response.status}`);
  const body=await response.json();
  if(body?.error)throw new Error(`${endpoint.id} ${body.error?.message||JSON.stringify(body.error)}`);
  return body?.result;
}

const endpointDiagnostics=[];
let proof=null;
for(const endpoint of network.rpcFailover){
  try{
    const [code,block,factoryHex,tickHex,token0Hex,token1Hex,liquidityHex,observeHex]=await Promise.all([
      rpcCall({endpoint,method:'eth_getCode',params:[POOL,BLOCK_TAG]}),
      rpcCall({endpoint,method:'eth_getBlockByNumber',params:[BLOCK_TAG,false]}),
      rpcCall({endpoint,method:'eth_call',params:[{to:POOL,data:SELECTORS.factory},BLOCK_TAG]}),
      rpcCall({endpoint,method:'eth_call',params:[{to:POOL,data:SELECTORS.tickSpacing},BLOCK_TAG]}),
      rpcCall({endpoint,method:'eth_call',params:[{to:POOL,data:SELECTORS.token0},BLOCK_TAG]}),
      rpcCall({endpoint,method:'eth_call',params:[{to:POOL,data:SELECTORS.token1},BLOCK_TAG]}),
      rpcCall({endpoint,method:'eth_call',params:[{to:POOL,data:SELECTORS.liquidity},BLOCK_TAG]}),
      rpcCall({endpoint,method:'eth_call',params:[{to:POOL,data:encodeObserve(300)},BLOCK_TAG]})
    ]);
    const factory=decodeAddress(factoryHex);
    const tickSpacing=Number(decodeUint256(tickHex));
    const token0=decodeAddress(token0Hex),token1=decodeAddress(token1Hex),liquidity=decodeUint256(liquidityHex);
    const ticks=decodeTickCumulatives(observeHex);
    const delta=ticks[1]-ticks[0],window=300n;
    let avg=delta/window;if(delta<0n&&delta%window!==0n)avg-=1n;
    const factoryLookups=[];
    for(const candidateFactory of AERODROME_SLIPSTREAM_FACTORIES){
      let returnedPool=null,error=null;
      try{returnedPool=decodeAddress(await rpcCall({endpoint,method:'eth_call',params:[{to:candidateFactory,data:encodeGetPool(TOWNS,USDC,tickSpacing)},BLOCK_TAG]}));}
      catch(e){error=e?.message||String(e);}
      factoryLookups.push({factory:lower(candidateFactory),returnedPool:returnedPool?lower(returnedPool):null,matchesKnownPool:lower(returnedPool)===lower(POOL),error});
    }
    proof={
      endpoint:endpoint.id,
      configuredRpcAvailable:Boolean(configuredRpc),
      blockNumber:BLOCK,
      blockTimestamp:block?.timestamp?new Date(Number(BigInt(block.timestamp))*1000).toISOString():null,
      codePresent:typeof code==='string'&&code!=='0x',
      pool:lower(POOL),factory:lower(factory),
      factoryAlreadyAllowlisted:AERODROME_SLIPSTREAM_FACTORIES.map(lower).includes(lower(factory)),
      tickSpacing,tickSpacingAlreadyAllowlisted:CANONICAL_TICK_SPACINGS.includes(tickSpacing),
      token0:lower(token0),token1:lower(token1),
      pairMatches:new Set([lower(token0),lower(token1)]).has(lower(TOWNS))&&new Set([lower(token0),lower(token1)]).has(lower(USDC)),
      liquidity:liquidity.toString(),activeLiquidity:liquidity>0n,observe300Ok:true,averageTick:Number(avg),
      factoryLookups,currentPriceUsed:false,executionAuthority:'none'
    };
    break;
  }catch(error){endpointDiagnostics.push({endpoint:endpoint.id,error:error?.message||String(error)});}
}

const summary={ok:Boolean(proof),configuredRpcAvailable:Boolean(configuredRpc),proof,endpointDiagnostics,canonicalFactories:AERODROME_SLIPSTREAM_FACTORIES.map(lower),canonicalTickSpacings:CANONICAL_TICK_SPACINGS,executionAuthority:'none'};
console.log('P5 known TOWNS/USDC Slipstream historical pool introspection',JSON.stringify(summary,null,2));
assert.ok(proof,'known TOWNS/USDC pool could not be introspected at the historical closing block');
assert.equal(proof.pairMatches,true,'known pool token pair does not match TOWNS/USDC at boundary');
assert.equal(proof.activeLiquidity,true,'known pool had no active liquidity at boundary');
assert.equal(proof.observe300Ok,true,'known pool could not provide 5-minute historical observation');
assert.ok(proof.factoryLookups.some(x=>x.matchesKnownPool),'no currently allowlisted canonical factory resolves the known TOWNS/USDC pool at its actual tick spacing');
