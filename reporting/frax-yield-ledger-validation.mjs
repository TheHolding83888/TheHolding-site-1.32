#!/usr/bin/env node
import assert from 'node:assert/strict';
import { fraxYieldCandidates } from './income-ledger.mjs';

const generatedAt='2026-09-02T12:00:00.000Z';
const base={
  version:'0.1-frax-yield-factual-accrual-evidence',
  mechanism:'frax-yield',
  semantics:{
    openingBalanceCreatesIncome:false,
    earnedIndependentOfClaim:true,
    claimIsSettlementNotSecondIncome:true,
    referenceAprUsed:false,
    laterPriceMovementRewritesClosedIncome:false,
    unknownIsNotZero:true
  },
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  events:[{
    eventKey:'frax-yield-accrual:0x0000000000000000000000000000000000000001:100:200',
    company:'Example.eth',family:'accrued-entitlement',economicDate:'2026-09-02',
    periodStart:'2026-09-01T06:00:00.000Z',periodEnd:'2026-09-02T06:00:00.000Z',
    route:'frax-yield',protocol:'Frax · veFRAX',asset:'WFRAX',token:'0xFc00000000000000000000000000000000000002',
    amount:1.25,amountRaw:'1250000000000000000',usdValue:1.31,valuationUnitUsd:1.048,
    sourceIdentity:'open->close',evidenceStatus:'factual-opening-plus-settlement-to-closing-reconciliation',
    openingEarnedRaw:'10000000000000000000',closingEarnedRaw:'1250000000000000000',settlementRaw:'10000000000000000000',
    settlementEventCount:1,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,
    laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'
  }]
};

const rows=fraxYieldCandidates(base,generatedAt);
assert.equal(rows.length,1);
const row=rows[0];
assert.equal(row.family,'accrued-entitlement');
assert.equal(row.route,'frax-yield');
assert.equal(row.amount,1.25);
assert.equal(row.usdValue,1.31);
assert.equal(row.referenceAprUsed,false);
assert.equal(row.currentClaimableBalanceIsPeriodIncome,false);
assert.equal(row.claimIsSecondIncomeEvent,false);
assert.equal(row.laterClaimOrPriceMoveDoesNotRewriteIncome,true);
assert.equal(row.retention,'indefinite');
assert.equal(row.laterStateChangeDoesNotEraseIncome,true);
assert.equal(row.executionAuthority,'none');
assert.ok(/^[0-9a-f]{64}$/.test(row.immutableEconomicFieldsHash));

assert.throws(()=>fraxYieldCandidates({...base,semantics:{...base.semantics,openingBalanceCreatesIncome:true}},generatedAt),/semantics invalid/);
assert.throws(()=>fraxYieldCandidates({...base,events:[{...base.events[0],referenceAprUsed:true}]},generatedAt),/recognition boundary invalid/);
assert.throws(()=>fraxYieldCandidates({...base,events:[base.events[0],base.events[0]]},generatedAt),/duplicate or missing event identity/);
assert.throws(()=>fraxYieldCandidates({...base,authority:{...base.authority,claimingAuthority:'allowed'}},generatedAt),/authority expansion/);

console.log('Frax Canonical Ledger admission validation OK',{
  eventFamily:row.family,
  openingBalanceCreatesIncome:false,
  claimIsSettlementNotSecondIncome:true,
  frozenUsd:true,
  referenceAprUsed:false,
  executionAuthority:'none'
});
