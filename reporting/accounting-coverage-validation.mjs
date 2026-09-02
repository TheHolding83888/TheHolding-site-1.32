#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';

const FILE=process.env.ACCOUNTING_COVERAGE_FILE||'./reporting/accounting-coverage.json';
const data=JSON.parse(fs.readFileSync(FILE,'utf8'));

assert.equal(data.version,'0.1-accounting-mechanism-coverage-registry');
assert.equal(data.status,'diagnostic-no-completion-authority');
assert.equal(data.semantics?.productivityCoverageIsNotAccountingCoverage,true);
assert.equal(data.semantics?.referenceMetricIsNotEarnedIncome,true);
assert.equal(data.semantics?.currentRewardStateIsNotPeriodIncome,true);
assert.equal(data.semantics?.factualEvidenceDoesNotImplyFullMechanismCoverage,true);
assert.equal(data.semantics?.partialEvidenceDoesNotCloseMonth,true);
assert.equal(data.semantics?.unknownIsNotZero,true);
assert.equal(data.completionPolicy?.registryHasMonthClosingAuthority,false);
assert.equal(data.authority?.executionAuthority,'none');
assert.equal(data.authority?.walletAuthority,'none');
assert.equal(data.authority?.capitalExecution,false);
assert.equal(data.authority?.monthClosingAuthority,false);
assert.equal(data.authority?.methodologyMutationAuthority,'none');

const companies=data.companies||{};
assert.equal(Object.keys(companies).length,10,'coverage registry must contain all 10 companies');
assert.equal(data.summary?.companyCount,10);
assert.ok(Number(data.summary?.mechanismCount)>0,'coverage registry has no mechanisms');
assert.equal(data.summary?.unclassifiedMechanismCount,0,'every currently admitted productive mechanism must be explicitly classified before this registry can ship');
assert.equal(data.summary?.classifiedMechanismCount,data.summary?.mechanismCount);

for(const [name,c] of Object.entries(companies)){
  assert.ok(c.registry,'company registry missing '+name);
  assert.equal(c.executionAuthority,'none');
  const mechanisms=Object.values(c.mechanisms||{});
  assert.equal(mechanisms.length,c.mechanismCount,`${name} mechanism count drift`);
  for(const m of mechanisms){
    assert.ok(['accrued-entitlement','embedded-income'].includes(m.accountingFamily),`${name}/${m.engineId} accounting family unclassified`);
    assert.equal(m.referenceMetricIsAccountingAuthority,false,`${name}/${m.engineId} reference metric gained accounting authority`);
    assert.ok(Array.isArray(m.accountingRouteHints)&&m.accountingRouteHints.length>0,`${name}/${m.engineId} route hints missing`);
    for(const [month,row] of Object.entries(m.months||{})){
      assert.equal(row.mechanismCompleteForMonth,false,`${name}/${m.engineId}/${month} diagnostic registry falsely completed mechanism`);
      assert.equal(typeof row.companyMonthAccountingComplete,'boolean');
      assert.ok(Array.isArray(row.completionBlockers));
      if(row.factualEventCount===0) assert.ok(row.completionBlockers.includes('no-canonical-period-income-evidence')||row.status==='no-accepted-period-intervals',`${name}/${m.engineId}/${month} no evidence without blocker`);
      if(row.status==='state-observed-not-period-income') assert.ok(row.completionBlockers.includes('current-state-is-not-period-income'));
    }
  }
  for(const [month,row] of Object.entries(c.months||{})){
    assert.equal(row.registryCompletionAuthority,false,`${name}/${month} diagnostic registry gained close authority`);
    if(row.legacyVerifiedRealisedArchive===true){
      assert.equal(name,'defitea.eth');
      assert.ok(month<='2026-07');
      assert.equal(row.registryReadyToCloseMonth,true);
      assert.deepEqual(row.blockers,[]);
    }else{
      assert.equal(row.registryReadyToCloseMonth,false,`${name}/${month} non-legacy month falsely ready to close`);
    }
  }
}

const y=companies['YieldRing.eth'];
assert.deepEqual(new Set(Object.keys(y.mechanisms||{})),new Set(['aerodrome_veaero','convex_vlcvx','frax_vefrax']),'YieldRing mechanism inventory drift');
assert.equal(y.months?.['2026-08']?.registryReadyToCloseMonth,false,'YieldRing August must remain open');

const nine=companies['1milliondollar.eth'];
const beefy=nine?.mechanisms?.beefy_cvxcrv?.months?.['2026-08'];
assert.ok(beefy,'Company #009 Beefy August coverage missing');
assert.ok(beefy.factualEventCount>0,'Company #009 factual Beefy evidence not detected');
assert.ok(Number(beefy.factualUsdSubtotal)>0,'Company #009 factual Beefy USD subtotal missing');
assert.equal(nine.months?.['2026-08']?.registryReadyToCloseMonth,false,'Company #009 August must remain open despite Beefy evidence');

const monetra=companies['Monetra.eth'];
assert.ok(monetra.mechanismCount>0,'Monetra embedded mechanisms missing');
assert.equal(monetra.mechanismInventorySource,'companies/embedded-yield-ledger.json');
assert.equal(monetra.months?.['2026-08']?.registryReadyToCloseMonth,false,'Monetra first tracking month must remain open');

for(const month of ['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07']){
  assert.equal(companies['defitea.eth']?.months?.[month]?.legacyVerifiedRealisedArchive,true,`Defitea legacy archive lost ${month}`);
}
assert.equal(companies['defitea.eth']?.months?.['2026-08']?.registryReadyToCloseMonth,false,'Defitea August mixed accounting must remain open');

console.log('Accounting Coverage Registry validation PASS',{
  companyCount:data.summary.companyCount,
  mechanismCount:data.summary.mechanismCount,
  classifiedMechanismCount:data.summary.classifiedMechanismCount,
  company009BeefyAugustUsd:beefy.factualUsdSubtotal,
  yieldRingAugustReady:false,
  defiteaLegacyVerifiedThrough:'2026-07',
  monthClosingAuthority:false
});
