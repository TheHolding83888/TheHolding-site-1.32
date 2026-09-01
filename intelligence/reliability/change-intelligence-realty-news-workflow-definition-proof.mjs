#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH='.github/workflows/update-change-intelligence.yml';
const NEWS_UPDATER='scripts/update-realty-news.py';
const workflow=fs.readFileSync(WORKFLOW_PATH,'utf8');
const updater=fs.readFileSync(NEWS_UPDATER,'utf8');

const requireText=(text,needle,label)=>assert.ok(text.includes(needle),label);

requireText(workflow,'name: Update The Holding Change Intelligence','Observer workflow identity drift');
requireText(workflow,'# holding-workflow-definition-proof: intelligence/reliability/change-intelligence-realty-news-workflow-definition-proof.mjs','paired proof marker missing');
requireText(workflow,'permissions:\n  contents: write','Observer writer contents permission drift');
requireText(workflow,'group: change-intelligence-daily','Observer concurrency group drift');
requireText(workflow,'cancel-in-progress: false','Observer writer must remain non-cancellable');
requireText(workflow,"- cron: '27 6 * * *'",'Observer daily schedule drift');
requireText(workflow,'python3 -m py_compile scripts/update-realty-news.py','Realty News syntax preflight missing');
requireText(workflow,'python3 scripts/update-realty-news.py --validate','Realty News contract preflight missing');
requireText(workflow,'- name: Refresh bounded Realty News','bounded Realty News step missing');
requireText(workflow,'python3 scripts/update-realty-news.py','Realty News updater execution missing');
requireText(workflow,'run: node intelligence/change-intelligence-engine.mjs','Observer engine execution missing');
for(const file of ['realty/news/data.json','realty/news/index.html','sitemap.xml']) requireText(workflow,`"${file}"`,`${file} publication allowlist missing`);
requireText(workflow,'git fetch origin main','safe writer fetch guard missing');
requireText(workflow,'git rebase origin/main','safe writer rebase guard missing');
requireText(workflow,'git push origin HEAD:main','safe writer push guard missing');

assert.equal(workflow.includes('\n  pull_request:'),false,'production Observer writer must not gain pull_request execution');
assert.equal(workflow.includes('actions: write'),false,'Observer writer must not gain actions:write');
assert.equal(workflow.includes('write-all'),false,'Observer writer must not gain write-all');
for(const forbidden of ['sendTransaction(', 'new Wallet(', 'gh workflow run']) assert.equal(workflow.includes(forbidden),false,`Observer authority expansion: ${forbidden}`);

requireText(updater,'MAX_ITEMS = 12','Realty News rolling archive bound drift');
requireText(updater,'CADENCE_HOURS = 72','Realty News cadence must remain 72 hours');
requireText(updater,'candidate = choose_new','Realty News deduplication gate missing');
requireText(updater,'data[lane] = [candidate, *data.get(lane, [])][:MAX_ITEMS]','Realty News bounded append contract missing');
requireText(updater,'update_sitemap_lastmod(data["generatedAt"])','Realty News sitemap freshness coupling missing');
requireText(updater,'does not summarize article bodies and never copies article text','Realty News non-synthetic content contract missing');
for(const service of ['openai','anthropic','chatgpt']) assert.equal(updater.toLowerCase().includes(service),false,`Realty News generative service dependency: ${service}`);

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