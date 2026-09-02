#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import process from 'node:process';

const EVIDENCE_FILE=process.env.ICP_NNS_FACTUAL_SNAPSHOTS_FILE||'./reporting/icp-nns-factual-snapshots.json';
const INTERVALS_FILE=process.env.ICP_NNS_FACTUAL_INTERVALS_FILE||'/tmp/icp-nns-factual-intervals.json';
const evidence=JSON.parse(fs.readFileSync(EVIDENCE_FILE,'utf8'));
const result=JSON.parse(fs.readFileSync(INTERVALS_FILE,'utf8'));

assert.equal(evidence.version,'0.1-icp-nns-factual-snapshot-evidence');
assert.equal(evidence.status,'baseline-only-no-period-income');
assert.equal(evidence.semantics?.snapshotIsStateNotPeriodIncome,true);
assert.equal(evidence.semantics?.singleSnapshotCanCreateIncome,false);
assert.equal(evidence.semantics?.referenceAprCanCreateIncome,false);
assert.equal(evidence.semantics?.publicGlobalRewardPoolCanCreateCompanyIncome,false);
assert.equal(evidence.semantics?.ballotCountCanCreateIncome,false);
assert.equal(evidence.semantics?.principalUnlockIsIncome,false);
assert.equal(evidence.semantics?.unknownIsNotZero,true);
assert.equal(evidence.authority?.periodIncomeAuthority,false);
assert.equal(evidence.authority?.executionAuthority,'none');
assert.equal(evidence.authority?.walletAuthority,'none');
assert.equal(evidence.authority?.capitalExecution,false);

assert.equal(evidence.positionScope?.neuronUniverseCount,41);
assert.equal(evidence.positionScope?.neuronUniverseSha256,'2e42a298466afccc46a365173ca078bd50d0c45493d7674bb900c35bb5268711');
assert.equal(evidence.positionScope?.companies?.['0x5860...83CA8.eth'],0.5);
assert.equal(evidence.positionScope?.companies?.['aerocvxyb.eth'],0.5);

assert.equal(evidence.snapshots?.length,1,'Initial factual NNS evidence must remain a single baseline until another exact owner/read-only snapshot is supplied');
const baseline=evidence.snapshots[0];
assert.equal(baseline.snapshotId,'owner-nns-maturity-2026-07-04');
assert.equal(baseline.observationDate,'2026-07-04');
assert.equal(baseline.timestampPrecision,'date-only');
assert.equal(baseline.sourceType,'owner-manual-nns-dapp-snapshot');
assert.equal(baseline.evidenceStatus,'owner-attested-state-baseline');
assert.equal(baseline.maturity?.aggregateIcp,21.48);
assert.equal(baseline.periodIncomeAuthority,false);
assert.equal(baseline.valuation?.requiredForBaseline,false);

const unlock=(evidence.lifecycleEvents||[]).find(x=>x.eventType==='principal-unlock');
assert.ok(unlock,'Known first NNS principal unlock must be preserved as lifecycle evidence');
assert.equal(unlock.neuronId,'7305384784698965212');
assert.equal(unlock.amountIcp,61.3877551);
assert.equal(unlock.recognizedIncome,false);
assert.equal(unlock.affectsRewardStateComparability,false);

assert.equal(result.version,'0.1-icp-nns-factual-interval-evaluator');
assert.equal(result.status,'baseline-only-no-period-income');
assert.equal(result.referenceAprUsed,false);
assert.equal(result.accountingAuthority,false);
assert.equal(result.executionAuthority,'none');
assert.equal(result.snapshotCount,1);
assert.equal(result.intervalCount,0);
assert.equal(result.readyIntervalCount,0);
assert.equal(result.admissionCandidateCount,0);
assert.deepEqual(result.intervals,[]);
assert.deepEqual(result.admissionCandidates,[]);
assert.equal(result.invariants?.currentStateIsNotPeriodIncome,true);
assert.equal(result.invariants?.singleSnapshotCreatesZeroIncome,true);
assert.equal(result.invariants?.referenceAprCanNeverBackfillEarnedIncome,true);
assert.equal(result.invariants?.lifecycleDiscontinuityFailsClosed,true);
assert.equal(result.invariants?.unknownIsNotZero,true);

console.log('ICP NNS factual snapshot evidence validation PASS',{
  snapshotCount:result.snapshotCount,
  baselineMaturityIcp:baseline.maturity.aggregateIcp,
  intervalCount:result.intervalCount,
  admissionCandidateCount:result.admissionCandidateCount,
  referenceAprUsed:false,
  accountingAuthority:false
});
