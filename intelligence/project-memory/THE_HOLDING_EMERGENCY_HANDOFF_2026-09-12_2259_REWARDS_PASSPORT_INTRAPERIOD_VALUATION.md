# THE HOLDING — EMERGENCY HANDOFF CHECKPOINT
## Rewards / Passport / ve(3,3) transient claims / intraperiod historical valuation

**Checkpoint time:** 2026-09-12 ~22:59 MSK (+03:00)  
**Purpose:** emergency continuity handoff from the current ChatGPT work thread to the next parallel/new chat before context exhaustion.  
**Authority:** observation / implementation continuity only.  
**executionAuthority:** `none`.  
**DO NOT treat this file as a substitute for live evidence.** At resume, always re-read live `main`, Actions, current artifacts and active PR state first.

---

# 0. ONE-SENTENCE RESUME

The current primary objective is to finish **PR #804 — `Accounting: resolve exact intraperiod ve33 reward valuations`**, prove the two LAPTOP + one SNX September earned-income events receive exact historical USD valuation without mutating immutable event economics, then continue to the real `aerocvxyb.eth` Passport acceptance: **claimed rewards must disappear from current claimable Rewards while the earned-income history remains permanently in the Canonical Income Ledger**.

Do **not** restart the architecture/refactor phase. Architecture/reporting reliability was explicitly closed GREEN earlier in the day. This frontier is factual accounting/history + current-state Passport correctness.

---

# 1. ABSOLUTE RECOVERY ORDER FOR THE NEXT CHAT

Before changing anything:

1. Read live `intelligence/project-memory/CURRENT.md` from **current `main`**.
2. Follow CURRENT to the latest automatic continuity file.
3. Read `intelligence/project-memory/THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md` only as needed.
4. Read **this handoff file** from branch:
   - branch: `handoff/emergency-rewards-passport-valuation-20260912-2259`
   - file: `intelligence/project-memory/THE_HOLDING_EMERGENCY_HANDOFF_2026-09-12_2259_REWARDS_PASSPORT_INTRAPERIOD_VALUATION.md`
5. Fresh-check live `main` HEAD.
6. Fresh-check PR **#804**, its head SHA, mergeability and every workflow/check.
7. Fresh-check recent production writer runs and generated artifacts.
8. Do not trust any SHA/run status in this file if live state has advanced.
9. Continue **one primary objective at a time**.

Canonical truth priority remains:

`live main → fresh generated artifacts / exact Actions evidence → subsystem machine state → CURRENT/latest continuity → routed canon → older handoffs`.

---

# 2. LIVE SOURCE BOUNDARY AT CHECKPOINT CREATION

## 2.1 live main

At the instant immediately before creating this handoff branch:

- repository: `TheHolding83888/TheHolding-site-1.32`
- live `main` HEAD: `7f6b5ff0d64c4e8f9de39cd1fc40a8acaf06a804`
- commit message: `data: update company monthly earned-income reports`
- commit time: `2026-09-12T19:15:17Z` = `22:15:17 MSK`

This is newer than the CURRENT/continuity anchor described below.

## 2.2 CURRENT at checkpoint creation

Live `CURRENT.md` represented canonical source state:

- `2026-09-12T17:55:38.418Z`
- latest continuity referenced by CURRENT:
  `THE_HOLDING_MASTER_CONTINUITY_2026-09-12_175540_AUTO_c403f091.md`

That continuity's source head was `c403f091...`, and its trigger boundary was the merge of PR #802.

**Important:** live `main` advanced materially after that continuity. Therefore the next chat must use CURRENT only as bootstrap, then prefer the newer live production state.

## 2.3 handoff branch

This checkpoint branch was created from the then-live `main`:

`handoff/emergency-rewards-passport-valuation-20260912-2259`

The handoff branch itself is memory-only. Do not merge it just to move production code.

---

# 3. OWNER'S CURRENT INTENT — DO NOT LOSE THIS

The owner is not asking for a local patch for LAPTOP or one company. The intended system is a reusable capital/accounting infrastructure that tracks the full economic lifecycle across all onchain companies, protocols and reward mechanisms.

The current accounting/Passport principles are:

1. **Current Passport Rewards = what is currently claimable/unclaimed now.**
2. **Earned income history = permanent.** A later claim must never erase what was earned.
3. **Claim is settlement, not a second income event**, unless independent mechanism-specific evidence proves a genuinely distinct income event.
4. `unknown != zero`.
5. Historical income must be valued at the economically correct historical earning/closing boundary.
6. Never use today's price to rewrite closed historical income.
7. Never use a later sale/swap price as the original earned-income price without an explicit accounting proof that such treatment is valid.
8. Never infer factual income from APR/APY.
9. No fake historical prices.
10. One canonical source of factual earned-income recognition: **Canonical Income Ledger**.
11. No per-token / per-company duplicate writer or parallel truth.
12. Real edge cases should become generic system rules.
13. Architecture should remain modular and sensor-driven; capability must grow faster than complexity.
14. No capital/wallet/claim execution authority is created by any of this work.

The owner's desired visual/behavioral acceptance for Passport is simple:

- before claim: reward appears in current Rewards;
- after claim and canonical refresh: settled amount disappears from current Rewards;
- the fact it was earned remains forever in accounting/history;
- any newly accrued post-claim reward can naturally appear again later.

---

# 4. ARCHITECTURE PHASE IS CLOSED — DO NOT REOPEN IT

Earlier GREEN closure:

`intelligence/project-memory/THE_HOLDING_ARCHITECTURE_REPORTING_GREEN_CLOSURE_2026-09-12_1035_MSK.md`

PR #782 recorded the STOP REFACTORING rule.

Do not propose a new broad architecture rewrite merely because this accounting frontier has edge cases. Reuse the existing:

- canonical Rewards writer;
- ve33 factual evidence pipeline;
- Canonical Income Ledger;
- historical valuation resolver;
- current Passport projection;
- existing workflow/control-plane chain.

Only add a new layer if a real reusable gap is proven.

---

# 5. RELEVANT MERGED FOUNDATION — WHAT IS ALREADY DONE

The next chat must **not redo** these completed atoms.

## PR #783 — merged
`Guard short-lived ve(3,3) claimed income`

Proved generic lifecycle semantics for direct veAERO / veVELO:

`earned = closing entitlement + proven settlement - opening entitlement`

Acceptance includes:

- reward earned and fully claimed between snapshots (`opening=0, closing=0, settlement>0`) remains factual earned income;
- claiming an already-open accrued amount does not create a second income event.

No Passport/UI change.

## PR #785 — merged
`Prove transient ve(3,3) claim from exact onchain tx`

Read-only diagnostic proving exact LAPTOP claim from tx/receipt.

## PR #787 — closed, never merge
Temporary forensic harness only.

It proved the exact LAPTOP transient-orphan case described later.

## PR #788 — merged
`Add generic ve33 transient-claim recovery foundation`

Generic read-only ClaimRewards discovery for tracked direct veNFT holders:

- does not need reward contract known in advance;
- binds logs to exact tracked tokenId from calldata;
- deduplicates proof identities;
- overlap/cursor semantics;
- `createsIncome=false`;
- `createsRealisedCashFlow=false`;
- `unknownIsNotZero=true`;
- `executionAuthority=none`.

## PR #789 — merged
`Materialize ve33 transient-claim recovery sidecar`

Single-writer production sidecar:

`reporting/ve33-transient-claim-recovery.json`

Discovery only. No income authority.

## PR #790 — merged
`Harden Base transient-claim historical RPC recovery`

Added adaptive historical `eth_getLogs` splitting + provider failover and redacted endpoint diagnostics.

## PR #791 — merged
`Feed transient ClaimRewards recovery into canonical ve33 accounting`

Sidecar feeds the existing canonical ve33 accounting runner. No new writer.

## PR #795 — merged
`Recover transient ve33 income from proven predeployment zero baseline`

This is critical.

A claim is not enough to create income. For an eligible transient lane, only exact historical facts can prove the opening/closing accounting state.

Generic fail-closed rule:

- exact historical `eth_getCode(rewardContract, openingBoundaryBlock) === 0x` may prove predeployment opening entitlement = zero;
- `0x00`, deployed bytecode, missing provider, RPC failure, ambiguity, incomplete coverage do **not** imply zero;
- verified recovery claim remains settlement-only;
- exact historical `ownerOf()` + `earned()` at claim block are read;
- canonical earned amount reconciles from factual opening, closing and settlement;
- already represented claims are not admitted again;
- no historical USD invented;
- no new writer;
- no Passport mutation;
- `executionAuthority=none`.

### Production LAPTOP materialization after #795

The writer physically materialized the LAPTOP earned event once in:

- `reporting/ve33-accounting-evidence.json`
- Canonical `reporting/income-ledger.json`

A subsequent rebuild added **0 duplicate events**, proving append-only idempotence.

## PR #796 — merged
`Accounting: enforce system-wide reward lifecycle and historical valuation law`

This converted the chat/domain lessons into a machine-enforced system contract.

Important laws now codified in `reporting/income-ledger-policy.json` and validated through the existing canonical validator:

- Passport/current Rewards means current claimable state only;
- claim does not erase earned history;
- claim does not create duplicate income;
- current claimable balance is state, not period income;
- claimable decrease alone does not prove realised cash flow;
- current spot price cannot rewrite old earned income;
- price observed after economic boundary cannot value earlier earned income;
- unproven historical price remains UNKNOWN;
- cross-family summation forbidden;
- ownership/attribution fail closed;
- scope is system-wide, not LAPTOP-only.

Do not create a second validator/workflow for the same law.

## PR #798 — merged
Reporting reliability proof synchronization. It repaired stale Accounting Coverage version expectation; no accounting methodology change.

## PR #801 — merged
Reconciliation Watch now wakes from Monthly Reporting as direct upstream.

## PR #802 — merged
Historical Accounting Completeness Map now wakes from both:

- `Update Company Monthly Reports`
- `Update The Holding Reporting Data`

This matters directly to the current PR #804 cross-artifact drift.

---

# 6. EXACT LAPTOP PRODUCTION CANARY

Company:

`0x5860...83CA8.eth`

Direct veAERO tokenId:

`1938`

Reward token:

`LAPTOP`

Token address:

`0xB095274743941e953c746F9C228DA9c18Bb6ec29`

Reward contract:

`0x7591A0D4a21170a8bB3C02Bf89F13D7757AeBADe`

Claim transaction:

`0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153`

Claim block / event close block:

`51109971`

Exact earned amount:

`67.61502017501584 LAPTOP`

Canonical rounded presentation observed in diagnostics:

`67.615020175016`

Accounting period end / economic boundary:

`2026-09-10T03:01:29.000Z`

Prior state:

- income event physically exists once;
- immutable event `usdValue` remains `null` until independent historical valuation proof is admitted;
- no duplicate event on rebuild.

This was the first real transient-orphan acceptance case, but the architecture is generic.

---

# 7. CURRENT THREE USD VALUATION BLOCKERS — EXACT DIAGNOSTIC PROOF

Temporary PR #803 was diagnostic only and has now been closed intentionally. Do not merge it.

It proved exactly **3 current September engineering-actionable canonical USD valuation blockers**:

## 7.1 LAPTOP event #1

Company:

`0x5860...83CA8.eth`

Event key:

`ve33:aerodrome|0x5860...83CA8.eth|0x58603461149fc2a800a56d421e77dcbba2d83ca8|1938|voting-reward|0x7591a0d4a21170a8bb3c02bf89f13d7757aebade|0xb095274743941e953c746f9c228da9c18bb6ec29:50715726:51109971`

Amount:

`67.615020175016 LAPTOP`

Chain:

- Base
- chainId `8453`

Closing block:

`51109971`

Boundary:

`2026-09-10T03:01:29.000Z`

Settlement proof:

- tx `0xaad260eb97a2414e45dc5f105e8966932ca8795eb267aacd9ce85b929cd37153`
- log index `28`
- decoded tokenId `1938`
- proof source `ve33-transient-claim-recovery-sidecar`

## 7.2 LAPTOP event #2

Company:

`Cypher`

Event key:

`ve33:aerodrome|Cypher|0x64688f4adc3f72cdb44d07e4879c724cd7025696|116579|voting-reward|0x7591a0d4a21170a8bb3c02bf89f13d7757aebade|0xb095274743941e953c746f9c228da9c18bb6ec29:50715726:51112441`

Amount:

`10.936356196393 LAPTOP`

Chain:

- Base
- chainId `8453`

Closing block:

`51112441`

Boundary:

`2026-09-10T04:23:49.000Z`

Settlement proof:

- tx `0x48c7a84b042b31e3bc88fc1932a83dd411ef1b3175e7c00ad646b6fdfed5f475`
- log index `509`
- decoded tokenId `116579`

## 7.3 SNX event

Company:

`defitea.eth`

Asset:

`SNX`

Token:

`0x8700dAec35aF8Ff88c16BdF0418774CB3D7599B4`

Amount:

`2.80734254553 SNX`

Chain:

- Optimism
- chainId `10`

veVELO tokenId:

`32671`

Closing block / valuation block:

`156807818`

Boundary:

`2026-09-12T12:00:13.000Z`

A settlement proof exists from an earlier block/claim transaction, but **historical valuation must follow the canonical event closing boundary `156807818`**, not simply the settlement transaction block.

Reward contract:

`0x3EcaAD2D3996df95D415D4c1C0f7587B22DBD901`

The diagnostic reason for all three was:

`canonical-event-usd-valuation-incomplete`

---

# 8. LAPTOP HISTORICAL PRICE — REAL ONCHAIN PROOF EXISTS

This is no longer a question of whether a defensible historical price source exists.

Temporary diagnostic #803 proved the real Aerodrome Slipstream pool:

Pool:

`0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c`

Pool tokens:

- Base USDC: `0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`
- LAPTOP: `0xb095274743941e953c746f9c228da9c18bb6ec29`

Identity matched onchain.

Historical window selected:

`300 seconds`

Exact diagnostic observations:

### closing block 51109971

- timestamp: `2026-09-10T03:01:29.000Z`
- avgTick: `275745`
- LAPTOP/USDC historical TWAP result expressed as USDC per LAPTOP:
  `1.0596087635721592`

### closing block 51112441

- timestamp: `2026-09-10T04:23:49.000Z`
- avgTick: `277700`
- USDC per LAPTOP:
  `0.8714555000749721`

These numbers are evidence of the historical pool ratio only.

**Final factual USD valuation must additionally prove the Base USDC/USD price at the same exact closing block. Do not hardcode USDC = $1.**

---

# 9. HISTORICAL PRICE ROUTES IMPLEMENTED IN CURRENT PR #804

Current work branch:

`accounting/intraperiod-historical-reward-valuation-v2-20260912`

Current PR:

**#804 — `Accounting: resolve exact intraperiod ve33 reward valuations`**

PR head at checkpoint:

`07e12d949be7f138db04290ff79649e667f93e5b`

Base at checkpoint:

`7f6b5ff0d64c4e8f9de39cd1fc40a8acaf06a804`

PR was mergeable and, relative to that base, branch was ahead and not behind.

## 9.1 Base USDC/USD exact Chainlink route

Token:

`0x833589fcd6edb6e08f4c7c32d4f71b54bda02913`

Feed:

`0x7e860098F58bBFC8648a4311b374B1D669a2bc6B`

Network:

`base`

chainId:

`8453`

No peg assumption. Historical answer is read at the exact event closing block.

## 9.2 Optimism SNX/USD exact Chainlink route

SNX token:

`0x8700daec35af8ff88c16bdf0418774cb3d7599b4`

Chainlink feed:

`0x2FCF37343e916eAEd1f1DdaaF84458a359b53877`

Network:

`optimism`

chainId:

`10`

Configured max age:

`1200 seconds`

Historical answer is read at the exact ve33 closing block.

## 9.3 Base LAPTOP Slipstream route

LAPTOP token:

`0xB095274743941e953c746F9C228DA9c18Bb6ec29`

Pool:

`0x99cf3e8bfb02c300312c53aac5d0b082e3d5975c`

Quote token:

Base USDC `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`

Quote Chainlink feed:

`0x7e860098F58bBFC8648a4311b374B1D669a2bc6B`

TWAP window:

`300 seconds`

Source family introduced:

`historical-onchain-slipstream-twap-chainlink-at-boundary`

The proof is intended to bind:

- immutable reward token;
- event chainId;
- event closing block;
- exact pool identity;
- quote token identity;
- quote Chainlink contract;
- TWAP seconds;
- source block timestamp;
- Chainlink round identity;
- no current price;
- no peg assumption;
- no APR;
- no execution authority.

---

# 10. KEY SYSTEMIC GAP #804 FIXES

The existing historical valuation annotator previously only treated month-start `periodEnd` values as eligible through a month-boundary regular expression.

That was adequate for closed month-end backfills, but wrong for factual earned events that close inside the month.

The three current blockers are real **intraperiod** events:

- Sep 10 LAPTOP #1;
- Sep 10 LAPTOP #2;
- Sep 12 SNX.

They already have exact immutable ve33 closing-block identity.

Therefore #804 changes the rule from roughly:

`only month boundary events are historical-valuation eligible`

to:

`any factual ve33 event with valid exact periodEnd + immutable closing-block identity can be historically valued at that exact boundary`.

This is a reusable fix, not a one-off token exception.

---

# 11. PR #804 CHANGED FILES AT CHECKPOINT

GitHub reported 6 changed files:

1. `reporting/accounting-reconciliation-watch.json`
2. `reporting/canonical-earned-income-view.mjs`
3. `reporting/historical-canonical-price-validation.mjs`
4. `reporting/historical-canonical-price.mjs`
5. `reporting/income-ledger.mjs`
6. `reporting/ve33-historical-valuation-identity.mjs`

### IMPORTANT generated-artifact warning

`reporting/accounting-reconciliation-watch.json` is a generated/writer-owned artifact and appears in the PR diff because a temporary branch-side validation/rebuild runner refreshed it.

Before merging #804, the next chat must decide this based on fresh state:

- if live `main` production writers have now generated the same/newer legitimate watch state, **do not carry a branch-authored generated snapshot as a hand-maintained production source**;
- reset/reconcile that file to fresh main unless it is the canonical writer-produced artifact required by the production chain;
- preserve ONE ARTIFACT → ONE CANONICAL WRITER.

Do not accidentally make PR #804 a second writer for Reconciliation Watch.

---

# 12. PR #804 CI STATUS AT HANDOFF

Head SHA:

`07e12d949be7f138db04290ff79649e667f93e5b`

GREEN workflows observed:

- `Verify Income Lifecycle Acceptance Contract`
- `The Holding Security · Commit Identity Privacy Guard`
- `Verify Accounting Reconciliation Watch`
- `The Holding Reliability · Repository Hygiene Guard`
- `Verify Company Monthly Reports`
- `Verify Frax Factual Accounting`
- `Verify ve33 Volatile Historical Pool Valuation`
- `The Holding Security · Public Surface Privacy Guard`
- `Verify Project X Income Accounting`
- `Verify ve33 Locked-Managed Historical Accounting`
- `Verify Reporting Layer`

The only RED check observed:

`Verify Public Foundation v1 Final Audit`

The failure happened at:

`Run final cross-artifact acceptance audit`

All earlier steps inside that job were GREEN:

- monthly projection validation;
- accounting coverage;
- notice queue;
- reference reconciliation;
- historical completeness map validation;
- reconciliation watch;
- income lifecycle acceptance.

## Exact failure

`AssertionError: Completeness/Monthly generation drift`

Actual Historical Completeness generatedAt:

`2026-09-12T18:33:36.875Z`

Expected / Monthly Reports generatedAt:

`2026-09-12T19:15:17.053Z`

This is a **cross-artifact freshness/synchronization failure**, not evidence that the new LAPTOP/SNX valuation logic is wrong.

Do not weaken the final audit and do not patch around the timestamp invariant.

PR #802 was specifically built so Historical Completeness wakes from Reporting Data as well as Monthly Reports. The next chat should first determine whether the canonical downstream workflow has simply not finished/materialized yet.

---

# 13. EXACT FIRST ACTION FOR NEXT CHAT

Do this before editing PR #804:

1. Fetch fresh live `main`.
2. Fetch fresh `CURRENT`.
3. Fetch current PR #804 head and workflow runs.
4. Inspect latest production runs for:
   - `Update Company Monthly Reports`
   - `Update Historical Accounting Completeness Map`
   - `Update Accounting Reconciliation Watch`
   - `Update The Holding Reporting Data`
5. Inspect fresh `generatedAt` fields in:
   - `reporting/company-monthly-reports.json`
   - `reporting/historical-accounting-completeness-map.json`
   - `reporting/accounting-reconciliation-watch.json`
6. If completeness has caught up to the monthly artifact, bring fresh main into #804 and rerun CI.
7. If completeness has **not** caught up, diagnose the writer-chain / workflow_run handoff. Do not touch historical price math yet.
8. Remove/reconcile the branch-side generated `accounting-reconciliation-watch.json` diff if it is not legitimately production-writer-owned.
9. Require **all #804 checks GREEN**, including Public Foundation Final Audit.
10. Only then merge #804.

---

# 14. POST-MERGE #804 ACCEPTANCE — WORKFLOW GREEN IS NOT ENOUGH

After #804 merge, do not declare victory immediately.

Wait for the canonical Reporting writer chain to rebuild live production artifacts.

Then prove physically on `main`:

## 14.1 LAPTOP company event

The `67.615020175016 LAPTOP` event remains exactly once.

Immutable event economics remain unchanged:

- raw factual `usdValue` stays null if the architecture intentionally keeps immutable event field null;
- historical resolved value lives in `valuationResolution` metadata;
- no second income event is created.

Its `valuationResolution` must show the exact Slipstream + exact Base USDC Chainlink provenance.

## 14.2 Cypher LAPTOP event

The `10.936356196393 LAPTOP` event is resolved by the same generic source family at its own closing block.

No token-specific manual value.

## 14.3 SNX event

The `2.80734254553 SNX` event is resolved at closing block `156807818` via exact historical Optimism SNX/USD Chainlink.

## 14.4 Canonical view / notices

Verify:

- `canonical-earned-income-view` recognizes all three historical valuations;
- current engineering-actionable `canonical-event-usd-valuation-incomplete` count decreases accordingly;
- no hidden conversion of UNKNOWN to zero;
- no duplicate eventKey;
- no new income source/writer;
- monthly reporting and completeness remain synchronized.

---

# 15. SUPERSEDED / CLOSED PRS — DO NOT REOPEN AS PRIMARY WORK

## #793 — closed, intentionally failed experiment

It attempted to recover LAPTOP price from canonical Rewards history. That source did not contain exact-token historical price before the claim.

Correct lesson:

- do not use future/current price;
- do not use symbol matching;
- do not use owner-reported sale proceeds;
- do not use approximate `$68–72` or any guessed number.

It is superseded by the exact onchain pool proof in #804.

## #797 — closed as superseded

Old Base exact Chainlink candidate. Useful semantics were carried forward.

## #800 — closed as superseded

Fresh-main Base-only candidate. Superseded by #804 because the true current frontier contains **three** intraperiod blockers, not just Base USDC.

## #803 — closed diagnostic only

It proved exact blockers and LAPTOP pool/TWAP capability. Do not merge temporary diagnostic code/workflow.

---

# 16. `aerocvxyb.eth` — OWNER SCREENSHOT ACCEPTANCE CASE

The owner sent three screenshots in the current chat specifically for `aerocvxyb.eth`.

Wallet / holder associated with the two direct Base veNFT positions:

`0xA641752824d512FA8683758c6b2D8A04ea46dcD0`

The two important veAERO tokenIds are:

- `64985`
- `69194`

The owner manually claimed a set of Aerodrome rewards from these positions.

The screenshots show the core bug/UX mismatch:

- rewards were already claimed by the owner;
- Passport/current Rewards still showed the old rewards as if they remained claimable.

This is **not** supposed to be solved by deleting history.

Correct lifecycle acceptance:

1. claim detected onchain;
2. current claimable state refreshes;
3. settled amount disappears from current Passport Rewards;
4. earned-income event remains in Canonical Ledger permanently;
5. claim remains settlement, not new income;
6. if the veNFT accrues new rewards after the claim, those new current rewards may appear again.

## Evidence already found

The ve33/onchain infrastructure already has factual tracking for both tokenIds. The prior chat inspection confirmed the claim detector found the owner's real claims across both locks; the remaining issue is projection/current-state freshness and reconciliation, not inability to detect the two veNFTs.

Do not treat tokenId `64985` and `69194` as two local special cases. They are acceptance fixtures for the generic lifecycle.

---

# 17. WHY PASSPORT STILL SHOWED CLAIMED REWARDS

At the time this was investigated, live:

`companies/rewards-data.json`

was generated at:

`2026-09-11T09:46:54.040Z`

That snapshot predates the owner's later claim interaction reflected in the screenshots.

Therefore the immediate likely cause is stale current-state Rewards projection rather than missing historical earned-income accounting.

Do **not** hand-edit claimed rows out of `rewards-data.json`.

Correct repair path:

- canonical `Update Company Rewards` / existing current-state collector must re-read the live veAERO claimables;
- its generated Rewards state must become the only current claimable truth;
- Passport reads that state;
- historical accounting remains separate and append-only.

The Rewards methodology already states that historical routes with zero residual claimables should be hidden from current Passport, while legacy routes remain visible only when residual Unclaimed exists.

---

# 18. `aerocvxyb.eth` NEXT ACCEPTANCE AFTER #804

Once #804 is fully merged and physically materialized, make `aerocvxyb.eth` the next concrete end-to-end acceptance atom.

Required proof for **both** veNFT `64985` and `69194`:

### Current state

- obtain a fresh canonical Rewards run after the claims;
- identify each current reward route/contract on each tokenId;
- prove already settled amounts are no longer claimable;
- confirm Passport no longer displays those settled balances as current Unclaimed;
- preserve any genuinely new post-claim accrual.

### Historical state

- verify all factual earned events that existed before settlement remain in `reporting/ve33-accounting-evidence.json` / `reporting/income-ledger.json`;
- verify settlement did not delete them;
- verify settlement did not create duplicate income;
- verify any unresolved historical USD stays null/UNKNOWN until independently proven.

### UI/Passport projection

The final public behavior should be understandable to a normal owner:

`Current Rewards` = available now.  
`Income / History` = what the company actually earned over time.

Do not mix those concepts.

---

# 19. RELEVANT FILES FOR THE NEXT CHAT

Core files to inspect:

- `reporting/ve33-accounting-evidence.json`
- `reporting/ve33-transient-claim-recovery.json`
- `reporting/income-ledger.json`
- `reporting/income-ledger.mjs`
- `reporting/income-ledger-policy.json`
- `reporting/canonical-earned-income-view.mjs`
- `reporting/historical-canonical-price.mjs`
- `reporting/historical-canonical-price-validation.mjs`
- `reporting/ve33-historical-valuation-identity.mjs`
- `reporting/company-monthly-reports.json`
- `reporting/accounting-coverage.json`
- `reporting/accounting-notice-queue.json`
- `reporting/accounting-reference-reconciliation.json`
- `reporting/historical-accounting-completeness-map.json`
- `reporting/accounting-reconciliation-watch.json`
- `reporting/income-lifecycle-contract.json`
- `companies/rewards-data.json`

Relevant workflow/control paths should be discovered live; do not assume names/SHAs from old memory when executing.

---

# 20. PR #804 IMPLEMENTATION BOUNDARIES — DO NOT WEAKEN

The current code is designed to preserve these invariants:

- exact historical block;
- exact reward-token identity;
- chain-bound proof;
- pool-bound proof for Slipstream;
- quote-token identity;
- exact Chainlink quote feed;
- TWAP rather than spot for LAPTOP;
- 300-second LAPTOP window;
- `stablecoinPegAssumptionUsed=false` for newly generated exact proofs;
- `currentPriceUsed=false`;
- `referenceAprUsed=false`;
- `executionAuthority=none`;
- immutable event economics not mutated;
- resolved USD stored in valuation metadata;
- source proof must match ve33 immutable identity.

### Backward compatibility rule already learned

Some old exact Chainlink historical resolutions predate the explicit `stablecoinPegAssumptionUsed` field.

Do not invalidate previously proven history merely because the new metadata field did not exist then.

Correct compatibility rule used in this work:

- explicit `stablecoinPegAssumptionUsed: true` is invalid;
- old direct exact Chainlink proof with the field absent may remain valid if all older token/chain/feed/block/round proof requirements match;
- all newly created proof records should explicitly carry `false`.

This avoids rewriting history while making new provenance stricter.

---

# 21. GENERATED ARTIFACT / WRITER DISCIPLINE

This has caused repeated false starts. Preserve the rule strictly:

**ONE ARTIFACT → ONE CANONICAL WRITER**

A PR test may locally generate an artifact to prove behavior, but that does not grant the PR a new production writer role.

After merge:

- canonical writer should physically publish the artifact;
- a GREEN validation workflow by itself is not production materialization;
- inspect live `main` bytes / generatedAt / workflow commit.

Never declare green from a PR check alone when the acceptance requires generated production data.

---

# 22. CURRENT REPORTING/ACCOUNTING SNAPSHOT OBSERVED IN #804 CHECKS

The #804 Public Foundation run saw:

### Monthly Reports validation

- companyCount: `10`
- completeMonths: `7`
- partialObservedMonths: `19`
- estimatedMonths: `20`
- unknownMonths: `1`
- rawCanonicalEventCount: `1022`
- recognizedCanonicalEventCount: `975`
- unresolvedCanonicalEventCount: `42`
- claimableSnapshotDerivedIncomeEventCount: `0`

### Accounting Coverage

- mechanism instances: `50`
- unique mechanisms: `29`
- reusableCoverageGaps: `0`
- factualTrackingProofs: `3319`
- monthClosingAuthority: `false`

### Notice Queue

- rowCount: `36`
- engineeringActionableCount: `3`
- parkedCount: `4`
- missingCapabilityCount: `0`
- trackingNoPeriodEventCount: `19`
- periodLifecycleReconciliationCount: `7`
- ownerDataPendingCount: `2`
- boundaryEvidencePendingCount: `2`

### Reconciliation Watch

- watchItemCount: `41`
- engineeringActionRequiredCount: `3`
- evidencePendingCount: `4`
- historicalForensicReviewCount: `26`
- referenceDiagnosticReviewCount: `8`

These figures are checkpoint context only. Re-read live after resume.

---

# 23. OWNER'S BROADER ECONOMIC MODEL — MUST PROJECT BEYOND THIS CHAT

The owner explicitly asked that today's broader discussion not remain chat-only.

Key idea:

**Voting power itself is a productive economic asset.**

For ve-style systems, the company can own/lock governance power and monetize the right to direct emissions/liquidity.

The owner wants The Holding sensors to understand the whole economic chain, not just display isolated reward tokens.

Conceptual chain to preserve:

`Voting Power → Vote / Allocation → Incentive / Bribe → Emissions → LP / TVL → Liquidity Depth → Volume → Fees → Reward / Cash Flow → Claim / Settlement → Canonical Income → Reinvestment / Compounding`

This applies conceptually across:

- Aerodrome / veAERO;
- Velodrome / veVELO;
- Curve / veCRV;
- Convex / vlCVX / meta-governance;
- FX / veFXN and related vote markets;
- Votium / VoteMarket / incentive markets;
- future Aero predictive allocation model;
- other future ve / gauge / allocation systems.

The current LAPTOP case is an excellent real production example of that wider model:

- LAPTOP pool wanted liquidity/emissions;
- incentive tokens were offered to voting power;
- veAERO owners directed votes;
- rewards were earned by the onchain company;
- claim settled the entitlement;
- accounting must preserve the earned-income fact;
- future sensors should connect that income to the upstream pool/vote/incentive/liquidity economics.

This is not an instruction to broaden #804. Finish the accounting atom first.

---

# 24. SENSOR / ECONOMIC GRAPH PROJECTION AFTER CURRENT FRONTIER

The owner wants future sensor chats to recover this idea from GitHub rather than relying on model conversational memory.

After current Rewards/Passport accounting is closed, the future sensor/Economic Graph work should consider first-class observable entities/edges such as:

### voting-power state

- veNFT/tokenId;
- locked amount;
- lock expiry / max-lock status;
- voting weight;
- delegation / manager / meta-governance route;
- current allocation/vote.

### incentive/bribe market

- pool/gauge being incentivized;
- incentive provider;
- reward tokens;
- incentive amount;
- incentive USD value at appropriate observation time;
- total votes purchased/attracted;
- incentive per unit of voting power;
- competing gauges/pools;
- weekly/epoch changes.

### emissions

- emission amount directed by vote;
- emission USD value;
- emission per vote;
- emission per incentive dollar;
- effect on LP APR.

### liquidity / LP

- TVL before vote/incentive;
- TVL during incentive;
- TVL after incentive expires;
- liquidity depth;
- LP inflow/outflow;
- capital retention after incentives.

### trading economics

- volume;
- fees;
- fee/TVL;
- fee/emission ratio;
- fee/incentive ratio;
- realized voter revenue;
- protocol productivity.

### reward lifecycle

- accrued/claimable;
- earned event;
- claim/settlement;
- wallet receipt;
- swap/transfer if later tracked;
- compounded/reinvested state;
- permanent historical accounting.

Potential derived metrics:

- price of voting power;
- bribe/incentive ROI;
- emissions efficiency;
- liquidity acquisition cost;
- liquidity retention after incentive;
- fee capture per incentive dollar;
- fee capture per unit of voting power;
- persistence/quality of liquidity;
- reward-token liquidity/quality/risk;
- capital migration between competing gauges/pools/protocols.

This should be represented through existing Economic Graph / sensor canon where appropriate, **not dumped into CURRENT as a giant prose block**.

If a new durable canon delta is needed, route it through the Memory Routing Index so a future sensor chat automatically knows what to load.

---

# 25. FUTURE AERO / PREDICTIVE ALLOCATION CONNECTION

Owner sees this accounting/sensor work as directly related to the future Aero model where allocation becomes more predictive and liquidity may move based on expected future volume/fees rather than only backward-looking weekly voting.

The Holding's strategic future opportunity:

1. observe incentives / allocations / votes;
2. observe where liquidity is moving;
3. observe volume and fee formation;
4. measure realized outcome;
5. learn which signals precede productive liquidity;
6. eventually produce a **Predictive Allocation** layer/recommendation;
7. still keep execution authority separate unless explicitly granted much later.

Do not build Predictive Allocation now. It remains downstream of factual accounting/history and sensor completeness.

---

# 26. USER'S CROSS-CHAT MEMORY REQUIREMENT

The owner explicitly stated that useful new principles learned in this chat must **not remain conversational and disappear**.

When work becomes materially accepted:

- code/tests should hold machine-enforceable rules;
- machine artifacts should hold changing facts;
- continuity/checkpoints should hold resume state and important milestones;
- Economic Graph/sensor canon should hold durable economic modeling concepts;
- Router should be updated only if future chats need a new retrieval path.

Do not bloat CURRENT with every research idea.

The goal is that another chat can recover the correct conceptual model through:

`CURRENT → continuity → Router → task canon → live artifact/evidence`.

---

# 27. CURRENT PRIORITY ORDER

Do not reorder casually.

## Priority 1 — close #804

Exact intraperiod historical USD valuation for the three current ve33 blockers.

## Priority 2 — physical production acceptance

Prove live Canonical Ledger / notices / reports actually materialize the resolved valuations.

## Priority 3 — `aerocvxyb.eth` claimed-reward Passport acceptance

Both veNFTs `64985` + `69194`:

current claimable correct, earned history preserved.

## Priority 4 — generic current-vs-history Passport proof

Ensure same lifecycle applies across companies/reward mechanisms where supported.

## Priority 5 — sensor/Economic Graph projection

Preserve and expand voting power / incentives / emissions / LP / volume / fees / reward relationships.

## Priority 6 — Predictive Allocation

Later, after factual sensor foundation is mature.

## Cosmetics

Parked until fundamental accounting/history front is green unless owner explicitly reprioritizes.

---

# 28. DO NOT DO LIST

The next chat should NOT:

- restart broad architecture simplification;
- create a second Canonical Income Ledger;
- create per-token accounting writers;
- create LAPTOP-specific permanent accounting architecture;
- use today's LAPTOP price for Sep 10 income;
- assume USDC exactly equals $1;
- use sale proceeds as original earned price;
- use Reference APR/APY as factual income;
- erase earned income after claim;
- create a second income event on claim;
- manually delete current Passport rewards from generated JSON as a patch;
- call UNKNOWN zero;
- merge #804 with a red Public Foundation Final Audit;
- weaken the final audit timestamp/freshness invariant just to get green;
- merge stale superseded #797/#800/#803;
- treat branch-local generated Reconciliation Watch output as a new canonical writer;
- declare production green merely because CI is green before physical writer output appears;
- broaden into Predictive Allocation before the current accounting/Passport atom is closed.

---

# 29. WHAT GREEN MEANS FOR THIS FRONTIER

The current frontier is fully GREEN only when all of the following are true:

1. #804 code checks all GREEN.
2. Public Foundation Final Audit GREEN.
3. #804 merged to fresh main without stale generated artifact ownership violation.
4. Reporting writer physically rebuilds live ledger.
5. Two LAPTOP + one SNX events have accepted historical valuationResolution.
6. No duplicate events.
7. Immutable event economics remain unchanged.
8. Notice/reconciliation stack physically reflects the reduced valuation gap.
9. Monthly Reports / Completeness / Reconciliation Watch are synchronized.
10. `aerocvxyb.eth` fresh Rewards state reflects owner claims for both #64985 and #69194.
11. Passport no longer presents settled balances as currently claimable.
12. Historical earned income remains permanently present.
13. New post-claim accrual remains able to appear normally.
14. Machine tests encode the lifecycle so another company cannot regress silently.
15. Durable continuity/canon is updated after actual closure, not before.

---

# 30. TRACKING REPORT STYLE FOR OWNER

When owner says **`трекай`**:

Perform fresh read-only live check of:

- main;
- active/relevant branches and PRs;
- workflows/Actions/runs;
- fresh generated artifacts/evidence;
- CURRENT/latest continuity/Router resume context when relevant.

Report briefly:

- 🟢 done;
- 🟡 in progress + approximate % if useful;
- ⚪ next/queue;
- short risk/blocker if real.

Do not report old SHA/run as current without fresh verification.

---

# 31. HUMAN-FACING SIMPLE EXPLANATION OF CURRENT WORK

If owner asks what we are doing in simple words:

> The system already knows that the reward was earned and that a claim happened. Now we are making it remember the correct dollar value at the moment it was earned, not today's price. After that we verify that claimed rewards disappear from the company's current Passport, while the historical income remains forever.

That is the correct high-level explanation.

---

# 32. WHY THIS MATTERS BEYOND THREE TOKENS

This work turns a real market edge case into a general accounting primitive:

- rewards can appear and disappear between snapshots;
- claims can happen before the next collector run;
- volatile/meme/incentive tokens may not exist in historical price catalogs;
- price sources may be DEX-relative rather than direct oracle feeds;
- current claimable state and historical earned income are fundamentally different state families.

A mature system must reconstruct truth from:

- exact protocol state;
- exact claim logs;
- immutable event identity;
- exact historical market evidence;
- canonical current-state refresh.

This is foundational to scaling from a handful of companies to many onchain companies and protocols.

---

# 33. FINAL HANDOFF COMMAND TO THE NEXT CHAT

**Resume from PR #804, not from general architecture.**

First fresh-check the Public Foundation failure. It was a Completeness/Monthly `generatedAt` drift, while every relevant accounting/valuation check was GREEN. Determine whether canonical downstream writers have caught up. Preserve single-writer ownership. Get #804 fully GREEN and physically materialized. Then move immediately to the owner's real `aerocvxyb.eth` acceptance for veNFTs `64985` and `69194`: claimed rewards disappear from current Passport, earned history remains in Ledger. After that, preserve the wider voting-power / incentives / emissions / liquidity / volume / fees model in the proper sensor/Economic Graph durable canon so future sensor chats recover it automatically.

**Do not guess. Re-read live state. Do not restart solved work.**

---

# 34. CHECKPOINT INTEGRITY NOTE

This handoff was intentionally created on a separate emergency branch rather than mutating production `main` while #804 is active.

The branch is a continuity artifact only. The next chat may use it as detailed operating context and then continue production work on the actual relevant branch/PR.

The model can change. **The memory must remain The Holding's.**
