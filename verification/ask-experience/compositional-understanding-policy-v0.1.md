# Ask The Holding · Compositional Understanding Foundation v0.1

## Why this exists

The production Intent Contract safely separated language understanding from answer/source/confidence/authority planes, but its first form could still reduce understanding to selection from a fixed intent menu.

That is safe but creates a conversational ceiling: a model can become excellent at choosing an existing intent without being able to represent a genuinely new or compound owner question.

v1.3A removes that ceiling without giving the language layer factual or execution authority.

## Canonical question path

`natural language → bounded question decomposition → understanding firewall → capability / missing-primitive resolution → deterministic evidence plane`

The decomposition describes **what the question requires**, never what the answer is.

## New bounded responsibilities

The understanding contract may now represent:

- `operation` — what kind of question operation is requested;
- `scope` — system / company / cross-company / protocol scope;
- `decomposition[]` — a bounded list of requested domain primitives;
- `missingPrimitives[]` — explicit primitives required by the question but not currently modeled by The Holding.

The direct known-intent path remains backward compatible.

## Composite questions

`intent = composite` requires at least two decomposition items and cannot itself declare a missing primitive.

This represents a question composed entirely from known/requestable primitives.

## Unsupported but understood questions

`intent = unsupported-decomposed` requires:

- at least one decomposition item; and
- at least one explicit missing primitive that also appears in the decomposition.

This allows the OS to say, structurally:

> I understand the question. It requires A + B. A exists; B is not yet a canonical primitive.

That is materially stronger than a generic UNKNOWN while remaining epistemically honest.

## Current missing-primitive vocabulary

The initial allow-list is intentionally small:

- `company-purpose`
- `realised-cash-flow`
- `maturity-reputation`
- `unmodeled`

`unmodeled` requires a short bounded `concept` label. The label is diagnostic demand evidence only; it is not a fact, source, methodology or authority object.

## Forbidden planes remain forbidden

A decomposition candidate still cannot contain:

- answer / response text;
- source selection or source preference;
- evidence/citation injection;
- confidence / grounded claims;
- transaction/signature/wallet/secret fields;
- authority/permissions/mandates;
- methodology/policy mutation.

Nested decomposition items are checked against the same boundary.

## Two-sided epistemic quality

Existing trust target:

`false-MEASURED = 0`

New mirror metric:

`false-UNKNOWN`

A false UNKNOWN occurs when the annotated case is answerable by current capability/evidence but Ask returns UNKNOWN.

The canonical evaluator now reports both metrics separately. Do not collapse them into one score.

The desired system must prove both:

1. it does not claim knowledge it lacks;
2. it does not discard knowledge it already has.

## Model role

No model is required to prove this foundation.

After this contract is proven, a model may be shadow-tested on decomposition quality. It remains untrusted and must pass the same firewall.

The model still cannot answer, choose source truth, assign confidence or execute.

## Future expansion rule

Add a new understanding field only when:

- a real question class requires it;
- a deterministic consumer exists;
- it describes the question rather than the answer;
- it can be validated fail-closed;
- existing authority invariants remain unchanged.

Do not add every conceivable semantic field pre-emptively.

## Product maturity

This is foundational intelligence architecture, not a visible maturity promotion by itself.

Ask remains `Synthesizing` until compositional/model-assisted understanding demonstrates real user-facing improvement.

## Authority

`model answer authority = none`

`executionAuthority = none`
