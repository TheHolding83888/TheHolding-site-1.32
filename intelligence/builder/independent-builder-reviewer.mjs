#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  queue:'intelligence/builder/candidate-queue.json',
  eval:'intelligence/builder/candidate-eval.json',
  policy:'intelligence/builder/builder-policy.json',
  proposal:'intelligence/proposals/proposal-queue.json',
  proposalEval:'intelligence/proposals/proposal-decision-eval.json',
  learning:'intelligence/learning-state/learning-context.json',
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

for (const p of Object.values(F).filter(x => x !== F.eval)) if (!fs.existsSync(p)) throw new Error(`Builder reviewer missing ${p}`);
const q=read(F.queue), policy=read(F.policy), proposal=read(F.proposal), pe=read(F.proposalEval), learning=read(F.learning), ledger=read(F.ledger);
const errors=[], warnings=[];

if (q.version !== '0.1-builder-candidate-queue' || q.engineVersion !== '0.1-bounded-builder-candidate-engine') errors.push('Builder queue version mismatch');
if (policy.version !== '0.1-builder-policy' || policy.mode !== 'approved-proposal-to-candidate-plan-no-mutation') errors.push('Builder policy mismatch');
if (pe.status !== 'pass') errors.push('Proposal Decision review not PASS');
if (pe.source?.queueSha256 !== shaFile(F.proposal)) errors.push('Proposal bytes differ from reviewed bytes');
if (q.source?.proposalQueueSha256 !== shaFile(F.proposal) || q.source?.proposalQueueHash !== proposal.integrity?.queueHash) errors.push('Builder/Proposal binding mismatch');
if (q.source?.proposalDecisionEvalSha256 !== shaFile(F.proposalEval)) errors.push('Builder/Proposal review binding mismatch');
if (q.source?.learningContextSha256 !== shaFile(F.learning)) errors.push('Builder/Learning binding mismatch');
if (q.source?.decisionLedgerSha256 !== shaFile(F.ledger) || q.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) errors.push('Builder/Decision binding mismatch');
if (q.source?.builderPolicySha256 !== shaFile(F.policy)) errors.push('Builder policy byte binding mismatch');

const approved = new Map((proposal.proposals ?? []).filter(p=>p.state==='APPROVED').map(p=>[p.proposalId,p]));
const seen=new Set();
for (const c of q.candidates ?? []) {
  if (seen.has(c.proposal?.proposalId)) errors.push(`duplicate candidate for ${c.proposal?.proposalId}`);
  seen.add(c.proposal?.proposalId);
  const p=approved.get(c.proposal?.proposalId);
  if (!p) { errors.push(`${c.candidateId}: candidate source is not APPROVED`); continue; }
  if (c.state !== 'CANDIDATE') errors.push(`${c.candidateId}: v0.1 may create only CANDIDATE state`);
  if (c.decision?.decisionId !== p.decisionBinding?.decisionId || c.decision?.decisionHash !== p.decisionBinding?.decisionHash) errors.push(`${c.candidateId}: Decision Memory mismatch`);
  if (c.source?.proposalQueueSha256 !== shaFile(F.proposal) || c.source?.proposalQueueHash !== proposal.integrity?.queueHash) errors.push(`${c.candidateId}: Proposal source binding mismatch`);
  for (const key of ['repositoryCodeMutationAllowed','branchCreationAllowed','pullRequestCreationAllowed','automaticMergeAllowed','automaticReleaseAllowed','productionMutationAuthorized','walletActionAllowed','capitalExecutionAllowed']) {
    if (c.boundaries?.[key] !== false) errors.push(`${c.candidateId}: unsafe boundary ${key}`);
  }
  if (c.boundaries?.humanReleaseApprovalRequired !== true || c.boundaries?.executionAuthority !== 'none') errors.push(`${c.candidateId}: release/execution boundary mismatch`);
  if (!Array.isArray(c.evidenceRequired) || c.evidenceRequired.length < 5) warnings.push(`${c.candidateId}: weak evidence plan`);
  if (!Array.isArray(c.verificationPlan) || c.verificationPlan.length < 4) warnings.push(`${c.candidateId}: weak verification plan`);
  if ((c.affectedFiles ?? []).length !== 0) errors.push(`${c.candidateId}: v0.1 must not pre-authorize affected files`);
}
for (const id of approved.keys()) if (!seen.has(id)) errors.push(`APPROVED proposal has no Builder candidate: ${id}`);
if ((q.summary?.approvedProposalCount ?? -1) !== approved.size || (q.summary?.candidateCount ?? -1) !== approved.size) errors.push('Builder summary count mismatch');
if (q.summary?.productionMutationAuthorizedCount !== 0) errors.push('Builder summary authorizes production mutation');
for (const [key,val] of Object.entries(q.constraints ?? {})) {
  if (key === 'humanReleaseApprovalRequired') { if (val !== true) errors.push('human release gate disabled'); }
}
for (const key of ['noRepositoryCodeMutation','noBranchCreation','noPullRequestCreation','noAutomaticMerge','noAutomaticRelease','noWalletAccess','noCapitalExecution']) {
  if (q.constraints?.[key] !== true) errors.push(`missing queue boundary ${key}`);
}
if (q.constraints?.executionAuthority !== 'none') errors.push('Builder queue execution authority changed');

const core={...q}; delete core.integrity;
if (q.integrity?.queueHash !== stableHash(core)) errors.push('Builder queue integrity mismatch');

const report={
  version:'0.1-builder-eval',
  reviewerVersion:'0.1-independent-builder-reviewer',
  generatedAt:new Date().toISOString(),
  status:errors.length?'fail':'pass',
  source:{
    candidateQueueSha256:shaFile(F.queue),
    proposalQueueSha256:shaFile(F.proposal),
    proposalDecisionEvalSha256:shaFile(F.proposalEval),
    learningContextSha256:shaFile(F.learning),
    decisionLedgerSha256:shaFile(F.ledger)
  },
  counts:{approvedProposals:approved.size,candidates:q.candidates?.length??0,errors:errors.length,warnings:warnings.length},
  errors,warnings,
  boundaries:{repositoryMutation:false,automaticMerge:false,automaticRelease:false,walletAction:false,capitalExecution:false,executionAuthority:'none'}
};
fs.writeFileSync(F.eval,JSON.stringify(report,null,2)+'\n');
console.log('Independent Builder reviewer',report.status,report.counts);
if(errors.length) process.exit(1);
