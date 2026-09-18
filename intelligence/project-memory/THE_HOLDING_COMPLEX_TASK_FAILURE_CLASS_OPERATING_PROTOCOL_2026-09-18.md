# THE HOLDING — COMPLEX TASK / FAILURE-CLASS OPERATING PROTOCOL

Created: 2026-09-18
Status: durable operating canon
Execution authority: none

## Purpose

Prevent long-running engineering/reliability work from turning into one expanding investigation. This is a working-discipline protocol, not a new orchestration layer, agent, scheduler, source of truth, or execution authority.

Use it only when a task becomes materially complex, ambiguous, recursive, or multi-hour.

## Activation signals

Enter **Complex Task / Failure-Class Mode** when one or more of these are true:

- several competing root-cause hypotheses are being explored at once;
- diagnosis, repair, proof and closure have become mixed together;
- the same evidence/history is being reread without a narrowing decision;
- the active task keeps expanding into adjacent subsystems;
- 30–60 minutes pass without a bounded conclusion, checkpoint or explicit external wait;
- a repair has landed but physical production acceptance is still unproven;
- fresh `main` materially changed while a long investigation was in progress;
- a generated artifact is approaching a platform/storage/runtime boundary and the failure class risks becoming structural rather than local.

Activation does not imply a system defect. It only changes how the work is decomposed.

## Core law

`DIAGNOSE != REPAIR != PROVE != CLOSE`

These are four separate states and, when useful, four separate cards/packets.

A repair is not proof.
A green workflow is not physical production materialization.
A later green run does not by itself prove an older incident's root cause is closed.
A plausible explanation is not closure.

## One failure class at a time

Each active packet must contain:

1. one narrow question;
2. one failure class or acceptance condition;
3. the smallest relevant evidence set;
4. one next discriminating test/action;
5. one explicit exit state.

Allowed exit states:

- `DONE`
- `WAITING_EXTERNAL_PROOF`
- `OPEN_DEFECT`
- `OWNER_BOUNDARY`

If a new defect is discovered, create a new packet rather than silently widening the current one.

## Packet lifecycle

### 1. Diagnose

State exactly what is observed and what remains unproven.
Separate facts from hypotheses.
Prefer the next test that distinguishes hypotheses instead of collecting more general history.

### 2. Repair

Apply the smallest systemic fix for the proven failure class.
Do not create a parallel writer, scheduler, truth source, watchdog or orchestration path unless a demonstrated gap requires it.
Preserve authority, accounting, security and fail-closed boundaries.

### 3. Prove

Re-read fresh `main` and exact post-repair evidence.
Require the proof appropriate to the failure class: exact-head CI, natural schedule event, physical generated artifact, deployment bytes, downstream rebind, recurrence check, visual acceptance, or another explicit acceptance condition.

`GREEN workflow != physically materialized production artifact` remains binding.

### 4. Close

Close only when the stated acceptance condition is physically evidenced.
Write the durable lesson/root cause only after evidence supports it.
If acceptance fails, classify the exact remaining layer and open one bounded packet.

## Re-baseline rule

After a material merge, repair, scheduler migration, source change or long external wait, do not continue from the old mental model.

Before the next decision:

`fresh main -> fresh canonical artifact -> exact run/evidence -> resume`

Unrelated generated/data-only drift can be classified and ignored. Relevant dependency drift requires re-validation. Do not spend hours investigating a state that no longer exists.

## Anti-stall checkpoint rule

During unresolved complex work, write a small delta/checkpoint after roughly 30–60 minutes or after any material discovery.

Checkpoint only:

- current failure class;
- proven facts;
- rejected hypotheses;
- open hypothesis/question;
- exact next test;
- current exit state;
- relevant run/commit/artifact identifiers.

Do not copy routine run noise or broad Actions history into prose memory.

## Evidence economy

Once a root cause, run ID, commit or artifact boundary is bound, use exact identifiers.
Avoid repeatedly rereading the entire Actions/repository history unless fresh contradictory evidence requires it.

The goal is not less rigor. The goal is higher information gain per read/action.

## Generated-state size budget

Large generated state must not be allowed to discover hard platform limits only by failing in production.

For materially growing generated artifacts:

- track approximate size/growth when the artifact is already large or fast-growing;
- introduce a warning before the hard provider/repository limit;
- prefer partition/shard + manifest/index structures when one monolithic artifact becomes structurally unsafe;
- preserve one canonical logical truth even if physical storage is partitioned;
- do not create duplicate economic truth merely to solve transport/storage size.

The 2026-08-29 Economic Graph >100 MB publication failure is the motivating observed class, not a universal fixed threshold for every backend.

## Complexity budget

This protocol must reduce complexity, not become a new subsystem.

Therefore by default:

- no new agent;
- no new scheduler;
- no automatic remediation authority;
- no new persistent runtime service;
- no universal task-management engine;
- no automatic architecture mutation.

If repeated real use later proves machine-readable detection is valuable, that may be proposed separately with evidence. Until then this is a human/model operating discipline carried through project memory and routing.

## Relationship to Flow Mode

Normal bounded work remains in Flow Mode:

`diagnose -> implement -> exact-head verify -> merge -> physical proof -> bounded cleanup`

Complex Task / Failure-Class Mode is a narrowing mechanism inside Flow Mode when complexity or uncertainty grows. It does not create artificial stop points; it prevents one objective from silently becoming many objectives.

## Durable handoff format

For a complex active task, future chats/models should be able to recover from a compact statement like:

`Objective / packet / state / proven facts / next discriminating test / acceptance proof / blockers`

Example:

`P10 / Stable scheduler / WAITING_EXTERNAL_PROOF / workflow registered / next test = natural schedule / acceptance = event=schedule + three physical Stable files + downstream rebind`

## Permanent invariants

- One primary objective at a time.
- Maximum one failure class per active packet.
- Repair, proof and closure are distinct.
- Fresh live state outranks prose memory.
- A new discovered defect becomes a new packet, not hidden scope expansion.
- No multi-hour archaeology without writing the useful delta.
- Do not weaken guards merely to turn RED into GREEN.
- Do not add architecture unless a demonstrated recurring gap justifies it.
- Capability must grow faster than complexity.
- `executionAuthority = none`.
