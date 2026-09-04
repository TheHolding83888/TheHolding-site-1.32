# THE HOLDING — MASTER CONTINUITY · AUTOMATIC CHECKPOINT
## 2026-09-04T17:02:21.000Z · source 5ba66019

Status: **AUTOMATIC IMMUTABLE RESUME CHECKPOINT**  
Authority: **observation / continuity only**  
executionAuthority: **none**

> This checkpoint is generated from live repository state. It is a resume anchor, not a substitute for fresh evidence. Changing facts must always be re-read from live `main`, fresh machine-readable artifacts and exact workflow evidence.

## 1. SOURCE BOUNDARY

- Canonical source head: **5ba6601959eebf54691965df9abcfa1ae4e2c71b**
- Source commit time: **2026-09-04T20:02:21+03:00**
- Source commit: **Merge pull request #617 from TheHolding83888/fix/rewards-rook-settlement-production-guard-v0-1**
- Previous continuity: `THE_HOLDING_MASTER_CONTINUITY_2026-09-04_163836_AUTO_cd6f97f0.md`.
- Changed paths observed on source commit: 11.
  - `.github/workflows/update-company-rewards.yml`
  - `intelligence/reliability/rewards-scheduler-workflow-definition-proof.mjs`
  - `reporting/accounting-coverage.json`
  - `reporting/company-monthly-reports.json`
  - `reporting/defitea-income-ledger.json`
  - `reporting/frax-yield-accounting-evidence.json`
  - `reporting/income-ledger.json`
  - `reporting/reporting-data.json`
  - `reporting/ve33-accounting-evidence.json`
  - `reporting/ve33-locked-managed-accounting-evidence.json`
  - `reporting/yield-basis-accounting-evidence.json`

## 2. CURRENT MACHINE SNAPSHOT

- Security Sentinel: **WATCH**; Critical 0 / High 2 / Medium 51; generatedAt 2026-09-04T16:38:56.964Z.
- Accounting Coverage: version 0.3-factual-tracking-accounting-mechanism-coverage-registry; generatedAt 2026-09-04T16:44:32.981Z; mechanisms 31; reusable gaps 14.
- Canonical Income Ledger: version 0.1-canonical-income-ledger; status partial; generatedAt 2026-09-04T16:44:32.981Z; observed event count 383.
- Company Monthly Reports: version 0.4-company-monthly-earned-income-accounting; methodology 0.4-canonical-ledger-sole-income-recognition-authority; generatedAt 2026-09-04T16:45:21.509Z; companies 10.

### Key factual-accounting mechanisms

- `aerodrome_veaero`: factual tracking 8/8; current-month factual events 2; reusableCoverageGap=no.
- `velodrome_vevelo`: factual tracking 4/4; current-month factual events 4; reusableCoverageGap=no.
- `frax_vefrax`: factual tracking 3/3; current-month factual events 122; reusableCoverageGap=no.
- `yieldbasis_veyb`: factual tracking 4/4; current-month factual events 15; reusableCoverageGap=no.
- `beefy_cvxcrv`: factual tracking 1/1; current-month factual events 3; reusableCoverageGap=no.
- `convex_vlcvx`: factual tracking 3/4; current-month factual events 2; reusableCoverageGap=yes.
- `convex_staked_cvxcrv`: factual tracking 0/1; current-month factual events 0; reusableCoverageGap=yes.
- `curve_vecrv`: factual tracking 3/3; current-month factual events 4; reusableCoverageGap=no.

### Highest-value reusable coverage gaps

- `icp_nns`: factual 0/2; state-only 2; reference-only 0; known productive value USD 6725.83.
- `convex_vlcvx`: factual 3/4; state-only 1; reference-only 0; known productive value USD 4888.51.
- `pendle_spendle`: factual 0/1; state-only 0; reference-only 1; known productive value USD 944.62.
- `venice_svvv`: factual 0/1; state-only 1; reference-only 0; known productive value USD 841.06.
- `yieldbasis_yblp_weth`: factual 0/1; state-only 0; reference-only 1; known productive value USD 732.15.
- `resupply_rsup`: factual 0/1; state-only 1; reference-only 0; known productive value USD 396.26.
- `liquity_lqty`: factual 0/1; state-only 1; reference-only 0; known productive value USD 331.19.
- `hyperlend-0xfd739d4e423301ce9385c1fb8850539d657c296d`: factual 0/1; state-only 0; reference-only 1; known productive value USD 322.76.
- `yieldbasis_yblp_wbtc`: factual 0/1; state-only 0; reference-only 1; known productive value USD 270.88.
- `projectx-whype-usdc`: factual 0/1; state-only 1; reference-only 0; known productive value USD 262.8.
- `concentrator_asdcrv`: factual 0/1; state-only 0; reference-only 1; known productive value USD 206.51.
- `gmx-gm-btc-usdc`: factual 0/1; state-only 0; reference-only 1; known productive value USD 203.74.

## 3. NON-NEGOTIABLE ACCOUNTING / AUTHORITY LAWS

- Canonical Income Ledger remains the sole factual earned-income recognition authority.
- Reference APR/APY and reference generated income are analytics, not factual period-income authority.
- Opening balance is baseline, not current-period income; later claim/reset/withdrawal/receipt is settlement when the economic income was already recognized.
- `UNKNOWN != 0`; incomplete evidence stays partial/null and fails closed rather than being estimated into factual income.
- `GREEN workflow != physically materialized production artifact`; production closure requires the artifact on live `main` plus downstream proof where applicable.
- No wallet signing, claiming, transaction execution, capital movement, automatic methodology mutation or execution-authority expansion is granted by this checkpoint.
- Security watch findings stay visible; continuity automation must never improve status by suppressing detectors.

## 4. RESUME CONTRACT

Canonical recovery path:

`CURRENT → latest continuity → Routing Index → task-specific canon/context → live artifact → exact evidence`

At resume time:
1. re-read live `intelligence/project-memory/CURRENT.md`;
2. re-read this checkpoint only if CURRENT still points here;
3. follow `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;
4. verify changing production facts from live artifacts and exact Actions/check evidence;
5. preserve `executionAuthority = none` unless the owner explicitly changes that boundary.

The model can change. **The memory must remain The Holding's.**
