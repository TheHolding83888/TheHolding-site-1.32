#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { finalizeCandidate } from './income-ledger.mjs';
import { buildProjectXIncomeCandidates } from './projectx-income-candidates.mjs';

const source=JSON.parse(fs.readFileSync(process.env.PROJECTX_HISTORY_FILE||'./companies/company-010-projectx-rate-history.json','utf8'));
const out=buildProjectXIncomeCandidates(source,finalizeCandidate,'2026-09-06T00:00:00.000Z');

assert.equal(out.version,'0.1-projectx-factual-fee-income-candidates');
assert.ok(out.summary.observationCount>=10,'Project X factual history unexpectedly shrank');
assert.ok(out.summary.acceptedIntervalCount>=7,'Project X accepted factual intervals unexpectedly shrank');
assert.ok(out.summary.fingerprintBoundaryCount>=2,'Project X fingerprint reset boundaries disappeared');
assert.equal(out.summary.claimResetBoundaryCount,0,'Current Project X history contains unexpected claim/reset boundary');
assert.equal(out.summary.crossMonthBoundaryCount,0,'Current Project X history contains unexpected same-fingerprint cross-month boundary');
assert.ok(out.summary.candidateEventCount>=14,'Project X factual fee candidates unexpectedly shrank');
assert.equal(out.candidates.length,out.summary.candidateEventCount);
assert.equal(new Set(out.candidates.map(x=>x.eventKey)).size,out.candidates.length,'Project X candidate event identity collision');

for(const row of out.candidates){
  assert.equal(row.company,'Cypher');
  assert.equal(row.family,'accrued-entitlement');
  assert.equal(row.route,'projectx-whype-usdc');
  assert.equal(row.protocol,'Project X');
  assert.ok(['WHYPE','USDC'].includes(row.asset));
  assert.ok(Number(row.amount)>0);
  assert.ok(Number(row.usdValue)>0);
  assert.ok(Number(row.valuationUnitUsd)>0);
  assert.equal(row.valuationStatus,'frozen-at-interval-end-observed-token-price');
  assert.equal(row.sourceFile,'companies/company-010-projectx-rate-history.json');
  assert.equal(row.sourceFamily,'adjacent same-fingerprint collect.staticCall fee observations');
  assert.equal(row.evidenceStatus,'canonical-positive-collectible-fee-delta');
  assert.equal(row.openingBalanceCreatesIncome,false);
  assert.equal(row.claimOrResetIsSettlementBoundary,true);
  assert.equal(row.claimOrResetCreatesSecondIncome,false);
  assert.equal(row.crossMonthIntervalAutoAllocated,false);
  assert.equal(row.referenceAprUsed,false);
  assert.equal(row.unknownIsNotZero,true);
  assert.equal(row.executionAuthority,'none');
  assert.ok(/^[0-9a-f]{64}$/.test(row.immutableEconomicFieldsHash));
  assert.equal(String(row.periodStart).slice(0,7),String(row.periodEnd).slice(0,7),'Project X candidate crossed month boundary');
}

const byMonth=out.candidates.reduce((acc,row)=>{const m=String(row.economicDate).slice(0,7);acc[m]=(acc[m]||0)+Number(row.usdValue);return acc;},{});
assert.ok(Math.abs(Number(byMonth['2026-08'])-2.20091137)<1e-7,'Project X August factual historical subtotal drift');
assert.ok(Number(byMonth['2026-09'])>=0.52937216,'Project X September factual subtotal unexpectedly below proven history');

const base={
  version:'0.1-projectx-rate-history',
  engineVersion:'0.2-projectx-dynamic-active-set-observed-fee-reference-apr',
  company:{registry:'010',name:'Cypher'},
  methodology:{feeTierIsNotYield:true,resetRules:['strategy fingerprint changed','claimable token amount decreased materially (claim/reward reset)','insufficient stable window']},
  authority:{readOnly:true,walletSigning:false,transactions:false,executionAuthority:'none'}
};
const obs=(at,fingerprint,whype,usdc)=>({
  observedAt:at,stateGeneratedAt:at,fingerprint,
  strategy:{pair:'WHYPE-USDC',positions:[{tokenId:'1'}]},navUsd:100,
  fees:{WHYPE:whype,USDC:usdc},prices:{WHYPE:50,USDC:1},
  source:'fixture · collect.staticCall max uint128'
});

const reset=buildProjectXIncomeCandidates({...base,observations:[obs('2026-09-01T00:00:00Z','a',1,1),obs('2026-09-02T00:00:00Z','a',0.5,1.2)]},finalizeCandidate);
assert.equal(reset.candidates.length,0,'Claim/reset boundary fabricated Project X income');
assert.equal(reset.summary.claimResetBoundaryCount,1);

const fingerprint=buildProjectXIncomeCandidates({...base,observations:[obs('2026-09-01T00:00:00Z','a',1,1),obs('2026-09-02T00:00:00Z','b',2,2)]},finalizeCandidate);
assert.equal(fingerprint.candidates.length,0,'Fingerprint change fabricated Project X income');
assert.equal(fingerprint.summary.fingerprintBoundaryCount,1);

const crossMonth=buildProjectXIncomeCandidates({...base,observations:[obs('2026-08-31T23:00:00Z','a',1,1),obs('2026-09-01T01:00:00Z','a',2,2)]},finalizeCandidate);
assert.equal(crossMonth.candidates.length,0,'Cross-month Project X interval was auto-allocated');
assert.equal(crossMonth.summary.crossMonthBoundaryCount,1);

assert.throws(()=>buildProjectXIncomeCandidates({...base,authority:{...base.authority,walletSigning:true},observations:[obs('2026-09-01T00:00:00Z','a',1,1),obs('2026-09-02T00:00:00Z','a',2,2)]},finalizeCandidate),/authority expansion/);

console.log('Project X factual fee candidate validation PASS',{
  observations:out.summary.observationCount,
  candidates:out.summary.candidateEventCount,
  augustUsd:Number(byMonth['2026-08'].toFixed(8)),
  septemberUsd:Number(byMonth['2026-09'].toFixed(8)),
  openingBalanceCreatesIncome:false,
  resetCreatesIncome:false,
  crossMonthAutoAllocation:false,
  referenceAprUsed:false,
  executionAuthority:'none'
});
