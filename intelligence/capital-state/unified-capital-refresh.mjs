#!/usr/bin/env node
/**
 * The Holding · Unified Capital Refresh v0.2.8
 *
 * Orchestration only. Reuses existing canonical projectors/collectors/builders:
 * Defitea projection -> YieldRing projection -> owner-balance site projection
 * -> Productivity collector -> Company #010 compatibility -> YieldRing overlay
 * -> VoteMarket income channels -> General Balance -> Company #007 current-state
 * downstream binding -> Capital State -> canonical public-site polish projection.
 *
 * v0.2.7 makes the already-canonical public-site polish projector an executed
 * part of the coherent refresh instead of merely a trigger/syntax-check input.
 * v0.2.8 binds the final Collection navigation proof to the canonical v3
 * Collection -> Index controller and fails closed if any retired router survives.
 *
 * No execution authority. No wallet action. No factual-income methodology mutation.
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

run('1/10 Project canonical Defitea state', ROOT, 'companies/defitea-public-capital-projection.mjs');
run('2/10 Project canonical YieldRing state', ROOT, 'companies/yieldring-public-capital-projection.mjs');
run('3/10 Project provenance-explicit owner balance bridges', ROOT, 'companies/owner-balance-site-projection.mjs');
run('4/10 Refresh protocol APRs and established Productivity', path.join(ROOT, 'productivity'), 'productivity-engine.mjs', {
  PAGE_FILE: '../companies/index.html',
  DATA_FILE: '../companies/productivity-data.json',
  REPORT_FILE: '../companies/productivity-source-report.json'
});
run('5/10 Admit Company #010 compatibility layer', ROOT, 'productivity/company-010-productivity-overlay.mjs');
run('6/10 Apply canonical YieldRing Productivity overlay', ROOT, 'productivity/yieldring-productivity-overlay.mjs');
run('7/10 Apply VoteMarket supplementary income channels', ROOT, 'productivity/votemarket-productivity-overlay.mjs');
run('8/10 Rebuild General Company Balance Sheet', ROOT, 'intelligence/capital-state/general-company-balance-sheet.mjs');
run('9/10 Bind Company #007 current state downstream', ROOT, 'intelligence/capital-state/company-007-current-state-downstream.mjs');
run('10/10 Build Capital State', ROOT, 'intelligence/capital-state/capital-state.mjs');
run('Materialize canonical public-site polish', ROOT, 'companies/public-site-polish-projection.mjs');

const defitea = readJson('companies/defitea-canonical-state.json');
const canonical = readJson('companies/yieldring-canonical-state.json');
const company001Owner = readJson('companies/company-001-owner-capital-snapshot.json');
const fundRegistry = readJson('intelligence/market-data/fund-capital-registry.json');
const productivity = readJson('companies/productivity-data.json');
const productivitySource = readJson('companies/productivity-source-report.json');
const voteMarketState = readJson('companies/votemarket-reference-state.json');
const general = readJson('intelligence/capital-state/general-company-balance-sheet.json');
const capital = readJson('intelligence/capital-state/capital-state.json');
const company007Discovery = readJson('companies/company-007-discovery.json');
const company007Resolve = readJson('companies/company-007-resolve.json');
const companiesHtml = fs.readFileSync(path.join(ROOT, 'companies/index.html'), 'utf8');
const yieldRingPage = fs.readFileSync(path.join(ROOT, 'yieldring/index.html'), 'utf8');
const company001Page = fs.readFileSync(path.join(ROOT, '05081966/index.html'), 'utf8');
const singulPage = fs.readFileSync(path.join(ROOT, 'singul/index.html'), 'utf8');

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
assert(Number(canonical?.capital?.frax?.quantity) === 1032, 'YieldRing canonical FRAX drift');
assert(canonical?.capital?.frax?.costBasisStatus === 'partial' && canonical?.capital?.frax?.costBasisUsd === null, 'YieldRing FRAX UNKNOWN cost-basis semantics drift');
assert(Number(canonical?.capital?.frax?.knownCostBasisUsd) === 210.24, 'YieldRing FRAX known cost-basis floor drift');

const owner001Btc=(company001Owner?.positions||[]).find(x=>x.assetId==='bitcoin');
const owner001Lots=owner001Btc?.lots||[];
assert(company001Owner?.authority?.executionAuthority==='none', 'Company #001 owner snapshot authority drift');
assert(Number(owner001Btc?.quantity)===0.00205 && Number(owner001Btc?.entryPriceUsd)===78038.78048780488 && Number(owner001Btc?.costBasisUsd)===159.9795, 'Company #001 owner BTC snapshot drift');
assert(owner001Lots.length===2 && Number(owner001Lots[1]?.quantity)===0.00079 && Number(owner001Lots[1]?.acquisitionPriceUsd)===78300 && Number(owner001Lots[1]?.costBasisUsd)===61.857, 'Company #001 BTC lot history drift');
const singulDiem=(fundRegistry?.funds?.singul?.positions||[]).find(x=>x.assetId==='diem');
assert(Number(singulDiem?.quantity)===0.07 && Number(singulDiem?.fixedTotalValueUsd)===150 && singulDiem?.evidenceStatus==='owner-provided-current', 'Singul DIEM owner snapshot drift');

assert(productivity?.version === '1.16', `Productivity v1.16 required, got ${productivity?.version}`);
const dpProd = productivity?.companies?.['defitea.eth'];
const dpa = (dpProd?.breakdown || []).find(x => x.engineId === 'aerodrome_veaero' || x.principalId === 'aerodrome-finance');
const dpc = (dpProd?.breakdown || []).find(x => x.engineId === 'curve_vecrv' || x.principalId === 'curve-dao-token');
const dpf = (dpProd?.breakdown || []).find(x => x.engineId === 'fx_vefxn' || x.principalId === 'fxn-token');
assert(dpProd && Number(dpa?.units) === 2632 && Number(dpf?.units) === 64.81, 'Defitea canonical quantities missing from Productivity');
assert(Number(dpProd?.coverage) > 0 && Number(dpProd?.coverage) <= 1, 'Defitea Productivity coverage invalid');

const voteMarketDiag = productivity?.diagnostics?.voteMarketIncomeChannels;
assert(voteMarketDiag?.capitalDoubleCount === false, 'VoteMarket capital double-count guard missing');
assert(voteMarketDiag?.idempotent === true, 'VoteMarket idempotency contract missing');
assert(voteMarketDiag?.earnedIncomeAuthority === false && voteMarketDiag?.factualIncomeAuthority === false, 'VoteMarket authority separation drift');
assert(voteMarketDiag?.executionAuthority === 'none', 'VoteMarket execution authority drift');
assert(voteMarketDiag?.claimedPeriodPersistencePending === false, 'VoteMarket claimed-period reference persistence missing');
assert(voteMarketDiag?.observationPersistence === 'claimed-aware-derived-cache', 'VoteMarket persistence mode drift');
assert(voteMarketState?.semantics?.sourceOfTruth === false, 'VoteMarket persistence cache became a source of truth');
assert(voteMarketState?.semantics?.factualIncomeAuthority === false && voteMarketState?.semantics?.earnedIncomeAuthority === false, 'VoteMarket persistence cache factual authority drift');
assert(voteMarketState?.semantics?.executionAuthority === 'none', 'VoteMarket persistence cache execution authority drift');
for (const [label,row,engineId] of [['veCRV',dpc,'curve_vecrv'],['veFXN',dpf,'fx_vefxn']]) {
  assert(row?.incomeChannels?.principalEngineId === engineId, `${label} VoteMarket income-channel hierarchy missing`);
  assert(row?.incomeChannels?.capitalAccounting === 'principal-counted-once' && row?.incomeChannels?.capitalDoubleCount === false, `${label} principal double-count guard missing`);
  assert(row?.incomeChannels?.factualIncomeAuthority === false && row?.incomeChannels?.earnedIncomeAuthority === false, `${label} VoteMarket factual authority drift`);
  assert(Array.isArray(row?.incomeChannels?.displayHierarchy) && row.incomeChannels.displayHierarchy.length === 3, `${label} display hierarchy missing`);
}

const fxnSource = productivitySource?.engines?.fx_vefxn;
const fxnEngine = productivity?.engines?.fx_vefxn;
const fxnEngineHistory = productivity?.history?.engines?.fx_vefxn || [];
const fxnCurrentHistory = fxnEngineHistory.at(-1);
const fxnAuthority = productivity?.diagnostics?.fxnLockerAprAuthority;
const fxnExactApr = Number(fxnAuthority?.exactApr);
const dpfNativeApr = Number(dpf?.incomeChannels?.native?.aprPct ?? dpf?.apr);
const fxnAprSurfaces = {
  sourceReport: Number(fxnSource?.apr),
  canonicalEngine: Number(fxnEngine?.aprLatest),
  currentEngineHistory: Number(fxnCurrentHistory?.apr),
  defiteaNativePosition: dpfNativeApr
};
assert(fxnSource?.status === 'ok' && fxnSource?.sourceType === 'official-frontend-exact-block' && fxnSource?.sourceMetric === 'veFXN Locker APR', 'veFXN exact source-report authority drift');
assert(fxnEngine?.status === 'ok' && fxnEngine?.sourceType === 'official-frontend-exact-block' && fxnEngine?.sourceMetric === 'veFXN Locker APR', 'veFXN canonical engine authority drift');
assert(fxnCurrentHistory?.snapshotKey === productivity?.snapshotKey, 'veFXN current engine-history observation missing');
assert(Number.isFinite(fxnExactApr), 'veFXN exact APR diagnostic missing');
assert(Object.values(fxnAprSurfaces).every(Number.isFinite), 'veFXN canonical native APR surface unavailable');
assert(Object.values(fxnAprSurfaces).every(v => Math.abs(v - fxnExactApr) <= 0.01), `veFXN canonical native APR parity drift: exact=${fxnExactApr} surfaces=${JSON.stringify(fxnAprSurfaces)}`);
assert(fxnAuthority?.canonicalEngineSynchronized === true && fxnAuthority?.currentEngineHistorySynchronized === true && fxnAuthority?.nearbyCirculatingSupplyPctCannotBecomeApr === true, 'veFXN semantic parity authority contract missing');

const yp = productivity?.companies?.['YieldRing.eth'];
const ya = (yp?.breakdown || []).find(x => x.engineId === 'aerodrome_veaero' || x.principalId === 'aerodrome-finance');
const yf = (yp?.breakdown || []).find(x => x.principalId === 'frax-share' || x.engineId === 'frax_vefrax' || x.engineId === 'frax_vefxs');
assert(yp && Number(ya?.units) === 678 && Number(yf?.units) === 1032, 'YieldRing AERO/FRAX canonical quantities missing from Productivity');
assert(productivity?.diagnostics?.company010?.executionAuthority === 'none', 'Company #010 Productivity authority drift');
assert(productivity?.diagnostics?.yieldRing?.executionAuthority === 'none', 'YieldRing Productivity authority drift');
assert(productivity?.diagnostics?.yieldRing?.fraxCostBasisStatus === 'partial', 'YieldRing Productivity partial cost-basis diagnostic missing');
assert(Date.parse(productivity.generatedAt) >= startedAt - 60_000, 'Productivity snapshot is not fresh for this unified run');

const rookProd=productivity?.companies?.["Rook's portfolio"];
const rookDiag=productivity?.diagnostics?.company007CurrentState;
const activeYbMarkets=(company007Resolve?.results?.yieldBasis?.positions||[]).map(x=>x.market).sort();
const expectedYbEngines=activeYbMarkets.map(x=>x==='yb-WBTC'?'yieldbasis_yblp_wbtc':x==='yb-WETH'?'yieldbasis_yblp_weth':`unsupported:${x}`).sort();
const actualYbEngines=(rookProd?.breakdown||[]).map(x=>x.engineId).filter(x=>String(x).startsWith('yieldbasis_yblp_')).sort();
assert(rookProd && rookDiag?.executionAuthority==='none' && rookDiag?.currentStateProofIsIncomeAuthority===false, 'Company #007 current-state Productivity authority missing');
assert(JSON.stringify(actualYbEngines)===JSON.stringify(expectedYbEngines), `Company #007 current YBLP inventory drift expected=${expectedYbEngines} actual=${actualYbEngines}`);
assert(JSON.stringify((rookDiag?.activeYieldBasisMarkets||[]).slice().sort())===JSON.stringify(activeYbMarkets), 'Company #007 current-state diagnostic/YB resolver mismatch');

assert(general?.version === '0.1-general-company-balance-sheet' && general?.status === 'ok', 'General Balance contract mismatch');
const dg = (general?.companies || []).find(x => x.registry === '004');
const dga = (dg?.positions || []).find(x => x.assetId === 'aerodrome-finance');
const dgf = (dg?.positions || []).find(x => x.assetId === 'fxn-token');
assert(dg && Number(dga?.units) === 2632 && Number(dgf?.units) === 64.81, 'Defitea quantities missing from General Balance');

const yg = (general?.companies || []).find(x => x.registry === '002');
const ygb = (yg?.positions || []).find(x => x.assetId === 'bitcoin');
const yga = (yg?.positions || []).find(x => x.assetId === 'aerodrome-finance');
const ygf = (yg?.positions || []).find(x => x.assetId === 'frax-share');
assert(yg && Number(ygb?.units) === 0.0334 && Number(yga?.units) === 678 && Number(ygf?.units) === 1032, 'YieldRing quantities missing from General Balance');
assert(String(yg?.epistemicNote||'').includes('UNKNOWN'), 'YieldRing partial cost-basis epistemic note missing');

const c001g=(general?.companies||[]).find(x=>x.registry==='001');
const c001gb=(c001g?.positions||[]).find(x=>x.assetId==='bitcoin');
assert(c001g && Number(c001gb?.units)===0.00205 && c001gb?.evidenceStatus==='owner-provided-current', 'Company #001 BTC owner snapshot missing from General Balance');
assert(Math.abs(Number(c001gb?.entryPriceUsd)-Number(owner001Btc.entryPriceUsd))<1e-6 && Math.abs(Number(c001gb?.costBasisUsd)-Number(owner001Btc.costBasisUsd))<1e-6, 'Company #001 BTC entry/cost provenance missing from General Balance');

const rookGeneral=(general?.companies||[]).find(x=>x.registry==='007');
const discoveryBook=new Map((company007Discovery?.proposedCompanyBook||[]).map(x=>[x.symbol,x]));
const rookBtc=(rookGeneral?.positions||[]).find(x=>x.assetId==='bitcoin'&&!x.productivityOnly);
const rookEth=(rookGeneral?.positions||[]).find(x=>x.assetId==='ethereum'&&!x.productivityOnly);
assert(rookGeneral?.sourceScope==='company-007-current-state-discovery-plus-targeted-resolver', 'Company #007 General Balance did not adopt current-state authority');
assert(Math.abs(Number(rookBtc?.units)-Number(discoveryBook.get('BTC')?.quantity))<1e-12, 'Company #007 BTC current-state quantity drift');
assert(Math.abs(Number(rookEth?.units)-Number(discoveryBook.get('ETH')?.quantity))<1e-12, 'Company #007 ETH current-state quantity drift');
assert(general?.sourceState?.company007CurrentState?.executionAuthority==='none', 'Company #007 General Balance authority drift');

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
const ycf = (yc?.measuredPositions || []).find(x => x.assetId === 'frax-share');
assert(yc && Number(ycb?.units) === 0.0334 && Number(yca?.units) === 678 && Number(ycf?.units)===1032, 'YieldRing quantities missing from Capital State');
const c001c=(capital?.companies||[]).find(x=>x.registry==='001');
const c001cb=(c001c?.measuredPositions||[]).find(x=>x.assetId==='bitcoin');
assert(c001c && Number(c001cb?.units)===0.00205, 'Company #001 BTC owner snapshot missing from Capital State');
const rc=(capital?.companies||[]).find(x=>x.registry==='007');
const rcb=(rc?.measuredPositions||[]).find(x=>x.assetId==='bitcoin');
const rce=(rc?.measuredPositions||[]).find(x=>x.assetId==='ethereum');
assert(rc&&Math.abs(Number(rcb?.units)-Number(rookBtc?.units))<1e-12&&Math.abs(Number(rce?.units)-Number(rookEth?.units))<1e-12, 'Company #007 current-state quantities missing from Capital State');
assert(capital?.authority?.executionAuthority === 'none', 'Capital State authority drift');

assert(companiesHtml.includes('qty: 2632') && companiesHtml.includes('qty: 64.81'), 'Defitea Registry projection drift');
assert(companiesHtml.includes('costBasisUsd: 1121.3') && companiesHtml.includes('qty: 192, entry: 0.42'), 'Defitea AERO cost-basis projection drift');
assert(companiesHtml.includes('costBasisUsd: 983.2386') && companiesHtml.includes('qty: 5, entry: 16.5'), 'Defitea FXN cost-basis projection drift');
assert(companiesHtml.includes("qty: 1032, entry: null, costBasisUsd: null, costBasisStatus: 'partial'") && companiesHtml.includes('knownCostBasisUsd: 210.24'), 'YieldRing FRAX partial-cost Registry projection drift');
assert(companiesHtml.includes("id: 'bitcoin', qty: 0.00205, entry: 78038.78048780488, costBasisUsd: 159.9795") && companiesHtml.includes("'05081966.eth':  ['Bitcoin','Curve','Aero','Frax']"), 'Company #001 BTC Registry projection drift');
assert(companiesHtml.includes("const finiteUiNumber = v => v !== null") && companiesHtml.includes("costBasisStatus: costComplete ? 'complete' : 'partial'"), 'Registry partial cost-basis null guard missing');
const collectionIndexV3 = [
  'data-th-collection-index-navigation-v3',
  'window.__TH_COLLECTION_INDEX_NAV_V3__',
  "card.removeAttribute('href')",
  'ev.stopImmediatePropagation()',
  'function waitForIndexReady',
  "panel.querySelector('.index-head')"
].every(token => companiesHtml.includes(token));
const retiredCollectionRouterPresent = [
  'data-th-collection-passport-routing-style',
  '<script data-th-collection-passport-routing>',
  'data-th-collection-uniform-explore',
  'data-th-collection-index-entry-v2',
  "card.setAttribute('href','#index')"
].some(token => companiesHtml.includes(token));
assert(collectionIndexV3 && !retiredCollectionRouterPresent, 'Collection -> Index v3 public projection missing or retired Collection router survived');
assert(yieldRingPage.includes('qty: 0.0334') && yieldRingPage.includes('qty: 678') && yieldRingPage.includes('qty: 1032'), 'YieldRing dedicated page projection drift');
assert(company001Page.includes("id: 'bitcoin', name: 'BTC', proto: 'Bitcoin reserve', qty: 0.00205") && company001Page.includes('BTC is held as reserve capital'), 'Company #001 dedicated page projection drift');
assert(singulPage.includes('const FIXED_DIEM_VALUE = 150') && singulPage.includes('owner-confirmed current snapshot'), 'Singul DIEM dedicated page projection drift');

console.log('\nUNIFIED CAPITAL REFRESH PASS', {
  productivityGeneratedAt: productivity.generatedAt,
  defiteaAprLatest: dpProd.aprLatest,
  veFxnExactNativeApr: fxnExactApr,
  veFxnNativeAprSurfaces: fxnAprSurfaces,
  voteMarketMeasuredReferenceCompanyCount: voteMarketDiag.measuredReferenceCompanyCount,
  voteMarketClaimedPeriodPersistencePending: voteMarketDiag.claimedPeriodPersistencePending,
  voteMarketPersistenceMode: voteMarketDiag.observationPersistence,
  defiteaVeCrvVoteMarketStatus: dpc?.incomeChannels?.votemarket?.status || null,
  defiteaVeFxnVoteMarketStatus: dpf?.incomeChannels?.votemarket?.status || null,
  defiteaProductiveValue: dpProd.productiveValue,
  defiteaAero: dca.units,
  defiteaAeroCostBasisUsd: defitea.costBasis.aerodrome.costBasisUsd,
  defiteaFxn: dcf.units,
  defiteaFxnCostBasisUsd: defitea.costBasis.fxn.costBasisUsd,
  yieldRingAprLatest: yp.aprLatest,
  yieldRingFrax: ycf.units,
  yieldRingFraxCostBasisStatus: canonical.capital.frax.costBasisStatus,
  company001Btc: c001cb.units,
  singulDiemFixedTotalValueUsd: singulDiem.fixedTotalValueUsd,
  company007ActiveYbMarkets:activeYbMarkets,
  company007ProductiveValue:rookProd.productiveValue,
  company007TotalCapitalUsd:rookGeneral.totalCapitalUsd,
  networkTvlUsd: capital.network.networkTvlUsd,
  registryCompanies: capital.network.registryCompanyCount,
  publicSitePolishMaterialized: true,
  executionAuthority: capital.authority.executionAuthority
});