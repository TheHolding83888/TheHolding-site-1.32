# THE HOLDING — MASTER CONTINUITY · AUTOMATIC CHECKPOINT
## 2026-09-07T16:28:06.000Z · source 4f881749

Status: **AUTOMATIC IMMUTABLE RESUME CHECKPOINT**  
Authority: **observation / continuity only**  
executionAuthority: **none**

> This checkpoint is generated from live repository state. It is a resume anchor, not a substitute for fresh evidence. Changing facts must always be re-read from live `main`, fresh machine-readable artifacts and exact workflow evidence.

## 1. SOURCE BOUNDARY

- Canonical source head: **4f881749d4c055bcf2c84b707c62018653cb51c2**
- Source commit time: **2026-09-07T16:28:06Z**
- Source commit: **data: update ICP NNS accrued rewards**
- Trigger boundary head: **03ceaa70d8f0eb0f73c54df046deb54735e39073**
- Trigger boundary time: **2026-09-07T19:27:41+03:00**
- Trigger boundary reason: **associated-merged-pr**
- Trigger boundary commit: **Accounting: probe ICP NNS rewards from direct Governance neuron info (#678)**
- Previous continuity: `THE_HOLDING_MASTER_CONTINUITY_2026-09-07_152817_AUTO_71abe7e1.md`.
- Changed paths observed on source commit: 3.
  - `companies/icp-nns-rewards-history.json`
  - `companies/icp-nns-rewards-state.json`
  - `companies/rewards-data.json`

## 2. CURRENT MACHINE SNAPSHOT

- Security Sentinel: **WATCH**; Critical 0 / High 2 / Medium 51; generatedAt 2026-09-07T15:28:15.848Z.
- Accounting Coverage: version 0.10-explicit-settlement-link-accounting-mechanism-coverage-registry; generatedAt 2026-09-07T15:54:16.331Z; mechanisms 29; reusable gaps 1.
- Canonical Income Ledger: version 0.1-canonical-income-ledger; status partial; generatedAt 2026-09-07T15:54:16.331Z; observed event count 716.
- Company Monthly Reports: version 0.4-company-monthly-earned-income-accounting; methodology 0.4-canonical-ledger-sole-income-recognition-authority; generatedAt 2026-09-07T15:55:14.331Z; companies 10.

### Key factual-accounting mechanisms

- `aerodrome_veaero`: factual tracking 8/8; current-month factual events 8; reusableCoverageGap=no.
- `velodrome_vevelo`: factual tracking 4/4; current-month factual events 6; reusableCoverageGap=no.
- `frax_vefrax`: factual tracking 3/3; current-month factual events 374; reusableCoverageGap=no.
- `yieldbasis_veyb`: factual tracking 4/4; current-month factual events 15; reusableCoverageGap=no.
- `beefy_cvxcrv`: factual tracking 1/1; current-month factual events 5; reusableCoverageGap=no.
- `convex_vlcvx`: factual tracking 4/4; current-month factual events 2; reusableCoverageGap=no.
- `convex_staked_cvxcrv`: factual tracking 1/1; current-month factual events 0; reusableCoverageGap=no.
- `curve_vecrv`: factual tracking 3/3; current-month factual events 4; reusableCoverageGap=no.

### Highest-value reusable coverage gaps

- `concentrator_asdcrv`: factual 0/1; state-only 0; reference-only 1; known productive value USD 218.88.

## 3. ACTIVE FRONTIER / ARTIFACT FRESHNESS

- Trigger boundary: `03ceaa70` at 2026-09-07T19:27:41+03:00; reason: associated-merged-pr.
- Accounting Coverage: predates-trigger-boundary-recheck-live; generatedAt 2026-09-07T15:54:16.331Z.
- Canonical Income Ledger: predates-trigger-boundary-recheck-live; generatedAt 2026-09-07T15:54:16.331Z.
- Company Monthly Reports: predates-trigger-boundary-recheck-live; generatedAt 2026-09-07T15:55:14.331Z.
- Diagnostic accounting frontier from the currently materialized Coverage artifact: `concentrator_asdcrv` (0/1 factual tracking; known productive value USD 218.88).
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
