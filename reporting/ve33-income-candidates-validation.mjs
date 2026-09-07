#!/usr/bin/env node
import assert from 'node:assert/strict';
import { validateVe33Evidence, ve33EvidenceCandidates } from './ve33-income-candidates.mjs';

const base={
  version:'0.1-ve33-factual-accrual-evidence',
  semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,rebaseDepositIntoVeNftIsSecondIncome:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  events:[]
};
assert.equal(validateVe33Evidence(base).present,true);
assert.equal(validateVe33Evidence({}).present,false);
assert.throws(()=>validateVe33Evidence({...base,semantics:{...base.semantics,referenceAprUsed:true}}));

const holder='0x2222222222222222222222222222222222222222';
const token='0x1111111111111111111111111111111111111111';
const rewardContract='0x3333333333333333333333333333333333333333';
const votingLane=`aerodrome|Alpha|${holder}|7|voting-reward|${rewardContract}|${token}`;
const event={
  eventKey:`ve33:${votingLane}:100:200`,company:'Alpha',family:'accrued-entitlement',economicDate:'2026-09-02',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-02T00:00:00.000Z',route:'aerodrome-ve',protocol:'Aerodrome',asset:'USDC',token,amount:1,amountRaw:'1000000',usdValue:1,mechanismKind:'voting-reward',holder,tokenId:'7',rewardContract,distributor:null,sourceIdentity:`${votingLane}|100->${votingLane}|200`,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterClaimOrPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true
};
const finalizer=(e)=>({...e,finalized:true});
const rows=ve33EvidenceCandidates({...base,events:[event]},finalizer,'2026-09-02T12:00:00.000Z');
assert.equal(rows.length,1);
assert.equal(rows[0].sourceFile,'reporting/ve33-accounting-evidence.json');
assert.equal(rows[0].finalized,true);
assert.throws(()=>ve33EvidenceCandidates({...base,events:[event,event]},finalizer,'2026-09-02T12:00:00.000Z'));
assert.throws(()=>ve33EvidenceCandidates({...base,events:[{...event,claimIsSecondIncomeEvent:true}]},finalizer,'2026-09-02T12:00:00.000Z'));
assert.throws(()=>ve33EvidenceCandidates({...base,events:[{...event,token:'0x5555555555555555555555555555555555555555'}]},finalizer,'2026-09-02T12:00:00.000Z'),'mutable token metadata must not disagree with immutable ve33 identity');

const distributor='0x4444444444444444444444444444444444444444';
const rebaseLane=`aerodrome|Alpha|${holder}|7|rebase-distributor|${distributor}|${token}`;
const rebase={...event,eventKey:`ve33:${rebaseLane}:100:200`,sourceIdentity:`${rebaseLane}|100->${rebaseLane}|200`,mechanismKind:'rebase-distributor',rewardContract:null,distributor};
assert.equal(ve33EvidenceCandidates({...base,events:[rebase]},finalizer,'2026-09-02T12:00:00.000Z').length,1);

console.log('ve33 Canonical Ledger candidate validation OK');
