# Ask The Holding — Model Intent Shadow Policy v0.1

## Purpose

This layer evaluates whether a replaceable language model can improve natural-language intent understanding without receiving factual, confidence or execution authority.

Canonical shadow path:

`raw question → untrusted model candidate → production Intent Contract Firewall → comparison/evaluation only`

The deterministic Ask router remains the only answer authority.

## Provider boundary

The first development proof may use GitHub Models from GitHub Actions with the workflow-scoped `GITHUB_TOKEN` and `models: read` permission. No separate model API secret is required for this proof.

The provider is not canonical truth and is replaceable. Provider/model identity is recorded in temporary shadow evidence.

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
