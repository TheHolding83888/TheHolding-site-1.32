#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/update-change-intelligence.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

const must = (needle, label) => assert.ok(workflow.includes(needle), label);

must('name: Update The Holding Change Intelligence', 'Observer workflow identity drift');
must("- cron: '27 6 * * *'", 'Observer schedule drift');
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

assert.equal(workflow.includes('\n  pull_request:'), false, 'Observer must not gain pull_request execution');
assert.equal(workflow.includes('actions: write'), false, 'Observer must not gain actions:write');
assert.equal(workflow.includes('write-all'), false, 'Observer must not gain write-all');

console.log('Observer + bounded Realty News paired workflow proof PASS', {
  workflow: WORKFLOW_PATH,
  newScheduledWorkflow: false,
  repositoryWriterCountDelta: 0,
  executionAuthority: 'none',
  walletAuthority: false
});