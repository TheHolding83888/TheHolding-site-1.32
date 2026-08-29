#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectFraxFrxEthV2RedemptionQueueCurrentState, applyFraxFrxEthV2RedemptionQueueCurrentState } from './frax-frxeth-v2-redemption-queue-current-state.mjs';
import registry from './frax-frxeth-registry.json' with { type:'json' };

const E18=10n**18n, U256=1n<<256n;
function word(value){let v=BigInt(value);if(v<0n)v=U256+v;return v.toString(16).padStart(64,'0');}
function words(...values){return `0x${values.map(word).join('')}`;}
function quantity(value){return `0x${BigInt(value).toString(16)}`;}
function addressWord(address){return String(address).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}

function makeFetch({allFail=false,legacyThreeWordState=false,arithmeticDrift=false}={}){
  return async (url,options)=>{
    if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
    const payload=JSON.parse(options.body);
    const rows=payload.map(req=>{
      if(req.method==='eth_blockNumber')return {jsonrpc:'2.0',id:req.id,result:'0x64'};
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
      if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
      if(req.method==='eth_getBalance')return {jsonrpc:'2.0',id:req.id,result:quantity(100n*E18)};
      if(req.method!=='eth_call')throw new Error(`unexpected ${req.method}`);
      assert.equal(req.params[1],'0x64');
      const data=req.params[0].data;
      if(data==='0x1494ef63')return {jsonrpc:'2.0',id:req.id,result:legacyThreeWordState?words(42n,86_400n,5_000n):words(42n,86_400n,5_000n,160n*E18,120n*E18)};
      if(data==='0x103cf9e3')return {jsonrpc:'2.0',id:req.id,result:words(150n*E18,5n*E18,10n*E18)};
      if(data==='0x9c79ceb0')return {jsonrpc:'2.0',id:req.id,result:words(arithmeticDrift?-39n*E18:-40n*E18,40n*E18)};
      if(data==='0x46904840')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord('0x1111111111111111111111111111111111111111')}`};
      if(data==='0xc9cb9497')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.operations.etherRouter)}`};
      if(data==='0x6ae3535e')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.assets.frxETH.address)}`};
      if(data==='0x7d7d7b0a')return {jsonrpc:'2.0',id:req.id,result:`0x${addressWord(registry.assets.sfrxETH.address)}`};
      if(data==='0xb8c2d71a')return {jsonrpc:'2.0',id:req.id,result:words(100n*86_400n)};
      if(data==='0xe63a391f')return {jsonrpc:'2.0',id:req.id,result:words(1_000_000n)};
      if(data==='0x5abd98db')return {jsonrpc:'2.0',id:req.id,result:words(20_000n)};
      if(data==='0xdfe8ccbd')return {jsonrpc:'2.0',id:req.id,result:words(1000n*E18)};
      if(data==='0xa71ada54')return {jsonrpc:'2.0',id:req.id,result:words(0n)};
      throw new Error(`unexpected call ${data}`);
    });
    return {ok:true,async json(){return rows;}};
  };
}

function baseState(){
  const surface={id:'frxeth-sfrxeth',measurementState:'MEASURED-current-onchain-partial',measured:{v2Internals:{etherRouter:{status:'ok',blockTag:'0x64'},lendingPool:{status:'ok',blockTag:'0x64'}},epistemic:{executionAuthority:'none'}},mechanicalRelations:[]};
  const observation={
    id:'frax-ecosystem:base',protocolId:'registry-frax-vefrax',status:'deep-sensor-family-fully-measured',
    authority:{executionAuthority:'none',causalClaimAuthority:'none'},
    epistemic:{executionAuthority:'none',measuredEconomicSurfaces:['frxeth-sfrxeth']},
    coverage:{surfaceCount:1,measuredSurfaceCount:1,sourceBoundUnknownSurfaceCount:0,relationshipCount:0,relationshipClassCounts:{}},
    surfaces:{frxEthSfrxEth:surface},relationshipGraph:[],scopeExtensions:{frxEth:{version:'0.1'}},measurementExtensions:{frxEthCurrentState:'0.1',frxEthV2EtherRouterCurrentState:'0.1',frxEthV2LendingPoolCurrentState:'0.1'},nextMeasurementUnlocks:['Measure frxETH V2 RedemptionQueue state and validator-pool credit as separate bounded sub-atoms.']
  };
  return {generatedAt:'2026-08-29T14:40:00.000Z',authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation},observations:[observation],observationCount:1,status:observation.status}},protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{measurementExtensions:{frxEthCurrentState:'0.1',frxEthV2EtherRouterCurrentState:'0.1',frxEthV2LendingPoolCurrentState:'0.1'}},epistemic:{executionAuthority:'none'}}}};
}

const measured=await collectFraxFrxEthV2RedemptionQueueCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),checkpoint:{blockTag:'0x64'}});
assert.equal(measured.status,'ok');
assert.equal(measured.measurementClass,'MEASURED');
assert.equal(measured.rpc.endpointId,'second-ok');
assert.equal(measured.rpc.reusedCheckpoint,true);
assert.equal(measured.redemptionQueue.nativeEthBalance.eth,100);
assert.equal(measured.redemptionQueue.state.nextNftId,42);
assert.equal(measured.redemptionQueue.state.queueLengthSecs,86_400);
assert.equal(measured.redemptionQueue.state.redemptionFeePct,0.5);
assert.equal(measured.redemptionQueue.state.ttlEthRequested.eth,160);
assert.equal(measured.redemptionQueue.state.ttlEthServed.eth,120);
assert.equal(measured.redemptionQueue.accounting.etherLiabilities.eth,150);
assert.equal(measured.redemptionQueue.accounting.unclaimedFees.frxEth,5);
assert.equal(measured.redemptionQueue.accounting.pendingFees.frxEth,10);
assert.equal(measured.redemptionQueue.liquidity.status,'SHORTAGE');
assert.equal(measured.redemptionQueue.liquidity.netEthBalanceEth,-40);
assert.equal(measured.redemptionQueue.liquidity.shortageEth,40);
assert.equal(measured.redemptionQueue.liquidity.netArithmeticParity,true);
assert.equal(measured.redemptionQueue.registryPointerParity,true);
assert.equal(measured.epistemic.unclaimedRedemptionFees,'MEASURED-earned-uncollected-protocol-fees');
assert.equal(measured.epistemic.aggregateProtocolRevenue,'UNKNOWN-not-complete-protocol-revenue-view');
assert.equal(measured.epistemic.executionAuthority,'none');

const state=baseState();
applyFraxFrxEthV2RedemptionQueueCurrentState({state,measurement:measured});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation,surface=obs.surfaces.frxEthSfrxEth;
assert.equal(obs.coverage.surfaceCount,1);
assert.equal(obs.coverage.measuredSurfaceCount,1);
assert.equal(surface.measured.v2Internals.redemptionQueue.redemptionQueue.liquidity.shortageEth,40);
assert.equal(obs.epistemic.frxEthV2RedemptionQueueLiabilities,'MEASURED-onchain-accounting');
assert.equal(obs.epistemic.frxEthV2RedemptionQueueAggregateProtocolRevenue,'UNKNOWN');
assert.equal(obs.authority.executionAuthority,'none');
assert.match(obs.nextMeasurementUnlocks[0],/validator-pool credit/);

const legacy=await collectFraxFrxEthV2RedemptionQueueCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({legacyThreeWordState:true}),checkpoint:{blockTag:'0x64'}});
assert.equal(legacy.measurementClass,'MEASURED');
assert.equal(legacy.epistemic.cumulativeQueueFlow,'UNKNOWN-interface-source-shape-mismatch');
assert.match(legacy.redemptionQueue.state.ttlEthRequested.status,/^UNKNOWN/);

const drift=await collectFraxFrxEthV2RedemptionQueueCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({arithmeticDrift:true}),checkpoint:{blockTag:'0x64'}});
assert.equal(drift.measurementClass,'UNKNOWN');
assert.match(drift.status,/arithmetic-parity-drift/);

const unavailable=await collectFraxFrxEthV2RedemptionQueueCurrentState({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true}),checkpoint:{blockTag:'0x64'}});
assert.equal(unavailable.measurementClass,'UNKNOWN');
const state2=baseState();
applyFraxFrxEthV2RedemptionQueueCurrentState({state:state2,measurement:unavailable});
assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.epistemic.frxEthV2RedemptionQueueState,'UNKNOWN');
assert.equal(state2.protocolEvidence['registry-frax-ecosystem'].latest.observation.authority.executionAuthority,'none');

console.log('FRAX frxETH V2 REDEMPTION QUEUE CANARY PASS',{
  blockNumber:measured.blockNumber,
  liabilitiesEth:measured.redemptionQueue.accounting.etherLiabilities.eth,
  unclaimedFeesFrxEth:measured.redemptionQueue.accounting.unclaimedFees.frxEth,
  pendingFeesFrxEth:measured.redemptionQueue.accounting.pendingFees.frxEth,
  nativeEth:measured.redemptionQueue.nativeEthBalance.eth,
  liquidityStatus:measured.redemptionQueue.liquidity.status,
  shortageEth:measured.redemptionQueue.liquidity.shortageEth,
  queueLengthSecs:measured.redemptionQueue.state.queueLengthSecs,
  redemptionFeePct:measured.redemptionQueue.state.redemptionFeePct,
  registryPointerParity:measured.redemptionQueue.registryPointerParity,
  executionAuthority:obs.authority.executionAuthority
});
