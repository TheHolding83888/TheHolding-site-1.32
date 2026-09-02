#!/usr/bin/env node
import assert from 'node:assert/strict';
import { lockedManagedEvidenceCandidates, validateLockedManagedEvidence } from './ve33-locked-managed-income-candidates.mjs';

const source={
  version:'0.1-ve33-locked-managed-factual-accrual',
  semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  events:[{
    eventKey:'ve33-locked:test:1',company:'Alpha',family:'embedded-compounded-income',economicDate:'2026-09-02',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-02T00:00:00.000Z',route:'aerodrome-relay',protocol:'Aerodrome',asset:'AERO',token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',amount:2,amountRaw:'2000000000000000000',usdValue:1.8,mechanismKind:'locked-managed-reward',holder:'0x5555555555555555555555555555555555555555',tokenId:'7',managedTokenId:'70',rewardContract:'0x7777777777777777777777777777777777777777',recognitionState:'compounded-locked',openingBalanceCreatesIncome:false,earnedIndependentOfWithdrawal:true,withdrawalIsSettlementNotSecondIncome:true,grossVeNftPrincipalDeltaIsIncomeAuthority:false,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true,executionAuthority:'none'
  }]
};
assert.deepEqual(validateLockedManagedEvidence(source),{present:true});
const finalize=(x,generatedAt)=>({...x,generatedAt,sourceIdentityHash:'test'});
const rows=lockedManagedEvidenceCandidates(source,finalize,'2026-09-02T12:00:00.000Z');
assert.equal(rows.length,1);
assert.equal(rows[0].sourceFamily,'ve(3,3) LockedManagedReward factual accrual');
assert.equal(rows[0].executionAuthority,'none');
assert.throws(()=>lockedManagedEvidenceCandidates({...source,events:[{...source.events[0],claimIsSecondIncomeEvent:true}]},finalize,'2026-09-02T12:00:00.000Z'),/recognition boundary invalid/);
console.log('ve(3,3) LockedManagedReward ledger candidate validation OK');
