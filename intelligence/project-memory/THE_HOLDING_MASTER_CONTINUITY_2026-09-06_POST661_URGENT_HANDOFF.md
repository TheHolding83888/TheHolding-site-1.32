# THE HOLDING — URGENT CHAT HANDOFF CHECKPOINT

Date: 2026-09-06
Purpose: preserve the exact live state so another chat can continue immediately without repeating the investigation.

## 0. Operating rule

Recover current truth in this order:
1. LIVE `main`
2. fresh physical production artifacts + exact workflow evidence
3. `intelligence/project-memory/CURRENT.md`
4. latest continuity checkpoint
5. this handoff as a precise historical anchor

Never treat a green workflow as equivalent to physical materialization. Never promote reference APR/APY/modelled income to factual earned income. `UNKNOWN != 0`.

User shorthand: when Alexander says **"трекай"**, inspect the whole GitHub surface, not only Actions: `main`, recent commits, open PRs, working branches, checkpoint/handoff branches, Actions/workflows, and fresh generated artifacts.

---

## 1. Fresh repository anchor at handoff creation

Repository: `TheHolding83888/TheHolding-site-1.32`

Fresh `main` HEAD at checkpoint creation:
- `4058b22a55afcc852610cc3c3a66292e0fe439b6`
- commit: `data: update reporting and canonical income ledger`
- committed to main at `2026-09-06T15:20:09Z`

Important: this means the post-#661 production Reporting writer **did physically publish** fresh Reporting / Canonical Income Ledger artifacts to `main`.

Immediately prior automatic continuity chain on main:
- `26a75bef9ae229229444358480ffdda108eb2343` — merge PR #661
- `04b6ef1a398a9b331823aec10485de335c0589bc` — Security memory
- `5c1c242d6747c89f85f3176a363dfd3406efcffd` — automatic continuity checkpoint at `2026-09-06T14:57:50Z`
- `f58c51c8796b039dfaa900f6372e73d9a0e7d1bd` — refresh current project bootstrap

So automatic checkpointing is working and nothing important depends only on chat memory.

---

## 2. Completed chain before the current blocker

### ✅ Lessons / Learning foundation
- PR #651 merged: verified engineering lesson candidates lane.
- PR #652 merged: bounded Cognitive → Learning recovery path.
- PR #655 merged: public git metadata privacy/redaction repair without weakening privacy guard.
- Formal cleanup of engineering lessons can remain later; do not let it distract from the current accounting objective.

### ✅ Defitea company-income isolation
- PR #653 merged: canonical ownership rule.
- Core law: factual income belongs only to its canonical company.
- `YieldRing.eth` and `05081966.eth` must **not** be added to Defitea earned income / cash flow.
- They may remain context/reference only where explicitly labelled non-additive.
- Cross-company reattribution is forbidden.

### ✅ Reporting contract alignment
- PR #656 merged: production Reporting guard aligned with Defitea ownership v0.2.

### ✅ August ve33 historical valuation / historical state capability
- PR #657 merged: historical AERO/VELO valuation uses historical canonical Market Data rather than today's token price.
- PR #658 merged: archive-capable historical RPC access for Base/Optimism proven; current reads and historical reads are routed appropriately.

### ✅ Historical RPC wired into production Reporting
- PR #660 merged.
- Production Reporting invokes the ve33 historical runner in normal build and safe rebuild paths.
- exact-head CI was green before merge.

### ✅ Reporting safe-writer runtime / race handling
- PR #661 merged at `2026-09-06T14:57:21Z`.
- Goal: avoid wasting the expensive historical accounting rebuild when `main` did not materially move; preserve full rebuild on a real race; give bounded runtime headroom.
- exact-head checks were green before merge, including heavy live ve33 canaries.

### ✅ Post-#661 physical Reporting publication
Fresh main commit `4058b22...` proves the Reporting writer physically published.

From the fresh `reporting/accounting-coverage.json` diff in that commit:
- generatedAt: `2026-09-06T15:19:39.100Z`
- canonical ledger event count increased `581 → 599`
- classified mechanism instances: 50
- reusable coverage gaps: **0**
- unmatched canonical events: **0**
- factual tracking proofs increased `2690 → 3032`

Important conclusion: the current main blocker is **no longer Reporting publication, archive RPC, or reusable mechanism coverage**.

---

## 3. Exact current blocker

Downstream workflow:
- `Update Company Monthly Reports`
- run id: `34041984674`
- run number: `142`
- event: `workflow_run`
- head: `4058b22a55afcc852610cc3c3a66292e0fe439b6`
- conclusion: **failure**

Steps:
- Checkout ✅
- Setup Node ✅
- Preflight monthly reporting contract ✅
- Build reference monthly scaffold ✅
- **Validate reference scaffold ❌**
- Canonical earned-income projection skipped
- earned-income validation skipped
- monthly snapshot commit skipped

Exact error:

`Error: Defitea August valued canonical evidence missing`

Thrown by:
`reporting/company-monthly-reports-validation.mjs`

The failing validator currently requires for Defitea August:
- `accruedEntitlement.eventCount > 0`
- `realisedCashFlow.eventCount > 0`
- both `accruedEntitlement.usd` and `realisedCashFlow.usd` finite

Do **not** simply weaken or delete the guard.

The next chat must determine whether this is:
1. a stale scaffold-validation assumption after the new historical ve33 evidence semantics, or
2. a real missing valuation / allocation in the fresh canonical ledger.

Evidence strongly suggests contract drift is plausible because:
- the production Reporting build itself passed all its accounting validations and physically published;
- `accounting-coverage.json` now shows August ve33 factual tracking materialized;
- at least one August ve33 mechanism now has factual period evidence with one valued event (`$0.89501102`) and a specific blocker `cross-month-boundary-requires-explicit-allocation` rather than no historical proof;
- another August ve33 route has factual tracking proof but zero period event, which is valid and must not be forced into fabricated income;
- reusable coverage gap count remains zero.

But verify against the fresh `reporting/income-ledger.json` / fresh generated scaffold before changing the validator.

---

## 4. Critical architecture / accounting laws to preserve

1. **Canonical Income Ledger is sole factual earned-income authority.**
2. Monthly Reports project canonical earned income; they do not create new income events.
3. Reference APR/APY / modelled generated income is analytics only.
4. `UNKNOWN != 0`.
5. Opening balance is not current-period income.
6. Claim / settlement does not create second income if entitlement was already recognised.
7. Later token price movement must not rewrite closed historical income.
8. Company ownership is exclusive; no cross-company double counting.
9. Do not sum overlapping evidence families merely to produce a prettier total.
10. Do not create a custom accounting engine per company. Protocol-specific evidence collectors are acceptable only when technically necessary; ownership, recognition, ledger, monthly projection and passport reporting stay common/canonical.
11. 29 reusable mechanisms / 50 classified instances and **0 reusable coverage gaps** means do not invent new accounting mechanisms "just in case".
12. No wallet/capital execution authority. No signing. No autonomous capital movement. No methodology mutation by data workflows.

---

## 5. Exact user objective / required sequence

Alexander's desired chain, in the recommended order:

### CURRENT — P0
1. Fix the **Company Monthly Reports downstream blocker** on fresh main, systemically.
2. Get `Update Company Monthly Reports` fully GREEN.
3. Require **physical commit of fresh `reporting/company-monthly-reports.json`** to main.

### NEXT — P0
4. Inspect fresh Defitea August in the physical monthly report.
5. Determine exact factual August earned income and evidence count from the Canonical Income Ledger projection.
6. Verify that `YieldRing.eth` and `05081966.eth` contribute **zero** to Defitea earned income.
7. Verify the Defitea Company Passport/site surface consumes the fresh physical monthly report and visually shows the corrected August amount / partial-completeness semantics correctly.

### NEXT — P1
8. Use the same canonical framework company × month across the remaining onchain companies.
9. Recover historical factual completeness where the underlying mechanism evidence already exists.
10. Only create/fix a protocol mechanism if a real concrete evidence gap appears. Do not add speculative engines.
11. Prove historical completeness by company/month, retaining `partial/unknown` where evidence truly cannot prove completeness.

### LATER
12. ICP estimated/reference layer — only after factual accounting is stable and explicitly separate from earned income.
13. Improve Passport / Index / visual explanation after data correctness is stable.
14. Finish formal Lessons/engineering-learning cleanup after this accounting block; engineering findings should still be captured as candidates during work.

Short chain:
**Monthly downstream fix → physical Defitea August → Passport proof → other companies × months → historical completeness → ICP → Passport/Index polish → Lessons cleanup.**

---

## 6. Important fresh artifact observations

Fresh Reporting materialization commit `4058b22...` changed physical accounting artifacts.

`reporting/accounting-coverage.json` fresh state includes:
- version `0.10-explicit-settlement-link-accounting-mechanism-coverage-registry`
- generatedAt `2026-09-06T15:19:39.100Z`
- canonical ledger event count `599`
- reusableCoverageGapCount `0`
- unmatchedCanonicalEventCount `0`

Historical ve33 August evidence is no longer simply "not tracked":
- one August route changed from `state-observed-not-factual-tracking` to `factual-tracking-no-period-event` with historical tracking proof;
- another changed to `factual-period-evidence`, eventCount `1`, valuedEventCount `1`, factualUsdSubtotal `0.89501102`, first boundary `2026-08-01T00:00:00.000Z`, last boundary `2026-09-01T00:00:00.000Z`, with blocker `cross-month-boundary-requires-explicit-allocation`.

Interpret carefully: a cross-month interval blocker is **not permission to arbitrarily assign the whole amount to August or September**. Allocation must follow existing canonical interval/month boundary rules.

---

## 7. Existing physical monthly report is stale relative to the new ledger

At handoff time the committed `reporting/company-monthly-reports.json` still has:
- generatedAt `2026-09-06T12:03:14.894Z`
- incomeLedger.generatedAt `2026-09-06T12:01:23.819Z`

This predates fresh Reporting ledger generation at `2026-09-06T15:19:39.100Z`.

Therefore **do not use the currently committed monthly report as proof that August recovery failed**. The downstream workflow failed before it could project and publish the new ledger.

This is the key distinction for the next chat.

---

## 8. Suggested next technical investigation

Start from fresh main `4058b22...` (or refetch if main moved).

1. Read fresh:
   - `reporting/income-ledger.json`
   - `reporting/accounting-coverage.json`
   - `reporting/ve33-accounting-evidence.json`
   - `reporting/company-monthly-reports.mjs`
   - `reporting/company-monthly-reports-validation.mjs`
   - `reporting/company-monthly-earned-income.mjs`
   - `reporting/company-monthly-earned-income-validation.mjs`
   - `.github/workflows/update-company-monthly-reports.yml`

2. Reproduce conceptually the run-142 sequence:
   `build reference scaffold → validate scaffold → project canonical earned income → validate canonical earned income → publish`.

3. Ask whether the **scaffold validator is incorrectly demanding post-projection/family completeness semantics before the canonical earned-income projection step**.

4. If yes, repair the validation contract at the correct layer, preserving fail-closed semantics. Do not simply turn missing USD into zero.

5. If no, identify exactly which Defitea August canonical event is unvalued/unallocated and fix at the evidence/ledger layer, not in the UI/monthly layer.

6. Use a focused PR branch and exact-head CI. Merge only when relevant checks are green.

7. After merge, wait for physical downstream materialization and inspect the resulting JSON + site.

---

## 9. Recent merged PR chain for quick recovery

- #651 Learning: verified engineering lesson candidates
- #652 Ops: bounded Cognitive → Learning recovery
- #653 Defitea: enforce native income ownership
- #655 Learning: public metadata redaction/privacy fix
- #656 Reporting: Defitea v0.2 guard alignment
- #657 ve33: August historical valuation
- #658 ve33: historical/archive RPC state failover
- #660 ve33: production historical RPC wiring
- #661 Reporting: bounded safe-writer runtime / expensive evidence reuse

Do not assume numbers beyond this list are current; refetch live GitHub.

---

## 10. User communication preferences

- Russian.
- Short and simple by default.
- Technical work can be deep under the hood; user-facing status should be compact.
- He prefers systemic solutions over patches and wants the assistant to choose the technically correct implementation order.
- Do not flood with SHA/check details unless useful.
- If everything is genuinely verified, concise confirmation is preferred.

---

## 11. Definition of success for the immediate block

Do not call Defitea August closed until all are true:

- fresh production Reporting physically published ✅ already achieved post-#661
- Company Monthly Reports workflow GREEN ⬜
- fresh monthly report physically committed from the fresh ledger ⬜
- Defitea August canonical earned-income amount is explicit and auditable ⬜
- no foreign-company income is attributed to Defitea ⬜ verify on fresh projection
- completeness/partial status is truthful ⬜
- Company Passport/site displays the same fresh truth ⬜

Only then proceed systematically to other companies.

---

## 12. Checkpoint branch safety

This branch is a handoff/checkpoint only:
`handoff/chat-checkpoint-20260906-post661-urgent3`

No production code was changed by this checkpoint.
Do not merge this handoff into `main` unless there is an explicit reason; use it as durable recovery context.
