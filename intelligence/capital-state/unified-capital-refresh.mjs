#!/usr/bin/env node
/**
 * The Holding · Unified Capital Refresh v0.2
 *
 * Orchestration only. Reuses existing canonical projectors/collectors/builders:
 * Defitea projection -> YieldRing projection -> Productivity collector
 * -> Company #010 compatibility -> YieldRing overlay -> General Balance -> Capital State.
 *
 * No execution authority. No wallet action. No methodology mutation.
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const startedAt = Date.now();

function run(label, cwd, script, env = {}) {
  console.log(`\n=== ${label} ===`);
  const r = spawnSync(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit'
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${label} failed with exit code ${r.status}`);
}
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }
function assert(ok, message) { if (!ok) throw new Error(message); }

run('1/7 Project canonical Defitea state', ROOT, 'companies/defitea-public-capital-projection.mjs');
run('2/7 Project canonical YieldRing state', ROOT, 'companies/yieldring-public-capital-projection.mjs');
run('3/7 Refresh protocol APRs and established Productivity', path.join(ROOT, 'productivity'), 'productivity-engine.mjs', {
  PAGE_FILE: '../companies/index.html',
  DATA_FILE: '../companies/productivity-data.json',
  REPORT_FILE: '../companies/productivity-source-report.json'
});
run('4/7 Admit Company #010 compatibility layer', ROOT, 'productivity/company-010-productivity-overlay.mjs');
run('5/7 Apply canonical YieldRing Productivity overlay', ROOT, 'productivity/yieldring-productivity-overlay.mjs');
run('6/7 Rebuild General Company Balance Sheet', ROOT, 'intelligence/capital-state/general-company-balance-sheet.mjs');
run('7/7 Build Capital State', ROOT, 'intelligence/capital-state/capital-state.mjs');

const defitea = readJson('companies/defitea-canonical-state.json');
const canonical = readJson('companies/yieldring-canonical-state.json');
const productivity = readJson('companies/productivity-data.json');
const general = readJson('intelligence/capital-state/general-company-balance-sheet.json');
const capital = readJson('intelligence/capital-state/capital-state.json');
const companiesHtml = fs.readFileSync(path.join(ROOT, 'companies/index.html'), 'utf8');
const yieldRingPage = fs.readFileSync(path.join(ROOT, 'yieldring/index.html'), 'utf8');

assert(defitea?.authority?.executionAuthority === 'none', 'Defitea authority drift');
assert(defitea?.productivePositions?.length === 11, 'Defitea 11-position inventory missing');
const dp = new Map(defitea.productivePositions.map(x=>[x.assetId,x]));
assert(Number(dp.get('aerodrome-finance')?.quantity) === 2632, 'Defitea canonical AERO drift');
assert(Number(dp.get('fxn-token')?.quantity) === 64.81, 'Defitea canonical FXN drift');
assert(defitea?.costBasis?.aerodrome?.status === 'complete' && Number(defitea.costBasis.aerodrome.costBasisUsd) === 1121.3, 'Defitea AERO lot basis incomplete');
assert(defitea?.costBasis?.fxn?.status === 'complete' && Number(defitea.costBasis.fxn.costBasisUsd) === 983.2386, 'Defitea FXN lot basis incomplete');
assert(defitea?.semantics?.costBasisLotsPreserved === true, 'Defitea lot preservation contract missing');

assert(canonical?.authority?.executionAuthority === 'none', 'YieldRing authority drift');
assert(Number(canonical?.capital?.bitcoin?.quantity) === 0.0334, 'YieldRing canonical BTC drift');
assert(Number(canonical?.capital?.aerodrome?.quantity) === 678, 'YieldRing canonical AERO drift');

assert(productivity?.version === '1.16', `Productivity v1.16 required, got ${productivity?.version}`);
const dpProd = productivity?.companies?.['defitea.eth'];
const dpa = (dpProd?.breakdown || []).find(x => x.engineId === 'aerodrome_veaero' || x.principalId === 'aerodrome-finance');
const dpf = (dpProd?.breakdown || []).find(x => x.engineId === 'fx_vefxn' || x.principalId === 'fxn-token');
assert(dpProd && Number(dpa?.units) === 2632 && Number(dpf?.units) === 64.81, 'Defitea canonical quantities missing from Productivity');
assert(Number(dpProd?.coverage) > 0 && Number(dpProd?.coverage) <= 1, 'Defitea Productivity coverage invalid');

const yp = productivity?.companies?.['YieldRing.eth'];
const ya = (yp?.breakdown || []).find(x => x.engineId === 'aerodrome_veaero' || x.principalId === 'aerodrome-finance');
assert(yp && Number(ya?.units) === 678, 'YieldRing 678 AERO missing from Productivity');
assert(productivity?.diagnostics?.company010?.executionAuthority === 'none', 'Company #010 Productivity authority drift');
assert(productivity?.diagnostics?.yieldRing?.executionAuthority === 'none', 'YieldRing Productivity authority drift');
assert(Date.parse(productivity.generatedAt) >= startedAt - 60_000, 'Productivity snapshot is not fresh for this unified run');

assert(general?.version === '0.1-general-company-balance-sheet' && general?.status === 'ok', 'General Balance contract mismatch');
const dg = (general?.companies || []).find(x => x.registry === '004');
const dga = (dg?.positions || []).find(x => x.assetId === 'aerodrome-finance');
const dgf = (dg?.positions || []).find(x => x.assetId === 'fxn-token');
assert(dg && Number(dga?.units) === 2632 && Number(dgf?.units) === 64.81, 'Defitea quantities missing from General Balance');

const yg = (general?.companies || []).find(x => x.registry === '002');
const ygb = (yg?.positions || []).find(x => x.assetId === 'bitcoin');
const yga = (yg?.positions || []).find(x => x.assetId === 'aerodrome-finance');
assert(yg && Number(ygb?.units) === 0.0334 && Number(yga?.units) === 678, 'YieldRing quantities missing from General Balance');

assert(capital?.version === '0.3-capital-state' && capital?.status === 'ok', 'Capital State contract mismatch');
assert(capital?.network?.registryCompanyCount === 10 && capital?.network?.measuredCompanyCount === 10, 'Capital State Registry coverage mismatch');
assert(capital?.network?.totalCapitalCompleteCompanyCount === 10 && capital?.network?.totalCapitalCoverage === 1, 'Capital State total-capital coverage mismatch');
assert(Number(capital?.network?.networkTvlUsd) > 0 && capital?.network?.networkTvlStatus === 'complete', 'Network TVL unavailable');
const dc = (capital?.companies || []).find(x => x.registry === '004');
const dca = (dc?.measuredPositions || []).find(x => x.assetId === 'aerodrome-finance');
const dcf = (dc?.measuredPositions || []).find(x => x.assetId === 'fxn-token');
assert(dc && Number(dca?.units) === 2632 && Number(dcf?.units) === 64.81, 'Defitea quantities missing from Capital State');
const yc = (capital?.companies || []).find(x => x.registry === '002');
const ycb = (yc?.measuredPositions || []).find(x => x.assetId === 'bitcoin');
const yca = (yc?.measuredPositions || []).find(x => x.assetId === 'aerodrome-finance');
assert(yc && Number(ycb?.units) === 0.0334 && Number(yca?.units) === 678, 'YieldRing quantities missing from Capital State');
assert(capital?.authority?.executionAuthority === 'none', 'Capital State authority drift');

assert(companiesHtml.includes('qty: 2632') && companiesHtml.includes('qty: 64.81'), 'Defitea Registry projection drift');
assert(companiesHtml.includes('costBasisUsd: 1121.3') && companiesHtml.includes('qty: 192, entry: 0.42'), 'Defitea AERO cost-basis projection drift');
assert(companiesHtml.includes('costBasisUsd: 983.2386') && companiesHtml.includes('qty: 5, entry: 16.5'), 'Defitea FXN cost-basis projection drift');
assert(companiesHtml.includes('qty: 0.0334') && companiesHtml.includes('qty: 678'), 'YieldRing Registry projection drift');
assert(yieldRingPage.includes('qty: 0.0334') && yieldRingPage.includes('qty: 678'), 'YieldRing dedicated page projection drift');

console.log('\nUNIFIED CAPITAL REFRESH PASS', {
  productivityGeneratedAt: productivity.generatedAt,
  defiteaAprLatest: dpProd.aprLatest,
  defiteaProductiveValue: dpProd.productiveValue,
  defiteaAero: dca.units,
  defiteaAeroCostBasisUsd: defitea.costBasis.aerodrome.costBasisUsd,
  defiteaFxn: dcf.units,
  defiteaFxnCostBasisUsd: defitea.costBasis.fxn.costBasisUsd,
  yieldRingAprLatest: yp.aprLatest,
  networkTvlUsd: capital.network.networkTvlUsd,
  registryCompanies: capital.network.registryCompanyCount,
  executionAuthority: capital.authority.executionAuthority
});
