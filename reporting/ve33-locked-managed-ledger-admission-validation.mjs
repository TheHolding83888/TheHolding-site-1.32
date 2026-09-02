#!/usr/bin/env node
import assert from 'node:assert/strict';
import { admitLockedManagedIntoLedgerState } from './ve33-ledger-admission.mjs';

const baseEvidence={
  version:'0.1-ve33-locked-managed-factual-accrual',
  semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  checkpoints:[],events:[]
};
const event={eventKey:'ve33-locked:test:1',company:'Alpha',family:'embedded-compounded-income',economicDate:'2026-09-02',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-02T00:00:00.000Z',route:'aerodrome-relay',protocol:'Aerodrome',asset:'AERO',token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',amount:2,amountRaw:'2000000000000000000',usdValue:1.8,mechanismKind:'locked-managed-reward',holder:'0x5555555555555555555555555555555555555555',tokenId:'7',managedTokenId:'70',rewardContract:'0x7777777777777777777777777777777777777777',recognitionState:'compounded-locked',openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'};
const ledger={version:'0.1-canonical-income-ledger',events:[]};
const first=admitLockedManagedIntoLedgerState({ledger,evidence:{...baseEvidence,events:[event]},generatedAt:'2026-09-02T12:00:00.000Z'});
assert.equal(first.candidateEventCount,1);
assert.equal(first.newEventsAdmitted,1);
assert.equal(first.ledger.events.length,1);
assert.equal(first.ledger.events[0].sourceFamily,'ve(3,3) LockedManagedReward factual accrual');
assert.equal(first.ledger.events[0].executionAuthority,'none');
const repeat=admitLockedManagedIntoLedgerState({ledger:first.ledger,evidence:{...baseEvidence,events:[event]},generatedAt:'2026-09-02T13:00:00.000Z'});
assert.equal(repeat.newEventsAdmitted,0);
assert.equal(repeat.ledger.events.length,1);
assert.throws(()=>admitLockedManagedIntoLedgerState({ledger:first.ledger,evidence:{...baseEvidence,events:[{...event,usdValue:2}]},generatedAt:'2026-09-02T13:00:00.000Z'}),/mutation detected/);
console.log('ve(3,3) LockedManagedReward Canonical Ledger admission validation OK');
