# The Holding — P13 Security High Review — 2026-09-19

Status: **P13 SECURITY HIGH REVIEW / BOUNDED**  
Scope: current Sentinel High findings only  
`executionAuthority = none`

## Exact review boundary

- Reviewed live `main`: `38bf508cd23476aeda220285d61060e2741654a1`
- Main commit time: `2026-09-19T15:21:35Z`
- Latest Security Intelligence present on that exact tree:
  - generatedAt: `2026-09-19T12:33:16.525Z`
  - status: `watch`
  - Critical: **0**
  - High: **2**
  - Medium: **73**
- Historical trust review used as prior evidence only: `security/SECURITY_TRUST_REVIEW_2026-08-26.md`

This review does not suppress findings, reduce Sentinel sensitivity, or claim that all P13 gates are closed. It answers only the P13 question: **are both current High privileged-trigger findings freshly reviewed/fixed/classified with evidence?**

## High 1 — Production Boundary Guard

Finding:

`.github/workflows/production-boundary-guard.yml` uses `pull_request_target`.

Fresh current-state review on the exact main above:

- workflow permissions are `contents: read` and `pull-requests: read`;
- the trusted guard baseline is checked out from the PR base SHA under `guard-base`;
- the candidate head is checked out separately under `candidate`;
- the candidate checkout is **not executed**;
- verification logic is executed only from the trusted baseline:
  - `guard-base/verification/production-boundary-self-lock-v1.mjs`
  - `guard-base/verification/production-boundary-guard-v1.mjs`
- candidate repository content is therefore treated as inspection data by trusted-base verification code.

Classification: **REVIEWED / ACCEPTED BOUNDED WATCH / NON-BLOCKING FOR P13**.

Reopen immediately if any of these drift conditions appear:

- write permission is added;
- secrets or privileged credentials are exposed to candidate-controlled execution;
- verification code is executed from the candidate checkout;
- candidate-controlled scripts/actions are invoked;
- trusted-base/candidate isolation is removed or materially weakened.

## High 2 — Production Deployment Smoke

Finding:

`.github/workflows/production-deployment-smoke.yml` uses `pull_request_target`.

Fresh current-state review on the exact main above:

- workflow permissions are `contents: read`, `checks: read`, `pull-requests: read`;
- the `pull_request_target` job is only `cloudflare-preview-build-gate`;
- that job does **not** checkout or execute candidate repository code;
- it reads PR changed-file metadata and check-runs through `gh api`;
- for deployment-sensitive changes it waits for the Cloudflare build check attached to the PR head SHA and validates the resulting Version ID;
- the live production checkout/runtime smoke path is gated to `push` or `workflow_dispatch`, not `pull_request_target`.

Classification: **REVIEWED / ACCEPTED BOUNDED WATCH / NON-BLOCKING FOR P13**.

Reopen immediately if any of these drift conditions appear:

- write permission is added;
- secrets or privileged credentials are exposed to candidate-controlled execution;
- candidate code is checked out/executed in the PR-target job;
- PR-controlled shell/script content becomes executable;
- the event/job boundary is widened so production execution runs under PR-target.

## P13 security decision for current Highs

At this exact review boundary:

- Critical remains **0** in the latest Security Intelligence on the reviewed tree;
- both current High findings are freshly reviewed against their current workflow definitions;
- both remain intentionally visible as privileged-trigger watch items;
- neither requires cosmetic suppression or trigger removal to satisfy P13;
- no Security Sentinel weakening is introduced;
- no accounting, capital, wallet, deployment or execution authority is changed.

Decision: **P13 CURRENT HIGH REVIEW = GREEN / CLASSIFIED**.

This is **not** a full P13 closure. Remaining P13 operational gates (control plane, repository/privacy hygiene, production/currentness, accounting/lifecycle, active/queued workflow classification, and project-memory recovery) must still be proven from fresh evidence before `P13 CLOSED / GREEN` is recorded.
