# THE HOLDING — MAIN CHAT HANDOFF / RESUME CHECKPOINT
## 2026-09-11 07:04 MSK · manual owner-requested checkpoint

Status: **MANUAL HANDOFF / PAUSE CHECKPOINT**  
Authority: **resume guidance + exact work state**  
executionAuthority: **none**

> Purpose: allow a parallel/new chat to continue the exact work of the current main chat without reconstructing it from conversation fragments. This document is intentionally detailed. It is NOT a replacement for fresh live truth. At resume, always re-read live `main`, `CURRENT.md`, `CONTINUITY.md`, latest immutable continuity, Router, fresh artifacts and exact Actions evidence before mutating anything.

---

## 0. OWNER DIRECTIVE / COLLABORATION CONTRACT

The owner explicitly promoted this chat to the primary working chat after the previous parallel chat reached memory limits. The owner authorized continuation of routine low-risk repository work with the standing rule:

- one primary objective at a time;
- split work into clean packages/atoms to avoid a tangled multi-purpose diff;
- prefer systemic reusable fixes over patches;
- routine low-risk GitHub work may proceed through branch → PR → verification → merge → production proof without asking permission for every PR;
- stop for explicit confirmation at material capital, wallet, authority, security, destructive/irreversible or methodology boundaries;
- no wallet signing, claiming, transaction execution, autonomous capital movement or expansion of execution authority;
- `executionAuthority = none` remains binding.

When the owner says **«трекай»**, perform a fresh live check of `main`, relevant branches/PRs, Actions/workflows/runs and generated artifacts/evidence, then report briefly:
- 🟢 completed
- 🟡 in progress + approximate %
- ⚪ next/queue
- short risk/blocker note when material.

Never treat a green workflow by itself as proof of physical production materialization.

---

## 1. LIVE RECOVERY BOUNDARY AT CHECKPOINT CREATION

Repository: `TheHolding83888/TheHolding-site-1.32`

### Live main at branch creation
- `main`: **`c5e643f10403656c51063c48178886c9e06559a2`**
- commit time: **2026-09-11T01:29:13Z = 04:29:13 MSK**
- commit: `memory: checkpoint continuity at f2f740e8`
- this handoff branch was created **exactly from that live main head**.

### Current continuity nuance
`CURRENT.md` on live main is slightly stale relative to the root continuity pointer:
- `CURRENT.md` represents canonical source state `2026-09-10T18:40:18.921Z` and still embeds `THE_HOLDING_MASTER_CONTINUITY_2026-09-10_184020_AUTO_2afc1da9.md`.
- live `CONTINUITY.md` is fresher and points to `THE_HOLDING_MASTER_CONTINUITY_2026-09-11_010439_AUTO_f2f740e8.md`.
- latest continuity source head: **`f2f740e82256a030d81d6c7691ce19af2fe415ad`** at **2026-09-11T01:04:39Z = 04:04:39 MSK**.
- source commit: `market data: refresh canonical price snapshot`.

Therefore on resume do NOT trust the stale embedded CURRENT pointer blindly. Canonical priority remains:
1. live `main`
2. fresh generated production artifacts / exact workflow evidence
3. current subsystem state
4. `CONTINUITY.md` latest immutable pointer + latest checkpoint
5. task-specific canon/router
6. older handoffs.

Latest automatic continuity at time of this file:
`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-11_010439_AUTO_f2f740e8.md`

---

## 2. PREVIOUS PARALLEL CHAT HANDOFF THAT THIS CHAT CONSUMED

Previous chat paused on branch:
`fix/collection-company-passport-routing-20260910`

Its detailed handoff file:
`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-10_191600_MSK_COLLECTION_PASSPORT_ROUTING_PAUSE.md`

Checkpoint commit:
**`24355ece7d11c714f145ec08b95e321273f45a79`**

That checkpoint described:
- completed homepage footer/mobile hamburger work;
- partially implemented Collection → Company Passport routing;
- existing Passport architecture;
- Back/Forward/hash-state risks;
- exact tests needed before PR;
- warning not to mix unrelated frontend/editorial work with the routing atom.

This chat verified that old branch was behind newer `main`, so it did NOT continue piling changes onto it. It rebuilt the active atom from fresh `main` and preserved the old branch only as historical handoff evidence.

---

## 3. WORK COMPLETED BY THIS CHAT AFTER THAT HANDOFF

### PR #739 — Collection cards → existing Company Passports
Merged: **2026-09-10T17:06:35Z = 20:06:35 MSK**  
Merge commit: **`c7421ccb14600482359d60702a5f7b8f34b9953a` head; merged PR #739**
Title: `Route Collection cards into existing Company Passports`

Purpose:
- reuse the existing Registry Observatory Passport model rather than creating a second Passport implementation;
- Registry 001–010 card routing to deterministic `#passport-XXX` state;
- Registry 008 uses the existing Stable Passport;
- close-state synchronization;
- `hashchange` + `popstate` handling for browser Back/Forward;
- direct-load/deep-link support;
- smooth scroll/open behavior;
- RU/EN accessibility labels;
- Company #006 router identity set to the owner-confirmed `aerocvxyb.eth`.

Important: this was source-level routing work only. Production closure requires physical `companies/index.html` proof.

### PR #740 — systemic projector materialization repair
Merged: **2026-09-10T17:27:14Z = 20:27:14 MSK**  
Merge commit: **`968c93f98866bca7563072a659263ad1c2824e78`**
Title: `Materialize canonical public-site polish during Unified Refresh`

Root cause proven after #739:
- `companies/public-site-polish-projection.mjs` was included in trigger/syntax-check logic;
- but the canonical Unified Refresh did NOT actually execute it;
- therefore a correct source PR could merge while physical `companies/index.html` stayed stale.

Fix:
- execute the existing canonical projector inside Unified Refresh;
- do it after capital/public data writers and before final assertions;
- fail closed if Collection Passport routing does not physically materialize;
- no new workflow, no duplicate writer/control plane.

This is an important durable lesson: **trigger coverage + syntax checks are not materialization**.

### PR #741 — uniform owner-requested Collection card contract
Merged: **2026-09-10T17:52:31Z = 20:52:31 MSK**  
Merge commit: **`7fb9dbfb2e1895f48478d5b358fe020834508657`**
Title: `Collection cards: one Explore Company action into Passport`

Owner request that caused this atom:
- every company card should show the same bottom phrase **`Explore Company`**;
- remove mixed phrases such as `View on DeBank`, `DeBank · Tracking`, `The Bank`, etc.;
- whole card should be clickable;
- click should lead smoothly/cleanly to that company’s Passport;
- bottom CTA is part of the same Passport action, not a separate external link.

Implementation merged in #741:
- canonical `companies/public-site-polish-projection.mjs` became coordinator;
- previous projector implementation preserved in `companies/public-site-polish-projection-core.mjs`;
- coordinator imports/runs core first, then normalizes Registry 001–010 Collection cards;
- removes external anchor `target`/`rel` semantics from whole card;
- deterministic destination `#passport-XXX`;
- footer normalized to one Passport action;
- MutationObserver covers dynamically inserted Company #010;
- hover affordance applied consistently;
- existing Passport router from #739 is reused.

IMPORTANT OWNER-WORDING MISMATCH TO RESOLVE:
The owner said the phrase **`Explore Company`** should be on **every** card. Current #741 coordinator contains:
`var label = isRu(card) ? 'Перейти к компании' : 'Explore Company';`
So in RU mode the literal phrase is currently localized rather than preserved. This may conflict with the latest explicit owner request. Treat the latest owner wording as higher priority and verify whether to make the visible CTA literally `Explore Company` in both languages. Do NOT silently assume localization is desired.

---

## 4. CURRENT FRONTEND MATERIALIZATION STATE — DO NOT DECLARE COMPLETE YET

At the time this chat was interrupted, the active task was to close the last production-proof gap after #741.

What is proven:
- source projector on live `main` contains the uniform Collection-card coordinator;
- #741 is merged;
- #740 wired the canonical projector into Unified Refresh;
- source-level Passport router exists;
- #741 itself is an atomic UI/public-surface change only; no capital/accounting/reward methodology changes.

What is NOT yet proven in this chat:
- a post-#741 canonical Unified Refresh successfully executed the updated projector;
- the resulting physical `companies/index.html` on live `main` contains `data-th-collection-uniform-explore`;
- live production browser behavior after the refreshed artifact;
- literal `Explore Company` visible on every live card after materialization;
- all old DeBank/Tracking/The Bank footer labels gone from live Collection;
- whole-card click + CTA click + Back/Forward + direct hash + stable Passport #008 all verified on the live surface.

The owner explicitly visited the site before the #741 materialization was proven and reported that he still saw old/non-clickable behavior. Therefore **do not answer that the frontend is finished just because #741 merged**.

Recommended immediate resume sequence for this package:
1. fresh-read `main` and latest Unified Refresh run after `7fb9dbfb`;
2. inspect jobs/steps and failure logs if any;
3. verify physical `companies/index.html` on current `main` contains both:
   - `data-th-collection-passport-routing`
   - `data-th-collection-uniform-explore`
4. verify visible footer contract is one `Explore Company` action per Registry 001–010;
5. verify no external DeBank footer action remains in Collection cards;
6. verify card-body and footer both open the same Passport;
7. test direct `#passport-001 … #passport-010`, Back, Forward, row close, Passport close and Registry 008 Stable Passport;
8. only then call Package 1 closed.

If materialization still does not occur, repair the **existing canonical Unified Refresh path**. Do not create a second projector workflow or parallel source of truth.

---

## 5. COMPANY #006 — CANONICAL IDENTITY FACTS

Owner explicitly corrected the company name:
**`aerocvxyb.eth`** is the correct name.

Canonical wallet evidence already matched the owner screenshots:
- Company Registry: **006**
- Aero / Velo wallet: **`0xA641752824d512FA8683758c6b2D8A04ea46dcD0`**
- Yield Basis wallet: **`0x6c6543eBA07946706Fd10a1064FA773326B5f5a9`**

Known stale metadata bug still on live `main` at checkpoint time:
`companies/company-006-discovery.json` contains:
`"name": "aerocrvyb.eth"`

This is incorrect and must be fixed in a **separate small identity atom** after frontend production proof, unless fresh live state already fixed it.

Do a repository-wide search for `aerocrvyb.eth` before mutation. Replace only proven stale identity metadata; do not rewrite historical/provenance text blindly if a historical value is intentionally documentary.

---

## 6. COMPANY #006 OWNER SCREENSHOTS — GROUND-TRUTH CONTROL POINT

The owner supplied **5 screenshots** from the actual owner of `aerocvxyb.eth`. All five were visually readable in the chat.

Owner-ground-truth values from those screenshots:

### Aerodrome voting rewards
Two veAERO positions showed approximately:
- **$86.94**
- **$48.44**
- combined screenshot claimable ≈ **$135.38**

### Aerodrome rebases
Two lock rebases showed:
- **9.2824 AERO**
- **5.36551 AERO**
- combined ≈ **14.64791 AERO**

These rebases are NOT the same lifecycle as free voting rewards. They should remain classified separately from claimable voting rewards.

### Yield Basis
Screenshot showed approximately:
- **12,500 YB locked**
- **~11,804.30 veYB voting power**
- **APR 5.31%**
- **$25.53** current earnings/claimable
- UI showed `NO EARNING CLAIMS`, supporting that the Yield Basis earnings had not been claimed at screenshot time.

### Critical later owner action
The company owner **claimed the veAERO/Aerodrome voting rewards later that day**.
The owner stated Yield Basis was **not** claimed.

Expected correct system behavior after claim:
- current Aerodrome claimable should fall/reset according to current onchain state;
- the economic earning must NOT disappear from historical earned-income/accounting;
- claim is a **settlement/state transition**, not negative income and not permission to erase earlier factual accrual;
- no double counting on the next daily refresh;
- Yield Basis should remain nonzero/unclaimed (subject to fresh accrual/value drift) because it was not claimed.

---

## 7. COMPANY #006 CURRENT REPOSITORY REWARD STATE OBSERVED BEFORE PAUSE

Live `companies/rewards-data.json` snapshot inspected in this chat:
- version: `0.3.10`
- generatedAt: **2026-09-10T09:48:26.087Z = 12:48:26 MSK**
- therefore it PRE-DATES the owner’s later screenshots/claim event and cannot be treated as post-claim truth.

For `aerocvxyb.eth` that snapshot reported:
- status: `partial`
- correct ENS in rewards engine: `aerocvxyb.eth`
- correct Aero/Velo wallet `0xA641...dcD0`
- correct separate Yield Basis wallet `0x6c6543...f5a9`
- `totalUsd`: **230.62906**
- `knownAccruedUsd`: **230.62906**
- `claimableUsd`: **230.62906**
- `routeCoverage`: 1
- `completeRouteCoverage`: 0.333333
- measuredRoutes: 3
- completeRoutes: 1
- pendingRoutes: 2
- unpricedRewards: 0

Do NOT compare the aggregate $230.62906 directly to screenshot $135.38. It includes multiple reward routes/classes and is from an earlier time. Decompose by route/classification first.

Aerodrome classification in that snapshot was structurally correct:
- voting/fee/incentive rewards: `classification: "unclaimed"`
- rebases from `RewardsDistributor.claimable`: `classification: "compounded-locked"`

Example pre-screenshot rebase observations in the repository snapshot:
- tokenId `64985`: **7.4430067819 AERO** compounded-locked
- tokenId `69194`: **4.2844675021 AERO** compounded-locked

The owner screenshots later showed higher accumulated rebase amounts (14.64791 AERO total), which is directionally consistent with later accrual and demonstrates why timestamp alignment matters.

Reward methodology present in repository:
- Aerodrome/Velodrome direct veNFT rewards: read Reward.earned with persistent reward-contract index/current vote + bounded tail discovery;
- Aerodrome rebases: read RewardsDistributor.claimable and classify as compounded-locked;
- Yield Basis: `FeeDistributor.preview_claim`, with YB rewards valued using current redemption value into BTC assets;
- claimable rewards are separate from TVL principal/Treasury cash.

There was also a partial operational discovery note for at least one Aerodrome scan caused by a Blockscout abort. `UNKNOWN != 0`; do not coerce partial discovery to zero.

---

## 8. MAIN ACCOUNTING QUESTION STILL OPEN — AERODROME CLAIM LIFECYCLE

This was the most important unfinished investigation when the chat paused.

Question:
After the owner claims the ~Aerodrome voting rewards, does The Holding preserve the earning as immutable/historical factual income while removing it from current claimable?

Project law from continuity already says:
- Canonical Income Ledger is the sole factual earned-income recognition authority;
- opening balance is baseline, not period income;
- later claim/reset/withdrawal/receipt is settlement when income was already recognized;
- `UNKNOWN != 0`;
- claim/reset must not erase previously recognized earnings.

What was NOT yet proven:
- a claim-aware Aerodrome settlement/history mechanism for Company #006 that survives the claim reset;
- exact mapping of the owner’s claimed transaction into canonical income history;
- whether the next `Update Company Rewards` refresh will simply zero current reward rows without preserving the transition elsewhere;
- whether current Passport presentation will correctly distinguish current Unclaimed vs Received/Settled history.

Important prior observation:
There is clearly dedicated lifecycle logic for some mechanisms (for example Received/settlement handling in other routes and realized cash-flow tooling), but this chat had **not yet proven equivalent claim persistence for Company #006 direct Aerodrome voting rewards**.

Therefore the next chat should NOT blindly trigger a manual reward refresh first and celebrate a zero claimable. First prove where the claimed amount will persist historically. If there is a real gap, implement it through the existing canonical income/accounting lifecycle rather than a separate ad-hoc reward history file.

---

## 9. PACKAGE PLAN — RECOMMENDED ORDER TO CONTINUE WITHOUT CHAOS

### PACKAGE 1 — Finish Collection → Passport production proof
Status at pause: **~90–95% source-complete, production proof incomplete**.

Tasks:
1. verify first post-#741 canonical Unified Refresh;
2. inspect physical `companies/index.html` on current live `main`;
3. if stale, fix the one existing canonical projector/writer path;
4. enforce owner’s exact uniform footer wording (`Explore Company`) on every card — note current RU localization mismatch;
5. browser/runtime verification: card hover/click, CTA click, smooth Passport open, direct hash, Back/Forward, close, Registry 008 Stable Passport, mobile;
6. production proof before declaring done.

Do not mix rewards/accounting work into this UI atom.

### PACKAGE 2 — Company #006 identity cleanup
Status: **small known bug**.

Tasks:
1. repository-wide search for `aerocrvyb.eth`;
2. confirm which occurrences are truly stale identity vs historical text;
3. correct canonical live identity to `aerocvxyb.eth`;
4. add deterministic validation if identity drift can recur;
5. PR + merge + proof.

### PACKAGE 3 — Company #006 reward parity + post-claim lifecycle
Status: **active audit; highest accounting importance**.

Tasks:
1. establish fresh post-claim onchain/current rewards state from the canonical reward workflow/collector;
2. align observations by timestamp with the five owner screenshots;
3. decompose Company #006 current state into:
   - Aerodrome voting/fee/incentive rewards
   - Aerodrome rebases
   - Velodrome if present
   - Yield Basis preview_claim
4. compare screenshot owner ground truth against system output route-by-route, not just aggregate USD;
5. prove the claim transition is preserved as settlement/history;
6. if claim persistence is missing, repair the canonical lifecycle/ledger path — no duplicate source of truth;
7. then refresh current rewards and verify:
   - claimed Aerodrome current claimable is removed/reduced;
   - historical earned amount remains;
   - Yield Basis remains unclaimed/nonzero;
   - no duplicate accounting next day;
   - Passport renders current vs historical semantics correctly.

### PACKAGE 4 — remaining frontend/editorial backlog
Only after Packages 1–3 are stable.

Known prior handoff items include:
- remaining Companies editorial/presentation polish;
- Index Framework/right-side drawer cleanup;
- RU parity;
- any other owner front-package items not already covered by #737–#741.

Re-read the old `...191600_MSK_COLLECTION_PASSPORT_ROUTING_PAUSE.md` and owner screenshots/messages before starting these, because this manual checkpoint deliberately does not invent details that were not re-verified here.

### PACKAGE 5 — older systemic tail, separate from current owner-facing work
Do not mix into Packages 1–3 unless it becomes an active blocker.

Open draft PR still live at checkpoint time:
- **PR #717** `Fix Market Data validated snapshot publish retry`
- state: OPEN, DRAFT
- head: `fix/market-data-validated-snapshot-publish-20260910`
- base is old; branch is likely stale relative to current main and needs a fresh live assessment before any continuation.

Its purpose is the Market Data writer race: validated candidate vs unrelated main advances. Do not merge stale #717 blindly.

---

## 10. RECENT FRONTEND WORK ALREADY CLOSED BEFORE/AROUND THIS CHAT

Do not redo these unless fresh live proof shows regression:
- PR #737: homepage footer wording → `Capital Architecture · Onchain Companies · Real Estate`.
- PR #738: viewport-safe mobile homepage navigation/hamburger.
- PR #739: Collection → existing Passport router.
- PR #740: run canonical public-site projector inside Unified Refresh.
- PR #741: uniform Collection-card Passport action source contract.

Again: #741 still needs physical post-refresh/live browser proof as described above.

---

## 11. IMPORTANT FILES / SURFACES

### Memory / continuity
- `intelligence/project-memory/CURRENT.md`
- `intelligence/project-memory/CONTINUITY.md`
- `intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-11_010439_AUTO_f2f740e8.md`
- `intelligence/project-memory/THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`
- old routing handoff: `THE_HOLDING_MASTER_CONTINUITY_2026-09-10_191600_MSK_COLLECTION_PASSPORT_ROUTING_PAUSE.md`

### Collection / Passport UI
- `companies/index.html` — PHYSICAL public artifact
- `companies/public-site-polish-projection.mjs` — current canonical coordinator after #741
- `companies/public-site-polish-projection-core.mjs` — preserved core projector implementation
- `intelligence/capital-state/unified-capital-refresh.mjs`
- `.github/workflows/unified-capital-refresh.yml`

### Company #006 identity/reward audit
- `companies/company-006-discovery.json` — known stale name currently `aerocrvyb.eth`
- `companies/rewards-data.json` — current reward snapshot artifact
- `rewards/company-rewards-engine.mjs` — canonical reward collector logic
- `.github/workflows/update-company-rewards.yml` — daily/manual reward workflow
- canonical income/accounting artifacts selected through Router before implementing any settlement persistence.

---

## 12. CURRENT STATUS SUMMARY FOR THE NEXT CHAT

🟢 **Parallel handoff consumed correctly.** Old branch/checkpoint was reviewed; continuation was rebuilt from fresh main rather than piling on stale branch state.

🟢 **PR #739 merged.** Existing Company Passports are now the routing target; Back/Forward/hash-state hardening was added at source level.

🟢 **PR #740 merged.** Systemic projector-materialization gap in Unified Refresh was repaired.

🟢 **PR #741 merged.** Source-level uniform Collection-card action was added: whole card → Passport, one footer action, dynamic Company #010 coverage.

🟡 **Collection package ~90–95%.** Physical post-#741 `companies/index.html` + live browser proof is still required. Owner previously saw stale behavior on the site. Also check exact literal `Explore Company` requirement versus current RU localization.

🟡 **Company #006 identity ~80–90%.** Runtime/rewards layers already know `aerocvxyb.eth`, but stale `company-006-discovery.json` still says `aerocrvyb.eth` and must be cleaned through a small isolated atom.

🟡 **Company #006 rewards/accounting audit ~55–65%.** Owner screenshot ground truth is captured and repository pre-claim state was inspected. Critical post-claim settlement/history preservation remains unproven.

⚪ **After those:** remaining Companies frontend/editorial polish, RU parity, Index Framework drawer, then older Market Data race/draft #717 and other systemic queue as appropriate.

---

## 13. NON-NEGOTIABLE RESUME INSTRUCTION

When another chat takes over:

1. **Do not start by editing.**
2. Fresh-read live `main` head.
3. Read `CURRENT.md` AND `CONTINUITY.md` because CURRENT’s embedded pointer was stale at this checkpoint.
4. Read the latest immutable continuity selected by `CONTINUITY.md`.
5. Read Router only for the task-specific canon needed.
6. Recheck PRs/branches/Actions because automation continues after this file was written.
7. Recheck physical artifacts before calling anything complete.
8. Continue **Package 1 first**, then Package 2, then Package 3.
9. Preserve one-atom-at-a-time discipline.
10. Preserve `executionAuthority = none`.

The most important immediate next question is not “did #741 merge?” It did. The question is:

**Did the canonical post-#741 refresh physically materialize the owner-requested Collection card contract on the live Companies page, and if so does every card literally show `Explore Company` and open the correct Passport smoothly?**

After that, move to the Company #006 identity correction and reward claim lifecycle audit.
