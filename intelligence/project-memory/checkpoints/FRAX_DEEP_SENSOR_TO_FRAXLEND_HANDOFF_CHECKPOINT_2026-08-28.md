# THE HOLDING — FRAX DEEP SENSOR → FRAXLEND HANDOFF CHECKPOINT

**Date:** 2026-08-28  
**Status:** CHECKPOINT / ACTIVE INTELLIGENCE DEVELOPMENT  
**Authority:** executionAuthority = none  
**Production mutation:** none on this checkpoint branch

## Purpose

Preserve the exact recovery boundary after the first post-orchestration Frax deep-sensor pilot and before Fraxlend implementation begins.

This file is a **historical recovery anchor**, not a replacement for live `main`.

Future chat order remains:

`CURRENT.md → fresh main → latest continuity → Router → task-specific live artifacts/evidence → this checkpoint only if needed`

## Fresh anchor at checkpoint creation

Fresh `main` when this checkpoint branch was created:

- commit: `8fd34049831fe23ca99905c534860ccbfced1475`
- message: `intelligence: refresh progress telemetry`
- time: `2026-08-28T13:18:11Z`
- tree: `0b226cd42a245c4069adc19a28fe0e1475563197`

`CURRENT.md` at this time still routes through:

`THE_HOLDING_MASTER_CONTINUITY_2026-08-28_ORCHESTRATION_CURRENTNESS_FREEZE.md`

The CURRENT source snapshot itself represented `2026-08-28T13:12:24.498Z`; later generated telemetry moved `main` forward normally.

## Inherited milestone boundary

The orchestration / Market Data / TVL currentness package is **CLOSED**.

Control Plane / generic orchestration is **FREEZE**.

Do not reopen merely for workflow count, fan-out aesthetics, another GitHub watchdog, generic dispatch authority, broad cancellation authority, universal gates, or architecture polishing.

External tails remain non-blocking unless fresh repo-controlled regression appears:

- GitHub natural cron materialization gaps;
- Cloudflare Workers Build quota reset;
- historical stale queued runs.

Cloudflare does not block sensor/Brain/Memory/GitHub work; it only delays fresh public-site delivery.

## Strategic protocol priority

Primary deep-intelligence cluster now:

1. Frax
2. f(x)
3. Curve
4. Convex / Votium
5. Pendle
6. Yield Basis

Treat these increasingly as a connected economic neighborhood: stables, pools, gauges, ve-locks, bribes, voting power, fee flows, emissions, Convex-on-Curve overlays, Votium incentives, and cross-protocol relationships only where provenance is real.

Aerodrome / Velodrome are intentionally moved to the late queue because the owner expects their near-term transition/evolution into Aero.xyz. They are postponed, not abandoned.

## Permanent sensor-building law

Prefer:

**existing writer + richer evidence**

over:

**new workflow + new scheduler + new orchestration layer**

For each sensor:

- reuse canonical writer where lawful;
- reuse existing RPC/source infrastructure;
- prefer deterministic read-only onchain state;
- exact block where possible;
- preserve provenance;
- respect native cadence;
- preserve `UNKNOWN != 0`;
- use `WARMING` when one checkpoint is insufficient;
- no fabricated history/backfill;
- do not convert market/pair/epoch-scoped metrics into synthetic protocol-wide metrics;
- do not promote correlation to cause;
- no recommendation/allocation/execution authority.

## First Frax deep-sensor pilot — DONE

### PR #437

Title: `intelligence: measure Frax sfrxUSD share price onchain`

Merged: `2026-08-28T12:44:45Z`

Merge commit: `7ad79041f69c95757a22d0d2372d5ce0b760ef68`

Production behavior:

- exact-block Ethereum read-only ERC20/ERC4626 measurement;
- reproduce sfrxUSD share price from `totalAssets / totalSupply`;
- existing public-RPC failover approach;
- existing canonical Economic Graph runner remains production path;
- bounded same-workflow Frax enrichment writes the same `economic-graph.json`;
- previous checkpoint is explicitly the last **published** canonical Graph state;
- retry/unpublished state cannot create fake history;
- first checkpoint is `WARMING` for interval yield;
- no APY/history backfill;
- no new workflow, cron, writer, watchdog, orchestrator, price authority, methodology or execution authority.

First physical production observation was approximately:

- sfrxUSD share price: `1.207887208561 frxUSD per sfrxUSD`
- Ethereum block: `25,853,824`
- Frax coverage moved from `1/9 MEASURED` to `2/9 MEASURED`
- interval embedded yield remained `WARMING`

The second independent published checkpoint may create the first honest interval yield mechanically. Never manufacture the earlier checkpoint.

## Compatibility work after the sensor

The first deeper Frax state exposed old consumers frozen on historical `9 total / 1 measured / 8 unknown` assumptions.

These were compatibility defects, not sensor defects.

### PR #438

Title: `fix: make Frax recovery contract depth-aware`

Merged: `2026-08-28T12:56:36Z`

Merge commit: `72f38daef03d183257387bbd3d34fb14af17ebe2`

Key result:

- replace fixed `9/1/8` recovery assertions with producer-owned structural invariants;
- enforce `measured + unknown = total surfaces`;
- require exact sfrxUSD proof when MEASURED;
- require fail-closed UNKNOWN semantics when unavailable;
- Explanatory inherits Graph counts;
- Brain inherits Explanatory counts;
- causal UNKNOWN guards remain.

### PR #439

Title: `fix: inherit Frax sensor depth into Explanatory`

Merged: `2026-08-28T13:01:59Z`

Merge commit: `a0a898e740471e4c83e29f17970bc8814bb9ceb5`

Key result:

- Explanatory no longer claims sfrxUSD is UNKNOWN once Graph measured it;
- depth and per-surface state are inherited dynamically;
- exact-block evidence is preserved;
- no causal or authority promotion.

### PR #440

Title: `fix: inherit Frax sensor depth into Brain`

Merged: `2026-08-28T13:10:17Z`

Merge commit: `8c3cc768e6abbac8a5561942db4e2d5611c923b7`

Key result:

- Grounded Brain no longer freezes old `1 measured / 8 unknown` text/guards;
- actual measured and UNKNOWN surface IDs flow into Brain posture;
- evidence note / whatChanged / Brain brief inherit real depth;
- exact Explanatory binding and causal UNKNOWN boundaries remain;
- reviewed Cognitive release hashes and downstream Learning pin were updated through normal coherence guards, not bypassed.

## End-to-end recovery — DONE

After #440, existing scoped recovery propagated the Frax depth through:

`Economic Graph → Explanatory → Observer/System Memory → Cognitive Stack → Grounded Brain → ChatGPT Bridge → Learning → Proposal → Downstream Continuity → Project Memory → Intelligence Progress`

Final Intelligence Progress completed successfully and then wrote fresh telemetry to `main`.

Therefore:

- sfrxUSD deep-sensor pilot = DONE end-to-end;
- Frax depth-aware downstream compatibility = DONE;
- full recovery = DONE.

Do not reopen those items without fresh regression evidence.

## Current active task — Fraxlend read-only audit

No Fraxlend implementation PR exists yet at this checkpoint.

Current target is **not** a synthetic protocol-wide Fraxlend APR.

Fraxlend must be treated as pair/market scoped.

Desired measurement path:

`canonical pair identity → pair accounting → utilization → borrow-rate state → fToken/share-price state → later interval lender-side history`

Potential measurable fields:

- pair identity;
- supplied asset;
- collateral asset;
- total supplied assets;
- total borrowed assets;
- utilization;
- current borrow-rate state;
- fToken `totalAssets` / `totalSupply`;
- fToken share price;
- later interval embedded yield between independent published checkpoints.

Known architectural direction: Fraxlend Pair has pair-level accounting (including `getPairAccounting()`-style accounting) and share-based fToken behavior. **Re-verify exact live ABI and official deployment/registry sources before coding.**

## Exact next proof obligations

Before implementation:

### 1. Canonical pair registry / deployment identity

Do not hard-code a random pair discovered from search.

Find a canonical source already trusted by The Holding or an official Frax deployment/registry source.

### 2. Existing Frax Economic Graph surface mapping

Read the live 9-surface Frax contract.

Determine which Fraxlend-related surfaces already exist and whether utilization / rate / fToken share-price work simply changes mapped UNKNOWN surfaces to MEASURED.

If a desired metric requires a new semantic/methodological surface, STOP at that boundary and explain before implementing.

### 3. Exact fields / units / block semantics

Prove:

- ABI call names;
- units/scaling;
- rate convention;
- one-block consistency;
- utilization formula;
- fToken share-price mechanical reproduction;
- no accidental mixing of markets.

### 4. Scope

Prefer one bounded canonical pilot market first.

Do not enumerate every Fraxlend market before the schema is proven.

## Recommended implementation if audit is GREEN

1. remain inside the existing Economic Graph writer/workflow;
2. add one read-only Fraxlend adapter;
3. read one exact Ethereum block;
4. resolve one canonical Pair;
5. capture accounting state;
6. derive utilization mechanically;
7. capture current borrow-rate state without inventing annualization semantics;
8. capture fToken share-price state;
9. first interval remains WARMING;
10. previous history must be last published canonical checkpoint only;
11. fail closed to UNKNOWN;
12. deterministic canary/static verification;
13. require physical production artifact proof;
14. require downstream Explanatory/Brain/Learning proof if depth changes;
15. no new workflow, cron, writer or orchestrator.

## Prohibited shortcuts

Do not:

- invent a global Fraxlend APR;
- mix markets;
- infer utilization from incomplete state;
- use current state to fabricate old history;
- annualize without existing canon;
- treat borrow rate as realized lender income;
- equate protocol revenue with owner cash flow;
- weaken guards to make new depth pass;
- reopen generic orchestration.

## Preserved prospective work

Historical branch:

`checkpoint/prospective-native-period-audit-20260828`

Historical commit:

`e261185a4b813968947e15de47b44849eb43e41a`

Key finding:
The Holding already has prospective machinery in Observational Learning. Do not create a new forecasting subsystem.

Possible first future pilot remains Curve native-period data only if exact non-overlapping period identity/provenance/canonical event semantics are proven.

## Long-term direction

The system should accumulate:

- state;
- flow;
- driver;
- outcome;
- native-period history;
- attribution;
- prospective support/counterevidence.

Eventually this feeds a real Capital Map / heat map where measured flows, mechanical relationships, correlations and pattern candidates are visually distinct.

Long-term sequence:

`OBSERVE → CONNECT → REMEMBER → EXPLAIN → TEST → LEARN → MAP → CONVERSE`

Truth law:

> The system is allowed to be incomplete. It is not allowed to pretend.

## Exact resume order

1. Read live CURRENT.
2. Resolve fresh main.
3. Load latest continuity + Router.
4. Treat orchestration/currentness as CLOSED/FREEZE unless fresh regression evidence exists.
5. Confirm #437–#440 have not been reverted.
6. Read live Frax Graph depth and latest sfrxUSD observation.
7. If a second independent sfrxUSD checkpoint now exists, validate whether interval yield lawfully materialized; otherwise keep WARMING.
8. Resume Fraxlend read-only audit.
9. Find canonical pair registry/deployment source.
10. Map exact Pair fields to existing Frax surfaces.
11. Choose smallest lawful pair-level atom.
12. Implement through existing Graph writer only if no methodology boundary is crossed.
13. Verify static/live/recovery chain and physical artifact.
14. Close pilot only after downstream proof.

## Final checkpoint state

**sfrxUSD sensor = DONE.**  
**Depth-aware recovery / Explanatory / Brain = DONE.**  
**Full downstream recovery = DONE.**  
**Fraxlend = AUDIT IN PROGRESS / IMPLEMENTATION NOT YET STARTED.**  
**Next action = canonical pair identity + exact measurable field proof.**

Permanent development rule:

> **more economic truth, not more infrastructure.**
