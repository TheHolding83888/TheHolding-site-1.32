# The Holding Project Memory

This directory is the canonical human-readable continuity layer for The Holding.

## Iron rule

Durable project memory belongs to **The Holding itself**, not to any one ChatGPT/Claude session.

For every material architecture decision, owner directive, production milestone, safety boundary, methodology change, important failure/recovery, or roadmap shift:

1. preserve the machine-readable fact in its canonical subsystem where one exists;
2. preserve the human continuity meaning in `intelligence/project-memory/` when it materially changes how the project should be understood or resumed;
3. keep `CURRENT.md` automatically refreshed as the compact bootstrap entrypoint;
4. route future sessions to the smallest relevant set of durable memory blocks rather than forcing every task to load every historical document.

Do **not** create a memory file for trivial noise. Memory should compress the project, not duplicate every log line.

## New-chat bootstrap rule

On the first substantive The Holding request in a new chat/session, the assistant should read the live `main` version of:

1. `intelligence/project-memory/CURRENT.md`;
2. the latest `THE_HOLDING_MASTER_CONTINUITY_*.md` referenced there;
3. `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md` for the durable owner/AI working contract — language, dictation handling, strict sequencing, proof expectations, visual review workflow, reusable-fix preference and merge authorization boundary;
4. `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`;
5. `THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md` to select the task-specific memory blocks and live artifacts needed for the current objective;
6. only the routed task-specific canons/context and current machine-readable evidence.

Do not read every historical continuity/canon by default. The Routing Index is the first-class retrieval map.

Changing production facts always outrank prose memory. If a continuity document conflicts with live generated state, live `main` + fresh production artifacts win.

The collaboration-style canon is operational context, not a personality profile. A newer explicit owner instruction always overrides an older working preference.

## Task-aware retrieval

Canonical retrieval path:

`CURRENT → latest continuity → Memory Routing Index → relevant task blocks → live artifacts → exact evidence`

Examples:
- new company / known mechanism → Known Mechanism Reuse canon + onboarding knowledge + strongest current production precedent;
- Company #010 Project X → latest continuity + Project X route in the Routing Index + live Company state + Project X rate history;
- HyperLend/Aave-like lending → latest continuity + HyperLend route + live Company/Rewards state;
- Rewards Drawer → Rewards Drawer canon + live Rewards state;
- Passport mobile/desktop → Passport Responsive UI canon;
- founder/company strategy → Owner Operating Context + Founder Decision DNA only when relevant;
- Security/deployment → fresh Security state + Production Incident postmortem.

The router is not a replacement for fresh state. It tells the model **where to look**, not **what the current number is**.

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
- `THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md`
- `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`
- `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md`
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_2026-08-16.md`
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_TRANCHE_*`
- `intelligence/owner-context/owner-operating-profile.json`
- `intelligence/owner-context/owner-operating-profile-tranche-*.json`
- `THE_HOLDING_CONVERSATION_LEARNING_CANON_2026-08-14.md`
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md`
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md`
- `THE_HOLDING_PRODUCTION_INCIDENT_POSTMORTEM_2026-08-14.md`

This layer lets a future model/session recover project architecture, operating rules, current stage, exact resume point, durable failure lessons, owner collaboration contract, mechanism reuse requirements, founder-alignment direction, owner capital philosophy, responsive UI rules, Rewards semantics and deployment lessons already paid for in live operation.

### 5. Task-aware routing layer

`THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md`

This is deliberately separate from the detailed memory blocks. It maps task classes to the memory/canonical state needed for them.

Why this matters:
- `CURRENT.md` must stay compact;
- the latest continuity must be deep enough to restore current project state;
- durable canons should remain specialized;
- a new model should not pollute context with unrelated Founder/Stable/UI history when working on one protocol mechanism;
- a task must still be able to retrieve deep precedent when it matters.

The router therefore turns the existing block architecture into an explicit retrieval contract.

## Important durable blocks

### Historical Operating Knowledge
Deliberately compact durable lessons. It must not substitute for fresh production data and must not be treated as retrospective Decision/Outcome Learning.

### Known Mechanism Reuse & Promotion
Turns “we solved this before” into an engineering gate. A new company must start from the strongest matching production precedent and preserve the full capability contract: source, economic scope, every in-scope leg, classification, quantity, pricing, USD valuation, null/completion semantics, aggregation boundary, rate lifecycle, public projection, refresh behavior and verifier.

It now also captures:
- multi-leg promotion parity from Project X;
- enumerable inventory vs economic active inventory;
- nonzero-liquidity unresolved principal fail-closed behavior;
- Aave-like lending split between embedded reserve-index interest and separate RewardsController incentives.

### Owner Collaboration Operating Style
Preserves directly observed working preferences — not private speculation or psychology. It prevents a new model from forcing the owner to reteach language/input conventions, sequencing, evidence standards, merge governance and accepted collaboration patterns.

### Founder Decision DNA
Strategic/evidence rule, not current runtime policy. A formal founder model should be built only from enough genuine decision→outcome cycles.

### Owner Operating Context
Preserves explicit owner principles, theses, heuristics and peer-owner context with provenance. Structured profiles currently provide context, not automatic policy, market fact or execution authority.

### Conversation Learning Canon
Defines how public dialogue may become a learning signal without allowing untrusted visitors to mutate facts, memory, code, methodology, security policy or capital authority.

### Passport Responsive UI Canon
Defines reusable desktop/mobile productive APR/APY presentation and protects accepted desktop geometry while using the two-row mobile composition.

### Rewards Drawer UI Canon
Defines one semantic ledger for Unclaimed, Compounded/Embedded and Pending/Warming states. New mechanisms should update canonical rows/data, not create protocol-specific mini-ledgers.

### Production Incident Postmortem
Encodes deployment-plane lessons such as canonical homepage ownership, Worker scope and Durable Object lifecycle as machine-enforced concerns rather than relying on model recollection.

## Memory write-back discipline

After material work, classify the new knowledge:

- current numeric/state fact → canonical machine-readable subsystem artifact;
- durable architecture/mechanism/UI lesson → relevant canon;
- major milestone/resume point → new master continuity checkpoint;
- task discovery/routing improvement → Routing Index / README;
- formal owner decision → Decision Memory under its capture contract;
- observational material event → Observer / Memory Vault;
- trivial run output → workflow/Git logs only.

Do not stuff everything into `CURRENT.md`. CURRENT is a bootstrap, not the archive.

## Automation

`.github/workflows/update-project-memory-bootstrap.yml` rebuilds `CURRENT.md` deterministically:
- after ordinary `main` pushes that GitHub can observe;
- after successful Security Sentinel updates;
- hourly as a backstop for GitHub-token generated production updates;
- on manual dispatch.

The updater writes only `CURRENT.md`, contains no model/API call, and emits no commit when canonical source state has not changed.

`CURRENT.md` deliberately remains compact. The latest lexicographically named `THE_HOLDING_MASTER_CONTINUITY_*.md` is linked as the first detailed resume checkpoint. The Routing Index is separately linked so the model can choose only the memory blocks relevant to the current task.

The memory model is therefore:

`Git history + Memory Vault + Decision/Learning memory + project continuity + task-aware routing + generated CURRENT bootstrap`

The model may change. **The memory must remain The Holding's.**
