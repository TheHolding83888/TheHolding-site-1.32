# The Holding Brain — Controlled Model Interpretation v0.2

## What this layer is

v0.1 gave The Holding a deterministic cortex:

`canonical memory → evidence-bound reasoning cases`

v0.2 adds a replaceable model interpreter above that deterministic layer:

`deterministic Brain → controlled model interpretation → bounded prioritization`

The model is not allowed to become the source of truth.

## Current provider

OpenAI Responses API

Model:
`gpt-5.6-sol`

Reasoning effort:
`xhigh`

Storage:
`store: false`

No tools are supplied to the model.

## What is sent to the model

Only a normalized public evidence packet derived from:

`/intelligence/brain-intelligence.json`

The model does NOT receive:

- raw System Memory;
- Memory Vault records;
- raw Security Memory;
- Security Vault records;
- secrets;
- wallet keys;
- GitHub credentials;
- private owner context.

## What the model may do

- explain the deterministic Brain;
- synthesize relationships across cases;
- prioritize cases;
- select the next best case to address;
- explain why.

## What the model may NOT do

- invent facts;
- invent metrics;
- invent action classes;
- replace unknown with zero;
- browse the web;
- use tools;
- run code;
- mutate methodology;
- modify repository source;
- modify workflows;
- execute capital actions.

## Deterministic enforcement

Structured Outputs constrain shape.

Post-model validation additionally enforces:

- exact case coverage;
- case-level evidence membership;
- cross-case evidence membership;
- valid next-best case;
- evidence for next-best selection;
- high/critical human-review gate;
- numeric grounding;
- proposal-only boundaries.

The model does not generate the operational action.
It selects a case and supplies interpretive rationale.
The final action text is attached from the deterministic Brain case.

## Generated artifacts

- `/intelligence/brain-interpretation.json`
- `/intelligence/brain-interpretation-history.json`
- `/intelligence/brain-interpretation-brief.md`
- `/intelligence/brain-interpretation-eval.json`

## Schedule

Daily at `07:17 UTC`, after:

- Stable Capital 05:37
- Reporting 06:07
- Observer 06:27
- Security Sentinel 06:47
- Grounded Brain 07:07
- Controlled Interpretation 07:17

## API secret

Use a dedicated OpenAI API project key.

Store it only as GitHub Actions repository secret:

`OPENAI_API_KEY`

Never commit the key into code, YAML, JSON, README, or chat logs.

## Architecture

`Collectors`
→ `Observer`
→ `Memory`
→ `Security Sentinel`
→ `Grounded Brain`
→ **`Controlled Model Interpretation`**
→ future `Independent Reviewer`
→ future `Proposal Engine`
→ deterministic `Guardian`
→ human gate / bounded executor
