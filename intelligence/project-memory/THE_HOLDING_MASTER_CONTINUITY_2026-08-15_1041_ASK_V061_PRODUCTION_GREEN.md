# THE HOLDING — MASTER CONTINUITY / ASK THE HOLDING v0.6.1 PRODUCTION GREEN

Snapshot: `2026-08-15 ~10:41 (+03)`
Priority: `CURRENT PRODUCT CONTINUITY DELTA`

## Executive state

**Ask The Holding v0.6.1 = PRODUCTION GREEN.**

This release closes the Trust / Intent Precision + Human Conversation Experience phase without adding a model backend, vector DB, generative fact synthesis, execution authority or persistent public Conversation Learning.

Canonical next product objective:

> **Owner Unknown / deep unexpected questions — make Ask increasingly feel like a conversation with The Holding OS, not merely a strong deterministic router.**

## Production proof

PR:
- `#56 — Ask The Holding v0.6.1: Trust, intent precision and Experience harness`

Candidate head:
- `263f23aba943b87a816d5e24ae8cf7d9c1280b10`

Merge commit:
- `7e2fdbb8fc971fd6ac37c3b85133a65049da4d3d`

Cloudflare production build:
- result: `SUCCESS`
- Build ID: `1b9e6e6e-db9c-4584-9d67-795f17a5a22d`
- Version ID: `266e4ad0-6bdb-409a-a222-12ef44ba748f`

Post-merge gates on exact merge SHA:
- Production Boundary: `SUCCESS`
- Production homepage smoke: `SUCCESS`
- Repository Sentinel: `SUCCESS`
- Cloudflare Workers Build: `SUCCESS`

Current `main` is a descendant of the merge commit and retains the Ask v0.6 asset cache-bust:
- `/agents/console/app.js?v=0.6`

## Final Experience proof before merge

Permanent workflow:
- `.github/workflows/ask-experience.yml`

Fresh all-mode candidate run:
- run `#14`
- run ID `31869879095`
- exact tested SHA `263f23aba943b87a816d5e24ae8cf7d9c1280b10`
- mutation seed `2026-08-31869879095-1`
- artifact SHA-256 `2bc7f4850cd4dd4a21eb8eefc4c4957b7ba2bf1290564fbb40d1ff99df6c8d58`

Results:
- output-side safety guard: `PASS`
- frozen Safety: `8/8 PASS`
- annotated Core: `16/16 PASS`
- fresh unseen Mutation: `7/7 PASS`
- selected release gates: `safety, core, mutation = PASS`
- false-MEASURED release target: `0`
- Owner Unknown: `12/12` executed as discovery evidence; explicitly not release-gated

PR-triggered Experience also passed on the same candidate SHA.

## Capability delta

Ask now has stronger deterministic handling for:
- RU/EN natural-language normalization;
- typo recovery on known semantic lexemes;
- transliteration / slang classes;
- company and protocol follow-up context;
- protocol → company membership questions;
- claimable/rewards phrasing;
- APR/APY vs Performance / actual-result distinction;
- secret/private-key phrasing including RU slang;
- product navigation/onboarding language.

The important improvement is not raw answered-count. The product is now evaluated against intent/source/confidence expectations and is allowed to block its own release on a new unseen surface form.

## Trust / evaluation architecture now permanent

`verification/ask-experience/` contains:
- annotated core corpus;
- frozen safety corpus;
- false-MEASURED evaluator;
- deterministic seeded mutation grammar;
- Owner Unknown discovery corpus;
- reusable browser runner;
- output-side safety guard test;
- learning-needs summarizer;
- Owner Unknown review;
- origin isolation policy;
- future live-human signal policy.

Evidence origins remain separate:
- `synthetic-regression`
- `synthetic-mutation`
- `owner-unknown`
- future `live-human`

Do not collapse these into one score.

Generalization discipline:
- repair **failure classes**, not exact generated phrases;
- after repair, prove with a **fresh seed**;
- a fresh unseen seed may block release even when frozen Core/Safety remain GREEN.

## Output-side safety

The final-answer guard now independently blocks unsafe final output classes including:
- claims of execution/signing/capital-movement authority;
- secret/private-key style content;
- personalized buy/sell/allocation recommendations;
- `MEASURED` answers without valid source mapping.

Input routing remains first-line protection, but is no longer the only protection.

## Authority boundaries unchanged

- `executionAuthority = none`
- no wallet signing
- no transaction execution
- no autonomous capital movement
- no autonomous production merge/release
- no methodology/security-policy mutation
- persistent public Conversation Learning remains OFF
- no public conversation can create authority

## Next phase — Owner Unknown / Conversational Intelligence

Now move beyond router polish into owner-grade questions whose answer shape is not known in advance.

Primary targets:
- `why?`
- `what changed?`
- `what matters now?`
- cross-source synthesis;
- salience / prioritisation;
- company purpose vs current state;
- Productivity vs Rewards vs Embedded Yield vs realised cash-flow distinctions;
- data-gap importance;
- risk / fragility explanation;
- multi-turn context across company → protocol → economics → governance;
- correct UNKNOWN/PARTIAL behavior when evidence is insufficient.

Do not add one phrase-patch per failure. The unit of improvement remains a reusable capability / failure class.

A query-understanding model remains a future option only if repeated independent Experience evidence shows deterministic parsing has reached a measured ceiling. If earned, the preferred boundary remains:

`question → structured intent JSON → deterministic grounded answer layer`

The model should not receive authority to invent economic facts.

## Product surface direction

`/agents/` should gradually become a visible live OS dashboard as intelligence improves.

Future earned UI should expose real evidence rather than invented AI scores, e.g.:
- false-MEASURED status;
- latest Safety/Core/Mutation proof;
- unseen seeds survived;
- Owner Unknown reviewed;
- accepted/rejected learning hypotheses;
- current conversational maturity stage;
- OS governance / Security / Proposal / Builder / Guardian state in the lower terminal surfaces.

This UI work follows production close and should be grounded in real machine-readable state.

## Working principle

> **Ask The Holding should increasingly feel like a conversation with the Capital OS — while every increase in conversational power remains grounded in verified state, measured failure evidence and explicit authority boundaries.**
