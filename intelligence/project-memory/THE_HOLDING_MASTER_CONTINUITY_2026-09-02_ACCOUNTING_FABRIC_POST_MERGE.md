# THE HOLDING — MASTER CONTINUITY · ACCOUNTING FABRIC POST-MERGE
## 2026-09-02 · Canonical factual earned-income foundation through Frax + ve(3,3)

Status: **PRODUCTION CODE MERGED / FIRST NEW FACTUAL MATERIALIZATION PARTIALLY PENDING**  
Authority: **read-only accounting/reporting**  
executionAuthority: **none**

---

## 0. WHY THIS CHECKPOINT EXISTS

This file is the durable resume point after the September 2 factual-accounting campaign. It supersedes the temporary stacked-PR working state as the preferred human continuity for accounting work.

The project has moved from approximate/reference-income reporting toward a factual accounting fabric where one owner-facing monthly earned-income number is produced only from canonical mechanism evidence and fail-closed lifecycle semantics.

The core architecture is now:

`existing protocol/source collectors → mechanism-specific accounting evidence/adapters → Canonical Income Ledger → canonical earned-income view → company monthly reports → passports / yield reports / future consumers`

The key architectural law remains: **do not build a second tracker**. Existing Rewards/Productivity/Stable/protocol collectors remain the observation/radar layer. Accounting interprets already observed facts into durable earned-income evidence and adds new collection only where factual recognition objectively requires evidence that does not yet exist.

---

## 1. EXACT LIVE PRODUCTION ANCHOR AT CHECKPOINT CREATION

The factual-accounting integration was merged through PR **#593**.

Canonical merge commit:

`1db0eeef96505a73d5a0a748f819b6b67514201f`

Merge title:

`Accounting: integrate canonical factual income fabric through ve(3,3)`

Immediately after merge, normal production automation advanced `main` further:

- `512a0e9dfd0016a36344e218ed28400bcb55349d` — `security: extend autonomous security memory`
- `fd52205b21b3ec6a13ce9eae7e2982384d338dcc` — `data: update company monthly earned-income reports`
- `65996f61aad04cdd5e3752986fa15ec9c9166480` — `memory: refresh current project bootstrap`

The memory checkpoint branch was created from exact live `main`:

`65996f61aad04cdd5e3752986fa15ec9c9166480`

Changing facts must still be re-read from live `main`; this checkpoint is a resume map, not a substitute for current evidence.

---

## 2. OWNER ACCOUNTING CANON — DO NOT REGRESS

The owner-facing target is **one primary USD earned-income number per company per calendar month**, but the internal ledger must preserve the mechanism and lifecycle that produced it.

Hard accounting laws:

1. Income is counted when it is **economically earned**, not merely when later claimed.
2. Earned-but-unclaimed / claimable accrued entitlement counts only when a mechanism-specific factual boundary proves the accrual.
3. Accepted embedded / auto-compounded / locked yield may count as earned income when the protocol mechanism proves that economic earning already occurred.
4. A claim, reset, withdrawal, redemption or later wallet receipt is **settlement**, not a second income event, when the same economic income was already recognized earlier.
5. Opening/pre-baseline balances are **not** income of the new month.
6. Generic current reward balances are state, not period income.
7. Generic reward/claimable snapshot deltas must never invent monthly income in the consumer layer.
8. Generic wallet receipts must not automatically become new income without mechanism-specific non-overlap proof.
9. USD value is frozen at the canonical recognition/accounting boundary. Later token price movement must not rewrite closed income.
10. TVL / asset P&L / market revaluation are separate from Monthly Earned Income.
11. Partial historical months remain explicitly incomplete. **UNKNOWN != 0.**
12. Reference APR/APY and reference generated income remain secondary analytics only and are never period earned-income authority.
13. Cross-family summation is forbidden unless the canonical ledger lifecycle explicitly proves the economic events are distinct.
14. False GREEN is worse than RED. Ambiguous reconciliation fails closed.

---

## 3. WHAT PR #593 PUT INTO PRODUCTION CODE

PR #593 integrated the cumulative work previously developed through the stacked sequence #588 → #589 → #590 → #591 → #592.

### 3.1 Canonical Ledger becomes sole monthly recognition authority

Origin: former PR #588.

Production architecture now includes:

- `reporting/canonical-earned-income-view.mjs`
- hardened `reporting/income-ledger.mjs`
- monthly reports projected from Canonical Income Ledger recognition rather than inventing reward-delta income locally
- explicit recognized / settlement-only / unresolved lifecycle semantics
- incomplete coverage stays `generatedIncomeUsd = null`
- Reference model remains separate secondary analytics
- verified Defitea historical realised archive remains retained

Monthly reporting is a **projection**, not a second accounting engine.

### 3.2 Frax / veFRAX factual accrual

Origin: former PR #589.

Existing Company Rewards already tracks every `frax-yield` company wallet and current `YieldDistributor.earned(account)` state. The accounting layer adds the missing factual interval boundary.

Canonical reconciliation:

`new earned = closing YieldDistributor.earned + proven YieldCollected settlements - opening YieldDistributor.earned`

Semantics:

- opening balance creates no income;
- earned-but-unclaimed income is recognized when earned;
- claim/reset cannot erase previously earned income;
- claim is settlement, never second income;
- negative/ambiguous reconciliation fails closed;
- historical interval containing a claim requires exact enough boundary evidence;
- later WFRAX price movement does not rewrite closed USD income;
- Reference APR/APY is never the income authority.

Declared full-accounting target boundary: **2026-09-01T00:00:00.000Z**.

### 3.3 Aerodrome / Velodrome direct/free/rebase factual accrual

Origin: former PR #590.

Reusable ve(3,3) accounting covers:

- direct veNFT voting fee/incentive reward lanes using `Reward.earned(token, tokenId)`;
- direct veNFT rebase distribution using `RewardsDistributor.claimable(tokenId)`;
- managed `FreeManagedReward` entitlement;
- exact claim/reset reconciliation where tokenId attribution is provable.

Voting/free reward formula:

`new earned = closing Reward.earned + proven ClaimRewards settlements - opening Reward.earned`

Rebase formula:

`new earned = closing RewardsDistributor.claimable + proven Claimed settlements - opening RewardsDistributor.claimable`

The critical ClaimRewards problem was solved fail-closed: the event itself does not contain tokenId, therefore settlement is counted only where tokenId can be recovered from the direct reward call or Voter `claimFees/claimBribes` transaction semantics. Unresolved attribution is not guessed.

### 3.4 LockedManagedReward / Relay compounded accrual

Origin: former PR #591.

The managed/Relay mechanism was proven as a distinct factual earned-income lane.

Recognition formula:

`new earned = closing LockedManagedReward.earned + proven withdrawManaged settlement - opening LockedManagedReward.earned`

Durable semantics:

- compounded locked AERO/VELO is economically earned before withdrawal when exact managed identity is proven;
- `withdrawManaged()` returns accumulated value into the veNFT and is settlement, not a second income event;
- gross veNFT principal delta is never itself income authority;
- external principal additions are not inferred as income;
- specific internal evidence may retain a mechanism-specific family, while Canonical Ledger normalizes admitted compounded income to its existing `embedded-income` family without losing `mechanismKind` / source semantics.

### 3.5 ve(3,3) bounded production runtime

Origin: former PR #592.

The first broad implementation could consume approximately 8–9.5 minutes on public RPC and therefore approached the full Reporting writer budget by itself.

The final production design does **not** repeatedly scan every historical cached reward contract. It reuses the existing Rewards operational radar:

- current voted pools;
- recent voted pools;
- persistent reward index;
- exact positive reward rows / current state;
- shared owner/token metadata caches;
- bounded concurrency;
- protocol-level historical-boundary capability probes.

This changed the live accounting set from thousands of stale candidate reads to the operationally relevant lanes.

Latest exact pre-merge live Base + Optimism canary on the integration head proved:

- **385 operational accounting lanes**;
- **385 factual current checkpoints**;
- Aerodrome: **146 / 146 factual current checkpoints, 0 current-state failures**;
- Velodrome: **239 / 239 factual current checkpoints, 0 current-state failures**;
- total runtime approximately **64 seconds**;
- historical September boundary unavailable through the configured/public RPC remained explicit `partial`, not estimated.

Production default `VE33_STATE_READ_CONCURRENCY` was bounded to 2 after Base public RPC retry-limit evidence.

---

## 4. CI / INTEGRATION PROOF BEFORE MERGE

Fresh-main integration PR #593 was created directly against live `main` because the historical stack had become several commits behind automatic Market Data / Security / Memory updates.

This avoided serially merging stale stacked bases.

Before merge, the fresh-main integration suite was GREEN for the relevant checks, including:

- Verify Frax Factual Accounting;
- Verify ve33 Factual Accounting;
- Verify ve33 Locked Managed Accounting;
- Verify Reporting Layer;
- Verify Company Monthly Reports;
- Workflow Control Plane;
- Repository Hygiene Guard;
- Commit Identity Privacy Guard;
- Public Surface Privacy Guard;
- Project Memory bootstrap contract;
- Project Memory continuity routing.

Important recovery lesson: an earlier Project Memory RED on #589 was **not** an accounting defect. The committed `CURRENT.md` had become stale relative to newer Security/Cognitive source artifacts. On the fresh-main integration PR, Project Memory continuity routing returned GREEN.

General law preserved: **GREEN workflow != physically materialized production artifact**. PR-level live canaries prove code behavior; a production writer artifact must still be verified separately after merge.

---

## 5. POST-MERGE PRODUCTION MATERIALIZATION — EXACT STATE

### 5.1 Company monthly reports

Post-merge automation already updated:

`reporting/company-monthly-reports.json`

Current observed header at checkpoint creation:

- version: `0.4-company-monthly-earned-income-accounting`
- methodologyVersion: `0.4-canonical-ledger-sole-income-recognition-authority`
- generatedAt: `2026-09-02T19:28:25.390Z`
- Canonical Income Ledger version: `0.1-canonical-income-ledger`
- Ledger status: `partial`
- `crossFamilySummationForbidden: true`
- `unknownIsNotZero: true`
- `referenceIncomeIsEarnedIncomeAuthority: false`

The monthly layer no longer manufactures earned income from generic reward snapshot changes.

### 5.2 Current factual evidence artifact caveat

At this checkpoint, code is merged and the pre-merge live canaries are proven GREEN, **but the committed production evidence seed files have not yet recorded their first live post-merge checkpoint**:

- `reporting/frax-yield-accounting-evidence.json` — `generatedAt: null`, status `bootstrap-no-income`, checkpoints empty;
- `reporting/ve33-accounting-evidence.json` — `generatedAt: null`, status `bootstrap-empty`, checkpoints empty;
- `reporting/ve33-locked-managed-accounting-evidence.json` — `generatedAt: null`, status `bootstrap-empty`, checkpoints empty.

This distinction is essential:

**production code merged ≠ first production factual evidence materialized.**

Do not infer that Frax/Aero/Velo income is zero from these bootstrap files. Their current correct interpretation is **not yet materialized / unknown**, not zero.

The next chat must verify the first post-merge `Update The Holding Reporting Data` materialization before claiming these adapters are physically publishing persistent checkpoints.

---

## 6. WHAT IS CLOSED VS WHAT IS STILL OPEN

### CLOSED / production code integrated

- Canonical Income Ledger sole monthly recognition authority.
- Monthly generic reward-delta income synthesis removed.
- Frax veFRAX factual reconciliation logic.
- Aerodrome/Velodrome direct voting/free reward factual reconciliation.
- Aerodrome/Velodrome direct rebase factual reconciliation.
- Managed FreeManagedReward accounting.
- LockedManagedReward / Relay compounded accounting semantics.
- ve(3,3) public-RPC runtime hardening.
- operational reward-pool scoping that reuses the existing Rewards radar.
- relevant fresh-main CI / memory / security gates.
- post-merge monthly report schema/methodology migration to v0.4.

Historical stacked PRs #588, #589, #590, #591 and #592 were closed as superseded by merged #593. Stale diagnostic PR #581 was also closed because merged #583 already superseded it. Branches/history were not deleted or rewritten.

### STILL OPEN / must not be falsely closed

1. **First production materialization of Frax + ve33 evidence files.**
2. Historical September 1 archive boundary remains unavailable through the tested public/configured RPC path; history stays partial rather than estimated.
3. **40 Acres payout non-overlap** is not yet proven. The USDC portfolio payout is an aggregate settlement and must not be added on top of underlying veVELO accrual unless exact lifecycle non-overlap is proven.
4. Yield Basis FeeDistributor factual accrual is not yet implemented in Canonical Income Ledger.
5. Remaining productive mechanisms must be completed mechanism by mechanism and measured through coverage before any claim of 100% accounting completeness.
6. A second factual checkpoint is required before cumulative-entitlement mechanisms can produce a normal forward interval event when no exact historical opening boundary is available.

---

## 7. NEXT EXACT RESUME ORDER

A new chat should **not** rediscover Frax/Aerodrome/Velodrome protocol mechanics from scratch.

Resume in this order:

### Step 1 — fresh live truth

Read:

1. live `intelligence/project-memory/CURRENT.md`;
2. this continuity;
3. `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;
4. fresh `main` head;
5. latest Reporting workflow/run evidence;
6. current `reporting/frax-yield-accounting-evidence.json`;
7. current `reporting/ve33-accounting-evidence.json`;
8. current `reporting/ve33-locked-managed-accounting-evidence.json`;
9. current `reporting/income-ledger.json` and `reporting/company-monthly-reports.json`.

### Step 2 — prove physical production materialization

Check whether the first post-merge Reporting writer has populated the three factual evidence artifacts.

If not populated:

- diagnose trigger/run/publish wiring first;
- do not rewrite the already-GREEN accounting math;
- do not create another writer;
- use the existing `update-reporting.yml` cascade and its paired definition proof;
- preserve fail-closed semantics.

If populated:

- verify factual checkpoint counts and generatedAt freshness;
- verify Canonical Ledger sourceState points to the new evidence;
- verify monthly report projection remains v0.4 and does not synthesize income itself.

### Step 3 — establish forward interval accumulation

Because exact 2026-09-01 archive state is unavailable on tested public RPC, the system is designed to accumulate factual current checkpoints forward. Verify that a subsequent Reporting run creates valid factual intervals without reopening the historical boundary or treating the opening checkpoint as income.

### Step 4 — Yield Basis FeeDistributor

Next preferred factual mechanism after production materialization proof:

**Yield Basis FeeDistributor**.

Existing Rewards already calls:

`FeeDistributor.preview_claim(receiver, epoch_count, use_vest)`

The intended reuse-first pattern is analogous to Frax cumulative entitlement:

`closing preview_claim + proven Claim settlement - opening preview_claim`

Requirements before admission:

- verify official exact Claim event/function semantics and token identity;
- reconcile each reward token independently;
- opening claimable balance is baseline only;
- claim is settlement, not second income;
- freeze USD at accounting boundary;
- no APR income authority;
- no second Yield Basis tracker.

### Step 5 — remaining mechanisms + measured coverage

After YB, continue only through demonstrated mechanism gaps. Then make Accounting Coverage an explicit measured diagnostic across company × mechanism × month.

Do not claim 100% until the coverage evidence proves it.

---

## 8. NEW-COMPANY REUSE TARGET

The target remains that a future Company #011 using already-supported mechanisms should require primarily:

- company identity;
- wallet(s);
- position/route mapping;
- presentation metadata.

Existing collectors + accounting adapters should then automatically produce factual ledger evidence, monthly reporting and Passport consumption.

New mechanism code is justified only for a genuinely new economic mechanism or missing evidence shape.

This is the standard of maturity for the accounting fabric: capability should be reusable at mechanism level, not copied company by company.

---

## 9. OWNER COLLABORATION / MERGE AUTHORITY — CURRENT CLARIFICATION

The owner explicitly reconfirmed on 2026-09-02 that routine low-risk GREEN repository PRs may be merged autonomously by the working model without asking for per-PR approval every time.

Ask the owner separately only at material risk boundaries such as:

- capital movement / wallet signing / transaction execution;
- material execution-authority expansion;
- security-policy weakening or sensitive trust-boundary changes;
- methodology changes that materially alter economic meaning;
- destructive/irreversible repository operations;
- ambiguous high-consequence production changes.

This matches the standing bounded routine merge flow already carried by CURRENT.

Historical phrase retained for continuity compatibility: `generic implementation permission != merge permission` described an older narrower operating state and must not be misread as the current routine-merge rule. The newer explicit owner instruction above supersedes it for ordinary low-risk verified repository work.

No force-push, history rewrite or destructive cleanup was used in this accounting campaign.

---

## 10. PROJECT / MEMORY INHERITANCE MARKERS — DO NOT DROP

This new latest continuity must retain critical inherited project truths so the minimum-recovery verifier and future chats do not accidentally narrow The Holding to the accounting campaign alone.

### PROJECT X + HYPERLEND CLOSED

The earlier Company #010 / Project X + HyperLend production campaign remains closed precedent. Preserve:

- `resolver completeness != promotion completeness`;
- `HyperLend base lending interest = Compounded / Embedded`;
- external incentives remain a separate lane;
- `rewardAssetCount = 0` means no reward assets were discovered in that exact proof state, not a universal protocol law;
- known-mechanism reuse and company passport inheritance remain the preferred onboarding architecture.

### Market Data inheritance

The Market Data / onchain authority campaign remains durable closed precedent:

- canonical reviewed onchain-primary set: **26/26**;
- provenance remains `per-asset-authority`;
- CoinGecko remains the controlled fallback/baseline lane, not an excuse to overwrite stronger onchain authority;
- divergence is telemetry, not automatic failure;
- PR #227 and PR #233 remain historical proof anchors from that campaign;
- historical closure marker: `Market Data / onchain tracking: fat check`.

Current prices and route health must always be read live rather than from this continuity.

### Learning / intelligence inheritance

- **Autonomous Observational / World Learning** remains the primary continuous learning lane.
- **Owner Decision → Outcome Experience** remains the sparse complementary experience lane.
- observations/patterns do not self-promote into causal truth, policy or execution authority.

### Pendle inheritance

`Pendle / sPENDLE` remains part of the broader protocol intelligence system. Do not infer its current economic state from this accounting checkpoint; route to current live protocol evidence when it becomes the task.

### Production truth inheritance

`GREEN workflow != physically materialized production artifact` remains a hard system law.

---

## 11. MINIMUM RECOVERY PACKET

For a new substantive chat, the **Minimum recovery packet** is:

1. live `CURRENT.md`;
2. this latest master continuity;
3. `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;
4. then only the task-specific canon/live artifacts/exact evidence required by the current objective.

For accounting continuation specifically, the files in Section 7 are the hot evidence set. Do not load every historical accounting PR/checkpoint unless diagnosing provenance.

---

## 12. SAFETY / AUTHORITY BOUNDARY

Current accounting authority remains:

- executionAuthority: **none**
- wallet authority: **none**
- signing authority: **none**
- claiming authority: **none**
- capital execution: **false**
- autonomous methodology mutation: **none**

Accounting observes, reconciles, records and reports. It does not move capital.

---

## 13. ONE-SENTENCE RESUME

**The canonical factual-income architecture through Frax + Aerodrome/Velodrome direct/free/rebase + LockedManaged/Relay is merged in production code via #593; monthly reporting has migrated to Canonical-Ledger-only recognition, but the first persistent Frax/ve33 evidence materialization must be verified next before moving on to Yield Basis FeeDistributor and the remaining measured mechanism coverage.**
