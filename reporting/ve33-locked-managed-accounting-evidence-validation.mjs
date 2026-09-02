#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { LOCKED_MANAGED_VERSION, trackedLockedManagedDescriptors, decodeWithdrawManagedTokenId } from './ve33-locked-managed-accounting-evidence.mjs';

assert.equal(LOCKED_MANAGED_VERSION,'0.1-ve33-locked-managed-factual-accrual');

const synthetic={
  generatedAt:'2026-09-02T12:00:00.000Z',
  companies:{
    Alpha:{
      sources:[],
      rewards:[{
        protocol:'Aerodrome',route:'aerodrome-relay',classification:'compounded-locked',
        token:'0x940181a94A35A4569E4529A3CDfB74e38FD98631',decimals:18,priceUsd:0.9,
        details:{wallet:'0x5555555555555555555555555555555555555555',walletAlias:'Alpha',symbol:'AERO',veNfts:[{tokenId:'7',managedTokenId:'70',lockedManagedReward:'0x7777777777777777777777777777777777777777'}]}
      }]
    },
    Beta:{
      sources:[{
        protocol:'Velodrome',route:'velodrome-ve-direct',
        details:{walletResults:[{wallet:'0x6666666666666666666666666666666666666666',walletAlias:'Beta',details:{positions:[{tokenId:'8',mode:'managed',managedTokenId:'80',lockedManagedReward:'0x8888888888888888888888888888888888888888'}]}}]}
      }],
      rewards:[]
    }
  }
};
const lanes=trackedLockedManagedDescriptors(synthetic);
assert.equal(lanes.length,2);
const aero=lanes.find(x=>x.company==='Alpha');
assert.equal(aero.protocolKey,'aerodrome');
assert.equal(aero.tokenId,'7');
assert.equal(aero.managedTokenId,'70');
assert.equal(aero.lockedManagedReward,'0x7777777777777777777777777777777777777777');
const velo=lanes.find(x=>x.company==='Beta');
assert.equal(velo.protocolKey,'velodrome');
assert.equal(velo.tokenId,'8');
assert.equal(velo.managedTokenId,'80');

const votingEscrow='0x9999999999999999999999999999999999999999';
const iface=new Interface(['function withdrawManaged(uint256 tokenId)']);
const data=iface.encodeFunctionData('withdrawManaged',[123]);
assert.equal(decodeWithdrawManagedTokenId({to:votingEscrow,data,votingEscrow}),'123');
assert.equal(decodeWithdrawManagedTokenId({to:'0x1111111111111111111111111111111111111111',data,votingEscrow}),null);
assert.equal(decodeWithdrawManagedTokenId({to:votingEscrow,data:'0x',votingEscrow}),null);

console.log('ve(3,3) LockedManagedReward accounting evidence validation OK');
