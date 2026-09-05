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
    semantics:{factualTrackingProofIsNotPeriodIncome:true,openingBalanceCreatesIncome:false,referenceAprUsed:false,currentPpsIsNotPeriodIncome:true,custodyLocationDoesNotCreateIncome:true,unknownIsNotZero:true},
    authority:{readOnly:true,executionAuthority:'none',walletAuthority:'none',claimingAuthority:'none',capitalExecution:false,methodologyMutationAuthority:'none'},
    checkpoints:Object.entries(MARKETS).map(([engineId,m])=>({ok:true,engineId,company:COMPANY,registry:REGISTRY,chain:'Ethereum',protocol:'Yield Basis',market:m.market,family:m.family,lt:m.lt,gauge:m.gauge,blockNumber:24000000,observedAt,source:'ethereum-json-rpc',sourceMethod:'custody-aware synthetic',rpcHost:'synthetic',pricePerShareRaw:'0x0de0b6b3a7640000',holdings:[{wallet:'0x7ec6331188468269dc7c1cf6a84c972632178b1e',directLtBalanceRaw:'0x00',gaugeShareBalanceRaw:'0x01'}],holders:[{wallet:'0x7ec6331188468269dc7c1cf6a84c972632178b1e',balanceRaw:'0x01',custodyPath:'gauge'}],positiveDirectLtHolderCount:0,positiveGaugeHolderCount:1,activeHoldingPath:'gauge',factualTrackingProof:true,periodIncomeAuthority:false,openingBalanceCreatesIncome:false,referenceAprUsed:false,unknownIsNotZero:true,executionAuthority:'none',checkpointKey:`yield-basis-lp:${engineId}:24000000`}))
  };
}

const fixture=synthetic();
assert.equal(validateEvidenceOutput(fixture),true);

const directFixture=structuredClone(fixture);
directFixture.checkpoints[0].holdings[0].directLtBalanceRaw='0x01';
directFixture.checkpoints[0].holdings[0].gaugeShareBalanceRaw='0x00';
directFixture.checkpoints[0].holders[0].balanceRaw='0x01';
directFixture.checkpoints[0].holders[0].custodyPath='direct-lt';
directFixture.checkpoints[0].positiveDirectLtHolderCount=1;
directFixture.checkpoints[0].positiveGaugeHolderCount=0;
directFixture.checkpoints[0].activeHoldingPath='direct-lt';
assert.equal(validateEvidenceOutput(directFixture),true,'direct LT custody stopped proving tracking');

const noHolding=structuredClone(fixture);
noHolding.checkpoints[0].holdings[0].gaugeShareBalanceRaw='0x00';
noHolding.checkpoints[0].holders[0].balanceRaw='0x00';
assert.throws(()=>validateEvidenceOutput(noHolding),/custody-aware holding proof invalid/,'zero company holding gained tracking authority');

const incomeLeak=structuredClone(fixture);
incomeLeak.checkpoints[0].periodIncomeAuthority=true;
assert.throws(()=>validateEvidenceOutput(incomeLeak),/tracking boundary invalid/,'current PPS gained period-income authority');

const wrongGauge=structuredClone(fixture);
wrongGauge.checkpoints[0].gauge='0x0000000000000000000000000000000000000001';
assert.throws(()=>validateEvidenceOutput(wrongGauge),/identity mismatch/,'wrong Yield Basis gauge gained tracking authority');

if(fs.existsSync(FILE)){
  const data=JSON.parse(fs.readFileSync(FILE,'utf8'));
  assert.equal(validateEvidenceOutput(data),true);
  assert.equal(data.checkpoints.length,2,'tracked Yield Basis LP evidence must cover WBTC and WETH together');
  assert.deepEqual(new Set(data.checkpoints.map(x=>x.engineId)),new Set(Object.keys(MARKETS)));
  assert.ok(data.checkpoints.every(x=>['direct-lt','gauge','mixed'].includes(x.activeHoldingPath)),'real evidence lost explicit custody path');
}

console.log('Yield Basis LP custody-aware factual tracking evidence validation OK.');
