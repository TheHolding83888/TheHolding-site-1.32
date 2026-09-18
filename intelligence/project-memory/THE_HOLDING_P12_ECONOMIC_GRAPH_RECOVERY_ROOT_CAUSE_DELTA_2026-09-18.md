# THE HOLDING — P12 ECONOMIC GRAPH RECOVERY ROOT-CAUSE DELTA
## 2026-09-18 · preparation only · do not merge before P10 acceptance

Authority: observation / future cleanup planning only  
`executionAuthority = none`

This delta resolves the previously unknown failure mechanism behind Runtime Reliability issue #778 without changing production code, workflows, methodology, or `main`.

---

## Incident

Issue: `#778 [Runtime Reliability] repeated-failure · resume-economic-graph-after-code-change`

Classification before review: **KEEP / NEEDS REVIEW**.

Classification after exact-run review:

**LIVE/RECENT ORCHESTRATION COHERENCE RACE · ROOT CAUSE IDENTIFIED · DO NOT WEAKEN HASH GUARDS**

---

## Exact failing recovery run

Recovery workflow:
- name: `Resume Economic Graph After Code Change`
- run id: `35108897555`
- run number: `71`
- event: `push`
- triggering head: `91e072976008fe9b704a73194251ab1b447d4536`
- triggering commit: `Reliability: bound Aerodrome vote-history RPC failover`
- created: `2026-09-16T14:29:39Z`
- completed: `2026-09-16T14:31:42Z`
- conclusion: failure

Recovery wrapper job:
- job id: `104837158365`

The wrapper itself behaved correctly:
1. checked out canonical `main`;
2. verified the recovery package;
3. dispatched the canonical `update-economic-graph.yml` workflow;
4. identified the dispatched child run;
5. waited for the child run with `gh run watch --exit-status`;
6. propagated the child failure instead of masking it.

Therefore the failure is **not** a broken dispatch helper or inability to identify/wait for the child workflow.

---

## Exact failing canonical Economic Graph child

Child workflow:
- canonical Economic Graph run id: `35109008081`
- run number: `691`
- child job id: `104837534733`
- canonical checkout at child runtime: `e99e2cd8f49a246d215b615f1de99d3302d083f7`

Failure occurred in:

`node intelligence/economic-graph/economic-graph-canonical-runner.mjs`

Exact error:

`Error: Curve gauge flow lost exact round-flow SHA-256 binding`

Thrown from:

`intelligence/economic-graph/vlcvx-votium-deep-evidence.mjs`

The guard compares the exact SHA-256 of the current `vlcvx-votium-round-flow.json` bytes against the SHA recorded in `vlcvx-votium-curve-gauge-flow.json`.

This fail-closed guard is correct and must remain.

---

## Proven generation mismatch at the failed checkout

At the failed canonical checkout:

### Fresh upstream round flow

`intelligence/economic-graph/vlcvx-votium-round-flow.json`
- generatedAt: `2026-09-16T14:13:38.401Z`

The immediately downstream voting provenance had already refreshed:

`intelligence/economic-graph/vlcvx-votium-snapshot-proof.json`
- generatedAt: `2026-09-16T14:15:02.899Z`
- `sourceBinding.roundFlowSha256 = db0dc47fd2a77a694e02a44877d98e4aa8892ee88d1bb0ba759065038aaaf31e`

This proves the current round-flow generation was represented by SHA `db0dc47f...` in the ordered evidence chain.

### Stale downstream Curve gauge flow

At the same failed checkout:

`intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json`
- generatedAt: `2026-09-12T06:08:33.690Z`
- `sourceBinding.roundFlowSha256 = e1c332829489e1093815442fbc5fd3dc42a23289e25f6c65cf21607307d49e07`

So the Graph was presented with two incompatible evidence generations:

- current Round Flow generation: `db0dc47f...`
- retained/stale Gauge Flow expectation: `e1c33282...`

The Graph correctly refused to combine them.

---

## Timeline proves a mid-cascade dispatch

Relevant materialization timeline on 2026-09-16:

1. `14:13:43Z` — commit `2f1c9aed...` · `intelligence: refresh vlcvx votium round flow`
2. `14:15:05Z` — commit `c910a864...` · `intelligence: refresh vlcvx votium voting provenance`
3. `14:29:39Z` — recovery wrapper run #71 starts
4. `~14:31Z` — canonical Economic Graph child fails on stale Gauge Flow SHA binding
5. `15:19:06Z` — commit `83b8d1ac...` · `intelligence: refresh vlcvx votium curve gauge flow`
6. `15:19:53Z` — commit `92a63508...` · `intelligence: refresh vlcvx votium curve pool context`

The repository already contains explicit ordered evidence workflow design:

`Round Flow → Voting Provenance → Curve Gauge Flow → Curve Pool Context`

Existing reliability commits include:
- `1d6a2fa3...` · `reliability: order voting provenance after round flow`
- `7be6bd3b...` · `reliability: order gauge flow and isolate PR network proof`
- `6d0b9867...` · `reliability: order pool context after gauge flow`

The failure happened because the independent recovery workflow dispatched canonical Economic Graph **before that already-ordered evidence cascade had reached Gauge Flow / Pool Context coherence**.

---

## Root cause

> **Economic Graph recovery readiness race: the code-change recovery wrapper can dispatch canonical Graph while a dependent vlCVX/Votium evidence cascade is between generations. The canonical Graph correctly rejects the mixed generation through exact SHA binding.**

This is not:
- a bad SHA guard;
- a corrupt Graph writer;
- a broken recovery dispatch helper;
- proof that the dependent evidence should be loosely accepted.

It is an orchestration/readiness problem.

Simple model:

`upstream evidence changed → downstream evidence still catching up → recovery dispatches Graph too early → exact-binding guard correctly fails`

---

## Bounded P12 repair principle

Do **not** weaken or remove exact SHA bindings.

Do **not** paper over this with retries that blindly rerun Graph against the same incoherent source set.

Prefer the smallest reuse of existing evidence-handoff semantics.

Before recovery dispatches canonical Economic Graph, prove that the required dependent evidence chain is coherent at the current `main` generation.

At minimum, readiness must preserve these bindings:

1. Voting Provenance → exact Round Flow SHA
2. Curve Gauge Flow → exact Round Flow SHA
3. Curve Gauge Flow → exact Voting Provenance SHA
4. Curve Pool Context → exact Curve Gauge Flow SHA

If coherent:
- dispatch Graph.

If the chain is visibly mid-refresh:
- do not claim Graph failure;
- either bounded-wait for the already-running ordered evidence chain to converge, or exit as a clearly classified deferred/no-op state and rely on a proven later canonical trigger.

If coherence cannot be established:
- fail closed.

The repair must not create a parallel evidence chain or a second Economic Graph writer.

---

## Preventive invariant

`Economic Graph recovery dispatch => all exact-bound dependent evidence surfaces are mutually generation-coherent`

Equivalent operational rule:

**Recovery may wait for truth to finish materializing; it may not force the Graph to combine half-old / half-new truth.**

---

## Closure evidence required for #778

Before closing issue #778:

1. implement a bounded pre-dispatch evidence-coherence/readiness guard using existing handoff semantics;
2. prove a coherent path dispatches and completes canonical Economic Graph;
3. prove an intentionally mixed-generation fixture is deferred/fails closed without weakening SHA checks;
4. verify a real post-merge recovery trigger on `main`;
5. verify physical Economic Graph materialization after that trigger;
6. confirm no recurrence of the `lost exact round-flow SHA-256 binding` class in the accepted recovery path.

---

## P12 status consequence

#778 should remain open for now, but it is no longer `UNKNOWN_UNTIL_REVIEWED` from an engineering standpoint.

The future repair is narrow and architectural:

`existing ordered evidence chain + readiness guard + exact SHA preservation`

—not more writers, weaker validation, or broader authority.