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


## 6. Productive identity label canon

When a productive mechanism identity is already proven, Passport presentation should use one readable `Protocol · productive asset / strategy` title rather than a bare ticker or a generic protocol name. Examples include `Aerodrome · veAERO`, `Velodrome · veVELO`, `Curve · veCRV`, `Yield Basis · veYB`, `Pendle · sPENDLE`, and `f(x) Protocol · veFXN`.

This rule applies consistently across Balance Sheet and Accrued Rewards surfaces. The renderer must not downgrade a canonical specific label back to a generic `Aerodrome`, `Velodrome`, `Curve`, or similar title. Route-specific strategy identity may remain when it is more precise than the generic productive asset, such as Defitea's accepted `Velodrome · 40 Acres` route.

Reserve assets remain concise (`BTC`, `ETH`, etc.). Unknown or ambiguous mechanism identity must not be guessed merely for visual symmetry.

## 7. Supplementary income channels + position metadata · 2026-09-08

Live mobile review established a broader card contract: **position principal, productive rate, supplementary income channel and position metadata are different presentation concepts and must not compete for the same line.**

### Principal and TVL

- One Balance Sheet card represents one principal position and therefore one capital / TVL contribution.
- A supplementary monetization route such as VoteMarket does **not** create a second position card and does **not** create a second capital amount.
- `capitalDoubleCount=false` remains a hard presentation invariant.

### Productive rate versus channel decomposition

When a principal has multiple measured Reference income channels:

- the main APR/APY capsule remains the **effective total Reference rate** for that principal;
- a subordinate channel rail may disclose the components, for example `Curve fees 1.79% · VoteMarket +4.86%`;
- the rail must not repeat another `Total 6.65%` because the main capsule already owns that headline number;
- the channel rail is descriptive/reference-only and never factual income authority.

This generalizes beyond VoteMarket: future supplementary channels should use the same hierarchy rather than inventing another card geometry.

### Mobile geometry

The universal mobile Balance Sheet uses a readable two-column position book. Dense three-column desktop variants may remain on larger screens, but they must collapse to the shared mobile two-column book.

A standard productive card remains two rows:
1. title across the full card width;
2. quantity/value left + APR/APY capsule right.

A productive card with supplementary income channels becomes three rows:
1. title across the full card width;
2. quantity/value left + effective APR/APY capsule right;
3. supplementary channel rail across the full card width.

No company-specific or asset-specific CSS exception should be required for that composition.

### Position metadata

Human annotations such as `Airdrop` are metadata about acquisition/source, not part of the numeric quantity.

- Render the quantity as the primary numeric value.
- Render the annotation as a small subordinate metadata element/chip.
- Metadata may wrap within the value area on narrow screens but may never overlap the APR/APY capsule.
- Do not solve metadata collisions by shrinking one asset, moving one badge, or adding one company-specific selector.

### Reuse law

Future onchain companies inherit this surface automatically:

`principal position → optional position metadata → canonical productive rate → optional supplementary income channels`

The reusable design law is:

**position != supplementary income channel != period income event != presentation metadata**

All four may refer to the same economic position, but they keep separate semantics and separate layout responsibilities.
