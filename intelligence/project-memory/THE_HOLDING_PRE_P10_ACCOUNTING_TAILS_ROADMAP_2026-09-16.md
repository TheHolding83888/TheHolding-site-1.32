# THE HOLDING — PRE-P10 ACCOUNTING TAILS ROADMAP
## Owner-approved durable addendum · 2026-09-16

Status: **ACTIVE — P9 materialized GREEN; Tail A GREEN; Tail B ACTIVE**  
Authority: sequencing / recovery context only  
executionAuthority: none

## Purpose

Preserve two bounded follow-up items discovered by the owner on 2026-09-16 so they cannot be lost when chat context rolls over:

1. rare reward-token historical USD valuation tails, with BLUECHIP as the current concrete example;
2. ICP NNS monitoring / unlock / reward-reference-APR refinement for the two ICP onchain companies.

This addendum does not replace the canonical public→private roadmap. Changing truth must still be recovered from live `main` and fresh generated evidence first.

## Sequencing contract

P9 has physically materialized its bounded reliability closure. The current order is now:

1. **Tail A — rare reward-token historical valuation closure — GREEN**;
2. **Tail B — ICP NNS dynamic monitoring / reference-yield refinement — ACTIVE**;
3. proceed to **P10** when Tail B reaches an honest bounded closure.

If Tail B lacks a second factual maturity/reward observation, do not invent one and do not block P10 solely to force a synthetic APR. Preserve the estimate/provenance explicitly and continue once the factual boundary is honest.

---

## Tail A — Rare reward-token historical valuation closure

Status: **GREEN — genuinely unprovable at the current exact historical boundary; no production patch justified.**

### Current concrete case

Company: `aerocvxyb.eth`  
Mechanism: Aerodrome veAERO voting rewards  
Reward token: `BLUECHIP` (`0xB200000000000000000000cFbdF64a8706a94a01`)

Current historical reward observations include:

- veAERO NFT `#64985`: approximately `178.270612668747 BLUECHIP` with historical USD still UNKNOWN;
- veAERO NFT `#69194`: approximately `104.750002204314 BLUECHIP` with historical USD still UNKNOWN;
- aggregate observed BLUECHIP amount: approximately `283.020614873061 BLUECHIP`.

The accounting event/amount/identity is not lost. The unresolved part is historical USD valuation at the required accounting boundary.

### Closure proof · 2026-09-16

Temporary diagnosis-only PR `#847` probed the live current canonical events on a GitHub-hosted runner and was deliberately closed **without merge**.

Exact tested boundary:

- accounting boundary: `2026-09-15T15:53:07.000Z`;
- Base closing block: `51,349,120`;
- unresolved BLUECHIP events: `2` (`#64985`, `#69194`).

Using the current generic exact-block Aerodrome Slipstream route core, the diagnostic tested:

1. `BLUECHIP → native Base USDC` — no proven historical route;
2. `BLUECHIP → AERO` — no proven historical route;
3. `BLUECHIP → WETH` — no proven historical route, so a WETH→USDC→USD continuation was not applicable.

The existing generic historical-price synthetic verification remained GREEN. The diagnostic preserved:

- `currentPriceUsed = false`;
- `stablecoinPegAssumptionUsed = false`;
- no APR/APY inference;
- no production accounting mutation;
- `executionAuthority = none`.

### Decision

Do **not** add BLUECHIP-specific accounting logic, do not backfill with today's price, and do not build an arbitrary recursive router merely to force cosmetic completeness.

Keep the exact token amounts/history in the Canonical Income Ledger and preserve historical USD as explicit `UNKNOWN / unvalued-fail-closed`.

This is a valid Tail A GREEN closure under the P5/PRE-P10 rule: the bounded reusable routes were tested at the exact historical boundary and no defensible route was proven.

Reopen only if fresh evidence later proves a new reusable historical quote class that materially applies beyond this one token.

---

## Tail B — ICP NNS dynamic monitoring / reference-yield refinement

Status: **ACTIVE**

### Owner-provided external monitor evidence

The owner supplied a sequence of ICP NNS monitor messages from `03 Jul 2026` through `14 Sep 2026`.

Useful facts from that channel:

- portfolio stake repeatedly shown as approximately `2,332.73 ICP`;
- 38 active neurons reported in the external monitor;
- old unlock schedule included `03 Aug`, `12 Sep`, `06 Oct`, `08 Nov`, `18 Dec`, each about `61.39 ICP`;
- reward snapshot `21.48 ICP` was shown from early July and then repeated unchanged through September with `Manual refresh required`;
- even after `03 Aug` and `12 Sep`, the external channel continued to present `03 Aug` as the next unlock.

Therefore this external channel is useful as historical owner evidence, but **it is not a factual daily reward-growth series**. The repeated `21.48 ICP` cannot by itself be used to calculate a new observed APR.

### Current repository evidence to re-read live before implementation

As of the 2026-09-16 live snapshot checked when this addendum was written, `companies/icp-nns-rewards-state.json` showed:

- `41/41` public neuron detail coverage;
- total observed stake approximately `2332.7346939 ICP`;
- `36` Dissolving + `5` Dissolved neurons;
- active observed stake approximately `2209.9591837 ICP`;
- the next future unlock in the repository state was `06 Oct 2026`, not the stale August/September dates;
- exact public maturity fields were not exposed (`exactUnstakedMaturityFieldCount = 0`);
- rewards were explicitly in estimated mode: `owner-baseline-plus-canonical-reference-apr-estimate`;
- owner baseline maturity/rewards: `21.48 ICP` dated `2026-07-04`;
- current reference APR approximately `6.57%`;
- allocation was 50/50 across the two ICP companies.

These numbers are a snapshot, not permanent truth; re-read live before changing code or methodology.

### Required work

#### B1 — Unlock/current-state reliability

Verify every owner-facing ICP surface (Passport / reporting / any notification projection) advances with the live public neuron state:

- an already-dissolved/unlocked neuron must not remain shown as the next future unlock;
- next unlock must be computed from current live neuron state rather than a stale manual schedule;
- keep the monitor read-only; no automatic payout/claim authority.

#### B2 — Reward observation provenance

Separate three states clearly:

1. **Factual observed maturity/reward snapshot** — owner/manual or another defensible exact source;
2. **Modeled/reference reward estimate** — derived from reference APR when factual maturity is unavailable;
3. **Unknown** — where neither can be defended.

An estimate must never silently become factual earned-income authority.

#### B3 — Adaptive reference APR only when evidence supports it

If a second genuine maturity/reward snapshot becomes available, compute a trailing observed reference rate from the factual delta and productive stake/time interval, with explicit provenance and confidence.

If there is only one factual snapshot (`21.48 ICP`), keep APR as an explicit reference estimate rather than pretending the repeated monitor messages are new observations.

Possible future model:

`factual snapshot A → factual snapshot B → observed reward delta → time/stake-normalized trailing APR → bounded smoothing/reference APR`

The model may adapt as more factual snapshots accumulate, but it must not rewrite already-closed historical income without evidence.

#### B4 — Company allocation

Preserve explicit 50/50 attribution to the two ICP companies unless owner evidence changes the ownership split. Ensure unlock/principal events and reward/maturity estimates are not double-counted as each other.

### Acceptance

- owner-facing next-unlock state advances correctly after real unlocks;
- stale past unlock dates do not remain presented as the next unlock;
- current stake / active productive stake / dissolved state have provenance;
- `Observed` vs `Estimated` vs `UNKNOWN` is explicit;
- if two factual maturity snapshots exist, a trailing observed reference APR can be computed and compared with the current ~6.5% reference;
- if they do not exist, the system remains honest and estimated rather than manufacturing precision;
- no reward or unlock is double-counted;
- no automatic payout, claim, wallet, or execution authority is added.

---

## Recovery note for the next chat

At takeover/warmup, read in this order:

`live CURRENT → latest continuity → Router → THE_HOLDING_PUBLIC_GREEN_TO_PRIVATE_ROADMAP_2026-09-13.md → this addendum → fresh artifacts/evidence`

Then verify the live active package before acting.

Current next bounded item from this addendum: **Tail B — ICP NNS dynamic monitoring / reference-yield refinement.**
