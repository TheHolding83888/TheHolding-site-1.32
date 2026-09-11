#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/unified-capital-refresh.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const orchestrator=fs.readFileSync('intelligence/capital-state/unified-capital-refresh.mjs','utf8');
const ownerProjection=fs.readFileSync('companies/owner-balance-site-projection.mjs','utf8');
const marketRuntimeProjection=fs.readFileSync('companies/public-page-market-runtime-projection.mjs','utf8');
const sitePolishProjection=fs.readFileSync('companies/public-site-polish-projection.mjs','utf8');
const sitePolishCore=fs.readFileSync('companies/public-site-polish-projection-core.mjs','utf8');

assert.match(workflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/unified-capital-refresh-workflow-definition-proof\.mjs$/m,'paired workflow proof marker missing');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*write/,'Unified Capital writer permission missing');
assert.doesNotMatch(workflow,/permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/,'Unified Capital permissions widened');
assert.match(workflow,/concurrency:\s*\n\s*group:\s*unified-capital-refresh\s*\n\s*cancel-in-progress:\s*false/,'Unified Capital concurrency contract drift');
assert.match(workflow,/schedule:\s*\n\s*- cron: '17 4 \* \* 0'/,'bounded weekly fallback schedule drift');
assert.match(workflow,/- "Update Company Rewards"/,'Rewards -> Unified Capital freshness coupling missing');
assert.match(workflow,/- "The Holding Market Data · Shared Refresh"/,'Market Data -> Unified Capital workflow_run handoff missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.head_branch == 'main'/,'workflow_run success/main gate missing');

// Market Data handoff must be explicit and cheap. GITHUB_TOKEN-authored pushes are
// not treated as a reliable downstream wake. A Market Data workflow completion is
// observed instead, then generation parity suppresses scheduled/no-op completions.
assert.match(workflow,/^  admission:\s*$/m,'Unified Capital lightweight admission job missing');
assert.match(workflow,/Checkout canonical main for handoff admission/,'handoff admission does not inspect canonical main');
assert.match(workflow,/UPSTREAM_WORKFLOW: \$\{\{ github\.event\.workflow_run\.name \}\}/,'upstream workflow identity not bound into admission');
assert.match(workflow,/upstream == 'The Holding Market Data · Shared Refresh'/,'Market Data-specific handoff admission missing');
assert.match(workflow,/market_generation = str\(market\.get\('generatedAt'\) or ''\)/,'canonical Market Data generation admission input missing');
assert.match(workflow,/materialized_generation = str\(\(public\.get\('sourceState'\) or \{\}\)\.get\('marketDataGeneratedAt'\) or ''\)/,'Public Capital materialized Market Data generation input missing');
assert.match(workflow,/due = market_generation != materialized_generation/,'Market Data generation parity admission missing');
assert.match(workflow,/market-data-noop-already-materialized/,'Market Data no-op suppression reason missing');
assert.match(workflow,/needs\.admission\.outputs\.due == 'true'/,'heavy Unified Capital refresh is not gated by lightweight admission');

assert.match(workflow,/node productivity\/votemarket-productivity-overlay-validation\.mjs/,'VoteMarket deterministic validation missing');
assert.match(orchestrator,/run\('7\/10 Apply VoteMarket supplementary income channels', ROOT, 'productivity\/votemarket-productivity-overlay\.mjs'\)/,'VoteMarket overlay missing from canonical orchestrator');
assert.match(orchestrator,/capitalDoubleCount === false/,'VoteMarket no-double-count assertion missing');
assert.match(orchestrator,/idempotent === true/,'VoteMarket idempotency assertion missing');
assert.match(orchestrator,/earnedIncomeAuthority === false && voteMarketDiag\?\.factualIncomeAuthority === false/,'VoteMarket factual authority separation missing');
assert.match(orchestrator,/claimedPeriodPersistencePending === false/,'VoteMarket claimed-period persistence closure missing');
assert.match(orchestrator,/observationPersistence === 'claimed-aware-derived-cache'/,'VoteMarket claimed-aware persistence mode missing');
assert.match(orchestrator,/voteMarketState\?\.semantics\?\.sourceOfTruth === false/,'VoteMarket derived cache source-of-truth guard missing');
assert.match(orchestrator,/voteMarketState\?\.semantics\?\.executionAuthority === 'none'/,'VoteMarket derived cache execution boundary missing');
assert.match(workflow,/companies\/votemarket-reference-state\.json/,'VoteMarket persistence cache is not published by the coherent writer');
assert.match(workflow,/vmState\?\.semantics\?\.sourceOfTruth!==false/,'VoteMarket persistence cache runtime source-of-truth guard missing');

assert.match(workflow,/node intelligence\/capital-state\/unified-capital-market-data-guard\.mjs/,'canonical Market Data consumer guard missing');
assert.doesNotMatch(workflow,/node intelligence\/market-data\/market-data-engine\.mjs/,'Unified Capital must not become a Market Data writer');
assert.doesNotMatch(workflow,/git add[\s\\\n\r\t\w./-]*intelligence\/market-data\/market-data\.json/,'Unified Capital must not stage canonical Market Data');
assert.match(workflow,/pub\.sourceState\?\.marketDataGeneratedAt!==m\.generatedAt/,'same-generation Public Capital validation missing');

// Company quantities used by final coherence validation must come from the same
// canonical states that drive the public Company Book, not duplicated literals.
assert.match(workflow,/const defiteaState=JSON\.parse\(fs\.readFileSync\('companies\/defitea-canonical-state\.json','utf8'\)\)/,'Defitea canonical quantity authority missing from final validation');
assert.match(workflow,/const yieldRingState=JSON\.parse\(fs\.readFileSync\('companies\/yieldring-canonical-state\.json','utf8'\)\)/,'YieldRing canonical quantity authority missing from final validation');
assert.match(workflow,/expectedDefiteaAero=Number\(canonicalDefiteaAero\?\.quantity\)/,'Defitea AERO canonical quantity binding missing');
assert.match(workflow,/expectedDefiteaFxn=Number\(canonicalDefiteaFxn\?\.quantity\)/,'Defitea FXN canonical quantity binding missing');
assert.match(workflow,/Number\(da\?\.units\)!==expectedDefiteaAero/,'Defitea Productivity is not checked against canonical AERO quantity');
assert.match(workflow,/Number\(dca\?\.units\)!==expectedDefiteaAero/,'Defitea Capital State is not checked against canonical AERO quantity');
assert.match(workflow,/Number\(a\?\.units\)!==expectedYieldRingAero/,'YieldRing Productivity is not checked against canonical AERO quantity');
assert.match(workflow,/Number\(btc\?\.units\)!==expectedYieldRingBtc/,'YieldRing Capital State is not checked against canonical BTC quantity');
assert.doesNotMatch(workflow,/Number\(da\?\.units\)!==2632\|\|/,'stale rounded Defitea AERO literal survived final validation');

for (const script of [
  'companies/owner-balance-site-projection.mjs',
  'companies/public-page-market-runtime-projection.mjs',
  'companies/public-site-polish-projection.mjs'
]) {
  assert.match(workflow,new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'public surface projector is not syntax-checked by Unified Capital: '+script);
}
const generatedSurfaces=['index.html','companies/index.html','05081966/index.html','yieldring/index.html','singul/index.html','yield-reports/index.html'];
for (const surface of generatedSurfaces) {
  const escaped=surface.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const occurrences=(workflow.match(new RegExp(escaped,'g'))||[]).length;
  assert.ok(occurrences>=3,`generated public surface must be initial-staged, fresh-main-reset and retry-staged: ${surface}`);
}
assert.match(ownerProjection,/await import\('\.\/public-page-market-runtime-projection\.mjs'\)/,'owner projection no longer chains canonical page runtime projection');
assert.match(ownerProjection,/await import\('\.\/public-site-polish-projection\.mjs'\)/,'owner projection no longer chains bounded site polish');
assert.match(sitePolishProjection,/await import\('\.\/public-site-polish-projection-core\.mjs'\)/,'public-site coordinator no longer delegates shared polish to core');
assert.match(marketRuntimeProjection,/company001DirectBrowserCoinGecko:false/,'Company #001 direct-browser external pricing guard missing');
assert.match(marketRuntimeProjection,/singulDuplicateRuntime:false/,'Singul duplicate price runtime retirement proof missing');
assert.match(sitePolishCore,/href=\"\/companies\"/,'homepage Companies navigation projection missing');
assert.match(sitePolishCore,/href=\"\/realty\"/,'homepage Real Estate navigation projection missing');
assert.match(sitePolishCore,/data-th-fund-pyramid-links/,'fund pyramid navigation marker missing');
assert.match(sitePolishCore,/Capital Architecture · Onchain Companies · Real Estate/,'homepage Capital Architecture footer projection missing');
assert.match(workflow,/home\.includes\('Capital Architecture · Onchain Companies · Real Estate'\)/,'Unified validation does not prove Capital Architecture footer materialization');
assert.match(sitePolishCore,/YIELD_REPORTS='yield-reports\/index\.html'/,'Yield Reports generated surface binding missing');
assert.match(sitePolishCore,/The Holding · Defitea mobile cash-flow polish/,'Defitea mobile report polish marker missing');
assert.match(sitePolishCore,/defiteaMobileCashFlowVisible:true/,'Defitea mobile cash-flow visibility proof missing');
assert.match(workflow,/yieldReportsPage\.includes\('The Holding · Defitea mobile cash-flow polish'\)/,'Unified validation does not prove mobile report materialization');
assert.doesNotMatch(sitePolishProjection,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'site polish coordinator contains wallet/capital transaction behavior');
assert.doesNotMatch(sitePolishCore,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'site polish core contains wallet/capital transaction behavior');

assert.match(workflow,/for attempt in 1 2 3/,'bounded safe-writer retry contract missing');
assert.match(workflow,/git fetch origin main/,'fresh-main reconciliation missing');
assert.match(workflow,/git rebase origin\/main/,'safe-writer rebase missing');
assert.match(workflow,/git checkout origin\/main --/,'fresh-main generated-surface reset missing');
assert.match(workflow,/git push origin HEAD:main/,'canonical main writer target drift');
const rebasePos=workflow.indexOf('git rebase origin/main');
const resetPos=workflow.indexOf('git checkout origin/main --',rebasePos);
const retryGuardPos=workflow.indexOf('node intelligence/capital-state/unified-capital-market-data-guard.mjs',resetPos);
const retryRefreshPos=workflow.indexOf('node intelligence/capital-state/unified-capital-refresh.mjs',resetPos);
assert.ok(rebasePos>=0&&resetPos>rebasePos&&retryGuardPos>resetPos&&retryRefreshPos>retryGuardPos,'fresh-main reset must occur after rebase and before retry guard/recompute');
for(const surface of [...generatedSurfaces,'companies/productivity-data.json','companies/productivity-source-report.json','companies/votemarket-reference-state.json','intelligence/capital-state/general-company-balance-sheet.mjs','intelligence/capital-state/general-company-balance-sheet.json','intelligence/capital-state/capital-state.json','intelligence/market-data/public-capital-state.json']){
  const resetBlock=workflow.slice(resetPos,retryGuardPos);
  assert.ok(resetBlock.includes(surface),`fresh-main retry reset missing generated surface: ${surface}`);
}
assert.doesNotMatch(workflow,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'Unified Capital workflow contains wallet/capital transaction behavior');
assert.doesNotMatch(orchestrator,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'Unified Capital orchestrator contains wallet/capital transaction behavior');

const order=[
  orchestrator.indexOf("run('1/10 Project canonical Defitea state'"),
  orchestrator.indexOf("run('2/10 Project canonical YieldRing state'"),
  orchestrator.indexOf("run('3/10 Project provenance-explicit owner balance bridges'"),
  orchestrator.indexOf("run('4/10 Refresh protocol APRs and established Productivity'"),
  orchestrator.indexOf("run('5/10 Admit Company #010 compatibility layer'"),
  orchestrator.indexOf("run('6/10 Apply canonical YieldRing Productivity overlay'"),
  orchestrator.indexOf("run('7/10 Apply VoteMarket supplementary income channels'"),
  orchestrator.indexOf("run('8/10 Rebuild General Company Balance Sheet'"),
  orchestrator.indexOf("run('9/10 Bind Company #007 current state downstream'"),
  orchestrator.indexOf("run('10/10 Build Capital State'")
];
assert.ok(order.every(x=>x>=0)&&order.every((x,i)=>i===0||x>order[i-1]),'canonical 10-step orchestrator order drift');

console.log('Unified Capital refresh workflow definition proof PASS',{
  orchestratorSteps:10,
  marketDataWorkflowRunHandoff:true,
  marketDataNoopSuppression:true,
  marketGenerationParity:true,
  canonicalCompanyQuantityAuthority:true,
  publicSitePolishLayering:true,
  freshMainRetryReset:true,
  rewardsFreshnessCoupling:true,
  voteMarketAfterCanonicalProductivityOverlays:true,
  voteMarketClaimedAwarePersistence:true,
  persistenceStateSourceOfTruth:false,
  capitalDoubleCount:false,
  publicSurfaceMaterialization:true,
  homepagePublicPolishBounded:true,
  defiteaMobileReportMaterialization:true,
  company001CanonicalRuntime:true,
  singulDuplicateRuntime:false,
  factualIncomeAuthority:false,
  executionAuthority:'none'
});