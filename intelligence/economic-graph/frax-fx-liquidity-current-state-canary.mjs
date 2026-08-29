#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { applyFraxEcosystemSensor } from './frax-ecosystem-sensor.mjs';
import { collectFraxFxLiquidityCurrentState, applyFraxFxLiquidityCurrentState, FRAX_FX_LIQUIDITY_VERSION, FRXUSD_FRAXTAL } from './frax-fx-liquidity-current-state.mjs';
import { FRAXSWAP_FACTORY_FRAXTAL } from './frax-bamm-onchain.mjs';

const P1='0x1111111111111111111111111111111111111111',P2='0x2222222222222222222222222222222222222222',P3='0x3333333333333333333333333333333333333333';
const A='0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',B='0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',C='0xcccccccccccccccccccccccccccccccccccccccc',D='0xdddddddddddddddddddddddddddddddddddddddd';
function word(v){return BigInt(v).toString(16).padStart(64,'0');}
function addr(v){return String(v).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
function uint(v){return `0x${word(v)}`;}
function addressResult(v){return `0x${addr(v)}`;}
function reserves(a,b){return `0x${word(a)}${word(b)}${word(123)}`;}
function cfg(){return {
  version:'0.1-frax-fx-liquidity-registry',purpose:'synthetic',adapter:'constant-product-v2-factory',network:{name:'fraxtal',chainId:252},factory:{label:'Fraxswap Factory',address:FRAXSWAP_FACTORY_FRAXTAL},baseAsset:{label:'frxUSD',address:FRXUSD_FRAXTAL,decimals:18},source:{repository:'FraxFinance/frax-solidity',ref:'30532c8cefcbf5c7efafcff4369261bd435a4859',contracts:['FraxswapFactory.sol','FraxswapPair.sol']},scope:{surface:'fxLiquidity',selection:'synthetic',partial:true,doesNotAssertAllCounterAssetsAreTokenizedCurrencies:true},semantics:{configIsSourceBoundTopology:true,configIsLiveMeasurement:false,fullFactoryRegistryRequired:true,sameBaseAssetReserveMayBeAggregated:true,counterpartUnitsAggregated:false,usdValuationPerformed:false,volumeMeasured:false,feesMeasured:false,incentivesMeasured:false,priceDeviationMeasured:false,capitalMigrationMeasured:false,pairPresenceIsNotCapitalFlow:true,reserveChangeIsNotCapitalMigrationWithoutTransactionIdentity:true,unknownIsZero:false,causalClaimAuthority:'none',recommendationAuthority:'none',executionAuthority:'none'}
};}
function response(rows){return {ok:true,status:200,async json(){return rows;}};}
function makeFetch({fail=false}={}){return async (url,options={})=>{
  if(fail)throw new Error('synthetic rpc outage');assert.equal(url,'https://fraxtal.test');const payload=JSON.parse(options.body);
  const rows=payload.map(req=>{
    if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:'0x64'};
    if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x6b49d200',hash:`0x${'ab'.repeat(32)}`}};
    if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
    if(req.method!=='eth_call')throw new Error(`unexpected method ${req.method}`);
    assert.equal(req.params[1],'0x64');const to=String(req.params[0].to).toLowerCase(),data=String(req.params[0].data).toLowerCase();
    if(to===FRAXSWAP_FACTORY_FRAXTAL.toLowerCase()&&data==='0x574f2ba3')return {jsonrpc:'2.0',id:req.id,result:uint(3)};
    if(to===FRAXSWAP_FACTORY_FRAXTAL.toLowerCase()&&data.startsWith('0x1e3dd18b')){const i=Number(BigInt(`0x${data.slice(10)}`));return {jsonrpc:'2.0',id:req.id,result:addressResult([P1,P2,P3][i])};}
    const meta={
      [P1.toLowerCase()]:{t0:FRXUSD_FRAXTAL,t1:A,r0:100n,r1:200n,s:1000n},
      [P2.toLowerCase()]:{t0:B,t1:FRXUSD_FRAXTAL,r0:300n,r1:400n,s:2000n},
      [P3.toLowerCase()]:{t0:C,t1:D,r0:500n,r1:600n,s:3000n}
    }[to];
    if(!meta)throw new Error(`unexpected target ${to}`);
    if(data==='0xc45a0155')return {jsonrpc:'2.0',id:req.id,result:addressResult(FRAXSWAP_FACTORY_FRAXTAL)};
    if(data==='0x0dfe1681')return {jsonrpc:'2.0',id:req.id,result:addressResult(meta.t0)};
    if(data==='0xd21220a7')return {jsonrpc:'2.0',id:req.id,result:addressResult(meta.t1)};
    if(data==='0x0902f1ac')return {jsonrpc:'2.0',id:req.id,result:reserves(meta.r0,meta.r1)};
    if(data==='0x18160ddd')return {jsonrpc:'2.0',id:req.id,result:uint(meta.s)};
    throw new Error(`unexpected call ${to} ${data}`);
  });return response(rows);
};}
function baseState(){return {generatedAt:'2026-08-29T08:00:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolLifecycle:{summary:{protocolCount:8},protocols:{'registry-frax-vefrax':{maturityStage:'shadow'}}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{epistemic:{executionAuthority:'none'},identityBoundary:{currentCanonicalPrincipal:'FRAX',currentCanonicalVoteEscrowLabel:'veFRAX'},referenceProductivity:{currentAprPct:5.25},registryExposure:{companyCount:3,positionCount:3},longitudinalEvidence:{canonicalSnapshotCount:4,validatedNativePeriodCount:0}}}}}};}

const registry=JSON.parse(fs.readFileSync(new URL('./frax-fx-liquidity-registry.json',import.meta.url),'utf8'));
assert.equal(registry.adapter,'constant-product-v2-factory');assert.equal(registry.scope.partial,true);assert.equal(registry.semantics.counterpartUnitsAggregated,false);assert.equal(registry.semantics.executionAuthority,'none');
const measurement=await collectFraxFxLiquidityCurrentState({config:cfg(),endpointsOverride:[{id:'synthetic',url:'https://fraxtal.test'}],fetchImpl:makeFetch()});
assert.equal(measurement.version,FRAX_FX_LIQUIDITY_VERSION);assert.equal(measurement.status,'ok');assert.equal(measurement.measurementClass,'MEASURED');assert.equal(measurement.network.blockNumber,100);assert.equal(measurement.summary.factoryPairCount,3);assert.equal(measurement.summary.matchingPairCount,2);assert.equal(measurement.summary.totalBaseReserveRaw,'500');assert.equal(measurement.pairs.length,2);assert.equal(measurement.pairs[0].raw.baseReserve,'100');assert.equal(measurement.pairs[1].raw.baseReserve,'400');assert.equal(measurement.epistemic.usdValuationPerformed,false);assert.equal(measurement.epistemic.capitalMigration,'UNKNOWN-not-measured-by-this-atom');assert.equal(measurement.epistemic.executionAuthority,'none');
const state=baseState();applyFraxEcosystemSensor({state,previousState:null});applyFraxFxLiquidityCurrentState({state,previousState:null,measurement});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.surfaces.fxLiquidity.measurementState,'MEASURED-current-fraxtal-frxusd-fraxswap-registry-partial');assert.equal(obs.coverage.measuredSurfaceCount,2);assert.equal(obs.coverage.sourceBoundUnknownSurfaceCount,7);assert.equal(obs.measurementExtensions.fxLiquidityCurrent,FRAX_FX_LIQUIDITY_VERSION);assert.equal(obs.epistemic.fxLiquidityCapitalMigration,'UNKNOWN-no-flow-proof');assert.equal(obs.authority.executionAuthority,'none');
const unavailable=await collectFraxFxLiquidityCurrentState({config:cfg(),endpointsOverride:[{id:'bad',url:'https://fraxtal.test'}],fetchImpl:makeFetch({fail:true})});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');const state2=baseState();applyFraxEcosystemSensor({state:state2,previousState:null});applyFraxFxLiquidityCurrentState({state:state2,previousState:null,measurement:unavailable});assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.surfaces.fxLiquidity.measurementState,'UNKNOWN-current-value-not-ingested');
console.log('FRAX FX LIQUIDITY REUSABLE COLLECTOR CANARY PASS',{factoryPairs:measurement.summary.factoryPairCount,frxUsdPairs:measurement.summary.matchingPairCount,totalBaseReserveRaw:measurement.summary.totalBaseReserveRaw,measuredSurfaces:obs.coverage.measuredSurfaceCount,usdTvl:measurement.epistemic.usdTvl,capitalMigration:measurement.epistemic.capitalMigration,executionAuthority:measurement.epistemic.executionAuthority});

if(process.env.GITHUB_ACTIONS==='true'){
  const live=await collectFraxFxLiquidityCurrentState();
  if(live.status!=='ok'||live.measurementClass!=='MEASURED'||Number(live.summary?.matchingPairCount)<1||!/^\d+$/.test(String(live.summary?.totalBaseReserveRaw||'')))throw new Error(`FRAX FX LIQUIDITY LIVE PROOF FAILED ${JSON.stringify({status:live.status,rpc:live.rpc})}`);
  if(live.epistemic?.usdValuationPerformed!==false||live.epistemic?.counterpartUnitsAggregated!==false||live.epistemic?.pairPresenceIsCapitalFlow!==false||live.epistemic?.executionAuthority!=='none')throw new Error('FRAX FX LIQUIDITY live epistemic/authority drift');
  console.log('FRAX FX LIQUIDITY LIVE EXACT-BLOCK PROOF PASS',{observedAt:live.observedAt,blockNumber:live.network.blockNumber,blockHash:live.network.blockHash,factoryPairCount:live.summary.factoryPairCount,frxUsdPairCount:live.summary.matchingPairCount,totalFrxUsdReserveRaw:live.summary.totalBaseReserveRaw,rpcEndpointId:live.rpc.endpointId,usdTvl:live.epistemic.usdTvl,capitalMigration:live.epistemic.capitalMigration,executionAuthority:live.epistemic.executionAuthority});
}
