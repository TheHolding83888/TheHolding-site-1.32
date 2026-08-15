# Ask The Holding · Semantic Substitution Safety v0.1

## Purpose

The first 150-question Capital OS broad sweep exposed a class-level trust failure: an unsupported question could be routed to an adjacent measured capability and receive a confident but semantically substituted answer.

Examples of forbidden substitution classes:

- realised / received company cash flow → current APR/APY or accrued Rewards;
- founding purpose / purpose drift → company definition, current APR, TVL or Performance;
- company maturity / reputation → evidence breadth or current productivity;
- guaranteed future APR/APY → current Reference APR/APY;
- exact future hack probability → current Security findings/severity;
- pre-tracking historical income → current earning capacity, Rewards or current value.

## Operating invariant

Unsupported semantics must fail closed **before** ordinary company, productivity, stable-capital, public-knowledge or protocol routing can substitute a nearby truth.

A correct UNKNOWN is a successful answer when the requested canonical object or validated methodology does not exist.

The semantic boundary may explicitly name an adjacent metric to explain why it cannot be substituted. Merely mentioning APR/APY in a rejection is not itself substitution.

## Frozen evidence

`corpus-semantic-safety-v0.1.json` is a frozen regression corpus derived from the first Capital OS 150-question broad sweep.

Release invariant for this corpus:

- expected confidence: UNKNOWN for unsupported semantics;
- source binding must identify the capability boundary;
- required answer semantics must explain the missing canonical object / methodology;
- false-MEASURED = 0;
- strict failures = 0.

## Architecture boundary

This layer is not a language model and does not attempt universal natural-language understanding. It is a deterministic trust boundary protecting the evidence plane before future model-assisted intent understanding is introduced.

Future model-assisted routing may replace or augment query understanding, but it must not bypass this semantic safety invariant, deterministic evidence binding, output guard, or `executionAuthority = none`.
