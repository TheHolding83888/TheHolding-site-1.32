# The Holding Brain — Grounded Reasoning Gateway v0.1

## Purpose

This is the first production cortex layer above The Holding's existing nervous system and memory.

Inputs:

- `intelligence/change-intelligence.json`
- `intelligence/system-memory.json`
- `security/security-intelligence.json`
- `security/security-memory.json`
- `intelligence/brain-policy.json`

Generated outputs:

- `intelligence/brain-intelligence.json`
- `intelligence/brain-history.json`
- `intelligence/brain-brief.md`

## Questions answered

The layer converts canonical memory into evidence-bound answers to:

1. What changed?
2. Why does it matter?
3. What follows?
4. What should be done?
5. What evidence supports the conclusion?

## v0.1 is deliberately deterministic

No LLM is called in v0.1.

This is intentional.

Before GPT, Claude, or another model is allowed to interpret The Holding's memory, the project first establishes a deterministic grounding contract:

- no reasoning case without evidence;
- exact source file + pointer + SHA-256 attached to conclusions;
- stale remains stale;
- unknown remains unknown;
- correction-ledger precedence is preserved;
- recommendations are proposal-only;
- no capital execution;
- no methodology mutation;
- no source-data mutation;
- no autonomous code mutation;
- no autonomous workflow-plane mutation.

## Future model contract

A future model may sit *above* this packet.

It may summarize, explain, compare, challenge, and produce candidate proposals.

But:

- material claims must cite packet evidence;
- policy gates remain deterministic and external to the model;
- the model is replaceable;
- the model may never bypass The Holding's constitution.

Conceptually:

`Observer + Memory Vault + Security Sentinel`
→ `Grounded Reasoner`
→ `Evidence Packet`
→ `GPT / Claude / future model`
→ `Proposal`
→ `Policy / Guardian`
→ `Human gate / bounded executor`

## Schedule

Daily at `07:07 UTC`, after:

- Stable Capital 05:37
- Reporting 06:07
- Observer 06:27
- Security Sentinel 06:47

Manual `workflow_dispatch` is also supported.

## Security boundary

The Brain workflow writes only its generated reasoning artifacts.

It does not modify `.github/workflows`, production engines, methodology, company source data, or wallet state.
