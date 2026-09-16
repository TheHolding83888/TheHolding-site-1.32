#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';
import { historicalCanonicalPriceAtBoundary } from './historical-canonical-price.mjs';
import { discoverHistoricalAerodromeUsdcRoute } from './historical-aerodrome-usdc-route.mjs';

const ledger=JSON.parse(await fs.readFile('reporting/income-ledger.json','utf8'));
const registry=JSON.parse(await fs.readFile('intelligence/market-data/onchain-price-source-registry.json','utf8'));
const targetCompany='aerocvxyb.eth';
const valuationReason='canonical-event-usd-valuation-incomplete';
const BASE_WETH='0x4200000000000000000000000000000000000006';
const lower=v=>String(v||'').toLowerCase();
const isVe33Target=e=>e?.company===targetCompany&&e?.sourceFile==='reporting/ve33-accounting-evidence.json'&&e?.family==='accrued-entitlement';

async function rpcCall({endpoint,method,params,fetchImpl=fetch}={}){
  const response=await fetchImpl(endpoint?.url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);
  const body=await response.json();
  if(body?.error)throw new Error(body.error?.message||JSON.stringify(body.error));
  return body?.result;
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

for(const event of aeroFallbackEvents){
  const r=event.valuationResolution;
  assert.equal(r.currentPriceUsed,false);
  assert.equal(r.stablecoinPegAssumptionUsed,false);
  assert.equal(r.referenceAprUsed,false);
  assert.equal(r.executionAuthority,'none');
  assert.equal(r.economicFieldsMutated,false);
  assert.ok(Number(r.resolvedUsdValue)>0);
}

// Classify every live Aerodrome valuation blocker through the exact candidate resolver.
// This is diagnostic only: no repository artifact or economic event is mutated.
const allAfterValuationBlockers=afterView.unresolved.filter(x=>x.reason===valuationReason);
const aerodromeBlockers=allAfterValuationBlockers
  .map(x=>candidateByKey.get(x.eventKey))
  .filter(e=>e?.sourceFile==='reporting/ve33-accounting-evidence.json'&&String(e?.protocol||'').toLowerCase()==='aerodrome');
const residualDiagnostics=[];
for(const event of aerodromeBlockers){
  const result=await historicalCanonicalPriceAtBoundary({
    token:event.token,
    boundaryAt:event.periodEnd,
    eventKey:event.eventKey,
    sourceIdentity:event.sourceIdentity,
    root:'.'
  });
  residualDiagnostics.push({
    eventKey:event.eventKey,
    company:event.company,
    token:lower(event.token),
    asset:event.asset||null,
    amount:event.amount??null,
    boundaryAt:event.periodEnd,
    chainId:event.chainId,
    resolverStatus:result?.status||null,
    sourceBlockNumber:result?.sourceBlockNumber??null,
    approvedQuoteCount:result?.approvedQuoteCount??null,
    attempts:Array.isArray(result?.attempts)?result.attempts:null,
    currentPriceUsed:result?.currentPriceUsed??false,
    stablecoinPegAssumptionUsed:result?.stablecoinPegAssumptionUsed??false,
    executionAuthority:result?.executionAuthority||'none'
  });
}

const routeStatusCounts={};
for(const item of residualDiagnostics){
  const attempts=Array.isArray(item.attempts)?item.attempts:[];
  if(attempts.length===0){
    const key=item.resolverStatus||'unknown';
    routeStatusCounts[key]=(routeStatusCounts[key]||0)+1;
  }
  for(const attempt of attempts){
    const key=`${attempt.quoteSymbol||attempt.quoteToken||'quote'}:${attempt.routeStatus||attempt.quoteStatus||'unknown'}`;
    routeStatusCounts[key]=(routeStatusCounts[key]||0)+1;
  }
}

// P5 topology probe: before implementing another quote leg, prove whether the
// unresolved reward tokens actually had active historical Slipstream WETH pools.
const baseNetwork=registry?.networks?.base;
const wethProbeCache=new Map();
const wethRouteDiagnostics=[];
for(const event of aerodromeBlockers){
  const match=String(event.eventKey||'').match(/:(\d+):(\d+)$/);
  const sourceBlockNumber=match?Number(match[2]):null;
  const cacheKey=`${lower(event.token)}|${sourceBlockNumber}|${event.periodEnd}`;
  if(!wethProbeCache.has(cacheKey)){
    wethProbeCache.set(cacheKey,discoverHistoricalAerodromeUsdcRoute({
      token:event.token,
      sourceBlockNumber,
      boundaryAt:event.periodEnd,
      network:baseNetwork,
      rpcCall,
      quoteToken:BASE_WETH,
      quoteTokenDecimals:18
    }).catch(error=>({ok:false,status:'weth-topology-probe-error',error:error?.message||String(error)})));
  }
  const route=await wethProbeCache.get(cacheKey);
  wethRouteDiagnostics.push({
    eventKey:event.eventKey,
    company:event.company,
    token:lower(event.token),
    asset:event.asset||null,
    boundaryAt:event.periodEnd,
    sourceBlockNumber,
    routeFound:route?.ok===true,
    routeStatus:route?.status||null,
    pool:route?.pool?lower(route.pool):null,
    factory:route?.factory?lower(route.factory):null,
    tickSpacing:route?.tickSpacing??null,
    liquidity:route?.liquidity??null,
    quoteToken:route?.quoteToken?lower(route.quoteToken):lower(BASE_WETH),
    quoteTokenAmount:route?.quoteTokenAmount??null,
    exactHistoricalBlock:route?.exactHistoricalBlock===true,
    currentPriceUsed:false,
    executionAuthority:'none'
  });
}
const wethRouteEventCount=wethRouteDiagnostics.filter(x=>x.routeFound).length;
const wethRouteUniqueKeys=[...new Set(wethRouteDiagnostics.filter(x=>x.routeFound).map(x=>`${x.token}|${x.sourceBlockNumber}`))];
const wethRouteAssets=[...new Set(wethRouteDiagnostics.filter(x=>x.routeFound).map(x=>x.asset).filter(Boolean))];
const wethStatusCounts={};
for(const item of wethRouteDiagnostics)wethStatusCounts[item.routeStatus]=(wethStatusCounts[item.routeStatus]||0)+1;

const summary={
  ok:wethRouteEventCount>0,
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
  residualRouteStatusCounts:routeStatusCounts,
  wethTopologyProbe:{
    quoteToken:lower(BASE_WETH),
    routeFoundEventCount:wethRouteEventCount,
    routeFoundUniqueTokenBlockCount:wethRouteUniqueKeys.length,
    assets:wethRouteAssets,
    statusCounts:wethStatusCounts,
    diagnostics:wethRouteDiagnostics
  },
  residualDiagnostics,
  executionAuthority:'none'
};
console.log('P5 LIVE residual Aerodrome WETH topology probe',JSON.stringify(summary,null,2));
assert.ok(summary.wethTopologyProbe.routeFoundEventCount>0,'no live residual Aerodrome blocker has a proven historical WETH route');
