#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DEFITEA_CANONICAL_POSITION_COUNT,
  REPORTING_VERSION,
  canonicalDefiteaPositions,
  assertDefiteaProductivityParity,
  selectedMarketPrices,
  validateRatePolicy,
  resolveReferenceRate,
  buildVlCvxReconciliation,
  buildDefiteaSnapshot,
  aggregateDefiteaMonths
} from './reporting-engine.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
const finite=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value));

const state=read('companies/defitea-canonical-state.json');
const productivity=read('companies/productivity-data.json');
const marketData=read('intelligence/market-data/market-data.json');
const published=read('reporting/reporting-data.json');
const policy=validateRatePolicy(read('reporting/rate-continuity-policy.json'));
let rewards={};
try { rewards=read('companies/rewards-data.json'); } catch {}

const positions=canonicalDefiteaPositions(state);
assert.equal(positions.length,DEFITEA_CANONICAL_POSITION_COUNT);
assert.equal(new Set(positions.map(p=>p.id)).size,DEFITEA_CANONICAL_POSITION_COUNT);
assertDefiteaProductivityParity(positions,productivity);
const selected=selectedMarketPrices(positions,marketData);
assert.equal(selected.size,DEFITEA_CANONICAL_POSITION_COUNT);

const previousSnapshot=published?.funds?.['defitea.eth']?.latestSnapshot||null;
const generatedAt=productivity.generatedAt||new Date().toISOString();
const snapshot=buildDefiteaSnapshot({generatedAt,positions,productivity,marketData,rewards,previousSnapshot,ratePolicy:policy});
assert.equal(snapshot.positionCount,11);
assert.equal(snapshot.positions.length,11);
assert.equal(snapshot.missingPrices.length,0);
assert.equal(snapshot.positions.every(r=>r.priceSource==='canonical-market-data'&&r.selectedLane&&Number(r.price)>0),true);
assert.equal(snapshot.marketDataGeneratedAt,marketData.generatedAt);
assert.equal(snapshot.unknownIsNotZero,true);
assert.equal(snapshot.rateContinuityPolicyVersion,policy.version);
assert.ok(snapshot.rateCoveredPositionCount>=0&&snapshot.rateCoveredPositionCount<=11);
assert.ok(snapshot.coverage>=0&&snapshot.coverage<=1);
assert.equal(snapshot.fullProductiveCoverage,snapshot.rateCoveredPositionCount===11);
for(const row of snapshot.positions){
  assert.ok(['current','carried-forward','unknown'].includes(row.rateStatus),`${row.principalId}: invalid rateStatus`);
  assert.equal(row.unknownIsNotZero,true);
  if(row.rateStatus==='unknown') assert.equal(row.referenceApr,null);
  else assert.ok(finite(row.referenceApr)&&Number(row.referenceApr)>=0,`${row.principalId}: covered rate invalid`);
}

// Current live source gaps may use only a bounded, physically published prior
// valid rate. That rate remains explicitly historical; it is not promoted back
// into Productivity and is not described as current verification.
const liveInvalid=(productivity.companies?.['defitea.eth']?.breakdown||[]).filter(r=>r.engineStatus!=='ok'||!finite(r.apr));
for(const row of liveInvalid){
  const resolved=snapshot.positions.find(x=>x.principalId===row.principalId);
  assert.ok(resolved,`${row.principalId}: missing resolved reporting row`);
  assert.ok(['carried-forward','unknown'].includes(resolved.rateStatus),`${row.principalId}: invalid degradation state`);
  if(resolved.rateStatus==='carried-forward'){
    assert.equal(resolved.rateSource,'previous-published-valid-reporting-rate');
    assert.ok(Number(resolved.rateAgeDays)<=Number(resolved.maxCarryDays));
    assert.notEqual(resolved.sourceEngineStatus,'ok');
  }
}

// Prove a route with no admissible prior rate degrades locally instead of
// freezing the fund. Its capital stays in TVL but its modeled income is absent.
const partialProductivity=clone(productivity);
const victim=partialProductivity.companies['defitea.eth'].breakdown[0];
victim.apr=null;
victim.engineStatus='unavailable';
if(partialProductivity.engines?.[victim.engineId]){
  partialProductivity.engines[victim.engineId].aprLatest=null;
  partialProductivity.engines[victim.engineId].status='unavailable';
}
const partial=buildDefiteaSnapshot({generatedAt,positions,productivity:partialProductivity,marketData,rewards,previousSnapshot:null,ratePolicy:policy});
assert.equal(partial.positionCount,11);
assert.ok(partial.rateCoveredPositionCount<11);
assert.ok(partial.coverage<1);
assert.equal(partial.fullProductiveCoverage,false);
assert.equal(partial.reportQuality,'partial');
const unknown=partial.positions.find(r=>r.principalId===victim.principalId);
assert.equal(unknown.rateStatus,'unknown');
assert.equal(unknown.referenceApr,null);
assert.ok(partial.totalValueUsd>partial.coveredValueUsd);
assert.ok(finite(partial.modeledDailyCashFlowUsd));

// Hard-invalid states can never inherit a prior rate.
const prior={referenceApr:12.34,rateObservedAt:generatedAt};
const blocked=resolveReferenceRate({prod:{apr:null,engineStatus:'blocked'},engine:{nativeCadence:'weekly'},prior,previousCapturedAt:generatedAt,generatedAt,policy});
assert.equal(blocked.status,'unknown');
assert.equal(blocked.apr,null);

// An expired carry also becomes UNKNOWN rather than zero.
const expired=resolveReferenceRate({prod:{apr:null,engineStatus:'warming'},engine:{nativeCadence:'daily'},prior:{referenceApr:12.34,rateObservedAt:'2026-08-01T00:00:00Z'},previousCapturedAt:'2026-08-01T00:00:00Z',generatedAt:'2026-08-27T00:00:00Z',policy});
assert.equal(expired.status,'unknown');
assert.equal(expired.apr,null);

// First tracking month remains non-fabricated.
const firstMonth=[];
for(let d=9;d<=31;d++) firstMonth.push({date:`2026-08-${String(d).padStart(2,'0')}`,totalValueUsd:100,coveredValueUsd:100,referenceApr:365,modeledDailyCashFlowUsd:1,carriedRatePositions:[],unknownRatePositions:[]});
const firstAgg=aggregateDefiteaMonths(firstMonth,new Date('2026-09-02T06:07:00Z'))['2026-08'];
assert.equal(firstAgg.status,'final-reference-partial');
assert.equal(firstAgg.firstTrackingMonth,true);
assert.equal(firstAgg.normalizationFactor,1);
assert.equal(firstAgg.cashFlowUsd,23);
assert.equal(firstAgg.unobservedPreTrackingDaysBackfilled,false);

// Partial rate coverage is represented honestly in month-level provenance.
const partialDays=[
  {date:'2026-09-01',totalValueUsd:100,coveredValueUsd:80,referenceApr:20,modeledDailyCashFlowUsd:0.0438356,carriedRatePositions:[],unknownRatePositions:['x']},
  {date:'2026-09-02',totalValueUsd:100,coveredValueUsd:100,referenceApr:20,modeledDailyCashFlowUsd:0.0547945,carriedRatePositions:['y'],unknownRatePositions:[]}
];
const partialAgg=aggregateDefiteaMonths(partialDays,new Date('2026-09-02T06:07:00Z'))['2026-09'];
assert.equal(partialAgg.status,'provisional');
assert.ok(partialAgg.averageRateCoverage<1);
assert.equal(partialAgg.unknownRateDays,1);
assert.equal(partialAgg.carriedRateDays,1);
assert.equal(partialAgg.unknownIsNotZero,true);

const reconciliation=buildVlCvxReconciliation(rewards);
assert.equal(reconciliation.referenceIncomeEngine,'convex_vlcvx');
assert.equal(reconciliation.referenceAprIncludesVotiumIncentives,true);
assert.equal(reconciliation.claimableSettlementAddedToReferenceCashFlow,false);
assert.equal(reconciliation.realisedCashFlowAuthority,false);
assert.equal(reconciliation.unknownIsNotZero,true);

const source=fs.readFileSync(path.join(ROOT,'reporting/reporting-engine.mjs'),'utf8');
assert.equal(REPORTING_VERSION,'1.2.1-resilient-rate-coverage');
for(const forbidden of ['api.coingecko.com/api/v3/simple/price','COINGECKO_API_KEY','getCoinGeckoPrices(','COMPANY_PAGE_FILE','parseCompanyBook(']) assert.equal(source.includes(forbidden),false,`forbidden Reporting price-discovery path remains: ${forbidden}`);

console.log('Reporting resilient rate coverage PASS',{
  canonicalPositions:snapshot.positionCount,
  liveInvalidRows:liveInvalid.map(r=>({principalId:r.principalId,engineId:r.engineId,status:r.engineStatus,apr:r.apr})),
  carriedRatePositions:snapshot.carriedRatePositions,
  unknownRatePositions:snapshot.unknownRatePositions,
  liveRateCoverage:snapshot.coverage,
  syntheticPartialCoverage:partial.coverage,
  unknownIsNotZero:true
});
