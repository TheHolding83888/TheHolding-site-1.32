# P0 Browser Trust Review — 2026-08-14

## Scope

Two owner-approved P0 findings were reviewed:

1. seven `external-script-no-sri` findings for `https://cloud.umami.is/script.js`;
2. thirty-one `dom-innerhtml` findings across seven public files.

## Conclusion — Umami Cloud

All seven external-script findings are one dependency, not seven different mechanisms.

The dependency is intentionally used for privacy-focused analytics. The reviewed URL is unversioned and mutable. Umami's official documentation supports proxying or self-hosting the tracker and explicitly warns that a self-hosted copy must be refreshed when the tracker changes.

Decision for this phase:
- do **not** apply static SRI to the mutable unversioned tracker;
- do **not** add self-hosting/proxy plumbing solely to silence the finding;
- retain the exact vendor dependency under an explicit reviewed trust policy;
- independently hash the remote JavaScript on Security Sentinel scans;
- reopen review on remote byte change, monitoring failure, unexpected content type, use on an unreviewed page, or review expiry.

This preserves analytics while converting seven repetitive findings into one monitored supply-chain boundary.

Official references:
- https://docs.umami.is/docs/bypass-ad-blockers
- https://docs.umami.is/docs/tracker-configuration

## Conclusion — innerHTML

The 31 reported sinks were reviewed by source family.

Observed provenance:
- `05081966_calculator/index.html`: user amount is coerced through `Number()`; HTML labels/styles are local constants;
- `05081966/index.html`, `05081966_company/index.html`, `yieldring/index.html`: asset metadata is hardcoded; fetched market prices enter rendered HTML only after numeric arithmetic/formatting;
- `defitea/index.html`, `yield-reports/index.html`: same-origin canonical Reporting Layer data; plotted/financial values are numerically coerced and displayed dates/months are controlled formatting;
- `companies/index.html`: reviewed sinks render static registry/i18n structures and same-origin canonical Company / Stable / Rewards / Reporting artifacts. No URL/search/form/user string was found routed directly into the reviewed assignments.

No currently evidenced user-controlled or arbitrary external string-to-HTML path was found in this P0 review.

Decision for this phase:
- do **not** rewrite 31 working renderers merely to satisfy a regex;
- bind the review to the exact Git blob SHA and exact sink count of each reviewed file;
- if any reviewed file changes, automatically invalidate its review and reopen its `innerHTML` findings.

This reduces false-positive noise without creating a permanent allowlist.

## Safety boundary

This review does not declare `innerHTML` or third-party JavaScript inherently safe. It records the exact current provenance/trust decision and makes that decision fail closed when the reviewed bytes change.
