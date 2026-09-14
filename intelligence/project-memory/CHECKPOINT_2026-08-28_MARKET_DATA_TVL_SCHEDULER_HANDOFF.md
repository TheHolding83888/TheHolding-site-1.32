# THE HOLDING — MARKET DATA / TVL SCHEDULER HANDOFF CHECKPOINT

Prepared: 2026-08-28
Purpose: preserve the exact working state before changing chats. This is a checkpoint, not a claim that the incident is fixed.

## Live anchor at checkpoint

Repository: `TheHolding83888/TheHolding-site-1.32`
Canonical branch: `main`
Fresh main head observed before creating this checkpoint branch: `0cfd336f8ca986b709053cbc040d0d6c85358172`
Main head message: `memory: refresh current project bootstrap`

`intelligence/project-memory/CURRENT.md` represented canonical source state `2026-08-28T04:16:20.508Z` at this anchor.

Checkpoint branch:
`checkpoint/market-data-tvl-scheduler-2026-08-28`

Important: always refetch live `main` before resuming. This SHA is only a recovery anchor.

## Current objective

Close the active **Market Data / TVL freshness and scheduler incident** narrowly and production-safely.

This is currently treated as an operational economic-truth issue, not evidence that the previously closed Control Plane optimization milestone should be reopened.

Working severity from the evidence carried into this checkpoint: **P1 operational defect, not P0** unless fresh evidence proves broader corruption/outage.

Reason: stale Market Data makes TVL / capital valuations stale, but available evidence showed the writer/calculation path can still succeed and the public site was not shown to be fully down or corrupted.

## Evidence already established before this checkpoint

The following facts were carried from the active parallel investigation and must be re-verified from live Actions/artifacts before mutation:

1. Canonical Shared Market Data schedule was intended to remain one canonical 30-minute path, historically `7,37 * * * *`.
2. A prior Market Data run (`#252` in the carried evidence) was a real `event: schedule` run and succeeded, but GitHub created it materially later than the expected slot (~23 minutes late versus the expected 23:37 UTC tick).
3. At another observation point, expected Market Data and Runtime Reliability scheduled events did not materialize at their expected slots.
4. Because misses appeared across at least two independent scheduled workflows, the leading hypothesis became **GitHub scheduled-event delivery/materialization instability**, not a local Market Data calculation/writer bug.
5. Therefore a second GitHub cron/watchdog would be a false repair if it depends on the same scheduler path.
6. Existing Runtime Reliability authority intentionally has `workflowDispatchAuthority=false`; do not grant dispatch/cancel authority merely to compensate for provider scheduler uncertainty.
7. Manual dispatch can prove writer logic, but **cannot prove scheduler health**. Scheduler repair requires natural `event=schedule` proof.
8. UNKNOWN must never be silently converted to zero; stale/currentness semantics must remain fail-closed.

## What this chat did / did not do

### Done

- Recovered project continuity and preserved the current architectural laws.
- Kept the investigation bounded to Market Data / TVL currentness instead of reopening broad fan-out optimization.
- Identified the remaining repo-side question as a **currentness-consumer gap**: whether public capital / TVL consumers already detect stale canonical Market Data and fail closed / surface stale state correctly.
- Refetched fresh `main` and `CURRENT.md` immediately before this checkpoint.

### Not done

- No production code fix has been committed by this chat for the currentness gap.
- No new cron, watchdog, dispatcher, workflow or execution authority was added.
- No scheduler issue is declared closed.
- No natural post-repair `event=schedule` proof has been obtained by this chat.

Do not tell the owner that the Market Data / TVL incident is fixed until the completion criteria below are physically proven.

## Exact next resume order

Start fresh from live truth, not this prose:

1. Fetch live `main` and `intelligence/project-memory/CURRENT.md`.
2. Load latest continuity + Router only as required.
3. Inspect the exact current Shared Market Data workflow YAML and scheduler contract. Confirm schedule, workflow state, permissions, concurrency and any recent changes.
4. Inspect the exact current Runtime Reliability scheduled observer path and its authority flags. Preserve `workflowDispatchAuthority=false` unless an explicit new owner decision changes authority.
5. Inspect recent GitHub Actions runs for both workflows. Classify each expected tick as:
   - naturally materialized on time,
   - naturally materialized late,
   - created but queued/stuck/failed,
   - or not created at all.
6. Read live generated artifacts, at minimum the current Market Data snapshot and Public Capital state, and compare canonical timestamps/provenance.
7. Locate the exact Public Capital / TVL consumer(s) and the already-existing freshness/currentness authority. Do not invent a new threshold if the repository already defines one.
8. Determine whether stale Market Data is already surfaced/fail-closed correctly.
   - If yes: do not create unnecessary repo code. Focus on natural scheduler proof/provider boundary.
   - If no: make one minimal fail-closed consumer fix using existing canonical freshness semantics.
9. Reuse existing checks/canaries. Do not create a new workflow for a tiny repair.
10. Obtain physical production proof before closure.

## Completion criteria

The incident can be marked GREEN / CLOSED only when all relevant conditions are proven:

- one canonical Market Data writer remains authoritative;
- no duplicate cron/watchdog/orchestrator was introduced without exact necessity;
- no new dispatch/cancel/execution authority was created;
- Market Data canonical output is fresh according to existing authority;
- Public Capital / TVL does not silently present materially stale valuation as current;
- stale/unknown state remains fail-closed and UNKNOWN != 0;
- existing safety/security checks remain GREEN;
- at least one **natural `event=schedule`** run proves scheduler materialization after the repair/observation boundary;
- generated artifacts physically materialize as expected on production `main`;
- no unrelated Control Plane milestone is reopened without new evidence.

## Do-not-do list

- Do not add a second GitHub cron just because the first cron was delayed/dropped.
- Do not add a new watchdog that depends on the same failing scheduler source.
- Do not enable autonomous workflow dispatch/cancellation as a convenience repair.
- Do not invent a new freshness methodology or threshold if canonical semantics already exist.
- Do not treat a manual workflow dispatch as scheduler proof.
- Do not weaken Security / privileged deployment proof to make counts look GREEN.
- Do not mix the separate Cloudflare deployment tail into this incident unless fresh evidence establishes causality.
- Do not continue generic fan-out optimization; that milestone is frozen/saturated by default unless measured new pain appears.

## Separate known tail — not part of this fix

Cloudflare Workers Build RED remains a separate issue classified in prior review as `WAITING EXTERNAL ACCOUNT/LOG PROOF` unless fresh evidence changes that classification. The live site had remained served by the last good deployment in the carried evidence. Do not make blind repo diagnostic PRs for Cloudflare without authenticated provider build logs.

## Broader next project direction after closure

Once Market Data / TVL freshness is closed and Cloudflare remains separately tracked, return to economic/sensor intelligence depth rather than more Control Plane plumbing. Current conceptual priority is longitudinal native-period sensor learning and bounded falsifiable prospective expectations, with owner decisions remaining a sparse complementary journal rather than the primary learning source.

## Message for the next chat

Use this file as a recovery handoff, but treat it as secondary to live truth. Begin from `CURRENT.md`, refetch live `main`, re-verify every changing fact above, then continue only the bounded Market Data / TVL currentness + scheduler objective. Do not broaden scope. Preserve one canonical writer, no new execution authority, natural schedule proof, and fail-closed stale-data semantics.
