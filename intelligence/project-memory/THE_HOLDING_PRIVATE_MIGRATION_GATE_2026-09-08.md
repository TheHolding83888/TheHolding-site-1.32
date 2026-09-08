# THE HOLDING — PRIVATE MIGRATION GATE
## Owner decision · 2026-09-08

Status: ACTIVE ROADMAP BOUNDARY  
Authority: owner-approved project sequencing / no capital or execution authority  
executionAuthority: none

## Decision

The current public-repository development phase ends after **Accounting / Historical Truth Foundation v1** is closed and physically verified.

**Do not begin `Capital Flow Semantics` implementation while the canonical repository remains public.**

The first implementation commit for `Capital Flow Semantics` is **PRIVATE-ONLY** and is blocked until:

1. the current accounting/historical-truth foundation exit criteria below are green;
2. a final public-state checkpoint and full repository backup/export are created;
3. repository visibility is changed from public to private, preferably in-place so Git history and repository continuity are preserved;
4. access, Actions/workflows, deployment/integration paths, security controls and project-memory recovery are re-verified after the visibility change;
5. the owner explicitly resumes development after the private-mode audit.

## Public-phase exit criteria

Before the privacy transition, finish the current foundation rather than carrying known accounting ambiguity across the boundary:

- August reconciliation for economically meaningful mechanisms is evidence-classified; no Reference/Estimated value is promoted into factual income.
- September rolling-month behavior and factual capture are live-validated.
- Known accounting boundary defects found during reconciliation are fixed or explicitly classified as permanent/temporary UNKNOWN or partial.
- Historical Completeness Map exists for `company × mechanism/channel × month`, with explicit statuses such as Complete / Partial / Tracking-no-event / Unknown / N/A.
- Reconciliation Watch is automatic and diagnostic only; it cannot create income or close a month.
- Earned-income lifecycle semantics are durable: `earned → accrued → claimable → claimed → received → reinvested`, with no double recognition.
- Canonical Income Ledger remains the sole factual earned-income authority.
- `UNKNOWN != 0` remains enforced.
- Final exact-head CI, production materialization proof, project-memory checkpoint and repository-state inventory are green enough to freeze the public phase.

This gate does **not** require artificial numerical convergence between Reference and Confirmed. The target is evidence explanation and correct epistemic classification.

## Private-only roadmap start

After successful private migration and post-migration audit, resume with the next major architecture block:

`Capital Flow Semantics → Position Lifecycle → Wallet Discovery → Unknown Strategy Queue → Historical Scanner → Company Book → Sensors / Economic Graph → arbitrary-wallet analysis → Free Capital Scan → Verify → Register → The Holding Index`

The existing accounting earned-income lifecycle work needed to close Accounting / Historical Truth Foundation v1 is part of the current public foundation and is distinct from the later broader `Position Lifecycle` architecture.

## Why this boundary

- Accounting/history is the integrity substrate that should be closed and verified before changing repository operating conditions.
- `Capital Flow Semantics` and the layers after it increasingly encode proprietary system intelligence and graph semantics; exposing additional implementation publicly has diminishing benefit.
- Waiting until Sensors/Economic Graph or Capital Scan would unnecessarily expose materially more architecture.
- Repository size/code volume is not the main migration risk. The larger risk of waiting is that additional proprietary history becomes permanently public.

## Visibility-change caveat

Making a public repository private restricts future access but does not erase copies already made while it was public. Existing public forks, if any, can remain public and become detached. Therefore the gate is designed to stop new proprietary implementation before the next major layer rather than assuming prior public history can be recalled.

## Migration preference

Default preference: **change the existing canonical repository in place from public to private**, after backup/export and preflight, rather than rebuilding a new repository unless a concrete technical blocker is discovered. Preserve repository identity, full Git history, branches, PR/issue continuity, automation history and project memory where GitHub behavior allows it.

The actual visibility change is a material security/repository boundary and must not be performed automatically under routine merge authority. Stop at the migration gate and execute the change with explicit owner participation/confirmation.

The model can change. **The memory must remain The Holding's.**
