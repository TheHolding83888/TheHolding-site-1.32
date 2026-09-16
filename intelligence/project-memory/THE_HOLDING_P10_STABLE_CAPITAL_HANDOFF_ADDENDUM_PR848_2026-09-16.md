# THE HOLDING — P10 STABLE CAPITAL HANDOFF ADDENDUM · PR #848

**Status:** ACTIVE REPAIR / CHECKS IN PROGRESS  
**Date:** 2026-09-16 MSK  
**Companion to:** `THE_HOLDING_P10_STABLE_CAPITAL_URGENT_HANDOFF_2026-09-16_2135_MSK.md`

## Fresh progress after the original 21:35 MSK checkpoint

The diagnosis advanced from “find first bad run” to a much narrower production-liveness boundary.

### Proven runtime boundary

Last proven good canonical Stable Capital run:

- workflow: `Update Stable Capital`
- run ID: `34025231555`
- run number: `33`
- event: `schedule`
- head SHA: `b9a6c97204d99f6ca02c30175e95901676b444d4`
- created: `2026-09-06T09:38:39Z`
- completed: `2026-09-06T09:42:34Z`
- conclusion: `success`

It physically produced the last known publication commit:

`4785c5f77e49ec1209437b00f46fa8c67f7a323b` — `Publish Monetra verified Stable Performance`.

Fresh checks of post-Sept-6 main activity found no corresponding Stable Capital run/materialization while many other Actions/workflows continued normally. The workflow file still exists, still declares a daily schedule, and its definition has not changed since Aug 17. The architecture/control-plane baseline still treats `update-stable-capital` as a known canonical repository writer and Unified Capital still lists `Update Stable Capital` as an upstream dependency.

**Current classification:** scheduler/workflow liveness defect, not an accounting-engine failure and not an intentional writer retirement.

The exact external GitHub workflow `state` could not be read with the available connector, so do **not** claim a manually-disabled workflow as proven fact.

## Repair candidate opened

PR:

`#848 — P10: re-register Stable Capital daily schedule`

Branch:

`fix/p10-stable-capital-scheduler-liveness-20260916`

Initial bounded change:

- old cron: `37 5 * * *`
- candidate cron: `41 5 * * *`
- same canonical workflow
- same writer
- same daily cadence
- no accounting logic change
- no methodology change
- no second writer
- no guard weakening
- no wallet/capital authority

The repository-side intent is to force GitHub to re-register the existing scheduled workflow while preserving architecture.

## Important control-plane discovery

The first PR #848 candidate commit was:

`419608aa9570dac9438e803b7b69185d94d4282e`

Most checks passed, but canonical `Workflow Control Plane` correctly failed at:

`Guard workflow definition changes`

Reason class: this workflow has no direct pull-request self-verifier, so any workflow logic/definition maintenance must be paired with a changed deterministic proof file under `intelligence/reliability/`.

**This red check was NOT suppressed.** The repair was adapted to satisfy the existing fail-closed architecture law.

## Deterministic paired proof added

Proof file added to PR #848:

`intelligence/reliability/update-stable-capital-scheduler-proof.mjs`

It is read-only/deterministic and proves:

- exact workflow identity remains `Update Stable Capital`;
- manual recovery trigger remains present;
- exactly one daily cron exists;
- cron is the intended `41 5 * * *` candidate;
- old `37 5 * * *` cron is absent;
- `contents: write` remains;
- canonical concurrency group remains `update-stable-capital`;
- `cancel-in-progress: false` remains;
- canonical Stable Capital engine, interval-history builder and Stable Index builder remain wired;
- all three canonical output paths remain wired;
- candidate workflow diff is bounded to the proof marker + scheduler re-registration only;
- no duplicate writer/accounting semantics/authority expansion is introduced.

Workflow now contains the paired marker:

`# holding-workflow-definition-proof: intelligence/reliability/update-stable-capital-scheduler-proof.mjs`

Relevant commits on PR #848 after the first candidate:

- `e90395a1683badd5d7f1467096dad43db7acb8be` — add deterministic scheduler proof
- `71255aeba4917f8fee1413ffeeca5be9e1a92625` — bind Stable Capital scheduler repair proof

Latest known PR head at this addendum:

`71255aeba4917f8fee1413ffeeca5be9e1a92625`

## Check state at addendum time

Fresh latest-head checks already GREEN:

- Embedded Yield Interval History — success
- Public Surface Privacy Guard — success
- Commit Identity Privacy Guard — success

Still running at the exact capture moment:

- Workflow Control Plane
- Repository Hygiene Guard

Do not call PR #848 GREEN until those settle successfully.

## Exact resume instruction

1. Fresh-check live `main` first.
2. Fresh-check PR #848 exact head (it may have advanced).
3. Confirm `Workflow Control Plane` now passes the paired deterministic proof.
4. Confirm Repository Hygiene and all relevant PR checks are terminal GREEN/skipped-as-expected.
5. **Do not automatically merge.** Production merge/release remains outside autonomous authority.
6. After an explicitly allowed merge, do not close the defect merely because the PR is merged.
7. Require a real `Update Stable Capital` production run and physical fresh materialization on `main` of:
   - `companies/stable-capital-data.json`
   - `companies/embedded-yield-ledger.json`
   - `companies/stable-index-data.json`
8. Verify their genuine fresh timestamps/data and control-plane integrity.
9. Only then mark this P10 Stable Capital defect GREEN and continue the broader P10 acceptance sweep.

## Resume one-liner

> Resume P10 at PR #848 head `71255ae...`; verify the paired workflow-definition proof turns Control Plane GREEN, do not bypass or suppress it, then await explicit production merge authority and require a real Stable Capital run + physical refresh of all three canonical artifacts before declaring closure.
