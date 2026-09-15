# THE HOLDING — CHAT HANDOFF / URGENT CHECKPOINT

Timestamp: 2026-09-15 08:56 MSK (+03:00)
Purpose: emergency continuity checkpoint so a parallel/new chat can resume the exact active work without reconstructing from conversation history.
Status at checkpoint: active work in P5, PR #828 open, NOT merge-ready.

---

## 0. RESUME THIS FIRST

If another chat takes over, do NOT infer current truth from this document alone. This is a high-detail snapshot, not a substitute for live GitHub.

Resume order:

1. Read `intelligence/project-memory/CURRENT.md` / live current memory routing if present on `main`.
2. Read the latest continuity/checkpoint after this file if a newer one exists.
3. Read the Router / resume block selected by current memory routing.
4. Re-check live `main`, active PRs/branches, Actions, generated artifacts/evidence.
5. Re-open PR #828 and verify its exact live head/base; this checkpoint records the state as of 2026-09-15 08:56 MSK only.
6. Continue P5 until the active ve33 canary/runtime defect is actually closed. Do not formally advance to P6 before that.

Primary repository:
`TheHolding83888/TheHolding-site-1.32`

Active roadmap package:
**P5 — universal historical reward-token valuation for supported mechanisms**

Roadmap source:
`intelligence/project-memory/THE_HOLDING_PUBLIC_GREEN_TO_PRIVATE_ROADMAP_2026-09-13.md`

Relevant roadmap order:
- P5 universal historical reward-token valuation for supported mechanisms
- P6 supported-mechanism / new-reward-token reuse proof
- P7 heavy workflow profiling
- P8 measured performance/reliability simplification

Important discipline: one primary roadmap package at a time. Current work is still treated as P5 closure/reliability work; do not jump to P6 simply because many P5 valuation pieces are already merged.

---

## 1. NON-NEGOTIABLE SYSTEM LAWS

Preserve these throughout all fixes:

- `UNKNOWN != 0`
- historical USD must bind to the historical/economic boundary
- no current-price backfill into historical income
- no stablecoin-peg assumption as factual historical valuation
- no Reference APR/APY as earned income
- claims/withdrawals/settlements are not second income
- Canonical Income Ledger is the sole earned-income authority
- one canonical writer per artifact
- workflow GREEN is not sufficient; physical artifact/materialization on live `main` is required for production closure
- fail closed rather than invent data
- no token-specific/company-specific patches when a mechanism-level reusable fix is possible
- preserve provenance / source identity
- `executionAuthority = none`
- no wallet signing
- no claiming authority
- no capital movement
- no methodology mutation merely to force GREEN
- do not make repo public→private without Alexander’s explicit confirmation at that moment

---

## 2. PRECEDING P5 HISTORY ALREADY COMPLETED

Important merged sequence before current PR #828:

### PR #818
Exact-block Velodrome USDC route discovery core.

### PR #819
Generic Velodrome historical reward valuation.

### PR #821
Aerodrome exact-block historical reward token → Base USDC discovery + USDC/USD Chainlink.

### PR #823
Title: `Accounting: admit discovered historical valuation proofs`
Squash merge:
`c079298f557798e22bdef20bf7da70b511d3d803`

Purpose:
Canonical Ledger admission was extended so discovered historical valuation proof source families can be accepted, specifically:
- `historical-onchain-aerodrome-twap-chainlink-at-boundary`
- `historical-onchain-velodrome-discovered-twap-chainlink-at-boundary`

Identity / fail-closed tests were added.

### Physical Reporting run #381
Workflow: `Update The Holding Reporting Data`
Run id: `34853230907`
Job id: `104006152061`
Completed successfully after a long safe-writer/rebase cycle.
Physical generated commit:
`f11237571a90f1ad4537a367361013b17cfb0c39`
message: `data: update reporting and canonical income ledger`

That run established a P7-type performance bottleneck (safe writer rebuilds Reporting when main advances), but that profiling work belongs to P7 and must not distract from P5 unless it blocks correctness.

### Physical P5 baseline after #381
Diagnostic branch:
`diagnostic/p5-post824-physical-ledger-20260914`
Workflow:
`.github/workflows/diagnose-p5-post824-physical-ledger.yml`
Run `34858003821`, job `104022473547`, success.

Physical persisted Ledger summary at that time:
- ledgerGeneratedAt `2026-09-14T14:42:05.904Z`
- eventCount 1278
- ve33EventCount 96
- historical valuation sourceState:
  - eligibleEventCount: 58
  - resolvedEventCount: 38
  - unresolvedEventCount: 20
  - identityMismatchEventCount: 5
  - reusedIdentityBoundResolutionCount: 0
- unresolved statuses:
  - `canonical-historical-market-data-empty`: 3
  - `historical-velodrome-usdc-route-unavailable`: 1
  - `token-not-canonical-market-data-mapped`: 6
  - `historical-aerodrome-usdc-route-unavailable`: 7
  - `historical-chainlink-rpc-unavailable`: 3
- canonicalUsdValuationBlockerCount: 20
- blockersByProtocol:
  - Aerodrome 14
  - Velodrome 6
- blockersByAsset:
  - QUID 1
  - MET 1
  - WETH 1
  - USDC 5
  - fBOMB 2
  - MUSD 2
  - CHIP 1
  - TOWNS 1
  - OPP 1
  - opxVELO 1
  - alETH 3
  - LAPTOP 1

Do not over-trust the old `ve33ResolvedValuationCount` diagnostic field; persisted events did not expose `valuationResolution` in the shape that field assumed. `sourceState.historicalValuationResolution` was the authoritative summary.

### PR #824
Title: `Accounting: bind discovered Velodrome valuation family`
Merged squash commit:
`ac4991e1aa80c9469d24558fad45727b687c2af1`

Bug fixed:
`reporting/historical-velodrome-discovered-price.mjs` was incorrectly returning the explicit-route source family:
`historical-onchain-velodrome-twap-chainlink-at-boundary`
when discovered proofs must use:
`historical-onchain-velodrome-discovered-twap-chainlink-at-boundary`

This mismatch explained the 5 identity mismatches in the physical sourceState baseline. Fix was systemic: discovered output now binds to discovered identity family; regression test asserts actual resolver output family.

### PR #825
Title: `Reliability: bind historical pricing dependencies to Reporting`
Purpose:
Bind historical discovery runtime dependencies to Reporting wake-up and safe-writer critical fingerprint so P5 price-logic changes cannot silently miss a canonical Reporting rebuild.

Important control-plane lesson:
Workflow definition guard correctly required the paired deterministic proof file rather than allowing a workflow-only change. Existing paired proof:
`intelligence/reliability/reporting-scheduler-workflow-definition-proof.mjs`
was used; no guard bypass / policy weakening was allowed.

---

## 3. CURRENT ACTIVE PR #828

PR:
`#828 — Reliability: adapt ve33 settlement logs to numeric RPC range limits`

Branch:
`fix/ve33-generic-rpc-range-limit-20260914`

State at checkpoint:
- open
- not merged
- not merge-ready

PR snapshot at beginning of this checkpoint sequence:
- base: `main`
- recorded PR base SHA: `38ade51923a9169b20fc3d70419eb47af6dc7bf4`
- active PR head SHA: `0f0e854f6a4f3980cda69578e29270cd2202eec5`
- changed files: 3
- additions: 136
- deletions: 39

Live `main` moved again after that PR base sync. At 2026-09-15 08:56 MSK live main was:
`ee0fe701df3d9424e9cafa2add01011b41ad147f`
message: `data: update company monthly earned-income reports`

Therefore the takeover chat MUST re-check whether #828 is behind/conflicted and, if needed, sync to the latest live main again before final merge. Do not assume `38ade519…` remains the current merge base.

The PR currently has exactly these three changed files:

1. `.github/workflows/verify-ve33-accounting.yml`
2. `reporting/ve33-accounting-evidence.mjs`
3. `reporting/ve33-unresolved-settlement-diagnostic.mjs`

Temporary runner/diagnostic workflow files used during development were already deleted. Do not reintroduce them into final PR.

---

## 4. WHY #828 EXISTS

A live ve33 canary exposed a real provider compatibility defect.

Observed class:
Base `mainnet.base.org` may reject `eth_getLogs` with a provider-specific numeric range-limit error, e.g. a 2,000-block range limit. Existing settlement handling recognized only older/literal range-limit wording (historically around 10,000), so a production-shaped live scan could fail or recurse inefficiently.

The intended fix class is generic, read-only RPC compatibility:
- recognize numeric provider range-limit errors generically (`2,000`, `10,000`, etc.)
- preserve optimistic wide requests on capable providers
- adapt/split only when a provider actually requires it
- allow provider-specific measured hints where already known
- pool settlement address queries so repeated company/lane scans can reuse the same log query results
- maintain failover and telemetry
- no accounting economics changes

The PR description explicitly states there are no changes to:
- accounting economics
- event identity
- income authority
- price logic
- stablecoin assumptions
- wallet authority
- claiming authority
- capital execution

`executionAuthority` stays `none`.

---

## 5. EXACT CODE SHAPE IN #828

### 5.1 `.github/workflows/verify-ve33-accounting.yml`

Only intended workflow change:
when `BASE_RPC_URL` secret is absent, canary now uses:
`https://base-rpc.publicnode.com`
instead of relying on no configured Base URL.

This is present in both:
- transient ClaimRewards diagnostic environment
- read-only live Base + Optimism accounting canary environment

Optimism fallback remains:
`https://gateway.tenderly.co/public/optimism`

This workflow change is a canary/runtime surface, not an accounting-methodology change.

### 5.2 `reporting/ve33-unresolved-settlement-diagnostic.mjs`

The diagnostic gained generic range-error handling:

- `errorText(error)` normalizes nested RPC error messages
- `isRangeError(error)` recognizes numeric range limit language
- `queryLogs(...)` changed from fixed MAX_LOG_BLOCKS iteration to optimistic direct request + recursive split only on an actual range error

Intent:
keep normal wide request behavior where provider supports it; adapt only when necessary.

### 5.3 `reporting/ve33-accounting-evidence.mjs`

This is the main production-shaped settlement router change.

Key changes:

#### Provider range hints
Aerodrome config now includes:
- `settlementRangeHints:{'mainnet.base.org':2000}`
- `settlementRequestSpacingMs:200`

#### Settlement provider state
Each candidate now tracks:
- `maxLogRange`
- `rangeLimitSource`
- `disabledForSettlement`
- `disableReason`

#### Address pooling
Instead of reward-only group mapping, router builds a pooled set of settlement addresses including:
- reward-contract addresses from lanes
- rewards distributor where applicable

Those addresses are grouped into settlement groups and used for cache reuse.

#### Generic error parsing
Range recognition now includes numeric forms such as:
- `limited to a 2,000 range`
- `limited to 0 - 2,000 blocks range`

It also detects:
- rate limit errors
- payload-too-large / 413 class
- address filter limits
- terminal historical/archive provider failure class

#### Provider disabling
A provider can be disabled for settlement after a terminal archive/history failure, avoiding repeated guaranteed-failing requests in the same router lifetime.

#### Multi-topic pooled settlement query
Pooled query uses both settlement topics:
- Claimed / rebase settlement
- ClaimRewards

Logs are parsed by actual `topic0`, then filtered per requested settlement kind and target address after cache retrieval.

This is intended to let the same pooled request answer both reward and rebase settlement consumers where block window/group matches.

#### Adaptive/proactive range split
If candidate already has a measured/hinted `maxLogRange` and requested span is larger, it proactively slices the request.

If RPC returns a numeric range limit, router learns it and records:
- `maxLogRange`
- `rangeLimitSource='learned-from-rpc-error'`

If error has no numeric limit but is a range/payload class, it falls back to recursive halving where appropriate.

#### Telemetry added
Router snapshot includes:
- `adaptiveSplitCount`
- `proactiveRangeSplitCount`
- `rangeLimitLearnedCount`
- `addressSplitCount`
- `rateLimitRetryCount`
- `failoverCount`
- `providerDisableCount`
- provider range limits and their source
- disabled providers and reasons
- provider success/failure counts
- pooled reward/settlement address counts/groups
- failure samples

This telemetry is important for the next optimization step. Do not remove it merely to simplify code until runtime root cause is proven.

---

## 6. BRANCH CLEANUP ALREADY DONE

Development previously used temporary workflow helpers/runners to materialize code changes because direct workflow-file pushes can hit GitHub App workflow permission constraints.

A previous runner accidentally attempted to include `node_modules` and workflow modifications in a push. GitHub App correctly blocked that push. The actual production code had passed checks.

Then the runner was corrected to commit only the intended reporting files. Production commit physically appeared in the branch (`96be0ca…` during that sequence).

Afterwards all temporary runner/diagnostic workflow files were removed from the PR branch.

Before the latest base synchronization, the clean PR diff was exactly 3 files. It is still exactly 3 files at this checkpoint.

Do not merge any temp helper workflow into main.

---

## 7. CI / ACTIONS STATUS AT CHECKPOINT

### Exact-head run set for PR head `0f0e854f6a4f3980cda69578e29270cd2202eec5`

#### GREEN

`Verify Reporting Layer`
- run id: `34929302576`
- run number: `290`
- conclusion: SUCCESS

This is significant because an earlier Reporting run had incorrectly treated #828 as Yield Basis-sensitive due to stale base comparison, then a live Yield Basis public Ethereum RPC issue produced a RED. After synchronizing the PR to then-current main, the fresh Reporting run correctly classified the PR and went fully GREEN, including:
- live Yield Basis boundary behavior
- writer/history checks
- append-only retention
- authority guards

Do not treat that older Yield Basis RED as a ve33 defect.

`The Holding Security · Commit Identity Privacy Guard`
- run id: `34929302584`
- run number: `2717`
- SUCCESS

`The Holding Reliability · Repository Hygiene Guard`
- run id: `34929302547`
- run number: `1634`
- SUCCESS

`The Holding Reliability · Workflow Control Plane`
- run id: `34929302552`
- run number: `915`
- SUCCESS

`Verify ve33 Historical RPC Capability`
- run id: `34929302604`
- run number: `85`
- SUCCESS

`The Holding Security · Public Surface Privacy Guard`
- run id: `34929302556`
- run number: `2380`
- SUCCESS

#### RED — CURRENT BLOCKER

`Verify ve33 Factual Accounting`
- run id: `34929302544`
- run number: `335`
- job id: `104253965022`
- conclusion: FAILURE

Job timing:
- created: `2026-09-15T04:33:41Z`
- started: `2026-09-15T04:33:44Z`
- completed: `2026-09-15T04:47:42Z`

Steps:
- checkout: SUCCESS
- scope classification: SUCCESS
- Node setup: SUCCESS
- runtime dependency install: SUCCESS
- syntax and deterministic accounting validation: SUCCESS
- unrelated-change boundary: skipped as expected
- transient exact-tx ClaimRewards diagnostic: skipped for this path
- **Read-only live Base + Optimism accounting canary: FAILURE**

Live canary step timing:
- started: `2026-09-15T04:34:19Z`
- completed: `2026-09-15T04:47:39Z`
- duration: ~13m20s

This is much longer than the desired runtime budget (~7.5 minutes for the live canary target discussed during work) and ultimately failed. Therefore #828 is NOT GREEN and MUST NOT be merged merely because all deterministic/security/reporting guards are green.

The previous assistant was waiting for this run; the final status is now known: it FAILED after ~13m20s in the live Base+Optimism accounting canary.

Important: exact terminal log text was not yet retrieved at checkpoint because the connector’s generic GitHub fetch endpoint rejected the Actions job logs endpoint. The next chat should obtain the failure cause via whatever Actions/log access is available (workflow-run/job endpoint, artifact, check output, GitHub connector action, or a temporary diagnostic only if necessary).

---

## 8. WHAT WE CURRENTLY SUSPECT — BUT MUST STILL PROVE

Working hypothesis before the final #335 failure was known:

The remaining long runtime is likely in repeated settlement `eth_getLogs` work on Base, potentially because:
- multiple companies/lanes request overlapping block windows
- a constrained provider (e.g. 2,000-block max) causes many subrequests
- cache keys include group + exact fromBlock/toBlock, so only perfectly matching windows deduplicate
- provider request pacing plus retries/failover multiplies the cost
- one provider may be returning a terminal/partial historical incompatibility after significant work

The router now pools addresses, but it may still scan the same long historical interval repeatedly across differing company/lane settlement windows.

DO NOT assume the root cause is simply “BASE_RPC_URL missing”. The system has public RPC failover/fallback logic and earlier P5 diagnostic work proved that blank secret alone is not a sufficient explanation.

DO NOT optimize by relaxing factual accounting or skipping settlements.

The correct next move is evidence-driven:
1. obtain exact #335 failure/error + router telemetry if emitted
2. identify which provider and which protocol consumed the 13m20s
3. quantify queryAttempts/cacheHits/proactive splits/adaptive splits/rate-limit retries/failovers/provider disables
4. determine whether duplicate long Base scans are the dominant cost
5. then apply a reusable optimization

Possible optimization class if evidence confirms duplication:
- precompute/bucket settlement scan windows by protocol/network
- query pooled settlement groups once per canonical block interval
- reuse those logs across all lanes/companies
- preserve post-filtering by exact target address/topic/token/tokenId/company identity

But do NOT implement this blindly before confirming telemetry.

---

## 9. ACCEPTANCE CONDITIONS FOR #828

Do not merge #828 until ALL are true:

1. PR is synced to current live main / no stale-base artifact.
2. PR diff remains clean: production code + intentional canary wiring only; no temporary workflows/node_modules/generated junk.
3. Deterministic accounting validation GREEN.
4. Workflow Control Plane GREEN.
5. Reporting GREEN.
6. Historical RPC capability GREEN.
7. Security/privacy/hygiene GREEN.
8. Read-only live Base + Optimism ve33 factual-accounting canary GREEN.
9. Live canary runtime is inside a defensible budget, or there is a documented measured reason why a higher budget is safe/necessary. The present ~13m20 failure is NOT acceptable.
10. No reduction in factual coverage to gain speed.
11. `UNKNOWN != 0` remains intact.
12. no change to earned-income authority/economic semantics.
13. no wallet/capital execution authority.

After merge, if this changes generated reporting/evidence behavior materially, require a fresh canonical production run / physical materialization before declaring closure.

---

## 10. IMMEDIATE RESUME PLAN — STEP BY STEP

A parallel/new chat should do this in order:

### Step A — refresh live truth
- fetch live `main` head
- fetch PR #828 metadata/head/base
- list PR changed files; ensure still exactly the three known files unless intentional later changes were added
- fetch exact-head workflow runs

At checkpoint live main = `ee0fe701df3d9424e9cafa2add01011b41ad147f` while PR head = `0f0e854f6a4f3980cda69578e29270cd2202eec5`; main had advanced after last sync.

### Step B — extract #335 failure evidence
Need exact failure text from:
- run `34929302544`
- job `104253965022`
- step `Read-only live Base + Optimism accounting canary`

If direct job logs remain inaccessible through connector, try:
- Actions run/check-run output endpoints that are allowed
- run artifacts, if any
- check-run details/annotations
- rerun on a diagnostic branch only if needed, with telemetry output explicitly persisted as artifact/text

Do not mutate main.

### Step C — classify runtime/failure
Determine whether failure is:
- provider range-limit still mishandled
- provider archive/history unsupported
- rate limiting
- payload/address filter issue
- exact-tx/block lookup issue
- Optimism rather than Base
- timeout / workflow budget
- factual assertion mismatch after successful scan

### Step D — use telemetry
Inspect settlement router telemetry fields added in #828:
- queryAttempts
- cacheHits
- cacheEntries
- pooledSettlementAddressCount
- pooledSettlementAddressGroupCount
- adaptiveSplitCount
- proactiveRangeSplitCount
- rangeLimitLearnedCount
- addressSplitCount
- rateLimitRetryCount
- failoverCount
- providerDisableCount
- providerRangeLimits
- disabledProviders
- providerSuccessCounts
- providerFailureCounts
- failureSamples

### Step E — implement only the proven systemic fix
If duplicate scans are proven, redesign query plan/cache around reusable protocol/network settlement windows instead of company/lane windows, while preserving identity filters.

If a provider is simply unsuitable for historical settlement after a definitive terminal response, disable/fail over earlier within the router rather than retrying the same impossible historical requests repeatedly.

If the failure is a missing error-class parser, add the generic class, not a one-off literal token/provider exception unless it represents a measured provider capability hint.

### Step F — rerun exact-head CI
Do not accept stale run results after head changes.

### Step G — merge only after live canary GREEN + runtime acceptable
Use expected head SHA on merge.

### Step H — materialize if needed
After merge, inspect production reporting/evidence physical artifacts on live main before calling P5 closed.

---

## 11. IMPORTANT OLD DIAGNOSTIC LESSONS

An earlier isolated diagnostic initially used shallow checkout and inflated UNKNOWN because `historical-canonical-price.mjs` depends on Git history of market-data snapshots.

Correct diagnostic uses full history (`fetch-depth: 0`).

Full-history isolated replay from run `34857405477`, job `104020415097` once showed sourceState:
- eligible 58
- resolved 27
- unresolved 31
- identityMismatch 5
with statuses including route unavailable, chainlink RPC unavailable, ambiguous route, source identity mismatch, canonical historical market data empty.

This isolated replay was diagnostic only; physical persisted Ledger after production materialization was authoritative.

Do not repeat the simplistic claim “secrets are blank, therefore valuation cannot resolve.” Public RPC source registry/failover exists and must be considered.

---

## 12. WHAT COMES AFTER #828 / P5 CLOSURE

Only after P5 physically closes:

### P6
Supported-mechanism / new-reward-token reuse proof.
Acceptance concept:
add/use one new reward token inside an already-supported mechanism WITHOUT building a new valuation engine, and prove:
- amount preservation
- append-only admission
- historical USD semantics reuse
- presentation/accounting parity
- no company-specific hardcoding

There is an old branch named something like `known-mechanism-reuse-compounded-usd`; do not assume it is current or valid. Reinspect live repo before reuse.

### P7
Heavy workflow profiling.
Known evidence already exists that Reporting safe-writer/rebase and live settlement scans can become long. P7 should quantify/optimize these rather than guess.

### P8
Measured performance/reliability simplification.

Do not collapse P5 correctness work into P7 optimization unless a performance defect directly prevents P5 canary acceptance, as #828 currently does.

---

## 13. COMMUNICATION / OWNER PREFERENCES

Alexander prefers:
- concise progress updates while work is actively running
- simple language for status
- when he says `трекай`: fresh read-only check of main, active branches/PRs, Actions/runs, generated artifacts/evidence, checkpoints/Router context, then report roughly:
  - 🟢 done
  - 🟡 in progress + approximate %
  - ⚪ next
- systemic production-grade reusable solutions over patches
- exact verification / provenance / authority boundaries
- do not stop simply because CI is green if physical evidence or runtime acceptance is not yet proven

Current explicit instruction at checkpoint creation:
> make an urgent detailed checkpoint in a branch so a parallel chat can take over if memory ends; once checkpoint is made, continue working.

Therefore after this checkpoint commit, the active chat should immediately continue #828 runtime/failure diagnosis. A takeover chat should do the same.

---

## 14. CHECKPOINT BRANCH / SNAPSHOT ANCHOR

This document is intentionally stored on a dedicated checkpoint branch so it does not pollute PR #828.

Checkpoint branch:
`checkpoint/chat-handoff-20260915-0856-msk`

Branch was created from active PR #828 head:
`0f0e854f6a4f3980cda69578e29270cd2202eec5`

At checkpoint time live main had already advanced to:
`ee0fe701df3d9424e9cafa2add01011b41ad147f`

This mismatch is intentional: the checkpoint captures the exact active work state, while the resume instructions explicitly require a fresh live-main check before continuing.

END OF CHECKPOINT.
