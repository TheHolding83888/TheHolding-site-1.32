#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildAccountingCoverage, explicitSettlementMechanismLinks } from './accounting-coverage.mjs';

const TX=`0x${'a'.repeat(64)}`;
const strongEvent={
  eventKey:`defitea-received:40acres:${TX}:7`,
  company:'defitea.eth',
  family:'realised-cash-flow',
  economicDate:'2026-09-03',
  periodStart:'2026-09-03',
  periodEnd:'2026-09-03',
  route:'forty-acres-velodrome-received',
  protocol:'40 Acres · veVELO',
  asset:'USDC',
  amount:1,
  usdValue:1,
  physicalEventId:`10:${TX}:7`,
  sourceFile:'reporting/defitea-income-ledger.json',
  sourceFamily:'fortyAcresReceivedEvents',
  sourceIdentity:`40acres:${TX}:7`,
  evidenceStatus:'canonical-actual-net-received',
  retention:'indefinite',
  laterStateChangeDoesNotEraseIncome:true,
  executionAuthority:'none',
  immutableEconomicFieldsHash:'b'.repeat(64)
};
const productivity={
  generatedAt:'2026-09-03T00:00:00.000Z',
  engines:{velodrome_vevelo:{protocol:'Velodrome'}},
  companies:{'defitea.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'velodrome_vevelo',value:100,engineStatus:'ok'}]}}
};
const ledger=event=>({
  generatedAt:'2026-09-03T00:00:00.000Z',
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  events:event?[event]:[],
  companies:{'defitea.eth':{currentClaimableState:{rows:[]}}}
});
const build=event=>buildAccountingCoverage({productivity,ledger:ledger(event),embedded:{},generatedAt:'2026-09-03T00:00:00.000Z'});

const mechanismRows=[{company:'defitea.eth',mechanism:{engineId:'velodrome_vevelo',accountingFamily:'accrued-entitlement',mechanismType:'governance-rewards',classified:true,accountingRouteHints:['velodrome','vevelo','forty-acres']}}];
const links=explicitSettlementMechanismLinks([strongEvent],mechanismRows);
assert.equal(links.length,1,'canonical 40 Acres Received settlement was not explicitly linked');
assert.equal(links[0].engineId,'velodrome_vevelo');
assert.equal(links[0].periodIncomeAuthority,false);
assert.equal(links[0].factualTrackingAuthority,false);
assert.equal(links[0].incomeFamilyPreserved,true);

const output=build(strongEvent);
assert.equal(output.summary.unmatchedCanonicalEventCount,0,'explicitly linked settlement remained unmatched');
assert.equal(output.summary.settlementLinkedCanonicalEventCount,1,'settlement link summary drift');
assert.equal(output.settlementMechanismLinks.length,1,'settlement link evidence missing');
assert.equal(output.settlementMechanismLinks[0].eventKey,strongEvent.eventKey);
assert.equal(output.settlementMechanismLinks[0].engineId,'velodrome_vevelo');
assert.equal(output.semantics.settlementLinkDoesNotChangeIncomeFamily,true);
assert.equal(output.semantics.settlementLinkIsNotPeriodIncomeAuthority,true);
assert.equal(output.completionPolicy.settlementLinksAreDiagnosticOnly,true);

// The cross-family settlement relation must never become accrued period evidence or tracking authority.
const ve=output.companies['defitea.eth'].mechanisms.velodrome_vevelo.months['2026-09'];
assert.equal(ve.factualEventCount,0,'realised settlement leaked into accrued factual-period evidence');
assert.equal(ve.factualUsdSubtotal,null,'realised settlement leaked into accrued USD subtotal');
assert.equal(ve.factualTrackingActive,false,'settlement link became factual tracking authority');
assert.equal(ve.status,'reference-only-no-factual-tracking');
assert.equal(output.mechanisms.velodrome_vevelo.reusableCoverageGap,true,'settlement diagnostic link falsely closed factual tracking coverage');

for(const [label,mutate] of [
  ['wrong route',e=>{e.route='forty-acres-other';}],
  ['wrong protocol',e=>{e.protocol='40 Acres';}],
  ['wrong source file',e=>{e.sourceFile='reporting/other.json';}],
  ['wrong source family',e=>{e.sourceFamily='other';}],
  ['wrong evidence status',e=>{e.evidenceStatus='reference-model';}],
  ['missing physical identity',e=>{e.physicalEventId=null;}],
  ['physical/source mismatch',e=>{e.physicalEventId=`10:${TX}:8`;}],
  ['wrong event identity',e=>{e.eventKey=`other:${e.sourceIdentity}`;}],
  ['authority expansion',e=>{e.executionAuthority='write';}],
  ['missing immutable hash',e=>{e.immutableEconomicFieldsHash=null;}],
  ['non-positive realised amount',e=>{e.amount=0;}],
  ['non-positive realised USD',e=>{e.usdValue=0;}]
]){
  const bad=structuredClone(strongEvent);mutate(bad);
  assert.equal(explicitSettlementMechanismLinks([bad],mechanismRows).length,0,`${label} failed open`);
  assert.equal(build(bad).summary.unmatchedCanonicalEventCount,1,`${label} was hidden from unmatched diagnostics`);
}

const noActiveMechanism=explicitSettlementMechanismLinks([strongEvent],[{company:'defitea.eth',mechanism:{engineId:'aerodrome_veaero',accountingFamily:'accrued-entitlement',mechanismType:'governance-rewards',classified:true,accountingRouteHints:['aerodrome']}}]);
assert.equal(noActiveMechanism.length,0,'settlement linked without the exact active velodrome_vevelo mechanism');

const unrelated={...strongEvent,eventKey:`other:${TX}:7`,route:'other-realised-cash-flow',protocol:'Other',sourceFile:'reporting/other.json',sourceFamily:'other',sourceIdentity:`other:${TX}:7`,evidenceStatus:'canonical-actual-net-received'};
assert.equal(explicitSettlementMechanismLinks([unrelated],mechanismRows).length,0,'unrelated realised cash flow gained a settlement relation');

console.log('Explicit settlement-mechanism link validation PASS',{
  relation:'40 Acres Received -> velodrome_vevelo',
  incomeFamilyPreserved:true,
  periodIncomeAuthority:false,
  factualTrackingAuthority:false,
  executionAuthority:'none'
});
