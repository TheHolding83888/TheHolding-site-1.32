# THE HOLDING — ARCHITECTURE / CANONICAL WRITER HANDOFF
## Manual detailed resume checkpoint · 2026-09-11 ~21:34 MSK

Status: **MANUAL DETAILED RESUME CHECKPOINT**  
Authority: **observation / continuity only**  
executionAuthority: **none**

> This file exists so a fresh chat can resume the architecture cleanup without relying on conversation memory. It is deliberately detailed. It is NOT a substitute for fresh live evidence. On resume, live `main`, current artifacts and exact Actions evidence always win.

---

## 0. RESUME IN ONE SENTENCE

Finish the conservative architecture simplification already underway: first resolve the stale Daily CoinGecko source-lane operational issue without weakening freshness rules, then continue **ONE ARTIFACT → ONE CANONICAL WRITER** for the remaining proven duplicate writers, then reduce only proven-unnecessary workflow fan-out, and stop refactoring when no genuine simplification remains.

---

## 1. SOURCE BOUNDARY AT CHECKPOINT CREATION

- Repository: `TheHolding83888/TheHolding-site-1.32`
- Canonical branch: `main`
- Main observed immediately before checkpoint work: `d3c568d514af49bebc186ddda53a42b9b6f90c21`
- Observed main commit: `memory: refresh current project bootstrap`
- Observed main commit time: `2026-09-11T18:34:10Z`
- Latest auto continuity visible before this manual checkpoint: `intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-11_183347_AUTO_8959d429.md`
- Its trigger boundary is PR #763 / merge commit `4ddbcce4a36d6240e705a5b4f797d54cca05b361`.
- Its source snapshot commit is `8959d42948473cca22cb7c62754f8a8eaa4a1025` (`market data: refresh canonical price snapshot`).

This manual checkpoint is intentionally separate from automatic `CONTINUITY.md`. Do not overwrite the deterministic continuity root merely to point at this file. The automatic Project Memory workflow owns generated `CURRENT.md` and the normal continuity chain.

---

## 2. NON-NEGOTIABLE AUTHORITY / SECURITY BOUNDARIES

Preserve all of these unless Alexander explicitly changes them:

1. `executionAuthority = none`.
2. No wallet signing.
3. No autonomous onchain transaction, claim, vote, approval, transfer or capital movement.
4. No autonomous methodology/policy mutation.
5. No hidden expansion of repository/workflow authority.
6. Do not weaken Privacy, Hygiene, Security, Workflow Control Plane, smoke or fail-closed guards to make a refactor green.
7. `UNKNOWN != 0`.
8. Reference APR/APY is not factual earned-income authority.
9. Opening balance is not income.
10. `GREEN workflow != physically materialized production artifact`.
11. Live `main` + current artifacts + exact evidence override this checkpoint when they disagree.
12. Do not add a new orchestrator/control layer for this cleanup. Reuse the existing Workflow Control Plane and existing canonical orchestrators.
13. Prefer narrow branch/PR atoms with deterministic definition proofs and exact post-merge verification.

---

## 3. WHY THIS ARCHITECTURE CLEANUP EXISTS

The repository has accumulated many safe but overlapping workflows. Guards prevent most races, but overlapping publication authority makes the system harder to reason about and creates unnecessary wakeups, rebases, generated commits and failure surfaces.

Target law:

> **ONE ARTIFACT → ONE CANONICAL WRITER**

Meaning:
- each generated production artifact has one official repository publisher;
- other workflows may collect data, validate, diagnose or provide inputs;
- legacy recovery paths may remain as read-only diagnostic replays when valuable;
- duplicate repository publication is removed instead of coordinated through another new layer.

Simple mental model: one official warehouse keeper per box. Other departments may inspect or provide inputs, but only one actor publishes the final box.

Expected benefits:
- fewer race conditions;
- fewer service/generated commits;
- fewer rebase collisions;
- easier debugging and ownership tracing;
- fewer unnecessary Actions;
- narrower mutation authority;
- simpler recovery path;
- security becomes easier to audit rather than weaker.

---

## 4. PARALLEL-CHAT ARCHITECTURE WORK ALREADY COMPLETED

### Capital ↔ Presentation separation

PRs #755–#758 completed the separation in bounded atoms:

- **#755 — Move public-site materialization out of the Capital orchestrator**
  - Capital stopped explicitly materializing UI polish.
- **#756 — Separate Presentation materialization from Capital**
  - Presentation materialization moved behind an explicit boundary.
- **#757 — Stop Capital from owning pure Presentation outputs**
  - homepage / Yield Reports were removed from the Capital writer surface.
- **#758 — Stop Presentation-only changes from waking Capital E2E**
  - Presentation-only source changes stopped triggering heavy Unified Capital validation.

Preserved invariants:
- no new writer/workflow created just to split the boundary;
- Capital economics/accounting remained unchanged;
- Presentation imports no longer rely on hidden materialization side effects;
- security / Control Plane remained green.

### Proven fan-out cleanup

PR **#759 — Remove dead Capital fan-out from Productivity diagnostics**:
- Project X → Capital orchestrator dependency was inspected and kept because validator genuinely reads orchestrator order.
- YieldRing cascade was inspected and kept because it is a real end-to-end proof and controls Productivity diagnostic behavior.
- `Diagnose Productivity Recovery` → generic Capital orchestrator was proven false/dead and removed.
- Diagnostic received its own bounded domain contract rather than bypassing Control Plane.

Do NOT re-remove the two real dependencies above merely to reduce counts.

### Final Capital → Presentation compatibility tail

PR **#760 — Remove final Capital-to-Presentation compatibility dependency**:
- removed the final no-op/compatibility dependency from Capital-side projection code;
- ownership boundary proof was strengthened;
- no economic behavior or authority expansion.

At this point the inherited parallel-chat architecture work is considered closed unless fresh evidence shows a regression.

---

## 5. THIS CHAT'S CANONICAL-WRITER PHASE — COMPLETED ATOMS

### PR #761 — Retire duplicate Productivity recovery writer

Goal: one production publisher for Productivity/Public Capital generated surfaces.

Completed:
- legacy manual Productivity recovery workflow downgraded `contents: write` → `contents: read`;
- removed git add/commit/rebase/push publication behavior;
- retained ephemeral diagnostic replay of protocol APRs, Company #010 overlay, YieldRing overlay, VoteMarket overlay and public-capital recompute;
- paired deterministic workflow-definition proof now fails if repository write behavior returns;
- canonical production publisher remains `The Holding Capital · Unified Refresh`, which already supports manual dispatch.

Key design decision: useful recovery logic was not deleted; mutation authority was removed and the legacy path became diagnostic-only.

### PR #762 — Retire duplicate Capital State recovery writer

Completed:
- legacy manual Capital State recovery workflow downgraded to repository read-only;
- removed commit/rebase/push behavior;
- retained ephemeral rebuild/validation of General Company Balance Sheet and Capital State;
- canonical production publisher remains `The Holding Capital · Unified Refresh`;
- added paired deterministic proof for the ownership boundary.

Canonical Unified Capital owns:
- `intelligence/capital-state/general-company-balance-sheet.json`
- `intelligence/capital-state/capital-state.json`

### PR #763 — Split Market Data writers by canonical ownership

Merged before this checkpoint.

Canonical chain after #763:

`Daily CoinGecko source lane → Shared canonical Market Data → Unified Capital/Public Capital`

Ownership after #763:
- `The Holding Market Data · Daily CoinGecko Baseline` publishes only `intelligence/market-data/market-data-coingecko.json`.
- `The Holding Market Data · Shared Refresh` publishes canonical `intelligence/market-data/market-data.json` plus `intelligence/market-data/onchain-price-shadow.json`.
- Unified Capital remains downstream owner of `intelligence/market-data/public-capital-state.json`.

Important #763 mechanics:
- Daily canonical authority materialization remains ephemeral validation only.
- Daily no longer rebuilds/publishes Public Capital.
- Shared Refresh no longer stages/publishes the Daily CoinGecko source-lane artifact.
- bounded rebase/supersession protections remain.
- Market Data methodology, 26-asset policy and UI remain unchanged.
- no wallet/capital execution.

PR #763 Control Plane run on candidate head `c10250e8b9c20375fe6d296326a9925e5ab2f511` completed SUCCESS, including:
- workflow definition guard;
- frozen baseline verification;
- topology build;
- fan-out measurement;
- no-new fan-out debt;
- structural no-new-debt gate;
- read-only authority boundary.

---

## 6. IMPORTANT BASELINE NUANCE — DO NOT MISREAD IT

`intelligence/reliability/workflow-control-plane-baseline.json` on live `main` is a **frozen debt ceiling**, not a current desired-state report.

At checkpoint time it still records the original historical ceiling:
- `duplicateCandidateWriterPathCount: 7`
- `workflowCount: 125`
- `repositoryWriterCount: 56`
- `repositoryWriterWithoutConcurrencyCount: 0`
- `workflowControlWithoutConcurrencyCount: 0`
- `broadGitAddCount: 0`
- `unresolvedEdgeCount: 0`
- `cycleCount: 0`

Its own epistemics explicitly say:
- candidate writer paths are heuristic;
- baseline is debt ceiling, not desired end state;
- reducing existing debt is always allowed;
- baseline expansion requires explicit maintenance.

Therefore: **do not assume the frozen baseline's seven paths still exist live**. Recompute/read exact current topology when choosing the next atom. Do not rewrite the baseline downward just for cosmetic bookkeeping unless the Control Plane maintenance contract specifically calls for that later.

Historical seven candidate paths in the frozen ceiling were:
1. `companies/index.html`
2. `intelligence/learning/decision-ledger.json`
3. `intelligence/market-data/market-data-coingecko.json`
4. `intelligence/market-data/market-data.json`
5. `intelligence/market-data/public-capital-state.json`
6. `companies/company-010-production-state.json`
7. `companies/rewards-data.json`

Market Data overlap has now been deliberately split by #763. Other duplicate-writer cleanup must be selected only from current source/evidence, not from this historical list alone.

---

## 7. CURRENT OPERATIONAL ISSUE: DAILY COINGECKO SOURCE LANE IS STALE

This is the active diagnostic tail and must be investigated before declaring Market Data work fully closed.

Observed facts before #763:
- `intelligence/market-data/market-data-coingecko.json` had `generatedAt: 2026-09-09T08:04:32.527Z`;
- last confirmed repository commit updating that source lane was `630abd341dded95a9a12a28691dccecfc0c4fd9f` (`market data: refresh daily CoinGecko baseline`);
- canonical `intelligence/market-data/market-data.json` was still fresh through the onchain-primary path (e.g. observed `2026-09-11T17:17:46Z`, 26/26 fresh, unknownCount 0 at one inspection);
- therefore the production onchain-primary path was not simply frozen, but the bounded CoinGecko sanity/failback source was over-age relative to its 30-hour safety rule.

This stale condition is valuable evidence, not something to hide.

### Do NOT "fix" it by
- increasing stale tolerance merely to turn checks green;
- marking stale data fresh;
- silently falling back to old prices;
- weakening `UNKNOWN != 0` or fail-closed behavior;
- making Shared Refresh a second CoinGecko publisher again;
- widening workflow/token permissions.

### Correct next diagnostic sequence
1. inspect natural scheduled runs for `The Holding Market Data · Daily CoinGecko Baseline` after the last successful Sep 9 materialization;
2. identify whether runs were absent, skipped, cancelled, failed during external fetch, failed during validation, or failed during publish/rebase;
3. inspect exact job steps/logs for the first failure boundary;
4. confirm whether `COINGECKO_API_KEY` absence is relevant or whether server-side keyless fallback should have worked;
5. verify schedule registration and workflow enabled state before editing code;
6. fix only the proven root cause;
7. require a naturally materialized fresh source-lane artifact on live `main` before declaring closure where feasible;
8. then verify Shared Refresh consumes it without becoming a second source-lane writer.

Scheduler epistemic law: a manual/push run can prove workflow logic, but does not automatically prove natural scheduler health.

---

## 8. NEXT ARCHITECTURE PHASE AFTER COINGECKO ROOT CAUSE

Continue **ONE ARTIFACT → ONE CANONICAL WRITER** one bounded atom at a time.

For every candidate:
1. identify all repository writers from exact workflow source;
2. identify which writer is canonical by domain authority and current production chain;
3. distinguish a real independent publisher from a false heuristic collision;
4. preserve useful collector/diagnostic logic as read-only where it adds recovery value;
5. remove repository mutation only from the noncanonical publisher;
6. add/strengthen deterministic workflow-definition proof;
7. preserve concurrency and safe-writer behavior for the canonical publisher;
8. run Workflow Control Plane / Privacy / Hygiene / domain tests;
9. verify post-merge live artifact if the atom changes generated production behavior.

Likely historical areas to re-evaluate from exact live source (NOT automatic targets):
- `companies/index.html`
- `intelligence/learning/decision-ledger.json`
- `companies/company-010-production-state.json`
- `companies/rewards-data.json`

Do not modify any of these until exact live source proves duplicate publication and identifies the canonical owner.

### Especially sensitive candidates

**Decision Ledger**
- likely has semantic distinction between generic Brain decisions and explicit Owner Economic Decisions;
- do not collapse two workflows merely because they touch one file unless a canonical ingestion/writer contract can preserve both event types without losing provenance;
- owner decision provenance/authority matters more than reducing a counter.

**Company #010 production state / Rewards**
- may have multiple domain-specific updaters feeding one aggregated artifact;
- preferred pattern is one canonical materializer/publisher consuming bounded domain inputs, NOT deleting factual collectors;
- do not accidentally turn Reference APR into factual income or mix principal with earned income.

**Companies index**
- navigation/public index may be a generated presentation artifact with multiple historical admission/projectors;
- first prove whether both still publish after Capital/Presentation separation and identify the true current owner.

---

## 9. FAN-OUT PHASE AFTER WRITER OWNERSHIP

After duplicate production ownership is reduced as far as safely justified, inspect remaining workflow fan-out.

Goal: remove only wakeups that have no true data/control dependency.

Preserve the four protected global workflow-change checks unless a separately proven governance redesign exists:
- `commit-identity-privacy-guard`
- `public-surface-privacy-guard`
- `repository-hygiene-guard`
- `workflow-control-plane`

Also preserve already-proven real dependencies (e.g. Project X validator dependency and YieldRing cascade) unless new exact source evidence changes the conclusion.

Fan-out cleanup rules:
- evidence before deletion;
- no new orchestrator;
- no broad fan-out baseline increase;
- reducing fan-out is good only if validation coverage/authority is unchanged;
- prefer domain-local deterministic proofs over broad generic wakeups when equivalent.

---

## 10. STOP CONDITION

Do **not** continue architecture refactoring forever.

Stop this architecture phase when:
- each proven generated production artifact has a clear canonical writer or remaining overlaps are intentionally justified;
- no meaningful false workflow dependencies remain;
- no unresolved workflow graph edges/cycles are introduced;
- security/governance remains at least as strong;
- further changes would mostly rename/rearrange rather than simplify authority or runtime behavior.

Then return to The Holding product/roadmap work instead of optimizing architecture for its own sake.

---

## 11. PRODUCT ROADMAP AFTER ARCHITECTURE CLEANUP

Architecture cleanup is infrastructure work, not the end goal. Resume the broader product direction afterward:

`BUILD → REGISTER → OPERATE → MEASURE → MATURE → DISCOVER → TRADE (optional/later)`

Near/mid roadmap context already established in project memory includes:
- historical completeness/accounting foundation;
- capital-flow semantics;
- position lifecycle;
- discovery / Unknown Queue / historical scanner;
- Company Book;
- sensors;
- arbitrary-address JSON spike;
- Free Scan;
- Company Preview;
- Verify → Register → Index;
- later Companion/API/Data/Protocol identity;
- execution only much later and only under explicit owner-defined authority.

Owner-facing North Star remains:

> **«Вот адрес. Трекай.»**

System should discover assets/mechanisms/history, separate capital from income, track incrementally, produce reports/passport/unknowns, and only after owner consent register/index.

---

## 12. EXACT RECOVERY ORDER FOR A NEW CHAT

When this chat ends, the next chat should NOT start from this file blindly. Use:

1. live `main` head;
2. `intelligence/project-memory/CURRENT.md`;
3. `intelligence/project-memory/CONTINUITY.md` → latest immutable automatic checkpoint;
4. this manual architecture handoff;
5. `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;
6. `intelligence/reliability/workflow-control-plane-baseline.json` as a debt ceiling, not current topology;
7. exact workflow sources;
8. latest PRs #755–#763 and later architecture PRs;
9. exact Actions/check-runs and physical generated artifacts.

Before writing anything after resume:
- re-check `main`;
- re-check open PRs/branches to avoid duplicating another chat;
- re-check latest Market Data Daily run and source-lane timestamp;
- re-measure remaining writer ownership from live workflow source.

---

## 13. COMPLETION / STATUS SNAPSHOT AT THIS CHECKPOINT

### GREEN / completed
- Capital ↔ Presentation separation: #755–#758.
- dead Productivity → generic Capital fan-out removed: #759.
- final no-op Capital → Presentation compatibility dependency removed: #760.
- legacy Productivity production writer retired to read-only diagnostic: #761.
- legacy Capital State production writer retired to read-only diagnostic: #762.
- Market Data writer ownership split into Daily source lane / Shared canonical state / Unified Public Capital: #763.
- PR #763 Workflow Control Plane candidate run green.
- authority boundary preserved: no wallet/capital execution; `executionAuthority = none`.

### YELLOW / active
- root-cause investigation of stale Daily CoinGecko source lane after Sep 9.
- exact current duplicate-writer topology must be re-measured from live source; frozen baseline intentionally still contains historical ceiling 7.

### WHITE / next
- close Daily CoinGecko root cause without weakening freshness or creating duplicate ownership;
- continue remaining proven canonical-writer atoms;
- then perform evidence-based fan-out reduction;
- stop architecture work when genuine simplification is exhausted;
- return to roadmap/product.

---

## 14. DO-NOT-LOSE OWNER INTENT

Alexander explicitly asked that:
- the parallel chat's cleanup be fully inherited and finished;
- this chat then perform the additional architecture modernization it proposed;
- nothing valuable be lost when chat memory ends;
- changes must materially simplify/speed the system rather than create architecture for architecture's sake;
- security must not be reduced;
- if no genuine improvement remains, say so and stop.

That is the governing intent for all work after this checkpoint.

The model can change. **The architecture intent, authority boundary and live evidence chain must remain The Holding's.**