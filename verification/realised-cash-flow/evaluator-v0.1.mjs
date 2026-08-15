import fs from 'node:fs';
import { classifyCandidate, buildLedger, POLICY_VERSION, VERSION as CLASSIFIER_VERSION } from '../../intelligence/realised-cash-flow/classifier.mjs';

const fixturePath = process.argv[2] || 'verification/realised-cash-flow/fixtures-v0.1.json';
const outputPath = process.argv[3] || 'artifacts/realised-cash-flow-eval.json';
const fixtures = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

if (fixtures.version !== '0.1-realised-cash-flow-boundary-fixtures' || !Array.isArray(fixtures.cases) || fixtures.cases.length < 10) {
  throw new Error('unexpected realised cash flow fixture corpus');
}

const results = [];
for (const test of fixtures.cases) {
  const r = classifyCandidate(test.candidate);
  const actual = r.ok ? {
    classification: r.row.classification,
    counted: r.row.countedAsRealisedCashFlow,
    usdValue: r.row.usdValue
  } : { rejected: true, reason: r.reason };

  const checks = {
    accepted: r.ok,
    classification: r.ok && r.row.classification === test.expect.classification,
    counted: r.ok && r.row.countedAsRealisedCashFlow === test.expect.counted,
    usdValue: !Object.prototype.hasOwnProperty.call(test.expect, 'usdValue') || (r.ok && r.row.usdValue === test.expect.usdValue)
  };
  checks.pass = Object.values(checks).every(Boolean);
  results.push({ id: test.id, expect: test.expect, actual, checks });
}

const candidates = fixtures.cases.map(x => x.candidate);
const ledger = buildLedger(candidates, {
  generatedAt: '2026-08-15T00:00:00.000Z',
  scope: 'verification-fixture',
  coverageComplete: false,
  coverageDeclaration: 'Fixture corpus proves accounting boundary only; no live protocol-history completeness is implied.'
});

const incomeCases = fixtures.cases.filter(x => x.expect.counted === true);
const expectedAssetTotals = {};
for (const test of incomeCases) {
  const key = test.candidate.asset;
  expectedAssetTotals[key] = Number(((expectedAssetTotals[key] || 0) + Number(test.candidate.amount)).toFixed(12));
}

const falseIncome = results.filter(x => x.actual.counted === true && x.expect.counted !== true);
const missedIncome = results.filter(x => x.expect.counted === true && x.actual.counted !== true);
const principalLeakage = results.filter(x => ['principal-return','contribution','internal-move','borrowed-capital'].includes(x.expect.classification) && x.actual.counted === true);

// Explicit outbound owner distribution must remain outside income.
const distributionCandidate = {
  ...fixtures.cases[0].candidate,
  adapterId: 'boundary-flow-distribution',
  transactionHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
  logIndex: 14,
  direction: 'out',
  economicKind: 'owner-distribution',
  amount: 7,
  usdValue: 7,
  protocolSemanticsVerified: false,
  principalOrInternalContradiction: true
};
const distributionResult = classifyCandidate(distributionCandidate);
const distributionSafe = distributionResult.ok && distributionResult.row.classification === 'distribution' && distributionResult.row.countedAsRealisedCashFlow === false;

// Same adapter, exact same physical event twice must fail closed.
const exactDuplicateLedger = buildLedger([fixtures.cases[0].candidate, fixtures.cases[0].candidate], {
  scope: 'duplicate-proof', coverageComplete: false, generatedAt: '2026-08-15T00:00:00.000Z'
});
const exactDuplicateSafe = exactDuplicateLedger.status === 'blocked' && exactDuplicateLedger.rejected.some(x => x.reason === 'duplicate-event-identity');

// Different adapters observing the same tx/log must not create two cash-flow rows.
const crossAdapterCandidate = {
  ...fixtures.cases[0].candidate,
  adapterId: 'erc20-transfer-supporting-evidence'
};
const crossAdapterLedger = buildLedger([fixtures.cases[0].candidate, crossAdapterCandidate], {
  scope: 'cross-adapter-collision-proof', coverageComplete: false, generatedAt: '2026-08-15T00:00:00.000Z'
});
const crossAdapterCollisionSafe = crossAdapterLedger.status === 'blocked' &&
  crossAdapterLedger.rows.length === 1 &&
  crossAdapterLedger.rejected.some(x => x.reason === 'cross-adapter-physical-event-collision');

const summary = {
  version: '0.1.1-realised-cash-flow-boundary-evaluation',
  fixtureVersion: fixtures.version,
  classifierVersion: CLASSIFIER_VERSION,
  policyVersion: POLICY_VERSION,
  totalCases: results.length,
  passedCases: results.filter(x => x.checks.pass).length,
  failedCases: results.filter(x => !x.checks.pass).length,
  falseIncomeCount: falseIncome.length,
  missedIncomeCount: missedIncome.length,
  principalLeakageCount: principalLeakage.length,
  distributionSafe,
  exactDuplicateSafe,
  crossAdapterCollisionSafe,
  ledgerStatus: ledger.status,
  ledgerRealisedIncomeEventCount: ledger.summary.realisedIncomeEventCount,
  ledgerRealisedCashFlowUsd: ledger.summary.realisedCashFlowUsd,
  ledgerTotalsByAsset: ledger.summary.totalsByAsset,
  expectedAssetTotals,
  executionAuthority: ledger.authority.executionAuthority,
  releaseGate: 'pass'
};

if (summary.failedCases !== 0) summary.releaseGate = 'fail';
if (summary.falseIncomeCount !== 0) summary.releaseGate = 'fail';
if (summary.missedIncomeCount !== 0) summary.releaseGate = 'fail';
if (summary.principalLeakageCount !== 0) summary.releaseGate = 'fail';
if (!summary.distributionSafe || !summary.exactDuplicateSafe || !summary.crossAdapterCollisionSafe) summary.releaseGate = 'fail';
if (JSON.stringify(summary.ledgerTotalsByAsset) !== JSON.stringify(expectedAssetTotals)) summary.releaseGate = 'fail';
if (summary.executionAuthority !== 'none') summary.releaseGate = 'fail';
if (ledger.status !== 'partial') summary.releaseGate = 'fail';
if (ledger.summary.realisedCashFlowUsd !== null) {
  // One measured income fixture intentionally lacks historical USD valuation.
  // A partial USD sum would be misleading, so the aggregate must remain null.
  summary.releaseGate = 'fail';
}

fs.mkdirSync(outputPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({
  summary,
  results,
  ledger,
  invariantProofs: {
    distribution: distributionResult,
    exactDuplicateLedger,
    crossAdapterLedger
  }
}, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
for (const row of results.filter(x => !x.checks.pass)) console.log(`FAIL=${JSON.stringify(row)}`);

if (summary.releaseGate !== 'pass') process.exit(1);
