# THE HOLDING — PUBLIC GREEN → PRIVATE MIGRATION ROADMAP
## Durable resume contract · 2026-09-13

Status: **ACTIVE OWNER-APPROVED ROADMAP / PUBLIC PHASE**  
Authority: sequencing and recovery context only  
executionAuthority: none

## Purpose

This file is the durable work queue for the remaining public-repository phase. It combines:

- the live handoff from the chat that ended on 2026-09-13;
- the existing owner-approved Private Migration Gate;
- remaining production/reliability/accounting work discovered after the 2026-09-12 architecture/reporting GREEN closure;
- the owner-approved requirement to make historical reward-token valuation more universal;
- the owner-approved requirement to profile and, only where justified, simplify slow/heavy workflows;
- final bounded cosmetics, cleanup, pre-private checks, checkpoint, backup and private migration.

It exists so future chats do **not** reconstruct this roadmap from conversation memory.

## Canonical truth / recovery order

This roadmap is **not** a second production source of truth. For changing facts always recover in this order:

`live main → fresh generated artifact / exact run evidence → CURRENT → latest continuity → Router → this roadmap → older handoffs`

At the start of every new work session:

1. read live `CURRENT.md`;
2. read its latest continuity;
3. read the Memory Routing Index;
4. read this roadmap;
5. verify the current active package from live GitHub evidence before writing anything.

## Build discipline for this roadmap

- Work **one primary package at a time**.
- Break every package into small atomic PRs/fixes with a narrow acceptance test.
- Do not run several architecture threads in parallel just to make visible progress.
- Prefer one shared reusable fix over company/token/protocol-specific patches.
- Multiple data transports are allowed; canonical semantics/business truth stay single.
- `UNKNOWN != 0`.
- Fail closed when a factual value cannot be proven.
- `GREEN workflow != physically materialized production artifact`.
- Do not reopen the 2026-09-12 architecture/reporting refactor unless fresh live evidence proves a concrete defect.
- Do not optimize for speed without measured bottleneck evidence.
- Do not begin private-only `Capital Flow Semantics` while the canonical repository is public.
- A newer explicit owner instruction overrides older sequencing details. As of 2026-09-13, **cosmetic packages are deferred until the functional/technical packages below are green**.

## Handoff baseline — verify live before use

The 2026-09-13 urgent handoff is preserved at:

`checkpoint/urgent-handoff-20260913-1856-msk`

`intelligence/project-memory/THE_HOLDING_URGENT_HANDOFF_2026-09-13_1856_MSK.md`

Checkpoint commit: `c605daad8963d8305b8c832ad510f1490ddaee56`  
Frozen base main: `a3b0f2fb0eb93e0a7f72dd445266f2d3967e0ced`

At that handoff:

- PR #811 Aerodrome transport-resilience was production-proven GREEN. Do not reopen Aerodrome merely because older failed runs exist.
- Reporting run #356 completed successfully and materialized current reporting/accounting artifacts.
- `reporting/income-ledger.json` baseline was 60 events: 40 with resolved historical USD valuation and 20 unresolved; this is a **snapshot, not a permanent target** and must be re-read live.
- the true next red frontier was Learning Loop run `34764013920`, job `103741658070`, failing `Preflight release coherence` because the release manifest hash for `.github/workflows/record-brain-decision.yml` was stale versus the current workflow file.

## Ordered public-phase packages

### P0 — Durable roadmap + recovery wiring

**Goal:** make this roadmap discoverable to future chats and keep it from becoming conversation-only memory.

Acceptance:
- this file exists on canonical `main`;
- the Memory Routing Index points to it for current public-phase work / pre-private recovery;
- no generated CURRENT machinery is made fragile merely to add a pointer.

### P1 — Close the current real production red frontier

**Current first target:** Learning Loop release coherence.

Procedure:
- first verify whether a newer run self-healed;
- if not, inspect exact current workflow + release manifest + change history;
- prove that the workflow change is intended and does not expand authority;
- update the stale release binding through the existing canonical release-coherence mechanism;
- run/prove Learning Loop GREEN and materialized/coherent where applicable.

Do not blindly replace a hash without semantic verification.

### P2 — Make red Actions meaningful

**Goal:** separate genuine production failure from diagnostic/guard noise.

Review only fresh/current failures. Known examples to re-check live include:
- Company #010 HyperLend jobs where economic computation passed but a final working-tree diagnostic caused red;
- Brain/release-coherence red states;
- current writer/materialization failures if any.

Acceptance:
- real failures remain fail-closed and visible;
- harmless diagnostics do not repeatedly create misleading red runs if they can be corrected without weakening guards;
- old historical failures are not treated as current production blockers.

### P3 — Company #010 / Cypher stability closure

Treat Company #010 as a whole production contour, not a sequence of local patches:

- HyperLend;
- Stake DAO / zero-principal lifecycle;
- rewards;
- capital aggregation;
- publication of production state;
- related writer/materialization paths.

Use current physical artifacts as truth. If already healthy, **do not manufacture work**; close with proof and move on.

### P4 — Factual accounting completeness tails

Re-read the live Historical Completeness / coverage artifacts and close only current actionable factual gaps.

Targets include, if still present:
- the two mechanisms previously classified as partial current-month observation;
- recent owner claim/withdrawal cases that still lack complete historical lifecycle evidence;
- any current supported-mechanism event that can disappear from live claimable state before a periodic snapshot.

LAPTOP is the benchmark behavior:

`earned/recovered fact → durable income history → claim settles entitlement → current claimable may become zero → no second income`

Do not force a factual closure when evidence does not exist; preserve Partial/UNKNOWN explicitly.

### P5 — Universal historical reward-token valuation for supported mechanisms

**Goal:** make historical USD valuation as reusable as the accounting event capture for the protocols/mechanisms already used by The Holding.

Build/reuse one evidence-first resolver cascade rather than token-by-token business logic:

`canonical historical price → Chainlink → proven onchain TWAP/quote route (for example USDC/ETH) → USD`

Rules:
- valuation is tied to the proven economic/closing boundary, never silently backfilled with today's price;
- stablecoin $1 assumptions are not silently substituted for proof;
- immutable accounting event economics are not rewritten; a proven historical valuation resolution may be attached through the existing non-economic resolution path;
- if price cannot be proved, token amount/history remains and USD stays `UNKNOWN`.

Acceptance:
- reprocess/re-evaluate current unresolved valuation events;
- every newly resolved value has source identity, boundary/block/time and route provenance;
- unresolved count may remain nonzero only for genuinely unprovable cases, not because a reusable route is missing;
- no special LAPTOP-only accounting branch is introduced.

### P6 — Supported-mechanism / new-reward-token reuse proof

**Goal:** prove the practical rule:

> For an already supported income mechanism, a newly encountered reward token does not require a new accounting engine.

Expected behavior:

`discover token → preserve exact amount/event → recognize income once → keep current claimable separate → discover/prove historical USD route when possible → UNKNOWN otherwise`

Run system-level parity/coverage checks across current companies and supported mechanisms. A new company using a solved mechanism should be predominantly identity/configuration binding, not a new accounting implementation.

### P7 — Heavy workflow profiling

Do **not** optimize by intuition. Measure current wall time / expensive steps across relevant production workflows.

Known historical signal: Aerodrome/Velodrome historical reconstruction has sometimes consumed ~30 minutes, while many other steps are much shorter. Also inspect other workflows that materially consume time.

Classify the cause:

- immutable-history rescanning;
- RPC latency/rate limits/retries;
- indexed/archival source limits;
- queue/fan-out/concurrency;
- redundant recomputation;
- publication/commit contention;
- something else.

If no material bottleneck remains, close this package without code changes.

### P8 — Fundamental performance/reliability simplification only where justified

Only if P7 proves a stable bottleneck, apply the smallest general improvement that removes the class of waste, for example:

- persist already proven immutable history and scan only from a durable checkpoint;
- reuse fresh proven evidence instead of recomputing it;
- parallelize independent network/protocol reads where safe;
- use bounded archival/indexed transports where public RPC is structurally unsuitable;
- preserve one semantic decoder/business truth and fail-closed completeness.

Do **not** create a second accounting engine, second truth, uncontrolled cache, or many per-workflow speed hacks.

After one optimization, measure again. Stop when the remaining runtime is justified by factual proof work.

### P9 — Bounded existing Economic Graph / sensor closure

Finish only **already-active public-phase factual/reliability tails** that are necessary to leave the current Economic Graph/sensor state coherent.

Do not use this package to launch the next proprietary architecture layer. New major `Capital Flow Semantics`, broader Position Lifecycle, arbitrary-wallet analysis and the deeper private-only roadmap remain blocked until after private migration.

### P10 — System-wide production acceptance

Before cosmetics, run a bounded final functional sweep over the current supported system:

- canonical accounting / Income Ledger;
- monthly reporting and rolling month behavior;
- historical completeness / reconciliation diagnostics;
- rewards/claim lifecycle;
- Company #010 and reusable known-mechanism parity;
- critical production writers/materialization;
- Learning/Brain release coherence;
- Workflow Control Plane / no-new-debt invariants;
- current Economic Graph artifacts needed for the public phase.

Acceptance is physical current evidence, not merely green badges.

### P11 — Bounded cosmetic/current-state package

Only **after P1–P10 are functionally green**, perform the owner's deferred small cosmetic/current-state package.

Follow the existing Private Migration Gate Stage B laws:
- bounded, not a redesign;
- owner-declared balances are explicitly provenance-labelled;
- machine/onchain evidence is not overwritten without proof;
- no major architecture expansion.

Then rerun only the checks genuinely affected by the package.

### P12 — Pre-private cleanup / freeze

Apply existing Private Migration Gate Stage C conservatively:

- retire obvious dead/no-merge recovery artifacts;
- classify/cancel harmless stale workflow ghosts where safe;
- close only Runtime Reliability incidents proven obsolete;
- delete only clearly disposable temporary branches after proving no unique recovery value;
- preserve historical/accounting/checkpoint branches by default.

No mass branch deletion, Git history rewrite, forensic evidence erasure, or cleanup-for-cleanup's-sake.

### P13 — Real pre-private checks

Execute Private Migration Gate Stage D against the **fresh exact state**:

- exact `main` + relevant CI/control plane;
- repository hygiene / public-surface privacy;
- production/deployment/currentness;
- accounting/lifecycle invariants;
- security: Critical = 0; every current High reviewed/fixed/classified with evidence;
- active/queued workflow classification;
- project-memory recovery path.

### P14 — Final public-state checkpoint / migration-readiness GREEN

Execute Stages E–F:

Create an explicit durable final public-state inventory containing exact final SHA/timestamp, PR/issue/branch/workflow/security/deployment/accounting state, accepted Partial/UNKNOWN tails, cleanup disposition and next-step contract.

Only then declare:

`PUBLIC PHASE FINALIZATION — GREEN. READY FOR FINAL BACKUP / PRIVATE MIGRATION.`

### P15 — Full verified backup/export

Execute Stage G from the exact P14 state. Verify the backup; do not treat “download started” as proof.

### P16 — Visibility change — OWNER CONFIRMATION REQUIRED

Stage H is a material repository/security boundary. Do **not** change visibility under routine automation authority.

Default preference remains an in-place public → private visibility change to preserve repository identity/history where GitHub permits it.

Proceed only with explicit owner participation/confirmation at that moment.

### P17 — Post-private audit

Execute Stage I:

- access;
- Actions/workflow permissions;
- deployment/integrations;
- security controls;
- project-memory recovery;
- canonical main + critical artifacts.

Owner explicitly resumes development only after this audit.

## Private-only roadmap boundary

After P17, the existing private-only sequence remains:

`Capital Flow Semantics → Position Lifecycle → Wallet Discovery → Unknown Strategy Queue → Historical Scanner → Company Book → Sensors / Economic Graph → arbitrary-wallet analysis → Free Capital Scan → Verify → Register → The Holding Index`

Do not pull these layers forward into the remaining public phase merely because a nearby public component already exists.

## Progress write-back contract

After each material package:

1. update package status in a durable checkpoint/continuity or this roadmap when the sequencing meaningfully changes;
2. write changing numeric truth to machine artifacts, not prose;
3. record exact production proof (run/job/artifact/SHA) for closed packages;
4. set the next **single** active package;
5. if chat context is near limit, create an explicit handoff before starting another package.

Suggested status vocabulary:
- `GREEN — proven/materialized`
- `ACTIVE — current single package`
- `QUEUED — ordered next`
- `DEFERRED — intentionally later`
- `BLOCKED — exact blocker documented`

## Stop rules

- Do not reopen a GREEN package without fresh contradictory production evidence.
- Do not convert UNKNOWN/Partial into zero or “complete” for appearance.
- Do not fix old red history unless it still represents a current actionable failure.
- Do not add a new layer just to make an existing layer more “advanced”.
- Do not optimize a workflow unless measurement shows meaningful benefit.
- Do not start multiple roadmap packages because an external RPC/workflow is temporarily slow; use the wait time only for read-only evidence collection that cannot create conflicting writes.

The model can change. **The roadmap must remain recoverable from The Holding's GitHub memory.**