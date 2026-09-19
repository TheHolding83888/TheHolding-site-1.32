#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/update-change-intelligence.yml';
const REPORTING_HEARTBEAT = 'reporting/reporting-data.json';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');
const triggerBlock = workflow.match(/^on:\n[\s\S]*?\npermissions:/m)?.[0] || '';

const must = (needle, label) => assert.ok(workflow.includes(needle), label);

must('name: Update The Holding Change Intelligence', 'Observer workflow identity drift');
must("- cron: '27 6 * * *'", 'Observer schedule drift');
must('push:', 'Observer automatic fallback trigger missing');
must('branches: [main]', 'Observer fallback must remain main-only');
must(REPORTING_HEARTBEAT, 'Observer canonical Reporting heartbeat missing');
must('intelligence/change-intelligence-engine.mjs', 'Observer engine self-probe missing');
must('.github/workflows/update-change-intelligence.yml', 'Observer workflow self-probe missing');
must('intelligence/reliability/change-intelligence-realty-news-workflow-definition-proof.mjs', 'Observer proof self-probe missing');
must('group: change-intelligence-daily', 'Observer concurrency group drift');
must('cancel-in-progress: false', 'Observer concurrency safety drift');
must('permissions:\n  contents: write', 'Observer contents permission drift');
must('- name: Refresh bounded Realty News', 'bounded Realty News step missing');
must('python3 scripts/update-realty-news.py', 'bounded Realty News updater missing');
must('run: node intelligence/change-intelligence-engine.mjs', 'Observer engine execution missing');
must('"realty/news/data.json"', 'Realty News data publication missing');
must('"realty/news/index.html"', 'Realty News page publication missing');
must('"sitemap.xml"', 'Realty News sitemap publication missing');
must('git fetch origin main', 'safe writer fetch guard missing');
must('git rebase origin/main', 'safe writer rebase guard missing');
must('git push origin HEAD:main', 'safe writer push guard missing');

assert.ok(triggerBlock, 'Observer trigger block missing');
assert.equal((triggerBlock.match(/\bcron:\s*/g) || []).length, 1, 'Observer must keep exactly one cron declaration');
assert.equal((triggerBlock.match(/reporting\/reporting-data\.json/g) || []).length, 1, 'Observer trigger must keep exactly one canonical Reporting heartbeat path');
assert.equal(workflow.includes('\n  pull_request:'), false, 'Observer must not gain pull_request execution');
assert.equal(workflow.includes('actions: write'), false, 'Observer must not gain actions:write');
assert.equal(workflow.includes('write-all'), false, 'Observer must not gain write-all');

console.log('Observer + bounded Realty News paired workflow proof PASS', {
  workflow: WORKFLOW_PATH,
  cronUtc: '27 6 * * *',
  automaticFallbackHeartbeat: REPORTING_HEARTBEAT,
  fallbackSemantics: 'canonical Reporting publication wakes the existing Observer writer; no duplicate writer and no workflow-dispatch authority added',
  newScheduledWorkflow: false,
  repositoryWriterCountDelta: 0,
  duplicateWriterAdded: false,
  executionAuthority: 'none',
  walletAuthority: false
});
