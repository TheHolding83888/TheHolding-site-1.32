#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectFraxFrxEthV2EtherRouterCurrentState, applyFraxFrxEthV2EtherRouterCurrentState } from './frax-frxeth-v2-ether-router-current-state.mjs';
import registry from './frax-frxeth-registry.json' with { type: 'json' };

const E18=10n**18n;
function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function quantity(value){return `0x${BigInt(value).toString(16)}`;}
function addressWord(address){return String(address).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
function tuple(){return `0x${word(0)}${word(0)}${word(120n*E18)}${word(80n*E18)}${word(200n*E18)}${word(50n*E18)}${word(30n*E18)}`;}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
function makeFetch({allFail=false}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    const rows=payload.map(req=>{
      if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:'0x64'};
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
      if(req.method==='eth_getBalance')return {jsonrpc:'2.0',id:req.id,result:quantity(20n*E18)};
      if(req.method!=='eth_call')throw new Error(`unexpected ${req.method}`);
      assert.equal(req.params[1],'0x64');
      const data=req.params[0].data;
      if(data.startsWith('0x8ee5556e')){assert.equal(data,`0x8ee5556e${word(1)}`);return {jsonrpc:'2.0',id:req.id,result:tuple()};}
      if(data==='0xa59a9973')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.lendingPool)}`};
      if(data==='0x97ec19be')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.redemptionQueueV2)}`};
      if(data==='0xf5da169c')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.curveLsdAmo)}`};
      if(data==='0x565d3e6e')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.assets.frxETH.address)}`};
      throw new Error(`unexpected call ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}
function baseState(){
  const observation={
    id:'frax-ecosystem:base',status:'deep-sensor-family-fully-measured',
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    epistemic:{executionAuthority:'none',measuredEconomicSurfaces:['frxeth-sfrxeth']},
    coverage:{surfaceCount:1,measuredSurfaceCount:1,sourceBoundUnknownSurfaceCount:0,relationshipCount:0,relationshipClassCounts:{}},
    surfaces:{frxEthSfrxEth:{id:'frxeth-sfrxeth',measurementState:'MEASURED-current-onchain-partial',measured:{epistemic:{executionAuthority:'none',lendingIncome:'UNKNOWN-not-measured-by-this-atom',validatorEconomics:'UNKNOWN-not-measured-by-this-atom'}},mechanicalRelations:[]}},
    relationshipGraph:[],scopeExtensions:{frxEth:{version:'0.1'}},measurementExtensions:{frxEthCurrentState:'0.1'},nextMeasurementUnlocks:['Measure frxETH V2 EtherRouter consolidated balance, LendingPool borrowing/utilization/rate/interest, redemption-queue state and validator-pool credit as separate bounded sub-atoms.']
  };
  return {authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation},observations:[observation],observationCount:1,status:observation.status}},protocolSensors:{'registry-frax-vefrax':{latest:{observation:{}},ecosystemFamily:{measurementExtensions:{frxEthCurrentState:'0.1'}}}}};
}

const measured=await collectFraxFrxEthV2EtherRouterCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),checkpoint:{blockTag:'0x64'}});
assert.equal(measured.status,'ok');
assert.equal(measured.measurementClass,'MEASURED');
assert.equal(measured.rpc.endpointId,'second-ok');
assert.equal(measured.rpc.reusedCheckpoint,true);
assert.equal(measured.consolidated.ethTotalBalanced,200);
assert.equal(measured.consolidated.ethAccountingParity,true);
assert.equal(measured.consolidated.frxEthTotalBalanced,80);
assert.equal(measured.router.nativeEthBalance,20);
assert.equal(measured.router.registryPointerParity,true);
assert.equal(measured.epistemic.lendingIncome,'UNKNOWN-not-measured-by-this-atom');
assert.equal(measured.epistemic.executionAuthority,'none');

const state=baseState();
applyFraxFrxEthV2EtherRouterCurrentState({state,measurement:measured});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation,surface=obs.surfaces.frxEthSfrxEth;
assert.equal(obs.coverage.surfaceCount,1);
assert.equal(obs.coverage.measuredSurfaceCount,1);
assert.equal(surface.measured.v2Internals.etherRouter.consolidated.ethTotalBalanced,200);
assert.equal(obs.epistemic.frxEthV2EtherRouterConsolidatedBalance,'MEASURED-current-Ethereum-force-live-view');
assert.equal(obs.epistemic.frxEthLendingIncome,'UNKNOWN-not-measured-by-this-atom');
assert.equal(obs.relationshipGraph.length,2);
assert.equal(obs.authority.executionAuthority,'none');

const unavailable=await collectFraxFrxEthV2EtherRouterCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true}),checkpoint:{blockTag:'0x64'}});
assert.match(unavailable.status,/^UNKNOWN/);
assert.equal(unavailable.measurementClass,'UNKNOWN');
const state2=baseState();applyFraxFrxEthV2EtherRouterCurrentState({state:state2,measurement:unavailable});
assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.epistemic.frxEthV2EtherRouterConsolidatedBalance,'UNKNOWN');
console.log('FRAX frxETH V2 ETHER ROUTER CANARY PASS',{blockNumber:measured.blockNumber,ethTotalBalanced:measured.consolidated.ethTotalBalanced,frxEthTotalBalanced:measured.consolidated.frxEthTotalBalanced,registryPointerParity:measured.router.registryPointerParity,executionAuthority:obs.authority.executionAuthority});
