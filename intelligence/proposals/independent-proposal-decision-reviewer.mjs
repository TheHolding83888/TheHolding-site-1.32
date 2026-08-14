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

if (policy.version !== '0.2.1-proposal-decision-policy') errors.push(`unexpected decision policy ${policy.version}`);
if (policy.mode !== 'decision-memory-reflection-no-execution') errors.push('decision policy mode escaped reflection-only');
if (policy.inactiveCaseState !== 'SUPERSEDED') errors.push('inactive case state changed');
for (const k of ['automaticApproval','automaticExecution','productionMutationAuthorized','walletActionAllowed','capitalExecutionAllowed','decisionRecordsExecutable']) {
  if (policy.hardBoundaries?.[k] !== false) errors.push(`decision policy boundary changed: ${k}`);
}
if (learning.status !== 'ready') errors.push(`Learning not ready: ${learning.status}`);
if (learning.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push('Learning/Decision Ledger hash mismatch');
if (q.source?.learningContextSha256 !== shaFile(F.learning)) errors.push('Queue/Learning byte binding mismatch');
if (q.source?.decisionLedgerSha256 !== shaFile(F.ledger)) errors.push('Queue/Decision Ledger byte binding mismatch');
if (q.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push('Queue/Decision Ledger semantic hash mismatch');
if (q.decisionBridge?.policySha256 !== shaFile(F.policy)) errors.push('Queue/Decision Bridge policy byte binding mismatch');
if (q.decisionBridge?.version !== '0.2.1-inactive-case-retirement') errors.push('Decision Bridge version mismatch');
if (q.decisionBridge?.productionMutationAuthorized !== false || q.decisionBridge?.executionAuthority !== 'none') errors.push('Decision Bridge escaped no-execution boundary');

const supersededDecisionIds = new Set((ledger.decisions ?? []).map(d => d.supersedesDecisionId).filter(Boolean));
const effective = new Map();
for (const d of ledger.decisions ?? []) {
  if (supersededDecisionIds.has(d.decisionId)) continue;
  if (effective.has(d.caseKey)) errors.push(`multiple effective decisions for ${d.caseKey}`);
  effective.set(d.caseKey, d);
}
const activeLearning = new Map((learning.activeCases ?? []).filter(c => c.experienceEligibility === 'decision-worthy').map(c => [c.caseKey, c]));
const mapping = policy.dispositionToProposalState ?? {};
let bound = 0, approved = 0, rejected = 0, deferred = 0, historical = 0;

for (const p of q.proposals ?? []) {
  const d = effective.get(p.source?.caseKey) ?? null;
  const learningCase = activeLearning.get(p.source?.caseKey) ?? null;
  const sourceCaseActive = !!learningCase;

  if (!d) {
    const expected = sourceCaseActive ? 'PROPOSED' : 'SUPERSEDED';
    if (p.state !== expected) errors.push(`${p.proposalId}: no-decision state should be ${expected}, got ${p.state}`);
    if (p.decisionBinding) errors.push(`${p.proposalId}: stale decision binding without effective decision`);
    if (!sourceCaseActive && !p.supersededReason) errors.push(`${p.proposalId}: historical item missing SUPERSEDED reason`);
    continue;
  }

  bound += 1;
  const expectedState = sourceCaseActive ? mapping[d.disposition] : policy.inactiveCaseState;
  if (!expectedState) errors.push(`${p.proposalId}: no state mapping for ${d.disposition}`);
  if (p.state !== expectedState) errors.push(`${p.proposalId}: expected ${expectedState}, got ${p.state}`);

  if (sourceCaseActive) {
    const latest = learningCase?.decisionMemory?.latestDecision;
    if (!latest || latest.decisionId !== d.decisionId || latest.disposition !== d.disposition) {
      errors.push(`${p.proposalId}: active Learning decision memory mismatch`);
    }
    if (p.supersededReason) errors.push(`${p.proposalId}: active proposal retained a superseded reason`);
  } else {
    historical += 1;
    if (p.state !== 'SUPERSEDED') errors.push(`${p.proposalId}: inactive decision-bound case was not retired`);
    if (!p.supersededReason) errors.push(`${p.proposalId}: inactive decision-bound proposal missing retirement reason`);
  }

  if (p.decisionBinding?.decisionId !== d.decisionId) errors.push(`${p.proposalId}: decisionId mismatch`);
  if (p.decisionBinding?.decisionHash !== d.integrity?.decisionHash) errors.push(`${p.proposalId}: decisionHash mismatch`);
  if (p.decisionBinding?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push(`${p.proposalId}: ledgerHash mismatch`);
  if (p.decisionBinding?.sourceCaseActive !== sourceCaseActive) errors.push(`${p.proposalId}: sourceCaseActive mismatch`);
  if (p.decisionBinding?.exactDecisionMemory !== true || p.decisionBinding?.authority !== 'human-owner') errors.push(`${p.proposalId}: decision authority binding missing`);
  if (p.decisionBinding?.productionMutationAuthorized !== false || p.decisionBinding?.executionAuthority !== 'none') errors.push(`${p.proposalId}: decision binding escaped authority`);
  if (p.boundaries?.automaticApproval !== false || p.boundaries?.automaticExecution !== false || p.boundaries?.productionMutationAuthorized !== false) errors.push(`${p.proposalId}: proposal boundary changed`);

  if (p.state === 'APPROVED') {
    approved += 1;
    if (!['accept','modify'].includes(d.disposition)) errors.push(`${p.proposalId}: APPROVED state lacks accept/modify decision`);
  }
  if (p.state === 'REJECTED') rejected += 1;
  if (sourceCaseActive && d.disposition === 'defer') deferred += 1;

  if (['accept','modify'].includes(d.disposition)) {
    if (p.human?.approvedBy !== 'owner' || p.human?.approvedAt !== d.recordedAt) errors.push(`${p.proposalId}: owner approval metadata mismatch`);
  } else if (p.human?.approvedBy !== null) {
    errors.push(`${p.proposalId}: non-approved disposition marked approved`);
  }

  const expectedAction = d.disposition === 'modify' ? d.modifiedAction : p.proposedAction;
  if ((p.effectiveAction ?? null) !== (expectedAction ?? null)) errors.push(`${p.proposalId}: effective action mismatch`);
}

const finalActive = (q.proposals ?? []).filter(p => !['REJECTED','SUPERSEDED','RELEASED'].includes(p.state));
const p0 = finalActive.filter(p => p.rankClass === 'P0').length;
const p1 = finalActive.filter(p => p.rankClass === 'P1').length;
const approvalsRequired = finalActive.filter(p => p.boundaries?.humanApprovalRequired === true).length;

if (q.decisionBridge?.boundDecisionCount !== bound) errors.push('bound decision count mismatch');
if (q.decisionBridge?.approvedCount !== approved) errors.push('approved count mismatch');
if (q.decisionBridge?.rejectedCount !== rejected) errors.push('rejected count mismatch');
if (q.decisionBridge?.deferredCount !== deferred) errors.push('deferred count mismatch');
if (q.decisionBridge?.historicalDecisionBoundCount !== historical) errors.push('historical decision-bound count mismatch');
if (q.summary?.ownerDecisionBoundCount !== bound || q.summary?.ownerApprovedCount !== approved || q.summary?.ownerRejectedCount !== rejected || q.summary?.ownerDeferredCount !== deferred || q.summary?.historicalDecisionBoundCount !== historical) errors.push('summary decision counts mismatch');
if (q.summary?.activeProposalCount !== finalActive.length) errors.push('active proposal count mismatch after retirement');
if (q.summary?.p0Count !== p0 || q.summary?.p1Count !== p1) errors.push('priority counts include inactive proposals');
if (q.summary?.requiresHumanApprovalCount !== approvalsRequired) errors.push('approval-required count includes inactive proposals');

const core = { ...q };
delete core.integrity;
if (q.integrity?.queueHash !== stableHash(core)) errors.push('Queue integrity hash mismatch after Decision Bridge');

const report = {
  version: '0.2.1-proposal-decision-eval',
  reviewerVersion: '0.2.1-inactive-case-retirement-reviewer',
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
    activeLearningCases: activeLearning.size,
    effectiveOwnerDecisions: effective.size,
    boundDecisions: bound,
    activeApproved: approved,
    rejected,
    deferred,
    historicalDecisionBound: historical,
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
