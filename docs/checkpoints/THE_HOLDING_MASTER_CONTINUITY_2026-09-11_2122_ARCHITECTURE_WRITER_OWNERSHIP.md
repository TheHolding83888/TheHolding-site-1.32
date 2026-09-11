# THE HOLDING — MASTER CONTINUITY CHECKPOINT

**Checkpoint time:** 2026-09-11 21:22 MSK (+03:00)
**Purpose:** urgent handoff checkpoint requested by Alexander before continuing architecture work.
**Checkpoint branch:** `checkpoint/architecture-continuity-20260911-2122`
**Repository:** `TheHolding83888/TheHolding-site-1.32`
**Branch base at creation:** live `main` = `9197e3f1783b14f928e1de02c2cdeaf4b0e1cf89`
**Base commit message:** `memory: refresh current project bootstrap`

> This document is a continuity artifact, not a new source of runtime truth. On resume, LIVE `main` always wins. Recover current truth in this order: `CURRENT.md -> latest continuity -> Router -> task-specific canon/context -> live artifact -> exact evidence`.

---

## 1. Owner instruction / why this checkpoint exists

Alexander explicitly asked to persist, in GitHub and in a dedicated branch, a very detailed record of:

1. what has already been completed;
2. what is being worked on now;
3. what remains planned;
4. the architectural improvement proposed in this chat so it cannot be lost when chat context ends;
5. enough exact operational detail for the next chat to take over without Alexander having to repeat context;
6. after writing the checkpoint, continue the work.

This checkpoint therefore intentionally records both the parallel-chat simplification work and this chat's independent system-level architecture review.

Do **not** interpret this checkpoint as permission to broaden production authority, bypass review, or mutate capital. It is an operational handoff only.

---

## 2. Hard authority and safety boundary — preserve exactly

These are non-negotiable unless Alexander explicitly changes them:

- `executionAuthority = none`
- no wallet signing;
- no autonomous onchain transactions;
- no autonomous capital movement;
- no autonomous methodology or policy mutation;
- production mutation remains controlled and explicitly authorized;
- Builder / Guardian / intelligence layers do not silently gain production mutation authority;
- live `main` beats memory/bootstrap/checkpoint;
- no duplicate source of truth;
- `UNKNOWN != 0`;
- Reference APR is not factual/realized income;
- Opening balance is not income;
- GREEN workflow is not proof that a required artifact was physically materialized;
- fail closed where authority/provenance cannot be proven;
- prefer small, bounded, reversible branch/PR atoms;
- do not introduce a new orchestrator/layer merely to reorganize existing orchestration;
- capability should grow faster than complexity;
- do not weaken security, privacy, deployment-smoke, repository-hygiene, or workflow-control boundaries;
- do not broaden workflow permissions without a specific proven need.

The architectural goal is simplification **without** lowering safety.

---

## 3. Strategic architecture conclusion from external review

The repository already contains a serious Workflow Control Plane. The correct next architectural move is **not** to create another orchestration layer.

The one system-level improvement worth pursuing after the current Capital / Presentation decoupling is:

# ONE ARTIFACT -> ONE CANONICAL WRITER

Meaning:

- every generated repository artifact/state should have exactly one canonical writer;
- other workflows may observe, calculate inputs, validate, or trigger the canonical writer, but should not independently publish the same output;
- the existing Workflow Control Plane should enforce this direction;
- duplicate-writer debt should be driven from the current measured value toward zero;
- workflow fan-out should then be reduced where safe;
- once this is done, stop architecture refactoring and return to the product roadmap unless new evidence demonstrates a concrete architectural failure.

Why this matters:

- fewer race conditions;
- fewer service/generated commits;
- fewer workflows fighting over the same state;
- easier provenance tracing;
- easier debugging;
- faster and safer changes;
- narrower repository mutation authority;
- less cognitive load for both humans and AI agents.

Simple mental model: instead of several departments editing the same accounting spreadsheet, one canonical accountant writes it and the other departments supply verified inputs.

---

## 4. Existing Workflow Control Plane — do not replace it

Canonical workflow: `.github/workflows/workflow-control-plane.yml`

The control plane already enforces / measures important properties including:

- read-only topology analysis;
- frozen debt baselines;
- no-new structural debt;
- no-new fan-out debt;
- workflow-definition verification;
- concurrency discipline;
- authority assertions such as:
  - `readOnly: true`
  - `executionAuthority: none`
  - `repositoryMutationAuthority: false`
  - `workflowDispatchAuthority: false`
  - `capitalExecution: false`
  - `walletAuthority: false`
  - `methodologyMutationAuthority: false`

Control modes already observed:

- control plane: `no-new-debt`
- fan-out: `no-new-fanout-debt`
- workflow-definition guard: `fail-closed-unverified-workflow-logic-change`

Do not create a second control plane.

---

## 5. Frozen workflow-debt baseline captured during review

File: `intelligence/reliability/workflow-control-plane-baseline.json`

Observed baseline during this architecture review:

- workflowCount: **125**
- repositoryWriterCount: **56**
- repositoryWriterWithoutConcurrencyCount: **0**
- workflowControlCount: **6**
- workflowControlWithoutConcurrencyCount: **0**
- otherWritePermissionWorkflowCount: **1**
- privilegedWorkflowCount: **62**
- contentsWriteCount: **56**
- actionsWriteCount: **6**
- scheduledCount: **26**
- workflowRunConsumerCount: **17**
- dispatchingWorkflowCount: **5**
- broadGitAddCount: **0**
- duplicateCandidateWriterPathCount: **7**
- resolvedEdgeCount: **37**
- unresolvedEdgeCount: **0**
- cycleCount: **0**

Debt snapshot:

- pullRequestTargetCount: 2
- duplicateCandidateWriterPathCount: 7
- writeAllCount: 0
- broadGitAddCount: 0
- unresolvedEdgeCount: 0
- cycleCount: 0

Important semantic: the baseline is a **debt ceiling, not the desired end state**. Existing debt may be reduced freely; increasing it should fail closed / require explicit bounded baseline maintenance.

Candidate-writer detection is heuristic. Before changing a path, inspect actual workflow semantics and prove ownership rather than blindly trusting the heuristic label.

---

## 6. Seven duplicate-writer candidate paths that define the cleanup queue

### 6.1 `companies/index.html`
Candidate writers:
- `admit-company-010-public`
- `project-yieldring-capital-state`

Goal: establish one presentation/public-materialization authority for the generated surface, with the other flow supplying data or invoking the canonical materializer rather than rewriting independently.

### 6.2 `intelligence/learning/decision-ledger.json`
Candidate writers:
- `record-brain-decision`
- `record-owner-economic-decision`

Goal: one append/materialization authority preserving provenance and decision class semantics. Do not collapse distinct decision types into ambiguous semantics; unify write ownership, not meaning.

### 6.3 `intelligence/market-data/market-data-coingecko.json`
Candidate writers:
- `market-data-coingecko-daily`
- `market-data-refresh`

This is currently the clearest active canonical-writer cleanup target. See section 9.

### 6.4 `intelligence/market-data/market-data.json`
Candidate writers:
- `market-data-coingecko-daily`
- `market-data-refresh`

Desired authority: Shared Refresh should be the canonical Market Data writer; the daily CoinGecko workflow should validate canonical authority ephemerally but not publish this file.

### 6.5 `intelligence/market-data/public-capital-state.json`
Candidate writers:
- `market-data-coingecko-daily`
- `market-data-refresh`

Desired direction already identified: Public Capital belongs to Unified Capital / the explicit downstream capital materialization path, not the daily CoinGecko source-lane workflow.

### 6.6 `companies/company-010-production-state.json`
Candidate writers:
- `update-company-010-hyperlend-income`
- `update-company-010-projectx-reference-apr`
- `update-company-010-state`

Goal: retain one canonical Company #010 state writer; protocol-specific jobs should generate inputs/evidence, not independently publish the same company production state.

### 6.7 `companies/rewards-data.json`
Candidate writers:
- `update-company-010-hyperlend-income`
- `update-company-rewards`
- `update-icp-nns-rewards`

Goal: one canonical rewards materializer/ledger publisher; mechanism-specific scanners provide normalized input events/evidence.

Target for this architecture phase: **7 -> 0 real duplicate-writer paths**, but only through small verified atoms. Do not fake the metric by hiding paths from the detector.

---

## 7. Workflow fan-out debt — second stage after writer ownership

File: `intelligence/reliability/workflow-fanout-baseline.json`

Observed during review:

- status: `FROZEN_NO_NEW_FANOUT_DEBT`
- workflowCount: **126**
- pullRequestWorkflowCount: **76**
- workflowFleetWakeCount: **76**
- protectedWorkflowFleetWakeCount: **4**
- reductionCandidateWorkflowFleetWakeCount: **72**
- selfDefinitionWakeCount: **76**
- boundedSelfDefinitionWakeCount: **73**
- unboundedPullRequestCount: **3**
- theoreticalProtectedFloorCount: **4**

Protected global workflow-change checks that must remain protected:

1. `commit-identity-privacy-guard`
2. `public-surface-privacy-guard`
3. `repository-hygiene-guard`
4. `workflow-control-plane`

After writer ownership is clean, safely reduce unnecessary PR/workflow fleet wake-ups. Do not optimize by removing the global safety floor.

---

## 8. Completed architecture simplification atoms from the parallel workstream

### PR #753 — merged
Title: `Retire legacy Collection -> Passport router at source`

Merge commit observed: `2e18844a4c0cf0980345184585ffd161be250c03`
Merged: 2026-09-11 14:54:03Z.

Effect:

- obsolete Collection -> Passport router stopped at source;
- direct `#passport-XXX` first-paint behavior preserved;
- `window.thSelectCapitalMode` preserved;
- Collection -> Index v3 remains the single Collection-card navigation authority;
- no capital/accounting/rewards/Market Data/Index methodology/wallet/custody/execution changes;
- `executionAuthority = none`.

This was simplification atom 1.

### PR #754 — merged
Title: `Make public-site polish explicit instead of import-driven`

Fresh check performed immediately before this checkpoint confirmed:

- state: **closed / merged**;
- merged at: `2026-09-11T15:06:20Z`;
- merge commit: `174ea3cddc9a4b39b05e8c9758992cdd15423b4b`;
- head branch: `refactor/make-presentation-materialization-explicit-20260911`;
- final head observed in PR metadata: `d88ad90989601b70d9ddf8a0e2765b3507e5853a`.

Problem it removed:

`owner-balance-site-projection.mjs` imported `public-site-polish-projection.mjs`, while Unified Capital later executed the same polish entrypoint explicitly. Because the entrypoint had top-level side effects, one capital refresh could materialize Presentation through a hidden import path and then again explicitly.

Result:

- proven polish implementation preserved as `public-site-polish-materializer.mjs`;
- `public-site-polish-projection.mjs` became a small coordinator with side-effect-free import behavior;
- direct execution still materializes the same public output;
- explicit callers may invoke `materializePublicSitePolish()`;
- merely importing the entrypoint from a capital projector no longer mutates Presentation.

This was simplification atom 2. The PR itself stated it was **not yet the full Capital / Presentation workflow split**; it removed the hidden execution edge first.

---

## 9. Active canonical-writer work found during this chat: Market Data ownership

A branch already exists:

`refactor/market-data-writer-ownership-20260911`

This branch must be treated as the active/in-progress implementation path for the Market Data duplicate-writer problem. **Do not independently recreate the same fix on another branch.** Fresh-check its head, PR association, diff, Actions, and merge status before any edit.

### Current `main` behavior inspected

`.github/workflows/market-data-coingecko-daily.yml` on main currently:

- schedules a daily CoinGecko refresh;
- has `permissions: contents: write`;
- uses concurrency group `shared-market-data-refresh`;
- runs Market Data engine;
- materializes production authority;
- rebuilds public capital;
- validates canonical state;
- stages and publishes three files:
  - `intelligence/market-data/market-data-coingecko.json`
  - `intelligence/market-data/market-data.json`
  - `intelligence/market-data/public-capital-state.json`

This is the concrete duplicate-writer ownership smell.

### Active branch behavior already inspected

On `refactor/market-data-writer-ownership-20260911`, the daily workflow has already been redesigned in the intended direction:

- adds workflow-definition proof:
  `intelligence/reliability/market-data-scheduler-workflow-definition-proof.mjs`;
- daily workflow refreshes the **CoinGecko source lane**;
- canonical Market Data is tested/validated only ephemerally there;
- publication of canonical Market Data is explicitly assigned to `The Holding Market Data · Shared Refresh`;
- Public Capital is explicitly assigned downstream to Unified Capital;
- before publishing daily source lane it checks out/reverts `market-data.json` from the ephemeral validation;
- it stages only `intelligence/market-data/market-data-coingecko.json`;
- includes superseded-input detection before rebase/push;
- retains `executionAuthority:'none'`.

Branch file SHA observed for `.github/workflows/market-data-coingecko-daily.yml`:
`6d8725ab37d9b39f3471c18356494191b3fe8b36`

This is directly aligned with `ONE ARTIFACT -> ONE CANONICAL WRITER`.

### Shared Refresh on main

`.github/workflows/market-data-refresh.yml`
Name: `The Holding Market Data · Shared Refresh`

Important observed semantics:

- multiple bounded schedules plus source/config push wakes;
- `permissions: contents: write`;
- same concurrency group `shared-market-data-refresh`;
- suppresses unnecessary scheduled refresh if canonical Market Data is younger than ~25 minutes;
- validates the scheduler contract;
- reuses daily CoinGecko source lane without external request;
- observes onchain prices into Shadow;
- materializes per-asset production authority;
- validates 26 canonical assets;
- safe rebase/push with superseded-input detection;
- intended canonical output includes `market-data.json` plus onchain shadow.

Continue proving that this is the sole canonical publisher for Market Data state after the active branch change.

---

## 10. Fresh Market Data truth observed before checkpoint

`intelligence/market-data/market-data.json` on main was freshly healthy when inspected:

- version: `1.2-market-data-truthful-canonical-provenance`
- engineVersion: `1.2-per-asset-authority-materializer-truthful-provenance`
- generatedAt: `2026-09-11T17:17:50.150Z`
- observedAt: `2026-09-11T17:17:46.067Z`
- status: `ok`
- requestedAssetCount: 26
- freshCount: 26
- unknownCount: 0
- canonical authority: per-asset
- CoinGecko external request count for this materialization: 0
- daily CoinGecko source lane reused as fallback/sanity;
- all canonical assets explicitly reviewed for onchain-primary.

Examples observed:

- BTC ~77,869.4779 via `onchain-chainlink-v3`
- ETH ~2,581.2029 via `onchain-chainlink-v3`
- XAUT via `onchain-uniswap-v3-twap-chainlink-quote`
- AERO via `onchain-chainlink-v3`

Therefore the live canonical Market Data path itself was healthy at checkpoint time.

---

## 11. Operational tail requiring investigation: daily CoinGecko source lane freshness

`intelligence/market-data/market-data-coingecko.json` on main was observed with:

- generatedAt: `2026-09-09T08:04:32.527Z`
- 26 fresh assets at that source snapshot;
- unknownCount: 0;
- strict daily cadence semantics;
- stale fallback max age: 30 hours.

Path history inspection found daily refresh commits through Sept 9, including:

- Sept 9: `630abd341dded95a9a12a28691dccecfc0c4fd9f`
- Sept 8: `4bdcdc8cb61f55937f0f57641f2d3fd3186777aa`
- Sept 7: `cd8b99efc78cb1db3e6f2794e2533f9df05db86c`
- Sept 6: `15db2305fd5ca60e3daf15f572f9c6bd2b1403d8`

No Sept 10/11 daily source-lane commit was found in the first path-history check.

Interpretation:

- no immediate canonical price-truth failure was observed because the onchain Shared Refresh path is fresh and healthy;
- however, if CoinGecko is supposed to remain a <=30h failback/sanity lane, an old Sept 9 snapshot is an operational resilience concern;
- investigate Actions for Sept 10/11 before concluding root cause;
- possibilities include schedule failure/disable, a deliberately suppressed/superseded run, or in-progress workflow refactor;
- do not manually rewrite the data to hide the issue;
- fix scheduler/source-lane ownership only after exact evidence.

---

## 12. Recently completed capital/accounting production work that must not regress

Defitea + YieldRing Performance production close is complete and must be preserved.

### Defitea
- historical cost basis: **$9,724.36** complete;
- canonical AERO quantity: **2632.61**.

### YieldRing
Historical cost basis: **$2,984.60** complete:
- BTC 0.0334 / $2,123.11
- AERO 678 / $210.24
- CVX 240 / $371.68
- FXS 1032 / $279.57

Relevant completed work:

- PR #751 completed historical performance basis;
- stale rounded Defitea AERO literal `2632` was found after #751, while canonical state had `2632.61`;
- PR #752 bound Unified Capital quantity checks to canonical company states;
- merge commit observed for #752: `35de120f...`;
- Unified Capital writer run #193 succeeded;
- coherent snapshot `6112298e...`;
- Production Deployment Smoke succeeded;
- public Performance uses complete-basis numeric path, with no erroneous Partial label;
- no further owner data is currently required for Defitea/YieldRing.

Architecture cleanup must not reintroduce duplicated numeric literals or separate quantity authority.

---

## 13. Accounting/tracking context to preserve

Recent known state before architecture cleanup:

- mechanisms: 29
- reusable gaps: 0
- Canonical Income Ledger: partial
- observed events: 871 at that historical continuity point
- Monthly Reports v0.5
- companies: 10
- veAERO: 8/8
- veVELO: 4/4
- veFRAX: 3/3
- veYB: 4/4
- reusable gaps: 0

Do not infer current counts from this checkpoint after resume. Re-read live artifacts.

---

## 14. Product North Star and why architecture work is bounded

Owner-facing North Star:

# "Вот адрес. Трекай."

The system should eventually:

1. accept an arbitrary address;
2. discover assets / mechanisms / protocol exposures / history;
3. distinguish capital from income;
4. track incrementally;
5. generate reports, Company Passport, unknown queue, evidence and provenance;
6. after owner consent, verify/register/index a company.

Roadmap direction after infrastructure/accounting:

`Free Scan -> Company Preview -> Verify -> Register -> Index -> Companion/API/Data/Protocol identity`

Optional execution is much later and remains outside current authority.

This is why architecture simplification must terminate. The purpose is to reduce friction so product work accelerates, not to turn the project into an endless architecture exercise.

---

## 15. Exact continuation sequence for the next chat / agent

On resume, do the following **in this order**:

### Step 1 — recover live truth

Read live `main`, not this checkpoint as canonical state.

Check:

- current `main` SHA;
- live `CURRENT.md`;
- latest continuity/checkpoint;
- Router / resume context;
- recent commits since this checkpoint base;
- open/recent PRs;
- relevant active branches;
- Actions / workflows / latest generated artifacts.

If main has moved, treat all SHAs in this file as historical anchors.

### Step 2 — do not duplicate parallel work

Fresh-check all architecture branches/PRs before writing.

Known important branches:

- `refactor/make-presentation-materialization-explicit-20260911` — PR #754 is already merged; do not redo it.
- `refactor/market-data-writer-ownership-20260911` — active branch observed; inspect current head/PR/diff before touching Market Data writer ownership.

If another branch has already begun the next Capital / Presentation atom, let it finish rather than creating a competing implementation.

### Step 3 — finish current Capital / Presentation decoupling first

PR #753 and #754 are completed atoms. Determine from live state what remains of the explicit full Capital / Presentation workflow ownership split.

Requirements:

- Capital producers own capital truth only;
- Presentation materialization happens through explicit Presentation authority;
- imports must remain side-effect free unless a file is explicitly an executable materializer;
- no hidden write edge;
- preserve exact public behavior and deployment smoke.

### Step 4 — complete Market Data writer-ownership atom

Inspect `refactor/market-data-writer-ownership-20260911`.

Prove:

- daily CoinGecko workflow writes only the CoinGecko source-lane artifact;
- Shared Refresh is the sole canonical writer for `market-data.json`;
- Unified Capital owns Public Capital materialization;
- no workflow has silently lost necessary validation;
- scheduler-definition proof passes;
- superseded-input behavior is fail-closed and race-safe;
- concurrency remains correct;
- `executionAuthority = none`;
- workflow-control-plane baseline decreases or stays within no-new-debt constraint;
- no public capital/accounting regression.

Then use the normal branch/PR/check/smoke path. Do not bypass review just to reduce the duplicate count.

### Step 5 — diagnose daily CoinGecko freshness tail

Inspect Actions/runs for Sept 10/11 and current date.

Answer:

- did `The Holding Market Data · Daily CoinGecko Baseline` run?
- if yes, did it fail, skip, or exit no-op?
- was schedule disabled or workflow definition superseded?
- was source-lane output intentionally not committed?
- is the active Market Data branch already solving it?

Only fix after evidence.

### Step 6 — continue duplicate-writer queue in small atoms

After Market Data, re-run / inspect Workflow Control Plane and determine the true remaining duplicate writers.

Suggested prioritization:

1. shared Market Data state;
2. Company #010 production state;
3. rewards-data canonical writer;
4. decision ledger writer ownership;
5. `companies/index.html` presentation writer ownership.

But prioritize from fresh risk/evidence, not blindly from this list.

For every atom:

- one explicit canonical writer;
- preserve semantic meaning;
- narrow, not broaden, mutation authority;
- proof/test before merge;
- observe Actions after merge;
- verify physical generated artifact when relevant;
- verify Production Deployment Smoke/public surface when relevant;
- allow Workflow Control Plane debt counters to fall naturally;
- never edit the baseline merely to make a failing new debt pass.

### Step 7 — reduce workflow fan-out

Only after writer ownership is largely resolved, reduce unnecessary PR/workflow fleet wakes while preserving the 4 protected global checks.

Target: materially lower unnecessary Action load, not chase an aesthetic zero.

### Step 8 — stop architecture refactoring

When:

- Capital / Presentation ownership is explicit;
- duplicate writer paths are resolved or only justified/verified exceptions remain;
- unnecessary fan-out is materially reduced;
- all safety/deployment/accounting boundaries stay green;

then stop architectural cleanup and resume roadmap/product delivery.

---

## 16. Definition of done for this architecture phase

This phase is done when all of the following are true:

1. no hidden import-side-effect write edges between Capital and Presentation;
2. each generated high-value artifact has one proven canonical writer;
3. Workflow Control Plane reports no new debt and the duplicate-writer debt has materially decreased, ideally to 0 real conflicts;
4. workflow fan-out is reduced without removing global safety checks;
5. repository writer concurrency remains controlled;
6. no `write-all`, broad `git add`, unresolved workflow cycles, or unproven authority expansion are introduced;
7. Market Data still has truthful provenance, 26-asset authority, explicit fallback semantics, and a healthy source-lane cadence;
8. Unified Capital remains coherent and Company Performance remains correct;
9. Production Deployment Smoke/public surface validation remains passing;
10. `executionAuthority = none` remains true;
11. the next engineering focus is roadmap/product, not more architecture for architecture's sake.

---

## 17. What must NOT happen

Do not:

- add another meta-orchestrator simply to coordinate existing orchestrators;
- merge competing fixes for the same output path;
- convert multiple writers into one giant god-workflow with unrelated responsibilities;
- weaken fail-closed semantics to reduce CI noise;
- remove evidence/provenance just to simplify files;
- turn a source lane into canonical truth without explicit authority policy;
- let CoinGecko silently become primary production price authority if policy says onchain-primary;
- let stale fallback be represented as fresh;
- use a green Action as substitute for checking materialized output;
- touch wallets/capital execution;
- introduce autonomous merge/self-approval/production execution authority;
- automatically expand baselines to accept new debt;
- overwrite live current truth based only on this checkpoint.

---

## 18. User-facing tracking protocol

When Alexander says **"трекай"**, perform a fresh read-only live check of:

- `main`;
- relevant active branches and PRs;
- Actions/workflow runs;
- generated artifacts/evidence;
- latest continuity/checkpoints;
- current Router/resume context when relevant.

Report briefly:

- 🟢 done;
- 🟡 in progress + approximate completion %;
- ⚪ next / queue / plan;
- short risks only if meaningful.

Do not answer from stale memory when a live GitHub check is possible.

---

## 19. Current checkpoint status

At the moment this document was created:

- urgent continuity preservation requested by owner: **done by this branch/file**;
- PR #753 architecture atom 1: **merged**;
- PR #754 architecture atom 2: **merged**;
- Market Data canonical-writer branch: **exists and requires fresh continuation check**;
- canonical Market Data: **fresh/healthy at last inspection**;
- CoinGecko daily source-lane freshness: **requires exact Actions diagnosis**;
- system-level `ONE ARTIFACT -> ONE CANONICAL WRITER` cleanup: **planned / partially already underway through Market Data branch**;
- fan-out reduction: **planned after writer ownership**;
- final destination after cleanup: **return to The Holding product roadmap**.

---

## 20. Final handoff instruction

If this chat disappears or reaches context limit, the next chat should not ask Alexander to reconstruct the work.

Start from live GitHub. Use this document as the architecture handoff, verify every active status against `main`, avoid duplicating parallel branches, finish the current bounded simplification atoms, then execute the canonical-writer cleanup and fan-out reduction only as far as they provide measurable simplification without lowering security.

**The intended direction is fewer authorities, fewer hidden edges, fewer redundant wakes, stronger provenance, and then back to shipping the product.**
