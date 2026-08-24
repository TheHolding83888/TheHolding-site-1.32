# Ask The Holding · Conversation Gauntlet v0.1

## Purpose

Conversation Gauntlet is a high-volume **generalization and epistemic stress campaign inside the existing Ask Experience harness**. It is not a new Learning organ, a second router, a model-training pipeline, or a new answer-authority plane.

The goal is to make ordinary conversation increasingly robust while preserving source grounding, uncertainty and authority boundaries.

Canonical loop:

`many unseen conversations → grouped failure classes → smallest systemic repair → fresh unseen seed → regression/generalization proof`

Never:

`failing sentence → hard-code that sentence → call it learning`.

## v0.1 scale

`mutation-intents-v0.1.json` defines **22 durable semantic families**.

`generate-mutation-corpus-v0.1.mjs` generates **10 seeded variants per family by default**:

- 220 unseen mutation cases per campaign;
- multi-turn sessions are generated for context-sensitive families;
- additional existing `all` evidence includes frozen Safety, Semantic Safety, Core and Owner Unknown;
- generated exact strings remain temporary artifacts, not durable project memory.

The variant count can be changed with `ASK_EXPERIENCE_VARIANTS_PER_INTENT`, bounded to 1–20. Increasing raw volume is not itself progress.

## Covered stress dimensions

The first campaign deliberately stresses:

- English, Russian and code-switched phrasing;
- colloquial language and protocol/crypto slang;
- conservative one-edit and occasional two-token typo noise;
- punctuation/casing noise;
- multi-turn pronoun/context retention;
- bounded one-turn fund/entity carry-over from real owner dialogue, with previous turns used only for referent resolution and fresh source-binding required for the answer;
- authority and secret boundaries;
- current yield vs historical performance;
- rewards vs APR/APY substitution;
- protocol membership;
- cross-company comparison;
- protocol definition + follow-up company lookup;
- Learning and Proposal introspection;
- cross-company concentration;
- Change + Salience;
- Owner Brief synthesis;
- company-understanding surface;
- personalized-allocation refusal without losing usefulness;
- future Companion authority boundaries;
- correct UNKNOWN for unsupported future-price, pre-tracking and Sharpe requests.

## First baseline campaign

The first exact-head 210-case browser campaign intentionally ran against the pre-repair Ask router and produced a useful RED baseline:

- evaluated: 210 / 210;
- browser harness errors: 0;
- false-MEASURED: 39;
- false-UNKNOWN: 41;
- strict failures: 95;
- source-fit rate: 67.14%;
- confidence-fit rate: 70.95%;
- answer-pattern-fit rate: 67.14%.

Important safety result: `authority-sign` and `secret-request` both remained 10 / 10 strict-pass despite language stress.

The dominant failures were not treated as 95 independent bugs. They were grouped into reusable causes:

1. bounded semantic normalization vocabulary was too narrow for ordinary typos/paraphrases;
2. epistemic/trust intents such as future price, pre-tracking history, Sharpe and personalized allocation could miss their high-priority boundary and fall into a generic company answer;
3. weak token coincidence in company matching could select a company without a real entity reference;
4. Owner Brief, Company Understanding, Concentration and Companion authority intent families were semantically too narrow;
5. broad owner-attention routing could outrank an explicit latest-change question.

The first repair pass changes those central classes only. It must be judged on a **fresh seed**, not by replaying the baseline strings.

## Repair law

A candidate repair is accepted only when it fixes a **semantic class** rather than the generated phrase and survives a fresh seed.

Examples of acceptable repairs:

- bounded alias/normalization improvement;
- intent family disambiguation;
- context carry-over repair;
- source-binding correction;
- evidence primitive that genuinely exists but was unreachable;
- confidence calibration / false-UNKNOWN repair;
- output semantics that stop an unsafe substitution.

Examples of rejected repairs:

- exact sentence memorization;
- global fuzzy matching that weakens safety;
- inventing unavailable historical/causal evidence;
- changing an expected answer merely to make a RED disappear;
- increasing answer authority or execution authority.

## Evidence interpretation

Primary hard targets remain:

- `falseMeasuredRate = 0`;
- `falseUnknownRate = 0` on annotated answerable families;
- correct source binding;
- required semantic pattern fit;
- no forbidden substitution.

A RED is useful evidence. It does not authorize an automatic patch. Repeated failures should be grouped into the smallest underlying capability gap before code changes.

## Relationship to Owner Economic Experience

Conversation Gauntlet improves **language understanding, routing, synthesis, epistemic discipline and conversational generalization**.

It does **not** substitute for genuine owner decision → outcome → reviewed lesson experience.

The Holding is intentionally a long-horizon accumulation/cash-flow operating system. Owner economic decisions may be sparse. They must not be fabricated merely to raise Experience telemetry. Between genuine decisions, high-value learning work is observation, historical accumulation, protocol/company economics, real Ask use and conversation stress-testing.

## Production release criterion

A Gauntlet repair is production-ready only on a clean exact PR head after all temporary repair machinery has been removed. The required proof is:

- Frozen Semantic Safety PASS;
- Annotated Core PASS;
- Ask Experience release gates PASS;
- a fresh unseen 220-case Gauntlet with `harnessErrors = 0`;
- `falseMeasuredCount = 0`;
- `falseUnknownCount = 0` on annotated answerable families;
- source fit, confidence fit and required answer-pattern fit all at 100%;
- `trustGate = PASS`, `strictInvariantGate = PASS`, `releaseGate = PASS`;
- mergeability against fresh `main` followed by exact-head re-proof if `main` moved.

A previously GREEN seed does not waive the fresh-head proof.

## Authority

Conversation Gauntlet may observe, measure and create review evidence.

It may not:

- move capital;
- sign transactions;
- approve governance actions;
- mutate financial truth;
- silently change methodology;
- self-promote model output to answer authority;
- create fake owner decisions or outcomes.

`executionAuthority = none` remains unchanged.
