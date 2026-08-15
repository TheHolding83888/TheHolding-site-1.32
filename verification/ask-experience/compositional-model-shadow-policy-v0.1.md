# Ask The Holding — Compositional Model Shadow Policy v0.1

## Purpose

Evaluate whether a replaceable language model can improve question understanding for compound, noisy, mixed-language and multi-turn owner requests without becoming a factual, evidence, confidence or execution authority.

Target path:

`human language → untrusted model candidate → production Intent Contract Firewall → diagnostic comparison → deterministic Ask answer path`

## Provider

Initial transport: GitHub Copilot CLI through short-lived GitHub Actions `GITHUB_TOKEN` with `copilot-requests: write`.

Provider is replaceable and is not a source of truth.

The existing deterministic ChatGPT Bridge is not repurposed. The existing paid OpenAI Brain Interpreter remains a separate Brain organ with its own bounded evidence packet and budget; v1.3B does not couple Ask shadow evaluation to it.

No new long-lived model secret is introduced by this layer.

Current Copilot model selection may remain `auto` during discovery. When `auto` is used, exact underlying provider/model identity is explicitly **not reproducible**, so stochastic shadow scores are evidence rather than production guarantees.

## Model authority

The model may only propose a question-understanding envelope accepted by `agents/console/intent-contract.js`.

The model may identify:
- intent;
- entities carried by the question/conversation;
- timeframe;
- comparison/ranking form;
- requested metric;
- operation;
- scope;
- bounded decomposition primitives;
- explicitly missing primitives.

The model may not:
- answer the question;
- provide factual claims;
- choose evidence or source truth;
- assign factual confidence;
- provide citations;
- create operational actions;
- sign or submit transactions;
- move capital;
- grant authority;
- mutate methodology, policy, source data or workflows;
- use repository/web/code tools during the shadow classification call.

`executionAuthority = none`.

## Epistemic boundary

A model must not substitute an adjacent supported concept for an unsupported one.

Examples:
- evidence breadth is not maturity/reputation;
- productivity is not realised cash flow;
- current security findings are not an exact future hack probability;
- current performance does not reconstruct income before tracking when no canonical history exists.

Unsupported mixed questions should use `unsupported-decomposed` and identify the missing primitive while preserving supported subparts in decomposition.

Mixed factual + execution requests must resolve to `authority-boundary`; operational authority dominates.

Current syntactically understood but evidence-unavailable primitives are:
- `company-purpose`;
- `realised-cash-flow`;
- `maturity-reputation`;
- `unmodeled`.

The production Intent Contract fails closed if one of these is represented as supported instead of being explicitly carried through `unsupported-decomposed` + `missingPrimitives`.

## Evaluation

Shadow evidence is synthetic diagnostic evidence and is never Capital OS truth.

Measure separately:
- firewall acceptance;
- strict semantic fit;
- required decomposition coverage;
- omitted-subpart rate;
- unsupported/missing-primitive detection;
- authority-boundary safety;
- forbidden-field leakage;
- over-decomposition diagnostics;
- entity carryover in multi-turn cases;
- comparison/ranking semantics;
- transport/infrastructure failures;
- repeated-run semantic consistency when repeats are enabled;
- provider identity reproducibility.

Do not collapse these into one maturity score.

Model quality misses are diagnostic during shadow mode. Infrastructure failures, forbidden-field leakage and authority-boundary escape fail closed.

## Holdout discipline

A separate compositional holdout corpus must be frozen **before** first inference and must not be edited to fit observed model output.

Observed holdout failures may produce new future class-level tests or a later independent corpus, but the frozen holdout itself remains unchanged. This protects against tuning the system to its own ten-question development set.

## Relationship to false-MEASURED / false-UNKNOWN

The shadow parser cannot itself create MEASURED or UNKNOWN factual answers, so it cannot directly change either production metric.

Its purpose is to test whether better decomposition can later reduce false-UNKNOWN / omitted-answer opportunities while preserving `false-MEASURED = 0` through deterministic evidence and answer guards.

No production answer-path promotion is allowed until this is demonstrated under the canonical Experience regressions.

## Current evidence disposition — 2026-08-15

Detailed immutable evaluation record:

`verification/ask-experience/compositional-model-shadow-evidence-v1.3b.md`

Current model evidence:
- tuned 10-case shadow: 70% strict semantic pass, **100% semantic-subpart recall**, unsupported 4/4 safe, authority 1/1 safe, forbidden-field leaks 0;
- frozen 16-case holdout: 75% strict semantic pass, **92.86% semantic-subpart recall**, unsupported 6/6 safe, authority 2/2 safe, forbidden-field leaks 0;
- holdout exposed real schema consistency, entity normalization and one omitted-primitive failure class;
- exact clean-branch deterministic Ask proof remains GREEN across Output Guard, Intent Contract 48/48, Safety 8/8, Semantic Safety 26/26, Core 22/22 and fresh Mutation 7/7, with `false-MEASURED = 0`.

Therefore the current disposition is:

**`EVIDENCE_ONLY_SHADOW`**

`livePromotionRecommended = false`.

The model is useful enough to justify maintaining the evaluation capability, but not yet reliable/reproducible enough to become the live Ask understanding authority.

## Lifecycle

Model shadow evaluation belongs in the **single canonical Ask Experience workflow** as a manual-only mode. It must not create a second permanent scheduled Experience loop.

Normal push / PR / scheduled Ask Experience must not spend model quota. A model shadow call occurs only when explicitly dispatched in `model-shadow` mode.

Raw model outputs remain temporary GitHub Actions artifacts and are not permanent OS memory, Decision Experience, Founder DNA or canonical truth.

Visible Ask maturity remains `Synthesizing` during shadow evaluation.

## Promotion requirements

Before a future live model-assisted understanding path is proposed, require evidence for all of the following:
- production Intent Contract acceptance without forbidden control fields;
- unsupported/missing-primitive preservation;
- authority-boundary safety;
- near-zero omitted-subpart rate on independent unseen evidence;
- bounded over-decomposition;
- robust entity normalization under noisy RU/EN/mixed language;
- correct comparison/ranking semantics;
- stochastic stability measured separately from single-run semantic fit;
- an identified/pinned model/provider where practical for reproducible production claims;
- deterministic Safety / Semantic Safety / Core / Mutation regressions remaining GREEN;
- `false-MEASURED = 0` after any actual live integration.

## Final law

The model may improve **understanding** before it earns any influence over **truth**.

**Capability must grow faster than complexity. Authority must grow slower than intelligence.**
