# The Holding · Realised Cash Flow Foundation v0.1

## Purpose

`Realised Cash Flow` is a distinct economic primitive. It must never be inferred from Reference APR, Embedded Yield, current claimable rewards, wallet balance changes, or generic withdrawals.

The first release is deliberately an accounting/evidence foundation. It defines what may and may not enter a realised-cash-flow ledger before any broad historical wallet classifier is allowed to publish numbers.

## Canonical economic separation

- **Reference APR / APY** — current normalized productive capacity.
- **Embedded Yield** — economic value accrued inside a wrapper / PPS / position.
- **Accrued Rewards** — protocol-side earned but not yet received at the company boundary.
- **Realised Cash Flow** — economic income actually received at the company boundary with evidence that distinguishes it from principal and internal movement.
- **Treasury** — freely held capital. Treasury balance is not itself evidence of income.

These surfaces may reconcile economically, but they are not interchangeable measurement planes.

## Core rule

A transaction or transfer may be counted as `realised-income` only when evidence proves **both**:

1. value crossed into the company economic boundary; and
2. the value is income rather than contributed principal, returned principal, borrowing, swap output, wrapper redemption, bridge settlement, or another internal capital movement.

If either condition is missing, the event is not realised income.

## Boundary-flow classification

Every candidate receipt belongs to exactly one accounting class:

- `realised-income` — protocol-attributed reward / fee / interest distribution received by the company, with sufficient semantic evidence;
- `contribution` — owner or external capital added to the company boundary;
- `distribution` — capital leaving the company boundary for an external owner / recipient;
- `internal-move` — movement among known company wallets, custody contracts, protocols, bridges, wrappers, strategies, or equivalent internal economic locations;
- `principal-return` — withdrawal / redemption returning previously deployed capital; not income unless the income component can be separately proved;
- `borrowed-capital` — loan proceeds or equivalent liabilities entering the boundary;
- `unknown` — evidence is insufficient to classify safely.

Only `realised-income` contributes to the Realised Cash Flow total.

## Explicit non-rules

The following are **never sufficient by themselves** to prove realised income:

- ERC-20 `Transfer` into a company wallet;
- native-token receipt;
- protocol `withdraw`;
- vault `redeem`;
- LP removal;
- stablecoin swap output;
- bridge receipt;
- claimable balance decreasing;
- company wallet balance increasing;
- a positive change in NAV;
- current APR / APY;
- owner assertion without transaction evidence.

A generic `claim` method name is also not sufficient unless the protocol semantics establish what is being claimed.

## Evidence tiers

### Tier A — protocol-attributed payout

Strongest initial lane. Required evidence:

- canonical protocol contract / documented payout mechanism;
- exact onchain event or state transition with explicit reward / fee / income semantics;
- company beneficiary identity;
- asset and amount;
- chain, transaction hash and unique event identity;
- no contradictory evidence that the same value is principal or internal movement.

Tier A can publish `realised-income` without whole-wallet heuristics.

### Tier B — reconstructed economic payout

Allowed later only when several exact records jointly prove the income component, for example:

`wrapper redemption + historical cost basis + exact redeemed value → principal return + realised income`

If the split cannot be proved, classify `principal-return` or `unknown`, never the entire redemption as income.

### Tier C — generic wallet flow

Discovery evidence only. It may create a candidate but cannot publish `realised-income` by itself.

## Yield Basis first-adapter rationale

The canonical Yield Basis `FeeDistributor` source defines:

`event Claim(user, token, amount)`

and emits it after transferring the claimed token in `_claim`.

That is materially stronger than observing an arbitrary incoming ERC-20 transfer. A future Yield Basis adapter may therefore normalize this exact event as Tier A payout evidence after beneficiary and dedupe checks.

Current The Holding Rewards already uses `FeeDistributor.preview_claim(...)` only for **unclaimed** rewards. A historical `Claim` event belongs to a different economic plane and must not be double-counted as current accrued rewards.

## Identity and boundary

A company boundary is a versioned set of known economic identities:

- direct company wallets;
- explicitly recognized company-controlled operational wallets;
- protocol custody / wrappers only where ownership attribution is deterministic.

An adapter must state which identity was beneficiary and why it belongs to the company.

## Deduplication

Canonical event identity:

`chainId : transactionHash : logIndex : adapterId`

If an adapter also observes the ERC-20 `Transfer` generated by the same payout transaction, that Transfer is supporting evidence, not a second cash-flow row.

Cross-adapter collisions must fail review rather than sum silently.

## Valuation

Token quantity is the primary factual amount.

Historical USD valuation is a separate field and may be:

- `exact-stable-nominal` — canonical stable unit at receipt;
- `historical-price` — timestamp/block-bound external or onchain price evidence;
- `not-valued` — quantity is measured but historical USD evidence is not yet sufficient.

A missing historical USD price does not erase a real token payout. It does prevent publication of a fabricated USD total.

## Status model

Per company:

- `measured` — all in-scope adapters are complete for the declared horizon;
- `partial` — at least one exact payout lane is measured but economic coverage is incomplete;
- `unknown` — no supported payout lane has sufficient evidence;
- `blocked` — contradictory / unsafe evidence prevents publication.

System-level status must describe coverage, not imply that every protocol has historical payout support.

## Learning boundary

Synthetic fixtures, parser failures and classification tests are Conversation / verification evidence. They do not enter Founder Decision DNA or capital Decision Experience automatically.

Real payout observations may become economic memory only after deterministic normalization and independent review.

## Authority

This layer observes and classifies evidence only.

- model calls: none required;
- wallet signing: none;
- claiming: none;
- transactions: none;
- capital movement: none;
- executionAuthority: `none`.
