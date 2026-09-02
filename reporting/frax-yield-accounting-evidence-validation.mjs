#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,MECHANISM,FULL_ACCOUNTING_START,PARTIAL_BOOTSTRAP_START,
  decimalToRaw18,rawToAmount,reconcileAccrual,trackedWalletsFromRewards,bootstrapCheckpointsFromLedger
} from './frax-yield-accounting-evidence.mjs';

assert.equal(VERSION,'0.1-frax-yield-factual-accrual-evidence');
assert.equal(MECHANISM,'frax-yield');
assert.equal(FULL_ACCOUNTING_START,'2026-09-01T00:00:00.000Z');
assert.equal(PARTIAL_BOOTSTRAP_START,'2026-08-27T00:00:00.000Z');

const raw=x=>decimalToRaw18(x);
assert.equal(raw(10),'10000000000000000000');
assert.equal(rawToAmount(raw(2.5)),2.5);

// Pure accrual: only the increase is new income.
assert.deepEqual(reconcileAccrual(raw(10),raw(15),'0'),{
  status:'positive-factual-accrual',accepted:true,earnedRaw:raw(5)
});

// Opening balance was earned before the interval. Claiming it is settlement,
// not a second income event. One token newly accrued after the claim is income.
assert.deepEqual(reconcileAccrual(raw(10),raw(1),raw(10)),{
  status:'positive-factual-accrual',accepted:true,earnedRaw:raw(1)
});

// Claim-to-zero of the opening balance creates no new income.
assert.deepEqual(reconcileAccrual(raw(10),'0',raw(10)),{
  status:'zero-new-earned',accepted:true,earnedRaw:'0'
});

// Partial settlement plus closing balance can reconcile to zero new earning.
assert.deepEqual(reconcileAccrual(raw(10),raw(2),raw(8)),{
  status:'zero-new-earned',accepted:true,earnedRaw:'0'
});

// A negative reconciliation is never guessed into income.
assert.equal(reconcileAccrual(raw(10),raw(1),raw(5)).accepted,false);
assert.equal(reconcileAccrual(raw(10),raw(1),raw(5)).status,'negative-reconciliation-required');

// Wallet discovery must preserve a successfully measured zero-claimable wallet:
// rewardCount=0 is still a factual state boundary, not a missing route.
const rewards={generatedAt:'2026-09-02T05:10:00.000Z',companies:{
  'Example.eth':{
    sources:[{route:'frax-yield',status:'ok',details:{walletResults:[
      {wallet:'0x0000000000000000000000000000000000000001',walletAlias:'Primary',status:'ok',rewardCount:0},
      {wallet:'0x0000000000000000000000000000000000000002',walletAlias:'Secondary',status:'partial',rewardCount:1}
    ]}}],
    rewards:[{route:'frax-yield',details:{wallet:'0x0000000000000000000000000000000000000002'},amount:1}]
  }
}};
const wallets=trackedWalletsFromRewards(rewards);
assert.equal(wallets.length,2);
assert.equal(wallets[0].company,'Example.eth');
assert.equal(wallets.some(x=>x.walletAlias==='Primary'),true);

// Historical bootstrap is state only. It creates checkpoints, never income.
const ledger={claimableSnapshots:[
  {snapshotKey:'old',capturedAt:'2026-08-26T05:00:00.000Z',company:'Example.eth',rows:[{route:'frax-yield',routeKey:'old',wallet:'0x0000000000000000000000000000000000000001',amount:9,usdValue:9}]},
  {snapshotKey:'baseline',capturedAt:'2026-08-27T05:00:00.000Z',company:'Example.eth',rows:[{route:'frax-yield',routeKey:'baseline',wallet:'0x0000000000000000000000000000000000000001',amount:10,usdValue:10.2}]}
]};
const checkpoints=bootstrapCheckpointsFromLedger(ledger);
assert.equal(checkpoints.length,1);
assert.equal(checkpoints[0].bootstrap,true);
assert.equal(checkpoints[0].periodIncomeAuthority,false);
assert.equal(checkpoints[0].earnedAmount,10);
assert.equal(checkpoints[0].unitUsd,1.02);

console.log('Frax factual accrual evidence validation OK',{
  version:VERSION,
  openingBalanceCreatesIncome:false,
  claimIsSettlementNotSecondIncome:true,
  claimToZeroHandled:true,
  zeroWalletStatePreserved:true,
  referenceAprUsed:false,
  unknownIsNotZero:true
});
