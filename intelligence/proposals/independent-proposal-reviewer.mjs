#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  queue: 'intelligence/proposals/proposal-queue.json',
  policy: 'intelligence/proposals/proposal-policy.json',
  output: 'intelligence/proposals/proposal-eval.json',
  learning: 'intelligence/learning-state/learning-context.json',
  stack: 'intelligence/cognitive-stack-state.json',
  brain: 'intelligence/brain-intelligence.json',
});
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const shaBytes = (value) => crypto.createHash('sha256').update(value).digest('hex');
const shaFile = (p) => shaBytes(fs.readFileSync(p));
const stable = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const stableHash = (v) => shaBytes(stable(v));

for (const p of Object.values(F).filter(x => x !== F.output)) {
  if (!fs.existsSync(p)) throw new Error(`Reviewer missing required file: ${p}`);
}

const q = read(F.queue);
const policy = read(F.policy);
const learning = read(F.learning);
const stack = read(F.stack);
const errors = [];
const warnings = [];

if (q.version !== '0.1-proposal-work-queue') errors.push(`unexpected queue version ${q.version}`);
if (q.engineVersion !== '0.1.1-deterministic-proposal-engine') errors.push(`unexpected engine version ${q.engineVersion}`);
if (policy.version !== '0.1.1-proposal-policy') errors.push(`unexpected policy version ${policy.version}`);
if (policy.mode !== 'proposal-only-no-execution') errors.push('policy mode escaped proposal-only');
if (policy.authorities?.caseLifecycleAndExperience !== F.learning) errors.push('policy Learning path contract mismatch');
if (policy.authorities?.execution !== 'none') errors.push('policy execution authority changed');

if (stack.readyForManualInterpretation !== true) errors.push('Cognitive Stack not ready');
if (stack.operatingContract?.executionAuthority !== 'none') errors.push('Cognitive execution authority changed');
if (learning.status !== 'ready') errors.push(`Learning not ready: ${learning.status}`);
if (learning.source?.cognitiveChainHash !== stack.integrity?.chainHash) errors.push('Learning/Cognitive chain mismatch');
if (q.source?.cognitiveChainHash !== stack.integrity?.chainHash) errors.push('Queue/Cognitive chain mismatch');
if (q.source?.learningContextFile !== F.learning) errors.push('Queue Learning path mismatch');
if (q.source?.learningContextSha256 !== shaFile(F.learning)) errors.push('Queue Learning byte binding mismatch');
if (q.source?.brainFile !== F.brain) errors.push('Queue Brain path mismatch');
if (q.source?.brainSha256 !== shaFile(F.brain)) errors.push('Queue Brain byte binding mismatch');
if (stack.chain?.groundedBrain?.sha256 && stack.chain.groundedBrain.sha256 !== shaFile(F.brain)) errors.push('Brain/Cognitive byte binding mismatch');

const core = { ...q };
delete core.integrity;
if (q.integrity?.queueHash !== stableHash(core)) errors.push('Queue integrity hash mismatch');

for (const key of ['noTransactions','noSigning','noWalletAccess','noProductionExecution','noAutomaticCodeChanges','noAutomaticApprovals','noPaidModelApiRequired']) {
  if (q.constraints?.[key] !== true) errors.push(`missing hard boundary: ${key}`);
}

const activeCaseKeys = new Set((learning.activeCases ?? []).map(x => x.caseKey));
const ids = new Set();
const keys = new Set();
for (const x of q.proposals ?? []) {
  if (!x.proposalId || ids.has(x.proposalId)) errors.push(`duplicate/missing proposalId ${x.proposalId}`);
  ids.add(x.proposalId);
  if (!x.proposalKey || keys.has(x.proposalKey)) errors.push(`duplicate/missing proposalKey ${x.proposalKey}`);
  keys.add(x.proposalKey);
  if (!policy.states.includes(x.state)) errors.push(`${x.proposalId}: invalid state ${x.state}`);
  if (!policy.riskTiers.includes(x.riskTier)) errors.push(`${x.proposalId}: invalid risk ${x.riskTier}`);
  if (!x.source?.caseKey) errors.push(`${x.proposalId}: no source caseKey`);
  if (!x.source?.cognitiveChainHash) errors.push(`${x.proposalId}: no cognitiveChainHash`);

  const sourceIsActive = activeCaseKeys.has(x.source?.caseKey);
  // Current Proposal states must bind to the current Cognitive chain. A
  // SUPERSEDED proposal is deliberately retained as immutable historical memory,
  // so its source chain is expected to remain the chain on which it was created.
  if (x.state !== 'SUPERSEDED' && x.source?.cognitiveChainHash !== q.source?.cognitiveChainHash) {
    errors.push(`${x.proposalId}: current proposal chain mismatch`);
  }
  if (x.state === 'SUPERSEDED') {
    if (sourceIsActive) errors.push(`${x.proposalId}: SUPERSEDED proposal still has an active source case`);
    if (!x.supersededReason) errors.push(`${x.proposalId}: SUPERSEDED proposal missing reason`);
  }

  if (x.boundaries?.automaticExecution !== false) errors.push(`${x.proposalId}: executable proposal`);
  if (x.boundaries?.automaticApproval !== false) errors.push(`${x.proposalId}: auto-approvable proposal`);
  if (x.boundaries?.humanApprovalRequired !== true) errors.push(`${x.proposalId}: human approval not required`);
  if (x.state === 'PROPOSED' && !sourceIsActive) errors.push(`${x.proposalId}: PROPOSED item has no active source case`);
  if (!Array.isArray(x.verificationRequired) || x.verificationRequired.length < 3) warnings.push(`${x.proposalId}: weak verification plan`);
}

const report = {
  version: '0.1.1-proposal-eval',
  reviewerVersion: '0.1.2-historical-state-aware-proposal-reviewer',
  generatedAt: new Date().toISOString(),
  status: errors.length ? 'fail' : 'pass',
  queueSha256: shaFile(F.queue),
  source: {
    cognitiveChainHash: stack.integrity?.chainHash ?? null,
    learningContextSha256: shaFile(F.learning),
    brainSha256: shaFile(F.brain),
  },
  counts: {
    proposals: q.proposals?.length ?? 0,
    activeLearningCases: learning.activeCases?.length ?? 0,
    errors: errors.length,
    warnings: warnings.length,
  },
  errors,
  warnings,
};
fs.writeFileSync(F.output, JSON.stringify(report, null, 2) + '\n');
console.log('Proposal reviewer', report.status, report.counts);
if (errors.length) process.exit(1);
