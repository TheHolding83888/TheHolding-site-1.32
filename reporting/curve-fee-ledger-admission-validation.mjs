#!/usr/bin/env node
import assert from 'node:assert/strict';
import { admitCurveFeeIntoLedgerState } from './curve-fee-ledger-admission.mjs';
import { FEE_DISTRIBUTOR, CRVUSD, VERSION } from './curve-fee-accounting-adapter.mjs';

const company="Rook's portfolio";
const wallet='0x7eC6331188468269DC7C1Cf6a84C972632178B1E';
const marketData={prices:{crvusd:{symbol:'crvUSD',usd:1.001,assetId:'crvusd',source:'canonical-test'}}};
const makeState=(block,raw,at)=>({
  stateKey:`${company}|${wallet.toLowerCase()}|${CRVUSD.toLowerCase()}`,company,wallet,walletAlias:'Wallet 1',
  feeDistributor:FEE_DISTRIBUTOR,token:CRVUSD,symbol:'crvUSD',decimals:18,amountRaw:String(raw),amount:Number(BigInt(raw))/1e18,
  observedAt:at,blockNumber:block,sourceRoute:'curve-fees',routeStatus:'ok',periodIncomeAuthority:false,currentClaimableBalanceIsPeriodIncome:false,unknownIsNotZero:true
});
const emptyLedger={version:'0.1-canonical-income-ledger',events:[],accountingExtensions:{},authority:{executionAuthority:'none'}};

const first=await admitCurveFeeIntoLedgerState({
  ledger:emptyLedger,rewards:{},marketData,generatedAt:'2026-09-04T10:00:00.000Z',
  currentStates:[makeState(100,5_000_000_000_000_000_000n,'2026-09-04T10:00:00.000Z')]
});
assert.equal(first.extension.version,VERSION);
assert.equal(first.extension.boundaries.length,1);
assert.equal(first.candidateEventCount,0);
assert.equal(first.newEventsAdmitted,0);
assert.equal(first.ledger.events.length,0,'opening claimable balance became income');
assert.equal(first.ledger.accountingExtensions.curveFeeAccrual.semantics.openingBalanceCreatesIncome,false);
assert.equal(first.ledger.accountingExtensions.curveFeeAccrual.authority.executionAuthority,'none');

const second=await admitCurveFeeIntoLedgerState({
  ledger:first.ledger,rewards:{},marketData,generatedAt:'2026-09-04T11:00:00.000Z',
  currentStates:[makeState(200,6_000_000_000_000_000_000n,'2026-09-04T11:00:00.000Z')],claimScanner:async()=>0
});
assert.equal(second.candidateEventCount,1);
assert.equal(second.newEventsAdmitted,1);
assert.equal(second.ledger.events.length,1);
const event=second.ledger.events[0];
assert.equal(event.company,company);
assert.equal(event.family,'accrued-entitlement');
assert.equal(event.route,'curve-fees');
assert.equal(event.asset,'crvUSD');
assert.equal(event.amount,1);
assert.equal(event.usdValue,1.001);
assert.equal(event.referenceAprUsed,false);
assert.equal(event.claimIsSecondIncomeEvent,false);
assert.equal(event.currentClaimableBalanceIsPeriodIncome,false);
assert.equal(event.retention,'indefinite');
assert.equal(event.laterStateChangeDoesNotEraseIncome,true);
assert.equal(event.executionAuthority,'none');
assert.ok(event.immutableEconomicFieldsHash);

const duplicate=await admitCurveFeeIntoLedgerState({
  ledger:second.ledger,rewards:{},marketData,generatedAt:'2026-09-04T11:00:00.000Z',
  currentStates:[makeState(200,6_000_000_000_000_000_000n,'2026-09-04T11:00:00.000Z')],claimScanner:async()=>0
});
assert.equal(duplicate.newEventsAdmitted,0);
assert.equal(duplicate.ledger.events.length,1,'same exact boundary duplicated canonical income');

console.log('Curve FeeDistributor Canonical Ledger admission PASS',{
  baselineEvents:first.ledger.events.length,admitted:second.newEventsAdmitted,totalEvents:second.ledger.events.length,
  duplicateAdmissions:duplicate.newEventsAdmitted,executionAuthority:event.executionAuthority
});
