#!/usr/bin/env node
import assert from 'node:assert/strict';
import { icpNnsObservationProofs } from './accounting-coverage.mjs';

const generatedAt='2026-09-05T01:00:00.000Z';
const ids=Array.from({length:41},(_,i)=>String(10000000000000000000n+BigInt(i)));
const companies={'0x5860...83CA8.eth':0.5,'aerocvxyb.eth':0.5};
const config={
  version:'0.1-icp-nns-shared-neuron-pool',
  asset:'ICP',network:'Internet Computer',positionType:'NNS Governance Neurons',
  allocation:{policy:'owner-declared-equal-economic-allocation',companies},
  neuronIds:ids,
  rewardPolicy:{referenceAprAccountingAuthority:false,fallbackAccountingTreatment:'analytics-state-estimate-only-never-earned-income',unknownIsNotZero:true,claimAuthority:'none',executionAuthority:'none'},
  security:{readOnly:true,seedPhraseRequired:false,identityPemRequired:false,privateKeyRequired:false}
};
const state={
  version:'0.1-icp-nns-rewards-state',engineVersion:'0.1-public-neuron-state-with-bounded-maturity-fallback',generatedAt,status:'partial',asset:'ICP',network:'Internet Computer',route:'icp-nns-governance',
  publicNeuronObservation:{requestedNeuronCount:41,detailOkCount:41,fullDetailCoverage:true},
  rewards:{mode:'owner-baseline-plus-canonical-reference-apr-estimate',estimated:true,aggregateUnclaimedIcp:999,referenceAprPct:99},
  authority:{readOnly:true,claimTransactionAuthority:'none',executionAuthority:'none'},unknownIsNotZero:true,
  neurons:ids.map(neuronId=>({neuronId,detailStatus:'ok',stakeIcp:61.3877551,state:'Dissolving'}))
};

const proofs=icpNnsObservationProofs(state,config);
assert.equal(proofs.length,2,'full canonical 41/41 NNS observation must prove tracking for both economic owners');
assert.deepEqual(new Set(proofs.map(x=>x.company)),new Set(Object.keys(companies)));
assert.ok(proofs.every(x=>x.engineId==='icp_nns'));
assert.ok(proofs.every(x=>x.sourceFile==='companies/icp-nns-rewards-state.json'));
assert.ok(proofs.every(x=>x.observedAt===generatedAt));

// Estimated rewards and Reference APR are deliberately irrelevant to tracking proof.
const extremeEstimate=structuredClone(state);
extremeEstimate.rewards.aggregateUnclaimedIcp=123456789;
extremeEstimate.rewards.referenceAprPct=0.000001;
assert.deepEqual(icpNnsObservationProofs(extremeEstimate,config),proofs,'analytics estimate leaked into factual tracking authority');

for(const mutate of [
  s=>{s.publicNeuronObservation.detailOkCount=40;},
  s=>{s.publicNeuronObservation.fullDetailCoverage=false;},
  s=>{s.neurons.pop();},
  s=>{s.neurons[0].detailStatus='unavailable';},
  s=>{s.neurons[0].neuronId='999';},
  s=>{s.authority.executionAuthority='write';},
  s=>{s.authority.claimTransactionAuthority='write';},
  s=>{s.unknownIsNotZero=false;}
]){
  const candidate=structuredClone(state); mutate(candidate);
  assert.deepEqual(icpNnsObservationProofs(candidate,config),[],'malformed/incomplete NNS observation failed open');
}
for(const mutate of [
  c=>{c.neuronIds.pop();},
  c=>{c.rewardPolicy.referenceAprAccountingAuthority=true;},
  c=>{c.rewardPolicy.fallbackAccountingTreatment='earned-income';},
  c=>{c.security.seedPhraseRequired=true;},
  c=>{c.security.identityPemRequired=true;},
  c=>{c.security.privateKeyRequired=true;},
  c=>{c.allocation.companies['aerocvxyb.eth']=0.4;}
]){
  const candidate=structuredClone(config); mutate(candidate);
  assert.deepEqual(icpNnsObservationProofs(state,candidate),[],'unsafe/drifted NNS config failed open');
}

console.log('ICP NNS factual tracking proof validation PASS',{proofs:proofs.length,neurons:41,estimatedRewardIncomeAuthority:false,executionAuthority:'none'});
