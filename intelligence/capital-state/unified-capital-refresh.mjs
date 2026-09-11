#!/usr/bin/env node
/**
 * The Holding · Unified Capital Refresh v0.2.10
 *
 * Capital orchestration only. Reuses existing canonical projectors/collectors/builders:
 * Defitea projection -> YieldRing projection -> owner-balance site projection
 * -> Productivity collector -> Company #010 compatibility -> YieldRing overlay
 * -> VoteMarket income channels -> General Balance -> Company #007 current-state
 * downstream binding -> Capital State.
 *
 * Presentation materialization is intentionally not owned by this orchestrator.
 * Capital may project canonical economic data into shared public surfaces, but
 * homepage/navigation/report polish is a separate presentation responsibility.
 *
 * v0.2.10 preserves complete historical acquisition basis for the current
 * Defitea and YieldRing economic positions while preserving dynamic current
 * valuation from canonical market data. Owner evidence is not silently upgraded
 * to independently reproduced onchain evidence.
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
function close(a,b,t=0.005){return Number.isFinite(Number(a))&&Math.abs(Number(a)-Number(b))<=t;}

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

assert(defitea?.version==='0.2-defitea-canonical-state' && defitea?.authority?.executionAuthority === 'none', 'Defitea authority/version drift');
assert(defitea?.productivePositions?.length === 11, 'Defitea 11-position inventory missing');
const dp = new Map(defitea.productivePositions.map(x=>[x.assetId,x]));
assert(Number(dp.get('aerodrome-finance')?.quantity) === 2632.61, 'Defitea canonical AERO drift');
assert(Number(dp.get('convex-finance')?.quantity) === 1333.8, 'Defitea canonical CVX drift');
assert(Number(dp.get('pendle')?.quantity) === 501.74, 'Defitea canonical PENDLE drift');
assert(Number(dp.get('frax-share')?.quantity) === 4456.96, 'Defitea canonical FRAX drift');
assert(Number(dp.get('fxn-token')?.quantity) === 64.81, 'Defitea canonical FXN drift');
assert(defitea?.costBasis?.status === 'complete' && close(defitea.costBasis.totalUsd,9724.36), 'Defitea complete portfolio basis missing');
assert(defitea.productivePositions.every(x=>Number.isFinite(Number(x.costBasisUsd))), 'Defitea current position without explicit cost basis');
assert(close(defitea?.evidenceSnapshot?.marketValueUsd,12814.37)&&close(defitea?.evidenceSnapshot?.unrealizedProfitUsd,3090.01), 'Defitea screenshot reconciliation drift');

assert(canonical?.version==='0.2-yieldring-canonical-state' && canonical?.authority?.executionAuthority === 'none', 'YieldRing authority/version drift');
assert(Number(canonical?.capital?.bitcoin?.quantity) === 0.0334, 'YieldRing canonical BTC drift');
assert(Number(canonical?.capital?.aerodrome?.quantity) === 678, 'YieldRing canonical AERO drift');
assert(Number(canonical?.capital?.frax?.quantity) === 1032, 'YieldRing canonical FRAX drift');
assert(canonical?.portfolioCostBasis?.status === 'complete' && close(canonical.portfolioCostBasis.totalUsd,2984.6), 'YieldRing complete portfolio basis missing');
assert(canonical?.capital?.frax?.costBasisStatus === 'complete' && close(canonical?.capital?.frax?.costBasisUsd,279.57), 'YieldRing complete FRAX basis missing');
assert(canonical?.wallet?.onchainReconciliationStatus === 'pending-independent-reproduction', 'YieldRing owner evidence was silently upgraded to onchain confirmation');

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
assert(dpProd && Number(dpa?.units) === 2632.61 && Number(dpf?.units) === 64.81, 'Defitea canonical quantities missing from Productivity');
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
const fxnAprSurfaces = {sourceReport:Number(fxnSource?.apr),canonicalEngine:Number(fxnEngine?.aprLatest),currentEngineHistory:Number(fxnCurrentHistory?.apr),defiteaNativePosition:dpfNativeApr};
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
assert(productivity?.diagnostics?.yieldRing?.fraxCostBasisStatus === 'complete' && close(productivity?.diagnostics?.yieldRing?.fraxCostBasisUsd,279.57), 'YieldRing Productivity complete cost-basis diagnostic missing');
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
const dgfr = (dg?.positions || []).find(x => x.assetId === 'frax-share');
assert(dg && Number(dga?.units) === 2632.61 && Number(dgf?.units) === 64.81 && Number(dgfr?.units)===4456.96, 'Defitea quantities missing from General Balance');
assert(dg?.costBasisStatus==='complete'&&close(dg?.historicalCostBasisUsd,9724.36)&&close(dga?.costBasisUsd,1038.45)&&close(dgfr?.costBasisUsd,1777.44), 'Defitea complete basis missing from General Balance');

const yg = (general?.companies || []).find(x => x.registry === '002');
const ygb = (yg?.positions || []).find(x => x.assetId === 'bitcoin');
const yga = (yg?.positions || []).find(x => x.assetId === 'aerodrome-finance');
const ygf = (yg?.positions || []).find(x => x.assetId === 'frax-share');
assert(yg && Number(ygb?.units) === 0.0334 && Number(yga?.units) === 678 && Number(ygf?.units) === 1032, 'YieldRing quantities missing from General Balance');
assert(yg?.costBasisStatus==='complete'&&close(yg?.historicalCostBasisUsd,2984.6)&&close(ygf?.costBasisUsd,279.57), 'YieldRing complete basis missing from General Balance');
assert(String(yg?.epistemicNote||'').includes('independent'), 'YieldRing provenance boundary note missing');

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
assert(dc && Number(dca?.units) === 2632.61 && Number(dcf?.units) === 64.81, 'Defitea quantities missing from Capital State');
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

assert(companiesHtml.includes('qty: 2632.61') && companiesHtml.includes('qty: 64.81') && companiesHtml.includes('qty: 4456.96'), 'Defitea Registry projection drift');
assert(companiesHtml.includes('costBasisUsd: 1038.45') && companiesHtml.includes('costBasisUsd: 1777.44') && companiesHtml.includes('costBasisUsd: 1713.55'), 'Defitea complete cost-basis projection drift');
assert(companiesHtml.includes('qty: 1032') && companiesHtml.includes('costBasisUsd: 279.57') && companiesHtml.includes('costBasisUsd: 2123.11'), 'YieldRing complete cost-basis Registry projection drift');
assert(!companiesHtml.includes('knownCostBasisUsd: 210.24'), 'retired YieldRing partial known-basis evidence survived');
assert(companiesHtml.includes("id: 'bitcoin', qty: 0.00205, entry: 78038.78048780488, costBasisUsd: 159.9795") && companiesHtml.includes("'05081966.eth':  ['Bitcoin','Curve','Aero','Frax']"), 'Company #001 BTC Registry projection drift');
assert(companiesHtml.includes("const finiteUiNumber = v => v !== null") && companiesHtml.includes("costBasisStatus: costComplete ? 'complete' : 'partial'"), 'Registry partial cost-basis null guard missing');
const collectionIndexV3 = ['data-th-collection-index-navigation-v3','window.__TH_COLLECTION_INDEX_NAV_V3__',"card.removeAttribute('href')",'ev.stopImmediatePropagation()','function waitForIndexReady',"panel.querySelector('.index-head')"].every(token => companiesHtml.includes(token));
const retiredCollectionRouterPresent = ['data-th-collection-passport-routing-style','<script data-th-collection-passport-routing>','data-th-collection-uniform-explore','data-th-collection-index-entry-v2',"card.setAttribute('href','#index')"].some(token => companiesHtml.includes(token));
assert(collectionIndexV3 && !retiredCollectionRouterPresent, 'Capital projection damaged canonical Collection -> Index v3 presentation state');
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
  defiteaCostBasisUsd: defitea.costBasis.totalUsd,
  yieldRingAprLatest: yp.aprLatest,
  yieldRingFrax: ycf.units,
  yieldRingCostBasisUsd: canonical.portfolioCostBasis.totalUsd,
  yieldRingOnchainReconciliationStatus: canonical.wallet.onchainReconciliationStatus,
  company001Btc: c001cb.units,
  singulDiemFixedTotalValueUsd: singulDiem.fixedTotalValueUsd,
  company007ActiveYbMarkets:activeYbMarkets,
  company007ProductiveValue:rookProd.productiveValue,
  company007TotalCapitalUsd:rookGeneral.totalCapitalUsd,
  networkTvlUsd: capital.network.networkTvlUsd,
  registryCompanies: capital.network.registryCompanyCount,
  presentationMaterializationOwnedElsewhere: true,
  executionAuthority: capital.authority.executionAuthority
});