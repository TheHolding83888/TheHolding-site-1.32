#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCanonicalEarnedIncomeView, recognitionDecision } from './canonical-earned-income-view.mjs';

const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);
const ROOT=path.resolve(__dirname,'..');
const CONTRACT_FILE=process.env.ACCOUNTING_INCOME_LIFECYCLE_CONTRACT_FILE||path.join(ROOT,'reporting','accounting-income-lifecycle-contract.json');
const VIEW_FILE=path.join(ROOT,'reporting','canonical-earned-income-view.mjs');

const contract=JSON.parse(fs.readFileSync(CONTRACT_FILE,'utf8'));
const source=fs.readFileSync(VIEW_FILE,'utf8');

assert.equal(contract.version,'0.1-accounting-income-lifecycle-contract');
assert.equal(contract.status,'canonical-semantics-no-execution-authority');
assert.deepEqual(contract.lifecycle,['earned','accrued','claimable','claimed','received','reinvested']);

const r=contract.recognitionContract||{};
for(const key of [
  'canonicalIncomeLedgerIsSoleFactualIncomeAuthority',
  'economicIncomeRecognizedAtMostOnce',
  'accruedEntitlementMayBeFirstRecognition',
  'embeddedIncomeMayBeFirstRecognition',
  'mechanismSpecificSettlementMayBeFirstRecognitionOnlyWithExplicitNonOverlapProof',
  'settlementRequiresProvenanceLinkage',
  'unknownIsNotZero'
]) assert.equal(r[key],true,`required lifecycle invariant missing: ${key}`);
for(const key of [
  'claimableBalanceAloneCreatesIncome',
  'openingBalanceCreatesIncome',
  'genericReceiptCreatesIncome',
  'claimAfterPriorEarnedRecognitionCreatesSecondIncome',
  'receiptAfterPriorEarnedRecognitionCreatesSecondIncome',
  'laterClaimOrReceiptCanRewriteEarnedMonth',
  'reinvestmentCanRewriteOriginalIncomeRecognition',
  'reinvestmentCreatesIncomeFromPrincipalMovement',
  'referenceAprCreatesFactualIncome',
  'referenceDeltaIsMissingIncome',
  'crossMonthTimeProrationCreatesIncome'
]) assert.equal(r[key],false,`forbidden lifecycle behavior enabled: ${key}`);

assert.equal(contract.periodContract?.laterSettlementCannotReallocateOriginalEarnedMonth,true);
assert.equal(contract.periodContract?.arbitraryCrossMonthIntervalsRemainUnresolved,true);
assert.equal(contract.periodContract?.boundaryEvidencePendingRemainsPartialOrUnknown,true);
assert.equal(contract.periodContract?.crossMonthProrationAllowed,false);

for(const [key,expected] of Object.entries({
  sourceOfTruth:false,
  incomeCreationAuthority:false,
  accountingCompletionAuthority:false,
  monthClosingAuthority:false,
  canReplaceUnknown:false,
  executionAuthority:'none',
  capitalExecution:false,
  walletAuthority:false
})) assert.equal(contract.authority?.[key],expected,`lifecycle contract authority expanded: ${key}`);

// Guard that the executable recognition view still carries the critical implementation laws.
for(const marker of [
  'openingBalanceCreatesIncome !== false',
  'settlementDoesNotReRecognizeIncome: true',
  'genericReceiptCreatesIncome: false',
  'crossMonthTimeProrationCreatesIncome: false',
  'unknownIsNotZero: true'
]) assert.ok(source.includes(marker),`canonical earned-income implementation marker missing: ${marker}`);

const base={
  protocol:'Fixture',
  asset:'USD',
  amount:10,
  usdValue:10,
  executionAuthority:'none'
};

const accrued={...base,eventKey:'fixture-accrued',company:'fixture.eth',family:'accrued-entitlement',economicDate:'2026-08-15T00:00:00.000Z'};
const accruedDecision=recognitionDecision(accrued);
assert.equal(accruedDecision.status,'recognized');
assert.equal(accruedDecision.month,'2026-08');
assert.equal(accruedDecision.recognitionBasis,'canonical-earned-accrual');

const embedded={...base,eventKey:'fixture-embedded',company:'fixture.eth',family:'embedded-income',periodStart:'2026-08-10T00:00:00.000Z',periodEnd:'2026-08-20T00:00:00.000Z',economicDate:'2026-08-20T00:00:00.000Z'};
const embeddedDecision=recognitionDecision(embedded);
assert.equal(embeddedDecision.status,'recognized');
assert.equal(embeddedDecision.month,'2026-08');

const crossMonth={...base,eventKey:'fixture-cross-month',company:'fixture.eth',family:'embedded-income',periodStart:'2026-08-31T11:00:00.000Z',periodEnd:'2026-09-01T10:00:00.000Z',economicDate:'2026-09-01T10:00:00.000Z',periodAttributionStatus:'cross-month-boundary-unallocated'};
const crossDecision=recognitionDecision(crossMonth);
assert.equal(crossDecision.status,'unresolved');
assert.equal(crossDecision.reason,'period-boundary-evidence-pending-no-exact-month-cut');

const settlement={...base,eventKey:'fixture-settlement',company:'fixture.eth',family:'realised-cash-flow',economicDate:'2026-09-05T00:00:00.000Z',incomeRecognition:{recognizesEarnedIncome:false,settlementOf:'earned:fixture-accrued'}};
const settlementDecision=recognitionDecision(settlement);
assert.equal(settlementDecision.status,'settlement-only');
assert.equal(settlementDecision.settlementOf,'earned:fixture-accrued');

const genericReceipt={...base,eventKey:'fixture-generic-receipt',company:'fixture.eth',family:'realised-cash-flow',economicDate:'2026-09-06T00:00:00.000Z'};
const genericDecision=recognitionDecision(genericReceipt);
assert.equal(genericDecision.status,'unresolved');
assert.equal(genericDecision.reason,'realised-receipt-lacks-non-overlap-recognition-proof');

const firstAtSettlement={...base,eventKey:'fixture-first-settlement',company:'fixture.eth',family:'realised-cash-flow',economicDate:'2026-09-07T00:00:00.000Z',incomeRecognition:{recognizesEarnedIncome:true,recognitionId:'fixture:first-settlement',recognitionBasis:'fixture-explicit-first-recognition',settlementStatus:'settled'}};
const firstSettlementDecision=recognitionDecision(firstAtSettlement);
assert.equal(firstSettlementDecision.status,'recognized');
assert.equal(firstSettlementDecision.recognitionId,'fixture:first-settlement');

const ledger={
  version:'0.1-canonical-income-ledger',
  generatedAt:'2026-09-09T00:00:00.000Z',
  semantics:{unknownIsNotZero:true,referenceAprCanBackfillEarnedIncome:false},
  events:[accrued,settlement,genericReceipt,firstAtSettlement,embedded,crossMonth]
};
const view=buildCanonicalEarnedIncomeView(ledger);
assert.equal(view.recognized.some(x=>x.eventKey==='fixture-accrued'),true);
assert.equal(view.settlements.some(x=>x.eventKey==='fixture-settlement'),true);
assert.equal(view.recognized.some(x=>x.eventKey==='fixture-settlement'),false,'settlement double-counted prior earned income');
assert.equal(view.unresolved.some(x=>x.eventKey==='fixture-generic-receipt'),true);
assert.equal(view.recognized.some(x=>x.eventKey==='fixture-first-settlement'),true);
assert.equal(view.recognized.some(x=>x.eventKey==='fixture-embedded'),true);
assert.equal(view.unresolved.some(x=>x.eventKey==='fixture-cross-month'),true);

const duplicateA={...firstAtSettlement,eventKey:'fixture-dup-a',incomeRecognition:{...firstAtSettlement.incomeRecognition,recognitionId:'fixture:duplicate-id'}};
const duplicateB={...firstAtSettlement,eventKey:'fixture-dup-b',incomeRecognition:{...firstAtSettlement.incomeRecognition,recognitionId:'fixture:duplicate-id'}};
assert.throws(()=>buildCanonicalEarnedIncomeView({...ledger,events:[duplicateA,duplicateB]}),/Earned-income recognition collision/,'duplicate economic recognition id must fail closed');

console.log('Accounting Income Lifecycle Contract validation PASS',{
  lifecycle:contract.lifecycle.join(' -> '),
  recognized:view.summary.recognizedEventCount,
  settlementOnly:view.summary.settlementOnlyEventCount,
  unresolved:view.summary.unresolvedEventCount,
  executionAuthority:contract.authority.executionAuthority
});
