#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { admitProjectXIntoLedgerState } from './projectx-ledger-admission.mjs';

const history=JSON.parse(fs.readFileSync(process.env.PROJECTX_HISTORY_FILE||'./companies/company-010-projectx-rate-history.json','utf8'));
const generatedAt='2026-09-06T00:00:00.000Z';
const baseLedger={version:'0.1-canonical-income-ledger',events:[]};

const first=admitProjectXIntoLedgerState({ledger:baseLedger,history,generatedAt});
assert.ok(first.candidateEventCount>=14,'Project X candidate admission unexpectedly shrank');
assert.equal(first.newEventsAdmitted,first.candidateEventCount);
assert.equal(first.ledger.events.length,first.candidateEventCount);
for(const row of first.ledger.events){
  assert.equal(row.company,'Cypher');
  assert.equal(row.family,'accrued-entitlement');
  assert.equal(row.route,'projectx-whype-usdc');
  assert.equal(row.executionAuthority,'none');
  assert.ok(/^[0-9a-f]{64}$/.test(row.immutableEconomicFieldsHash));
}

const second=admitProjectXIntoLedgerState({ledger:first.ledger,history,generatedAt:'2026-09-06T01:00:00.000Z'});
assert.equal(second.newEventsAdmitted,0,'Project X duplicate admission was not idempotent');
assert.equal(second.ledger.events.length,first.ledger.events.length);
for(let i=0;i<first.ledger.events.length;i++)assert.equal(second.ledger.events[i].immutableEconomicFieldsHash,first.ledger.events[i].immutableEconomicFieldsHash);

const changed=structuredClone(history);
changed.observations[1].prices.WHYPE=Number(changed.observations[1].prices.WHYPE)+1;
assert.throws(()=>admitProjectXIntoLedgerState({ledger:first.ledger,history:changed,generatedAt}),/mutation detected/,'Project X historical economic mutation did not fail closed');

const authority=structuredClone(history);
authority.authority.walletSigning=true;
assert.throws(()=>admitProjectXIntoLedgerState({ledger:baseLedger,history:authority,generatedAt}),/authority expansion/);
assert.throws(()=>admitProjectXIntoLedgerState({ledger:{version:'wrong',events:[]},history,generatedAt}),/version mismatch/);

const august=first.ledger.events.filter(x=>String(x.economicDate).startsWith('2026-08')).reduce((s,x)=>s+Number(x.usdValue),0);
const september=first.ledger.events.filter(x=>String(x.economicDate).startsWith('2026-09')).reduce((s,x)=>s+Number(x.usdValue),0);
assert.ok(Math.abs(august-2.20091137)<1e-7,'Project X admitted August subtotal drift');
assert.ok(september>=0.52937216,'Project X admitted September subtotal below proven history');

console.log('Project X Canonical Ledger admission validation PASS',{
  candidateEvents:first.candidateEventCount,
  augustUsd:Number(august.toFixed(8)),
  septemberUsd:Number(september.toFixed(8)),
  duplicateAdmissionIdempotent:true,
  mutationFailsClosed:true,
  referenceAprUsed:false,
  executionAuthority:'none'
});
