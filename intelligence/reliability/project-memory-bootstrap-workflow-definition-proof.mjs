#!/usr/bin/env node
import fs from 'node:fs';

const workflowPath = '.github/workflows/update-project-memory-bootstrap.yml';
const text = fs.readFileSync(workflowPath, 'utf8');

const required = [
  'name: "The Holding · Project Memory Bootstrap"',
  'branches: [main]',
  'workflow_run:',
  'workflows: ["The Holding Security Sentinel"]',
  "cron: '17 * * * *'",
  'workflow_dispatch:',
  'permissions:\n  contents: write',
  'concurrency:\n  group: project-memory-bootstrap-main\n  cancel-in-progress: false',
  'test -s intelligence/project-memory/CONTINUITY.md',
  'node intelligence/project-memory/verify-continuity-checkpoint.mjs',
  'node intelligence/project-memory/build-current-memory.mjs',
  'node intelligence/project-memory/verify-current-memory.mjs',
  'git add intelligence/project-memory/CURRENT.md',
  "grep -Ev '^intelligence/project-memory/CURRENT\\.md$'",
  'memory: refresh current project bootstrap',
  'git push origin HEAD:main',
];

for (const phrase of required) {
  if (!text.includes(phrase)) throw new Error(`Project Memory Bootstrap workflow proof missing contract: ${phrase}`);
}

const forbidden = [
  'git add -A',
  'git add .',
  'workflow_dispatch_authority',
  'walletAuthority: true',
  'executionAuthority: true',
];
for (const phrase of forbidden) {
  if (text.includes(phrase)) throw new Error(`Project Memory Bootstrap workflow proof found forbidden widening: ${phrase}`);
}

const currentStageMatches = [...text.matchAll(/git add intelligence\/project-memory\/CURRENT\.md/g)];
if (currentStageMatches.length !== 1) {
  throw new Error(`Expected exactly one CURRENT staging command, found ${currentStageMatches.length}`);
}

if (!text.includes("- 'intelligence/project-memory/CURRENT.md'")) {
  throw new Error('CURRENT self-write path-ignore missing');
}

console.log('Project Memory Bootstrap workflow-definition proof PASS', {
  workflowPath,
  soleGeneratedMutationBoundary: 'intelligence/project-memory/CURRENT.md',
  continuityRootVerified: true,
  executionAuthority: 'none',
});
