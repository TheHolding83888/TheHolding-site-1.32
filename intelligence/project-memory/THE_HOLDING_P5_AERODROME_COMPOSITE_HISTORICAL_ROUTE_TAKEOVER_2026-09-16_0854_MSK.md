# THE HOLDING — P5 AERODROME COMPOSITE HISTORICAL ROUTE TAKEOVER
## 2026-09-16 08:54 MSK · urgent branch-local handoff

Status: **ACTIVE / NOT MERGE-READY / TAKEOVER CHECKPOINT**  
Authority: **observation + implementation handoff only**  
executionAuthority: **none**

> This file is intentionally committed to the feature branch, not `main`. It is a precise handoff for another chat/agent to resume the work without guessing. It does not replace live `CURRENT.md`, canonical continuity, Router, or fresh machine evidence. Before continuing, re-read live `main`, current PR state, exact-head Actions and generated artifacts.

---

## 1. EXACT TAKEOVER BOUNDARY

Repository: `TheHolding83888/TheHolding-site-1.32`

Feature branch:
`fix/p5-aerodrome-composite-historical-route-20260916`

Pull request:
`#836 — Accounting: add exact-block Aerodrome AERO quote fallback`

PR URL:
`https://github.com/TheHolding83888/TheHolding-site-1.32/pull/836`

Branch was created from fresh `main`:
`917a11e8117b488a98d2ddaed47b47765f44ccb6`

Pre-handoff implementation head before this checkpoint commit:
`3375a8d8b9b8068756b4d84a9318a0485f23f3e9`

At the time of handoff PR #836 was:
- open
- not merged
- mergeable according to GitHub metadata
- 4 implementation commits before this handoff commit
- 4 changed implementation/test files before this handoff commit
- no generated production artifacts committed
- no accounting-recognition semantics deliberately changed

IMPORTANT: after this checkpoint commit, the PR head advances. Always fetch the current PR head before acting.

---

## 2. WHY THIS WORK EXISTS

Current Public Green roadmap frontier is P5 historical USD valuation completeness.

The accounting system already follows the required laws:
- Canonical Income Ledger is the sole factual earned-income recognition authority.
- `UNKNOWN != 0`.
- Historical USD must be proven at the relevant historical boundary/block.
- No current-price backfill.
- No stablecoin peg assumption.
- No APR/APY inference as factual income.
- No duplicate recognition at later settlement/claim.

Earlier P5 work materially reduced canonical historical USD blockers, but reusable unresolved cases remained.

The specific remaining reusable Aerodrome problem identified in this session:
- the generic historical Aerodrome discovery path could prove `reward token -> native Base USDC` via exact-block Slipstream TWAP;
- but if the reward token had no usable direct USDC pool at the historical closing block, discovery stopped and the event stayed UNKNOWN;
- some reward tokens can have a valid historical route through another approved Aerodrome quote asset such as AERO;
- the repository already contains a reusable exact-block Chainlink historical pricing primitive, so a new pricing engine is unnecessary and undesirable.

Goal of PR #836:
**extend the existing reusable Aerodrome historical valuation route from one-hop quote discovery to a narrowly approved two-leg composite route while preserving fail-closed accounting.**

Target composite path:
`reward token -> AERO (Aerodrome Slipstream TWAP at exact closing block) -> USD (official Base AERO/USD Chainlink at the same exact closing block)`

Existing direct path remains first priority:
`reward token -> USDC (Aerodrome Slipstream TWAP at exact closing block) -> USD (official Base USDC/USD Chainlink at same exact closing block)`

This is not a token-specific reward accounting patch. It is intended as reusable route infrastructure for supported Aerodrome ve(3,3) reward tokens.

---

## 3. EXISTING REUSABLE PRIMITIVES CONFIRMED BEFORE PATCH

### A. Exact-block Aerodrome Slipstream route discovery
File:
`reporting/historical-aerodrome-usdc-route.mjs`

Important existing behavior:
- canonical Aerodrome Slipstream factories are allowlisted;
- canonical tick spacings are bounded;
- reads occur at the exact historical `sourceBlockNumber`;
- closing block timestamp must be at/before accounting boundary and within a strict lag bound;
- reward-token decimals are read at the historical block;
- pool token identity is verified;
- active liquidity is required;
- a positive 5-minute TWAP is required;
- candidate selection is deterministic by highest active historical liquidity;
- ambiguous equal-liquidity result fails closed;
- current price is not used;
- stablecoin peg is not assumed;
- `executionAuthority = none`.

Before this PR the module is named around USDC and takes a fixed quote token by default, but the underlying factory/pool/TWAP machinery is reusable.

### B. Exact-block historical Chainlink resolver
File:
`reporting/historical-canonical-price.mjs`

Existing reusable helper:
`historicalChainlinkPriceAtBoundaryForRoute(...)`

Important existing behavior:
- exact closing block is derived from ve33 event/source identity;
- registry network/chain identity must match;
- block number and block timestamp are verified;
- Chainlink decimals and `latestRoundData()` are read using `eth_call` at the exact historical block tag;
- round integrity is checked;
- observation timestamp must be <= closing block and <= accounting boundary;
- staleness is bounded by route-specific max age;
- positive USD result is required;
- proof carries source contract, round IDs, block number, chain ID and provenance;
- no current price or stablecoin peg assumption.

Existing Base direct Chainlink mappings already include:
- native Base USDC/USD feed.

The live onchain price registry also contains the canonical Base AERO/USD Chainlink route, so the composite fallback can reuse an already admitted market-data source rather than inventing a new authority.

### C. Existing generic Aerodrome discovered-price composition
File:
`reporting/historical-aerodrome-discovered-price.mjs`

Before PR #836 it already did:
1. prove `reward -> Base USDC` with generic Aerodrome factory discovery/TWAP;
2. resolve Base USDC/USD at the same historical closing block;
3. multiply both exact historical legs;
4. emit a fully provenance-rich valuation proof.

### D. Identity gate
File:
`reporting/ve33-historical-valuation-identity.mjs`

Critical point discovered in this session:
Even if the resolver can mathematically build a new composite proof, the canonical ledger will reject it unless the identity validator also explicitly admits the route.

Before PR #836 the generic Aerodrome discovered family effectively expected:
- quote token = native Base USDC;
- quote Chainlink contract = Base USDC/USD feed.

Therefore the minimum systemic scope must include both:
- route/resolver logic;
- exact fail-closed identity admission.

This prevents a dangerous situation where pricing code produces a value that accounting cannot or should not trust.

---

## 4. IMPLEMENTATION ALREADY MADE IN PR #836

Before this handoff, four implementation/test files were changed.

### 4.1 `reporting/historical-aerodrome-discovered-price.mjs`
Intent of the change:
- preserve current direct `reward -> USDC -> USD` path as first priority;
- if direct USDC discovery cannot prove a route, try a narrowly allowlisted AERO quote leg;
- discover `reward -> AERO` through the same exact-block Aerodrome Slipstream factory/TWAP machinery;
- resolve AERO/USD using the official Base AERO/USD Chainlink feed at the same closing block;
- reject proof if quote-chain block, chain ID or source contract do not match the exact expected evidence;
- emit explicit quote-token / quote-feed provenance;
- preserve `currentPriceUsed:false`, `stablecoinPegAssumptionUsed:false`, `referenceAprUsed:false`, `executionAuthority:'none'`.

Architectural rule:
**direct USDC remains preferred; AERO is fallback, not replacement.**

Fail-closed rule:
If neither exact historical direct USDC nor exact historical AERO composite route can be proven, the event remains unresolved/UNKNOWN.

### 4.2 `reporting/ve33-historical-valuation-identity.mjs`
Intent of the change:
- generalize the generic Aerodrome discovered-family identity gate from one hard-coded quote leg to a strict allowlist of admitted quote routes;
- require the reward token and pool pair to match exact event identity;
- require canonical Aerodrome factory and canonical tick spacing;
- require exact expected quote token and its exact expected Chainlink feed;
- preserve exact-block / no-peg semantics;
- reject wrong quote token, wrong feed, wrong chain, wrong factory, malformed provenance.

The allowlist is deliberately small. This is not an arbitrary recursive DEX router.

### 4.3 `reporting/verify-historical-aerodrome-discovered-price.mjs`
Tests expanded to cover:
- direct USDC route still works;
- direct USDC has precedence over fallback when available;
- AERO fallback can produce a composite exact-block proof when direct USDC is unavailable;
- proof uses the exact expected Base AERO/USD Chainlink source;
- wrong/missing quote evidence fails closed;
- no current-price or peg assumption is introduced.

### 4.4 `reporting/verify-p5-discovered-valuation-admission.mjs`
Admission tests expanded to ensure the canonical ve33 identity layer accepts the new valid AERO composite proof and rejects malformed variants.

Explicit negative cases include the intended invariants:
- wrong quote token -> reject;
- wrong quote feed -> reject;
- wrong factory -> reject;
- wrong chain/provenance -> reject as applicable;
- `UNKNOWN` is preserved when proof cannot satisfy identity.

---

## 5. PR #836 BODY / DECLARED SCOPE

The PR was opened with the following intended scope:

- preserve existing direct `reward token -> USDC -> USD` path as first priority;
- if no exact historical USDC pool is proven, try `reward token -> AERO` through canonical Aerodrome Slipstream discovery at the same closing block;
- price AERO through official Base AERO/USD Chainlink at that exact closing block;
- admit only allowlisted Aerodrome quote legs in ve33 historical valuation identity checks;
- add fail-closed tests for wrong quote token/feed/factory and direct-USDC precedence.

Declared invariants:
- no current-price backfill;
- no stablecoin peg assumption;
- no APR/APY inference;
- no token-specific reward accounting path;
- unresolved stays UNKNOWN when either historical leg cannot be proven;
- no wallet / claim / capital / methodology authority change;
- `executionAuthority = none`.

Declared validation target:
**exact-head CI + Fresh Final Audit must prove the real canonical USD blocker delta before merge.**

---

## 6. WHAT HAS NOT BEEN PROVEN YET — DO NOT SKIP

At handoff time the implementation exists, but the production acceptance loop has NOT been completed.

Not yet proven after PR creation:
1. exact-head CI status for the latest PR head;
2. whether any PR-triggered `action_required` statuses are merely approval gating or actual failures;
3. relevant test-job logs for the modified historical valuation modules;
4. Fresh Final Audit on the PR candidate;
5. actual live canonical USD blocker reduction caused by this fallback;
6. which unresolved live events, if any, resolve specifically through `reward -> AERO -> USD`;
7. whether any newly exposed edge case requires a minimal correction;
8. production artifact materialization on `main` — impossible until/if PR is safely merged and downstream Reporting regenerates.

Therefore:
**PR #836 is NOT merge-ready merely because GitHub says mergeable.**

Do not merge on code inspection alone.

---

## 7. EXACT RESUME ORDER FOR PARALLEL CHAT

### Step 0 — restore current truth
Before touching the branch:
1. read live `intelligence/project-memory/CURRENT.md` from `main`;
2. read latest continuity pointed to by CURRENT/CONTINUITY;
3. read Routing Index and active Public Green roadmap block;
4. re-read live `main` head and all newer commits after branch base `917a11e8...`;
5. inspect currently open relevant PRs so this branch is not evaluated against stale assumptions.

Do not assume this handoff is newer than `main`; it only captures this feature branch at 08:54 MSK.

### Step 1 — fetch current PR #836
Confirm:
- state is open;
- exact current head SHA;
- exact current base SHA / merge-base;
- changed filenames;
- no unrelated generated artifacts or stale-main drift entered the PR.

Expected implementation paths from this handoff:
- `reporting/historical-aerodrome-discovered-price.mjs`
- `reporting/ve33-historical-valuation-identity.mjs`
- `reporting/verify-historical-aerodrome-discovered-price.mjs`
- `reporting/verify-p5-discovered-valuation-admission.mjs`
- this handoff file only as continuity metadata.

If main advanced materially and PR scope becomes polluted/conflicted, rebuild cleanly from fresh main rather than stacking unrelated generated changes.

### Step 2 — inspect exact-head Actions
Fetch workflow runs for the current PR head.

Important project nuance:
GitHub can report `action_required` for approval/gating. Do not call that a code failure without inspecting jobs/steps/logs.

For any non-green run:
- fetch jobs;
- inspect failing/action-required job steps;
- fetch logs where available;
- distinguish infrastructure/gating from code/test failure.

### Step 3 — run/verify targeted tests
At minimum verify the two modified test surfaces:
- `reporting/verify-historical-aerodrome-discovered-price.mjs`
- `reporting/verify-p5-discovered-valuation-admission.mjs`

Also run the canonical historical valuation validation if CI workflow includes it:
- `reporting/historical-canonical-price-validation.mjs`

And any broader accounting validation automatically triggered by changes to:
- historical price resolver;
- ve33 identity admission;
- income ledger / canonical earned income downstream.

Required result:
all fail-closed negative cases remain enforced.

### Step 4 — Fresh Final Audit / production-shaped proof
The decisive question is not "do tests pass?" but:
**does the exact-head candidate actually reduce reusable canonical USD blockers on production-shaped live evidence?**

Run/inspect the repository's Fresh Final Audit / Public Foundation candidate audit path on exact PR head.

Capture:
- blocker count before candidate;
- blocker count after candidate;
- exact events/tokens newly resolved;
- sourceFamily of each newly resolved event;
- exact historical block and chain;
- quote token and quote Chainlink contract;
- confirmation `currentPriceUsed=false`;
- confirmation `stablecoinPegAssumptionUsed=false`;
- confirmation event immutable economic identity is unchanged.

Do NOT claim P5 progress from synthetic tests only.

### Step 5 — classify residual blockers
After candidate audit, classify remaining unresolved historical valuations into:
A. reusable technical route gap -> must still be fixed in P5;
B. transient RPC/reliability issue -> fix systemically if reusable;
C. genuinely historically unprovable -> may remain UNKNOWN under P5 acceptance;
D. unrelated mechanism/accounting issue -> route to correct package, do not contaminate this PR.

Recall P5 acceptance principle:
**technical/reusable route gaps must go to zero; literal unresolved count does not have to be cosmetically forced to zero when evidence is genuinely unprovable.**

### Step 6 — merge decision
Merge only if all are true:
- exact-head targeted validations green;
- no unintended accounting-semantics drift;
- no identity/fail-open regression;
- candidate audit proves real reusable improvement or otherwise provides compelling evidence the route is needed/correct;
- scope remains clean relative to fresh main;
- no unresolved review thread or concrete CI defect;
- merge uses current expected head SHA.

If the fallback resolves zero live blockers, do not merge automatically. Re-evaluate whether this route is justified now under one-primary-objective discipline.

### Step 7 — post-merge physical closure if merged
After merge:
- wait for / inspect downstream Reporting regeneration;
- re-read physical `reporting/income-ledger.json` on live main;
- re-read `reporting/company-monthly-reports.json` and accounting completeness artifacts;
- verify generated artifacts are newer than merge trigger boundary;
- verify newly resolved USD values carry exact provenance;
- verify no current price backfill appeared;
- verify P5 blocker classification/count on live main, not only candidate worktree.

Remember project law:
**GREEN workflow != physically materialized production artifact.**

---

## 8. DESIGN CONSTRAINTS — DO NOT RELAX

The next chat must preserve these boundaries:

### Accounting
- Canonical Income Ledger remains sole factual earned-income recognition authority.
- This work only supplies historical valuation evidence; it must not create a second recognition authority.
- Immutable event amount/token/economic identity must not be rewritten merely to obtain USD value.
- Claims/settlements remain separate from earned-income recognition.

### Historical price
- exact historical block required for onchain route legs;
- quote feed must be read at the same closing block;
- no latest/current price substitution;
- no `$1` stablecoin shortcut;
- no guessed price;
- no APR-derived factual USD.

### Route discovery
- canonical Aerodrome factory allowlist only;
- canonical tick spacing only;
- positive historical active liquidity;
- positive historical TWAP;
- deterministic route selection;
- ambiguous evidence fails closed;
- approved quote tokens only;
- approved exact USD feed for each quote token only.

### Authority
- read-only blockchain/RPC operations only;
- no wallet signing;
- no claim execution;
- no transaction submission;
- no capital movement;
- no methodology mutation;
- `executionAuthority = none`.

---

## 9. WHY THE PATCH IS SYSTEMIC RATHER THAN A TOKEN PATCH

A bad implementation would add a hard-coded historical price for one unresolved reward token.

This PR instead reuses the existing architecture:
1. event identity tells us the exact closing block;
2. Aerodrome factory discovery proves a historical pool for the reward token against an approved quote asset;
3. historical TWAP proves the reward/quote exchange rate;
4. exact-block Chainlink proves quote/USD;
5. identity validator checks that both legs match the event chain/token and the admitted quote route;
6. canonical ledger may then attach valuation evidence without mutating economic identity;
7. if any leg is missing, UNKNOWN survives.

This is the intended P5/P6 direction: reusable valuation infrastructure that can handle new reward tokens without a new accounting engine.

---

## 10. KNOWN LIVE PROJECT CONTEXT AT HANDOFF

The last continuity checkpoint observed in this session before this feature branch work was a live-main automatic checkpoint commit:
`917a11e8117b488a98d2ddaed47b47765f44ccb6`

That checkpoint pointed to source head:
`510c304f112dbacb01a86c0536112bf66e4b1543`

Snapshot recorded there included:
- Security Sentinel: WATCH; Critical 0 / High 2 / Medium 74;
- Accounting Coverage: 29 mechanisms; reusable gaps 0;
- Canonical Income Ledger: `status: partial`;
- observed event count: 1487;
- Company Monthly Reports: 10 companies;
- accounting artifacts at that checkpoint predated the trigger boundary and therefore required fresh re-read before physical-closure claims.

This is resume context only. Re-read live main because it may have advanced after this handoff.

---

## 11. OWNER-FACING SIMPLE SUMMARY

What this branch is trying to do in plain language:

Previously the system could say:
> "I know exactly how many reward tokens were earned, but I cannot prove their dollar value at that historical moment because I cannot find a direct historical road from that token to USDC."

The patch adds one controlled detour:
> "If there is no direct historical road to USDC, prove a road to AERO inside Aerodrome, then prove AERO's dollar price at the exact same historical block."

It is deliberately not allowed to improvise. If either half of the detour cannot be proven, the value remains UNKNOWN.

---

## 12. TAKEOVER STATUS

### 🟢 Done in this branch
- identified reusable architecture already present;
- avoided building a second historical price engine;
- implemented direct-USDC-first + AERO composite fallback concept;
- extended canonical identity admission for the new approved quote route;
- added positive and fail-closed test coverage;
- opened PR #836;
- preserved all authority boundaries;
- created this detailed takeover checkpoint.

### 🟡 In progress / not yet accepted
- exact-head CI review;
- candidate Fresh Final Audit;
- real canonical blocker delta measurement;
- proof that live unresolved Aerodrome events actually use the new route;
- merge/no-merge decision.

Approximate state of this specific PR package: **~65–70%**. Implementation is present; production proof and closure remain.

### ⚪ Next
1. fresh live recovery (`CURRENT -> continuity -> Router -> live main`);
2. exact PR #836 head + Actions;
3. inspect failures/gates rather than trusting badges;
4. run/inspect targeted validation;
5. Fresh Final Audit candidate comparison;
6. classify residual blockers;
7. merge only on exact evidence;
8. post-merge physical artifact verification if merged.

---

## 13. FINAL HANDOFF RULE

Do not continue from prose memory alone.

Resume from:
`LIVE CURRENT.md -> latest continuity -> Router -> fresh main -> PR #836 exact head -> exact Actions/jobs/logs -> candidate audit -> generated evidence`.

This file is a bridge, not truth authority.

The model can change. **The Holding's evidence must remain reproducible.**
