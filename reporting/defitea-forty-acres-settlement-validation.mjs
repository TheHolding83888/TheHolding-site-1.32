#!/usr/bin/env node
import assert from 'node:assert/strict';
import {collectReceivedEvents,applySettlement} from './defitea-forty-acres-settlement.mjs';

const rewards={
  generatedAt:'2026-08-22T14:52:35.146Z',
  companies:{'defitea.eth':{
    receivedIncomeUsdIsComplete:true,
    receivedIncome:[{
      protocol:'40 Acres · veVELO',route:'forty-acres-velodrome-received',state:'Received',classification:'received',
      includedInClaimableTotal:false,executionAuthority:'none',portfolio:'0x1111111111111111111111111111111111111111',recipient:'0x2222222222222222222222222222222222222222',
      payoutToken:'0x3333333333333333333333333333333333333333',symbol:'USDC',chain:'Optimism',transfers:[
        {txHash:'0x'+'a'.repeat(64),logIndex:1,timestamp:'2026-08-06T12:00:00Z',amount:0.68,usdValue:0.68,symbol:'USDC',chain:'Optimism'},
        {txHash:'0x'+'b'.repeat(64),logIndex:2,timestamp:'2026-08-13T12:00:00Z',amount:0.61,usdValue:0.61,symbol:'USDC',chain:'Optimism'},
        {txHash:'0x'+'c'.repeat(64),logIndex:3,timestamp:'2026-07-30T12:00:00Z',amount:9,usdValue:9,symbol:'USDC',chain:'Optimism'}
      ]
    }]
  }}
};
const first=collectReceivedEvents(rewards,{existing:[]});
assert.equal(first.events.length,2);
assert.equal(first.admitted,2);
assert.equal(first.events.reduce((s,x)=>s+x.usdValue,0),1.29);
assert.equal(first.events.some(x=>x.eventDate<'2026-08-01'),false);
const second=collectReceivedEvents(rewards,{existing:first.events});
assert.equal(second.events.length,2);
assert.equal(second.admitted,0);

const reporting={
  generatedAt:'2026-08-22T15:00:00Z',note:'Base.',
  funds:{'defitea.eth':{
    trackingStartedAt:'2026-08-09',latestSnapshot:{date:'2026-08-22',totalValueUsd:10000},
    daily:[
      {date:'2026-08-09',positions:[{principalId:'velodrome-finance',valueUsd:200,referenceApr:18.25}]},
      {date:'2026-08-10',positions:[{principalId:'velodrome-finance',valueUsd:200,referenceApr:18.25}]}
    ],
    months:{
      '2026-07':{month:'2026-07',status:'final-reported',mode:'reported-realised',cashFlowUsd:56.05,monthlyYieldPct:0.82,annualizedAprPct:9.89,averageTvlUsd:6835.37},
      '2026-08':{month:'2026-08',status:'provisional',mode:'reference-model',baseDefiteaReferenceCashFlowUsd:10,associatedCompanyReferenceCashFlowUsd:2,voteMarketObservedIncomeUsd:5,cashFlowUsd:17,averageTvlUsd:10000,sampleDays:2,normalizationFactor:1}
    },summaries:{}
  }}
};
const out=applySettlement({reporting,rewards,ledger:{fortyAcresReceivedEvents:[]}});
const aug=out.reporting.funds['defitea.eth'].months['2026-08'];
assert.equal(aug.fortyAcresReplacedReferenceCashFlowUsd,0.2);
assert.equal(aug.fortyAcresReceivedIncomeUsd,1.29);
assert.equal(aug.cashFlowUsd,18.09);
assert.equal(aug.fortyAcresReferenceDoubleCountPrevented,true);
assert.equal(out.reporting.funds['defitea.eth'].months['2026-07'].cashFlowUsd,56.05);
assert.equal(out.reporting.funds['defitea.eth'].fortyAcresSettlement.claimableAffected,false);
assert.equal(out.reporting.funds['defitea.eth'].fortyAcresSettlement.tvlAffected,false);
assert.equal(out.reporting.funds['defitea.eth'].fortyAcresSettlement.executionAuthority,'none');

console.log('Defitea 40 Acres settlement validation PASS',{
  events:first.events.length,duplicateAdmissions:second.admitted,
  replacedReferenceUsd:aug.fortyAcresReplacedReferenceCashFlowUsd,
  receivedUsd:aug.fortyAcresReceivedIncomeUsd,unifiedCashFlowUsd:aug.cashFlowUsd
});
