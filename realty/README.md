# The Holding Realty

## Product role

The Holding Realty is a multi-page property discovery and intelligence vertical inside The Holding.

It is deliberately **not** a one-page marketing landing and deliberately **not** a replacement marketplace.

Long-term product direction:

`Aggregated markets → normalized property records → source provenance → historical observations → comparison → watchlists / alerts → intelligence → discovery routing`

The strategic analogy is closer to a property-native combination of a discovery portal, market terminal and aggregation layer than to a new issuer or exchange.

## Current routes

- `/realty/` — Realty portal / two-world entry
- `/realty/physical/` — tokenized physical real estate explorer
- `/realty/digital/` — metaverse real estate explorer
- `/realty/compare/` — Reality Lens, semantic comparison between worlds
- `/realty/property/?id=...` — physical property detail
- `/realty/parcel/?id=...` — digital parcel detail
- `/realty/data/market-snapshot.json` — first source-linked market snapshot

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

The presence of a market in the universe does **not** claim current listing coverage. Current records in the snapshot are explicitly source-linked.

## Truth / data semantics

Hard rules:

1. Never turn missing data into zero.
2. Never fabricate a listing for visual completeness.
3. Preserve the source platform's semantics.
4. `ask != best offer != collection floor != last sale`.
5. Physical issuer `estimated/projected return` must not be relabeled as realized yield.
6. Aggregation is not homogenization: legal rights, eligibility, liquidity and income mechanics differ across issuers/worlds.
7. Each observation keeps source URL, source label and source-check date.
8. Current v0.1 is a source snapshot, not yet an autonomous canonical live collector.

## Execution boundary

The Holding Realty currently provides discovery and intelligence only.

- no custody
- no transaction execution
- no token issuance
- no source-platform impersonation
- no claim that The Holding is the seller

Transactions and eligibility remain governed by the source venue.

## Visual direction

- premium dark mode is the primary immersive presentation;
- full light mode is supported and persisted locally;
- high-impact visual storytelling belongs mainly to the two world-entry surfaces;
- object cards remain data-led and institutional;
- source-verified property media may be added later without changing the data model;
- mobile and desktop are first-class surfaces.

## Future product layers

Potential next modules, added only when justified:

- persistent listing/history collector
- real map / geospatial search for physical property
- coordinate/world maps for virtual land
- cross-market saved search
- watchlist
- price / yield / listing alerts
- property comparison sets
- property quality / source-confidence layer
- historical price and liquidity charts
- normalized cash-flow / yield history where legally/economically meaningful
- Ask Realty conversational discovery
- client collection / shortlist
- source API integrations
- eventual routing/execution partnerships without unnecessary custody
