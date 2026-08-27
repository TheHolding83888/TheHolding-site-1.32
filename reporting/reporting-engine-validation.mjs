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
  buildVlCvxReconciliation,
  buildDefiteaSnapshot,
  aggregateDefiteaMonths
} from './reporting-engine.mjs';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(ROOT,p),'utf8'));
const clone=value=>JSON.parse(JSON.stringify(value));
const validApr=value=>value!==null&&value!==undefined&&value!==''&&Number.isFinite(Number(value))&&Number(value)>=0;

const state=read('companies/defitea-canonical-state.json');
const liveProductivity=read('companies/productivity-data.json');
const marketData=read('intelligence/market-data/market-data.json');
const publishedReporting=read('reporting/reporting-data.json');
let rewards={};
try { rewards=read('companies/rewards-data.json'); } catch {}

const positions=canonicalDefiteaPositions(state);
assert.equal(positions.length,DEFITEA_CANONICAL_POSITION_COUNT);
assert.equal(new Set(positions.map(p=>p.id)).size,DEFITEA_CANONICAL_POSITION_COUNT);

// PR code verification must be deterministic even when a live Productivity
// source is intentionally fail-closed/warming. Production Reporting must NOT
// inherit this fixture: it continues to consume the live Productivity file and
// therefore still refuses publication unless all 11 rows are valid.
const liveCompany=liveProductivity?.companies?.['defitea.eth'];
assert.ok(liveCompany&&Array.isArray(liveCompany.breakdown),'live Defitea Productivity company missing');
const liveInvalidRows=liveCompany.breakdown.filter(row=>row?.engineStatus!=='ok'||!validApr(row?.apr));
if(liveInvalidRows.length){
  assert.throws(
    ()=>assertDefiteaProductivityParity(positions,liveProductivity),
    /exact 11\/11 Defitea Reference APR coverage not satisfied/,
    'live warming/UNKNOWN Productivity must remain fail-closed for production Reporting'
  );
}

const productivity=clone(liveProductivity);
const fixtureCompany=productivity.companies?.['defitea.eth'];
const lastPublished=publishedReporting?.funds?.['defitea.eth']?.latestSnapshot;
const lastPublishedRows=Array.isArray(lastPublished?.positions)?lastPublished.positions:[];
const fixtureSources=[];

for(const row of fixtureCompany.breakdown){
  if(row?.engineStatus==='ok'&&validApr(row?.apr)) continue;
  const prior=lastPublishedRows.find(x=>(x?.principalId&&x.principalId===row?.principalId)||(x?.engineId&&x.engineId===row?.engineId));
  assert.ok(prior,`${row?.principalId||row?.engineId}: no previously published valid Reporting row available for deterministic validation fixture`);
  assert.equal(prior.engineStatus,'ok',`${row?.principalId||row?.engineId}: previously published fixture row is not ok`);
  assert.ok(validApr(prior.referenceApr),`${row?.principalId||row?.engineId}: previously published fixture APR invalid`);
  row.apr=Number(prior.referenceApr);
  row.engineStatus='ok';
  row.validationFixture={
    validationOnly:true,
    source:'reporting/reporting-data.json latest physically published valid snapshot',
    capturedAt:lastPublished?.capturedAt||null,
    referenceApr:Number(prior.referenceApr),
    liveStatus:liveCompany.breakdown.find(x=>x.engineId===row.engineId)?.engineStatus||null,
    liveApr:liveCompany.breakdown.find(x=>x.engineId===row.engineId)?.apr??null
  };
  if(productivity.engines?.[row.engineId]){
    productivity.engines[row.engineId].aprLatest=Number(prior.referenceApr);
    productivity.engines[row.engineId].status='ok';
    productivity.engines[row.engineId].validationFixture=row.validationFixture;
  }
  fixtureSources.push({engineId:row.engineId,principalId:row.principalId,referenceApr:Number(prior.referenceApr),capturedAt:lastPublished?.capturedAt||null});
}

if(fixtureSources.length){
  const rows=fixtureCompany.breakdown;
  const total=rows.reduce((sum,row)=>sum+Number(row.value||0),0);
  const weighted=rows.reduce((sum,row)=>sum+Number(row.value||0)*Number(row.apr||0),0);
  assert.ok(total>0&&rows.every(row=>row.engineStatus==='ok'&&validApr(row.apr)),'validation fixture failed to restore deterministic 11/11 coverage');
  fixtureCompany.aprLatest=weighted/total;
  fixtureCompany.status='ok';
  fixtureCompany.aprScope='full-productive-capital-validation-fixture';
  fixtureCompany.coverage=1;
  fixtureCompany.productiveValue=total;
  fixtureCompany.coveredProductiveValue=total;
  fixtureCompany.uncoveredProductiveValue=0;
  productivity.validationFixture={
    validationOnly:true,
    source:'last physically published valid Reporting snapshot',
    reportingGeneratedAt:publishedReporting.generatedAt||null,
    liveGeneratedAt:liveProductivity.generatedAt||null,
    patchedRows:fixtureSources,
    productionAuthority:false,
    productionWriterMustUseLiveProductivity:true
  };
}

assertDefiteaProductivityParity(positions,productivity);
const selected=selectedMarketPrices(positions,marketData);
assert.equal(selected.size,DEFITEA_CANONICAL_POSITION_COUNT);

const fixtureOutput=process.env.REPORTING_VALIDATION_PRODUCTIVITY_FILE;
if(fixtureOutput){
  fs.writeFileSync(path.resolve(fixtureOutput),JSON.stringify(productivity,null,2)+'\n');
}

const snapshot=buildDefiteaSnapshot({
  generatedAt:'2026-08-22T06:07:00.000Z',
  positions,productivity,marketData,rewards
});
assert.equal(snapshot.positionCount,11);
assert.equal(snapshot.rateCoveredPositionCount,11);
assert.equal(snapshot.fullProductiveCoverage,true);
assert.equal(snapshot.coverage,1);
assert.equal(snapshot.missingPrices.length,0);
assert.equal(snapshot.positions.every(r=>r.priceSource==='canonical-market-data'),true);
assert.equal(snapshot.positions.every(r=>r.selectedLane),true);
assert.equal(snapshot.marketDataGeneratedAt,marketData.generatedAt);
assert.ok(snapshot.referenceApr>=0);
assert.ok(snapshot.modeledDailyCashFlowUsd>=0);

// The daily Reference APR must be internally coherent with the exact same
// canonical prices used for the daily TVL and cash-flow model.
const recomputedValue=snapshot.positions.reduce((s,r)=>s+r.units*r.price,0);
const recomputedWeighted=snapshot.positions.reduce((s,r)=>s+(r.units*r.price*r.referenceApr),0);
const recomputedApr=recomputedWeighted/recomputedValue;
const recomputedDaily=(recomputedWeighted/100)/365;
assert.ok(Math.abs(snapshot.referenceApr-recomputedApr)<0.0002);
assert.ok(Math.abs(snapshot.modeledDailyCashFlowUsd-recomputedDaily)<0.00002);

// First tracking month: Aug 9 -> Aug 31 must NEVER be normalized to 31 days.
const firstMonth=[];
for(let d=9;d<=31;d++) firstMonth.push({
  date:`2026-08-${String(d).padStart(2,'0')}`,
  totalValueUsd:100,
  referenceApr:365,
  modeledDailyCashFlowUsd:1
});
const firstAgg=aggregateDefiteaMonths(firstMonth,new Date('2026-09-02T06:07:00Z'))['2026-08'];
assert.equal(firstAgg.status,'final-reference-partial');
assert.equal(firstAgg.firstTrackingMonth,true);
assert.equal(firstAgg.normalizationFactor,1);
assert.equal(firstAgg.cashFlowUsd,23);
assert.equal(firstAgg.observedReferenceCashFlowUsd,23);
assert.equal(firstAgg.unobservedPreTrackingDaysBackfilled,false);
assert.match(firstAgg.note,/no income is fabricated/i);

// A live partial month must annualise observed cash-flow yield, not substitute
// the weighted Reference APR shown separately as averageReferenceAprPct.
const livePartial=[
  {date:'2026-08-09',totalValueUsd:100,referenceApr:20,modeledDailyCashFlowUsd:1},
  {date:'2026-08-10',totalValueUsd:100,referenceApr:20,modeledDailyCashFlowUsd:1}
];
const liveAgg=aggregateDefiteaMonths(livePartial,new Date('2026-08-10T06:07:00Z'))['2026-08'];
assert.equal(liveAgg.status,'provisional');
assert.equal(liveAgg.averageReferenceAprPct,20);
assert.equal(liveAgg.monthlyYieldPct,2);
assert.equal(liveAgg.annualizedAprPct,365);
assert.notEqual(liveAgg.annualizedAprPct,liveAgg.averageReferenceAprPct);

// A later closed month may normalize an isolated missed daily run, preserving
// the existing bounded continuity policy.
const later=[
  ...firstMonth,
  ...Array.from({length:29},(_,i)=>{
    const day=i+1;
    return {
      date:`2026-09-${String(day).padStart(2,'0')}`,
      totalValueUsd:100,
      referenceApr:365,
      modeledDailyCashFlowUsd:1
    };
  })
];
const laterAgg=aggregateDefiteaMonths(later,new Date('2026-10-02T06:07:00Z'))['2026-09'];
assert.equal(laterAgg.firstTrackingMonth,false);
assert.ok(laterAgg.normalizationFactor>1);
assert.equal(laterAgg.cashFlowUsd,30);

// Union settlement is explicitly non-additive to the Reference APR model.
const reconciliation=buildVlCvxReconciliation(rewards);
assert.equal(reconciliation.referenceIncomeEngine,'convex_vlcvx');
assert.equal(reconciliation.referenceAprIncludesVotiumIncentives,true);
assert.equal(reconciliation.claimableSettlementAddedToReferenceCashFlow,false);
assert.equal(reconciliation.realisedCashFlowAuthority,false);
assert.equal(reconciliation.unknownIsNotZero,true);

// Prove the code plane no longer owns external price discovery.
const source=fs.readFileSync(path.join(ROOT,'reporting/reporting-engine.mjs'),'utf8');
assert.equal(REPORTING_VERSION,'1.2.0-defitea-canonical-market-data');
for(const forbidden of [
  'api.coingecko.com/api/v3/simple/price',
  'COINGECKO_API_KEY',
  'getCoinGeckoPrices(',
  'COMPANY_PAGE_FILE',
  'parseCompanyBook('
]) assert.equal(source.includes(forbidden),false,`forbidden Reporting price-discovery path remains: ${forbidden}`);

console.log('Reporting hardening PASS',{
  canonicalPositions:snapshot.positionCount,
  fullProductiveCoverage:snapshot.fullProductiveCoverage,
  marketDataGeneratedAt:snapshot.marketDataGeneratedAt,
  selectedLanes:[...new Set(snapshot.positions.map(r=>r.selectedLane))],
  liveInvalidRows:liveInvalidRows.map(r=>({engineId:r.engineId,principalId:r.principalId,status:r.engineStatus,apr:r.apr})),
  validationFixtureRows:fixtureSources,
  productionLiveFailClosed:liveInvalidRows.length>0,
  firstMonthNormalization:firstAgg.normalizationFactor,
  laterMonthNormalization:laterAgg.normalizationFactor,
  unionAdditive:reconciliation.claimableSettlementAddedToReferenceCashFlow
});
