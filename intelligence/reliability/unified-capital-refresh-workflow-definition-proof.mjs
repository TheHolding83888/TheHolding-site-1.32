#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/unified-capital-refresh.yml';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const orchestrator=fs.readFileSync('intelligence/capital-state/unified-capital-refresh.mjs','utf8');

assert.match(workflow,/^# holding-workflow-definition-proof: intelligence\/reliability\/unified-capital-refresh-workflow-definition-proof\.mjs$/m,'paired workflow proof marker missing');
assert.match(workflow,/permissions:\s*\n\s*contents:\s*write/,'Unified Capital writer permission missing');
assert.doesNotMatch(workflow,/permissions:\s*write-all|actions:\s*write|pull-requests:\s*write/,'Unified Capital permissions widened');
assert.match(workflow,/concurrency:\s*\n\s*group:\s*unified-capital-refresh\s*\n\s*cancel-in-progress:\s*false/,'Unified Capital concurrency contract drift');
assert.match(workflow,/schedule:\s*\n\s*- cron: '17 4 \* \* 0'/,'bounded weekly fallback schedule drift');
assert.match(workflow,/- "Update Company Rewards"/,'Rewards -> Unified Capital freshness coupling missing');
assert.match(workflow,/github\.event\.workflow_run\.conclusion == 'success' && github\.event\.workflow_run\.head_branch == 'main'/,'workflow_run success/main gate missing');

assert.match(workflow,/node productivity\/votemarket-productivity-overlay-validation\.mjs/,'VoteMarket deterministic validation missing');
assert.match(orchestrator,/run\('6\/9 Apply VoteMarket supplementary income channels', ROOT, 'productivity\/votemarket-productivity-overlay\.mjs'\)/,'VoteMarket overlay missing from canonical orchestrator');
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

assert.match(workflow,/for attempt in 1 2 3/,'bounded safe-writer retry contract missing');
assert.match(workflow,/git fetch origin main/,'fresh-main reconciliation missing');
assert.match(workflow,/git rebase origin\/main/,'safe-writer rebase missing');
assert.match(workflow,/git push origin HEAD:main/,'canonical main writer target drift');
assert.doesNotMatch(workflow,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'Unified Capital workflow contains wallet/capital transaction behavior');
assert.doesNotMatch(orchestrator,/sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|\.claim\(|\.vote\(/,'Unified Capital orchestrator contains wallet/capital transaction behavior');

const order=[
  orchestrator.indexOf("run('3/9 Refresh protocol APRs and established Productivity'"),
  orchestrator.indexOf("run('4/9 Admit Company #010 compatibility layer'"),
  orchestrator.indexOf("run('5/9 Apply canonical YieldRing Productivity overlay'"),
  orchestrator.indexOf("run('6/9 Apply VoteMarket supplementary income channels'"),
  orchestrator.indexOf("run('7/9 Rebuild General Company Balance Sheet'"),
  orchestrator.indexOf("run('9/9 Build Capital State'")
];
assert.ok(order.every(x=>x>=0)&&order.every((x,i)=>i===0||x>order[i-1]),'canonical orchestrator order drift');

console.log('Unified Capital refresh workflow definition proof PASS',{
  rewardsFreshnessCoupling:true,
  voteMarketAfterCanonicalProductivityOverlays:true,
  voteMarketClaimedAwarePersistence:true,
  persistenceStateSourceOfTruth:false,
  capitalDoubleCount:false,
  factualIncomeAuthority:false,
  executionAuthority:'none'
});
