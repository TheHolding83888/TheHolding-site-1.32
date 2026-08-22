# THE HOLDING — REPORTING REFERENCE MODEL CANON
## 2026-08-22 · Defitea daily/monthly reporting hardening + income composition

## Purpose

This canon defines the durable boundary for automated Defitea reporting after the Reporting Layer was aligned with the shared Market Data architecture and the canonical 11-position productive inventory.

It also defines the Defitea income-composition boundary: associated-company income from `YieldRing.eth` and `05081966.eth`, plus observed VoteMarket veCRV / veFXN entitlement events, may contribute to the reported Defitea cash-flow numerator while **Defitea TVL remains Defitea-only**.

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

Daily modeled base cash flow is:

`sum(position USD value × position Reference APR / 100 / 365)`

The Productivity Layer's published company APR remains useful provenance, but the Reporting snapshot does not blindly reuse an APR weighted against a different price observation.

This keeps daily Defitea TVL, weighted APR and modeled base cash flow on one coherent valuation timestamp.

## 4. Reference model != realised cash flow

Automated Defitea periods are explicitly:

**reference cash-flow models with separately observed entitlement events, not wallet claim accounting.**

Reference APR/APY is not realised wallet income. Current claimable balance is not itself a new daily cash-flow event. Asset-price performance is not income.

Jan–Jul 2026 historical rows remain their existing reported/realised family. Automated periods must remain visibly distinguishable from that history.

## 5. First tracking month — no fabricated backfill

The first autonomous Defitea tracking month must never be normalized across days before tracking began.

If autonomous tracking starts on August 9, the closed August reference period counts only observed reporting days from August 9 onward. It must not fabricate August 1–8 income by multiplying observed samples to a full-month estimate.

Later closed months may normalize isolated missed base daily snapshots under the existing bounded continuity policy, but the unobserved beginning of the first tracking month is permanently excluded.

Machine-readable contract:
- `firstTrackingMonth = true` for the first automated month;
- `unobservedPreTrackingDaysBackfilled = false`;
- if that first month is partial, `normalizationFactor = 1`.

Associated-company income also begins only when its daily contribution is actually observed by the composition layer. No historical associated-company income is fabricated before that first observation.

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

## 7. VoteMarket veCRV / veFXN — event accounting

Defitea also earns conditional vote incentives through:
- `votemarket-vecrv`;
- `votemarket-vefxn`.

These flows are not part of the base `curve_vecrv` or `fx_vefxn` Productivity APRs. They are discontinuous and vote-dependent: a week may have a different campaign, gauge, reward asset and effective yield, or no eligible vote/income at all.

The authoritative evidence lane is canonical Rewards, which already proves individual VoteMarket entitlements from official Stake DAO proof data plus VoteMarket claimed/period state and published vote reconstruction.

Reporting must **not** add the current VoteMarket claimable balance every day. That would count one unclaimed entitlement repeatedly and then erase it after claim.

Instead Reporting maintains an append-only income-event ledger. One event is admitted exactly once using the identity:

`route + epoch + chainId + platform + campaignId + gauge + wallet + rewardToken`

At first admission:
- the proven USD value is frozen for reporting history;
- later claiming/disappearance does not erase the event;
- duplicate daily observations do not create duplicate income;
- events before Defitea autonomous tracking are not used to rewrite Jan–Jul history;
- no eligible VoteMarket event for a week means zero VoteMarket income for that week;
- uncertain / unresolved Rewards evidence remains excluded rather than guessed.

This is **observed entitlement income**, not a claim transaction ledger.

## 8. Associated-company income contributors

Two companies are designated income contributors to the Defitea report:
- `YieldRing.eth`;
- `05081966.eth`.

Their role is **income contributor, not capital contributor**.

For each observed Reporting day, their contribution is modeled from their canonical complete Productivity state:

`company productiveValue × company Reference APR / 100 / 365`

Admission requires:
- company Productivity `status = ok`;
- `coverage = 1`;
- positive finite `productiveValue`;
- finite non-negative `aprLatest`.

If that contract is not satisfied, the composition layer fails closed. Missing contributor income is never silently converted to zero.

Hard capital boundary:
- `incomeIncludedInDefiteaCashFlow = true`;
- `includedInDefiteaTvl = false`;
- YieldRing / 05081966 productive value must never be added to Defitea `totalValueUsd`, `averageTvlUsd`, or any TVL denominator.

Their productive value is used only to calculate their own reference-income contribution.

## 9. Unified Defitea monthly cash-flow numerator

For automated Defitea months:

`cashFlowUsd = base Defitea reference cash flow + associated-company reference income + observed VoteMarket veCRV/veFXN income events`

The public Yield Reports surface may continue to display one aggregate cash-flow number. Machine-readable Reporting must preserve the components separately for auditability:
- `baseDefiteaReferenceCashFlowUsd`;
- `associatedCompanyReferenceCashFlowUsd`;
- `voteMarketObservedIncomeUsd`;
- unified `cashFlowUsd`.

Monthly yield remains:

`unified cashFlowUsd / Defitea-only averageTvlUsd`

Thus associated companies can increase the Defitea cash-flow numerator without inflating or contaminating the Defitea TVL denominator.

### Live-month and year annualisation

Each month's `annualizedAprPct` is a comparable non-compounded annualised rate:
- closed month: `monthlyYieldPct × 12`;
- live provisional month: `observed monthlyYieldPct × 365 / sampleDays`.

The live provisional month is annualised only from days actually observed. Reporting must not fabricate unobserved future days and must not compound the result.

The year-level `annualizedCashFlowAprPct` is the arithmetic mean of all finite monthly `annualizedAprPct` values available for that year, **including the live provisional month when present**.

Therefore the displayed year APR moves daily with the current live month. When no provisional month exists, the same formula naturally reduces to the mean of closed-month annualised rates.

Audit fields:
- `annualizedCashFlowAprIncludesLiveMonth`;
- `annualizedCashFlowAprMonths`;
- `currentMonthAnnualizedAprPct`.

`bestMonth` remains based on closed months only. Existing closed-only YTD summary fields remain closed-only internally so public live-YTD composition does not double-count the provisional month.

## 10. Persistent income ledger

The composition layer owns:

`reporting/defitea-income-ledger.json`

The ledger is persistent because `reporting-data.json` is regenerated by the base Reporting engine. It stores:
- daily associated-company reference-income observations;
- deduplicated VoteMarket entitlement events;
- explicit TVL-exclusion semantics and accounting provenance.

The ledger is written by the existing Reporting workflow and does not create a second workflow/writer plane.

## 11. Schedule / writer boundary

The daily Reporting writer runs after the 04:57 UTC Rewards update, after Stable Capital, and after the 06:07 UTC shared Market Data heartbeat. It must not share the exact same scheduled minute with the canonical price writer.

The sequence is:

`canonical Reporting base snapshot → Defitea income composition → validation → one Reporting commit`

Reporting owns only its reporting/history artifacts. It is never a Market Data writer and never gains execution authority.

`executionAuthority = none` remains canonical.

## Compact law

**Defitea-only 11-position TVL + canonical base Reference APR → base income; YieldRing + 05081966 add income but never TVL; VoteMarket veCRV/veFXN enters once per proven entitlement event; Union settlement never double-counts; live-month APR uses observed days only; year APR includes the live month; one unified monthly cash-flow numerator remains auditable by component.**
