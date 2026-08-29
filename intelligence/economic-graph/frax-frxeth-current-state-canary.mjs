#!/usr/bin/env node
import assert from 'node:assert/strict';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxFrxEthCurrentState, applyFraxFrxEthCurrentState, FRAX_FRXETH_SURFACE_KEY } from './frax-frxeth-current-state.mjs';
import registry from './frax-frxeth-registry.json' with { type: 'json' };

const E18=10n**18n;
function uint256(value){return `0x${BigInt(value).toString(16).padStart(64,'0')}`;}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
function makeFetch({assets=110n*E18,blockTag='0x64',allFail=false}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    if(payload.length===1&&payload[0].method==='eth_blockNumber')return {ok:true,async json(){return [{jsonrpc:'2.0',id:1,result:blockTag}];}};
    const rows=payload.map(req=>{
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:blockTag,timestamp:blockTag==='0x64'?'0x65920080':'0x659202d8',hash:`0x${(blockTag==='0x64'?'ab':'cd').repeat(32)}`}};
      if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
      if(req.method!=='eth_call')throw new Error(`Unexpected method ${req.method}`);
      assert.equal(req.params[1],blockTag,'all frxETH reads must share one exact block');
      const to=String(req.params[0].to).toLowerCase(),data=req.params[0].data;
      if(to===registry.assets.frxETH.address.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(1000n*E18)};
      if(to===registry.assets.frxETH.address.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uint256(18n)};
      if(to===registry.assets.sfrxETH.address.toLowerCase()&&data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint256(100n*E18)};
      if(to===registry.assets.sfrxETH.address.toLowerCase()&&data==='0x01e1d114')return {jsonrpc:'2.0',id:req.id,result:uint256(assets)};
      if(to===registry.assets.sfrxETH.address.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uint256(18n)};
      throw new Error(`Unexpected eth_call ${to} ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}
function baseState(generatedAt='2026-08-29T09:00:00.000Z'){return {generatedAt,authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}

const first=await collectFraxFrxEthCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch()});
assert.equal(first.status,'ok');assert.equal(first.measurementClass,'MEASURED');assert.equal(first.rpc.endpointId,'second-ok');assert.equal(first.rpc.failoverAttempts.length,1);assert.equal(first.blockNumber,100);assert.equal(first.asset.totalSupply,1000);assert.equal(first.vault.totalSupply,100);assert.equal(first.vault.totalAssets,110);assert.equal(first.vault.sharePriceAsset,1.1);assert.equal(Object.keys(first.operationalCode).length,9);assert.equal(Object.values(first.operationalCode).every(item=>item.deployed),true);assert.equal(first.epistemic.validatorEconomics,'UNKNOWN-not-measured-by-this-atom');assert.equal(first.epistemic.executionAuthority,'none');

const state1=baseState();applyFraxEcosystemSensor({state:state1,previousState:null});applyFraxFrxEthCurrentState({state:state1,previousState:null,measurement:first,registry});
const obs1=state1.protocolEvidence['registry-frax-ecosystem'].latest.observation,surface1=obs1.surfaces[FRAX_FRXETH_SURFACE_KEY];
assert.equal(obs1.coverage.surfaceCount,10);assert.equal(obs1.coverage.measuredSurfaceCount,2);assert.equal(obs1.coverage.sourceBoundUnknownSurfaceCount,8);assert.equal(surface1.measurementState,'MEASURED-current-onchain-partial');assert.equal(surface1.measured.intervalEmbeddedYield.status,'warming-first-onchain-checkpoint');assert.equal(obs1.scopeExtensions.frxEth.surfaceId,'frxeth-sfrxeth');assert.equal(obs1.epistemic.frxEthLendingIncome,'UNKNOWN-not-measured-by-this-atom');assert.equal(obs1.authority.executionAuthority,'none');

const second={...first,observedAt:'2024-01-01T00:10:00.000Z',blockNumber:101,blockTag:'0x65',blockHash:`0x${'cd'.repeat(32)}`,vault:{...first.vault,totalAssetsRaw:(111n*E18).toString(),totalAssets:111,sharePriceAsset:1.11}};
const previous=structuredClone(state1),state2=baseState('2026-08-29T09:10:00.000Z');applyFraxEcosystemSensor({state:state2,previousState:previous});applyFraxFrxEthCurrentState({state:state2,previousState:previous,measurement:second,registry});
const interval=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.surfaces[FRAX_FRXETH_SURFACE_KEY].measured.intervalEmbeddedYield;
assert.equal(interval.status,'ok');assert.equal(interval.accepted,true);assert.ok(Math.abs(interval.embeddedYieldPct-0.909090909091)<1e-9);assert.equal(interval.annualizedApyPct,null);

const unavailable=await collectFraxFrxEthCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true})});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');assert.equal(unavailable.vault.sharePriceAsset,null);
const state3=baseState();applyFraxEcosystemSensor({state:state3,previousState:null});applyFraxFrxEthCurrentState({state:state3,previousState:null,measurement:unavailable,registry});const obs3=state3.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs3.coverage.surfaceCount,10);assert.equal(obs3.coverage.measuredSurfaceCount,1);assert.equal(obs3.coverage.sourceBoundUnknownSurfaceCount,9);assert.match(obs3.surfaces[FRAX_FRXETH_SURFACE_KEY].measurementState,/^UNKNOWN/);assert.equal(obs3.epistemic.frxEthCurrentState,'UNKNOWN');

console.log('FRAX frxETH CURRENT STATE CANARY PASS',{exactBlock:first.blockNumber,sharePriceFrxEth:first.vault.sharePriceAsset,scopeSurfaces:obs1.coverage.surfaceCount,measuredSurfaces:obs1.coverage.measuredSurfaceCount,firstInterval:surface1.measured.intervalEmbeddedYield.status,secondIntervalYieldPct:interval.embeddedYieldPct,unknownFallbackMeasuredSurfaces:obs3.coverage.measuredSurfaceCount,executionAuthority:obs1.authority.executionAuthority});
