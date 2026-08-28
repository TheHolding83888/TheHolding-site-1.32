# THE HOLDING — ORCHESTRATION / CURRENTNESS CLOSURE & FREEZE

**Date:** 2026-08-28  
**Status:** ENGINEERING MILESTONE CLOSED / CONTROL PLANE FREEZE  
**Authority:** executionAuthority = none

## Purpose

This continuity closes the inherited orchestration / Market Data / TVL currentness package without reopening generic infrastructure work.

The milestone is considered complete when repo-controlled truthfulness and writer behavior are proven, while provider-owned delivery failures are classified explicitly rather than converted into new internal orchestration.

## Fresh closure evidence

Closure was re-verified from fresh live `main` rather than historical handoff identifiers.

- Fresh `main` before this closure branch: `88c741282759fce4123de8314826e7c6d6786c89`.
- PR #434 (`Public Capital · label generated valuation as snapshot`) merged successfully.
- PR #434 changed only the public currentness claim; valuation methodology, workflow topology, schedule, authority, and freshness threshold were not changed.
- Public Capital now labels generated valuation as a snapshot rather than making an unqualified `Current capital` claim.
- Canonical `market-data.json` at closure evidence time:
  - `generatedAt`: `2026-08-28T09:40:48.932Z`
  - `status`: `ok`
  - 26 / 26 assets fresh
  - stale fallback count: 0
  - unknown count: 0
- Canonical `public-capital-state.json` at closure evidence time:
  - `generatedAt`: `2026-08-28T09:40:48.973Z`
  - `status`: `ok`
  - same upstream Market Data observation
  - fund ecosystem TVL and company network TVL both materialized successfully.
- No live `in_progress` GitHub Actions runs at closure check.
- No queued runs on `main` at closure check.

## Shared Market Data scheduler classification

The Shared Market Data workflow remains one canonical writer.

Current schedule definition uses four wake slots per hour:

- `:07`
- `:22`
- `:37`
- `:52`

The `:22/:52` slots are same-workflow bounded recovery attempts, not a second writer, watchdog, dispatcher, or independent scheduler.

The scheduled admission logic suppresses unnecessary retries when canonical Market Data age is below 25 minutes.

`workflowDispatchAuthority=false` remains preserved.

### Natural schedule evidence

The latest natural Shared Market Data run located during closure verification was:

- workflow: `The Holding Market Data · Shared Refresh`
- workflow id: `338044849`
- run number: `252`
- event: `schedule`
- status: completed
- conclusion: success
- created: `2026-08-27T23:59:56Z`

On 2026-08-28, GitHub materialized only a small subset of repository cron events and did not materialize the expected Shared Market Data natural schedule slots during the closure observation window.

This is classified as **WAITING EXTERNAL PROVIDER DELIVERY / GitHub scheduler materialization gap**, not as an open defect in the Shared Market Data writer.

Why:

1. the workflow is active and its live schedule definition is present on `main`;
2. the writer executes successfully when awakened through existing lawful repository events;
3. fresh canonical Market Data and Public Capital state physically materialized after PR #434;
4. the same day showed missing natural schedule materialization across more than one cron workflow, so the symptom is not isolated to Shared Market Data;
5. adding another GitHub cron, dispatcher, watchdog, or broader workflow authority would remain in the same provider failure domain and would not create genuine independent reliability.

## Public currentness safety — DONE

The repo-controlled false-currentness gap is closed.

A stale generated valuation may remain useful as the last known snapshot, but the public client no longer silently represents that value as an unqualified current observation.

Permanent semantic rule:

- fresh trustworthy valuation -> normal current snapshot display;
- older but still trustworthy last-known valuation -> may remain visible as a snapshot / last-known value, but must not silently claim freshness;
- insufficient trustworthy valuation -> UNKNOWN / unavailable, never fabricated zero.

`UNKNOWN != 0` remains mandatory.

## Cloudflare deployment tail

Post-merge Production Deployment Smoke for PR #434 failed at the step `Wait for successful Cloudflare production build`.

This is the already-proven external Cloudflare Workers Builds quota tail, not a JS / valuation / Market Data regression.

Classification: **WAITING EXTERNAL PROVIDER / QUOTA RESET**.

Do not add a bypass deployment architecture solely to evade the known monthly quota boundary.

After quota reset, validate only:

1. first Workers Build succeeds;
2. deployed static timestamps align with fresh `main`;
3. live TVL aligns with canonical Public Capital state.

Then close the Cloudflare tail.

## Historical queued runs

At closure check, total queued runs across the repository remained 21, while queued runs on `main` were 0 and live `in_progress` runs were 0.

These queued runs are inherited historical residue on stale PR branches. Prior audit classified 20 / 21 as belonging to closed superseded PR #386 and 1 / 21 to long-merged PR #150.

There is no evidence that these runs currently block `main` or that they caused the GitHub natural schedule materialization gap.

Classification: **NON-BLOCKING HISTORICAL RESIDUE**.

Do not expand cancellation authority or build a queue-management subsystem solely to remove these historical entries.

## Inherited durable closure checkpoints

This continuity inherits, rather than replaces, the prior durable closure facts required by Project Memory verification. These are historical/canonical checkpoints; changing production truth must still be re-read from live artifacts and exact workflow evidence.

- **PROJECT X + HYPERLEND CLOSED** remains a durable completed milestone.
- **resolver completeness != promotion completeness** remains the semantic guard against promoting incomplete evidence.
- **HyperLend base lending interest = Compounded / Embedded** remains the accounting classification.
- **rewardAssetCount = 0** remains a valid explicit no-reward-asset state where canonically established; zero is not inferred from missing evidence.
- **generic implementation permission != merge permission** remains an authority boundary.
- **GREEN workflow != physically materialized production artifact** remains a production-proof rule.
- Market Data / onchain tracking retained its **26/26** reviewed canonical asset coverage under **per-asset-authority** semantics; CoinGecko remains the bounded fallback/sanity lane, not a browser price authority.
- Market Data **divergence** telemetry and the durable milestones represented by **PR #227** and **PR #233** remain inherited.
- **Market Data / onchain tracking: fat check** remains a prior closed production milestone; this continuity adds the later scheduler/currentness boundary without erasing that writer/authority closure.
- **Autonomous Observational / World Learning** remains the primary always-on learning lane; **Owner Decision → Outcome Experience** remains a sparse complementary lane.
- **Minimum recovery packet** discipline remains mandatory: CURRENT -> latest continuity -> Router -> smallest task-specific canon/live evidence set.
- **Pendle / sPENDLE** remains fail-closed where current independent evidence is insufficient; absence of promotion is not itself a defect.
- executionAuthority: **none** remains the active authority boundary.

## Final milestone classification

### DONE

- Shared Market Data writer architecture
- one canonical writer / no duplicate production writer
- per-asset authority materialization
- canonical Market Data physical state
- canonical Public Capital physical state
- 26 / 26 fresh coverage at closure evidence time
- public false-currentness claim repair
- repo-side currentness truthfulness
- no live production queue blocker
- no execution / capital / policy mutation authority expansion

### WAITING EXTERNAL PROOF / PROVIDER TAIL

- future GitHub natural `schedule` materialization for Shared Market Data
- Reporting natural schedule proof where still absent
- Cloudflare Workers Build recovery after monthly quota reset

These external tails remain observable, but they do **not** keep the engineering milestone open unless fresh evidence shows a new repo-controlled defect.

### NON-BLOCKING HISTORICAL RESIDUE

- 21 stale queued runs on historical PR branches

### FUTURE HARDENING

Only evidence-driven hardening is permitted. No generic orchestration optimization backlog is promoted into a closure prerequisite.

## Control Plane freeze

Effective after this continuity is merged:

**CONTROL PLANE / GENERIC ORCHESTRATION = FREEZE**

Do not reopen for:

- workflow-count reduction for its own sake;
- fan-out shaving without measured harm;
- another scheduler/watchdog inside GitHub;
- generic dispatch authority;
- universal material gates;
- broad cancellation authority;
- architecture polishing without a production defect.

Reopen only on fresh production evidence of:

- data corruption;
- repeated material reliability loss;
- unsafe authority behavior;
- repeated truthfulness failure;
- repeated material operational cost.

## Detailed final closure checkpoint

The exact post-closure evidence chain, including #435 verification history, post-merge materialization, external-provider tails, historical queue residue, freeze rules and resume law, is preserved separately at:

[`checkpoints/ORCHESTRATION_CURRENTNESS_FINAL_CLOSURE_CHECKPOINT_2026-08-28.md`](./checkpoints/ORCHESTRATION_CURRENTNESS_FINAL_CLOSURE_CHECKPOINT_2026-08-28.md)

Use that file as **detailed historical closure evidence**, not as a substitute for fresh live truth. `CURRENT.md` remains intentionally compact and generated; it should continue routing through this master continuity rather than carrying the full checkpoint payload.

Creating the checkpoint does not start the next intelligence/sensor milestone.

## Next primary milestone

After this closure, engineering focus moves away from plumbing and back to intelligence depth:

1. resume the preserved Prospective / Native-Period audit;
2. deepen Frax sensors (sfrxUSD share price, Fraxlend utilization, borrow rate, protocol revenue, revenue -> veFRAX -> cash-flow chain);
3. deepen Curve / f(x) native-period and incentive / fee / reward-unit observations;
4. build measured state / flow / driver / outcome history;
5. close bounded arithmetic attribution identities with explicit unexplained residual;
6. reuse the existing prospective evaluator for one lawful native-period pilot;
7. continue toward longitudinal Economic Graph / Capital Map / conversational-capital intelligence.

Permanent direction:

**OBSERVE -> CONNECT -> REMEMBER -> EXPLAIN -> TEST -> LEARN -> MAP -> CONVERSE**

Permanent truth rule:

> The system is allowed to be incomplete. It is not allowed to pretend.

## Resume order for a future chat

1. Read live `intelligence/project-memory/CURRENT.md`.
2. Resolve fresh `main`.
3. Load latest continuity and Router.
4. Treat this document as the closure boundary unless fresh production evidence proves a regression.
5. Do not reopen orchestration merely because GitHub or Cloudflare still has an external provider tail.
6. Use the detailed final closure checkpoint only when exact closure evidence is needed.
7. Resume the prospective / sensor milestone from preserved checkpoints and live evidence only after the owner starts that next process.
