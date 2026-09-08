# THE HOLDING — URGENT PUBLIC FOUNDATION GREEN CHECKPOINT
## 2026-09-08 21:03 MSK · pre-private-migration completion frontier

Status: **MANUAL RESUME CHECKPOINT — ACTIVE WORK NOT YET GREEN**  
Authority: continuity / recovery only  
executionAuthority: **none**

> This file exists so a fresh chat/model can resume the exact unfinished path to the owner's final green gate without reconstructing it from conversation memory. It is NOT completion proof, NOT methodology authority, and NOT a substitute for fresh live evidence.

---

## 0. OWNER DIRECTIVE / STOP CONDITION

Owner directive at this checkpoint:

1. Finish the current public foundation **all the way to a real green gate**, not “almost done”.
2. Preserve accounting truth, UNKNOWN semantics, provenance, read-only authority and production evidence.
3. After the engineering/accounting foundation is fully green, only a small final cosmetic pass on the public site may remain.
4. Only after that green/freeze point should the project move into the later private-mode phase.
5. **Do not decide in this checkpoint what remains public vs private.** That scope will be decided separately after the green gate.
6. New work such as Capital Flow Semantics / Position Lifecycle / Wallet Discovery / Sensors must NOT be started before this public-foundation gate is closed unless required to repair an existing regression.

Required final message to owner only when objectively true:

> **🟢 PUBLIC FOUNDATION v1 — GREEN. МОЖНО FREEZE И ПЕРЕХОДИТЬ К PRIVATE MIGRATION.**

Do not emit that sentence until merge + live-main materialization + downstream validation evidence are complete.

---

## 1. CANONICAL RECOVERY ORDER

Every new chat must recover from live truth, not this prose alone:

`LIVE main → intelligence/project-memory/CURRENT.md → latest continuity → Memory Routing Index → task-specific canons/context → fresh artifacts → exact workflow/materialization evidence → this checkpoint as unfinished-work map`

At checkpoint creation:

- live `main`: `74076a48c186554aee1ffb3c9ccc6381a0224a20`
- live main message: `market data: refresh shared public snapshot`
- previous main parent: `30fa32bbc7121d1dfa859a5d4825f3a756e8d746`
- CURRENT points to automatic continuity `THE_HOLDING_MASTER_CONTINUITY_2026-09-08_172838_AUTO_67dbd636.md`.
- That continuity predates the active accounting PR work; use it for durable context only, then read fresh artifacts/actions.

Canonical laws that must survive all remaining fixes:

- Canonical Income Ledger is the sole factual earned-income authority.
- Reference / Estimated is analytics only and can never backfill factual income.
- `UNKNOWN != 0`.
- Opening balance is not period income.
- Claim / receipt / withdrawal after prior accrual recognition is settlement, not second income.
- Principal is counted once.
- Supplementary channels such as VoteMarket do not create second principal TVL.
- Green CI alone is not production closure; require live-main artifact materialization where relevant.
- `executionAuthority = none`; no signing, claiming, voting, transactions, capital movement or autonomous methodology mutation.

---

## 2. WHAT IS ALREADY CLOSED / PROVEN

### 2.1 Package 1 accounting foundation — closed

Previously closed and merged before the current frontier:

- public/report UI cleanup and accounting presentation fixes;
- capital-weighted Estimated / Reference guard;
- VoteMarket factual entitlement lane with principal counted once;
- VoteMarket supplementary income separated from base productive principal;
- HyperLend apparent gap resolved through physical materialization;
- Accounting Notice Queue introduced;
- ICP NNS accounting canon established and exact factual reward limitation documented;
- automatic Reference-vs-Confirmed reconciliation diagnostic established.

Important ICP result:

- ICP productive position is structurally tracked and contributes to company Reference / Estimated via current NNS reference APR.
- Exact NNS maturity/reward is not safely available as factual company-period income under current evidence boundary.
- Therefore ICP factual reward remains UNKNOWN/partial, not zero.
- Reference APR never becomes factual authority.

### 2.2 Exact calendar-month embedded-income boundary fix — fully closed

PR **#697**: `Accounting: recognize proven exact calendar-month embedded income`

Branch:
`accounting/exact-month-boundary-embedded-income-20260908`

Key implementation:

- exact UTC calendar-month embedded interval such as `2026-08-01T00:00:00Z → 2026-09-01T00:00:00Z` can be attributed to August **only** under already-proven locked-managed evidence semantics;
- arbitrary cross-month intervals remain unresolved / fail-closed;
- no ledger rewrite and no Reference APR backfill;
- later settlement remains settlement-only.

Merged commit:
`fd13ee970e3b36eebb8d9224fa4c3d4df854792b`

Production monthly-report materialization commit:
`aa54c70762fe1ac15206f6facc210dcc99045be8`

Subsequent security memory commit:
`99646672a9fc49a941a4bdcb271969eb83b11553`

Materialized effects included:

- `05081966.eth` August confirmed: `$0.07293433 → $1.32868564`;
- its locked-managed embedded August event: `+$1.25575131`;
- Defitea August confirmed: `$13.46690579 → $25.67175109`;
- Defitea locked-managed veAERO August factual addition: `+$10.94909399`;
- Defitea unresolved lifecycle count for this boundary class: `2 → 0`;
- Defitea boundary issue for that class: `true → false`;
- no September leakage;
- same generic fix also improved other companies, proving it was not Defitea-specific.

Important scope rule retained:

- Defitea report can intentionally include associated-company reporting scope (`YieldRing.eth`, `05081966.eth`), but Holding-wide aggregation must use canonical ownership to avoid double count.

### 2.3 veFXN / VoteMarket reconciliation semantics — investigated

The prior apparent Defitea `fx_vefxn` Reference-vs-Confirmed gap was explicitly treated as diagnostic, not automatically “missing income”.

Known August comparison at the beginning of this frontier:

- reference: about `$22.99201557`;
- confirmed: about `$10.759724`;
- delta: about `$12.23229157`.

Known September comparison:

- reference: about `$8.11809995`;
- confirmed: about `$4.566646`.

Do NOT force convergence. Base veFXN productive principal and VoteMarket supplementary factual entitlement are distinct channels on the same principal. Historical effective Reference APR may include overlay economics and is not evidence that the full numeric delta is missing factual income.

### 2.4 Private migration gate memory — already merged, but not a migration decision

PR **#699** merged earlier:
`Memory: define private migration gate`

Merge:
`67dbd63670b96a0d2d3fdf4aa237dea911a7d9f8`

This only records that private migration occurs after the public foundation gate. It does NOT decide final public/private repository split. The owner explicitly wants that decision postponed.

---

## 3. ACTIVE PR / CURRENT ENGINEERING FRONTIER

### 3.1 PR #700 — NOT GREEN YET

PR **#700**:
`Accounting: respect explicit canonical month attribution`

Branch:
`accounting/coverage-explicit-month-attribution-20260908`

Checkpoint-observed PR head:
`482b5bfda5ebfc43b693de58d74e6b0972d9ed66`

PR base when opened:
`30fa32bbc7121d1dfa859a5d4825f3a756e8d746`

Current live main has since advanced to:
`74076a48c186554aee1ffb3c9ccc6381a0224a20`

Therefore re-check/rebase/mergeability against fresh main before merge. Do not assume old PR merge ref is current.

### 3.2 Root cause addressed by PR #700

A Frax diagnostic false positive was found:

- Canonical Ledger already carried an explicit `periodAttributionMonth` proving the economic month for certain exact cross-month evidence;
- Accounting Coverage ignored that canonical attribution and re-derived boundary ambiguity only from raw `periodStart/periodEnd`;
- result: factual income itself was correct, but Coverage could falsely report an unresolved period-boundary blocker.

Correct general invariant implemented:

- raw cross-month evidence is still visible for audit;
- an explicit canonical `periodAttributionMonth` may resolve the **diagnostic boundary only** when it matches the target month;
- this does not create, move, estimate, duplicate or rewrite income;
- arbitrary/unattributed cross-month evidence remains fail-closed.

### 3.3 ICP observation-completeness regression discovered during #700

Fresh ICP public-neuron observation temporarily returned only **39/41 complete neuron reads** because two requests were unavailable/rate-limited.

Critical distinction established:

- **tracking capability** did not disappear: all 41 neuron identities remained configured/queried;
- **current observation completeness** became partial: 39/41 fully observed, 2/41 unavailable/UNKNOWN;
- temporary source failure must not erase the existence of tracking capability;
- unavailable observations must never be converted to zero or factual income.

The branch moved Accounting Coverage to a capability-vs-observation contract (reported as Coverage Registry v0.12 in CI):

- coverage gaps: `0`;
- partial-observation mechanisms: `2` (ICP allocations);
- reusable missing capability: none;
- factual income remains UNKNOWN where source observation is unavailable.

This is the correct semantic direction and must remain guarded.

---

## 4. EXACT CI STATE OF PR #700 AT CHECKPOINT

Do not call #700 green yet.

A fresh PR run on head `482b5bfd...` showed:

### Passing / semantically healthy

- Verify Accounting Coverage Registry — PASS
- Verify GMX Accounting Tracking — PASS
- Verify Project X Accounting Tracking — PASS
- Verify HyperLend Accounting Tracking — PASS
- Verify Concentrator Accounting Tracking — PASS
- Public Surface Privacy Guard — PASS
- Commit Identity Privacy Guard — PASS
- Repository Hygiene Guard — PASS
- Reference APR capital-weighting guard — PASS
- exact month-boundary accounting validation — PASS
- company monthly report generation/validation itself — PASS before dependent diagnostics
- Accounting Coverage v0.12 build — PASS with `coverageGaps: 0`, `partialObservationMechanisms: 2`
- Accounting Notice Queue build/validation — PASS

### Failing because dependent guards still expect old artifact shape/version

1. **Verify Company Monthly Reports**
   - failure occurs in accounting diagnostics;
   - new reconciliation builds as version:
     `0.2-accounting-reference-reconciliation-cross-month-attribution`
   - validation still asserts old exact string:
     `0.1-accounting-reference-reconciliation`.
   - Required action: update the reconciliation validation contract to the new version **and add/retain semantic assertions**, not merely loosen/remove the check.

2. **Verify Curve Fee · Factual Accounting**
   - Curve factual adapter, ledger admission, route discovery and Curve-specific accounting coverage all PASS;
   - regression guard deep-compares pre-change Coverage row to regenerated Coverage row;
   - v0.12 adds a new generic diagnostic field such as `currentMonthPartialObservationCompanyCount: 0`, so deep-equality fails although Curve economics did not change.
   - Required action: update the Curve regression guard to compare the stable Curve semantic/economic slice rather than requiring byte/shape identity across an intentional generic registry schema extension.
   - Do NOT weaken factual Curve lifecycle assertions.

3. **Verify Settlement Accounting Links**
   - was red in the same PR run and must be inspected separately before green.
   - Do not assume it is harmless until exact job logs identify the failing assertion.

4. **Verify vlCVX · Convex Team Settlement Boundary**
   - was still in progress at one observed point; fetch its final conclusion on fresh head.

The current red state is mostly dependent-contract drift, but every remaining failure must be inspected and closed with exact-head CI proof.

---

## 5. REQUIRED IMMEDIATE RESUME STEPS

A fresh chat should continue in this exact order:

### Step A — refresh live truth

1. Fetch live `main` head.
2. Fetch live PR #700 head/base/mergeability.
3. Fetch all exact-head workflow conclusions and failed job logs.
4. Compare branch to fresh main; incorporate non-conflicting market/security/memory movement without losing accounting changes.

### Step B — finish PR #700 cleanly

1. Update `reporting/accounting-reference-reconciliation-validation.mjs` for reconciliation v0.2 with explicit semantic guards for cross-month attribution.
2. Repair Curve workflow regression check to ignore generic additive Coverage-schema fields while still asserting Curve-specific accounting semantics/economic values/tracking identity are unchanged.
3. Inspect and repair Settlement Accounting Links failure only after identifying exact assertion.
4. Inspect final vlCVX settlement-boundary workflow conclusion.
5. Run/observe exact-head full CI.
6. Require all relevant workflows green.
7. Merge only against expected current head.
8. Require downstream production/reporting materialization where the changed registry/reconciliation artifacts are persisted.
9. Re-read live-main `reporting/accounting-coverage.json`, `reporting/accounting-reference-reconciliation.json`, monthly reports and notice queue.
10. Prove the Frax false boundary blocker is gone, unresolved arbitrary cross-month evidence still fails closed, ICP partial observation is represented honestly, and no factual totals were synthetically changed.

### Step C — continue August reconciliation tails

After #700 is physically closed, continue the remaining forensic order. Each item is classification work, not a convergence target.

1. **veVELO / 40 Acres**
   - verify earned/accrual vs settlement relationship;
   - receipt/withdrawal must remain settlement-only when income already recognized;
   - no second counting.

2. **veCRV / VoteMarket**
   - Curve base fee and VoteMarket supplementary entitlement are separate channels;
   - same principal cannot be counted twice;
   - claims/settlements cannot create second earned events.

3. **vlCVX**
   - inspect historical completeness and Convex Team / platform / extra-reward evidence;
   - current factual tracking does not automatically prove full August history;
   - do not reconstruct August from current APR.

4. **Frax / veFRAX**
   - after #700 materializes, re-check August boundary/partial-window diagnostics;
   - rough old reference-vs-confirmed comparison was approximately `$3.90` vs `$3.11`, but re-read fresh artifacts instead of trusting this checkpoint number.

5. **staked cvxCRV / Beefy / Yield Basis / other tails**
   - inspect factual lifecycle coverage;
   - classify legitimate model variance vs partial tracking vs evidence pending vs permanently UNKNOWN;
   - no Reference backfill.

Every economically meaningful divergence must end in one of these explicit classes:

- factual income captured;
- capture/accounting gap fixed;
- lifecycle/boundary issue fixed;
- legitimate model/reference variance documented;
- evidence pending / partial;
- permanently UNKNOWN under current evidence boundary;
- N/A / no event.

Do not set Confirmed equal to Estimated as a goal.

### Step D — September live validation

After August tails are classified:

1. verify every company has September period opened correctly;
2. verify new September earned events are entering September, not August;
3. verify no exact-month August boundary fix leaked into September;
4. verify all active mechanisms show one of: factual event / tracking-no-event / partial observation / UNKNOWN / N/A;
5. verify Reference / Estimated continues to be analytics only;
6. inspect current-month unresolved lifecycle counts and notice queue;
7. prove automatic month rollover is functioning generically for future months.

### Step E — materialize Historical Completeness Map

Required machine-readable map:

`company × mechanism/channel × month → Complete | Partial | Tracking-no-event | Unknown | N/A`

It must distinguish:

- current tracking capability;
- historical evidence completeness;
- temporary observation/source failures;
- factual events;
- settlement-only events;
- unresolved lifecycle/boundary cases.

The map must not gain month-closing authority merely because it labels completeness.

### Step F — automatic Reconciliation Watch

Create/reuse a diagnostic watch over Estimated/Reference vs Confirmed that:

- surfaces meaningful divergence;
- explains reason codes/classification;
- never infers missing income solely from delta;
- never replaces UNKNOWN;
- has no factual income or month-closing authority;
- avoids noisy alerts for known legitimate model variance.

### Step G — lifecycle closure

Ensure accounting lifecycle is explicit and testable:

`earned → accrued → claimable → claimed → received → reinvested`

Requirements:

- one economic income event recognized once;
- later lifecycle transitions linked to the original economic event;
- settlement does not create second earned income;
- partial/UNKNOWN states survive when evidence is absent;
- lifecycle evidence supports August/September diagnostics.

### Step H — final public-foundation regression / materialization audit

Before green:

1. full relevant accounting/reward/reporting CI green on exact head;
2. privacy/security/repository hygiene guards green;
3. live main contains final code + generated artifacts;
4. downstream writer/materializer jobs completed successfully;
5. no reusable Accounting Coverage gaps;
6. no unexplained engineering-actionable accounting notices remain;
7. every remaining Reference-vs-Confirmed divergence has classification, not numerical hand-waving;
8. September is live and correct;
9. future rollover remains automatic;
10. canonical ledger/authority invariants unchanged;
11. no accidental double counting through associated companies or supplementary channels;
12. no factual income created by Reference APR, current APR, historical approximation or unavailable source state.

Only then can engineering/accounting foundation be called green.

---

## 6. COSMETIC PUBLIC-SITE PASS AFTER ENGINEERING GREEN

Owner expects there may be one or two small physical-display/cosmetic nuances on the site after the accounting foundation is green.

Rules:

- do not redesign accepted surfaces unnecessarily;
- preserve already accepted desktop/laptop behavior while fixing only the actual visual issue;
- cosmetic changes must not alter accounting semantics or authority;
- after cosmetic PR(s), run relevant UI/privacy/repository guards and materialize on live site;
- then freeze public foundation v1.

This cosmetic pass is the last allowed public-foundation layer before the later private-mode work.

---

## 7. THINGS A NEW CHAT MUST NOT DO

- Do not start from this checkpoint without refreshing live main.
- Do not interpret Reference delta as missing income.
- Do not fill UNKNOWN with zero or APR-derived historical estimates.
- Do not count VoteMarket and base principal as two TVLs.
- Do not count settlement as second earned income.
- Do not declare an old CI run sufficient after the branch/head has changed.
- Do not declare green before downstream artifact materialization.
- Do not begin Capital Flow Semantics / Position Lifecycle / Wallet Discovery / Sensor expansion before this gate closes.
- Do not decide the later public/private repository split here.
- Do not move capital or gain wallet execution authority.

---

## 8. HIGH-VALUE FILES FOR RESUME

Primary accounting/runtime:

- `reporting/income-ledger.json`
- `reporting/company-monthly-reports.json`
- `reporting/accounting-coverage.json`
- `reporting/accounting-coverage.mjs`
- `reporting/accounting-coverage-validation.mjs`
- `reporting/accounting-notice-queue.json`
- `reporting/accounting-reference-reconciliation.json`
- `reporting/accounting-reference-reconciliation.mjs`
- `reporting/accounting-reference-reconciliation-validation.mjs`
- `reporting/canonical-earned-income-view.mjs`
- `reporting/ve33-locked-managed-accounting-evidence.json`
- `reporting/frax-yield-accounting-evidence.json`
- `reporting/icp-nns-factual-snapshots.json`
- `companies/icp-nns-rewards-state.json`
- `companies/productivity-data.json`

Relevant CI/workflows:

- Verify Company Monthly Reports
- Verify Accounting Coverage Registry
- Verify Curve Fee · Factual Accounting
- Verify Settlement Accounting Links
- Verify vlCVX · Convex Team Settlement Boundary
- protocol-specific factual tracking validators
- Public Surface Privacy Guard
- Commit Identity Privacy Guard
- Repository Hygiene Guard

---

## 9. CURRENT GREEN-GATE STATUS AT THIS CHECKPOINT

### 🟢 Closed

- Package 1 accounting/presentation foundation.
- Canonical factual income authority and Reference/Estimated separation.
- exact proven calendar-month locked-managed boundary recognition (#697) + production materialization.
- principal/supplementary-channel non-duplication semantics.
- ICP accounting boundary: structural/reference tracking yes; unavailable exact maturity remains UNKNOWN.
- private-migration gate exists in memory, without deciding final public/private split.

### 🟡 Active / must finish

- PR #700 full CI repair, rebase against fresh main, merge and production materialization.
- dependent validation-contract updates caused by Coverage/Reconciliation schema evolution.
- inspect remaining Settlement/vlCVX exact failures.
- August remaining mechanism/channel classification tails.
- September live completeness validation.
- Historical Completeness Map.
- Reconciliation Watch.
- explicit lifecycle closure and regressions.
- final full-system regression/materialization audit.
- optional tiny site cosmetic pass.

### 🔴 Green gate not yet earned

Do **not** report `PUBLIC FOUNDATION v1 — GREEN` yet.

---

## 10. FINAL RESUME SENTENCE

A new chat should read this only after the canonical recovery path and then continue:

> Resume the unfinished public-foundation green frontier. First finish and physically close PR #700 against fresh live main, then complete August classification tails, September validation, Historical Completeness Map, Reconciliation Watch, lifecycle and full regression/materialization proof. Do not start private-mode architecture decisions or the next Capital Flow/Sensor roadmap layer until the owner-facing green gate is objectively earned.

The model can change. **The memory must remain The Holding's.**
