# Reporting Scheduler Diagnostic — 2026-08-27

Status: **REPAIR IMPLEMENTATION / CONTRACT DONE — NATURAL SCHEDULER PROOF WAITING EXTERNAL EVENT**

## Closure classification

- scheduler registration/contract repair: **DONE**;
- workflow ↔ schedule metadata parity: **DONE**;
- Reporting verifier + Control Plane/no-new-fan-out guards: **DONE**;
- natural post-repair `event=schedule` proof: **WAITING EXTERNAL PROOF**;
- live Pendle APR availability: **WAITING EXTERNAL EVIDENCE**, not scheduler defect;
- manual dispatch: **not accepted as scheduler-health proof**.

This file no longer represents an open pre-repair investigation. PR #397 implemented and merged the bounded repair. The exact GitHub platform-side reason the old schedule stopped materializing remains unproven, but the repository-side registration/contract defect has been repaired without changing Reporting accounting semantics or expanding authority.

## Pre-repair evidence

- `Update The Holding Reporting Data` had a daily schedule in `.github/workflows/update-reporting.yml`.
- Pre-repair workflow schedule: `22 6 * * *` (06:22 UTC).
- Last confirmed natural Reporting run before the repair was 2026-08-24 and was triggered by `event=schedule`; it completed successfully and produced the current published Reporting snapshot.
- Expected Aug 25–27 Reporting schedule runs were absent rather than present-and-failing.
- Other scheduled workflows continued to run and the repository remained active.
- Generated Reporting metadata declared `dailySnapshot: 06:07 UTC` while the workflow declared 06:22 UTC: a real schedule contract drift.

## Repair implemented in PR #397

PR #397 — `Repair Reporting scheduler registration and contract drift` — merged with historical merge SHA:

`9bc3e3e75151030c7f6cd547d2cb70af3baa0fce`

Implemented:

1. `reporting/reporting-scheduler-contract.json` as the single schedule source of truth;
2. `reporting/reporting-scheduled-runner.mjs` as a thin contract validator/binder around the existing Reporting engine;
3. natural cron shifted to `31 6 * * *` / **06:31 UTC** to force bounded schedule-definition re-registration while remaining after Rewards, Stable Capital and Shared Market Data;
4. exact workflow ↔ contract parity verification;
5. generated Reporting schedule metadata bound to the contract;
6. deterministic validation-only Productivity fixture where needed for CI, explicitly `productionAuthority:false`;
7. production Reporting writer remains bound to live Productivity and cannot consume the validation fixture;
8. no new workflow, no new dispatch authority, no capital/wallet/methodology authority.

PR checks passed after the repair, including Reporting verification, Workflow Control Plane/no-new-debt/no-new-fan-out and repository/privacy guards.

## Current scheduler contract

- version: `0.1-reporting-scheduler-contract`;
- status: `production`;
- cron: `31 6 * * *`;
- dailySnapshotUtc: `06:31 UTC`;
- timezone: UTC;
- `naturalScheduleProofRequired = true`;
- `manualDispatchDoesNotProveSchedulerHealth = true`;
- `unknownIsNotZero = true`.

## Why natural proof is still waiting

#397 merged after the Aug 27 06:31 UTC schedule slot. Therefore a same-day natural post-repair cron proof was physically unavailable.

The first honest proof opportunity is the next natural Reporting slot on **2026-08-28 around 06:31 UTC**.

Do not manually dispatch merely to manufacture GREEN. At/after the next slot, inspect whether GitHub created the natural `event=schedule` run.

## Scheduler health != input publishability != artifact materialization

These are three separate proofs:

1. **scheduler health** — did the natural `event=schedule` run materialize?;
2. **input publishability** — did every required live Reporting input satisfy its fail-closed contract?;
3. **artifact materialization** — did a valid new Reporting snapshot commit physically reach `main`?

A natural scheduled run can prove scheduler health even if the writer later refuses publication because a required live economic input is `UNKNOWN/WARMING`.

Do not conflate the current Pendle evidence wait with scheduler failure.

## Pendle boundary

At the checkpoint `pendle_spendle` is correctly fail-closed:

- `aprLatest = null`;
- `status = warming`;
- current 14-day period has not yet accumulated the required independent official evidence for promotion.

This is **WAITING EXTERNAL EVIDENCE**, not an engineering defect. Never convert UNKNOWN to zero, silently reuse stale APR as production authority or weaken exact Reporting coverage merely to publish a fresher timestamp.

## Durable closure rule

**No moving finish line.**

New observations after this repair must be classified as `DONE / WAITING EXTERNAL PROOF / OPEN DEFECT / FUTURE HARDENING`. A correctly functioning fail-closed wait does not reopen this scheduler repair.

## Authority / epistemics

- execution authority: none;
- no workflow dispatch/cancel/rerun authority added;
- no capital or wallet authority;
- no Reporting accounting/methodology change in this repair;
- UNKNOWN remains distinct from zero;
- current Reporting data staleness remains visible until a publishable production run materializes.
