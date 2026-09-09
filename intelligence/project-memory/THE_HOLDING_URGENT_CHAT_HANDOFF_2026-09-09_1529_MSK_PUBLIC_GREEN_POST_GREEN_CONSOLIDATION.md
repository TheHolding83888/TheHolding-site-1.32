# THE HOLDING — URGENT CHAT HANDOFF
## 2026-09-09 15:29 MSK · Public Foundation v1 GREEN achieved earlier / post-GREEN lifecycle consolidation still open

Status: **MANUAL RECOVERY CHECKPOINT — CHAT CONTINUITY ONLY**  
Branch: `memory/urgent-public-green-handoff-20260909-1529-msk`  
Source live main at branch creation: `00abe5f05922d8f5f9a72eeaed51db4ba211fe19`  
Source main message: `data: update accounting reconciliation watch`  
Source main commit time: **2026-09-09 15:29:06 MSK** (`2026-09-09T12:29:06Z`)  
Authority: **observation / recovery / diagnostic only**  
`executionAuthority = none`

> This checkpoint exists because the current ChatGPT conversation was becoming slow/unstable and the owner asked to move work to a new chat. It is intentionally detailed enough for a fresh model/chat to resume without reconstructing the entire day from scratch. It is **not** an accounting source of truth, does **not** close any month, does **not** authorize repository/capital execution, and does **not** override live `main`. Changing facts must always be re-read from live `main`, fresh generated artifacts, open PR state and exact workflow evidence.

---

# 1. OWNER INTENT / STRATEGIC GATE

The owner's requested sequence is explicit and must be preserved:

1. Finish the public Accounting / Historical Truth Foundation to a **genuine evidence-backed GREEN**.
2. Notify the owner only when the gate is real.
3. The owner may then do **1–2 final cosmetic website changes**.
4. After cosmetics, stop public feature development and handle the **GitHub private-mode transition as a separate workstream**.
5. Do **not** begin the next architecture layer publicly before that transition.

Private/public migration mechanics are intentionally **not** specified here. What remains public, what becomes private, repository migration mechanics, visibility boundaries and future repo structure are to be decided separately with the owner after the public foundation is clean/frozen.

The public-green roadmap boundary remains:

`Accounting / Historical Truth Foundation v1`
→ `FINAL PUBLIC GREEN GATE`
→ freeze feature expansion
→ optional 1–2 cosmetics
→ separate private-mode work
→ only later resume post-migration architecture.

**Do NOT start Capital Flow Semantics before that later private-mode work.**

Also do not start before the private-mode transition:
- full future Position Lifecycle / Capital Flow layer;
- Wallet Discovery;
- Unknown Strategy Queue expansion;
- Historical Scanner expansion;
- Company Book expansion;
- Sensors / Economic Graph expansion as the next public feature layer;
- arbitrary-wallet support;
- Free Capital Scan;
- Verify / Register / Index expansion.

---

# 2. RECOVERY ORDER FOR THE NEXT CHAT

Always resume through live truth, not this prose alone:

`LIVE main → intelligence/project-memory/CURRENT.md → latest continuity named by CURRENT → Memory Routing Index → this checkpoint branch → fresh accounting artifacts → open PRs → exact Actions evidence`

Recommended exact order:

1. Fetch live `main` HEAD again. Do **not** assume `00abe5f...` is still current.
2. Read live `intelligence/project-memory/CURRENT.md`.
3. Read the latest immutable continuity named by CURRENT.
4. Read `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md` for accounting/reporting/public-green routing.
5. Read this checkpoint from branch:
   `memory/urgent-public-green-handoff-20260909-1529-msk`.
6. Re-read open PR **#712** and its exact current head/checks because this is the only known active accounting structural-cleanup frontier at checkpoint time.
7. Re-read current production artifacts:
   - `reporting/income-ledger.json`
   - `reporting/company-monthly-reports.json`
   - `reporting/accounting-coverage.json`
   - `reporting/accounting-notice-queue.json`
   - `reporting/accounting-reference-reconciliation.json`
   - `reporting/historical-accounting-completeness-map.json`
   - `reporting/accounting-reconciliation-watch.json`
   - canonical income lifecycle contract retained from #708.
8. Inspect latest relevant workflow runs after the live main head.
9. Finish #712 correctly through Control Plane proof, exact-head GREEN, merge and fresh-main verification.
10. Re-run/re-verify the final public foundation acceptance on the post-#712 live main.
11. Only after current-head proof is clean, re-affirm the public GREEN gate to the owner.

---

# 3. FRESH LIVE MAIN BOUNDARY AT CHECKPOINT CREATION

Freshest main commit observed immediately before this checkpoint branch was created:

`00abe5f05922d8f5f9a72eeaed51db4ba211fe19`

Message:
`data: update accounting reconciliation watch`

Commit time:
- UTC: `2026-09-09T12:29:06Z`
- MSK: **2026-09-09 15:29:06**

Immediately preceding fresh accounting materializations on live main:

- `c2898d133dcad3c2f9cdd0ffe11c6dc3cb87871f`
  - `data: update company monthly earned-income reports`
  - 2026-09-09 15:28:07 MSK
- `0e57e95947dd2140fdc6b5e3fd0a8990e53b1b60`
  - `data: update historical accounting completeness map`
  - 2026-09-09 15:28:36 MSK
- `00abe5f05922d8f5f9a72eeaed51db4ba211fe19`
  - `data: update accounting reconciliation watch`
  - 2026-09-09 15:29:06 MSK

Therefore the accounting diagnostics were still actively and successfully materializing after the major GREEN work and after #711.

Live CURRENT at checkpoint time represented source state `2026-09-09T11:54:47.592Z` and pointed to:
`THE_HOLDING_MASTER_CONTINUITY_2026-09-09_113435_AUTO_1c0e5bdf.md`.

Important: CURRENT can lag very fresh generated writer commits. Live `main` + fresh artifacts outrank prose continuity for changing facts.

---

# 4. IMPORTANT DISCOVERY: PUBLIC FOUNDATION v1 GREEN WAS ALREADY ACHIEVED AND RECORDED

During this chat we initially believed lifecycle acceptance and final regression still remained. Fresh live-history inspection at checkpoint time showed that another concurrent workstream had already completed them.

## PR #708 — canonical income lifecycle acceptance

PR **#708** — `Accounting: close income lifecycle acceptance contract`

Merged before the final audit.

Purpose:
- close the reusable income lifecycle prerequisite without creating a new accounting engine or writer;
- machine-check the existing canonical lifecycle:
  `earned → accrued → claimable → claimed → received → reinvested`;
- validate the live Canonical Income Ledger through the existing Canonical Earned Income View.

Key semantics locked by #708:
- Canonical Income Ledger remains sole factual income authority;
- accrued/embedded earned income can be recognized before claim when canonical mechanism evidence proves it;
- claimable visibility alone creates no income;
- claim/receipt does not re-recognize previously earned income;
- realised cash flow can be first recognition only with explicit non-overlap proof and a unique `recognitionId`;
- generic receipt remains unresolved;
- reinvestment changes capital state only and does not create a second income event or rewrite original earned period;
- opening balances do not create income;
- Reference/Estimated does not create factual income;
- arbitrary cross-month time proration is forbidden;
- `UNKNOWN != 0`;
- no wallet/capital/execution/month-closing authority.

This #708 contract is the contract that the current consolidation work intends to **retain as canonical**.

## PR #709 — final public foundation acceptance audit

PR **#709** — `Accounting: verify final public foundation v1 gate`

Merged at:
- UTC around `2026-09-09T11:06:07Z`
- MSK around **14:06:07**

This was the final read-only acceptance gate for `Accounting / Historical Truth Foundation v1`.

It explicitly proved on one exact candidate:
- Canonical Income Ledger remains sole factual income authority;
- Accounting Coverage has zero reusable gaps and zero unclassified mechanism instances;
- all 10 companies have August history and current September reporting without month leakage;
- Historical Completeness Map is source-compatible;
- current month cannot be Complete;
- September states are Partial / Tracking-no-event rather than fabricated UNKNOWN/zero;
- August has no unresolved cross-month leakage;
- Notice Queue has zero missing capability and zero engineering-actionable accounting notices;
- owner/boundary evidence gaps remain parked and non-actionable;
- Reference Reconciliation has zero engineering-actionable company periods;
- delta/capture remain diagnostic only;
- principal is counted once;
- supplementary Reference double-add is forbidden;
- Reconciliation Watch is null-preserving v0.1.1 with zero engineering action required and zero baseline alerts;
- lifecycle contract remains `earned → accrued → claimable → claimed → received → reinvested`;
- unique recognition IDs / no settlement double recognition;
- Confirmed and Estimated remain non-additive;
- `UNKNOWN != 0`;
- cross-month proration forbidden;
- `executionAuthority = none`.

This final audit intentionally did **not** start Capital Flow Semantics.

## PR #710 — explicit PUBLIC FOUNDATION v1 GREEN checkpoint

PR **#710** — `Memory: checkpoint Public Foundation v1 GREEN`

Merged at:
- UTC around `2026-09-09T11:11:29Z`
- MSK around **14:11:29**

It records that the evidence-backed Accounting / Historical Truth Foundation v1 green gate had been achieved.

Its acceptance snapshot recorded:
- **10 companies**;
- **50 mechanism instances**;
- **29 unique mechanisms**;
- **0 reusable coverage gaps**;
- **857 Canonical Income Ledger observed events**;
- **821 recognized earned-income events**;
- **5 settlement-only events**;
- **31 unresolved events**;
- September open-month acceptance:
  - 31 Partial;
  - 19 Tracking-no-event;
  - 0 Unknown;
  - 0 Complete;
- August unresolved cross-month count = **0**;
- Historical Completeness Map materialized/validated;
- Reconciliation Watch materialized/validated;
- income lifecycle contract materialized/validated;
- Notice/Reconciliation engineering-actionable = **0**;
- accepted parked evidence boundaries remain Partial/UNKNOWN and are not defects or prorated estimates;
- no accounting PR remained open at the final #710 verification boundary;
- Capital Flow Semantics had **not** started;
- feature expansion could freeze;
- optional cosmetics may follow;
- private-mode transition remains a separate workstream.

The green-gate phrase preserved from the earlier owner contract is:

**🟢 PUBLIC FOUNDATION v1 — GREEN. CAN FREEZE FEATURE DEVELOPMENT AND PREPARE FOR PRIVATE-MODE WORK.**

This phrase was legitimately reached at the #709/#710 boundary.

---

# 5. WHY CURRENT LIVE MAIN STILL HAS ONE POST-GREEN CLEANUP FRONTIER

After #710 had already recorded GREEN, PR **#711** was merged at approximately:
- UTC `2026-09-09T11:34:06Z`
- MSK **14:34:06**

PR #711 title:
`Accounting: lock reusable income lifecycle contract`

Its intent was semantically correct and again encoded:
`earned → accrued → claimable → claimed → received → reinvested`.

However, because #708 had already created the canonical lifecycle acceptance contract before the final audit, #711 introduced **duplicate lifecycle contract machinery after GREEN**.

This is structural duplication, not an economic/accounting correction.

No evidence at checkpoint time suggested that #711 changed factual income, month attribution, wallet state or capital execution. The problem is architectural debt / duplicate contract surface after a gate whose discipline explicitly says no duplicate sources/contracts when reuse is possible.

Therefore PR **#712** was opened to consolidate back to a single canonical lifecycle acceptance contract.

This distinction matters:

- The Accounting / Historical Truth Foundation **did reach GREEN** at #709/#710.
- Current `main` subsequently gained a post-GREEN duplicate lifecycle contract through #711.
- #712 is a **structural cleanup / consolidation**, not a reopening of historical accounting forensics.
- The next chat should finish #712 before treating the latest current head as the clean frozen public boundary for cosmetics/private transition.

---

# 6. ACTIVE FRONTIER AT HANDOFF: PR #712

Open PR at checkpoint time:

**#712 — `Accounting: consolidate lifecycle contract`**

Branch:
`accounting/lifecycle-contract-consolidation-20260909`

Observed head:
`77baedeeb4f7f8bd5da47924aae20058e325ce7a`

PR base at creation:
`45eb601c3dea1c11fe118420d2c5bdbb1fb1940d`

Because live main advanced to `00abe5f...` after the PR was opened, the next chat must re-check mergeability/base freshness before doing anything.

## #712 intended consolidation

The PR explicitly intends to:
- retain the stronger #708 contract as the single canonical lifecycle acceptance contract;
- carry forward useful explicit invariants from #711 into #708's retained contract/validator;
- delete the duplicate #711 JSON, validator and workflow;
- not change any economic event, income value, month attribution, Reference value, wallet state, capital state or execution authority.

Observed changed paths in #712:

1. `.github/workflows/verify-accounting-income-lifecycle-contract.yml`
2. `reporting/accounting-income-lifecycle-contract-validation.mjs`
3. `reporting/accounting-income-lifecycle-contract.json`
4. `reporting/income-lifecycle-contract-validation.mjs`
5. `reporting/income-lifecycle-contract.json`

Interpretation:
- the first three are the duplicate #711 surface intended for retirement;
- the latter two are the retained #708 canonical contract/validator being strengthened with useful invariants before duplicate removal.

Do not create another third lifecycle contract.

---

# 7. EXACT CI STATE OF PR #712 AT HANDOFF

Exact-head checks observed on `77baedeeb4f7f8bd5da47924aae20058e325ce7a`:

GREEN:
- `Verify Income Lifecycle Acceptance Contract` — success;
- `Verify Public Foundation v1 Final Audit` — success;
- `The Holding Security · Commit Identity Privacy Guard` — success;
- `The Holding Reliability · Repository Hygiene Guard` — success;
- `The Holding Security · Public Surface Privacy Guard` — success.

RED:
- `The Holding Reliability · Workflow Control Plane` — failure.

The failing Workflow Control Plane run:
- run id `34350040110`;
- job `audit`;
- failure occurred specifically at step:
  **`Guard workflow definition changes`**.

All Control Plane static canaries before that step passed:
- workflow-control-plane canary;
- no-new-debt canary;
- workflow fan-out canary;
- fan-out enforcement canary;
- workflow-definition-diff guard canary.

The failure occurred when the real candidate diff was evaluated by:
`intelligence/reliability/workflow-definition-diff-guard.mjs`.

The command exited non-zero before subsequent Control Plane topology/no-new-debt steps ran.

The logs available in this chat did **not** print the detailed row/proof reason before exit, so do not invent the exact policy violation. The high-confidence boundary is only:

> #712 changes/removes a workflow definition and the real Workflow Definition Diff Guard did not accept the candidate proof yet.

Most likely investigation direction is the legitimate retirement/self-reduction proof expected when deleting duplicate workflow machinery, but the next chat must **read the live guard policy and exact generated diff result** rather than assuming the fix.

### Required handling

- Do **not** weaken or bypass Workflow Control Plane.
- Do **not** suppress the failing check.
- Do **not** merge #712 while Control Plane is red.
- Read the actual diff-guard contract/policy and add the correct proof/retirement semantics for a workflow deletion/reduction.
- Preserve the fact that removing a duplicate workflow is structural-debt reduction, not permission expansion.
- Re-run exact-head CI.
- Merge only when every required check is GREEN on the exact current candidate.

---

# 8. WORK COMPLETED DURING THE ACCOUNTING FORENSICS / PUBLIC-GREEN PASS

The following sequence is important context for why the foundation became green.

## PR #702 — VoteMarket principal-route isolation

Already merged before this chat's fresh work.

Key effect:
- `votemarket-vecrv` must map to veCRV principal;
- `votemarket-vefxn` must map to veFXN principal;
- generic VoteMarket label cannot cross-attribute between locked principals;
- principal counted once;
- company-level factual income unchanged.

August diagnostic split:
- veFXN VoteMarket Confirmed: **$6.777316**;
- veCRV VoteMarket Confirmed: **$3.982408**;
- Defitea August company Confirmed remained **$25.67175109**.

This was attribution correction only, not income mutation.

## PR #703 — canonical historical valuation reused in Coverage

PR #703:
`Accounting: reuse canonical historical valuation in coverage`

Root cause discovered during Defitea veVELO / 40 Acres August forensic:
- Canonical Income Ledger already had strict identity-bound historical `valuationResolution` for veVELO entitlement events;
- Canonical Earned Income View could safely resolve those values;
- Accounting Coverage still looked only at raw `usdValue`, causing proven factual August veVELO to appear as `Confirmed = null`.

Safe fix:
- Coverage reuses canonical `resolvedUsdValue` logic;
- no Canonical Ledger economic field mutation;
- no Reference/APR/current-price backfill;
- `UNKNOWN != 0` preserved;
- 40 Acres receipts remain settlement-only.

Materialized result for Defitea August `velodrome_vevelo`:
- factual events: **19/19 valued**;
- Confirmed/effective factual subtotal: **$2.04403678**;
- Reference approximately **$3.30088136**;
- no unresolved cross-month evidence for that lane;
- 40 Acres receipt events remain settlement-only and do not add income twice.

PR #703 exact-head checks went fully GREEN after one transient live-source retry and then merged/materialized.

## veCRV / VoteMarket August forensic conclusion

Defitea August veCRV:
- factual VoteMarket entitlement Confirmed **$3.982408**;
- base Curve fee lane did not have sufficient historical period-income authority for complete August reconstruction;
- >100% vs Reference is not a bug because Reference is non-factual and scope differs;
- no Reference backfill;
- missing historical base-fee proof remains Partial/UNKNOWN where appropriate.

No engineering fix required.

## vlCVX August conclusion

Historical August vlCVX remains a proof-boundary problem, not a zero-income conclusion.

Important rejected unsafe idea:
- do not sum historical Votium Merkle roots as independent additive drops;
- roots are replacement/current-root semantics and require exact claim/carry-forward/period evidence.

No unsafe historical backfill was admitted.

## Frax August conclusion

Frax exact factual adapter only proves the late-August observation tail from the bootstrap boundary onward.

August before first observation remains Partial/UNKNOWN, not zero and not Reference-backfilled.

## ICP NNS conclusion

ICP remains structurally/reference tracked, but exact factual private-neuron reward/maturity history is unavailable under the current safe privacy/no-hotkey boundary.

Opening owner snapshot is baseline only.

No public/global proxy estimate creates factual income.

ICP is parked, not engineering-actionable by default.

---

# 9. PR #704 — CROSS-MONTH EVIDENCE-PENDING LIFECYCLE CLASSIFICATION

PR #704:
`Accounting: classify exact-cut cross-month evidence as pending`

This closed the two remaining September boundary ambiguities without inventing income.

Evidence:

### 1milliondollar / Beefy
- last August checkpoint before boundary around `2026-08-31 11:18 UTC`;
- next observed state around `2026-09-02 09:00 UTC`;
- no exact `2026-09-01 00:00 UTC` cut.

### Monetra
- 8 cross-month intervals spanning approximately
  `2026-08-31 11:50 UTC → 2026-09-01 10:26 UTC`;
- no exact midnight cut.

Safe semantics:
- remain unresolved for exact month attribution;
- `period-boundary-evidence-pending-no-exact-month-cut`;
- parked / non-engineering-actionable;
- `UNKNOWN != 0`;
- no time-proration;
- no Reference backfill;
- no month-close authority.

PR #704 merged and materialized.

Result after materialization:
- production accounting queue had **0 engineering-actionable** accounting blockers;
- Monetra and 1milliondollar boundary cases became explicit accepted evidence-pending states.

---

# 10. PR #705 — HISTORICAL ACCOUNTING COMPLETENESS MAP

PR #705:
`Accounting: add historical completeness map`

Introduced explicit derived machine-readable map:

`company × mechanism × month`

States:
- `Complete`
- `Partial`
- `Tracking-no-event`
- `Unknown`
- `N/A`

Safety semantics:
- diagnostic only;
- Canonical Income Ledger remains factual income authority;
- Accounting Coverage remains factual tracking authority;
- Complete is not month-close authority;
- current/open month cannot be Complete;
- Tracking-no-event is not zero proof;
- Reference cannot backfill;
- cross-month proration forbidden;
- no wallet/capital/execution authority.

Initial materialized map covered:
- 10 companies;
- 50 mechanism instances;
- 100 company × mechanism × month rows.

Initial state counts around first materialization:
- Complete: 20;
- Partial: 34;
- Tracking-no-event: 25;
- Unknown: 21.

Acceptance anchors included:
- Defitea August veVELO = Complete after #703, 19/19 valued, $2.04403678;
- 1milliondollar September Beefy = Partial because exact Sep-1 cut absent;
- 05081966 August veCRV = Unknown because historical factual tracking not proven;
- 05081966 August veAERO = Tracking-no-event, not zero.

Writer was intentionally one-file derived output only.

Production materialization commit originally observed:
`ee350ab506bace4abd311ac6dcf3c1d5cbe7de5c`
`data: update historical accounting completeness map`

Later fresh materialization at checkpoint time:
`0e57e95947dd2140fdc6b5e3fd0a8990e53b1b60`.

---

# 11. PR #706 + #707 — AUTOMATIC RECONCILIATION WATCH + NULL-PRESERVATION HOTFIX

## PR #706

PR #706:
`Accounting: add automatic reconciliation watch`

Derived watch inputs:
- Accounting Notice Queue;
- Accounting Reference Reconciliation;
- Historical Accounting Completeness Map.

Watch classes:
- `engineering-action-required`;
- `evidence-pending`;
- `historical-forensic-review`;
- `reference-diagnostic-review`.

Semantics:
- first snapshot is baseline, no retroactive false alerts;
- stable fingerprints detect new/changed/resolved states;
- semantic no-op preserves file byte-for-byte;
- Reference delta is not missing income;
- Tracking-no-event is not failure;
- open-month Partial is not historical failure;
- evidence-pending is not engineering failure;
- disappearance from watch is not accounting close proof;
- `UNKNOWN != 0`;
- no proration;
- no wallet/capital/execution/month-close authority.

Initial baseline after #706:
- watch items: **36**;
- engineeringActionRequired: **0**;
- evidencePending: **4**;
- historicalForensicReview: **24**;
- referenceDiagnosticReview: **8**;
- first baseline alerts: **0**.

## PR #707 — important discovered projection bug

After #706 physically materialized, a manual live-artifact inspection caught that JavaScript `Number(null)` had projected source `null` numeric values as `0` in the derived Watch.

Even though Watch is diagnostic-only, this violated The Holding law:
`UNKNOWN != 0`.

PR #707:
`Accounting: preserve UNKNOWN/null in reconciliation watch`

Fix:
- null/undefined/empty numeric inputs remain `null`;
- watch version became `0.1.1-accounting-reconciliation-watch-null-preserving`;
- schema migration intentionally started fresh baseline so the repair did not create false change alerts;
- validation proves numeric parity against watched source rows;
- explicit regression protects ICP owner-data-pending null amounts and August veCRV historical UNKNOWN USD.

Original corrected writer materialization commit:
`2e46aa5dedd11a46bd120c01902cb10e287cb63f`

It changed only:
`reporting/accounting-reconciliation-watch.json`.

Fresh watch at checkpoint-time live main had advanced to:
`00abe5f05922d8f5f9a72eeaed51db4ba211fe19`.

Fresh watch source timestamps after the 15:28 writers:
- Accounting Notice Queue generated around `2026-09-09T12:28:07.465Z`;
- Reference Reconciliation generated around `2026-09-09T12:28:07.553Z`;
- Historical Completeness generated around `2026-09-09T12:28:35.966Z`;
- Reconciliation Watch generated around `2026-09-09T12:29:04.740Z`.

Fresh watch summary at checkpoint time:
- watchItemCount: **36**;
- engineeringActionRequiredCount: **0**;
- evidencePendingCount: **4**;
- historicalForensicReviewCount: **24**;
- referenceDiagnosticReviewCount: **8**;
- newCount: 0;
- changedCount: 2;
- unchangedCount: 34;
- resolvedCount: 0;
- alertCount: **0**;
- evidenceUpdateCount: 1;
- diagnosticUpdateCount: 1.

Fresh non-alert updates included:
- evidence update for 1milliondollar September company-period boundary state;
- diagnostic update for Cypher September company period.

This is important: the watch is working as intended — data can change without inventing an engineering emergency.

---

# 12. CURRENT CANONICAL ACCOUNTING LAWS — DO NOT RELAX

These are non-negotiable throughout any continuation:

1. **Canonical Income Ledger is the sole factual earned-income recognition authority.**
2. Reference APR/APY / Estimated generated income is analytics only.
3. Reference cannot create factual income or close a factual gap.
4. `delta != missing income`.
5. `captureRatio != accounting completeness`.
6. Broad parity does not close a month.
7. `UNKNOWN != 0`.
8. Opening balance is baseline, not current-period income.
9. Accrued entitlement can be first recognition point when mechanism evidence proves it.
10. Embedded earned income can be recognized inside a position when mechanism evidence proves it.
11. Claimable visibility alone creates no income.
12. Claim / withdrawal / receipt after prior earned recognition is settlement only.
13. Settlement provenance must remain linked to the original earned-income lane.
14. A realised receipt without explicit non-overlap proof remains unresolved.
15. Mechanism-specific first recognition at settlement requires explicit unique recognition identity.
16. Later settlement cannot rewrite the original earned month.
17. Reinvestment changes capital/productive state, not original income recognition.
18. Principal movement creates no income.
19. Exact closed calendar-month attribution requires exact mechanism proof.
20. Arbitrary cross-month intervals remain unresolved without an exact cut.
21. Time-proration across a month boundary is forbidden as factual accounting.
22. Historical valuation may resolve an unknown USD value only when provenance/identity/boundary rules are satisfied; it must not mutate immutable economic event fields.
23. Principal must be counted once across supplementary channels.
24. Supplementary Reference overlay double-add is forbidden.
25. Green CI alone is not enough; physical live-main materialization/evidence is required where a writer is involved.
26. No wallet signing, claiming, voting, transaction execution or capital movement.
27. `executionAuthority = none` unless the owner explicitly changes the boundary.

---

# 13. ACCEPTED PARTIAL / UNKNOWN STATES ARE NOT GREEN-GATE FAILURES

The green gate does **not** require inventing history that cannot be proven.

Accepted evidence boundaries include examples such as:
- ICP NNS owner-data pending until a second comparable factual owner snapshot exists;
- historical vlCVX pre-observation periods without complete safe root/claim/economic-period proof;
- historical Frax interval before first factual observation;
- historical mechanism periods where tracking existed only after part of the month;
- Monetra / Beefy cross-month intervals without exact month boundary cut.

These are acceptable when machine-classified as:
- Partial;
- Unknown;
- Tracking-no-event;
- parked evidence-pending;
- non-engineering-actionable;
- no proration;
- no zero fabrication;
- no Reference backfill.

The public foundation objective is honest evidence classification, not numerical convergence.

---

# 14. SECURITY SENTINEL IS A SEPARATE PLANE

The final #710 checkpoint explicitly clarified that:

`PUBLIC FOUNDATION v1 — GREEN`

means the Accounting / Historical Truth Foundation v1 gate is green.

It does **not** claim that every unrelated repository/security observation is closed.

CURRENT around checkpoint time still showed standalone Security Sentinel:
- status WATCH;
- Critical 0;
- High 2;
- Medium 50.

Do not conflate this separate security monitoring plane with the accounting green gate unless a new security finding directly invalidates the accounting/public-foundation acceptance or creates a required blocker under the repository's existing security policies.

Do not suppress Security Sentinel findings to make a status look greener.

---

# 15. EXACT NEXT ACTIONS IN THE NEW CHAT

The next chat should **not restart accounting forensics from veVELO**. That work is closed.

The exact continuation frontier is now post-GREEN structural cleanup:

### Step 1 — refresh live state
- fetch live main HEAD;
- read CURRENT / latest continuity / router;
- re-fetch PR #712;
- check whether main moved beyond `00abe5f...`;
- check whether #712 head moved beyond `77baedee...`;
- check exact current workflow results.

### Step 2 — resolve PR #712 Workflow Control Plane failure
- inspect live `workflow-definition-diff-policy.json` and guard implementation;
- reproduce/read the exact candidate result for the changed/deleted workflow definition;
- determine the expected proof semantics for legitimate workflow retirement / structural-debt reduction;
- add only the minimal proof/metadata required by the existing Control Plane contract;
- do not weaken guards;
- do not add a third lifecycle workflow/contract;
- retain #708 canonical lifecycle contract and strengthen it with #711 useful invariants only where already intended by #712.

### Step 3 — exact-head CI
Require all relevant checks GREEN, including at minimum:
- Income Lifecycle Acceptance Contract;
- Public Foundation v1 Final Audit;
- Workflow Control Plane;
- Repository Hygiene;
- Public Surface Privacy Guard;
- Commit Identity Privacy Guard;
- any additional checks triggered by the final exact candidate.

### Step 4 — merge #712 safely
- re-fetch PR head immediately before merge;
- merge with expected exact head SHA;
- no merge if head changed or Control Plane is red.

### Step 5 — post-merge live-main verification
After merge:
- verify duplicate #711 contract files/workflow are actually gone;
- verify the single retained #708 contract/validator remains and passes;
- verify no duplicate lifecycle source/contract/workflow exists;
- verify no accounting economic artifact changed unexpectedly because #712 should be structural only;
- verify Canonical Ledger / Coverage / Monthly Reports / Completeness / Notice / Reconciliation / Watch remain coherent;
- verify Notice/Reconciliation/Watch still show 0 engineering-actionable unless new real evidence changed that state;
- verify September still behaves as open month without August leakage;
- verify no arbitrary proration or UNKNOWN→0 regression;
- verify no open accounting PR remains unless deliberately accepted by owner.

### Step 6 — re-affirm final gate on the current clean head
Because #710 already legitimately recorded GREEN before #711, after #712 cleanup the next chat should **re-verify and re-affirm**, not rebuild the entire foundation.

Use the owner-facing phrase only after current-head proof is clean:

**🟢 PUBLIC FOUNDATION v1 — GREEN. CAN FREEZE FEATURE DEVELOPMENT AND PREPARE FOR PRIVATE-MODE WORK.**

Then tell the owner in simple Russian that:
- public accounting/history foundation is genuinely green;
- feature development can stay frozen;
- next he can do the couple of cosmetic site changes he mentioned;
- after cosmetics, private-mode work can be discussed separately.

Do not start private-mode migration mechanics automatically unless the owner asks.

---

# 16. WHAT NOT TO DO IN THE NEW CHAT

Do not:
- reopen already-closed veVELO/40 Acres forensic without new contradictory evidence;
- force Confirmed to match Estimated;
- backfill historical UNKNOWN from Reference/APR;
- treat Tracking-no-event as zero;
- time-prorate cross-month intervals;
- sum historical Votium roots naively;
- double-recognize settlement receipts;
- create another lifecycle contract parallel to #708;
- bypass Workflow Control Plane to merge #712;
- start Capital Flow Semantics;
- start Capital Scan / wallet discovery / external index expansion;
- begin private/public migration design before owner moves to that separate workstream;
- claim every Security Sentinel WATCH item is solved merely because Accounting Foundation is GREEN.

---

# 17. MINIMAL OWNER-FACING STATUS AT HANDOFF

At the moment this checkpoint was written:

- 🟢 Historical accounting forensics/public foundation had already reached formal GREEN through #709/#710.
- 🟢 veVELO valuation projection, cross-month evidence semantics, Historical Completeness Map, Reconciliation Watch and null preservation were all merged/materialized.
- 🟢 canonical lifecycle acceptance existed through #708 and final audit passed.
- 🟢 fresh production writers were still updating Monthly Reports / Completeness / Watch at 15:28–15:29 MSK.
- 🟢 fresh Reconciliation Watch showed **0 engineering-actionable** items and **0 alerts**.
- 🟡 a post-GREEN duplicate lifecycle contract introduced by #711 created structural debt.
- 🟡 PR #712 is the intended consolidation cleanup.
- 🟡 #712 exact head passed all accounting/final-audit/privacy/hygiene checks but **Workflow Control Plane remained RED at `Guard workflow definition changes`**.
- ⚪ next chat must fix that Control Plane proof legitimately, merge #712, verify clean live main, then re-affirm GREEN and hand control back to the owner for optional cosmetics.

---

# 18. ONE-LINE RESUME INSTRUCTION

**Resume from open PR #712 (`accounting/lifecycle-contract-consolidation-20260909`), not from old August forensics: fix the Workflow Definition Diff Guard proof without weakening Control Plane, get exact-head fully GREEN, merge, verify single #708 lifecycle contract + fresh accounting artifacts on live main, then re-affirm `PUBLIC FOUNDATION v1 — GREEN` and stop feature expansion before owner cosmetics/private-mode work.**

---

# 19. CHECKPOINT AUTHORITY / MERGE POLICY

This file is a recovery artifact only.

Recommended branch policy:
- keep this checkpoint branch available for the next chat;
- do **not** merge it to `main` by default merely for continuity;
- live `CURRENT.md`, immutable automatic continuity, fresh machine artifacts, open PR state and exact workflow evidence remain higher authority.

The model can change. **The memory must remain The Holding's.**
