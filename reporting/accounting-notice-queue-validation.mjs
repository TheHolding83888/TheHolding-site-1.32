#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';

const FILE=process.env.ACCOUNTING_NOTICE_QUEUE_FILE||'./reporting/accounting-notice-queue.json';
const ICP_FILE=process.env.ICP_NNS_FACTUAL_SNAPSHOTS_FILE||'./reporting/icp-nns-factual-snapshots.json';
const q=JSON.parse(fs.readFileSync(FILE,'utf8'));
const icp=JSON.parse(fs.readFileSync(ICP_FILE,'utf8'));
const categories=new Set(['missing-capability','tracking-no-period-event','period-lifecycle-reconciliation','reference-vs-factual-divergence']);
const finite=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v));
const BOUNDARY_REASON='period-boundary-evidence-pending-no-exact-month-cut';

assert.equal(q.version,'0.2-accounting-notice-queue-boundary-evidence-pending');
assert.equal(q.status,'diagnostic-no-completion-authority');
assert.match(q.currentMonth,/^\d{4}-\d{2}$/);
assert.equal(q.semantics?.sourceOfTruth,false);
assert.equal(q.semantics?.canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority,true);
assert.equal(q.semantics?.estimatedIncomeIsFactualIncome,false);
assert.equal(q.semantics?.estimatedIncomeCanCloseAccountingCoverage,false);
assert.equal(q.semantics?.confirmedPlusEstimatedIsValidTotal,false);
assert.equal(q.semantics?.deltaIsMissingIncome,false);
assert.equal(q.semantics?.trackingNoPeriodEventIsError,false);
assert.equal(q.semantics?.ownerDataPendingIsEngineeringFailure,false);
assert.equal(q.semantics?.boundaryEvidencePendingIsEngineeringFailure,false);
assert.equal(q.semantics?.crossMonthIntervalProrationAllowed,false);
assert.equal(q.semantics?.boundaryEvidencePendingCanCloseAccountingCoverage,false);
assert.equal(q.semantics?.unknownIsNotZero,true);
assert.equal(q.authority?.readOnly,true);
assert.equal(q.authority?.sourceOfTruth,false);
assert.equal(q.authority?.incomeCreationAuthority,false);
assert.equal(q.authority?.factualIncomeAuthority,false);
assert.equal(q.authority?.monthClosingAuthority,false);
assert.equal(q.authority?.canReplaceUnknown,false);
assert.equal(q.authority?.methodologyMutationAuthority,'none');
assert.equal(q.authority?.walletAuthority,'none');
assert.equal(q.authority?.capitalExecution,false);
assert.equal(q.authority?.executionAuthority,'none');
assert.ok(Array.isArray(q.rows));
assert.equal(new Set(q.rows.map(x=>x.id)).size,q.rows.length,'queue row identities must be unique');

for(const row of q.rows){
  assert.ok(categories.has(row.category),`unknown category ${row.category}`);
  assert.equal(row.sourceOfTruth,false,`${row.id} became source of truth`);
  assert.equal(row.incomeCreationAuthority,false,`${row.id} gained income authority`);
  assert.equal(row.monthClosingAuthority,false,`${row.id} gained month-closing authority`);
  assert.equal(row.canReplaceUnknown,false,`${row.id} can replace UNKNOWN`);
  assert.equal(row.executionAuthority,'none',`${row.id} execution authority drift`);
  assert.equal(row.month,q.currentMonth,`${row.id} month drift`);
  if(row.category==='missing-capability'){
    assert.equal(row.engineeringActionable,true,`${row.id} missing capability not actionable`);
    assert.equal(row.blocker,'missing-factual-tracking-capability');
    assert.notEqual(row.factualTrackingActive,true,`${row.id} missing capability already has factual tracking`);
  }
  if(row.category==='tracking-no-period-event'){
    assert.equal(row.engineeringActionable,false,`${row.id} normal no-event cadence became engineering work`);
    assert.equal(row.factualTrackingActive,true,`${row.id} no-event row lacks tracking`);
    assert.equal(Number(row.factualEventCount||0),0,`${row.id} no-event row has factual event`);
  }
  if(row.blocker==='owner-data-pending'){
    assert.equal(row.mechanism,'icp_nns');
    assert.equal(row.parked,true);
    assert.equal(row.engineeringActionable,false);
    assert.equal(row.action,'await-owner-factual-snapshot');
  }
  if(row.blocker==='historical-boundary-evidence-pending'){
    assert.equal(row.scope,'company-period',`${row.id} boundary evidence pending must remain company-period lifecycle state`);
    assert.equal(row.category,'period-lifecycle-reconciliation');
    assert.equal(row.parked,true,`${row.id} boundary evidence pending must be parked`);
    assert.equal(row.engineeringActionable,false,`${row.id} unavailable exact boundary leaked into engineering backlog`);
    assert.equal(row.action,'await-exact-boundary-evidence-no-proration');
    assert.equal(row.boundaryEvidencePending,true);
    assert.equal(row.prorationAllowed,false);
    assert.ok(Number(row.unresolvedEventCount||0)>0,`${row.id} boundary evidence pending without unresolved events`);
    assert.ok(Array.isArray(row.unresolvedReasons)&&row.unresolvedReasons.length>0,`${row.id} boundary reasons missing`);
    assert.ok(row.unresolvedReasons.every(reason=>reason===BOUNDARY_REASON),`${row.id} mixed lifecycle reasons cannot be parked as exact-cut evidence pending`);
  }
  if(row.category==='reference-vs-factual-divergence'){
    assert.equal(row.scope,'company-period');
    assert.equal(row.engineeringActionable,false);
    assert.ok(finite(row.confirmedUsd)&&finite(row.estimatedUsd)&&finite(row.deltaUsd),`${row.id} comparison amounts incomplete`);
    assert.ok(Math.abs(Number(row.deltaUsd)-(Number(row.estimatedUsd)-Number(row.confirmedUsd)))<1e-7,`${row.id} delta arithmetic drift`);
  }
}

const count=category=>q.rows.filter(x=>x.category===category).length;
assert.equal(q.summary?.rowCount,q.rows.length);
assert.equal(q.summary?.engineeringActionableCount,q.rows.filter(x=>x.engineeringActionable).length);
assert.equal(q.summary?.parkedCount,q.rows.filter(x=>x.parked).length);
assert.equal(q.summary?.missingCapabilityCount,count('missing-capability'));
assert.equal(q.summary?.trackingNoPeriodEventCount,count('tracking-no-period-event'));
assert.equal(q.summary?.periodLifecycleReconciliationCount,count('period-lifecycle-reconciliation'));
assert.equal(q.summary?.referenceVsFactualDivergenceCount,count('reference-vs-factual-divergence'));
assert.equal(q.summary?.ownerDataPendingCount,q.rows.filter(x=>x.blocker==='owner-data-pending').length);
assert.equal(q.summary?.boundaryEvidencePendingCount,q.rows.filter(x=>x.blocker==='historical-boundary-evidence-pending').length);

if(icp.status==='baseline-only-no-period-income'&&Array.isArray(icp.snapshots)&&icp.snapshots.length<2){
  const icpRows=q.rows.filter(x=>x.mechanism==='icp_nns');
  assert.ok(icpRows.length>0,'baseline-only ICP evidence must be visible as owner-data-pending when ICP mechanisms are active');
  assert.ok(icpRows.every(x=>x.blocker==='owner-data-pending'&&x.engineeringActionable===false),'ICP pending owner evidence leaked into engineering backlog');
}

console.log('Accounting Notice Queue validation PASS',q.summary);
