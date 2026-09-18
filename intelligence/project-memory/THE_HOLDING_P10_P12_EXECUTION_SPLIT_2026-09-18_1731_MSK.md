# THE HOLDING — P10 / P12 EXECUTION SPLIT

Created: 2026-09-18 17:31 MSK
Purpose: stop treating P10/P12 as one large investigation and convert the remaining work into small, independently closable packets.

## Operating rule

One packet = one narrow question, one evidence set, one decision, one checkpoint.
Do not reopen previously proven history unless new evidence contradicts it.
Do not mutate `main` merely to make a workflow green.
P10 acceptance remains physical-production-evidence based.
P12 cleanup remains downstream of P10/P11 ordering unless the roadmap is explicitly changed.

## P10 — close as a short acceptance packet

### P10-A — Stable Capital natural scheduler proof
Goal: answer only whether the canonical Stable Capital scheduler has naturally fired and physically refreshed its three production artifacts on `main`.
Evidence required:
- `event=schedule` run of `.github/workflows/update-stable-capital-scheduled.yml`
- successful completion
- post-run materialization on `main` of:
  1. `companies/stable-capital-data.json`
  2. `companies/embedded-yield-ledger.json`
  3. `companies/stable-index-data.json`
Exit:
- PASS => proceed to P10-B
- FAIL/MISSING => classify exact failure; do not widen scope

### P10-B — downstream rebinding after Stable publication
Goal: prove stale Stable sources no longer poison Observer/System Memory/Cognitive Stack.
Evidence required:
- fresh Runtime Observer / System Memory after the Stable publication boundary
- natural or canonical Cognitive Stack materialization using the refreshed sources
- no freshness bypass / threshold weakening
Exit:
- PASS => P10-C
- FAIL => isolate exact downstream break only

### P10-C — system-wide production acceptance memo
Goal: one compact final acceptance snapshot for P10.
Include:
- P5-P9 already closed
- Company #010/Cypher scheduler/publication proof
- Reporting/Rewards/HyperLend repaired evidence
- Stable scheduler proof
- Observer/System Memory/Cognitive rebind proof
- any genuine remaining red production failure class
Exit:
- no genuine blocking red => P10 CLOSED
- real blocker => one new bounded packet, not another broad investigation

## P11 — bounded cosmetic/current-state package
Only run if roadmap still requires it after P10. Do not mix P11 into P12 cleanup.

## P12 — split into six packets

### P12-A — metadata cleanup / stale PRs
Scope: only stale/superseded PR metadata and intentionally-never-merge canaries.
Candidates already identified: #852, #730, #729, #717, #433, #37.
Exit: each PR classified CLOSE / KEEP / NEEDS OWNER BOUNDARY. No code changes.

### P12-B — resolved incident closure
Scope: incidents with durable repair evidence already present.
Candidates: #822 HyperLend, #369 Rewards, #447 Unified Capital, #716 Market Data, #792 ve33 verifier, #726 Comparative Intelligence.
Exit per issue: root cause + repair commit/PR + post-fix success + recurrence check. Close only when all four are evidenced.

### P12-C1 — Aerodrome archive-RPC capability mismatch (#815)
One defect only. Repair should distinguish basic RPC liveness from historical/archive capability and fail closed.
Do not widen to general RPC redesign.

### P12-C2 — Economic Graph publication/recovery
One defect family only.
Newly recovered historical evidence: on 2026-08-29 Economic Graph generation/validation succeeded, but publish failed because `intelligence/economic-graph/economic-graph.json` reached 116.42 MB and GitHub rejected it over the 100 MB file limit. Historical recovery then stopped at Graph rebuild, skipping downstream Explanatory/Observer/Cognitive steps.
This is a concrete historical production failure class and should be bound to #456/#778 only if exact issue/run lineage matches.
Required next step: prove issue/run lineage, then decide whether current architecture already eliminated this failure class or a bounded preventive guard is still needed.
Do not infer closure merely from later green runs.

### P12-C3 — Reporting publish-time main drift (#799)
One defect only.
Design target: deterministic input boundary. Relevant drift => recompute; unrelated drift => retain validated candidate/bounded validation; unknown drift => fail closed.
Do not solve by increasing timeout.

### P12-D — Cognitive freshness incidents (#379/#564)
Do not patch independently before P10 Stable proof.
After P10 fresh publication/rebinding, check recurrence. If no recurrence and root cause is the stale upstream source chain, close as downstream symptom. If recurrence remains, create a new bounded packet.

### P12-E — final fan-out/runtime audit
Only after A-D.
Use existing control-plane evidence. Do not invent another orchestration layer.
Output: real remaining failure classes, redundant workflows, stale metadata, and items intentionally retained.

### P12-F — cleanup freeze / handoff to P13
Produce one freeze snapshot:
- what closed
- what stayed open and why
- what was changed
- what is evidence-only
- what requires owner/destructive/security confirmation
Then advance to P13.

## Anti-stall rules

1. Maximum one defect family per working packet.
2. After 30-60 minutes of investigation, save a delta/checkpoint even if unresolved.
3. Every packet must end with one of: DONE / WAITING EXTERNAL PROOF / OPEN DEFECT / OWNER BOUNDARY.
4. No multi-hour archaeology without writing the discovered evidence to project memory.
5. Avoid re-reading all Actions history after a root cause has been bound; use exact run IDs/commits.
6. `main` remains the truth source; checkpoint branches are continuity/evidence only unless explicitly promoted.

## Recommended immediate order

1. P10-A fresh Stable scheduler proof.
2. P10-B downstream rebinding.
3. P10-C close P10.
4. P11 only if still required.
5. P12-A then P12-B.
6. P12-C1, C2, C3 one at a time.
7. P12-D recurrence closure.
8. P12-E/F and move to P13.
