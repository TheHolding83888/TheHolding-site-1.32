#!/usr/bin/env node
import assert from 'node:assert/strict';
import { admitVe33IntoLedgerState, lockedManagedHistoricalBoundaryFailures } from './ve33-ledger-admission.mjs';
import { historicalOptimismVelodromeTwapRouteForToken } from './historical-canonical-price.mjs';

const baseEvidence={
  version:'0.1-ve33-factual-accrual-evidence',status:'factual-boundary-tracking',fullAccountingStart:'2026-09-01T00:00:00.000Z',
  semantics:{openingBalanceCreatesIncome:false,earnedIndependentOfClaim:true,claimIsSettlementNotSecondIncome:true,rebaseDepositIntoVeNftIsSecondIncome:false,referenceAprUsed:false,laterPriceMovementRewritesClosedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
  checkpoints:[],events:[]
};
const holder='0x2222222222222222222222222222222222222222';
const token='0x1111111111111111111111111111111111111111';
const rewardContract='0x3333333333333333333333333333333333333333';
const lane=`aerodrome|Alpha|${holder}|7|voting-reward|${rewardContract}|${token}`;
const event={
  eventKey:`ve33:${lane}:100:200`,company:'Alpha',family:'accrued-entitlement',economicDate:'2026-09-02',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-02T00:00:00.000Z',route:'aerodrome-ve',protocol:'Aerodrome',asset:'USDC',token,amount:1,amountRaw:'1000000',usdValue:1,mechanismKind:'voting-reward',holder,tokenId:'7',rewardContract,distributor:null,sourceIdentity:`${lane}|100->${lane}|200`,referenceAprUsed:false,currentClaimableBalanceIsPeriodIncome:false,claimIsSecondIncomeEvent:false,laterPriceMoveDoesNotRewriteIncome:true,unknownIsNotZero:true
};
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

// Materialization retry must be narrowly scoped to exact historical month
// boundaries. Current-state failures and semantic inactive boundaries must not
// trigger an expensive historical rebuild.
const retryProbe={diagnostics:{protocols:{aerodrome:{boundaryFailures:[
  {laneKey:'aerodrome|defitea.eth|lane',boundaryAt:'2026-08-01T00:00:00.000Z',status:'archive-state-unavailable',error:'transient archive read'},
  {laneKey:null,boundaryAt:'2026-09-01T00:00:00.000Z',status:'boundary-block-unavailable',error:'transient block lookup'},
  {laneKey:'aerodrome|defitea.eth|lane',boundaryAt:'2026-09-08T01:00:00.000Z',status:'archive-state-unavailable',error:'current read'},
  {laneKey:'aerodrome|other|lane',boundaryAt:'2026-08-01T00:00:00.000Z',status:'managed-token-mismatch',error:null}
]}}}};
const retryFailures=lockedManagedHistoricalBoundaryFailures(retryProbe);
assert.equal(retryFailures.length,2);
assert.deepEqual(retryFailures.map(x=>x.boundaryAt),['2026-08-01T00:00:00.000Z','2026-09-01T00:00:00.000Z']);
assert.equal(lockedManagedHistoricalBoundaryFailures({diagnostics:{protocols:{aerodrome:{boundaryFailures:[]}}}}).length,0);

// Defitea August historical-valuation tail regression: these two immutable
// reward-token identities must remain bound to exact Optimism Velodrome V2
// pools and native USDC quote proof. This validation grants no price or income
// authority; the production resolver still must prove the exact closing block.
const usdc='0x0b2c639c533813f4aa9d7837caf62653d097ff85';
const alUsd=historicalOptimismVelodromeTwapRouteForToken('0xCB8FA9a76b8e203D8C3797bF438d8FB81Ea3326A');
assert.equal(alUsd?.assetId,'alchemix-usd');
assert.equal(alUsd?.pool.toLowerCase(),'0x124d69daeda338b1b31ffc8e429e39c9a991164e');
assert.equal(alUsd?.quoteToken.toLowerCase(),usdc);
assert.equal(alUsd?.poolStable,true);
assert.equal(alUsd?.twapGranularity,48);
const tarot=historicalOptimismVelodromeTwapRouteForToken('0x1F514A61bcde34F94Bc39731235690ab9da737F7');
assert.equal(tarot?.assetId,'tarot');
assert.equal(tarot?.pool.toLowerCase(),'0x707ba27189e8bf89e43b2198e6b88aac4720124f');
assert.equal(tarot?.quoteToken.toLowerCase(),usdc);
assert.equal(tarot?.poolStable,false);
assert.equal(tarot?.twapGranularity,48);

console.log('ve(3,3) Canonical Ledger admission + locked-managed retry + Defitea August historical route validation OK');