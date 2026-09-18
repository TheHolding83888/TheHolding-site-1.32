# THE HOLDING — P12 ECONOMIC GRAPH RELIABILITY DELTA
## 2026-09-18 · preparation only · do not merge before P10 acceptance

Authority: observation / future cleanup planning only  
`executionAuthority = none`

## #370 — repeated-failure · update-economic-graph

Classification: **CURRENTLY HEALTHY / HISTORICAL ROOT CAUSE UNRESOLVED**

Evidence:
- first observed 2026-08-26;
- multiple recurrences persisted through 2026-09-13;
- latest recorded recurrence: `2026-09-13T06:44:16Z`, 3 consecutive production failures;
- issue still says `Root cause: UNKNOWN_UNTIL_REVIEWED`;
- after the latest recorded recurrence, the canonical Economic Graph has physically materialized many times on `main`;
- fresh examples include `d81f0a3f0475e2006964f02ebe7aae7c5a8935b6` at 2026-09-18T00:48:37Z and numerous 2026-09-16/17 materializations.

Interpretation:
- there is no evidence of a current dead Economic Graph writer;
- later success alone does not identify or erase the historical failure class;
- ordinary Graph publication must not be conflated with the separate `resume-economic-graph-after-code-change` recovery workflow tracked by #778.

P12 action:
- keep #370 out of the immediate strong-close batch unless the old failure fingerprint can be mapped to a reviewed repair or exact old-run cause;
- if no exact root cause can be recovered economically, classify it explicitly as reviewed historical/unattributed rather than inventing a cause;
- do not change Graph economics, freshness guards, or writer topology merely to close issue metadata.

## #383 — critical-handoff-miss · Economic Graph → Explanatory Context

Classification: **CURRENT CHAIN HEALTHY / HISTORICAL ROOT CAUSE UNRESOLVED**

Evidence:
- incident means Economic Graph succeeded but Explanatory Context did not materialize within 60 minutes;
- recurrences were recorded from 2026-08-26 through 2026-09-13;
- latest recorded recurrence: `2026-09-13T12:41:50Z`;
- current `update-explanatory-context.yml` has explicit successful-main `workflow_run` wakeups from `The Holding · Economic Graph` and `The Holding · Comparative Intelligence`, plus push wakeup on the materialized Economic Graph JSON;
- production currently shows repeated physical Graph → Explanatory pairings after the last recorded incident;
- fresh pair: Economic Graph `d81f0a3f0475e2006964f02ebe7aae7c5a8935b6` at 00:48:37Z → Explanatory `ca72347e1dd7352131f11e7dbd58f40439f5939b` at 00:49:37Z on 2026-09-18;
- many additional paired materializations exist on 2026-09-16/17.

Relevant historical reliability architecture already present:
- #373 explicitly bound Comparative → Explanatory;
- #390 partitioned PR and production concurrency while preserving serialized production;
- #393 serialized Graph-to-Memory recovery to prevent premature Explanatory execution against not-yet-materialized Graph evidence;
- #395 introduced dependency-scoped recovery freshness while retaining global cognition fail-closed;
- #396 aligned the Explanatory recovery canary with the scoped recovery contract.

Caution:
None of those facts alone proves which exact repair eliminated the latest #383 fingerprint. Do not retroactively assign a root cause without exact evidence.

P12 action:
- treat the current Graph → Explanatory handoff as operationally healthy;
- keep #383 in historical-root-cause review rather than immediate bulk closure;
- if issue closure is later chosen without recoverable exact cause, document that it is `reviewed historical / no current recurrence / exact old cause unrecoverable`, not `fixed by <guessed PR>`.

## Combined conclusion

The current Economic Graph → Explanatory path is materially alive and repeatedly publishing. The remaining open issue metadata is primarily **unreconciled historical operational memory**, not evidence that the current canonical chain is broken.

P12 must preserve this distinction:

`current production health != historical root-cause attribution`

Do not create a new orchestrator, duplicate writer, extra wakeup, or weakened guard merely to make old runtime issues disappear.