#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import { liquityLqtyObservationProofs } from './accounting-coverage.mjs';

const REWARDS_FILE=process.env.REWARDS_DATA_FILE||'./companies/rewards-data.json';
const WALLET='0x78bf5af472d5f6014b641ed70de01862c05da8c3';
const PROXY='0x1111111111111111111111111111111111111111';
const GOVERNANCE='0x807DEf5E7d057DF05C796F4bc75C3Fe82Bd6EeE1';
const STAKING='0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d';
const LUSD='0x5f98805A4E8be255a32880FDeC7F6728C6568bA0';
const SOURCE='onchain: Liquity V1 LQTYStaking pending gain across wallet + V2 UserProxy';

function fixture({ethRaw='0',lusdRaw='0',rows=[]}={}){
  return{
    generatedAt:'2026-09-05T12:00:00.000Z',
    companies:{
      'defitea.eth':{
        updatedAt:'2026-09-05T12:00:00.000Z',
        sources:[{
          protocol:'Liquity',
          route:'liquity-staking',
          status:'ok',
          chain:'Ethereum',
          metric:'LQTYStaking pending ETH + LUSD across direct wallet and Liquity V2 UserProxy',
          details:{
            governance:GOVERNANCE,
            stakingV1:STAKING,
            primaryUserProxy:PROXY,
            primaryUserProxyStakedLqty:10,
            rewardAccounts:[
              {wallet:WALLET,account:WALLET,accountKind:'direct-v1',stakedLqty:null,pendingEthRaw:'0',pendingLusdRaw:'0'},
              {wallet:WALLET,account:PROXY,accountKind:'liquity-v2-userproxy',stakedLqty:10,pendingEthRaw:ethRaw,pendingLusdRaw:lusdRaw}
            ],
            issues:[],
            unknownIsNotZero:true,
            rewardState:'Claimable'
          }
        }],
        rewards:rows
      }
    }
  };
}

function row(token,amount){
  return{
    protocol:'Liquity',route:'liquity-staking',chain:'Ethereum',token,amount,
    classification:'unclaimed',source:SOURCE,
    details:{userProxy:PROXY,unknownIsNotZero:true,rewardState:'Claimable'}
  };
}

const zero=fixture();
const zeroProofs=liquityLqtyObservationProofs(zero);
assert.equal(zeroProofs.length,1,'complete zero-reward Liquity observation must prove tracking');
assert.equal(zeroProofs[0].engineId,'liquity_lqty');
assert.equal(zeroProofs[0].company,'defitea.eth');

const eth=fixture({ethRaw:'1000000000000000000',rows:[row('native:ETH',1)]});
assert.equal(liquityLqtyObservationProofs(eth).length,1,'valid positive ETH Liquity observation stopped proving tracking');

const both=fixture({ethRaw:'1000000000000000000',lusdRaw:'2000000000000000000',rows:[row('native:ETH',1),row(LUSD,2)]});
assert.equal(liquityLqtyObservationProofs(both).length,1,'valid ETH+LUSD Liquity observation stopped proving tracking');

const partial=fixture();partial.companies['defitea.eth'].sources[0].status='partial';
assert.equal(liquityLqtyObservationProofs(partial).length,0,'partial Liquity source gained factual tracking authority');

const wrongMetric=fixture();wrongMetric.companies['defitea.eth'].sources[0].metric='Reference APR';
assert.equal(liquityLqtyObservationProofs(wrongMetric).length,0,'non-factual Liquity metric gained tracking authority');

const unknownZero=fixture();unknownZero.companies['defitea.eth'].sources[0].details.unknownIsNotZero=false;
assert.equal(liquityLqtyObservationProofs(unknownZero).length,0,'Liquity proof survived unknown-is-not-zero drift');

const noStake=fixture();noStake.companies['defitea.eth'].sources[0].details.primaryUserProxyStakedLqty=0;
assert.equal(liquityLqtyObservationProofs(noStake).length,0,'unstaked Liquity proxy gained tracking authority');

const badRead=fixture();badRead.companies['defitea.eth'].sources[0].details.rewardAccounts[1].readError='rpc failed';
assert.equal(liquityLqtyObservationProofs(badRead).length,0,'failed Liquity account read gained tracking authority');

const badRaw=fixture();badRaw.companies['defitea.eth'].sources[0].details.rewardAccounts[1].pendingEthRaw='unknown';
assert.equal(liquityLqtyObservationProofs(badRaw).length,0,'invalid Liquity raw reward state gained tracking authority');

const missingPositive=fixture({ethRaw:'1',rows:[]});
assert.equal(liquityLqtyObservationProofs(missingPositive).length,0,'positive Liquity onchain state without matching reward row gained tracking authority');

const fabricatedPositive=fixture({rows:[row('native:ETH',1)]});
assert.equal(liquityLqtyObservationProofs(fabricatedPositive).length,0,'fabricated Liquity positive row gained tracking authority');

if(fs.existsSync(REWARDS_FILE)){
  const rewards=JSON.parse(fs.readFileSync(REWARDS_FILE,'utf8'));
  const proofs=liquityLqtyObservationProofs(rewards);
  assert.ok(proofs.some(x=>x.company==='defitea.eth'&&x.engineId==='liquity_lqty'),'live canonical Liquity observation does not satisfy factual tracking proof');
}

console.log('Liquity LQTY factual tracking validation PASS',{zeroRewardTracking:true,positiveRewardTracking:true,unknownIsNotZero:true,periodIncomeAuthority:false,executionAuthority:'none'});
