#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import { resupplyRsupObservationProofs } from './accounting-coverage.mjs';

const REWARDS_FILE=process.env.REWARDS_DATA_FILE||'./companies/rewards-data.json';
const WALLET='0x78bf5af472d5f6014b641ed70de01862c05da8c3';
const TOKEN='0x0000000000000000000000000000000000000001';

function fixture({rewardCount=0,rows=[]}={}){
  return{
    generatedAt:'2026-09-05T10:00:00.000Z',
    companies:{
      'defitea.eth':{
        updatedAt:'2026-09-05T10:00:00.000Z',
        sources:[{
          protocol:'Resupply · staked RSUP',route:'resupply-staking',status:'ok',chain:'Ethereum',
          metric:'GovStaker dynamic reward tokens + earned(account,token)',
          details:{walletResults:[{wallet:WALLET,walletAlias:'defitea.eth',status:'ok',rewardCount,note:null,details:null}]}
        }],
        rewards:rows
      }
    }
  };
}

const zero=fixture();
const zeroProofs=resupplyRsupObservationProofs(zero);
assert.equal(zeroProofs.length,1,'complete zero-reward Resupply observation must prove tracking');
assert.equal(zeroProofs[0].engineId,'resupply_rsup');
assert.equal(zeroProofs[0].company,'defitea.eth');

const positiveRow={protocol:'Resupply · staked RSUP',route:'resupply-staking',chain:'Ethereum',token:TOKEN,amount:1.25,classification:'unclaimed',source:'onchain: GovStaker.earned(account,rewardToken)',details:{wallet:WALLET}};
assert.equal(resupplyRsupObservationProofs(fixture({rewardCount:1,rows:[positiveRow]})).length,1,'valid positive Resupply reward stopped proving tracking');

const countMismatch=fixture({rewardCount:0,rows:[positiveRow]});
assert.equal(resupplyRsupObservationProofs(countMismatch).length,0,'reward-count mismatch gained factual tracking authority');

const badStatus=fixture();badStatus.companies['defitea.eth'].sources[0].status='partial';
assert.equal(resupplyRsupObservationProofs(badStatus).length,0,'partial source gained factual tracking authority');

const badMetric=fixture();badMetric.companies['defitea.eth'].sources[0].metric='Reference APR';
assert.equal(resupplyRsupObservationProofs(badMetric).length,0,'non-factual metric gained tracking authority');

if(fs.existsSync(REWARDS_FILE)){
  const rewards=JSON.parse(fs.readFileSync(REWARDS_FILE,'utf8'));
  const proofs=resupplyRsupObservationProofs(rewards);
  assert.ok(proofs.some(x=>x.company==='defitea.eth'&&x.engineId==='resupply_rsup'),'production-shaped rewards snapshot does not contain a strong Defitea Resupply tracking proof');
}

console.log('Resupply factual tracking proof validation PASS.');
