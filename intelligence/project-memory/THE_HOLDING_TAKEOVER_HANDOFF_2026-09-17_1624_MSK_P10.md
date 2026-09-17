# The Holding — Urgent Takeover Handoff

**Checkpoint:** 2026-09-17 16:24 MSK  
**Scope:** P10 — system-wide production acceptance  
**Purpose:** exact operational takeover for a parallel/new chat when current chat context is near exhaustion.  
**Authority:** read/write repository work may continue under existing low-risk standing authorization; `executionAuthority = none`. Do not expand wallet/capital/security/methodology authority.

---

## 0. PRIMARY TAKEOVER RULE

Recover current truth in this order and do not trust this handoff over fresher evidence:

1. `LIVE CURRENT.md` / current canonical project-current file on `main`
2. latest continuity checkpoint
3. Routing Index / current task canon
4. fresh GitHub `main`
5. fresh Actions/workflow runs
6. fresh generated production artifacts/evidence
7. this handoff only as continuity/context

Conflict priority remains:

1. live GitHub `main`
2. fresh generated production JSON / exact workflow evidence
3. subsystem machine-readable state
4. latest continuity checkpoint
5. task canons/context via Routing Index
6. older handoffs/project memory

Do not declare a workflow/problem GREEN merely because a GitHub Action succeeded. Require physical production evidence when the acceptance contract requires it.

---

## 1. ROADMAP — STRICT ORDER

Owner-approved roadmap file:

`intelligence/project-memory/THE_HOLDING_PUBLIC_GREEN_TO_PRIVATE_ROADMAP_2026-09-13.md`

Order:

- P0 durable roadmap + recovery
- P1 current red frontier Learning Loop
- P2 meaningful red Actions
- P3 Company #010 / Cypher stability
- P4 factual accounting tails
- P5 universal historical reward-token valuation
- P6 supported mechanism/new reward-token reuse proof
- P7 heavy workflow profiling
- P8 reliability/performance simplification only if profiling proves bottleneck
- P9 bounded Economic Graph/sensor closure
- **P10 system-wide production acceptance — CURRENT FRONTIER**
- P11 bounded cosmetic/current-state package only after P1–P10 GREEN
- P12 cleanup/freeze
- P13 real pre-private checks
- P14 final public-state checkpoint/readiness GREEN
- P15 full verified backup/export
- P16 visibility public→private — **OWNER CONFIRMATION REQUIRED**
- P17 post-private audit

Do **not** open P11 before P10 is genuinely evidence-closed.

---

## 2. HARD INVARIANTS

- Canonical Income Ledger is the sole factual earned-income recognition authority.
- Reference APR/APY/reference-generated income = analytics, not factual period income.
- Opening balance = baseline, not current-period income.
- `UNKNOWN != 0`.
- Settlement / claim / reset / withdrawal / receipt is not second income if already recognized.
- `GREEN workflow != physical production artifact`.
- No new architecture/layer unless a real gap requires it.
- One primary objective at a time.
- Prefer reusable/systemic fixes over token-specific patches.
- Capability > complexity.
- Authority grows slower than intelligence.
- No duplicate source of truth or duplicate orchestration loop.
- Do not fix old historical RED merely to make dashboards green.
- Execution/capital authority remains `none`.

---

## 3. P5–P9 ALREADY CLOSED — DO NOT REOPEN WITHOUT FRESH EVIDENCE

### P5
Closed through PR #842 with fail-closed valuation semantics. Historical values remain explicit `UNKNOWN` where proof is unavailable.

### P6
PR #843 merged 2026-09-16. Proved supported ve33 mechanism can ingest non-base/new reward token end-to-end without token-specific accounting. Exact token amounts preserved; historical USD fails closed where unsupported.

### P7
Profiling identified Aerodrome historical RPC bottleneck.

### P8
PR #844 merged 2026-09-16. Fixed Aerodrome Voter historical reconstruction failover:
- 413/403/429 handling
- range shrink only for range/size failures
- immediate provider failover on auth/rate-limit class

Canary rebuilt roughly 99k Voter events / ~950 txs; historical reconstruction ~3m09s; full job <20m.

### P9
PR #845 merged 2026-09-16. Fixed retained historical RPC provenance in vlCVX/Votium → Curve Gauge Flow after fallback; no false fresh-RPC provenance.

PRE-P10 diagnostic PR #847 was intentionally closed unmerged. It proved two BLUECHIP historical events lacked a proven historical Slipstream valuation route and correct closure is token amounts + historical USD `UNKNOWN / unvalued-fail-closed`.

---

## 4. P10 STATUS — HIGH LEVEL

P10 was approximately **96–98%** before this urgent handoff, but it is **NOT GREEN**.

Already proven/closed inside P10:

### Company #010 / Cypher
A real natural scheduled run occurred 2026-09-17 and physically wrote fresh state to `main`.

Key proof from prior work:
- workflow: `The Holding · Company #010 Onchain State`
- natural schedule run succeeded
- physical state commit on main: `d6d9da38b03f560eb98f7814d37c5bcfbdeb43d4`
- commit message: `companies: refresh complete Cypher state`
- around 12:46:58 MSK

Treat Company #010 P10 tail as GREEN unless fresh evidence contradicts it.

### Continuity → CURRENT
PR #849 fixed continuity writer so successful continuity checkpoint explicitly dispatches Project Memory Bootstrap; GitHub token pushes alone do not trigger downstream push workflows.

PR #850 declared continuity writer’s existing `workflow-controller` role alongside repository-writer without weakening baseline.

After #851, continuity chain worked:
- merge #851 → continuity checkpoint physical commit
- Project Memory Bootstrap dispatched
- CURRENT caught up

Treat chain as GREEN unless fresh live drift appears.

### Accounting/reporting prior healthy snapshot
Earlier live audit found:
- 10 companies
- 50 mechanisms
- 29 unique types
- 0 unclassified
- 0 reusable coverage gaps
- Canonical Income Ledger 1641 factual events

However **later on 2026-09-17 a fresh accounting coverage run showed 1 reusable coverage gap**, tied to Company #010 / HyperLend. This is the current new P10 tail and must be resolved from fresh evidence; do not rely on older zero-gap snapshot.

### Learning Loop
Earlier fresh checks on 2026-09-17 showed successful real runs and CURRENT-aligned metrics:
- 25 active cases
- 294 remembered
- 81 Brain observations
- no expansion of execution authority

Recheck live if materially used, but no known blocker at handoff.

---

## 5. STABLE CAPITAL — IMPORTANT OPEN ACCEPTANCE TAIL

Historical problem:
- `Update Stable Capital` canonical writer had not materially published since 2026-09-06.
- workflow/schedule existed, while other repository schedules worked.
- changing cron in PR #848 did **not** revive natural scheduled execution.
- this localized defect to Stable Capital workflow registration/liveness rather than repo-wide Actions.

PR #851 merged 2026-09-17 around 13:14:51 MSK.

Architecture of #851:

### Retired registration tombstone
Old `.github/workflows/update-stable-capital.yml` retained as read-only retired Actions registration:
- name `Update Stable Capital · Retired Registration`
- `workflow_dispatch` only
- no schedule
- `permissions: contents: read`
- no stable engine/writer steps
- no canonical output refs
- separate concurrency group

### New active workflow
New `.github/workflows/update-stable-capital-scheduled.yml`:
- name `Update Stable Capital`
- `workflow_dispatch`
- cron `41 5 * * *`
- `contents: write`
- concurrency `update-stable-capital`, cancel false
- same Stable Capital engine / Embedded Yield interval builder / Stable Index bridge
- same three canonical outputs
- Control Plane metadata preserved

Exact merge commit recorded during repair:
`95850437ab3eb42aae3532bf2e504ebb4d99afb2`

Post-merge continuity commit observed:
`1ac274d7a3884a75b1ceccabb8ebadd278eec660`

### Acceptance requirement — DO NOT CHEAT
Because #851 merged after the 2026-09-17 cron window, the first true future natural schedule opportunity is:

**2026-09-18 05:41 UTC = 08:41 MSK**

P10/Stable Capital cannot be called GREEN until:

1. NEW active workflow has a real `event=schedule` run after that window, and
2. all three files physically refresh on `main`:
   - `companies/stable-capital-data.json`
   - `companies/embedded-yield-ledger.json`
   - `companies/stable-index-data.json`

Manual dispatch does **not** substitute for scheduler-liveness proof.

If natural schedule occurs but files do not materially refresh, determine whether engine correctly no-op’d or remained stale. Acceptance contract currently expects physical fresh materialization.

If natural schedule does not occur after the next window plus ordinary GitHub scheduling delay, continue P10 scheduler diagnosis. Do not jump to P11.

---

## 6. NEW OPEN TAIL DISCOVERED JUST BEFORE THIS HANDOFF — HYPERLEND / REWARDS

This is the most important immediate continuation item.

### Fresh symptom
A fresh `accounting-coverage.json` / accounting completeness result on 2026-09-17 showed:

**1 reusable coverage gap**

The gap was localized to Company #010 / **HyperLend**.

Earlier state had 0 reusable coverage gaps, so this is a fresh production drift/timing problem, not an old accepted historical UNKNOWN by default.

### What is already known
There is a dedicated HyperLend proof path requiring a real embedded lending-interest measurement based on liquidity-index semantics. The system is already designed to support this mechanism; do **not** invent a new accounting layer.

Canonical Rewards workflow:

`.github/workflows/update-company-rewards.yml`

Workflow name:

`Update Company Rewards`

Relevant trigger configuration confirmed from live `main`:

```yaml
on:
  schedule:
    - cron: '07 5 * * *'
  workflow_dispatch:
  workflow_run:
    workflows:
      - "Update Company #010 · Cypher Production State"
      - "Update ICP NNS Rewards"
    types: [completed]
    branches: [main]
```

The job guard allows successful same-repo main workflow_run events and excludes PR/PR-target events.

The Rewards workflow explicitly contains:

- `Project Company #010 HyperLend rewards from canonical state`
- script `rewards/company-010-hyperlend-rewards-overlay.mjs`
- it expects a canonical Rewards source with route `hyperlend-khype`
- reward state `Compounded`
- `claimableApplicable=false`
- embedded Rewards row with `usdValueIncludedInClaimableTotal=false`

Therefore the architecture already expects correct HyperLend embedded-income semantics.

### Timing evidence already observed
Company #010 state refreshed on 2026-09-17 around 12:46 MSK.

At the time of investigation, `companies/rewards-data.json` appeared to have last been physically published roughly the prior day (~2026-09-16 around 13:13 MSK), while fresh Cypher state was newer.

That suggested a likely synchronization/materialization gap:

`Cypher state refreshed` → expected `Update Company Rewards` child run → expected fresh `rewards-data.json`

The workflow definition trigger name matches the source workflow exactly, so a simple typo in `workflow_run.workflows` was ruled out.

### CURRENT UNFINISHED DIAGNOSTIC
Immediately before this urgent handoff, the active task was to distinguish:

A. `Update Company Rewards` did **not start** after the fresh Company #010 run

vs

B. `Update Company Rewards` **started but failed / skipped / completed without publishing fresh rewards**

Do not patch until this is proven.

### Live Actions clue immediately before handoff
At ~15:48 MSK (12:48 UTC), fresh accounting/reconciliation workflows were still running and writing completeness/reconciliation materializations. A run visible just before handoff:

- `Update Accounting Reconciliation Watch`
- run id `35223270729`
- event `workflow_run`
- conclusion `success`
- created `2026-09-17T12:48:49Z`
- head SHA `d00f7f6c971b09b6e8f8820e8bfdde24b17eb327`
- head commit message `data: update historical accounting completeness map`

This confirms the repo was actively processing accounting follow-on workflows during diagnosis.

### Immediate takeover procedure for HyperLend
Do these steps in order:

1. Fetch current `main` HEAD.
2. Fetch newest workflow runs filtered by recent time / inspect runs around fresh Company #010 completion.
3. Find the exact Company #010 run that wrote the fresh Cypher state.
4. Determine whether an `Update Company Rewards` run exists immediately after it with `event=workflow_run`.
5. If it exists:
   - inspect conclusion
   - inspect jobs and the step `Project Company #010 HyperLend rewards from canonical state`
   - inspect job logs if failed/skipped
   - inspect physical `companies/rewards-data.json` on the corresponding/newer `main`
6. If it does not exist:
   - diagnose workflow_run orchestration/registration/liveness
   - do **not** add a second writer
   - prefer a bounded handoff/dispatch fix analogous to existing orchestration rules only if evidence supports it
7. Re-run/re-materialize only within normal repository authority; do not use manual success as substitute if scheduler/trigger liveness itself is the acceptance target.
8. Recheck fresh accounting coverage after Rewards is materially fresh.
9. Acceptance for this tail should restore `reusable coverage gaps = 0` **only if factual production state supports that**. Do not coerce the metric.

Likely intended repair shape, **only if diagnosis proves orchestration failure**:

- keep `Update Company Rewards` as the sole canonical writer
- fix the handoff/trigger between existing Company #010 writer and Rewards
- no duplicate source of truth
- no new accounting semantics
- no authority expansion

If instead Rewards did run and the HyperLend step failed, fix the minimal generator/projection defect proven by logs.

---

## 7. REMAINING P10 SWEEP AFTER HYPERLEND

After HyperLend/Rewards is resolved or accurately classified, continue the P10 sweep without opening P11:

### Rewards / Lifecycle
Check:
- latest `Update Company Rewards`
- any lifecycle/settlement/accounting downstream consumers
- physical Rewards artifact freshness
- no duplicate recognition
- no `UNKNOWN→0` coercion

### Cognitive / Learning / Release coherence
Check fresh runs/artifacts for:
- Learning Loop
- Cognitive Release Coherence
- Grounded Brain / ChatGPT Bridge where relevant
- Decision Memory / proposals if production acceptance depends on them

Acceptance principles:
- system may be WATCH while functioning correctly
- `executionAuthority` must remain `none`
- no unauthorized production mutation path

### Repository Integrity / Control Plane
Check fresh:
- Workflow Control Plane
- Workflow Definition Diff Guard
- repository hygiene
- authority boundary
- frozen baseline / topology / fan-out debt checks

Do not weaken guards to make a PR pass.

### Economic Graph / Sensors
P9 itself is closed, but P10 acceptance should verify current production graph/sensor flows are still healthy and materially present.

### Continuity / CURRENT final pass
At end of any P10 repair:
- verify continuity checkpoint physically exists
- verify Project Memory Bootstrap ran
- verify CURRENT references fresh state
- don’t claim chain green from workflow status alone

---

## 8. PR / CHANGE RULES FOR TAKEOVER CHAT

For any new fix:

1. Re-read latest `main` and CURRENT before mutation.
2. Create a dedicated branch from exact current `main`.
3. Make the smallest bounded change that fixes the proven defect.
4. Preserve existing source-of-truth ownership.
5. Preserve authority boundary.
6. Run exact-head checks.
7. Require relevant Control Plane / definition / hygiene guards GREEN.
8. Merge only after exact-head proof and only if low-risk under standing authorization.
9. Verify physical production result on `main` after merge.
10. Verify continuity → CURRENT afterward if the change is material to continuity.

Do not merge speculative fixes.

---

## 9. PREVIOUS RELEVANT PRS / COMMITS

- PR #842 — P5 fail-closed historical valuation closure
- PR #843 — P6 supported/new reward-token reuse proof
- PR #844 — P8 Aerodrome historical RPC failover/performance repair
- PR #845 — P9 historical RPC provenance repair
- PR #847 — diagnostic only, closed unmerged
- PR #848 — initial Stable Capital schedule nudge; insufficient
- PR #849 — continuity→Project Memory Bootstrap explicit dispatch
- PR #850 — continuity workflow controller-role declaration
- PR #851 — Stable Capital fresh workflow registration architecture; merged

Stable Capital #851 merge SHA:
`95850437ab3eb42aae3532bf2e504ebb4d99afb2`

Post-#851 continuity physical commit observed:
`1ac274d7a3884a75b1ceccabb8ebadd278eec660`

Company #010 fresh physical state commit:
`d6d9da38b03f560eb98f7814d37c5bcfbdeb43d4`

Fresh accounting follow-on head observed during latest diagnosis:
`d00f7f6c971b09b6e8f8820e8bfdde24b17eb327`

Always prefer fresher `main` over these SHAs.

---

## 10. WHAT NOT TO DO

- Do not start P11 because P10 “looks almost done.”
- Do not mark Stable Capital green before the real 2026-09-18 natural cron + three physical files.
- Do not treat a manual dispatch as scheduler proof.
- Do not create a second Rewards writer.
- Do not alter accounting methodology just to erase a HyperLend gap.
- Do not convert unresolved values to zero.
- Do not expand `executionAuthority`.
- Do not reopen P5–P9 absent new evidence.
- Do not optimize heavy workflows unless measured evidence requires it.
- Do not weaken Workflow Definition Diff Guard / Control Plane.
- Do not make public→private visibility change before explicit owner confirmation at P16.

---

## 11. USER COMMUNICATION STYLE

Alexander prefers concise Russian status reports.

Use:

- 🟢 сделано
- 🟡 делается + approximate %
- ⚪ следующее

Explain in simple business terms, not implementation jargon, unless technical detail is necessary.

When he says `трекай`, do a fresh read-only live check of:

- `main`
- relevant active branches / PRs
- Actions/workflows/runs
- fresh generated artifacts/evidence
- continuity/checkpoints
- current Router resume context

Do not give stale memory as live status.

---

## 12. EXACT TAKEOVER START ORDER

**Start here:**

1. Read latest CURRENT on `main`.
2. Read latest continuity checkpoint.
3. Read current Routing Index / P10 canon.
4. Fetch current `main` HEAD.
5. Inspect the exact fresh Company #010 run and its downstream `Update Company Rewards` run.
6. Resolve/classify the HyperLend reusable coverage gap from evidence.
7. Re-run fresh accounting coverage/reconciliation evidence after any legitimate materialization.
8. Sweep remaining Rewards/Lifecycle → Cognitive/Release → Control Plane/Integrity → Economic Graph.
9. Leave Stable Capital OPEN until 2026-09-18 08:41 MSK natural cron evidence + all three physical artifacts.
10. Only when all P10 acceptance tails are physically proven GREEN, move to P11.

---

## 13. TAKEOVER SUMMARY IN ONE PARAGRAPH

The system is near the end of P10. Company #010 natural scheduling and continuity→CURRENT are already proven. Stable Capital registration was rebuilt in PR #851 but cannot be finally accepted until the first new natural cron on 2026-09-18 08:41 MSK physically refreshes all three canonical Stable Capital outputs. A **new P10 tail appeared today**: fresh accounting coverage reports one reusable gap tied to Company #010 HyperLend. The canonical Rewards workflow already contains the HyperLend projection and is configured to trigger after the Company #010 state workflow, so the immediate job is to prove whether that child Rewards run failed to start or started but failed/skipped/did not publish. Fix only the proven failure mode, preserve the single Rewards writer and all accounting/authority invariants, then finish the remaining P10 production sweep. Do not open P11 before this is closed.
