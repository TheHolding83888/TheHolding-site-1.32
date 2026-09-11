#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/unified-capital-refresh.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const orchestrator=fs.readFileSync('intelligence/capital-state/unified-capital-refresh.mjs','utf8');
const ownerProjection=fs.readFileSync('companies/owner-balance-site-projection.mjs','utf8');
const marketRuntimeProjection=fs.readFileSync('companies/public-page-market-runtime-projection.mjs','utf8');
const sitePolishProjection=fs.readFileSync('companies/public-site-polish-projection.mjs','utf8');
const sitePolishMaterializer=fs.readFileSync('companies/public-site-polish-materializer.mjs','utf8');
const sitePolishCore=fs.readFileSync('companies/public-site-polish-projection-core.mjs','utf8');

const noWalletPattern=/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/;

// Writer/control-plane boundary.
assert.match(workflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/unified-capital-refresh-workflow-definition-proof\.mjs$/m,'paired workflow proof marker missing');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*write/,'Unified Capital writer permission missing');
assert.doesNotMatch(workflow,/permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/,'Unified Capital permissions widened');
assert.match(workflow,/concurrency:\s*\n\s*group:\s*unified-capital-refresh\s*\n\s*cancel-in-progress:\s*false/,'Unified Capital concurrency contract drift');
assert.match(workflow,/schedule:\s*\n\s*- cron: '17 4 \* \* 0'/,'bounded weekly fallback schedule drift');
assert.match(workflow,/- "Update Company Rewards"/,'Rewards -> Unified Capital freshness coupling missing');
assert.match(workflow,/- "The Holding Market Data · Shared Refresh"/,'Market Data -> Unified Capital handoff missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.head_branch == 'main'/,'workflow_run success/main gate missing');

// Pure Presentation source changes no longer wake the production Capital writer.
const pushBlock=workflow.slice(workflow.indexOf('  push:'),workflow.indexOf('\n\npermissions:'));
assert.ok(pushBlock.length>0,'Unified Capital push block missing');
assert.doesNotMatch(pushBlock,/public-site-polish-(?:projection|materializer|projection-core)\.mjs/,'pure Presentation source still wakes Unified Capital');

// Cheap Market Data admission remains ahead of the heavy capital path.
assert.match(workflow,/^  admission:\s*$/m,'Unified Capital lightweight admission job missing');
assert.match(workflow,/upstream == 'The Holding Market Data · Shared Refresh'/,'Market Data-specific handoff admission missing');
assert.match(workflow,/market_generation = str\(market\.get\('generatedAt'\) or ''\)/,'canonical Market Data generation input missing');
assert.match(workflow,/materialized_generation = str\(\(public\.get\('sourceState'\) or \{\}\)\.get\('marketDataGeneratedAt'\) or ''\)/,'Public Capital materialized generation input missing');
assert.match(workflow,/due = market_generation != materialized_generation/,'Market Data generation parity admission missing');
assert.match(workflow,/market-data-noop-already-materialized/,'Market Data no-op suppression missing');
assert.match(workflow,/needs\.admission\.outputs\.due == 'true'/,'heavy Unified Capital refresh is not admission-gated');

// Capital remains a Market Data consumer, not a second market-data writer.
assert.match(workflow,/node intelligence\/capital-state\/unified-capital-market-data-guard\.mjs/,'canonical Market Data consumer guard missing');
assert.doesNotMatch(workflow,/node intelligence\/market-data\/market-data-engine\.mjs/,'Unified Capital became a Market Data writer');
assert.doesNotMatch(workflow,/git add[\s\\\n\r\t\w./-]*intelligence\/market-data\/market-data\.json/,'Unified Capital stages canonical Market Data');
assert.match(workflow,/pub\.sourceState\?\.marketDataGeneratedAt!==m\.generatedAt/,'same-generation Public Capital validation missing');

// Canonical ten-step capital pipeline is ordered and Presentation-free.
const order=[
  "run('1/10 Project canonical Defitea state'",
  "run('2/10 Project canonical YieldRing state'",
  "run('3/10 Project provenance-explicit owner balance bridges'",
  "run('4/10 Refresh protocol APRs and established Productivity'",
  "run('5/10 Admit Company #010 compatibility layer'",
  "run('6/10 Apply canonical YieldRing Productivity overlay'",
  "run('7/10 Apply VoteMarket supplementary income channels'",
  "run('8/10 Rebuild General Company Balance Sheet'",
  "run('9/10 Bind Company #007 current state downstream'",
  "run('10/10 Build Capital State'"
].map(token=>orchestrator.indexOf(token));
assert.ok(order.every(x=>x>=0)&&order.every((x,i)=>i===0||x>order[i-1]),'canonical 10-step orchestrator order drift');
assert.doesNotMatch(orchestrator,/run\([^\n]*public-site-polish-projection\.mjs/,'Capital orchestrator regained Presentation materialization');
assert.match(orchestrator,/presentationMaterializationOwnedElsewhere:\s*true/,'Capital/Presentation ownership boundary diagnostic missing');

// VoteMarket/reward accounting invariants remain inside Capital.
assert.match(orchestrator,/capitalDoubleCount === false/,'VoteMarket no-double-count assertion missing');
assert.match(orchestrator,/idempotent === true/,'VoteMarket idempotency assertion missing');
assert.match(orchestrator,/earnedIncomeAuthority === false && voteMarketDiag\?\.factualIncomeAuthority === false/,'VoteMarket factual authority separation missing');
assert.match(orchestrator,/claimedPeriodPersistencePending === false/,'VoteMarket claimed-period persistence closure missing');
assert.match(orchestrator,/observationPersistence === 'claimed-aware-derived-cache'/,'VoteMarket persistence mode missing');
assert.match(orchestrator,/voteMarketState\?\.semantics\?\.sourceOfTruth === false/,'VoteMarket derived cache source-of-truth guard missing');
assert.match(orchestrator,/voteMarketState\?\.semantics\?\.executionAuthority === 'none'/,'VoteMarket execution boundary missing');

// Economic public projections may update shared public surfaces, but Capital
// must not retain a compatibility dependency on the Presentation coordinator.
assert.match(ownerProjection,/await import\('\.\/public-page-market-runtime-projection\.mjs'\)/,'owner projection no longer chains canonical page market runtime');
assert.doesNotMatch(ownerProjection,/public-site-polish-projection\.mjs/,'owner projection regained Presentation coordinator dependency');
assert.match(ownerProjection,/presentationMaterializationOwnedElsewhere:\s*true/,'owner projection Presentation ownership diagnostic missing');
assert.match(sitePolishProjection,/export async function materializePublicSitePolish\(\)/,'explicit public-site materialization function missing');
assert.match(sitePolishProjection,/if\(invoked===SELF\)/,'public-site direct-execution gate missing');
assert.match(sitePolishProjection,/await import\('\.\/public-site-polish-materializer\.mjs'\)/,'public-site coordinator delegation missing');
assert.doesNotMatch(sitePolishProjection,/await import\('\.\/public-site-polish-projection-core\.mjs'\)/,'public-site coordinator regained hidden core side effects');
assert.match(sitePolishMaterializer,/await import\('\.\/public-site-polish-projection-core\.mjs'\)/,'materializer no longer delegates shared polish to core');

// Pure Presentation artifacts are not Capital writer surfaces anymore.
const publishBlock=workflow.slice(workflow.indexOf('- name: Publish one coherent capital snapshot safely'));
assert.ok(publishBlock.length>0,'Capital publish block missing');
assert.doesNotMatch(publishBlock,/\n\s+index\.html\s*\\/,'homepage remained in Capital writer surface');
assert.doesNotMatch(publishBlock,/yield-reports\/index\.html/,'Yield Reports remained in Capital writer surface');
for(const surface of ['companies/index.html','05081966/index.html','yieldring/index.html','singul/index.html','companies/productivity-data.json','intelligence/capital-state/capital-state.json','intelligence/market-data/public-capital-state.json']){
  assert.ok(publishBlock.includes(surface),`required Capital-owned surface missing from writer: ${surface}`);
}

// Presentation implementation remains bounded and wallet-free; Capital only
// verifies that its own projections do not damage the already-materialized UI.
assert.match(sitePolishCore,/data-th-fund-pyramid-links/,'fund pyramid presentation contract missing');
assert.match(sitePolishCore,/The Holding · Defitea mobile cash-flow polish/,'Defitea mobile report presentation contract missing');
assert.match(marketRuntimeProjection,/company001DirectBrowserCoinGecko:false/,'Company #001 direct-browser external pricing guard missing');
assert.match(marketRuntimeProjection,/singulDuplicateRuntime:false/,'Singul duplicate price runtime retirement proof missing');
assert.match(workflow,/Capital refresh damaged canonical Collection -> Index v3 state/,'Capital non-damage Presentation guard missing');

// Safe writer mechanics remain bounded on the smaller ownership surface.
assert.match(workflow,/for attempt in 1 2 3/,'bounded safe-writer retry contract missing');
assert.match(workflow,/git fetch origin main/,'fresh-main reconciliation missing');
assert.match(workflow,/git rebase origin\/main/,'safe-writer rebase missing');
assert.match(workflow,/git checkout origin\/main --/,'fresh-main generated-surface reset missing');
assert.match(workflow,/git push origin HEAD:main/,'canonical main writer target drift');
const rebasePos=workflow.indexOf('git rebase origin/main');
const resetPos=workflow.indexOf('git checkout origin/main --',rebasePos);
const retryGuardPos=workflow.indexOf('node intelligence/capital-state/unified-capital-market-data-guard.mjs',resetPos);
const retryRefreshPos=workflow.indexOf('node intelligence/capital-state/unified-capital-refresh.mjs',resetPos);
assert.ok(rebasePos>=0&&resetPos>rebasePos&&retryGuardPos>resetPos&&retryRefreshPos>retryGuardPos,'fresh-main retry ordering drift');

for(const text of [workflow,orchestrator,sitePolishProjection,sitePolishMaterializer,sitePolishCore]){
  assert.doesNotMatch(text,noWalletPattern,'Capital/Presentation boundary contains wallet or capital transaction behavior');
}

console.log('Unified Capital workflow definition proof PASS',{
  orchestratorSteps:10,
  capitalOwnsPresentationMaterialization:false,
  presentationSourceWakesCapitalWriter:false,
  homepageOwnedByCapitalWriter:false,
  yieldReportsOwnedByCapitalWriter:false,
  ownerProjectionDependsOnPresentation:false,
  presentationEntrypointExplicit:true,
  presentationImportSideEffects:false,
  marketDataConsumerOnly:true,
  marketGenerationParity:true,
  rewardsFreshnessCoupling:true,
  voteMarketClaimedAwarePersistence:true,
  capitalDoubleCount:false,
  boundedWriterRetry:true,
  executionAuthority:'none'
});