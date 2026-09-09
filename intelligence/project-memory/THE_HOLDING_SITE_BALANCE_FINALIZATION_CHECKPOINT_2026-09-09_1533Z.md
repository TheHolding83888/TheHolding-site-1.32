# The Holding — Site / Balance Finalization Checkpoint

Timestamp: 2026-09-09 15:33Z
Working branch: `fix/site-balance-finalization-20260909`
Checkpoint base/head before this file: `497d4c5474b971dbfda6811340b988aaf141a3ef`
Point-in-time checkpoint branch also created from that exact SHA: `checkpoint/site-balance-finalization-20260909-1533z`

## Purpose
Preserve the current pre-private site/balance finalization work so no completed reasoning or implementation is lost while the three bounded finalization packages continue.

## Completed / materially implemented on the working branch

### 1. YieldRing current FRAX principal
- `companies/yieldring-canonical-state.json` updated from 800 to **1,032 FRAX** current principal.
- The added 232 FRAX is explicit `owner-provided-current` evidence.
- Entry price/cost basis for the added 232 was not supplied, therefore it remains `UNKNOWN` / partial rather than being converted to zero.
- Existing known cost basis remains preserved as a floor: `$210.24` for the established 800 FRAX lot.
- `productivity/yieldring-productivity-overlay.mjs` now binds the current 1,032 FRAX quantity into Productivity.
- Recovery validation in `.github/workflows/update-productivity.yml` now asserts 1,032 FRAX and the partial/UNKNOWN cost-basis contract.
- `companies/yieldring-public-capital-projection.mjs` now projects 1,032 FRAX into Companies + dedicated YieldRing surface and adds a null-safe partial-cost-basis guard so incomplete cost basis cannot become fake zero performance.

### 2. Company #001 / 05081966.eth current BTC
- Added `companies/company-001-owner-capital-snapshot.json`.
- Current owner-confirmed position: **0.00126 BTC**.
- Entry price: **$77,875**.
- Cost basis: **$98.1225**.
- Evidence is explicitly `owner-provided-current` / manual current snapshot, not falsely represented as independently reproduced onchain evidence.
- `intelligence/capital-state/general-company-balance-sheet.mjs` now binds this snapshot into current total capital while keeping provenance explicit.
- `companies/owner-balance-site-projection.mjs` projects the BTC into the Registry Company Book and `/05081966/` dedicated company page.
- Dedicated-page lock copy is corrected so BTC is reserve capital rather than being falsely described as a 4-year locked cash-flow position.

### 3. Singul DIEM current valuation bridge
- `intelligence/market-data/fund-capital-registry.json` updates DIEM current explicit owner snapshot from the old fixed `$86` to **$150 total value for 0.07 DIEM**.
- Provenance is explicit: current owner-confirmed valuation snapshot, not an onchain-observed dynamic market price.
- `companies/owner-balance-site-projection.mjs` updates the dedicated Singul page to the same `$150` value so the fund registry and page cannot silently disagree.

### 4. General balance / unified refresh integration
- `intelligence/capital-state/general-company-balance-sheet.mjs` upgraded to accept provenance-explicit owner current-balance bridges for YieldRing and Company #001 while preserving `UNKNOWN != 0` and `partial cost basis != total cost basis`.
- `intelligence/capital-state/unified-capital-refresh.mjs` upgraded to v0.2.5 and now runs the owner-balance projection before Productivity / General Balance / Capital State reconstruction.
- Unified validation now checks:
  - YieldRing 1,032 FRAX;
  - YieldRing partial/UNKNOWN added-lot cost basis;
  - Company #001 0.00126 BTC + entry/cost provenance;
  - Singul DIEM $150 current snapshot;
  - Registry / dedicated-page projections;
  - no execution-authority expansion.

## Owner clarification captured now — Defitea capital identity
This is a hard invariant for the remaining work:

1. **Defitea Fund and onchain company `defitea.eth` are the same economic object viewed through two product surfaces.**
2. Therefore their **TVL must be identical**, not separately calculated competing numbers.
3. The Defitea fund/company TVL also contains the capital of **two nested onchain companies**. Their capital rolls into the Defitea economic TVL.
4. Current balance additions to those nested companies must therefore flow through into the Defitea fund/company TVL as well.
5. This is a **capital aggregation rule only**. It does NOT authorize mixing the child companies' income into Defitea's Canonical Income Ledger. Existing accounting guard remains: no YieldRing/05081966/etc factual income may be silently recognized as Defitea income.
6. One economic position must still be counted once. Fund/company parity must not create a second copy in ecosystem/network totals.

### Important implementation note
The current branch's `public-capital-engine.mjs` still values the Defitea fund directly from `defitea-canonical-state.productivePositions`, while the Registry company value comes from Capital State. This can drift and therefore must be replaced/guarded so the fund surface delegates to the same canonical Defitea company economic TVL.

Before hard-coding the nested-company identities into the aggregation rule, recover/confirm their exact canonical IDs from live/project truth; do not guess. Historical accounting remains separate from capital ownership/roll-up.

## Current branch safety
- All work remains off `main` on `fix/site-balance-finalization-20260909`.
- `executionAuthority = none` remains unchanged.
- No wallet action / capital movement / claim / vote / methodology mutation was authorized or introduced.
- Point-in-time branch preserves SHA `497d4c5474b971dbfda6811340b988aaf141a3ef` even if subsequent working commits need correction.

## Immediate next work
1. Finish Defitea fund/company TVL identity and nested-company capital roll-up with no double counting.
2. Wire the new owner-balance files/projectors into the production Unified Capital workflow trigger/validation/publish file set so updates cannot disappear on the next automatic refresh.
3. Run branch-level exact-head validation / diff inspection; fix any regressions before PR/main.
4. Finish the remaining site/cosmetic package and then proceed to bounded public cleanup + real checks + final snapshot/checkpoint before the private-migration gate.

## Non-regression rules
- `UNKNOWN != 0`.
- partial != total.
- owner-confirmed manual snapshot != independently reproduced onchain observation.
- Reference APR != realised cash flow.
- accrued/claimable != realised cash flow.
- Defitea fund TVL == defitea.eth company TVL.
- Nested-company capital may roll into Defitea TVL; nested-company income must not silently roll into Defitea factual income.
- no ecosystem/network double counting from dual fund/company representation.
- `executionAuthority = none`.
