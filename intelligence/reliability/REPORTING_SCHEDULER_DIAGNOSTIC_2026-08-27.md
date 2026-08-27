# Reporting Scheduler Diagnostic — 2026-08-27

Status: **DIAGNOSTIC CHECKPOINT — root cause narrowed, production repair not yet proven**

## Why this checkpoint exists

Preserve the live evidence and current hypothesis before the repair is complete. This file is diagnostic memory, not a claim that Reporting is GREEN.

## Live evidence

- `Update The Holding Reporting Data` has a daily schedule in `.github/workflows/update-reporting.yml`.
- Current workflow schedule before this repair: `22 6 * * *` (06:22 UTC).
- Last confirmed natural Reporting run was 2026-08-24 and was triggered by `event=schedule`; it completed successfully and produced the current Reporting snapshot.
- `reporting/reporting-data.json` remained stuck at the 2026-08-24 snapshot through 2026-08-27.
- No Reporting snapshot commits were observed for Aug 25–27 during the live investigation.
- Other scheduled workflows continued to run, and the repository remained highly active; repository-wide inactivity is therefore not a plausible explanation.
- `.github/workflows/update-reporting.yml` itself had not changed since before the missed Aug 25–27 executions.
- Reporting engine metadata currently declares `dailySnapshot: '06:07 UTC'`, while the workflow schedule is 06:22 UTC. This is a contract drift even though it does not by itself prove why GitHub stopped creating scheduled runs.

## Current diagnosis

The evidence narrows the fault away from Reporting economic logic and toward **scheduled workflow registration/state / scheduler wake-up**:

1. The same Reporting workflow logic succeeded under a natural `schedule` event on Aug 24.
2. Subsequent expected scheduled runs were not found, rather than being present and failing.
3. Other cron workflows still execute.
4. The repository is active.

Therefore the working hypothesis is: **the Reporting workflow schedule stopped being materialized by GitHub after the Aug 24 run**. Exact platform-side cause is not yet proven from repository evidence alone.

## Repair principles

- Do not manually refresh Reporting merely to hide staleness.
- Do not change Reporting accounting or economic semantics as part of scheduler repair.
- Do not add a second scheduler/workflow unless the existing schedule proves unrecoverable.
- Preserve writer concurrency and fail-closed validation.
- Force a bounded schedule-definition re-registration through an explicit workflow definition change.
- Eliminate YAML ↔ generated metadata schedule drift with a machine-verifiable scheduler contract.
- Reuse the existing Workflow Control Plane and Reporting verifier; do not create unnecessary fan-out.

## Planned minimal repair

1. Introduce a Reporting scheduler contract consumed by Reporting output metadata.
2. Shift the cron by a small bounded amount to force GitHub schedule re-registration and avoid top-of-hour congestion.
3. Extend Reporting verification to prove exact contract parity between workflow cron and generated metadata.
4. Merge only after existing Workflow Control Plane / Reporting validation stays GREEN.
5. Distinguish two proofs after merge:
   - **workflow logic proof** (manual dispatch if needed), and
   - **autonomous scheduler proof** (a subsequent natural `event=schedule` run).

## Authority / epistemics

- This checkpoint has no execution authority.
- It does not authorize capital, wallet, methodology, or accounting changes.
- `UNKNOWN` remains distinct from zero.
- The scheduler root cause is **narrowed but not fully proven** until a natural post-repair schedule event is observed.
