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

// Company #006 has a proven historical public rename. The old name may remain
// in historical source artifacts but must never materialize as another company.
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
      assert.ok(['factual-period-evidence','state-observed-not-period-income','reference-only-no-period-evidence'].includes(row.status));
      if(row.factualEventCount===0)assert.ok(row.completionBlockers.includes('no-canonical-period-income-evidence'),`${name}/${m.engineId}/${month} eventless period lacks blocker`);
      if(row.status==='state-observed-not-period-income')assert.ok(row.completionBlockers.includes('current-state-is-not-period-income'));
      if(row.factualEventCount>0)assert.equal(row.status,'factual-period-evidence');
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
  assert.equal(m.factualCompanyCount,(m.factualCompanies||[]).length,`${engineId} factual company count drift`);
  assert.equal(m.stateOnlyCompanyCount,(m.stateOnlyCompanies||[]).length,`${engineId} state-only company count drift`);
  assert.equal(m.referenceOnlyCompanyCount,(m.referenceOnlyCompanies||[]).length,`${engineId} reference-only company count drift`);
  assert.equal(m.reusableCoverageGap,m.factualCompanyCount<m.activeCompanyCount,`${engineId} gap flag drift`);
}

const ranking=data.gapRanking||[];
assert.equal(ranking.length,data.summary.reusableCoverageGapCount,'gap ranking count drift');
for(let i=0;i<ranking.length;i++){
  assert.equal(ranking[i].rank,i+1,'gap rank sequence drift');
  assert.equal(data.mechanisms?.[ranking[i].engineId]?.reusableCoverageGap,true,'ranked mechanism is not a coverage gap');
  if(i>0){
    const a=ranking[i-1],b=ranking[i];
    assert.ok(a.activeCompanyCount>b.activeCompanyCount||
      (a.activeCompanyCount===b.activeCompanyCount&&Number(a.knownProductiveValueUsdTotal||0)>=Number(b.knownProductiveValueUsdTotal||0)),
      'gap ranking lost reusable/economic ordering');
  }
}

// Future-company acceptance: a new company using an already classified mechanism
// is discovered without modifying a hard-coded company registry.
const syntheticLedger={
  generatedAt:'2026-09-03T00:00:00.000Z',
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  events:[{
    eventKey:'future:curve:1',company:'FutureCo.eth',family:'accrued-entitlement',economicDate:'2026-09-03',
    periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-03T00:00:00.000Z',protocol:'Curve',route:'veCRV fees',asset:'crvUSD',usdValue:1
  }],
  companies:{'FutureCo.eth':{currentClaimableState:{rows:[]}}}
};
const syntheticProductivity={
  generatedAt:'2026-09-03T00:00:00.000Z',
  engines:{curve_vecrv:{protocol:'Curve'},future_unknown:{protocol:'Future Protocol'}},
  companies:{'FutureCo.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[
    {engineId:'curve_vecrv',value:100,engineStatus:'ok'},
    {engineId:'future_unknown',value:50,engineStatus:'ok'}
  ]}}
};
const synthetic=buildAccountingCoverage({productivity:syntheticProductivity,ledger:syntheticLedger,embedded:{},generatedAt:'2026-09-03T00:00:00.000Z'});
assert.equal(synthetic.summary.companyCount,1);
assert.ok(synthetic.companies['FutureCo.eth'],'future company was not auto-discovered');
assert.equal(synthetic.companies['FutureCo.eth'].mechanisms.curve_vecrv.months['2026-09'].status,'factual-period-evidence');
assert.equal(synthetic.companies['FutureCo.eth'].mechanisms.future_unknown.classified,false);
assert.ok(synthetic.companies['FutureCo.eth'].mechanisms.future_unknown.months['2026-09'].completionBlockers.includes('unclassified-income-mechanism'));
assert.equal(synthetic.summary.unclassifiedMechanismInstanceCount,1);

// Historical-alias regression: mixed canonical + old-name upstream inputs must
// collapse into one stable Company #006 identity rather than an 11th company.
const aliasLedger={
  generatedAt:'2026-09-03T00:00:00.000Z',
  semantics:{referenceAprCanBackfillEarnedIncome:false,unknownIsNotZero:true},
  authority:{executionAuthority:'none',capitalExecution:false},
  events:[{
    eventKey:'alias:curve:1',company:'aerocrvyb.eth',family:'accrued-entitlement',economicDate:'2026-09-03',
    periodStart:'2026-09-01T00:00:00.000Z',periodEnd:'2026-09-03T00:00:00.000Z',protocol:'Curve',route:'veCRV fees',asset:'crvUSD',usdValue:1
  }],
  companies:{'aerocrvyb.eth':{currentClaimableState:{rows:[]}}}
};
const aliasProductivity={
  generatedAt:'2026-09-03T00:00:00.000Z',
  engines:{curve_vecrv:{protocol:'Curve'}},
  companies:{'aerocvxyb.eth':{trackingStartedAt:'2026-09-01T00:00:00.000Z',breakdown:[{engineId:'curve_vecrv',value:100,engineStatus:'ok'}]}}
};
const aliasSynthetic=buildAccountingCoverage({productivity:aliasProductivity,ledger:aliasLedger,embedded:{},generatedAt:'2026-09-03T00:00:00.000Z'});
assert.equal(aliasSynthetic.summary.companyCount,1,'historical alias created duplicate company identity');
assert.ok(aliasSynthetic.companies['aerocvxyb.eth'],'canonical Company #006 missing after alias fold');
assert.equal(aliasSynthetic.companies['aerocrvyb.eth'],undefined,'old Company #006 alias survived as separate company');
assert.deepEqual(new Set(aliasSynthetic.companies['aerocvxyb.eth'].sourceAliases),new Set(['aerocrvyb.eth','aerocvxyb.eth']));
assert.equal(aliasSynthetic.companies['aerocvxyb.eth'].mechanisms.curve_vecrv.months['2026-09'].factualEventCount,1,'alias event lost during canonicalization');

console.log('Accounting Coverage Registry v0.2 validation PASS',{
  companyCount:data.summary.companyCount,
  mechanismInstances:data.summary.mechanismInstanceCount,
  uniqueMechanisms:data.summary.uniqueMechanismCount,
  reusableCoverageGaps:data.summary.reusableCoverageGapCount,
  unclassified:data.summary.unclassifiedMechanismInstanceCount,
  unmatchedLedgerEvents:data.summary.unmatchedCanonicalEventCount,
  canonicalizedAliasCompanies:data.summary.canonicalizedAliasCompanyCount,
  currentMonth:data.currentMonth,
  futureCompanyAutoDiscovery:true,
  historicalAliasCannotCreatePhantomCompany:true,
  monthClosingAuthority:false
});
