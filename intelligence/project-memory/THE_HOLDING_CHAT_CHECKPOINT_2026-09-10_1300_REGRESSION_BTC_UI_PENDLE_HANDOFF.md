# THE HOLDING — DETAILED CHAT HANDOFF CHECKPOINT

Date: 2026-09-10 ~13:00 MSK
Purpose: deterministic handoff from the current chat to a parallel/replacement chat because the current chat has begun stalling. This checkpoint is intentionally detailed and is a **handoff / resume document only**, not a production change.

A replacement chat must NOT treat any SHA, PR number, run number, TVL or generated value below as automatically current. Always re-check live `main`, current Actions and physical artifacts before mutating anything.

---

## 0. NON-NEGOTIABLE OPERATING RULES

- Recovery order: live `main` -> `intelligence/project-memory/CURRENT.md` -> latest continuity -> Memory Routing Index -> task-specific canon/context -> live generated artifact -> exact workflow/materialization evidence.
- `UNKNOWN != 0`.
- partial != total.
- Reference APR/APY is not factual-income authority.
- `executionAuthority = none` unless the owner explicitly changes it.
- No wallet signing, no transaction execution, no autonomous capital movement, no automatic methodology/security-policy mutation.
- Do not start Capital Flow Semantics implementation while the repository is still public.
- `GREEN workflow != physically materialized production artifact`.
- Every production writer/projector must validate physically materialized output, not only an in-memory/pre-write candidate.
- Work one primary objective at a time.
- Prefer tiny atomic PRs over broad packages. Do not mix accounting/data semantics, Pendle, Learning, UX and private migration in one PR.
- Before each mutation, re-read fresh `main`. Automated workflows commit frequently and can advance the base during work.
- After each mutation, inspect the exact diff for unrelated drift before merge.
- When the owner says `трекай`, perform a new live check: `main`, relevant branches/PRs, Actions/workflows/runs, generated artifacts/evidence. Report: 🟢 done; 🟡 in progress + rough %; ⚪ next.

---

## 1. LIVE ANCHOR WHEN THIS CHECKPOINT WAS CREATED

Fresh `main` at checkpoint creation:

`30265c6c834c4c6c9d9656f2fce6941b8deda115`

Commit:
`data: update HyperLend income semantics`

Commit time:
`2026-09-10T09:48:51Z`

Immediate recent main activity was mostly autonomous generated/data/intelligence refreshes, including:
- HyperLend income semantics
- ICP NNS accrued rewards
- progress/comparative/explanatory intelligence refreshes
- coherent production capital snapshot refreshes
- Project X observed fee APR
- Company #010/Cypher current-state refresh

Important implication: this repo is highly active. A replacement chat must never branch from this historical anchor blindly; fetch fresh `main` again.

At checkpoint time the latest listed scheduled Market Data run was:
- `The Holding Market Data · Shared Refresh`
- run #421
- event `schedule`
- status `queued`
- head SHA `30265c6...`

Again: re-check current status rather than assuming it is still queued.

Repository visibility at checkpoint creation: public.

---

## 2. CURRENT PROJECT MEMORY STATE IS OLDER THAN LIVE MAIN

`intelligence/project-memory/CURRENT.md` on live main still represented canonical source state around:
`2026-09-10T06:45:13.174Z`

This is older than the current main activity around 09:48Z.

Therefore a replacement chat must use CURRENT only as the bootstrap/routing contract, then recover changing truth from live files/workflows/artifacts.

Critical CURRENT invariants remain:
- default owner language: Russian;
- one primary objective at a time;
- systemic reusable fixes over patches;
- execution authority none;
- physical materialization required for completion;
- memory hierarchy: live main > generated artifacts > subsystem state > continuity > routed canons > old handoffs.

---

## 3. CHECKPOINT HISTORY / EXISTING HANDOFF PR

An earlier checkpoint already exists:
- PR #729
- title: `Memory: detailed BTC/Pendle pre-private chat handoff`
- branch: `checkpoint/chat-handoff-20260910-btc-pendle`
- old head: `c79edcbfa60720979b395d9c508cf66a1fee59cd`

Its checkpoint file is useful historical context, but it was created from an older main anchor (`889994a...`) and is now superseded by this fresher checkpoint.

Do not merge #729 into production simply because it is open. Treat checkpoint PRs as recovery references unless explicitly needed in main memory.

The current checkpoint branch is:
`checkpoint/chat-handoff-20260910-1300-regression-btc-ui-pendle`

---

## 4. MAJOR COMPLETED CHANGE: DEFITEA OWN-CAPITAL TVL BOUNDARY

The current chat already completed and merged PR #728:
`Fix Defitea own-capital TVL boundary`

Key owner semantic now encoded in live main:

### Defitea capital identity
- Defitea Fund and registry #004 `defitea.eth` are the same economic capital object.
- TVL of Defitea = ONLY assets owned by `defitea.eth` / registry #004.
- Registry #001 `05081966.eth` capital is separate.
- Registry #002 `YieldRing.eth` capital is separate.
- #001 and #002 capital must NEVER be added to Defitea TVL.
- Defitea Fund display TVL and defitea.eth Company TVL should be equal for the same market snapshot.
- Defitea Network/Index contribution should use the same own-capital boundary, without nested/double counting.

Current canonical file:
`companies/defitea-canonical-state.json`

Important current fields:
- `displayTvlMode = standalone-company-assets-only`
- `standaloneCapitalSource = registry-004-general-company-balance`
- related companies excluded from capital: #001 and #002
- `fundCompanyTvlParityRequired = true`
- `relatedCompanyCapitalExcludedFromDefiteaTvl = true`
- `relatedCompanyIncomeRollupSeparateFromCapital = true`

Current Defitea positions in canonical state:
- veAERO 2632
- vlCVX 1333
- veCRV 4125
- PENDLE 500
- veFXN 64.81
- veYB 10846
- veFRAX 4456
- veVELO 12180
- sVVV 50
- LQTY 1488
- RSUP 3682

veFRAX detail:
- old established amount: 4224
- new owner-confirmed amount: 4456
- added lot: 232
- acquisition price for the new 232 was NOT supplied
- therefore new lot cost basis remains `UNKNOWN`, not inherited/fabricated
- existing known cost basis for old lot: 1707.3408
- overall FRAX cost-basis status: `partial`

Do not regress this semantic back to the old PR #725 model where Defitea displayed TVL included #001 + #002 capital.

---

## 5. DEFITEA INCOME ROLL-UP — EXISTING CANONICAL MECHANISM ALREADY MATCHES OWNER INTENT

The owner clarified:
- capital of #001 and #002 must NOT enter Defitea TVL;
- but income from #001 and #002 SHOULD be aggregated into Defitea Fund reporting;
- at the same time, each of those companies must continue showing its own income in its own passport;
- income events must not be duplicated in the canonical ledger / whole-Holding accounting.

Current live canonical scope file:
`reporting/company-income-scope.mjs`

It already defines for `defitea.eth`:
- `associatedCompanies = ['YieldRing.eth', '05081966.eth']`
- `includeAssociatedConfirmed = true`
- `includeAssociatedEstimated = true`
- `includeAssociatedCapital = false`

It also explicitly preserves:
- canonical ownership;
- no cross-company reattribution;
- Holding-wide aggregation must use canonical owners;
- company report totals are non-additive across associated-company reports;
- capital owners for Defitea scope remain only `defitea.eth`.

Interpretation:

`YieldRing income event` remains owned by YieldRing and should appear in YieldRing Passport.

`05081966 income event` remains owned by 05081966 and should appear in that company Passport.

`Defitea Fund reporting view` may roll those canonical events up as associated income.

`Holding-wide total` must count canonical events once, not sum overlapping company-report totals.

The current chat determined that **no new income-semantics PR should be created merely to implement this owner rule**, because the reusable canonical reporting scope already embodies it.

However, replacement chat should still include the following in final regression acceptance:
- prove the live public/physical Company Passport consumer is using the canonical monthly reporting artifact;
- prove #001 own income is visible in #001 Passport;
- prove #002 own income is visible in #002 Passport;
- prove Defitea reporting includes the associated income roll-up;
- prove whole-Holding totals do not double count.

Do not rewrite the mechanism unless fresh evidence shows a real broken consumer/materialization path.

---

## 6. OPEN ATOM: COMPANY #001 `05081966.eth` NEW BTC PURCHASE — NOT YET IMPLEMENTED

This is the most important current unfinished data atom.

Current live source file:
`companies/company-001-owner-capital-snapshot.json`

At checkpoint time it still contains ONLY:
- BTC quantity: `0.00126`
- owner-provided entry price: `$77,875 / BTC`
- cost basis: `$98.1225`
- evidence: `owner-provided-current`
- source type: `owner-confirmed-manual-current-snapshot`

Blob SHA observed at checkpoint:
`93b1b6dc0d3f2838929472571f586589ecc9379d`

Therefore **the new BTC lot is still NOT in live main**.

Owner requested new lot:
- add `0.00079 BTC`
- acquisition price `$78,300 / BTC`
- lot cost = `$61.857`

Final required BTC quantity:
`0.00126 + 0.00079 = 0.00205 BTC`

Known combined cost across both owner-provided lots:
`$98.1225 + $61.857 = $159.9795`

Critical semantic:
- BTC belongs to Company #001.
- More broadly after #728, ALL Company #001 capital is outside Defitea TVL.
- Updating Company #001 BTC should raise Company #001 own TVL and relevant whole-Holding aggregate(s), subject to current market price.
- It must NOT raise Defitea own-capital TVL.

Recommended BTC implementation discipline:
1. fresh main first;
2. inspect current canonical owner-current source and writer/projection chain;
3. preserve two lot-level acquisition facts rather than flattening into a fabricated single entry price unless the architecture explicitly supports weighted basis while preserving lots;
4. update source once, not public HTML manually;
5. project through canonical General Balance / Capital State / Public Capital / Company Passport / Collection Card / Index consumers as designed;
6. acceptance must prove Company #001 BTC `0.00205` physically;
7. acceptance must prove new lot cost `$61.857` and total known cost `$159.9795` if that surface exposes cost basis;
8. acceptance must prove Defitea TVL remains own-capital-only;
9. inspect diff for unrelated company state changes before merge;
10. physical materialization proof after merge.

Keep this as a separate PR from UX, Pendle and Learning.

---

## 7. OPEN VISIBLE REGRESSIONS: PERFORMANCE DASHES

Owner observed:
- `defitea.eth` Performance became `—` after recent package work;
- `YieldRing.eth` Performance also became `—`.

These remain required investigation/fix items.

Do NOT assume same root cause for both.

### Defitea known history
Earlier package logic temporarily replaced Defitea standalone TVL with a consolidated value and deliberately disabled PnL/Performance because there was no valid automatic consolidated cost basis. That was consistent with fail-closed semantics but inconsistent with the owner's desired capital model.

After PR #728 restored standalone own-capital TVL, Performance should be re-evaluated against the standalone Defitea cost-basis model.

Important complication:
- new 232 veFRAX has acquisition cost `UNKNOWN`;
- therefore a fully totalized Performance number must not be fabricated if the current performance contract requires complete cost basis;
- a correct outcome may require a partial-known-performance semantics / coverage indicator, depending on existing canon.

Before editing, inspect prior known-good implementation/surface and current reusable Performance methodology. Do not simply force a number onto the UI.

### YieldRing
Diagnose independently:
- inspect current asset lots/cost basis;
- identify when the dash appeared relative to the package baseline;
- determine whether it is a real unknown/partial basis state or regression in public consumer/projection;
- preserve `UNKNOWN != 0`.

Performance work should be a dedicated small atom after diagnosis.

---

## 8. REQUIRED REGRESSION AUDIT AGAINST PRE-THREE-PACKAGE BASELINE

The owner explicitly requested a broad but careful regression audit because recent multi-package work produced severe unintended side effects.

Goal:
compare a verified baseline from BEFORE the three recent package efforts against current main and distinguish:

1. **Expected / owner-requested changes** — allowed.
2. **Market movement / legitimate autonomous data refresh** — allowed if provenance explains it.
3. **Methodology changes explicitly accepted by owner** — allowed.
4. **Unexpected regressions / numerical corruption / disappearing values / double counts / UI breakage** — must be fixed.

Do NOT perform this as one huge mutation package. Audit can be broad/read-only, but fixes must be atomic.

Recommended audit batches:

### Batch A — capital/accounting/data
Check every company/fund and cross-surface consistency for:
- TVL jumps without economic cause;
- asset quantity changes;
- duplicate or missing assets;
- prices / source lane drift;
- cost basis changes;
- PnL / Performance disappearing or appearing spuriously;
- `UNKNOWN` silently becoming 0;
- partial basis represented as total;
- Fund/Company identity boundaries;
- nested/double counting;
- whole-Holding aggregate coherence;
- Network / Index coherence;
- Defitea own-capital boundary;
- YieldRing / #001 independence;
- Rewards / accrued income / cash-flow ownership.

### Batch B — reporting
Check:
- Monthly Reports all companies have rolled from August to September correctly;
- new September income is not being written into August;
- income remains visible in each company's own Passport;
- Defitea associated-income roll-up works;
- whole-Holding totals do not duplicate overlapping reports;
- Rewards is current claimable/accrued snapshot while ledger retains historical earned events.

### Batch C — public/UI
Check homepage, Companies, Passports, Index, Graph, Yield Reports on desktop/mobile for:
- corrupted/duplicated HTML;
- missing blocks;
- cards not clickable where expected;
- mobile overflow;
- hamburger menu cutoff;
- stale or mismatched values;
- viewport issues;
- unexpected copy changes;
- reload/back/hash behavior.

Use an allowlist of known intended changes. Any non-allowlisted strong delta is suspicious until explained.

The final package gets a green mark only after re-running the same audit on the post-fix main and physically inspecting public output.

---

## 9. OPEN UX/COSMETIC OWNER REQUESTS

These are Stage-B bounded public-surface tasks. Keep them separate from accounting semantics where practical.

### 9.1 Homepage footer
At the very bottom of homepage:
replace only:
`Funds · Index`
with:
`Capital Architecture`

Keep all other footer copy unchanged.

At checkpoint time code search did not find either literal reliably, so inspect the current homepage/template/projector source rather than assuming path/string.

### 9.2 Mobile hamburger menu
Homepage mobile view:
- tap sandwich/hamburger upper right;
- current expanded link list pushes `Blog` too low/off viewport and it is barely visible.

Required result:
- whole link list visually balanced;
- safe on short mobile viewport heights;
- no bottom cutoff;
- natural internal scrolling only if necessary;
- preserved accepted desktop behavior;
- spacing/touch targets look intentional;
- no horizontal overflow;
- close/open/back interactions remain correct.

Do not merely move Blog upward with a fragile pixel hack. Make the expanded navigation viewport-safe.

### 9.3 The Collection -> Company Passport
On Companies page, section `The Collection`:
- each company card should be a clear clickable entry point;
- clicking a card should navigate/scroll to the correct on-chain Company Passport;
- desired UX: passport becomes active/opened automatically, smooth scroll, no harsh jump;
- preserve internal card controls/links without click conflicts;
- test desktop and mobile;
- test reload/back/history/hash/deep-link behavior so state is predictable.

Prefer reusable card->passport routing rather than 10 manual one-off handlers if current architecture permits.

---

## 10. PENDLE / sPENDLE — OPEN, REUSE EXISTING INFRASTRUCTURE

Owner reports Pendle has shown `Pending` for a long time and wants the system to actually track it.

Do NOT rebuild from scratch.

Historical infrastructure already exists and should be inspected live first.

### Known first-party method/history
- tracked concept: sPENDLE / Pendle productive mechanism;
- official endpoint historically used:
  `https://api-v2.pendle.finance/core/v1/spendle/data`
- official Pendle Merkle distribution evidence used;
- approximately 14-day reward snapshots;
- legacy vePENDLE virtual sPENDLE participates in active denominator;
- 80% Pendle V2 fees -> PENDLE buybacks; distributed reward may be sPENDLE;
- points/airdrops may be in-kind and should not casually contaminate conservative buyback-only Reference APR.

### Zero-guard already established
Historical `1.4-pendle-zero-guard`:
- official API could show APR 0 while positive revenues/rewards existed;
- if APR=0 and positive economic evidence exists, use warming/unknown, not factual zero;
- false zero must not be written to history.

### Merkle audit
Historical `1.5-pendle-merkle-audit`:
- official Merkle campaign proved real reward distribution despite API zero;
- example around `2026-08-01-spendle`: ~144,388 sPENDLE, ~6,048 recipients.

### Epoch mapping
Historical `1.6-pendle-epoch-map`:
- stable exact ~+3-day mapping from API epoch to Merkle reward window across multiple epochs;
- reward values matched.

### Rejected approach
Historical `1.7-pendle-transfer-reconstruction`:
- full ERC20 Transfer historical reconstruction was too slow/unreliable on public RPC (429/403/408, small getLogs windows);
- explicit production decision: DO NOT use full historical Transfer backfill in routine workflow.

### Designed next approach
Current-balance survivor clustering:
- sample real recent Merkle recipients;
- read current sPENDLE `balanceOf`;
- compare Merkle reward / current direct sPENDLE balance;
- unchanged holders may create dense ratio cluster;
- derive implied active denominator / conservative buyback-only Reference APR.

Historical promotion gate concept:
- ~20+ matching holders;
- spread <= ~50 bps;
- meaningful share of direct holders;
- at least 2 campaigns;
- latest campaign passes;
- +3d mapping retained;
- reward checks pass.

Only promote `warming -> ok` after objective evidence. Never remove Pending by weakening evidence standards.

Replacement task:
1. inspect live current Pendle/productivity adapter files;
2. inspect current machine-state JSON and public status projection;
3. identify exact reason public status is Pending today;
4. determine whether v1.8-or-later implementation already landed;
5. reuse API + Merkle + epoch mapping + zero-guard;
6. avoid full-transfer backfill;
7. build/fix only the smallest missing current lane;
8. physical production proof before `ok`.

Pendle must be a dedicated PR/atom.

---

## 11. PROJECTOR CORRUPTION INCIDENT / LEARNING TAIL

A severe public Companies projector corruption incident occurred on 2026-09-10.

Incident is already recorded in:
`intelligence/learning/engineering-incident-ledger.json`

Incident ID:
`ENG-INC-2026-09-10-public-projector-materialization-corruption`

Established direct root cause:
- dynamic HTML/JS passed as JavaScript `String.replace()` replacement string;
- dollar-prefixed tokens inside injected JS were interpreted as replacement metacharacters;
- physical public HTML became corrupted/duplicated.

Broader multi-surface package increased blast radius and detection difficulty but was not asserted as the direct technical root cause.

Recovery already completed previously:
- PR #718 restored damaged public company pages;
- callback/literal replacement semantics used;
- exact single-target guards;
- replay/idempotence checks;
- fresh Unified production materialization succeeded without recreating corruption.

Engineering rule:
`SOURCE -> PROJECT TO TEMP -> STRUCTURAL/PARSE VALIDATION -> IDEMPOTENCE -> DIFF/ANOMALY CHECK -> PUBLISH`

PR #719 recorded the incident.
PR #720 restored Learning release coherence.

### IMPORTANT: generated Learning candidate state is STILL stale at this checkpoint
Live file:
`intelligence/learning-state/engineering-lesson-candidates.json`

At checkpoint time it still showed:
- generatedAt `2026-09-06T09:17:21.257Z`
- incidentCount `2`
- verifiedCandidateCount `1`
- pendingEvidenceCount `1`
- formalLessonCount `0`

It does NOT yet physically include the Sep10 projector incident.

Therefore this tail remains open:
- identify why normal Learning materialization has not refreshed the file;
- use/fix existing canonical Learning adapter/workflow, not a parallel pipeline;
- include the new incident in generated candidate state if evidence gates permit;
- do NOT auto-promote to formal owner Lesson;
- `formalLesson=false` remains correct without explicit governance/owner action.

This is its own small Learning materialization atom.

---

## 12. MARKET DATA / WORKFLOW RELIABILITY / STALE PR #717

Recent reliability fixes already merged before this checkpoint included:
- #721 `Package 1 · Harden Market Data publish coherence`
- #722 `Package 1 · Fail back transient unhealthy Market Data routes`
- #724 `Package 1 · Align General Balance with per-asset Market Data fallback`

Accepted principles:
- one canonical Market Data writer;
- transient transport failure may use approved bounded per-asset fallback;
- failed/unavailable route cannot be mislabeled healthy;
- structural identity/authority drift remains hard fail;
- `UNKNOWN != 0`;
- no methodology/execution authority expansion.

Open stale draft PR #717:
`Fix Market Data validated snapshot publish retry`

It was based on old broken main and has 13 commits.
#721 explicitly extracted current-safe reliability logic from this older broad branch.

DO NOT merge #717 blindly.

During Stage-C cleanup:
- compare #717 against current main;
- identify whether any unique valid behavior remains;
- if fully superseded, close with explanation;
- if one small valid gap remains, extract only that gap onto fresh main in a new atomic branch.

Other open historical branches/PRs at checkpoint:
- #433 draft checkpoint only; historical recovery context, not a production fix;
- #37 benign production-boundary canary; MUST NEVER be merged.

---

## 13. PUBLIC -> PRIVATE ROADMAP / HARD GATE

The owner still wants to finish all current public/cosmetic/package cleanup and reach an explicit GREEN readiness gate before repository visibility is changed.

Canonical stages:
A. foundation consolidation
B. bounded owner current-state + cosmetic refresh
C. pre-private cleanup/freeze
D. real checks/preflight
E. final public-state snapshot
F. readiness GREEN
G. backup/export
H. explicit owner public -> private visibility change
I. post-private audit

Only after private transition:
`Capital Flow Semantics -> Position Lifecycle -> Wallet Discovery -> Unknown Strategy Queue -> Historical Scanner -> Company Book -> Sensors/Economic Graph -> arbitrary-wallet analysis -> Free Capital Scan -> Verify -> Register -> Index`

Hard law:
**Do not begin Capital Flow Semantics implementation while repo remains public.**

---

## 14. RECOMMENDED RESUME ORDER — SMALL ATOMS, NO BIG MIXED PACKAGE

A replacement chat should not try to implement the whole list in one sweep.

### Step 0 — fresh takeover
- fetch live main;
- open CURRENT + this checkpoint + latest continuity + Router;
- inspect open PRs;
- inspect recent Actions and generated artifacts;
- detect any commits after this checkpoint.

### Step 1 — short read-only regression inventory, DATA first
Before making several more changes, identify critical unexpected regressions from the pre-three-package baseline:
- TVL / asset lists / Performance / PnL / cost basis / Index / Network / Monthly Reports.

Do not fix everything at once; make a RED/YELLOW/GREEN list and choose highest-risk red.

### Step 2 — Company #001 BTC atom
Implement `0.00205 BTC` with two preserved lots.
Acceptance: #001 changes, Defitea own TVL does not absorb it.

### Step 3 — Performance atom(s)
Diagnose Defitea and YieldRing separately.
Fix only evidence-supported regressions.

### Step 4 — tiny homepage/footer atom
Only `Funds · Index` -> `Capital Architecture`, preserving other footer copy.

### Step 5 — mobile hamburger atom
Viewport-safe expanded nav. Preserve desktop.

### Step 6 — The Collection -> Passport atom
Reusable click/deep-link/open/smooth-scroll behavior for company cards.

### Step 7 — Pendle atom
Inspect existing live implementation first; solve the smallest real missing evidence/status lane.

### Step 8 — Learning materialization atom
Refresh stale engineering lesson candidate state through canonical path.

### Step 9 — remaining Package-3 / public polish audit
Determine what parallel chat intended but did not close. Do not trust package labels; inspect actual current files/PRs/surfaces.

### Step 10 — full regression acceptance
Compare baseline -> final current state:
- expected intentional deltas explained;
- no unexplained numerical jumps;
- no duplicated/missing assets;
- no unexpected Performance dashes;
- Monthly Reports correct by month;
- Defitea capital/income scopes correct;
- all company own incomes preserved;
- desktop/mobile surfaces coherent;
- projector replay does not reintroduce corruption;
- physical published artifacts proven.

### Step 11 — Stage-C cleanup / pre-private GREEN
- stale PR review (#717, #433, canary #37 constraints);
- branch/workflow hygiene;
- security High review / preflight;
- final public inventory and snapshot;
- readiness GREEN;
- backup/export;
- only then owner-controlled private switch.

---

## 15. WHAT NOT TO DO

- Do not reintroduce Defitea consolidated capital with #001/#002.
- Do not remove #001/#002 income from their own passports just because Defitea rolls it up.
- Do not sum Defitea roll-up report + associated company reports into Holding total.
- Do not fabricate acquisition cost for 232 veFRAX.
- Do not fabricate Performance to eliminate a dash.
- Do not interpret Pendle API zero as factual zero if reward/revenue evidence is positive.
- Do not rebuild Pendle with full historical Transfer scanning.
- Do not patch generated public HTML directly unless the canonical architecture explicitly treats that file as source.
- Do not trust workflow GREEN without checking materialized output.
- Do not merge stale #717 or canary #37.
- Do not start private-only Capital Flow Semantics while repository remains public.
- Do not mix five unrelated tasks into one PR.

---

## 16. OWNER'S CURRENT ACCEPTANCE GOAL

The owner wants to finish the day's messy package sequence cleanly and put one real GREEN check on the whole current cosmetic/public-state phase.

Definition of done is not "all workflows green" and not "the site looks approximately right".

Definition of done:
- intentional owner changes are implemented;
- unintended regressions from recent packages are identified and removed;
- capital and income semantics are correct;
- public data surfaces agree;
- no hidden hard numerical skew remains;
- mobile UX is clean;
- Company collection navigation works;
- Pendle current status is evidence-driven;
- Learning captured the materialization incident through the canonical path;
- stale reliability/checkpoint debt is understood;
- physical post-merge materialization is proven;
- then current Stage-B/packages can be marked GREEN and Stage C can begin.

---

## 17. FAST RESUME SUMMARY FOR THE NEXT CHAT

If only one minute is available, remember this:

- Fresh live main first; this file is a handoff, not current truth.
- #728 is done: Defitea TVL = own registry #004 assets only.
- Defitea income scope already canonically rolls up YieldRing + 05081966 income WITHOUT their capital, preserving canonical ownership.
- Company #001 BTC update is NOT done: live source still says 0.00126; owner requires 0.00205 after +0.00079 @ $78,300.
- Defitea and YieldRing Performance dashes still need evidence-based diagnosis/fix.
- Required regression audit against pre-three-package baseline remains important.
- Footer -> `Capital Architecture` open.
- Mobile hamburger cutoff open.
- Collection cards -> Passport open.
- Pendle Pending open; reuse API/Merkle/+3d/zero-guard infrastructure, no full Transfer backfill.
- Learning candidate artifact is still stale from Sep6 with only 2 incidents; Sep10 projector incident is in ledger but not downstream candidate state.
- #717 stale; do not merge blindly. #37 never merge.
- Finish public/cosmetic state -> regression acceptance -> Stage C -> GREEN -> backup -> private. Capital Flow Semantics only after private.

`executionAuthority = none`.
