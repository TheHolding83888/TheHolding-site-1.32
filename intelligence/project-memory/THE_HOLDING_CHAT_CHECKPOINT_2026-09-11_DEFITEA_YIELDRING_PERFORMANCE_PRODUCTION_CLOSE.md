# The Holding Chat Checkpoint — Defitea + YieldRing Performance Production Close

Date: 2026-09-11
Status: **production closed** — canonical basis complete, physical generated artifact numeric-only, Cloudflare production builds GREEN
Authority: read-only continuity record; executionAuthority = none

## Owner objective

Finish the public Company Passport Performance field for Defitea and YieldRing so both display a normal numeric Performance percentage, exactly like companies with a complete historical basis. Do not show `Partial` / `частично` for these two companies once the historical cost basis is complete.

Important product rule: do not hide missing-data semantics by CSS or string replacement. Defitea and YieldRing must reach the normal numeric Performance path because their historical basis is genuinely complete.

## Canonical historical basis

### Defitea
- portfolio historical cost basis: **$9,724.36**
- basis status: **complete**
- exact canonical AERO quantity: **2632.61**
- all productive positions required for the owner-confirmed historical basis have explicit cost basis
- expected Performance semantics: current canonical portfolio value vs fixed historical cost basis

### YieldRing
- portfolio historical cost basis: **$2,984.60**
- basis status: **complete**
- canonical position basis:
  - BTC: quantity `0.0334`, cost basis **$2,123.11**
  - AERO: quantity `678`, cost basis **$210.24**
  - CVX: quantity `240`, cost basis **$371.68**
  - FXS: quantity `1032`, cost basis **$279.57**
- provenance reproduction may remain pending independently, but that must not demote owner-confirmed basis coverage from complete to partial

At the owner screenshot price snapshot the approximate control values were Defitea ~+31.8% and YieldRing ~+24.4%. These are controls, not frozen UI values. The historical basis is fixed; displayed Performance moves with the current canonical valuation.

## Root-cause chain and repairs

1. Historical Performance originally fell into the partial-basis state because not every historical acquisition basis was represented.
2. PR #751, **Complete Defitea and YieldRing historical performance basis**, completed both canonical historical bases and made the public Company Book state-driven.
   - merge commit: `87e52ccb930be28dd49515ee3125f5423a9bb92c`
3. After #751, the production writer still could not publish because its final coherence validation duplicated an old rounded Defitea AERO literal `2632` while the canonical state correctly contains `2632.61`.
4. PR #752, **Bind Unified Capital quantity checks to canonical company states**, removed that duplicate numeric authority. Final validation now reads Defitea and YieldRing quantities from their canonical company state files and verifies Productivity / Capital State against those same authorities.
   - merge commit: `35de120fba867f3b1a0f7e01b36723510a9d0570`
   - paired deterministic workflow-definition proof was repaired in the same change; fail-closed review remained intact.
5. Canonical production writer **The Holding Capital · Unified Refresh** then completed successfully.
   - run #193
   - run id `34609159145`
   - head `35de120fba867f3b1a0f7e01b36723510a9d0570`
   - final result: success
   - coherent refresh, public projection rebuild, final validation and `Publish one coherent capital snapshot safely` all passed.
6. The writer produced coherent production snapshot commit:
   - `6112298e692c18704402cfec895c0d2fb5360ccf`
   - message: `capital: refresh coherent production snapshot`
7. Cloudflare built that exact generated snapshot successfully:
   - check: `Workers Builds: theholdingprotocol`
   - completed: `2026-09-11T14:20:50Z` = **17:20:50 MSK**
   - Version ID: `74dac73c-d402-4e06-87a4-852375e11cd7`
8. Later project-memory/intelligence commits advanced `main` without removing the snapshot. A compare from `6112298...` to later `main` showed `main` ahead and the snapshot as merge base.
9. Later current-main deployment was also GREEN:
   - observed main during acceptance: `dea6ed39db0219a28fdde80f201b1ce694c0313f`
   - check: `Workers Builds: theholdingprotocol`
   - completed: `2026-09-11T14:29:24Z` = **17:29:24 MSK**
   - Version ID: `b093d35f-6018-4079-af7e-256a9defe4b3`
10. Production Deployment Smoke #2655 / run `34609159196` had already succeeded on the #752 merge commit. Do not misstate it as a smoke on the later writer-generated snapshot SHA; the Cloudflare checks above are the exact deployment proof for the generated snapshot and descendant main.

## Physical generated-artifact acceptance

Fresh current-main inspection of `companies/index.html` after the successful writer confirms the active Company Book contains complete basis for both companies.

Defitea:
- full explicit historical basis is materialized
- exact AERO quantity `2632.61`
- all relevant rows have explicit `costBasisUsd`
- `costBasisStatus: 'complete'`

YieldRing:
- BTC `0.0334` / `$2123.11`
- AERO `678` / `$210.24`
- CVX `240` / `$371.68`
- FXS `1032` / `$279.57`
- `costBasisStatus: 'complete'`

The physically generated Company Passport headline renderer now uses the normal complete-basis path:

```js
econ(
  L.performance,
  c.cost > 0
    ? fmtPct(c.pct)
    : (c.performancePending ? (lang === 'ru' ? 'Ожидается' : 'Pending') : '—')
)
```

The current public Passport renderer therefore contains **no `Partial` / `частично` label in the Performance headline path**. Defitea and YieldRing both have `c.cost > 0`, so they resolve to **plain numeric `fmtPct(c.pct)` only**.

The underlying data model may still retain partial/unavailable states for truthful diagnostics and methodology. Those states are not to be surfaced as the Defitea/YieldRing Performance headline now that their basis is complete.

## Product decision

Do not solve this by CSS-hiding, string replacement, company-specific label suppression, or any other visual patch. The correct chain is:

canonical historical basis → canonical company state → Unified Capital coherent writer → generated Company Book → numeric Performance branch → Cloudflare production build.

That chain is now materially closed end-to-end.

## Live-delivery acceptance note

The GitHub/Cloudflare deployment evidence now proves that the corrected physical generated artifact was built into production, first at `17:20:50 MSK` for snapshot `6112298...` and again at `17:29:24 MSK` for a descendant current-main commit.

The generic web text crawler available to ChatGPT can return a stale/cached textual representation and does not provide reliable click-level Passport acceptance, so it must not override GitHub physical-artifact + exact Cloudflare-build evidence.

If the owner still sees `Partial` in Defitea or YieldRing **after the 17:29 MSK deployment**, first hard-refresh/reopen the page because that would contradict the deployed current artifact. If it persists after a fresh page load, treat it as a concrete browser/CDN delivery incident and inspect the served response/runtime before changing canonical accounting or reintroducing UI hacks.

## Owner input requirement

**No additional owner data is required for Defitea or YieldRing Performance.** The historical basis supplied by the owner is sufficient and canonical coverage is complete.

## Resume instructions for a parallel/new chat

1. Read live GitHub `main` first; it always wins.
2. Read `intelligence/project-memory/CURRENT.md` and latest continuity/checkpoint.
3. Use this file as the final task close/handoff for Defitea + YieldRing Performance.
4. Treat the earlier `THE_HOLDING_CHAT_CHECKPOINT_2026-09-11_1636_MSK_DEFITEA_YIELDRING_PERFORMANCE_WIP.md` as superseded for task status.
5. Verify current `companies/index.html` before making any new change.
6. Defitea/YieldRing expected public Performance = a plain signed percentage, no Partial label.
7. If `Partial` is reported visually while current artifact still has complete basis + numeric branch, investigate the actual served response/cache/runtime first; do not demote basis or add a cosmetic suppression patch.
8. Never claim a future production UI regression is fixed from source code alone; require physical artifact and deployment evidence.

## Safety / authority

- executionAuthority: `none`
- no wallet authority
- no capital execution
- no transaction / claim / vote / transfer behavior introduced by this work
- no second source of truth for company quantities or historical basis
