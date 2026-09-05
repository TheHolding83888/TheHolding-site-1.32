# THE HOLDING — MASTER CONTINUITY · AUTOMATIC CHECKPOINT
## 2026-09-05T11:06:32.000Z · source bb572e86

Status: **AUTOMATIC IMMUTABLE RESUME CHECKPOINT**  
Authority: **observation / continuity only**  
executionAuthority: **none**

> This checkpoint is generated from live repository state. It is a resume anchor, not a substitute for fresh evidence. Changing facts must always be re-read from live `main`, fresh machine-readable artifacts and exact workflow evidence.

## 1. SOURCE BOUNDARY

- Canonical source head: **bb572e863d5f7a4c201461d4fe67859b261ee5e0**
- Source commit time: **2026-09-05T14:06:32+03:00**
- Source commit: **Accounting: promote factual Resupply tracking proof (#626)**
- Trigger boundary head: **bb572e863d5f7a4c201461d4fe67859b261ee5e0**
- Trigger boundary time: **2026-09-05T14:06:32+03:00**
- Trigger boundary reason: **associated-merged-pr**
- Trigger boundary commit: **Accounting: promote factual Resupply tracking proof (#626)**
- Previous continuity: `THE_HOLDING_MASTER_CONTINUITY_2026-09-05_082216_AUTO_3a878dcf.md`.
- Changed paths observed on source commit: 3.
  - `.github/workflows/verify-accounting-coverage.yml`
  - `reporting/accounting-coverage.mjs`
  - `reporting/resupply-tracking-proof-validation.mjs`

## 2. CURRENT MACHINE SNAPSHOT

- Security Sentinel: **WATCH**; Critical 0 / High 2 / Medium 50; generatedAt 2026-09-05T10:56:22.885Z.
- Accounting Coverage: version 0.3-factual-tracking-accounting-mechanism-coverage-registry; generatedAt 2026-09-05T11:01:56.340Z; mechanisms 31; reusable gaps 9.
- Canonical Income Ledger: version 0.1-canonical-income-ledger; status partial; generatedAt 2026-09-05T11:01:56.340Z; observed event count 456.
- Company Monthly Reports: version 0.4-company-monthly-earned-income-accounting; methodology 0.4-canonical-ledger-sole-income-recognition-authority; generatedAt 2026-09-05T09:40:18.156Z; companies 10.

### Key factual-accounting mechanisms

- `aerodrome_veaero`: factual tracking 8/8; current-month factual events 2; reusableCoverageGap=no.
- `velodrome_vevelo`: factual tracking 4/4; current-month factual events 4; reusableCoverageGap=no.
- `frax_vefrax`: factual tracking 3/3; current-month factual events 186; reusableCoverageGap=no.
- `yieldbasis_veyb`: factual tracking 4/4; current-month factual events 15; reusableCoverageGap=no.
- `beefy_cvxcrv`: factual tracking 1/1; current-month factual events 4; reusableCoverageGap=no.
- `convex_vlcvx`: factual tracking 4/4; current-month factual events 2; reusableCoverageGap=no.
- `convex_staked_cvxcrv`: factual tracking 1/1; current-month factual events 0; reusableCoverageGap=no.
- `curve_vecrv`: factual tracking 3/3; current-month factual events 4; reusableCoverageGap=no.

### Highest-value reusable coverage gaps

- `yieldbasis_yblp_weth`: factual 0/1; state-only 0; reference-only 1; known productive value USD 719.98.
- `resupply_rsup`: factual 0/1; state-only 1; reference-only 0; known productive value USD 396.35.
- `liquity_lqty`: factual 0/1; state-only 1; reference-only 0; known productive value USD 345.48.
- `hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d`: factual 0/1; state-only 0; reference-only 1; known productive value USD 324.83.
- `yieldbasis_yblp_wbtc`: factual 0/1; state-only 0; reference-only 1; known productive value USD 267.62.
- `projectx-whype-usdc`: factual 0/1; state-only 1; reference-only 0; known productive value USD 263.1.
- `concentrator_asdcrv`: factual 0/1; state-only 0; reference-only 1; known productive value USD 208.51.
- `gmx-gm-btc-usdc`: factual 0/1; state-only 0; reference-only 1; known productive value USD 201.42.
- `gmx-gm-eth-usdc`: factual 0/1; state-only 0; reference-only 1; known productive value USD 180.34.

## 3. ACTIVE FRONTIER / ARTIFACT FRESHNESS

- Trigger boundary: `bb572e86` at 2026-09-05T14:06:32+03:00; reason: associated-merged-pr.
- Accounting Coverage: predates-trigger-boundary-recheck-live; generatedAt 2026-09-05T11:01:56.340Z.
- Canonical Income Ledger: predates-trigger-boundary-recheck-live; generatedAt 2026-09-05T11:01:56.340Z.
- Company Monthly Reports: predates-trigger-boundary-recheck-live; generatedAt 2026-09-05T09:40:18.156Z.
- Diagnostic accounting frontier from the currently materialized Coverage artifact: `yieldbasis_yblp_weth` (0/1 factual tracking; known productive value USD 719.98).
- **PRE-MATERIALIZATION WARNING:** one or more machine artifacts predate the trigger boundary. Their values are useful resume context only; re-read live artifacts and downstream Actions before declaring the triggering change physically complete.
- Active Frontier is diagnostic resume guidance only. It has no completion, methodology, wallet, claim or capital authority.

## 4. NON-NEGOTIABLE ACCOUNTING / AUTHORITY LAWS

- Canonical Income Ledger remains the sole factual earned-income recognition authority.
- Reference APR/APY and reference generated income are analytics, not factual period-income authority.
- Opening balance is baseline, not current-period income; later claim/reset/withdrawal/receipt is settlement when the economic income was already recognized.
- `UNKNOWN != 0`; incomplete evidence stays partial/null and fails closed rather than being estimated into factual income.
- `GREEN workflow != physically materialized production artifact`; production closure requires the artifact on live `main` plus downstream proof where applicable.
- No wallet signing, claiming, transaction execution, capital movement, automatic methodology mutation or execution-authority expansion is granted by this checkpoint.
- Security watch findings stay visible; continuity automation must never improve status by suppressing detectors.

## 5. RESUME CONTRACT

Canonical recovery path:

`CURRENT → latest continuity → Routing Index → task-specific canon/context → live artifact → exact evidence`

At resume time:
1. re-read live `intelligence/project-memory/CURRENT.md`;
2. re-read this checkpoint only if CURRENT still points here;
3. follow `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;
4. verify changing production facts from live artifacts and exact Actions/check evidence;
5. preserve `executionAuthority = none` unless the owner explicitly changes that boundary.

The model can change. **The memory must remain The Holding's.**
