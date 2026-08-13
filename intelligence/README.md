# The Holding Autonomous Change Intelligence Layer

## v0.1 — Observer + System Memory

This layer sits **above** the existing production collectors. It does not replace Productivity, Rewards, Stable Capital or Reporting and it does not recalculate their economics.

Its job is to answer four questions every day:

1. **What changed?**
2. **Why does it matter?**
3. **What should be watched next?**
4. **What did the system know before this run?**

Architecture:

```text
Productivity ─┐
Rewards ──────┤
Stable Capital┤
Stable Index ─┤──> The Holding Observer ──> System Memory
Embedded Yield┤                            ├─> Change History
Reporting ────┘                            ├─> Change Intelligence
                                          └─> Daily Brief
```

The Observer is deliberately deterministic in v0.1. It does **not** call an LLM, invent explanations, alter methodology, or execute capital decisions.

## Files

- `change-intelligence-engine.mjs` — deterministic observer and delta engine.
- `system-memory.json` — latest normalized machine-readable system state plus source provenance.
- `change-history.json` — append-only material-change/event memory (bounded to recent 730 runs / 5,000 unique events).
- `change-intelligence.json` — compact canonical bridge for human/AI reasoning.
- `daily-brief.md` — deterministic readable summary.

## Canonical bridge

For future AI reasoning, read this first:

`/intelligence/change-intelligence.json`

Only open the large source artifacts when deeper evidence is needed.

This makes the Observer a **brain stem / memory bridge** while higher-level reasoning can remain external and fail-closed.

## Source files observed

- `/companies/productivity-data.json`
- `/companies/rewards-data.json`
- `/companies/stable-capital-data.json`
- `/companies/stable-index-data.json`
- `/companies/embedded-yield-ledger.json`
- `/reporting/reporting-data.json`

Every source is fingerprinted with SHA-256 and its version/generatedAt are preserved in System Memory.

## Schedule

`06:27 UTC daily`

This intentionally runs after the current data pipeline:

- Productivity — Sunday 04:17 UTC
- Rewards — daily 04:57 UTC
- Stable Capital — daily 05:37 UTC
- Reporting — daily 06:07 UTC
- Observer — daily 06:27 UTC

## First-run semantics

The first run creates a **baseline**. It should not fabricate a long list of “changes” because there is no prior Observer state to compare against.

From the second run onward, material deltas become events.

## Event families v0.1

- source/schema version changes
- new/removed Productivity companies
- company Reference APR changes
- company Productivity coverage changes
- adapter status changes (`warming → ok`, `ok → warming`, etc.)
- accrued reward changes
- reward completeness changes
- Stable Current Capital / APY / Claimable / Embedded Yield / Performance changes
- Stable coverage-state changes
- new daily reporting observations
- current-month cash-flow / generated-income changes
- source freshness warnings

Thresholds intentionally suppress meaningless dust so the event stream stays useful.

## Safety rules

- Never treat `null`, missing, warming or unknown as zero.
- Never recompute canonical APR/APY/rewards/performance methodology here.
- Never mutate source data.
- Never publish an invented explanation as fact.
- Every event preserves source provenance.
- First version observes and remembers only.
- Future autonomous proposals should be **generated automatically but deployed only through bounded/fail-closed policy**.

## Roadmap

### v0.2 — Memory depth
- milestone detector
- anomaly detector
- strategy-drift events
- company birthdays / operating-history milestones
- new-capability-unlocked events
- richer registry-level network state

### v0.3 — Narrative intelligence
A separate reasoning agent reads `change-intelligence.json` and writes a draft:

> What changed → why it matters → what to watch next

Draft first; no autonomous public publishing.

### v0.4 — Proposal engine
The system can propose:
- new Passport metrics when enough history exists
- new charts
- reusable adapters when a mechanism repeats
- stale methodology/UI sections
- candidate site updates

Still no risky self-deployment.

### v1.x — Bounded self-building
Low-risk data/content changes may become automatically publishable under explicit policy. Code, methodology and capital actions remain gated by progressively stronger approval, testing and permission boundaries.

Long-term loop:

```text
OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → IMPROVE
                                                  ↓
                              bounded autonomous action later
```
