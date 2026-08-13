# The Holding — Cognitive Stack Reliability v0.2

This package turns the current Brain path into a coherent one-button manual refresh.

## Canonical chain

`Security Sentinel`
→ `Grounded Brain`
→ `ChatGPT Bridge`
→ `Cognitive Stack State`
→ human-triggered ChatGPT interpretation

## What is stronger now

### 1. Exact upstream freshness

The Bridge no longer accepts a Grounded Brain merely because it is "young enough."

Before a Bridge can be emitted, the reusable upstream guard re-hashes the exact
current canonical files that the Grounded Brain claims to represent:

- `intelligence/change-intelligence.json`
- `intelligence/system-memory.json`
- `security/security-intelligence.json`
- `security/security-memory.json`
- `intelligence/brain-policy.json`

Every current byte hash must equal the SHA recorded inside `brain-intelligence.json`.

If any source moved after the Brain run, Bridge generation fails closed:

`Grounded Brain is not current relative to canonical upstream state`

The fix is deterministic: refresh Grounded Brain first.

### 2. One-button manual stack refresh

New workflow:

`The Holding Brain · Refresh Cognitive Stack`

It performs, in one job:

1. fresh Security Sentinel scan;
2. security contract validation;
3. critical-security gate;
4. Grounded Brain rebuild;
5. Grounded Brain validation;
6. upstream-bound ChatGPT Bridge rebuild;
7. Bridge validation;
8. Cognitive Stack state generation;
9. end-to-end chain verification;
10. one atomic generated-state commit;
11. fetch/rebase + post-rebase full-chain verification;
12. push + remote HEAD verification.

It shares the existing `security-sentinel-main` concurrency group, so it cannot race
the standalone Security Sentinel workflow.

### 3. Atomic cognitive generation

The manual stack refresh publishes Security + Brain + Bridge + stack-state generated
artifacts together.

No source engines, methodologies, workflows or company source data are staged by the
writer.

### 4. One machine-readable readiness point

New:

`/intelligence/cognitive-stack-state.json`

It tells future tooling and ChatGPT:

- whether the whole chain is current;
- whether manual interpretation is ready;
- whether immediate human review is required;
- exact component hashes;
- exact upstream vector;
- security severity counts;
- Brain/Bridge status;
- zero-API / zero-model-call / zero-execution boundaries;
- one chain integrity hash.

### 5. Components remain useful independently

Existing scheduled workflows stay in place:

- Security Sentinel
- Grounded Brain
- ChatGPT Bridge

The new integrated workflow is a high-confidence manual refresh/recovery path.

After this package proves stable in production, it can later become the canonical
orchestrated schedule if desired.
