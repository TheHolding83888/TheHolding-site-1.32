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
- transport/infrastructure failures.

Do not collapse these into one maturity score.

Model quality misses are diagnostic during shadow mode. Infrastructure failures, forbidden-field leakage and authority-boundary escape fail closed.

## Relationship to false-MEASURED / false-UNKNOWN

The shadow parser cannot itself create MEASURED or UNKNOWN factual answers, so it cannot directly change either production metric.

Its purpose is to test whether better decomposition can later reduce false-UNKNOWN / omitted-answer opportunities while preserving `false-MEASURED = 0` through deterministic evidence and answer guards.

No production answer-path promotion is allowed until this is demonstrated under the canonical Experience regressions.

## Lifecycle

The candidate workflow is transient development orchestration. It must be removed before any final capability PR unless model shadow evaluation is deliberately integrated into the existing canonical Ask Experience workflow without creating a duplicate permanent loop.

Visible Ask maturity remains `Synthesizing` during shadow evaluation.
