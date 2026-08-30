# The Holding Realty

## Product role

The Holding Realty is a multi-page property discovery and intelligence vertical inside The Holding.

It is deliberately **not** a one-page marketing landing and deliberately **not** a replacement marketplace.

Long-term product direction:

`Discover → normalize → verify → compare → save → map → remember → explain → alert → route`

The strategic analogy is a property-native combination of a discovery portal, market terminal and aggregation layer across physical/tokenized real estate and digital/metaverse property.

## Current routes

- `/realty/` — two-world portal and market board
- `/realty/markets/` — normalized Market Directory
- `/realty/market/?id=...` — market/provider profile with ownership, entry, income, return, liquidity, coverage and source lineage
- `/realty/atlas/` — physical geographic discovery using explicit city/market precision
- `/realty/physical/` — tokenized physical real-estate explorer
- `/realty/income/` — investor Income Layer
- `/realty/digital/` — metaverse/digital-property explorer
- `/realty/worlds/` — world-native spatial discovery for digital property
- `/realty/data-health/` — deterministic observation-age and review-priority surface
- `/realty/history/` — append-only Property Memory / History Explorer
- `/realty/compare/` — Reality Lens and up-to-four-property shortlist
- `/realty/watchlist/` — browser-local saved assets
- `/realty/sources/` — source/access/media/commercialization governance
- `/realty/property/?id=...` — physical property detail
- `/realty/parcel/?id=...` — digital parcel detail

## Current machine-readable contracts

- `/realty/data/market-snapshot.json` — current source-linked property/parcel observations + Market Directory
- `/realty/data/market-profiles.json` — market-level ownership, minimum-entry, income, return, liquidity, geography and coverage semantics
- `/realty/data/platform-economics.json` — platform-level investor access/income semantics used by Income Layer
- `/realty/data/source-governance.json` — conservative source access/media/commercialization policy
- `/realty/data/property-media.json` — exact third-party property-media provenance and display policy
- `/realty/data/atlas.json` — physical geographic anchors and precision contract
- `/realty/data/world-spatial.json` — digital-world coordinate adapters; reads coordinates from canonical market records instead of duplicating mutable market truth
- `/realty/data/freshness-policy.json` — observation-age states and thresholds; freshness is not accuracy/confidence
- `/realty/data/history/index.json` — append-only history ledger + current-snapshot join and chart discipline
- `/realty/data/history/*.json` — immutable archived source observations

Changing prices, yields, asks, floors, offers and listing states belong in machine observations, not prose documentation.

## Current market universe

Physical market families:
- Lofty
- RealT
- Reental
- Blocksquare
- Propy

Digital market families:
- Decentraland
- The Sandbox
- Otherside
- Somnium Space
- Voxels

The presence of a market in the universe does **not** claim current listing coverage. `Tracked` and `Source integration` remain distinct states.

## Truth / data semantics

Hard rules:

1. Never turn missing data into zero.
2. Never fabricate a listing or market metric for visual completeness.
3. Preserve the source platform's economic/legal terminology.
4. `ask != best offer != collection floor != last sale`.
5. `estimated/projected return != realised yield/cash flow`.
6. `minimum entry != total property/project value`.
7. `market profile != complete listing coverage`.
8. `city/market coordinate != exact property boundary`.
9. Sandbox coordinates, Decentraland coordinates and other virtual-world systems are separate native coordinate spaces; there is no invented universal metaverse map.
10. An indexed-observation viewport is not a claim of a complete official world map.
11. Freshness measures observation age only: `fresh != guaranteed correct`; `stale != false`.
12. A freshness label does not imply a collector/scheduler exists.
13. Two independent observations can prove a change but do not establish a trend.
14. A field appearing/disappearing between snapshots is a coverage change, not automatically an economic market move.
15. Aggregation is not homogenization: legal rights, eligibility, liquidity and income mechanics differ across issuers/worlds.
16. Each changing observation keeps source URL/source label/source-check date.
17. Exact third-party media is a separate display-rights layer.
18. A public webpage is not blanket permission for scaled automated extraction or commercial reuse.

A beautiful explicit absence is preferred to invented completeness.

## Observation freshness

Data Health v1.0 deterministically evaluates the admitted `sourceChecked` date against UTC calendar days:

- `Current` — 0–7 days;
- `Aging` — 8–30 days;
- `Stale` — more than 30 days;
- `Unknown` — missing/invalid/future date.

The thresholds are an operational review-priority policy, not a market-confidence score. They do not create any background collection cadence by themselves. A future collection system can use field-specific cadences once scale makes that necessary.

## Property Memory / history

History is append-only evidence, not a synthetic backtest.

- archived snapshots remain immutable;
- current `market-snapshot.json` is joined at read time rather than copied into a second live truth;
- repeated asset IDs can be compared across independent observation points;
- only fields present in both observations are treated as comparable changes;
- missing/present transitions are labelled coverage gaps;
- two observation points show exact `previous → current` changes but no trend line;
- the current chart policy requires at least three independent observations before a trend visualization is admissible.

Before a future current snapshot is materially replaced, preserve the outgoing observation in append-only history when it is an independent source observation worth retaining.

## Source strategy

Default architecture is **source-first + free-first**:

1. protocol/onchain state where the economic fact truly lives onchain;
2. official issuer/market/world source;
3. official API/feed where access rights are clear;
4. future licensed/partner feeds;
5. source-market observations with explicit provenance.

Token-to-USD conversion should reuse a verified shared The Holding Market Data/oracle lane when appropriate rather than creating a duplicate Realty price engine.

No dedicated paid Realty CoinGecko dependency is required by the current architecture.

## Execution boundary

The Holding Realty currently provides discovery and intelligence only.

- no custody
- no transaction execution
- no token issuance
- no source-platform impersonation
- no claim that The Holding is the seller

Transactions, KYC and eligibility remain governed by the source venue.

## Capacity / orchestration boundary

Realty remains intentionally lightweight relative to product depth:

- static HTML/CSS/JS
- compact JSON contracts
- local browser state for watchlist/shortlist
- no dedicated Realty backend
- no Realty-specific collector/workflow fan-out

Do not add a workflow/backend/search cluster until catalogue scale or reliability creates a demonstrated need. Capability should grow faster than infrastructure complexity.

## Visual direction

- premium dark mode as the primary immersive presentation;
- full light mode supported and persisted locally;
- Physical World uses restrained gold/stone/architecture language;
- Digital World uses restrained violet/deep-blue spatial language;
- object and market cards stay data-led and institutional;
- exact property media renders only when display rights are admitted;
- premium owned/neutral fallback remains first-class;
- mobile and desktop are both first-class surfaces with no horizontal overflow.

## Future product layers

Added only when justified by live gaps:

- broader source-backed inventory and provider coverage
- richer provider/market pages and fees/jurisdiction/ownership details
- richer world-specific spatial adapters as admissible coordinates become available
- deeper history/charts after enough independent observations accumulate
- saved search and alerts when real monitoring infrastructure is justified
- field-specific source freshness/collection cadence once automated ingestion is justified
- Ask Realty / property intelligence on top of canonical history
- partner/referral routing with explicit commercial disclosure
- eventual portfolio/company integration
- Realty Index / Opportunity Radar only after comparable methodology exists
