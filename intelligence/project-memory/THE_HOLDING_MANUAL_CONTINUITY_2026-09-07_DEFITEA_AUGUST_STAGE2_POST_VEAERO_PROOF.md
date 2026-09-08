# The Holding — Manual Continuity Checkpoint · Defitea August Stage 2 · POST veAERO PROOF

Date: 2026-09-07
Roadmap stage: **Stage 2 — Defitea August factual closure**
Status at checkpoint: **veAERO historical factual reconstruction proven in live CI; PR #682 not yet merged/materialized**

This checkpoint supersedes the unresolved-veAERO working state in `THE_HOLDING_MANUAL_CONTINUITY_2026-09-07_DEFITEA_AUGUST_STAGE2_PR682.md` for the veAERO subtask. It does not supersede newer live main/current truth.

## Resume order after context loss

1. Read live `intelligence/project-memory/CURRENT.md`.
2. Read latest master continuity.
3. Read Memory Routing Index.
4. Read Capital Scan Master Canon + History Roadmap.
5. Read the prior Stage-2 checkpoint.
6. Read this POST-veAERO checkpoint.
7. Re-inspect live main, PR #682 or its merge result, workflow runs, and physically materialized accounting artifacts.

Never treat PR numbers / SHAs here as current without re-checking live GitHub.

---

## Roadmap spine — preserve exactly

1. Fresh reporting / coverage / canonical ledger / monthly artifact foundations.
2. **Defitea August factual closure — ACTIVE.**
3. Passport acceptance.
4. ICP NNS alignment.
5. Audit other nine companies.
6. Historical completeness.
7. Capital flows + lifecycle semantics.
8. Lifecycle / discovery.
9. Arbitrary-wallet ingestion / public Capital Scan.

Do not jump forward while the Defitea August money gap remains unexplained.

---

## Economic anchor

The owner challenged the August Defitea report because factual recognized income was only about **$13.23542516**, while the independently modeled economics for the tracked August period were about **$87.74**.

The $87.74 is a reference sanity-check, NOT factual earned income and never a backfill target.

The real Stage-2 objective is:

> Explain the gap mechanism-by-mechanism with factual historical evidence, or explicitly leave irrecoverable money UNKNOWN.

Never force the factual total toward $60–90 merely because that range feels economically plausible.

---

# veAERO historical reconstruction — FACTUALLY PROVEN

Active PR at checkpoint:
- PR #682 — `Accounting: reconstruct Defitea locked-managed veAERO from August`
- branch: `accounting/defitea-august-locked-managed-history-20260907`

## Root cause found

Defitea's Aerodrome veAERO position is a managed veNFT whose locked reward accrual lives in `LockedManagedReward`.

The pre-fix adapter had factual locked-managed accounting start at **2026-09-01**, so August could not generate a factual interval at all.

After moving the factual boundary to 2026-08-01, the first historical attempt still emitted no August event because the adapter attempted historical `ClaimRewards` log reconciliation for every interval. RPC log scanning failed, and those failures were converted into reconciliation failures even though exact boundary state itself was readable.

Official Aerodrome contract semantics were then inspected. `LockedManagedReward` exposes `earned(token, tokenId)` and `lastEarn(token, tokenId)`. `lastEarn` is updated when the reward is actually settled through the managed-withdraw path. Therefore, if exact historical opening and closing block-tagged `lastEarn` values are identical, the interval has a direct contract-state proof that no settlement occurred; settlement can be safely fixed at zero without guessing or APR inference.

Production adapter now:
- reads exact `earned` + `lastEarn` at historical boundaries;
- requires exact historical managed identity (`idToManaged` + `managedToLocked`);
- if `lastEarn` is unchanged between exact boundaries, proves settlement = 0;
- if `lastEarn` changed, still requires real settlement log reconciliation and fails closed if unavailable;
- compacts redundant checkpoints while preserving month boundaries / event proof endpoints / latest state;
- uses historical canonical price provenance for closed months;
- keeps Reference APR out of factual income;
- keeps execution authority `none`.

---

## Live CI proof — exact values

Workflow:
- `Verify ve33 Locked-Managed Historical Accounting`
- run #11
- run id `34154290318`
- result: **SUCCESS**

Live Defitea Aerodrome lane:
- company: `defitea.eth`
- veNFT tokenId: `103935`
- managedTokenId: `10298`
- LockedManagedReward: `0xC6631c68f00A5c89927fada25c70934D922329EF`
- reward token: AERO `0x940181a94A35A4569E4529A3CDfB74e38FD98631`

### Exact opening boundary — 2026-08-01
- block: `49376526`
- earned raw: `95103303759077476278`
- earned: **95.103303759077 AERO**

### Exact closing boundary — 2026-09-01
- block: `50715726`
- earned raw: `118250670887559382187`
- earned: **118.250670887559 AERO**

### Factual August delta
- raw delta: `23147367128481905909`
- earned during period: **23.147367128482 AERO**
- proven settlement raw: **0**
- settlement event count: **0**

### Historical USD valuation
- factual USD value: **$10.94909399**
- valuation state: `historical-canonical-market-price-frozen-at-closing-accounting-boundary`
- historical price resolution count: 1
- unresolved historical price count: 0
- selected archive-capable Base provider in canary: `mainnet.base.org`

### Canary diagnostics
- accepted positive intervals: 2
- zero intervals: 0
- reconciliation failures: **0**
- unresolved settlements: **0**
- unvalued intervals: **0**
- historical boundary failures: **0**
- execution authority: `none`

This is not modeled APR income. It is exact historical block-tagged contract-state accrual with settlement continuity proof and historical price provenance.

---

## Economic implication — provisional until main materialization

Previous Defitea August factual monthly recognized USD:
- ~$13.23542516

New factual veAERO event candidate:
- +$10.94909399

Simple provisional arithmetic:
- **~$24.18451915**

This is NOT yet the official materialized August total because Canonical Income Ledger is the only authority and may apply non-overlap / recognition rules. The number must be read again from physical main artifacts after merge and writer completion.

Therefore do not report `$24.1845` as final until post-merge physical verification.

---

# Immediate resume task

Before moving to vlCVX:

1. Re-check all PR #682 CI at the latest head.
2. Fix any remaining red workflows.
3. Merge only when required checks are green and PR is mergeable.
4. Wait for / inspect `Update The Holding Reporting Data` downstream publication.
5. Verify physical main artifacts, not just workflow green:
   - `reporting/ve33-locked-managed-accounting-evidence.json`
   - `reporting/income-ledger.json`
   - `reporting/accounting-coverage.json`
   - `reporting/company-monthly-reports.json`
6. Read Defitea August from the materialized monthly report.
7. Record:
   - exact new factual recognized USD;
   - exact contribution from veAERO;
   - which mechanisms remain UNKNOWN / partial;
   - remaining gap vs ~$87.74 reference economics.

Only then mark veAERO subtask fully green.

---

# Next Stage-2 mechanism — vlCVX

Once veAERO is physically materialized, next economically material gap is **vlCVX**.

Current main adapter already has prospective factual tracking based on sequential `claimableRewards` observations and `RewardPaid` continuity proof, but it lacks a full historical August opening-boundary reconstruction.

For vlCVX, preserve the same factual discipline:

1. Determine exact August historical state source(s).
2. Determine whether opening / closing reward entitlement can be reconstructed at exact blocks.
3. Reconcile any reward settlements/claims in-period.
4. Separate platform rewards, delegate/Votium incentives, and other reward families to prevent double-counting.
5. Use historical canonical valuation only.
6. Classify result as:
   - exact historical reconstruction possible;
   - partial reconstruction possible;
   - exact reconstruction impossible.
7. Re-measure Defitea August factual USD after materialization.

Do not move to Pendle / veYB / sVVV / Liquity / Resupply until vlCVX, as the larger economic lane, is understood first unless evidence proves a different priority.

---

## Remaining August mechanisms after veAERO proof

Still needing Stage-2 historical closure / explicit recoverability classification:
- vlCVX
- PENDLE / sPENDLE
- veYB
- sVVV
- LQTY
- RSUP

Some existing Curve / Frax / f(x) / Velodrome evidence is already factual but monthly completeness can still remain partial due valuation, boundary, or recognition constraints.

---

## September guardrail

September is structurally stronger because active factual tracking exists across all Defitea mechanisms, but tracking capability != period completeness.

Keep separate:
- mechanism tracked;
- canonical factual event observed;
- month fully proven.

Weekly / epoch / lumpy mechanisms can legitimately have zero events early in a month. Zero must be proven or explicitly remain unknown; it cannot be inferred from silence.

---

## Non-negotiable rules

- `UNKNOWN != 0`.
- Reference APR/APY never backfills earned income.
- Current claimable balance is state, not automatically period income.
- Claim / withdrawal is settlement, not second income.
- Gross veNFT principal delta is not income authority.
- Canonical Income Ledger is sole earned-income authority.
- No cross-family summation without non-overlap reconciliation.
- Closed historical income never uses future/current price.
- Missing historical valuation remains UNKNOWN.
- Green workflow != physical artifact.
- No wallet execution, claiming, custody, transaction, or methodology-expansion authority.

---

## Owner-intent invariant

At every Stage-2 mechanism closure, explicitly answer the economic question:

> How much factual August income did this mechanism add, how much of the original ~$13.24 → ~$87.74 gap is now explained, and what remaining dollars are still UNKNOWN rather than silently treated as zero?

Technical green without this monetary reconciliation is not sufficient closure.

End checkpoint.
