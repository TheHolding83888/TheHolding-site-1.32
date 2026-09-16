#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {
  discoverHistoricalAerodromeUsdcRoute,
  BASE_NATIVE_USDC
} from './historical-aerodrome-usdc-route.mjs';

const BLUECHIP='0xB200000000000000000000cFbdF64a8706a94a01';
const AERO='0x940181a94A35A4569E4529A3CDfB74e38FD98631';
const RPC_TIMEOUT_MS=12_000;
const lower=value=>String(value||'').toLowerCase();
const closingBlock=event=>{
  const match=String(event?.eventKey||'').match(/:(\d+):(\d+)$/);
  const block=match?Number(match[2]):null;
  return Number.isSafeInteger(block)&&block>0?block:null;
};

async function rpcCall({endpoint,method,params,fetchImpl=fetch}){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),RPC_TIMEOUT_MS);
  try{
    const response=await fetchImpl(endpoint.url,{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),
      signal:controller.signal
    });
    if(!response.ok)throw new Error(`RPC ${endpoint.id||'unknown'} HTTP ${response.status}`);
    const payload=await response.json();
    if(payload?.error)throw new Error(`RPC ${endpoint.id||'unknown'} ${payload.error.code??''} ${payload.error.message||'error'}`.trim());
    if(payload?.result===undefined||payload?.result===null)throw new Error(`RPC ${endpoint.id||'unknown'} result missing`);
    return payload.result;
  }finally{
    clearTimeout(timer);
  }
}

const [ledger,registry]=await Promise.all([
  fs.readFile('reporting/income-ledger.json','utf8').then(JSON.parse),
  fs.readFile('intelligence/market-data/onchain-price-source-registry.json','utf8').then(JSON.parse)
]);

const targets=(ledger.events||[]).filter(event=>
  lower(event?.protocol)==='aerodrome'&&
  lower(event?.token)===lower(BLUECHIP)&&
  event?.usdValue===null&&
  String(event?.valuationStatus||'')==='unvalued-fail-closed'
);
assert.ok(targets.length>0,'No current unresolved BLUECHIP Aerodrome event found; refresh diagnosis instead of probing stale target');

const configured=String(process.env.BASE_ARCHIVE_RPC_URL||process.env.BASE_RPC_URL||'').trim();
const baseNetwork={
  ...(registry?.networks?.base||{}),
  rpcFailover:[
    ...(configured?[{id:'configured-base-archive',url:configured}]:[]),
    ...((registry?.networks?.base?.rpcFailover)||[])
  ]
};
assert.equal(Number(baseNetwork.chainId),8453,'Base network registry missing');

const boundaryGroups=new Map();
for(const event of targets){
  const block=closingBlock(event);
  assert.ok(block,`BLUECHIP event missing exact closing block: ${event.eventKey}`);
  const boundaryAt=event.periodEnd||event.valuationAt;
  assert.ok(Number.isFinite(Date.parse(boundaryAt||'')),`BLUECHIP event missing valid boundary: ${event.eventKey}`);
  const key=`${lower(event.token)}:${block}:${boundaryAt}`;
  const group=boundaryGroups.get(key)||{token:event.token,block,boundaryAt,eventKeys:[],tokenIds:[]};
  group.eventKeys.push(event.eventKey);
  if(event.tokenId!==null&&event.tokenId!==undefined&&!group.tokenIds.includes(String(event.tokenId)))group.tokenIds.push(String(event.tokenId));
  boundaryGroups.set(key,group);
}

const compact=result=>({
  ok:result?.ok===true,
  status:result?.status||null,
  sourceBlockNumber:result?.sourceBlockNumber??null,
  sourceBlockTimestamp:result?.sourceBlockTimestamp??null,
  rpcEndpointId:result?.rpcEndpointId||null,
  factory:result?.factory||null,
  pool:result?.pool||null,
  tickSpacing:result?.tickSpacing??null,
  liquidity:result?.liquidity||null,
  quoteToken:result?.quoteToken||null,
  quoteTokenAmount:result?.quoteTokenAmount??null,
  twapSeconds:result?.twapSeconds??null,
  averageTick:result?.averageTick??null,
  exactHistoricalBlock:result?.exactHistoricalBlock===true,
  stablecoinPegAssumptionUsed:result?.stablecoinPegAssumptionUsed??null,
  currentPriceUsed:result?.currentPriceUsed??null,
  referenceAprUsed:result?.referenceAprUsed??null,
  executionAuthority:result?.executionAuthority||'none'
});

const results=[];
for(const group of boundaryGroups.values()){
  const common={
    token:group.token,
    sourceBlockNumber:group.block,
    boundaryAt:group.boundaryAt,
    network:baseNetwork,
    rpcCall,
    fetchImpl:fetch
  };
  const direct=await discoverHistoricalAerodromeUsdcRoute(common);
  const aero=await discoverHistoricalAerodromeUsdcRoute({...common,quoteToken:AERO,quoteTokenDecimals:18});
  for(const candidate of [direct,aero]){
    if(candidate?.ok===true){
      assert.equal(candidate.exactHistoricalBlock,true,'Proven route is not exact historical block');
      assert.equal(candidate.currentPriceUsed,false,'Current price leaked into route proof');
      assert.equal(candidate.stablecoinPegAssumptionUsed,false,'Stablecoin peg assumption leaked into route proof');
      assert.equal(candidate.referenceAprUsed,false,'Reference APR leaked into route proof');
      assert.equal(candidate.executionAuthority,'none','Execution authority expanded');
    }
  }
  results.push({
    boundaryAt:group.boundaryAt,
    sourceBlockNumber:group.block,
    eventCount:group.eventKeys.length,
    tokenIds:group.tokenIds,
    directUsdc:compact(direct),
    aeroFallback:compact(aero),
    routeClass:direct?.ok===true?'DIRECT_USDC_PROVEN':aero?.ok===true?'AERO_FALLBACK_PROVEN':'NO_APPROVED_ROUTE_PROVEN'
  });
}

const summary={
  ok:true,
  diagnosticOnly:true,
  token:'BLUECHIP',
  tokenAddress:BLUECHIP,
  unresolvedEventCount:targets.length,
  uniqueBoundaryCount:boundaryGroups.size,
  results,
  anyDirectUsdcProven:results.some(row=>row.directUsdc.ok),
  anyAeroFallbackProven:results.some(row=>row.aeroFallback.ok),
  allBoundariesHaveApprovedRoute:results.every(row=>row.directUsdc.ok||row.aeroFallback.ok),
  productionAccountingMutated:false,
  currentPriceUsed:false,
  executionAuthority:'none'
};

console.log('PRE-P10 BLUECHIP HISTORICAL ROUTE DIAGNOSTIC');
console.log(JSON.stringify(summary,null,2));
