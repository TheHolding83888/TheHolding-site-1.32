#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-reporting.yml';
const CONTRACT_PATH='reporting/reporting-scheduler-contract.json';
const RUNNER_PATH='reporting/reporting-scheduled-runner.mjs';
const RATE_POLICY_PATH='reporting/rate-continuity-policy.json';
const INCOME_POLICY_PATH='reporting/income-ledger-policy.json';
const COVERAGE_BUILDER_PATH='reporting/accounting-coverage.mjs';
const COVERAGE_VALIDATION_PATH='reporting/accounting-coverage-validation.mjs';
const FRAX_EVIDENCE_PATH='reporting/frax-yield-accounting-evidence.json';
const FRAX_BUILDER_PATH='reporting/frax-yield-accounting-evidence.mjs';
const FRAX_VALIDATION_PATH='reporting/frax-yield-accounting-evidence-validation.mjs';
const YB_EVIDENCE_PATH='reporting/yield-basis-accounting-evidence.json';
const YB_BUILDER_PATH='reporting/yield-basis-accounting-evidence.mjs';
const YB_CANDIDATES_PATH='reporting/yield-basis-income-candidates.mjs';
const YB_ADMISSION_PATH='reporting/yield-basis-ledger-admission.mjs';
const YB_VALIDATION_PATHS=[
  'reporting/yield-basis-accounting-evidence-validation.mjs',
  'reporting/yield-basis-income-candidates-validation.mjs',
  'reporting/yield-basis-ledger-admission-validation.mjs'
];
const VE33_EVIDENCE_PATH='reporting/ve33-accounting-evidence.json';
const VE33_BUILDER_PATH='reporting/ve33-accounting-evidence.mjs';
const VE33_CANDIDATES_PATH='reporting/ve33-income-candidates.mjs';
const VE33_ADMISSION_PATH='reporting/ve33-ledger-admission.mjs';
const VE33_VALIDATION_PATHS=[
  'reporting/ve33-accounting-evidence-validation.mjs',
  'reporting/ve33-income-candidates-validation.mjs',
  'reporting/ve33-ledger-admission-validation.mjs'
];
const LOCKED_EVIDENCE_PATH='reporting/ve33-locked-managed-accounting-evidence.json';
const LOCKED_BUILDER_PATH='reporting/ve33-locked-managed-accounting-evidence.mjs';
const LOCKED_CANDIDATES_PATH='reporting/ve33-locked-managed-income-candidates.mjs';
const LOCKED_VALIDATION_PATHS=[
  'reporting/ve33-locked-managed-accounting-evidence-validation.mjs',
  'reporting/ve33-locked-managed-income-candidates-validation.mjs',
  'reporting/ve33-locked-managed-ledger-admission-validation.mjs'
];

const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const contract=JSON.parse(fs.readFileSync(CONTRACT_PATH,'utf8'));
const runner=fs.readFileSync(RUNNER_PATH,'utf8');
const ratePolicy=JSON.parse(fs.readFileSync(RATE_POLICY_PATH,'utf8'));
const incomePolicy=JSON.parse(fs.readFileSync(INCOME_POLICY_PATH,'utf8'));
const coverageBuilder=fs.readFileSync(COVERAGE_BUILDER_PATH,'utf8');
const coverageValidation=fs.readFileSync(COVERAGE_VALIDATION_PATH,'utf8');
const fraxEvidence=JSON.parse(fs.readFileSync(FRAX_EVIDENCE_PATH,'utf8'));
const fraxBuilder=fs.readFileSync(FRAX_BUILDER_PATH,'utf8');
const fraxValidation=fs.readFileSync(FRAX_VALIDATION_PATH,'utf8');
const ybEvidence=JSON.parse(fs.readFileSync(YB_EVIDENCE_PATH,'utf8'));
const ybBuilder=fs.readFileSync(YB_BUILDER_PATH,'utf8');
const ybCandidates=fs.readFileSync(YB_CANDIDATES_PATH,'utf8');
const ybAdmission=fs.readFileSync(YB_ADMISSION_PATH,'utf8');
const ybValidations=YB_VALIDATION_PATHS.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const ve33Evidence=JSON.parse(fs.readFileSync(VE33_EVIDENCE_PATH,'utf8'));
const ve33Builder=fs.readFileSync(VE33_BUILDER_PATH,'utf8');
const ve33Candidates=fs.readFileSync(VE33_CANDIDATES_PATH,'utf8');
const ve33Admission=fs.readFileSync(VE33_ADMISSION_PATH,'utf8');
const ve33Validations=VE33_VALIDATION_PATHS.map(p=>fs.readFileSync(p,'utf8')).join('\n');
const lockedEvidence=JSON.parse(fs.readFileSync(LOCKED_EVIDENCE_PATH,'utf8'));
const lockedBuilder=fs.readFileSync(LOCKED_BUILDER_PATH,'utf8');
const lockedCandidates=fs.readFileSync(LOCKED_CANDIDATES_PATH,'utf8');
const lockedValidations=LOCKED_VALIDATION_PATHS.map(p=>fs.readFileSync(p,'utf8')).join('\n');

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

assert.match(coverageBuilder,/Accounting Coverage Registry v0\.3/,'Coverage Registry builder identity drift');
assert.match(coverageBuilder,/Canonical Income Ledger is the sole authority for/,'Coverage Registry lost Canonical Ledger sole-authority boundary');
assert.match(coverageBuilder,/Tracking proof never creates period income/,'Coverage tracking proof gained income authority');
assert.match(coverageBuilder,/zeroPeriodEventDoesNotImplyCoverageGap:true/,'Coverage zero-event semantics missing');
assert.match(coverageBuilder,/coverageGapMeansMissingFactualTrackingCapability:true/,'Coverage gap semantics missing');
assert.match(coverageBuilder,/executionAuthority:'none'/,'Coverage Registry execution authority drift');
assert.match(coverageValidation,/registryHasMonthClosingAuthority,false/,'Coverage Registry month-closing guard missing');
assert.match(coverageValidation,/registryHasIncomeCreationAuthority,false/,'Coverage Registry income-creation guard missing');
assert.match(coverageValidation,/zeroPeriodEventDoesNotImplyCoverageGap,true/,'Coverage zero-event validation missing');
assert.match(coverageValidation,/unknownIsNotZero,true/,'Coverage unknown-is-not-zero guard missing');

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

assert.equal(ybEvidence.version,'0.1-yield-basis-factual-accrual-evidence');
assert.equal(ybEvidence.mechanism,'yield-basis-fees');
assert.equal(ybEvidence.fullAccountingStart,'2026-09-01T00:00:00.000Z');
assert.equal(ybEvidence.source?.feeDistributor,'0xD11b416573EbC59b6B2387DA0D2c0D1b3b1F7A90');
assert.equal(ybEvidence.semantics?.openingBalanceCreatesIncome,false);
assert.equal(ybEvidence.semantics?.earnedIndependentOfClaim,true);
assert.equal(ybEvidence.semantics?.claimIsSettlementNotSecondIncome,true);
assert.equal(ybEvidence.semantics?.referenceAprUsed,false);
assert.equal(ybEvidence.semantics?.laterPriceMovementRewritesClosedIncome,false);
assert.equal(ybEvidence.semantics?.unknownIsNotZero,true);
assert.equal(ybEvidence.authority?.executionAuthority,'none');
assert.equal(ybEvidence.authority?.walletAuthority,'none');
assert.equal(ybEvidence.authority?.claimingAuthority,'none');
assert.equal(ybEvidence.authority?.capitalExecution,false);
assert.match(ybBuilder,/closing preview_claim \+ Claim settlements - opening preview_claim, token by token/,'Yield Basis factual accrual formula missing');
assert.match(ybBuilder,/preview_claim\.staticCall\(walletRow\.wallet,50,false/,'Yield Basis exact FeeDistributor claimable state read missing');
assert.match(ybBuilder,/contract\.filters\.Claim\(wallet\)/,'Yield Basis Claim settlement attribution missing');
assert.match(ybBuilder,/currentClaimableBalanceIsPeriodIncome:false/,'Yield Basis current-state accounting boundary missing');
assert.match(ybBuilder,/claimIsSecondIncomeEvent:false/,'Yield Basis claim settlement dedup missing');
assert.match(ybBuilder,/laterClaimOrPriceMoveDoesNotRewriteIncome:true/,'Yield Basis frozen income invariant missing');
assert.match(ybBuilder,/trackedWalletsFromRewards/,'Yield Basis canonical Rewards wallet-scope reuse missing');
assert.match(ybBuilder,/priceIndexFromRewards/,'Yield Basis canonical Rewards valuation reuse missing');
assert.doesNotMatch(ybBuilder,/referenceAprUsed\s*:\s*true|referenceApyUsed\s*:\s*true/i,'Yield Basis builder gained APR/APY income authority');
assert.match(ybCandidates,/yieldBasisEvidenceCandidates/,'Yield Basis Canonical Ledger candidate contract missing');
assert.match(ybCandidates,/sourceFile:'reporting\/yield-basis-accounting-evidence\.json'/,'Yield Basis source provenance missing');
assert.match(ybAdmission,/admitEvents\(ledger\?\.events,candidates\)/,'Yield Basis must use Canonical Ledger immutable admission primitive');
assert.match(ybAdmission,/const rebuilt=await build\(\)/,'Yield Basis must rebuild derived views through the same Canonical Ledger builder');
assert.match(ybAdmission,/executionAuthority:'none'/,'Yield Basis admission authority boundary missing');
assert.match(ybValidations,/claim-to-zero of the opening balance creates no new income/i,'Yield Basis claim reset regression test missing');
assert.match(ybValidations,/mutation detected/,'Yield Basis immutable event mutation regression test missing');

assert.equal(ve33Evidence.version,'0.1-ve33-factual-accrual-evidence');
assert.equal(ve33Evidence.fullAccountingStart,'2026-09-01T00:00:00.000Z');
assert.equal(ve33Evidence.semantics?.openingBalanceCreatesIncome,false);
assert.equal(ve33Evidence.semantics?.earnedIndependentOfClaim,true);
assert.equal(ve33Evidence.semantics?.claimIsSettlementNotSecondIncome,true);
assert.equal(ve33Evidence.semantics?.rebaseDepositIntoVeNftIsSecondIncome,false);
assert.equal(ve33Evidence.semantics?.referenceAprUsed,false);
assert.equal(ve33Evidence.semantics?.laterPriceMovementRewritesClosedIncome,false);
assert.equal(ve33Evidence.semantics?.unknownIsNotZero,true);
assert.equal(ve33Evidence.authority?.executionAuthority,'none');
assert.equal(ve33Evidence.authority?.walletAuthority,'none');
assert.equal(ve33Evidence.authority?.claimingAuthority,'none');
assert.equal(ve33Evidence.authority?.capitalExecution,false);
assert.match(ve33Builder,/reconcileEntitlement\(open\.entitlementRaw,close\.entitlementRaw,settlements\.amountRaw\)/,'ve33 entitlement reconciliation missing');
assert.match(ve33Builder,/ClaimRewards/,'ve33 voting reward settlement proof missing');
assert.match(ve33Builder,/Claimed/,'ve33 rebase settlement proof missing');
assert.match(ve33Builder,/decodeRewardClaimTokenId/,'ve33 tokenId claim attribution missing');
assert.match(ve33Builder,/currentClaimableBalanceIsPeriodIncome:false/,'ve33 current state accounting boundary missing');
assert.match(ve33Builder,/claimIsSecondIncomeEvent:false/,'ve33 claim dedup missing');
assert.match(ve33Builder,/laterClaimOrPriceMoveDoesNotRewriteIncome:true/,'ve33 frozen income invariant missing');
assert.doesNotMatch(ve33Builder,/referenceAprUsed\s*:\s*true|referenceApyUsed\s*:\s*true/i,'ve33 builder gained APR/APY income authority');
assert.match(ve33Candidates,/ve33EvidenceCandidates/,'ve33 Canonical Ledger candidate contract missing');
assert.match(ve33Candidates,/sourceFile:'reporting\/ve33-accounting-evidence\.json'/,'ve33 source provenance missing');
assert.match(ve33Admission,/admitEvents\(ledger\?\.events,candidates\)/,'ve33 must use Canonical Ledger immutable admission primitive');
assert.match(ve33Admission,/const rebuilt=await build\(\)/,'ve33 must rebuild derived views through the same Canonical Ledger builder');
assert.match(ve33Admission,/executionAuthority:'none'/,'ve33 admission authority boundary missing');
assert.match(ve33Validations,/mutation detected/,'ve33 immutable event mutation regression test missing');
assert.match(ve33Validations,/claim settlement semantics drift|claimIsSecondIncomeEvent/,'ve33 claim settlement regression coverage missing');

assert.equal(lockedEvidence.version,'0.1-ve33-locked-managed-factual-accrual');
assert.equal(lockedEvidence.fullAccountingStart,'2026-09-01T00:00:00.000Z');
assert.equal(lockedEvidence.semantics?.openingBalanceCreatesIncome,false);
assert.equal(lockedEvidence.semantics?.earnedIndependentOfWithdrawal,true);
assert.equal(lockedEvidence.semantics?.withdrawalIsSettlementNotSecondIncome,true);
assert.equal(lockedEvidence.semantics?.grossVeNftPrincipalDeltaIsIncomeAuthority,false);
assert.equal(lockedEvidence.semantics?.referenceAprUsed,false);
assert.equal(lockedEvidence.semantics?.laterPriceMovementRewritesClosedIncome,false);
assert.equal(lockedEvidence.semantics?.unknownIsNotZero,true);
assert.equal(lockedEvidence.authority?.executionAuthority,'none');
assert.equal(lockedEvidence.authority?.walletAuthority,'none');
assert.equal(lockedEvidence.authority?.claimingAuthority,'none');
assert.equal(lockedEvidence.authority?.capitalExecution,false);
assert.equal(lockedEvidence.authority?.methodologyMutationAuthority,'none');
assert.match(lockedBuilder,/idToManaged/,'LockedManagedReward managed identity proof missing');
assert.match(lockedBuilder,/managedToLocked/,'LockedManagedReward exact reward-contract proof missing');
assert.match(lockedBuilder,/reconcileEntitlement\(open\.entitlementRaw,close\.entitlementRaw,settlements\.amountRaw\)/,'LockedManagedReward entitlement reconciliation missing');
assert.match(lockedBuilder,/withdrawManaged/,'LockedManagedReward withdrawal settlement attribution missing');
assert.match(lockedBuilder,/withdrawalIsSettlementNotSecondIncome:true/,'LockedManagedReward withdrawal dedup invariant missing');
assert.match(lockedBuilder,/grossVeNftPrincipalDeltaIsIncomeAuthority:false/,'LockedManagedReward gross principal exclusion missing');
assert.match(lockedBuilder,/laterClaimOrPriceMoveDoesNotRewriteIncome:true/,'LockedManagedReward frozen income invariant missing');
assert.doesNotMatch(lockedBuilder,/referenceAprUsed\s*:\s*true|referenceApyUsed\s*:\s*true/i,'LockedManagedReward builder gained APR/APY income authority');
assert.match(lockedCandidates,/family:'embedded-income'/,'LockedManagedReward Canonical Ledger family mapping missing');
assert.match(lockedCandidates,/sourceEvidenceFamily:e\.family/,'LockedManagedReward source evidence family preservation missing');
assert.match(lockedCandidates,/sourceFile:'reporting\/ve33-locked-managed-accounting-evidence\.json'/,'LockedManagedReward source provenance missing');
assert.match(ve33Admission,/buildLockedManagedEvidence/,'LockedManagedReward evidence build missing from canonical admission path');
assert.match(ve33Admission,/admitLockedManagedIntoLedgerState/,'LockedManagedReward canonical admission primitive missing');
assert.match(lockedValidations,/embedded-income/,'LockedManagedReward canonical family regression coverage missing');
assert.match(lockedValidations,/sourceEvidenceFamily/,'LockedManagedReward source family preservation regression coverage missing');
assert.match(lockedValidations,/mutation detected/,'LockedManagedReward immutable event mutation regression test missing');

const exactCron=`- cron: '${contract.cron}'`;
assert.equal(workflow.split(exactCron).length-1,1,'Reporting workflow must contain exactly one canonical scheduler cron');
assert.match(workflow,/permissions:\n  contents: write/,'Reporting writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write/,'Reporting scheduler must not gain actions:write');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'Reporting production writer must not gain pull_request execution');
assert.match(workflow,/group:\s*reporting-daily/,'Reporting concurrency group drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'Reporting production writer must remain non-cancellable');
assert.match(workflow,/timeout-minutes:\s*10/,'Reporting evidence runtime budget missing');
assert.match(workflow,/npm install --no-save --no-package-lock ethers@6/,'Accounting runtime dependency missing');
assert.match(workflow,/node reporting\/reporting-scheduled-runner\.mjs --validate-contract/,'Reporting scheduler contract preflight missing');
assert.match(workflow,/run: node reporting\/reporting-scheduled-runner\.mjs/,'Reporting production writer must execute the contract-bound runner');
assert.doesNotMatch(workflow,/gh workflow run|workflow_dispatch\s*\(/,'Reporting workflow gained dispatch behavior');

assert.match(workflow,/workflow_run:\n\s+workflows:\n\s+- "Update Company Rewards"\n\s+- "Update Stable Capital"\n\s+- "The Holding Capital · Unified Refresh"\n\s+types: \[completed\]/,'Reporting canonical workflow_run sources drift');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success'/,'Reporting workflow_run success gate missing');
assert.match(workflow,/github\.event\.workflow_run\.head_branch == 'main'/,'Reporting workflow_run main-branch gate missing');
assert.match(workflow,/ref: main/,'Reporting must consume canonical main');
for(const source of ['companies/rewards-data.json','companies/stable-index-data.json','companies/embedded-yield-ledger.json','companies/productivity-data.json','companies/defitea-canonical-state.json','intelligence/realised-cash-flow/realised-cash-flow.json']) assert.ok(workflow.includes(`- '${source}'`),`Reporting freshness source missing: ${source}`);
for(const source of [
  'reporting/rate-continuity-policy.json','reporting/income-ledger-policy.json','reporting/reporting-engine.mjs','reporting/reporting-engine-validation.mjs','reporting/income-ledger.mjs','reporting/income-ledger-validation.mjs','reporting/accounting-coverage.mjs','reporting/accounting-coverage-validation.mjs','reporting/accounting-coverage.json',
  'reporting/frax-yield-accounting-evidence.mjs','reporting/frax-yield-accounting-evidence-validation.mjs','reporting/frax-yield-accounting-evidence.json',
  'reporting/yield-basis-accounting-evidence.mjs','reporting/yield-basis-accounting-evidence-validation.mjs','reporting/yield-basis-income-candidates.mjs','reporting/yield-basis-income-candidates-validation.mjs','reporting/yield-basis-ledger-admission.mjs','reporting/yield-basis-ledger-admission-validation.mjs','reporting/yield-basis-accounting-evidence.json',
  'reporting/ve33-accounting-evidence.mjs','reporting/ve33-accounting-evidence-validation.mjs','reporting/ve33-income-candidates.mjs','reporting/ve33-income-candidates-validation.mjs','reporting/ve33-ledger-admission.mjs','reporting/ve33-ledger-admission-validation.mjs','reporting/ve33-accounting-evidence.json',
  'reporting/ve33-locked-managed-accounting-evidence.mjs','reporting/ve33-locked-managed-accounting-evidence-validation.mjs','reporting/ve33-locked-managed-income-candidates.mjs','reporting/ve33-locked-managed-income-candidates-validation.mjs','reporting/ve33-locked-managed-ledger-admission-validation.mjs','reporting/ve33-locked-managed-accounting-evidence.json'
]) assert.ok(workflow.includes(`- '${source}'`),`Reporting deterministic code/policy wake missing: ${source}`);

assert.match(workflow,/test -s reporting\/rate-continuity-policy\.json/,'Reporting rate continuity policy preflight missing');
assert.match(workflow,/test -s reporting\/income-ledger-policy\.json/,'Canonical Income Ledger policy preflight missing');
assert.match(workflow,/node --check reporting\/accounting-coverage\.mjs/,'Coverage Registry builder preflight missing');
assert.match(workflow,/node --check reporting\/accounting-coverage-validation\.mjs/,'Coverage Registry validation preflight missing');
assert.match(workflow,/test -s reporting\/frax-yield-accounting-evidence\.json/,'Frax evidence preflight missing');
assert.match(workflow,/test -s reporting\/yield-basis-accounting-evidence\.json/,'Yield Basis evidence preflight missing');
assert.match(workflow,/test -s reporting\/ve33-accounting-evidence\.json/,'ve33 evidence preflight missing');
assert.match(workflow,/test -s reporting\/ve33-locked-managed-accounting-evidence\.json/,'LockedManagedReward evidence preflight missing');
assert.match(workflow,/test -s intelligence\/realised-cash-flow\/realised-cash-flow\.json/,'Canonical Realised Cash Flow source preflight missing');
assert.match(workflow,/node reporting\/income-ledger-validation\.mjs/,'Canonical Income Ledger validation missing');
assert.match(workflow,/node reporting\/frax-yield-accounting-evidence-validation\.mjs/,'Frax evidence validation missing');
assert.match(workflow,/node reporting\/yield-basis-accounting-evidence-validation\.mjs/,'Yield Basis evidence validation missing');
assert.match(workflow,/node reporting\/yield-basis-income-candidates-validation\.mjs/,'Yield Basis candidate validation missing');
assert.match(workflow,/node reporting\/yield-basis-ledger-admission-validation\.mjs/,'Yield Basis ledger admission validation missing');
assert.match(workflow,/node reporting\/ve33-accounting-evidence-validation\.mjs/,'ve33 evidence validation missing');
assert.match(workflow,/node reporting\/ve33-income-candidates-validation\.mjs/,'ve33 candidate validation missing');
assert.match(workflow,/node reporting\/ve33-ledger-admission-validation\.mjs/,'ve33 ledger admission validation missing');
assert.match(workflow,/node reporting\/ve33-locked-managed-accounting-evidence-validation\.mjs/,'LockedManagedReward evidence validation missing');
assert.match(workflow,/node reporting\/ve33-locked-managed-income-candidates-validation\.mjs/,'LockedManagedReward candidate validation missing');
assert.match(workflow,/node reporting\/ve33-locked-managed-ledger-admission-validation\.mjs/,'LockedManagedReward ledger admission validation missing');
assert.match(workflow,/name: Build Frax veFRAX factual accrual evidence/,'Frax factual accrual build step missing');
assert.match(workflow,/run: node reporting\/frax-yield-accounting-evidence\.mjs/,'Frax factual accrual writer execution missing');
assert.match(workflow,/FRAXTAL_RPC_URL:\s*\$\{\{ secrets\.FRAXTAL_RPC_URL \}\}/,'Frax RPC secret/fallback binding missing');
assert.match(workflow,/name: Build Yield Basis veYB factual accrual evidence/,'Yield Basis factual accrual build step missing');
assert.match(workflow,/run: node reporting\/yield-basis-accounting-evidence\.mjs/,'Yield Basis factual accrual writer execution missing');
assert.match(workflow,/ETH_RPC_URL:\s*\$\{\{ secrets\.ETH_RPC_URL \}\}/,'Yield Basis Ethereum RPC secret/fallback binding missing');
assert.match(workflow,/name: Admit Yield Basis evidence through Canonical Income Ledger/,'Yield Basis Canonical Ledger admission step missing');
assert.match(workflow,/run: node reporting\/yield-basis-ledger-admission\.mjs/,'Yield Basis Canonical Ledger admission execution missing');
assert.match(workflow,/YIELD_BASIS_EVIDENCE_FILE:\s*\.\/reporting\/yield-basis-accounting-evidence\.json/,'Yield Basis evidence runtime binding missing');
assert.match(workflow,/name: Build Aerodrome \+ Velodrome factual accrual evidence/,'ve33 factual accrual build step missing');
assert.match(workflow,/run: node reporting\/ve33-accounting-evidence\.mjs/,'ve33 factual accrual writer execution missing');
assert.match(workflow,/BASE_RPC_URL:\s*\$\{\{ secrets\.BASE_RPC_URL \}\}/,'Aerodrome RPC secret/fallback binding missing');
assert.match(workflow,/OPTIMISM_RPC_URL:\s*\$\{\{ secrets\.OPTIMISM_RPC_URL \}\}/,'Velodrome RPC secret/fallback binding missing');
assert.match(workflow,/name: Build Canonical Income Ledger/,'Canonical Income Ledger build step missing');
assert.match(workflow,/run: node reporting\/income-ledger\.mjs/,'Canonical Income Ledger writer execution missing');
assert.match(workflow,/name: Admit ve33 evidence through Canonical Income Ledger/,'ve33 Canonical Ledger admission step missing');
assert.match(workflow,/run: node reporting\/ve33-ledger-admission\.mjs/,'ve33 Canonical Ledger admission execution missing');
assert.match(workflow,/name: Build \+ validate Accounting Coverage Registry/,'Coverage Registry build/validation step missing');
assert.match(workflow,/node reporting\/accounting-coverage\.mjs\n\s+node reporting\/accounting-coverage-validation\.mjs/,'Coverage Registry deterministic build/validation execution missing');
assert.match(workflow,/ACCOUNTING_COVERAGE_FILE:\s*\.\/reporting\/accounting-coverage\.json/,'Coverage Registry output binding missing');
assert.match(workflow,/FRAX_YIELD_EVIDENCE_FILE:\s*\.\/reporting\/frax-yield-accounting-evidence\.json/,'Frax evidence runtime binding missing');
assert.match(workflow,/VE33_EVIDENCE_FILE:\s*\.\/reporting\/ve33-accounting-evidence\.json/,'ve33 evidence runtime binding missing');
assert.match(workflow,/VE33_LOCKED_MANAGED_EVIDENCE_FILE:\s*\.\/reporting\/ve33-locked-managed-accounting-evidence\.json/,'LockedManagedReward evidence runtime binding missing');
assert.match(workflow,/INCOME_LEDGER_FILE:\s*\.\/reporting\/income-ledger\.json/,'Canonical Income Ledger runtime output binding missing');
assert.match(workflow,/git add reporting\/reporting-data\.json reporting\/defitea-income-ledger\.json reporting\/frax-yield-accounting-evidence\.json reporting\/ve33-accounting-evidence\.json reporting\/ve33-locked-managed-accounting-evidence\.json reporting\/income-ledger\.json reporting\/yield-basis-accounting-evidence\.json reporting\/accounting-coverage\.json/,'Canonical Reporting + Coverage publication staging missing');
assert.match(workflow,/critical_fingerprint\(\)/,'Reporting race critical fingerprint missing');
assert.match(workflow,/reporting\/accounting-coverage\.mjs/,'Coverage builder missing from critical fingerprint');
assert.match(workflow,/reporting\/accounting-coverage-validation\.mjs/,'Coverage validation missing from critical fingerprint');
assert.match(workflow,/reporting\/frax-yield-accounting-evidence\.mjs/,'Frax evidence builder missing from critical fingerprint');
assert.match(workflow,/reporting\/yield-basis-accounting-evidence\.mjs/,'Yield Basis evidence builder missing from critical fingerprint');
assert.match(workflow,/reporting\/yield-basis-income-candidates\.mjs/,'Yield Basis candidates missing from critical fingerprint');
assert.match(workflow,/reporting\/yield-basis-ledger-admission\.mjs/,'Yield Basis admission missing from critical fingerprint');
assert.match(workflow,/reporting\/ve33-accounting-evidence\.mjs/,'ve33 evidence builder missing from critical fingerprint');
assert.match(workflow,/reporting\/ve33-ledger-admission\.mjs/,'ve33 admission missing from critical fingerprint');
assert.match(workflow,/reporting\/ve33-locked-managed-accounting-evidence\.mjs/,'LockedManagedReward builder missing from critical fingerprint');
assert.match(workflow,/reporting\/ve33-locked-managed-income-candidates\.mjs/,'LockedManagedReward candidates missing from critical fingerprint');
assert.match(workflow,/reporting\/ve33-locked-managed-ledger-admission-validation\.mjs/,'LockedManagedReward admission guard missing from critical fingerprint');
assert.match(workflow,/Critical Reporting code\/policy changed during publish rebase; fail closed/,'Reporting rebase code-drift fail-closed guard missing');
assert.match(workflow,/node reporting\/frax-yield-accounting-evidence\.mjs\n\s+node reporting\/ve33-accounting-evidence\.mjs\n\s+node reporting\/income-ledger\.mjs\n\s+node reporting\/ve33-ledger-admission\.mjs\n\s+node reporting\/reporting-engine-validation\.mjs\n\s+node reporting\/yield-basis-accounting-evidence\.mjs\n\s+node reporting\/yield-basis-ledger-admission\.mjs\n\s+node reporting\/accounting-coverage\.mjs\n\s+node reporting\/accounting-coverage-validation\.mjs/,'Reporting rebase must rebuild canonical accounting before Coverage materialization');
assert.match(workflow,/Unexpected Reporting publish delta after rebase/,'Reporting post-rebase publish scope guard missing');
assert.match(workflow,/reporting\/frax-yield-accounting-evidence\.json\|reporting\/ve33-accounting-evidence\.json\|reporting\/ve33-locked-managed-accounting-evidence\.json\|reporting\/income-ledger\.json\|reporting\/yield-basis-accounting-evidence\.json\|reporting\/accounting-coverage\.json/,'Coverage artifact missing from safe publish scope');
assert.match(workflow,/accountingExtensions\?\.yieldBasisAccrual/,'Yield Basis generated ledger extension validation missing');
assert.match(workflow,/tokenSpecificReconciliation!==true/,'Yield Basis token-specific reconciliation guard missing');
assert.match(workflow,/accountingExtensions\?\.ve33LockedManaged/,'LockedManagedReward generated ledger extension validation missing');
assert.match(workflow,/sourceEvidenceFamily!=='embedded-compounded-income'/,'LockedManagedReward source semantic preservation guard missing');
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
  accountingCoverageRegistry:'0.3-factual-tracking-accounting-mechanism-coverage-registry',
  accountingCoveragePersistedByExistingWriter:true,
  accountingCoverageHasIncomeCreationAuthority:false,
  accountingCoverageHasMonthClosingAuthority:false,
  fraxFactualAccrualEvidence:fraxEvidence.version,
  fraxFullAccountingStart:fraxEvidence.fullAccountingStart,
  fraxClaimAware:true,
  yieldBasisFactualAccrualEvidence:ybEvidence.version,
  yieldBasisFullAccountingStart:ybEvidence.fullAccountingStart,
  yieldBasisFeeDistributor:ybEvidence.source?.feeDistributor,
  yieldBasisClaimAware:true,
  yieldBasisTokenSpecific:true,
  yieldBasisRewardsCollectorReused:true,
  ve33FactualAccrualEvidence:ve33Evidence.version,
  ve33FullAccountingStart:ve33Evidence.fullAccountingStart,
  ve33ClaimAware:true,
  ve33RebaseCompoundingDedup:true,
  ve33CanonicalLedgerRebuild:true,
  lockedManagedFactualAccrualEvidence:lockedEvidence.version,
  lockedManagedFullAccountingStart:lockedEvidence.fullAccountingStart,
  lockedManagedWithdrawalAware:true,
  lockedManagedCanonicalFamily:'embedded-income',
  lockedManagedGrossPrincipalExcluded:true,
  lockedManagedEvidencePersisted:true,
  openingBalancesExcluded:true,
  laterPriceRevaluationExcluded:true,
  singleSourceFailureIsolation:true,
  appendOnlyIncomeHistory:true,
  stateOnlyClaimableSnapshots:true,
  rebaseRebuildGuard:true,
  productionWriterPullRequestAuthority:false,
  workflowDispatchAuthority:false,
  concurrency:'reporting-daily/non-cancellable',
  naturalScheduleProofRequired:true
});
