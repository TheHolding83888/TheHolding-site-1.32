#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildCanonicalEarnedIncomeView, recognitionDecision } from './canonical-earned-income-view.mjs';

const ROOT = process.cwd();
const CONTRACT_FILE = process.env.INCOME_LIFECYCLE_CONTRACT_FILE || './reporting/income-lifecycle-contract.json';
const LEDGER_FILE = process.env.INCOME_LEDGER_FILE || './reporting/income-ledger.json';

function read(file) {
  return JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

const contract = read(CONTRACT_FILE);
const ledger = read(LEDGER_FILE);
const view = buildCanonicalEarnedIncomeView(ledger);

assert.equal(contract.version, '0.1-income-lifecycle-contract');
assert.equal(contract.status, 'acceptance-contract-no-accounting-authority');
assert.deepEqual(contract.sequence, ['earned', 'accrued', 'claimable', 'claimed', 'received', 'reinvested']);

for (const [key, expected] of Object.entries({
  sourceOfTruth: false,
  factualIncomeAuthority: false,
  incomeCreationAuthority: false,
  accountingCompletionAuthority: false,
  monthClosingAuthority: false,
  methodologyMutationAuthority: false,
  executionAuthority: 'none',
  capitalExecution: false,
  walletAuthority: false
})) assert.equal(contract.authority?.[key], expected, `lifecycle authority expanded: ${key}`);

assert.equal(contract.invariants?.canonicalIncomeLedgerRemainsSoleFactualIncomeAuthority, true);
assert.equal(contract.invariants?.canonicalEarnedIncomeViewIsReadOnlyInterpretation, true);
assert.equal(contract.invariants?.sameEconomicIncomeRecognizedAtMostOnce, true);
assert.equal(contract.invariants?.settlementDoesNotReRecognizeIncome, true);
assert.equal(contract.invariants?.laterReceiptCannotRewriteEarnedHistory, true);
assert.equal(contract.invariants?.laterClaimCannotRewriteEarnedHistory, true);
assert.equal(contract.invariants?.laterPriceMovementCannotRewriteFrozenHistoricalIncome, true);
assert.equal(contract.invariants?.openingBalanceCreatesIncome, false);
assert.equal(contract.invariants?.claimableSnapshotsCreateIncome, false);
assert.equal(contract.invariants?.genericReceiptCreatesIncome, false);
assert.equal(contract.invariants?.reinvestmentCreatesSecondIncome, false);
assert.equal(contract.invariants?.referenceAprCanBackfillIncome, false);
assert.equal(contract.invariants?.estimatedIncomeCanReplaceUnknown, false);
assert.equal(contract.invariants?.crossMonthProrationAllowed, false);
assert.equal(contract.invariants?.unknownIsNotZero, true);

assert.equal(ledger.version, '0.1-canonical-income-ledger');
assert.equal(ledger.semantics?.unknownIsNotZero, true);
assert.equal(ledger.semantics?.referenceAprCanBackfillEarnedIncome, false);
assert.ok(Array.isArray(ledger.events), 'canonical ledger events missing');

assert.equal(view.version, '0.1-canonical-earned-income-view');
assert.equal(view.semantics?.claimableSnapshotsCreateIncome, false);
assert.equal(view.semantics?.referenceAprCreatesIncome, false);
assert.equal(view.semantics?.genericReceiptCreatesIncome, false);
assert.equal(view.semantics?.accruedIncomeRecognizedBeforeClaim, true);
assert.equal(view.semantics?.embeddedCompoundingRecognizedAsEarnedIncome, true);
assert.equal(view.semantics?.crossMonthTimeProrationCreatesIncome, false);
assert.equal(view.semantics?.settlementDoesNotReRecognizeIncome, true);
assert.equal(view.semantics?.unknownIsNotZero, true);
assert.equal(view.authority?.executionAuthority, 'none');

const sourceByEventKey = new Map((ledger.events || []).map(event => [event.eventKey, event]));
const recognizedByEventKey = new Map((view.recognized || []).map(row => [row.eventKey, row]));
const settlementByEventKey = new Map((view.settlements || []).map(row => [row.eventKey, row]));
const recognitionIds = new Set();

for (const row of view.recognized || []) {
  assert.ok(row.eventKey, 'recognized row missing event key');
  assert.equal(row.recognizesEarnedIncome, true, `${row.eventKey} recognition flag drift`);
  assert.ok(row.recognitionId, `${row.eventKey} recognition id missing`);
  assert.equal(recognitionIds.has(row.recognitionId), false, `duplicate earned-income recognition id: ${row.recognitionId}`);
  recognitionIds.add(row.recognitionId);
  assert.ok(['accrued-entitlement', 'embedded-income', 'realised-cash-flow'].includes(row.family), `${row.eventKey} unsupported recognized family`);
  assert.notEqual(row.usdValue, null, `${row.eventKey} recognized without factual/resolved USD value`);
  assert.equal(Number.isFinite(Number(row.usdValue)), true, `${row.eventKey} recognized USD invalid`);

  const source = sourceByEventKey.get(row.eventKey);
  assert.ok(source, `${row.eventKey} recognized row missing canonical source event`);
  if (row.family === 'realised-cash-flow') {
    assert.equal(source.incomeRecognition?.recognizesEarnedIncome, true, `${row.eventKey} realised receipt lacks explicit first-recognition proof`);
    assert.equal(String(source.incomeRecognition?.recognitionId || ''), String(row.recognitionId), `${row.eventKey} recognition id mismatch`);
  }
  if (hasOwn(source, 'openingBalanceCreatesIncome')) assert.equal(source.openingBalanceCreatesIncome, false, `${row.eventKey} opening balance became income`);
  if (hasOwn(source, 'claimIsSecondIncomeEvent')) assert.equal(source.claimIsSecondIncomeEvent, false, `${row.eventKey} claim became second income`);
  if (hasOwn(source, 'withdrawalIsSettlementNotSecondIncome')) assert.equal(source.withdrawalIsSettlementNotSecondIncome, true, `${row.eventKey} withdrawal settlement contract drift`);
  if (hasOwn(source, 'laterClaimOrPriceMoveDoesNotRewriteIncome')) assert.equal(source.laterClaimOrPriceMoveDoesNotRewriteIncome, true, `${row.eventKey} later claim/price may rewrite history`);
  if (hasOwn(source, 'referenceAprUsed')) assert.equal(source.referenceAprUsed, false, `${row.eventKey} Reference APR entered factual recognition`);
}

for (const row of view.settlements || []) {
  assert.ok(row.eventKey, 'settlement row missing event key');
  assert.equal(row.recognizesEarnedIncome, false, `${row.eventKey} settlement re-recognized income`);
  assert.ok(row.settlementOf, `${row.eventKey} settlement provenance missing`);
  assert.equal(recognizedByEventKey.has(row.eventKey), false, `${row.eventKey} appears as both earned and settlement`);
  const source = sourceByEventKey.get(row.eventKey);
  assert.ok(source, `${row.eventKey} settlement missing canonical source event`);
  assert.equal(source.family, 'realised-cash-flow', `${row.eventKey} settlement family drift`);
  assert.equal(source.incomeRecognition?.recognizesEarnedIncome, false, `${row.eventKey} settlement source recognition drift`);
  assert.equal(String(source.incomeRecognition?.settlementOf || ''), String(row.settlementOf), `${row.eventKey} settlement provenance mismatch`);
}

for (const event of ledger.events || []) {
  if (hasOwn(event, 'openingBalanceCreatesIncome')) assert.equal(event.openingBalanceCreatesIncome, false, `${event.eventKey} opening balance income drift`);
  if (hasOwn(event, 'claimIsSecondIncomeEvent')) assert.equal(event.claimIsSecondIncomeEvent, false, `${event.eventKey} claim second-income drift`);
  if (hasOwn(event, 'withdrawalIsSettlementNotSecondIncome')) assert.equal(event.withdrawalIsSettlementNotSecondIncome, true, `${event.eventKey} withdrawal settlement drift`);
  if (hasOwn(event, 'laterClaimOrPriceMoveDoesNotRewriteIncome')) assert.equal(event.laterClaimOrPriceMoveDoesNotRewriteIncome, true, `${event.eventKey} historical rewrite drift`);
  if (event.incomeRecognition?.recognizesEarnedIncome === false) {
    assert.equal(settlementByEventKey.has(event.eventKey), true, `${event.eventKey} explicit settlement not represented as settlement-only`);
    assert.equal(recognizedByEventKey.has(event.eventKey), false, `${event.eventKey} explicit settlement double-counted`);
  }
}

// Synthetic acceptance tests prove the reusable stage contract independent of current event mix.
const base = { eventKey: 'synthetic', company: 'synthetic.eth', usdValue: 1, economicDate: '2026-08-15T00:00:00.000Z' };
let decision = recognitionDecision({ ...base, family: 'accrued-entitlement' });
assert.equal(decision.status, 'recognized');
assert.equal(decision.recognitionBasis, 'canonical-earned-accrual');
assert.equal(decision.settlementStatus, 'earned-not-dependent-on-claim');

decision = recognitionDecision({ ...base, eventKey: 'synthetic-receipt-unproven', family: 'realised-cash-flow' });
assert.equal(decision.status, 'unresolved');
assert.equal(decision.reason, 'realised-receipt-lacks-non-overlap-recognition-proof');

decision = recognitionDecision({
  ...base,
  eventKey: 'synthetic-first-at-settlement',
  family: 'realised-cash-flow',
  incomeRecognition: { recognizesEarnedIncome: true, recognitionId: 'synthetic:first-recognition' }
});
assert.equal(decision.status, 'recognized');
assert.equal(decision.recognitionId, 'synthetic:first-recognition');

decision = recognitionDecision({
  ...base,
  eventKey: 'synthetic-settlement-only',
  family: 'realised-cash-flow',
  incomeRecognition: { recognizesEarnedIncome: false, settlementOf: 'synthetic:prior-earned-income' }
});
assert.equal(decision.status, 'settlement-only');
assert.equal(decision.settlementOf, 'synthetic:prior-earned-income');

decision = recognitionDecision({ ...base, eventKey: 'synthetic-claimable', family: 'claimable-snapshot' });
assert.equal(decision.status, 'unresolved');
assert.equal(decision.reason, 'unsupported-economic-family');

decision = recognitionDecision({ ...base, eventKey: 'synthetic-reinvested', family: 'reinvested' });
assert.equal(decision.status, 'unresolved');
assert.equal(decision.reason, 'unsupported-economic-family');

decision = recognitionDecision({
  eventKey: 'synthetic-cross-month',
  company: 'synthetic.eth',
  family: 'embedded-income',
  usdValue: 1,
  periodStart: '2026-08-31T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
  economicDate: '2026-09-01T00:00:00.000Z',
  periodAttributionStatus: 'cross-month-boundary-unallocated'
});
assert.equal(decision.status, 'unresolved');
assert.equal(decision.reason, 'period-boundary-evidence-pending-no-exact-month-cut');

console.log('Income Lifecycle Acceptance Contract validation PASS', {
  contractVersion: contract.version,
  ledgerEventCount: ledger.events.length,
  recognizedEventCount: view.summary.recognizedEventCount,
  settlementOnlyEventCount: view.summary.settlementOnlyEventCount,
  unresolvedEventCount: view.summary.unresolvedEventCount,
  recognitionIdCount: recognitionIds.size,
  executionAuthority: 'none'
});
