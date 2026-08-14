#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const P = 'intelligence/proposals';
const FILES = {
  brain: 'intelligence/brain-intelligence.json',
  stack: 'intelligence/cognitive-stack-state.json',
  learning: 'intelligence/learning/learning-context.json',
  policy: `${P}/proposal-policy.json`,
  queue: `${P}/proposal-queue.json`,
  brief: `${P}/proposal-brief.md`,
};

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const shaText = (s) => crypto.createHash('sha256').update(s).digest('hex');
const shaFile = (p) => shaText(fs.readFileSync(p));
const stable = (v) => {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`;
};
const stableHash = (v) => shaText(stable(v));
const now = new Date().toISOString();

for (const p of [FILES.brain, FILES.stack, FILES.learning, FILES.policy]) {
  if (!fs.existsSync(p)) throw new Error(`Missing required source: ${p}`);
}

const brain = read(FILES.brain);
const stack = read(FILES.stack);
const learning = read(FILES.learning);
const policy = read(FILES.policy);

if (stack.readyForManualInterpretation !== true) throw new Error('Cognitive Stack is not ready for interpretation');
if (stack.operatingContract?.executionAuthority !== 'none') throw new Error('Execution authority boundary changed');
if (stack.chain?.groundedBrain?.sha256 && stack.chain.groundedBrain.sha256 !== shaFile(FILES.brain)) {
  throw new Error('Brain bytes do not match Cognitive Stack binding');
}
if (learning.source?.cognitiveChainHash && learning.source.cognitiveChainHash !== stack.integrity?.chainHash) {
  throw new Error('Learning context is not bound to current Cognitive Stack chainHash');
}
if (policy.mode !== 'proposal-only-no-execution') throw new Error('Proposal policy escaped proposal-only mode');

let previous = null;
if (fs.existsSync(FILES.queue)) {
  try { previous = read(FILES.queue); } catch { previous = null; }
}
const previousByKey = new Map((previous?.proposals ?? []).map(x => [x.proposalKey, x]));

const riskBonus = policy.priorityRules?.riskBonus ?? {};
const confidenceBonus = policy.priorityRules?.confidenceBonus ?? {};
const domainBase = policy.priorityRules ?? {};
const activeCases = Array.isArray(learning.activeCases) ? learning.activeCases : [];

function proposalKey(c) {
  return shaText([c.caseKey,c.recommendationClass,c.entity,c.domain,c.category].map(x => String(x ?? '')).join('|')).slice(0, 24);
}
function score(c) {
  const domain = Number(domainBase[c.domain] ?? domainBase.other ?? 40);
  const risk = Number(riskBonus[c.riskTier] ?? 0);
  const confidence = Number(confidenceBonus[c.confidence] ?? 0);
  const persistence = Math.min(10, Number(c.lifecycle?.activeObservationCount ?? 1));
  const unresolved = Number(c.outcomeMemory?.settledOutcomeCount ?? 0) === 0 ? 5 : 0;
  return domain + risk + confidence + persistence + unresolved;
}
function proposedAction(c) {
  const r = c.recommendationClass || 'bounded-review';
  const entity = c.entity || c.category || c.caseKey;
  const map = {
    'security-provenance-triage': `Review actual data provenance for ${entity}; classify sinks as trusted, sanitized, or unsafe before any code change.`,
    'third-party-trust-review': `Review third-party script trust and integrity posture for ${entity}; propose bounded hardening only where compatibility is proven.`,
    'data-gap-resolution': `Run bounded resolver/research for ${entity}; preserve unknown/warming rather than inventing a value.`,
    'coverage-resolution': `Resolve the bounded coverage gap for ${entity} using existing adapters before introducing new methodology.`,
    'reward-route-resolution': `Resolve incomplete reward routes for ${entity} with current-state, wallet-scoped accounting and explicit provenance.`
  };
  return map[r] ?? `Perform bounded human-reviewed work for ${entity} under recommendation class ${r}.`;
}

const activeKeys = new Set();
const proposals = activeCases.map(c => {
  const key = proposalKey(c); activeKeys.add(key);
  const prev = previousByKey.get(key);
  const humanState = policy.humanControlledStates.includes(prev?.state) ? prev.state : null;
  const state = humanState ?? 'PROPOSED';
  const createdAt = prev?.createdAt ?? now;
  return {
    proposalId: prev?.proposalId ?? `PRP-${key}`,
    proposalKey: key,
    state,
    createdAt,
    updatedAt: now,
    priorityScore: score(c),
    rankClass: score(c) >= 120 ? 'P0' : score(c) >= 95 ? 'P1' : score(c) >= 75 ? 'P2' : 'P3',
    source: {
      caseId: c.caseId,
      caseKey: c.caseKey,
      experienceClass: c.experienceClass,
      brainSnapshotHash: learning.source?.brainSnapshotHash ?? stack.chain?.groundedBrain?.snapshotHash ?? null,
      cognitiveChainHash: stack.integrity?.chainHash ?? null
    },
    domain: c.domain ?? 'other',
    category: c.category ?? 'unknown',
    entity: c.entity ?? null,
    recommendationClass: c.recommendationClass ?? 'bounded-review',
    riskTier: c.riskTier ?? 'low',
    confidence: c.confidence ?? 'medium',
    rationale: {
      activeObservationCount: c.lifecycle?.activeObservationCount ?? null,
      firstSeenAt: c.lifecycle?.firstSeenAt ?? null,
      lastSeenAt: c.lifecycle?.lastSeenAt ?? null,
      peerCaseCount: c.peerExperience?.caseCount ?? null,
      peerDecisionCount: c.peerExperience?.decisionCount ?? null,
      observedResolutionRate: c.peerExperience?.observedResolutionRate ?? null,
      latestLesson: c.outcomeMemory?.latestLesson ?? null
    },
    proposedAction: proposedAction(c),
    boundaries: {
      proposalOnly: true,
      automaticApproval: false,
      automaticExecution: false,
      humanApprovalRequired: true,
      affectedFiles: []
    },
    verificationRequired: [
      'fresh source evidence',
      'independent deterministic review',
      'regression/security checks appropriate to affected surface',
      'human approval before mutation'
    ],
    human: prev?.human ?? { approvedBy: null, approvedAt: null, notes: null },
    outcome: prev?.outcome ?? null
  };
});

// Preserve history without deleting disappeared proposals. Only untouched PROPOSED items
// may be automatically superseded. Human-controlled states are never changed by the engine.
for (const old of previous?.proposals ?? []) {
  if (activeKeys.has(old.proposalKey)) continue;
  const humanControlled = policy.humanControlledStates.includes(old.state);
  proposals.push({
    ...old,
    state: humanControlled ? old.state : 'SUPERSEDED',
    updatedAt: humanControlled ? old.updatedAt : now,
    supersededReason: humanControlled ? old.supersededReason ?? null : 'Source case is no longer active in current Learning context.'
  });
}

proposals.sort((a,b) => (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || a.proposalId.localeCompare(b.proposalId));
const counts = Object.fromEntries(policy.states.map(s => [s, proposals.filter(p => p.state === s).length]));
const active = proposals.filter(p => !['RELEASED','REJECTED','SUPERSEDED'].includes(p.state));

const core = {
  version: '0.1-proposal-work-queue',
  engineVersion: '0.1-deterministic-proposal-engine',
  generatedAt: now,
  status: active.some(x => x.riskTier === 'critical') ? 'blocked' : active.length ? 'watch' : 'ready',
  headline: `${active.length} active proposal(s) synthesized from ${activeCases.length} active Learning case(s); execution remains disabled.`,
  source: {
    brainFile: FILES.brain,
    brainSha256: shaFile(FILES.brain),
    brainSnapshotHash: learning.source?.brainSnapshotHash ?? stack.chain?.groundedBrain?.snapshotHash ?? null,
    cognitiveStackFile: FILES.stack,
    cognitiveChainHash: stack.integrity?.chainHash ?? null,
    learningContextFile: FILES.learning,
    learningContextSha256: shaFile(FILES.learning),
    learningGeneratedAt: learning.generatedAt ?? null,
    decisionCount: learning.summary?.decisionCount ?? null,
    lessonCount: learning.summary?.lessonCount ?? null
  },
  summary: {
    activeCaseCount: activeCases.length,
    totalProposalCount: proposals.length,
    activeProposalCount: active.length,
    stateCounts: counts,
    p0Count: active.filter(x => x.rankClass === 'P0').length,
    p1Count: active.filter(x => x.rankClass === 'P1').length,
    requiresHumanApprovalCount: active.filter(x => x.boundaries?.humanApprovalRequired).length
  },
  proposals,
  constraints: {
    mode: policy.mode,
    noTransactions: true,
    noSigning: true,
    noWalletAccess: true,
    noProductionExecution: true,
    noAutomaticCodeChanges: true,
    noAutomaticApprovals: true,
    noPaidModelApiRequired: true
  }
};
const queue = { ...core, integrity: { queueHash: stableHash(core) } };
fs.writeFileSync(FILES.queue, JSON.stringify(queue, null, 2) + '\n');

const lines = [
  '# The Holding Proposal Work Queue', '',
  `Generated: ${queue.generatedAt}`, '',
  `Status: **${queue.status.toUpperCase()}**`, '',
  queue.headline, '',
  '## Priority queue', ''
];
for (const p of active.slice(0, 12)) {
  lines.push(`- **${p.rankClass} · ${p.domain} · ${p.entity ?? p.category}** – ${p.proposedAction} [${p.state}]`);
}
lines.push('', '## Safety boundary', '', 'This queue can observe, synthesize and propose. It cannot approve, mutate production, sign, transact or execute.', '');
fs.writeFileSync(FILES.brief, lines.join('\n'));
console.log('Proposal Work Queue built', queue.summary);
