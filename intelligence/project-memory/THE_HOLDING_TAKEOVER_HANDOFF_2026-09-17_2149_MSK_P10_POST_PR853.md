# THE HOLDING — URGENT TAKEOVER HANDOFF
## P10 production acceptance · post-PR #853

Created: **2026-09-17 21:49 MSK (UTC+3)**  
Branch: `checkpoint/p10-takeover-20260917-2149-msk`  
Branch base / live-main snapshot used for this handoff: **15bc95a4a6e0789966152e3a0810eb2500d34bcb**  
Repository: `TheHolding83888/TheHolding-site-1.32`  
Authority: continuity / repository work only  
**executionAuthority = none**

> This is an urgent human-readable takeover checkpoint for the next ChatGPT work session. It is not a replacement for live truth. At resume, fresh `main`, generated artifacts and exact Actions evidence outrank this file.

---

## 0. OWNER INSTRUCTION / WHY THIS FILE EXISTS

The owner explicitly asked for a **detailed emergency checkpoint in a GitHub branch** because the current chat has started hanging and another parallel chat must be able to take over immediately when context is exhausted.

Default owner working language: **Russian**.  
Preferred status style: concise, simple, with `🟢 done / 🟡 in progress + approximate % / ⚪ next`.

When owner says **«трекай» / «чекай»**, perform a fresh **read-only live check** of:
- `main`;
- active/relevant branches and PRs;
- workflows / Actions / runs;
- fresh generated artifacts/evidence;
- continuity/checkpoints;
- current Router/resume context.

Canonical recovery order:

`CURRENT.md → latest continuity → Routing Index → task-specific canon/context → fresh live artifact → exact evidence`

Do not rely on this checkpoint instead of fresh live evidence.

---

## 1. NON-NEGOTIABLE PROJECT BOUNDARIES

- **executionAuthority = none**.
- No wallet signing, claiming, transaction execution, autonomous capital movement, automatic methodology/policy mutation.
- Routine low-risk repository work may continue through normal verified PR/merge/production proof under the owner's standing authorization.
- Stop for explicit owner confirmation at material capital / authority / security / methodology / destructive boundaries.
- **P16 public→private visibility change requires explicit owner confirmation.** Do not cross it automatically.
- One primary objective at a time.
- No new layer without a real gap.
- Prefer reuse/simplification over parallel machinery.
- No duplicate truth, writer, or orchestration loop.
- `GREEN workflow != physically materialized production artifact`.
- `UNKNOWN != 0`.
- Canonical Income Ledger remains the sole factual earned-income authority.

---

## 2. ROADMAP POSITION AT TAKEOVER

Known closed before this handoff:
- **P5 — closed** (merged #842).
- **P6 — closed** (merged #843 generic reward-token reuse proof).
- **P7 — closed**.
- **P8 — closed** (merged #844; Aerodrome historical vote reconstruction reliability).
- **P9 — materialized GREEN / closed**.
  - BLUECHIP historical reward valuation tail was validly closed **UNKNOWN / unvalued-fail-closed** after historical route checks; no current-price backfill and no fake stablecoin assumption.

Current primary objective:
- **P10 — system-wide production acceptance — ACTIVE.**

Later sequence remains:
- P11 cosmetics
- P12 pre-private cleanup/freeze
- P13 real pre-private checks
- P14 final public-state checkpoint / migration readiness
- P15 verified backup/export
- P16 public→private visibility change **only with explicit owner confirmation**
- P17 post-private audit

Do not skip ahead while P10 has factual production gaps.

---

## 3. WHAT HAPPENED IMMEDIATELY BEFORE THIS CHECKPOINT

### 3.1 PR #853 — merged

PR #853 title / merge commit:

`P10: align Company #010 Rewards token-strip parity with measured rows (#853)`

Merge commit:

`a18e79669b8a7b212eea06b97310262d9b928973`

Merge/commit time:
- `2026-09-17T17:40:43Z`
- **20:40:43 MSK**

Core fix:
- Company #010 Rewards validation previously hard-coded the measured token strip to require `AERO`, `VELO`, `WHYPE`, `USDC` even when a direct ve route had no actual economic row for a base token.
- #853 changed token-strip parity to follow **actual economic rows only**.
- `WHYPE` and `USDC` remain required for Project X rows.
- Aerodrome/Velodrome token inclusion is derived from actual claimable rows or positively-valued Compounded rows.
- This avoids fabricating an economic token solely to satisfy presentation parity.

Changed files in merge commit:
- `.github/workflows/update-company-rewards.yml`
- `intelligence/reliability/rewards-scheduler-workflow-definition-proof.mjs`

### 3.2 PR #853 CI / push evidence

At the PR stage, profile/protection workflows were green except an old P6 guard that still reported the already-known reusable accounting gap. It was not a new #853 regression.

After merge, exact push evidence includes:

**Update Company Rewards**
- workflow run id: **35254190780**
- run number: **150**
- event: `push`
- head SHA: `a18e79669b8a7b212eea06b97310262d9b928973`
- status: `completed`
- conclusion: **success**
- created: `2026-09-17T17:40:46Z`
- updated: `2026-09-17T17:56:46Z`

Other exact push checks seen on the same merge SHA:
- The Holding Production Boundary Guard — success
- The Holding Reliability · Workflow Control Plane — success
- The Holding · Continuity Checkpoint — success

### 3.3 Physical Rewards materialization after #853 — IMPORTANT

A real production commit touched `companies/rewards-data.json` after the merge:

`ee35c6650220bb11bb204f3699b21028fea1e065`

Commit message:

`data: update company accrued rewards`

Timing:
- author time `2026-09-17T17:52:22Z`
- commit time `2026-09-17T17:56:41Z`
- **20:56:41 MSK**

This is materially stronger than merely green PR CI: the canonical Rewards writer actually ran and physically updated the production artifact on `main`.

Therefore, for #853 itself, the next session should NOT repeat the question “did Update Company Rewards actually run?” — yes, it did, and `rewards-data.json` was physically materialized.

However, do **not** automatically conclude that every downstream accounting reusable gap is closed from this fact alone. Re-read the latest accounting coverage / ledger artifacts after this materialization.

---

## 4. POST-#853 CASCADE OBSERVED ON MAIN

Fresh live `main` at handoff capture:

`15bc95a4a6e0789966152e3a0810eb2500d34bcb`

Commit message:

`data: update historical accounting completeness map`

Commit time:
- `2026-09-17T18:44:30Z`
- **21:44:30 MSK**

Recent production cascade after #853 included at least:

1. `ee35c665...` — `data: update company accrued rewards` — physical Rewards materialization.
2. `e635cfcba09d5222e5d7c778d7b80847bfb930ee` — `data: update reporting and canonical income ledger`.
3. `b53fb13efc59eeb9d95c4a269fc2dcf47e4e9fe1` — `data: update company monthly earned-income reports` at `2026-09-17T18:43:39Z`.
4. `1faf9c9a40f46fb6b32e5581758833c8cf7d7bb1` — `data: update accounting reconciliation watch`.
5. `15bc95a4a6e0789966152e3a0810eb2500d34bcb` — `data: update historical accounting completeness map` at `2026-09-17T18:44:30Z`.

This means the repo did not stop at merge/CI: downstream reporting/ledger machinery continued to run and publish after #853.

Still, acceptance must be based on the exact current JSON state, not inferred from commit names.

---

## 5. CURRENT / CONTINUITY STALENESS WARNING

At this takeover, live `intelligence/project-memory/CURRENT.md` still represented canonical source state:

`2026-09-17T17:41:21.077Z`

and pointed to:

`THE_HOLDING_MASTER_CONTINUITY_2026-09-17_174128_AUTO_9312f40b.md`

That automatic checkpoint was triggered by #853 merge and explicitly carried a **PRE-MATERIALIZATION WARNING**.

Its snapshot still showed:
- Accounting Coverage generated at `2026-09-17T16:11:18.858Z`
- reusable gaps: `1`
- diagnostic frontier: HyperLend mechanism for Company #010

But this checkpoint predates the real `ee35c665...` Rewards materialization and the later ledger/reporting cascade.

Therefore:
- treat that continuity as a resume anchor only;
- on takeover, re-read fresh machine artifacts before deciding whether the HyperLend reusable gap survived or disappeared.

Do not let stale CURRENT/continuity override later live `main` data.

---

## 6. STABLE CAPITAL P10 TAIL — STILL NOT GREEN AS OF HANDOFF

Earlier P10 defect:
- canonical `Update Stable Capital` writer had last materially published on **2026-09-06**.
- PR #848 (`P10: re-register Stable Capital daily schedule`) was merged on 2026-09-16.
- Minimal fix changed cron to force GitHub scheduled-workflow re-registration.
- expected schedule after #848: `41 5 * * *` = **05:41 UTC / 08:41 MSK**.
- expected physical outputs:
  - `companies/stable-capital-data.json`
  - `companies/embedded-yield-ledger.json`
  - `companies/stable-index-data.json`

Important fresh check at this handoff:

Commit history for `companies/stable-capital-data.json` still shows the latest materialization as:

`4785c5f77e49ec1209437b00f46fa8c67f7a323b`

Commit message:

`Publish Monetra verified Stable Performance`

Date:

`2026-09-06T09:42:28Z`

No newer physical commit for this file was visible as of the handoff snapshot.

**Conclusion:** Stable Capital must NOT be called GREEN yet. The scheduler re-registration fix may be merged, but its required production closure has not materialized in `stable-capital-data.json` as of this checkpoint.

Next session should investigate exact recent `Update Stable Capital` Actions runs after #848:
- whether the natural scheduled run fired;
- whether it failed/skipped/no-op;
- exact job/step/log reason;
- whether the writer attempted all three expected outputs;
- whether any condition prevents commit even though schedule fired.

Do not create a second writer or parallel Stable Capital path. Diagnose and repair the existing canonical writer/liveness path minimally.

---

## 7. HYPERLEND / REUSABLE ACCOUNTING GAP — EXACT TAKEOVER RULE

Before #853 materialization, the latest automatic continuity showed the highest-value reusable coverage gap:

`hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d`

with:
- factual tracking `0/1`
- reference-only `1`
- known productive value about `$308.77`

PR #853 fixed a Rewards token-strip parity condition and then the Rewards writer physically materialized.

At this handoff, the post-materialization accounting artifacts have **not yet been fully re-read in this chat** to determine whether reusable gap count moved from `1` to `0`.

Therefore the next session must:
1. locate the freshest accounting mechanism/coverage artifact on live `main`;
2. read its `generatedAt` and make sure it is later than `ee35c665...` / later production cascade;
3. inspect reusable gap count and exact HyperLend mechanism state;
4. cross-check Canonical Income Ledger and company monthly report output;
5. only then decide if this P10 sub-tail is GREEN.

Do not infer closure merely because downstream workflows ran.

---

## 8. BLUECHIP / HISTORICAL USD TAIL — DO NOT REOPEN WITHOUT NEW EVIDENCE

Earlier P9 diagnostic for two BLUECHIP events on Base:
- accounting boundary: `2026-09-15T15:53:07.000Z`
- Base closing block: `51,349,120`
- unresolved events: veAERO NFT #64985 and #69194

Historical routes tested:
- BLUECHIP→native Base USDC: no proven historical route
- BLUECHIP→AERO: no proven historical route
- BLUECHIP→WETH: no proven historical route

Preserved:
- `currentPriceUsed=false`
- `stablecoinPegAssumptionUsed=false`
- no accounting mutation
- executionAuthority=none

Correct status: exact token events/history remain, historical USD **UNKNOWN / unvalued-fail-closed**.

This is a valid closure, not an error to “fix” with guessed prices. Reopen only if genuinely new historical evidence appears.

---

## 9. WHAT THE NEXT CHAT SHOULD DO FIRST

Do this in order, with fresh live reads:

### A. Re-establish truth
1. Fetch fresh `main` head — it may be newer than `15bc95a...`.
2. Read live `CURRENT.md`.
3. Read the latest continuity only if CURRENT still points to it.
4. Follow Routing Index for P10 task-specific canon.
5. Check open PRs / active branches newer than this handoff.

### B. Close the #853 downstream question
6. Treat #853 merge and Rewards production run as proven:
   - merge `a18e796...`
   - Update Company Rewards run #150 / id `35254190780` success
   - physical rewards commit `ee35c665...`
7. Re-read freshest accounting coverage artifact and Canonical Income Ledger.
8. Determine whether HyperLend reusable gap is now `0` or still present.
9. If still present, diagnose the exact remaining semantic/mechanism gap rather than adding token-specific special casing unnecessarily.

### C. Stable Capital
10. Query recent exact `Update Stable Capital` workflow runs since #848 merge.
11. Inspect jobs/steps/logs for the natural schedule around 05:41 UTC / 08:41 MSK.
12. Verify physical commit history of all three outputs.
13. Since `stable-capital-data.json` is still stale at Sep 6 in this handoff, do not mark GREEN until a fresh production materialization exists.
14. If broken, make the smallest liveness/reliability fix in the existing canonical writer; no second writer.

### D. Continue P10 system-wide acceptance
15. Walk other production contours one by one.
16. For each contour require: correct canonical writer + exact successful run + fresh physical artifact + downstream consistency where applicable.
17. Keep P10 active until system-wide production acceptance is materially proven.

---

## 10. RECENT KEY SHA / RUN INDEX

- Handoff branch base / live-main capture: `15bc95a4a6e0789966152e3a0810eb2500d34bcb`
- #853 merge: `a18e79669b8a7b212eea06b97310262d9b928973`
- automatic continuity after #853 merge: `48ae0bd5e59c20e861b524ca9794c50cbe1fe5f2`
- current continuity source head inside that auto checkpoint: `9312f40b6c20369ca5444e7e8c88e7941d27e9cb`
- Rewards physical materialization: `ee35c6650220bb11bb204f3699b21028fea1e065`
- later reporting/ledger publish: `e635cfcba09d5222e5d7c778d7b80847bfb930ee`
- later company monthly reports: `b53fb13efc59eeb9d95c4a269fc2dcf47e4e9fe1`
- later reconciliation watch: `1faf9c9a40f46fb6b32e5581758833c8cf7d7bb1`
- latest live-main capture at handoff: `15bc95a4a6e0789966152e3a0810eb2500d34bcb`
- Update Company Rewards production run: id `35254190780`, run #150, success
- Stable Capital latest physical `stable-capital-data.json` commit observed: `4785c5f77e49ec1209437b00f46fa8c67f7a323b` from 2026-09-06

---

## 11. IMPORTANT COLLABORATION / REPORTING NOTES

Owner prefers concise explanations. For status, use roughly:

- 🟢 **done** — only if physically proven where production proof is required.
- 🟡 **in progress** — include approximate % only as a human estimate, not machine truth.
- ⚪ **next** — exact next operational step.

Do not flood with every run. Surface only evidence that changes the decision.

For multi-step work, give short progress messages rather than going silent for long periods; owner explicitly complained that chats have started hanging.

---

## 12. DO NOT DO THESE THINGS

- Do not claim a workflow is production-closed from green CI alone.
- Do not interpret stale continuity values as current if later artifacts exist.
- Do not fabricate historical USD valuation.
- Do not turn UNKNOWN into zero.
- Do not create duplicate accounting writers.
- Do not create a second Stable Capital writer to mask scheduler failure.
- Do not cross P16 visibility boundary without explicit owner confirmation.
- Do not expand wallet/capital authority.
- Do not merge this checkpoint branch into `main` merely because it exists; it is a takeover branch unless later deliberately incorporated.

---

## 13. SIMPLE TAKEOVER SUMMARY

🟢 **P5–P9 closed.**

🟢 **PR #853 merged** at `a18e796...` and its canonical Rewards writer **really ran in production**.

🟢 `companies/rewards-data.json` **physically updated** via `ee35c665...` at 20:56 MSK.

🟢 Downstream reporting/ledger/monthly/completeness machinery continued publishing through at least 21:44 MSK.

🟡 **P10 remains ACTIVE.** The immediate next proof is to re-read post-materialization accounting coverage and decide whether the HyperLend reusable gap is truly gone.

🟡 **Stable Capital remains not proven GREEN**: `companies/stable-capital-data.json` is still physically stale since 2026-09-06 despite #848 scheduler re-registration fix. Exact natural-schedule Actions evidence must be investigated next.

⚪ Then continue P10 system-wide production acceptance contour by contour. Do not skip to P11+ until P10 is materially closed.

---

**Resume rule:** live `main` always outranks this handoff. Re-fetch before acting.
