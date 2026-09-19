# THE HOLDING — URGENT TAKEOVER CHECKPOINT
## 2026-09-19 08:58 MSK · P10 Stable materialized / P10-B active

Status: **CANONICAL TAKEOVER CHECKPOINT FOR PARALLEL CHAT**  
Authority: continuity / recovery only  
Execution authority: **none**

> This checkpoint is intentionally stored on a dedicated checkpoint branch. It does **not** mutate `main`. Changing facts must be re-read from live `main` and exact Actions evidence before continuing.

---

## 0. TAKEOVER ENTRY POINT

Repository: `TheHolding83888/TheHolding-site-1.32`

Canonical checkpoint branch:

`checkpoint/p10-p12-urgent-takeover-20260919-0858-msk-canonical`

Checkpoint branch base / live `main` head at branch creation:

`0b415d67376d3c86347bb2f70d03ff0d34170c8e`

Base commit time: `2026-09-19T05:56:55Z` = **08:56:55 MSK**  
Base commit: `intelligence: refresh aerodrome managed pulse`

Previous canonical takeover checkpoint:

- branch: `checkpoint/p10-p12-urgent-takeover-20260918-2258-msk-canonical`
- commit: `605b4af062950fb2a7e309b9fc67cf20892c4bd5`
- file: `intelligence/project-memory/THE_HOLDING_URGENT_TAKEOVER_CHECKPOINT_2026-09-18_2258_MSK_P10_WAIT_P11_P12_READY.md`

Do **not** resume from the older noisy prep branch that had accidental `.tmp` artifacts. Use this checkpoint + fresh live `main`.

Mandatory truth order at takeover:

`CURRENT.md → latest continuity → Router → active roadmap → fresh main/artifacts/Actions → this checkpoint for resume context`

Because `main` moved materially after the latest automatic CURRENT/continuity checkpoint, **fresh live artifacts outrank CURRENT** for this P10 state.

---

## 1. CURRENT PRIMARY OBJECTIVE

Active roadmap package: **P10 — System-wide production acceptance**.

Owner instruction: finish/fix the issue; do not keep waiting another day or expand into broad archaeology.

P10 was decomposed earlier into:

- **P10-A** — Stable Capital automatic writer/materialization proof
- **P10-B** — downstream rebind after Stable publication
- **P10-C** — final system-wide production acceptance memo/checkpoint → `P10 CLOSED`

### Current state at this checkpoint

- **P10-A: operationally GREEN / physical Stable materialization achieved.**
- **P10-B: ACTIVE / partially progressed.**
- **P10-C: NOT YET DONE.**

Important nuance: the original P10-A wording asked specifically for a natural `event=schedule` proof. That exact natural schedule event had still not appeared in the earlier proof window. The repair changed the production liveness model by adding a bounded automatic heartbeat from the already-healthy canonical Market Data baseline while preserving the same single Stable writer. The writer then auto-started and physically published fresh artifacts. Treat exact `event=schedule` as an evidence question, not silently as proven. Do not re-open broad scheduler archaeology unless the final P10 acceptance contract still explicitly requires schedule-only proof despite the new resilient automatic heartbeat.

---

## 2. WHAT HAPPENED SINCE THE 2026-09-18 TAKEOVER

### 2.1 PR #859 — bounded natural scheduler proof window

PR: **#859** — `P10: bounded Stable natural-scheduler proof window`  
Merged: **07:44:04 MSK**  
Merge commit: `9742e2f22533dfa0fb08a4eac0b1026ec248a783`

Change was intentionally tiny: temporary two-slot schedule for liveness proof.

Result: the expected natural Stable `schedule` run still did not appear in the short proof window. This was no longer treated as `WAITING_EXTERNAL_PROOF`.

### 2.2 Diagnosis — YAML/business logic was not the primary blocker

The Stable workflow definition remained structurally valid and the repository had other healthy scheduled workflows. Repeatedly moving cron slots was judged a bad repair strategy.

The existing Workflow Control Plane was checked and correctly remained **read-only/auditor-only**; it was not given dispatch or execution authority.

### 2.3 PR #860 — automatic Market Data failover / self-probe

PR: **#860** — `P10: Stable automatic Market Data failover`  
Merged: **08:14:18 MSK**  
Merge commit: `d2455cec3781a41cbc3e74feb0c30c8729991232`

Bounded repair:

- keep one canonical Stable writer;
- keep its schedule;
- add automatic `push` wake-up when the canonical daily Market Data baseline file changes:
  `intelligence/market-data/market-data-coingecko.json`;
- self-probe after Stable workflow/proof/engine definition changes;
- no duplicate writer;
- no workflow-dispatch authority added;
- no accounting-semantic change.

Expected chain:

`Daily Market Data baseline → Stable Capital writer → existing Unified Capital downstream`

Control Plane / no-new-debt checks passed before merge.

### 2.4 First automatic Stable run after #860 exposed a second bounded defect

Run ID: **`35423417508`**  
Workflow: `Update Stable Capital`  
Event: **`push`**  
Head SHA: `d2455cec3781a41cbc3e74feb0c30c8729991232`  
Started: **08:14:21 MSK**

The workflow auto-started without manual dispatch, proving the new automatic wake-up path was real.

However the job reached:

`Collect recurring Stable Capital reference yield + ledger checkpoint`

and hit the workflow's **12-minute job limit** before publication. The collector step was cancelled; later build/validate/publish steps were skipped. Therefore the three production artifacts were still not materialized by this run.

This correctly became a **new bounded runtime packet**, not a reopening of scheduler diagnosis.

### 2.5 PR #861 — bound Stable rate collection runtime

PR: **#861** — `P10: bound Stable rate collection runtime`  
Merged: **08:37:15 MSK**  
Merge commit: `c6a99309db8f333caae9d47954967e3a349709f7`

Repair:

- run the 10 independent read-only Stable rate adapters concurrently instead of serially;
- preserve per-adapter fail-closed error isolation;
- preserve accounting/methodology semantics;
- add per-adapter runtime telemetry;
- self-probe the same canonical Stable writer after engine changes;
- no duplicate writer;
- no new dispatch authority;
- no accounting formula change;
- no Stable Index methodology change.

The canonical engine now logs each adapter start/done/error and collects them with `Promise.all(...)`.

---

## 3. CRITICAL NEW FACT: STABLE PHYSICAL MATERIALIZATION SUCCEEDED

After PR #861, `main` received:

**Commit:** `5abc934d4ac066981c8995ebc6fdbd0916683d44`  
**Message:** `Publish Monetra verified Stable Performance`  
**Time:** `2026-09-19T05:44:43Z` = **08:44:43 MSK**

This is the first fresh Stable publication after the old September 6 state.

### Three required P10-A physical artifacts are now fresh on live `main`

1. `companies/stable-capital-data.json`
   - version: `0.4.1-monetra-recurring-stable-index-semantics`
   - generatedAt: **`2026-09-19T05:44:42.264Z`**

2. `companies/embedded-yield-ledger.json`
   - version: `0.4-flow-aware-recurring-checkpoints`
   - generatedAt: **`2026-09-19T05:44:42.264Z`**

3. `companies/stable-index-data.json`
   - version: `0.2-stable-companies-index-strategy-performance`
   - generatedAt: **`2026-09-19T05:44:42.359Z`**
   - Stable source generatedAt: `2026-09-19T05:44:42.264Z`
   - Embedded Ledger source generatedAt: `2026-09-19T05:44:42.264Z`

All three belong to the same fresh publication boundary.

Stable Index current summary at that boundary includes:

- Stable Capital: `100.475098 USD`
- Current Capital: `100.56481423 USD`
- Invested: `99.99833671 USD`
- Strategy Performance: `+0.78346157` / `+0.7834746%`
- Net Market P&L: `+0.56647752` / `+0.56648694%`
- Embedded income since tracking: `0.12265482 USD`
- Accrued claimable: `0.08971623 USD`

Note: `currentFullCoverage=false` with `referenceApyStatus=last-full-coverage` is a factual rate-coverage state, not evidence that publication failed. Do not convert UNKNOWN/warming rate evidence into zero or fabricate coverage.

### P10-A conclusion

The production writer now:

- has an automatic non-manual wake-up path;
- runs the canonical Stable collector;
- completes within bounded runtime after #861;
- physically publishes the exact three required artifacts to live `main`.

Therefore **the production materialization blocker that held P10 for ~2 days is functionally resolved**.

Do not spend another day moving cron slots. If exact natural `event=schedule` proof is still desired, observe it opportunistically; do not confuse that with the now-proven automatic production materialization path.

---

## 4. DOWNSTREAM AFTER STABLE PUBLICATION — P10-B

Fresh commits after Stable publication show the downstream system already began rebinding:

- `417a3ed2cd4bd955fb4a49a2d74c3411892cdc3f` — `capital: refresh coherent production snapshot` — **08:49:10 MSK**
- `4e73b763f1b74bd54833ab1b71e9f77fd5dd6e97` — `intelligence: refresh comparative state` — **08:50:06 MSK**
- `d1a21caa6761ba5bbca219244c72a5f9186bbc2b` — `intelligence: refresh explanatory context` — **08:51:01 MSK**
- `26d166c2827838b847c4de541c3bda96b3fb3528` — `intelligence: refresh economic graph` — **08:51:15 MSK**
- `9ca59f994423ea1dbd7ed939a84d6bc303c14b2e` — `intelligence: refresh explanatory context` — **08:52:18 MSK**
- `0b415d67376d3c86347bb2f70d03ff0d34170c8e` — `intelligence: refresh aerodrome managed pulse` — **08:56:55 MSK**

This strongly indicates the normal downstream chain is moving again after Stable publication.

### What is NOT yet closed in P10-B

At the last CURRENT snapshot, System Memory was still old:

- `intelligence/system-memory.json` represented in CURRENT as generatedAt `2026-09-18T11:35:41.707Z`.

The Cognitive Stack packet in CURRENT was also an older coherent chain (Security snapshot inside it from Sep 13), while standalone Security had already refreshed on Sep 19.

Therefore **do not declare P10-B closed yet** merely because Unified/Comparative/Explanatory/Economic Graph moved.

P10-B acceptance still needs fresh exact proof that the relevant Observer/System Memory/Cognitive chain has rebound from the post-Stable state without freshness bypasses or weakened guards.

Useful workflow facts already checked:

- `The Holding Reliability · Runtime Observer` remains read-only with respect to repository mutation/execution; schedule `13,43 * * * *`; issue metadata only.
- `The Holding Brain · Refresh Cognitive Stack` is triggered by successful non-manual `The Holding · Explanatory Context` workflow_run and has a daily schedule; it has strict freshness/release guards.
- downstream continuity remains bounded and cannot gain execution authority.

### Exact next action for takeover chat

1. Fresh-read `main` after `0b415d...` in case more downstream commits landed.
2. Inspect Actions runs around the Stable publication boundary and identify the exact successful post-#861 Stable run ID/head SHA.
3. Verify the three Stable files remain the Sep 19 fresh publication.
4. Verify the fresh coherent production snapshot / Unified Capital source actually consumed the Sep 19 Stable bytes, not a stale cached source.
5. Inspect the first post-Stable Runtime Observer/System Memory materialization.
6. Inspect the first post-Stable Explanatory → Cognitive Stack workflow chain.
7. Require normal freshness guards to PASS; do **not** weaken thresholds or manual-bypass freshness solely to get green.
8. If downstream naturally materializes coherently, mark **P10-B GREEN**.
9. If one exact downstream handoff is broken, open **one bounded defect packet only**. No broad architecture audit.

---

## 5. P10-C — FINAL ACCEPTANCE CHECKLIST

Once P10-B is physically green, create a bounded P10 acceptance memo/checkpoint proving the already-closed public functional contour:

- P5–P9 remain closed unless fresh evidence proves regression;
- Company #010 / Cypher scheduler/publication proof remains valid;
- Reporting / Rewards / HyperLend repaired evidence is classified accurately (natural proof still pending where applicable, but do not invent closure);
- Stable automatic wake-up + bounded runtime + 3-file physical materialization proven;
- downstream Observer/System Memory/Cognitive rebind proven;
- Workflow Control Plane / no-new-debt invariants preserved;
- no genuine current production blocking red remains.

Exit:

- no genuine blocker → **`P10 CLOSED / GREEN`**
- genuine blocker → exactly one bounded packet, with evidence and explicit exit condition.

Do not keep P10 open for unrelated P12 cleanup work.

---

## 6. P11 — DO NOT INVENT WORK

Live inspection before this checkpoint found no separate material P11 package already active.

After P10 closes:

- run one fresh bounded current-state/cosmetic baseline;
- if a real owner-deferred P11 package exists, execute only that bounded package;
- otherwise record **P11 = N/A / no material package** and proceed to P12.

P11 is not permission for redesign.

---

## 7. P12 — PREPARED QUEUE FROM PREVIOUS CHAT

P12 has not been allowed to contaminate P10, but much forensic prep is already done.

### P12-A — metadata cleanup / stale PRs

Candidates previously prepared:

- #852
- #730
- #729
- #717
- #433
- #37

Classify `CLOSE / KEEP / NEEDS OWNER BOUNDARY`. No code changes merely to make the list look clean.

### P12-B — resolved incident closure

Previously assessed:

- **#716 Market Data** — evidence likely sufficient for closure after P10 gate.
- **#792 ve33 verifier** — evidence likely sufficient for closure.
- **#447 Unified** — two Sep 18 failures traced to transient browser/runtime timeout while reading FXN Locker (`page.waitForFunction` 20s); later Unified runs recovered. Treat as transient external runtime class unless fresh recurrence disproves it.
- **#822 HyperLend** — repair exists; natural production proof still required.
- **#369 Rewards** — repair exists; natural post-fix execution evidence still incomplete.
- **#726, #432, #565, #370, #383, #659** — retain/review; do not force-close without proof.

### P12-C engineering packets

- **#815 Aerodrome archive-RPC capability mismatch** — distinguish basic RPC liveness from historical/archive capability; fail closed; no broad RPC redesign.
- **#778 Economic Graph publication/recovery coherence** — historical 116.42 MB graph publish failure > GitHub 100 MB; prove whether current architecture has eliminated the class or add only a bounded preventive guard.
- **#799 Reporting publish-time main drift** — relevant drift → recompute; unrelated drift → retain validated candidate/bounded validation; unknown → fail closed. Do not solve by merely increasing timeout.

### P12-D Cognitive freshness incidents

- #379 Cognitive
- #564 Explanatory → Cognitive

Do not patch these from old evidence. First complete P10-B fresh rebind proof. If they disappear, close as downstream symptoms; if they recur, isolate one bounded packet.

### P12-E/F

- final fan-out/runtime audit using existing Control Plane;
- cleanup/freeze;
- checkpoint what closed / stayed open and why;
- then hand off to P13.

Anti-stall rules remain:

1. one defect family per packet;
2. `DIAGNOSE != REPAIR != PROVE != CLOSE`;
3. after ~30–60 minutes unresolved work save a delta/checkpoint;
4. every packet ends `DONE / WAITING EXTERNAL PROOF / OPEN DEFECT / OWNER BOUNDARY`;
5. no multi-hour Actions archaeology after root cause is bound;
6. live `main` is truth; checkpoint branches are continuity only.

---

## 8. IMPORTANT FILE / WORKFLOW STATE

Canonical Stable workflow on `main`:

`.github/workflows/update-stable-capital-scheduled.yml`

Current automatic inputs:

- `workflow_dispatch` (manual, not preferred as acceptance proof)
- schedule: `52 4,16 * * *` during bounded proof window
- `push` on:
  - `intelligence/market-data/market-data-coingecko.json`
  - `stable-capital/stable-capital-engine.mjs`
  - `.github/workflows/update-stable-capital-scheduled.yml`
  - `intelligence/reliability/update-stable-capital-scheduler-proof.mjs`

Writer permissions remain `contents: write`; concurrency group remains `update-stable-capital`; `cancel-in-progress: false`.

After final P10 acceptance, consider reverting the temporary two-slot proof schedule to the normal single daily cadence **only as bounded cleanup** and only if doing so does not destroy still-needed exact evidence.

---

## 9. DO NOT DO

- Do not re-run the entire P10 investigation from scratch.
- Do not wait another 24 hours merely for a cron badge if the production automatic writer and physical materialization are already proven through the canonical fallback heartbeat.
- Do not weaken freshness guards.
- Do not create a second Stable writer.
- Do not give Runtime Observer / Workflow Control Plane dispatch or execution authority.
- Do not change Stable accounting semantics while closing a reliability packet.
- Do not mix P12 cleanup into P10-C acceptance.
- Do not mass-delete branches/issues/workflows.
- Do not use old generated timestamps as current truth.

---

## 10. SIMPLE TAKEOVER SUMMARY

At the old handoff, P10 was stuck waiting for Stable. That blocker is now materially different:

1. natural schedule proof did not arrive;
2. automatic Market Data heartbeat was added without adding a duplicate writer;
3. Stable auto-started, exposing a 12-minute collector runtime problem;
4. rate collection was parallelized without changing economics;
5. **fresh Stable publication succeeded at 08:44:43 MSK**;
6. all three required Stable artifacts are fresh on `main`;
7. downstream Unified/Comparative/Explanatory/Economic Graph commits started flowing immediately after publication;
8. the active task is now **P10-B downstream System Memory/Cognitive rebind**, then **P10-C final acceptance**.

The next chat should begin there, not at scheduler diagnosis.

---

## 11. RECOVERY LAW

Always re-read live:

`CURRENT → latest continuity → Router → Roadmap → fresh artifacts → exact Actions`

This checkpoint is the resume map, not production truth.

The goal remains: **close P10 cleanly, do not expand scope, then P11 bounded/N/A → P12 finite cleanup → P13 real pre-private checks.**
