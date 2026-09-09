# THE HOLDING — URGENT HIGH-DETAIL CHAT CHECKPOINT

**Timestamp:** 2026-09-09 12:02 MSK (+03:00)  
**Type:** MANUAL HIGH-DETAIL RESUME CHECKPOINT  
**Branch:** `accounting/cross-month-evidence-pending-lifecycle-20260909`  
**Branch base at creation:** `612a9f99c3a642796f2d6a74a9bd8365daafc5dd` (`intelligence: refresh vlcvx votium curve pool context`)  
**Branch head immediately before this checkpoint:** `82bdca190b57d39d426b4a59b02418ef77547c0e`  
**Authority:** continuity / implementation context only. On resume, current truth MUST be restored from LIVE `main` → `intelligence/project-memory/CURRENT.md` → latest continuity → Memory Routing Index → fresh artifacts/evidence. Do not assume this branch or any SHA remains current.

---

## 1. Why this checkpoint exists

The active chat began degrading / hanging while performing a production accounting forensic pass. This checkpoint preserves the exact reasoning boundary, current branch work, evidence found, safety decisions, and next execution steps so another chat can resume without reconstructing the investigation from scratch.

The current work is **NOT** a redesign and **NOT** a Capital Scan/product pivot. It is a narrow accounting correctness hardening pass around historical cross-month lifecycle evidence.

---

## 2. Owner intent that must be preserved

The owner wants the accounting/reporting foundation to become production-grade and historically truthful, month by month and company by company.

Core rules remain unchanged:

1. Canonical Income Ledger is the sole factual earned-income recognition authority.
2. `UNKNOWN != 0`.
3. Reference APR/APY / Estimated economics are analytics only and cannot create factual income.
4. Current visible rewards do not automatically become period income.
5. Opening balance does not create current-period income.
6. Claim / receipt / withdrawal can be settlement rather than new income if earned income was already recognized.
7. Exact company / route / locked-principal identity matters; wallet-level or mechanism-level similarity is insufficient for attribution.
8. No wallet signing, claiming, transactions, or capital movement.
9. Historical accounting must never invent a monthly split where the evidence does not prove one.
10. No prorating an interval across a month boundary merely because it is mathematically convenient.

---

## 3. Live project context immediately before this branch

Recent main work had already materially advanced accounting:

- PR #702 had hardened VoteMarket accounting by locked-principal / route identity.
- PR #703 had merged canonical historical valuation reuse into accounting coverage.
- Downstream reporting and company monthly reports had been regenerated after those merges.
- Accounting mechanism coverage remained effectively closed at 29 mechanisms / 0 reusable coverage gaps in the prior live inspection.
- The bottleneck had shifted from “can we track the protocol?” to “can historical income be attributed to the correct company / principal / month with exact evidence?”

The active forensic frontier before this checkpoint was therefore historical attribution and lifecycle boundary semantics rather than basic tracking capability.

---

## 4. Immediate forensic question investigated in this branch

The current monthly accounting layer contained unresolved lifecycle events spanning the August → September boundary.

The operational queue was treating these as generic engineering-actionable `period-lifecycle-reconciliation` items, with action:

`reconcile-period-boundary-settlement-or-lifecycle-semantics`

The investigation asked:

> Are these unresolved events actually code/semantic bugs that engineering can resolve now, or are they evidence gaps where the exact Sep-1 boundary state simply does not exist in the historical source data?

The key distinction is critical:

- **engineering-actionable** = implementation or semantics can be fixed using existing evidence;
- **evidence-pending / permanently partial** = source evidence is insufficient to prove the monthly cut, therefore the system must remain UNKNOWN/partial rather than guess.

---

## 5. Evidence found

### 5.1 Beefy historical interval

One problematic Beefy interval crosses the August → September month boundary.

Observed source shape from the forensic inspection:

- last available August checkpoint: approximately **2026-08-31 11:18 UTC**;
- next available checkpoint: approximately **2026-09-02 09:00 UTC**;
- there is **no exact `2026-09-01T00:00:00Z` checkpoint/cut** in the evidence chain inspected.

Therefore the economic change over that interval cannot be truthfully split into “August earned” and “September earned” from the current evidence.

Safe conclusion:

- do not put the full interval into August;
- do not put the full interval into September;
- do not linearly prorate by time;
- keep the interval unresolved / UNKNOWN for exact monthly attribution until an exact historical boundary proof becomes available.

### 5.2 Monetra historical intervals

Eight problematic Monetra lifecycle intervals were found around the same month boundary.

Observed source shape from the forensic inspection:

- preceding checkpoint around **2026-08-31 11:50 UTC**;
- following checkpoint around **2026-09-01 10:26 UTC**;
- no exact midnight `2026-09-01T00:00:00Z` cut for those intervals.

The same safety conclusion applies to all eight intervals.

### 5.3 Combined conclusion

Current evidence supports **9 cross-month intervals total** in this specific investigation:

- Beefy: **1**
- Monetra: **8**

These are not presently resolvable by honest arithmetic alone. Their correct state is evidence-pending / unresolved, not “engineering bug” and not “zero income.”

---

## 6. Design decision taken

A reusable explicit lifecycle reason is being introduced:

`period-boundary-evidence-pending-no-exact-month-cut`

Meaning:

> A canonical economic event exists and has value, but it spans more than one calendar month and the evidence does not include a proven exact month-boundary cut. Monthly attribution must remain unresolved. No proration is allowed.

This reason is deliberately distinct from generic:

`period-boundary-not-single-month`

because the latter does not explain whether the issue is implementation-reconcilable or evidence-limited.

The new state must remain:

- unresolved;
- non-income for the affected monthly attribution;
- non-completion-authority;
- incapable of replacing UNKNOWN;
- incapable of closing the month;
- read-only;
- no execution authority.

---

## 7. Branch implementation already materialized

The branch is currently **5 commits ahead** of its creation base and changes exactly these five files:

1. `reporting/canonical-earned-income-view.mjs`
2. `reporting/accounting-notice-queue.mjs`
3. `reporting/accounting-notice-queue-validation.mjs`
4. `reporting/accounting-reference-reconciliation.mjs`
5. `reporting/accounting-reference-reconciliation-validation.mjs`

No generated factual income artifact has intentionally been edited by hand in this branch.

### 7.1 Canonical Earned Income View

`recognitionDecision(event)` now detects an explicit cross-month embedded-income event when:

- `family === 'embedded-income'`;
- `periodAttributionStatus === 'cross-month-boundary-unallocated'`;
- start month exists;
- end month exists;
- start month != end month;
- no safe single-month attribution is available.

Such an event remains `status: 'unresolved'`, but receives the explicit reason:

`period-boundary-evidence-pending-no-exact-month-cut`

instead of the generic `period-boundary-not-single-month`.

This does **not** recognize new income and does **not** reallocate any existing income.

### 7.2 Accounting Notice Queue

Queue version moved to:

`0.2-accounting-notice-queue-boundary-evidence-pending`

A company-period lifecycle row whose unresolved reasons are exclusively the new exact-boundary evidence-pending reason is now represented as:

- `blocker: historical-boundary-evidence-pending`
- `action: await-exact-boundary-evidence-no-proration`
- `engineeringActionable: false`
- `parked: true`
- `boundaryEvidencePending: true`
- `prorationAllowed: false`

This is the core operational behavior change.

The queue still does not create income, close accounting coverage, replace UNKNOWN, or gain execution authority.

### 7.3 Accounting Reference Reconciliation

Company-period diagnostic reconciliation now understands the queue blocker:

`historical-boundary-evidence-pending`

and projects the state as:

`reconciliationStatus: parked-boundary-evidence-pending`

It also adds the corresponding reason code.

This layer remains purely diagnostic and non-authoritative. Reference/Estimated remains non-factual and cannot backfill Confirmed income.

### 7.4 Validations

Validation hardening was added so that:

- the new queue version is required;
- evidence-pending rows cannot become engineering actionable;
- they must be parked;
- they must retain `prorationAllowed === false`;
- boundary evidence-pending cannot gain source-of-truth, income-creation, month-closing, UNKNOWN-replacement, or execution authority;
- reconciliation must expose the parked evidence-pending state rather than presenting it as solved.

---

## 8. Important semantic invariant: this branch does NOT “fix” the 9 events by assigning them

The intended result is **not** to make unresolved count go to zero.

The intended result is to make the system truthful about *why* the unresolved count remains.

Expected semantic transition:

Before:

`unresolved lifecycle -> generic engineering actionable reconciliation`

After:

`unresolved lifecycle -> exact historical boundary evidence missing -> parked / evidence-pending / no proration`

Thus a successful branch may leave the same factual unresolved events in place while improving operational classification.

Any test or reviewer expecting the unresolved events to disappear is using the wrong acceptance criterion.

---

## 9. What must NOT change after this branch

Acceptance must fail if any of the following occurs:

- Confirmed earned-income USD increases merely because of the new classification.
- An August/September monthly split is manufactured from elapsed time.
- Estimated/Reference data fills the historical factual gap.
- The 9 intervals are silently dropped.
- UNKNOWN becomes zero.
- A parked evidence-pending row closes accounting coverage.
- A current reward snapshot becomes factual period income.
- A generic receipt becomes earned income without mechanism-specific first-recognition proof.
- Cross-company or cross-principal attribution is inferred from wallet/mechanism similarity.
- Any wallet/execution authority expands.

---

## 10. Current execution state at checkpoint time

### Done on branch

- forensic source review for the Beefy + Monetra cross-month cases;
- safety decision: exact cut absent, no proration;
- reusable explicit unresolved reason introduced;
- operational queue classification implemented;
- diagnostic reconciliation classification implemented;
- fail-closed validations added;
- branch diff inspected: 5 files changed, branch 5 commits ahead of base immediately before this checkpoint.

### Not yet completed when checkpoint was requested

- **No PR had yet been opened for this branch.**
- Full GitHub PR CI had **not yet been allowed to complete** for this branch.
- Generated queue/reconciliation artifacts had not yet been accepted as final evidence for this branch.
- No merge to `main` had occurred.
- No downstream post-merge reporting regeneration had been verified.
- No post-merge continuity checkpoint existed for this work yet.

This distinction is essential: implementation is materialized, but production acceptance is not yet proven.

---

## 11. Exact next resume order

On resume, do the following in order:

1. Re-read LIVE `intelligence/project-memory/CURRENT.md` from current `main`.
2. Re-read latest automatic continuity and Memory Routing Index.
3. Re-check whether `main` moved beyond branch base `612a9f99...` while this chat was degraded.
4. Compare current `main` against `accounting/cross-month-evidence-pending-lifecycle-20260909` and rebase/recreate only if genuinely required; do not overwrite newer production truth.
5. Re-open this checkpoint and inspect all 5 changed files on the branch.
6. Confirm canonical branch head (checkpoint commit will be newer than pre-checkpoint head `82bdca19...`).
7. Open a PR to `main` if no equivalent/superseding PR already exists.
8. Run/observe relevant CI, especially Company Monthly Reports / Reporting Layer / integrity/security guards triggered by the changed paths.
9. Inspect generated accounting notice queue and reference reconciliation output.
10. Prove that affected company-period rows become `historical-boundary-evidence-pending`, `engineeringActionable:false`, `parked:true`, `prorationAllowed:false` where the unresolved reason set is exclusively the new boundary reason.
11. Prove factual Confirmed income did not change solely because of classification.
12. Prove unresolved evidence remains visible and is not silently dropped.
13. Prove `UNKNOWN != 0`, no Reference backfill, and no month closing authority drift.
14. Only after GREEN CI **plus artifact/evidence verification** merge the PR.
15. Verify downstream generated reporting/monthly artifacts physically materialize on `main`.
16. Verify fresh automatic continuity checkpoint after merge.
17. Continue to the next largest genuinely engineering-actionable accounting blocker rather than repeatedly revisiting evidence-pending historical intervals unless new evidence appears.

---

## 12. Expected acceptance observations

The branch should be considered successful if the following are simultaneously true:

- code validations pass;
- affected lifecycle events remain unresolved where exact cut is absent;
- the operational queue no longer calls those evidence-only cases engineering work;
- parked/evidence-pending classification is explicit and machine-readable;
- no proration is permitted;
- no factual income total is inflated;
- no historical month is falsely closed;
- diagnostic reconciliation reflects the same blocker consistently;
- authority boundaries remain unchanged.

A GREEN workflow without those artifact-level checks is insufficient.

---

## 13. Broader accounting state to remember after this micro-task

Do not lose the larger priority structure:

1. mechanism-level factual tracking capability is largely built;
2. historical attribution completeness remains the hard frontier;
3. exact locked-principal / route identity remains mandatory for veAERO / veVELO / VoteMarket-type history;
4. current September visible rewards must still be separated from September factual earned income;
5. Company × Month × Mechanism historical completeness mapping remains a high-value next layer;
6. Passport owner-facing presentation must preserve Confirmed vs Estimated vs UNKNOWN semantics;
7. Capital Flow Graph and Capital Scan/onboarding funnel remain later, after accounting truth is strong.

---

## 14. Compact resume sentence

**Resume from the cross-month accounting branch, not from product work: 1 Beefy + 8 Monetra intervals span Aug→Sep without an exact Sep-1 midnight cut; never prorate them. The branch converts their lifecycle state from generic engineering-actionable reconciliation to explicit `historical-boundary-evidence-pending`, parked/non-actionable, while keeping them unresolved/UNKNOWN and preserving Canonical Income Ledger authority. PR/CI/merge were not yet completed at checkpoint time.**
