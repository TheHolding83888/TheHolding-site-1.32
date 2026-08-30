#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  collectFraxFrxEthV2EtherRouterAmoComposition,
  applyFraxFrxEthV2EtherRouterAmoComposition,
  FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION
} from './frax-frxeth-v2-ether-router-amo-composition.mjs';

const E18=10n**18n;
const ROUTER='0x1111111111111111111111111111111111111111';
const AMO='0x2222222222222222222222222222222222222222';
const HELPER='0x3333333333333333333333333333333333333333';
function word(value){return BigInt(value).toString(16).padStart(64,'0');}
function abiAddress(value){return `0x${String(value).toLowerCase().replace(/^0x/,'').padStart(64,'0')}`;}
function packed(...values){return `0x${values.map(word).join('')}`;}
function registry(){return {version:'0.1-frxeth-current-state-registry',network:'ethereum',chainId:1,operations:{etherRouter:ROUTER,curveLsdAmo:AMO},sources:{officialSourceRepo:'FraxFinance/frxETH-v2-public',officialSourceCommit:'83dfe93b4a32b9ca0ab93d6e7c059fcd977320d4'},epistemic:{unknownIsZero:false,executionAuthority:'none',causalClaimAuthority:'none'}};}
function rpcRegistry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'first-fails',url:'https://first.invalid'},{id:'second-ok',url:'https://second.invalid'}]}}};}
const currentRouter={status:'ok',measurementClass:'MEASURED',observedAt:'2026-08-30T00:00:00.000Z',blockNumber:100,blockTag:'0x64',blockHash:`0x${'ab'.repeat(32)}`,router:{address:ROUTER,nativeEthBalanceRaw:(2n*E18).toString(),nativeEthBalance:2},consolidated:{ethFreeRaw:(5n*E18).toString(),ethFree:5,ethInLpBalancedRaw:(4n*E18).toString(),ethInLpBalanced:4,ethTotalBalancedRaw:(9n*E18).toString(),ethTotalBalanced:9,frxEthFreeRaw:(5n*E18).toString(),frxEthFree:5,frxEthInLpBalancedRaw:(6n*E18).toString(),frxEthInLpBalanced:6}};

function makeFetch({allFail=false}={}){return async (url,options)=>{
  if(allFail||url.includes('first.invalid'))throw new Error('synthetic rpc outage');
  const payload=JSON.parse(options.body);assert.ok(Array.isArray(payload));
  const rows=payload.map(req=>{
    if(req.id===1)return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x65920080',hash:`0x${'ab'.repeat(32)}`}};
    if(req.id===2||req.id===202||req.id===300)return {jsonrpc:'2.0',id:req.id,result:'0x6001600055'};
    if(req.id===3||req.id===4)return {jsonrpc:'2.0',id:req.id,result:abiAddress(AMO)};
    if(req.id===100)return {jsonrpc:'2.0',id:req.id,result:abiAddress(AMO)};
    if(req.id>=101&&req.id<=115)return {jsonrpc:'2.0',id:req.id,error:{code:3,message:'execution reverted: array out of bounds'}};
    if(req.id===200)return {jsonrpc:'2.0',id:req.id,result:`0x${word(1n)}`};
    if(req.id===201)return {jsonrpc:'2.0',id:req.id,result:abiAddress(HELPER)};
    if(req.id===301)return {jsonrpc:'2.0',id:req.id,result:packed(3n*E18,4n*E18,7n*E18,5n*E18,6n*E18)};
    throw new Error(`Unexpected synthetic request ${JSON.stringify(req)}`);
  });
  return {ok:true,async json(){return rows;}};
};}

const measured=await collectFraxFrxEthV2EtherRouterAmoComposition({registry:registry(),rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentEtherRouterMeasurement:currentRouter});
assert.equal(measured.version,FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION);
assert.equal(measured.status,'ok');assert.equal(measured.measurementClass,'MEASURED');assert.equal(measured.rpc.endpointId,'second-ok');assert.equal(measured.rpc.failoverAttempts.length,1);
assert.equal(measured.blockNumber,100);assert.equal(measured.router.arraySlotCount,1);assert.equal(measured.router.activeAmoCount,1);assert.equal(measured.router.arrayEnumerationComplete,true);
assert.equal(measured.router.depositPreferenceActive,true);assert.equal(measured.router.primaryWithdrawPreferenceActive,true);assert.equal(measured.router.registryCurveLsdAmoActive,true);
assert.equal(measured.amos.length,1);assert.equal(measured.amos[0].address.toLowerCase(),AMO.toLowerCase());assert.equal(measured.amos[0].helper.toLowerCase(),HELPER.toLowerCase());assert.equal(measured.amos[0].balanced.amoEthTotalBalanced,7);
assert.equal(measured.aggregate.amoEthFree,3);assert.equal(measured.aggregate.amoEthInLpBalanced,4);assert.equal(measured.aggregate.amoEthTotalBalanced,7);assert.equal(measured.aggregate.routerNativeEth,2);assert.equal(measured.aggregate.reconciliation.all,true);
assert.equal(measured.epistemic.protocolRevenue,'UNKNOWN-capital-composition-is-not-net-revenue');assert.equal(measured.epistemic.executionAuthority,'none');

const state={authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation:{authority:{executionAuthority:'none',causalClaimAuthority:'none'},coverage:{relationshipCount:0,relationshipClassCounts:{}},measurementExtensions:{},epistemic:{},surfaces:{frxEthSfrxEth:{id:'frxEthSfrxEth',measurementState:'MEASURED-current-onchain-partial',measured:{v2Internals:{etherRouter:currentRouter},epistemic:{}},mechanicalRelations:[]}}}}}}};
applyFraxFrxEthV2EtherRouterAmoComposition({state,measurement:measured});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation,surface=obs.surfaces.frxEthSfrxEth;
assert.equal(surface.measured.v2Internals.etherRouterAmoComposition.status,'ok');assert.equal(surface.measured.epistemic.etherRouterAmoComposition,'MEASURED-exact-block-reconciled');assert.equal(obs.measurementExtensions.frxEthV2EtherRouterAmoComposition,FRAX_FRXETH_V2_ETHER_ROUTER_AMO_COMPOSITION_VERSION);assert.equal(obs.epistemic.frxEthV2EtherRouterAmoProtocolRevenue,'UNKNOWN');assert.equal(obs.authority.executionAuthority,'none');assert.equal(obs.relationshipGraph.length,2);

const unavailable=await collectFraxFrxEthV2EtherRouterAmoComposition({registry:registry(),rpcRegistry:rpcRegistry(),fetchImpl:makeFetch({allFail:true}),currentEtherRouterMeasurement:currentRouter});
assert.match(unavailable.status,/^UNKNOWN/);assert.equal(unavailable.measurementClass,'UNKNOWN');assert.equal(unavailable.router.activeAmoCount,null);assert.equal(unavailable.epistemic.unknownIsZero,false);
const missingPrereq=await collectFraxFrxEthV2EtherRouterAmoComposition({registry:registry(),rpcRegistry:rpcRegistry(),fetchImpl:makeFetch(),currentEtherRouterMeasurement:null});
assert.equal(missingPrereq.status,'UNKNOWN-prerequisite-current-EtherRouter-exact-block-unavailable');

console.log('FRAX frxETH V2 ETHER ROUTER AMO COMPOSITION CANARY PASS',{blockNumber:measured.blockNumber,activeAmos:measured.router.activeAmoCount,amoEthTotalBalanced:measured.aggregate.amoEthTotalBalanced,routerNativeEth:measured.aggregate.routerNativeEth,reconciliation:measured.aggregate.reconciliation.all,protocolRevenue:measured.epistemic.protocolRevenue,executionAuthority:measured.epistemic.executionAuthority});
