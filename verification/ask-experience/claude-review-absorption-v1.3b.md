# Ask v1.3B — Claude Review Absorption / Architecture Decision

Status: development canon, not production authority

## Decision

The Holding accepts the external review as adversarial input, not as a specification.

The evidence now justifies **augmenting** the deterministic Ask understanding plane with a bounded model-assisted parser. It does **not** justify replacing the deterministic evidence plane, introducing a general agent, giving a model source-truth authority, or adding execution tools.

Canonical near-term path:

`human language → untrusted semantic/compositional candidate → Intent Contract Firewall → deterministic capability + source resolution → Answer Contract / Output Guard`

The model may help understand the question. It does not decide what is true.

## Accepted from the review

1. The phrase-level deterministic router is reaching its useful complexity ceiling.
2. Hard-coded RU/EN/typo normalization is not a scalable primary understanding strategy.
3. Conversation state must become richer than lastEntity / lastTopic, but should remain explicit and bounded.
4. False confidence is multi-dimensional: answering a neighboring metric/entity/timeframe is a failure even when the answer itself is measured.
5. Evaluation must separately observe intent/entity/metric/timeframe/safety/context fit rather than collapse everything into one score.
6. Synthetic-corpus overfitting is a real risk; holdout/adversarial and later real-human evidence are required.
7. Public Ask should remain read-only while semantic capability is introduced.
8. Company Companion should inherit shared OS capability rather than duplicate a full OS per company.
9. UI capability should visibly evolve only after capability is proven.
10. General agent, wallet execution, autonomous portfolio management, fashionable vector/RAG infrastructure, microservices/event-bus sprawl, separate per-company brains, persistent public memory and autonomous marketplace remain premature.

## Strengthened beyond the review

### Understanding Firewall before model promotion

The Holding introduced the production Intent Contract Firewall and Compositional Understanding contract **before** allowing a model into the path. This makes model output structurally untrusted and machine-rejectable.

### Missing primitives are first-class

Unsupported semantic concepts are not silently mapped to neighboring metrics. Current explicit missing primitives include company purpose, realised cash flow and maturity/reputation.

### Two-sided epistemic quality

The system tracks both:
- false-MEASURED — claiming knowledge it lacks;
- false-UNKNOWN — discarding knowledge it already has.

These must remain separate.

### Conversation Experience is not Decision Experience

Question-understanding misses, routing failures and synthetic test cases are product-quality evidence. They are not automatically founder preference, capital experience, owner decisions or durable lessons.

Durable promotion requires a reproducible class-level lesson; raw synthetic/model outputs remain ephemeral artifacts.

### Provider is replaceable

Current shadow transport uses GitHub Copilot CLI because it can operate with short-lived GitHub workflow identity and no new long-lived provider secret. Provider choice is not part of The Holding identity.

## Current v1.3B promotion gates

Before any live model-assisted understanding path is proposed:

- all model candidates must pass the production Intent Contract Firewall;
- forbidden answer/source/confidence/authority fields = 0;
- executionAuthority = none;
- answerAuthority remains deterministic Ask only;
- unsupported cases must preserve missing primitives rather than semantic substitution;
- authority requests must route to authority-boundary;
- compound/multi-turn omitted-subpart rate should reach 0 on the current pressure set;
- class-level holdout/adversarial evidence must be added before calling the capability general;
- deterministic Safety / Semantic Safety / Core / Mutation gates must remain GREEN.

## Deferred explicitly

Do not build yet:
- free-form general agent;
- model tools;
- wallet signing / transaction execution;
- model-selected source truth;
- model-set factual confidence;
- persistent raw conversation memory;
- autonomous Experience-to-production mutation loop;
- vector database or generic RAG stack without a measured retrieval gap;
- separate full OS / Brain per company;
- marketplace execution infrastructure;
- architecture added only to appear mature.

## Product direction

Ask The Holding is the shared conversational substrate for the future platform. The next useful intelligence gain is better understanding of natural, compound and multi-turn language while preserving deterministic evidence and authority laws.

Company Companions later inherit this shared substrate with company-scoped context and permissions; they do not create independent truth systems.

Build law remains:

**Capability must grow faster than complexity. Authority must grow slower than intelligence.**
