#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const qf = 'intelligence/proposals/proposal-queue.json';
const pf = 'intelligence/proposals/proposal-policy.json';
const of = 'intelligence/proposals/proposal-eval.json';
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const q = read(qf), p = read(pf);
const errors = [], warnings = [];

if (q.version !== '0.1-proposal-work-queue') errors.push(`unexpected queue version ${q.version}`);
if (p.mode !== 'proposal-only-no-execution') errors.push('policy mode escaped proposal-only');
if (q.constraints?.noProductionExecution !== true) errors.push('execution boundary missing');
if (q.constraints?.noAutomaticCodeChanges !== true) errors.push('automatic code-change boundary missing');
if (q.constraints?.noAutomaticApprovals !== true) errors.push('automatic approval boundary missing');
if (q.constraints?.noPaidModelApiRequired !== true) errors.push('zero-extra-cost boundary missing');

const ids = new Set(), keys = new Set();
for (const x of q.proposals ?? []) {
  if (!x.proposalId || ids.has(x.proposalId)) errors.push(`duplicate/missing proposalId ${x.proposalId}`); ids.add(x.proposalId);
  if (!x.proposalKey || keys.has(x.proposalKey)) errors.push(`duplicate/missing proposalKey ${x.proposalKey}`); keys.add(x.proposalKey);
  if (!p.states.includes(x.state)) errors.push(`${x.proposalId}: invalid state ${x.state}`);
  if (!p.riskTiers.includes(x.riskTier)) errors.push(`${x.proposalId}: invalid risk ${x.riskTier}`);
  if (!x.source?.caseKey) errors.push(`${x.proposalId}: no source caseKey`);
  if (!x.source?.cognitiveChainHash) errors.push(`${x.proposalId}: no cognitiveChainHash`);
  if (x.boundaries?.automaticExecution !== false) errors.push(`${x.proposalId}: executable proposal`);
  if (x.boundaries?.automaticApproval !== false) errors.push(`${x.proposalId}: auto-approvable proposal`);
  if (x.boundaries?.humanApprovalRequired !== true) errors.push(`${x.proposalId}: human approval not required`);
  if (!Array.isArray(x.verificationRequired) || x.verificationRequired.length < 2) warnings.push(`${x.proposalId}: weak verification plan`);
}

const report = {
  version: '0.1-proposal-eval',
  reviewerVersion: '0.1-independent-deterministic-proposal-reviewer',
  generatedAt: new Date().toISOString(),
  status: errors.length ? 'fail' : 'pass',
  queueSha256: sha(qf),
  counts: { proposals: q.proposals?.length ?? 0, errors: errors.length, warnings: warnings.length },
  errors, warnings
};
fs.writeFileSync(of, JSON.stringify(report,null,2)+'\n');
console.log('Proposal reviewer', report.status, report.counts);
if (errors.length) process.exit(1);
