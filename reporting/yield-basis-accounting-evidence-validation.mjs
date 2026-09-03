#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Contract, JsonRpcProvider } from 'ethers';
import {
  VERSION,MECHANISM,DISTRIBUTOR,FULL_ACCOUNTING_START,
  reconcileEntitlement,trackedWalletsFromRewards,priceIndexFromRewards,blockAtOrBefore
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

// A recent accounting boundary must be located from the recent chain tip rather
// than by probing from genesis. This protects public RPCs from unnecessary
// archive reads while preserving the exact at-or-before block contract.
const requested=[];
const fakeProvider={
  async getBlock(number){
    requested.push(Number(number));
    return{number:Number(number),timestamp:Number(number)*12};
  }
};
const targetBlock=99_000,latestBlock=100_000;
const boundary=await blockAtOrBefore(fakeProvider,new Date(targetBlock*12*1000).toISOString(),latestBlock,new Map());
assert.equal(boundary.blockNumber,targetBlock);
assert.ok(Math.min(...requested)>95_000,`recent boundary search regressed into deep archive reads: ${Math.min(...requested)}`);
assert.ok(requested.length<40,`recent boundary search used too many block reads: ${requested.length}`);

console.log('Yield Basis factual accrual evidence validation OK',{
  version:VERSION,
  feeDistributor:DISTRIBUTOR,
  formula:'closing preview_claim + Claim settlements - opening preview_claim, token by token',
  openingBalanceCreatesIncome:false,
  claimIsSettlementNotSecondIncome:true,
  claimToZeroHandled:true,
  zeroWalletStatePreserved:true,
  recentBoundarySearch:true,
  boundaryLookupReads:requested.length,
  oldestBoundaryProbe:Math.min(...requested),
  referenceAprUsed:false,
  unknownIsNotZero:true
});

// TEMPORARY diagnostic: never fails validation. It pinpoints which historical
// FeeDistributor/VE getter rejects the Sep-1 block so the production fallback
// can be corrected without weakening factual accounting assertions.
try{
  const rpc=new JsonRpcProvider('https://eth.drpc.org',1);
  const blockTag=25878704;
  const wallet='0x6c6543eBa07946706Fd10A1064fA773326B5f5A9';
  const fd=new Contract(DISTRIBUTOR,[
    'function INITIAL_EPOCH() view returns (uint256)',
    'function VE() view returns (address)',
    'function last_claimed_for(address) view returns (uint256)',
    'function initial_set_for_epoch(uint256) view returns (uint256)',
    'function max_set_for_epoch(uint256) view returns (uint256)',
    'function token_sets(uint256,uint256) view returns (address)',
    'function balances_for_epoch(uint256,address) view returns (uint256)',
    'function claimed_epoch_for(address,address) view returns (uint256)'
  ],rpc);
  const probe=async(name,fn)=>{try{const v=await fn();console.log('YB_STORAGE_DIAG PASS',name,String(v));return v;}catch(error){console.log('YB_STORAGE_DIAG FAIL',name,error?.shortMessage||error?.message||String(error));return null;}};
  const initial=await probe('INITIAL_EPOCH',()=>fd.INITIAL_EPOCH({blockTag}));
  const veAddress=await probe('VE',()=>fd.VE({blockTag}));
  const last=await probe('last_claimed_for',()=>fd.last_claimed_for(wallet,{blockTag}));
  if(initial!==null&&last!==null){
    const epoch=Number(last)===0?Number(initial):Number(last)+7*86400;
    const initialSet=await probe(`initial_set_for_epoch:${epoch}`,()=>fd.initial_set_for_epoch(epoch,{blockTag}));
    const maxSet=await probe(`max_set_for_epoch:${epoch}`,()=>fd.max_set_for_epoch(epoch,{blockTag}));
    if(initialSet!==null&&Number(initialSet)>0){
      const token=await probe(`token_sets:${initialSet}:0`,()=>fd.token_sets(initialSet,0,{blockTag}));
      if(token){
        await probe(`claimed_epoch_for:${token}`,()=>fd.claimed_epoch_for(wallet,token,{blockTag}));
        await probe(`balances_for_epoch:${epoch}:${token}`,()=>fd.balances_for_epoch(epoch,token,{blockTag}));
      }
    }
    if(veAddress){
      const ve=new Contract(veAddress,[
        'function getPastVotes(address,uint256) view returns (uint256)',
        'function getPastTotalSupply(uint256) view returns (uint256)'
      ],rpc);
      await probe(`VE.getPastVotes:${epoch}`,()=>ve.getPastVotes(wallet,epoch,{blockTag}));
      await probe(`VE.getPastTotalSupply:${epoch}`,()=>ve.getPastTotalSupply(epoch,{blockTag}));
    }
    if(maxSet!==null)console.log('YB_STORAGE_DIAG RANGE',{epoch,initialSet:String(initialSet),maxSet:String(maxSet)});
  }
}catch(error){
  console.log('YB_STORAGE_DIAG OUTER_FAIL',error?.shortMessage||error?.message||String(error));
}
