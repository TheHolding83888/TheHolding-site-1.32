# THE HOLDING — P10 STABLE CAPITAL URGENT PARALLEL-CHAT HANDOFF

**Status:** URGENT RESUME CHECKPOINT / BRANCH-ONLY / P10 DIAGNOSIS IN PROGRESS  
**Created:** 2026-09-16 21:35 MSK (+03:00)  
**Checkpoint branch:** `checkpoint/p10-stable-capital-urgent-20260916-2135-msk`  
**Source `main` SHA at checkpoint creation:** `38068d014877377afae6380d0861ec6018f4d3d9`  
**Source `main` commit time:** 2026-09-16T17:07:24Z  
**Source `main` message:** `intelligence: refresh vlcvx votium curve pool context`  
**Execution authority:** `none` — this handoff does not authorize wallet actions, capital movement, methodology mutation, or automatic production merge/release.

---

## 0. RESUME LAW — READ THIS FIRST

This checkpoint is a **point-in-time recovery aid**, not a replacement for live truth.

On resume, restore truth in this order:

`LIVE main → CURRENT.md → latest continuity → Routing Index → task-specific canon/context → fresh artifacts → exact workflow/run evidence`

If live `main` has advanced after source SHA `38068d0...`, **fresh live state wins**.

Do not assume any diagnosis below remained unchanged without a fresh read-only check.

---

## 1. CURRENT ROADMAP POSITION

Canonical roadmap:

`intelligence/project-memory/THE_HOLDING_PUBLIC_GREEN_TO_PRIVATE_ROADMAP_2026-09-13.md`

Public→private sequence:

- P0 durable roadmap/recovery wiring
- P1 close real production red frontier
- P2 make red Actions meaningful
- P3 Company #010 / Cypher stability
- P4 factual accounting completeness tails
- P5 universal historical reward-token valuation
- P6 supported-mechanism/new-reward-token reuse proof
- P7 heavy workflow profiling
- P8 bottleneck repair only where P7 proved one
- P9 bounded Economic Graph / sensor closure
- **P10 system-wide production acceptance / final functional sweep — ACTIVE FRONTIER**
- P11 bounded cosmetics/current-state package
- P12 cleanup/freeze
- P13 real pre-private checks
- P14 migration-readiness GREEN checkpoint
- P15 full verified backup/export
- P16 public→private only with explicit owner confirmation at that moment
- P17 post-private audit

Recent continuity confirms the project has already progressed through the P9 trigger boundary (`P9: preserve vlCVX retained historical RPC provenance`). The work being handed off here is the **P10 functional sweep**, not a new architecture layer.

---

## 2. CANONICAL PROJECT / SAFETY INVARIANTS TO PRESERVE

The Holding cognitive loop:

`OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → ACT → MEASURE → LEARN`

Must preserve:

1. **ONE ARTIFACT → ONE CANONICAL WRITER.**
2. Do not create a second writer/workflow merely to make stale output look fresh.
3. Do not weaken freshness/acceptance guards to silence a red condition.
4. Do not fabricate timestamps, data, or “successful” materialization.
5. `UNKNOWN != 0`.
6. A GREEN workflow/run is not equivalent to a physically materialized artifact on `main`.
7. Prefer the smallest systemic fix that closes the proven defect.
8. No wallet signing, transaction execution, autonomous capital movement, or authority expansion.
9. Do not move to P11 cosmetics while a real P10 production-freshness defect remains open.

---

## 3. IMMEDIATE P10 DEFECT FOUND

During the system-wide P10 sweep, three Stable Capital production artifacts were found stale together.

They are all owned by the same canonical GitHub Actions workflow:

`.github/workflows/update-stable-capital.yml`

Workflow display name:

`Update Stable Capital`

The workflow currently contains:

```yaml
on:
  workflow_dispatch:
  schedule:
    - cron: "37 5 * * *"
```

So the intended recurring cadence is **daily at 05:37 UTC**.

Its publication step atomically stages these three artifacts:

```text
companies/stable-capital-data.json
companies/embedded-yield-ledger.json
companies/stable-index-data.json
```

The workflow explicitly commits them with:

`Publish Monetra verified Stable Performance`

and then rebases/pushes back to `origin/main`, followed by remote verification.

### Last proven materialization boundary

Fresh commit-history inspection of `companies/stable-capital-data.json` shows the latest publishing commit on `main` is:

- SHA: `4785c5f77e49ec1209437b00f46fa8c67f7a323b`
- time: `2026-09-06T09:42:28Z`
- message: `Publish Monetra verified Stable Performance`

The previous daily materializations visible immediately before it include:

- 2026-09-05 — `3092292fd00af4fc8cec1c310a79c181a984b3c4`
- 2026-09-04 — `6e031ccd706266999276dd791510c05e387d9829`
- 2026-09-03 — `d632dee068897577453511beb421292e895828a8`

This is strong evidence that the recurring writer was working day-by-day and then stopped materializing after September 6.

The Sept 6 commit itself contains a new `embedded-yield-ledger.json` checkpoint with `generatedAt: 2026-09-06T09:42:27.811Z`, confirming that this was a real recurring data refresh, not just metadata churn.

---

## 4. WHAT HAS ALREADY BEEN NARROWED DOWN

The earlier investigation initially checked broader intelligence/freshness surfaces, but the defect is now localized much more tightly:

- The three stale outputs have **one common canonical writer**.
- The canonical workflow file still exists on current `main`.
- Its schedule declaration still exists.
- Its `contents: write` permission still exists.
- It has a single concurrency group `update-stable-capital`, with `cancel-in-progress: false`.
- The workflow still has the expected collect → interval-history → stable-index → validate → publish sequence.

Therefore, do **not** treat this as a Cognitive Stack defect and do not add a parallel refresh loop.

The unresolved question at checkpoint time is specifically:

> **Why did scheduled `Update Stable Capital` stop producing/publishing the three canonical artifacts after 2026-09-06?**

Root cause is **not yet claimed** in this checkpoint.

---

## 5. EXACT WORKFLOW LOGIC WORTH CHECKING

The current workflow has a 12-minute job timeout and performs:

1. checkout with full history;
2. Node 22 setup;
3. preflight schema/invariant checks;
4. dependency install (`ethers@6`, `@aave-dao/aave-address-book`);
5. live Stable Capital collection using Ethereum/Base/Fraxtal RPC secrets;
6. canonical Embedded Yield interval-history build;
7. Stable Companies Index build;
8. strict generated-data validation;
9. git commit/rebase/push to `main` with up to 3 attempts;
10. remote file/version verification.

Important preflight dependencies include:

- `companies/company-008-resolve.json`
- `companies/stable-capital-data.json`
- `companies/embedded-yield-ledger.json`
- `companies/company-008-strategy-entry-ledger.json`

The preflight expects exact structural/version invariants, including:

- Monetra registry `008`
- 10 Stable Capital positions
- Strategy Entry version `0.7-monetra-lido-capital-transfer-close`
- full 10/10 entry and performance readiness

A later change to any of these upstream files/schema assumptions is one plausible failure class, but it is **not yet proven**. Check run evidence instead of guessing.

---

## 6. NEXT EXACT DIAGNOSTIC SEQUENCE

Resume from here in this order:

### A. Inspect actual Actions history for `Update Stable Capital`

Look across at least Sept 5–16 and find:

- last scheduled run that definitely succeeded;
- first scheduled run after Sept 6;
- whether runs exist but fail, are skipped/cancelled, or are absent entirely;
- event type (`schedule` vs `workflow_dispatch`);
- run/head SHA and conclusion.

### B. If runs exist after Sept 6

Inspect the first bad run job/step/logs and classify the failure boundary:

- preflight failure;
- dependency install;
- RPC/live collection;
- timeout;
- interval-history build;
- index build;
- validation;
- git rebase/push conflict;
- permission/write failure;
- remote verification failure.

Compare with the last good Sept 6 run.

### C. If scheduled runs are absent

Check:

- workflow enabled/disabled state;
- workflow ID/path history;
- default-branch trigger validity;
- whether the workflow file was renamed/reintroduced;
- GitHub schedule inactivity/disable conditions;
- relevant workflow-control-plane evidence.

Do not “fix” an absent schedule by adding a duplicate scheduler.

### D. Inspect workflow git history around the boundary

Compare `.github/workflows/update-stable-capital.yml` before/after Sept 6 and any upstream file/schema changes that could cause preflight to fail.

### E. Repair only after root cause is proven

The repair should be the smallest change to the **canonical** writer/trigger.

Validation standard:

1. workflow runs successfully;
2. generated artifacts validate;
3. the three expected files physically materialize on current `main`;
4. generated timestamps/data are genuinely fresh;
5. no duplicate writer is introduced;
6. workflow-control-plane / architecture invariants remain clean;
7. only then mark this P10 defect GREEN and continue the functional sweep.

---

## 7. CURRENT RECOVERY SOURCES AT CHECKPOINT TIME

Fresh `main` recovery sources inspected immediately before this handoff:

### CURRENT

`intelligence/project-memory/CURRENT.md`

At inspection time it pointed to latest continuity:

`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-16_151851_AUTO_608c23ff.md`

and the Routing Index:

`intelligence/project-memory/THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`

### Latest continuity

`THE_HOLDING_MASTER_CONTINUITY_2026-09-16_151851_AUTO_608c23ff.md`

Key carry-forward facts:

- trigger boundary associated with merged P9 work;
- Security currently WATCH rather than silently GREEN;
- accounting mechanisms: 29, reusable coverage gap: 0 at that captured snapshot;
- canonical income ledger remains sole factual earned-income authority;
- reference APR/APY is non-additive analytical context;
- claims/withdrawals already recognized as settlement do not create second income;
- no wallet/capital/methodology authority.

Because continuity is older than this checkpoint’s `main` SHA, use it for context only; fresh `main` artifacts win.

---

## 8. RECENT ROADMAP CARRY-FORWARD THAT SHOULD NOT BE REOPENED WITHOUT NEW EVIDENCE

P5/P6 had already been closed with fail-closed semantics and reusable-mechanism proof before the active P10 sweep.

Relevant preserved principles:

- no current-price historical backfill;
- unresolved historical USD proof remains explicit UNKNOWN;
- new reward token on an already-supported mechanism must reuse the generic accounting engine rather than create per-token special logic;
- `claim` is settlement, not a second factual income event;
- accounting gaps must remain visible rather than being coerced to zero.

Do not let the Stable Capital operational-freshness fix mutate those accounting laws.

---

## 9. USER OPERATING CONTRACT

Alexander prefers brief/plain-language progress reports.

When he says **«трекай»**, perform a **fresh read-only live GitHub check** of:

- current `main`;
- active/relevant branches and PRs;
- workflows / Actions / runs;
- fresh generated artifacts/evidence;
- continuity/checkpoints;
- Router/resume context.

Then report in this form:

- 🟢 done
- 🟡 in progress + rough %
- ⚪ next

Do not answer “current status” from this checkpoint alone.

---

## 10. ONE-SENTENCE RESUME PROMPT

> Resume P10 from live `main`; verify the exact Actions-run boundary for canonical `Update Stable Capital` after the last proven Sept 6 publication, identify whether the schedule stopped firing or a run started failing, make no duplicate writer and no guard weakening, then repair the smallest proven cause and verify physical refresh of all three Stable Capital artifacts on `main`.

---

## 11. CHECKPOINT INTEGRITY NOTE

This file was intentionally written only to the dedicated checkpoint branch. It is not a production-state mutation and should not be merged merely for the sake of having a handoff. Its purpose is continuity if the active chat loses context.
