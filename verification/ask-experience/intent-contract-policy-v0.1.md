# Ask The Holding · Intent Contract Firewall v0.1

## Purpose

The deterministic Ask router has reached a language-generalization ceiling: free-form phrasing and evidence routing currently live in the same code path. Before any model-assisted language understanding is introduced, The Holding needs a narrow structured contract between **understanding** and **answering**.

The contract is a trust boundary, not a new answer engine.

Canonical future path:

`natural language → structured intent candidate → Intent Contract Firewall → deterministic evidence-bound answer layer → Answer Contract → Output Guard`

## Allowed responsibility

A future replaceable language model may propose only bounded understanding fields:

- `intent`
- `entities`
- `timeframe`
- `comparison`
- `requestedMetric`

It may not determine truth.

## Forbidden responsibility

A candidate is rejected if it attempts to carry answer-plane or authority-plane fields such as:

- answer text;
- confidence / confidence class;
- source artifacts or source truth;
- grounded status;
- execution/action/transaction/signature fields;
- wallet/private-key/seed material;
- methodology or policy mutation;
- authority or permissions.

The model must never be able to smuggle answer content through the understanding contract.

## Deterministic ownership

The deterministic OS remains responsible for:

- validating the candidate;
- resolving entities against known live state;
- deciding whether the requested semantic object actually exists;
- applying Semantic Substitution Safety;
- selecting canonical source artifacts;
- constructing the answer;
- assigning confidence class;
- calculations;
- Output Guard;
- all authority boundaries.

## Authority

`executionAuthority = none`

The Intent Contract cannot sign, execute, rebalance, move capital, mutate methodology, mutate security policy, or grant permissions.

## Release invariant

The contract is not production-ready unless:

- all valid fixtures normalize to a frozen bounded envelope;
- unknown keys fail closed;
- answer/confidence/source fields fail closed;
- transaction/wallet/authority fields fail closed;
- unsupported intents, metrics, comparisons and timeframes fail closed;
- capability metadata states `canAnswer=false`, `canSetConfidence=false`, `canSelectSourcesAsTruth=false`, `canExecute=false`, `executionAuthority=none`.

## Product maturity

This is infrastructure earned by the broad-sweep language ceiling. It does **not** justify a visible maturity upgrade by itself. Ask remains `Synthesizing` until model-assisted understanding is actually connected and proven to improve natural-language coverage without degrading evidence safety.
