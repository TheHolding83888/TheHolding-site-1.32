#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  queue: 'intelligence/proposals/proposal-queue.json',
  brief: 'intelligence/proposals/proposal-brief.md',
  policy: 'intelligence/proposals/proposal-decision-policy.json',
  learning: 'intelligence/learning-state/learning-context.json',
  ledger: 'intelligence/learning/decision-ledger.json',
});

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const shaBytes = value => crypto.createHash('sha256').update(value).digest('hex');
const shaFile = p => shaBytes(fs.readFileSync(p));
const stable = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const stableHash = v => shaBytes(stable(v));
const fail = m => { throw new Error(m); };

for (const p of [F.queue, F.policy, F.learning, F.ledger]) {
  if (!fs.existsSync(p)) fail(`Proposal Decision Bridge missing required file: ${p}`);
}

const q = read(F.queue);
const policy = read(F.policy);
const learning = read(F.learning);
const ledger = read(F.ledger);

if (q.version !== '0.1-proposal-work-queue') fail(`Unexpected Proposal queue version: ${q.version}`);
if (q.engineVersion !== '0.1.2-decision-eligible-proposal-engine') fail(`Unexpected Proposal engine version: ${q.engineVersion}`);
if (policy.version !== '0.2.1-proposal-decision-policy') fail(`Unexpected Proposal Decision policy: ${policy.version}`);
if (policy.mode !== 'decision-memory-reflection-no-execution') fail('Proposal Decision policy mode mismatch');
if (policy.inactiveCaseState !== 'SUPERSEDED') fail('Inactive Proposal retirement policy changed');
if (policy.hardBoundaries?.automaticApproval !== false) fail('Decision bridge policy unexpectedly enables automatic approval');
if (policy.hardBoundaries?.automaticExecution !== false) fail('Decision bridge policy unexpectedly enables execution');
if (policy.hardBoundaries?.productionMutationAuthorized !== false) fail('Decision bridge policy unexpectedly authorizes production mutation');
if (learning.status !== 'ready') fail(`Learning is not ready: ${learning.status}`);
if (learning.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) fail('Learning/Decision Ledger hash mismatch');
if (q.source?.learningContextSha256 !== shaFile(F.learning)) fail('Proposal queue is not bound to current Learning bytes');

const decisionCore = d => { const x = { ...d }; delete x.integrity; return x; };
const ledgerCore = x => { const y = { ...x }; delete y.integrity; return y; };

if (ledger.version !== '0.1-decision-ledger') fail(`Unexpected Decision Ledger version: ${ledger.version}`);
if (!Array.isArray(ledger.decisions) || ledger.decisionCount !== ledger.decisions.length) fail('Decision Ledger count mismatch');
let previous = null;
for (let i = 0; i < ledger.decisions.length; i += 1) {
  const d = ledger.decisions[i];
  if (d?.chain?.previousDecisionHash !== previous) fail(`Decision chain broken at ${i}`);
  const hash = stableHash(decisionCore(d));
  if (d?.integrity?.decisionHash !== hash) fail(`Decision hash mismatch at ${i}`);
  if (d?.authority?.executable !== false || d?.authority?.executionAuthority !== 'none') fail(`Decision ${d?.decisionId ?? i} escaped inert authority`);
  previous = hash;
}
if ((ledger.integrity?.chainRootHash ?? null) !== (ledger.decisions[0]?.integrity?.decisionHash ?? null)) fail('Decision Ledger root mismatch');
if ((ledger.integrity?.latestDecisionHash ?? null) !== (ledger.decisions.at(-1)?.integrity?.decisionHash ?? null)) fail('Decision Ledger latest mismatch');
if (ledger.integrity?.ledgerHash !== stableHash(ledgerCore(ledger))) fail('Decision Ledger integrity mismatch');

const supersededDecisionIds = new Set(ledger.decisions.map(d => d.supersedesDecisionId).filter(Boolean));
const effectiveByCase = new Map();
for (const d of ledger.decisions) {
  if (supersededDecisionIds.has(d.decisionId)) continue;
  if (effectiveByCase.has(d.caseKey)) fail(`Multiple effective owner decisions for stable case ${d.caseKey}`);
  effectiveByCase.set(d.caseKey, d);
}

const learningByCase = new Map((learning.activeCases ?? []).filter(c => c.experienceEligibility === 'decision-worthy').map(c => [c.caseKey, c]));
const mapping = policy.dispositionToProposalState ?? {};
const states = ['PROPOSED','APPROVED','IN_PROGRESS','VERIFYING','RELEASE_READY','RELEASED','REJECTED','SUPERSEDED'];
let boundDecisionCount = 0;
let approvedCount = 0;
let rejectedCount = 0;
let deferredCount = 0;
let historicalDecisionBoundCount = 0;

q.proposals = (q.proposals ?? []).map(p => {
  const d = effectiveByCase.get(p.source?.caseKey) ?? null;
  const learningCase = learningByCase.get(p.source?.caseKey) ?? null;
  const sourceCaseActive = !!learningCase;

  if (!d) {
    if (!sourceCaseActive) {
      p.state = 'SUPERSEDED';
      p.supersededReason = p.supersededReason ?? 'Source case is no longer active in current Learning context.';
    } else {
      p.state = 'PROPOSED';
      delete p.supersededReason;
    }
    delete p.decisionBinding;
    delete p.effectiveAction;
    p.human = { approvedBy: null, approvedAt: null, notes: null };
    return p;
  }

  if (sourceCaseActive) {
    const latest = learningCase?.decisionMemory?.latestDecision;
    if (!latest || latest.decisionId !== d.decisionId || latest.disposition !== d.disposition) {
      fail(`Active Learning case does not expose the effective decision for ${p.source?.caseKey}`);
    }
  }

  const activeTargetState = mapping[d.disposition];
  if (!activeTargetState) fail(`Decision disposition has no Proposal mapping: ${d.disposition}`);
  if (!states.includes(activeTargetState)) fail(`Decision policy mapped to unknown Proposal state: ${activeTargetState}`);

  const targetState = sourceCaseActive ? activeTargetState : policy.inactiveCaseState;
  p.state = targetState;
  if (sourceCaseActive) {
    delete p.supersededReason;
  } else {
    p.supersededReason = 'Source case is no longer active in current Learning context; exact owner Decision Memory is preserved. SUPERSEDED does not imply rejection, release, or execution.';
  }

  p.decisionBinding = {
    decisionId: d.decisionId,
    decisionHash: d.integrity?.decisionHash ?? null,
    decisionLedgerHash: ledger.integrity.ledgerHash,
    caseKey: d.caseKey,
    sourceCaseId: d.caseId,
    sourceCaseActive,
    recordedAt: d.recordedAt,
    disposition: d.disposition,
    exactDecisionMemory: true,
    authority: 'human-owner',
    productionMutationAuthorized: false,
    executionAuthority: 'none'
  };
  p.human = {
    approvedBy: ['accept','modify'].includes(d.disposition) ? 'owner' : null,
    approvedAt: ['accept','modify'].includes(d.disposition) ? d.recordedAt : null,
    notes: d.rationale ?? null,
    disposition: d.disposition,
    decisionId: d.decisionId,
    expectedOutcome: d.expectedOutcome ?? null,
    modifiedAction: d.modifiedAction ?? null
  };
  p.effectiveAction = d.disposition === 'modify' ? d.modifiedAction : p.proposedAction;
  p.boundaries = {
    ...(p.boundaries ?? {}),
    automaticApproval: false,
    automaticExecution: false,
    humanApprovalRequired: true,
    productionMutationAuthorized: false,
    ownerDecisionReflected: true
  };

  boundDecisionCount += 1;
  if (!sourceCaseActive) historicalDecisionBoundCount += 1;
  if (targetState === 'APPROVED') approvedCount += 1;
  if (targetState === 'REJECTED') rejectedCount += 1;
  if (sourceCaseActive && d.disposition === 'defer') deferredCount += 1;
  return p;
});

const finalActive = q.proposals.filter(p => !['REJECTED','SUPERSEDED','RELEASED'].includes(p.state));
const stateCounts = Object.fromEntries(states.map(s => [s, q.proposals.filter(p => p.state === s).length]));
q.summary = {
  ...(q.summary ?? {}),
  totalProposalCount: q.proposals.length,
  activeProposalCount: finalActive.length,
  stateCounts,
  p0Count: finalActive.filter(p => p.rankClass === 'P0').length,
  p1Count: finalActive.filter(p => p.rankClass === 'P1').length,
  requiresHumanApprovalCount: finalActive.filter(p => p.boundaries?.humanApprovalRequired === true).length,
  ownerDecisionBoundCount: boundDecisionCount,
  ownerApprovedCount: approvedCount,
  ownerRejectedCount: rejectedCount,
  ownerDeferredCount: deferredCount,
  historicalDecisionBoundCount
};
q.source = {
  ...(q.source ?? {}),
  decisionLedgerFile: F.ledger,
  decisionLedgerSha256: shaFile(F.ledger),
  decisionLedgerHash: ledger.integrity.ledgerHash,
  decisionCount: ledger.decisionCount
};
q.decisionBridge = {
  version: '0.2.1-inactive-case-retirement',
  policyFile: F.policy,
  policySha256: shaFile(F.policy),
  boundDecisionCount,
  approvedCount,
  rejectedCount,
  deferredCount,
  historicalDecisionBoundCount,
  stateAuthority: 'append-only-owner-decision-memory-plus-current-learning-lifecycle',
  approvedMeaning: policy.semantics?.approvedMeans ?? null,
  inactiveCaseState: policy.inactiveCaseState,
  inactiveCaseMeaning: policy.semantics?.inactiveCaseRetirement ?? null,
  productionMutationAuthorized: false,
  executionAuthority: 'none'
};

const core = { ...q };
delete core.integrity;
q.integrity = { queueHash: stableHash(core) };
fs.writeFileSync(F.queue, JSON.stringify(q, null, 2) + '\n');

const priority = [...q.proposals].sort((a,b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0));
const lines = [
  '# The Holding Proposal Work Queue',
  '',
  `Generated: ${q.generatedAt}`,
  '',
  `Status: **${String(q.status ?? 'watch').toUpperCase()}**`,
  '',
  `${q.summary.activeProposalCount} active proposal(s) from ${q.summary.activeCaseCount} active Learning case(s); ${boundDecisionCount} owner decision(s) reflected; ${historicalDecisionBoundCount} decision-bound item(s) retained as historical resolved-case memory; execution remains disabled.`,
  '',
  '## Priority queue',
  '',
  ...priority.map(p => `- **${p.rankClass} · ${p.domain} · ${p.entity}** – ${p.effectiveAction ?? p.proposedAction} [${p.state}]${p.decisionBinding ? ` · owner ${p.decisionBinding.disposition} · ${p.decisionBinding.decisionId}` : ''}`),
  '',
  '## Decision boundary',
  '',
  `Currently owner-approved active proposals: ${approvedCount}. Rejected: ${rejectedCount}. Deferred active cases: ${deferredCount}. Historical decision-bound resolved cases: ${historicalDecisionBoundCount}.`,
  '',
  'APPROVED means owner-approved for bounded next-stage research/build-candidate work only. SUPERSEDED means the source case is no longer active; it does not mean rejected, released, executed, or forgotten.',
  '',
  '## Safety boundary',
  '',
  'This queue can observe, synthesize, reflect explicit owner decisions, and retire resolved source cases. Automatic approval and execution remain disabled.',
  ''
];
fs.writeFileSync(F.brief, lines.join('\n'));

console.log('Proposal Decision Bridge applied', {
  decisions: ledger.decisionCount,
  boundDecisionCount,
  approvedCount,
  rejectedCount,
  deferredCount,
  historicalDecisionBoundCount,
  activeProposalCount: finalActive.length,
  queueHash: q.integrity.queueHash,
  executionAuthority: 'none'
});
