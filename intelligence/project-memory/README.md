# The Holding Project Memory

This directory is the canonical human-readable continuity layer for The Holding.

## Iron rule

Durable project memory belongs to **The Holding itself**, not to any one ChatGPT/Claude session.

For every material architecture decision, owner directive, production milestone, safety boundary, methodology change, important failure/recovery, or roadmap shift:

1. preserve the machine-readable fact in its canonical subsystem where one exists;
2. preserve the human continuity meaning in `intelligence/project-memory/` when it materially changes how the project should be understood or resumed;
3. keep `CURRENT.md` automatically refreshed as the compact bootstrap entrypoint.

Do **not** create a memory file for trivial noise. Memory should compress the project, not duplicate every log line.

## New-chat bootstrap rule

On the first substantive The Holding request in a new chat/session, the assistant should read the live `main` version of:

1. `intelligence/project-memory/CURRENT.md`;
2. the latest `THE_HOLDING_MASTER_CONTINUITY_*.md` referenced there;
3. `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md` for the durable owner/AI working contract — language, dictation handling, strict sequencing, proof expectations, visual review workflow, reusable-fix preference and merge authorization boundary;
4. `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`;
5. when the task depends on how the system was built or what earlier work already taught us, read `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`;
6. when the task concerns founder alignment, The Holding AI, decision style or the future digital-founder model, read `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md`;
7. when the task concerns company strategy, capital philosophy, reward harvesting/reinvestment, diversification, stable reserves, leverage/Health Factor, company decision points or future Company Curator logic, read both `THE_HOLDING_OWNER_OPERATING_CONTEXT_2026-08-16.md` and the latest `THE_HOLDING_OWNER_OPERATING_CONTEXT_TRANCHE_*` extensions; when machine-readable owner context is useful, read `intelligence/owner-context/owner-operating-profile.json` plus the latest additive `intelligence/owner-context/owner-operating-profile-tranche-*.json`;
8. when the task concerns public dialogue, conversation learning, model safety, financial-advice boundaries or owner teaching through the console, read `THE_HOLDING_CONVERSATION_LEARNING_CANON_2026-08-14.md`;
9. when the task concerns Company Passport responsive UI, `Balance Sheet · Strategies`, productive APR/APY capsules, or mobile-versus-desktop Passport layout, read `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md` before proposing local visual fixes;
10. when the task touches Cloudflare, Workers, Wrangler, deployment routing, Durable Objects, production permissions, or homepage ownership, read `THE_HOLDING_PRODUCTION_INCIDENT_POSTMORTEM_2026-08-14.md` before proposing changes;
11. only then the live machine-readable artifacts needed for the task.

Changing production facts always outrank prose memory. If a continuity document conflicts with live generated state, live `main` + fresh production artifacts win.

The collaboration-style canon is operational context, not a personality profile. A newer explicit owner instruction always overrides an older working preference.

## Memory tiers

### 1. Current operational memory
- `intelligence/system-memory.json`
- `intelligence/change-intelligence.json`
- `intelligence/change-history.json`

Fast working state for current reasoning.

### 2. Permanent factual Memory Vault
- `intelligence/memory-vault/YYYY/MM/<run-id>.json`
- `intelligence/memory-vault/manifest.json`
- `intelligence/memory-vault/corrections.json`

Append-only, SHA-256 hash-chained Observer history with indefinite canonical retention and no configured lifetime cap.

### 3. Cognitive / experience memory
- `intelligence/brain-history.json`
- `intelligence/brain-chatgpt-bridge-history.json`
- `intelligence/learning/decision-ledger.json`
- `intelligence/learning-state/**`
- Proposal / Builder / Guardian generated states

This preserves cases, owner decisions, outcomes, lessons, and capability-gate history.

### 4. Human continuity / project canon
- `intelligence/project-memory/CURRENT.md`
- `THE_HOLDING_MASTER_CONTINUITY_*.md`
- `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`
- `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`
- `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md`
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_2026-08-16.md`
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_TRANCHE_*`
- `intelligence/owner-context/owner-operating-profile.json`
- `intelligence/owner-context/owner-operating-profile-tranche-*.json`
- `THE_HOLDING_CONVERSATION_LEARNING_CANON_2026-08-14.md`
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md`
- `THE_HOLDING_PRODUCTION_INCIDENT_POSTMORTEM_2026-08-14.md`

This is the fastest way for a future model/session to recover the project architecture, operating rules, current stage, resume point, durable lessons from earlier company/product/infrastructure work, owner collaboration style, founder-alignment direction, owner capital philosophy/company strategy context, conversation-learning safety rules, responsive Passport UI canon, and production deployment lessons already paid for in live operation.

The historical operating knowledge file is deliberately compact and contains durable lessons only. It must not be used as a substitute for fresh production data and must not be treated as retrospective Decision/Outcome Learning.

The Owner Collaboration Operating Style preserves directly observed working preferences — not private speculation or psychology. Its purpose is to prevent a new model from forcing the owner to reteach language/input conventions, sequencing, evidence standards, merge governance and accepted collaboration patterns.

The Founder Decision DNA canon is a strategic/evidence rule, not a current runtime layer. A formal machine-readable founder model should only be built after enough genuine owner decision → outcome cycles exist to support stable patterns rather than guesses.

The Owner Operating Context preserves explicit owner principles, theses, heuristics and peer-owner context with provenance. Later owner-teaching tranches extend the original context without silently rewriting earlier answers. The structured `owner-operating-profile.json` plus additive tranche profiles make high-value owner context machine-readable, but their current `runtimeBinding` is deliberately none: they are context for future reasoning/Curator integration, not automatic policy, market-fact source or execution authority.

The Conversation Learning canon defines how real public dialogue may become a learning signal without allowing untrusted visitors to directly mutate facts, memory, code, methodology, security policy or capital authority. Owner teaching through the public console is not trusted until a real authenticated owner channel exists.

The Passport Responsive UI canon defines the reusable desktop/mobile presentation contract for productive APR/APY capsules in Company Passports. It prevents future long strategy labels from being fixed with one-off per-asset nudges and explicitly preserves the accepted desktop geometry while using a two-row mobile composition.

The production incident postmortem defines the deployment-plane lesson from the 2026-08-14 root-routing incident. Its key rule is that model memory is not a sufficient production control: canonical homepage ownership, auxiliary Worker scope and Durable Object lifecycle must be machine-enforced and smoke-tested against rendered production surfaces.

## Automation

`.github/workflows/update-project-memory-bootstrap.yml` rebuilds `CURRENT.md` deterministically:
- after ordinary `main` pushes that GitHub can observe;
- hourly as a backstop for GitHub-token generated production updates;
- on manual dispatch.

The updater writes only `CURRENT.md`, contains no model/API call, and emits no commit when the canonical source state has not changed.

`CURRENT.md` deliberately remains compact. The latest lexicographically named `THE_HOLDING_MASTER_CONTINUITY_*.md` is linked as the first detailed resume checkpoint, so a new detailed continuity file should be preferred over manually stuffing transient details into `CURRENT.md`.

The memory model is therefore:

`Git history + Memory Vault + Decision/Learning memory + project continuity + generated CURRENT bootstrap`

The model may change. **The memory must remain The Holding's.**
