# THE HOLDING — PRIVATE MIGRATION GATE
## Owner decision · 2026-09-08 · sequencing refinement 2026-09-09

Status: ACTIVE ROADMAP BOUNDARY  
Authority: owner-approved project sequencing / no capital or execution authority  
executionAuthority: none

## Decision

The current public-repository development phase ends only after the accounting foundation is technically closed **and** the bounded pre-private finalization sequence below is completed.

**Do not begin `Capital Flow Semantics` implementation while the canonical repository remains public.**

The first implementation commit for `Capital Flow Semantics` is **PRIVATE-ONLY**.

The Accounting / Historical Truth Foundation v1 reached formal technical GREEN through the final audit sequence on 2026-09-09. Post-GREEN structural debt from the duplicate lifecycle contract was subsequently consolidated through PR #712 without changing economic truth or authority. Formal foundation GREEN does not by itself mean that the public repository is already frozen for migration: the owner approved a short current-state/cosmetic refresh, bounded cleanup, real preflight and final public snapshot before the final migration-readiness GREEN.

## Public-phase exit criteria — accounting foundation

Before the privacy transition, the accounting/historical-truth foundation must remain green:

- August reconciliation for economically meaningful mechanisms is evidence-classified; no Reference/Estimated value is promoted into factual income.
- September rolling-month behavior and factual capture are live-validated.
- Known accounting boundary defects found during reconciliation are fixed or explicitly classified as permanent/temporary UNKNOWN or partial.
- Historical Completeness Map exists for `company × mechanism/channel × month`, with explicit statuses such as Complete / Partial / Tracking-no-event / Unknown / N/A.
- Reconciliation Watch is automatic and diagnostic only; it cannot create income or close a month.
- Earned-income lifecycle semantics are durable: `earned → accrued → claimable → claimed → received → reinvested`, with no double recognition.
- Canonical Income Ledger remains the sole factual earned-income authority.
- `UNKNOWN != 0` remains enforced.
- Exact-head CI and production materialization remain coherent.

This gate does **not** require artificial numerical convergence between Reference and Confirmed. The target is evidence explanation and correct epistemic classification.

## Pre-private finalization sequence — owner-approved 2026-09-09

### Stage A — Foundation consolidation

Close only genuine post-GREEN structural debt and re-verify the clean canonical accounting state. Do not reopen already classified August archaeology merely to force numerical completeness.

Status at sequencing refinement: PR #712 merged; duplicate #711 lifecycle JSON/validator removed; #708 remains the single canonical active lifecycle acceptance contract. The retired duplicate workflow may remain only as a manual read-only retirement proof with no automatic trigger or write authority.

### Stage B — Bounded owner current-state and cosmetic refresh

Before the final cleanup/freeze, allow one small owner-supplied package of current-state and presentation updates:

- newly acquired company assets / balance quantities that are not yet reliably auto-discovered;
- small cosmetic or presentation corrections on the public site;
- no new major architecture and no private-only Capital Flow Semantics work.

Manual current-state data is allowed when necessary, but it must be explicitly represented as owner-declared / owner-confirmed evidence rather than falsely presented as independently discovered onchain truth. Existing machine-discovered/onchain evidence must not be overwritten or downgraded without proof. Preserve provenance so a later automatic blockchain collector can supersede the manual source without rewriting history.

This is a bounded refresh window, not an invitation to redesign the site or expand scope indefinitely.

### Stage C — Final pre-private cleanup / freeze

Perform a deliberately small, low-risk cleanup pass. Optimize for fast closure and minimal deletion risk.

Priority order:

1. close or retire obvious dead PR/checkpoint/canary artifacts whose own contract says they must never merge or were recovery-only;
2. classify/cancel harmless stale queued workflow ghosts where safe and supported; do not treat old historical failures as current production failures;
3. review open Runtime Reliability incident issues against fresh live evidence and close only those proven obsolete/resolved; retain genuine unresolved incidents;
4. remove only clearly disposable temporary branches (`tmp`, explicit `do-not-use`, obvious one-off no-op/test transport branches) after verifying they contain no unique recovery value;
5. retain historical/accounting/checkpoint branches by default unless deletion is clearly safe and useful.

Do **not** mass-delete the branch history, rewrite Git history, erase forensic evidence, chase every historical failed run, or turn cleanup into a new long project. History is project memory; cleanup removes noise, not archaeology.

### Stage D — Real pre-private checks

Run a fresh, exact-state preflight after the bounded refresh and cleanup:

- exact current `main` and relevant CI/control-plane checks;
- repository hygiene and public-surface privacy checks;
- production/deployment/currentness checks for critical public surfaces and bounded writers;
- accounting artifacts and lifecycle invariants remain coherent after cosmetic/current-state changes;
- no current engineering-actionable accounting blocker is silently hidden;
- inspect current security state: Critical must remain `0`; every current High finding must be reviewed and either fixed or explicitly classified as accepted/non-blocking with evidence; Medium findings do not need blanket closure;
- inspect active/queued workflows and distinguish real current work from documented stale historical noise;
- verify project-memory recovery path still works.

### Stage E — Final public-state snapshot and explicit checkpoint

Create a durable final public-state inventory/checkpoint that a new chat can recover without relying on conversation memory. At minimum record:

- exact final public `main` SHA and timestamp;
- open PRs/issues and their disposition;
- branch count plus retained-history policy and any intentionally preserved exceptional branches;
- active/queued workflow state and classified stale runs;
- current security summary and disposition of High findings;
- deployment/public-surface state;
- canonical accounting artifact status/freshness and accepted Partial/Unknown tails;
- provenance of any owner-declared current company balance updates;
- cleanup actions performed and intentionally skipped items;
- exact next-step contract for backup/private migration.

Automatic continuity checkpoints remain supporting infrastructure, but this explicit checkpoint is required at the transition boundary.

### Stage F — Final migration-readiness GREEN

Only after Stages A–E are green, report to the owner explicitly:

`PUBLIC PHASE FINALIZATION — GREEN. READY FOR FINAL BACKUP / PRIVATE MIGRATION.`

This is the user-facing green checkmark for the public-development phase. It means feature work is frozen and the repository is ready for backup/migration preparation; it does **not** itself change repository visibility.

### Stage G — Full backup/export

Create and verify a full repository backup/export from the exact final-green public state. If chat context is near its limit, stop after the Stage E/F checkpoint and continue backup work in a fresh chat using that checkpoint.

### Stage H — Visibility change

Change the existing canonical repository in place from public to private, preferably preserving repository identity, full Git history, branches, PR/issue continuity, automation history and project memory where GitHub behavior allows it.

The actual visibility change is a material security/repository boundary and must not be performed automatically under routine merge authority. Execute it only with explicit owner participation/confirmation.

### Stage I — Post-private audit

After the visibility change, re-verify:

- owner/collaborator access;
- Actions/workflows and required permissions;
- deployment/integration paths;
- security controls;
- project-memory recovery;
- canonical main continuity and critical artifacts.

The owner explicitly resumes development only after this audit.

## Private-only roadmap start

After successful private migration and post-migration audit, resume with:

`Capital Flow Semantics → Position Lifecycle → Wallet Discovery → Unknown Strategy Queue → Historical Scanner → Company Book → Sensors / Economic Graph → arbitrary-wallet analysis → Free Capital Scan → Verify → Register → The Holding Index`

A priority inside this private phase is to evolve company capital tracking from today's hybrid model toward reproducible daily onchain tracking wherever technically possible:

`external contribution / withdrawal → treasury balance → principal → protocol position → strategy transformation → reward/settlement → treasury → reinvestment`.

The target is automatic daily detection of company inflows, outflows, free assets and protocol positions without silently replacing owner-declared or historical evidence. Unknown or unsupported exposure remains explicit rather than disappearing or becoming zero.

The existing accounting earned-income lifecycle is distinct from the broader future Position Lifecycle / Capital Flow architecture.

## Why this boundary

- Accounting/history is the integrity substrate and has to stay intact through the migration boundary.
- A bounded owner refresh prevents knowingly freezing stale public company balances or obvious visual defects.
- A small cleanup removes misleading live noise without destroying historical recovery value.
- `Capital Flow Semantics` and later layers encode increasingly proprietary intelligence; exposing their implementation publicly has diminishing benefit.
- Waiting until Sensors/Economic Graph or Capital Scan would unnecessarily expose materially more architecture.
- Repository size/code volume is not the main migration risk. The larger risk of waiting is additional proprietary history becoming permanently public.

## Visibility-change caveat

Making a public repository private restricts future access but does not erase copies already made while it was public. Existing public forks, if any, can remain public and become detached. The gate therefore stops new proprietary implementation before the next major layer rather than assuming prior public history can be recalled.

## Migration preference

Default preference: **change the existing canonical repository in place from public to private**, after final-green checkpoint and verified backup/export, rather than rebuilding a new repository unless a concrete technical blocker is discovered.

The model can change. **The memory must remain The Holding's.**
