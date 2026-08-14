#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  candidates: 'intelligence/builder/candidate-queue.json',
  candidateEval: 'intelligence/builder/candidate-eval.json',
  proposal: 'intelligence/proposals/proposal-queue.json',
  ledger: 'intelligence/learning/decision-ledger.json',
  policy: 'intelligence/guardian/guardian-policy.json',
  state: 'intelligence/guardian/guardian-state.json',
  brief: 'intelligence/guardian/guardian-brief.md'
});
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = v => crypto.createHash('sha256').update(v).digest('hex');
const shaFile = p => sha(fs.readFileSync(p));
const stable = v => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const stableHash = v => sha(stable(v));
const fail = m => { throw new Error(m); };

for (const p of [F.candidates,F.candidateEval,F.proposal,F.ledger,F.policy]) {
  if (!fs.existsSync(p)) fail(`Guardian missing required file: ${p}`);
}
const candidates = read(F.candidates);
const candidateEval = read(F.candidateEval);
const proposal = read(F.proposal);
const ledger = read(F.ledger);
const policy = read(F.policy);

if (policy.version !== '0.1-guardian-policy' || policy.mode !== 'deterministic-capability-gate-no-execution') fail('Unexpected Guardian policy');
if (candidateEval.status !== 'pass') fail('Independent Builder reviewer is not PASS');
if (candidateEval.source?.candidateQueueSha256 !== shaFile(F.candidates)) fail('Guardian input Builder bytes were not independently reviewed');
if (candidates.source?.proposalQueueSha256 !== shaFile(F.proposal)) fail('Builder/Proposal byte binding mismatch');
if (candidates.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) fail('Builder/Decision Ledger mismatch');
if (proposal.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) fail('Proposal/Decision Ledger mismatch');
if (candidates.constraints?.executionAuthority !== 'none') fail('Builder execution authority changed');

for (const [key, value] of Object.entries(policy.hardBoundaries ?? {})) {
  if (key === 'humanReleaseApprovalRequired') {
    if (value !== true) fail('Guardian human release gate disabled');
  } else if (key === 'executionAuthority') {
    if (value !== 'none') fail('Guardian execution authority changed');
  } else if (value !== false) {
    fail(`Guardian hard boundary unexpectedly enabled: ${key}`);
  }
}

const proposalById = new Map((proposal.proposals ?? []).map(p => [p.proposalId, p]));
const allowed = new Set(policy.researchOnlyRule?.allowedCapabilities ?? []);
const decisions = (candidates.candidates ?? []).map(c => {
  const reasons = [];
  const p = proposalById.get(c.proposal?.proposalId);
  if (!p || p.state !== 'APPROVED') reasons.push('source Proposal is not currently APPROVED');
  if (c.state !== policy.researchOnlyRule?.requiredCandidateState) reasons.push(`candidate state is ${c.state}, expected ${policy.researchOnlyRule?.requiredCandidateState}`);
  if (c.decision?.authority !== 'human-owner') reasons.push('candidate lacks human-owner decision authority');
  if (!p?.decisionBinding?.exactDecisionMemory || p?.decisionBinding?.decisionId !== c.decision?.decisionId || p?.decisionBinding?.decisionHash !== c.decision?.decisionHash) reasons.push('candidate/Proposal Decision Memory binding mismatch');
  if ((c.affectedFiles ?? []).length !== 0) reasons.push('candidate declares affected files before sandbox-build authority exists');
  for (const key of ['repositoryCodeMutationAllowed','branchCreationAllowed','pullRequestCreationAllowed','automaticMergeAllowed','automaticReleaseAllowed','productionMutationAuthorized','walletActionAllowed','capitalExecutionAllowed']) {
    if (c.boundaries?.[key] !== false) reasons.push(`candidate unsafe boundary: ${key}`);
  }
  if (c.boundaries?.executionAuthority !== 'none') reasons.push('candidate execution authority is not none');
  if (c.boundaries?.humanReleaseApprovalRequired !== true) reasons.push('candidate human release gate missing');

  const gateDecision = reasons.length ? 'BLOCKED' : 'RESEARCH_ONLY';
  const capabilitySet = gateDecision === 'RESEARCH_ONLY' ? [...allowed] : [];
  return {
    guardianDecisionId: `GRD-${sha(stable({candidateId:c.candidateId,candidateQueueHash:candidates.integrity?.queueHash,gateDecision})).slice(0,24)}`,
    candidateId: c.candidateId,
    candidateClass: c.candidateClass,
    proposalId: c.proposal?.proposalId ?? null,
    decisionId: c.decision?.decisionId ?? null,
    riskTier: c.proposal?.riskTier ?? null,
    gateDecision,
    rationale: reasons.length ? reasons : [
      'candidate is exactly owner-approved and independently reviewed',
      'candidate declares no affected files or mutation authority',
      'v0.1 Guardian therefore permits research/specification capabilities only'
    ],
    allowedCapabilities: capabilitySet,
    forbiddenCapabilities: [
      'repository_code_mutation',
      'branch_creation',
      'pull_request_creation',
      'merge',
      'release',
      'policy_or_methodology_mutation',
      'wallet_access',
      'signing',
      'transaction',
      'capital_execution'
    ],
    nextGate: gateDecision === 'RESEARCH_ONLY'
      ? 'future Guardian sandbox-build capability + explicit human release gate'
      : 'repair candidate/upstream evidence and re-run Guardian',
    bindings: {
      candidateQueueSha256: shaFile(F.candidates),
      candidateQueueHash: candidates.integrity?.queueHash ?? null,
      candidateId: c.candidateId,
      proposalQueueSha256: shaFile(F.proposal),
      proposalQueueHash: proposal.integrity?.queueHash ?? null,
      proposalId: c.proposal?.proposalId ?? null,
      decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
      decisionId: c.decision?.decisionId ?? null,
      decisionHash: c.decision?.decisionHash ?? null
    },
    authority: {
      executable: false,
      productionMutationAuthorized: false,
      sandboxBuildAuthority: false,
      executionAuthority: 'none'
    }
  };
});

const researchOnlyCount = decisions.filter(d => d.gateDecision === 'RESEARCH_ONLY').length;
const blockedCount = decisions.filter(d => d.gateDecision === 'BLOCKED').length;
const generatedAt = new Date().toISOString();
const core = {
  version: '0.1-guardian-state',
  engineVersion: '0.1-deterministic-guardian-capability-gate',
  generatedAt,
  status: blockedCount ? 'blocked' : (researchOnlyCount ? 'watch' : 'ready'),
  headline: `${researchOnlyCount} candidate(s) permitted for research-only work; ${blockedCount} blocked; execution and production mutation remain disabled.`,
  source: {
    candidateQueueFile: F.candidates,
    candidateQueueSha256: shaFile(F.candidates),
    candidateQueueHash: candidates.integrity?.queueHash ?? null,
    candidateEvalFile: F.candidateEval,
    candidateEvalSha256: shaFile(F.candidateEval),
    proposalQueueFile: F.proposal,
    proposalQueueSha256: shaFile(F.proposal),
    proposalQueueHash: proposal.integrity?.queueHash ?? null,
    decisionLedgerFile: F.ledger,
    decisionLedgerSha256: shaFile(F.ledger),
    decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
    cognitiveChainHash: candidates.source?.cognitiveChainHash ?? null,
    guardianPolicySha256: shaFile(F.policy)
  },
  summary: {
    candidateCount: decisions.length,
    researchOnlyCount,
    blockedCount,
    sandboxBuildAuthorizedCount: 0,
    productionMutationAuthorizedCount: 0
  },
  decisions,
  constraints: {
    noRepositoryCodeMutation: true,
    noBranchCreation: true,
    noPullRequestCreation: true,
    noAutomaticMerge: true,
    noAutomaticRelease: true,
    noWalletAccess: true,
    noSigning: true,
    noTransactions: true,
    noCapitalExecution: true,
    noAutomaticPolicyOrMethodologyMutation: true,
    sandboxBuildAuthority: false,
    humanReleaseApprovalRequired: true,
    executionAuthority: 'none'
  }
};
const state = { ...core, integrity: { stateHash: stableHash(core) } };
fs.mkdirSync('intelligence/guardian', { recursive: true });
fs.writeFileSync(F.state, JSON.stringify(state, null, 2) + '\n');

const lines = [
  '# The Holding Guardian Capability Gate',
  '',
  `Generated: ${generatedAt}`,
  '',
  `Research-only: ${researchOnlyCount} · Blocked: ${blockedCount} · Sandbox build authority: 0`,
  '',
  '## Gate decisions',
  '',
  ...decisions.map(d => `- **${d.guardianDecisionId} · ${d.candidateClass}** – ${d.gateDecision} · ${d.candidateId}`),
  '',
  '## Boundary',
  '',
  'Guardian v0.1 can authorize research/specification capabilities only. Repository mutation, branch/PR creation, merge, release, wallet/signing/transaction, and capital execution remain disabled.',
  ''
];
fs.writeFileSync(F.brief, lines.join('\n'));
console.log('Guardian capability state built', state.summary);
