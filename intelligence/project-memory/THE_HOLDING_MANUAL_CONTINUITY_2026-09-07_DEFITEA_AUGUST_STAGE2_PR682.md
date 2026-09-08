# The Holding — Manual Continuity Checkpoint

Date: 2026-09-07
Scope: Capital Scan / factual accounting roadmap
Current active stage: **Stage 2 — Defitea August factual closure**
Purpose: preserve exact working context if chat context is lost before Stage 2 is complete.

## 1. Resume order

Resume from this checkpoint only after re-reading live main/current truth in the normal project order:

1. `intelligence/project-memory/CURRENT.md`
2. latest `THE_HOLDING_MASTER_CONTINUITY_*`
3. Memory Routing Index
4. this manual checkpoint
5. live PR / workflows / physical reporting artifacts

This file is a working continuity anchor, not authority over newer live artifacts.

## 2. Roadmap spine — do not drift

The agreed sequence remains:

1. Fresh reporting / coverage / canonical ledger / monthly artifact foundations.
2. **Defitea August factual closure — CURRENT ACTIVE STAGE.**
3. Passport acceptance against factual accounting.
4. ICP NNS alignment.
5. Audit the other nine companies.
6. Historical completeness.
7. Capital flows + lifecycle semantics.
8. Lifecycle / discovery surfaces.
9. Arbitrary-wallet ingestion / public Capital Scan.

Do not jump to public scanner, broad UX, or general company audit before Defitea August is understood and closed as far as evidence permits.

## 3. Economic problem that triggered Stage 2

The core owner observation is economic, not merely technical:

- Defitea August currently recognizes only about **$13.235 factual monthly income**.
- The independent reference model for the tracked August period is about **$87.74**.
- This does **not** mean the $87.74 is factual earned income; it is a sanity-check/reference economic scale only.
- The previous statement that August was "90–95% covered" was wrong because it confused **mechanism tracking coverage** with **month / money factual completeness**.
- Correct distinction:
  - Mechanism Coverage = can the system classify/track the mechanism?
  - Period/Money Coverage = is this month’s income actually proven?
- August Period/Money Coverage remains materially partial.

Reference snapshot around 2026-08-22 showed roughly $11.56k Defitea productive capital and about 11.59% reference APR, equivalent to about $3.67/day modeled productivity. Seven mechanisms that lacked August period proof at the time represented roughly $2.54/day of reference economics, explaining why $13 factual was implausibly low versus the economic scale.

Important: these reference calculations are diagnostics only. Never backfill factual income from APR.

## 4. Defitea August mechanism state before current PR

Defitea had 11 productive mechanisms. August period evidence existed only for a minority. Major mechanisms without August factual period proof included:

- Aerodrome veAERO
- Convex vlCVX
- Pendle / sPENDLE
- Yield Basis veYB
- Venice sVVV
- Liquity LQTY
- Resupply RSUP

Curve veCRV, Frax veFRAX, f(x) veFXN and Velodrome had some August factual period evidence, but raw mechanism subtotals must never be blindly summed because Canonical Income Ledger non-overlap / recognition rules are the sole income authority.

## 5. Current active PR

PR: **#682 — Accounting: reconstruct Defitea locked-managed veAERO from August**
Branch: `accounting/defitea-august-locked-managed-history-20260907`
Branch head at checkpoint creation: `866cc075bb113256f31fe34bb87313aff1a3abf7`
Main at checkpoint inspection: `23079d4ad365503f8330d6daae334aefe9c3ab0f`

### Why this PR exists

Defitea's Aerodrome veAERO position is managed through `LockedManagedReward`. The existing locked-managed factual adapter had a factual baseline starting on **2026-09-01**, so August could never generate a locked-managed factual interval even though archive-capable ve33 infrastructure exists.

### Intended PR behavior

- move LockedManagedReward factual accounting baseline to `2026-08-01T00:00:00.000Z`;
- require exact historical managed identity using `idToManaged` + `managedToLocked` at each boundary;
- use the archive-capable provider selection already proven by ve33 infrastructure;
- value closed historical intervals only with canonical historical price evidence;
- never use current price to rewrite August;
- never use Reference APR as factual income;
- reject pre-position / wrong-managed-identity boundaries rather than inventing opening balances;
- preserve Canonical Income Ledger as sole income admission authority;
- preserve execution / wallet / claiming authority = `none`.

## 6. CI state at this checkpoint

For PR #682 head `866cc075...`:

GREEN:
- Workflow Control Plane
- Repository Hygiene Guard
- Public Surface Privacy Guard
- Commit Identity Privacy Guard
- Verify Reporting Layer
- Verify ve33 Locked Managed Accounting
- Verify ve33 Factual Accounting

RED / current blocker:
- `Verify ve33 Locked-Managed Historical Accounting`
- failing step: `Live Defitea August historical canary`

The red canary is useful evidence, not a reason to weaken the test.

## 7. New crucial evidence from the failed historical canary

The canary ran the real archive historical path and passed all static / semantic validation. It also passed the checks that require Defitea's exact locked-managed historical boundaries to exist before reaching the final event assertion.

Therefore the current evidence narrows the problem substantially:

- Defitea Aerodrome LockedManaged lane is discovered.
- Historical provider routing works sufficiently to obtain the relevant boundary state.
- Exact block-tagged **2026-08-01 opening boundary exists**.
- Exact block-tagged **2026-09-01 closing boundary exists**.
- Managed identity checks did not fail at those boundaries.
- Yet **no positive August locked-managed factual event was emitted**.

The exact failure was:

`Error: Defitea August locked-managed factual event missing`

This means the next task is no longer "can we read August state?". We can. The task is to determine why opening + closing + settlement reconciliation does not produce a positive factual interval.

Do NOT assume yet that the adapter is wrong or that veAERO definitely earned positive LockedManagedReward during August.

## 8. Root-cause hypotheses to test next — evidence first

Instrument / inspect the exact Defitea locked-managed lane and obtain:

- opening `entitlementRaw` at 2026-08-01;
- closing `entitlementRaw` at 2026-09-01;
- proven `ClaimRewards` / `withdrawManaged` settlement amount inside the interval;
- output of `reconcileEntitlement(opening, closing, settlement)`;
- managed token ID and locked reward contract at both boundaries;
- interval attribution result;
- any settlement scan/reconciliation failure count for that exact lane.

Likely branches after measurement:

A. `closing + settlement - opening > 0`
- adapter should emit positive August factual event;
- if it does not, fix event construction / interval routing / valuation path.

B. result = 0
- then LockedManagedReward itself did not accrue August income in this lane;
- investigate where Aerodrome managed strategy economics were actually represented in August (relay / free-managed reward / principal-compounding path / another contract), without treating gross veNFT principal change as income unless exact non-overlap proof exists.

C. result < 0 or settlement cannot be proven
- keep component UNKNOWN/partial and solve settlement attribution if technically recoverable.

D. historical position did not exist for whole month
- classify exact active sub-period and do not invent pre-position income.

## 9. Immediate next implementation step

Before changing methodology, add diagnostic proof to the historical canary / adapter so the CI logs print the exact Defitea August locked-managed reconciliation inputs and status. Re-run PR #682. Only after this physical evidence should the production accounting behavior be changed further.

Do not merge PR #682 while the historical canary is red.

## 10. After veAERO — next Stage 2 order

Once veAERO is resolved and materialized into Canonical Income Ledger / monthly output, re-measure Defitea August factual USD total against the reference scale.

Then continue mechanism-by-mechanism, prioritizing economically material gaps. Current next candidate is **vlCVX**.

Known vlCVX issue:
- current factual platform adapter works prospectively from sequential claimable-reward observations;
- it does not yet provide an August historical opening boundary reconstruction;
- therefore a substantial August Convex income lane can remain absent even though current tracking is active.

After vlCVX, continue the remaining August-unproven mechanisms such as Pendle, veYB, sVVV, Liquity and Resupply. For each mechanism explicitly classify historical recoverability as:

1. exact reconstruction possible;
2. partial reconstruction possible;
3. exact reconstruction impossible.

If exact historical proof is impossible, leave that lane/month partial/UNKNOWN forever. Never coerce the month toward the expected $60–90 by estimation.

## 11. September guardrail

September tracking architecture is much stronger than August because all Defitea mechanisms now have factual tracking capability, but September is still not automatically "complete" merely because tracking is active. Some mechanisms may be weekly / epoch-based / lumpy and can legitimately have zero early-month events.

Keep separate:
- active factual tracking;
- canonical event observed;
- period fully proven.

## 12. Non-negotiable accounting rules

- `UNKNOWN != 0`.
- Reference APR/APY is never factual earned-income backfill.
- Current claimable state is not period income by itself.
- Claim/withdrawal is settlement, not automatically second income.
- Gross principal delta is not income authority unless mechanism canon proves it.
- Canonical Income Ledger is sole factual income authority.
- No cross-family summation without explicit non-overlap reconciliation.
- Historical closed income must not be rewritten by later price movement.
- Historical USD valuation must use valid historical provenance; missing price stays UNKNOWN.
- Workflow green is not enough; require physically materialized artifacts.
- No wallet execution, claiming, transactions or custody authority.

## 13. Owner intent / working style that must survive context loss

The owner explicitly wants the work to remain anchored on the economic question: **are the monthly Defitea income numbers actually capturing the productive economics of the positions?** Technical progress is not sufficient if the dollars remain implausibly incomplete.

Therefore every mechanism task should end with a re-measurement of:

- factual recognized August USD;
- what mechanisms now contribute;
- what money remains UNKNOWN;
- whether the gap versus reference economics is explained by proven timing / non-income semantics or still indicates missing factual evidence.

The goal is not to make the number look close to the reference model. The goal is to explain the difference with factual evidence.

## 14. Status shorthand at checkpoint

- 🟢 Stage 1 accounting foundation: substantially established.
- 🟡 Stage 2 Defitea August factual closure: active.
- 🟡 veAERO historical reconstruction: archive boundaries proven, factual event not yet emitted; exact reconciliation diagnosis is next.
- ⚪ vlCVX August reconstruction: next major Stage 2 mechanism after veAERO.
- ⚪ Remaining Defitea August mechanisms: exact/partial/impossible audit after high-value lanes.
- ⚪ Stage 3+ roadmap: intentionally not started from this checkpoint.

End of manual continuity checkpoint.
