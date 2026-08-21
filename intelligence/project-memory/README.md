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

On the first substantive The Holding request in a new chat/session, read the live `main` version of:

1. `intelligence/project-memory/CURRENT.md`;
2. the latest `THE_HOLDING_MASTER_CONTINUITY_*.md` referenced there;
3. `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`;
4. `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`;
5. `THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md`;
6. only the routed task-specific canons/context and current machine-readable evidence.

Do not read every historical continuity/canon by default. The Routing Index is the first-class retrieval map.

Changing production facts always outrank prose memory. If a continuity document conflicts with live generated state, live `main` + fresh production artifacts win.

The collaboration-style canon is operational context, not a personality profile. A newer explicit owner instruction always overrides an older working preference.

## Task-aware retrieval

Canonical retrieval path:

`CURRENT → latest continuity → Memory Routing Index → relevant task blocks → live artifacts → exact evidence`

Examples:
- new company / known mechanism → Known Mechanism Reuse canon + Passport Inheritance canon + strongest current production precedent;
- Company #010 Project X → latest continuity + Project X route + live Company state + Project X rate history;
- HyperLend/Aave-like lending → latest continuity + HyperLend route + live Company/Rewards state;
- Rewards / vlCVX → Rewards Drawer + vlCVX route canon + live current routing evidence;
- Passport mobile/desktop → Passport Responsive UI canon;
- **Market Data / current prices / CoinGecko / Public Capital / TVL propagation → latest continuity + `THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md` + live Market Data/Shadow/CoinGecko/Public Capital artifacts + fresh heartbeat/workflow evidence;**
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
- `THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md`
- `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md`
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_2026-08-16.md`
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_TRANCHE_*`
- `intelligence/owner-context/owner-operating-profile.json`
- `intelligence/owner-context/owner-operating-profile-tranche-*.json`
- `THE_HOLDING_CONVERSATION_LEARNING_CANON_2026-08-14.md`
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md`
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md`
- `THE_HOLDING_VLCVX_ROUTE_GRAPH_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
- `THE_HOLDING_PRODUCTION_INCIDENT_POSTMORTEM_2026-08-14.md`

This layer lets a future model/session recover project architecture, operating rules, current stage, exact resume point, durable failure lessons, owner collaboration contract, mechanism reuse requirements, owner capital philosophy, responsive UI rules, Rewards semantics, routing semantics, Market Data authority and deployment lessons already paid for in live operation.

### 5. Task-aware routing layer

`THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md`

This maps task classes to the smallest relevant memory/canonical-state set.

Why this matters:
- `CURRENT.md` must stay compact;
- latest continuity must be deep enough to restore the current project;
- durable canons should remain specialized;
- a new model should not pollute context with unrelated history;
- a task must still be able to retrieve deep precedent when it matters.

## Important durable blocks

### Historical Operating Knowledge
Compact durable lessons. Never a substitute for fresh production data or retrospective Decision/Outcome Learning.

### Known Mechanism Reuse & Promotion
Turns “we solved this before” into an engineering gate. A new company starts from the strongest matching production precedent and preserves the full capability contract: source, economic scope, every in-scope leg, classification, quantity, pricing, USD valuation, null/completion semantics, aggregation boundary, rate lifecycle, public projection, refresh behavior and verifier.

It includes multi-leg promotion parity, enumerable-vs-economic inventory, nonzero-liquidity fail-closed behavior and Aave-like embedded-vs-incentive semantics.

### Market Data / Onchain Authority Canon
`THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md`

This is the durable engineering contract for the production price plane after the Aug 19–21 onchain migration and paranoid audit.

It preserves:
- one canonical selected Market Data plane;
- 26 explicitly reviewed canonical onchain-primary assets;
- physical silver as reference-only;
- one canonical writer and consumer-only Capital/recovery paths;
- 30-minute onchain heartbeat `7,37 * * * *`;
- automatic CoinGecko baseline `12 3 * * *`;
- zero external CoinGecko discovery in normal Shared Refresh materialization;
- divergence-as-telemetry semantics;
- real per-asset route failure failback;
- CoinGecko fallback freshness bounded to <=30 hours;
- truthful top-level `per-asset-authority` provenance;
- browser external price authority disabled;
- physical production materialization as acceptance proof;
- high-frequency generated snapshot push-noise suppression for Project Memory/Security.

Current prices and route health must still be fetched from live artifacts.

### Owner Collaboration Operating Style
Preserves directly observed working preferences and merge governance. It is an operating contract, not a psychological profile.

### Founder Decision DNA
Strategic/evidence rule, not current runtime policy. Formal founder modelling should grow from genuine decision→outcome cycles.

### Owner Operating Context
Explicit owner principles, theses and heuristics with provenance. Context, not automatic policy, market fact or execution authority.

### Conversation Learning Canon
Defines how public dialogue may become a learning signal without allowing untrusted visitors to mutate facts, memory, code, methodology, security policy or capital authority.

### Passport Responsive UI Canon
Defines reusable desktop/mobile productive APR/APY presentation and protects accepted desktop geometry during mobile-only work.

### Company Passport Inheritance Canon
Makes strongest current public presentation/backend capability the starting point for Company #011+ instead of allowing new company adapters to regress known labels/features.

### Rewards Drawer UI Canon
Defines one semantic ledger for Unclaimed, Compounded/Embedded and Pending/Warming states. New mechanisms update canonical rows/data rather than adding protocol-specific mini-ledgers.

### vlCVX Route Graph Canon
Separates current delegation/settlement routes from historical residual reward inventory and requires current routing evidence rather than inferring current route from old Merkle claims.

### Production Incident Postmortem
Encodes deployment-plane lessons such as canonical homepage ownership, Worker scope and Durable Object lifecycle as machine-enforced concerns rather than relying on recollection.

## 2026-08-21 continuity milestone

The latest deep continuity after this memory upgrade is intended to cover the complete delta from the 2026-08-18 Project X + HyperLend checkpoint through:
- Defitea Votium + Union scrvUSD proof;
- full-registry vlCVX routing;
- productive Passport identity/inheritance work;
- YieldRing and Unified Capital production coherence;
- Defitea quantity/cost-basis refresh;
- shared Market Data/Public Capital foundation;
- full 27-target onchain observation campaign;
- promotion of all 26 canonical market assets to onchain-primary;
- 30-minute onchain vs daily CoinGecko cadence separation;
- generated-state memory/security noise suppression;
- `/companies/` metric-universe coherence;
- Project X dynamic active-set correction;
- the full #227–#233 deep-audit failure chain;
- final post-#233 truthful-provenance physical production close.

A target-specific statement “Market Data/onchain = production green” is scoped to that subsystem. It must never be used as proof that every unrelated repository subsystem is perfect.

## Memory write-back discipline

After material work, classify new knowledge:
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
- after ordinary observable `main` pushes;
- after successful Security Sentinel updates;
- hourly at minute 17 as a backstop;
- on manual dispatch.

Pure high-frequency Market Data generated-state pushes are intentionally ignored by the push trigger to avoid up to ~48 redundant memory wakeups/day. The hourly backstop remains, and Market Data code/workflow/policy/registry changes remain observable.

The updater writes only `CURRENT.md`, contains no model/API call, and emits no commit when canonical source state has not changed.

`CURRENT.md` deliberately remains compact. The latest lexicographically named `THE_HOLDING_MASTER_CONTINUITY_*.md` is linked as the first deep resume checkpoint. The Routing Index is separately linked so the model chooses only relevant memory blocks.

The memory model is therefore:

`Git history + Memory Vault + Decision/Learning memory + project continuity + specialized canons + task-aware routing + generated CURRENT bootstrap`

The model may change. **The memory must remain The Holding's.**
