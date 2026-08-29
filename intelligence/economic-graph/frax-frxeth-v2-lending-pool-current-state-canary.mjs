#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectFraxFrxEthV2LendingPoolCurrentState, applyFraxFrxEthV2LendingPoolCurrentState } from './frax-frxeth-v2-lending-pool-current-state.mjs';
import registry from './frax-frxeth-registry.json' with { type:'json' };

const E18=10n**18n;
function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function words(...values){return `0x${values.map(word).join('')}`;}
function addressWord(address){return String(address).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}

function makeFetch({allFail=false,previewFail=false}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    const rows=payload.map(req=>{
      if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:'0x64'};
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
      if(req.method!=='eth_call')throw new Error(`unexpected ${req.method}`);
      assert.equal(req.params[1],'0x64');
      const data=req.params[0].data;
      if(data==='0x8285ef40')return {jsonrpc:'2.0',id:req.id,result:words(500n*E18,450n*E18)};
      if(data==='0x20dcc342')return {jsonrpc:'2.0',id:req.id,result:words(25n*E18)};
      if(data==='0x41810cf4')return {jsonrpc:'2.0',id:req.id,result:words(65_000n)};
      if(data==='0x6b3ecd4a')return {jsonrpc:'2.0',id:req.id,result:words(70_000n)};
      if(data==='0xaf833d42')return {jsonrpc:'2.0',id:req.id,result:words(300n*E18)};
      if(data==='0x95d14ca8')return {jsonrpc:'2.0',id:req.id,result:words(1_700_000_000n,1_000_000_000n,3_000_000_000n)};
      if(data==='0x0df8dfac')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.variableInterestRate)}`};
      if(data==='0xc9cb9497')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.etherRouter)}`};
      if(data==='0x97ec19be')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.redemptionQueueV2)}`};
      if(data==='0x565d3e6e')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.assets.frxETH.address)}`};
      if(data==='0x37525805')return {jsonrpc:'2.0',id:req.id,result:words(E18)};
      if(data==='0xc11b96f0')return {jsonrpc:'2.0',id:req.id,result:words(100_000n)};
      if(data==='0xcacf3b58'){
        if(previewFail)return {jsonrpc:'2.0',id:req.id,error:{message:'synthetic preview unavailable'}};
        return {jsonrpc:'2.0',id:req.id,result:words(2n*E18,E18/5n,15n*E18/100n,1_700_000_600n,1_100_000_000n,3_000_000_000n,502n*E18,451n*E18)};
      }
      throw new Error(`unexpected call ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}

function baseState(){
  const surface={id:'frxeth-sfrxeth',measurementState:'MEASURED-current-onchain-partial',measured:{v2Internals:{etherRouter:{status:'ok',blockTag:'0x64'}},epistemic:{executionAuthority:'none'}},mechanicalRelations:[]};
  const observation={
    id:'frax-ecosystem:base',protocolId:'registry-frax-vefrax',status:'deep-sensor-family-fully-measured',
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    epistemic:{executionAuthority:'none',measuredEconomicSurfaces:['frxeth-sfrxeth']},
    coverage:{surfaceCount:1,measuredSurfaceCount:1,sourceBoundUnknownSurfaceCount:0,relationshipCount:0,relationshipClassCounts:{}},
    surfaces:{frxEthSfrxEth:surface},relationshipGraph:[],scopeExtensions:{frxEth:{version:'0.1'}},measurementExtensions:{frxEthCurrentState:'0.1',frxEthV2EtherRouterCurrentState:'0.1'},nextMeasurementUnlocks:['Measure frxETH V2 LendingPool borrowing/utilization/rate/interest, redemption-queue state and validator-pool credit as separate bounded sub-atoms.']
  };
  return {generatedAt:'2026-08-29T14:20:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation},observations:[observation],observationCount:1,status:observation.status}},protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{measurementExtensions:{frxEthCurrentState:'0.1',frxEthV2EtherRouterCurrentState:'0.1'}},epistemic:{executionAuthority:'none'}}}};
}

const measured=await collectFraxFrxEthV2LendingPoolCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),checkpoint:{blockTag:'0x64'}});
assert.equal(measured.status,'ok');
assert.equal(measured.measurementClass,'MEASURED');
assert.equal(measured.rpc.endpointId,'second-ok');
assert.equal(measured.rpc.reusedCheckpoint,true);
assert.equal(measured.lendingPool.totalBorrow.amountEth,500);
assert.equal(measured.lendingPool.interestAccrued.eth,25);
assert.equal(measured.lendingPool.utilization.storedPct,65);
assert.equal(measured.lendingPool.utilization.livePct,70);
assert.equal(measured.lendingPool.maxBorrow.eth,300);
assert.equal(measured.lendingPool.currentRateInfo.annualizedNominalRatePct,3.1556736);
assert.equal(measured.lendingPool.currentRateInfo.fullUtilizationAnnualizedNominalRatePct,9.4670208);
assert.equal(measured.lendingPool.registryPointerParity,true);
assert.equal(measured.preview.status,'MEASURED-read-only-preview-not-realized');
assert.equal(measured.preview.interestEarned.eth,2);
assert.equal(measured.preview.feesAmount.eth,0.2);
assert.equal(measured.epistemic.protocolRevenue,'UNKNOWN-not-proven-as-realized-or-routed-by-this-atom');
assert.equal(measured.epistemic.executionAuthority,'none');

const state=baseState();
applyFraxFrxEthV2LendingPoolCurrentState({state,measurement:measured});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation,surface=obs.surfaces.frxEthSfrxEth;
assert.equal(obs.coverage.surfaceCount,1);
assert.equal(obs.coverage.measuredSurfaceCount,1);
assert.equal(surface.measured.v2Internals.lendingPool.lendingPool.utilization.livePct,70);
assert.equal(surface.measured.epistemic.lendingPoolProtocolRevenue,'UNKNOWN-not-proven-as-realized-or-routed-by-this-atom');
assert.equal(obs.epistemic.frxEthV2LendingPoolInterestAccrued,'MEASURED-onchain-counter');
assert.equal(obs.epistemic.frxEthV2LendingPoolProtocolRevenue,'UNKNOWN');
assert.equal(obs.authority.executionAuthority,'none');
assert.match(obs.nextMeasurementUnlocks[0],/RedemptionQueue/);

const previewUnavailable=await collectFraxFrxEthV2LendingPoolCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({previewFail:true}),checkpoint:{blockTag:'0x64'}});
assert.equal(previewUnavailable.measurementClass,'MEASURED');
assert.match(previewUnavailable.preview.status,/^UNKNOWN/);
assert.equal(previewUnavailable.epistemic.pendingInterestPreview,'UNKNOWN');

const unavailable=await collectFraxFrxEthV2LendingPoolCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true}),checkpoint:{blockTag:'0x64'}});
assert.match(unavailable.status,/^UNKNOWN/);
assert.equal(unavailable.measurementClass,'UNKNOWN');
const state2=baseState();
applyFraxFrxEthV2LendingPoolCurrentState({state:state2,measurement:unavailable});
assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.epistemic.frxEthV2LendingPoolBorrowState,'UNKNOWN');
assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.authority.executionAuthority,'none');

console.log('FRAX frxETH V2 LENDING POOL CANARY PASS',{
  blockNumber:measured.blockNumber,
  totalBorrowEth:measured.lendingPool.totalBorrow.amountEth,
  utilizationPct:measured.lendingPool.utilization.livePct,
  annualizedNominalRatePct:measured.lendingPool.currentRateInfo.annualizedNominalRatePct,
  storedInterestAccruedEth:measured.lendingPool.interestAccrued.eth,
  pendingInterestPreviewEth:measured.preview.interestEarned.eth,
  registryPointerParity:measured.lendingPool.registryPointerParity,
  executionAuthority:obs.authority.executionAuthority
});
