#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/unified-capital-refresh.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const orchestrator=fs.readFileSync('intelligence/capital-state/unified-capital-refresh.mjs','utf8');
const ownerProjection=fs.readFileSync('companies/owner-balance-site-projection.mjs','utf8');
const marketRuntimeProjection=fs.readFileSync('companies/public-page-market-runtime-projection.mjs','utf8');
const sitePolishProjection=fs.readFileSync('companies/public-site-polish-projection.mjs','utf8');

assert.match(workflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/unified-capital-refresh-workflow-definition-proof\.mjs$/m,'paired workflow proof marker missing');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*write/,'Unified Capital writer permission missing');
assert.doesNotMatch(workflow,/permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/,'Unified Capital permissions widened');
assert.match(workflow,/concurrency:\s*\n\s*group:\s*unified-capital-refresh\s*\n\s*cancel-in-progress:\s*false/,'Unified Capital concurrency contract drift');
assert.match(workflow,/schedule:\s*\n\s*- cron: '17 4 \* \* 0'/,'bounded weekly fallback schedule drift');
assert.match(workflow,/- "Update Company Rewards"/,'Rewards -> Unified Capital freshness coupling missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.head_branch == 'main'/,'workflow_run success/main gate missing');

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

// Public-surface materialization contract. The owner/current-state projector may
// update these generated pages, therefore the canonical writer must validate and
// publish the same bounded surface set rather than leaving CI-green bytes local.
for (const script of [
  'companies/owner-balance-site-projection.mjs',
  'companies/public-page-market-runtime-projection.mjs',
  'companies/public-site-polish-projection.mjs'
]) {
  assert.match(workflow,new RegExp(script.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')),'public surface projector is not syntax-checked by Unified Capital: '+script);
}
for (const surface of ['index.html','companies/index.html','05081966/index.html','yieldring/index.html','singul/index.html']) {
  const escaped=surface.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const occurrences=(workflow.match(new RegExp(escaped,'g'))||[]).length;
  assert.ok(occurrences>=2,`generated public surface must be staged in both initial and retry publish paths: ${surface}`);
}
assert.match(ownerProjection,/await import\('\.\/public-page-market-runtime-projection\.mjs'\)/,'owner projection no longer chains canonical page runtime projection');
assert.match(ownerProjection,/await import\('\.\/public-site-polish-projection\.mjs'\)/,'owner projection no longer chains bounded site polish');
assert.match(marketRuntimeProjection,/company001DirectBrowserCoinGecko:false/,'Company #001 direct-browser external pricing guard missing');
assert.match(marketRuntimeProjection,/singulDuplicateRuntime:false/,'Singul duplicate price runtime retirement proof missing');
assert.match(sitePolishProjection,/executionAuthority:'none'/,'site polish authority boundary missing');
assert.match(sitePolishProjection,/href=\"\/companies\"/,'homepage Companies navigation projection missing');
assert.match(sitePolishProjection,/href=\"\/realty\"/,'homepage Real Estate navigation projection missing');
assert.match(sitePolishProjection,/data-th-fund-pyramid-links/,'fund pyramid navigation marker missing');
assert.doesNotMatch(sitePolishProjection,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'site polish projector contains wallet/capital transaction behavior');

assert.match(workflow,/for attempt in 1 2 3/,'bounded safe-writer retry contract missing');
assert.match(workflow,/git fetch origin main/,'fresh-main reconciliation missing');
assert.match(workflow,/git rebase origin\/main/,'safe-writer rebase missing');
assert.match(workflow,/git push origin HEAD:main/,'canonical main writer target drift');
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
  rewardsFreshnessCoupling:true,
  voteMarketAfterCanonicalProductivityOverlays:true,
  voteMarketClaimedAwarePersistence:true,
  persistenceStateSourceOfTruth:false,
  capitalDoubleCount:false,
  publicSurfaceMaterialization:true,
  homepagePublicPolishBounded:true,
  company001CanonicalRuntime:true,
  singulDuplicateRuntime:false,
  factualIncomeAuthority:false,
  executionAuthority:'none'
});
