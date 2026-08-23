#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const sha = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const run = file => execFileSync('node', [file], { stdio: 'inherit' });

const required = [
  'intelligence/cognitive-stack-state.json',
  'intelligence/learning-state/learning-context.json',
  'intelligence/learning/decision-ledger.json',
  'intelligence/proposals/proposal-release-guard.mjs',
  'intelligence/proposals/proposal-engine.mjs',
  'intelligence/proposals/proposal-decision-bridge.mjs',
  'intelligence/proposals/independent-proposal-reviewer.mjs',
  'intelligence/proposals/independent-proposal-decision-reviewer.mjs',
  'intelligence/builder/builder-release-guard.mjs',
  'intelligence/builder/builder-engine.mjs',
  'intelligence/builder/independent-builder-reviewer.mjs',
  'intelligence/guardian/guardian-release-guard.mjs',
  'intelligence/guardian/guardian-engine.mjs',
  'intelligence/guardian/independent-guardian-reviewer.mjs'
];
for (const file of required) {
  if (!fs.existsSync(file) || fs.statSync(file).size === 0) throw new Error(`Missing governance fixture dependency: ${file}`);
}

// Rebuild only generated governance state in the temporary CI workspace.
// Nothing here is staged, committed or published.
run('intelligence/proposals/proposal-release-guard.mjs');
run('intelligence/proposals/proposal-engine.mjs');
run('intelligence/proposals/proposal-decision-bridge.mjs');
run('intelligence/proposals/independent-proposal-reviewer.mjs');
run('intelligence/proposals/independent-proposal-decision-reviewer.mjs');

run('intelligence/builder/builder-release-guard.mjs');
run('intelligence/builder/builder-engine.mjs');
run('intelligence/builder/independent-builder-reviewer.mjs');

run('intelligence/guardian/guardian-release-guard.mjs');
run('intelligence/guardian/guardian-engine.mjs');
run('intelligence/guardian/independent-guardian-reviewer.mjs');

const stack = JSON.parse(fs.readFileSync('intelligence/cognitive-stack-state.json', 'utf8'));
const learning = JSON.parse(fs.readFileSync('intelligence/learning-state/learning-context.json', 'utf8'));
const proposal = JSON.parse(fs.readFileSync('intelligence/proposals/proposal-queue.json', 'utf8'));
const proposalEval = JSON.parse(fs.readFileSync('intelligence/proposals/proposal-eval.json', 'utf8'));
const proposalDecisionEval = JSON.parse(fs.readFileSync('intelligence/proposals/proposal-decision-eval.json', 'utf8'));
const builder = JSON.parse(fs.readFileSync('intelligence/builder/candidate-queue.json', 'utf8'));
const builderEval = JSON.parse(fs.readFileSync('intelligence/builder/candidate-eval.json', 'utf8'));
const guardian = JSON.parse(fs.readFileSync('intelligence/guardian/guardian-state.json', 'utf8'));
const guardianEval = JSON.parse(fs.readFileSync('intelligence/guardian/guardian-eval.json', 'utf8'));

if (learning.source?.cognitiveChainHash !== stack.integrity?.chainHash) throw new Error('Fixture Learning/Cognitive binding mismatch');
if (proposal.source?.learningContextSha256 !== sha('intelligence/learning-state/learning-context.json')) throw new Error('Fixture Proposal/Learning byte binding mismatch');
if (proposalEval.status !== 'pass' || proposalDecisionEval.status !== 'pass') throw new Error('Fixture Proposal reviewer failed');
if (builder.source?.proposalQueueSha256 !== sha('intelligence/proposals/proposal-queue.json')) throw new Error('Fixture Builder/Proposal byte binding mismatch');
if (builderEval.status !== 'pass') throw new Error('Fixture Builder reviewer failed');
if (guardian.source?.candidateQueueSha256 !== sha('intelligence/builder/candidate-queue.json')) throw new Error('Fixture Guardian/Builder byte binding mismatch');
if (guardianEval.status !== 'pass') throw new Error('Fixture Guardian reviewer failed');
if (proposal.decisionBridge?.executionAuthority !== 'none' || builder.constraints?.executionAuthority !== 'none' || guardian.constraints?.executionAuthority !== 'none') throw new Error('Fixture governance execution boundary changed');

console.log(JSON.stringify({
  status: 'pass',
  purpose: 'temporary coherent Ask governance fixture',
  learningGeneratedAt: learning.generatedAt,
  proposalGeneratedAt: proposal.generatedAt,
  builderGeneratedAt: builder.generatedAt,
  guardianGeneratedAt: guardian.generatedAt,
  proposalCount: proposal.summary?.activeProposalCount ?? null,
  builderCandidateCount: builder.summary?.candidateCount ?? null,
  executionAuthority: 'none',
  publication: false
}, null, 2));
