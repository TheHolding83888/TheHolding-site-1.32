import fs from 'node:fs';

// Visible quick commands are product promises: exact UI text must have exact Core coverage.
// Any cleaned candidate re-synced with fresh main must re-run Experience on these exact bytes.
// Nearby navigation language still proves generalization through fresh seeded Mutation, not exact-string memorization.
const app = fs.readFileSync('agents/console/app.js', 'utf8');
const core = JSON.parse(fs.readFileSync('verification/ask-experience/corpus-core-v0.1.json', 'utf8'));

const match = app.match(/function buildQuick\(\)\s*\{[\s\S]*?const labels = \[([\s\S]*?)\];/);
if (!match) throw new Error('Quick-command contract: buildQuick labels not found');

const labels = [...match[1].matchAll(/['"]([^'"]+)['"]/g)].map(x => x[1]);
if (!labels.length) throw new Error('Quick-command contract: no labels parsed');

const prompts = new Set();
for (const test of core.cases || []) {
  if (typeof test.prompt === 'string') prompts.add(test.prompt);
  if (Array.isArray(test.session)) for (const prompt of test.session) prompts.add(prompt);
}

const missing = labels.filter(label => !prompts.has(label));
if (missing.length) throw new Error('Quick-command contract: UI command lacks exact core regression coverage: ' + missing.join(' | '));

console.log(JSON.stringify({
  version: '0.1-quick-command-contract',
  quickCommandCount: labels.length,
  coveredCount: labels.length,
  labels
}, null, 2));
