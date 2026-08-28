# THE HOLDING — FRAX DEEP SENSOR / FRAXLEND CHECKPOINT

**Date:** 2026-08-28  
**Status:** DURABLE RECOVERY CHECKPOINT  
**Authority:** executionAuthority = none  
**Branch:** `checkpoint/frax-deep-sensor-fraxlend-20260828`

## Purpose

Preserve the exact handoff boundary between the completed first Frax deep-sensor pilot and the next active Fraxlend audit, without changing production runtime or starting a new workflow.

This checkpoint is historical recovery evidence only. Future chats must restore mutable truth from live `CURRENT.md` -> fresh `main` -> latest continuity -> Router -> live artifacts/evidence.

## Fresh live anchor at checkpoint creation

- Repository: `TheHolding83888/TheHolding-site-1.32`
- Fresh `main`: `8fd34049831fe23ca99905c534860ccbfced1475`
- Commit message: `intelligence: refresh progress telemetry`
- Commit time: `2026-08-28T13:18:11Z`
- Tree: `0b226cd42a245c4069adc19a28fe0e1475563197`
- `CURRENT.md` still routes through `THE_HOLDING_MASTER_CONTINUITY_2026-08-28_ORCHESTRATION_CURRENTNESS_FREEZE.md`.

Treat all identifiers below as historical anchors only.

## Inherited closure boundary

The orchestration / Market Data / TVL currentness package is CLOSED.

- Shared Market Data remains one canonical writer.
- Public currentness semantics are fail-closed/truthful.
- Control Plane / generic orchestration is FREEZE.
- GitHub natural scheduler delivery remains an external provider tail unless fresh evidence proves a repo-controlled defect.
- Cloudflare Workers Build quota remains an external provider tail until quota reset; do not build bypass deployment architecture solely for this.
- Historical queued Actions remain non-blocking residue unless fresh evidence proves otherwise.

Do not reopen generic orchestration optimization during sensor expansion without a measured production defect.

## Strategic development direction

Primary deep-intelligence cluster now:

1. Frax
2. f(x)
3. Curve
4. Convex / Votium
5. Pendle
6. Yield Basis

Aerodrome / Velodrome are intentionally deferred until the Aero.xyz transition is clearer.

Permanent direction:

`OBSERVE -> CONNECT -> REMEMBER -> EXPLAIN -> TEST -> LEARN -> MAP -> CONVERSE`

Permanent truth rule:

> The system is allowed to be incomplete. It is not allowed to pretend.

## First Frax deep-sensor pilot — DONE end-to-end

### PR #437

`intelligence: measure Frax sfrxUSD share price onchain`

Historical merge commit:
`7ad79041f69c95757a22d0d2372d5ce0b760ef68`

Bounded production behavior:

- exact-block Ethereum read-only measurement;
- ERC20/ERC4626 mechanical share-price reproduction from `totalAssets / totalSupply`;
- existing public-RPC failover approach;
- same Economic Graph production writer;
- no new workflow / cron / writer / orchestrator;
- first interval remains `WARMING`;
- no APY/history backfill;
- comparison only against last published canonical Graph checkpoint;
- publish retry cannot fabricate longitudinal depth;
- fail closed to UNKNOWN on unavailable RPC/evidence;
- no causal promotion, recommendation, allocation or execution authority.

First physical production checkpoint observed approximately:

- sfrxUSD share price: `1.207887208561 frxUSD per sfrxUSD`
- Ethereum block: `25,853,824`
- Frax depth moved from `1/9 MEASURED` to `2/9 MEASURED`
- embedded-yield interval remained `WARMING`, correctly awaiting a second independent published checkpoint.

## Depth-aware downstream compatibility — DONE

The first new measured surface exposed stale fixed-depth assumptions (`9/1/8`) in downstream consumers. These were repaired structurally, not by weakening guards.

### PR #438

`fix: make Frax recovery contract depth-aware`

Historical merge commit:
`72f38daef03d183257387bbd3d34fb14af17ebe2`

Durable invariant:

- `measured + unknown = total Frax surfaces`;
- exact-block sfrxUSD proof required when MEASURED;
- fail-closed UNKNOWN required when unavailable;
- Explanatory must inherit actual Graph depth;
- Brain must inherit actual Explanatory depth;
- causal UNKNOWN guards remain intact.

### PR #439

`fix: inherit Frax sensor depth into Explanatory`

Historical merge commit:
`a0a898e740471e4c83e29f17970bc8814bb9ceb5`

Explanatory now reflects actual measured/UNKNOWN Frax surfaces and exact Graph evidence rather than stale text.

### PR #440

`fix: inherit Frax sensor depth into Brain`

Historical merge commit:
`8c3cc768e6abbac8a5561942db4e2d5611c923b7`

Grounded Brain now inherits actual Frax depth, measured/UNKNOWN surface identities and exact-block sfrxUSD evidence. Frozen Cognitive and downstream Learning release hashes were updated through normal coherence guards; no guard was bypassed.

## End-to-end proof — DONE

After #440, existing scoped recovery propagated the new Frax state through:

1. Economic Graph
2. Explanatory Context
3. Observer / System Memory
4. Cognitive Stack
5. Grounded Brain
6. ChatGPT Bridge
7. Learning
8. Proposal
9. Downstream Continuity
10. Project Memory
11. Intelligence Progress

Final Intelligence Progress completed successfully and later advanced `main` to the live anchor above.

Therefore:

**sfrxUSD deep-sensor pilot = DONE end-to-end.**

Do not reopen unless fresh production evidence proves a regression.

## Active resume point — Fraxlend audit

Fraxlend implementation has NOT yet started at this checkpoint.

Current task is still read-only design/audit.

Goal:

Identify the smallest lawful Fraxlend measurement atom that fits the existing Frax Economic Graph contract.

Fraxlend must be treated as pair/market scoped, not as one synthetic protocol-wide APR.

Intended model:

`pair identity -> pair accounting -> utilization -> borrowing economics -> fToken/share-price history`

Potential direct measurable fields:

- canonical pair identity;
- asset;
- collateral asset;
- total supplied assets;
- total borrowed assets;
- utilization;
- current borrow-rate state;
- fToken `totalAssets` / `totalSupply`;
- fToken share price;
- later, interval lender-side embedded yield between independent published checkpoints.

## Exact questions to prove before code

### 1. Canonical pair registry / deployment identity

Do not hard-code a random Fraxlend Pair discovered through search.

Find an official/pinned/canonically trusted registry or deployment source with deterministic market identity.

### 2. Existing Frax surface mapping

Inspect live Economic Graph Frax surfaces and determine:

- which existing UNKNOWN surfaces correspond to Fraxlend;
- whether utilization / borrow-rate state / fToken share price already fit existing semantics;
- whether implementation only promotes an existing surface from UNKNOWN to MEASURED;
- whether any desired field would require a genuinely new semantic/methodology surface.

If new methodology is required, STOP at the explicit methodology boundary before implementation.

### 3. Exact onchain fields and units

For the selected canonical Pair prove:

- exact ABI calls;
- units/scaling;
- pair accounting semantics;
- utilization formula;
- borrow-rate convention;
- fToken share-price reproduction;
- exact-block consistency.

### 4. Bounded scope

Do not enumerate every Fraxlend market in the first implementation.

Prefer one canonically relevant representative Pair, prove the schema, then replicate.

## Lawful implementation shape if audit is GREEN

1. use the existing Economic Graph workflow/writer;
2. add one read-only Fraxlend adapter;
3. read one exact Ethereum block;
4. identify one canonical Pair;
5. capture deterministic pair accounting;
6. derive utilization mechanically;
7. capture current rate state without inventing annualization methodology;
8. capture fToken share-price state;
9. first longitudinal interval = `WARMING`;
10. compare only with last published canonical checkpoint;
11. fail closed to UNKNOWN if evidence is unavailable;
12. add deterministic canary/static proof;
13. require physical production artifact proof;
14. require downstream Explanatory -> Brain -> Learning proof if depth changes;
15. no new workflow / cron / writer / orchestrator.

## Sensor expansion discipline

Preferred pattern:

**existing writer + richer evidence**

not:

**workflow-per-sensor / scheduler-per-sensor / new orchestration layer**

Preserve:

- native cadence;
- exact provenance;
- deterministic identity;
- `UNKNOWN != 0`;
- `WARMING` when one checkpoint is insufficient;
- no fabricated historical depth;
- no silent correlation -> causality promotion;
- no execution/recommendation/allocation authority.

## Prospective learning

Existing prospective machinery should be reused, not rebuilt.

Historical preserved audit:

- branch: `checkpoint/prospective-native-period-audit-20260828`
- historical commit: `e261185a4b813968947e15de47b44849eb43e41a`

Potential first prospective pilot remains Curve weekly native-period evidence only if deterministic non-overlapping period identity/provenance is proven.

## Cloudflare during sensor work

Cloudflare does not block GitHub-side sensor/Graph/Brain/Memory/Learning work.

It only blocks fresh public-site deployment until quota reset.

Do not make Fraxlend or protocol-intelligence work wait for Cloudflare.

## Exact future-chat resume order

1. live `CURRENT.md`
2. fresh `main`
3. latest continuity
4. Router / smallest task-specific canon set
5. verify #437-#440 remain in production and no rollback occurred
6. inspect live Frax Graph depth and latest sfrxUSD checkpoint
7. if a second independent sfrxUSD checkpoint exists, verify whether the first interval yield materialized lawfully
8. resume Fraxlend read-only audit
9. prove canonical Fraxlend Pair registry/identity
10. map official Pair fields to existing Frax Economic Graph surfaces
11. choose one smallest pair-level atom
12. implement only if no methodology boundary is crossed
13. use existing Economic Graph writer
14. require exact tests and physical production proof
15. verify downstream Explanatory -> Brain -> Learning propagation
16. close one atom before expanding further

Do not restart orchestration work.
Do not prioritize Aerodrome/Velodrome yet.
Do not create a new forecasting subsystem.
Do not fabricate history.

## Final checkpoint statement

**Orchestration/currentness = CLOSED / FREEZE.**

**sfrxUSD deep sensor = DONE end-to-end.**

**Frax depth-aware downstream compatibility = DONE.**

**Fraxlend = next active read-only audit; implementation not yet started.**

Next exact action:

> prove canonical Fraxlend Pair identity + exact measurable fields + existing surface mapping, then implement one bounded atom only if lawful.
