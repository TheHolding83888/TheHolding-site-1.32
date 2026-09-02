# The Holding Accounting Fabric Checkpoint — 2026-09-02

Status: WORK IN PROGRESS / READ-ONLY PRODUCTION / NO MERGE AUTHORITY

## Resume point

Fresh live `main` observed after the previous checkpoint: `8e18e469e9fb7617c7afa601de50bc99eac58d43` (`memory: refresh current project bootstrap`, 2026-09-02T16:40:19Z). Its parent is `fd2259efad879c4f8146617582bc1fb67cade4f2`. Always re-check live `main` before production conclusions because autonomous data/memory writers can advance it.

Open architectural hardening PR: #588 `Accounting: make Canonical Ledger the sole monthly income authority`.
Branch: `accounting/canonical-ledger-sole-monthly-authority-v0-1`.
Checkpoint/base head: `398dbd1822173dd040dd93ad43aecb2e3657e712`.
PR is open, mergeable, not merged.

Open stacked Frax PR: #589 `Accounting: admit Frax veFRAX factual accruals`.
Branch: `accounting/frax-yield-factual-accrual-v0-1`.
Previous fully verified code head: `08afcc554c71bace626ff289165d3276a6181cfe`.
Previous checkpoint head: `34ee7e753c0adc74a111898a69f85d0b3fbf74c5`.
PR #589 targets the #588 branch, not `main`, and is not merged.
At `08afcc...` all five relevant PR checks were GREEN: Frax Factual Accounting, Verify Reporting Layer, Workflow Control Plane, Repository Hygiene Guard, Commit Identity Privacy Guard.

This checkpoint commit only updates project memory. It does not change production accounting logic, collectors, wallet state, `main`, or merge state.

## Owner-facing accounting canon

The owner-facing monthly report has one primary number per company per calendar month: USD earned income.

Rules:
- recognize economic income when it is earned, not when it is later claimed;
- include earned-but-unclaimed entitlement;
- include accepted embedded/auto-compounded yield;
- include direct protocol receipts only when they are proven first recognition of income rather than settlement of earlier accrual;
- freeze USD value at canonical recognition time; later token price movement must not rewrite closed monthly earned income;
- current rewards balances and their current USD valuation remain a separate state surface in Company Passports;
- TVL / asset P&L / market revaluation are separate from Monthly Earned Income;
- opening/pre-baseline claimable balances are not income of the first tracked month;
- partial historical months must remain explicitly incomplete rather than fabricated or backfilled from APR;
- changing economic form does not create a second income event: accrued -> claimed -> received -> compounded/locked/held is a lifecycle, not repeated income;
- all productive mechanisms count if factual evidence proves the earning inside the month, regardless of token, claim state, or whether the value remains inside the protocol.

## Architecture target

`protocol/source collectors -> mechanism-specific accounting evidence/adapters -> Canonical Income Ledger -> canonical earned-income view -> company monthly reports -> passports / yield reports / future consumers`

The monthly layer must not invent new income from generic reward snapshot deltas. One accounting foundation, many consumers.

New company onboarding target: if Company #011 uses already-supported mechanisms, onboarding should be identity/wallet/position mapping only. Existing collectors and accounting adapters should automatically supply the monthly report. New code is required only for genuinely new economic mechanisms/evidence shapes.

Cadence target:
- underlying sensors keep mechanism-appropriate cadence (daily heartbeat, epoch-aware, or event-aware where appropriate);
- accounting evidence is rebuilt when canonical source truth updates, with a daily fallback;
- monthly reports are projections of Canonical Income Ledger, not independent calculators.

## Work completed

1. ICP NNS factual accounting was merged earlier and is source/evidence driven; first baseline does not fabricate history.
2. Votium Union factual accrual adapter was merged earlier and materialized into Canonical Income Ledger / September monthly reports.
3. PR #588 hardens monthly accounting so Canonical Ledger is the sole authority; generic reward-delta recognition is removed from the monthly consumer; accrued entitlement and accepted embedded intervals remain earned; generic realised receipts fail closed without mechanism-specific non-overlap proof.
4. Monetra `sfrxUSD` does NOT need a new tracker: Stable Capital already records daily flow-aware embedded-yield intervals. Accepted Frax/sfrxUSD intervals already have canonical factual income semantics and feed the Canonical Income Ledger through the existing embedded-yield path.
5. Frax `veFRAX / frax-yield` is implemented in stacked PR #589 using existing Rewards source truth rather than a parallel tracker.
6. Existing Rewards collector continues to own Passport/current-state semantics; Frax accounting does not change the Rewards UI contract.
7. A stale Reporting CI assumption discovered by #589 was hardened: VoteMarket import parity is mechanism-specific (`sourceFamily=voteMarketEvents` + exact canonical event keys), so other accrued-entitlement mechanisms such as Union/Frax do not collide with the test.
8. Detailed Aerodrome/Velodrome source and official-contract semantics audit has now been completed far enough to define the next accounting adapters without inventing another tracking layer. No Aero/Velo accounting code has been committed yet as of this checkpoint.

## Frax / veFRAX factual accounting — GREEN candidate

Existing source truth reused:
- Company Rewards already resolves every tracked `frax-yield` company wallet;
- Rewards reads Fraxtal `YieldDistributor.earned(account)` and emitted reward token state;
- route-level `walletResults` preserve successfully measured wallets even when current reward is zero;
- prior Canonical Income Ledger `claimableSnapshots` provide state-only historical bootstrap points.

Official Frax contract semantics confirm that a claim checkpoints earned state, transfers the reward and resets stored yield. Therefore PR #589 uses:

`earnedDuringWindow = closingEarned + provenYieldCollectedDuringWindow - openingEarned`

Implemented invariants:
- opening balance creates no income;
- unclaimed accrual counts when earned;
- `YieldCollected` inside the interval is settlement evidence and prevents claim/reset from erasing earned income;
- claim never creates a second income event;
- zero-new-income intervals create no event;
- negative/ambiguous reconciliation fails closed;
- historical intervals containing a claim require exact block-tagged endpoints;
- September 1, 2026 is the declared full-accounting target boundary; older available history is partial/bootstrap-only unless evidence proves the interval;
- USD valuation freezes at the admitted closing accounting boundary;
- later WFRAX price movement does not rewrite closed monthly income;
- Reference APR/APY is not income authority;
- execution/wallet/claiming/capital authority remains `none`.

Key PR #589 files:
- `reporting/frax-yield-accounting-evidence.mjs`
- `reporting/frax-yield-accounting-evidence-validation.mjs`
- `reporting/frax-yield-ledger-validation.mjs`
- `reporting/frax-yield-accounting-evidence.json`
- `reporting/income-ledger.mjs`
- `.github/workflows/update-reporting.yml`
- `.github/workflows/verify-frax-yield-accounting.yml`
- `intelligence/reliability/reporting-scheduler-workflow-definition-proof.mjs`

## Aerodrome / Velodrome — production source truth already available

Do NOT build another Aero/Velo tracker. `rewards/company-rewards-engine.mjs` already contains the production sensing fabric needed for the accounting work.

Current company routing already includes:
- `05081966.eth`: `aerodrome-relay`;
- `YieldRing.eth`: `aerodrome-relay`;
- `defitea.eth`: `aerodrome-ve` + `velodrome-ve` plus many other mechanisms;
- `0x5860...83CA8.eth`: `aerodrome-ve` + `velodrome-ve-direct`;
- `aerocvxyb.eth`: `aerodrome-ve` + `velodrome-ve-direct` on its Aero/Velo wallet;
- `Rook's portfolio`: `aerodrome-relay`;
- `1milliondollar.eth`: `aerodrome-relay`.

Existing Aerodrome/Velodrome sensor capabilities:
- canonical protocol addresses for VotingEscrow, RewardsDistributor and Voter on Base / Optimism;
- direct veNFT discovery through `ownerToNFTokenIdList`;
- managed/Relay mapping through `idToManaged`;
- `managedToLocked` and `managedToFree` reward contracts;
- direct rebase/emission state through `RewardsDistributor.claimable(tokenId)`;
- direct current voted pools plus bounded recent Voted-log discovery and persistent reward-contract index;
- exact reward-token enumeration from FeesVotingReward / Incentive-or-BribeVotingReward / FreeManagedReward and `earned(token, tokenId)`;
- exact managed locked AERO/VELO state from `LockedManagedReward.earned(baseToken, tokenId)`;
- Defitea 40 Acres Velodrome custody discovery through official PortfolioFactory contracts;
- actual 40 Acres holder address and `custodyContext='40acres'` are preserved on reward rows;
- configured 40 Acres payout token is discovered from portfolio state;
- already-distributed wallet payouts are intentionally excluded from current accrued reward state;
- current reward rows retain token, tokenId, reward contract, reward kind, pool/gauge where applicable, wallet/holder context and USD price metadata.

The production Rewards collector is therefore the sensor/state plane. The accounting work should add only durable interval/event evidence and one-time recognition semantics.

## Aerodrome / Velodrome — economic mechanisms must stay separate

Do not create a protocol-wide `positive rewards delta` adapter. At least these distinct lanes exist:

### Lane A — direct veNFT voting fees / incentives

Source state:
- FeesVotingReward / BribeVotingReward / IncentiveVotingReward `earned(token, tokenId)`;
- exact reward token and exact reward contract are already known by Rewards.

Official Aerodrome Reward contract semantics verified:
- rewards are epoch based (`DURATION = 7 days`);
- `earned(token, tokenId)` computes unclaimed reward since the epoch of `lastEarn[token][tokenId]`;
- `_getReward` reads `earned`, advances `lastEarn[token][tokenId] = block.timestamp`, transfers the reward, and emits `ClaimRewards(recipient, token, reward)`;
- therefore claim/reset can make the current `earned()` state fall to zero even though income was earned in the interval.

Candidate accounting identity must include at least:
`chain + protocol + tokenId + rewardContract + rewardToken`.

Candidate recognition formula is Frax-like:
`earnedDuringWindow = closingEarned + proven ClaimRewards settlements in window - openingEarned`.

Required guards:
- opening state is baseline only;
- claim is settlement, not second income;
- exact `ClaimRewards` event / recipient / token / reward contract relationship must match the tracked tokenId lane;
- if a reset/claim relationship cannot be proven, fail closed rather than infer from a negative delta;
- freeze USD at admitted earning boundary, not at later claim or current token price;
- one reward token on one reward contract is a separate accounting lane; do not collapse different incentive tokens before recognition.

The same core logic should be reusable for Aerodrome and Velodrome because their Reward contract semantics are structurally aligned, while keeping chain/protocol identity explicit.

### Lane B — direct veNFT rebase / emission component

Source state:
- `RewardsDistributor.claimable(tokenId)` in AERO or VELO.

Official Aerodrome and Velodrome RewardsDistributor semantics verified:
- rewards are distributed by weekly cursor;
- `claimable(tokenId)` derives accrued distribution from `timeCursorOf[tokenId]`, veNFT historical balance and `tokensPerWeek`;
- successful `_claim` advances `timeCursorOf[tokenId]` and emits `Claimed(tokenId, epochStart, weekCursor, amount)`;
- on `claim(tokenId)`, if lock is active/permanent, the amount is sent through `VotingEscrow.depositFor(tokenId, amount)` and becomes additional locked veNFT principal; only expired non-permanent locks receive the token directly to owner;
- therefore this economic income can be compounded/locked automatically and must still count when earned;
- a later `Claimed`/deposit is settlement/compounding of already-earned income, not a second earning.

Candidate recognition must therefore be claim-aware and tokenId-specific. Prefer the same cumulative-entitlement reconciliation pattern:
`new earned = closing claimable + proven Claimed amount in interval - opening claimable`,
subject to exact block/event evidence and no ambiguous cursor transition.

Important accounting consequence: do NOT count both the accrued `claimable()` amount and the later increase in veNFT locked balance as two incomes.

### Lane C — managed / Relay LockedManagedReward

Source state:
- `idToManaged(tokenId)` identifies managed custody;
- `managedToLocked(managedTokenId)` gives LockedManagedReward;
- `LockedManagedReward.earned(baseToken, tokenId)` is already collected;
- Rewards labels this `classification='compounded-locked'`.

Official Aerodrome semantics verified:
- LockedManagedReward is specifically documented as storing max-locked rewards / rebases / compounded rewards;
- its reward accounting inherits the same epoch-based `Reward.earned` / `lastEarn` / `ClaimRewards` machinery;
- claim of locked managed reward is restricted to VotingEscrow and is used during managed lifecycle operations such as withdrawal;
- owner-facing economics: this is earned income even while it remains locked/compounded inside the managed veNFT.

Do not model this merely as current token balance or TVL appreciation. Build an accrued-entitlement lane with claim/reset reconciliation and preserve `compounded-locked` settlement state.

Potential extra guard needed before implementation: distinguish externally added principal into a managed lock from `LockedManagedReward` entitlement itself. The source `earned()` is the income lane; gross veNFT principal delta is NOT sufficient accounting evidence.

### Lane D — managed FreeManagedReward

Source state:
- `managedToFree(managedTokenId)`;
- reward tokens enumerated from FreeManagedReward;
- `earned(token, tokenId)` already collected as claimable rewards.

Official contract semantics verified:
- FreeManagedReward pays the current veNFT owner through normal Reward `_getReward` semantics;
- `ClaimRewards` is therefore the settlement event;
- use the same rewardContract + tokenId + rewardToken interval identity and claim-aware accrual reconciliation as direct voting rewards.

### Lane E — Defitea Velodrome through 40 Acres

Source state already exists:
- direct Defitea wallet(s) are checked first;
- official 40 Acres PortfolioFactory mappings discover the actual portfolio holder;
- the same Velodrome reward mechanisms are measured at the actual veNFT holder;
- Rewards attaches `holderAddress`, `custodyContext='40acres'`, `fortyAcresStrategy`, factory and payout-token context;
- current accrued state intentionally excludes already-distributed wallet payouts;
- separate Defitea 40 Acres settlement logic already exists in Reporting for actual received cash flow.

Critical accounting rule:
- do not add a second generic 40 Acres income path;
- protocol-level earned entitlement and actual portfolio payout must be related as lifecycle/settlement where evidence proves they represent the same economic earning;
- if exact non-overlap cannot yet be proven, keep the lane partial/fail-closed rather than sum both;
- the existing Defitea settlement artifact can remain evidence, but Canonical Ledger must decide recognition once.

## Aerodrome / Velodrome — implementation shape for next chat/current work

Preferred design is one reusable `ve(3,3)` factual accounting engine with protocol configuration, not separate copy-paste Aero and Velo implementations.

Conceptual configuration per protocol:
- protocol / chain / chainId;
- VotingEscrow address;
- RewardsDistributor address;
- base token + symbol;
- reward routes (`aerodrome-ve`, `aerodrome-relay`, `velodrome-ve`, `velodrome-ve-direct`);
- supported settlement event signatures and contract roles.

Expected evidence output should preserve mechanism identity rather than only company totals. Candidate keys:
- direct/free voting reward: `company|holder|tokenId|rewardContract|rewardToken`;
- distributor rebase: `company|holder|tokenId|RewardsDistributor|baseToken`;
- locked managed: `company|holder|tokenId|managedTokenId|LockedManagedReward|baseToken`.

Expected interval evidence fields:
- opening checkpoint + exact block/time where possible;
- closing checkpoint + exact block/time;
- opening/closing raw entitlement;
- settlement events inside interval;
- reconciled newly-earned raw amount;
- token decimals/symbol/address;
- frozen USD unit price + valuation source/time;
- company / wallet / actual holder / custody context;
- route / protocol / reward kind / tokenId / managed token id / reward contract;
- evidence status and partial/reconciliation reason;
- `referenceAprUsed=false`;
- `claimIsSecondIncomeEvent=false`;
- `laterPriceMovementRewritesClosedIncome=false`;
- `executionAuthority='none'`.

Historical policy:
- do not fabricate August before a trustworthy baseline;
- September 1, 2026 remains the target full-accounting boundary where exact evidence can support it;
- historical reward state already retained by Canonical Ledger can be bootstrap evidence, but state-only snapshots do not become income by themselves;
- if exact month boundary archive reads or settlement logs are unavailable, mark coverage partial instead of backfilling from Reference APR.

Integration target:
1. read existing `companies/rewards-data.json` source truth;
2. build Aero/Velo mechanism evidence;
3. validate lifecycle deterministically with synthetic fixtures including no-claim, claim/reset, multiple token rewards, zero income, negative/ambiguous reconciliation, managed lock and 40 Acres overlap scenarios;
4. admit only accepted events into `reporting/income-ledger.mjs`;
5. let #588 canonical earned-income projection aggregate them into monthly reports;
6. do NOT alter Passport reward-state semantics unless a separate display bug is found;
7. wire read-only PR verification and production Reporting workflow preflight;
8. keep workflow definition proof paired with any production-writer workflow change.

## Important discoveries / non-actions

- An old branch `feat/aerodrome-epoch-flow-accounting-v0.1` exists but is far behind current `main` and contains no commits ahead of current main. Treat it as historical only; do not revive it as current implementation truth.
- There are several historical Aerodrome sensor/intelligence branches. They may be useful archaeology, but current production Rewards engine is the primary source truth for this accounting task.
- Current `reporting/accounting-coverage.mjs` is diagnostic only. It classifies `aerodrome_veaero` and `velodrome_vevelo` as `accrued-entitlement / governance-rewards`, but `mechanismCompleteForMonth` remains false by design. Do not interpret classification coverage as completed factual accounting coverage.
- No Aerodrome/Velodrome accounting implementation has been committed after the Frax GREEN checkpoint yet. The work after Frax so far is analysis/contract verification only.
- No production/main changes, deletions, wallet actions, claims, capital movements, force-pushes or merges were performed during this Aero/Velo analysis.

## Next exact resume action

1. Re-check live `main` and open PR #588/#589 status.
2. Create a new stacked Aero/Velo accounting branch from the latest safe #589 head unless a newer parallel implementation has appeared.
3. Implement the reusable ve(3,3) evidence core first for one narrow deterministic lane (prefer direct/free Reward.earned + ClaimRewards because official semantics are fully verified), with config for Aerodrome and Velodrome.
4. Add RewardsDistributor rebase lane using `claimable + Claimed - opening` and explicit no-double-count with locked veNFT principal growth.
5. Add managed LockedManagedReward / FreeManagedReward lanes.
6. Integrate 40 Acres only through explicit lifecycle reconciliation with existing settlement evidence; never sum protocol accrued + payout blindly.
7. Wire accepted events into Canonical Income Ledger and verify monthly projection through #588.
8. Run CI and keep all ambiguous evidence partial/fail-closed.
9. After Aero/Velo, continue remaining productive mechanisms, then build truthful measured mechanism-level Accounting Coverage + freshness/timestamp. Do not announce 100% coverage before evidence supports it.

## Safety / change authority

- `main` protected; do not write directly to main;
- no deletion, force-push, history rewrite, wallet execution, claim, capital movement or destructive action;
- work via branches/PRs and fail-closed tests;
- do not merge #588, #589, future Aero/Velo accounting PRs, or perform serious production-impacting changes without fresh explicit owner approval;
- if a proposed action can materially affect production data, methodology, history, wallet/capital state, or remove existing functionality, stop and request owner approval;
- if live main or evidence disagrees with this checkpoint, live production evidence wins.