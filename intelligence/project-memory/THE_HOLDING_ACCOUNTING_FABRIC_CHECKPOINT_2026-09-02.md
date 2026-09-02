# The Holding Accounting Fabric Checkpoint — 2026-09-02

Status: WORK IN PROGRESS / READ-ONLY PRODUCTION / NO MERGE AUTHORITY

## Resume point

Fresh live `main` observed during this work: `fd2259efad879c4f8146617582bc1fb67cade4f2` (`market data: refresh shared public snapshot`, 2026-09-02T15:19:48Z). Always re-check live `main` before production conclusions.

Open architectural hardening PR: #588 `Accounting: make Canonical Ledger the sole monthly income authority`.
Branch: `accounting/canonical-ledger-sole-monthly-authority-v0-1`.
Checkpoint/base head: `398dbd1822173dd040dd93ad43aecb2e3657e712`.
PR is open, mergeable, not merged.

Open stacked Frax PR: #589 `Accounting: admit Frax veFRAX factual accruals`.
Branch: `accounting/frax-yield-factual-accrual-v0-1`.
Latest verified pre-checkpoint code head: `08afcc554c71bace626ff289165d3276a6181cfe`.
PR #589 targets the #588 branch, not `main`, and is not merged.
At `08afcc...` all five relevant PR checks were GREEN: Frax Factual Accounting, Verify Reporting Layer, Workflow Control Plane, Repository Hygiene Guard, Commit Identity Privacy Guard.

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
- partial historical months must remain explicitly incomplete rather than fabricated or backfilled from APR.

## Architecture target

`protocol/source collectors -> mechanism-specific accounting evidence/adapters -> Canonical Income Ledger -> canonical earned-income view -> company monthly reports -> passports / yield reports / future consumers`

The monthly layer must not invent new income from generic reward snapshot deltas. One accounting foundation, many consumers.

New company onboarding target: if Company #011 uses already-supported mechanisms, onboarding should be identity/wallet/position mapping only. Existing collectors and accounting adapters should automatically supply the monthly report. New code is required only for genuinely new economic mechanisms/evidence shapes.

## Work completed

1. ICP NNS factual accounting was merged earlier and is source/evidence driven; first baseline does not fabricate history.
2. Votium Union factual accrual adapter was merged earlier and materialized into Canonical Income Ledger / September monthly reports.
3. PR #588 hardens monthly accounting so Canonical Ledger is the sole authority; generic reward-delta recognition is removed from the monthly consumer; accrued entitlement and accepted embedded intervals remain earned; generic realised receipts fail closed without mechanism-specific non-overlap proof.
4. Monetra `sfrxUSD` does NOT need a new tracker: Stable Capital already records daily flow-aware embedded-yield intervals. Accepted Frax/sfrxUSD intervals already have canonical factual income semantics and feed the Canonical Income Ledger through the existing embedded-yield path.
5. Frax `veFRAX / frax-yield` is now implemented in stacked PR #589 using existing Rewards source truth rather than a parallel tracker.
6. Existing Rewards collector continues to own Passport/current-state semantics; Frax accounting does not change the Rewards UI contract.
7. A stale Reporting CI assumption discovered by #589 was hardened: VoteMarket import parity is now mechanism-specific (`sourceFamily=voteMarketEvents` + exact canonical event keys), so other accrued-entitlement mechanisms such as Union/Frax do not collide with the test.

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

## Current next step — Aerodrome / Velodrome

Do not repeat a protocol-wide rediscovery. Start from the already-production Rewards engine and classify the existing source truth by economic mechanism.

Known live Rewards capabilities already present:
- Aerodrome/Velodrome direct veNFT state;
- `RewardsDistributor.claimable(tokenId)` rebase component;
- current voted-pool reward contracts plus bounded recent vote-history discovery;
- managed/Relay positions via `idToManaged`;
- `LockedManagedReward.earned(baseToken, tokenId)` for compounded/locked base-token rewards;
- FreeManagedReward / voting reward enumeration for claimable fee/incentive legs;
- Defitea Velodrome 40 Acres holder discovery, with already-distributed wallet payouts kept outside accrued-reward state;
- existing per-company wallet/route mapping in Rewards.

Accounting task: reuse these facts and build mechanism adapters / evidence boundaries, not another tracker. Separate at least cumulative claimable entitlement, compounded-locked/embedded earning, and realised settlement where economically distinct. Preserve one-time recognition and frozen USD semantics. Prefer extracting generalized reusable accounting patterns from Frax where the source behaves like cumulative entitlement + claim reset.

After Aero/Velo: continue remaining productive mechanisms, then measured mechanism-level Accounting Coverage + freshness/timestamp. Do not announce 100% accounting coverage until measured evidence supports it.

## Safety / change authority

- `main` protected; do not write directly to main;
- no deletion, force-push, history rewrite, wallet execution, claim, capital movement or destructive action;
- work via branches/PRs and fail-closed tests;
- do not merge #588, #589, or future accounting PRs and do not perform serious production-impacting changes without fresh explicit owner approval;
- if live main or evidence disagrees with this checkpoint, live production evidence wins.
