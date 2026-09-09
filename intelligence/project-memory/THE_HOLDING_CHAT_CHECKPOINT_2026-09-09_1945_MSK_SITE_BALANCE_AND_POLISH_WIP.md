# The Holding — Chat Checkpoint
## 2026-09-09 19:45 MSK · Site Balance Finalization + Public Polish WIP

Status: **WORK IN PROGRESS — SAFE HANDOFF POINT**
Branch: `fix/site-balance-finalization-20260909`
Last known branch head before this checkpoint: `497d4c5474b971dbfda6811340b988aaf141a3ef`
Authority boundary: `executionAuthority = none`

This checkpoint exists because the active chat is long and the owner explicitly requested that work be physically preserved before continuing.

---

## 1. Owner intent / sequencing

Complete the three user-supplied public-site packages in a production-grade way, not as isolated cosmetic patches.

Current sequence:
1. Capital / balances / TVL / price-source coherence.
2. Companies-page copy + side panel + homepage nav/footer polish.
3. Defitea Yield Reports mobile polish + Holding Graph APR/source audit + clickable fund pyramid.
4. Full repeat audit across all public TVL surfaces, workflows, price authority and generated state.
5. Then continue the canonical pre-private roadmap: bounded final cleanup -> real checks -> final checkpoint/snapshot -> GREEN confirmation -> backup/private boundary.

Do not start Capital Flow Semantics while repo remains public.

---

## 2. Critical owner clarification received at 19:45 MSK

**Defitea Fund and onchain company `defitea.eth` are economically the same entity and their TVL must match.**

The Defitea fund/company TVL also includes **two additional constituent companies**. Therefore:
- do NOT split Defitea Fund TVL from `defitea.eth` TVL as separate economic totals;
- do NOT create double counting between the fund surface and company network surface;
- additional balance updates to `defitea.eth` are also updates to the Defitea fund/company balance;
- verify the exact two constituent-company identities from current canonical code/evidence before changing aggregation; if ambiguity remains, ask the owner instead of guessing.

This clarification supersedes the earlier WIP suspicion that Defitea Fund and `defitea.eth` should be separated.

---

## 3. User package #1 — requested current balances

### Singul Fund
Owner-provided current quantities:
- MANA 486
- SAND 853
- OVR 838
- OLAS 1180
- VIRTUAL 669
- BEAM REMOVE
- MODE 1,000,000
- ELIZAOS 80,808
- DIEM 0.07

DIEM requirement:
- first preference: validated blockchain/onchain price route;
- if no valid route can be proven now: explicit static current valuation of **$150 total for 0.07 DIEM**;
- never mislabel that static value as onchain-observed market price.

### Defitea Fund / defitea.eth
Owner-provided current quantities:
- veAERO 2,632
- vlCVX 1,333
- veCRV 4,125
- PENDLE 500
- veFXN 64.81
- veYB 10,846
- veFRAX 4,456  ← changed from 4,224
- veVELO 12,180
- sVVV 50
- LQTY 1,488
- RSUP 3,682

Important: Defitea Fund == defitea.eth economic entity; exact aggregation with its two constituent companies must be preserved.

### 05081966.eth
Current quantities:
- AERO 202
- FRAX 393 — current Frax branding; user explicitly says this is former FXS and is now a cash-flow-generating company asset
- CRV 480
- BTC 0.00126 NEW

BTC entry price supplied by owner: **$77,875**
Cost basis: **$98.1225**
Requirement:
- include BTC in Company Book / Passport / TVL / network totals;
- performance must use supplied entry price and current canonical BTC market price;
- provenance must remain owner-confirmed manual current snapshot until blockchain-native balance discovery reproduces it.

### YieldRing.eth
Current quantities:
- BTC 0.0334
- veAERO 678
- vlCVX 240
- veFRAX 1,032  ← changed from 800

No acquisition price/cost basis was supplied for the added 232 FRAX.
Therefore:
- current quantity may be used for current-capital valuation;
- added-lot cost basis remains UNKNOWN;
- do not use zero cost basis and do not invent performance for the unknown lot.

---

## 4. Changes already physically written on WIP branch

### A. YieldRing canonical state
File: `companies/yieldring-canonical-state.json`
- veFRAX quantity changed to 1,032.
- known original 800-FRAX lot retained at $210.24 cost basis.
- added 232 FRAX lot recorded with `entryPriceUsd:null`, `costBasisUsd:null`.
- `costBasisStatus:'partial'` and UNKNOWN != 0 semantics preserved.

### B. YieldRing Productivity overlay
File: `productivity/yieldring-productivity-overlay.mjs`
- now binds YieldRing Frax Productivity row to canonical current quantity 1,032.
- adds provenance and partial cost-basis diagnostics.
- keeps execution authority none.

### C. Productivity recovery workflow guard
File: `.github/workflows/update-productivity.yml`
- deterministic checks extended to require YieldRing FRAX 1,032 and partial/UNKNOWN cost basis semantics.

### D. Singul DIEM current static bridge
File: `intelligence/market-data/fund-capital-registry.json`
- DIEM 0.07 set to explicit owner-provided current valuation snapshot of $150 total.
- explicitly states it is NOT an onchain-observed price.
- NOTE: other Singul owner quantity updates are NOT yet all applied in this file; this is still WIP.

### E. Company #001 owner snapshot
New file: `companies/company-001-owner-capital-snapshot.json`
- records 0.00126 BTC
- entry $77,875
- cost basis $98.1225
- provenance `owner-confirmed-manual-current-snapshot`
- explicitly not independently reproduced onchain.

### F. General Company Balance bridge
File: `intelligence/capital-state/general-company-balance-sheet.mjs`
- reads YieldRing canonical state rather than trusting stale browser quantity for current YieldRing principal.
- overlays Company #001 BTC owner snapshot.
- keeps current market valuation on canonical shared Market Data.
- marks manual snapshot provenance explicitly.
- adds gaps for YieldRing partial FRAX cost basis and Company #001 manual BTC evidence.

### G. YieldRing public/capital projection
File: `companies/yieldring-public-capital-projection.mjs`
- projects 1,032 FRAX into Company Book and dedicated YieldRing page.
- modifies Company Book performance helper so incomplete cost basis produces UNKNOWN performance rather than `null -> 0` or an invented cost basis.
- updates General Balance expected browser blob hash after projection.

### H. Owner balance site projection
New file: `companies/owner-balance-site-projection.mjs`
- projects Company #001 BTC into Company Book and dedicated `05081966` page.
- updates Company #001 protocol/asset list to include Bitcoin.
- fixes Company #001 lock copy so BTC is not falsely described as a four-year locked cash-flow asset.
- projects DIEM $150 language into Singul dedicated page.
- updates General Balance browser blob proof after projection.

### I. Unified Capital Refresh
File: `intelligence/capital-state/unified-capital-refresh.mjs`
- version advanced in WIP to include owner-balance site projection before Productivity collection.
- assertions added for:
  - YieldRing 1,032 FRAX;
  - partial/UNKNOWN YieldRing FRAX cost basis;
  - Company #001 BTC 0.00126 / $77,875 / $98.1225;
  - Singul DIEM $150 manual snapshot;
  - dedicated-page / Registry projections.

IMPORTANT: this branch has not yet completed CI and is not merged to main.

---

## 5. Important findings from price / TVL audit so far

### Canonical market layer
Fresh canonical Market Data had 26/26 selected onchain price lanes, CoinGecko fallback 0 at the inspected snapshot.
Canonical design intent remains:
- onchain Market Data refreshed approximately every 30 minutes by its own market-data workflow;
- CoinGecko is a bounded fallback / low-frequency lane, not the browser authority.

### Browser legacy tails found
`05081966/index.html` and `yieldring/index.html` still contain old direct browser CoinGecko code and old local cache/update language.
These pages need to be moved onto `public-capital-client.js` / canonical local snapshot rather than direct external CoinGecko calls.

Singul also contains legacy local TVL code, but its `/intelligence/market-data/simple-price` route is intercepted by the public capital client on pages where that client is loaded. It still needs cleanup/coherence review so there is one clear authority and no misleading 5-minute browser refresh semantics.

### Substantia silver tail
Public fund registry still contains legacy silver valuation through XAUT ratio even though a newer onchain silver route exists in Market Data. This should be reviewed and, if validated, promoted to canonical shared market pricing rather than retaining the ratio workaround.

### DIEM
No validated dynamic DIEM route is currently promoted in the inspected onchain source registry. Static $150 bridge is therefore currently honest; further source research may continue, but no fake live price.

### Public Capital engine
`intelligence/market-data/public-capital-engine.mjs` currently values Defitea directly from `defitea-canonical-state.json` only. The owner's new clarification means Defitea aggregation must be re-audited before finalizing: the Fund and `defitea.eth` TVL are the same economic entity and must also include the two constituent companies without double counting.

---

## 6. User package #2 — queued after capital truth

### Companies page
Review current copy against evolved product reality. Make only meaningful updates, no rewriting for the sake of rewriting.
Review right-side informational drawer as well.
Russian translation must remain natural/premium.
If a proposed change is conceptually large, ask owner first in simple Russian; minor factual/editorial updates may be done directly.

### Homepage navigation
Hamburger menu currently needs:
- Companies link
- Real Estate link
Fit compactly/premium without breaking existing layout.

### Homepage footer
Add Real Estate link in an appropriate section, likely Resources.
Replace the overly narrow footer line `Personal on-chain companies, self-custodied, not financial advice.` with a concise description of The Holding as a whole: funds + Index + onchain companies + real estate / capital architecture.

---

## 7. User package #3 — queued after package #2 / data authority dependencies

### Defitea Yield Reports mobile
Page: `/yield-reports/`
Fix mobile overflow / numbers escaping right edge / overly wide composition. Preserve desktop quality.

### The Holding Graph
Audit all displayed percentages/APRs and whether they come from canonical Productivity/Passport sources.
Goal: one daily canonical APR/productivity authority, no independent stale manual graph percentages.
Check graph for other errors while there.

### Homepage fund pyramid
Make all five pyramid fund layers clickable:
- Defitea -> Defitea page
- Fructus -> Fructus page
- Singul -> Singul page
- Substantia -> Substantia page
- Monetra -> Monetra page

---

## 8. Next exact actions for continuation

1. Open a draft PR from `fix/site-balance-finalization-20260909` to `main` so CI becomes visible and WIP defects surface early.
2. Resolve the Defitea aggregation rule with current canonical repo evidence:
   - confirm the exact two constituent companies;
   - make Defitea Fund TVL == defitea.eth TVL by construction;
   - include those two constituents exactly once;
   - avoid duplicate network aggregation semantics.
3. Apply remaining owner quantities:
   - Singul MANA 486 / SAND 853 / OVR 838 / OLAS 1180 / VIRTUAL 669 / remove BEAM / MODE 1m / ELIZAOS 80808 / DIEM 0.07 $150 fallback;
   - Defitea veFRAX 4456.
4. Move `05081966` and YieldRing dedicated pages off direct browser CoinGecko onto canonical local Public Capital / Market Data client.
5. Review Singul old local 5-minute TVL loop and Substantia legacy silver XAUT-ratio tail.
6. Re-run / inspect CI, fix branch until capital truth is green.
7. Continue packages #2 and #3 in the same or follow-up PRs depending change surface/risk.
8. Write another checkpoint before any chat handoff.

---

## 9. Safety / non-goals

- No wallet actions.
- No capital movement.
- No claims / votes / transactions.
- No execution authority expansion.
- UNKNOWN != 0.
- Partial cost basis != full cost basis.
- Manual current snapshot != onchain observation.
- Do not merge WIP just to make progress visible; use PR/CI first.
- Do not start post-private Capital Flow Semantics while repository remains public.
