import assert from 'node:assert/strict';
import { buildVlCvxPlatformAccrual, extractVlCvxPlatformStates, VERSION } from './vlcvx-platform-accounting-adapter.mjs';

const LOCKER='0x72a19342e8F1838460eBFCCEf09F6585e32db86E';
const WALLET='0x7eC6331188468269DC7C1Cf6a84C972632178B1E';
const FXS='0x3432B6A60D23Ca0dFCa7761B7ab56459D9C964D0';
const t=(block,raw='1000000000000000000',at='2026-09-04T12:00:00.000Z')=>({
  version:'x',generatedAt:at,diagnostics:{vlCvxLockerPlatformProof:{generatedAt:at,observedBlock:block}},companies:{
    "Rook's portfolio":{sources:[{route:'vlcvx-locker-platform-rewards',status:'ok',details:{principalAsset:'vlCVX',component:'locked-cvx-platform-rewards',wallet:WALLET,locker:LOCKER,observedBlock:block,rewards:[{token:FXS,symbol:'FXS',decimals:18,amountRaw:raw,amount:Number(raw)/1e18}],currentRoute:'convex-finance-vlcvx',periodIncomeAuthority:false,currentRewardStateIsNotPeriodIncome:true,unknownIsNotZero:true}}]}
  }
});
const market={generatedAt:'2026-09-04T12:00:00.000Z',prices:{'frax-share':{assetId:'frax-share',symbol:'FXS',usd:0.3,status:'fresh',observedAt:'2026-09-04T12:00:00.000Z',source:'test-canonical-price'}}};
const noClaims={getLogs:async()=>[]};
const withClaim={getLogs:async()=>[{blockNumber:150,transactionHash:'0x'+'1'.repeat(64)}]};

const states=extractVlCvxPlatformStates(t(100));
assert.equal(states.length,1);assert.equal(states[0].company,"Rook's portfolio");assert.equal(states[0].blockNumber,100);assert.equal(states[0].amountRaw,'1000000000000000000');

const baseline=await buildVlCvxPlatformAccrual({rewards:t(100),marketData:market,previousExtension:null,generatedAt:'2026-09-04T12:01:00.000Z',provider:noClaims});
assert.equal(baseline.events.length,0);assert.equal(baseline.extension.version,VERSION);assert.equal(baseline.extension.boundaries.length,1);assert.equal(baseline.extension.diagnostics.baselineCount,1);
assert.equal(baseline.extension.semantics.openingBalanceCreatesIncome,false);assert.equal(baseline.extension.semantics.referenceAprUsed,false);assert.equal(baseline.extension.authority.executionAuthority,'none');

const positive=await buildVlCvxPlatformAccrual({rewards:t(200,'2000000000000000000','2026-09-04T13:00:00.000Z'),marketData:market,previousExtension:baseline.extension,generatedAt:'2026-09-04T13:01:00.000Z',provider:noClaims});
assert.equal(positive.events.length,1);const e=positive.events[0];
assert.equal(e.family,'accrued-entitlement');assert.equal(e.route,'vlcvx-locker-platform-rewards');assert.equal(e.amount,1);assert.equal(e.usdValue,0.3);assert.equal(e.claimContinuityStatus,'no-intervening-claim-proven');assert.equal(e.currentClaimableBalanceIsPeriodIncome,false);assert.equal(e.claimIsSecondIncomeEvent,false);assert.equal(e.referenceAprUsed,false);assert.equal(e.executionAuthority,'none');

const claimed=await buildVlCvxPlatformAccrual({rewards:t(200,'2000000000000000000','2026-09-04T13:00:00.000Z'),marketData:market,previousExtension:baseline.extension,generatedAt:'2026-09-04T13:01:00.000Z',provider:withClaim});
assert.equal(claimed.events.length,0);assert.equal(claimed.extension.reconciliation.length,1);assert.equal(claimed.extension.reconciliation[0].reason,'positive-delta-with-intervening-claim-not-admitted');

const decrease=await buildVlCvxPlatformAccrual({rewards:t(200,'500000000000000000','2026-09-04T13:00:00.000Z'),marketData:market,previousExtension:baseline.extension,generatedAt:'2026-09-04T13:01:00.000Z',provider:noClaims});
assert.equal(decrease.events.length,0);assert.equal(decrease.extension.reconciliation[0].reason,'claimable-decrease-requires-reconciliation');

const unchanged=await buildVlCvxPlatformAccrual({rewards:t(200,'1000000000000000000','2026-09-04T13:00:00.000Z'),marketData:market,previousExtension:baseline.extension,generatedAt:'2026-09-04T13:01:00.000Z',provider:noClaims});
assert.equal(unchanged.events.length,0);assert.equal(unchanged.extension.diagnostics.unchangedCount,1);

const unvalued=await buildVlCvxPlatformAccrual({rewards:t(200,'2000000000000000000','2026-09-04T13:00:00.000Z'),marketData:{prices:{}},previousExtension:baseline.extension,generatedAt:'2026-09-04T13:01:00.000Z',provider:noClaims});
assert.equal(unvalued.events.length,1);assert.equal(unvalued.events[0].usdValue,null);assert.equal(unvalued.events[0].valuationStatus,'unvalued-canonical-price-unavailable');

console.log('vlCVX PLATFORM ACCOUNTING ADAPTER VALIDATION PASS',{version:VERSION,baselineBoundaries:baseline.extension.boundaries.length,positiveEvents:positive.events.length,claimReconciliation:claimed.extension.reconciliation.length,decreaseReconciliation:decrease.extension.reconciliation.length,executionAuthority:positive.extension.authority.executionAuthority});
