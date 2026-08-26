# The Holding — Security Trust Review — 2026-08-26

## Scope

This review closes the browser-trust re-review opened when `companies/index.html` changed after its prior exact-blob approval.

- Reviewed main/base SHA: `c2db7945a5c7b5169ae95ba63d7fa6a57570ed30`
- Reviewed `companies/index.html` Git blob: `def951f9432bfe600f29bdbbf1c26dbd58655b0d`
- Reviewed `.innerHTML =` assignments: **18**
- Security Sentinel policy remains fail-closed: any future blob or sink-count change invalidates this approval automatically.

## DOM conclusion

All 18 reviewed assignments render controlled static/i18n structures or same-origin canonical Company, Stable, Rewards, Reporting, Economic Graph and protocol-lifecycle data. External/string fields in these reviewed render paths are escaped before insertion and numeric values are formatted/coerced. No URL, search parameter, form field or other raw user-controlled string was found routed directly into the reviewed assignments.

Decision: approve the exact blob above at sink count 18. This is not a wildcard exemption.

## Privileged trigger review

Two existing Sentinel High watch findings were re-reviewed and intentionally remain visible:

- `.github/workflows/production-boundary-guard.yml`
- `.github/workflows/production-deployment-smoke.yml`

Both use `pull_request_target`, but current permissions are read-only. The boundary guard executes verification code from the trusted base checkout and treats candidate code as data. The deployment smoke PR-target path inspects GitHub metadata/check-runs and does not execute candidate repository code.

Decision: no suppression and no Sentinel weakening. These remain explicit privileged-trigger watch items for future drift review.

## Result

- Critical security findings: **0** at reviewed baseline.
- Browser DOM re-review: **CLOSED for exact reviewed blob**.
- Remaining High findings: **2 intentional bounded watch items**, not reclassified or hidden.
- `executionAuthority`: unchanged / none.
