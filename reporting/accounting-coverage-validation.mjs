#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';
import { buildAccountingCoverage, canonicalCompanyName, COMPANY_ALIASES, VERSION } from './accounting-coverage.mjs';

const FILE=process.env.ACCOUNTING_COVERAGE_FILE||'./reporting/accounting-coverage.json';
const PRODUCTIVITY_FILE=process.env.PRODUCTIVITY_DATA_FILE||'./companies/productivity-data.json';
const EMBEDDED_FILE=process.env.EMBEDDED_YIELD_LEDGER_FILE||'./companies/embedded-yield-ledger.json';
const data=JSON.parse(fs.readFileSync(FILE,'utf8'));
const productivity=JSON.parse(fs.readFileSync(PRODUCTIVITY_FILE,'utf8'));
const embedded=JSON.parse(fs.readFileSync(EMBEDDED_FILE,'utf8'));

assert.equal(data.version,VERSION);
assert.equal(data.status,'diagnostic-no-completion-authority');
assert.equal(data.semantics?.canonicalLedgerIsSoleFactualIncomeAuthority,true);
assert.equal(data.semantics?.productivityCoverageIsNotAccountingCoverage,true);
assert.equal(data.semantics?.referenceMetricIsNotEarnedIncome,true);
assert.equal(data.semantics?.currentRewardStateIsNotPeriodIncome,true);
assert.equal(data.semantics?.factualTrackingProofIsNotPeriodIncome,true);
assert.equal(data.semantics?.zeroPeriodEventDoesNotImplyCoverageGap,true);
assert.equal(data.semantics?.coverageGapMeansMissingFactualTrackingCapability,true);
assert.equal(data.semantics?.factualEvidenceDoesNotImplyFullMechanismCoverage,true);
assert.equal(data.semantics?.partialEvidenceDoesNotCloseMonth,true);
assert.equal(data.semantics?.unknownIsNotZero,true);
assert.equal(data.semantics?.newCompanyDoesNotRequireNewAccountingEngineWhenMechanismAlreadySupported,true);
assert.equal(data.semantics?.unclassifiedMechanismIsVisibleGapNotZero,true);
assert.equal(data.semantics?.historicalCompanyAliasesCanonicalized,true);
assert.equal(data.semantics?.stringAliasCannotCreateNewCompanyIdentity,true);
assert.equal(data.completionPolicy?.registryHasMonthClosingAuthority,false);
assert.equal(data.completionPolicy?.registryHasIncomeCreationAuthority,false);
assert.equal(data.completionPolicy?.coverageGapRankingIsDiagnosticOnly,true);
assert.equal(data.authority?.executionAuthority,'none');
assert.equal(data.authority?.walletAuthority,'none');
assert.equal(data.authority?.claimingAuthority,'none');
assert.equal(data.authority?.capitalExecution,false);
assert.equal(data.authority?.monthClosingAuthority,false);
assert.equal(data.authority?.methodologyMutationAuthority,'none');
assert.ok(/^\d{4}-\d{2}$/.test(data.currentMonth),'currentMonth missing');
assert.ok(Number(data.summary?.factualTrackingProofCount)>=0,'factual tracking proof summary missing');

const companies=data.companies||{};
assert.equal(data.summary?.companyCount,Object.keys(companies).length,'dynamic company summary drift');
assert.ok(Number(data.summary?.companyCount)>0,'coverage registry discovered no companies');
assert.ok(Number(data.summary?.mechanismInstanceCount)>0,'coverage registry has no mechanism instances');
assert.equal(data.summary?.uniqueMechanismCount,Object.keys(data.mechanisms||{}).length,'unique mechanism summary drift');
assert.equal(data.summary?.mechanismInstanceCount,data.summary?.classifiedMechanismInstanceCount+data.summary?.unclassifiedMechanismInstanceCount,'classification accounting drift');
assert.equal(data.summary?.canonicalLedgerEventCount>=data.summary?.unmatchedCanonicalEventCount,true,'unmatched event count exceeds ledger event count');
assert.ok(Array.isArray(data.companyIdentityAliases),'company identity alias diagnostics missing');

for(const name of Object.keys(productivity?.companies||{}))assert.ok(companies[canonicalCompanyName(name)],`dynamic discovery missed productivity company ${name}`);
if(embedded?.company?.name)assert.ok(companies[canonicalCompanyName(embedded.company.name)],`dynamic discovery missed embedded company ${embedded.company.name}`);

assert.equal(COMPANY_ALIASES['aerocrvyb.eth'],'aerocvxyb.eth');
assert.ok(companies['aerocvxyb.eth'],'Company #006 canonical identity missing');
assert.equal(companies['aerocrvyb.eth'],undefined,'Company #006 historical alias became a phantom company');
assert.ok((companies['aerocvxyb.eth'].sourceAliases||[]).includes('aerocvxyb.eth'),'Company #006 canonical source alias missing');

let mechanismInstances=0;
for(const [name,c] of Object.entries(companies)){
  assert.equal(c.name,name);
  assert.equal(c.discoveredDynamically,true,`${name} was not dynamically discovered`);
  assert.equal(c.canonicalIdentityApplied,true,`${name} canonical identity layer was not applied`);
  assert.ok(Array.isArray(c.sourceAliases)&&c.sourceAliases.length>0,`${name} source aliases missing`);
  assert.equal(c.executionAuthority,'none');
  assert.ok(Array.isArray(c.mechanismInventorySource));
  const mechanisms=Object.values(c.mechanisms||{});
  mechanismInstances+=mechanisms.length;
  assert.equal(mechanisms.length,c.mechanismCount,`${name} mechanism count drift`);
  for(const m of mechanisms){
    assert.ok(m.engineId,`${name} mechanism id missing`);
    assert.ok(['accrued-entitlement','embedded-income','unknown'].includes(m.accountingFamily),`${name}/${m.engineId} invalid accounting family`);
    assert.equal(m.referenceMetricIsAccountingAuthority,false,`${name}/${m.engineId} reference metric gained accounting authority`);
    assert.ok(Array.isArray(m.accountingRouteHints)&&m.accountingRouteHints.length>0,`${name}/${m.engineId} route hints missing`);
    assert.ok(m.months?.[data.currentMonth],`${name}/${m.engineId} current-month coverage missing`);
    for(const [month,row] of Object.entries(m.months||{})){
      assert.ok(/^\d{4}-\d{2}$/.test(month),`${name}/${m.engineId} invalid month key`);
      assert.equal(row.mechanismCompleteForMonth,false,`${name}/${m.engineId}/${month} diagnostic registry falsely completed mechanism`);
      assert.ok(Array.isArray(row.completionBlockers));
      assert.ok(Array.isArray(row.factualTrackingProofSources));
      assert.ok(['factual-period-evidence','factual-tracking-no-period-event','state-observed-not-factual-tracking','reference-only-no-factual-tracking'].includes(row.status));
      if(row.factualEventCount===0)assert.ok(row.completionBlockers.includes('no-canonical-period-income-evidence'),`${name}/${m.engineId}/${month} eventless period lacks blocker`);
      if(row.factualTrackingActive===true)assert.ok(!row.completionBlockers.includes('no-factual-engine-tracking-proof'),`${name}/${m.engineId}/${month} tracked mechanism incorrectly marked uncovered`);
      if(row.factualTrackingActive!==true)assert.ok(row.completionBlockers.includes('no-factual-engine-tracking-proof'),`${name}/${m.engineId}/${month} missing factual-tracking blocker`);
      if(row.status==='state-observed-not-factual-tracking')assert.ok(row.completionBlockers.includes('current-state-is-not-period-income'));
      if(row.factualEventCount>0){assert.equal(row.status,'factual-period-evidence');assert.equal(row.factualTrackingActive,true);}
      if(row.status==='factual-tracking-no-period-event'){assert.equal(row.factualTrackingActive,true);assert.equal(row.factualEventCount,0);assert.ok(row.factualTrackingProofCount>0);}
      if(m.classified!==true)assert.ok(row.completionBlockers.includes('unclassified-income-mechanism'),`${name}/${m.engineId}/${month} unclassified mechanism hidden`);
    }
  }
}
assert.equal(mechanismInstances,data.summary.mechanismInstanceCount,'mechanism instance summary drift');

for(const [engineId,m] of Object.entries(data.mechanisms||{})){
  assert.equal(m.engineId,engineId);
  assert.equal(m.referenceMetricIsAccountingAuthority,false);
  assert.equal(m.completionAuthority,false);
  assert.equal(m.activeCompanyCount,(m.companies||[]).length,`${engineId} active company count drift`);
  assert.equal(m.factualTrackingCompanyCount,(m.factualTrackingCompanies||[]).length,`${engineId} factual-tracking company count drift`);
  assert.equal(m.factualEventCompanyCount,(m.factualEventCompanies||[]).length,`${engineId} factual-event company count drift`);
  assert.equal(m.factualCompanyCount,m.factualTrackingCompanyCount,`${engineId} compatibility factual count drift`);
  assert.deepEqual(m.factualCompanies,m.factualTrackingCompanies,`${engineId} compatibility factual companies drift`);
  assert.equal(m.stateOnlyCompanyCount,(m.stateOnlyCompanies||[]).length,`${engineId} state-only company count drift`);
  assert.equal(m.referenceOnlyCompanyCount,(m.referenceOnlyCompanies||[]).length,`${engineId} reference-only company count drift`);
  assert.equal(m.reusableCoverageGap,m.factualTrackingCompanyCount<m.activeCompanyCount,`${engineId} gap flag must follow factual tracking, not event incidence`);
}

const ranking=data.gapRanking||[];
assert.equal(ranking.length,data.summary.reusableCoverageGapCount,'gap ranking count drift');
for(let i=0;i<ranking.length;i++){
  assert.equal(ranking[i].rank,i+1,'gap rank sequence drift');
  assert.equal(data.mechanisms?.[ranking[i].engineId]?.reusableCoverageGap,true,'ranked mechanism is not a coverage gap');
  if(i>0){
    const a=ranking[i-1],b=ranking[i];
    assert.ok(a.activeCompanyCount>b.activeCompanyCount||(a.activeCompanyCount===b.activeCompanyCount&&Number(a.knownProductiveValueUsdTotal||0)>=Number(b.knownProductiveValueUsdTotal||0)),'gap ranking lost reusable/economic ordering');
  }
}

const emptyLedger={generatedAt:'2026-09-03T00:00:00.000Z',semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},authority:{executionAuthority:'none',capitalExecution:false},events:[],companies:{}};

// A factual checkpoint proves engine coverage without inventing period income.
const trackingProductivity={generatedAt:'2026-09-03T00:00:00.000Z',engines:{aerodrome_veaero:{protocol:'Aerodrome'}},companies:{'FutureCo.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'aerodrome_veaero',value:100,engineStatus:'ok'}]}}};
const trackingLedger={...emptyLedger,companies:{'FutureCo.eth':{currentClaimableState:{rows:[{route:'aerodrome-ve',protocol:'Aerodrome · veAERO'}]}}}};
const trackingSynthetic=buildAccountingCoverage({productivity:trackingProductivity,ledger:trackingLedger,embedded:{},factualEvidence:{ve33:{generatedAt:'2026-09-03T00:00:00.000Z',checkpoints:[{ok:true,company:'FutureCo.eth',protocolKey:'aerodrome',observedAt:'2026-09-03T00:00:00.000Z',checkpointKey:'future:aero:1'}]}},generatedAt:'2026-09-03T00:00:00.000Z'});
const trackedRow=trackingSynthetic.companies['FutureCo.eth'].mechanisms.aerodrome_veaero.months['2026-09'];
assert.equal(trackedRow.status,'factual-tracking-no-period-event');
assert.equal(trackedRow.factualTrackingActive,true);
assert.equal(trackedRow.factualEventCount,0);
assert.equal(trackingSynthetic.mechanisms.aerodrome_veaero.factualTrackingCompanyCount,1);
assert.equal(trackingSynthetic.mechanisms.aerodrome_veaero.factualEventCompanyCount,0);
assert.equal(trackingSynthetic.mechanisms.aerodrome_veaero.reusableCoverageGap,false,'zero-event tracked company became a false protocol gap');

// Same state without mechanism-specific factual checkpoint stays a real gap.
const stateOnlySynthetic=buildAccountingCoverage({productivity:trackingProductivity,ledger:trackingLedger,embedded:{},generatedAt:'2026-09-03T00:00:00.000Z'});
assert.equal(stateOnlySynthetic.companies['FutureCo.eth'].mechanisms.aerodrome_veaero.months['2026-09'].status,'state-observed-not-factual-tracking');
assert.equal(stateOnlySynthetic.mechanisms.aerodrome_veaero.reusableCoverageGap,true);

// Canonical staked-cvxCRV source identity must prove tracking, while malformed identity must fail closed.
const cvxCrvProductivity={generatedAt:'2026-09-04T18:55:00.000Z',engines:{convex_staked_cvxcrv:{protocol:'Convex'}},companies:{Cypher:{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'convex_staked_cvxcrv',value:146.45,engineStatus:'ok'}]}}};
const cvxCrvLedger={...emptyLedger,generatedAt:'2026-09-04T18:55:00.000Z',companies:{Cypher:{currentClaimableState:{rows:[{route:'convex-staked-cvxcrv',protocol:'Convex · staked cvxCRV'}]}}}};
const cvxCrvRewards={generatedAt:'2026-09-04T18:55:00.000Z',companies:{Cypher:{updatedAt:'2026-09-04T18:55:00.000Z',sources:[{route:'convex-staked-cvxcrv',protocol:'Convex · staked cvxCRV',status:'ok',metric:'CvxCrvStakingWrapper earned(account)',details:{rewardState:'Claimable',stateVersion:'synthetic:v1',rewardCount:1}}],rewards:[{route:'convex-staked-cvxcrv',protocol:'Convex · staked cvxCRV',classification:'unclaimed',amount:1}]}}};
const cvxCrvSynthetic=buildAccountingCoverage({productivity:cvxCrvProductivity,ledger:cvxCrvLedger,embedded:{},factualEvidence:{rewards:cvxCrvRewards},generatedAt:'2026-09-04T18:55:00.000Z'});
assert.equal(cvxCrvSynthetic.mechanisms.convex_staked_cvxcrv.factualTrackingCompanyCount,1,'canonical staked-cvxCRV source identity did not prove tracking');
assert.equal(cvxCrvSynthetic.mechanisms.convex_staked_cvxcrv.reusableCoverageGap,false,'canonical staked-cvxCRV source remained a false reusable gap');
const malformedCvxCrvRewards=structuredClone(cvxCrvRewards);
malformedCvxCrvRewards.companies.Cypher.sources[0].protocol='Convex-like';
const malformedCvxCrvSynthetic=buildAccountingCoverage({productivity:cvxCrvProductivity,ledger:cvxCrvLedger,embedded:{},factualEvidence:{rewards:malformedCvxCrvRewards},generatedAt:'2026-09-04T18:55:00.000Z'});
assert.equal(malformedCvxCrvSynthetic.mechanisms.convex_staked_cvxcrv.factualTrackingCompanyCount,0,'malformed staked-cvxCRV source identity gained tracking authority');
assert.equal(malformedCvxCrvSynthetic.mechanisms.convex_staked_cvxcrv.reusableCoverageGap,true,'malformed staked-cvxCRV source failed open');

// A recent canonical factual event also proves current in-period factual operation.
const syntheticLedger={generatedAt:'2026-09-03T00:00:00.000Z',semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},authority:{executionAuthority:'none',capitalExecution:false},events:[{eventKey:'future:curve:1',company:'FutureCo.eth',family:'accrued-entitlement',economicDate:'2026-09-03',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-03T00:00:00.000Z',protocol:'Curve',route:'veCRV fees',asset:'crvUSD',usdValue:1}],companies:{'FutureCo.eth':{currentClaimableState:{rows:[]}}}};
const syntheticProductivity={generatedAt:'2026-09-03T00:00:00.000Z',engines:{curve_vecrv:{protocol:'Curve'},future_unknown:{protocol:'Future Protocol'}},companies:{'FutureCo.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'curve_vecrv',value:100,engineStatus:'ok'},{engineId:'future_unknown',value:50,engineStatus:'ok'}]}}};
const synthetic=buildAccountingCoverage({productivity:syntheticProductivity,ledger:syntheticLedger,embedded:{},generatedAt:'2026-09-03T00:00:00.000Z'});
assert.equal(synthetic.summary.companyCount,1);
assert.ok(synthetic.companies['FutureCo.eth'],'future company was not auto-discovered');
assert.equal(synthetic.companies['FutureCo.eth'].mechanisms.curve_vecrv.months['2026-09'].status,'factual-period-evidence');
assert.equal(synthetic.mechanisms.curve_vecrv.reusableCoverageGap,false);
assert.equal(synthetic.companies['FutureCo.eth'].mechanisms.future_unknown.classified,false);
assert.ok(synthetic.companies['FutureCo.eth'].mechanisms.future_unknown.months['2026-09'].completionBlockers.includes('unclassified-income-mechanism'));
assert.equal(synthetic.summary.unclassifiedMechanismInstanceCount,1);

// Historical-alias regression.
const aliasLedger={generatedAt:'2026-09-03T00:00:00.000Z',semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},authority:{executionAuthority:'none',capitalExecution:false},events:[{eventKey:'alias:curve:1',company:'aerocrvyb.eth',family:'accrued-entitlement',economicDate:'2026-09-03',periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-03T00:00:00.000Z',protocol:'Curve',route:'veCRV fees',asset:'crvUSD',usdValue:1}],companies:{'aerocrvyb.eth':{currentClaimableState:{rows:[]}}}};
const aliasProductivity={generatedAt:'2026-09-03T00:00:00.000Z',engines:{curve_vecrv:{protocol:'Curve'}},companies:{'aerocvxyb.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'curve_vecrv',value:100,engineStatus:'ok'}]}}};
const aliasSynthetic=buildAccountingCoverage({productivity:aliasProductivity,ledger:aliasLedger,embedded:{},generatedAt:'2026-09-03T00:00:00.000Z'});
assert.equal(aliasSynthetic.summary.companyCount,1,'historical alias created duplicate company identity');
assert.ok(aliasSynthetic.companies['aerocvxyb.eth'],'canonical Company #006 missing after alias fold');
assert.equal(aliasSynthetic.companies['aerocrvyb.eth'],undefined,'old Company #006 alias survived as separate company');
assert.deepEqual(new Set(aliasSynthetic.companies['aerocvxyb.eth'].sourceAliases),new Set(['aerocrvyb.eth','aerocvxyb.eth']));
assert.equal(aliasSynthetic.companies['aerocvxyb.eth'].mechanisms.curve_vecrv.months['2026-09'].factualEventCount,1,'alias event lost during canonicalization');

for(const engineId of ['aerodrome_veaero','velodrome_vevelo','yieldbasis_veyb','frax_vefrax']){
  const m=data.mechanisms?.[engineId];
  if(!m)continue;
  assert.ok(m.factualTrackingCompanyCount>=m.factualEventCompanyCount,`${engineId} tracking coverage fell below event coverage`);
}

console.log('Accounting Coverage Registry v0.3 validation PASS',{
  companyCount:data.summary.companyCount,mechanismInstances:data.summary.mechanismInstanceCount,uniqueMechanisms:data.summary.uniqueMechanismCount,reusableCoverageGaps:data.summary.reusableCoverageGapCount,unclassified:data.summary.unclassifiedMechanismInstanceCount,unmatchedLedgerEvents:data.summary.unmatchedCanonicalEventCount,canonicalizedAliasCompanies:data.summary.canonicalizedAliasCompanyCount,factualTrackingProofs:data.summary.factualTrackingProofCount,currentMonth:data.currentMonth,futureCompanyAutoDiscovery:true,zeroEventTrackingDoesNotCreateFalseGap:true,stakedCvxCrvCanonicalIdentityProof:true,historicalAliasCannotCreatePhantomCompany:true,monthClosingAuthority:false
});
