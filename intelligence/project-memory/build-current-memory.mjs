#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const rel = p => path.join(ROOT, p);
const readJson = (p) => {
  try { return JSON.parse(fs.readFileSync(rel(p), 'utf8')); }
  catch { return null; }
};
const exists = p => fs.existsSync(rel(p));
const val = (v, fallback = 'n/a') => (v === null || v === undefined || v === '' ? fallback : v);

const projectDir = rel('intelligence/project-memory');
const continuityFiles = exists('intelligence/project-memory')
  ? fs.readdirSync(projectDir)
      .filter(name => /^THE_HOLDING_MASTER_CONTINUITY_.*\.md$/.test(name))
      .sort()
  : [];
const latestContinuity = continuityFiles.at(-1) ?? null;

// This file is a durable collaboration contract, not a personality profile.
// It is intentionally first-class in CURRENT so a new chat/model learns how to
// work with the owner before performing substantive project work.
const ownerCollaborationCanon = 'THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md';
const ownerCollaborationCanonExists = exists(`intelligence/project-memory/${ownerCollaborationCanon}`);

const systemMemory = readJson('intelligence/system-memory.json');
const vault = readJson('intelligence/memory-vault/manifest.json');
const cognitive = readJson('intelligence/cognitive-stack-state.json');
const learning = readJson('intelligence/learning-state/learning-context.json');
const proposals = readJson('intelligence/proposals/proposal-queue.json');
const builder = readJson('intelligence/builder/candidate-queue.json');
const guardian = readJson('intelligence/guardian/guardian-state.json');
const security = readJson('security/security-intelligence.json');
const decisions = readJson('intelligence/learning/decision-ledger.json');

const latestSourceTimes = [
  systemMemory?.generatedAt,
  cognitive?.generatedAt,
  learning?.generatedAt,
  proposals?.generatedAt,
  builder?.generatedAt,
  guardian?.generatedAt,
  security?.generatedAt,
].filter(Boolean).sort();
const sourceStateAsOf = latestSourceTimes.at(-1) ?? 'n/a';

const stateCounts = proposals?.summary?.stateCounts ?? {};
const builderCounts = builder?.summary?.stateCounts ?? {};

// CURRENT is a bootstrap for the latest independently available subsystem state,
// not a frozen replay of the older coherent Cognitive Stack packet. Therefore the
// standalone Security Sentinel artifact is authoritative for *current* Security.
// The Cognitive Stack keeps its own exact historical Security binding and remains
// authoritative for that coherent packet only.
const securityStatus = security?.status ?? cognitive?.chain?.security?.status ?? 'unknown';
const securityCritical = security?.severityCounts?.critical ?? cognitive?.chain?.security?.critical ?? 0;
const securityHigh = security?.severityCounts?.high ?? cognitive?.chain?.security?.high ?? 0;
const securityMedium = security?.severityCounts?.medium ?? cognitive?.chain?.security?.medium ?? 0;
const securityGeneratedAt = security?.generatedAt ?? cognitive?.chain?.security?.generatedAt ?? null;
const cognitiveSecurityGeneratedAt = cognitive?.chain?.security?.generatedAt ?? null;
const securityNewerThanCognitive = Boolean(
  securityGeneratedAt && cognitiveSecurityGeneratedAt &&
  Date.parse(securityGeneratedAt) > Date.parse(cognitiveSecurityGeneratedAt)
);

const lines = [
  '# THE HOLDING — CURRENT PROJECT MEMORY BOOTSTRAP',
  '',
  '> **IRON RULE FOR NEW CHATS / NEW MODELS**',
  '>',
  '> Before substantive The Holding work, read this file from live GitHub `main`, then follow the Resume order below. The latest continuity checkpoint restores what is being worked on; the Owner Collaboration Operating Style restores how to work with the owner. For changing facts, live generated artifacts and fresh workflow evidence outrank prose memory.',
  '',
  `Canonical source state represented here: **${sourceStateAsOf}**`,
  '',
  '## Resume order',
  '',
  `1. ${latestContinuity ? `[${latestContinuity}](./${latestContinuity})` : 'No continuity checkpoint found.'}`,
  `2. ${ownerCollaborationCanonExists ? `[Owner Collaboration Operating Style](./${ownerCollaborationCanon})` : `MISSING: ${ownerCollaborationCanon}`}`,
  '3. [THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md](./THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md)',
  '4. [Project Memory README](./README.md)',
  '5. Read only the live machine-readable subsystem artifacts and task-specific canons needed for the current task.',
  '',
  '## Owner collaboration bootstrap',
  '',
  '- Default working language with the owner is **Russian**; voice-dictated messages may contain transcription noise, so resolve obvious intent from live project context instead of repeatedly asking the owner to restate known information.',
  '- Work **one primary objective at a time**, preserve the owner\'s requested sequence, and prefer systemic reusable fixes over one-off patches.',
  '- `делай / продолжай / ок делай` authorizes implementation/branch/PR preparation, **not a new production merge**. Every PR still requires fresh explicit merge authorization and exact-head pre-merge proof.',
  '- Live-site screenshots are visual acceptance evidence. Preserve already accepted desktop/laptop surfaces while fixing mobile unless the owner explicitly asks to redesign both.',
  '- A newer explicit owner instruction always overrides an older collaboration preference. The collaboration canon is an operating contract, not a psychological profile.',
  '',
  '## Project identity',
  '',
  'The Holding is a **Capital Operating System + persistent intelligence, memory and governance layer for sovereign onchain companies and funds**.',
  '',
  '`OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → ACT → MEASURE → LEARN`',
  '',
  'Current authority boundary: **execution authority = none**. No wallet signing, transaction execution, autonomous capital movement, automatic production merge/release, or automatic methodology/policy mutation.',
  '',
  '## Memory architecture',
  '',
  `- **System Memory** — current normalized state; generatedAt: ${val(systemMemory?.generatedAt)}.`,
  `- **Permanent Memory Vault** — ${val(vault?.runCount, 0)} Observer record(s), ${val(vault?.eventCount, 0)} material event(s), retention: ${val(vault?.policy?.canonicalRetention)}; hard lifetime cap: ${vault?.policy?.hardLifetimeCap === null ? 'none' : val(vault?.policy?.hardLifetimeCap)}.`,
  `- **Latest Vault record** — ${val(vault?.latestRecord?.recordPath)}.`,
  `- **Decision Memory** — ${val(decisions?.decisionCount, 0)} append-only owner decision(s); executionAuthority: ${val(decisions?.authority?.executionAuthority ?? decisions?.executionAuthority, 'none')}.`,
  '- **Project continuity** — this bootstrap + latest master continuity + owner collaboration canon + specialized canons + Git history.',
  '',
  '## Current cognitive stack',
  '',
  `- Cognitive Stack: **${String(val(cognitive?.status, 'unknown')).toUpperCase()}**; readyForManualInterpretation: ${val(cognitive?.readyForManualInterpretation, false)}; chainHash: ${val(cognitive?.integrity?.chainHash)}.`,
  `- Security Sentinel (latest standalone state): **${String(val(securityStatus, 'unknown')).toUpperCase()}**; Critical ${val(securityCritical, 0)} / High ${val(securityHigh, 0)} / Medium ${val(securityMedium, 0)}; generatedAt ${val(securityGeneratedAt)}.`,
  ...(securityNewerThanCognitive ? [
    `- Cognitive Stack Security snapshot is older (${val(cognitiveSecurityGeneratedAt)}); it remains the exact Security binding for that coherent Cognitive Stack packet, not the current standalone Security count.`
  ] : []),
  `- Grounded Brain: **${String(val(cognitive?.chain?.groundedBrain?.status, 'unknown')).toUpperCase()}**.`,
  `- ChatGPT Bridge: **${String(val(cognitive?.chain?.chatgptBridge?.status, 'unknown')).toUpperCase()}**; cases ${val(cognitive?.chain?.chatgptBridge?.caseCount, 0)}; evidence ${val(cognitive?.chain?.chatgptBridge?.evidenceCount, 0)}; noExecution ${val(cognitive?.chain?.chatgptBridge?.noExecution, true)}.`,
  '',
  '## Learning / Proposal / Builder / Guardian',
  '',
  `- Learning: **${String(val(learning?.status, 'unknown')).toUpperCase()}**; active cases ${val(learning?.summary?.activeCaseCount, 0)}; remembered cases ${val(learning?.summary?.rememberedCaseCount, 0)}; Brain observations ${val(learning?.summary?.brainObservationCount, 0)}; owner decisions ${val(learning?.summary?.decisionCount, 0)}; settled outcomes ${val(learning?.summary?.settledOutcomeCount, 0)}; lessons ${val(learning?.summary?.lessonCount, 0)}.`,
  `- Proposal: **${String(val(proposals?.status, 'unknown')).toUpperCase()}**; active ${val(proposals?.summary?.activeProposalCount, 0)}; APPROVED ${val(stateCounts.APPROVED, 0)}; PROPOSED ${val(stateCounts.PROPOSED, 0)}; SUPERSEDED ${val(stateCounts.SUPERSEDED, 0)}; production execution disabled.`,
  `- Builder: **${String(val(builder?.status, 'unknown')).toUpperCase()}**; candidates ${val(builder?.summary?.candidateCount, 0)}; CANDIDATE ${val(builderCounts.CANDIDATE, 0)}; productionMutationAuthorizedCount ${val(builder?.summary?.productionMutationAuthorizedCount, 0)}.`,
  `- Guardian: **${String(val(guardian?.status, 'unknown')).toUpperCase()}**; research-only ${val(guardian?.summary?.researchOnlyCount, 0)}; blocked ${val(guardian?.summary?.blockedCount, 0)}; sandbox-build authorized ${val(guardian?.summary?.sandboxBuildAuthorizedCount, 0)}; production mutation authorized ${val(guardian?.summary?.productionMutationAuthorizedCount, 0)}.`,
  '',
  '## Build discipline',
  '',
  '- Build **layer by layer**.',
  '- One primary objective at a time.',
  '- No new layer without a real gap.',
  '- Close and prove the current capability before expanding.',
  '- Prefer reuse and simplification over parallel machinery.',
  '- No duplicate sources of truth and no orchestration loops.',
  '- Capability must grow faster than complexity; authority must grow slower than intelligence.',
  '',
  '## Durable-memory rule',
  '',
  'Material architecture decisions, owner directives, durable collaboration preferences, production milestones, important failure/recovery lessons and roadmap shifts must be preserved in GitHub-owned project memory. Trivial run noise should remain in machine logs/history rather than being copied into prose continuity.',
  '',
  '## Canonical priority when facts conflict',
  '',
  '1. live GitHub `main`',
  '2. fresh generated production JSON / exact workflow evidence',
  '3. current subsystem machine-readable state',
  '4. latest continuity checkpoint',
  '5. older project-memory / handoff files',
  '',
  'The model can change. **The memory must remain The Holding\'s.**',
  ''
];

fs.writeFileSync(rel('intelligence/project-memory/CURRENT.md'), lines.join('\n'), 'utf8');
console.log('Project Memory CURRENT.md rebuilt', {
  sourceStateAsOf,
  latestContinuity,
  ownerCollaborationCanon,
  ownerCollaborationCanonExists,
  securityGeneratedAt,
  securityCounts: { critical: securityCritical, high: securityHigh, medium: securityMedium },
  cognitiveSecurityGeneratedAt,
  vaultRuns: vault?.runCount ?? 0,
  decisions: decisions?.decisionCount ?? 0,
  activeCases: learning?.summary?.activeCaseCount ?? 0,
  activeProposals: proposals?.summary?.activeProposalCount ?? 0,
  builderCandidates: builder?.summary?.candidateCount ?? 0,
  guardianResearchOnly: guardian?.summary?.researchOnlyCount ?? 0,
});
