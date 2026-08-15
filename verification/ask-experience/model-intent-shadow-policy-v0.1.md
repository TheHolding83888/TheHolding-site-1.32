# Ask The Holding — Model Intent Shadow Policy v0.1

## Purpose

This layer evaluates whether a replaceable language model can improve natural-language intent understanding without receiving factual, confidence or execution authority.

Canonical shadow path:

`raw question → untrusted model candidate → production Intent Contract Firewall → comparison/evaluation only`

The deterministic Ask router remains the only answer authority.

## Provider boundary

The shadow evaluator must be provider-replaceable. Provider/model identity is diagnostic metadata only and is never canonical truth.

GitHub Models was evaluated first because it could previously run from Actions with a short-lived workflow token. Live development evidence returned the explicit retirement response `github_models_retirement_brownout`, and GitHub's published retirement schedule fully retires that service. Therefore GitHub Models is not an allowed durable dependency for this capability.

The current preferred GitHub-native development transport is GitHub Copilot CLI in non-interactive mode, authenticated from Actions with the short-lived `GITHUB_TOKEN` and narrowly scoped `copilot-requests: write` permission. No long-lived model API credential is introduced by this path.

The Copilot transport must expose zero tools to the model for intent classification. It receives only the parser instructions and user question and returns text that is parsed as a candidate before the production Intent Contract Firewall.

If Copilot access is unavailable because account/repository policy or subscription state blocks requests, the shadow run must fail closed and record only a bounded diagnostic. It must not silently fall back to a weaker factual path or enable a paid external provider without owner authorization.

The existing deterministic ChatGPT Bridge is not repurposed. Its current no-API/no-model-call meaning remains unchanged.

## Allowed model task

The model may only infer the bounded structured fields accepted by `agents/console/intent-contract.js`:

- version
- intent
- entities
- timeframe
- comparison
- requestedMetric

The model receives the natural-language question and the contract enums/instructions required to create that candidate.

## Forbidden model task

The model must not:

- answer the user;
- provide balances, APR/APY, rewards, performance, cash flow or other facts;
- select source artifacts as truth;
- assign factual confidence;
- produce recommendations or operational actions;
- create transactions or signatures;
- gain wallet/capital authority;
- mutate methodology, policy, security or production code;
- bypass Semantic Safety, Intent Contract validation, Answer Contract or Output Guard.

`executionAuthority = none`

## Missing-capability semantics

When the current production contract has no canonical capability for a request, the model candidate must remain `unknown` rather than substitute an adjacent metric.

This includes at least:

- founding purpose / purpose drift;
- realised company-level cash actually received;
- maturity / reputation ranking;
- guaranteed future yield;
- exact future exploit/hack probability;
- pre-tracking income that has not been backfilled.

Execution or production-authority commands must map to `authority-boundary`, never to an executable action.

## Transport failure semantics

Infrastructure errors are distinct from model-quality misses.

The evaluator must fail fast after the first transport-class error so it does not waste quota or create misleading aggregate quality statistics. Logged diagnostics must redact tokens and bound provider error text.

Examples of transport-class errors:

- provider retirement/unavailability;
- authentication failure;
- account or repository policy denial;
- quota/budget exhaustion;
- unsupported transport configuration.

A transport RED says nothing about the quality of the Intent Contract or deterministic Ask answer layer.

## Evidence semantics

Shadow corpus strings and model responses are evaluation evidence only.

They are:

- not a new source of economic truth;
- not durable Capital OS memory;
- not release-gated evidence in v0.1;
- not allowed to modify the live answer path;
- safe to discard after evaluation.

Only architecture decisions, aggregate findings and justified capability changes may graduate into durable Project Memory.

## Promotion rule

Do not allow model output to control deterministic retrieval until shadow evidence shows materially better language understanding while preserving:

- firewall acceptance of valid structured candidates;
- unsupported semantics remaining UNKNOWN;
- authority commands remaining bounded;
- no forbidden field leakage;
- false-MEASURED = 0 in the canonical Ask release gates.

UI maturity remains `Synthesizing` during shadow evaluation.
