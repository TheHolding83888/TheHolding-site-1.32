# THE HOLDING — P12 LIVE ACTIVATION DELTA
## 2026-09-18 ~20:27 MSK · preparation only · P10 gate still active

Authority: read-only/evidence-backed preparation only. `main` is not changed by this delta. `executionAuthority = none`.

This file does **not** replace the original `THE_HOLDING_P12_ACTIVATION_QUEUE_2026-09-18.md`. It records fresh evidence learned later on 2026-09-18 and therefore overrides stale item-level assumptions when activation eventually occurs.

## Hard gate unchanged

P12 production activation remains blocked until P10 Stable Capital is physically GREEN:
- natural `event=schedule` run;
- successful writer;
- physical refresh on live `main` of:
  - `companies/stable-capital-data.json`
  - `companies/embedded-yield-ledger.json`
  - `companies/stable-index-data.json`;
- required downstream Observer/System Memory/Cognitive rebind;
- final P10 acceptance.

Manual dispatch/rerun does not substitute for natural scheduler proof.

## Fresh P11 interpretation

The original queue says to respect P11 ordering **if** a bounded cosmetic/current-state package is still required. Fresh searches on live `main` did not surface a dedicated active P11 issue/package. Therefore after P10 GREEN:
1. re-read CURRENT/roadmap/live PRs/issues;
2. if a concrete bounded P11 package exists, respect the ordering;
3. otherwise do **not** invent cosmetic work merely to satisfy the phase label; proceed to P12.

## Overrides to original Queue A

The original activation queue predated later Sep 18 forensic evidence. These item-level classifications are now more accurate:

### #822 HyperLend — move from closure-ready to WAITING_EXTERNAL_PROOF
- #855 repaired the diagnostic `node_modules` residue / false-red clean guard.
- Natural cron is 05:17 UTC / 08:17 MSK.
- No natural post-merge HyperLend run was found through ~19:45 MSK Sep 18, far beyond the known ~4h Stable scheduler-lag benchmark.
- Do not close merely because repair code merged. Require a real production proof or separately diagnose missing registration/materialization.

### #369 Rewards — move from closure-ready to WAITING_EXTERNAL_PROOF
- #853 repaired measured-token strip semantics.
- Triggers include narrow push, daily 05:07 UTC / 08:07 MSK, plus workflow_run after Cypher/ICP.
- No post-merge Rewards execution was found through ~19:48 MSK Sep 18.
- Observer recurrence text alone does not prove post-fix regression. Require actual post-fix production materialization before closure.

### #447 Unified Capital — move from closure-ready to RETAIN / TRANSIENT RUNTIME REVIEW
- Old malformed action-pin defect was repaired by #767.
- Fresh Sep 18 Unified runs #348 (`35310165590`) and #349 (`35312518538`) both failed in coherent-capital refresh at YieldRing Productivity / FXN locker browser guard: `page.waitForFunction` timed out after 20s.
- Later Unified #360 passed the same FXN step.
- FXN guard code had not changed since Aug 24 between failures and recovery.
- Therefore do not classify the fresh failures as recurrence of the old action-pin bug. Current evidence supports a real but transient external/browser runtime class. No blind repair and no immediate closure.

### #716 Market Data — CLOSURE-READY remains valid
- #715 repaired reviewed production root causes.
- Fresh natural Market Data #524 passed scheduler contract, onchain prices, 26-asset authority and canonical publication.
- Final same-fingerprint check at activation, then metadata close is justified.

### #792 ve33 verifier — CLOSURE-READY remains valid
- PR-triggered workflow, not cron.
- Exact-head canary PR #832 passed: runtime 386088ms < 450000ms; zero settlement-query, unresolved-settlement, reconciliation, current-state and boundary failures.
- Final same-fingerprint check at activation, then close as CI/workflow-definition incident.

### #456 Unified → Economic Graph — DONE / CLOSED
- Historical one-off downstream `workflow_run` materialization miss was forensically bound and closed evidence-backed.
- Provider-internal reason was not observable and was not guessed.
- Do not reopen without new same-lineage evidence.

## Other fresh classifications

### #727 Reporting repeated-failure — HISTORICAL / superseded operationally by live #799
The old repeated-failure fingerprint stopped being the primary live class. A distinct `running-too-long` Reporting fingerprint is active as #799 and recurred through Sep 18 (~32.2m observed). Do not claim Reporting itself is fixed; prepare #727 only for reviewed historical cleanup.

### #726 Comparative — RETAIN / REVIEW
No attributable post-incident repair established. Current workflow is downstream-driven; later `skipped` runs can be legitimate guards. Insufficient evidence for honest closure.

### #432 Deployment Smoke — RETAIN / SECURITY-REVIEW
Security-sensitive historical incident; no reviewed root cause/durable repair/canary established in this pass.

### #565 Monthly Reports — RETAIN / REVIEW
Historical two-failure fingerprint remains unattributed. Later `skipped` runs are not proof of repair.

### #370 Economic Graph old repeated-failure — RETAIN / REVIEW
Old fingerprint recurred through Sep 13 and stayed UNKNOWN_UNTIL_REVIEWED. Keep distinct from current #778 recovery-readiness engineering class unless exact lineage proves otherwise.

### #383 Economic Graph → Explanatory handoff — RETAIN / REVIEW
Old handoff-miss fingerprint recurred through Sep 13. Do not conflate with #456 or #778 without exact evidence.

### #659 Learning Loop — RETAIN / REVIEW
Historical three-failure fingerprint, no reviewed repair attribution in current pass.

## Exact recommended activation order after P10 GREEN

### Step 0 — fresh activation baseline
- live `main` head;
- CURRENT → latest continuity → Router;
- open PR/issue inventory;
- fresh Actions/runs;
- fresh physical artifacts;
- decide whether a concrete P11 package actually exists.

### Step 1 — P11 only if concretely materialized
Execute only a bounded already-defined cosmetic/current-state package. If none exists, skip directly to P12. Do not invent work.

### Step 2 — P12 Batch A metadata cleanup
Final live check, then close only evidence-backed stale surfaces:
- PRs #852, #730, #729, #717, #433;
- PR #37 only after proving no current policy/rule/recovery dependency; do not delete its branch in the same batch;
- issues #716 and #792 after one final same-fingerprint recurrence check;
- #727 only as reviewed historical/superseded metadata if its old fingerprint still has no new recurrence.

Do **not** auto-close #822, #369 or #447 under the old queue assumption.

### Step 3 — P12 Batch B P10-freshness recovery
For #379 Cognitive Stack and #564 Explanatory → Cognitive:
- use the fresh Stable artifacts from P10;
- require Observer/System Memory rebind;
- require natural Cognitive success / natural handoff;
- do not patch around freshness guards or add a second orchestrator.

### Step 4 — unresolved natural-proof tails
- #822 HyperLend: obtain/diagnose natural production materialization.
- #369 Rewards: obtain/diagnose post-fix production materialization.
These are proof/registration packets, not reasons to weaken logic.

### Step 5 — C1 #815 Aerodrome Managed Pulse
Bounded capability-aware RPC repair; prove historical/blockTag capability before admitting provider; fail closed; reuse existing Base RPC patterns; no new subsystem.

### Step 6 — C2 #778 Economic Graph recovery
Bounded exact-generation readiness/coherence repair; preserve exact SHA bindings; coherent → dispatch, visibly mid-refresh → bounded defer/wait, unknown/incoherent → fail closed; no parallel graph writer.

### Step 7 — C3 #799 Reporting
Dependency-aware main-drift optimization; preserve deterministic input boundary and accounting truth; relevant drift recomputes, unrelated drift preserves validated candidate with bounded validation; timeout expansion is not the primary repair.

### Step 8 — fresh fan-out audit
Use only existing fan-out control plane. Remove proven redundant wakeups, never domain coverage. Security-sensitive `pull_request_target` surfaces excluded from casual reduction.

### Step 9 — destructive hygiene boundary
Branch deletion/history cleanup remains separate and requires explicit owner authorization plus dependency proof.

### Step 10 — freeze for P13
Fresh exact-head evidence, no unresolved newly-introduced failure classes, then hand off to P13 real pre-private checks.

## Activation principle

P12 success is not issue-count reduction. It is fewer real failure classes and stale surfaces with no loss of security, accounting truth, provenance, fail-closed behavior or evidence.
