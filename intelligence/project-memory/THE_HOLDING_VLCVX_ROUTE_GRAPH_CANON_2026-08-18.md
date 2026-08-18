# THE HOLDING — vlCVX ROUTE GRAPH CANON
## 2026-08-18 · delegation, settlement and legacy reward continuity

## Purpose

vlCVX is not a single reward mechanism. The same vlCVX principal can move through different delegation / management / settlement paths over time, while rewards from an older path can remain claimable after the active route changes.

The Holding therefore models vlCVX as a route graph rather than a flat protocol label:

`vlCVX principal → delegation / management route → settlement layer → payout assets`

Examples:

- `vlCVX → Votium → direct Votium Merkle → USDC / FXN / DOLA / BOLD / frxUSD / ...`
- `vlCVX → Votium → The Union → scrvUSD`
- `vlCVX → Stake DAO → Stake DAO settlement → measured payout assets`

Future mechanisms may add new routes, but must preserve the same graph semantics.

## Core invariants

1. **Principal route and reward route are separate facts.** A current delegation route does not erase rewards already earned under an older route.
2. **Legacy residual rewards remain tracked until proven claimed / settled.** If a company changes from direct Votium to Votium + Union, old direct Votium Merkle rewards remain visible alongside the new Union settlement lane.
3. **Current route != only route with claimable state.** Historical claimables may coexist with current routing.
4. **unknown != zero.** A route with unresolved member-level settlement remains Pending / Warming; no zero is fabricated.
5. **claimable != TVL.** All vlCVX reward outputs remain outside principal TVL unless the mechanism explicitly compounds into the principal position and that embedded treatment is separately proven.
6. **No route inference from branding alone.** Votium, Union, Stake DAO or another route must be backed by current/period-appropriate onchain or reproducible protocol evidence.
7. **Route transitions are historical events.** The system should preserve prior route evidence and identify the currently effective path separately.

## Canonical public labels

For Passport / Rewards Drawer presentation:

- direct Votium settlement: **`Votium · vlCVX`**
- Votium forwarding into Union: **`Votium + Union · vlCVX`**
- Stake DAO managed / settlement path: **`Stake DAO · vlCVX`**

The `+` convention means a chained route, not two competing alternatives. It is intentionally concise while preserving the mechanism graph.

## Public ordering

All reward groups arising from the same vlCVX principal should be adjacent in the Rewards Drawer.

For a company with both residual direct Votium rewards and a current Union route, preferred order is:

1. `Votium · vlCVX`
2. `Votium + Union · vlCVX`

This preserves chronology / mechanism readability and avoids scattering one vlCVX economic story across the drawer.

## Machine-readable route atoms

When a collector can prove them, preserve:

- `principalAsset`: `vlCVX`
- `delegationProtocol`
- `settlementProtocol`
- `payoutAsset` or payout asset set
- `routeRole`: `current`, `legacy-residual`, or `unknown`
- route effective start / expiration when available
- claim / Merkle period or distributor week when relevant
- claimed / unclaimed state
- proof provenance

A payout row may additionally carry a canonical path string, e.g.:

`vlCVX → Votium → The Union → scrvUSD`

## Defitea precedent

Defitea wallet:
`0x78bf5AF472d5f6014b641eD70DE01862C05dA8c3`

Current proven route at the 2026-08-18 close:

`vlCVX → Votium → The Union → scrvUSD`

At the same time, direct Votium Merkle rewards from the prior/direct path remain independently claimable and must remain visible as `Votium · vlCVX` until claimed.

Thus Defitea intentionally displays two adjacent vlCVX reward groups:

- `Votium · vlCVX` — legacy/direct Votium claimables;
- `Votium + Union · vlCVX` — current Union settlement, with actual configured payout asset(s), currently scrvUSD.

This is the reusable precedent for Company #011 and later companies.

## Onboarding law

Whenever a new company contains vlCVX:

1. detect vlCVX principal;
2. discover current delegation / management route;
3. inspect known historical / residual claimable routes where reproducible evidence exists;
4. classify each route independently;
5. preserve current and legacy residual routes simultaneously when both are economically live;
6. discover settlement asset(s) rather than assuming them;
7. project each route into canonical Rewards data;
8. group adjacent vlCVX routes in the Passport without collapsing distinct settlement semantics;
9. add a new route adapter only for a genuine new mechanism delta.

Solved vlCVX routing becomes a reusable mechanism graph, not a company-specific label patch.

Authority remains `none` — discovery and reward measurement are read-only; no claiming, delegation mutation or allocation mutation is authorized.