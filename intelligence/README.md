# The Holding Autonomous Change Intelligence Layer

## v0.2 — Observer + System Memory + Memory Vault

This layer sits **above** the existing production collectors. It does not replace Productivity, Rewards, Stable Capital, Stable Index, Embedded Yield or Reporting, and it does not recalculate their economics.

Its job is now split into two memory horizons:

1. **Operational memory** — fast current state and recent material events.
2. **Long-term canonical memory** — an append-only, SHA-256 hash-chained record of every Observer run.

Architecture:

```text
Productivity ─┐
Rewards ──────┤
Stable Capital┤
Stable Index ─┤──> The Holding Observer ──> System Memory
Embedded Yield┤                            ├─> Change History (fast / bounded)
Reporting ────┘                            ├─> Change Intelligence
                                          ├─> Daily Brief
                                          └─> Memory Vault (long-term / append-only)
```

The Observer remains deterministic. It does **not** call an LLM, invent explanations, alter canonical methodology, change the website, or execute capital decisions.

## Memory model

### `system-memory.json`
The current normalized state of The Holding plus source provenance.

Think of it as **what the system knows now**.

### `change-history.json`
Fast operational event/run history.

It intentionally keeps a bounded working set:
- latest 730 runs;
- latest 5,000 unique material events.

It also exposes lifetime counters that point to the permanent Vault.

### `change-intelligence.json`
Compact bridge for human/AI reasoning.

Read this first. It tells a future reasoning layer:
- what changed;
- what remains under watch;
- current source health;
- the current Memory Vault anchor.

### `memory-vault/`
The permanent memory.

Every Observer run gets its own immutable JSON record under:

```text
/intelligence/memory-vault/YYYY/MM/<run-id>.json
```

The record contains:
- normalized system snapshot;
- SHA-256 provenance of all canonical source files;
- material events detected in that run;
- watch conditions;
- snapshot hash;
- source composite hash;
- previous Vault record hash;
- its own SHA-256 record hash.

`/intelligence/memory-vault/manifest.json` indexes the whole chain.

The v0.2 policy has **no configured lifetime cap**.

This is the long-term "flash drive" for The Holding Brain.

## Hash-chain integrity

Each Vault record includes:

```text
previous record hash
        ↓
current canonical record payload
        ↓
SHA-256 current record hash
```

The next record points to the current one.

This does not make Git immutable by itself, but it makes silent historical mutation detectable and gives future audit/reasoning layers a deterministic integrity chain.

The workflow validates the latest chain anchor before publishing.

## v0.1 baseline migration

The first v0.2 run does not discard the already verified v0.1 baseline.

If no Vault exists yet, the engine imports the existing canonical:
- `system-memory.json`
- matching `change-intelligence.json`
- matching `change-history.json`

into the first permanent Vault record.

It then appends the new v0.2 run as the next record.

No fabricated pre-history is created.

## Canonical bridge

For future AI reasoning, read first:

`/intelligence/change-intelligence.json`

Then use its `bridge.memoryVault.latestRecordPath` when historical evidence is required.

Only open large raw source artifacts when deeper protocol/economic evidence is needed.

## Source files observed

- `/companies/productivity-data.json`
- `/companies/rewards-data.json`
- `/companies/stable-capital-data.json`
- `/companies/stable-index-data.json`
- `/companies/embedded-yield-ledger.json`
- `/reporting/reporting-data.json`

Every source is fingerprinted with SHA-256.

## Schedule

`06:27 UTC daily`

Current pipeline order:

- Productivity — Sunday 04:17 UTC
- Rewards — daily 04:57 UTC
- Stable Capital — daily 05:37 UTC
- Reporting — daily 06:07 UTC
- Observer — daily 06:27 UTC

Manual `workflow_dispatch` remains available.

## Safety rules

- `null`, missing, empty, warming and unknown are never silently converted to zero.
- Observer never recomputes canonical APR/APY/rewards/performance methodology.
- Observer never mutates source data.
- Vault records are append-only at the engine level: an existing run path cannot be overwritten with different content.
- A hash mismatch fails closed.
- A manifest/record mismatch fails closed.
- Rebase/push conflicts fail rather than guessing.
- AI reasoning remains downstream of deterministic memory.
- Autonomous generation can expand over time; deployment/action remains bounded.

## Why keep both Change History and Memory Vault?

Because they serve different jobs.

`change-history.json` should stay small and fast for the live site and current reasoning.

The Memory Vault is the deep archive. Five or ten years from now, The Holding should still be able to recover the state it observed on an exact day without depending on a rolling buffer.

## Roadmap after v0.2

### v0.3 — Milestones + capability detection
- TVL thresholds
- company birthdays
- operating-history thresholds
- coverage recovery
- adapter capability unlocks
- anomaly and strategy-drift candidates

### v0.4 — Narrative Intelligence
A reasoning layer reads Change Intelligence + Memory Vault and drafts:

> What changed → why it matters → what to watch next

### v0.5 — Proposal Engine
The system proposes:
- new Passport metrics when enough history exists;
- new charts;
- reusable adapters;
- new portal sections;
- safe code/content patches.

### Later — The Holding Brain
Provider-neutral reasoning engines (GPT, Claude, future models) plug into persistent Holding-owned memory, rules, mandates and audit history.

Long-term:

```text
OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → IMPROVE
                                                   ↓
                                 bounded autonomous action later
```

The model can change. The memory must remain The Holding's.
