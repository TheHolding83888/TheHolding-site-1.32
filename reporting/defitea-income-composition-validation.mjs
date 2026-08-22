#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CONTRIBUTORS,
  collectVoteMarketEvents,
  contributorRow,
  rebuildDefiteaMonths,
  rebuildYearSummary,
  compose
} from './defitea-income-composition.mjs';

const productivity={
  generatedAt:'2026-08-22T06:00:00Z',
  companies:{
    'YieldRing.eth':{status:'ok',coverage:1,productiveValue:1000,aprLatest:36.5},
    '05081966.eth':{status:'ok',coverage:1,productiveValue:500,aprLatest:73}
  }
};

// Contributor arithmetic fixture: deliberately simple deterministic values.
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

// Production-scale synthetic month: values are intentionally close to the
// observed Aug-21 Defitea Reporting scale, but remain deterministic test data.
const months={
  '2026-07':{month:'2026-07',status:'final-reported',mode:'reported-realised',cashFlowUsd:56.05,monthlyYieldPct:0.82,annualizedAprPct:9.89,averageTvlUsd:6835.37},
  '2026-08':{month:'2026-08',status:'provisional',mode:'reference-model',cashFlowUsd:45.62,referenceCashFlowUsd:45.62,averageTvlUsd:9532.58,sampleDays:13,monthlyYieldPct:0.4785,annualizedAprPct:13.954}
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
assert.equal(rebuilt['2026-08'].baseDefiteaReferenceCashFlowUsd,45.62);
assert.equal(rebuilt['2026-08'].associatedCompanyReferenceCashFlowUsd,2);
assert.equal(rebuilt['2026-08'].voteMarketObservedIncomeUsd,5);
assert.equal(rebuilt['2026-08'].cashFlowUsd,52.62);
assert.equal(rebuilt['2026-08'].monthlyYieldPct,0.552); // denominator remains Defitea-only TVL
assert.equal(rebuilt['2026-08'].annualizedAprPct,15.4985); // observed 13-day yield annualized; no fabricated future days
assert.equal(rebuilt['2026-08'].associatedCompanyTvlIncluded,false);

// The live year APR is the arithmetic mean of comparable per-month annualized rates.
// This fixture keeps the live month in a realistic Defitea-scale range.
const liveSummary=rebuildYearSummary(rebuilt,'2026');
assert.equal(liveSummary.annualizedCashFlowAprPct,12.6943);
assert.equal(liveSummary.annualizedCashFlowAprIncludesLiveMonth,true);
assert.equal(liveSummary.annualizedCashFlowAprMonths,2);
assert.equal(liveSummary.currentMonthAnnualizedAprPct,15.4985);

// Closed-only fallback remains stable when no provisional month exists.
const closedSummary=rebuildYearSummary({'2026-07':rebuilt['2026-07']},'2026');
assert.equal(closedSummary.annualizedCashFlowAprPct,9.89);
assert.equal(closedSummary.annualizedCashFlowAprIncludesLiveMonth,false);
assert.equal(closedSummary.annualizedCashFlowAprMonths,1);
assert.equal(closedSummary.currentMonthAnnualizedAprPct,null);

const reporting={
  generatedAt:'2026-08-22T06:22:00Z',
  note:'Base reporting.',
  funds:{
    'defitea.eth':{
      trackingStartedAt:'2026-08-09',
      latestSnapshot:{date:'2026-08-22',totalValueUsd:9532.58,modeledDailyCashFlowUsd:1},
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
assert.equal(fund.latestSnapshot.totalValueUsd,9532.58); // no associated-company TVL leakage
assert.equal(fund.incomeComposition.associatedCompanyTvlIncluded,false);
assert.equal(composed.ledger.contributors.every(x=>x.includedInDefiteaTvl===false),true);
assert.equal(fund.vlCvxReconciliation.claimableSettlementAddedToReferenceCashFlow,false); // unchanged reconciliation boundary
assert.equal(fund.months['2026-07'].cashFlowUsd,56.05);
assert.equal(fund.months['2026-08'].cashFlowUsd,52.62);
assert.equal(fund.summaries['2026'].annualizedCashFlowAprPct,12.6943);
assert.equal(fund.summaries['2026'].annualizedCashFlowAprIncludesLiveMonth,true);

// Unknown != zero: incomplete contributor Productivity must fail closed.
assert.throws(()=>contributorRow({companies:{'YieldRing.eth':{status:'partial',coverage:0.5,productiveValue:1000,aprLatest:10}}},'YieldRing.eth','2026-08-22'),/complete canonical Productivity state required/);

console.log('Defitea income composition validation PASS',{
  voteMarketEvents:first.events.length,
  duplicateAdmissions:second.admitted,
  retainedAfterClaim:third.events.length,
  contributorDailyUsd:2,
  unifiedAugustCashFlowUsd:rebuilt['2026-08'].cashFlowUsd,
  liveAugustAnnualizedAprPct:rebuilt['2026-08'].annualizedAprPct,
  liveYearAnnualizedAprPct:liveSummary.annualizedCashFlowAprPct,
  defiteaOnlyTvlUsd:9532.58
});
