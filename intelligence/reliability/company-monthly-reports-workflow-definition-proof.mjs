#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-company-monthly-reports.yml';
const SCOPE_PATH='reporting/company-income-scope.mjs';
const RECOGNITION_VIEW_PATH='reporting/canonical-earned-income-view.mjs';
const MONTHLY_ACCOUNTING_PATH='reporting/company-monthly-earned-income.mjs';
const PASSPORT_PATH='companies/company-passport-priority-adapter.js';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const scope=fs.readFileSync(SCOPE_PATH,'utf8');
const recognitionView=fs.readFileSync(RECOGNITION_VIEW_PATH,'utf8');
const monthlyAccounting=fs.readFileSync(MONTHLY_ACCOUNTING_PATH,'utf8');
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
assert.ok(workflow.includes("- 'reporting/company-income-scope.mjs'"),'monthly reports economic scope code wake missing');
assert.ok(workflow.includes("- 'reporting/canonical-earned-income-view.mjs'"),'monthly reports canonical recognition-view code wake missing');
assert.ok(workflow.includes("- cron: '37 7 * * *'"),'monthly reports fallback heartbeat missing');
assert.match(workflow,/test -s reporting\/income-ledger\.json/,'monthly reports canonical income ledger preflight missing');
assert.match(workflow,/node --check reporting\/company-income-scope\.mjs/,'monthly reports economic scope preflight missing');
assert.match(workflow,/node --check reporting\/canonical-earned-income-view\.mjs/,'monthly reports canonical recognition-view preflight missing');
assert.match(workflow,/INCOME_LEDGER_FILE:\s*\.\/reporting\/income-ledger\.json/,'monthly reports canonical income ledger runtime binding missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports\.mjs/,'monthly reference scaffold builder missing');
assert.match(workflow,/run: node reporting\/company-monthly-reports-validation\.mjs/,'monthly reference scaffold validator missing');
assert.match(workflow,/run: node reporting\/company-monthly-earned-income\.mjs/,'monthly earned-income accounting projection missing');
assert.match(workflow,/run: node reporting\/company-monthly-earned-income-validation\.mjs/,'monthly earned-income accounting validation missing');
assert.doesNotMatch(workflow,/gh workflow run|workflow_dispatch\s*\(/,'monthly reports workflow gained dispatch behavior');

assert.match(workflow,/critical_fingerprint\(\)/,'monthly writer critical fingerprint missing');
assert.match(workflow,/reporting\/company-income-scope\.mjs/,'monthly writer economic scope fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-reports\.mjs/,'monthly writer builder fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-reports-validation\.mjs/,'monthly writer scaffold validator fingerprint missing');
assert.match(workflow,/reporting\/canonical-earned-income-view\.mjs/,'monthly writer canonical recognition-view fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-earned-income\.mjs/,'monthly writer earned-income fingerprint missing');
assert.match(workflow,/reporting\/company-monthly-earned-income-validation\.mjs/,'monthly writer earned-income validator fingerprint missing');
assert.match(workflow,/companies\/company-passport-priority-adapter\.js/,'monthly writer Passport presentation fingerprint missing');
assert.match(workflow,/Critical Company Monthly Reports code changed during publish rebase; fail closed/,'monthly writer code-race fail-closed guard missing');
assert.match(workflow,/PRODUCTIVITY_DATA_FILE=\.\/companies\/productivity-data\.json[\s\S]*INCOME_LEDGER_FILE=\.\/reporting\/income-ledger\.json[\s\S]*node reporting\/company-monthly-reports\.mjs/,'monthly writer post-rebase canonical scaffold rebuild missing');
assert.match(workflow,/COMPANY_MONTHLY_REPORTS_FILE=\.\/reporting\/company-monthly-reports\.json[\s\S]*INCOME_LEDGER_FILE=\.\/reporting\/income-ledger\.json[\s\S]*node reporting\/company-monthly-earned-income\.mjs/,'monthly writer post-rebase earned-income rebuild missing');
assert.match(workflow,/git diff --name-only origin\/main\.\.\.HEAD/,'monthly writer post-rebase delta guard missing');
assert.match(workflow,/reporting\/company-monthly-reports\.json/,'monthly writer generated output allowlist missing');

// Explicit economic reporting scope is presentation/reporting composition only.
// Canonical event ownership remains with the source company and associated TVL
// can never leak into the target company capital denominator.
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

// The recognition layer may classify already-admitted canonical evidence, but
// neither it nor the monthly projection may discover income from generic state,
// current prices, APRs, or wallet receipts.
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

// Browser reads the backend dual-view contract; it never calculates income.
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

// The output remains reporting data only. The workflow has no wallet,
// capital execution, methodology mutation, arbitrary Actions dispatch, or
// independent price-discovery authority.
const combined=[workflow,scope,recognitionView,monthlyAccounting,passport].join('\n');
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
  passportPresentation:PASSPORT_PATH,
  canonicalLedgerSoleMonthlyIncomeAuthority:true,
  canonicalCompanyOwnershipPreserved:true,
  defiteaAssociatedCompanies:['YieldRing.eth','05081966.eth'],
  associatedCompanyTvlIncluded:false,
  holdingWideAggregationUsesCanonicalOwners:true,
  confirmedEstimatedNonAdditive:true,
  claimableSnapshotIncomeDiscovery:false,
  genericReceiptIncomeDiscovery:false,
  settlementReRecognition:false,
  laterPriceRevaluation:false,
  incompleteCoverageFailClosed:true,
  productivityMaterializationWake:true,
  incomeLedgerMaterializationWake:true,
  economicScopeMaterializationWake:true,
  fallbackCron:'37 7 * * *',
  movingMainRebuild:true,
  criticalCodeRaceFailClosed:true,
  executionAuthority:'none',
  walletAuthority:false,
  methodologyMutationAuthority:false
});
