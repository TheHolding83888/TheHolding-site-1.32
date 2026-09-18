# The Holding — forensic checkpoint

Date: 2026-09-18
Time: ~20:23 MSK
Mode: P10 WAITING_EXTERNAL_PROOF + P12 read-only forensic preparation
Authority: no production repair activation; `main` untouched by this checkpoint; `executionAuthority = none`.

## P10 Stable Capital

Current acceptance gate remains physical:
1. real natural `event=schedule` run for `Update Stable Capital`;
2. successful writer;
3. physical refresh on live `main` of exactly:
   - `companies/stable-capital-data.json`
   - `companies/embedded-yield-ledger.json`
   - `companies/stable-index-data.json`
4. downstream Observer/System Memory/Cognitive rebind;
5. final P10 acceptance memo.

PR #858 merged at ~18:49 MSK and moved the sole active Stable scheduler slot to `10 16 * * *` = 19:10 MSK. This is a fresh proof opportunity after the earlier 05:41 UTC registration failed to materialize naturally.

Latest fresh Actions check at ~20:23 MSK: no `Update Stable Capital` natural run in the recent Actions surface. Other scheduled workflows are materializing successfully, so repository-wide Actions is not globally stopped.

Historical exact Stable scheduler delay benchmark from 2026-09-06 remains 4h01m39s. Therefore current P10 status is still `WAITING_EXTERNAL_PROOF`, not OPEN_DEFECT. Passive-wait boundary is approximately 23:10–23:12 MSK; if still absent then, open a fresh scheduler-diagnosis packet instead of extending passive wait indefinitely.

Do not manual-dispatch/rerun to substitute for natural scheduler acceptance.

## P12 forensic findings completed while waiting

### Issue #456 — DONE / CLOSED
Historical one-off Unified -> Economic Graph `workflow_run` materialization miss. Exact producer and 60-minute downstream window reviewed; provider-internal cause not observable. Current same-semantics handoffs healthy. Closed evidence-backed without production code patch.

### Issue #447 — RETAIN / transient runtime class, not old regression
Old malformed action-pin defect was fixed by #767. Fresh Sep 18 Unified runs #348 (`35310165590`) and #349 (`35312518538`) failed in the same step: coherent capital refresh -> YieldRing Productivity overlay -> FXN locker browser guard `page.waitForFunction` 20s timeout. Later Unified #360 passed the same FXN step with no FXN guard code change since Aug 24. Classify as real transient external/browser runtime instability, not recurrence of the old action-pin defect. No blind patch.

### Issue #822 HyperLend — WAITING_EXTERNAL_PROOF
PR #855 fixed diagnostic `node_modules` residue / false-red clean guard. Natural cron is 05:17 UTC = 08:17 MSK. No natural HyperLend run found through ~19:45 MSK Sep 18, well beyond the known ~4h Stable lag benchmark. Repair merged, natural production proof absent. Do not assign scheduler root cause without separate diagnosis.

### Issue #369 Rewards — WAITING_EXTERNAL_PROOF
PR #853 fixed measured-token strip semantics. Triggers: narrow push, daily 05:07 UTC = 08:07 MSK, plus workflow_run after Cypher/ICP. No post-merge Rewards run found through ~19:48 MSK Sep 18. Observer recurrence text is insufficient to prove a post-fix regression. Repair merged, production proof absent.

### Issue #716 Market Data — CLOSURE-READY
PR #715 repaired proven production root causes. Fresh natural Market Data run #524 passed scheduler contract, onchain prices, 26-asset authority and canonical publish. Evidence supports closure after P10 gate/cleanup activation.

### Issue #792 ve33 verifier — CLOSURE-READY
Workflow is PR-triggered, not scheduled. Exact-head canary PR #832 passed with runtime 386088ms < 450000ms and zero settlement/query/reconciliation/current-state/boundary failures. Evidence supports closure after P10 gate/cleanup activation.

### Issue #726 Comparative Intelligence — RETAIN / REVIEW
Historical issue reports 7 consecutive failures on 2026-09-10. Current workflow is downstream `workflow_run` after successful Unified Refresh / Income & Performance plus narrow path pushes; it has no daily cron. At least one later run (#130 / `34511088148`) is a legitimate `skipped`, not a failure. No attributable post-incident repair has been established, and available evidence is insufficient for honest closure. Do not invent a repair attribution; retain for review.

### Issue #727 Reporting — HISTORICAL / SUPERSEDED BY LIVE #799
#727 recorded repeated-failure fingerprint through Sep 11. A distinct later live Reporting fingerprint exists as #799 `running-too-long`, recurring on Sep 12, Sep 16, Sep 17 and again Sep 18 (~32.2m). Therefore #727 is not the current primary Reporting engineering defect; #799 is. Prepare #727 for historical/superseded cleanup only after appropriate review. Do not claim Reporting is fixed.

### Issue #432 Production Deployment Smoke — RETAIN / SECURITY-REVIEW
Historical repeated-failure incident from Aug 28–30. No reviewed root cause / durable repair / canary proof established in current forensic pass. Because deployment smoke is security-sensitive, absence of new recurrence is not enough to close. Retain for explicit security review.

### Issue #565 Monthly Reports — review started
Historical Sep 1 incident: 2 consecutive production failures, no comments, root cause still UNKNOWN_UNTIL_REVIEWED. Do not close yet; exact attribution/proof still required.

## Stale PR cleanup classification already established
Post-P10 candidates to close as superseded/metadata without merge:
- #852
- #730
- #729
- #717
- #433
- #37 (`must never be merged`; branch deletion remains a separate destructive boundary and requires dependency proof)

## Engineering queue remains gated by P10
Do not activate production repairs before P10 GREEN:
- #815 Aerodrome Managed Pulse capability-aware RPC routing
- #778 Economic Graph exact-generation readiness/coherence
- #799 Reporting dependency-aware drift optimization

## Immediate resume sequence
1. Fresh-check `Update Stable Capital` natural run.
2. If absent and still before historical-lag boundary: continue read-only forensic review only.
3. Continue #565 -> #370 -> #383 -> #659 one packet at a time.
4. If Stable natural run materializes: bind exact run/jobs/head; verify all 3 physical files on live main; verify downstream rebind; complete P10 acceptance.
5. If Stable remains absent beyond ~23:10–23:12 MSK: start a fresh bounded scheduler diagnosis; do not substitute manual dispatch for natural proof.
