#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { VERSION, PROTOCOLS, reconcileEntitlement, decodeRewardClaimTokenId, trackedPositionDescriptors } from './ve33-accounting-evidence.mjs';

assert.equal(VERSION,'0.1-ve33-factual-accrual-evidence');
assert.equal(PROTOCOLS.aerodrome.chainId,8453);
assert.equal(PROTOCOLS.velodrome.chainId,10);

assert.deepEqual(reconcileEntitlement('100','100','0'),{accepted:true,status:'zero-new-earned',earnedRaw:'0'});
assert.deepEqual(reconcileEntitlement('100','125','0'),{accepted:true,status:'positive-factual-accrual',earnedRaw:'25'});
assert.deepEqual(reconcileEntitlement('100','5','120'),{accepted:true,status:'positive-factual-accrual',earnedRaw:'25'});
assert.equal(reconcileEntitlement('100','5','10').accepted,false);
assert.equal(reconcileEntitlement('oops','5','10').accepted,false);

const reward='0x1111111111111111111111111111111111111111';
const token='0x2222222222222222222222222222222222222222';
const voter='0x3333333333333333333333333333333333333333';
const other='0x4444444444444444444444444444444444444444';
const directIface=new Interface(['function getReward(uint256 tokenId,address[] tokens)']);
const voterIface=new Interface([
  'function claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)',
  'function claimFees(address[] fees,address[][] tokens,uint256 tokenId)'
]);
const directData=directIface.encodeFunctionData('getReward',[77,[token]]);
assert.equal(decodeRewardClaimTokenId({to:reward,data:directData,rewardContract:reward,rewardToken:token,voter}),'77');
assert.equal(decodeRewardClaimTokenId({to:reward,data:directData,rewardContract:reward,rewardToken:other,voter}),null);
const bribeData=voterIface.encodeFunctionData('claimBribes',[[other,reward],[[other],[token]],88]);
assert.equal(decodeRewardClaimTokenId({to:voter,data:bribeData,rewardContract:reward,rewardToken:token,voter}),'88');
const feeData=voterIface.encodeFunctionData('claimFees',[[reward],[[token]],99]);
assert.equal(decodeRewardClaimTokenId({to:voter,data:feeData,rewardContract:reward,rewardToken:token,voter}),'99');
assert.equal(decodeRewardClaimTokenId({to:other,data:'0x',rewardContract:reward,rewardToken:token,voter}),null);

const synthetic={
  companies:{
    Alpha:{
      sources:[{
        route:'aerodrome-ve',
        details:{walletResults:[{wallet:'0x5555555555555555555555555555555555555555',walletAlias:'Alpha',status:'ok',details:{positions:[{tokenId:'7',mode:'direct'}]}}]}
      }],
      rewards:[]
    },
    Beta:{
      sources:[{
        route:'velodrome-ve-direct',
        details:{walletResults:[{wallet:'0x6666666666666666666666666666666666666666',walletAlias:'Beta',status:'ok',details:{positions:[{tokenId:'8',mode:'managed',managedTokenId:'80',freeManagedReward:'0x7777777777777777777777777777777777777777'}]}}]}
      }],
      rewards:[]
    }
  },
  internalState:{directVeRewardIndex:{
    'base:7':{contracts:[{rewardAddress:'0x8888888888888888888888888888888888888888'}]}
  }}
};
const positions=trackedPositionDescriptors(synthetic);
assert.equal(positions.length,2);
const aero=positions.find(x=>x.company==='Alpha');
assert.equal(aero.protocolKey,'aerodrome');
assert.deepEqual(aero.rewardContracts,['0x8888888888888888888888888888888888888888']);
const velo=positions.find(x=>x.company==='Beta');
assert.equal(velo.protocolKey,'velodrome');
assert.equal(velo.freeManagedReward,'0x7777777777777777777777777777777777777777');

console.log('ve(3,3) factual accounting evidence validation OK');
