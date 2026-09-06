# THE HOLDING — MASTER CONTINUITY · AUTOMATIC CHECKPOINT
## 2026-09-06T05:09:48.000Z · source f3916c60

Status: **AUTOMATIC IMMUTABLE RESUME CHECKPOINT**  
Authority: **observation / continuity only**  
executionAuthority: **none**

> This checkpoint is generated from live repository state. It is a resume anchor, not a substitute for fresh evidence. Changing facts must always be re-read from live `main`, fresh machine-readable artifacts and exact workflow evidence.

## 1. SOURCE BOUNDARY

- Canonical source head: **f3916c600fb5fdaa111d3575cbd2947462160d93**
- Source commit time: **2026-09-06T05:09:48Z**
- Source commit: **data: update company monthly earned-income reports**
- Trigger boundary head: **e6256911756fb411462c9ae9dcfc7bb1b2ea911f**
- Trigger boundary time: **2026-09-06T08:09:25+03:00**
- Trigger boundary reason: **associated-merged-pr**
- Trigger boundary commit: **Reporting UI: show factual observed monthly income without upgrading completeness (#649)**
- Previous continuity: `THE_HOLDING_MASTER_CONTINUITY_2026-09-06_043651_AUTO_9d09273f.md`.
- Changed paths observed on source commit: 1.
  - `reporting/company-monthly-reports.json`

## 2. CURRENT MACHINE SNAPSHOT

- Security Sentinel: **WATCH**; Critical 0 / High 2 / Medium 50; generatedAt 2026-09-06T05:09:44.831Z.
- Accounting Coverage: version 0.10-explicit-settlement-link-accounting-mechanism-coverage-registry; generatedAt 2026-09-06T04:58:45.573Z; mechanisms 29; reusable gaps 0.
- Canonical Income Ledger: version 0.1-canonical-income-ledger; status partial; generatedAt 2026-09-06T04:58:45.573Z; observed event count 546.
- Company Monthly Reports: version 0.4-company-monthly-earned-income-accounting; methodology 0.4-canonical-ledger-sole-income-recognition-authority; generatedAt 2026-09-06T05:09:48.798Z; companies 10.

### Key factual-accounting mechanisms

- `aerodrome_veaero`: factual tracking 8/8; current-month factual events 2; reusableCoverageGap=no.
- `velodrome_vevelo`: factual tracking 4/4; current-month factual events 4; reusableCoverageGap=no.
- `frax_vefrax`: factual tracking 3/3; current-month factual events 262; reusableCoverageGap=no.
- `yieldbasis_veyb`: factual tracking 4/4; current-month factual events 15; reusableCoverageGap=no.
- `beefy_cvxcrv`: factual tracking 1/1; current-month factual events 4; reusableCoverageGap=no.
- `convex_vlcvx`: factual tracking 4/4; current-month factual events 2; reusableCoverageGap=no.
- `convex_staked_cvxcrv`: factual tracking 1/1; current-month factual events 0; reusableCoverageGap=no.
- `curve_vecrv`: factual tracking 3/3; current-month factual events 4; reusableCoverageGap=no.

### Highest-value reusable coverage gaps

- None reported by the current Coverage Registry.

## 3. ACTIVE FRONTIER / ARTIFACT FRESHNESS

- Trigger boundary: `e6256911` at 2026-09-06T08:09:25+03:00; reason: associated-merged-pr.
- Accounting Coverage: predates-trigger-boundary-recheck-live; generatedAt 2026-09-06T04:58:45.573Z.
- Canonical Income Ledger: predates-trigger-boundary-recheck-live; generatedAt 2026-09-06T04:58:45.573Z.
- Company Monthly Reports: at-or-after-trigger-boundary; generatedAt 2026-09-06T05:09:48.798Z.
- Diagnostic accounting frontier: no reusable Coverage gap is currently materialized.
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
