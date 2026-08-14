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
3. `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`;
4. when the task depends on how the system was built or what earlier work already taught us, read `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`;
5. when the task concerns founder alignment, The Holding AI, decision style or the future digital-founder model, read `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md`;
6. only then the live machine-readable artifacts needed for the task.

Changing production facts always outrank prose memory. If a continuity document conflicts with live generated state, live `main` + fresh production artifacts win.

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
- `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`
- `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md`

This is the fastest way for a future model/session to recover the project architecture, operating rules, current stage, resume point, durable lessons from earlier company/product/infrastructure work, and the founder-alignment direction for The Holding AI.

The historical operating knowledge file is deliberately compact and contains durable lessons only. It must not be used as a substitute for fresh production data and must not be treated as retrospective Decision/Outcome Learning.

The Founder Decision DNA canon is a strategic/evidence rule, not a current runtime layer. A formal machine-readable founder model should only be built after enough genuine owner decision → outcome cycles exist to support stable patterns rather than guesses.

## Automation

`.github/workflows/update-project-memory-bootstrap.yml` rebuilds `CURRENT.md` deterministically:
- after ordinary `main` pushes that GitHub can observe;
- hourly as a backstop for GitHub-token generated production updates;
- on manual dispatch.

The updater writes only `CURRENT.md`, contains no model/API call, and emits no commit when the canonical source state has not changed.

The memory model is therefore:

`Git history + Memory Vault + Decision/Learning memory + project continuity + generated CURRENT bootstrap`

The model may change. The memory must remain The Holding's.
