#!/usr/bin/env node
import assert from 'node:assert/strict';
import { collectFraxFrxEthV2EtherRouterFlow, applyFraxFrxEthV2EtherRouterFlow } from './frax-frxeth-v2-ether-router-flow.mjs';
import registry from './frax-frxeth-registry.json' with { type:'json' };

const E18=10n**18n;
const depositAmo='0x1000000000000000000000000000000000000001';
const other='0x2000000000000000000000000000000000000002';
function word(v){return BigInt(v).toString(16).padStart(64,'0');}
function addressWord(address){return String(address).toLowerCase().replace(/^0x/,'').padStart(64,'0');}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
const hashes={
  'EtherSwept(address,uint256)':`0x${'33'.repeat(32)}`,
  'EtherRequested(address,uint256,uint256)':`0x${'44'.repeat(32)}`
};
function resultFor(req){
  if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x65',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
  if(req.method==='eth_getCode')return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
  if(req.method==='web3_sha3'){const sig=Buffer.from(req.params[0].slice(2),'hex').toString('utf8');return {jsonrpc:'2.0',id:req.id,result:hashes[sig]};}
  if(req.method==='eth_getLogs')return {jsonrpc:'2.0',id:req.id,result:[
    {address:registry.operations.etherRouter,blockNumber:'0x65',transactionHash:`0x${'01'.repeat(32)}`,logIndex:'0x0',topics:[hashes['EtherSwept(address,uint256)']],data:`0x${addressWord(registry.operations.redemptionQueueV2)}${word(2n*E18)}`},
    {address:registry.operations.etherRouter,blockNumber:'0x65',transactionHash:`0x${'02'.repeat(32)}`,logIndex:'0x1',topics:[hashes['EtherSwept(address,uint256)']],data:`0x${addressWord(depositAmo)}${word(3n*E18)}`},
    {address:registry.operations.etherRouter,blockNumber:'0x65',transactionHash:`0x${'03'.repeat(32)}`,logIndex:'0x2',topics:[hashes['EtherRequested(address,uint256,uint256)']],data:`0x${addressWord(registry.operations.lendingPool)}${word(4n*E18)}${word(1n*E18)}`}
  ]};
  throw new Error(`unexpected ${req.method}`);
}
function makeFetch({allFail=false}={}){return async (url,options)=>{
  if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
  const payload=JSON.parse(options.body);
  if(Array.isArray(payload))return {ok:true,async json(){return payload.map(resultFor);}};
  return {ok:true,async json(){return resultFor(payload);}};
};}
function checkpoint(block,hashByte,nativeEth,consolidatedEth,observedAt){return {
  version:'0.1-frxeth-v2-ether-router-exact-block',status:'ok',measurementClass:'MEASURED',observedAt,network:'ethereum',chainId:1,blockNumber:block,blockTag:`0x${block.toString(16)}`,blockHash:`0x${hashByte.repeat(32)}`,
  router:{address:registry.operations.etherRouter,nativeEthBalanceRaw:String(nativeEth*E18),nativeEthBalance:nativeEth,lendingPool:registry.operations.lendingPool,redemptionQueue:registry.operations.redemptionQueueV2,depositToAmoAddr:depositAmo,frxETH:registry.assets.frxETH.address,registryPointerParity:true},
  consolidated:{ethTotalBalancedRaw:String(consolidatedEth*E18),ethTotalBalanced:consolidatedEth,ethAccountingParity:true},
  epistemic:{executionAuthority:'none'}
};}
function baseState(){const surface={id:'frxeth-sfrxeth',measurementState:'MEASURED-current-onchain-partial',measured:{v2Internals:{etherRouter:{status:'ok'},lendingPool:{status:'ok'},validatorPoolCredit:{status:'ok'},lendingFlow:{status:'ok'}},epistemic:{executionAuthority:'none'}},mechanicalRelations:[]};const observation={id:'frax-ecosystem:base',protocolId:'registry-frax-vefrax',status:'deep-sensor-family-fully-measured',authority:{executionAuthority:'none',causalClaimAuthority:'none'},epistemic:{executionAuthority:'none'},coverage:{surfaceCount:1,measuredSurfaceCount:1,sourceBoundUnknownSurfaceCount:0,relationshipCount:0,relationshipClassCounts:{}},surfaces:{frxEthSfrxEth:surface},relationshipGraph:[],measurementExtensions:{frxEthV2EtherRouterCurrentState:'0.1'},nextMeasurementUnlocks:[]};return {authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation},observations:[observation],observationCount:1,status:observation.status}},protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{},epistemic:{executionAuthority:'none'}}}};}

const previous=checkpoint(100,'cd',12n,100n,'2026-08-30T00:00:00.000Z');
const current=checkpoint(101,'ab',5n,96n,'2026-08-30T00:00:12.000Z');
const measured=await collectFraxFrxEthV2EtherRouterFlow({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentEtherRouterMeasurement:current,previousEtherRouterMeasurement:previous});
assert.equal(measured.status,'ok');assert.equal(measured.measurementClass,'MEASURED');assert.equal(measured.rpc.endpointId,'second-ok');assert.equal(measured.rpc.ethGetLogsTransport,'single-request-not-batched');
assert.equal(measured.interval.summary.eventCount,3);assert.equal(measured.interval.summary.etherSweptCount,2);assert.equal(measured.interval.summary.etherRequestedCount,1);assert.equal(measured.interval.summary.sweptEth,5);assert.equal(measured.interval.summary.sweptToRedemptionQueueEth,2);assert.equal(measured.interval.summary.sweptToDepositAmoEth,3);assert.equal(measured.interval.summary.requestedToRecipientEth,4);assert.equal(measured.interval.summary.requestedToRedemptionQueueEth,1);assert.equal(measured.interval.summary.eventReportedOutflowEth,10);assert.equal(measured.interval.summary.routerNativeBalanceDeltaEth,-7);assert.equal(measured.interval.summary.consolidatedEthTotalBalancedDeltaEth,-4);
assert.equal(measured.epistemic.fullFlowReconciliation,'UNKNOWN-inbound-depositEther-receive-have-no-complete-event-surface-and-consolidated-AMO-value-can-change');assert.equal(measured.epistemic.withdrawalFeeToSpecificOutflow,'UNKNOWN-fungible-router-balance-not-traceable-to-later-outflow-with-this-evidence');assert.equal(measured.epistemic.protocolRevenue,'UNKNOWN-routing-is-capital-movement-not-net-revenue');

const state=baseState();applyFraxFrxEthV2EtherRouterFlow({state,measurement:measured});const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.coverage.surfaceCount,1);assert.equal(obs.coverage.measuredSurfaceCount,1);assert.equal(obs.epistemic.frxEthV2EtherRouterRealizedOutboundRouting,'MEASURED-adjacent-checkpoint-EtherSwept-plus-EtherRequested');assert.equal(obs.epistemic.frxEthV2EtherRouterFullFlowReconciliation,'UNKNOWN');assert.equal(obs.epistemic.frxEthV2EtherRouterProtocolRevenue,'UNKNOWN');assert.equal(obs.authority.executionAuthority,'none');assert.ok(obs.surfaces.frxEthSfrxEth.mechanicalRelations.some(x=>x.extension==='frxeth-v2-ether-router-flow'&&x.class==='ASSOCIATED-fungible-balance-NOT-attributed'));

const priorMeasurement={measurementClass:'MEASURED',interval:{toBlockNumber:100},cumulativeSinceTracking:{trackingStartBlock:90,sweptRaw:String(2n*E18),sweptToRedemptionQueueRaw:String(E18),sweptToDepositAmoRaw:String(E18),sweptToOtherRaw:'0',requestedToRecipientRaw:String(E18),requestedToRedemptionQueueRaw:'0',eventReportedOutflowRaw:String(3n*E18),etherSweptCount:2,etherRequestedCount:1},recentEvents:[]};
const accumulated=await collectFraxFrxEthV2EtherRouterFlow({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentEtherRouterMeasurement:current,previousEtherRouterMeasurement:previous,previousMeasurement:priorMeasurement});assert.equal(accumulated.cumulativeSinceTracking.trackingStartBlock,90);assert.equal(accumulated.cumulativeSinceTracking.sweptEth,7);assert.equal(accumulated.cumulativeSinceTracking.eventReportedOutflowEth,13);assert.equal(accumulated.cumulativeSinceTracking.continuousFromTrackingStart,true);

const warming=await collectFraxFrxEthV2EtherRouterFlow({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentEtherRouterMeasurement:current,previousEtherRouterMeasurement:null});assert.match(warming.status,/^UNKNOWN-warming/);assert.equal(warming.measurementClass,'UNKNOWN');
const unavailable=await collectFraxFrxEthV2EtherRouterFlow({registry,rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true}),currentEtherRouterMeasurement:current,previousEtherRouterMeasurement:previous});assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');assert.equal(unavailable.epistemic.protocolRevenue,'UNKNOWN');
console.log('FRAX frxETH V2 ETHER ROUTER REALIZED ROUTING CANARY PASS',{eventCount:measured.interval.summary.eventCount,sweptEth:measured.interval.summary.sweptEth,requestedEth:measured.interval.summary.requestedToRecipientEth,redemptionQueueEth:measured.interval.summary.sweptToRedemptionQueueEth+measured.interval.summary.requestedToRedemptionQueueEth,eventReportedOutflowEth:measured.interval.summary.eventReportedOutflowEth,fullFlowReconciliation:measured.epistemic.fullFlowReconciliation,protocolRevenue:measured.epistemic.protocolRevenue,executionAuthority:obs.authority.executionAuthority});
