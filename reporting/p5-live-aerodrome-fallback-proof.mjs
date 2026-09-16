#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const ledger=JSON.parse(await fs.readFile('reporting/income-ledger.json','utf8'));
const valuationReason='canonical-event-usd-valuation-incomplete';
const lower=v=>String(v||'').toLowerCase();
const eventByKey=rows=>new Map((rows?.events||[]).map(event=>[event.eventKey,event]));
const isAerodromeEvent=event=>event?.sourceFile==='reporting/ve33-accounting-evidence.json'&&lower(event?.protocol)==='aerodrome';

const beforeView=buildCanonicalEarnedIncomeView(ledger);
const beforeByKey=eventByKey(ledger);
const beforeValuationBlockers=beforeView.unresolved.filter(x=>x.reason===valuationReason);
const beforeAerodrome=beforeValuationBlockers.filter(x=>isAerodromeEvent(beforeByKey.get(x.eventKey)));

assert.ok(beforeAerodrome.length>0,'live baseline no longer has Aerodrome historical USD blockers; refresh P5 diagnosis before proceeding');

const annotated=await annotateHistoricalValuationResolution(ledger);
const candidateLedger=annotated.ledger;
const candidateByKey=eventByKey(candidateLedger);
const afterView=buildCanonicalEarnedIncomeView(candidateLedger);
const afterValuationBlockers=afterView.unresolved.filter(x=>x.reason===valuationReason);
const afterAerodrome=afterValuationBlockers.filter(x=>isAerodromeEvent(candidateByKey.get(x.eventKey)));
const afterAerodromeKeys=new Set(afterAerodrome.map(x=>x.eventKey));
const newlyRecognized=beforeAerodrome.filter(x=>!afterAerodromeKeys.has(x.eventKey));

const newlyResolvedEvents=newlyRecognized.map(row=>candidateByKey.get(row.eventKey)).filter(Boolean);
const tenderlyResolved=newlyResolvedEvents.filter(event=>String(event?.valuationResolution?.sourceRpcEndpointId||'')==='tenderly-public-archive');

for(const event of tenderlyResolved){
  const r=event.valuationResolution;
  assert.equal(r.currentPriceUsed,false,'current price leaked into archive resolution');
  assert.equal(r.stablecoinPegAssumptionUsed,false,'stablecoin peg assumption leaked into archive resolution');
  assert.equal(r.referenceAprUsed,false,'Reference APR leaked into archive resolution');
  assert.equal(r.executionAuthority,'none','execution authority expanded');
  assert.equal(r.economicFieldsMutated,false,'historical valuation mutated economic fields');
  assert.equal(r.exactHistoricalBlock,true,'archive resolution is not exact-block');
  assert.ok(Number(r.resolvedUsdValue)>0,'archive resolution did not produce positive USD value');
}

const unresolvedStatuses={};
for(const row of afterAerodrome){
  const event=candidateByKey.get(row.eventKey);
  const status=event?.valuationResolution?.sourceStatus||event?.valuationStatus||row.reason||'unknown';
  unresolvedStatuses[status]=(unresolvedStatuses[status]||0)+1;
}

const companyDelta={};
for(const row of beforeAerodrome){
  const event=beforeByKey.get(row.eventKey);
  const company=event?.company||'unknown';
  companyDelta[company]??={before:0,after:0,delta:0};
  companyDelta[company].before++;
}
for(const row of afterAerodrome){
  const event=candidateByKey.get(row.eventKey);
  const company=event?.company||'unknown';
  companyDelta[company]??={before:0,after:0,delta:0};
  companyDelta[company].after++;
}
for(const value of Object.values(companyDelta))value.delta=value.before-value.after;

const compactResolution=event=>{
  const r=event.valuationResolution||{};
  return{
    eventKey:event.eventKey,
    company:event.company,
    asset:event.asset||null,
    token:lower(event.token),
    boundaryAt:event.periodEnd,
    amount:event.amount,
    sourceFamily:r.sourceFamily||null,
    sourceRpcEndpointId:r.sourceRpcEndpointId||null,
    sourceContract:r.sourceContract?lower(r.sourceContract):null,
    poolFactory:r.poolFactory?lower(r.poolFactory):null,
    tickSpacing:r.tickSpacing??null,
    quoteTokenSymbol:r.quoteTokenSymbol||null,
    quoteToken:r.quoteToken?lower(r.quoteToken):null,
    valuationUnitUsd:r.valuationUnitUsd??null,
    resolvedUsdValue:r.resolvedUsdValue??null,
    sourceBlockNumber:r.sourceBlockNumber??null,
    exactHistoricalBlock:r.exactHistoricalBlock===true,
    currentPriceUsed:r.currentPriceUsed,
    stablecoinPegAssumptionUsed:r.stablecoinPegAssumptionUsed,
    executionAuthority:r.executionAuthority
  };
};

const summary={
  ok:afterAerodrome.length<beforeAerodrome.length&&tenderlyResolved.length>0,
  baseline:{
    eligibleEventCount:beforeValuationBlockers.length,
    aerodromeValuationBlockers:beforeAerodrome.length
  },
  candidate:{
    eligibleEventCount:annotated.eligibleEventCount??null,
    resolvedEventCount:annotated.resolvedEventCount??null,
    unresolvedEventCount:annotated.unresolvedEventCount??null,
    unresolvedStatuses:annotated.unresolvedStatuses??null,
    totalValuationBlockers:afterValuationBlockers.length,
    aerodromeValuationBlockers:afterAerodrome.length
  },
  aerodromeBlockerDelta:beforeAerodrome.length-afterAerodrome.length,
  tenderlyResolvedEventCount:tenderlyResolved.length,
  companyDelta,
  newlyResolved:newlyResolvedEvents.map(compactResolution),
  tenderlyResolved:tenderlyResolved.map(compactResolution),
  residualAerodromeStatuses:unresolvedStatuses,
  currentPriceUsed:false,
  stablecoinPegAssumptionUsed:false,
  executionAuthority:'none'
};

console.log('P5 LIVE Canonical Income Ledger archive-RPC blocker proof',JSON.stringify(summary,null,2));
assert.ok(summary.aerodromeBlockerDelta>0,'archive RPC fabric did not reduce any live Aerodrome historical USD blocker');
assert.ok(summary.tenderlyResolvedEventCount>0,'no newly resolved live blocker is attributable to the archive RPC endpoint');
