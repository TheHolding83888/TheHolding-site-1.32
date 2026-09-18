# THE HOLDING — TAKEOVER DELTA
## 2026-09-18 · ~19:20 MSK · P10 WAIT / P12 #456 CLOSED

Status: **bounded takeover checkpoint**  
Authority: observation / continuity / metadata cleanup only  
`executionAuthority = none`

## P10 — Stable Capital natural scheduler proof

Current canonical writer:
- workflow: `.github/workflows/update-stable-capital-scheduled.yml`
- name: `Update Stable Capital`
- current cron on live `main`: `10 16 * * *` = **19:10 MSK**
- required acceptance remains: natural `event=schedule` run → success → physical refresh on live `main` of:
  - `companies/stable-capital-data.json`
  - `companies/embedded-yield-ledger.json`
  - `companies/stable-index-data.json`
- manual dispatch/rerun must not substitute for this natural-schedule proof.

At ~19:20 MSK no Stable scheduled run had materialized yet. A different scheduled workflow, Runtime Observer, did materialize at 19:19:40 MSK, proving GitHub schedule processing itself was active.

### Historical delay benchmark

Exact historical evidence from 2026-09-06:
- old Stable cron at exact historical head: `37 5 * * *` = **08:37 MSK**;
- natural Stable run `34025231555` (`Update Stable Capital`, event=`schedule`) was created at `2026-09-06T09:38:39Z` = **12:38:39 MSK**;
- run completed successfully at `2026-09-06T09:42:34Z` = **12:42:34 MSK**;
- resulting Monetra publication commit: `4785c5f77e49ec1209437b00f46fa8c67f7a323b` at `2026-09-06T09:42:28Z`.

Observed historical schedule-to-run-creation delay: **4h 01m 39s**.

Therefore absence of the new 19:10 MSK Stable run during the first minutes is **not sufficient evidence of a scheduler defect**. P10 remains:

`WAITING_EXTERNAL_PROOF`

Do not move it to `OPEN_DEFECT` without stronger live evidence beyond the already-proven historical delay envelope or another exact registration/runtime failure.

## P12 — issue #456 reviewed closure

Issue #456 `[Runtime Reliability] critical-handoff-miss · unified-capital-refresh` was forensically reviewed and closed as a historical one-off `workflow_run` dispatch/materialization miss.

Exact producer:
- `The Holding Capital · Unified Refresh`
- run `33095121996` (#71)
- `main`
- conclusion `success`
- completed `2026-08-27T16:53:58Z`

Evidence boundary:
- historical Economic Graph workflow already had the correct `workflow_run` trigger on Unified Refresh and the expected success/main gate;
- no Economic Graph consumer run materialized within the full 60-minute acceptance window after the producer;
- current production retains the same handoff semantics and later/current Unified → Economic Graph materializations are healthy;
- no persistent current trigger defect is materialized.

Root-cause statement is intentionally narrow:
- observable failure = downstream GitHub Actions `workflow_run` event/run did not materialize for that historical producer;
- provider-internal reason is not observable from repository evidence and is not guessed.

Explicitly separate failure classes:
- later Economic Graph timeout/materialization failures;
- historical ~116.42 MB Economic Graph publication/storage failure.

Neither is assigned as the cause of #456 without exact lineage proof.

Issue #456 now has a detailed reviewed closure comment and is closed as completed.

## P12 hard gate

`THE_HOLDING_P12_ACTIVATION_QUEUE_2026-09-18.md` remains binding:
- P12 production repairs do **not** activate before P10 GREEN;
- read-only forensic preparation may continue;
- no #815/#778/#799 engineering repair should start while P10 is still waiting for Stable natural proof.

## Resume

1. Fresh-check live scheduled runs after the 19:10 MSK slot.
2. If Stable run appears, bind exact run ID/status/jobs and require physical refresh of all three target files.
3. On Stable success/materialization, verify downstream Observer/System Memory/Cognitive rebind and finish P10 acceptance.
4. If Stable remains absent, compare against the proven 4h01m39s historical delay before classifying a new scheduler defect.
5. Keep P12 engineering repairs gated until P10 GREEN; #456 is already DONE.
