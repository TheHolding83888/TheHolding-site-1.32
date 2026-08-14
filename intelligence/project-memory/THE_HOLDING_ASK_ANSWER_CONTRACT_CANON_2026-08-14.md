# THE HOLDING — ASK THE HOLDING ANSWER CONTRACT CANON
## 2026-08-14

## Purpose

Ask The Holding is a read-only practice surface for verified project knowledge. Its next capability threshold is not “more fluent text”; it is the ability to distinguish a supported answer from an unsupported one in a machine-readable way.

Canonical rule:

**An answer may be conversational, but factual confidence must remain source-bound.**

## Answer Contract v0.4

Every routed answer is wrapped in a local machine-readable contract with:

- `version`
- `language`
- `confidenceClass`
- `sourceArtifacts[]`
- `generatedAt` when the underlying structured source exposes one
- `topic`
- `grounded`

Current confidence classes:

- `measured` — source-bound answer with no detected partial/warming/unknown condition;
- `partial` — useful verified information exists, but measured coverage or evidence is explicitly incomplete;
- `warming` — the source itself is still warming and no measured value is available;
- `unknown` — no sufficiently strong verified answer exists, source is unavailable, or a factual answer cannot be bound to a known source artifact.

`unknown` is a valid result, not a failure to be hidden.

If a response would otherwise look factual but has no mapped source artifact, the console fails closed and does not release it as a factual answer.

## Answer-quality evidence

The deterministic router should be replaced or augmented by a free-form model only when real usage demonstrates the need.

The relevant evidence is not code size. It is answer quality:

- measured rate;
- partial rate;
- warming rate;
- unknown rate;
- error rate;
- repeated unresolved topics/questions.

This makes the future model transition evidence-driven rather than architecture-driven.

## Privacy boundary

Before persistent Conversation Learning is deliberately activated, Answer Quality remains browser-local.

The v0.4 quality mechanism:

- does not add a server endpoint;
- does not activate persistent learning;
- does not store raw questions in its quality ledger;
- does not create a raw Question Ledger;
- uses a browser-local random salt plus SHA-256 for repeated unresolved-question fingerprints;
- stores only bounded local aggregates/coarse topic/fingerprint/count/timestamps/language;
- does not transmit those quality metrics anywhere.

Existing Safe Conversation Learning activation gates remain unchanged and fail-closed.

## Authority boundary

Answer Contract v0.4 changes explanation quality only.

It grants no:

- GitHub write authority;
- Cloudflare/deployment authority;
- methodology or policy mutation authority;
- wallet/signing authority;
- transaction authority;
- capital execution authority.

Execution authority remains `none`.

## Engineering lesson from candidate validation

Syntax-valid generated code is not sufficient proof of semantic correctness.

During v0.4 candidate validation, an external patch generator produced syntactically valid but semantically malformed regular expressions after escape processing. Manual post-GREEN inspection detected the issue before PR. The candidate was repaired and a behavioral semantic gate was added for numeric/coverage classification.

Durable rule:

**For generated production code, validate behavior-critical semantics in addition to syntax and string-presence invariants. GREEN is evidence, not a substitute for inspecting the resulting artifact.**

## Current rollout rule

The contract may enter production only through normal PR checks and production smoke verification. Persistent public Conversation Learning remains OFF until its separate runtime/privacy/legal activation gates are deliberately satisfied.
