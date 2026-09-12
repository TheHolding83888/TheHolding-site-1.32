#!/usr/bin/env node
import assert from 'node:assert/strict';
import { Interface } from 'ethers';
import { CLAIM_REWARDS_TOPIC, indexedAddressTopic } from './ve33-transient-claim-recovery.mjs';
import { VERSION, recoveryRpcUrls, safeRpcError, createRpcOperationRouter, runRecoveryWriter } from './ve33-transient-claim-recovery-writer.mjs';

assert.equal(VERSION,'0.2-ve33-transient-claim-recovery-writer');
const cfg={protocol:'Test',chainId:1,rpcEnv:'TEST_RPC_URL',rpcFallbacks:['https://fallback-one.example','https://fallback-two.example']};
assert.deepEqual(recoveryRpcUrls(cfg,{TEST_RPC_URL:'https://configured.example'}),[
  'https://configured.example','https://fallback-two.example','https://fallback-one.example'
]);
assert.equal(safeRpcError(new Error('failed at https://secret-rpc.example/private-key-123')), 'failed at [rpc]');

const providers={
  'https://configured.example':{
    async getTransaction(){throw new Error('Archive requests require a personal token');},destroy(){}
  },
  'https://fallback-two.example':{
    async getTransaction(hash){return{hash,to:'0x1111111111111111111111111111111111111111',data:'0x'};},destroy(){}
  },
  'https://fallback-one.example':{async getTransaction(){throw new Error('should not be reached');},destroy(){}}
};
const failover=createRpcOperationRouter({
  cfg,env:{TEST_RPC_URL:'https://configured.example'},requestSpacingMs:0,
  providerFactory:url=>providers[url]
});
const tx=await failover.getTransaction('0x'+'12'.repeat(32));
assert.ok(tx);
const failoverStats=failover.snapshot();
assert.equal(failoverStats.preferredProvider,'fallback-two.example');
assert.equal(failoverStats.failoverCount,1);
assert.equal(failoverStats.failures['configured.example'],1);
assert.equal(failoverStats.successes['fallback-two.example'],1);
failover.destroy();

const splitProviders={
  'https://configured.example':{
    async getLogs(filter){
      const from=Number(filter.fromBlock),to=Number(filter.toBlock);
      if(to-from+1>600)throw new Error('query exceeds max block range at https://configured.example/private-key');
      return [{blockNumber:from,transactionHash:'0x'+'ab'.repeat(32),index:from,address:'0x1111111111111111111111111111111111111111'}];
    },destroy(){}
  },
  'https://fallback-two.example':{
    async getLogs(){throw new Error('historical range unavailable');},destroy(){}
  },
  'https://fallback-one.example':{
    async getLogs(){throw new Error('historical range unavailable');},destroy(){}
  }
};
const adaptive=createRpcOperationRouter({
  cfg,env:{TEST_RPC_URL:'https://configured.example'},requestSpacingMs:0,minLogSplitBlocks:64,maxLogSplitDepth:6,
  providerFactory:url=>splitProviders[url]
});
const splitLogs=await adaptive.getLogs({fromBlock:1000,toBlock:1999,topics:[CLAIM_REWARDS_TOPIC]});
assert.equal(splitLogs.length,2);
assert.deepEqual(splitLogs.map(x=>x.blockNumber),[1000,1500]);
const splitStats=adaptive.snapshot();
assert.equal(splitStats.adaptiveSplitCount,1);
assert.equal(splitStats.maxAdaptiveSplitDepth,1);
assert.ok(splitStats.failureSamples.length>=3);
assert.ok(splitStats.failureSamples.every(x=>!String(x.error).includes('private-key')));
assert.ok(splitStats.splitSamples.every(x=>!String(x.error).includes('private-key')));
adaptive.destroy();

const holder='0x58603461149Fc2A800a56d421e77DcbBA2D83CA8';
const voter='0x16613524e02ad97eDfeF371bC883F2F5d6C480A5';
const rewardContract='0x7591A0D4a21170a8bB3C02Bf89F13D7757AeBADe';
const rewardToken='0xB095274743941e953c746F9C228DA9c18Bb6ec29';
const txHash='0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153';
const amountRaw=67615020175015840449n;
const rewards={
  companies:{
    '0x5860...83CA8.eth':{
      sources:[{route:'aerodrome-ve',details:{walletResults:[{wallet:holder,walletAlias:'acceptance',status:'ok',details:{positions:[{tokenId:'1938',mode:'direct',currentVotedPools:[],recentVotedPools:[],matchedRewardPools:[]}]}}]}}],
      rewards:[]
    }
  },internalState:{directVeRewardIndex:{}}
};
const claimIface=new Interface(['event ClaimRewards(address indexed from,address indexed reward,uint256 amount)']);
const encoded=claimIface.encodeEventLog(claimIface.getEvent('ClaimRewards'),[holder,rewardToken,amountRaw]);
const voterIface=new Interface(['function claimBribes(address[] bribes,address[][] tokens,uint256 tokenId)']);
const data=voterIface.encodeFunctionData('claimBribes',[[rewardContract],[[rewardToken]],1938]);
let queries=0;
const mockRouter={
  async getBlockNumber(){return 20000;},
  async getLogs(filter){
    queries++;
    assert.equal(filter.topics[0],CLAIM_REWARDS_TOPIC);
    assert.ok(filter.topics[1].includes(indexedAddressTopic(holder)));
    if(Number(filter.fromBlock)<=18000&&Number(filter.toBlock)>=18000)return[{address:rewardContract,topics:encoded.topics,data:encoded.data,blockNumber:18000,transactionHash:txHash,index:28}];
    return[];
  },
  async getTransaction(hash){assert.equal(hash,txHash);return{to:voter,data};},
  snapshot(){return{preferredProvider:'mock-archive',attempts:queries,failoverCount:0,adaptiveSplitCount:0};}
};
const output=await runRecoveryWriter({
  rewards,previousEvidence:{checkpoints:[],events:[]},previousState:{},generatedAt:'2026-09-12T00:00:00.000Z',
  providerRouters:{aerodrome:mockRouter},accountingStartBlocks:{aerodrome:10000},protocolKeys:['aerodrome']
});
assert.equal(output.version,'0.1-ve33-transient-claim-recovery');
assert.equal(output.status,'discovery-complete');
assert.equal(output.writer.version,VERSION);
assert.equal(output.writer.executionAuthority,'none');
assert.equal(output.semantics.createsIncome,false);
assert.equal(output.semantics.createsRealisedCashFlow,false);
assert.equal(output.protocols.aerodrome.lastScannedBlock,20000);
assert.equal(output.protocols.aerodrome.claims.length,1);
const claim=output.protocols.aerodrome.claims[0];
assert.equal(claim.transactionHash,txHash);
assert.equal(claim.tokenId,'1938');
assert.equal(claim.rewardContract.toLowerCase(),rewardContract.toLowerCase());
assert.equal(claim.rewardToken.toLowerCase(),rewardToken.toLowerCase());
assert.equal(claim.amountRaw,amountRaw.toString());
assert.equal(claim.classification,'transient-orphan-claim');
assert.equal(claim.decodePath,'voter-claimBribes');
assert.equal(claim.accountingAuthority,false);
assert.equal(claim.executionAuthority,'none');

console.log('ve33 transient ClaimRewards recovery writer validation OK',{
  operationFailover:true,adaptiveHistoricalLogSplit:true,redactedRpcDiagnostics:true,
  overlapCursor:true,exactLaptopAcceptanceShape:true,createsIncome:false,executionAuthority:'none'
});
