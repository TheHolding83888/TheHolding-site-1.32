#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import {
  VERSION,CLAIM_REWARDS_TOPIC,RECOVERY_SEMANTICS,indexedAddressTopic,claimProofKey,recoveryLaneKey,recoveryScanStart,
  directTrackedPositions,mergeRecoveryClaims,attachClaimBlockTimestamps,addRecoveryShadowRows,discoverProtocolTransientClaims,buildRecoveryState
} from './ve33-transient-claim-recovery.mjs';

assert.equal(VERSION,'0.1-ve33-transient-claim-recovery');
assert.equal(RECOVERY_SEMANTICS.discoveryOnly,true);
assert.equal(RECOVERY_SEMANTICS.createsIncome,false);
assert.equal(RECOVERY_SEMANTICS.createsRealisedCashFlow,false);
assert.equal(RECOVERY_SEMANTICS.claimIsSettlementNotSecondIncome,true);
assert.equal(RECOVERY_SEMANTICS.unknownIsNotZero,true);
assert.equal(RECOVERY_SEMANTICS.executionAuthority,'none');

const holder='0x58603461149Fc2A800a56d421e77DcbBA2D83CA8';
const voter='0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';
const rewardContract='0x7591A0D4a21170a8bB3C02Bf89F13D7757AeBADe';
const rewardToken='0xB095274743941e953c746F9C228DA9c18Bb6ec29';
const txHash='0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153';
const amountRaw=67615020175015840449n;
const blockTimestamp='2026-09-10T00:26:40.000Z';

assert.equal(indexedAddressTopic(holder),'0x00000000000000000000000058603461149fc2a800a56d421e77dcbba2d83ca8');
assert.equal(claimProofKey({transactionHash:txHash,logIndex:28}),`${txHash}:28`);
assert.equal(recoveryScanStart({accountingStartBlock:10000,lastScannedBlock:null,overlapBlocks:4096}),10000);
assert.equal(recoveryScanStart({accountingStartBlock:10000,lastScannedBlock:20000,overlapBlocks:4096}),15904);
assert.equal(recoveryScanStart({accountingStartBlock:10000,lastScannedBlock:11000,overlapBlocks:4096}),10000);

const rewards={
  companies:{
    '0x5860...83CA8.eth':{
      sources:[{
        route:'aerodrome-ve',
        details:{walletResults:[{wallet:holder,walletAlias:'0x5860...83CA8.eth',status:'ok',details:{positions:[{
          tokenId:'1938',mode:'direct',currentVotedPools:[],recentVotedPools:[],matchedRewardPools:[]
        }]}}]}
      }],
      rewards:[]
    }
  },
  internalState:{directVeRewardIndex:{}}
};
const positions=directTrackedPositions(rewards,'aerodrome');
assert.equal(positions.length,1);
assert.equal(positions[0].tokenId,'1938');
assert.equal(positions[0].holder.toLowerCase(),holder.toLowerCase());

const claimIface=new Interface(['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)']);
assert.equal(claimIface.getEvent('ClaimRewards').topicHash,CLAIM_REWARDS_TOPIC);
const encodedLog=claimIface.encodeEventLog(claimIface.getEvent('ClaimRewards'),[holder,rewardToken,amountRaw]);
const voterIface=new Interface(['function claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)']);
const txData=voterIface.encodeFunctionData('claimBribes',[[rewardContract],[[rewardToken]],1938]);
let logQueries=0,txQueries=0,blockQueries=0;
const provider={
  async getBlockNumber(){return 20000;},
  async getLogs(filter){
    logQueries++;
    assert.equal(filter.topics[0],CLAIM_REWARDS_TOPIC);
    assert.ok(Array.isArray(filter.topics[1]));
    assert.ok(filter.topics[1].includes(indexedAddressTopic(holder)));
    if(Number(filter.fromBlock)<=18000&&Number(filter.toBlock)>=18000){
      return[{address:rewardContract,topics:encodedLog.topics,data:encodedLog.data,blockNumber:18000,transactionHash:txHash,index:28}];
    }
    return[];
  },
  async getTransaction(hash){txQueries++;assert.equal(hash,txHash);return{to:voter,data:txData};},
  async getBlock(blockNumber){blockQueries++;assert.equal(Number(blockNumber),18000);return{number:18000,timestamp:1789000000};}
};

const discovered=await discoverProtocolTransientClaims({
  rewards,previous:{checkpoints:[],events:[]},recoveryState:{protocols:{}},protocolKey:'aerodrome',provider,
  accountingStartBlock:10000,latestBlockNumber:20000,scanChunkBlocks:5000,scanOverlapBlocks:4096
});
assert.equal(discovered.status,'complete');
assert.equal(discovered.claims.length,1);
assert.equal(discovered.unresolved.length,0);
assert.ok(logQueries>=2);
assert.equal(txQueries,1);
assert.equal(blockQueries,1);
const claim=discovered.claims[0];
assert.equal(claim.classification,'transient-orphan-claim');
assert.equal(claim.company,'0x5860...83CA8.eth');
assert.equal(claim.route,'aerodrome-ve');
assert.equal(claim.tokenId,'1938');
assert.equal(claim.rewardContract.toLowerCase(),rewardContract.toLowerCase());
assert.equal(claim.rewardToken.toLowerCase(),rewardToken.toLowerCase());
assert.equal(claim.amountRaw,amountRaw.toString());
assert.equal(claim.blockTimestamp,blockTimestamp);
assert.equal(claim.decodePath,'voter-claimBribes');
assert.equal(claim.accountingAuthority,false);
assert.equal(claim.periodIncomeAuthority,false);
assert.equal(claim.executionAuthority,'none');
assert.equal(claim.laneKey,recoveryLaneKey({protocolKey:'aerodrome',company:'0x5860...83CA8.eth',holder,tokenId:'1938',rewardContract,rewardToken}));

const timestampBackfill=await attachClaimBlockTimestamps([{...claim,blockTimestamp:null}],provider);
assert.equal(timestampBackfill.unresolved.length,0);
assert.equal(timestampBackfill.claims[0].blockTimestamp,blockTimestamp);

const priceResolver=({token,boundaryAt})=>{
  assert.equal(String(token).toLowerCase(),rewardToken.toLowerCase());
  assert.equal(boundaryAt,blockTimestamp);
  return{
    ok:true,status:'historical-canonical-rewards-token-price',sourceFamily:'canonical-rewards-git-history',
    assetId:rewardToken.toLowerCase(),tokenAddress:rewardToken.toLowerCase(),symbol:'LAPTOP',priceUsd:1.03125,
    observedAt:'2026-09-09T09:00:00.000Z',ageMinutes:926.666667,maxAgeMinutes:50400,
    priceMethod:'canonical-rewards-observation',commitSha:'abc123',sourceFile:'companies/rewards-data.json',
    policyVersion:'0.1-month-bounded-committed-rewards-fallback',exactTokenAddressMatch:true,symbolMatchingUsed:false,
    currentPriceUsed:false,referenceAprUsed:false,executionAuthority:'none'
  };
};
const shadow=addRecoveryShadowRows(rewards,discovered.claims,{priceResolver});
assert.equal(shadow.inserted,1);
assert.equal(shadow.priced,1);
assert.equal(shadow.unpriced,0);
const row=shadow.rewards.companies['0x5860...83CA8.eth'].rewards[0];
assert.equal(row.status,'historical-claim-recovery-shadow');
assert.equal(row.amount,null);
assert.equal(row.usdValue,null);
assert.equal(row.priceUsd,1.03125);
assert.equal(row.priceMethod,'historical-canonical-rewards-token-price');
assert.equal(row.priceObservedAt,'2026-09-09T09:00:00.000Z');
assert.equal(row.accountingAuthority,false);
assert.equal(row.periodIncomeAuthority,false);
assert.equal(row.realisedCashFlowAuthority,false);
assert.equal(row.details.historicalClaimRecovery,true);
assert.equal(row.details.tokenId,'1938');
assert.equal(row.details.rewardContract.toLowerCase(),rewardContract.toLowerCase());
assert.equal(row.details.claimBlockTimestamp,blockTimestamp);
assert.equal(row.details.historicalPriceRecovery.ok,true);
assert.equal(row.details.historicalPriceRecovery.sourceFamily,'canonical-rewards-git-history');
assert.equal(row.details.historicalPriceRecovery.sourceCommit,'abc123');
assert.equal(row.details.historicalPriceRecovery.exactTokenAddressMatch,true);
assert.equal(row.details.historicalPriceRecovery.symbolMatchingUsed,false);
assert.equal(row.details.historicalPriceRecovery.currentPriceUsed,false);
assert.equal(row.details.historicalPriceRecovery.referenceAprUsed,false);
assert.equal(row.details.historicalPriceRecovery.executionAuthority,'none');

const failClosedShadow=addRecoveryShadowRows(rewards,discovered.claims,{priceResolver:()=>({ok:false,status:'not-found'})});
const failClosedRow=failClosedShadow.rewards.companies['0x5860...83CA8.eth'].rewards[0];
assert.equal(failClosedShadow.priced,0);
assert.equal(failClosedShadow.unpriced,1);
assert.equal(failClosedRow.priceUsd,null);
assert.equal(failClosedRow.priceMethod,null);
assert.equal(failClosedRow.periodIncomeAuthority,false);
assert.equal(failClosedRow.details.historicalPriceRecovery.ok,false);

const duplicate=mergeRecoveryClaims(discovered.claims,[{...claim,blockNumber:18000}]);
assert.equal(duplicate.length,1);
const state=buildRecoveryState({protocolResults:{aerodrome:discovered},generatedAt:'2026-09-12T00:00:00.000Z'});
assert.equal(state.status,'discovery-complete');
assert.equal(state.protocols.aerodrome.lastScannedBlock,20000);
assert.equal(state.protocols.aerodrome.claims.length,1);
assert.equal(state.protocols.aerodrome.claims[0].blockTimestamp,blockTimestamp);
assert.equal(state.semantics.createsIncome,false);
assert.equal(state.authority.executionAuthority,'none');

const alreadyRepresented=await discoverProtocolTransientClaims({
  rewards,
  previous:{checkpoints:[{protocolKey:'aerodrome',company:'0x5860...83CA8.eth',holder,tokenId:'1938',kind:'voting-reward',rewardContract,rewardToken}],events:[{settlementProofs:[{transactionHash:txHash,logIndex:28}]}]},
  recoveryState:{protocols:{aerodrome:{lastScannedBlock:20000,claims:[]}}},protocolKey:'aerodrome',provider,
  accountingStartBlock:10000,latestBlockNumber:20000,scanChunkBlocks:5000,scanOverlapBlocks:4096
});
assert.equal(alreadyRepresented.claims.length,1);
assert.equal(alreadyRepresented.claims[0].classification,'already-represented');
assert.equal(alreadyRepresented.claims[0].alreadyRepresented,true);
assert.equal(alreadyRepresented.claims[0].knownHistoricalLane,true);
assert.equal(alreadyRepresented.claims[0].blockTimestamp,blockTimestamp);

console.log('ve33 transient ClaimRewards recovery foundation validation OK',{
  exactAcceptanceShape:{company:claim.company,tokenId:claim.tokenId,rewardContract:claim.rewardContract,rewardToken:claim.rewardToken,amountRaw:claim.amountRaw,blockTimestamp:claim.blockTimestamp,priceUsd:row.priceUsd},
  overlapScan:true,deduplicated:true,historicalPriceByExactToken:true,symbolMatchingUsed:false,createsIncome:false,executionAuthority:'none'
});
