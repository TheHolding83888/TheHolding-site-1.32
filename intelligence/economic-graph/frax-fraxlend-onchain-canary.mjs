#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  collectFraxFraxlendOnchain,
  applyFraxFraxlendOnchainMeasurement,
  FRAXLEND_PAIR_REGISTRY_ETHEREUM,
  FRAXLEND_DEPLOYER_V4_ETHEREUM,
  FRAXLEND_PAIR_SFRXETH_USDC,
  USDC_ETHEREUM,
  SFRXETH_ETHEREUM
} from './frax-fraxlend-onchain.mjs';

function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function uints(values){return `0x${values.map(word).join('')}`;}
function addressWord(address){return `0x${String(address).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function addressArray(addresses){
  return `0x${word(32n)}${word(BigInt(addresses.length))}${addresses.map(a=>String(a).replace(/^0x/,'').toLowerCase().padStart(64,'0')).join('')}`;
}
function minimalRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[
  {id:'first-fails',url:'https://first.invalid'},
  {id:'second-ok',url:'https://second.invalid'}
]}}};}

const E6=10n**6n,E18=10n**18n;
const totalAsset=1000n*E6;
const totalShares=900n*E6;
const totalBorrow=600n*E6;
const totalBorrowShares=500n*E6;
const totalCollateral=10n*E18;
const pricePerShareRaw=(E18*totalAsset)/totalShares;

function makeFetch({allFail=false,registryHasPair=true}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    if(payload.length===1&&payload[0].method==='eth_blockNumber')return {ok:true,async json(){return [{jsonrpc:'2.0',id:1,result:'0x64'}];}};
    const rows=payload.map(req=>{
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method!=='eth_call')throw new Error(`Unexpected method ${req.method}`);
      assert.equal(req.params[1],'0x64','all Fraxlend reads must be exact-block bound');
      const to=String(req.params[0].to).toLowerCase();
      const data=req.params[0].data;
      if(to===FRAXLEND_PAIR_REGISTRY_ETHEREUM.toLowerCase()&&data==='0x607b6d16')return {jsonrpc:'2.0',id:req.id,result:addressArray(registryHasPair?[FRAXLEND_PAIR_SFRXETH_USDC]:[USDC_ETHEREUM])};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0xd2a156e0')return {jsonrpc:'2.0',id:req.id,result:addressWord(FRAXLEND_DEPLOYER_V4_ETHEREUM)};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0x38d52e0f')return {jsonrpc:'2.0',id:req.id,result:addressWord(USDC_ETHEREUM)};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0xc6e1c7c9')return {jsonrpc:'2.0',id:req.id,result:addressWord(SFRXETH_ETHEREUM)};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0xcdd72d52')return {jsonrpc:'2.0',id:req.id,result:uints([totalAsset,totalShares,totalBorrow,totalBorrowShares,totalCollateral])};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0x95d14ca8')return {jsonrpc:'2.0',id:req.id,result:uints([99n,10000n,1704067200n,1000000000n,2000000000n])};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0x99530b06')return {jsonrpc:'2.0',id:req.id,result:uints([pricePerShareRaw])};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0x9a295e73')return {jsonrpc:'2.0',id:req.id,result:uints([100000n,100000n,100000n,100000n,E18,100000n,E18,50000n])};
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uints([6n])};
      if(to===USDC_ETHEREUM.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uints([6n])};
      if(to===SFRXETH_ETHEREUM.toLowerCase()&&data==='0x313ce567')return {jsonrpc:'2.0',id:req.id,result:uints([18n])};
      throw new Error(`Unexpected call ${to} ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}

const first=await collectFraxFraxlendOnchain({registry:minimalRegistry(),fetchImpl:makeFetch()});
assert.equal(first.status,'ok');
assert.equal(first.measurementClass,'MEASURED');
assert.equal(first.rpc.endpointId,'second-ok');
assert.equal(first.rpc.failoverAttempts.length,1);
assert.equal(first.blockNumber,100);
assert.equal(first.registry.pairMembershipProven,true);
assert.equal(first.registry.pairCount,1);
assert.equal(first.values.totalAsset,1000);
assert.equal(first.values.totalBorrow,600);
assert.equal(first.values.totalCollateral,10);
assert.equal(first.values.utilizationPct,60);
assert.equal(first.values.protocolFeePct,10);
assert.ok(Math.abs(first.values.fTokenSharePriceAsset-(10/9))<1e-9);
assert.equal(first.epistemic.borrowRateModelReproduction,'NOT-YET-REPRODUCED');
assert.equal(first.epistemic.annualizationPerformed,false);
assert.equal(first.epistemic.executionAuthority,'none');

const noMembership=await collectFraxFraxlendOnchain({registry:minimalRegistry(),fetchImpl:makeFetch({registryHasPair:false})});
assert.match(noMembership.status,/^UNKNOWN/);
assert.equal(noMembership.measurementClass,'UNKNOWN');
assert.match(noMembership.rpc.failoverAttempts.at(-1)?.error||'',/missing from official Pair Registry/);

function surface(id,state='UNKNOWN-source-bound-not-yet-measured',relations=[]){return {id,measurementState:state,mechanicalRelations:relations};}
function baseState(){
  const surfaces={
    governanceVeFrax:surface('governance-vefrax','MEASURED-current-governance-partial'),
    fraxtalFloxFxtl:surface('fraxtal-flox-fxtl'),
    frxUsdSfrxUsd:surface('frxusd-sfrxusd','MEASURED-current-onchain-partial'),
    fraxNet:surface('fraxnet'),
    fraxlend:surface('fraxlend','UNKNOWN-source-bound-not-yet-measured',[
      {from:'total borrows / lendable capital',to:'utilization',class:'MECHANICAL-ready-for-onchain-reproduction'},
      {from:'utilization + rate model',to:'borrow rate',class:'MECHANICAL-ready-for-onchain-reproduction'},
      {from:'interest accrual',to:'fToken share price',class:'MECHANICAL-ready-for-onchain-reproduction'},
      {from:'Fraxlend activity',to:'veFRAX distribution',class:'UNKNOWN'}
    ]),
    fraxswapBamm:surface('fraxswap-bamm'),
    fxb:surface('fxb'),
    fxLiquidity:surface('fx-liquidity'),
    revenueRouting:surface('revenue-routing')
  };
  const current={
    version:'0.1-frax-deep-ecosystem-sensor-family',id:'base',status:'deep-sensor-family-active-partial-measurement',
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    epistemic:{executionAuthority:'none',measuredEconomicSurfaces:['governance-vefrax','frxusd-sfrxusd']},
    surfaces,
    coverage:{surfaceCount:9,surfaceIds:Object.values(surfaces).map(x=>x.id),measuredSurfaceCount:2,sourceBoundUnknownSurfaceCount:7,relationshipCount:4,relationshipClassCounts:{}},
    relationshipGraph:[],measurementExtensions:{sfrxUsdOnchain:'0.1-sfrxusd-exact-block-erc4626'},
    nextMeasurementUnlocks:['Enumerate Fraxlend Pair Registry and reproduce utilization/rate/share-price identities.']
  };
  return {
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    protocolEvidence:{'registry-frax-ecosystem':{latest:{observation:current},observations:[current],observationCount:1,measurementExtensions:{sfrxUsdOnchain:'0.1-sfrxusd-exact-block-erc4626'}}},
    protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{measurementExtensions:{sfrxUsdOnchain:'0.1-sfrxusd-exact-block-erc4626'}},latest:{observation:{ecosystemFamily:{},epistemic:{executionAuthority:'none'}}}}}
  };
}

const state1=baseState();
applyFraxFraxlendOnchainMeasurement({state:state1,previousState:null,measurement:first});
const obs1=state1.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs1.coverage.measuredSurfaceCount,3);
assert.equal(obs1.coverage.sourceBoundUnknownSurfaceCount,6);
assert.equal(obs1.surfaces.fraxlend.measurementState,'MEASURED-current-onchain-pair-pilot');
assert.equal(obs1.surfaces.fraxlend.measured.intervalEmbeddedYield.status,'warming-first-onchain-checkpoint');
assert.equal(obs1.surfaces.fraxlend.measured.intervalEmbeddedYield.accepted,false);
assert.equal(obs1.epistemic.fraxlendRateModelCausality,'UNKNOWN-not-reproduced');
assert.equal(obs1.measurementExtensions.fraxlendOnchain,'0.1-fraxlend-pair-exact-block');
assert.equal(state1.protocolEvidence['registry-frax-ecosystem'].observations.length,1,'intermediate same-build observations must not be fabricated');

const second={...first,observedAt:'2024-01-01T00:10:00.000Z',blockNumber:101,blockTag:'0x65',blockHash:`0x${'cd'.repeat(32)}`,
  values:{...first.values,fTokenSharePriceAsset:1.12,accountingSharePriceAsset:1.12},
  raw:{...first.raw,pricePerShare:'1120000000000000000'}};
const previous=structuredClone(state1);
const state2=baseState();
applyFraxFraxlendOnchainMeasurement({state:state2,previousState:previous,measurement:second});
const interval=state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.surfaces.fraxlend.measured.intervalEmbeddedYield;
assert.equal(interval.status,'ok');
assert.equal(interval.accepted,true);
assert.equal(interval.annualizedApyPct,null);
assert.match(interval.annualizationState,/NOT-CALCULATED/);
assert.ok(interval.embeddedYieldPct>0);

const unavailable=await collectFraxFraxlendOnchain({registry:minimalRegistry(),fetchImpl:makeFetch({allFail:true})});
assert.match(unavailable.status,/^UNKNOWN/);
assert.equal(unavailable.measurementClass,'UNKNOWN');
assert.equal(unavailable.values.utilizationPct,null);
const state3=baseState();
applyFraxFraxlendOnchainMeasurement({state:state3,previousState:null,measurement:unavailable});
const obs3=state3.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs3.coverage.measuredSurfaceCount,2);
assert.equal(obs3.coverage.sourceBoundUnknownSurfaceCount,7);
assert.equal(obs3.surfaces.fraxlend.measured.values.utilizationPct,null);
assert.equal(obs3.epistemic.fraxlendCurrentState,'UNKNOWN');

console.log('FRAX FRAXLEND ONCHAIN SENSOR CANARY PASS',{
  pair:first.contracts.pair,
  exactBlock:first.blockNumber,
  registryMembership:first.registry.pairMembershipProven,
  utilizationPct:first.values.utilizationPct,
  borrowRatePerSecond:first.values.borrowRatePerSecond,
  fTokenSharePriceAsset:first.values.fTokenSharePriceAsset,
  firstInterval:obs1.surfaces.fraxlend.measured.intervalEmbeddedYield.status,
  secondIntervalYieldPct:interval.embeddedYieldPct,
  measuredSurfaces:obs1.coverage.measuredSurfaceCount,
  unavailableFallbackMeasuredSurfaces:obs3.coverage.measuredSurfaceCount,
  executionAuthority:obs1.authority.executionAuthority
});

if(process.env.GITHUB_ACTIONS==='true'){
  const live=await collectFraxFraxlendOnchain();
  if(live.status!=='ok'||live.measurementClass!=='MEASURED'){
    throw new Error(`FRAX FRAXLEND LIVE PROBE FAILED: ${live.status}; attempts=${JSON.stringify(live.rpc?.failoverAttempts||[])}`);
  }
  assert.equal(live.registry?.pairMembershipProven,true,'live pair must be present in official Fraxlend Pair Registry');
  assert.equal(String(live.contracts?.deployer||'').toLowerCase(),FRAXLEND_DEPLOYER_V4_ETHEREUM.toLowerCase(),'live pair deployer drift');
  assert.equal(String(live.contracts?.asset||'').toLowerCase(),USDC_ETHEREUM.toLowerCase(),'live pair asset drift');
  assert.equal(String(live.contracts?.collateral||'').toLowerCase(),SFRXETH_ETHEREUM.toLowerCase(),'live pair collateral drift');
  assert.ok(Number.isFinite(Number(live.values?.utilizationPct)),'live utilization missing');
  assert.ok(Number.isFinite(Number(live.values?.borrowRatePerSecond)),'live borrow-rate state missing');
  assert.ok(Number(live.values?.fTokenSharePriceAsset)>0,'live fToken share price missing');
  assert.equal(live.epistemic?.annualizationPerformed,false,'live probe must not invent annualization');
  assert.equal(live.epistemic?.executionAuthority,'none','live probe authority drift');
  console.log('FRAX FRAXLEND LIVE EXACT-BLOCK PROBE PASS',{
    observedAt:live.observedAt,
    blockNumber:live.blockNumber,
    blockHash:live.blockHash,
    pair:live.contracts.pair,
    registryPairCount:live.registry.pairCount,
    utilizationPct:live.values.utilizationPct,
    borrowRatePerSecond:live.values.borrowRatePerSecond,
    fTokenSharePriceAsset:live.values.fTokenSharePriceAsset,
    rpcEndpointId:live.rpc.endpointId,
    executionAuthority:live.epistemic.executionAuthority
  });
}
