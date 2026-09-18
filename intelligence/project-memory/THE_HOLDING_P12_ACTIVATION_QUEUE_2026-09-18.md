# THE HOLDING — P12 ACTIVATION QUEUE
## 2026-09-18 · preparation only · activate only after P10 GREEN

Authority: evidence-backed planning only  
`executionAuthority = none`

This file converts the P12 preparation inventory and subsequent exact-run investigations into an ordered activation queue. It does not change `main`, production workflows, capital/accounting authority, or methodology.

## Hard gate

P12 remains non-active until P10 Stable Capital acceptance is physically proven through the new scheduled workflow and the required three production artifacts refresh on live `main`.

Before activation, refresh every item below against current `main`, open PR/issue state, fresh Actions and CURRENT/continuity.

---

## Queue A — metadata-only cleanup candidates

These can be handled first after the P10/P11 ordering boundary is satisfied because they do not require production-code changes, but each still needs a final live-state check before closure.

### Open PR cleanup
- #852 — superseded P10 handoff surface; close, never merge.
- #730 — superseded continuity/handoff PR; close, never merge.
- #729 — older handoff superseded by #730 and later continuity; close, never merge.
- #717 — stale Market Data retry PR; useful logic already exists in canonical `main`; close as superseded, do not merge stale head.
- #433 — historical scheduler handoff/checkpoint; close after final confirmation.
- #37 — benign Production Boundary canary explicitly marked never merge; close only after proving no current policy/rule/recovery process still depends on it remaining open. Do not delete its branch in the same batch.

### Runtime issues with reviewed resolved evidence
- #822 HyperLend — root cause/fix/proof already established via #855 and natural post-merge success; final same-fingerprint recurrence check then close.
- #369 Rewards — root cause/fix/proof established via #853 and physical downstream closure; final recurrence check then close.
- #447 Unified Capital — malformed action-pin root cause fixed by #767 with repeated later materialization; final recurrence check then close.
- #716 Market Data — same-generation ownership/handoff fix #715 plus repeated later publication; final recurrence check then close.
- #792 ve33 verifier — historical workflow-compilation defect caused by an unquoted opaque `0x...` tx-hash YAML scalar. Commit `177841d6954cc852cc59c592feea4d3246e74625` quotes the scalar; representative pre-fix run #293 had zero jobs; post-fix verifier run #303 succeeded. Final same-fingerprint recurrence check then close as CI/workflow-definition incident, not accounting-methodology incident.

---

## Queue B — P10 freshness-dependent reliability closure

### #379 Cognitive Stack
Do not patch around the guard.

Current reviewed mechanism is intentional global freshness failure while Stable Capital, Stable Index and Embedded Ledger are stale. After P10 refresh:
1. Observer/System Memory must rebind to fresh sources;
2. natural Cognitive Stack execution must succeed;
3. no same-fingerprint recurrence.

Only then close.

### #564 Explanatory → Cognitive handoff
Treat jointly with #379. After the P10 freshness restoration, require the existing natural handoff to materialize Cognitive within the expected window. Do not create a second orchestrator.

---

## Queue C — bounded engineering repairs

These have exact current/recent root causes and justify small architectural repairs after activation. They are not metadata-only.

### C1 — Aerodrome Managed Pulse #815
Root cause:
**RPC capability mismatch.** A fallback provider passed basic `getBlockNumber()` liveness but failed the real historical/blockTag contract read with 403 `Archive requests require a personal token`.

Repair principle:
- reuse existing current-vs-archive/capability-aware Base RPC patterns;
- admit a provider for historical work only if the required operation class is proven;
- fail closed if no capable provider exists;
- do not fix by timeout extension alone;
- do not create another RPC subsystem.

Acceptance:
exact-head proof → merge → real production trigger → physical Aerodrome pulse materialization → no old 403/archive-capability fingerprint.

### C2 — Economic Graph recovery #778
Root cause:
**recovery readiness race across exact-bound evidence generations.** Recovery dispatched canonical Economic Graph while the ordered vlCVX/Votium chain had fresh Round Flow / Voting Provenance but stale Curve Gauge Flow / Pool Context. The Graph correctly failed closed on exact SHA mismatch.

Repair principle:
- preserve exact SHA bindings;
- add bounded pre-dispatch generation-coherence/readiness proof using existing evidence semantics;
- coherent chain → dispatch;
- visibly mid-refresh → bounded wait or explicit deferred/no-op path relying on a proven later trigger;
- unknown/incoherent → fail closed;
- no parallel Graph writer or evidence chain.

Acceptance:
coherent fixture passes; mixed-generation fixture is safely deferred/rejected; real post-merge recovery trigger succeeds; physical Graph materializes; no recurrence of exact-binding mismatch in accepted recovery path.

### C3 — Reporting #799
Root mechanism:
**publish-time `main` drift can force a full rebuild of an already validated heavy Reporting stack.** A fresh successful run spent ~22.5 minutes inside `Commit reporting snapshot`, mostly rebuilding after rebase.

Repair principle:
- define deterministic Reporting input boundary;
- relevant input/code/policy drift → recompute/re-prove;
- unrelated `main` drift → preserve validated candidate and run bounded necessary validation;
- unclassifiable drift → fail closed/recompute;
- preserve all Canonical Income Ledger and factual evidence invariants;
- do not use timeout expansion as the primary solution;
- do not revive stale PR #717 wholesale or create a parallel writer.

Acceptance:
prove both relevant-drift and unrelated-drift cases; then real production proof with materially lower publish/rebase wall time and unchanged accounting correctness.

---

## Queue D — retain/review; no guessed closure

### #727 Reporting repeated-failure
Historical fingerprint is distinct from #799. Map its Sep 10–11 repeated failures to a reviewed historical repair if evidence supports it. Otherwise preserve as reviewed-but-unattributed operational memory. Do not pretend #799 automatically explains it.

### #456 Unified Capital → Economic Graph critical handoff miss
Current `update-economic-graph.yml` still has an explicit `workflow_run` dependency on `The Holding Capital · Unified Refresh`. Therefore the old handoff contract still exists and the incident cannot be dismissed as structurally obsolete. The issue stopped recurring after Sep 6, but an exact historical cause/fix mapping is still required before closure.

### #432 Production Deployment Smoke
Security-sensitive. Keep outside casual P12 fan-out reduction. Requires dedicated current smoke evidence and trust-boundary review.

### #565 Monthly Reports
Healthy later production is proven, but historical failure fingerprint remains unattributed. Review only if economically useful; otherwise retain as explicit historical memory.

### #370 Economic Graph
Later production healthy; old failure class still needs attribution before closure.

### #383 Economic Graph → Explanatory handoff
Current chain appears healthy; do not close solely from later success without reviewed old fingerprint/handoff evidence.

### #726 Comparative Intelligence
Fresh production healthy; old repeated-failure cause remains undocumented.

### #659 Learning Loop
Likely historical and later architecture materially improved, but exact old fingerprint-to-fix mapping is not yet proven.

---

## Queue E — fan-out reduction only after fresh audit

Reuse only the existing control plane:
- `workflow-fanout-policy.json`
- `workflow-fanout-baseline.json`
- `workflow-fanout-audit.mjs`
- Workflow Control Plane
- PR Run Supersession Controller

Rules:
- historical baseline is a ceiling, not current fleet truth;
- run fresh audit on exact live `main` after P10 closure;
- remove only proven redundant wakeups, never domain coverage;
- security-sensitive `pull_request_target` workflows are excluded from casual reduction;
- every batch gets exact-head proof and post-merge production proof.

---

## Recommended activation order

1. Re-read live truth after P10 closes.
2. Respect P11 ordering if a bounded cosmetic/current-state package is still required by roadmap.
3. P12 Batch A: superseded PRs + fully resolved runtime metadata.
4. P12 Batch B: confirm Cognitive recovery from fresh Stable Capital rather than changing the guard.
5. P12 C1/C2 first: Aerodrome capability routing and Economic Graph recovery readiness are narrow, well-understood failure classes.
6. P12 C3: Reporting dependency-aware drift optimization, because it touches a heavier accounting publication path and deserves isolated proof.
7. Fresh fan-out audit and smallest safe reduction batch.
8. Separate branch-deletion/destructive hygiene boundary; do not mix with logical cleanup without explicit owner authorization.
9. Freeze exact-head evidence for P13 real pre-private checks.

## Operating rule

P12 success is not “fewer open issues.”

P12 success is:

**fewer real failure classes, fewer ambiguous stale surfaces, less redundant runtime work, and no loss of evidence, security, accounting truth, or fail-closed behavior.**