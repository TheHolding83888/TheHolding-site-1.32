import fs from 'node:fs';
import { eventMonth, recognitionDecision, buildCanonicalEarnedIncomeView } from './canonical-earned-income-view.mjs';

const FILE = process.env.PRODUCTIVITY_DATA_FILE || './companies/productivity-data.json';
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const nearlyEqual = (a, b, tolerance = 0.001) => Math.abs(Number(a) - Number(b)) <= tolerance;

let checked = 0;
let multiPositionChecked = 0;
let unknownAprExcluded = 0;

for (const [name, company] of Object.entries(data.companies || {})) {
  const breakdown = Array.isArray(company?.breakdown) ? company.breakdown : [];
  if (!breakdown.length || !finite(company?.aprLatest)) continue;

  const covered = breakdown.filter(row => finite(row?.value) && Number(row.value) > 0 && finite(row?.apr));
  if (!covered.length) continue;

  const coveredCapital = covered.reduce((sum, row) => sum + Number(row.value), 0);
  const weightedApr = covered.reduce((sum, row) => sum + Number(row.value) * Number(row.apr), 0) / coveredCapital;

  if (!nearlyEqual(weightedApr, company.aprLatest)) {
    throw new Error(`${name}: Reference APR is not capital-weighted: expected ${weightedApr}, found ${company.aprLatest}`);
  }

  if (finite(company.coveredProductiveValue) && Math.abs(coveredCapital - Number(company.coveredProductiveValue)) > 0.05) {
    throw new Error(`${name}: covered productive capital no longer matches positions with valid Reference APR`);
  }

  const unknown = breakdown.filter(row => finite(row?.value) && Number(row.value) > 0 && !finite(row?.apr));
  if (unknown.length) {
    unknownAprExcluded += unknown.length;
    const allCapital = breakdown.filter(row => finite(row?.value) && Number(row.value) > 0).reduce((sum, row) => sum + Number(row.value), 0);
    if (!(allCapital > coveredCapital)) throw new Error(`${name}: unknown-APR position was not excluded from covered capital`);
  }

  if (covered.length > 1) {
    multiPositionChecked += 1;
    const arithmeticApr = covered.reduce((sum, row) => sum + Number(row.apr), 0) / covered.length;
    const materiallyDifferentWeights = Math.max(...covered.map(row => Number(row.value))) / Math.min(...covered.map(row => Number(row.value))) > 1.1;
    if (materiallyDifferentWeights && nearlyEqual(arithmeticApr, company.aprLatest, 0.0001) && !nearlyEqual(arithmeticApr, weightedApr, 0.0001)) {
      throw new Error(`${name}: Reference APR appears to have drifted to a simple arithmetic mean`);
    }
  }

  checked += 1;
}

if (!checked) throw new Error('No company Reference APRs were validated');
if (!multiPositionChecked) throw new Error('No multi-position company was available to prove capital weighting');

const defitea = data.companies?.['defitea.eth'];
if (!defitea || !finite(defitea.aprLatest)) throw new Error('Defitea Reference APR missing');
const defiteaCovered = (defitea.breakdown || []).filter(row => finite(row?.value) && Number(row.value) > 0 && finite(row?.apr));
const defiteaCapital = defiteaCovered.reduce((sum, row) => sum + Number(row.value), 0);
const defiteaWeighted = defiteaCovered.reduce((sum, row) => sum + Number(row.value) * Number(row.apr), 0) / defiteaCapital;
if (!nearlyEqual(defiteaWeighted, defitea.aprLatest)) throw new Error('Defitea capital-weighted Reference APR regression');

const exactBoundaryEvent = {
  eventKey: 'fixture:exact-calendar-month',
  company: 'fixture.eth',
  family: 'embedded-income',
  economicDate: '2026-08-31',
  periodStart: '2026-08-01T00:00:00.000Z',
  periodEnd: '2026-09-01T00:00:00.000Z',
  usdValue: 10,
  sourceFile: 'reporting/ve33-locked-managed-accounting-evidence.json',
  sourceEvidenceFamily: 'embedded-compounded-income',
  sourceFamily: 've(3,3) LockedManagedReward factual accrual',
  referenceAprUsed: false,
  openingBalanceCreatesIncome: false,
  earnedIndependentOfWithdrawal: true,
  withdrawalIsSettlementNotSecondIncome: true,
  grossVeNftPrincipalDeltaIsIncomeAuthority: false,
  claimIsSecondIncomeEvent: false,
  laterClaimOrPriceMoveDoesNotRewriteIncome: true,
  unknownIsNotZero: true
};
if (eventMonth(exactBoundaryEvent) !== '2026-08') throw new Error('Exact closed calendar-month embedded interval was not attributed to August');
const exactDecision = recognitionDecision(exactBoundaryEvent);
if (exactDecision.status !== 'recognized' || exactDecision.month !== '2026-08') throw new Error('Exact closed calendar-month embedded interval was not recognized once in August');

const view = buildCanonicalEarnedIncomeView({
  version: '0.1-canonical-income-ledger',
  generatedAt: '2026-09-08T00:00:00.000Z',
  semantics: { unknownIsNotZero: true, referenceAprCanBackfillEarnedIncome: false },
  events: [exactBoundaryEvent]
});
if (view.summary.recognizedEventCount !== 1) throw new Error('Exact calendar-month fixture was recognized more or less than once');
if (view.byCompanyMonth?.['fixture.eth']?.['2026-08']?.recognizedIncomeUsd !== 10) throw new Error('Exact calendar-month fixture did not land in August');
if (view.byCompanyMonth?.['fixture.eth']?.['2026-09']) throw new Error('Exact August calendar-month fixture leaked into September');

const arbitraryCrossMonth = { ...exactBoundaryEvent, eventKey: 'fixture:arbitrary-cross-month', periodStart: '2026-08-15T00:00:00.000Z', periodEnd: '2026-09-15T00:00:00.000Z' };
if (eventMonth(arbitraryCrossMonth) !== null) throw new Error('Arbitrary cross-month embedded interval gained month attribution');

const missingProof = { ...exactBoundaryEvent, eventKey: 'fixture:missing-proof', sourceEvidenceFamily: null };
if (eventMonth(missingProof) !== null) throw new Error('Exact month boundary without canonical mechanism proof gained attribution');

const aprContaminated = { ...exactBoundaryEvent, eventKey: 'fixture:apr-contaminated', referenceAprUsed: true };
if (eventMonth(aprContaminated) !== null) throw new Error('Reference APR contaminated exact-month attribution');

const wrongEconomicMonth = { ...exactBoundaryEvent, eventKey: 'fixture:wrong-economic-month', economicDate: '2026-09-01' };
if (eventMonth(wrongEconomicMonth) !== null) throw new Error('Exact boundary with economicDate outside prior month gained attribution');

const settlement = {
  eventKey: 'fixture:settlement',
  company: 'fixture.eth',
  family: 'realised-cash-flow',
  economicDate: '2026-09-02',
  periodStart: '2026-09-02',
  periodEnd: '2026-09-02',
  usdValue: 10,
  incomeRecognition: { recognizesEarnedIncome: false, settlementOf: 'earned:fixture:exact-calendar-month' }
};
const settlementDecision = recognitionDecision(settlement);
if (settlementDecision.status !== 'settlement-only') throw new Error('Settlement re-recognized prior embedded income');

console.log('Reference APR capital-weighting + exact month-boundary accounting PASS', {
  checkedCompanies: checked,
  multiPositionCompanies: multiPositionChecked,
  unknownAprPositionsExcluded: unknownAprExcluded,
  defiteaCoveredCapitalUsd: Number(defiteaCapital.toFixed(2)),
  defiteaWeightedAprPct: Number(defiteaWeighted.toFixed(6)),
  defiteaPublishedAprPct: Number(defitea.aprLatest),
  exactBoundaryMonth: exactDecision.month,
  arbitraryCrossMonthRemainsUnresolved: true,
  settlementRemainsSettlementOnly: true
});