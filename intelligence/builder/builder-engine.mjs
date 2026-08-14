#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const F = Object.freeze({
  proposal: 'intelligence/proposals/proposal-queue.json',
  proposalEval: 'intelligence/proposals/proposal-decision-eval.json',
  learning: 'intelligence/learning-state/learning-context.json',
  ledger: 'intelligence/learning/decision-ledger.json',
  policy: 'intelligence/builder/builder-policy.json',
  queue: 'intelligence/builder/candidate-queue.json',
  brief: 'intelligence/builder/candidate-brief.md'
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
const fail = m => { throw new Error(m); };

for (const p of [F.proposal,F.proposalEval,F.learning,F.ledger,F.policy]) if (!fs.existsSync(p)) fail(`Builder missing required file: ${p}`);
const proposal = read(F.proposal);
const proposalEval = read(F.proposalEval);
const learning = read(F.learning);
const ledger = read(F.ledger);
const policy = read(F.policy);

if (policy.version !== '0.1-builder-policy' || policy.mode !== 'approved-proposal-to-candidate-plan-no-mutation') fail('Unexpected Builder policy');
if (proposalEval.status !== 'pass') fail('Proposal Decision reviewer is not PASS');
if (proposalEval.source?.queueSha256 !== shaFile(F.proposal)) fail('Builder input Proposal bytes were not independently reviewed');
if (proposal.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) fail('Proposal/Decision Ledger mismatch');
if (learning.source?.decisionLedgerHash !== ledger.integrity?.ledgerHash) fail('Learning/Decision Ledger mismatch');
if (proposal.decisionBridge?.productionMutationAuthorized !== false || proposal.decisionBridge?.executionAuthority !== 'none') fail('Proposal layer crossed no-execution boundary');
for (const [k,v] of Object.entries(policy.hardBoundaries ?? {})) {
  if (k === 'humanReleaseApprovalRequired') { if (v !== true) fail('Builder human release gate disabled'); }
  else if (v !== false) fail(`Builder hard boundary unexpectedly enabled: ${k}`);
}

const classFor = p => policy.candidateClasses?.[p.category] ?? policy.candidateClasses?.default ?? 'bounded-improvement-research';
const planFor = p => {
  if (p.category === 'external-script-no-sri') return {
    researchSteps: [
      'Inventory the exact external script URLs, loading surfaces, and whether each script is essential.',
      'Determine whether each resource is immutable enough for SRI; if not, compare self-hosting, removal, or a narrower CSP/trust boundary.',
      'Preserve existing analytics/site behavior until a replacement is independently verified.',
      'Return evidence and a minimal hardening candidate; do not edit production in Builder v0.1.'
    ],
    evidence: ['exact script URL and page/surface','current provider/version behavior','SRI immutability feasibility','compatibility/regression risk']
  };
  if (p.category === 'dom-innerhtml') return {
    researchSteps: [
      'Enumerate the current sink set and group by page/component.',
      'Trace every assigned value to its source and classify provenance as trusted-static, trusted-generated, sanitized, or untrusted/external.',
      'Mark only sinks reachable by untrusted/dynamic data as hardening candidates.',
      'Prefer textContent or safe DOM construction only where semantically equivalent; preserve accepted UI behavior.'
    ],
    evidence: ['sink path and line/surface','data-source provenance','sanitization/encoding evidence','UI regression implications']
  };
  return {
    researchSteps: ['Collect fresh evidence for the approved proposal.','Define the smallest reversible candidate change.','Specify verification before any future mutation.'],
    evidence: ['fresh source evidence','affected surface','reversibility']
  };
};

const approved = (proposal.proposals ?? []).filter(p => p.state === 'APPROVED');
const candidates = approved.map(p => {
  if (p.decisionBinding?.authority !== 'human-owner' || p.decisionBinding?.exactDecisionMemory !== true) fail(`Approved proposal lacks exact owner decision: ${p.proposalId}`);
  if (p.decisionBinding?.productionMutationAuthorized !== false || p.decisionBinding?.executionAuthority !== 'none') fail(`Approved proposal escaped decision boundary: ${p.proposalId}`);
  const plan = planFor(p);
  const candidateId = `BLD-${sha(stable({
    version:'0.1',
    proposalId:p.proposalId,
    decisionId:p.decisionBinding.decisionId,
    decisionHash:p.decisionBinding.decisionHash,
    candidateClass:classFor(p)
  })).slice(0,24)}`;
  return {
    candidateId,
    candidateKey: candidateId.slice(4),
    state: 'CANDIDATE',
    candidateClass: classFor(p),
    proposal: {
      proposalId: p.proposalId,
      proposalKey: p.proposalKey,
      rankClass: p.rankClass,
      domain: p.domain,
      category: p.category,
      entity: p.entity,
      riskTier: p.riskTier,
      queueHash: proposal.integrity?.queueHash ?? null
    },
    decision: {
      decisionId: p.decisionBinding.decisionId,
      decisionHash: p.decisionBinding.decisionHash,
      decisionLedgerHash: p.decisionBinding.decisionLedgerHash,
      disposition: p.decisionBinding.disposition,
      authority: 'human-owner'
    },
    objective: p.effectiveAction ?? p.proposedAction,
    expectedOutcome: p.human?.expectedOutcome ?? null,
    researchSteps: plan.researchSteps,
    allowedScope: [
      'evidence collection from public/canonical sources',
      'classification and threat/economic reasoning',
      'candidate design and verification planning',
      'reversible patch specification for a later Guardian-gated phase'
    ],
    forbiddenScope: [
      'editing production repository files',
      'creating or merging production pull requests',
      'changing policy or methodology automatically',
      'wallet access, signing, transaction, or capital execution'
    ],
    affectedFiles: [],
    evidenceRequired: [...new Set([...(policy.requiredCandidateEvidence ?? []), ...(p.verificationRequired ?? []), ...plan.evidence])],
    verificationPlan: [
      'Independent Builder reviewer PASS',
      'Security Sentinel appropriate to the affected surface before any future patch release',
      'Repository Integrity Sentinel PASS for any future code candidate',
      'UI Regression Sentinel PASS when UI behavior can be affected',
      'explicit human/Guardian release gate before production mutation'
    ],
    reversibility: 'Builder v0.1 makes no production mutation. The candidate can be discarded without changing runtime state.',
    boundaries: {
      candidateOnly: true,
      repositoryCodeMutationAllowed: false,
      branchCreationAllowed: false,
      pullRequestCreationAllowed: false,
      automaticMergeAllowed: false,
      automaticReleaseAllowed: false,
      productionMutationAuthorized: false,
      humanReleaseApprovalRequired: true,
      walletActionAllowed: false,
      capitalExecutionAllowed: false,
      executionAuthority: 'none'
    },
    source: {
      proposalQueueFile: F.proposal,
      proposalQueueSha256: shaFile(F.proposal),
      proposalQueueHash: proposal.integrity?.queueHash ?? null,
      proposalDecisionEvalSha256: shaFile(F.proposalEval),
      cognitiveChainHash: proposal.source?.cognitiveChainHash ?? null,
      learningContextSha256: proposal.source?.learningContextSha256 ?? null,
      decisionLedgerHash: ledger.integrity?.ledgerHash ?? null
    }
  };
});

const generatedAt = new Date().toISOString();
const stateCounts = Object.fromEntries((policy.candidateStates ?? []).map(s => [s, candidates.filter(c => c.state === s).length]));
const core = {
  version: '0.1-builder-candidate-queue',
  engineVersion: '0.1-bounded-builder-candidate-engine',
  generatedAt,
  status: candidates.length ? 'watch' : 'ready',
  headline: `${candidates.length} bounded Builder candidate(s) derived from ${approved.length} exact owner-approved Proposal item(s); repository mutation remains disabled.`,
  source: {
    proposalQueueFile: F.proposal,
    proposalQueueSha256: shaFile(F.proposal),
    proposalQueueHash: proposal.integrity?.queueHash ?? null,
    proposalDecisionEvalFile: F.proposalEval,
    proposalDecisionEvalSha256: shaFile(F.proposalEval),
    learningContextFile: F.learning,
    learningContextSha256: shaFile(F.learning),
    decisionLedgerFile: F.ledger,
    decisionLedgerSha256: shaFile(F.ledger),
    decisionLedgerHash: ledger.integrity?.ledgerHash ?? null,
    cognitiveChainHash: proposal.source?.cognitiveChainHash ?? null,
    builderPolicySha256: shaFile(F.policy)
  },
  summary: {
    approvedProposalCount: approved.length,
    candidateCount: candidates.length,
    stateCounts,
    productionMutationAuthorizedCount: 0
  },
  candidates,
  constraints: {
    noRepositoryCodeMutation: true,
    noBranchCreation: true,
    noPullRequestCreation: true,
    noAutomaticMerge: true,
    noAutomaticRelease: true,
    noWalletAccess: true,
    noCapitalExecution: true,
    humanReleaseApprovalRequired: true,
    executionAuthority: 'none'
  }
};
const queue = { ...core, integrity: { queueHash: stableHash(core) } };
fs.mkdirSync('intelligence/builder',{recursive:true});
fs.writeFileSync(F.queue, JSON.stringify(queue,null,2)+'\n');

const lines = [
  '# The Holding Self-Improvement Builder Sandbox',
  '',
  `Generated: ${generatedAt}`,
  '',
  `${candidates.length} candidate packet(s). Production mutation: **DISABLED**.`,
  '',
  '## Candidate queue',
  '',
  ...candidates.map(c => `- **${c.candidateId} · ${c.candidateClass} · ${c.proposal.entity}** – ${c.objective} [${c.state}] · ${c.decision.decisionId}`),
  '',
  '## Boundary',
  '',
  'Builder v0.1 creates evidence-bound work packets only. It cannot edit code, create branches/PRs, merge, release, sign, transact, access wallets, or execute capital.',
  ''
];
fs.writeFileSync(F.brief, lines.join('\n'));
console.log('Builder candidate queue built', queue.summary);
