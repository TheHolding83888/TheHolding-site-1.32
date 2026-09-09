# THE HOLDING — URGENT PUBLIC FOUNDATION GREEN CHECKPOINT
## 2026-09-09 06:40 MSK · recovery branch

Status: **RECOVERY-ONLY CHECKPOINT — DO NOT MERGE BY DEFAULT**  
Purpose: preserve the exact unfinished path to `PUBLIC FOUNDATION v1 — GREEN` before any private-mode work begins.  
Authority: observation / continuity only.  
`executionAuthority = none`.

> This document is a recovery anchor, not live truth. On resume always re-read live `main`, `intelligence/project-memory/CURRENT.md`, latest continuity, Routing Index and fresh generated artifacts/workflows. Never trust stale PR/SHA/artifact values over fresh evidence.

---

## 1. SOURCE BOUNDARY AT CHECKPOINT CREATION

Recovery branch:
`memory/urgent-public-foundation-green-checkpoint-20260909-0640-msk`

Branch source live main:
`c55df6c6b9c7b51c628b883be76d0f989fee4ecf`

Source commit message:
`memory: checkpoint continuity at 85e0e18b`

Latest automatic immutable continuity visible from that source:
`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-09_011316_AUTO_85e0e18b.md`

Its source head:
`85e0e18b0d35c27bcaffd5931d3a946c8fd4ec13`

Fresh automatic continuity snapshot states:
- Accounting Coverage v0.13.
- 29 unique mechanisms.
- reusable coverage gaps = 0.
- canonical income ledger = partial / 847 observed events at the cited generated boundary.
- current factual tracking includes veAERO, veVELO, veFRAX, veYB, Beefy cvxCRV, vlCVX, staked cvxCRV and veCRV.

IMPORTANT: generated accounting artifacts cited below were generated before later market-data / continuity-only commits. Re-read them live before mutation. Their economic/accounting structure is still the active resume context unless fresh evidence supersedes it.

---

## 2. PUBLIC→PRIVATE DEVELOPMENT GATE ALREADY DECIDED

The owner decided that public development should stop only after the current foundation is genuinely complete.

Canonical boundary:

`Accounting / Historical Truth Foundation v1`
→ **FINAL PUBLIC GREEN GATE**
→ pause feature development
→ owner may do 1–2 final cosmetic website adjustments
→ only then begin separate private-mode work.

Do **NOT** start `Capital Flow Semantics` before the green gate and the later private-mode transition.

This checkpoint intentionally does **not** prescribe what remains public/private or the migration mechanics. That will be decided separately after the public foundation is green.

PR #699 previously persisted the principle that `Capital Flow Semantics` is private-only / post-migration work.

---

## 3. NON-NEGOTIABLE ACCOUNTING LAWS

Preserve all of these during recovery:

1. Canonical Income Ledger is the sole factual earned-income authority.
2. `Reference / Estimated` is an independent analytics comparator, never factual income.
3. `Estimated + Confirmed` is forbidden as a combined income total.
4. `UNKNOWN != 0`.
5. Opening state/balance is not period income.
6. Claim / receipt / withdrawal / settlement is not a second income event when earned income was already recognized.
7. Principal must be counted once even when multiple reward overlays exist.
8. Supplementary routes such as VoteMarket / Votium cannot create a second principal.
9. Exact historical backfill must come from exact factual provenance, never current APR or reconstructed expectations.
10. A green PR is not production closure. Closure requires merged code + live main materialization / writer evidence + correct generated artifacts.
11. No signing, claiming, voting, wallet authority, capital movement or execution authority expansion.
12. Association is not causation; diagnostic spread is not missing income.

---

## 4. COMPLETED WORK — CLOSED BEFORE THIS CHECKPOINT

### 4.1 Package 1 / early accounting foundation — closed

Previously closed items include:
- UI cleanup PRs #687 / #690 / #692 / #693.
- capital-weighted Estimated guard.
- VoteMarket entitlement accounting and principal-count-once semantics.
- HyperLend apparent gap resolved through physical materialization.
- Accounting Notice Queue PR #694.
- ICP NNS canon PR #696: exact private-neuron reward income unavailable under current safe/public-read constraints; reference APR allowed only in Estimated; factual ICP income remains UNKNOWN, not zero.
- Reconciliation diagnostic originally introduced by PR #695.

### 4.2 veAERO exact closed calendar-month attribution — CLOSED

PR #697: `Accounting: recognize proven exact calendar-month embedded income`.

Merged with production materialization.

Core result:
- exact proven `Aug 1 00:00 → Sep 1 00:00` embedded-compounded income is allowed to belong to August only under strict existing mechanism proof;
- arbitrary cross-month intervals remain unresolved;
- opening balance does not create income;
- settlement does not create second income;
- Reference APR cannot create factual income.

Materialization increased factual August values where proof existed without leaking into September.

### 4.3 Reconciliation semantics — CLOSED

PR #698 closed the diagnostic interpretation problem.

Important invariant now persisted:
- a mechanism Reference APR may already include a supplementary overlay;
- principal capital is still counted once;
- overlay must not be added again merely because it exists as a separate factual reward channel;
- historical decomposition of effective APR into subchannels is not inferred when no historical proof exists.

### 4.4 Coverage / observation semantics + Frax cross-month diagnostic fix — CLOSED

PR #700 merged after exact-head 13/13 green.

Key results:
- explicit canonical `periodAttributionMonth` can resolve a diagnostic cross-month warning only when the canonical event already proves that month;
- this does not create or reallocate income;
- arbitrary cross-month intervals still fail closed;
- tracking capability is now distinct from temporary current-source observation completeness;
- temporary source failures (e.g. ICP 39/41 due rate-limit/source availability) can remain `tracking active + observation partial`; UNKNOWN values stay UNKNOWN;
- stale verifier contracts for Curve / 40 Acres / vlCVX were repaired semantically rather than weakened.

### 4.5 Production diagnostics materialization order — CLOSED

After #700 merge, production exposed a real dependency-order bug: Monthly Reports diagnostics consumed an older persisted Coverage artifact.

PR #701 fixed this.

Final architecture:
- canonical persisted `accounting-coverage.json` keeps one writer owner;
- Monthly Reports builds a fresh ephemeral `/tmp` Coverage for Notice/Reconciliation input;
- no duplicate writer debt;
- writer dependency order is correct;
- exact-head CI green;
- production run #196 green;
- physical data commit `40ae5897...` proved materialization.

### 4.6 VoteMarket principal-route isolation — CLOSED

PR #702 fixed a real reusable attribution bug.

Root cause:
`fx_vefxn` had generic accounting hints including `votemarket`; matcher used any matching hint, so `votemarket-vecrv` events also leaked into `fx_vefxn` mechanism-level Coverage/Reconciliation.

Important: canonical ledger factual income itself was not duplicated. The bug was mechanism-level diagnostic attribution.

Fix:
- supplementary VoteMarket routes are principal-bound;
- `votemarket-vecrv → curve_vecrv`;
- `votemarket-vefxn → fx_vefxn`;
- generic `votemarket` label cannot create principal identity;
- even a veCRV VoteMarket reward paid in an FXN-like token must stay on veCRV principal identity.

PR #702 exact-head CI: 12/12 green.
Merged commit: `c368c0df...`.
Monthly production run #198 green.
Persisted Accounting Coverage v0.13 materialized.

Post-fix August mechanism attribution:
- veFXN VoteMarket Confirmed = `$6.777316` (6 factual events).
- veCRV VoteMarket Confirmed = `$3.982408` (8 factual events).
- the prior veFXN `$10.759724` was exactly both channels combined and is no longer the correct mechanism attribution.
- company-level Defitea August Confirmed stayed `$25.67175109`, proving the fix changed only mechanism attribution, not factual company income.

### 4.7 ICP — PARKED / CLOSED FOR CURRENT PUBLIC FOUNDATION

Current safe interpretation:
- ICP/NNS position itself is tracked structurally.
- current Reference APR contributes to Estimated / company reference view.
- exact NNS maturity/reward income is not automatically/publicly measurable under the current safe setup.
- Confirmed ICP income therefore remains UNKNOWN, not zero.
- temporary incomplete public observation does not erase known tracking capability.

Do not reopen ICP before the green gate unless materially new factual/public evidence appears.

---

## 5. AUGUST FORENSIC CLASSIFICATIONS ALREADY REACHED

These are important because the objective is **not numerical convergence**.

### 5.1 veFXN / VoteMarket — CLOSED AFTER #702

Current correct August factual mechanism attribution:
- native/supplementary principal attribution is isolated;
- `fx_vefxn` Confirmed is no longer contaminated by veCRV VoteMarket events;
- remaining Reference-vs-Confirmed spread is diagnostic/model/evidence-window variance unless future factual proof says otherwise.

Do not “fill” the remaining spread.

### 5.2 vlCVX / Votium / Union — CLASSIFIED PARTIAL / UNKNOWN, NO BACKFILL

Forensics performed:
- first member-level Union-era historical evidence appears in the latter half of August;
- first saved week-45 Union state is an opening/baseline state, not proven newly-earned August income;
- legacy direct Votium Merkle state was investigated through Git history and upstream contract semantics;
- `MultiMerkleStash` stores a current root and increments update epochs; a new root replaces the previous current root for claim verification;
- therefore historical roots are not safely additive by themselves;
- a claim / carry-forward / epoch-economic-period link would be needed to reconstruct historical earned income without guessing;
- current evidence does not safely prove a full August amount.

Conclusion:
**vlCVX August remains Partial/UNKNOWN. Do not backfill from current APR, current claimable state, or by summing historical Merkle roots.**

This is an evidence boundary, not an accounting bug and not a zero-income conclusion.

### 5.3 Frax / veFRAX — CLASSIFIED PARTIAL / UNKNOWN FOR AUGUST, NO FULL-MONTH BACKFILL YET

Current factual adapter constants:
- `FULL_ACCOUNTING_START = 2026-09-01T00:00:00Z`
- `PARTIAL_BOOTSTRAP_START = 2026-08-27T00:00:00Z`

Current August facts at the latest materialized boundary:
- Reference roughly `$3.90015267`.
- Confirmed roughly `$0.4411922`.
- factual event count = 10.
- first factual evidence = `2026-08-27T16:33:06.991Z`.
- cross-month evidence is explicitly attributed, unresolved cross-month count = 0.
- mechanism complete for August = false.

Interpretation:
`$0.4411922` is factual late-August coverage, not proof of full-month August income.

The adapter correctly uses:
`closing earned + YieldCollected settlements - opening earned`
with claim as settlement, not second income.

A full August backfill would require exact historical archive-state boundaries + all relevant settlements + historical frozen valuation/provenance. Current public foundation has not yet proven that safely.

Conclusion for now:
**Frax August remains Partial/UNKNOWN outside the observed tail. Do not force it toward Reference.**

---

## 6. CURRENT ACTIVE FRONTIER AT CHAT INTERRUPTION

### ACTIVE: Defitea `velodrome_vevelo` / 40 Acres August

Fresh reconciliation context already read before this checkpoint:

August:
- mechanism = `velodrome_vevelo`
- Reference ≈ `$3.30088136`
- Confirmed = `null`
- status = not-comparable.

September:
- Reference ≈ `$1.6081899`
- Confirmed ≈ `$1.39483227`
- capture ≈ `0.867331`
- review-band.

Coverage registry currently links **5 canonical 40 Acres realised receipt events** to `velodrome_vevelo` as settlement links.

Critical semantic already persisted:
- those five realised receipts are settlement links to an active productive mechanism;
- settlement linkage preserves the original income family;
- settlement linkage is **not period-income authority** by itself;
- do not count a receipt as August earned income merely because it arrived in August;
- if earned/accrued income was recognized elsewhere, receipt is settlement only.

The active forensic question that must be resumed:

**Does Defitea have factual August veVELO/40 Acres earned/accrual evidence independent of the five settlement receipts, or is August legitimately UNKNOWN/partial while September is factual?**

Recommended next reads:
- `reporting/accounting-coverage.json` → Defitea `velodrome_vevelo` month blocks.
- `reporting/accounting-reference-reconciliation.json` → August/September `velodrome_vevelo` rows.
- `reporting/defitea-income-ledger.json` → five `fortyAcresReceivedEvents` and any earned/accrued lane.
- `reporting/defitea-forty-acres-settlement.mjs` + validation.
- ve(3,3) accounting evidence / locked-managed evidence where Velodrome routes are present.
- relevant historical rewards/evidence snapshots if necessary.

Decision rule:
- if an independent factual entitlement/accrual lane is proven → recognize exactly once in canonical accounting and keep receipts settlement-only;
- if not → August remains Partial/UNKNOWN; no Reference backfill.

Do **not** treat September broad/review parity as proof that August was complete.

---

## 7. REMAINING AUGUST TAILS AFTER veVELO / 40 ACRES

After the active frontier, continue systematically through remaining material Defitea August mechanisms.

### 7.1 veCRV / VoteMarket

Principal-isolation bug is already fixed by #702.

Need now classify remaining August spread using:
- veCRV base fee evidence;
- VoteMarket entitlement events;
- separate supplementary-channel semantics;
- no duplicate principal;
- claim/receipt settlement-only where applicable.

Known factual VoteMarket August component currently isolated at about `$3.982408`.

Do not infer missing base fees from Reference APR.

### 7.2 staked cvxCRV / Convex-related tails

Inspect current Coverage/Reconciliation rows and exact historical factual evidence.

If there is tracking capability but no period event, classify `tracking-no-period-event` / Partial / UNKNOWN according to evidence. Do not convert absence into zero unless the source proves zero.

### 7.3 Beefy / Yield Basis / other material tails

Use current rows rather than historical rough numbers.

For each mechanism answer only:
1. Is factual tracking capability present?
2. Is August factual period evidence present?
3. Is the observation window complete?
4. Is any lifecycle/boundary issue unresolved?
5. Is the Reference spread merely diagnostic/model variance?
6. Is there a real reusable engineering gap?

Only code when there is a reusable engineering defect or a safely provable missing factual lane.

---

## 8. SEPTEMBER LIVE VALIDATION — REQUIRED BEFORE GREEN GATE

After August forensics, validate September live operation end-to-end.

Minimum proof:
- September is the active month across all companies/mechanisms that should roll monthly.
- New September income does not leak back into August.
- Exact month-boundary logic remains stable after all August fixes.
- Current factual adapters remain operational.
- temporary source degradation is represented as partial/UNKNOWN, not zero and not false coverage loss.
- claims/receipts do not double-count previously earned income.
- Reference/Estimated stays non-factual and capital-weighted.
- company scopes and canonical ownership remain consistent.

Do not declare September complete simply because the current partial month is broadly close to Reference.

---

## 9. HISTORICAL COMPLETENESS MAP — MUST EXIST BEFORE GREEN

Create a durable machine-readable / human-readable map:

`company × mechanism/channel × month`

with explicit states such as:
- `Complete`
- `Partial`
- `Tracking-no-event`
- `Unknown`
- `N/A`

The map must distinguish:
- tracking capability;
- observation completeness;
- factual period-income evidence;
- lifecycle/boundary blockers;
- model/reference availability.

It must not use Reference parity as completion authority.

This is required so future Historical Scanner work starts from known evidence boundaries instead of re-investigating every mechanism.

---

## 10. AUTOMATIC RECONCILIATION WATCH — MUST BE CLOSED

The existing Reconciliation diagnostic should become a stable ongoing watch layer that surfaces material divergence without inventing missing income.

Required invariants:
- delta != missing income;
- capture ratio != accounting completeness;
- model variance possible != model variance proven;
- mechanism/reference scopes may differ from company scopes;
- principal counted once;
- supplementary overlay double-add forbidden;
- explicit canonical period attribution can resolve diagnostic boundary but cannot create income;
- UNKNOWN stays UNKNOWN.

Goal:
**100% of economically meaningful divergence becomes evidence-explained, explicitly partial/pending, explicitly model/reference variance where proven, or permanently UNKNOWN when proof is unavailable.**

No target of Confirmed = Estimated.

---

## 11. POSITION / INCOME LIFECYCLE CONTRACT — MUST BE CLOSED BEFORE GREEN

Persist and validate the lifecycle:

`earned → accrued → claimable → claimed → received → reinvested`

Required behavior:
- the same economic income must not be recognized twice as it progresses through states;
- settlement events preserve linkage/provenance;
- later claim/receipt must not rewrite historical earned income;
- opening balances remain baselines;
- current claimable balance is not automatically current-period income;
- reinvestment changes capital state, not original income recognition.

This must be reusable across 40 Acres, VoteMarket, Votium/Union, Frax, ve(3,3), Curve fees and future mechanisms.

---

## 12. FINAL PUBLIC FOUNDATION REGRESSION / MATERIALIZATION AUDIT

Before the owner is told the public foundation is green:

1. re-read fresh `main`;
2. ensure no open accounting PRs remain;
3. run / inspect all relevant exact-head CI for final code;
4. verify writers physically materialize generated artifacts on main;
5. verify Accounting Coverage has no reusable gaps unless explicitly accepted/parked with evidence;
6. verify Notice Queue and Reconciliation are generated from fresh compatible inputs;
7. verify no duplicate generated-file writers / structural debt was introduced;
8. verify privacy/security/hygiene guards green;
9. verify canonical ledger totals did not change from diagnostic-only fixes unless factual evidence explicitly justified the change;
10. verify August/September month isolation;
11. verify Historical Completeness Map and lifecycle contract exist and validate;
12. write a final public-foundation checkpoint / inventory.

Only then report exactly:

**🟢 PUBLIC FOUNDATION v1 — GREEN. CAN FREEZE FEATURE DEVELOPMENT AND PREPARE FOR PRIVATE-MODE WORK.**

Do not use that wording earlier.

---

## 13. OPTIONAL LAST COSMETIC PASS BEFORE FREEZE

The owner may request 1–2 cosmetic/physical display changes on the website after the engineering green gate.

These must remain bounded presentation changes and must not reopen accounting methodology unless a real defect is discovered.

After cosmetics, repeat the relevant UI/build/privacy regression and materialization proof, then re-affirm the same green gate.

---

## 14. WHAT MUST NOT START BEFORE GREEN / PRIVATE TRANSITION

Do not start the next architecture layers yet:

`Capital Flow Semantics`
→ `Position Lifecycle` as the next larger capital-flow architecture layer
→ `Wallet Discovery`
→ `Unknown Strategy Queue`
→ `Historical Scanner`
→ `Company Book`
→ `Sensors / Economic Graph`
→ arbitrary-wallet support
→ Free Capital Scan
→ Verify / Register / Index expansion.

Note: the accounting income lifecycle contract in section 11 is a prerequisite accounting semantic; this is different from starting the later full capital-flow Position Lifecycle roadmap layer.

---

## 15. RESUME ORDER FOR NEXT CHAT

If this chat dies, next chat should do:

1. Read live `intelligence/project-memory/CURRENT.md`.
2. Read live `intelligence/project-memory/CONTINUITY.md` and latest immutable continuity.
3. Read Routing Index blocks relevant to Accounting / Reporting / Public Foundation gate.
4. Read this checkpoint from branch:
   `memory/urgent-public-foundation-green-checkpoint-20260909-0640-msk`.
5. Re-check live `main` head and all accounting artifacts because autonomous market/security/continuity writers may have advanced main.
6. Confirm PR #702 remains merged/materialized and Coverage is still v0.13 or later compatible version.
7. Resume exactly at **Defitea veVELO / 40 Acres August forensic**.
8. Continue remaining August tails.
9. Complete September live validation.
10. Build Historical Completeness Map.
11. Close automatic Reconciliation Watch.
12. Close reusable income lifecycle contract.
13. Run final regression + production materialization audit.
14. Only when all evidence is green, notify owner with the exact public foundation green gate wording.
15. Do not begin private-mode architecture or Capital Flow Semantics before that owner-facing green gate.

---

## 16. LAST OWNER INTENT

Owner explicitly asked:
- finish everything required to a genuine green checkpoint;
- tell him only when the green checkpoint is real;
- possibly do a couple of final cosmetic website details;
- then pause development so private-mode work can be handled separately;
- preserve enough detail that another chat can continue without losing the frontier.

This checkpoint exists for exactly that purpose.
