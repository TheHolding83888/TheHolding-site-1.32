# THE HOLDING — URGENT TAKEOVER CHECKPOINT

Timestamp: 2026-09-18 22:58 MSK
Branch: `prep/p12-cleanup-manifest-20260918`
Purpose: deterministic takeover for a parallel/new chat. **Do not merge this checkpoint branch into main as production work.**

## 0. OWNER INTENT / OPERATING MODE

Alexander asked to continue autonomously while P10 waits on external scheduler proof, but to keep strict authority boundaries. Current mode is:

- read-only live GitHub verification while waiting;
- checkpoint/metadata writes are allowed only to the prep/checkpoint branch;
- **do not mutate `main` merely to manufacture proof**;
- **do not manually dispatch/rerun Stable to satisfy P10-A** because the acceptance condition is a natural schedule event;
- continue P11/P12 preparation, forensics, cleanup classification, and exact execution planning;
- `executionAuthority = none` remains invariant.

Truth recovery order for takeover:

1. LIVE `CURRENT.md`
2. latest continuity
3. Router/resume context
4. fresh artifacts/evidence
5. this checkpoint as a handoff aid, not a substitute for fresh live truth.

## 1. P10 — CURRENT STATUS

### State

P10 remains approximately **98–99%** and is currently `WAITING_EXTERNAL_PROOF`, not a confirmed code defect.

P10-A requires a **natural scheduled `Update Stable Capital` run** on the current scheduler plus physical publication of exactly these three files on live `main`:

1. `companies/stable-capital-data.json`
2. `companies/embedded-yield-ledger.json`
3. `companies/stable-index-data.json`

Then P10-B requires downstream rebind / recovery; P10-C is final acceptance memo / closure.

### Current Stable scheduler

Current workflow: `.github/workflows/update-stable-capital-scheduled.yml`

Current cron after PR #858: `10 16 * * *` = **19:10 MSK**.

PR #858 merged before that slot (~18:49 MSK), so the workflow definition was present before the 19:10 natural window.

### Historical scheduler lag benchmark

Old Stable natural run on 2026-09-06:

- nominal cron: 08:37 MSK
- actual run creation: 12:38:39 MSK
- exact observed delay: **4h 01m 39s**
- successful materialization completed ~12:42 MSK

Therefore absence immediately after 19:10 is not sufficient to call a defect. Same historical lag would place a comparable materialization around **23:11:39–23:12 MSK** on 2026-09-18.

### Physical artifact truth before current natural proof

The three Stable files were last physically materialized by commit `4785c5f77e49ec1209437b00f46fa8c67f7a323b` on 2026-09-06 ~12:42 MSK. No later physical Stable materialization had been proven during the earlier checks.

### Required next P10 decision

At takeover, **re-check fresh Actions first**. If a natural `Update Stable Capital` run has appeared:

1. bind exact run ID, event=`schedule`, head SHA, created/start/completion, conclusion;
2. fetch run jobs/steps and prove writer/publish completed;
3. fetch live-main versions of all three required files and confirm they are post-run fresh, not pre-existing artifacts;
4. bind the publication commit on `main`;
5. inspect downstream Observer/System Memory/Cognitive/Explanatory recovery/rebind as required by current canon;
6. only then set P10 GREEN and write final acceptance memo.

If **no Stable natural run exists materially beyond ~23:12 MSK**, stop treating the state as ordinary scheduler lag. Re-baseline first, then open a bounded scheduler/registration diagnostic packet. Do not immediately dispatch manually and do not conflate connector endpoint failures with GitHub scheduler failure.

## 2. WHAT WAS DONE DURING THE LAST ~2–3 HOURS

While P10 waited, the session did not idle. A read-only P12 forensic/cleanup audit was performed and the queue was materially corrected against live evidence.

### A. #447 Unified Capital — fresh failure class isolated

Two real failures on 2026-09-18 were bound:

- run #348 / ID `35310165590`
- run #349 / ID `35312518538`

Both fail in the same coherent-capital refresh area, specifically:

- Unified passes admission, checkout, dependency setup, validation, VoteMarket safety and canonical Market Data guard;
- failure occurs in `6/10 Apply canonical YieldRing Productivity overlay`;
- exact exception: `page.waitForFunction: Timeout 20000ms exceeded`;
- stack points into `productivity/fxn-locker-apr-guard.mjs` → `collectLockerBlocks()` → `collectFxnLockerEconomicSnapshot()` → YieldRing overlay;
- this is **not** the old malformed action-pin defect repaired by PR #767.

Important recovery evidence:

- a later Unified run was observed successful without changing the FXN locker guard code;
- additionally, a fresh later Unified run #362 / ID `35379889890` at ~21:23 MSK was observed `success` in live Actions history;
- therefore this new fingerprint is best classified as **real but transient external/browser runtime instability**, not a persistent known code regression.

Safe handling: keep #447 open/reviewed until incident semantics are reconciled; do not close it merely as “fixed by #767”. The old fix and the new transient failure class are distinct.

### B. #716 Market Data — closure-ready evidence

PR #715 repaired the known production causes without weakening guards. Fresh natural Market Data production runs on 2026-09-18 are green. A reviewed natural run proved scheduler contract, onchain prices, authority and safe canonical publication. Classification: **closure-ready by evidence**.

### C. #792 ve33 verifier — closure-ready evidence

This verifier is PR-triggered rather than cron-based. Exact-head canary PR #832 supplied the correct proof. The canary completed within budget with:

- runtime ~386088 ms < 450000 ms
- `settlementQueryFailures=0`
- `unresolvedSettlements=0`
- `reconciliation=0`
- `currentStateFailures=0`
- `boundaryFailures=0`

Classification: **closure-ready by evidence**.

### D. #822 HyperLend — repair merged, natural proof absent

PR #855 fixes the diagnostic checkout pollution / leftover `node_modules` failure class. However the expected natural daily cron (05:17 UTC = 08:17 MSK) did not materialize in the checked post-merge windows through the evening. Classification: **not closure-ready**. Need natural post-merge production proof or separate trigger-registration diagnosis.

### E. #369 Rewards — repair merged, post-fix production proof absent

PR #853 fixes the old measured-token strip assumption by checking only rows actually present in economic state. However no post-merge `Update Company Rewards` execution was found across the checked windows (cron/push/workflow_run). Observer recurrence text alone is insufficient to prove a new regression. Classification: **repair merged, production proof absent; not closure-ready**.

### F. #799 Reporting — current live engineering tail

Old #727 `repeated-failure` fingerprint is historical. The newer/current Reporting issue is #799 `running-too-long`, with recurrence observed even on 2026-09-18 (~32.2 min). After P10, engineering should target #799 rather than pretending #727 is the current primary defect.

### G. Historical/retain-review queue

Read-only triage concluded:

- #726 Comparative Intelligence: **RETAIN/REVIEW** — no clean post-incident repair attribution / proof yet; legitimate downstream skips must not be confused with failures.
- #727 Reporting repeated-failure: historical; effectively superseded by the newer #799 runtime problem, but do not claim Reporting globally fixed.
- #432 deployment smoke: **RETAIN/SECURITY-REVIEW** — no sufficiently reviewed root-cause/repair/canary chain.
- #565 monthly reports: **RETAIN/REVIEW** — old incident, insufficient reviewed attribution.
- #370 Economic Graph: **RETAIN/REVIEW** — recurrence reached Sep 13, root cause remained unreviewed; current engineering tail is separately #778.
- #383 Economic Graph → Explanatory handoff: **RETAIN/REVIEW** — repeated handoff miss with insufficient final attribution.
- #659 Learning: **RETAIN/REVIEW** — old repeated-failure, insufficient attribution.
- #456 was separately forensically closed earlier as a historical one-off workflow_run dispatch/materialization miss; do not reopen without new evidence.

## 3. P11 — WHAT TO DO AFTER P10

No clear active standalone P11 issue/package was found in the live checks. Therefore **do not invent cosmetic work simply to satisfy the number P11**.

After P10 GREEN:

1. fresh roadmap/CURRENT/Router check;
2. if a concrete bounded P11 cosmetic/current-state package is still explicitly required, execute it;
3. otherwise record P11 as not required / already absorbed according to current canon and proceed directly to P12.

Do not widen the finish line.

## 4. P12 — UPDATED ACTIVATION QUEUE

P12 remains hard-gated by **P10 GREEN** for production repairs/mutations. Preparation is already advanced.

### Batch A — cleanup / metadata, after gate

Stale/superseded PRs already classified:

- #852 — urgent handoff, explicitly “do not merge”, superseded by live CURRENT
- #730 — superseded handoff
- #729 — older superseded handoff
- #717 — stale Market Data fix PR; useful logic already canonical; do not merge whole old PR
- #433 — historical recovery/checkpoint metadata
- #37 — Production Boundary canary, explicitly must never be merged; branch deletion is a separate destructive boundary

Issue handling after P10:

- #716 — closure-ready
- #792 — closure-ready
- #822 — hold open pending natural production proof / trigger diagnosis
- #369 — hold open pending post-fix execution proof / trigger diagnosis
- #447 — reviewed split classification: old pin defect fixed, fresh transient FXN browser-timeout class recovered; do not casually close without reconciliation

### Batch B — Cognitive recovery

#379 and #564 are dependency/freshness recovery tails. After Stable refresh:

1. prove fresh Stable physical state;
2. prove Observer/System Memory rebind;
3. prove natural Cognitive / Explanatory recovery according to current workflow dependencies;
4. require no recurrence before closure.

Do not build a second orchestrator.

### Batch C — engineering

C1 — #815 Aerodrome Managed Pulse
- capability-aware RPC routing;
- historical/blockTag fallback currently hit 403 archive restriction on a public fallback;
- reuse existing capability patterns, fail closed, no new RPC subsystem.

C2 — #778 Economic Graph recovery
- readiness race across exact-bound evidence generations;
- preserve exact SHA bindings;
- add bounded pre-dispatch generation-coherence proof;
- keep separate from the old #456 dispatch incident.

C3 — #799 Reporting
- publish-time main drift can force expensive rebuild;
- introduce deterministic input boundary / relevant-drift recompute / unrelated-drift bounded preserve-and-validate;
- do not use timeout expansion as the primary fix.

Then:

- fresh fanout audit;
- destructive stale-branch deletion only as a separate explicit boundary;
- freeze for P13.

## 5. P10-B / P10-C TAKEOVER CHECKLIST

When Stable natural publication appears, do not stop at “workflow green”. P10 closes only when all of the following are proven:

### P10-A — Stable natural production proof
- event = `schedule`
- workflow = current Stable writer
- conclusion = success
- three required files physically fresh on `main`
- publication commit bound

### P10-B — downstream rebind
Use current live workflow definitions to prove the actual dependency chain. Expected conceptual chain is:

`Stable physical state` → `Observer / System Memory freshness recognition` → `Explanatory/Cognitive recovery`

Do not assume exact workflow names/triggers from this checkpoint; fetch live definitions after the Stable commit. The acceptance point is that downstream systems stop treating Stable as stale and naturally recover without manual evidence fabrication.

### P10-C — final closure
- fresh live-main baseline
- no Stable stale-state contradiction
- no false UNKNOWN→ZERO coercion
- final acceptance memo/checkpoint
- update CURRENT/continuity only according to project canon
- then allow P11/P12 activation.

## 6. IMPORTANT TIME BOUNDARY AT CHECKPOINT

This checkpoint is written at **22:58 MSK**, only ~14 minutes before the historical 4h01m39s Stable scheduler-lag benchmark would be exceeded for the 19:10 slot.

Therefore the very first action by the takeover chat should be a **fresh live Actions check around/after 23:12 MSK**.

Decision tree:

- Stable natural run exists → immediately prove P10-A physical publication and continue P10-B/P10-C.
- Stable still absent materially after the historical lag boundary → create a bounded scheduler-registration diagnostic packet; do not keep waiting indefinitely and do not manually dispatch merely to manufacture acceptance.

## 7. COMMUNICATION WITH OWNER

Alexander prefers concise Russian status using:

- 🟢 done
- 🟡 in progress / waiting + approximate %
- ⚪ next

For `трекай`: always do a fresh read-only live check of main, active branches/PRs, Actions/runs, artifacts/evidence, continuity/checkpoints, and Router/resume context. Never reuse stale state as if live.

## 8. TAKEOVER FIRST COMMANDS / SEQUENCE

1. Fresh `main` head + LIVE CURRENT.
2. Fresh Actions list; search exact `Update Stable Capital` after 19:10 MSK.
3. If found, bind run/jobs and inspect all three required files on live main.
4. If absent after ~23:12 MSK, diagnose workflow registration/scheduler delivery as a bounded new packet.
5. Re-check latest Unified #362 only as supporting evidence that the FXN browser-timeout class recovered; do not conflate it with Stable.
6. Keep P12 production mutations gated until P10 GREEN.
7. After P10 GREEN, fresh roadmap check for whether P11 exists; then execute P12 in the updated order above.

---

This checkpoint intentionally separates **diagnosis, proof, repair, and closure**. It records current evidence without widening authority or manufacturing production proof.
