# The Holding Chat Checkpoint — Defitea + YieldRing Performance Production Close

Date: 2026-09-11
Status: production artifact closed; direct live-browser pixel verification remains a delivery-edge check
Authority: read-only continuity record; executionAuthority = none

## Owner objective

Finish the public Company Passport Performance field for Defitea and YieldRing so both display a normal numeric Performance percentage, exactly like companies with a complete historical basis. Do not show `Partial` / `частично` for these two companies once the historical cost basis is complete.

Important product rule: do **not** globally hide the generic Partial state. It remains valid for companies whose historical basis is genuinely incomplete. Defitea and YieldRing must enter the complete-basis numeric branch because their basis is now complete.

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

1. Historical Performance originally fell into the generic partial-basis branch because not every historical acquisition basis was represented.
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
7. Production Deployment Smoke #2655 / run `34609159196` succeeded on the #752 merge commit. Do not misstate it as a smoke on the later writer-generated snapshot SHA.

## Physical generated-artifact acceptance

Fresh current-main inspection of `companies/index.html` after the successful writer confirms the active Company Book contains complete basis for both companies.

Defitea:
- full explicit historical basis is materialized
- `costBasisStatus: 'complete'`

YieldRing:
- BTC `0.0334` / `$2123.11`
- AERO `678` / `$210.24`
- CVX `240` / `$371.68`
- FXS `1032` / `$279.57`
- `costBasisStatus: 'complete'`

The physically generated Performance renderer follows this branch:

```js
c.cost > 0
  ? fmtPct(c.pct)
  : (finiteUiNumber(c.partialPct)
      ? (fmtPct(c.partialPct) + ' · ' + (lang === 'ru' ? 'частично' : 'partial'))
      : ...)
```

Therefore Defitea and YieldRing, whose complete cost is positive, resolve to **plain `fmtPct(c.pct)` only**. The word Partial is not part of their intended current generated state. The generic Partial branch is intentionally preserved only for genuinely incomplete companies.

## Product decision

Do not solve this by CSS-hiding, string replacement, company-specific label suppression, or any other visual patch. The correct fix is and remains:

canonical historical basis → canonical company state → Unified Capital coherent writer → generated Company Book → numeric Performance branch.

That chain is now materially closed in the repository and generated production artifact.

## Live-delivery caveat

This chat does not have a true interactive browser session capable of clicking the deployed Passport and proving pixels. External text crawling of `theholding.ai/companies` has returned a stale/static representation and strips dynamic Passport behavior, so it is not suitable acceptance evidence.

If the owner still sees `Partial` after this production artifact exists, treat that as a **delivery/cache/deployment-edge mismatch**, not as permission to reintroduce a UI hack or to demote the canonical basis. Track the served asset / deployment edge until it matches current generated `companies/index.html`.

## Owner input requirement

No additional owner data is required for Defitea or YieldRing Performance at this point. The historical basis supplied by the owner is sufficient and canonical coverage is complete.

## Resume instructions for a parallel/new chat

1. Read live GitHub `main` first; it always wins.
2. Read `intelligence/project-memory/CURRENT.md` and latest continuity/checkpoint.
3. Use this file as the task close/handoff for Defitea + YieldRing Performance.
4. Treat the earlier `THE_HOLDING_CHAT_CHECKPOINT_2026-09-11_1636_MSK_DEFITEA_YIELDRING_PERFORMANCE_WIP.md` as superseded for task status.
5. Verify current `companies/index.html` before making any new change.
6. If `Partial` is reported visually while current artifact still has complete basis + numeric branch, investigate delivery/cache/deployment only.
7. Never claim a production UI regression is fixed from source code alone; require physical artifact and, where available, deployment/smoke evidence.

## Safety / authority

- executionAuthority: `none`
- no wallet authority
- no capital execution
- no transaction / claim / vote / transfer behavior introduced by this work
- no second source of truth for company quantities or historical basis
