#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-reporting.yml';
const CONTRACT_PATH='reporting/reporting-scheduler-contract.json';
const RUNNER_PATH='reporting/reporting-scheduled-runner.mjs';
const RATE_POLICY_PATH='reporting/rate-continuity-policy.json';
const INCOME_POLICY_PATH='reporting/income-ledger-policy.json';
const FRAX_EVIDENCE_PATH='reporting/frax-yield-accounting-evidence.json';
const FRAX_BUILDER_PATH='reporting/frax-yield-accounting-evidence.mjs';
const FRAX_VALIDATION_PATH='reporting/frax-yield-accounting-evidence-validation.mjs';

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const contract=JSON.parse(fs.readFileSync(CONTRACT_PATH,'utf8'));
const runner=fs.readFileSync(RUNNER_PATH,'utf8');
const ratePolicy=JSON.parse(fs.readFileSync(RATE_POLICY_PATH,'utf8'));
const incomePolicy=JSON.parse(fs.readFileSync(INCOME_POLICY_PATH,'utf8'));
const fraxEvidence=JSON.parse(fs.readFileSync(FRAX_EVIDENCE_PATH,'utf8'));
const fraxBuilder=fs.readFileSync(FRAX_BUILDER_PATH,'utf8');
const fraxValidation=fs.readFileSync(FRAX_VALIDATION_PATH,'utf8');

assert.equal(contract.version,'0.1-reporting-scheduler-contract');
assert.equal(contract.status,'production');
assert.equal(contract.timezone,'UTC');
assert.equal(contract.cron,'31 6 * * *');
assert.equal(contract.dailySnapshotUtc,'06:31 UTC');
assert.equal(contract.epistemics?.naturalScheduleProofRequired,true);
assert.equal(contract.epistemics?.manualDispatchDoesNotProveSchedulerHealth,true);
assert.equal(contract.epistemics?.unknownIsNotZero,true);
for(const key of ['repositoryMutationAuthority','workflowDispatchAuthority','capitalExecution','walletAuthority','methodologyMutationAuthority']) assert.equal(contract.authority?.[key],false,`scheduler contract authority expansion: ${key}`);

assert.equal(ratePolicy.version,'0.1-reporting-rate-continuity');
assert.equal(ratePolicy.status,'production');
assert.equal(ratePolicy.semantics?.unknownIsNotZero,true);
assert.equal(ratePolicy.semantics?.singleSourceDataFailureMustNotFreezeWholeReport,true);
assert.equal(ratePolicy.semantics?.structuralIntegrityFailureRemainsFailClosed,true);
assert.equal(ratePolicy.semantics?.carryForwardIsCurrentVerification,false);
assert.equal(ratePolicy.semantics?.expiredOrUnprovenRateBecomesUnknown,true);
assert.equal(ratePolicy.authority?.executionAuthority,'none');
assert.equal(ratePolicy.authority?.methodologyMutationAuthority,'none');
assert.equal(ratePolicy.authority?.walletAuthority,'none');

assert.equal(incomePolicy.version,'0.1-canonical-income-ledger-policy');
assert.ok(['production-candidate','production'].includes(incomePolicy.status));
for(const key of ['eventEconomicFieldsImmutableAfterAdmission','claimOrWalletMovementDoesNotErasePriorIncome','currentClaimableBalanceIsStateNotPeriodIncome','claimableDecreaseDoesNotProveRealisedCashFlow','claimableIncreaseWithoutMechanismIdentityDoesNotProvePeriodIncome','missingClaimableRouteDoesNotMeanZero','embeddedIncomeRequiresAcceptedCanonicalInterval','realisedCashFlowRequiresMechanismSpecificProof','referenceAprCanNeverBackfillEarnedIncome','unknownIsNotZero','crossFamilySummationForbidden']) assert.equal(incomePolicy.rules?.[key],true,`income ledger policy drift: ${key}`);
assert.equal(incomePolicy.authority?.executionAuthority,'none');
assert.equal(incomePolicy.authority?.walletAuthority,'none');
assert.equal(incomePolicy.authority?.claimingAuthority,'none');
assert.equal(incomePolicy.authority?.capitalExecution,false);
assert.equal(incomePolicy.authority?.methodologyMutationAuthority,'none');

assert.equal(fraxEvidence.version,'0.1-frax-yield-factual-accrual-evidence');
assert.equal(fraxEvidence.mechanism,'frax-yield');
assert.equal(fraxEvidence.fullAccountingStart,'2026-09-01T00:00:00.000Z');
assert.equal(fraxEvidence.semantics?.openingBalanceCreatesIncome,false);
assert.equal(fraxEvidence.semantics?.claimIsSettlementNotSecondIncome,true);
assert.equal(fraxEvidence.semantics?.referenceAprUsed,false);
assert.equal(fraxEvidence.semantics?.laterPriceMovementRewritesClosedIncome,false);
assert.equal(fraxEvidence.semantics?.unknownIsNotZero,true);
assert.equal(fraxEvidence.authority?.executionAuthority,'none');
assert.equal(fraxEvidence.authority?.walletAuthority,'none');
assert.equal(fraxEvidence.authority?.claimingAuthority,'none');
assert.equal(fraxEvidence.authority?.capitalExecution,false);
assert.match(fraxBuilder,/closing earned \+ YieldCollected settlements - opening earned/,'Frax factual accrual formula missing');
assert.match(fraxBuilder,/currentClaimableBalanceIsPeriodIncome:false/,'Frax current-state accounting boundary missing');
assert.match(fraxBuilder,/claimIsSecondIncomeEvent:false/,'Frax claim settlement dedup missing');
assert.match(fraxBuilder,/laterClaimOrPriceMoveDoesNotRewriteIncome:true/,'Frax frozen income invariant missing');
assert.doesNotMatch(fraxBuilder,/referenceAprUsed\s*:\s*true|referenceApyUsed\s*:\s*true/i,'Frax builder gained APR/APY income authority');
assert.match(fraxValidation,/claim-to-zero of the opening balance creates no new income/i,'Frax claim reset regression test missing');

const exactCron=`- cron: '${contract.cron}'`;
assert.equal(workflow.split(exactCron).length-1,1,'Reporting workflow must contain exactly one canonical scheduler cron');
assert.match(workflow,/permissions:\n  contents: write/,'Reporting writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write/,'Reporting scheduler must not gain actions:write');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'Reporting production writer must not gain pull_request execution');
assert.match(workflow,/group:\s*reporting-daily/,'Reporting concurrency group drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'Reporting production writer must remain non-cancellable');
assert.match(workflow,/timeout-minutes:\s*10/,'Reporting Frax evidence runtime budget missing');
assert.match(workflow,/npm install --no-save --no-package-lock ethers@6/,'Frax accounting runtime dependency missing');
assert.match(workflow,/node reporting\/reporting-scheduled-runner\.mjs --validate-contract/,'Reporting scheduler contract preflight missing');
assert.match(workflow,/run: node reporting\/reporting-scheduled-runner\.mjs/,'Reporting production writer must execute the contract-bound runner');
assert.doesNotMatch(workflow,/gh workflow run|workflow_dispatch\s*\(/,'Reporting workflow gained dispatch behavior');

assert.match(workflow,/workflow_run:\n\s+workflows:\n\s+- "Update Company Rewards"\n\s+- "Update Stable Capital"\n\s+- "The Holding Capital · Unified Refresh"\n\s+types: \[completed\]/,'Reporting canonical workflow_run sources drift');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/,'Reporting workflow_run success gate missing');
assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/,'Reporting workflow_run main-branch gate missing');
assert.match(workflow,/ref: main/,'Reporting must consume canonical main');
for(const source of ['companies/rewards-data.json','companies/stable-index-data.json','companies/embedded-yield-ledger.json','companies/productivity-data.json','companies/defitea-canonical-state.json','intelligence/realised-cash-flow/realised-cash-flow.json']) assert.ok(workflow.includes(`- '${source}'`),`Reporting freshness source missing: ${source}`);
for(const source of ['reporting/rate-continuity-policy.json','reporting/income-ledger-policy.json','reporting/reporting-engine.mjs','reporting/reporting-engine-validation.mjs','reporting/income-ledger.mjs','reporting/income-ledger-validation.mjs','reporting/frax-yield-accounting-evidence.mjs','reporting/frax-yield-accounting-evidence-validation.mjs','reporting/frax-yield-accounting-evidence.json']) assert.ok(workflow.includes(`- '${source}'`),`Reporting deterministic code/policy wake missing: ${source}`);

assert.match(workflow,/test -s reporting\/rate-continuity-policy\.json/,'Reporting rate continuity policy preflight missing');
assert.match(workflow,/test -s reporting\/income-ledger-policy\.json/,'Canonical Income Ledger policy preflight missing');
assert.match(workflow,/test -s reporting\/frax-yield-accounting-evidence\.json/,'Frax evidence preflight missing');
assert.match(workflow,/test -s intelligence\/realised-cash-flow\/realised-cash-flow\.json/,'Canonical Realised Cash Flow source preflight missing');
assert.match(workflow,/node reporting\/income-ledger-validation\.mjs/,'Canonical Income Ledger validation missing');
assert.match(workflow,/node reporting\/frax-yield-accounting-evidence-validation\.mjs/,'Frax evidence validation missing');
assert.match(workflow,/name: Build Frax veFRAX factual accrual evidence/,'Frax factual accrual build step missing');
assert.match(workflow,/run: node reporting\/frax-yield-accounting-evidence\.mjs/,'Frax factual accrual writer execution missing');
assert.match(workflow,/FRAXTAL_RPC_URL:\s*\$\{\{ secrets\.FRAXTAL_RPC_URL \}\}/,'Frax RPC secret/fallback binding missing');
assert.match(workflow,/name: Build Canonical Income Ledger/,'Canonical Income Ledger build step missing');
assert.match(workflow,/run: node reporting\/income-ledger\.mjs/,'Canonical Income Ledger writer execution missing');
assert.match(workflow,/FRAX_YIELD_EVIDENCE_FILE:\s*\.\/reporting\/frax-yield-accounting-evidence\.json/,'Frax evidence runtime binding missing');
assert.match(workflow,/INCOME_LEDGER_FILE:\s*\.\/reporting\/income-ledger\.json/,'Canonical Income Ledger runtime output binding missing');
assert.match(workflow,/git add reporting\/reporting-data\.json reporting\/defitea-income-ledger\.json reporting\/frax-yield-accounting-evidence\.json reporting\/income-ledger\.json/,'Canonical Income Ledger + Frax publication staging missing');
assert.match(workflow,/critical_fingerprint\(\)/,'Reporting race critical fingerprint missing');
assert.match(workflow,/reporting\/frax-yield-accounting-evidence\.mjs/,'Frax evidence builder missing from critical fingerprint');
assert.match(workflow,/Critical Reporting code\/policy changed during publish rebase; fail closed/,'Reporting rebase code-drift fail-closed guard missing');
assert.match(workflow,/node reporting\/frax-yield-accounting-evidence\.mjs\n\s+node reporting\/income-ledger\.mjs\n\s+node reporting\/reporting-engine-validation\.mjs/,'Reporting rebase must rebuild Frax evidence before Income Ledger validation');
assert.match(workflow,/Unexpected Reporting publish delta after rebase/,'Reporting post-rebase publish scope guard missing');
assert.match(workflow,/reporting\/frax-yield-accounting-evidence\.json\|reporting\/income-ledger\.json/,'Frax evidence missing from safe publish scope');
assert.match(workflow,/RATE_CONTINUITY_POLICY_FILE:\s*\.\/reporting\/rate-continuity-policy\.json/,'Reporting rate continuity runtime binding missing');

assert.match(runner,/reporting-scheduler-contract\.json/,'scheduled runner is not bound to scheduler contract');
assert.match(runner,/reporting-engine\.mjs/,'scheduled runner is not bound to existing Reporting engine');
assert.match(runner,/manualDispatchDoesNotProveSchedulerHealth/,'scheduled runner lost natural-schedule epistemic guard');
assert.match(runner,/contractSource:\s*'reporting\/reporting-scheduler-contract\.json'/,'generated Reporting contract provenance missing');
assert.doesNotMatch(runner,/gh workflow run|actions:\s*write|sendTransaction\(|new Wallet\(/,'scheduled runner authority expansion');

const upstreamMinutes=contract.upstreamSequence.map(x=>{const m=/^(\d{2}):(\d{2}) UTC$/.exec(String(x.nominalUtc||''));assert.ok(m,`invalid upstream time for ${x.workflow}`);return Number(m[1])*60+Number(m[2]);});
const reportingMinutes=6*60+31;
assert.ok(upstreamMinutes.every(x=>x<reportingMinutes),'Reporting schedule no longer follows declared upstream sequence');

console.log('Reporting workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  cron:contract.cron,
  dailySnapshotUtc:contract.dailySnapshotUtc,
  workflowRunSources:['Update Company Rewards','Update Stable Capital','The Holding Capital · Unified Refresh'],
  canonicalDataWakeCount:6,
  rateContinuityPolicy:ratePolicy.version,
  canonicalIncomeLedgerPolicy:incomePolicy.version,
  fraxFactualAccrualEvidence:fraxEvidence.version,
  fraxFullAccountingStart:fraxEvidence.fullAccountingStart,
  fraxClaimAware:true,
  fraxOpeningBalanceExcluded:true,
  fraxLaterPriceRevaluationExcluded:true,
  singleSourceFailureIsolation:true,
  appendOnlyIncomeHistory:true,
  stateOnlyClaimableSnapshots:true,
  rebaseRebuildGuard:true,
  productionWriterPullRequestAuthority:false,
  workflowDispatchAuthority:false,
  concurrency:'reporting-daily/non-cancellable',
  naturalScheduleProofRequired:true
});
