#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  VERSION,MECHANISM,DISTRIBUTOR,FULL_ACCOUNTING_START,
  reconcileEntitlement,trackedWalletsFromRewards,priceIndexFromRewards
} from './yield-basis-accounting-evidence.mjs';

assert.equal(VERSION,'0.1-yield-basis-factual-accrual-evidence');
assert.equal(MECHANISM,'yield-basis-fees');
assert.equal(DISTRIBUTOR,'0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90');
assert.equal(FULL_ACCOUNTING_START,'2026-09-01T00:00:00.000Z');

// Pure cumulative entitlement increase.
assert.deepEqual(reconcileEntitlement('100','150','0'),{
  status:'positive-factual-accrual',accepted:true,earnedRaw:'50'
});

// Opening entitlement is settled, then one new unit accrues. Claim is settlement,
// not a second income event.
assert.deepEqual(reconcileEntitlement('100','10','100'),{
  status:'positive-factual-accrual',accepted:true,earnedRaw:'10'
});

// Claim-to-zero of the opening balance creates no new income.
assert.deepEqual(reconcileEntitlement('100','0','100'),{
  status:'zero-new-earned',accepted:true,earnedRaw:'0'
});

// Partial settlement plus remaining state can still be exactly zero new earning.
assert.deepEqual(reconcileEntitlement('100','20','80'),{
  status:'zero-new-earned',accepted:true,earnedRaw:'0'
});
assert.equal(reconcileEntitlement('100','10','50').accepted,false);
assert.equal(reconcileEntitlement('100','10','50').status,'negative-reconciliation-required');

// Reuse canonical Rewards wallet scoping. A measured zero-claimable wallet must
// stay tracked through source.walletResults even when no reward row exists.
const rewards={generatedAt:'2026-09-03T06:00:00.000Z',companies:{
  'Example.eth':{
    sources:[{route:'yield-basis-fees',status:'ok',details:{walletResults:[
      {wallet:'0x0000000000000000000000000000000000000001',walletAlias:'Primary',status:'ok',rewardCount:0},
      {wallet:'0x0000000000000000000000000000000000000002',walletAlias:'Secondary',status:'ok',rewardCount:1}
    ]}}],
    rewards:[{
      route:'yield-basis-fees',token:'0x0000000000000000000000000000000000000011',symbol:'yb-WBTC',
      priceUsd:74250.5,priceMethod:'redemption-value:WBTC@canonical',
      details:{wallet:'0x0000000000000000000000000000000000000002',walletAlias:'Secondary'}
    }]
  }
}};
const wallets=trackedWalletsFromRewards(rewards);
assert.equal(wallets.length,2);
assert.equal(wallets.some(x=>x.walletAlias==='Primary'),true);
assert.equal(wallets.some(x=>x.walletAlias==='Secondary'),true);

const prices=priceIndexFromRewards(rewards);
const p=prices.get('Example.eth','0x0000000000000000000000000000000000000002','0x0000000000000000000000000000000000000011');
assert.equal(p.unitUsd,74250.5);
assert.equal(p.priceMethod,'redemption-value:WBTC@canonical');

console.log('Yield Basis factual accrual evidence validation OK',{
  version:VERSION,
  feeDistributor:DISTRIBUTOR,
  formula:'closing preview_claim + Claim settlements - opening preview_claim, token by token',
  openingBalanceCreatesIncome:false,
  claimIsSettlementNotSecondIncome:true,
  claimToZeroHandled:true,
  zeroWalletStatePreserved:true,
  referenceAprUsed:false,
  unknownIsNotZero:true
});
