# THE HOLDING — REPORTING REFERENCE MODEL CANON
## 2026-08-22 · Defitea daily/monthly reporting hardening

## Purpose

This canon defines the durable boundary for automated Defitea reporting after the Reporting Layer was aligned with the shared Market Data architecture and the canonical 11-position productive inventory.

It does not redefine Jan–Jul 2026 historical reports. Those remain preserved reported/realised history.

## 1. Canonical Defitea inventory

Automated Defitea reporting must consume:

`companies/defitea-canonical-state.json`

The current canonical productive inventory contains exactly **11 economic positions**. The Reporting Layer must not reconstruct the inventory from public HTML or maintain its own position book.

A daily Defitea reference report is publishable only when all 11 canonical positions have:
- one unique canonical asset identity;
- a positive canonical quantity;
- a selected canonical market price;
- a matching Productivity engine;
- a finite non-negative Reference APR with `engineStatus = ok`.

If exact 11/11 coverage is not satisfied, the daily writer fails closed instead of silently publishing a partial fund-level cash-flow model.

`unknown != zero` remains a hard law.

## 2. One canonical market-price plane

Reporting is a consumer of:

`intelligence/market-data/market-data.json`

It does not perform independent CoinGecko discovery, browser price discovery, or another external spot-price request.

The selected Market Data row is authoritative for Reporting regardless of whether the Market Data selector chose a healthy onchain route or its bounded CoinGecko failback. Source selection belongs to Market Data; Reporting must not recreate that policy.

Every daily position preserves selected-lane/provenance metadata and the exact `marketDataGeneratedAt` used for the snapshot.

## 3. Internally coherent daily Reference APR

The daily Defitea snapshot computes its fund Reference APR from the exact same 11 position values used for that day's TVL:

`sum(position USD value × position Reference APR) / total productive USD value`

Daily modeled cash flow is:

`sum(position USD value × position Reference APR / 100 / 365)`

The Productivity Layer's published company APR remains useful provenance, but the Reporting snapshot does not blindly reuse an APR weighted against a different price observation.

This keeps daily TVL, weighted APR and modeled daily cash flow on one coherent valuation timestamp.

## 4. Reference model != realised cash flow

Automated Defitea periods are explicitly:

**reference cash-flow models, not claim accounting.**

Reference APR/APY is not realised income. Claimable rewards are not realised cash flow. Asset-price performance is not income.

Jan–Jul 2026 historical rows remain their existing reported/realised family. Automated periods must remain visibly distinguishable from that history.

## 5. First tracking month — no fabricated backfill

The first autonomous Defitea tracking month must never be normalized across days before tracking began.

If autonomous tracking starts on August 9, the closed August reference period counts only observed reporting days from August 9 onward. It must not fabricate August 1–8 income by multiplying observed samples to a full-month estimate.

Later closed months may normalize isolated missed daily snapshots under the existing bounded continuity policy, but the unobserved beginning of the first tracking month is permanently excluded.

Machine-readable contract:
- `firstTrackingMonth = true` for the first automated month;
- `unobservedPreTrackingDaysBackfilled = false`;
- if that first month is partial, `normalizationFactor = 1`.

## 6. vlCVX / Votium + Union reconciliation boundary

Defitea's current proven vlCVX route is:

`vlCVX → Votium → The Union → scrvUSD`

The Productivity engine `convex_vlcvx` already includes Votium incentives in the Reference APR model.

Therefore a current Union scrvUSD entitlement or other claimable settlement is **reconciliation/disclosure state**, not an additive cash-flow term.

Hard rule:

`claimable Union settlement + convex_vlcvx Reference APR model` must **not** be summed as two independent income sources.

Reporting may preserve:
- current route identity;
- settlement asset;
- current claimable amount/USD when proven;
- legacy residual continuity;
- route evidence status.

But it must also preserve:
- `claimableSettlementAddedToReferenceCashFlow = false`;
- `realisedCashFlowAuthority = false`.

A future realised-income system may supersede reference periods only after complete flow-safe accounting proves the corresponding cash flows without double counting.

## 7. Schedule / writer boundary

The daily Reporting writer runs after the Stable Capital update and after the 06:07 UTC shared Market Data heartbeat. It must not share the exact same scheduled minute with the canonical price writer.

Reporting owns only its historical/reporting artifact. It is never a Market Data writer and never gains execution authority.

`executionAuthority = none` remains canonical.

## Compact law

**One canonical 11-position inventory + one canonical selected price plane + exact 11/11 rate coverage → one coherent daily reference snapshot → no pre-tracking fabrication → no Union double count.**
