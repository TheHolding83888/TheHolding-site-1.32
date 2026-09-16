#!/usr/bin/env node
/**
 * Exact-block Aerodrome Slipstream reward-token -> Base quote route discovery.
 *
 * Factories are the canonical Aerodrome Slipstream deployments published by
 * aerodrome-finance/slipstream. Discovery is read-only and fail-closed: it
 * proves pool identity at the historical block, requires active liquidity and
 * a positive 5-minute TWAP, and never assumes a USDC peg or current price.
 */

export const VERSION='0.2-exact-block-aerodrome-slipstream-route-archive-fabric';
export const BASE_NATIVE_USDC='0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913';
export const BASE_NATIVE_USDC_DECIMALS=6;
export const DEFAULT_TWAP_SECONDS=300;
export const MAX_BOUNDARY_BLOCK_LAG_SECONDS=120;

export const AERODROME_HISTORICAL_RPC_FALLBACKS=Object.freeze([
  Object.freeze({id:'tenderly-public-archive',url:'https://base.gateway.tenderly.co'})
]);

export const AERODROME_SLIPSTREAM_FACTORIES=Object.freeze([
  '0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A',
  '0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a',
  '0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef'
]);

export const CANONICAL_TICK_SPACINGS=Object.freeze([1,50,100,200,2000]);

export const SELECTORS=Object.freeze({
  getPool:'0x28af8d0b',
  decimals:'0x313ce567',
  token0:'0x0dfe1681',
  token1:'0xd21220a7',
  observe:'0x883bdbfd',
  liquidity:'0x1a686502'
});

const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
const lower=value=>String(value||'').toLowerCase();
const abiWord=value=>{
  const n=BigInt(value),mod=1n<<256n,encoded=n<0n?mod+n:n;
  return encoded.toString(16).padStart(64,'0');
};
const abiAddress=value=>lower(value).replace(/^0x/,'').padStart(64,'0');
const hexQuantity=value=>`0x${BigInt(value).toString(16)}`;

export function historicalAerodromeRpcEndpoints(network){
  const seen=new Set();
  return[
    ...AERODROME_HISTORICAL_RPC_FALLBACKS,
    ...(Array.isArray(network?.rpcFailover)?network.rpcFailover:[])
  ].filter(endpoint=>{
    const url=String(endpoint?.url||'').trim();
    if(!url||seen.has(url))return false;
    seen.add(url);
    return true;
  });
}

export function encodeGetPool(tokenA,tokenB,tickSpacing){
  return `${SELECTORS.getPool}${abiAddress(tokenA)}${abiAddress(tokenB)}${abiWord(tickSpacing)}`;
}
export function encodeObserve(secondsAgo){
  return `${SELECTORS.observe}${abiWord(32)}${abiWord(2)}${abiWord(secondsAgo)}${abiWord(0)}`;
}
export function decodeUint256(hex){
  const raw=String(hex||'').replace(/^0x/,'');
  if(raw.length<64||!/^[0-9a-f]+$/i.test(raw))throw new Error('ABI uint256 result invalid');
  return BigInt(`0x${raw.slice(-64)}`);
}
export function decodeAddress(hex){
  const raw=String(hex||'').replace(/^0x/,'');
  if(raw.length<64||!/^[0-9a-f]+$/i.test(raw))throw new Error('ABI address result invalid');
  const address=`0x${raw.slice(-40)}`;
  if(!/^0x[0-9a-f]{40}$/i.test(address))throw new Error('ABI address result invalid');
  return address;
}
function signedBits(value,bits){
  const b=BigInt(bits),mod=1n<<b,mask=mod-1n,sign=1n<<(b-1n),v=BigInt(value)&mask;
  return v>=sign?v-mod:v;
}
export function decodeTickCumulatives(hex){
  const raw=String(hex||'').replace(/^0x/,'');
  if(raw.length<128)throw new Error('Slipstream observe result missing');
  const offset=Number(BigInt(`0x${raw.slice(0,64)}`));
  if(!Number.isSafeInteger(offset)||offset<32||offset%32!==0)throw new Error('Slipstream observe offset invalid');
  const base=offset*2;
  if(raw.length<base+64)throw new Error('Slipstream tick cumulative array missing');
  const length=Number(BigInt(`0x${raw.slice(base,base+64)}`));
  if(length!==2)throw new Error(`Slipstream observe length invalid: ${length}`);
  const ticks=[];
  for(let i=0;i<length;i++){
    const start=base+64+i*64;
    if(raw.length<start+64)throw new Error('Slipstream tick cumulative word missing');
    ticks.push(signedBits(BigInt(`0x${raw.slice(start,start+64)}`),56));
  }
  return ticks;
}

export function quoteTokenPerReward({avgTick,token0,token,tokenDecimals,quoteTokenDecimals}){
  if(!Number.isSafeInteger(avgTick))throw new Error('Slipstream average tick invalid');
  const rawToken1PerToken0=Math.pow(1.0001,avgTick);
  const scale=10**(Number(tokenDecimals)-Number(quoteTokenDecimals));
  if(!(Number.isFinite(rawToken1PerToken0)&&rawToken1PerToken0>0&&Number.isFinite(scale)&&scale>0))throw new Error('Slipstream tick price invalid');
  const quotePerReward=lower(token0)===lower(token)?rawToken1PerToken0*scale:scale/rawToken1PerToken0;
  if(!(Number.isFinite(quotePerReward)&&quotePerReward>0))throw new Error('Slipstream derived quote invalid');
  return quotePerReward;
}

export async function discoverHistoricalAerodromeUsdcRoute({token,sourceBlockNumber,boundaryAt,network,rpcCall,fetchImpl=fetch,factories=AERODROME_SLIPSTREAM_FACTORIES,tickSpacings=CANONICAL_TICK_SPACINGS,quoteToken=BASE_NATIVE_USDC,quoteTokenDecimals=BASE_NATIVE_USDC_DECIMALS,twapSeconds=DEFAULT_TWAP_SECONDS}={}){
  if(!/^0x[0-9a-f]{40}$/i.test(String(token||''))||lower(token)===lower(quoteToken))return{ok:false,status:'invalid-reward-token'};
  if(!Number.isSafeInteger(Number(sourceBlockNumber))||Number(sourceBlockNumber)<=0)return{ok:false,status:'invalid-source-block'};
  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary'};
  if(Number(network?.chainId)!==8453)return{ok:false,status:'base-historical-rpc-fabric-unavailable'};
  if(typeof rpcCall!=='function')return{ok:false,status:'historical-rpc-call-unavailable'};
  const endpoints=historicalAerodromeRpcEndpoints(network);
  if(endpoints.length===0)return{ok:false,status:'base-historical-rpc-fabric-unavailable'};

  const blockTag=hexQuantity(sourceBlockNumber),attempts=[];
  for(const endpoint of endpoints){
    try{
      const block=await rpcCall({endpoint,method:'eth_getBlockByNumber',params:[blockTag,false],fetchImpl});
      if(lower(block?.number)!==lower(blockTag))return{ok:false,status:'closing-block-rpc-mismatch',sourceBlockNumber};
      const blockTimestampSeconds=Number(BigInt(block?.timestamp||'0x0'));
      const blockTimestampMs=blockTimestampSeconds*1000;
      if(!(Number.isFinite(blockTimestampMs)&&blockTimestampMs>0))return{ok:false,status:'historical-block-time-invalid',sourceBlockNumber};
      if(blockTimestampMs>boundaryMs)return{ok:false,status:'historical-block-after-accounting-boundary',sourceBlockNumber};
      const boundaryLagSeconds=(boundaryMs-blockTimestampMs)/1000;
      if(boundaryLagSeconds>MAX_BOUNDARY_BLOCK_LAG_SECONDS)return{ok:false,status:'historical-block-too-far-from-accounting-boundary',sourceBlockNumber,boundaryLagSeconds:Number(boundaryLagSeconds.toFixed(3))};
      const decimalsHex=await rpcCall({endpoint,method:'eth_call',params:[{to:token,data:SELECTORS.decimals},blockTag],fetchImpl});
      const tokenDecimals=Number(decodeUint256(decimalsHex));
      if(!Number.isInteger(tokenDecimals)||tokenDecimals<0||tokenDecimals>36)return{ok:false,status:'reward-token-decimals-invalid',sourceBlockNumber};
      const valid=[];
      for(const factory of factories){
        for(const tickSpacing of tickSpacings){
          try{
            const poolHex=await rpcCall({endpoint,method:'eth_call',params:[{to:factory,data:encodeGetPool(token,quoteToken,tickSpacing)},blockTag],fetchImpl});
            const pool=decodeAddress(poolHex);
            if(lower(pool)===ZERO_ADDRESS)continue;
            const[token0Hex,token1Hex,liquidityHex,observeHex]=await Promise.all([
              rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.token0},blockTag],fetchImpl}),
              rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.token1},blockTag],fetchImpl}),
              rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.liquidity},blockTag],fetchImpl}),
              rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:encodeObserve(twapSeconds)},blockTag],fetchImpl})
            ]);
            const token0=decodeAddress(token0Hex),token1=decodeAddress(token1Hex),liquidity=decodeUint256(liquidityHex);
            const pair=new Set([lower(token0),lower(token1)]);
            if(pair.size!==2||!pair.has(lower(token))||!pair.has(lower(quoteToken))||liquidity<=0n)continue;
            const ticks=decodeTickCumulatives(observeHex),delta=ticks[1]-ticks[0],window=BigInt(twapSeconds);
            let averageTick=delta/window;if(delta<0n&&delta%window!==0n)averageTick-=1n;
            const avgTick=Number(averageTick);
            const quoteTokenAmount=quoteTokenPerReward({avgTick,token0,token,tokenDecimals,quoteTokenDecimals});
            valid.push({factory,pool,tickSpacing,token0,token1,liquidity,avgTick,quoteTokenAmount});
          }catch(error){attempts.push({endpointId:endpoint?.id||null,factory,tickSpacing,error:error?.message||String(error)});}
        }
      }
      const unique=new Map();
      for(const candidate of valid){const key=lower(candidate.pool),existing=unique.get(key);if(!existing||candidate.liquidity>existing.liquidity)unique.set(key,candidate);}
      const candidates=[...unique.values()];
      if(candidates.length===0)continue;
      candidates.sort((a,b)=>a.liquidity===b.liquidity?0:(a.liquidity>b.liquidity?-1:1));
      if(candidates.length>1&&candidates[0].liquidity===candidates[1].liquidity)return{ok:false,status:'historical-aerodrome-usdc-route-ambiguous',sourceBlockNumber,candidatePools:candidates.map(x=>({factory:x.factory,pool:x.pool,tickSpacing:x.tickSpacing,liquidity:x.liquidity.toString()}))};
      const candidate=candidates[0];
      return{ok:true,status:'historical-aerodrome-usdc-route-proven',chainId:8453,sourceBlockNumber:Number(sourceBlockNumber),sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),rpcEndpointId:endpoint?.id||null,factory:candidate.factory,pool:candidate.pool,tickSpacing:candidate.tickSpacing,routeSelection:'highest-active-liquidity-at-historical-boundary',candidateCount:candidates.length,token,tokenDecimals,token0:candidate.token0,token1:candidate.token1,quoteToken,quoteTokenDecimals,quoteTokenAmount:candidate.quoteTokenAmount,twapSeconds:Number(twapSeconds),averageTick:candidate.avgTick,liquidity:candidate.liquidity.toString(),exactHistoricalBlock:true,stablecoinPegAssumptionUsed:false,currentPriceUsed:false,referenceAprUsed:false,executionAuthority:'none'};
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});}
  }
  return{ok:false,status:'historical-aerodrome-usdc-route-unavailable',sourceBlockNumber:Number(sourceBlockNumber),attempts};
}
