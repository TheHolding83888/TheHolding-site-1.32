#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  VERSION,validatePolicy,economicHashPayload,finalizeCandidate,admitEvents,
  defiteaCandidates,embeddedCandidates,realisedCandidates,rewardStateRows,
  continuityFor,eventMonth,familySummary,buildMonthly
} from './income-ledger.mjs';
import crypto from 'node:crypto';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const stableStringify=value=>{
  if(value===null||typeof value!=='object') return JSON.stringify(value);
  if(Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
};
const hash=v=>crypto.createHash('sha256').update(stableStringify(v)).digest('hex');

const policy=validatePolicy(read('reporting/income-ledger-policy.json'));
const defitea=read('reporting/defitea-income-ledger.json');
const embedded=read('companies/embedded-yield-ledger.json');
const rewards=read('companies/rewards-data.json');
const realised=read('intelligence/realised-cash-flow/realised-cash-flow.json');
const at='2026-08-27T17:00:00.000Z';

assert.equal(VERSION,'0.1-canonical-income-ledger');
assert.equal(policy.rules.currentClaimableBalanceIsStateNotPeriodIncome,true);
assert.equal(policy.rules.claimableDecreaseDoesNotProveRealisedCashFlow,true);
assert.equal(policy.rules.claimableIncreaseWithoutMechanismIdentityDoesNotProvePeriodIncome,true);
assert.equal(policy.rules.missingClaimableRouteDoesNotMeanZero,true);
assert.equal(policy.rules.crossFamilySummationForbidden,true);
assert.equal(policy.rules.referenceAprCanNeverBackfillEarnedIncome,true);
assert.equal(policy.authority.executionAuthority,'none');

const dc=defiteaCandidates(defitea,at);
const ec=embeddedCandidates(embedded,at);
const rc=realisedCandidates(realised,at);
const all=[...dc,...ec,...rc];
assert.equal(new Set(all.map(x=>x.eventKey)).size,all.length,'candidate event keys must be unique');
for(const e of all){
  assert.equal(e.immutableEconomicFieldsHash,hash(economicHashPayload(e)),`immutable event hash drift ${e.eventKey}`);
  assert.equal(e.laterStateChangeDoesNotEraseIncome,true);
  assert.equal(e.executionAuthority,'none');
}

const sourceVote=(defitea.voteMarketEvents||[]).filter(e=>e?.eventKey&&Number(e?.usdValue)>0).length;
const source40=(defitea.fortyAcresReceivedEvents||[]).filter(e=>e?.eventKey&&Number(e?.usdValue)>0).length;
assert.equal(dc.filter(e=>e.family==='accrued-entitlement').length,sourceVote,'VoteMarket canonical entitlement admission parity');
assert.equal(dc.filter(e=>e.family==='realised-cash-flow').length,source40,'40 Acres canonical received admission parity');

let acceptedEmbedded=0;
for(const p of Object.values(embedded.positions||{})) acceptedEmbedded+=(p.intervalHistory||[]).filter(e=>e?.status==='ok'&&e?.accepted===true).length;
assert.equal(ec.length,acceptedEmbedded,'Monetra accepted canonical Embedded Yield interval parity');
assert.equal(ec.every(e=>e.family==='embedded-income'&&Number.isFinite(Number(e.usdValue))),true);
assert.equal(ec.every(e=>e.periodAttributionStatus==='single-month'||e.periodAttributionStatus==='cross-month-boundary-unallocated'),true);

let acceptedRealised=0;
for(const c of Object.values(realised.companies||{})) acceptedRealised+=(c?.ledger?.rows||[]).filter(r=>r?.classification==='realised-income'&&r?.countedAsRealisedCashFlow===true).length;
assert.equal(rc.length,acceptedRealised,'mechanism-specific Realised Cash Flow admission parity');
assert.equal(rc.every(e=>e.family==='realised-cash-flow'&&e.physicalEventId),true);

const admitted=admitEvents([],all);
assert.equal(admitted.admitted,all.length);
assert.equal(admitted.events.length,all.length);
const retained=admitEvents(admitted.events,[]);
assert.equal(retained.admitted,0,'source disappearance must not fabricate a new event');
assert.equal(retained.events.length,admitted.events.length,'source disappearance/claim must not erase historical income');

if(all.length){
  const victim=structuredClone(all[0]);
  victim.usdValue=Number(victim.usdValue||0)+1;
  victim.immutableEconomicFieldsHash=hash(economicHashPayload(victim));
  assert.throws(()=>admitEvents(admitted.events,[victim]),/economic mutation detected/,'same event identity must not mutate economics');
}

const base=finalizeCandidate({
  eventKey:'synthetic:realised:1',company:'Synthetic.eth',family:'realised-cash-flow',economicDate:'2026-08-27',
  periodStart:'2026-08-27',periodEnd:'2026-08-27',route:'adapter-a',protocol:'Synthetic',asset:'USDC',amount:1,usdValue:1,
  physicalEventId:'1:0x1111111111111111111111111111111111111111111111111111111111111111:0',sourceIdentity:'a'
},at);
const collision=finalizeCandidate({...base,eventKey:'synthetic:realised:2',route:'adapter-b',sourceIdentity:'b'},at);
assert.throws(()=>admitEvents([base],[collision]),/Cross-source realised cash-flow collision/,'same physical receipt must not be double counted by two realised adapters');

const previous={rows:[{routeKey:'route-a',amount:10,usdValue:10},{routeKey:'route-b',amount:2,usdValue:2}]};
const current={rows:[{routeKey:'route-a',amount:4,usdValue:4},{routeKey:'route-c',amount:1,usdValue:1}]};
const continuity=continuityFor(previous,current,policy);
assert.equal(continuity.find(x=>x.routeKey==='route-a').state,'reconciliation-needed-not-realised-proof');
assert.equal(continuity.find(x=>x.routeKey==='route-a').realisedCashFlowAuthority,false);
assert.equal(continuity.find(x=>x.routeKey==='route-b').state,'route-missing-reconciliation-needed-not-zero');
assert.equal(continuity.find(x=>x.routeKey==='route-b').unknownIsNotZero,true);
assert.equal(continuity.find(x=>x.routeKey==='route-c').state,'new-route-baseline');
assert.equal(continuity.every(x=>x.periodIncomeAuthority===false),true);

for(const [company,c] of Object.entries(rewards.companies||{})){
  const rows=rewardStateRows(c);
  assert.equal(new Set(rows.map(x=>x.routeKey)).size,rows.length,`${company}: claimable route state keys must be unique`);
  assert.equal(rows.every(x=>x.unknownIsNotZero===true&&x.periodIncomeAuthority===false&&x.realisedCashFlowAuthority===false),true);
}

const shardAggregate=rewardStateRows({rewards:[
  {route:'same-route',protocol:'Synthetic',chain:'Base',symbol:'TOKEN',wallet:'0xabc',classification:'unclaimed',amount:1.25,usdValue:2.5,source:'shard-a'},
  {route:'same-route',protocol:'Synthetic',chain:'Base',symbol:'TOKEN',wallet:'0xabc',classification:'unclaimed',amount:2.75,usdValue:5.5,source:'shard-b'}
]});
assert.equal(shardAggregate.length,1,'same-mechanism claimable shards must aggregate into one state row');
assert.equal(shardAggregate[0].shardCount,2);
assert.equal(shardAggregate[0].amount,4);
assert.equal(shardAggregate[0].usdValue,8);
assert.equal(shardAggregate[0].amountComplete,true);
assert.equal(shardAggregate[0].usdValueComplete,true);
assert.equal(shardAggregate[0].periodIncomeAuthority,false);
assert.equal(shardAggregate[0].realisedCashFlowAuthority,false);

const incompleteShardAggregate=rewardStateRows({rewards:[
  {route:'partial-route',protocol:'Synthetic',chain:'Base',symbol:'TOKEN',wallet:'0xdef',classification:'unclaimed',amount:1,usdValue:2,source:'known-shard'},
  {route:'partial-route',protocol:'Synthetic',chain:'Base',symbol:'TOKEN',wallet:'0xdef',classification:'unclaimed',amount:null,usdValue:null,source:'unknown-shard'}
]});
assert.equal(incompleteShardAggregate.length,1);
assert.equal(incompleteShardAggregate[0].amount,null,'unknown shard amount must not be treated as zero');
assert.equal(incompleteShardAggregate[0].usdValue,null,'unknown shard USD must not be treated as zero');
assert.equal(incompleteShardAggregate[0].amountComplete,false);
assert.equal(incompleteShardAggregate[0].usdValueComplete,false);
assert.equal(incompleteShardAggregate[0].unknownIsNotZero,true);

const cross=finalizeCandidate({
  eventKey:'synthetic:embedded:cross-month',company:'Synthetic.eth',family:'embedded-income',periodStart:'2026-08-31T23:00:00Z',periodEnd:'2026-09-01T01:00:00Z',economicDate:'2026-09-01',route:'p',protocol:'P',asset:'USDC',usdValue:1,stablePriceEffectUsd:0
},at);
assert.equal(eventMonth(cross),null,'cross-month interval must not be silently assigned to one month');
const monthly=buildMonthly([...all,cross],'Synthetic.eth');
assert.equal(Object.keys(monthly).length,0,'unallocated cross-month interval must remain outside monthly income totals');

const family=familySummary([
  finalizeCandidate({eventKey:'u1',company:'S',family:'realised-cash-flow',economicDate:'2026-08-01',usdValue:1},at),
  finalizeCandidate({eventKey:'u2',company:'S',family:'realised-cash-flow',economicDate:'2026-08-02',usdValue:null},at)
]);
assert.equal(family.usdComplete,false);
assert.equal(family.usd,null,'partial USD valuation must not masquerade as a complete family total');
assert.equal(family.valuedUsdSubtotal,1);

const source=fs.readFileSync(path.join(ROOT,'reporting/income-ledger.mjs'),'utf8');
for(const forbidden of ['sendTransaction(','new Wallet(','claimTransactionAuthority: true','executionAuthority: write']) assert.equal(source.includes(forbidden),false,`income ledger authority expansion: ${forbidden}`);
assert.equal(source.includes('referenceAprCanBackfillEarnedIncome:false'),true,'explicit reference APR non-backfill semantic missing');
assert.equal(source.includes('claimableShardRule:'),true,'claimable shard aggregation semantic missing');

console.log('Canonical Income Ledger validation PASS',{
  defiteaEntitlementEvents:sourceVote,
  defiteaReceivedEvents:source40,
  monetraAcceptedEmbeddedIntervals:acceptedEmbedded,
  mechanismSpecificRealisedEvents:acceptedRealised,
  candidateEvents:all.length,
  claimableCompanies:Object.keys(rewards.companies||{}).length,
  sameMechanismShardAggregation:true,
  incompleteShardUnknownPreserved:true,
  claimableDecreaseRealisedAuthority:false,
  crossFamilySummation:false,
  unknownIsNotZero:true
});
