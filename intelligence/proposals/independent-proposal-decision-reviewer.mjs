#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  queue: 'intelligence/proposals/proposal-queue.json',
  output: 'intelligence/proposals/proposal-decision-eval.json',
  policy: 'intelligence/proposals/proposal-decision-policy.json',
  learning: 'intelligence/learning-state/learning-context.json',
  ledger: 'intelligence/learning/decision-ledger.json'
});
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const shaBytes = v => crypto.createHash('sha256').update(v).digest('hex');
const shaFile = p => shaBytes(fs.readFileSync(p));
const stable = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const stableHash = v => shaBytes(stable(v));

for (const p of Object.values(F).filter(x => x !== F.output)) {
  if (!fs.existsSync(p)) throw new Error(`Decision Bridge reviewer missing required file: ${p}`);
}

const q = read(F.queue);
const policy = read(F.policy);
const learning = read(F.learning);
const ledger = read(F.ledger);
const errors = [];
const warnings = [];

if (policy.version !== '0.2-proposal-decision-policy') errors.push(`unexpected decision policy ${policy.version}`);
if (policy.mode !== 'decision-memory-reflection-no-execution') errors.push('decision policy mode escaped reflection-only');
for (const k of ['automaticApproval','automaticExecution','productionMutationAuthorized','walletActionAllowed','capitalExecutionAllowed','decisionRecordsExecutable']) {
  if (policy.hardBoundaries?.[k] !== false) errors.push(`decision policy boundary changed: ${k}`);
}
if (learning.status !== 'ready') errors.push(`Learning not ready: ${learning.status}`);
if (learning.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push('Learning/Decision Ledger hash mismatch');
if (q.source?.learningContextSha256 !== shaFile(F.learning)) errors.push('Queue/Learning byte binding mismatch');
if (q.source?.decisionLedgerSha256 !== shaFile(F.ledger)) errors.push('Queue/Decision Ledger byte binding mismatch');
if (q.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push('Queue/Decision Ledger semantic hash mismatch');
if (q.decisionBridge?.policySha256 !== shaFile(F.policy)) errors.push('Queue/Decision Bridge policy byte binding mismatch');
if (q.decisionBridge?.productionMutationAuthorized !== false || q.decisionBridge?.executionAuthority !== 'none') errors.push('Decision Bridge escaped no-execution boundary');

const superseded = new Set((ledger.decisions ?? []).map(d => d.supersedesDecisionId).filter(Boolean));
const effective = new Map();
for (const d of ledger.decisions ?? []) {
  if (superseded.has(d.decisionId)) continue;
  if (effective.has(d.caseKey)) errors.push(`multiple effective decisions for ${d.caseKey}`);
  effective.set(d.caseKey, d);
}
const mapping = policy.dispositionToProposalState ?? {};
let bound = 0, approved = 0, rejected = 0, deferred = 0;
for (const p of q.proposals ?? []) {
  const d = effective.get(p.source?.caseKey) ?? null;
  if (!d) {
    if (!['PROPOSED','SUPERSEDED'].includes(p.state)) errors.push(`${p.proposalId}: state ${p.state} has no owner decision`);
    if (p.decisionBinding) errors.push(`${p.proposalId}: stale decision binding without effective decision`);
    continue;
  }
  bound += 1;
  const expectedState = mapping[d.disposition];
  if (p.state !== expectedState) errors.push(`${p.proposalId}: ${d.disposition} should map to ${expectedState}, got ${p.state}`);
  if (p.decisionBinding?.decisionId !== d.decisionId) errors.push(`${p.proposalId}: decisionId mismatch`);
  if (p.decisionBinding?.decisionHash !== d.integrity?.decisionHash) errors.push(`${p.proposalId}: decisionHash mismatch`);
  if (p.decisionBinding?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push(`${p.proposalId}: ledgerHash mismatch`);
  if (p.decisionBinding?.exactDecisionMemory !== true || p.decisionBinding?.authority !== 'human-owner') errors.push(`${p.proposalId}: decision authority binding missing`);
  if (p.decisionBinding?.productionMutationAuthorized !== false || p.decisionBinding?.executionAuthority !== 'none') errors.push(`${p.proposalId}: decision binding escaped authority`);
  if (p.boundaries?.automaticApproval !== false || p.boundaries?.automaticExecution !== false || p.boundaries?.productionMutationAuthorized !== false) errors.push(`${p.proposalId}: proposal boundary changed`);
  if (['accept','modify'].includes(d.disposition)) {
    approved += 1;
    if (p.human?.approvedBy !== 'owner' || p.human?.approvedAt !== d.recordedAt) errors.push(`${p.proposalId}: owner approval metadata mismatch`);
  } else if (d.disposition === 'reject') {
    rejected += 1;
    if (p.human?.approvedBy !== null) errors.push(`${p.proposalId}: rejected proposal marked approved`);
  } else if (d.disposition === 'defer') {
    deferred += 1;
  }
  const expectedAction = d.disposition === 'modify' ? d.modifiedAction : p.proposedAction;
  if ((p.effectiveAction ?? null) !== (expectedAction ?? null)) errors.push(`${p.proposalId}: effective action mismatch`);
}

if (q.decisionBridge?.boundDecisionCount !== bound) errors.push('bound decision count mismatch');
if (q.decisionBridge?.approvedCount !== approved) errors.push('approved count mismatch');
if (q.decisionBridge?.rejectedCount !== rejected) errors.push('rejected count mismatch');
if (q.decisionBridge?.deferredCount !== deferred) errors.push('deferred count mismatch');
if (q.summary?.ownerDecisionBoundCount !== bound || q.summary?.ownerApprovedCount !== approved || q.summary?.ownerRejectedCount !== rejected || q.summary?.ownerDeferredCount !== deferred) errors.push('summary decision counts mismatch');

const core = { ...q };
delete core.integrity;
if (q.integrity?.queueHash !== stableHash(core)) errors.push('Queue integrity hash mismatch after Decision Bridge');

const report = {
  version: '0.2-proposal-decision-eval',
  reviewerVersion: '0.2-independent-proposal-decision-reviewer',
  generatedAt: new Date().toISOString(),
  status: errors.length ? 'fail' : 'pass',
  source: {
    queueSha256: shaFile(F.queue),
    learningContextSha256: shaFile(F.learning),
    decisionLedgerSha256: shaFile(F.ledger),
    decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
    decisionPolicySha256: shaFile(F.policy)
  },
  counts: {
    proposals: q.proposals?.length ?? 0,
    effectiveOwnerDecisions: effective.size,
    boundDecisions: bound,
    approved,
    rejected,
    deferred,
    errors: errors.length,
    warnings: warnings.length
  },
  errors,
  warnings,
  boundaries: {
    automaticApproval: false,
    automaticExecution: false,
    productionMutationAuthorized: false,
    executionAuthority: 'none'
  }
};
fs.writeFileSync(F.output, JSON.stringify(report, null, 2) + '\n');
console.log('Proposal Decision Bridge reviewer', report.status, report.counts);
if (errors.length) process.exit(1);
