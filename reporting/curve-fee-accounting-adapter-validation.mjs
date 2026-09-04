#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildCurveFeeAccrual, discoverCurveFeeWallets, FEE_DISTRIBUTOR, CRVUSD, VERSION } from './curve-fee-accounting-adapter.mjs';

const wallet='0x7CdF49f589038242e77847573604441E383f5429';
const company='05081966.eth';
const at1='2026-09-04T10:00:00.000Z',at2='2026-09-04T11:00:00.000Z',at3='2026-09-04T12:00:00.000Z';
const marketData={generatedAt:at2,prices:{crvusd:{symbol:'crvUSD',usd:0.9995,assetId:'curve-dao-token-crvusd',source:'canonical-test'}}};
const state=(block,amountRaw,observedAt=at1)=>({
  stateKey:`${company}|${wallet.toLowerCase()}|${CRVUSD.toLowerCase()}`,company,wallet,walletAlias:'test',feeDistributor:FEE_DISTRIBUTOR,
  token:CRVUSD,symbol:'crvUSD',decimals:18,amountRaw:String(amountRaw),amount:Number(BigInt(amountRaw))/1e18,
  observedAt,blockNumber:block,sourceRoute:'curve-fees',routeStatus:'ok',periodIncomeAuthority:false,currentClaimableBalanceIsPeriodIncome:false,unknownIsNotZero:true
});

const discovered=discoverCurveFeeWallets({companies:{
  [company]:{sources:[{route:'curve-fees',status:'ok',details:{walletResults:[{wallet,walletAlias:'Curve wallet',status:'ok',rewardCount:0}]}}],rewards:[]},
  Ignored:{sources:[{route:'curve-fees',status:'partial',details:{walletResults:[{wallet:'0x0000000000000000000000000000000000000001',status:'error'}]}}]}
}});
assert.equal(discovered.length,1);
assert.equal(discovered[0].company,company);
assert.equal(discovered[0].wallet,wallet);

const baseline=await buildCurveFeeAccrual({currentStates:[state(100,0n)],marketData,generatedAt:at1});
assert.equal(baseline.extension.version,VERSION);
assert.equal(baseline.extension.status,'factual-boundary-tracking');
assert.equal(baseline.extension.boundaries.length,1);
assert.equal(baseline.extension.diagnostics.baselineCount,1);
assert.equal(baseline.events.length,0,'opening zero baseline created income');
assert.equal(baseline.extension.semantics.openingBalanceCreatesIncome,false);
assert.equal(baseline.extension.semantics.currentClaimableBalanceIsPeriodIncome,false);
assert.equal(baseline.extension.semantics.unknownIsNotZero,true);
assert.equal(baseline.extension.authority.executionAuthority,'none');

const positive=await buildCurveFeeAccrual({
  currentStates:[state(200,2_000_000_000_000_000_000n,at2)],marketData,previousExtension:baseline.extension,generatedAt:at2,
  claimScanner:async()=>0
});
assert.equal(positive.events.length,1);
assert.equal(positive.events[0].family,'accrued-entitlement');
assert.equal(positive.events[0].route,'curve-fees');
assert.equal(positive.events[0].amount,2);
assert.equal(positive.events[0].usdValue,1.999);
assert.equal(positive.events[0].referenceAprUsed,false);
assert.equal(positive.events[0].currentClaimableBalanceIsPeriodIncome,false);
assert.equal(positive.events[0].claimIsSecondIncomeEvent,false);
assert.equal(positive.events[0].claimContinuityStatus,'no-intervening-claim-proven');

const withClaim=await buildCurveFeeAccrual({
  currentStates:[state(300,3_000_000_000_000_000_000n,at3)],marketData,previousExtension:positive.extension,generatedAt:at3,
  claimScanner:async()=>1
});
assert.equal(withClaim.events.length,0,'positive delta crossed an intervening claim');
assert.equal(withClaim.extension.reconciliation.length,1);
assert.equal(withClaim.extension.reconciliation[0].reason,'positive-delta-with-intervening-claim-not-admitted');

const decrease=await buildCurveFeeAccrual({
  currentStates:[state(300,1_000_000_000_000_000_000n,at3)],marketData,previousExtension:positive.extension,generatedAt:at3,
  claimScanner:async()=>0
});
assert.equal(decrease.events.length,0,'claimable decrease became negative income');
assert.equal(decrease.extension.reconciliation[0].reason,'claimable-decrease-requires-reconciliation');

const unchanged=await buildCurveFeeAccrual({currentStates:[state(300,2_000_000_000_000_000_000n,at3)],marketData,previousExtension:positive.extension,generatedAt:at3});
assert.equal(unchanged.events.length,0);
assert.equal(unchanged.extension.diagnostics.unchangedCount,1);

console.log('Curve FeeDistributor factual accrual adapter PASS',{
  discoveredWallets:discovered.length,baselineEvents:baseline.events.length,positiveEvents:positive.events.length,
  claimReconciliation:withClaim.extension.reconciliation.length,decreaseReconciliation:decrease.extension.reconciliation.length,
  executionAuthority:positive.extension.authority.executionAuthority
});
