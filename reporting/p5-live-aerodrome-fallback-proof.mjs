#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';
import { historicalCanonicalPriceAtBoundary } from './historical-canonical-price.mjs';
import { discoverHistoricalAerodromeUsdcRoute } from './historical-aerodrome-usdc-route.mjs';
import {
  SELECTORS as V2_SELECTORS,
  encodeGetPool as encodeV2GetPool,
  encodeQuote as encodeV2Quote,
  decodeUint256 as decodeV2Uint256,
  decodeAddress as decodeV2Address,
  decodeBool as decodeV2Bool,
  DEFAULT_TWAP_GRANULARITY as V2_TWAP_GRANULARITY
} from './historical-velodrome-usdc-route.mjs';

const ledger=JSON.parse(await fs.readFile('reporting/income-ledger.json','utf8'));
const registry=JSON.parse(await fs.readFile('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const targetCompany='aerocvxyb.eth';
const valuationReason='canonical-event-usd-valuation-incomplete';
const BASE_USDC='0x833589fCD6eDb6E08f4C7C32D4f71b54bdA02913';
const BASE_AERO='0x940181a94A35A4569E4529A3CDfB74e38FD98631';
const BASE_WETH='0x4200000000000000000000000000000000000006';
const AERODROME_V2_POOL_FACTORY='0x420DD381b31aEf6683db6B902084cB0FFECe40Da';
const ZERO_ADDRESS='0x0000000000000000000000000000000000000000';
const lower=v=>String(v||'').toLowerCase();
const abiHex=v=>`0x${BigInt(v).toString(16)}`;
const isVe33Target=e=>e?.company===targetCompany&&e?.sourceFile==='reporting/ve33-accounting-evidence.json'&&e?.family==='accrued-entitlement';

async function rpcCall({endpoint,method,params,fetchImpl=fetch}={}){
  const response=await fetchImpl(endpoint?.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(body?.error)throw new Error(body.error?.message||JSON.stringify(body.error));
  return body?.result;
}

async function discoverHistoricalAerodromeV2Route({token,quoteToken,quoteTokenDecimals,sourceBlockNumber,boundaryAt,network}={}){
  if(!/^0x[0-9a-f]{40}$/i.test(String(token||''))||!/^0x[0-9a-f]{40}$/i.test(String(quoteToken||''))||lower(token)===lower(quoteToken)){
    return{ok:false,status:'invalid-token-pair'};
  }
  if(!Number.isSafeInteger(Number(sourceBlockNumber))||Number(sourceBlockNumber)<=0)return{ok:false,status:'invalid-source-block'};
  const boundaryMs=Date.parse(boundaryAt||'');
  if(!Number.isFinite(boundaryMs))return{ok:false,status:'invalid-accounting-boundary'};
  if(Number(network?.chainId)!==8453||!Array.isArray(network?.rpcFailover)||network.rpcFailover.length===0)return{ok:false,status:'base-historical-rpc-fabric-unavailable'};
  const blockTag=abiHex(sourceBlockNumber),attempts=[];
  for(const endpoint of network.rpcFailover){
    try{
      const block=await rpcCall({endpoint,method:'eth_getBlockByNumber',params:[blockTag,false]});
      if(lower(block?.number)!==lower(blockTag))throw new Error('closing block mismatch');
      const blockTimestampMs=Number(BigInt(block?.timestamp||'0x0'))*1000;
      const boundaryLagSeconds=(boundaryMs-blockTimestampMs)/1000;
      if(!(Number.isFinite(blockTimestampMs)&&blockTimestampMs>0)||blockTimestampMs>boundaryMs||boundaryLagSeconds>120){
        throw new Error(`historical block boundary mismatch lag=${boundaryLagSeconds}`);
      }
      const decimalsHex=await rpcCall({endpoint,method:'eth_call',params:[{to:token,data:V2_SELECTORS.decimals},blockTag]});
      const tokenDecimals=Number(decodeV2Uint256(decimalsHex));
      if(!Number.isInteger(tokenDecimals)||tokenDecimals<0||tokenDecimals>36)throw new Error('reward token decimals invalid');
      const amountIn=10n**BigInt(tokenDecimals),candidates=[];
      for(const poolStable of [false,true]){
        try{
          const poolHex=await rpcCall({endpoint,method:'eth_call',params:[{to:AERODROME_V2_POOL_FACTORY,data:encodeV2GetPool(token,quoteToken,poolStable)},blockTag]});
          const pool=decodeV2Address(poolHex);
          if(lower(pool)===ZERO_ADDRESS)continue;
          const[token0Hex,token1Hex,stableHex,observationLengthHex]=await Promise.all([
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:V2_SELECTORS.token0},blockTag]}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:V2_SELECTORS.token1},blockTag]}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:V2_SELECTORS.stable},blockTag]}),
            rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:V2_SELECTORS.observationLength},blockTag]})
          ]);
          const token0=decodeV2Address(token0Hex),token1=decodeV2Address(token1Hex),stable=decodeV2Bool(stableHex),observationLength=Number(decodeV2Uint256(observationLengthHex));
          const pair=new Set([lower(token0),lower(token1)]);
          if(pair.size!==2||!pair.has(lower(token))||!pair.has(lower(quoteToken))||stable!==poolStable)continue;
          let quoteTokenAmount=null,quoteOk=false,quoteError=null;
          if(Number.isSafeInteger(observationLength)&&observationLength>Number(V2_TWAP_GRANULARITY)){
            try{
              const quoteHex=await rpcCall({endpoint,method:'eth_call',params:[{to:pool,data:encodeV2Quote(token,amountIn,V2_TWAP_GRANULARITY)},blockTag]});
              const quoteRaw=decodeV2Uint256(quoteHex);
              quoteTokenAmount=Number(quoteRaw)/10**Number(quoteTokenDecimals);
              quoteOk=Number.isFinite(quoteTokenAmount)&&quoteTokenAmount>0;
            }catch(error){quoteError=error?.message||String(error);}
          }
          candidates.push({pool,poolStable,token0,token1,observationLength,quoteOk,quoteTokenAmount,quoteError});
        }catch(error){attempts.push({endpointId:endpoint?.id||null,poolStable,error:error?.message||String(error)});}
      }
      if(candidates.length>0){
        return{
          ok:candidates.some(x=>x.quoteOk),
          status:candidates.some(x=>x.quoteOk)?'historical-aerodrome-v2-twap-route-proven':'historical-aerodrome-v2-pool-found-no-48-point-twap',
          chainId:8453,sourceBlockNumber:Number(sourceBlockNumber),sourceBlockTimestamp:new Date(blockTimestampMs).toISOString(),
          rpcEndpointId:endpoint?.id||null,factory:AERODROME_V2_POOL_FACTORY,token,tokenDecimals,quoteToken,quoteTokenDecimals,
          twapGranularity:Number(V2_TWAP_GRANULARITY),candidates,exactHistoricalBlock:true,currentPriceUsed:false,executionAuthority:'none'
        };
      }
    }catch(error){attempts.push({endpointId:endpoint?.id||null,error:error?.message||String(error)});}
  }
  return{ok:false,status:'historical-aerodrome-v2-route-unavailable',sourceBlockNumber:Number(sourceBlockNumber),attempts};
}

const beforeView=buildCanonicalEarnedIncomeView(ledger);
const beforeUnresolved=beforeView.unresolved.filter(x=>x.company===targetCompany&&x.reason===valuationReason);
const beforeByKey=new Map((ledger.events||[]).map(e=>[e.eventKey,e]));
assert.ok(beforeUnresolved.length>0,'live baseline no longer has the expected aerocvxyb historical USD blocker; refresh the P5 diagnosis before proceeding');

const annotated=await annotateHistoricalValuationResolution(ledger);
const candidateLedger=annotated.ledger;
const afterView=buildCanonicalEarnedIncomeView(candidateLedger);
const afterUnresolved=afterView.unresolved.filter(x=>x.company===targetCompany&&x.reason===valuationReason);
const afterUnresolvedKeys=new Set(afterUnresolved.map(x=>x.eventKey));
const newlyRecognized=beforeUnresolved.filter(x=>!afterUnresolvedKeys.has(x.eventKey));
const candidateEvents=(candidateLedger.events||[]).filter(isVe33Target);
const candidateByKey=new Map((candidateLedger.events||[]).map(e=>[e.eventKey,e]));
const aeroFallbackEvents=candidateEvents.filter(e=>{
  const r=e?.valuationResolution;
  if(r?.sourceFamily!=='historical-onchain-aerodrome-twap-chainlink-at-boundary'||String(r?.quoteTokenSymbol)!=='AERO')return false;
  const prior=beforeByKey.get(e.eventKey)?.valuationResolution;
  return !(prior?.sourceFamily===r.sourceFamily&&String(prior?.quoteTokenSymbol)==='AERO'&&Number(prior?.resolvedUsdValue)>0);
});

const allAfterValuationBlockers=afterView.unresolved.filter(x=>x.reason===valuationReason);
const aerodromeBlockers=allAfterValuationBlockers
  .map(x=>candidateByKey.get(x.eventKey))
  .filter(e=>e?.sourceFile==='reporting/ve33-accounting-evidence.json'&&String(e?.protocol||'').toLowerCase()==='aerodrome');
const residualDiagnostics=[];
for(const event of aerodromeBlockers){
  const result=await historicalCanonicalPriceAtBoundary({token:event.token,boundaryAt:event.periodEnd,eventKey:event.eventKey,sourceIdentity:event.sourceIdentity,root:'.'});
  residualDiagnostics.push({eventKey:event.eventKey,company:event.company,token:lower(event.token),asset:event.asset||null,amount:event.amount??null,boundaryAt:event.periodEnd,chainId:event.chainId,resolverStatus:result?.status||null,sourceBlockNumber:result?.sourceBlockNumber??null,attempts:Array.isArray(result?.attempts)?result.attempts:null});
}

const baseNetwork=registry?.networks?.base;
const quoteRoutes=[
  {token:BASE_USDC,symbol:'USDC',decimals:6},
  {token:BASE_AERO,symbol:'AERO',decimals:18},
  {token:BASE_WETH,symbol:'WETH',decimals:18}
];
const probeCache=new Map(),classicV2Diagnostics=[];
for(const event of aerodromeBlockers){
  const match=String(event.eventKey||'').match(/:(\d+):(\d+)$/),sourceBlockNumber=match?Number(match[2]):null;
  for(const quote of quoteRoutes){
    const cacheKey=`${lower(event.token)}|${sourceBlockNumber}|${event.periodEnd}|${lower(quote.token)}`;
    if(!probeCache.has(cacheKey))probeCache.set(cacheKey,discoverHistoricalAerodromeV2Route({token:event.token,quoteToken:quote.token,quoteTokenDecimals:quote.decimals,sourceBlockNumber,boundaryAt:event.periodEnd,network:baseNetwork}));
    const route=await probeCache.get(cacheKey);
    classicV2Diagnostics.push({eventKey:event.eventKey,company:event.company,asset:event.asset||null,token:lower(event.token),boundaryAt:event.periodEnd,sourceBlockNumber,quoteSymbol:quote.symbol,quoteToken:lower(quote.token),routeFound:route?.ok===true,routeStatus:route?.status||null,factory:route?.factory?lower(route.factory):null,twapGranularity:route?.twapGranularity??null,candidates:Array.isArray(route?.candidates)?route.candidates.map(x=>({pool:lower(x.pool),poolStable:x.poolStable,observationLength:x.observationLength,quoteOk:x.quoteOk,quoteTokenAmount:x.quoteTokenAmount,quoteError:x.quoteError})):[],exactHistoricalBlock:route?.exactHistoricalBlock===true,currentPriceUsed:false,executionAuthority:'none'});
  }
}
const provenClassic=classicV2Diagnostics.filter(x=>x.routeFound);
const foundPoolNoTwap=classicV2Diagnostics.filter(x=>x.routeStatus==='historical-aerodrome-v2-pool-found-no-48-point-twap');
const classicAssets=[...new Set(provenClassic.map(x=>x.asset).filter(Boolean))];
const statusCounts={};
for(const x of classicV2Diagnostics)statusCounts[`${x.quoteSymbol}:${x.routeStatus}`]=(statusCounts[`${x.quoteSymbol}:${x.routeStatus}`]||0)+1;

const summary={
  ok:provenClassic.length>0,
  targetCompany,
  baselineValuationBlockers:beforeUnresolved.length,
  candidateValuationBlockers:afterUnresolved.length,
  blockerDelta:beforeUnresolved.length-afterUnresolved.length,
  newlyRecognizedEventKeys:newlyRecognized.map(x=>x.eventKey),
  aeroFallbackEventCount:aeroFallbackEvents.length,
  eligibleEventCount:annotated.eligibleEventCount??null,
  resolvedEventCount:annotated.resolvedEventCount??null,
  unresolvedEventCount:annotated.unresolvedEventCount??null,
  unresolvedStatuses:annotated.unresolvedStatuses??null,
  residualAerodromeBlockerCount:residualDiagnostics.length,
  classicV2TopologyProbe:{
    factory:lower(AERODROME_V2_POOL_FACTORY),
    twapGranularity:Number(V2_TWAP_GRANULARITY),
    provenRouteEventQuoteCount:provenClassic.length,
    poolFoundButTwapInsufficientCount:foundPoolNoTwap.length,
    assetsWithProvenRoute:classicAssets,
    statusCounts,
    provenRoutes:provenClassic,
    poolFoundButTwapInsufficient:foundPoolNoTwap
  },
  residualDiagnostics,
  executionAuthority:'none'
};
console.log('P5 LIVE residual Aerodrome classic V2 topology probe',JSON.stringify(summary,null,2));
assert.ok(summary.classicV2TopologyProbe.provenRouteEventQuoteCount>0,'no live residual Aerodrome blocker has a proven classic V2 historical TWAP route');
