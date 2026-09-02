#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSource, beefyCandidates } from './income-ledger-company-009-beefy.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const source=read('companies/company-009-beefy-cvxcrv-income.json');
const ledger=read('reporting/income-ledger.json');
const checkpoints=validateSource(source);
const built=beefyCandidates(source,'2026-09-02T00:00:00.000Z');

assert.ok(checkpoints.length>=2,'Beefy factual checkpoint history missing');
assert.ok(built.events.length>0,'Beefy source has no positive factual embedded-income intervals');
assert.equal(built.events.every(e=>e.company==='1milliondollar.eth'),true);
assert.equal(built.events.every(e=>e.family==='embedded-income'),true);
assert.equal(built.events.every(e=>e.route==='beefy-cvxcrv'&&e.protocol==='Beefy'),true);
assert.equal(built.events.every(e=>e.referenceAprUsed===false),true,'Reference APR must never enter Beefy earned-income evidence');
assert.equal(built.events.every(e=>Number(e.amount)>0&&Number(e.usdValue)>0),true);
assert.equal(built.events.every(e=>e.valuationStatus==='frozen-at-interval-end-cvxcrv-price'),true);
assert.equal(new Set(built.events.map(e=>e.eventKey)).size,built.events.length,'Beefy event identities must be unique');

const sourceShares=new Set(checkpoints.map(c=>c.sharesRaw));
assert.equal(sourceShares.size,1,'Current Beefy history changed share balance and requires reconciliation');
for(let i=1;i<checkpoints.length;i++){
  assert.ok(Number(checkpoints[i].ppfs)>=Number(checkpoints[i-1].ppfs),'Current Beefy PPFS decreased; loss accounting lane required before admission');
}

assert.equal(ledger.version,'0.1-canonical-income-ledger');
assert.equal(ledger.semantics?.referenceAprCanBackfillEarnedIncome,false);
assert.equal(ledger.authority?.executionAuthority,'none');
const state=ledger.sourceState?.company009BeefyEmbeddedIncome;
assert.ok(state,'Beefy canonical source state missing from Income Ledger');
assert.equal(state.file,'companies/company-009-beefy-cvxcrv-income.json');
assert.equal(state.version,source.version);
assert.equal(state.generatedAt,source.generatedAt);
assert.equal(state.referenceAprUsed,false);
assert.equal(state.checkpointCount,checkpoints.length);
assert.equal(state.candidateIntervalCount,built.events.length);

const expectedKeys=new Set(built.events.map(e=>e.eventKey));
const admitted=(ledger.events||[]).filter(e=>expectedKeys.has(e.eventKey));
assert.equal(admitted.length,built.events.length,'Every factual Beefy interval must be admitted exactly once');
for(const event of admitted){
  const expected=built.events.find(e=>e.eventKey===event.eventKey);
  assert.equal(event.immutableEconomicFieldsHash,expected.immutableEconomicFieldsHash,`Beefy immutable economics drift ${event.eventKey}`);
  assert.equal(event.executionAuthority,'none');
}

const company=ledger.companies?.['1milliondollar.eth'];
assert.ok(company,'Company #009 missing from Canonical Income Ledger');
assert.equal(company.coverage?.overallComplete,false,'Beefy partial history must not falsely complete Company #009 accounting');
assert.equal(company.coverage?.embeddedIncome,'partial-mechanism-specific-beefy-cvxcrv');
assert.equal(company.eventCountsByFamily?.embeddedIncome>=built.events.length,true);
const august=company.monthly?.['2026-08'];
assert.ok(august,'Company #009 August embedded-income evidence missing');
assert.equal(august.families?.embeddedIncome?.eventCount>0,true);
assert.equal(august.families?.embeddedIncome?.usdComplete,true);
assert.ok(Number(august.families.embeddedIncome.usd)>0,'Company #009 August factual embedded income must be positive');
assert.equal(august.combinedIncomeUsd,null,'Evidence families must remain unreconciled until full coverage');
assert.equal(august.crossFamilySumAllowed,false);

const extension=ledger.accountingExtensions?.company009BeefyEmbeddedIncome;
assert.ok(extension,'Company #009 Beefy accounting extension metadata missing');
assert.equal(extension.referenceAprUsed,false);
assert.equal(extension.laterPriceMovementRewritesIncome,false);
assert.equal(extension.crossMonthIntervalsAutoAllocated,false);
assert.equal(extension.executionAuthority,'none');

const script=fs.readFileSync(path.join(ROOT,'reporting/income-ledger-company-009-beefy.mjs'),'utf8');
for(const forbidden of ['referenceApr *','referenceApr/','modeledDaily','sendTransaction(','new Wallet(','executionAuthority: write']){
  assert.equal(script.includes(forbidden),false,`Company #009 Beefy accounting authority/model leak: ${forbidden}`);
}

console.log('Company #009 Beefy canonical embedded-income validation PASS',{
  checkpoints:checkpoints.length,
  factualIntervals:built.events.length,
  zeroIncomeIntervals:built.zeroIntervals,
  augustEmbeddedIncomeUsd:august.families.embeddedIncome.usd,
  overallCompanyCoverageComplete:false,
  referenceAprUsed:false,
  unknownIsNotZero:true
});
