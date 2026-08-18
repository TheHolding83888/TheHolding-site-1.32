# THE HOLDING — PASSPORT RESPONSIVE UI CANON
## 2026-08-18

Purpose: preserve the accepted responsive rule for `Balance Sheet · Strategies` so future Company Passport work reuses one stable layout instead of accumulating per-asset visual nudges.

This is a **presentation canon**, not an economic methodology or data-source rule. Live Productivity / Rewards / Capital data remain canonical for the values shown.

## 1. Productive strategy rate badges

A productive Balance Sheet position may show its canonical Reference APR / APY as a soft rounded capsule visually aligned with the Accrued Rewards token-chip language.

- Measured productive rate: show `APR <rate>` or `APY <rate>` according to the canonical source metric.
- Productive mechanism with an unproven rate: show `APR Pending` / `APY Pending` as applicable.
- Unknown must never be rendered as `0%`.
- Reserve / non-productive assets do not receive a rate capsule merely for visual symmetry.
- GMX retains its accepted compact combined APY presentation and must not receive a duplicate generic badge.

## 2. Desktop / laptop canon

The accepted desktop / laptop geometry from PR #132 remains unchanged:

- productive title and value remain in the existing asset card layout;
- APR/APY capsule is right-aligned and vertically centered inside the card;
- the capsule must not be moved down selectively based on individual asset names;
- existing laptop/desktop Passport spacing and geometry must not be altered by mobile fixes.

## 3. Mobile canon

On mobile, every productive position carrying a rate capsule uses one reusable two-row composition:

- **title on row one** across the available card width;
- **value bottom-left** on row two;
- **APR/APY capsule bottom-right** on row two;
- long titles may wrap naturally without entering the capsule's space;
- the capsule uses the same placement logic for short and long titles so cards do not visually jump between different per-asset rules.

This replaces the earlier mobile absolute-center approach that could allow long strategy names such as `HyperLend · kHYPE`, `Stake DAO · 4pool stables`, `Concentrator · sdCRV`, or `Convex · staked cvxCRV` to collide with the rate capsule.

## 4. Reuse rule

Future Company Passport additions must follow this responsive pattern automatically when they participate in the canonical productive-rate badge system.

Do **not** solve future long labels by:
- moving individual capsules down with asset-specific selectors;
- shrinking individual titles until they fit;
- embedding APR/APY into the asset name merely to avoid layout work;
- changing desktop geometry to fix a mobile-only collision.

Preferred pattern:

`productive classification → canonical APR/APY binding → shared desktop badge layout → shared mobile two-row layout`

## 5. Regression guard

A Passport rate-badge change is not complete until it preserves:
- desktop right-centered capsule geometry;
- mobile two-row title / value + capsule geometry;
- reserve assets without synthetic yield badges;
- `Pending != 0%` semantics;
- GMX no-duplicate APY behavior;
- previous Company-specific Passport fixes;
- EN/RU rendering and existing mobile Passport containment.

This canon records the owner-approved design direction after mobile review on 2026-08-18. It should be treated as durable UI operating knowledge unless the owner explicitly replaces it with a newer responsive Passport canon.
