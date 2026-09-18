# THE HOLDING — P12 ve33 VERIFIER ROOT-CAUSE DELTA
## 2026-09-18 · preparation only · do not merge before P10 acceptance

Authority: observation / future cleanup planning only  
`executionAuthority = none`

This delta reviews Runtime Reliability issue #792 without changing production code, workflow authority, accounting methodology, or `main`.

---

## Incident

Issue: `#792 [Runtime Reliability] repeated-failure · verify-ve33-accounting`

Recorded history:
- first observed: `2026-09-12T03:59:28.736Z` · 11 consecutive production failures;
- recurrence: `2026-09-12T04:59:38.191Z` · 12 consecutive production failures;
- recurrence: `2026-09-13T01:23:45.059Z` · 3 consecutive production failures;
- observer root cause remained `UNKNOWN_UNTIL_REVIEWED`.

Post-review classification:

**HISTORICAL WORKFLOW-COMPILATION FAILURE · ROOT CAUSE IDENTIFIED · STRONG CLOSE CANDIDATE AFTER FINAL RECURRENCE CHECK**

---

## Exact failure class

The historical `verify-ve33-accounting.yml` contained this environment scalar in the exact-tx transient ClaimRewards diagnostic:

```yaml
VE33_TRANSIENT_TX_HASHES: 0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153
```

The `0x...` value was left unquoted. For GitHub Actions workflow parsing/schema purposes, this is unsafe because a transaction hash must be preserved as a string scalar, not interpreted through YAML numeric/scalar typing.

This was repaired explicitly by commit:

`177841d6954cc852cc59c592feea4d3246e74625`  
`fix: quote ve33 transient tx hash workflow scalar`

The patch was exactly:

```diff
- VE33_TRANSIENT_TX_HASHES: 0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153
+ VE33_TRANSIENT_TX_HASHES: '0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153'
```

This is direct root-cause evidence, not inference from later accounting output.

---

## Exact pre-fix workflow evidence

A representative historical failed verifier run:

- workflow: `Verify ve33 Factual Accounting`
- run id: `34718436409`
- run number: `293`
- event: `push`
- head SHA: `3b820c43107c8df2a226f2160850154ca2464d6a`
- created/finished effectively immediately on `2026-09-12T20:54:22Z`
- conclusion: failure

GitHub reports **zero jobs** for this run.

That is decisive boundary evidence: the accounting validator did not start and no runtime accounting assertion failed. The workflow failed before normal job execution, consistent with workflow compilation/schema invalidity.

At the same historical SHA, the workflow still contained the unquoted transaction hash scalar.

Therefore the Runtime Reliability fingerprint represented a CI/workflow-definition failure class, not evidence that ve33 factual accounting itself was red.

---

## Exact post-fix proof

On the repair head `177841d6954cc852cc59c592feea4d3246e74625`:

- branch: `fix/ve33-workflow-tx-hash-string-20260913`
- `Verify ve33 Factual Accounting`
- run id: `34750000974`
- run number: `303`
- event: `pull_request`
- conclusion: **success**
- created: `2026-09-13T09:41:02Z`
- completed: `2026-09-13T09:41:39Z`

The PR title itself described the repair intent as:

`ve33: restore workflow compilation for exact-tx diagnostic`

Other repository/security/control checks on the same repair head also completed successfully.

The issue’s last recorded recurrence at `2026-09-13T01:23:45.059Z` predates the repair commit at `2026-09-13T09:40:45Z`.

This temporal ordering is consistent with the repair closing the recorded fingerprint.

---

## Durable lesson

**Opaque identifiers that begin with numeric-looking prefixes must be explicitly quoted in workflow YAML when they are semantically strings.**

Examples include:
- transaction hashes;
- addresses/identifiers where YAML scalar typing is ambiguous;
- very large numeric-looking IDs that must remain exact strings.

The preventive invariant is:

`workflow env value is semantically an opaque identifier => serialize it explicitly as a string scalar`

The stronger CI interpretation is:

`zero-job workflow failure => investigate workflow compilation/schema/registration before diagnosing runtime business logic`

This distinction prevents a CI syntax/typing defect from being misclassified as accounting unreliability.

---

## P12 closure condition for #792

Before closing #792 during activated P12:

1. fresh-check that no recurrence of the same `verify-ve33-accounting` repeated-failure fingerprint exists after commit `177841d...`;
2. reference the zero-job pre-fix run and successful post-fix run;
3. preserve current deterministic ve33/accounting validations;
4. close the incident as a resolved historical workflow-compilation defect, not as an accounting-methodology defect.

No production code repair is currently justified for this historical fingerprint.

---

## Status consequence

#792 moves from:

`KEEP / NEEDS REVIEW`

to:

`RESOLVED_EVIDENCE / STRONG CLOSE CANDIDATE AFTER FINAL LIVE RECURRENCE CHECK`

This narrows the remaining live P12 engineering tails without weakening any accounting invariant.