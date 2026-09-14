# THE HOLDING — DETAILED CHAT HANDOFF CHECKPOINT

Date: 2026-09-10
Purpose: deterministic handoff from the current chat to any parallel/replacement chat if the current chat stalls. This checkpoint is intentionally detailed and should be read together with live `main`, `CURRENT.md`, `CONTINUITY.md`, the Memory Routing Index, and fresh workflow/artifact evidence.

## 0. NON-NEGOTIABLE OPERATING RULES

- Never trust any SHA/run/PR number in this checkpoint as current truth without a fresh live check.
- Recovery order: live `main` -> `intelligence/project-memory/CURRENT.md` -> `CONTINUITY.md` / latest immutable continuity -> Memory Routing Index -> task canon -> fresh generated artifacts/evidence.
- `UNKNOWN != 0`.
- partial != total.
- Reference APR/APY is not factual-income authority.
- `executionAuthority = none` unless the owner explicitly changes it.
- No wallet signing, transaction execution, capital movement, autonomous methodology mutation, autonomous security policy mutation, or private-mode migration without explicit owner instruction.
- `GREEN workflow != physically materialized production artifact`.
- Every production writer must validate the materialized output, not only the pre-write candidate.
- Prefer atomic, production-grade reusable fixes. Do not mix unrelated UX/accounting/Pendle/Learning/private-migration changes in one PR.
- When owner says `трекай`, do a new live check of main, relevant branches/PRs, Actions/workflow runs, generated artifacts/evidence. Report: 🟢 done; 🟡 in progress with rough %; ⚪ next.

## 1. LIVE ANCHOR WHEN THIS CHECKPOINT BRANCH WAS CREATED

Checkpoint branch: `checkpoint/chat-handoff-20260910-btc-pendle`
Branch was created from live `main` SHA:
`889994a95a4b9269e5a247ab168d2164c0ebcf90`
Commit message: `intelligence: refresh explanatory context`

This is only a handoff anchor. A replacement chat MUST re-read live main before changing anything.

The repo was still public at checkpoint creation. The public->private gate remains active; Capital Flow Semantics implementation must not start while the repository remains public.

## 2. WHAT THE PARALLEL CHAT ALREADY COMPLETED AFTER THE PREVIOUS HANDOFF

The previous handoff expected a BTC atom to correct Company #001 while preserving the owner rule that Company #001 BTC must not enter Defitea capital.

Before this checkpoint, another chat advanced the repo materially and merged PR #728:

`#728 Fix Defitea own-capital TVL boundary`

Accepted semantics from PR #728:
- Defitea Fund and registry #004 `defitea.eth` remain one economic capital identity.
- Defitea TVL contains ONLY assets owned by registry #004 / defitea.eth.
- Registry #001 `05081966.eth` and registry #002 `YieldRing.eth` capital remain separate and are NEVER added into Defitea TVL.
- Network/Index contribution for Defitea equals the same own-company TVL.
- veFRAX current amount remains 4,456; the added 232 lot has cost basis explicitly `UNKNOWN` / partial.
- Related-company income roll-up is a separate reporting question and was intentionally NOT changed by #728.
- no factual-income authority expansion.
- `executionAuthority = none`.

Important: #728 intentionally did NOT include Company #001 BTC update, homepage footer copy, Pendle, or income-rollup work.

A recent merged main commit associated with #728 was:
`145cc9c29f39f9e6df5c9b07900e3e294b5d2bc9` — `Merge PR #728: restore Defitea own-capital TVL boundary`.
After it, automated capital/memory/intelligence refreshes advanced main to the checkpoint anchor above.

## 3. CURRENT OWNER-REQUESTED COMPANY #001 BTC CHANGE — STILL OPEN AT HANDOFF

Target company: registry #001, `05081966.eth`.

Previously accepted BTC position before the new lot:
- amount: `0.00126 BTC`
- owner-provided acquisition price: `$77,875 / BTC`
- known cost: `0.00126 * 77,875 = $98.1225`
- provenance: owner-provided current snapshot / acquisition fact until independently reproduced onchain.

NEW OWNER-REQUESTED LOT:
- add `0.00079 BTC`
- acquisition price: `$78,300 / BTC`
- lot cost: `0.00079 * 78,300 = $61.857`

NEW TOTAL BTC:
- `0.00126 + 0.00079 = 0.00205 BTC`

KNOWN COMBINED ACQUISITION COST FOR THE TWO OWNER-PROVIDED LOTS:
- `$98.1225 + $61.857 = $159.9795`

CRITICAL OWNER RULE:
- Company #001 BTC belongs to Company #001 only.
- It must NOT be included in Defitea TVL/capital.
- #728 now applies an even cleaner boundary: all #001 and #002 capital stays outside Defitea capital.
- Therefore the Company #001 BTC update should change Company #001 own TVL and the whole-Holding aggregate where appropriate, but must leave Defitea own-capital TVL unchanged except for unrelated market-price movement.

Implementation discipline for this BTC atom:
1. fresh live `main` first;
2. locate the current canonical owner/current-balance source for Company #001 and the canonical writer/projection path;
3. update the source once, not scattered generated/public HTML manually;
4. preserve owner-provenance / cost-basis semantics;
5. run/reuse the canonical projection chain into General Balance -> Capital State -> Public Capital / company page / Companies card / Index or other surfaces that are supposed to consume Company #001 own capital;
6. exact acceptance must prove `0.00205 BTC` on Company #001;
7. exact acceptance must prove Defitea capital does not absorb #001 BTC or any #001 capital;
8. validate physical materialized surfaces after projection;
9. keep this PR atomic; do not add Pendle or Learning changes.

If current canonical source structure has changed since this checkpoint, adapt to the current architecture instead of reproducing old paths mechanically.

## 4. HOMEPAGE FOOTER COSMETIC CHANGE — OPEN

At the very bottom of the homepage footer, replace only the text:
`Funds · Index`
with:
`Capital Architecture`

Keep all other footer words/content unchanged.

This is a small Stage-B cosmetic atom. Prefer a tiny separate PR if the BTC atom touches accounting/state semantics. Do not manually alter generated duplicates unless the canonical source is the HTML itself by design.

## 5. PENDLE / sPENDLE — OPEN AND SHOULD REUSE EXISTING INFRASTRUCTURE

Owner says Pendle has been showing `Pending` for a long time and wants the system to actually track it. Do NOT rebuild from scratch. First inspect what is already alive on current `main`.

Historical infrastructure already developed under the hood:

### 5.1 Official sources / method already established
- asset/mechanism: sPENDLE.
- official API endpoint historically used:
  `https://api-v2.pendle.finance/core/v1/spendle/data`
- official Pendle Merkle distribution repository/data was used as first-party reward evidence.
- sPENDLE reward snapshots are approximately every 14 days.
- virtual sPENDLE from legacy vePENDLE participates in active denominator.
- 80% of Pendle V2 fees are used for PENDLE buybacks; repurchased PENDLE can be distributed as sPENDLE.
- points/airdrops can be in-kind and should not be mixed casually into conservative buyback-only Reference APR.

### 5.2 Zero-guard already proven
Historical development `1.4-pendle-zero-guard` proved the official API could report historical APR `0` while revenues/buybacks were positive.
Rule established:
- if APR=0 but economic reward/revenue evidence is positive, treat Pendle as `warming` / unknown, NOT factual zero;
- never write false zero into history.

### 5.3 Merkle audit already proven
Historical development `1.5-pendle-merkle-audit` used an official Merkle campaign and proved real reward distribution despite API zero.
Historical evidence included a campaign around `2026-08-01-spendle`, approximately 144,388 sPENDLE distributed to ~6,048 recipients.

### 5.4 Epoch mapping already proven
Historical development `1.6-pendle-epoch-map` established a stable exact approximately `+3 day` mapping between API reward epoch and Merkle reward window across multiple epochs, with reward amounts matching.

### 5.5 Full Transfer reconstruction was rejected
Historical `1.7-pendle-transfer-reconstruction` attempted historical ERC20 Transfer reconstruction but public RPC limits made it too slow/unreliable (429/403/408, tiny getLogs windows).
Explicit production decision:
- DO NOT use full historical Transfer backfill in the regular production workflow.

### 5.6 Designed next approach
A later design was current-balance survivor clustering:
- sample real recent Merkle recipients;
- read current sPENDLE `balanceOf`;
- compare `Merkle reward / current direct sPENDLE balance`;
- unchanged long-term holders should create a dense ratio cluster;
- derive an implied active-sPENDLE denominator and conservative Reference APR from buyback rewards only.

Suggested promotion gate from historical design:
- minimum ~20 matching holders;
- spread <= ~50 bps;
- meaningful share of sampled direct holders;
- confirmation on at least 2 campaigns;
- latest campaign passes;
- +3 day epoch mapping retained;
- reward checks pass.
Only then promote `warming -> ok`.

### 5.7 What replacement/current chat must do now
First inspect LIVE current main for:
- Pendle/productivity adapter code;
- productivity machine state JSON;
- source report/provenance;
- current public/status projection showing `Pending`;
- whether any v1.8-or-later implementation ever landed;
- the exact reason status remains Pending today.

Then extend the existing mechanism only as needed.
Do not weaken `UNKNOWN != 0`.
Do not promote to tracked/ok merely to remove the word Pending.
Need objective current evidence and a bounded production-time solution.
Pendle should be its own PR/atom after the Company #001 BTC / footer work unless live evidence shows a tiny no-risk stale-status projection bug.

## 6. LEARNING / PROJECTOR-CORRUPTION INCIDENT — RECORDED BUT MATERIALIZATION TAIL REMAINS

The 2026-09-10 public Companies projector corruption incident is already formally recorded in the engineering incident ledger.

Incident id:
`ENG-INC-2026-09-10-public-projector-materialization-corruption`

Direct root cause established:
- dynamic HTML/JS inserted through JavaScript `String.replace()` replacement-string semantics;
- dollar-prefixed tokens inside the dynamic replacement were interpreted as replacement metacharacters, causing corrupted materialized public HTML.

Important process observation:
- the broad multi-surface package increased blast radius and made detection harder, but it was NOT asserted as the direct root cause.

Recovery already completed:
- PR #718 restored damaged public pages and changed the projector insertions to literal/callback replacement semantics;
- replay / idempotence / exact-target guards were added;
- a fresh production materialization succeeded without recreating the corruption.

Engineering rule to preserve:
`SOURCE -> PROJECT TO TEMP -> STRUCTURAL/PARSE VALIDATION -> IDEMPOTENCE -> DIFF/ANOMALY CHECK -> PUBLISH`

Use shared literal-replacement primitives where possible.
Prefer one logical public surface at a time.

PR #719 recorded the incident.
PR #720 refreshed the Learning release manifest so the canonical engineering adapter could pass the fail-closed release guard again.

However, at the earlier check the generated file:
`intelligence/learning-state/engineering-lesson-candidates.json`
was stale from 2026-09-06 and still showed only 2 incidents, not the Sep10 incident.

Therefore the remaining Learning tail is:
- verify whether a newer Learning workflow/materialization has since refreshed the generated candidate state;
- if still stale, run/fix the existing normal Learning materialization path so the new engineering incident appears in downstream generated state;
- do NOT invent or auto-promote a formal owner Lesson;
- `formalLesson=false` remains correct unless owner/governance explicitly promotes it.

Treat this as a separate Learning-state materialization atom, not mixed into accounting/Pendle.

## 7. MARKET DATA / PRODUCTION RELIABILITY STATE

Recent merged reliability sequence before this checkpoint:
- #721 `Package 1 · Harden Market Data publish coherence`
- #722 `Package 1 · Fail back transient unhealthy Market Data routes`
- #724 `Package 1 · Align General Balance with per-asset Market Data fallback`

Accepted principles:
- preserve one canonical Market Data writer;
- public RPC transport failures may use the already approved bounded per-asset fallback contract;
- unavailable transport must never be mislabeled healthy;
- structural route/identity/authority drift remains hard-fail;
- selected canonical assets must remain usable/positive with explicit lane provenance;
- `UNKNOWN != 0`;
- no methodology or execution authority expansion.

Stale broad PR #717 remains historical/stale debt. #721 explicitly extracted the safe current logic from it. Do NOT merge #717 blindly. Before Stage C cleanup, compare its diff against current main; if fully superseded, close it with an explanatory note rather than resurrecting old code.

## 8. DEFITEA TVL SEMANTICS — IMPORTANT CHANGE HISTORY

Earlier PR #725 temporarily encoded a consolidated display TVL for Defitea as Defitea standalone + #001 + #002, while avoiding Network/Index double count.

The owner later clarified the desired capital boundary, and PR #728 superseded that capital interpretation:
- Defitea capital is Defitea/registry #004 own capital only;
- #001 and #002 remain separate companies and separate capital;
- related-company income roll-up, if desired, is a separate reporting semantic and must not be conflated with capital ownership.

For all future work, use #728 semantics unless the owner explicitly changes them again.

This distinction matters particularly for the new #001 BTC lot: it must not leak into Defitea TVL.

## 9. CURRENT BROADER PRE-PRIVATE ROADMAP

Canonical staged direction remains:
A. foundation consolidation
B. bounded owner current-state + cosmetic refresh
C. pre-private cleanup/freeze
D. real preflight checks
E. final public-state inventory/checkpoint
F. user-facing readiness GREEN
G. verified backup/export
H. explicit owner visibility change public -> private
I. post-private audit

Only AFTER private mode:
`Capital Flow Semantics -> Position Lifecycle -> Wallet Discovery -> Unknown Strategy Queue -> Historical Scanner -> Company Book -> Sensors / Economic Graph -> arbitrary-wallet analysis -> Free Capital Scan -> Verify -> Register -> Index`

Hard gate:
DO NOT begin Capital Flow Semantics implementation while repo is public.

## 10. QUEUED ORDER AFTER THIS CHECKPOINT

Recommended exact order, with a fresh live check before each mutation:

### Atom A — Company #001 BTC
- update canonical #001 BTC amount to `0.00205 BTC`;
- preserve acquisition-lot provenance (`0.00079 @ $78,300` new lot, prior `0.00126 @ $77,875`);
- company own TVL updates through canonical projection;
- prove Defitea own-capital TVL excludes #001 entirely;
- physical materialization verification.

### Atom B — Homepage footer
- replace only `Funds · Index` -> `Capital Architecture`;
- all other footer content unchanged;
- physical page check.

### Atom C — Pendle
- inspect current live implementation/state before coding;
- identify why Pending persists;
- reuse official API + Merkle + zero guard + +3-day mapping / existing code;
- avoid full historical Transfer backfill;
- promote only on objective evidence.

### Atom D — Learning materialization tail
- verify whether new incident now appears downstream;
- if not, fix/run existing Learning path;
- no automatic formal Lesson.

### Atom E — remaining Stage-B / Package audit
- confirm no intended public polish remains unmaterialized;
- do not assume old package names equal current repo truth.

### Atom F — Stage C pre-private cleanup
- stale/superseded PR cleanup (#717 is the primary known example);
- inspect #433 checkpoint-only debt if still open;
- PR #37 canary must NEVER be merged;
- avoid mass deletion.

### Atom G — preflight / migration GREEN
- real workflow/security/hygiene/accounting/reporting/public-page checks;
- final public-state inventory/checkpoint;
- verified backup/export;
- only with explicit owner instruction switch visibility to private;
- post-private audit.

## 11. ACCOUNTING / CURRENT BALANCE REFERENCE FACTS

These are context anchors only; current machine state must be rechecked before using them.

### Company #001 05081966.eth
Previously accepted current balances:
- AERO 202
- FRAX 393
- CRV 480
- BTC was 0.00126; owner now requests 0.00205 after new lot.

### YieldRing.eth
- BTC 0.0334
- veAERO 678
- vlCVX 240
- veFRAX 1,032
- added 232 FRAX cost basis `UNKNOWN`, never zero/invented.

### Defitea / defitea.eth
- veAERO 2,632
- vlCVX 1,333
- veCRV 4,125
- PENDLE 500
- veFXN 64.81
- veYB 10,846
- veFRAX 4,456
- veVELO 12,180
- sVVV 50
- LQTY 1,488
- RSUP 3,682

### Singul
- MANA 486
- SAND 853
- OVR 838
- OLAS 1,180
- VIRTUAL 669
- BEAM removed
- MODE 1,000,000
- ELIZAOS 80,808
- DIEM 0.07
- owner-confirmed DIEM total valuation $150 unless current machine state has newer evidence; do not reinterpret as independently observed market price.

## 12. SITE CORRUPTION INCIDENT DETAILS FOR DEBUGGING

Bad production materialization historical commit:
`518a971cc36301e05044ed13fb619a012f162ca3`
message: `capital: refresh coherent production snapshot`

Recovery PR:
`#718 Recovery: restore public company pages after projector corruption`

Historical recovery merge commit:
`bdbf3b1f9503331aa6eef253625a55591afd2041`

Known affected projector code historically included:
- `companies/owner-balance-site-projection.mjs`
- `companies/public-page-market-runtime-projection.mjs`

The replacement callback/literal semantics were intentional. Never revert this back to raw dynamic replacement strings.

## 13. HOW A REPLACEMENT CHAT SHOULD TAKE OVER WITHOUT LOSING TIME

On first turn after reading this checkpoint:
1. fresh live `main` SHA;
2. fresh open/recent PRs;
3. fresh latest workflow runs, especially Unified Capital, Market Data, Project Memory, Learning, Security/Control Plane;
4. fresh `CURRENT.md` + `CONTINUITY.md` and latest continuity;
5. inspect whether any other chat advanced BTC/footer/Pendle/Learning after this checkpoint;
6. do not duplicate work already merged;
7. if BTC atom is still open, continue there first;
8. every mutation via fresh branch / atomic PR; exact-head checks before merge; then physical post-merge materialization evidence.

If another chat is actively working on the same atom, do not create competing branches blindly. First compare live changes and pick one carrier.

## 14. WHAT IS DEFINITELY DONE VS OPEN AT THIS HANDOFF

DONE:
- public site projector corruption recovered;
- incident recorded in engineering ledger;
- Learning release manifest coherence restored;
- Market Data publish/fallback/General Balance reliability package merged;
- Defitea own-capital boundary corrected and merged through #728;
- automated fresh capital/memory/intelligence refreshes ran after #728.

OPEN / MUST RECHECK LIVE:
- Company #001 new BTC lot + total 0.00205 BTC;
- materialized Company #001 TVL/card/passport/index/whole-Holding projection from that change;
- homepage footer `Capital Architecture` copy;
- Pendle Pending -> evidence-based tracked state using existing infrastructure;
- Learning generated candidate state including the Sep10 projector incident;
- stale/superseded PR cleanup, especially #717;
- final Stage-B audit and Stage-C pre-private cleanup;
- real pre-private GREEN, backup/export, owner-directed private switch, post-private audit.

## 15. OWNER INTENT

The owner explicitly asked for this detailed checkpoint because the current chat appeared to stall. The purpose is that a parallel/replacement chat can immediately close all tails and continue without re-litigating the project architecture.

After creating this checkpoint, the current chat is authorized to continue the queued work immediately. A replacement chat should independently verify current live state and then continue from the earliest still-open atom.
