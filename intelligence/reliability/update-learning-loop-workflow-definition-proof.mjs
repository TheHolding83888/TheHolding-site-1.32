#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const WORKFLOW_PATH = '.github/workflows/update-learning-loop.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

assert.match(workflow, /^# holding-workflow-definition-proof: intelligence\/reliability\/update-learning-loop-workflow-definition-proof\.mjs$/m, 'paired workflow proof marker missing');
assert.match(workflow, /name: "The Holding Brain · Decision Outcome Learning Loop"/, 'Learning Loop identity drift');
assert.match(workflow, /workflow_dispatch:\s*\n\s*workflow_run:\s*\n\s*workflows: \["The Holding Brain · Refresh Cognitive Stack"\]/, 'Learning Loop canonical trigger contract drift');
assert.match(workflow, /push:\s*\n\s*branches: \[main\]/, 'Learning Loop must remain main-push bounded');
assert.doesNotMatch(workflow, /\bpull_request_target\s*:|\brepository_dispatch\s*:|\bschedule\s*:/, 'Learning Loop trigger authority widened');
assert.match(workflow, /permissions:\s*\n\s*contents: write/, 'Learning Loop safe-writer permission missing');
assert.doesNotMatch(workflow, /actions:\s*write|pull-requests:\s*write|issues:\s*write|id-token:\s*write|permissions:\s*write-all/, 'Learning Loop gained unrelated write authority');
assert.match(workflow, /group: decision-learning-main\s*\n\s*cancel-in-progress: false/, 'Learning Loop single-writer concurrency drift');

for (const requiredPath of [
  'intelligence/learning/engineering-incident-ledger.json',
  'intelligence/learning/engineering-lesson-candidate-adapter.mjs',
  'intelligence/learning/independent-engineering-lesson-reviewer.mjs',
]) {
  assert.ok(workflow.includes(`- '${requiredPath}'`), `Learning Loop push path missing: ${requiredPath}`);
}

for (const command of [
  'node --check intelligence/learning/engineering-lesson-candidate-adapter.mjs',
  'node --check intelligence/learning/independent-engineering-lesson-reviewer.mjs',
  'node intelligence/learning/engineering-lesson-candidate-adapter.mjs --self-test',
  'node intelligence/learning/independent-engineering-lesson-reviewer.mjs --self-test',
  'node intelligence/learning/engineering-lesson-candidate-adapter.mjs',
  'node intelligence/learning/independent-engineering-lesson-reviewer.mjs',
]) {
  assert.ok(workflow.includes(command), `Engineering Learning verification command missing: ${command}`);
}

assert.match(workflow, /- name: Build verified engineering lesson candidates\s*\n\s*if: steps\.build\.outputs\.skip != 'true'/, 'engineering candidate build escaped existing Learning Loop gating');
assert.match(workflow, /engineering\.operatingContract\?\.executionAuthority !== 'none'/, 'engineering execution-authority assertion missing');
assert.match(workflow, /engineering\.operatingContract\?\.causalClaimAuthority !== 'none'/, 'engineering causal-authority assertion missing');
assert.match(workflow, /engineering\.summary\?\.formalLessonCount !== 0/, 'formal-Lesson separation assertion missing');
assert.ok(workflow.includes('intelligence/learning-state/engineering-lesson-candidates.json'), 'engineering candidate artifact missing from Learning safe-publisher allowlist');
assert.match(workflow, /git add intelligence\/learning-state/, 'Learning Loop publisher widened beyond learning-state unexpectedly');
assert.doesNotMatch(workflow, /sendTransaction|eth_sendRawTransaction|eth_sendTransaction|\.transfer\(|\.approve\(|walletActionAllowed:\s*true|capitalExecutionAllowed:\s*true/, 'Learning Loop contains wallet/capital execution behavior');

console.log('Decision Outcome Learning Loop engineering-candidate integration workflow definition proof PASS');
