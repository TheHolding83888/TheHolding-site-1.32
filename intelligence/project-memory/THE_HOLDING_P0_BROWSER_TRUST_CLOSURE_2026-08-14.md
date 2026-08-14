# THE HOLDING — P0 BROWSER TRUST CLOSURE
## 2026-08-14

This checkpoint records the practical closure path for the first two owner-approved Self-Improvement P0 items.

## What was actually found

The prior Security Sentinel reported 38 medium browser findings:
- 7 `external-script-no-sri` findings were all the same mutable Umami Cloud tracker dependency;
- 31 `dom-innerhtml` findings were regex-detected sinks across seven reviewed public files.

Source-level provenance review found no currently evidenced direct user-controlled or arbitrary external string-to-HTML execution path in those 31 current sinks. The review is documented in `security/P0_BROWSER_TRUST_REVIEW_2026-08-14.md`.

## Production change

Security Sentinel v0.2 browser-trust calibration was merged through PR #20, merge commit:

`6b8f44be20d188b026310380ad1300e5264c89ed`

The design intentionally avoids two bad fixes:
- no brittle static SRI is attached to the unversioned mutable Umami tracker merely to silence a scanner;
- no mass rewrite of 31 working renderers is performed merely to satisfy an `innerHTML` regex.

Instead:
- reviewed DOM sinks are trusted only while the exact Git blob SHA and exact sink count remain unchanged;
- any reviewed file change automatically invalidates that review and reopens the findings;
- the exact Umami vendor URL is allowed only on seven reviewed pages;
- network-enabled Security runs independently fetch and SHA-256 hash the vendor JavaScript;
- vendor-byte change, monitoring failure, unexpected content type, unreviewed use, or review expiry reopens one actionable trust finding.

## Pre-merge proof

A temporary read-only branch workflow executed the new Sentinel offline and passed with:
- status green;
- Critical 0;
- High 0;
- Medium 0;
- 31 reviewed DOM sinks across 7 reviewed files;
- 0 unreviewed DOM files;
- 1 reviewed external JavaScript dependency across 7 page usages;
- all 38 old regex findings resolved under the exact review contract.

Temporary validation workflow/file was deleted before merge and is not part of production `main`.

## Production proof contract

This memory checkpoint is also a deliberate non-`security/**` production change so the normal Security Sentinel push trigger executes the **first network-enabled v0.2 production scan**.

P0 closure is considered proven only by the fresh live Security artifact produced after this checkpoint. Expected proof:
- no Critical / High finding;
- exact DOM review remains valid;
- Umami remote bytes are successfully observed and hashed, or any monitoring/trust exception is surfaced explicitly;
- no application UI regression was introduced because the P0 fix changes Security interpretation/monitoring, not application rendering.

When this prose conflicts with fresh Security state, the fresh generated Security artifact wins.

## Build-discipline lesson

This is the intended Self-Improvement pattern:

`real finding → owner approval → bounded research → source-level classification → smallest justified fix → independent proof → production observation → Learning`

The result is not “fewer warnings at any cost.” The result is **less noise with a stronger fail-closed monitoring contract**.
