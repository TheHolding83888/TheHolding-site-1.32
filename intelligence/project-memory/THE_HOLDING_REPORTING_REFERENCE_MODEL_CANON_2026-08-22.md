# THE HOLDING — REPORTING REFERENCE MODEL CANON
## 2026-08-22 · amended 2026-08-27 · resilient reporting + Canonical Income Ledger

Status: **CANONICAL PRODUCTION LAW**
Execution authority: **none**

## Purpose

This canon defines the durable boundary for automated Defitea, Monetra and Company Monthly Reporting after the Reporting Layer was aligned with shared Market Data, resilient per-source degradation, the Canonical Income Ledger and the event-driven production cascade.

It preserves the original Defitea income-composition law: associated-company income from `YieldRing.eth` and `05081966.eth`, plus observed VoteMarket veCRV / veFXN entitlement events, may contribute to the Defitea cash-flow numerator while **Defitea TVL remains Defitea-only**.

It does not redefine Jan–Jul 2026 historical Defitea reports. Those remain preserved reported/realised history.

---

## 1. Canonical Defitea inventory — structural integrity remains strict

Automated Defitea reporting consumes:

`companies/defitea-canonical-state.json`

The current canonical productive inventory contains exactly **11 economic positions**. Reporting must not reconstruct that inventory from public HTML or maintain a second position book.

Structural requirements remain fail-closed. Every canonical productive position must have:
- one unique canonical asset identity;
- a positive canonical quantity;
- a selected canonical market price;
- a matching Productivity engine.

A broken inventory, missing identity, invalid quantity, missing canonical price, duplicated position, corrupted methodology contract or other structural-integrity failure still blocks publication.

A **temporary economic-source failure is different from a structural failure**. One temporarily unavailable Reference APR must not freeze the entire fund or the whole Reporting system.

Canonical rate states are:
- `current` — a fresh, currently validated Reference APR;
- `carried-forward` — the last previously published valid Reporting rate, admitted only under the bounded continuity policy and with explicit historical provenance;
- `unknown` — no admissible current or bounded prior rate exists.

For `unknown`:
- the position remains in TVL;
- its rate is `null`, never `0`;
- it is excluded only from modeled-income / rate-covered calculations;
- the rest of the fund continues reporting when structurally sound.

Hard law:

**fail soft on an individual economic data source; fail closed on structural integrity.**

`unknown != zero` remains absolute.

The machine-readable policy is:

`reporting/rate-continuity-policy.json`

---

## 2. Bounded rate continuity is not current verification

Carry-forward exists to preserve reporting continuity during temporary source degradation. It does not promote an old observation into a fresh measurement.

A carried rate must preserve:
- the previous verified value;
- its original observation/provenance time;
- its age;
- the maximum permitted carry window;
- the current source-engine state that caused degradation.

If the permitted window expires, the rate becomes `UNKNOWN`. Reporting must never extend continuity indefinitely merely to keep a number on screen.

Hard-invalid / blocked / revoked states are never eligible for historical carry.

This mechanism is generic. Pendle is one production example, not a protocol-specific exception. The same policy applies to any future income-rate source that temporarily enters an admissible degraded state.

---

## 3. One canonical market-price plane

Reporting is a consumer of:

`intelligence/market-data/market-data.json`

It does not perform independent CoinGecko discovery, browser price discovery, or another external spot-price request.

The selected Market Data row is authoritative for Reporting regardless of whether the Market Data selector chose a healthy onchain route or an approved bounded fallback. Source selection belongs to Market Data; Reporting must not recreate that policy.

Every daily position preserves selected-lane/provenance metadata and the exact `marketDataGeneratedAt` used for the snapshot.

---

## 4. Internally coherent daily Reference APR

For every rate-covered Defitea position, the daily snapshot computes its fund Reference APR from the same position values used for that day's TVL.

When full rate coverage exists:

`sum(position USD value × position Reference APR) / total productive USD value`

When one or more positions are `UNKNOWN`, the weighted Reference APR applies only to rate-covered capital, while total TVL continues to represent the full canonical productive inventory.

Daily modeled reference cash flow is:

`sum(rate-covered position USD value × admitted Reference APR / 100 / 365)`

Reporting must expose coverage/provenance rather than silently pretending partial rate coverage is full coverage.

The Productivity Layer's published company APR remains useful provenance, but Reporting does not blindly reuse an APR weighted against a different valuation timestamp.

---

## 5. Reference model != earned-income authority != realised cash flow

Automated Reference APR/APY models are useful continuous estimates, but they are not by themselves proof that a specific amount was earned, claimed or received.

Hard distinctions:
- Reference APR/APY != realised wallet cash flow;
- current claimable balance != a new daily cash-flow event;
- claimable decrease != proof of realised cash flow;
- asset-price performance != income;
- Reference APR cannot backfill missing earned-income evidence.

Jan–Jul 2026 Defitea rows remain their existing reported/realised family. New automated periods preserve their own provenance and semantics.

---

## 6. First tracking month — no fabricated backfill

The first autonomous tracking month must never be normalized across days before tracking began.

If autonomous tracking starts after the first day of a month, the first month counts only observed reporting days. It must not fabricate earlier income by extrapolating observed samples backwards.

Machine-readable contract:
- `firstTrackingMonth = true` for the first automated month where applicable;
- `unobservedPreTrackingDaysBackfilled = false`;
- the first partial tracking month keeps `normalizationFactor = 1`.

Later closed months may use only the separately defined bounded continuity rules for isolated missing observations. Unknown history is never manufactured.

---

## 7. vlCVX / Votium + Union reconciliation boundary

Defitea's proven vlCVX route includes:

`vlCVX → Votium → The Union → scrvUSD`

The Productivity engine `convex_vlcvx` already includes Votium incentives in the Reference APR model.

Therefore a current Union scrvUSD entitlement or other claimable settlement is **reconciliation/disclosure state**, not an additive cash-flow term.

Hard rule:

`claimable Union settlement + convex_vlcvx Reference APR model` must **not** be summed as two independent income sources.

Reporting preserves route identity and evidence while keeping:
- `claimableSettlementAddedToReferenceCashFlow = false`;
- `realisedCashFlowAuthority = false`.

---

## 8. VoteMarket veCRV / veFXN — append-only event accounting

Defitea may earn conditional vote incentives through:
- `votemarket-vecrv`;
- `votemarket-vefxn`.

These flows are not continuous base APR and are not counted by repeatedly summing the current claimable balance.

A proven entitlement is admitted once using a stable event identity. At first admission:
- its evidence identity is frozen;
- its reporting value is preserved with provenance;
- later claim/disappearance does not erase historical earned evidence;
- duplicate daily observations do not create duplicate income;
- unresolved evidence remains excluded rather than guessed.

This is observed entitlement evidence, not a claim-transaction inference.

---

## 9. Associated-company income contributors

Two companies are designated income contributors to the Defitea report:
- `YieldRing.eth`;
- `05081966.eth`.

Their role is **income contributor, not capital contributor**.

When their canonical Productivity state is complete and valid, their reference contribution may be modeled from their own productive capital and Reference APR.

Hard capital boundary:
- `incomeIncludedInDefiteaCashFlow = true` where the existing Defitea composition contract admits it;
- `includedInDefiteaTvl = false`;
- their productive value must never inflate Defitea TVL or its denominator.

---

## 10. Canonical Income Ledger — durable economic evidence plane

The canonical economic evidence artifact is:

`reporting/income-ledger.json`

Its governing machine policy is:

`reporting/income-ledger-policy.json`

The ledger exists so that income does not disappear merely because a claim, withdrawal, reinvestment or compounding event changes current balances.

The backend distinguishes at least these economic families:

1. **Accrued entitlement** — proven economic entitlement / earned claimable evidence that has not necessarily been received.
2. **Realised cash flow** — proven value actually received under an admitted realised-flow mechanism.
3. **Embedded income** — measured income economically retained inside a strategy / wrapper / compounding route.

Current claimable state is a state observation, not an append-only income event by itself.

Hard rules:
- append-only event identity where the mechanism is event-based;
- current claimable decrease does not prove realised cash flow;
- claim/reinvest/compounding must not erase previously admitted earned evidence;
- duplicate observations must not duplicate income;
- incomplete coverage remains `UNKNOWN`, not `$0`;
- no cross-family total is published until non-overlap is actually proven;
- Reference APR/APY remains separate from canonical earned-income evidence unless a protocol-specific reconciliation proves equivalence for that period.

Therefore:

`accrued + realised + embedded`

is **not automatically a valid total**.

The ledger may carry multiple evidence families side by side precisely so the system can become more intelligent without lying to the user.

`executionAuthority = none` and `capitalExecution = false` remain hard boundaries.

---

## 11. Company Monthly Reports — one headline, detailed backend

`reporting/company-monthly-reports.json` is the canonical Company Monthly Reports presentation artifact.

It may consume:
- canonical Reporting;
- Canonical Income Ledger;
- Productivity / capital observations;
- durable tracking history required by its existing methodology.

The backend may preserve detailed accounting families, provenance, coverage, statuses and reconciliation metadata.

**The standard Company Passport must remain simple.**

Canonical presentation law:

**Backend maximally intelligent and detailed; Passport maximally simple and readable.**

Default Company Passport Monthly Reports surface shows only the compact user-level result:
- one headline `Generated` amount for the selected month;
- `Month Yield`;
- the appropriate average capital metric (`Average TVL`, `Average Stable Capital`, `Average Productive Capital`, etc.);
- optional `Full Report` navigation when a dedicated report exists.

Raw `Accrued entitlement`, `Realised cash flow`, `Embedded income`, reconciliation states and other accounting subfamilies are **not shown by default in the standard Passport**. They remain backend/machine intelligence and may appear only on a deliberately designed deeper audit/reporting surface.

A rich backend must not make the primary Passport harder to understand.

---

## 12. Defitea monthly headline remains auditable

For Defitea, the public monthly headline may continue to present one aggregate Reporting number while machine-readable artifacts preserve its components and overlap warnings.

The public headline is not permission to add every Canonical Income Ledger family on top of it. Where the primary Reporting metric may already contain overlapping economics, canonical evidence remains side-by-side and `combinedIncomeUsd` stays `null` until reconciliation proves a safe combined total.

This is why a Company Passport can truthfully show one simple monthly number while the backend retains much richer evidence.

---

## 13. Monetra reporting boundary

Monetra uses its own stable-capital reporting family.

Reference-generated income is based on daily productive Stable Capital and validated Reference APY. Embedded Yield remains an independent measured/audit family unless full reconciliation proves that a different combined representation is safe.

Stable-price / depeg effects and market P&L remain separate from generated income.

The public `/yield-reports/` surface may show Monetra's live monthly reporting, while the backend preserves the independent Embedded Yield evidence family without automatically summing the two.

---

## 14. Production orchestration / freshness cascade

Reporting freshness is event-driven first and cron-backed second.

Current intended production flow is:

`Rewards / Stable Capital canonical materialization → Update The Holding Reporting Data → Canonical Income Ledger → Update Company Monthly Reports`

Productivity and other canonical inputs may also wake the relevant reporting writer through their defined paths.

Fallback cron heartbeats remain defense-in-depth; they are not the only freshness mechanism.

Hard laws:
- `GREEN workflow != physically materialized production artifact`;
- downstream reporting is considered fresh only after the canonical artifact is physically published to `main`;
- writers rebuild on fresh `main` after safe rebase when required;
- if critical reporting methodology changes during publish, the writer fails closed and requires a fresh canonical run;
- no second parallel reporting truth plane is created merely to solve scheduling reliability.

---

## 15. Public reporting surfaces

The public reporting hierarchy is intentionally layered:

- **Company Passport** — compact monthly headline for ordinary reading.
- **`/yield-reports/`** — dedicated fund-level reporting for Defitea and Monetra.
- **machine artifacts / ledgers** — detailed evidence, provenance, coverage, reconciliation and accounting-family intelligence.

User-facing simplicity and backend depth are complementary, not conflicting goals.

---

## Compact law

**Keep the economic book deep and the Passport simple. One temporary protocol/source failure must degrade locally rather than freeze the whole report; structural corruption still fails closed. Current → bounded verified carry → UNKNOWN, never invented zero. Preserve claimable, received and compounded/embedded evidence as distinct canonical families, never double-count them, never let claims erase earned history, and publish one simple monthly headline only after the backend has done the hard reconciliation work.**
