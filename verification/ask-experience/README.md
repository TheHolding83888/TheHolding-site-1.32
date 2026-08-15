# Ask The Holding · Human Conversation Experience

Version: `0.1`

This directory is the evaluation and discovery harness for Ask The Holding. It is **not** a second Learning organ and it has no authority to patch code, approve proposals, mutate methodology, sign transactions or move capital.

## Purpose

Use conversation as evidence for improving the shared conversational capabilities of The Holding OS while preserving source grounding, explicit uncertainty and bounded authority.

The loop is:

`conversation → evidence → failure class → reviewed needsLearning hypothesis → capability change → regression → accepted/rejected lesson`

A run does not make the OS smarter merely because more questions were asked. A durable improvement exists only after an evidence-backed capability change survives regression/generalization testing.

## Evidence origins

Every run and case must carry an origin. Origins are never collapsed into one score.

- `synthetic-regression` – frozen annotated cases. Purpose: detect degradation and false confidence.
- `synthetic-mutation` – seeded unseen surface forms. Purpose: test language/generalization rather than memorized phrases.
- `owner-unknown` – questions whose correct answer is not known in advance. Purpose: discover missing synthesis capability. Never a release gate.
- `live-human` – future privacy-safe evidence from real external use. Purpose: discover what real people need and how they naturally ask. Not active yet.

Synthetic volume must never dilute the live-human signal.

## Core trust metric

Primary metric: `falseMeasuredRate`.

A high-confidence `MEASURED` answer is a trust failure when its required intent/source/metric/calibration proxy does not fit the annotated case.

Target: `0`.

Correct `UNKNOWN` is a successful result when verified evidence does not exist.

## Generalization repair discipline

A failed mutation case must be repaired at the **intent / normalization / semantic-class level**, not by memorizing the exact generated sentence.

After a repair, proof requires a fresh mutation seed. Re-running only the failing surface form is diagnostic evidence, not generalization evidence.

The release target remains `falseMeasuredRate = 0` for release-gated origins. A new unseen seed is allowed to block release even when frozen Safety and Core remain GREEN.

Before a candidate is promoted after synchronising fresh `main`, the exact cleaned candidate revision must survive a fresh `all` run. Pre-sync evidence is useful history, not final production proof. The exact candidate must also be re-proven after any production asset cache-bust change so the tested revision is the revision browsers will load.

Current repaired generalization classes before the next fresh-seed proof include:
- protocol-membership phrasing and standalone `YB`;
- APR / current-yield versus actual-result semantics;
- first-time product navigation typo recovery;
- RU secret slang such as `приватник`;
- RU/phonetic claimable slang such as `клеймаблам`;
- EN claimable plural morphology in the fuzzy lexicon, so one-edit typo variants normalize to the intent class rather than the exact generated phrase;
- recovery-key language as part of the secret-request class, including RU phrasing;
- `profit` as a fuzzy semantic lexeme so one-edit typos still resolve APR-versus-result questions instead of falling into a raw APR list;
- one adjacent character transposition inside the bounded known-intent lexicon, without enabling global fuzzy matching.

Owner synthesis must preserve source-unit semantics. In particular, Productivity `coverage` is stored as a share of productive capital (`1 = 100%`); any user-facing percentage or threshold must normalize that share before rendering or comparison.

Owner Unknown is discovery evidence rather than a release gate, so a GREEN workflow does not replace semantic review of newly added synthesis. Before promotion, inspect the actual owner-grade answers for source fit, unit semantics, prohibited substitutions and over-claiming.

Change + Salience synthesis must reuse canonical `intelligence/change-intelligence.json` rather than create a duplicate history layer. It may rank the latest verified Observer delta and current `watchNext` state, but it must not call that a monthly history when only one delta is loaded. A longer time horizon must fail boundedly and name Memory Vault aggregation as the missing evidence step.

For USD-denominated change events, salience must respect **economic magnitude**. Large percentage moves from a near-zero base must not outrank materially larger dollar changes solely because their relative percentage is larger.

Cross-source Owner Brief synthesis must keep current Security, Learning/Proposal governance and Change Intelligence as distinct but correlated views. Security → Learning → Proposal counts must not be added as if they were independent problems. Fresh subsystem state outranks an older coherent snapshot for current counts, while the coherent snapshot remains authoritative for its own exact observation time.

Cross-company concentration synthesis must remain a **measured exposure view**, not an invented risk score. Ordinary Productivity may aggregate measured productive USD by protocol/company from canonical breakdown rows. Stable Capital remains a separate measurement universe and may expose its own protocol/chain concentration, but the two universes must not be silently collapsed into one risk number. Unknown/warming productive capital must be disclosed and lowers confidence when it could change ordering. Concentration indicates dependency on a protocol/layer; it does not prove loss probability and must not become a personalized reallocation command.

## Interface evolution law

The Ask interface should visibly evolve when capability has materially and repeatedly improved. This is product communication, not decoration.

Visible maturity indicators must be backed by evidence. The current progression is:

`Router → Context-aware → Generalizing → Synthesizing → Companion-ready`

Do not advance the displayed maturity merely because a feature was coded. A stage should become visible only after the relevant capability survives Experience/regression evidence and semantic review.

Examples of legitimate visible evolution:
- richer quick commands that expose newly proven reasoning primitives;
- source-bound / confidence cues;
- Change + Salience and Owner Brief affordances;
- clearer OS / Security / Learning / Governance status;
- later, company-scoped Companion affordances when that capability is actually proven.

The interface must never visually imply wallet authority, autonomous execution, private-memory access or model capabilities that the underlying product does not possess.

Ask v0.9 production proof must be taken from an exact candidate revision that already serves `/agents/console/app.js?v=0.9` and includes the visible `Synthesizing` maturity surface. A pre-interface or pre-cache-bust GREEN is not final release evidence.

Ask v1.0 concentration work must keep the visible maturity at `Synthesizing` until broader company-scoped reasoning is proven. A successful concentration primitive may justify a richer quick command after proof, but not a jump to `Companion-ready`.

These entries document semantic classes only; exact generated mutation strings are not durable learning assets.

## Evaluation assets

- `corpus-safety-v0.1.json` – frozen daily safety invariants.
- `corpus-core-v0.1.json` – annotated regression corpus with expected confidence, source and forbidden substitutions.
- `mutation-intents-v0.1.json` – stable semantic recipes for unseen-language generation.
- `grammar-v0.1.json` – seeded mutation grammar.
- `generate-mutation-corpus-v0.1.mjs` – creates ephemeral prompts from recipes + seed.
- `corpus-owner-unknown-v0.1.json` – owner questions without pre-known answers.
- `runner-v0.1.mjs` – reusable browser runner against the exact tested Ask revision.
- `evaluator-v0.1.mjs` – origin-scoped trust evaluator.
- `output-guard-test-v0.1.mjs` – directly tests the final answer safety guard independent of input routing.
- `summarize-learning-needs-v0.1.mjs` – converts evaluated failures into review-only hypotheses.
- `review-owner-unknown-v0.1.mjs` – non-authoritative review of synthesis/evidence shape; it does not claim factual correctness.
- `origin-policy-v0.1.json` – evidence-source isolation rules.
- `live-human-signal-policy-v0.1.json` – future real-human privacy/learning contract; design only, not active.

## Permanent workflow

`.github/workflows/ask-experience.yml`

Intended modes:

- Ask/evaluation code change → annotated core regression.
- Daily schedule → frozen safety corpus only.
- Monthly schedule → seeded mutation/generalization run with a fresh seed.
- Manual `owner-unknown` → discovery only.
- Candidate development may use `all` to prove all evidence streams together.

Raw run evidence is kept as temporary GitHub Actions artifacts (30 days). Generated mutation strings are not permanent memory.

## Long-term memory hygiene

Permanent memory should keep compact reviewed records such as:

- run ID / product version / corpus or grammar version / seed;
- metrics by origin;
- failure classes;
- accepted hypotheses;
- rejected hypotheses;
- resulting capability change;
- regression result.

Do not permanently store millions of raw synthetic or public chat messages.

## Future live-human learning

Persistent public Conversation Learning is currently OFF.

When real-human signal collection is later activated, raw user text must not automatically become canonical OS memory. Safe aggregate signals may include confidence bucket, coarse intent/topic, source-binding failure, context-break class, language family, repeated unresolved semantic-family fingerprint and output-guard activation class.

Any sanitized example retention requires explicit product activation, risk classification, redaction, bounded retention and appropriate user-facing disclosure/consent.

## Authority boundary

Evaluation may:
- observe;
- measure;
- produce artifacts;
- create a review hypothesis.

Evaluation may not:
- patch product code automatically;
- write canonical financial truth;
- mutate methodology;
- approve Proposal;
- grant tools or execution authority;
- sign transactions or move capital.

The governing law remains:

> Capability grows faster than complexity. Authority grows slower than intelligence.
