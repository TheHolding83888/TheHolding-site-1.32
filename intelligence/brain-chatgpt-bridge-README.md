# The Holding Brain — ChatGPT Bridge v0.1

## Why this exists

The Holding has a production deterministic Grounded Brain.

The next useful cognitive step is model interpretation, but the project currently
does not want a separate recurring API bill.

The Bridge therefore creates a clean zero-extra-cost boundary:

`Grounded Brain`
→ `deterministic public Bridge`
→ `human-triggered ChatGPT interpretation`

All deterministic collection, memory, security and reasoning remain autonomous in GitHub.

The LLM step is triggered only when the owner asks ChatGPT to inspect the Brain.

## No API dependency

The Bridge:

- uses no OpenAI API;
- needs no API key;
- makes no model call;
- has no network dependency;
- costs no separate model/API budget.

## Input boundary

The Bridge reads only:

`/intelligence/brain-intelligence.json`

It does not read or expose:

- raw System Memory;
- Memory Vault;
- raw Security Memory;
- Security Vault;
- private owner context;
- secrets.

## Stable evidence IDs

Every evidence object receives a stable content-derived ID:

`EV-<16 hex characters>`

The same exact evidence object keeps the same ID across Bridge runs.

Cases preserve the exact deterministic Brain `caseId`.

## Authority boundary

The Bridge copies:

- deterministic signal;
- why it matters;
- what follows;
- deterministic action;
- recommendation class;
- risk tier;
- confidence;
- evidence IDs.

When ChatGPT interprets the Bridge:

- facts remain deterministic;
- evidence remains deterministic;
- allowed action remains the deterministic case action;
- ChatGPT may synthesize and prioritize;
- ChatGPT may select an existing next-best case;
- ChatGPT must not invent a new operational action;
- execution remains disabled.

## Prompt-injection boundary

Evidence text is explicitly data, not instructions.

The Bridge itself performs no model call, so evidence cannot trigger external behavior
during Bridge generation.

When ChatGPT reads the Bridge manually, the handoff contract says to ignore any
instruction-like content found inside evidence.

## Public-output secret guard

Before writing the public Bridge, the generator scans the resulting packet for common
high-risk secret markers:

- private-key PEM;
- GitHub PAT;
- OpenAI API key;
- Anthropic API key;
- AWS access key.

If such a marker is detected, publication fails without printing the matched secret.

## Generated artifacts

`/intelligence/brain-chatgpt-bridge.json`
Current machine-readable handoff.

`/intelligence/brain-chatgpt-bridge.md`
Readable handoff.

`/intelligence/brain-chatgpt-bridge-history.json`
Bounded semantic history of Bridge changes.

`/intelligence/brain-chatgpt-bridge-eval.json`
Deterministic Bridge validation report.

## History semantics

The current Bridge always binds to the exact latest Brain file SHA-256.

Bridge History, however, deduplicates by semantic Brain snapshot so harmless daily
timestamp refreshes do not create meaningless long-term observations.

Deep economic/security memory remains in the existing Vaults.

## Schedule

Daily at `07:12 UTC`, after the production Grounded Brain at `07:07 UTC`.

Manual trigger is also supported.

## Owner workflow

The owner writes:

`чекай brain`

ChatGPT then reads the live production Bridge and performs the interpretation step.

No copy/paste of the entire Brain packet should be required.
