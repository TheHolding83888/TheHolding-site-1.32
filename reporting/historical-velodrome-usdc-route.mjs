#!/usr/bin/env node
/**
 * Exact-block Velodrome V2 reward-token -> native Optimism USDC route discovery.
 *
 * This module is deliberately transport/route evidence only. It does not
 * recognize income, mutate ledger economics, assume a stablecoin peg, or
 * choose between ambiguous pools. Production valuation can compose its proven
 * quote with the canonical historical USDC/USD proof.
 */

export const VERSION='0.1-exact-block-velodrome-usdc-route-discovery';
export const OPTIMISM_VELODROME_V2_FACTORY='0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a';
export const OPTIMISM_NATIVE_USDC='0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
export const OPTIMISM_NATIVE_USDC_DECIMALS=6;
export const DEFAULT_TWAP_GRANULARITY=48;
export const MAX_BOUNDARY_BLOCK_LAG_SECONDS=120;

// keccak256('getPool(address,address,bool)')[0:4] = 0x79bc57d5.
// Other selectors are existing Velodrome V2 pool/ERC20 selectors.
export const SELECTORS=Object.freeze({
  getPool:'0x79bc57d5',
  decimals:'0x313ce567',
  token0:'0x0dfe1681',
  token1:'0xd21220a7',
  stable:'0x22be3de1',
  observationLength:'0xebeb31db',
  quote:'0x9e8cc04b'
});

const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
const lower=value=>String(value||'').toLowerCase();
const abiWord=value=>BigInt(value).toString(16).padStart(64,'0');
const abiAddress=value=>lower(value).replace(/^0x/,'').padStart(64,'0');
const hexQuantity=value=>`0x${BigInt(value).toString(16)}`;

export function encodeGetPool(tokenA,tokenB,stable){
  return `${SELECTORS.getPool}${abiAddress(tokenA)}${abiAddress(tokenB)}${abiWord(stable?1:0)}`;
}
export function encodeQuote(tokenIn,amountIn,granularity){
  return `${SELECTORS.quote}${abiAddress(tokenIn)}${abiWord(amountIn)}${abiWord(granularity)}`;
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
export function decodeBool(hex){return decodeUint256(hex)!==0n;}

export async function discoverHistoricalVelodromeUsdcRoute({
  token,
  sourceBlockNumber,
  boundaryAt,
  network,
  rpcCall,
  fetchImpl=fetch,
  factory=OPTIMISM_VELODROME_V2_FACTORY,
  quoteToken=OPTIMISM_NATIVE_USDC,
  quoteTokenDecimals=OPTIMISM_NATIVE_USDC_DECIMALS,
  twapGranularity=DEFAULT_TWAP_GRANULARITY
}={}){
  if(!/^0x[0-9a-f]{40}$/i.test(String(token||''))||lower(token)===lower(quoteToken))return{ok:false,status:'invalid-reward-token'};
  if(!Number.isSafeInteger(Number(sourceBlockNumber))||Number(sourceBlockNumber)<=0)return{ok:false,status:'invalid-source-block'};
  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary'};
  if(Number(network?.chainId)!==10||!Array.isArray(network?.rpcFailover)||network.rpcFailover.length===0)return{ok:false,status:'optimism-historical-rpc-fabric-unavailable'};
  if(typeof rpcCall!=='function')return{ok:false,status:'historical-rpc-call-unavailable'};

  const blockTag=hexQuantity(sourceBlockNumber),attempts=[];
  for(const endpoint of network.rpcFailover){
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
      const amountIn=10n**BigInt(tokenDecimals),valid=[];

      for(const poolStable of [false,true]){
        try{
          const poolHex=await rpcCall({endpoint,method:'eth_call',params:[{to:factory,data:encodeGetPool(token,quoteToken,poolStable)},blockTag],fetchImpl});
          const pool=decodeAddress(poolHex);
          if(lower(pool)===ZERO_ADDRESS)continue;
          const [token0Hex,token1Hex,stableHex,observationLengthHex,quoteHex]=await Promise.all([
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.token0},blockTag],fetchImpl}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.token1},blockTag],fetchImpl}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.stable},blockTag],fetchImpl}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:SELECTORS.observationLength},blockTag],fetchImpl}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:encodeQuote(token,amountIn,twapGranularity)},blockTag],fetchImpl})
          ]);
          const token0=decodeAddress(token0Hex),token1=decodeAddress(token1Hex),stable=decodeBool(stableHex);
          const observationLength=Number(decodeUint256(observationLengthHex)),quoteAmountOutRaw=decodeUint256(quoteHex);
          const pair=new Set([lower(token0),lower(token1)]);
          if(pair.size!==2||!pair.has(lower(token))||!pair.has(lower(quoteToken)))continue;
          if(stable!==poolStable)continue;
          if(!Number.isSafeInteger(observationLength)||observationLength<=Number(twapGranularity))continue;
          if(quoteAmountOutRaw<=0n)continue;
          valid.push({pool,poolStable,token0,token1,observationLength,quoteAmountOutRaw});
        }catch(error){attempts.push({endpointId:endpoint?.id||null,poolStable,error:error?.message||String(error)});}
      }

      const unique=new Map(valid.map(row=>[lower(row.pool),row]));
      const candidates=[...unique.values()];
      if(candidates.length===0)continue;
      if(candidates.length!==1)return{ok:false,status:'historical-velodrome-usdc-route-ambiguous',sourceBlockNumber,candidatePools:candidates.map(x=>({pool:x.pool,poolStable:x.poolStable,observationLength:x.observationLength}))};
      const candidate=candidates[0],quoteTokenAmount=Number(candidate.quoteAmountOutRaw)/10**Number(quoteTokenDecimals);
      if(!(Number.isFinite(quoteTokenAmount)&&quoteTokenAmount>0))return{ok:false,status:'historical-velodrome-usdc-quote-invalid',sourceBlockNumber};
      return{
        ok:true,status:'historical-velodrome-usdc-route-proven',chainId:10,
        sourceBlockNumber:Number(sourceBlockNumber),sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),
        rpcEndpointId:endpoint?.id||null,factory,pool:candidate.pool,poolStable:candidate.poolStable,
        token,tokenDecimals,token0:candidate.token0,token1:candidate.token1,
        quoteToken,quoteTokenDecimals,quoteAmountOutRaw:candidate.quoteAmountOutRaw.toString(),quoteTokenAmount,
        twapGranularity:Number(twapGranularity),observationLength:candidate.observationLength,
        exactHistoricalBlock:true,stablecoinPegAssumptionUsed:false,currentPriceUsed:false,referenceAprUsed:false,
        executionAuthority:'none'
      };
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});}
  }
  return{ok:false,status:'historical-velodrome-usdc-route-unavailable',sourceBlockNumber:Number(sourceBlockNumber),attempts};
}
