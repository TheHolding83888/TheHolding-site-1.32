# THE HOLDING — URGENT TAKEOVER HANDOFF
## 2026-09-17 09:54 MSK · P10 production acceptance

Status: **DETAILED MANUAL RESUME CHECKPOINT**  
Purpose: allow a parallel/replacement chat to continue the current P10 work without reconstructing the investigation from scratch.  
Authority: **observation / repository continuity only**  
`executionAuthority = none`

> This file is a takeover aid, not a source of changing truth. At resume time always re-read live `main`, CURRENT, latest continuity, active PRs/runs and physical artifacts before making a production claim.

---

## 0. EXACT SOURCE BOUNDARY OF THIS HANDOFF

Repository: `TheHolding83888/TheHolding-site-1.32`

This handoff branch was created directly from fresh live `main`:

- branch: `handoff/p10-takeover-20260917-0954-msk`
- source `main` SHA at branch creation: `273a87b62f374807eb49332b0daa0d235c695fe0`
- source commit: `data: update company monthly earned-income reports`
- source commit timestamp: `2026-09-17T06:05:25Z` / approximately `09:05:25 MSK`

Important: automation was still active around this period. `main` may move immediately after this checkpoint. The replacement chat must re-fetch live state rather than assume `273a87b6` is still head.

---

## 1. CANONICAL RESUME ORDER

Always recover in this order:

`CURRENT.md → latest continuity → Memory Routing Index → task-specific canon/context → fresh generated artifacts → exact Actions/run evidence`

Do **not** treat prose memory, old checkpoints or old CI success as current production truth.

Current `CURRENT.md` read during this handoff:

- represented source state: `2026-09-17T04:17:37.674Z`
- points to continuity: `THE_HOLDING_MASTER_CONTINUITY_2026-09-17_041654_AUTO_49031330.md`
- current authority boundary: `execution authority = none`
- Security Sentinel: WATCH, Critical 0 / High 2 / Medium 74 at represented source state
- Learning READY; Proposal WATCH; Builder WATCH; Guardian WATCH

Latest continuity read during this handoff:

`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-17_041654_AUTO_49031330.md`

Its trigger/source boundary is:

- `49031330d36006cc7f0aef910d0fa6e45bd7bc00`
- commit: `fix(p10): declare continuity workflow-controller role`
- source time: `2026-09-17T07:16:54+03:00`

That continuity warns that several accounting artifacts predate its trigger boundary and therefore must be re-read live before production completion claims.

---

## 2. NON-NEGOTIABLE PROJECT LAWS

Preserve all of these during takeover:

### Authority

- `executionAuthority = none`.
- No wallet signing.
- No transaction execution.
- No autonomous capital movement.
- No claim/withdraw/settle action authority.
- No automatic methodology or policy mutation.
- No production authority expansion merely because an automation or proposal exists.

### Accounting

- Canonical Income Ledger is the sole factual earned-income recognition authority.
- APR/APY/reference generated income is analytics, not factual earned income.
- Opening balance is baseline, not current-period earned income.
- `UNKNOWN != 0`.
- Historical USD may only be admitted with factual historical evidence.
- No current-price backfill for historical events.
- No silent `$1` stablecoin assumption.
- Current claimable/unclaimed state is not itself period-income authority.
- Settlement must not duplicate income already recognized economically.

### Production proof

- `GREEN workflow != physically materialized production artifact`.
- PR CI green is not production closure.
- A repair is only production-green when live `main` plus real workflow/runtime behavior plus physical output evidence support it.

### Build discipline

- one primary objective at a time;
- no new layer without a demonstrated gap;
- prefer reuse/simplification;
- no duplicate writers / duplicate truth / orchestration loops;
- fix only the measured problem;
- capability grows faster than complexity; authority slower than intelligence.

---

## 3. ROADMAP POSITION

The currently relevant public→private roadmap remains:

- P6 supported-mechanism/new-reward-token reuse proof — **GREEN / closed**
- P7 heavy workflow profiling — **GREEN / closed**
- P8 measured reliability/performance repair — **GREEN / closed**
- P9 bounded Economic Graph / sensor closure — **GREEN / closed**
- P10 system-wide production acceptance — **ACTIVE**
- P11 cosmetics
- P12 pre-private cleanup/freeze
- P13 real pre-private checks
- P14 final public-state checkpoint / migration readiness
- P15 verified backup/export
- P16 public→private visibility change — **requires explicit owner confirmation**
- P17 post-private audit

Do not skip P10 merely because most individual engines are green. P10 is the factory-wide production acceptance phase.

---

## 4. WHAT WAS ALREADY CLOSED BEFORE THIS TAKEOVER

### P5 accounting tail

P5 was closed through merged PR #842.

Key conclusion: residual historical USD may legitimately remain explicit `UNKNOWN / unvalued-fail-closed` when no factual historical route can be proven. This is not automatically an engineering defect.

### P6 reusable mechanism proof

Merged PR #843:

`P6: prove supported mechanism new reward-token reuse end to end`

Proved the supported ve33 mechanism can ingest a non-base/new reward token without token-specific accounting logic. Generic mechanism identity and exact amount/event preservation are the intended architecture.

### P7 / P8

P7 profiling completed. P8 repair was merged through #844.

Measured Aerodrome historical vote reconstruction failures were repaired by bounded RPC failover/range logic. Exact-head canary proved large historical reconstruction stayed within budget. No accounting methodology or authority expansion.

### P9

P9 is materially GREEN.

Merged PR #845:

`P9: preserve vlCVX retained historical RPC provenance`

The repaired vlCVX/Votium → Curve Gauge Flow retained-history path now preserves historical RPC provenance rather than losing it on retained refresh. The verifier was not weakened.

Temporary PR #846 was a takeover/discoverability helper only and was closed without merge.

### PRE-P10 Tail A — BLUECHIP rare reward-token historical valuation

Temporary diagnostic PR #847 was closed **without merge** after exact historical investigation.

Exact tested boundary:

- accounting boundary: `2026-09-15T15:53:07.000Z`
- Base closing block: `51,349,120`
- unresolved BLUECHIP events: 2 (`veAERO NFT #64985` and `#69194`)

Historical routes tested:

- BLUECHIP → native Base USDC: no proven historical route
- BLUECHIP → AERO: no proven historical route
- BLUECHIP → WETH: no proven historical route
- therefore WETH → USDC → USD continuation not applicable

Preserved:

- `currentPriceUsed=false`
- `stablecoinPegAssumptionUsed=false`
- no production accounting mutation
- `executionAuthority=none`

Decision: exact token amounts/history remain in the Canonical Income Ledger; historical USD remains explicit `UNKNOWN / unvalued-fail-closed`. Do not add token-specific pricing code or arbitrary recursive routing merely to remove UNKNOWN cosmetically.

---

## 5. P10 — IMPORTANT MERGED REPAIRS ALREADY COMPLETED

### PR #848 — Stable Capital scheduler liveness

Merged: **yes**

Title:
`P10: re-register Stable Capital daily schedule`

Observed defect before repair:

- canonical `Update Stable Capital` writer had last materially published on 2026-09-06 (run #33, scheduled, success);
- workflow file still existed;
- daily schedule was declared;
- `main` and other schedules were active;
- writer had not been replaced.

Diagnosis: scheduler/workflow liveness, not Stable Capital accounting logic.

Minimal repair:

- cron moved from `05:37 UTC` to `05:41 UTC` to re-register/reactivate the scheduled workflow;
- one canonical writer preserved;
- no Stable Capital methodology change;
- no second scheduler/writer;
- no guard weakening;
- no wallet/capital authority.

Critical acceptance condition from #848:

**Do not call this defect GREEN merely because PR #848 merged or CI passed.**

Need a real `Update Stable Capital` scheduled run and physical fresh materialization on live `main` of all three canonical outputs:

- `companies/stable-capital-data.json`
- `companies/embedded-yield-ledger.json`
- `companies/stable-index-data.json`

This physical verification was one of the exact tasks being checked when this handoff was requested.

### PR #849 — continuity → CURRENT synchronization

Merged: **yes**

Title:
`fix(p10): keep CURRENT synchronized after continuity checkpoints`

Observed production gap:

- scheduled continuity writer successfully advanced `CONTINUITY.md` and created a new immutable checkpoint;
- `CURRENT.md` remained pointing at the previous checkpoint;
- cause: commits pushed with workflow token do not automatically wake downstream push workflows.

Repair:

- continuity workflow explicitly dispatches Project Memory Bootstrap after successfully publishing a continuity checkpoint;
- Project Memory Bootstrap remains the sole `CURRENT.md` writer;
- continuity writer remains bounded to continuity files.

Acceptance requirement:

- physical proof that a continuity checkpoint is followed by Project Memory Bootstrap and `CURRENT.md` resolves to the new continuity root.

### PR #850 — continuity workflow controller role declaration

Merged: **yes**

Title:
`fix(p10): declare continuity workflow-controller role`

Why needed:

- after #849, the continuity workflow legitimately performs a bounded workflow dispatch;
- Workflow Control Plane correctly classified that behavior as workflow-control;
- metadata still declared only `repository-writer`, producing structural no-new-debt failure.

Repair:

- declare the already-existing bounded role explicitly as `repository-writer, workflow-controller`.

No baseline widening, no new target, no new permission, no accounting/capital/methodology/transaction authority.

Current `CURRENT.md` already pointed to the #850-triggered continuity checkpoint when checked during this handoff, which is evidence that the chain has advanced. Still re-check live on takeover.

---

## 6. EXACT LIVE STATE OBSERVED IMMEDIATELY BEFORE THIS HANDOFF

At handoff branch creation, live `main` was:

`273a87b62f374807eb49332b0daa0d235c695fe0`

Commit:

`data: update company monthly earned-income reports`

Timestamp:

`2026-09-17T06:05:25Z`

This is important because the current P10 acceptance work was waiting for morning schedule windows and downstream physical materialization. A fresh monthly-report commit means the production data plane was actively moving after those windows.

However, **do not infer from this commit alone** that:

- Company #010’s exact scheduled workflow passed;
- Stable Capital’s repaired scheduler ran successfully;
- all expected Stable Capital outputs were physically refreshed;
- every P10 acceptance atom is green.

Each must be proved from the exact workflow/run and relevant file commit/content.

A later general Actions query during this handoff showed at least:

- `The Holding Reliability · Runtime Observer` run #171
- event: `schedule`
- conclusion: `success`
- head SHA: `273a87b62f374807eb49332b0daa0d235c695fe0`
- created: `2026-09-17T06:36:51Z`

This proves automation remained alive after the monthly report update, but it is not a substitute for the missing task-specific proofs below.

---

## 7. EXACT WORK THAT WAS IN PROGRESS WHEN OWNER REQUESTED THIS CHECKPOINT

The current chat had reached the scheduled P10 verification windows and was checking two concrete lanes:

### Lane A — Company #010

Expected daily/scheduled window mentioned in the active investigation: approximately **04:47 UTC**.

Goal:

- find the real `Update Company #010` / corresponding canonical workflow run after that schedule window;
- prove it was a natural schedule event, not merely manual dispatch;
- inspect conclusion and exact head SHA;
- then inspect the physical Company #010 output(s) that the workflow is supposed to materialize;
- confirm the files changed on `main` from the real run.

Do not call Company #010 green from a generic monthly report update without matching exact workflow and physical output evidence.

### Lane B — Stable Capital

Repaired expected schedule: **05:41 UTC** after #848.

Goal:

1. locate the first real post-#848 `Update Stable Capital` **scheduled** run;
2. verify `event=schedule`;
3. verify run conclusion;
4. identify exact head SHA / commit boundary;
5. inspect physical fresh materialization of:
   - `companies/stable-capital-data.json`
   - `companies/embedded-yield-ledger.json`
   - `companies/stable-index-data.json`
6. verify files are on live `main` and are attributable to the canonical writer path;
7. only then close the #848 P10 defect GREEN.

This is the most important immediate takeover task.

---

## 8. WHAT THE NEXT CHAT SHOULD DO FIRST — PRECISE ORDER

### Step 1 — re-anchor live truth

Re-fetch:

- `main` current SHA and latest commits;
- `intelligence/project-memory/CURRENT.md`;
- continuity file referenced by CURRENT;
- latest active/most recent PRs around P10;
- recent Actions/runs.

If `main` moved after `273a87b6`, treat this handoff as historical context only and anchor the new investigation to the newer SHA.

### Step 2 — verify Stable Capital scheduler repair physically

Priority #1.

Search exact workflow runs after `2026-09-17 05:41 UTC`.

Need evidence package:

- workflow name/path;
- run number/id;
- `event=schedule`;
- status/conclusion;
- run start/completion;
- head SHA;
- resulting commit if writer publishes;
- physical file timestamps/commit/content for the three canonical Stable Capital outputs.

Outcome classification:

- if real scheduled run + all three physical outputs are fresh and coherent → #848 production defect can be GREEN;
- if schedule run exists but publish failed → inspect exact failure, fix only demonstrated cause;
- if no schedule run exists after the re-registration window → #848 repair is not accepted; continue scheduler-liveness diagnosis without creating duplicate writer/cron machinery;
- if workflow green but files not materialized → treat as not closed.

### Step 3 — verify Company #010 scheduled lane

Find its real post-window scheduled run and physical output. Do not infer from aggregate/monthly reports.

### Step 4 — verify #849/#850 continuity chain end-to-end

Although CURRENT was already pointing at the #850-triggered continuity checkpoint during this handoff, verify current live chain:

continuity writer → immutable checkpoint → Project Memory Bootstrap → CURRENT updates to newest continuity root.

If this is now physically proven, mark that P10 continuity defect green.

### Step 5 — continue P10 system-wide acceptance

After the above concrete tails are closed, continue the production-acceptance sweep rather than opening P11 cosmetics early.

The purpose of P10 is to discover silent production gaps that local tests miss: stale schedules, writers not waking downstream workflows, green checks without materialization, broken liveness and stale roots.

---

## 9. P10 INTERPRETATION / OWNER-FACING STATUS

At the previous tracking point before today’s new evidence, P10 was described to the owner as roughly **~20%** complete. That was a human estimate, not a canonical machine metric.

Since then:

- #848 merged;
- #849 merged;
- #850 merged;
- CURRENT advanced to the newest continuity root;
- production monthly reports subsequently updated;
- runtime observer continued succeeding on schedule.

Therefore P10 is clearly further advanced than that old ~20% estimate, but **do not assign a new percentage until the two pending scheduled lanes (Stable Capital and Company #010) are freshly verified**.

Owner prefers concise tracking reports:

- 🟢 done
- 🟡 active + rough %
- ⚪ next

Explain technical state with simple factory/business analogies where useful.

A good current analogy:

> The main engines are built; P10 is the factory-wide inspection. It is deliberately finding timers, handoffs and conveyor belts that can silently stop even when each machine looks healthy in isolation.

---

## 10. ACTIVE / STALE PR WARNINGS

Recent relevant PRs:

- #850 — merged — continuity workflow-controller role
- #849 — merged — continuity → CURRENT dispatch
- #848 — merged — Stable Capital scheduler re-registration
- #847 — closed without merge — BLUECHIP diagnostic only
- #846 — closed draft — P9 takeover/discoverability helper only
- #845 — merged — P9 vlCVX retained historical RPC provenance
- #844 — merged — P8 Aerodrome vote-history RPC failover
- #843 — merged — P6 new reward-token reuse proof
- #842 — merged — P5 fail-closed valuation pending semantics

Do not resurrect old temporary diagnostic PRs as production candidates.

Repository also contains unrelated long-lived open PRs such as Dependabot/security or old handoff/checkpoint PRs. They are not the current P10 frontier unless fresh evidence says otherwise.

---

## 11. CURRENT ACCOUNTING SNAPSHOT FROM LATEST CONTINUITY

Useful resume context only; it predates current main and must be refreshed before claims.

Continuity snapshot reported:

- Accounting Coverage version: `0.13-supplementary-route-principal-isolation-accounting-mechanism-coverage-registry`
- mechanisms: 29
- reusable gaps: 0
- Canonical Income Ledger status: partial
- observed event count: 1641
- Company Monthly Reports companies: 10

Selected factual tracking:

- `aerodrome_veaero`: 8/8; current-month events 30; reusable gap no
- `velodrome_vevelo`: 4/4; current-month events 16; reusable gap no
- `frax_vefrax`: 3/3; current-month events 1132; reusable gap no
- `yieldbasis_veyb`: 4/4; current-month events 20; reusable gap no
- `beefy_cvxcrv`: 1/1; current-month events 9; reusable gap no
- `convex_vlcvx`: 4/4; current-month events 4; reusable gap no
- `convex_staked_cvxcrv`: 1/1; current-month events 0; reusable gap no
- `curve_vecrv`: 3/3; current-month events 8; reusable gap no

No reusable Coverage gap was reported by that continuity snapshot.

Again: refresh live artifacts before using these numbers as current state.

---

## 12. THINGS THE REPLACEMENT CHAT MUST NOT DO

- Do not call P10 closed because recent PRs merged.
- Do not call Stable Capital green without a natural scheduled run + physical outputs.
- Do not call Company #010 green from aggregate report activity alone.
- Do not add a second scheduler just because one scheduled lane appears missing.
- Do not create new accounting engines for unresolved token prices if existing generic mechanism is sufficient.
- Do not convert UNKNOWN to zero.
- Do not use today’s token price to fill historical USD.
- Do not weaken validation or freshness guards to make dashboards green.
- Do not start P11 cosmetics while a P10 production defect remains materially open.
- Do not change visibility/private state before P16 and explicit owner confirmation.
- Do not infer capital/execution authority from repository automation.

---

## 13. HOW TO REPORT TO ALEXANDER

Language: Russian by default.

Style requested by owner:

- concise;
- simple words;
- no unnecessary technical jargon;
- status with green/yellow/white markers;
- rough completion % only when useful and clearly approximate;
- can use business/factory analogy.

For “трекай” / “чекай”:

1. always do a new read-only live GitHub check;
2. inspect main, relevant PRs/branches, workflows/Actions/runs, generated artifacts/evidence, continuity/checkpoints and Router resume context;
3. never rely on prior answer as current truth.

---

## 14. OWNER REQUEST THAT CREATED THIS FILE

The owner explicitly requested an urgent detailed checkpoint in a GitHub branch so the parallel chat can take over if the current chat runs out of memory.

Therefore this document intentionally favors deterministic takeover detail over brevity.

No production/accounting/methodology/capital behavior was changed by this handoff itself.

`executionAuthority = none`

---

## 15. IMMEDIATE ONE-LINE RESUME

**Resume P10 by re-reading live main/CURRENT, then prove the post-#848 Stable Capital 05:41 UTC natural scheduled run and all three physical output files first; next prove Company #010 scheduled materialization; then confirm the #849/#850 continuity→CURRENT chain remains physically live before proceeding with the rest of P10.**
