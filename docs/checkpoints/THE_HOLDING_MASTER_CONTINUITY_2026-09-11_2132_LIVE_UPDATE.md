# LIVE UPDATE — PR #763 / Market Data canonical-writer cleanup

**Time:** ~2026-09-11 21:32 MSK
**Parent checkpoint:** `THE_HOLDING_MASTER_CONTINUITY_2026-09-11_2122_ARCHITECTURE_WRITER_OWNERSHIP.md`

After the urgent master checkpoint was persisted, work continued immediately.

## Fresh findings

- Active branch confirmed: `refactor/market-data-writer-ownership-20260911`
- Branch head before repair: `03d225334acbc9f569d941947015a13f89dfb95a`
- Active PR confirmed: **#763 — `Split Market Data writers by canonical ownership`**
- PR purpose exactly matches the architecture doctrine `ONE ARTIFACT -> ONE CANONICAL WRITER`.
- PR explicitly defines the writer chain:
  `Daily CoinGecko source lane -> Shared canonical Market Data -> Unified Capital/Public Capital`.

## CI failure diagnosed

One PR check, workflow `Validate Onchain Market Data`, failed in job `validate`.

Exact failing assertion:

`Real dependency failure must perform bounded CoinGecko failback`

The production selector correctly refuses CoinGecko failback older than 30 hours. The checked-in CoinGecko source snapshot is currently from Sept 9, while the onchain Shadow snapshot is Sept 11. The validator used the mutable checked-in source freshness as if it were a permanently fresh test fixture. Therefore the test itself became time-dependent and failed once the source snapshot aged beyond 30h.

This was **not** repaired by weakening the production 30h safety bound.

## Repair applied

Updated on PR #763 branch:

`intelligence/market-data/market-data-materializer-health-boundary-validation.mjs`

New commit:

`c10250e8b9c20375fe6d296326a9925e5ab2f511`

Repair semantics:

- construct an explicit fresh CoinGecko fixture for tests intended to prove bounded failback;
- keep the real production selector unchanged;
- add an explicit stale (>30h) test proving stale CoinGecko failback is rejected and authority becomes `unknown` when the onchain lane is also unhealthy;
- preserve `executionAuthority = none`.

This makes the test deterministic and strengthens, rather than weakens, the safety proof.

## Immediate CI result after repair

Fresh check-runs on `c10250e8...` show the previously failing Market Data `validate` check now **SUCCESS**. Several other visible checks (`guard`, another `validate`) were also SUCCESS; an `audit` check was still in progress at the instant inspected. No failure was present in the fresh check-run resource at that moment.

## Next actions

1. Wait for / inspect all PR #763 checks to complete.
2. Verify Workflow Control Plane result and PR mergeability.
3. Inspect PR diff for any accidental ownership or methodology change.
4. If all green and bounded, merge through normal PR path.
5. After merge, verify `main`, physical Market Data outputs, Workflow Control Plane debt reduction, and any deployment/smoke evidence.
6. Separately diagnose why the daily CoinGecko source lane has not produced a committed Sept 10/11 snapshot; do not hide that operational issue with test fixtures.
7. Continue remaining canonical-writer queue only after current atom is cleanly closed.

Live `main` remains the source of truth; fresh-check it before resuming.
