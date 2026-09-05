#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import { VERSION, COMPANY, REGISTRY, MARKETS, validateEvidenceOutput } from './yield-basis-lp-accounting-evidence.mjs';

const FILE=process.env.YIELD_BASIS_LP_EVIDENCE_FILE||'./reporting/yield-basis-lp-accounting-evidence.json';

function synthetic(){
  const observedAt='2026-09-05T10:00:00.000Z';
  return{
    version:VERSION,
    generatedAt:observedAt,
    status:'ok',
    purpose:'synthetic validation fixture',
    source:{chain:'Ethereum',blockNumber:24000000,observedAt,rpcHost:'synthetic'},
    semantics:{factualTrackingProofIsNotPeriodIncome:true,openingBalanceCreatesIncome:false,referenceAprUsed:false,currentPpsIsNotPeriodIncome:true,unknownIsNotZero:true},
    authority:{readOnly:true,executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
    checkpoints:Object.entries(MARKETS).map(([engineId,m])=>({ok:true,engineId,company:COMPANY,registry:REGISTRY,chain:'Ethereum',protocol:'Yield Basis',market:m.market,family:m.family,lt:m.lt,blockNumber:24000000,observedAt,source:'ethereum-json-rpc',sourceMethod:'LT.pricePerShare() + LT.balanceOf(company wallet) at one block',rpcHost:'synthetic',pricePerShareRaw:'0x0de0b6b3a7640000',holders:[{wallet:'0x7ec6331188468269dc7c1cf6a84c972632178b1e',balanceRaw:'0x01'}],positiveHolderCount:1,factualTrackingProof:true,periodIncomeAuthority:false,openingBalanceCreatesIncome:false,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none',checkpointKey:`yield-basis-lp:${engineId}:24000000`}))
  };
}

const fixture=synthetic();
assert.equal(validateEvidenceOutput(fixture),true);

const noHolding=structuredClone(fixture);
noHolding.checkpoints[0].holders[0].balanceRaw='0x00';
assert.throws(()=>validateEvidenceOutput(noHolding),/holder proof invalid/,'zero company holding gained tracking authority');

const incomeLeak=structuredClone(fixture);
incomeLeak.checkpoints[0].periodIncomeAuthority=true;
assert.throws(()=>validateEvidenceOutput(incomeLeak),/tracking boundary invalid/,'current PPS gained period-income authority');

const wrongLt=structuredClone(fixture);
wrongLt.checkpoints[0].lt='0x0000000000000000000000000000000000000001';
assert.throws(()=>validateEvidenceOutput(wrongLt),/identity mismatch/,'wrong Yield Basis LT gained tracking authority');

if(fs.existsSync(FILE)){
  const data=JSON.parse(fs.readFileSync(FILE,'utf8'));
  assert.equal(validateEvidenceOutput(data),true);
  assert.equal(data.checkpoints.length,2,'tracked Yield Basis LP evidence must cover WBTC and WETH together');
  assert.deepEqual(new Set(data.checkpoints.map(x=>x.engineId)),new Set(Object.keys(MARKETS)));
}

console.log('Yield Basis LP factual tracking evidence validation OK.');
