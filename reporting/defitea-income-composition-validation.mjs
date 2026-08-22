#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CONTRIBUTORS,
  collectVoteMarketEvents,
  contributorRow,
  rebuildDefiteaMonths,
  compose
} from './defitea-income-composition.mjs';

const productivity={
  generatedAt:'2026-08-22T06:00:00Z',
  companies:{
    'YieldRing.eth':{status:'ok',coverage:1,productiveValue:1000,aprLatest:36.5},
    '05081966.eth':{status:'ok',coverage:1,productiveValue:500,aprLatest:73}
  }
};

// Contributor arithmetic: 1000*36.5%/365 = $1/day; 500*73%/365 = $1/day.
assert.equal(CONTRIBUTORS.length,2);
assert.equal(contributorRow(productivity,'YieldRing.eth','2026-08-22').referenceIncomeUsd,1);
assert.equal(contributorRow(productivity,'05081966.eth','2026-08-22').referenceIncomeUsd,1);
assert.equal(contributorRow(productivity,'YieldRing.eth','2026-08-22').includedInDefiteaTvl,false);

const vmBase={
  generatedAt:'2026-08-22T05:45:00Z',
  companies:{
    'defitea.eth':{
      rewards:[
        {
          protocol:'VoteMarket · veCRV',route:'votemarket-vecrv',classification:'unclaimed',
          token:'0x1111111111111111111111111111111111111111',symbol:'pUSDC',amount:2,usdValue:2,
          details:{epoch:1787184000,epochDate:'2026-08-20',chainId:42161,platform:'0x2222222222222222222222222222222222222222',campaignId:'10',gauge:'0x3333333333333333333333333333333333333333',wallet:'0x4444444444444444444444444444444444444444',walletAlias:'defitea.eth'}
        },
        {
          protocol:'VoteMarket · veFXN',route:'votemarket-vefxn',classification:'unclaimed',
          token:'0x5555555555555555555555555555555555555555',symbol:'pFXN',amount:1,usdValue:3,
          details:{epoch:1786579200,epochDate:'2026-08-13',chainId:42161,platform:'0x6666666666666666666666666666666666666666',campaignId:'20',gauge:'0x7777777777777777777777777777777777777777',wallet:'0x4444444444444444444444444444444444444444',walletAlias:'defitea.eth'}
        },
        // Pre-tracking event must never rewrite immutable Jan-Jul history.
        {
          protocol:'VoteMarket · veCRV',route:'votemarket-vecrv',classification:'unclaimed',
          token:'0x8888888888888888888888888888888888888888',symbol:'pUSDC',amount:9,usdValue:9,
          details:{epoch:1784764800,epochDate:'2026-07-23',chainId:42161,platform:'0x2222222222222222222222222222222222222222',campaignId:'9',gauge:'0x3333333333333333333333333333333333333333',wallet:'0x4444444444444444444444444444444444444444'}
        }
      ]
    }
  }
};

const first=collectVoteMarketEvents(vmBase,{trackingStartedAt:'2026-08-09',existing:[]});
assert.equal(first.events.length,2);
assert.equal(first.admitted,2);
assert.equal(first.events.reduce((s,x)=>s+x.usdValue,0),5);
assert.equal(first.events.some(x=>x.eventDate<'2026-08-09'),false);

// Same current claimable snapshot cannot be counted twice.
const second=collectVoteMarketEvents(vmBase,{trackingStartedAt:'2026-08-09',existing:first.events});
assert.equal(second.events.length,2);
assert.equal(second.admitted,0);

// Later claim/disappearance does not erase an already admitted income event.
const afterClaim={generatedAt:'2026-08-23T05:45:00Z',companies:{'defitea.eth':{rewards:[]}}};
const third=collectVoteMarketEvents(afterClaim,{trackingStartedAt:'2026-08-09',existing:first.events});
assert.equal(third.events.length,2);
assert.equal(third.events.reduce((s,x)=>s+x.usdValue,0),5);

const months={
  '2026-07':{month:'2026-07',status:'final-reported',mode:'reported-realised',cashFlowUsd:56.05,monthlyYieldPct:0.82,annualizedAprPct:9.89,averageTvlUsd:6835.37},
  '2026-08':{month:'2026-08',status:'provisional',mode:'reference-model',cashFlowUsd:10,referenceCashFlowUsd:10,averageTvlUsd:1000,sampleDays:10,monthlyYieldPct:1,annualizedAprPct:36.5}
};
const ledger={
  contributorDaily:[
    {date:'2026-08-22',month:'2026-08',company:'YieldRing.eth',referenceIncomeUsd:1},
    {date:'2026-08-22',month:'2026-08',company:'05081966.eth',referenceIncomeUsd:1}
  ],
  voteMarketEvents:first.events
};
const rebuilt=rebuildDefiteaMonths({months},ledger);
assert.equal(rebuilt['2026-07'].cashFlowUsd,56.05); // immutable legacy family untouched
assert.equal(rebuilt['2026-08'].baseDefiteaReferenceCashFlowUsd,10);
assert.equal(rebuilt['2026-08'].associatedCompanyReferenceCashFlowUsd,2);
assert.equal(rebuilt['2026-08'].voteMarketObservedIncomeUsd,5);
assert.equal(rebuilt['2026-08'].cashFlowUsd,17);
assert.equal(rebuilt['2026-08'].monthlyYieldPct,1.7); // denominator remains Defitea-only TVL = 1000
assert.equal(rebuilt['2026-08'].associatedCompanyTvlIncluded,false);

const reporting={
  generatedAt:'2026-08-22T06:22:00Z',
  note:'Base reporting.',
  funds:{
    'defitea.eth':{
      trackingStartedAt:'2026-08-09',
      latestSnapshot:{date:'2026-08-22',totalValueUsd:1000,modeledDailyCashFlowUsd:1},
      months,
      summaries:{},
      daily:[],
      vlCvxReconciliation:{claimableSettlementAddedToReferenceCashFlow:false}
    },
    'Monetra.eth':{trackingStartedAt:'2026-08-12',latestSnapshot:{date:'2026-08-22'},months:{},summaries:{}}
  }
};
const composed=compose({reporting,productivity,rewards:vmBase,ledger:{contributorDaily:[],voteMarketEvents:[]}});
const fund=composed.reporting.funds['defitea.eth'];
assert.equal(fund.latestSnapshot.totalValueUsd,1000); // no associated-company TVL leakage
assert.equal(fund.incomeComposition.associatedCompanyTvlIncluded,false);
assert.equal(composed.ledger.contributors.every(x=>x.includedInDefiteaTvl===false),true);
assert.equal(fund.vlCvxReconciliation.claimableSettlementAddedToReferenceCashFlow,false); // unchanged reconciliation boundary
assert.equal(fund.months['2026-07'].cashFlowUsd,56.05);
assert.equal(fund.months['2026-08'].cashFlowUsd,17);

// Unknown != zero: incomplete contributor Productivity must fail closed.
assert.throws(()=>contributorRow({companies:{'YieldRing.eth':{status:'partial',coverage:0.5,productiveValue:1000,aprLatest:10}}},'YieldRing.eth','2026-08-22'),/complete canonical Productivity state required/);

console.log('Defitea income composition validation PASS',{
  voteMarketEvents:first.events.length,
  duplicateAdmissions:second.admitted,
  retainedAfterClaim:third.events.length,
  contributorDailyUsd:2,
  unifiedAugustCashFlowUsd:rebuilt['2026-08'].cashFlowUsd,
  defiteaOnlyTvlUsd:1000
});
