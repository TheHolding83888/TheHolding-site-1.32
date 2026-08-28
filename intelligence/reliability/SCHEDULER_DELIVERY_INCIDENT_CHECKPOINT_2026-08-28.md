# The Holding · Scheduler Delivery Incident Checkpoint · 2026-08-28

Status: READ-ONLY INVESTIGATION CHECKPOINT — NOT PRODUCTION CANON

Main anchor at checkpoint: `0cfd336f8ca986b709053cbc040d0d6c85358172`

## Why this checkpoint exists

A previous handoff described Shared Market Data / TVL as repo-side closed after PR #431. Fresh live evidence on 2026-08-28 shows a stricter boundary: the writer and repair code are healthy, but natural GitHub `schedule` delivery remains intermittent and the final natural-schedule proof is not durable.

## Fresh physical evidence

- PR #431 preserved the canonical Market Data writer, kept the primary `7,37 * * * *` cron, added same-workflow recovery slots `22,52 * * * *`, and did not add dispatch/cancel/rerun authority.
- PR #431 explicitly requires a subsequent natural `event=schedule` run for final scheduler-health closure; push/manual materialization is not that proof.
- From `2026-08-28T00:00:00Z` through the investigation window, repository Actions exposed only two natural `event=schedule` runs on `main`: Project Memory Bootstrap and Runtime Observer. No Shared Market Data, Reporting, or Daily CoinGecko natural run was observed.
- Reporting remains configured for `31 6 * * *` and its contract still requires natural schedule proof. No natural Reporting run was observed after the 06:31 UTC slot.
- Canonical `intelligence/market-data/market-data.json` was last materialized at `2026-08-28T04:16:27.825Z`; this materialization followed the #431 main change / non-schedule recovery path, not a natural schedule proof.
- Daily CoinGecko is configured for `12 3 * * *`, but no natural Daily CoinGecko run was observed today. Canonical `market-data-coingecko.json` remained from `2026-08-27T14:05:28.684Z` during the investigation.
- GitHub's own documentation states scheduled events can be delayed and, under sufficiently high Actions load, dropped.
- GitHub Status recorded Actions trigger/queue incidents on Aug 24, Aug 26 and Aug 26–27, including trigger-processing saturation and some runs failing to trigger. Current GitHub Status at investigation time reported Actions operational, so this checkpoint does not claim an active global incident as root cause.

## Stale queue boundary

- 21 queued historical runs remain.
- 20 belong to closed superseded PR #386 / branch `intelligence/frax-vefrax-lifecycle-v0-1`.
- 1 belongs to long-merged PR #150 / branch `agent/cypher-vlcvx-apr-badge`.
- 0 `in_progress` runs were observed.
- No evidence currently proves these historical queued runs cause missing scheduled-event creation. Do not cancel or broaden cancellation authority based on correlation alone.

## Architectural boundary

Do not respond by adding another GitHub cron, a new orchestrator, or dispatch authority to Runtime Reliability. Those either share the same scheduler failure domain or expand authority after the Control Plane freeze.

Any repair must preserve:
- one canonical Market Data writer;
- no workflow dispatch/cancel/rerun authority expansion;
- no valuation methodology change;
- UNKNOWN != zero;
- natural schedule proof remains distinct from push/manual materialization;
- fail closed rather than present stale economic state as freshly observed.

## Next investigation step

Determine whether an already-existing independent non-schedule event can provide bounded same-writer freshness recovery without creating a fan-out loop. If no such event exists, classify GitHub schedule delivery as an external provider dependency and harden stale/freshness semantics rather than building false redundancy inside the same failure domain.
