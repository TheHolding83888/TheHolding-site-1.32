# THE HOLDING — URGENT HANDOFF · PR #656 / REPORTING RECOVERY
## 2026-09-06

> HANDOFF ONLY. DO NOT MERGE THIS BRANCH INTO `main`.
> This supplements `CHAT_HANDOFF_2026-09-06_POST_LEARNING_DEFITEA_653_655_URGENT.md` and supersedes its uncertainty about the stale Reporting tail.

## LIVE RESUME RULE
Always re-read: `CURRENT.md → latest continuity → Router → live artifacts → exact Actions` before any mutation. Automation moves `main` frequently.

## WHAT IS ALREADY CLOSED
- PR #651 engineering-learning materialization tail: physically produced `engineering-lesson-candidates.json` after bounded Cognitive/Learning recovery; initial result was 1 verified candidate + 1 pending evidence; formal Decision→Outcome lessons remained 0.
- PR #655 Learning privacy fix merged: raw repository/developer git-subject metadata removed from published engineering evidence; Privacy Guard remained strict.
- PR #653 Defitea income ownership merged: canonical rule is `event.company == target company`; `YieldRing.eth` and `05081966.eth` reference income remains context only and is not attributed to Defitea. Monthly report physically materialized ownership flags at `2026-09-06T10:03:17.199Z`.

## NEW ROOT CAUSE FOUND AFTER #653
The old checkpoint said stale `income-ledger.json` / `accounting-coverage.json` might be either expected no-diff or a downstream trigger/materialization issue. That uncertainty is now resolved.

Actual root cause: production `.github/workflows/update-reporting.yml` still contained a duplicate stale runtime guard expecting `defitea-income-ledger.json` version `0.1-defitea-income-composition` after PR #653 intentionally upgraded Defitea composition to v0.2. The stale guard stopped production Reporting before canonical ingestion/publish.

## PR #656 — FIX
- PR #656: `Reporting: align Defitea v0.2 production guard`
- branch: `fix/reporting-defitea-v02-production-guard`
- merge commit: `98df53025717181fe761cec9158a3fbaa19a8845`
- scope: only `.github/workflows/update-reporting.yml`
- fix: production guard now expects Defitea v0.2 and verifies ownership invariants (`canonicalIncomeOwnerField == company`, `crossCompanyReattributionAllowed == false`, contributors context-only / not included in Defitea income).
- no accounting methodology change; no Income Ledger core change; no wallet/capital authority change.

This supersedes the earlier hypothesis that Reporting simply failed to trigger after #653.

## ACTIVE PRODUCTION PROOF — DO NOT PATCH WHILE THIS RUN IS HEALTHY
After #656 merge, production Reporting DID start:
- workflow: `Update The Holding Reporting Data`
- workflow id: `330704720`
- run id: `34028133291`
- event: push
- branch: `main`
- head/trigger: `98df53025717181fe761cec9158a3fbaa19a8845`
- job: `update-reporting`
- job id: `101472670354`

Last checked status: `in_progress`.

Steps already successful at last check:
1. Checkout
2. Setup Node
3. Install accounting dependency
4. Preflight canonical reporting inputs
5. Update Defitea + Monetra daily reporting state
6. Compose Defitea associated income + VoteMarket events
7. Settle Defitea 40 Acres Received cash flow
8. Build Frax veFRAX factual accrual evidence
9. Validate Frax factual evidence

At the last check the run was still inside:
10. `Build Yield Basis veYB factual accrual evidence`

This step can legitimately take longer because it performs onchain/RPC historical work. No failure was observed yet. Later expected steps include Yield Basis validation/admission, ve33 evidence/admission, Canonical Income Ledger build, Accounting Coverage build/validation, writer/commit/publish.

## EXACT NEXT ACTIONS FOR REPLACEMENT CHAT
1. Re-read live `main`, `CURRENT.md`, latest continuity.
2. Check run `34028133291` and job `101472670354`.
3. If still healthy/in-progress: WAIT / inspect, do not create a patch.
4. If failed: read exact failed step/log and fix only that proven blocker.
5. If success: verify live physical artifacts on current `main`:
   - `reporting/income-ledger.json`
   - `reporting/accounting-coverage.json`
   - `reporting/company-monthly-reports.json`
   - optionally `reporting/defitea-income-ledger.json` / reporting state needed for proof
6. Confirm generated timestamps are post-#656 / fresh enough and that Defitea ownership v0.2 semantics are physically present.
7. Re-read CURRENT/latest continuity and ensure pre-materialization warning is gone or correctly explained by fresh evidence.
8. Only then declare #653/#656 production tail closed.

## THEN — NEXT MAJOR FRONT
Start reusable Defitea August factual recovery, ideally toward `2026-08-01`:
`historical evidence recovery → Canonical Income Ledger → Monthly Report`.
Do NOT build a one-off manual Defitea backfill.

Strong first candidates previously identified:
- veAERO
- veVELO
- veCRV
- veFRAX
- veYB

Other notes:
- f(x) had partial visibility from around Aug 13.
- Convex requires proof of economic earning time; do not equate later claim/receipt with new income blindly.
- Liquity / Pendle / Resupply / Venice are harder historical-evidence cases.

For every mechanism: recover only provable factual evidence; preserve economic date; admit through Canonical Income Ledger; leave unverifiable periods UNKNOWN/partial; never derive factual income from APR.

## OTHER ENGINEERING LESSON TO REVISIT
Observed Operator Command Bridge race during Lessons recovery: Bridge dispatched Cognitive successfully but looked it up using a stale `main` SHA after automation advanced `main`, so it lost its own run and aborted before Learning. A rerun succeeded. Before adding a new incident/lesson, inspect the live engineering incident ledger/candidates to avoid duplicate entries.

## AUTHORITY
Execution authority remains none. No wallet signing, capital movement, autonomous methodology mutation, or authority expansion.
