#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  collectFraxFraxlendRateModel,
  applyFraxFraxlendRateModel,
  FRAX_FRAXLEND_RATE_MODEL_VERSION
} from './frax-fraxlend-rate-model.mjs';
import { FRAXLEND_PAIR_SFRXETH_USDC } from './frax-fraxlend-onchain.mjs';

const RATE='0x1111111111111111111111111111111111111111';
const HASH=`0x${'ab'.repeat(32)}`;
const E6=10n**6n;
function word(v){return BigInt(v).toString(16).padStart(64,'0');}
function words(vs){return `0x${vs.map(word).join('')}`;}
function addressWord(a){return `0x${String(a).replace(/^0x/,'').toLowerCase().padStart(64,'0')}`;}
function registry(){return {networks:{ethereum:{chainId:1,rpcFailover:[{id:'synthetic',url:'https://rpc.invalid'}]}}};}
const storedAsset=1000n*E6,storedBorrow=700n*E6;
const previewAsset=1010n*E6,previewBorrow=710n*E6;
const oldRate=1000000000n,oldFull=2000000000n,newRate=1500000000n,newFull=2100000000n;
const blockTimestamp=1704067200n,lastTimestamp=1704067190n;
const expectedUtil=70000n;
const base={
  status:'ok',measurementClass:'MEASURED',observedAt:'2024-01-01T00:00:00.000Z',chain:'ethereum',chainId:1,blockNumber:100,blockTag:'0x64',blockHash:HASH,
  contracts:{pair:FRAXLEND_PAIR_SFRXETH_USDC},rpc:{endpointId:'synthetic'},
  raw:{totalAssetAmount:previewAsset.toString(),totalAssetShares:(900n*E6).toString(),totalBorrowAmount:previewBorrow.toString(),totalBorrowShares:(500n*E6).toString()}
};
function makeFetch({badParity=false,paused=false}={}){
  return async (_url,options)=>{
    const reqs=JSON.parse(options.body);
    const out=reqs.map(req=>{
      if(req.method==='eth_getBlockByNumber')return {jsonrpc:'2.0',id:req.id,result:{number:'0x64',timestamp:'0x'+blockTimestamp.toString(16),hash:HASH}};
      assert.equal(req.method,'eth_call');
      assert.equal(req.params[1],'0x64');
      const to=String(req.params[0].to).toLowerCase(),data=req.params[0].data;
      if(to===FRAXLEND_PAIR_SFRXETH_USDC.toLowerCase()){
        if(data==='0xeee24219')return {jsonrpc:'2.0',id:req.id,result:addressWord(RATE)};
        if(data==='0xf9557ccb')return {jsonrpc:'2.0',id:req.id,result:words([storedAsset,900n*E6])};
        if(data==='0x8285ef40')return {jsonrpc:'2.0',id:req.id,result:words([storedBorrow,500n*E6])};
        if(data==='0x95d14ca8')return {jsonrpc:'2.0',id:req.id,result:words([99n,10000n,lastTimestamp,oldRate,oldFull])};
        if(data==='0xf211c390')return {jsonrpc:'2.0',id:req.id,result:words([paused?1n:0n])};
        if(data==='0xcacf3b58')return {jsonrpc:'2.0',id:req.id,result:words([
          10n*E6,1n*E6,1n*E6,
          100n,10000n,blockTimestamp,paused?oldRate:newRate,paused?oldFull:newFull,
          previewAsset,900n*E6,previewBorrow,500n*E6
        ])};
      }
      if(to===RATE.toLowerCase()){
        if(data==='0x54fd4d50')return {jsonrpc:'2.0',id:req.id,result:words([2n,0n,0n])};
        if(data.startsWith('0xcd3181d5')){
          const clean=data.slice(10);
          assert.equal(BigInt('0x'+clean.slice(0,64)),10n);
          assert.equal(BigInt('0x'+clean.slice(64,128)),expectedUtil);
          assert.equal(BigInt('0x'+clean.slice(128,192)),oldFull);
          return {jsonrpc:'2.0',id:req.id,result:words([badParity?newRate+1n:newRate,newFull])};
        }
      }
      throw new Error(`Unexpected call ${to} ${data}`);
    });
    return {ok:true,async json(){return out;}};
  };
}
const proof=await collectFraxFraxlendRateModel({baseMeasurement:base,registry:registry(),fetchImpl:makeFetch()});
assert.equal(proof.status,'ok');
assert.equal(proof.measurementClass,'DERIVED-MECHANICAL');
assert.equal(proof.version,FRAX_FRAXLEND_RATE_MODEL_VERSION);
assert.equal(proof.values.storedUtilizationPct,70);
assert.equal(proof.values.deltaTimeSeconds,10);
assert.equal(proof.parity.accepted,true);
assert.equal(proof.parity.previewVsDirectRateRaw,'0');
assert.equal(proof.rateContractVersion.major,2);
assert.equal(proof.epistemic.rateModelReproduction,'PROVEN-current-exact-block-protocol-native-call-parity');
assert.equal(proof.epistemic.annualizationPerformed,false);
assert.equal(proof.epistemic.executionAuthority,'none');

const bad=await collectFraxFraxlendRateModel({baseMeasurement:base,registry:registry(),fetchImpl:makeFetch({badParity:true})});
assert.match(bad.status,/^UNKNOWN/);
assert.equal(bad.parity.accepted,false);
assert.match(bad.rpc.failoverAttempts[0].error,/parity mismatch/);

const paused=await collectFraxFraxlendRateModel({baseMeasurement:base,registry:registry(),fetchImpl:makeFetch({paused:true})});
assert.equal(paused.status,'ok');
assert.equal(paused.mechanismState,'PAUSED-interest-short-circuit');
assert.equal(paused.parity.shortCircuit,true);
assert.equal(paused.epistemic.rateModelReproduction,'PROVEN-protocol-short-circuit');

function graphState(){
  const measured={...base,contracts:{pair:FRAXLEND_PAIR_SFRXETH_USDC},epistemic:{borrowRateModelReproduction:'NOT-YET-REPRODUCED',executionAuthority:'none'}};
  const current={id:'frax-ecosystem:before',authority:{executionAuthority:'none'},coverage:{relationshipCount:1,relationshipClassCounts:{}},epistemic:{executionAuthority:'none',fraxlendRateModelCausality:'UNKNOWN-not-reproduced'},measurementExtensions:{},surfaces:{fraxlend:{measurementState:'MEASURED-current-onchain-pair-pilot',measured,mechanicalRelations:[{from:'utilization + rate model',to:'borrow rate',class:'MEASURED-current-rate-state-model-not-reproduced'}]}}};
  return {authority:{executionAuthority:'none',causalClaimAuthority:'none'},protocolEvidence:{'registry-frax-ecosystem':{latest:{observation:current},observations:[current],measurementExtensions:{}}},protocolSensors:{'registry-frax-vefrax':{ecosystemFamily:{measurementExtensions:{}},latest:{observation:{ecosystemFamily:{}}}}}};
}
const state=graphState();
applyFraxFraxlendRateModel({state,proof});
const obs=state.protocolEvidence['registry-frax-ecosystem'].latest.observation;
assert.equal(obs.epistemic.fraxlendRateModel,'DERIVED-MECHANICAL');
assert.equal(obs.epistemic.fraxlendRateModelCausality,'MECHANICAL-protocol-native-utilization-rate-path');
assert.equal(obs.surfaces.fraxlend.measured.epistemic.borrowRateModelReproduction,'PROVEN-current-exact-block-protocol-native-call-parity');
assert.equal(obs.surfaces.fraxlend.mechanicalRelations[0].class,'MECHANICAL-proven-current-rate-model');
assert.notEqual(obs.id,'frax-ecosystem:before');
assert.equal(state.protocolSensors['registry-frax-vefrax'].ecosystemFamily.latestObservationId,obs.id);
assert.equal(obs.authority.executionAuthority,'none');

console.log('FRAX FRAXLEND RATE MODEL CANARY PASS',{
  utilizationPct:proof.values.storedUtilizationPct,
  deltaTimeSeconds:proof.values.deltaTimeSeconds,
  storedRatePerSecond:proof.values.storedRatePerSecond,
  previewRatePerSecond:proof.values.previewRatePerSecond,
  directRatePerSecond:proof.values.directRatePerSecond,
  parity:proof.parity.accepted,
  pausedShortCircuit:paused.parity.shortCircuit,
  badParityFallback:bad.status,
  executionAuthority:proof.epistemic.executionAuthority
});

if(process.env.GITHUB_ACTIONS==='true'){
  const {collectFraxFraxlendOnchain}=await import('./frax-fraxlend-onchain.mjs');
  const liveBase=await collectFraxFraxlendOnchain();
  assert.equal(liveBase.status,'ok','live base Fraxlend pair measurement required');
  const live=await collectFraxFraxlendRateModel({baseMeasurement:liveBase});
  if(live.status!=='ok'||live.measurementClass!=='DERIVED-MECHANICAL'||live.parity?.accepted!==true){
    throw new Error(`FRAX FRAXLEND LIVE RATE MODEL PROBE FAILED: ${live.status}; attempts=${JSON.stringify(live.rpc?.failoverAttempts||[])}`);
  }
  assert.equal(live.blockNumber,liveBase.blockNumber,'live rate model must share base exact block');
  assert.equal(String(live.blockHash).toLowerCase(),String(liveBase.blockHash).toLowerCase(),'live rate model block hash drift');
  assert.equal(live.epistemic.annualizationPerformed,false,'live rate model must not annualize');
  assert.equal(live.epistemic.executionAuthority,'none','live rate model authority drift');
  console.log('FRAX FRAXLEND LIVE RATE MODEL PROBE PASS',{
    observedAt:live.observedAt,
    blockNumber:live.blockNumber,
    blockHash:live.blockHash,
    rateContract:live.rateContract,
    rateContractVersion:live.rateContractVersion,
    mechanismState:live.mechanismState,
    storedUtilizationPct:live.values.storedUtilizationPct,
    deltaTimeSeconds:live.values.deltaTimeSeconds,
    storedRatePerSecond:live.values.storedRatePerSecond,
    previewRatePerSecond:live.values.previewRatePerSecond,
    directRatePerSecond:live.values.directRatePerSecond,
    parity:live.parity.accepted,
    rpcEndpointId:live.rpc.endpointId,
    executionAuthority:live.epistemic.executionAuthority
  });
}
