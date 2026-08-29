#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import {
  collectFraxSfrxUsdOnchain,
  applyFraxSfrxUsdOnchainMeasurement,
  FRXUSD_ETHEREUM,
  SFRXUSD_ETHEREUM
} from './frax-sfrxusd-onchain.mjs';

const E18=10n**18n;
function uint256(value){return `0x${BigInt(value).toString(16).padStart(64,'0')}`;}
function minimalRegistry(){return {
  networks:{ethereum:{chainId:1,rpcFailover:[
    {id:'first-fails',url:'https://first.invalid'},
    {id:'second-ok',url:'https://second.invalid'}
  ]}}
};}
function makeFetch({shareAssets=105n*E18,allFail=false}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    if(payload.length===1&&payload[0].method==='eth_blockNumber')return {ok:true,async json(){return [{jsonrpc:'2.0',id:1,result:'0x64'}];}};
    const rows=payload.map(req=>{
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method!=='eth_call')throw new Error(`Unexpected method ${req.method}`);
      assert.equal(req.params[1],'0x64','all contract reads must be exact-block bound');
      const to=String(req.params[0].to).toLowerCase();const data=req.params[0].data;
      if(to===FRXUSD_ETHEREUM.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(1000n*E18)};
      if(to===FRXUSD_ETHEREUM.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uint256(18n)};
      if(to===SFRXUSD_ETHEREUM.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(100n*E18)};
      if(to===SFRXUSD_ETHEREUM.toLowerCase()&&data==='0x01e1d114')return {jsonrpc:'2.0',id:req.id,result:uint256(shareAssets)};
      if(to===SFRXUSD_ETHEREUM.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uint256(18n)};
      throw new Error(`Unexpected call ${to} ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}
function baseState(generatedAt='2026-08-28T12:00:00.000Z'){return {generatedAt,authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}

const first=await collectFraxSfrxUsdOnchain({registry:minimalRegistry(),fetchImpl:makeFetch()});
assert.equal(first.status,'ok');assert.equal(first.measurementClass,'MEASURED');assert.equal(first.rpc.endpointId,'second-ok');assert.equal(first.rpc.failoverAttempts.length,1);assert.equal(first.blockNumber,100);assert.equal(first.values.frxUsdSupply,1000);assert.equal(first.values.sfrxUsdSupply,100);assert.equal(first.values.sfrxUsdTotalAssets,105);assert.equal(first.values.sharePriceFrxUsd,1.05);assert.equal(first.epistemic.executionAuthority,'none');
const state1=baseState();applyFraxEcosystemSensor({state:state1,previousState:null});applyFraxSfrxUsdOnchainMeasurement({state:state1,previousState:null,measurement:first});const obs1=state1.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs1.coverage.surfaceCount,9);assert.equal(obs1.coverage.measuredSurfaceCount,2);assert.equal(obs1.coverage.sourceBoundUnknownSurfaceCount,7);assert.equal(obs1.surfaces.frxUsdSfrxUsd.measurementState,'MEASURED-current-onchain-partial');assert.equal(obs1.surfaces.frxUsdSfrxUsd.measured.intervalEmbeddedYield.status,'warming-first-onchain-checkpoint');assert.equal(obs1.surfaces.frxUsdSfrxUsd.measured.intervalEmbeddedYield.accepted,false);
const second={...first,observedAt:'2024-01-01T00:10:00.000Z',blockNumber:101,blockTag:'0x65',blockHash:`0x${'cd'.repeat(32)}`,values:{...first.values,sfrxUsdTotalAssets:106,sharePriceFrxUsd:1.06},raw:{...first.raw,sfrxUsdTotalAssets:(106n*E18).toString()}};
const previous=structuredClone(state1),state2=baseState('2026-08-28T12:10:00.000Z');applyFraxEcosystemSensor({state:state2,previousState:previous});applyFraxSfrxUsdOnchainMeasurement({state:state2,previousState:previous,measurement:second});const obs2=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation,interval=obs2.surfaces.frxUsdSfrxUsd.measured.intervalEmbeddedYield;
assert.equal(interval.status,'ok');assert.equal(interval.accepted,true);assert.ok(Math.abs(interval.embeddedYieldPct-0.952380952381)<1e-9);assert.equal(interval.annualizedApyPct,null);assert.match(interval.annualizationState,/NOT-CALCULATED/);assert.equal(obs2.epistemic.sfrxUsdEmbeddedYield,'DERIVED-MECHANICAL');assert.equal(obs2.authority.executionAuthority,'none');
const unavailable=await collectFraxSfrxUsdOnchain({registry:minimalRegistry(),fetchImpl:makeFetch({allFail:true})});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');assert.equal(unavailable.values.sharePriceFrxUsd,null);const state3=baseState();applyFraxEcosystemSensor({state:state3,previousState:null});applyFraxSfrxUsdOnchainMeasurement({state:state3,previousState:null,measurement:unavailable});const obs3=state3.protocolEvidence['registry-frax-ecosystem'].latest.observation;assert.equal(obs3.coverage.measuredSurfaceCount,1);assert.equal(obs3.coverage.sourceBoundUnknownSurfaceCount,8);assert.equal(obs3.surfaces.frxUsdSfrxUsd.measured.values.sharePriceFrxUsd,null);assert.equal(obs3.epistemic.sfrxUsdCurrentState,'UNKNOWN');
console.log('FRAX sfrxUSD ONCHAIN SENSOR CANARY PASS',{exactBlock:first.blockNumber,rpcEndpoint:first.rpc.endpointId,sharePrice:first.values.sharePriceFrxUsd,firstInterval:obs1.surfaces.frxUsdSfrxUsd.measured.intervalEmbeddedYield.status,secondIntervalYieldPct:interval.embeddedYieldPct,measuredSurfaces:obs2.coverage.measuredSurfaceCount,unavailableFallbackMeasuredSurfaces:obs3.coverage.measuredSurfaceCount,executionAuthority:obs2.authority.executionAuthority});

// Keep this as the single bounded Frax onchain test lane. Each protocol atom
// imports its deterministic test here and may add fail-closed live proof only
// when GitHub Actions executes this entrypoint.
await import('./frax-fraxlend-onchain-canary.mjs');
await import('./frax-fraxlend-rate-model-canary.mjs');
await import('./frax-bamm-onchain-canary.mjs');
await import('./frax-fraxswap-flow-fees-canary.mjs');
await import('./frax-fraxswap-twamm-canary.mjs');
await import('./frax-fraxswap-protocol-fee-routing-canary.mjs');
await import('./frax-fraxswap-feeto-lifecycle-canary.mjs');
await import('./frax-fraxswap-feeto-history-backfill-canary.mjs');
await import('./frax-fxb-onchain-canary.mjs');
await import('./frax-fraxnet-current-state-canary.mjs');
await import('./frax-flox-fxtl-current-state-canary.mjs');
await import('./frax-fx-liquidity-current-state-canary.mjs');
await import('./frax-revenue-routing-current-state-canary.mjs');
await import('./frax-frxeth-current-state-canary.mjs');
await import('./frax-frxeth-v2-ether-router-current-state-canary.mjs');
await import('./frax-frxeth-v2-lending-pool-current-state-canary.mjs');
await import('./frax-frxeth-v2-redemption-queue-current-state-canary.mjs');
await import('./frax-frxeth-v2-validator-pool-credit-current-state-canary.mjs');
await import('./frax-fpi-fpis-current-state-canary.mjs');
await import('./protocol-evidence-history-retention-canary.mjs');
