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
import {
  COMPANY_INCOME_SCOPE_VERSION,
  incomeScopeFor,
  scopeIncludesCanonicalOwner
} from './company-income-scope.mjs';

const scope=incomeScopeFor('defitea.eth');
assert.equal(scope.version,COMPANY_INCOME_SCOPE_VERSION);
assert.deepEqual(scope.associatedCompanies,['YieldRing.eth','05081966.eth']);
assert.deepEqual(scope.confirmedOwners,['defitea.eth','YieldRing.eth','05081966.eth']);
assert.deepEqual(scope.estimatedContributors,['defitea.eth','YieldRing.eth','05081966.eth']);
assert.deepEqual(scope.capitalOwners,['defitea.eth']);
assert.equal(scope.canonicalOwnershipPreserved,true);
assert.equal(scope.crossCompanyReattributionAllowed,false);
assert.equal(scope.holdingWideAggregationMustUseCanonicalOwners,true);
assert.equal(scope.companyReportTotalsAreNotAdditiveAcrossCompanies,true);

const productivity={
  generatedAt:'2026-08-22T06:00:00Z',
  companies:{
    'YieldRing.eth':{status:'ok',coverage:1,productiveValue:1000,aprLatest:36.5},
    '05081966.eth':{status:'ok',coverage:1,productiveValue:500,aprLatest:73}
  }
};

// Associated-company reference income keeps its canonical owner, but an
// explicit economic reporting scope admits it into Defitea Estimated only.
assert.equal(CONTRIBUTORS.length,2);
const yieldRingContext=contributorRow(productivity,'YieldRing.eth','2026-08-22');
const firstCompanyContext=contributorRow(productivity,'05081966.eth','2026-08-22');
assert.equal(yieldRingContext.referenceIncomeUsd,1);
assert.equal(firstCompanyContext.referenceIncomeUsd,1);
assert.equal(yieldRingContext.canonicalIncomeOwner,'YieldRing.eth');
assert.equal(firstCompanyContext.canonicalIncomeOwner,'05081966.eth');
assert.equal(yieldRingContext.incomeIncludedInDefiteaCashFlow,false); // canonical ownership unchanged
assert.equal(firstCompanyContext.incomeIncludedInDefiteaCashFlow,false);
assert.equal(yieldRingContext.referenceIncomeIncludedInDefiteaEstimatedView,true);
assert.equal(firstCompanyContext.referenceIncomeIncludedInDefiteaEstimatedView,true);
assert.equal(yieldRingContext.foreignCompanyContextOnly,true);
assert.equal(yieldRingContext.crossCompanyReattributionAllowed,false);
assert.equal(yieldRingContext.includedInDefiteaTvl,false);
assert.equal(scopeIncludesCanonicalOwner('defitea.eth','YieldRing.eth','capital'),false);

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
assert.equal(first.events.every(x=>x.company==='defitea.eth'),true);
assert.equal(first.events.some(x=>x.eventDate<'2026-08-09'),false);

const second=collectVoteMarketEvents(vmBase,{trackingStartedAt:'2026-08-09',existing:first.events});
assert.equal(second.events.length,2);
assert.equal(second.admitted,0);

const afterClaim={generatedAt:'2026-08-23T05:45:00Z',companies:{'defitea.eth':{rewards:[]}}};
const third=collectVoteMarketEvents(afterClaim,{trackingStartedAt:'2026-08-09',existing:first.events});
assert.equal(third.events.length,2);
assert.equal(third.events.reduce((s,x)=>s+x.usdValue,0),5);

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
assert.equal(rebuilt['2026-07'].cashFlowUsd,56.05);
assert.equal(rebuilt['2026-08'].baseDefiteaReferenceCashFlowUsd,45.62);
assert.equal(rebuilt['2026-08'].associatedCompanyReferenceCashFlowUsd,2);
assert.equal(rebuilt['2026-08'].associatedCompanyReferenceContextUsd,2);
assert.equal(rebuilt['2026-08'].associatedCompanyCanonicalOwnershipAttributedUsd,0);
assert.equal(rebuilt['2026-08'].crossCompanyReferenceIncomeExcludedUsd,0);
assert.equal(rebuilt['2026-08'].voteMarketObservedIncomeUsd,5);
assert.equal(rebuilt['2026-08'].cashFlowUsd,52.62);
assert.equal(rebuilt['2026-08'].monthlyYieldPct,0.552); // Defitea-only TVL denominator preserved
assert.equal(rebuilt['2026-08'].annualizedAprPct,15.4985);
assert.equal(rebuilt['2026-08'].associatedCompanyTvlIncluded,false);
assert.equal(rebuilt['2026-08'].crossCompanyReattributionAllowed,false);
assert.equal(rebuilt['2026-08'].associatedCompanyEstimatedViewIncluded,true);

const liveSummary=rebuildYearSummary(rebuilt,'2026');
assert.equal(liveSummary.annualizedCashFlowAprPct,12.6943);
assert.equal(liveSummary.annualizedCashFlowAprIncludesLiveMonth,true);
assert.equal(liveSummary.annualizedCashFlowAprMonths,2);
assert.equal(liveSummary.currentMonthAnnualizedAprPct,15.4985);

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
assert.equal(fund.latestSnapshot.totalValueUsd,9532.58);
assert.equal(fund.incomeComposition.associatedCompanyTvlIncluded,false);
assert.equal(fund.incomeComposition.crossCompanyReattributionAllowed,false);
assert.equal(fund.incomeComposition.currentDayAssociatedCompanyReferenceContextUsd,2);
assert.equal(fund.incomeComposition.currentDayAssociatedCompanyAttributedIncomeUsd,0);
assert.equal(fund.incomeComposition.currentDayAssociatedCompanyEstimatedViewUsd,2);
assert.equal(fund.incomeComposition.associatedCompanyEstimatedViewIncluded,true);
assert.equal(fund.incomeComposition.holdingWideAggregationMustUseCanonicalOwners,true);
assert.equal(composed.ledger.contributors.every(x=>x.incomeIncludedInDefiteaCashFlow===false),true);
assert.equal(composed.ledger.contributors.every(x=>x.referenceIncomeIncludedInDefiteaEstimatedView===true),true);
assert.equal(composed.ledger.contributors.every(x=>x.contextOnly===true),true);
assert.equal(composed.ledger.contributors.every(x=>x.includedInDefiteaTvl===false),true);
assert.equal(fund.vlCvxReconciliation.claimableSettlementAddedToReferenceCashFlow,false);
assert.equal(fund.months['2026-07'].cashFlowUsd,56.05);
assert.equal(fund.months['2026-08'].cashFlowUsd,52.62);
assert.equal(fund.summaries['2026'].annualizedCashFlowAprPct,12.6943);
assert.equal(fund.summaries['2026'].annualizedCashFlowAprIncludesLiveMonth,true);

assert.throws(()=>contributorRow({companies:{'YieldRing.eth':{status:'partial',coverage:0.5,productiveValue:1000,aprLatest:10}}},'YieldRing.eth','2026-08-22'),/complete canonical Productivity state required/);

console.log('Defitea income composition validation PASS',{
  voteMarketEvents:first.events.length,
  duplicateAdmissions:second.admitted,
  retainedAfterClaim:third.events.length,
  associatedCompanyReferenceContextUsd:2,
  associatedCompanyEstimatedViewUsd:2,
  associatedCompanyCanonicalAttributedUsd:0,
  defiteaAugustEstimatedUsd:rebuilt['2026-08'].cashFlowUsd,
  liveAugustAnnualizedAprPct:rebuilt['2026-08'].annualizedAprPct,
  liveYearAnnualizedAprPct:liveSummary.annualizedCashFlowAprPct,
  defiteaOnlyTvlUsd:9532.58
});
