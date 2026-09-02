#!/usr/bin/env node
import assert from 'node:assert/strict';
import { admitVe33IntoLedgerState } from './ve33-ledger-admission.mjs';

const baseEvidence={
  version:'0.1-ve33-factual-accrual-evidence',status:'factual-boundary-tracking',fullAccountingStart:'2026-09-01T00:00:00.000Z',
  semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,rebaseDepositIntoVeNftIsSecondIncome:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  checkpoints:[],events:[]
};
const event={eventKey:'ve33:test:1',company:'Alpha',family:'accrued-entitlement',economicDate:'2026-09-02',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-02T00:00:00.000Z',route:'aerodrome-ve',protocol:'Aerodrome',asset:'USDC',token:'0x1111111111111111111111111111111111111111',amount:1,amountRaw:'1000000',usdValue:1,mechanismKind:'voting-reward',holder:'0x2222222222222222222222222222222222222222',tokenId:'7',rewardContract:'0x3333333333333333333333333333333333333333',distributor:null,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true};
const ledger={version:'0.1-canonical-income-ledger',events:[]};
const first=admitVe33IntoLedgerState({ledger,evidence:{...baseEvidence,events:[event]},generatedAt:'2026-09-02T12:00:00.000Z'});
assert.equal(first.candidateEventCount,1);
assert.equal(first.newEventsAdmitted,1);
assert.equal(first.ledger.events.length,1);
assert.equal(first.ledger.events[0].sourceFamily,'ve(3,3) factual accrual evidence');
assert.equal(first.ledger.events[0].executionAuthority,'none');
const repeat=admitVe33IntoLedgerState({ledger:first.ledger,evidence:{...baseEvidence,events:[event]},generatedAt:'2026-09-02T13:00:00.000Z'});
assert.equal(repeat.newEventsAdmitted,0);
assert.equal(repeat.ledger.events.length,1);
const mutated={...event,usdValue:2};
assert.throws(()=>admitVe33IntoLedgerState({ledger:first.ledger,evidence:{...baseEvidence,events:[mutated]},generatedAt:'2026-09-02T13:00:00.000Z'}),/mutation detected/);
const absent=admitVe33IntoLedgerState({ledger,evidence:{},generatedAt:'2026-09-02T13:00:00.000Z'});
assert.equal(absent.newEventsAdmitted,0);
assert.equal(absent.ledger.events.length,0);
console.log('ve(3,3) Canonical Ledger admission validation OK');
