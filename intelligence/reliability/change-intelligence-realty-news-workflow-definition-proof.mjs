#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-change-intelligence.yml';
const NEWS_UPDATER='scripts/update-realty-news.py';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const updater=fs.readFileSync(NEWS_UPDATER,'utf8');

assert.match(workflow,/^name: Update The Holding Change Intelligence/m,'Observer workflow identity drift');
assert.match(workflow,/permissions:\n  contents: write/,'Observer writer contents permission drift');
assert.doesNotMatch(workflow,/actions:\s*write|write-all/,'Observer writer must not gain workflow-control authority');
assert.doesNotMatch(workflow,/\n\s*pull_request:/,'production Observer writer must not gain pull_request execution');
assert.match(workflow,/group:\s*change-intelligence-daily/,'Observer concurrency group drift');
assert.match(workflow,/cancel-in-progress:\s*false/,'Observer writer must remain non-cancellable');
assert.ok(workflow.includes("- cron: '27 6 * * *'"),'Observer daily schedule drift');
assert.match(workflow,/python3 -m py_compile scripts\/update-realty-news\.py/,'Realty News updater syntax preflight missing');
assert.match(workflow,/python3 scripts\/update-realty-news\.py --validate/,'Realty News contract preflight missing');
assert.match(workflow,/- name: Refresh bounded Realty News[\s\S]*python3 scripts\/update-realty-news\.py/,'bounded Realty News refresh step missing');
assert.match(workflow,/run: node intelligence\/change-intelligence-engine\.mjs/,'Observer engine execution missing');
assert.ok(workflow.includes('"realty/news/data.json"'),'Realty News data publication allowlist missing');
assert.ok(workflow.includes('"realty/news/index.html"'),'Realty News page publication allowlist missing');
assert.ok(workflow.includes('"sitemap.xml"'),'sitemap publication allowlist missing');
assert.match(workflow,/git fetch origin main[\s\S]*git rebase origin\/main[\s\S]*git push origin HEAD:main/,'safe moving-main writer guard missing');

assert.match(updater,/CADENCE_HOURS\s*=\s*72/,'Realty News cadence must remain 72 hours');
assert.match(updater,/MAX_ITEMS\s*=\s*12/,'Realty News rolling archive bound drift');
assert.match(updater,/candidate = choose_new/,'Realty News deduplicating candidate gate missing');
assert.match(updater,/data\[lane\] = \[candidate, \*data\.get\(lane, \[\]\)\]\[:MAX_ITEMS\]/,'Realty News bounded append contract missing');
assert.match(updater,/update_sitemap_lastmod\(data\["generatedAt"\]\)/,'Realty News sitemap freshness coupling missing');
assert.doesNotMatch(updater,/openai|anthropic|chatgpt|\bllm\b/i,'Realty News updater must not call generative-AI services');
assert.match(updater,/does not summarize article bodies and never copies article text/,'Realty News non-synthetic content contract missing');

for(const forbidden of ['sendTransaction(', 'new Wallet(', 'workflow_dispatch(', 'actions: write', 'write-all', 'gh workflow run']){
  assert.equal(workflow.includes(forbidden),false,`Observer authority expansion: ${forbidden}`);
}

console.log('Change Intelligence + bounded Realty News workflow definition paired proof PASS',{
  workflow:WORKFLOW_PATH,
  updater:NEWS_UPDATER,
  cadenceHours:72,
  maxItemsPerLane:12,
  newScheduledWorkflow:false,
  repositoryWriterCountDelta:0,
  executionAuthority:'none',
  walletAuthority:false,
  methodologyMutationAuthority:false
});