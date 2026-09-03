#!/usr/bin/env node
import assert from 'node:assert/strict';
import { admitYieldBasisIntoLedgerState } from './yield-basis-ledger-admission.mjs';

const generatedAt='2026-09-03T07:00:00.000Z';
const ledger={
  version:'0.1-canonical-income-ledger',
  events:[{
    eventKey:'existing:1',company:'Existing.eth',family:'accrued-entitlement',economicDate:'2026-09-02',route:'frax-yield',amount:1,usdValue:1,
    immutableEconomicFieldsHash:'filler',retention:'indefinite',laterStateChangeDoesNotEraseIncome:true,executionAuthority:'none'
  }]
};
// Use an empty ledger for the positive path because admitEvents verifies hashes
// of all prior canonical events; the preservation property is tested separately
// by admitting the same Yield Basis event twice.
const baseLedger={version:'0.1-canonical-income-ledger',events:[]};
const evidence={
  version:'0.1-yield-basis-factual-accrual-evidence',mechanism:'yield-basis-fees',
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

const first=admitYieldBasisIntoLedgerState({ledger:baseLedger,evidence,generatedAt});
assert.equal(first.candidateEventCount,1);
assert.equal(first.newEventsAdmitted,1);
assert.equal(first.ledger.events.length,1);
const row=first.ledger.events[0];
assert.equal(row.family,'accrued-entitlement');
assert.equal(row.route,'yield-basis-fees');
assert.equal(row.retention,'indefinite');
assert.equal(row.laterStateChangeDoesNotEraseIncome,true);
assert.equal(row.executionAuthority,'none');
assert.ok(/^[0-9a-f]{64}$/.test(row.immutableEconomicFieldsHash));

const second=admitYieldBasisIntoLedgerState({ledger:first.ledger,evidence,generatedAt:'2026-09-03T08:00:00.000Z'});
assert.equal(second.newEventsAdmitted,0);
assert.equal(second.ledger.events.length,1);
assert.equal(second.ledger.events[0].immutableEconomicFieldsHash,row.immutableEconomicFieldsHash);

assert.throws(()=>admitYieldBasisIntoLedgerState({ledger:first.ledger,evidence:{...evidence,events:[{...evidence.events[0],usdValue:0.8}]},generatedAt}),/mutation detected/);
assert.throws(()=>admitYieldBasisIntoLedgerState({ledger:baseLedger,evidence:{...evidence,authority:{...evidence.authority,walletAuthority:'allowed'}},generatedAt}),/authority expansion/);
assert.throws(()=>admitYieldBasisIntoLedgerState({ledger:{version:'wrong',events:[]},evidence,generatedAt}),/version mismatch/);

console.log('Yield Basis Canonical Ledger admission validation OK',{
  immutableAdmission:true,
  duplicateAdmissionIdempotent:true,
  mutationFailsClosed:true,
  executionAuthority:'none'
});
