# THE HOLDING — BUILD DISCIPLINE CANON
## 2026-08-14

This is an owner operating directive for all future architecture, implementation and AI-assisted development of The Holding.

## Core rule

Build **layer by layer**, with high quality, explicit boundaries and a clear reason for every layer. Do not create work for the sake of work, meta-systems for their own sake, or deep side branches that obscure the main construction path.

The system must become more capable without becoming harder to understand, operate or verify.

## Required discipline

1. **One primary objective at a time.** Every build phase must state the concrete capability or problem it closes.
2. **No new layer without a gap.** A new subsystem is justified only when the current architecture cannot cleanly satisfy a real requirement.
3. **Close before expanding.** Prefer proving and using the current layer end-to-end before opening another architectural branch.
4. **Production proof matters more than architecture count.** A layer is not considered valuable merely because files/workflows exist; it must produce a verified useful artifact or capability.
5. **Minimize orchestration plumbing.** Add handoffs only when they remove a real operational failure mode or repeated manual burden.
6. **Keep authority behind intelligence.** Reasoning, memory and research may advance faster than mutation/execution permissions. Wallet/capital authority remains much later and explicitly bounded.
7. **Avoid duplicate sources of truth.** Each concept should have one canonical machine-readable home wherever practical.
8. **Prefer reuse over reinvention.** Reuse proven adapters, policies, reviewers and mechanisms instead of restarting research or creating parallel implementations.
9. **Regression safety is mandatory.** Do not trade speed for hidden breakage. Verify affected surfaces, but do not multiply checks beyond what the risk actually requires.
10. **Stop when the objective is closed.** Do not continue polishing a subsystem indefinitely if the next marginal improvement does not materially improve the whole Holding.

## Phase exit criteria

Before moving to the next major layer, answer:

- What real capability now exists that did not exist before?
- Is it present in production `main`?
- Has it passed the appropriate independent checks?
- Is its output actually consumed or useful downstream?
- Did complexity increase less than capability?
- Is there a clearly identified next bottleneck?

If these answers are weak, do not add another layer. Simplify, consolidate or use the existing system first.

## Current strategic implication

The cognitive-governance stack has reached a meaningful architectural threshold:

`Observer → Memory → Security → Brain → Cognitive → Learning → Proposal → Owner Decision → Builder Candidate → Guardian`

The next priority is **not to add many more abstract layers**. First exercise the two existing owner-approved P0 candidates through real bounded research and evidence, then decide whether Guardian sandbox-build authority is actually justified.

## Durable project-memory iron rule

The Holding must not depend on one chat session or one model remembering the project.

- GitHub `main` is the canonical durable home for project continuity.
- Material architecture decisions, owner directives, production milestones, safety boundaries, important failures/recoveries and roadmap shifts must be preserved in `intelligence/project-memory/` or in the appropriate machine-readable canonical subsystem.
- `intelligence/project-memory/CURRENT.md` is the compact auto-refreshed bootstrap entrypoint.
- On the first substantive The Holding turn in a new chat/session, read live `CURRENT.md` first, then its latest continuity checkpoint, then only the live machine-readable artifacts needed for the task.
- Do not copy trivial logs into prose memory. Compress meaning; keep raw detail in Git/workflow/history artifacts.
- When prose memory conflicts with changing production facts, fresh `main` artifacts win.

The model can change. The memory must remain The Holding's.

## Orchestration efficiency invariant

The Holding should behave as a directed, bounded organism – not a maze of workflows.

- Prefer a DAG of explicit handoffs; do not create autonomous cycles unless a bounded retry/recovery loop is deliberately required.
- Never dispatch a downstream workflow manually if an already-proven canonical handoff will produce the same fresh state; wait for and verify the canonical handoff instead.
- Eliminate repeated no-op or duplicate runs when they add cost/complexity without additional assurance.
- Safety redundancy is allowed only when it closes a distinct failure mode (for example, fresh Security immediately before reasoning).
- Every generated state has one canonical producer and one canonical source-of-truth path.
- If orchestration becomes harder to explain than the capability it delivers, simplify before adding another layer.

## Continuous improvement / antifragility invariant

The Holding should become harder to break **without becoming harder to reason about**.

- Do not add resilience machinery for hypothetical elegance. A new guard, fallback or recovery path must answer a demonstrated failure class or a clearly bounded high-consequence risk.
- When a real production failure reveals a reusable class, prefer one generic fix that protects future mechanisms over repeated local patches.
- Isolate local failures. A broken transport, sensor or protocol adapter should degrade its own evidence to explicit `UNKNOWN`, `partial` or `stale` state rather than corrupting unrelated truth planes.
- Multiple observation or transport paths are allowed when they protect a real evidence boundary; canonical truth and canonical writer authority remain singular.
- Recovery must be replayable/idempotent where practical: retrying a writer or rebuilding from canonical evidence must not double-count income or create duplicate state.
- Remove obsolete transition guards, compatibility plumbing and temporary recovery code after the new canonical path is physically proven.
- A hardening change is successful only when the reliability/capability gained is greater than the complexity it leaves behind.

## Owner quality standard

The target is not maximum speed and not maximum complexity. The target is **super quality, order, reproducibility, controlled progress and a system that remains understandable as it compounds**.

Whenever there is tension between adding more architecture and closing a real capability end-to-end, prefer the latter.
