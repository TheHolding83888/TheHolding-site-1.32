#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  state:'intelligence/guardian/guardian-state.json',
  eval:'intelligence/guardian/guardian-eval.json',
  policy:'intelligence/guardian/guardian-policy.json',
  candidates:'intelligence/builder/candidate-queue.json',
  candidateEval:'intelligence/builder/candidate-eval.json',
  proposal:'intelligence/proposals/proposal-queue.json',
  ledger:'intelligence/learning/decision-ledger.json'
});
const read = p => JSON.parse(fs.readFileSync(p,'utf8'));
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const shaFile = p => sha(fs.readFileSync(p));
const stable = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const stableHash = v => sha(stable(v));

for (const p of Object.values(F).filter(x => x !== F.eval)) if (!fs.existsSync(p)) throw new Error(`Guardian reviewer missing ${p}`);
const state=read(F.state), policy=read(F.policy), candidates=read(F.candidates), ce=read(F.candidateEval), proposal=read(F.proposal), ledger=read(F.ledger);
const errors=[], warnings=[];

if (state.version !== '0.1-guardian-state' || state.engineVersion !== '0.1-deterministic-guardian-capability-gate') errors.push('Guardian state version mismatch');
if (policy.version !== '0.1-guardian-policy' || policy.mode !== 'deterministic-capability-gate-no-execution') errors.push('Guardian policy mismatch');
if (ce.status !== 'pass') errors.push('Builder reviewer not PASS');
if (ce.source?.candidateQueueSha256 !== shaFile(F.candidates)) errors.push('Builder candidate bytes differ from independently reviewed bytes');
if (state.source?.candidateQueueSha256 !== shaFile(F.candidates) || state.source?.candidateQueueHash !== candidates.integrity?.queueHash) errors.push('Guardian/Builder binding mismatch');
if (state.source?.candidateEvalSha256 !== shaFile(F.candidateEval)) errors.push('Guardian/Builder review binding mismatch');
if (state.source?.proposalQueueSha256 !== shaFile(F.proposal) || state.source?.proposalQueueHash !== proposal.integrity?.queueHash) errors.push('Guardian/Proposal binding mismatch');
if (state.source?.decisionLedgerSha256 !== shaFile(F.ledger) || state.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push('Guardian/Decision Ledger binding mismatch');
if (state.source?.guardianPolicySha256 !== shaFile(F.policy)) errors.push('Guardian policy byte binding mismatch');

const candidateById = new Map((candidates.candidates ?? []).map(c => [c.candidateId,c]));
const proposalById = new Map((proposal.proposals ?? []).map(p => [p.proposalId,p]));
const allowedSet = new Set(policy.researchOnlyRule?.allowedCapabilities ?? []);
let researchOnly=0, blocked=0;
for (const d of state.decisions ?? []) {
  const c = candidateById.get(d.candidateId);
  if (!c) { errors.push(`${d.guardianDecisionId}: missing candidate`); continue; }
  const p = proposalById.get(c.proposal?.proposalId);
  const shouldPass = Boolean(
    p?.state === 'APPROVED' &&
    c.state === 'CANDIDATE' &&
    c.decision?.authority === 'human-owner' &&
    p?.decisionBinding?.exactDecisionMemory === true &&
    p?.decisionBinding?.decisionId === c.decision?.decisionId &&
    p?.decisionBinding?.decisionHash === c.decision?.decisionHash &&
    (c.affectedFiles ?? []).length === 0 &&
    ['repositoryCodeMutationAllowed','branchCreationAllowed','pullRequestCreationAllowed','automaticMergeAllowed','automaticReleaseAllowed','productionMutationAuthorized','walletActionAllowed','capitalExecutionAllowed'].every(k => c.boundaries?.[k] === false) &&
    c.boundaries?.executionAuthority === 'none' &&
    c.boundaries?.humanReleaseApprovalRequired === true
  );
  const expected = shouldPass ? 'RESEARCH_ONLY' : 'BLOCKED';
  if (d.gateDecision !== expected) errors.push(`${d.guardianDecisionId}: expected ${expected}, got ${d.gateDecision}`);
  if (d.bindings?.candidateQueueSha256 !== shaFile(F.candidates) || d.bindings?.candidateQueueHash !== candidates.integrity?.queueHash) errors.push(`${d.guardianDecisionId}: candidate queue binding mismatch`);
  if (d.bindings?.proposalQueueSha256 !== shaFile(F.proposal) || d.bindings?.proposalQueueHash !== proposal.integrity?.queueHash) errors.push(`${d.guardianDecisionId}: Proposal binding mismatch`);
  if (d.bindings?.decisionLedgerHash !== ledger.integrity?.ledgerHash || d.bindings?.decisionId !== c.decision?.decisionId || d.bindings?.decisionHash !== c.decision?.decisionHash) errors.push(`${d.guardianDecisionId}: Decision Memory binding mismatch`);
  if (d.authority?.executable !== false || d.authority?.productionMutationAuthorized !== false || d.authority?.sandboxBuildAuthority !== false || d.authority?.executionAuthority !== 'none') errors.push(`${d.guardianDecisionId}: authority escaped v0.1`);
  if (d.gateDecision === 'RESEARCH_ONLY') {
    researchOnly += 1;
    if (!Array.isArray(d.allowedCapabilities) || !d.allowedCapabilities.length) errors.push(`${d.guardianDecisionId}: no allowed research capabilities`);
    for (const x of d.allowedCapabilities ?? []) if (!allowedSet.has(x)) errors.push(`${d.guardianDecisionId}: undeclared capability ${x}`);
  } else {
    blocked += 1;
    if ((d.allowedCapabilities ?? []).length) errors.push(`${d.guardianDecisionId}: BLOCKED decision exposes capabilities`);
  }
  for (const forbidden of ['repository_code_mutation','branch_creation','pull_request_creation','merge','release','wallet_access','signing','transaction','capital_execution']) {
    if (!(d.forbiddenCapabilities ?? []).includes(forbidden)) errors.push(`${d.guardianDecisionId}: missing forbidden capability ${forbidden}`);
  }
}

if (state.summary?.candidateCount !== (state.decisions?.length ?? 0)) errors.push('Guardian candidate count mismatch');
if (state.summary?.researchOnlyCount !== researchOnly || state.summary?.blockedCount !== blocked) errors.push('Guardian decision summary mismatch');
if (state.summary?.sandboxBuildAuthorizedCount !== 0 || state.summary?.productionMutationAuthorizedCount !== 0) errors.push('Guardian summary grants mutation authority');
for (const k of ['noRepositoryCodeMutation','noBranchCreation','noPullRequestCreation','noAutomaticMerge','noAutomaticRelease','noWalletAccess','noSigning','noTransactions','noCapitalExecution','noAutomaticPolicyOrMethodologyMutation']) {
  if (state.constraints?.[k] !== true) errors.push(`missing Guardian constraint ${k}`);
}
if (state.constraints?.sandboxBuildAuthority !== false || state.constraints?.humanReleaseApprovalRequired !== true || state.constraints?.executionAuthority !== 'none') errors.push('Guardian global authority boundary changed');

const core={...state}; delete core.integrity;
if (state.integrity?.stateHash !== stableHash(core)) errors.push('Guardian state integrity mismatch');

const report={
  version:'0.1-guardian-eval',
  reviewerVersion:'0.1-independent-guardian-reviewer',
  generatedAt:new Date().toISOString(),
  status:errors.length?'fail':'pass',
  source:{
    guardianStateSha256:shaFile(F.state),
    candidateQueueSha256:shaFile(F.candidates),
    candidateEvalSha256:shaFile(F.candidateEval),
    proposalQueueSha256:shaFile(F.proposal),
    decisionLedgerSha256:shaFile(F.ledger),
    guardianPolicySha256:shaFile(F.policy)
  },
  counts:{candidates:state.decisions?.length??0,researchOnly,blocked,errors:errors.length,warnings:warnings.length},
  errors,warnings,
  boundaries:{sandboxBuildAuthority:false,productionMutation:false,automaticMerge:false,automaticRelease:false,walletAction:false,capitalExecution:false,executionAuthority:'none'}
};
fs.writeFileSync(F.eval,JSON.stringify(report,null,2)+'\n');
console.log('Independent Guardian reviewer',report.status,report.counts);
if(errors.length) process.exit(1);
