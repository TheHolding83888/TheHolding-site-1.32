# Accounting Cross-Month Attribution Proof

Scope: diagnostic boundary handling only.

- Canonical Income Ledger remains the sole factual earned-income authority.
- A cross-month event may be treated as already allocated by Accounting Coverage only when the canonical event itself carries a valid `periodAttributionMonth` equal to the accounting month selected by its canonical economic date.
- This rule never creates, reallocates, estimates, backfills, or reprices income.
- Cross-month evidence without that explicit canonical marker remains unresolved and retains `cross-month-boundary-requires-explicit-allocation`.
- Reconciliation uses `crossMonthUnresolvedCount` for boundary-review while retaining raw and explicitly-attributed counts for auditability.
- Reference APR remains non-factual and cannot fill historical gaps.
- `UNKNOWN != 0`.
- `executionAuthority = none`.
