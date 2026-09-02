# The Holding Accounting Fabric Checkpoint — 2026-09-02

Status: WORK IN PROGRESS / READ-ONLY PRODUCTION / NO MERGE AUTHORITY

## Resume point

Fresh live `main` observed during this work: `fd2259efad879c4f8146617582bc1fb67cade4f2` (`market data: refresh shared public snapshot`, 2026-09-02T15:19:48Z).

Open architectural hardening PR: #588 `Accounting: make Canonical Ledger the sole monthly income authority`.
Branch: `accounting/canonical-ledger-sole-monthly-authority-v0-1`.
Pre-checkpoint head: `2764df5fe800bbe352ebc80c271b2ab1ea6484c9`.
PR is open, mergeable, not merged. Core checks were GREEN before this checkpoint commit.

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

## Work completed immediately before this checkpoint

1. ICP NNS factual accounting was merged earlier and is source/evidence driven; first baseline does not fabricate history.
2. Votium Union factual accrual adapter was merged earlier and materialized into Canonical Income Ledger / September monthly reports.
3. PR #588 hardens monthly accounting so Canonical Ledger is the sole authority; generic reward-delta recognition is removed from the monthly consumer; accrued entitlement and accepted embedded intervals remain earned; generic realised receipts fail closed without mechanism-specific non-overlap proof.
4. Monetra `sfrxUSD` does NOT need a new tracker: Stable Capital already records daily flow-aware embedded-yield intervals. Accepted Frax/sfrxUSD intervals already have canonical factual income semantics and can feed the Canonical Income Ledger through the existing embedded-yield path.
5. Separate `veFRAX / frax-yield` remains the current Frax gap. Rewards collector already reads Fraxtal `YieldDistributor.earned(account)` and records current claimable WFRAX state for multiple company wallets. Canonical ledger also retains historical claimable snapshots; these are state-only and are not themselves period-income authority.

## Frax / veFRAX accounting boundary established

For Frax YieldDistributor, current `earned(account)` is accumulated entitlement. Claim/reset can make current `earned()` fall even though income was earned during the interval. Therefore the reusable factual interval must be claim-aware:

`earnedDuringWindow = closingEarned + provenYieldCollectedDuringWindow - openingEarned`

Admission rules:
- opening balance is baseline only and is never automatically income;
- admit only positive, evidence-backed earned amount inside the observation window;
- detect/attribute `YieldCollected` settlement events inside the exact window so claims do not erase accrual;
- claim itself is settlement, not a second income recognition;
- freeze USD valuation when the earning interval is admitted;
- fail closed if the exact interval or settlement relationship cannot be proven.

## Next implementation step

Build a reusable Frax YieldDistributor accounting adapter, modeled after Votium Union but using existing Frax Rewards/source truth. Prefer reuse of existing route identity / company-wallet mapping. Do not alter Rewards UI semantics. Wire admitted Frax accrual events into Canonical Income Ledger, add deterministic fixtures/validation and workflow preflight, then verify monthly projection through PR #588 semantics.

After Frax: Aerodrome/Velodrome factual mechanisms, then measured mechanism-level Accounting Coverage + freshness/timestamp. Do not announce 100% accounting coverage until measured evidence supports it.

## Safety / change authority

- `main` protected; do not write directly to main.
- no deletion, force-push, history rewrite, wallet execution, claim, capital movement or destructive action;
- work via branches/PRs and fail-closed tests;
- do not merge PRs or perform serious production-impacting changes without fresh explicit owner approval;
- if live main or evidence disagrees with this checkpoint, live production evidence wins.
