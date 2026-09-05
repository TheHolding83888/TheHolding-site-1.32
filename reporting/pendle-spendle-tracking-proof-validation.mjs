#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildAccountingCoverage, pendleSPendleObservationProofs } from './accounting-coverage.mjs';

const generatedAt='2026-09-05T06:00:00.000Z';
const wallet1='0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3';
const wallet2='0x6640C1AF0BF7e77fa223d4Af2F779e55dcFB8D2d';

const canonicalRewards={
  generatedAt,
  companies:{
    'defitea.eth':{
      updatedAt:generatedAt,
      sources:[{
        protocol:'Pendle',
        route:'pendle-spendle',
        status:'ok',
        chain:'Multi-chain',
        metric:'Official sPENDLE holder + dashboard claimable rewards APIs',
        details:{
          walletResults:[
            {wallet:wallet1,walletAlias:'defitea.eth',status:'ok',rewardCount:1,note:null},
            {wallet:wallet2,walletAlias:'Defitea Operations',status:'ok',rewardCount:1,note:null}
          ]
        }
      }],
      rewards:[
        {
          protocol:'Pendle',route:'pendle-spendle',classification:'unclaimed',amount:1.25,
          source:'official Pendle API: dashboard merkle rewards',details:{wallet:wallet1,walletAlias:'defitea.eth'}
        },
        {
          protocol:'Pendle',route:'pendle-spendle',classification:'unclaimed',amount:0.001,
          source:'official Pendle API: sPENDLE accrued ETH fees',details:{wallet:wallet2,walletAlias:'Defitea Operations'}
        }
      ]
    }
  }
};

const proofs=pendleSPendleObservationProofs(canonicalRewards);
assert.equal(proofs.length,1,'complete canonical Pendle route must prove factual tracking');
assert.equal(proofs[0].engineId,'pendle_spendle');
assert.equal(proofs[0].company,'defitea.eth');
assert.equal(proofs[0].observedAt,generatedAt);
assert.equal(proofs[0].sourceFile,'companies/rewards-data.json');
assert.equal(proofs[0].month,'2026-09');

// Reference rates are analytics only and cannot alter the factual tracking boundary.
const withReferenceApr=structuredClone(canonicalRewards);
withReferenceApr.companies['defitea.eth'].sources[0].details.referenceAprPct=999;
assert.deepEqual(pendleSPendleObservationProofs(withReferenceApr),proofs,'reference APR leaked into Pendle factual tracking authority');

// A fully observed zero-reward state still proves that the mechanism is being tracked.
const zeroRewards=structuredClone(canonicalRewards);
zeroRewards.companies['defitea.eth'].sources[0].details.walletResults.forEach(x=>{x.rewardCount=0;});
zeroRewards.companies['defitea.eth'].rewards=[];
const zeroProofs=pendleSPendleObservationProofs(zeroRewards);
assert.equal(zeroProofs.length,1,'complete zero-reward Pendle observation became a false coverage gap');

const emptyLedger={
  generatedAt,
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  events:[],
  companies:{'defitea.eth':{currentClaimableState:{rows:[]}}}
};
const productivity={
  generatedAt,
  engines:{pendle_spendle:{protocol:'Pendle'}},
  companies:{'defitea.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'pendle_spendle',value:944.62,engineStatus:'ok'}]}}
};
const coverage=buildAccountingCoverage({productivity,ledger:emptyLedger,embedded:{},factualEvidence:{rewards:zeroRewards},generatedAt});
const aggregate=coverage.mechanisms.pendle_spendle;
const current=coverage.companies['defitea.eth'].mechanisms.pendle_spendle.months['2026-09'];
assert.equal(aggregate.activeCompanyCount,1);
assert.equal(aggregate.factualTrackingCompanyCount,1,'Pendle tracking proof was not admitted into coverage');
assert.equal(aggregate.factualEventCompanyCount,0,'tracking proof fabricated a period income event');
assert.equal(aggregate.reusableCoverageGap,false,'fully observed Pendle route remained a reusable coverage gap');
assert.equal(current.status,'factual-tracking-no-period-event');
assert.equal(current.factualTrackingActive,true);
assert.equal(current.factualEventCount,0);
assert.ok(current.completionBlockers.includes('no-canonical-period-income-evidence'),'tracking-only Pendle state lost period-income blocker');
assert.ok(!current.completionBlockers.includes('no-factual-engine-tracking-proof'),'tracked Pendle mechanism still reports missing tracking proof');

const expectFailClosed=(mutate,label)=>{
  const candidate=structuredClone(canonicalRewards);
  mutate(candidate);
  assert.deepEqual(pendleSPendleObservationProofs(candidate),[],label);
};

expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].status='partial';},'partial Pendle route gained tracking authority');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].protocol='Pendle-like';},'protocol identity drift failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].metric='Reference APR';},'metric identity drift failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults=[];},'missing wallet boundary failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults[1].status='partial';},'partially observed wallet failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults[0].wallet='not-an-address';},'invalid wallet identity failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults[1].wallet=wallet1;},'duplicate wallet identity failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults[0].rewardCount=-1;},'negative wallet reward count failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults[0].rewardCount=1.5;},'fractional wallet reward count failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].sources[0].details.walletResults[0].rewardCount=2;},'wallet reward count mismatch failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].rewards[0].protocol='Pendle-like';},'reward protocol drift failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].rewards[0].classification='estimated';},'non-factual reward classification failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].rewards[0].source='reference APR estimate';},'unofficial reward source failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].rewards[0].details.wallet='0x1111111111111111111111111111111111111111';},'reward escaped scoped wallet boundary');
expectFailClosed(x=>{x.companies['defitea.eth'].rewards[0].amount='not-a-number';},'non-finite reward amount failed open');
expectFailClosed(x=>{x.companies['defitea.eth'].rewards[0].amount=-1;},'negative reward amount failed open');
expectFailClosed(x=>{delete x.generatedAt;delete x.companies['defitea.eth'].updatedAt;},'missing observation time gained tracking authority');

console.log('sPENDLE factual tracking proof validation PASS',{
  wallets:2,
  zeroRewardTracking:true,
  periodIncomeAuthority:false,
  referenceAprAccountingAuthority:false,
  executionAuthority:'none'
});
