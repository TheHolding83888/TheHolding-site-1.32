#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-monthly-reports.yml';
const SCOPE_PATH='reporting/company-income-scope.mjs';
const RECOGNITION_VIEW_PATH='reporting/canonical-earned-income-view.mjs';
const MONTHLY_ACCOUNTING_PATH='reporting/company-monthly-earned-income.mjs';
const COVERAGE_PATH='reporting/accounting-coverage.mjs';
const NOTICE_PATH='reporting/accounting-notice-queue.mjs';
const RECONCILIATION_PATH='reporting/accounting-reference-reconciliation.mjs';
const PASSPORT_PATH='companies/company-passport-priority-adapter.js';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const scope=fs.readFileSync(SCOPE_PATH,'utf8');
const recognitionView=fs.readFileSync(RECOGNITION_VIEW_PATH,'utf8');
const monthlyAccounting=fs.readFileSync(MONTHLY_ACCOUNTING_PATH,'utf8');
const coverage=fs.readFileSync(COVERAGE_PATH,'utf8');
const notice=fs.readFileSync(NOTICE_PATH,'utf8');
const reconciliation=fs.readFileSync(RECONCILIATION_PATH,'utf8');
const passport=fs.readFileSync(PASSPORT_PATH,'utf8');

assert.match(workflow,/^name: Update Company Monthly Reports/m,'monthly reports workflow identity drift');
assert.match(workflow,/permissions:\n  contents: write/,'monthly reports writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write/,'monthly reports must not gain actions:write');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'monthly reports production writer must not gain pull_request execution');
assert.match(workflow,/group:\s*company-monthly-reports-daily/,'monthly reports concurrency group drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'monthly reports writer must remain non-cancellable');
assert.match(workflow,/workflow_run:\n\s+workflows:\n\s+- "Update The Holding Reporting Data"\n\s+types: \[completed\]/,'monthly reports canonical Reporting handoff missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/,'monthly workflow_run success gate missing');
assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/,'monthly workflow_run main-branch gate missing');
assert.match(workflow,/ref: main/,'monthly reports must consume canonical main');
assert.ok(workflow.includes("- 'companies/productivity-data.json'"),'monthly reports Productivity materialization wake missing');
assert.ok(workflow.includes("- 'reporting/income-ledger.json'"),'monthly reports Income Ledger materialization wake missing');
assert.ok(workflow.includes("- 'reporting/reporting-data.json'"),'monthly reports Reporting materialization wake missing');
assert.ok(workflow.includes("- 'reporting/company-income-scope.mjs'"),'monthly reports economic scope code wake missing');
assert.ok(workflow.includes("- 'reporting/canonical-earned-income-view.mjs'"),'monthly reports canonical recognition-view code wake missing');
assert.ok(workflow.includes("- 'reporting/accounting-coverage.mjs'"),'monthly reports Coverage code wake missing');
assert.ok(workflow.includes("- 'reporting/accounting-coverage-validation.mjs'"),'monthly reports Coverage validation wake missing');
assert.ok(workflow.includes("- 'reporting/accounting-reference-reconciliation.mjs'"),'monthly reports reconciliation code wake missing');
assert.ok(workflow.includes("- cron: '37 7 * * *'"),'monthly reports fallback heartbeat missing');
assert.match(workflow,/test -s reporting\/income-ledger\.json/,'monthly reports canonical income ledger preflight missing');
assert.match(workflow,/test -s reporting\/reporting-data\.json/,'monthly reports Reporting preflight missing');
assert.match(workflow,/node --check reporting\/company-income-scope\.mjs/,'monthly reports economic scope preflight missing');
assert.match(workflow,/node --check reporting\/canonical-earned-income-view\.mjs/,'monthly reports canonical recognition-view preflight missing');
assert.match(workflow,/node --check reporting\/accounting-coverage\.mjs/,'monthly reports Coverage preflight missing');
assert.match(workflow,/node --check reporting\/accounting-coverage-validation\.mjs/,'monthly reports Coverage validation preflight missing');
assert.match(workflow,/node --check reporting\/accounting-reference-reconciliation\.mjs/,'monthly reports reconciliation preflight missing');
assert.match(workflow,/INCOME_LEDGER_FILE:\s*\.\/reporting\/income-ledger\.json/,'monthly reports canonical income ledger runtime binding missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports\.mjs/,'monthly reference scaffold builder missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports-validation\.mjs/,'monthly reference scaffold validator missing');
assert.match(workflow,/run: node reporting\/company-monthly-earned-income\.mjs/,'monthly earned-income accounting projection missing');
assert.match(workflow,/run: node reporting\/company-monthly-earned-income-validation\.mjs/,'monthly earned-income accounting validation missing');
assert.match(workflow,/node reporting\/accounting-coverage\.mjs/,'monthly accounting Coverage projection missing');
assert.match(workflow,/node reporting\/accounting-coverage-validation\.mjs/,'monthly accounting Coverage validation missing');
assert.match(workflow,/node reporting\/accounting-notice-queue\.mjs/,'monthly accounting notice projection missing');
assert.match(workflow,/node reporting\/accounting-reference-reconciliation\.mjs/,'monthly reconciliation projection missing');
assert.match(workflow,/node reporting\/accounting-reference-reconciliation-validation\.mjs/,'monthly reconciliation validation missing');
assert.doesNotMatch(workflow,/gh workflow run|workflow_dispatch\s*\(/,'monthly reports workflow gained dispatch behavior');

const firstCoverageBuild=workflow.indexOf('node reporting/accounting-coverage.mjs');
const firstCoverageValidation=workflow.indexOf('node reporting/accounting-coverage-validation.mjs');
const firstNoticeBuild=workflow.indexOf('node reporting/accounting-notice-queue.mjs');
const firstReconciliationBuild=workflow.indexOf('node reporting/accounting-reference-reconciliation.mjs');
assert.ok(firstCoverageBuild>=0&&firstCoverageValidation>firstCoverageBuild,'monthly diagnostics Coverage build/validation order missing');
assert.ok(firstNoticeBuild>firstCoverageValidation,'Notice Queue must consume freshly validated Coverage');
assert.ok(firstReconciliationBuild>firstNoticeBuild,'Reconciliation must run after fresh Coverage and Notice Queue');

assert.match(workflow,/critical_fingerprint\(\)/,'monthly writer critical fingerprint missing');
assert.match(workflow,/reporting\/company-income-scope\.mjs/,'monthly writer economic scope fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-reports\.mjs/,'monthly writer builder fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-reports-validation\.mjs/,'monthly writer scaffold validator fingerprint missing');
assert.match(workflow,/reporting\/canonical-earned-income-view\.mjs/,'monthly writer canonical recognition-view fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-earned-income\.mjs/,'monthly writer earned-income fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-earned-income-validation\.mjs/,'monthly writer earned-income validator fingerprint missing');
assert.match(workflow,/reporting\/accounting-coverage\.mjs/,'monthly writer Coverage fingerprint missing');
assert.match(workflow,/reporting\/accounting-coverage-validation\.mjs/,'monthly writer Coverage validator fingerprint missing');
assert.match(workflow,/reporting\/accounting-notice-queue\.mjs/,'monthly writer notice queue fingerprint missing');
assert.match(workflow,/reporting\/accounting-reference-reconciliation\.mjs/,'monthly writer reconciliation fingerprint missing');
assert.match(workflow,/reporting\/accounting-reference-reconciliation-validation\.mjs/,'monthly writer reconciliation validator fingerprint missing');
assert.match(workflow,/companies\/company-passport-priority-adapter\.js/,'monthly writer Passport presentation fingerprint missing');
assert.match(workflow,/Critical Company Monthly Reports code changed during publish rebase; fail closed/,'monthly writer code-race fail-closed guard missing');
assert.match(workflow,/PRODUCTIVITY_DATA_FILE=\.\/companies\/productivity-data\.json[\s\S]*INCOME_LEDGER_FILE=\.\/reporting\/income-ledger\.json[\s\S]*node reporting\/company-monthly-reports\.mjs/,'monthly writer post-rebase canonical scaffold rebuild missing');
assert.match(workflow,/COMPANY_MONTHLY_REPORTS_FILE=\.\/reporting\/company-monthly-reports\.json[\s\S]*INCOME_LEDGER_FILE=\.\/reporting\/income-ledger\.json[\s\S]*node reporting\/company-monthly-earned-income\.mjs/,'monthly writer post-rebase earned-income rebuild missing');
assert.match(workflow,/PRODUCTIVITY_DATA_FILE=\.\/companies\/productivity-data\.json[\s\S]*ACCOUNTING_COVERAGE_FILE=\.\/reporting\/accounting-coverage\.json[\s\S]*node reporting\/accounting-coverage\.mjs[\s\S]*node reporting\/accounting-coverage-validation\.mjs[\s\S]*node reporting\/accounting-notice-queue\.mjs[\s\S]*node reporting\/accounting-reference-reconciliation\.mjs/,'monthly writer post-rebase diagnostic dependency rebuild missing');
assert.match(workflow,/ACCOUNTING_REFERENCE_RECONCILIATION_FILE=\.\/reporting\/accounting-reference-reconciliation\.json[\s\S]*node reporting\/accounting-reference-reconciliation\.mjs/,'monthly writer post-rebase reconciliation rebuild missing');
assert.match(workflow,/git diff --name-only origin\/main\.\.\.HEAD/,'monthly writer post-rebase delta guard missing');
assert.match(workflow,/git add reporting\/company-monthly-reports\.json reporting\/accounting-coverage\.json reporting\/accounting-notice-queue\.json reporting\/accounting-reference-reconciliation\.json/,'monthly writer generated diagnostic snapshot add-set missing');
assert.match(workflow,/reporting\/company-monthly-reports\.json/,'monthly writer generated monthly output allowlist missing');
assert.match(workflow,/reporting\/accounting-coverage\.json/,'monthly writer generated Coverage output allowlist missing');
assert.match(workflow,/reporting\/accounting-notice-queue\.json/,'monthly writer generated notice output allowlist missing');
assert.match(workflow,/reporting\/accounting-reference-reconciliation\.json/,'monthly writer generated reconciliation output allowlist missing');

for(const required of [
  "'YieldRing.eth'",
  "'05081966.eth'",
  'includeAssociatedConfirmed: true',
  'includeAssociatedEstimated: true',
  'includeAssociatedCapital: false',
  'canonicalOwnershipPreserved: true',
  'crossCompanyReattributionAllowed: false',
  'holdingWideAggregationMustUseCanonicalOwners: true'
]){
  assert.ok(scope.includes(required),`economic reporting scope invariant missing: ${required}`);
}

for(const required of [
  'canonicalLedgerIsSoleMonthlyIncomeEventSource: true',
  'canonicalCompanyOwnsIncomeExclusively: true',
  'crossCompanyEarnedIncomeReattributionForbidden: true',
  'explicitEconomicReportingScopeMayAggregateCanonicalOwnersForPresentation: true',
  'holdingWideAggregationMustUseCanonicalOwners: true',
  'monthlyLayerCreatesIncomeEvents: false',
  'claimableSnapshotDeltaCreatesIncome: false',
  'genericReceiptCreatesIncome: false',
  'accruedIncomeMayBeEarnedBeforeClaim: true',
  'embeddedCompoundingMayBeEarnedIncome: true',
  'settlementDoesNotReRecognizeEarnedIncome: true',
  'laterPriceMovementRewritesClosedIncome: false',
  'confirmedAndEstimatedAreNonAdditive: true',
  'estimatedIncomeCanCloseAccountingCoverage: false',
  'estimatedIncomeCanReplaceUnknown: false'
]){
  assert.ok(monthlyAccounting.includes(required),`monthly accounting invariant missing: ${required}`);
}
assert.ok(monthlyAccounting.includes("source: 'reporting/income-ledger.json'"),'monthly accounting canonical source binding missing');
assert.ok(monthlyAccounting.includes('claimableSnapshotDerivedIncomeEventCount: 0'),'monthly accounting reward snapshot discovery guard missing');
assert.ok(monthlyAccounting.includes('monthlyIncomeEventDiscoveryAuthority: false'),'monthly accounting discovery authority guard missing');
assert.ok(monthlyAccounting.includes('referenceScaffold'),'monthly accounting daily reference scaffold freeze missing');
assert.ok(monthlyAccounting.includes('scopeComponents'),'monthly accounting estimated component provenance missing');
assert.ok(monthlyAccounting.includes('associatedCompanyCapitalIncluded: false'),'monthly accounting associated capital exclusion missing');
assert.ok(recognitionView.includes("status: 'recognized'"),'canonical recognition view recognized lifecycle missing');
assert.ok(recognitionView.includes("status: 'settlement-only'"),'canonical recognition view settlement lifecycle missing');
assert.ok(recognitionView.includes("status: 'unresolved'"),'canonical recognition view unresolved lifecycle missing');

for(const required of [
  'canonicalLedgerIsSoleFactualIncomeAuthority:true',
  'factualTrackingProofIsNotPeriodIncome:true',
  'unknownIsNotZero:true',
  "executionAuthority:'none'"
]){
  assert.ok(coverage.includes(required),`accounting Coverage authority boundary missing: ${required}`);
}

for(const required of [
  'sourceOfTruth:false',
  'incomeCreationAuthority:false',
  'monthClosingAuthority:false',
  'canReplaceUnknown:false',
  "executionAuthority:'none'"
]){
  assert.ok(notice.includes(required),`accounting notice diagnostic boundary missing: ${required}`);
}
for(const required of [
  'canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority:true',
  'referenceEstimateIsFactualIncome:false',
  'referenceEstimateCanBackfillIncome:false',
  'deltaIsMissingIncome:false',
  'captureRatioIsAccountingCompleteness:false',
  'signalBandIsAccountingStatus:false',
  'broadParityDoesNotCloseMonth:true',
  'modelVariancePossibleDoesNotProveModelVariance:true',
  'mechanismRowsDoNotNecessarilySumToCompanyEstimated:true',
  'numericalConvergenceTarget:false',
  "executionAuthority:'none'"
]){
  assert.ok(reconciliation.includes(required),`reference reconciliation boundary missing: ${required}`);
}
assert.ok(reconciliation.includes("referenceBasis:'canonical Reporting daily position valueUsd × admitted Reference APR / 365'"),'Defitea daily mechanism reference basis missing');
assert.ok(reconciliation.includes("companyEstimatedReconciliationAuthority:false"),'mechanism-to-company Estimated scope guard missing');

for(const required of [
  "const INCOME_VIEW_VERSION = '0.1-confirmed-estimated-non-additive'",
  'browserCalculatesEstimatedIncome: false',
  'confirmedPlusEstimatedIsValidTotal: false',
  'estimatedIncomeAuthority: false',
  'estimatedCanCloseAccountingCoverage: false',
  'associatedCompanyCapitalIncluded: false',
  'trackingNoEventVisible: true',
  'coverageHasCompletionAuthority: false',
  "state.status === 'factual-tracking-no-period-event'"
]){
  assert.ok(passport.includes(required),`Passport dual-income boundary missing: ${required}`);
}

const combined=[workflow,scope,recognitionView,monthlyAccounting,coverage,notice,reconciliation,passport].join('\n');
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'workflow_dispatch(', 'actions: write', 'write-all', 'api.coingecko.com', 'COINGECKO_API_KEY']){
  assert.equal(combined.includes(forbidden),false,`monthly reports authority expansion: ${forbidden}`);
}

console.log('Company Monthly Reports workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  economicReportingScope:SCOPE_PATH,
  canonicalUpstream:'Update The Holding Reporting Data',
  canonicalIncomeLedger:'reporting/income-ledger.json',
  recognitionView:RECOGNITION_VIEW_PATH,
  monthlyProjection:MONTHLY_ACCOUNTING_PATH,
  coverageProjection:COVERAGE_PATH,
  noticeProjection:NOTICE_PATH,
  reconciliationProjection:RECONCILIATION_PATH,
  passportPresentation:PASSPORT_PATH,
  diagnosticDependencyOrder:['accounting-coverage','accounting-notice-queue','accounting-reference-reconciliation'],
  coveragePublishedAtomically:true,
  canonicalLedgerSoleMonthlyIncomeAuthority:true,
  canonicalCompanyOwnershipPreserved:true,
  defiteaAssociatedCompanies:['YieldRing.eth','05081966.eth'],
  associatedCompanyTvlIncluded:false,
  holdingWideAggregationUsesCanonicalOwners:true,
  confirmedEstimatedNonAdditive:true,
  reconciliationDiagnosticOnly:true,
  reconciliationNumericalConvergenceTarget:false,
  claimableSnapshotIncomeDiscovery:false,
  genericReceiptIncomeDiscovery:false,
  settlementReRecognition:false,
  laterPriceRevaluation:false,
  incompleteCoverageFailClosed:true,
  productivityMaterializationWake:true,
  incomeLedgerMaterializationWake:true,
  reportingMaterializationWake:true,
  economicScopeMaterializationWake:true,
  fallbackCron:'37 7 * * *',
  movingMainRebuild:true,
  criticalCodeRaceFailClosed:true,
  executionAuthority:'none',
  walletAuthority:false,
  methodologyMutationAuthority:false
});
