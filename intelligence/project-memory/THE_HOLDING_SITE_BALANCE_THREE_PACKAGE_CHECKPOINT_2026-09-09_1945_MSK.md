# The Holding · Site / Balance Finalization · Three-Package Checkpoint

**Checkpoint time:** 2026-09-09 19:45 MSK  
**Working branch:** `fix/site-balance-finalization-20260909`  
**Branch checkpoint head before this file:** `497d4c5474b971dbfda6811340b988aaf141a3ef`

## Purpose
Durable handoff for the pre-private cosmetic/current-capital stage. Continue from this branch; do not restart completed public-foundation/accounting work.

## Owner clarification — Defitea
Defitea Fund and onchain company `defitea.eth` are one economic scope and their published TVL must match. The Defitea scope also includes its two constituent onchain companies; additions to the Defitea company balance are therefore additions to the Fund/company economic scope as well. Do not publish a separate contradictory Fund TVL and company TVL. Before final merge, verify the exact constituent-company aggregation already encoded by the live system and preserve the established no-double-count semantics.

## Package 1 — owner balance changes supplied
### Singul
Target current quantities supplied by owner:
- MANA 486
- SAND 853
- OVR 838
- OLAS 1180
- VIRTUAL 669
- BEAM remove
- MODE 1,000,000
- ELIZAOS 80,808
- DIEM 0.07
DIEM: first preference is a validated dynamic/onchain price route. None is currently promoted in the onchain registry. Temporary fallback approved by owner: explicit current total valuation **$150 for 0.07 DIEM**, clearly marked owner-confirmed/manual, never represented as onchain-observed price.

### Defitea
Target current quantities:
- veAERO 2,632
- vlCVX 1,333
- veCRV 4,125
- PENDLE 500
- veFXN 64.81
- veYB 10,846
- veFRAX 4,456
- veVELO 12,180
- sVVV 50
- LQTY 1,488
- RSUP 3,682
Important: Defitea Fund = defitea.eth economic scope; TVL parity required.

### 05081966.eth
Target current positions:
- AERO 202
- FRAX 393 (current branding; formerly FXS; productive cash-flow asset)
- CRV 480
- BTC 0.00126
BTC owner-provided entry price: **$77,875**; resulting cost basis = **$98.1225**. Add BTC to card/passport/TVL/network TVL and performance where cost basis is complete. Provenance must remain owner-confirmed manual current snapshot until blockchain-native discovery reproduces it.

### YieldRing.eth
Target current positions:
- BTC 0.0334
- veAERO 678
- vlCVX 240
- veFRAX 1,032
Added 232 FRAX has no supplied acquisition price. Current principal may be valued at current canonical price, but performance/cost basis must remain **partial/UNKNOWN**, not zero and not guessed.

## Package 1 — changes already physically committed on working branch
1. `companies/yieldring-canonical-state.json`
   - FRAX principal updated to 1,032.
   - Existing 800-FRAX cost basis preserved ($210.24 known).
   - Added 232-FRAX lot recorded with `entryPriceUsd:null`, `costBasisUsd:null`.
   - `costBasisStatus: partial`, `costBasisUsd:null`; UNKNOWN != 0 preserved.

2. `intelligence/market-data/fund-capital-registry.json`
   - DIEM explicit owner snapshot changed from old $86 to **$150 total for 0.07** with provenance.
   - NOTE: remaining Singul target quantity edits still need to be applied (MANA/SAND/OLAS etc., BEAM removal).

3. `productivity/yieldring-productivity-overlay.mjs`
   - YieldRing FRAX quantity now binds to canonical state instead of stale 800.
   - current FRAX current-value/productivity valuation updates with 1,032 units.
   - partial cost-basis diagnostic preserved.

4. `.github/workflows/update-productivity.yml`
   - validation expanded to require YieldRing FRAX 1,032 and preserve partial/UNKNOWN cost-basis semantics.

5. `companies/company-001-owner-capital-snapshot.json`
   - new provenance-explicit owner snapshot for 05081966 BTC 0.00126 @ $77,875; cost basis $98.1225.

6. `intelligence/capital-state/general-company-balance-sheet.mjs`
   - now binds `yieldring-canonical-state.json` and Company #001 owner snapshot.
   - YieldRing 1,032 FRAX included in current capital.
   - 05081966 BTC included in Foundation current capital using canonical shared market price.
   - provenance/UNKNOWN semantics surfaced explicitly.

7. `companies/yieldring-public-capital-projection.mjs`
   - projects 1,032 FRAX into Registry/dedicated page.
   - Registry performance helper changed to null-safe/partial cost-basis logic so missing acquisition basis does not become zero or NaN-derived fake performance.

8. `companies/owner-balance-site-projection.mjs`
   - new bounded projection bridge.
   - projects 05081966 BTC into Company Book/dedicated page and protocol list.
   - changes 05081966 lock copy so BTC is not falsely described as a four-year locked productive position.
   - projects DIEM $150 snapshot to Singul page.

9. `intelligence/capital-state/unified-capital-refresh.mjs`
   - upgraded orchestration to include owner-balance projection before Productivity/General Balance/Capital State.
   - validation now checks YieldRing 1,032 FRAX, partial basis, 05081966 BTC and DIEM $150 provenance.

## TVL / price audit findings already established
- Canonical Market Data architecture is onchain-first; most recent checked snapshot had **26/26 canonical market assets selected from onchain lanes and CoinGecko fallback = 0**.
- CoinGecko is intended as bounded fallback/daily lane, not ordinary browser runtime authority.
- Main/Substantia/Defitea/Singul/Monetra use shared `public-capital-client`/canonical state paths.
- Legacy dedicated `05081966` and `YieldRing` pages still contain direct browser CoinGecko code. This is a real cleanup tail: migrate them to shared local canonical Market Data/Public Capital and remove browser external price calls.
- Singul legacy page still contains its own five-minute simple-price calculation. Public client intercepts/localizes it on connected surfaces, but the redundant local calculation should be retired rather than kept as duplicated TVL logic.
- Substantia silver uses legacy XAUT ratio despite a dedicated onchain silver price existing in the newer Market Data layer; review and migrate if current dedicated silver route is proven canonical.
- DIEM has no promoted dynamic/onchain route; current owner-approved fallback is $150 total and must remain explicit.

## Defitea clarification requiring immediate reconciliation
Owner clarified at 19:45 MSK: Defitea Fund and onchain company `defitea.eth` are the same economic scope and TVL must match, including two constituent onchain companies. Earlier analysis incorrectly framed their parity as a possible architectural defect. Correct action: inspect the established aggregation/constituent relationship and ensure Fund TVL, defitea.eth TVL, homepage pyramid and Holding totals use the same economic scope with no double-count. Also update veFRAX target from 4,224 to **4,456** everywhere canonical.

## Package 2 — queued after data truth
- Review `/companies/` landing-page copy against current architecture; only make meaningful non-radical edits without owner confirmation.
- Review right-side informational drawer and RU translation parity.
- Homepage hamburger: add Companies and Real Estate compactly.
- Homepage footer: add Real Estate.
- Replace overly company-specific footer strapline with concise Holding-wide description covering funds / Index / onchain companies / real estate.
- Any materially different positioning/copy must be shown to owner in Russian before implementation.

## Package 3 — queued
- `/yield-reports/` Defitea mobile responsive polish; fix numbers overflowing/rightward and overly loose layout.
- The Holding Graph: verify APR/% values against canonical Productivity/Passport source; unify to daily canonical updates, remove stale/manual split if found; audit graph errors.
- Homepage five-level fund pyramid: each fund block clickable to its dedicated fund page.

## Required sequencing from here
1. Re-fetch live `main`, compare branch drift; do not overwrite parallel generated commits.
2. Reconcile Defitea economic-scope aggregation and update veFRAX to 4,456 canonically.
3. Finish Singul target quantities and BEAM removal.
4. Remove legacy direct-browser CoinGecko/runtime duplicate TVL paths; bind dedicated pages to canonical local shared data.
5. Rebuild/validate Capital State + Public Capital; verify company/fund/Holding aggregates and pyramid parity.
6. Open PR for Package 1 and use Actions as durable validation/execution surface; merge only after exact-head green and materialized state proof.
7. Package 2 copy/navigation/footer pass.
8. Package 3 mobile reports/Graph/pyramid pass.
9. Full system TVL/source/workflow re-audit, then move to the previously agreed Final Public Cleanup stage.

## Hard invariants
- executionAuthority = none
- UNKNOWN != 0
- partial != total
- current price may value current principal; unknown acquisition basis must not fabricate performance
- owner-confirmed manual snapshots are not onchain observations
- no browser external CoinGecko dependence for canonical public TVL
- no double-count across Fund/company/constituent aggregation
- do not start Capital Flow Semantics before private-mode boundary
