# THE HOLDING — ASK THE HOLDING v0.8 PRODUCTION GREEN

Snapshot: `2026-08-15 ~11:44 (+03)`
Priority: `CURRENT PRODUCT CONTINUITY DELTA`

## Status

**Ask The Holding v0.8 · Change + Salience Intelligence = PRODUCTION GREEN.**

Production merge:
- PR `#58`
- merge SHA `20e8178e3805d2b0a6096c800f2e80e07a55389d`

Cloudflare production:
- build `b7a3ba15-8c86-456b-85ee-0d230dbe065e`
- Version ID `ed7613ef-4e20-42a8-aa9f-e406a45103a4`
- production homepage / unified OS Lab smoke: `SUCCESS`
- Repository Sentinel: `SUCCESS`
- post-merge Experience: `SUCCESS`

Production asset:
- `/agents/console/app.js?v=0.8`

## Capability delta

Ask now reads the existing canonical:
`/intelligence/change-intelligence.json`

It can answer bounded forms of:
- what changed since the previous verified Observer snapshot;
- which recent changes are most materially significant;
- what current watch conditions deserve owner attention;
- why a listed change matters according to canonical Change Intelligence.

No new history layer was created.

Long-term history remains in the existing append-only Memory Vault.

A single Observer delta is explicitly **not** presented as a full monthly history. Longer horizons require aggregation of multiple Memory Vault snapshots.

## Salience semantics

Semantic review caught and corrected a Goodhart-like failure before release:
relative percentage change from a near-zero base could initially outrank a materially larger economic change.

For USD-denominated events, bounded salience now respects economic magnitude.

Verified example after repair:
1. Defitea current-month counter `$20.03 → $23.10` (+$3.07)
2. Rook accrued rewards `$152.34 → $150.67` (-$1.66)
3. `0x5860...83CA8.eth` accrued rewards `$57.61 → $57.14` (-$0.47)

Tiny Monetra dollar deltas no longer rank first solely because their relative percentage is large.

## Experience proof

Final exact pre-merge proof:
- Experience run `#30`
- run ID `31875039615`
- exact candidate SHA `3711a056046af53da05534c39b7fb118d4adf57d`
- output guard PASS
- Safety PASS
- Core PASS
- fresh seeded Mutation PASS
- selected release gates PASS
- false-MEASURED `0`
- Owner Unknown executed and semantically reviewed
- artifact SHA-256 `2171f1352a738c8c429778c1b9b371e6b52d8022eaecc35b76867003de3a6fa9`

Owner Unknown progression:
- v0.6.1: `11/12` flagged
- v0.7: `7/12` flagged
- v0.8: `6/12` flagged

Owner Unknown remains discovery evidence, not a release gate.

## Authority unchanged

`executionAuthority = none`

No:
- signing;
- transaction execution;
- capital movement;
- personalized allocation advice;
- new model backend;
- vector DB / generic RAG stack;
- duplicate canonical history store;
- persistent public Conversation Learning.

## Exact next capability

Move to **Cross-Source Owner Reasoning**.

Target question family:
- `What actually deserves my attention now, and why?`
- `What changed, which part matters, and what is still uncertain?`
- `Give me the owner brief, not a list of metrics.`

Preferred bounded synthesis:

`Change Intelligence`
+ `Learning / Decision queue`
+ `Security / OS state`
+ relevant current economic watch conditions
→ `priority tiers + evidence + uncertainty + what-to-watch`

This is monitoring / decision-support synthesis, not capital-allocation advice.

Do not add a new source-of-truth layer. Reuse the machine-readable OS state that already exists.

## Development law

> Capability must grow faster than complexity. Authority must grow slower than intelligence.
