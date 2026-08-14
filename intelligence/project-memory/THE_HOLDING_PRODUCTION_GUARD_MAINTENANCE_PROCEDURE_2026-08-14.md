# THE HOLDING — PRODUCTION GUARD MAINTENANCE PROCEDURE
## 2026-08-14

The Production Boundary Guard is intentionally self-locked. Ordinary pull requests must not be able to weaken, delete, or silently rewrite its verifier or protected workflows.

## Why a maintenance procedure exists

A guard can itself contain a defect. The first production smoke run after Guard v1 bootstrap exposed one such defect: a shell quoting error in the smoke parser. The production site and Cloudflare build were healthy; the guard test itself failed.

If the guard could freely rewrite itself through an ordinary PR, self-protection would be meaningless. Therefore guard maintenance is treated as an explicit owner-controlled administrative exception.

## Required conditions for a guard-maintenance exception

All of the following are required:

1. The owner explicitly authorizes guard maintenance in the active operating context.
2. The maintenance change is isolated to guard/security/continuity surfaces; unrelated product/runtime changes are not bundled with it.
3. A pull request is used for auditability even when the self-lock is expected to report RED because the protected guard file is intentionally changing.
4. The expected self-lock failure is documented as the reason for the administrative exception; other unexpected failures must not be ignored.
5. Cloudflare build/deployment evidence is checked independently where relevant.
6. Immediately after merge, the updated guard must return GREEN on `main`.
7. A benign canary PR must pass.
8. A deliberately invalid production-boundary canary PR must fail closed and must never be merged.
9. The incident/maintenance result is preserved in Project Memory.

## What this procedure does not authorize

- no bypass for ordinary product changes;
- no deletion of the guard because it is inconvenient;
- no wallet/signing/capital authority expansion;
- no weakening of homepage ownership, Worker route isolation, Durable Object lifecycle continuity, or deployment smoke requirements;
- no silent suppression of unrelated Security Sentinel findings.

## Current permission recommendation

ChatGPT GitHub access remains `Any changes` by default. `Allow all actions` should not be restored merely because the guard exists. A future decision to widen app permissions requires proven guard behavior plus repository rules that prevent direct unreviewed changes to protected production state.
