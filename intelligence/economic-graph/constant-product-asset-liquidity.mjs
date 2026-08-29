#!/usr/bin/env node
/**
 * The Holding · reusable constant-product asset-liquidity collector v0.1
 *
 * Generic read-only exact-block collector for Uniswap-v2-compatible Factory/Pair
 * registries. Protocol-specific identity belongs in config; this module knows only
 * how to enumerate pairs, select those containing one configured base asset and
 * measure pair reserves / LP supply at the same block.
 *
 * It deliberately does not price counterpart assets, infer USD TVL, call swaps,
 * infer volume/fees/incentives, or claim capital migration / causality.
 */
import crypto from 'node:crypto';

export const CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION='0.1-constant-product-asset-liquidity-exact-block';
const RPC_TIMEOUT_MS=12_000;
const MAX_FACTORY_PAIRS=1200;
const MAX_BATCH_CALLS=120;
const ZERO='0x0000000000000000000000000000000000000000';
const S={
  allPairsLength:'0x574f2ba3',
  allPairs:'0x1e3dd18b',
  factory:'0xc45a0155',
  token0:'0x0dfe1681',
  token1:'0xd21220a7',
  getReserves:'0x0902f1ac',
  totalSupply:'0x18160ddd'
};

function normalizeAddress(v){return String(v||'').toLowerCase();}
function sameAddress(a,b){return normalizeAddress(a)===normalizeAddress(b);}
function isAddress(v){return /^0x[0-9a-f]{40}$/i.test(String(v||''));}
function sha256(v){return crypto.createHash('sha256').update(String(v)).digest('hex');}
function rpcQuantity(v){if(!/^0x[0-9a-f]+$/i.test(String(v||'')))throw new Error('Invalid RPC quantity');return BigInt(v);}
function cleanAbi(v){const x=String(v||'').replace(/^0x/,'');if(!x.length||x.length%64!==0||!/^[0-9a-f]+$/i.test(x))throw new Error('Invalid ABI result');return x;}
function words(v){const x=cleanAbi(v),out=[];for(let i=0;i<x.length;i+=64)out.push(BigInt(`0x${x.slice(i,i+64)}`));return out;}
function word(v){const x=words(v);if(!x.length)throw new Error('Missing ABI word');return x[0];}
function address(v){const x=cleanAbi(v);return `0x${x.slice(24,64)}`;}
function uintArg(v){return BigInt(v).toString(16).padStart(64,'0');}
function nonemptyCode(v){const s=String(v||'').toLowerCase();return /^0x[0-9a-f]+$/.test(s)&&!/^0x0*$/.test(s);}
function checkpointIdentity(block){return `${block.blockNumber}:${String(block.blockHash).toLowerCase()}`;}

async function postBatch(url,payload,fetchImpl){
  const response=await fetchImpl(url,{method:'POST',headers:{'content-type':'application/json',accept:'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(RPC_TIMEOUT_MS)});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();if(!Array.isArray(body))throw new Error('RPC response is not an array');
  const byId=new Map(body.map(row=>[Number(row?.id),row]));
  for(const req of payload){const row=byId.get(req.id);if(!row)throw new Error(`RPC result ${req.id} missing`);if(row.error)throw new Error(`RPC ${req.method} error: ${row.error?.message||'unknown'}`);if(row.result===undefined||row.result===null)throw new Error(`RPC ${req.method} result missing`);}
  return byId;
}
async function batched(url,payload,fetchImpl){const out=new Map();for(let i=0;i<payload.length;i+=MAX_BATCH_CALLS){const part=await postBatch(url,payload.slice(i,i+MAX_BATCH_CALLS),fetchImpl);for(const [k,v] of part)out.set(k,v);}return out;}

function validateConfig(config){
  if(config?.adapter!=='constant-product-v2-factory')throw new Error('Unsupported liquidity adapter');
  if(!Number.isInteger(Number(config?.network?.chainId))||Number(config.network.chainId)<=0)throw new Error('Invalid network identity');
  if(!isAddress(config?.factory?.address)||!isAddress(config?.baseAsset?.address))throw new Error('Factory/base-asset address missing');
  if(sameAddress(config.factory.address,ZERO)||sameAddress(config.baseAsset.address,ZERO))throw new Error('Zero address identity forbidden');
  if(config?.semantics?.configIsLiveMeasurement!==false||config?.semantics?.unknownIsZero!==false||config?.semantics?.usdValuationPerformed!==false||config?.semantics?.counterpartUnitsAggregated!==false||config?.semantics?.executionAuthority!=='none')throw new Error('Liquidity config epistemic/authority boundary drift');
  return config;
}
function unknown(config,attempts,reason='UNKNOWN-constant-product-liquidity-read-failed'){return {
  version:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION,status:reason,measurementClass:'UNKNOWN',observedAt:null,
  network:{name:config?.network?.name||null,chainId:Number(config?.network?.chainId||0)||null},
  factory:config?.factory||null,baseAsset:config?.baseAsset||null,pairs:[],
  summary:{factoryPairCount:null,matchingPairCount:null,totalBaseReserveRaw:null},
  rpc:{endpointId:null,failoverAttempts:attempts||[]},provenance:config?.source||null,
  edges:[{from:'pair registry',to:'base-asset exchange liquidity',class:'UNKNOWN'}],
  epistemic:{factoryRegistry:'UNKNOWN',pairReserves:'UNKNOWN',usdTvl:'UNKNOWN-not-valued-by-this-collector',volume:'UNKNOWN-not-measured-by-this-collector',fees:'UNKNOWN-not-measured-by-this-collector',incentives:'UNKNOWN-not-measured-by-this-collector',capitalMigration:'UNKNOWN-not-measured-by-this-collector',counterpartUnitsAggregated:false,unknownIsZero:false,causalClaimAuthority:'none',executionAuthority:'none'}
};}

export async function collectConstantProductAssetLiquidity({config,fetchImpl=fetch,endpoints,checkpoint=null}={}){
  let cfg;try{cfg=validateConfig(config);}catch(error){return unknown(config,[{scope:'config',error:error.message}],'UNKNOWN-liquidity-config-invalid');}
  if(!Array.isArray(endpoints)||!endpoints.length)return unknown(cfg,[{scope:'rpc',error:'No RPC endpoints'}],'UNKNOWN-liquidity-rpc-unavailable');
  const attempts=[];
  for(const endpoint of endpoints){
    try{
      let blockTag,blockNumber,blockHash,blockTimestamp;
      if(checkpoint?.blockTag&&Number.isFinite(Number(checkpoint?.blockNumber))&&/^0x[0-9a-f]{64}$/i.test(String(checkpoint?.blockHash||''))){
        blockTag=checkpoint.blockTag;blockNumber=BigInt(checkpoint.blockNumber);
        const check=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_getBlockByNumber',params:[blockTag,false]}],fetchImpl);
        const b=check.get(1).result;if(String(b?.hash||'').toLowerCase()!==String(checkpoint.blockHash).toLowerCase())throw new Error('Provided checkpoint hash mismatch');
        blockHash=String(b.hash).toLowerCase();blockTimestamp=Number(rpcQuantity(b.timestamp));
      }else{
        const head=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:1,method:'eth_blockNumber',params:[]}],fetchImpl);blockNumber=rpcQuantity(head.get(1).result);blockTag=`0x${blockNumber.toString(16)}`;
        const check=await postBatch(endpoint.url,[{jsonrpc:'2.0',id:2,method:'eth_getBlockByNumber',params:[blockTag,false]}],fetchImpl);const b=check.get(2).result;
        if(!/^0x[0-9a-f]{64}$/i.test(String(b?.hash||'')))throw new Error('Exact block identity unavailable');blockHash=String(b.hash).toLowerCase();blockTimestamp=Number(rpcQuantity(b.timestamp));
      }
      const call=(id,to,data)=>({jsonrpc:'2.0',id,method:'eth_call',params:[{to,data},blockTag]});
      const root=await postBatch(endpoint.url,[
        {jsonrpc:'2.0',id:10,method:'eth_getCode',params:[cfg.factory.address,blockTag]},
        {jsonrpc:'2.0',id:11,method:'eth_getCode',params:[cfg.baseAsset.address,blockTag]},
        call(12,cfg.factory.address,S.allPairsLength)
      ],fetchImpl);
      if(!nonemptyCode(root.get(10).result)||!nonemptyCode(root.get(11).result))throw new Error('Factory/base-asset code missing');
      const pairCount=Number(word(root.get(12).result));if(!Number.isSafeInteger(pairCount)||pairCount<1||pairCount>MAX_FACTORY_PAIRS)throw new Error(`Factory pair count invalid ${pairCount}`);

      let id=1000;const pairReq=[],pairIds=[];for(let i=0;i<pairCount;i++){pairIds.push({index:i,id});pairReq.push(call(id++,cfg.factory.address,S.allPairs+uintArg(i)));}
      const pairRes=await batched(endpoint.url,pairReq,fetchImpl);const pairAddresses=pairIds.map(x=>address(pairRes.get(x.id).result));
      if(new Set(pairAddresses.map(normalizeAddress)).size!==pairAddresses.length)throw new Error('Duplicate factory pair identity');

      const metaReq=[],meta=[];id=10000;for(const pair of pairAddresses){const row={pair,factory:id++,token0:id++,token1:id++};meta.push(row);metaReq.push(call(row.factory,pair,S.factory),call(row.token0,pair,S.token0),call(row.token1,pair,S.token1));}
      const metaRes=await batched(endpoint.url,metaReq,fetchImpl);const matches=[];
      for(const row of meta){const factory=address(metaRes.get(row.factory).result),token0=address(metaRes.get(row.token0).result),token1=address(metaRes.get(row.token1).result);if(!sameAddress(factory,cfg.factory.address))throw new Error(`Pair factory identity drift ${row.pair}`);if(sameAddress(token0,cfg.baseAsset.address)||sameAddress(token1,cfg.baseAsset.address))matches.push({pair:row.pair,token0,token1,baseSide:sameAddress(token0,cfg.baseAsset.address)?0:1,counterAsset:sameAddress(token0,cfg.baseAsset.address)?token1:token0});}
      if(!matches.length)throw new Error('No configured base-asset pairs found in factory');

      const liqReq=[];id=50000;for(const row of matches){row.reserves=id++;row.supply=id++;liqReq.push(call(row.reserves,row.pair,S.getReserves),call(row.supply,row.pair,S.totalSupply));}
      const liqRes=await batched(endpoint.url,liqReq,fetchImpl);let totalBaseReserve=0n;
      const pairs=matches.map(row=>{const reserveWords=words(liqRes.get(row.reserves).result);if(reserveWords.length<2)throw new Error(`Pair reserves unavailable ${row.pair}`);const reserve0=reserveWords[0],reserve1=reserveWords[1],supply=word(liqRes.get(row.supply).result),baseReserve=row.baseSide===0?reserve0:reserve1,counterReserve=row.baseSide===0?reserve1:reserve0;totalBaseReserve+=baseReserve;return {pair:row.pair,token0:row.token0,token1:row.token1,baseAsset:cfg.baseAsset.address,counterAsset:row.counterAsset,baseSide:row.baseSide,raw:{reserve0:reserve0.toString(),reserve1:reserve1.toString(),baseReserve:baseReserve.toString(),counterReserve:counterReserve.toString(),lpTotalSupply:supply.toString()},epistemic:{pairIdentity:'MEASURED-exact-block',reserves:'MEASURED-exact-block',counterAssetSemantics:'UNKNOWN-address-only',usdValue:'UNKNOWN-not-valued',volume:'UNKNOWN-not-measured',fees:'UNKNOWN-not-measured',incentives:'UNKNOWN-not-measured',capitalMigration:'UNKNOWN-not-measured'}};});
      const observedAt=new Date(blockTimestamp*1000).toISOString();
      return {
        version:CONSTANT_PRODUCT_ASSET_LIQUIDITY_VERSION,status:'ok',measurementClass:'MEASURED',observedAt,
        network:{name:cfg.network.name,chainId:Number(cfg.network.chainId),blockNumber:Number(blockNumber),blockTag,blockHash,blockTimestamp,checkpointId:checkpointIdentity({blockNumber:Number(blockNumber),blockHash})},
        factory:{...cfg.factory,codePresent:true,pairCount},baseAsset:{...cfg.baseAsset,codePresent:true},pairs,
        summary:{factoryPairCount:pairCount,matchingPairCount:pairs.length,totalBaseReserveRaw:totalBaseReserve.toString()},
        rpc:{endpointId:endpoint.id,failoverAttempts:attempts},provenance:cfg.source,
        edges:[
          {from:'exact-block Factory allPairs registry',to:'pairs containing configured base asset',class:'MEASURED-exact-block'},
          {from:'pair getReserves()',to:'pair-local base/counter reserves',class:'MEASURED-exact-block'},
          {from:'same configured base-asset reserve units',to:'aggregate base reserve across selected pairs',class:'DERIVED-MECHANICAL-safe-same-asset-sum'},
          {from:'pair reserves',to:'USD TVL',class:'UNKNOWN-counterpart-not-valued'},
          {from:'pair liquidity change',to:'capital migration',class:'UNKNOWN-no-address/transaction-flow-proof'}
        ],
        epistemic:{factoryRegistry:'MEASURED-exact-block-complete-registry',pairReserves:'MEASURED-exact-block',baseReserveAggregate:'DERIVED-MECHANICAL-same-asset-only',usdTvl:'UNKNOWN-not-valued-by-this-collector',volume:'UNKNOWN-not-measured-by-this-collector',fees:'UNKNOWN-not-measured-by-this-collector',incentives:'UNKNOWN-not-measured-by-this-collector',priceDeviation:'UNKNOWN-not-measured-by-this-collector',capitalMigration:'UNKNOWN-not-measured-by-this-collector',counterpartUnitsAggregated:false,usdValuationPerformed:false,unknownIsZero:false,causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'},
        proofHash:sha256(JSON.stringify({chainId:cfg.network.chainId,blockNumber:Number(blockNumber),blockHash,factory:normalizeAddress(cfg.factory.address),base:normalizeAddress(cfg.baseAsset.address),pairs:pairs.map(x=>[normalizeAddress(x.pair),x.raw.baseReserve,x.raw.counterReserve])}))
      };
    }catch(error){attempts.push({endpointId:endpoint.id,error:error instanceof Error?error.message:String(error)});}
  }
  return unknown(cfg,attempts);
}
