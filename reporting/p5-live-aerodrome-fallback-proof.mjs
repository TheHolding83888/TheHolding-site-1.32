#!/usr/bin/env node
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import { annotateHistoricalValuationResolution } from './income-ledger.mjs';
import { buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const ledger=JSON.parse(await fs.readFile('reporting/income-ledger.json','utf8'));
const targetCompany='aerocvxyb.eth';
const valuationReason='canonical-event-usd-valuation-incomplete';
const lower=v=>String(v||'').toLowerCase();
const isVe33Target=e=>e?.company===targetCompany&&e?.sourceFile==='reporting/ve33-accounting-evidence.json'&&e?.family==='accrued-entitlement';

const beforeView=buildCanonicalEarnedIncomeView(ledger);
const beforeUnresolved=beforeView.unresolved.filter(x=>x.company===targetCompany&&x.reason===valuationReason);
const beforeByKey=new Map((ledger.events||[]).map(e=>[e.eventKey,e]));

assert.ok(beforeUnresolved.length>0,'live baseline no longer has the expected aerocvxyb historical USD blocker; refresh the P5 diagnosis before proceeding');

const annotated=await annotateHistoricalValuationResolution(ledger);
const candidateLedger=annotated.ledger;
const afterView=buildCanonicalEarnedIncomeView(candidateLedger);
const afterUnresolved=afterView.unresolved.filter(x=>x.company===targetCompany&&x.reason===valuationReason);
const afterUnresolvedKeys=new Set(afterUnresolved.map(x=>x.eventKey));
const newlyRecognized=beforeUnresolved.filter(x=>!afterUnresolvedKeys.has(x.eventKey));
const candidateEvents=(candidateLedger.events||[]).filter(isVe33Target);
const aeroFallbackEvents=candidateEvents.filter(e=>{
  const r=e?.valuationResolution;
  if(r?.sourceFamily!=='historical-onchain-aerodrome-twap-chainlink-at-boundary'||String(r?.quoteTokenSymbol)!=='AERO')return false;
  const prior=beforeByKey.get(e.eventKey)?.valuationResolution;
  return !(prior?.sourceFamily===r.sourceFamily&&String(prior?.quoteTokenSymbol)==='AERO'&&Number(prior?.resolvedUsdValue)>0);
});

for(const event of aeroFallbackEvents){
  const r=event.valuationResolution;
  assert.equal(r.currentPriceUsed,false);
  assert.equal(r.stablecoinPegAssumptionUsed,false);
  assert.equal(r.referenceAprUsed,false);
  assert.equal(r.executionAuthority,'none');
  assert.equal(r.economicFieldsMutated,false);
  assert.ok(Number(r.resolvedUsdValue)>0);
}

const summary={
  ok:afterUnresolved.length<beforeUnresolved.length&&aeroFallbackEvents.length>0,
  targetCompany,
  baselineValuationBlockers:beforeUnresolved.length,
  candidateValuationBlockers:afterUnresolved.length,
  blockerDelta:beforeUnresolved.length-afterUnresolved.length,
  newlyRecognizedEventKeys:newlyRecognized.map(x=>x.eventKey),
  aeroFallbackEventCount:aeroFallbackEvents.length,
  aeroFallbackEvents:aeroFallbackEvents.map(e=>({
    eventKey:e.eventKey,
    token:lower(e.token),
    boundaryAt:e.periodEnd,
    quoteTokenSymbol:e.valuationResolution.quoteTokenSymbol,
    quoteToken:lower(e.valuationResolution.quoteToken),
    sourceBlockNumber:e.valuationResolution.sourceBlockNumber,
    sourceContract:lower(e.valuationResolution.sourceContract),
    quoteChainlinkContract:lower(e.valuationResolution.quoteChainlinkContract),
    resolvedUsdValue:e.valuationResolution.resolvedUsdValue,
    currentPriceUsed:e.valuationResolution.currentPriceUsed,
    stablecoinPegAssumptionUsed:e.valuationResolution.stablecoinPegAssumptionUsed,
    executionAuthority:e.valuationResolution.executionAuthority
  })),
  eligibleEventCount:annotated.eligibleEventCount??null,
  resolvedEventCount:annotated.resolvedEventCount??null,
  unresolvedEventCount:annotated.unresolvedEventCount??null,
  unresolvedStatuses:annotated.unresolvedStatuses??null,
  executionAuthority:'none'
};
console.log('P5 LIVE Aerodrome AERO fallback proof',JSON.stringify(summary,null,2));
assert.ok(summary.blockerDelta>0,'candidate did not reduce the live aerocvxyb historical USD blocker');
assert.ok(summary.aeroFallbackEventCount>0,'candidate did not use the new AERO quote fallback on any live unresolved event');
