#!/usr/bin/env node
import assert from 'node:assert/strict';
import { finalizeCandidate } from './income-ledger.mjs';
import { yieldBasisEvidenceCandidates } from './yield-basis-income-candidates.mjs';

const generatedAt='2026-09-03T07:00:00.000Z';
const base={
  version:'0.1-yield-basis-factual-accrual-evidence',
  mechanism:'yield-basis-fees',
  semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  events:[{
    eventKey:'yield-basis-accrual:0x0000000000000000000000000000000000000001:0x0000000000000000000000000000000000000011:100:200',
    company:'Example.eth',family:'accrued-entitlement',economicDate:'2026-09-03',periodStart:'2026-09-02T06:00:00.000Z',periodEnd:'2026-09-03T06:00:00.000Z',
    route:'yield-basis-fees',protocol:'Yield Basis · veYB',asset:'yb-WBTC',token:'0x0000000000000000000000000000000000000011',decimals:18,
    amount:0.00001,amountRaw:'10000000000000',usdValue:0.75,valuationUnitUsd:75000,
    sourceIdentity:'open->close:token',evidenceStatus:'factual-opening-plus-settlement-to-closing-token-reconciliation',
    openingClaimableRaw:'10000000000000',closingClaimableRaw:'5000000000000',settlementRaw:'15000000000000',settlementEventCount:1,
    referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'
  }]
};

const rows=yieldBasisEvidenceCandidates(base,finalizeCandidate,generatedAt);
assert.equal(rows.length,1);
const row=rows[0];
assert.equal(row.family,'accrued-entitlement');
assert.equal(row.route,'yield-basis-fees');
assert.equal(row.amount,0.00001);
assert.equal(row.usdValue,0.75);
assert.equal(row.referenceAprUsed,false);
assert.equal(row.currentClaimableBalanceIsPeriodIncome,false);
assert.equal(row.claimIsSecondIncomeEvent,false);
assert.equal(row.laterClaimOrPriceMoveDoesNotRewriteIncome,true);
assert.equal(row.retention,'indefinite');
assert.equal(row.laterStateChangeDoesNotEraseIncome,true);
assert.equal(row.executionAuthority,'none');
assert.ok(/^[0-9a-f]{64}$/.test(row.immutableEconomicFieldsHash));

assert.throws(()=>yieldBasisEvidenceCandidates({...base,semantics:{...base.semantics,openingBalanceCreatesIncome:true}},finalizeCandidate,generatedAt),/semantics invalid/);
assert.throws(()=>yieldBasisEvidenceCandidates({...base,events:[{...base.events[0],claimIsSecondIncomeEvent:true}]},finalizeCandidate,generatedAt),/recognition boundary invalid/);
assert.throws(()=>yieldBasisEvidenceCandidates({...base,events:[base.events[0],base.events[0]]},finalizeCandidate,generatedAt),/duplicate or missing event identity/);
assert.throws(()=>yieldBasisEvidenceCandidates({...base,authority:{...base.authority,claimingAuthority:'allowed'}},finalizeCandidate,generatedAt),/authority expansion/);

console.log('Yield Basis Canonical Ledger candidate validation OK',{
  openingBalanceCreatesIncome:false,
  claimIsSettlementNotSecondIncome:true,
  frozenUsd:true,
  referenceAprUsed:false,
  executionAuthority:'none'
});
