# THE HOLDING — P12 AERODROME + REPORTING ROOT-CAUSE DELTA
## 2026-09-18 · preparation only · do not merge before P10 acceptance

Authority: observation / future cleanup planning only  
`executionAuthority = none`

This delta records exact-run evidence for the two live reliability tails identified in the P12 preparation handoff. It does not change production code, workflow authority, accounting methodology, capital semantics, or `main`.

---

## 1. Aerodrome Managed Pulse · issue #815

Issue: `[Runtime Reliability] repeated-failure · update-aerodrome-managed-pulse`

### Classification

**KEEP / LIVE FAILURE CLASS / ROOT CAUSE IDENTIFIED**

The earlier P12 note correctly kept #815 open because later successful materialization did not explain the recurring failure. Exact failed-run logs now identify the current failure mechanism.

### Exact failed run

- workflow: `The Holding · Aerodrome Managed Strategy Pulse`
- run id: `35282301405`
- run number: `626`
- event: `workflow_run`
- head SHA: `196e644bf003d2b37725b058deab7d57fff83442`
- job: `managed-pulse`
- job id: `105406779945`
- failed step: `Generate managed strategy pulse`
- run created: `2026-09-17T23:02:05Z`
- run completed: `2026-09-17T23:11:02Z`

### Exact failure mechanism

The failed job resolved both configured Base RPC environment values as empty:

- `BASE_RPC_URL` — empty
- `BASE_RPC_URL_2` — empty

The managed-pulse script therefore entered its public fallback list. Its current provider-selection helper validates a candidate only with a basic `getBlockNumber()` probe.

`https://base-rpc.publicnode.com` passed that basic liveness probe and was selected.

The real managed-pulse workload then performed contract reads at explicit historical `blockTag` values. PublicNode rejected the archive-style call with HTTP 403 and the provider response:

`Archive requests require a personal token`

Therefore the observed failure is not accurately described as a generic timeout or unexplained RPC intermittency. The concrete failure class is:

> **RPC capability mismatch: provider admission proves current/basic liveness, while the actual workload requires block-tag/archive-capable contract reads.**

A provider may therefore be admitted as “alive” and still be structurally incapable of the next required operation.

### Existing reusable pattern elsewhere in The Holding

The current ve33/Reporting path already distinguishes current and archive RPC capability for Aerodrome, including a separate archive route for historical block reads. That is evidence that a capability-aware pattern already exists in the repository and should be reused rather than creating another RPC subsystem.

### P12 repair principle

Do **not** solve #815 by merely raising the workflow timeout.

The bounded repair should instead make provider admission match workload capability. Prefer reuse of the existing Base/Aerodrome current-vs-archive routing pattern where practical.

Required invariant:

`provider admitted for historical/blockTag work => provider proves the required historical/blockTag capability`

Acceptable bounded designs include:
- explicit archive-capable route for historical reads; or
- a capability probe that exercises the same class of block-tag call before admitting a fallback provider.

The implementation must remain fail-closed if no provider can prove the required capability.

No new writer, orchestrator, accounting path, capital authority, or methodology change is justified by this incident.

### Closure evidence required later

Before closing #815:
1. implement the smallest reusable capability-aware repair;
2. exact-head workflow/reliability proof must pass;
3. a real post-merge production trigger must complete GREEN;
4. physical Aerodrome managed-pulse materialization must occur on live `main`;
5. confirm the old 403/archive-capability fingerprint does not recur in the accepted run.

---

## 2. Reporting · issue #799

Issue: `[Runtime Reliability] running-too-long · update-reporting`

### Classification

**KEEP / LIVE PERFORMANCE-RELIABILITY TAIL / ROOT MECHANISM IDENTIFIED**

Reporting is alive and can physically materialize, but current exact-run profiling shows a material wall-time cost inside the safe publish/rebase path.

### Exact successful profiling run

- workflow: `Update The Holding Reporting Data`
- run id: `35263777516`
- head SHA: `79e64b6dced50137e351f31723292a9f36646719`
- job: `update-reporting`
- job id: `105356029987`
- job started: `2026-09-17T19:46:22Z`
- job completed GREEN: `2026-09-17T20:25:30Z`
- total job wall time: about 39 minutes

Relevant step costs in that accepted run included:
- initial Yield Basis evidence build: about 5m35s;
- Canonical Income Ledger build: about 1m27s;
- ve33 admission: about 2m52s;
- Yield Basis admission: about 5m19s;
- `Commit reporting snapshot`: about **22m36s**.

### Exact publish/rebase mechanism

During `Commit reporting snapshot`, `main` moved while the validated reporting candidate was being published.

The safe-writer path correctly fetched/rebased the latest `origin/main`, but after rebase it rebuilt the full heavy reporting stack again before amending/pushing the candidate.

That rebuild included the expensive evidence/accounting pipeline rather than only re-validating whether the intervening `main` drift was relevant to Reporting inputs.

In the inspected GREEN run, the post-rebase rebuild consumed most of the ~22m36s publish step. The run eventually published successfully, so the writer is not dead; the reliability concern is excessive recomputation under repository drift.

### Interpretation

The conservative safe-writer behavior has a legitimate purpose: it prevents publishing a reporting snapshot against changed relevant inputs.

However, the project now has an explicit **Main Drift Triage** invariant: unrelated generated/data-only drift should not automatically invalidate an otherwise correct candidate, while relevant dependency drift must trigger fresh proof/recomputation.

Therefore the P12 opportunity is not “remove safety”. It is:

> **make Reporting rebase behavior dependency-aware so unrelated `main` drift does not force a full expensive evidence rebuild.**

### Bounded optimization principle

Before implementation, define the actual deterministic Reporting input boundary.

Then, after a publish-time rebase:

- if relevant Reporting inputs / code / policy changed → recompute and re-prove;
- if only unrelated repository/generated paths changed → reuse the already validated candidate and run only the necessary bounded validation before publish;
- if the change cannot be classified safely → fail closed / recompute.

This should reuse existing Main Drift Triage and validated-snapshot concepts. Do not revive stale PR #717 wholesale and do not create a parallel writer.

Do **not** solve #799 merely by extending the timeout or weakening factual accounting/evidence coverage.

### Closure evidence required later

Before closing #799:
1. establish the Reporting deterministic input boundary;
2. prove exact-head safe-writer behavior for both relevant and unrelated drift;
3. preserve Canonical Income Ledger and accounting invariants;
4. verify a real production run under ordinary `main` drift;
5. demonstrate materially reduced publish/rebase wall time without skipped relevant evidence.

---

## 3. Reporting repeated-failure · issue #727

Issue: `[Runtime Reliability] repeated-failure · update-reporting`

Fingerprint: `dc55de2de08a4e67f8`

### Classification

**HISTORICAL REPEATED-FAILURE FINGERPRINT / KEEP UNTIL MAPPED**

Exact issue history shows:
- first observed `2026-09-10T05:54:49.764Z` with 7 consecutive failures;
- recurrence `2026-09-10T14:58:02.885Z` with 11 consecutive failures;
- recurrence `2026-09-11T14:58:42.931Z` with 4 consecutive failures;
- final recorded recurrence `2026-09-11T21:14:52.442Z` with 2 consecutive failures;
- issue metadata still records root cause as `UNKNOWN_UNTIL_REVIEWED`.

#727 is not the same runtime-reliability fingerprint/type as #799:
- #727 = `repeated-failure`;
- #799 = `running-too-long`.

Therefore #727 must not be mechanically closed as a duplicate of #799 merely because both subjects are `update-reporting`.

### P12 rule

Use the Reporting historical run timeline to determine whether #727’s repeated-failure fingerprint maps to a reviewed historical repair. If that mapping cannot be established economically, retain it as reviewed historical/unattributed operational memory rather than inventing a cause.

#799 remains independently live because it represents current long-runtime behavior.

---

## 4. Combined P12 conclusion

The two current live tails are now more precise:

### Aerodrome #815
Not “random timeout”. The current observed failure class is **basic RPC liveness admitted a provider that lacked required archive/blockTag capability**.

### Reporting #799
Not “dead reporting”. The writer is alive, but **publish-time `main` drift can trigger a full expensive rebuild of an already validated heavy reporting stack**, materially increasing wall time.

### Reporting #727
A separate historical `repeated-failure` fingerprint whose exact historical repair still needs attribution. It must not be silently collapsed into #799.

These findings narrow future P12 implementation work without changing production while P10 Stable Capital acceptance is still waiting.

The preferred direction remains:

`reuse existing capability patterns + dependency-aware drift triage + fail closed when evidence is insufficient`

—not more timeouts, duplicate writers, new orchestration loops, or weakened evidence.