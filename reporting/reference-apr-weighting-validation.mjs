import fs from 'node:fs';

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

console.log('Reference APR capital-weighting PASS', {
  checkedCompanies: checked,
  multiPositionCompanies: multiPositionChecked,
  unknownAprPositionsExcluded: unknownAprExcluded,
  defiteaCoveredCapitalUsd: Number(defiteaCapital.toFixed(2)),
  defiteaWeightedAprPct: Number(defiteaWeighted.toFixed(6)),
  defiteaPublishedAprPct: Number(defitea.aprLatest)
});