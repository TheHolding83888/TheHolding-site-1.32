# THE HOLDING — MASTER CONTINUITY CHECKPOINT
## 2026-08-14 09:40 (+03)

This is a canonical handoff for future ChatGPT conversations. For mutable production facts, always verify live GitHub `main` and fresh generated artifacts before relying on this checkpoint.

## Project identity

The Holding is a **Capital Operating System + persistent intelligence/memory layer for sovereign onchain companies and funds**, not merely a website or dashboard.

Canonical intelligence loop:

`OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → ACT → MEASURE → LEARN`

Long-term bounded autonomy principle:

`Sovereign owner → explicit mandate → intelligent capital → bounded autonomous action`

Core concepts:
- capital with memory;
- capital that can explain itself;
- eventually bounded autonomous capital.

Verification invariant:

**If a value cannot be reproduced and verified, The Holding does not invent it.**

Economic layers must remain distinct:
- Reference Productivity / APR;
- Embedded Yield;
- Accrued Rewards;
- Realised Cash Flow;
- Treasury balance;
- Performance.

Unknown/warming is not zero. Signed verified return can be negative.

## Production repository and operating rule

Repository: `TheHolding83888/TheHolding-site-1.32`

Live site: `theholding.ai`

Changing production facts priority:
1. live GitHub `main`;
2. fresh generated production JSON;
3. fresh resolver/discovery/ledger artifacts;
4. latest intelligence library / canon;
5. older handoffs.

User shorthand **`чекай раны` / `чекай ран`** means independently inspect all fresh relevant GitHub Actions, exact runs/jobs/logs/artifacts, publish commits and fresh JSON. Do not ask the user to paste logs first.

GitHub write safety:
- no write without explicit command such as `грузи`, `мерджи`, `применяй`;
- prefer temporary branch + PR;
- merge only after explicit `мерджи`;
- after merge inspect Security, Repository Integrity and affected subsystem runs;
- if RED/WATCH, stop further production writes until understood.

## Security / Integrity / UI guards

Security Sentinel v0.1 + SHA Hardening v0.1.1 is production proven.

Pinned Actions:
- `actions/checkout@df4cb1c069e1874edd31b4311f1884172cec0e10` (`v6.0.3`)
- `actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e` (`v6.4.0`)

Original 30 HIGH mutable-action findings were eliminated by immutable SHA pinning. Security memory/history/vault is persistent and hash-chained. Recent coherent baselines have 0 Critical / 0 High.

Repository Integrity Sentinel validates repository contract, JSON parseability, dormant JS syntax, local paths/imports/workflow references and conflict markers. UI Regression Sentinel v0.1.1 is calibrated in observer mode.

## Decision & Outcome Learning v0.1.1

Canonical loop:

`Grounded Brain Case → Owner Decision → Later Coherent Observation → Outcome → Deterministic Lesson → Confidence Calibration`

Learning is structured experience memory, not model-weight training and not an executor.

Production state:
- first coherent Learning observations recorded;
- Independent Learning Reviewer PASS;
- successful Cognitive Stack completion wakes Learning through proven `workflow_run` topology;
- execution authority remains `none`;
- no autonomous wallet/code/methodology/policy mutation.

Do not create fake decisions or outcomes. Do not feed Learning context back into Grounded Brain yet. Wait for roughly 5–10 genuine settled outcomes, then design explicit exact-byte feedback and correction precedence to avoid self-confirming loops.

## Autonomous Cognitive Cycle v0.2

Canonical daily chain:

`Economic Collectors → Observer / System Memory → Security Sentinel → Grounded Brain → exact-upstream ChatGPT Bridge → Cognitive Stack → Decision & Outcome Learning`

Topology:
- Observer: daily `06:27 UTC`;
- standalone Security: daily `06:47 UTC`;
- integrated `Refresh Cognitive Stack`: daily `07:27 UTC` + manual;
- standalone Grounded Brain: manual recovery/diagnostic only;
- standalone ChatGPT Bridge: manual recovery/diagnostic only;
- Learning: `workflow_run` after successful integrated Cognitive refresh.

Scheduled Cognitive refresh fails closed unless Observer/System Memory are coherent, source health is fresh, Observer age is within the configured bound and Security/Brain/Bridge bindings remain exact.

Production proof:
- `Refresh Cognitive Stack #6`
- run ID `31774745930`
- SUCCESS
- publish commit `1facc9f7a1175e58573067826a62cccc35324295`

Learning then woke automatically and recorded the second coherent observation. Decisions/outcomes/lessons remained 0 by design; calibration stayed warming.

Canonical status:

**Autonomous Cognitive Cycle v0.2 = PRODUCTION GREEN**

**Daily coherent cognitive heartbeat = PROVEN**

**Execution authority = NONE**

## Proposal / Work Queue architecture

Next downstream organ:

`Observer / Memory → Security → Brain → Bridge → Cognitive Stack → Learning → Proposal Work Queue`

Purpose: transform active grounded Brain/Learning cases into persistent machine-readable **PROPOSED** work items with prioritization, provenance, lifecycle and independent deterministic review.

Intended boundaries:
- deterministic proposal creation only;
- no automatic approval;
- no automatic code mutation;
- no wallet access/signing/transactions;
- no paid model API requirement;
- every mutation remains human-gated.

Lifecycle:

`PROPOSED → APPROVED → IN_PROGRESS → VERIFYING → RELEASE_READY → RELEASED`

with `REJECTED` and `SUPERSEDED` alternate terminal states.

## Proposal v0.1 rollout and first RED

Initial Proposal v0.1 was uploaded through safe branch + PR and merged only after explicit approval.

Initial branch: `ai/proposal-work-queue-v0.1-20260814`

Package commit: `c828c512bc68c6774b4d659f6448f30932d9bf03`

PR #3: `Add Proposal Work Queue v0.1`

Merged to `main` with merge commit:
`3ea2ca226a39f547ded538fca90890b385e51468`

Immediate protections after merge:
- Security Sentinel #94 — run `31776550965` — SUCCESS;
- Repository Integrity Sentinel #49 — run `31776551022` — SUCCESS.

Security then published:
`c251db0639e84b0e4cd9a52f1863b1b41215c340`

User manually ran Proposal Work Queue.

Exact failed run:
- workflow `The Holding Brain · Proposal Work Queue`;
- run #2;
- run ID `31776806187`;
- event `workflow_dispatch`;
- branch `main`;
- head `c251db0639e84b0e4cd9a52f1863b1b41215c340`;
- conclusion **FAILURE**.

Root cause: Proposal referenced the wrong Learning context path.

Wrong:
`intelligence/learning/learning-context.json`

Correct production path:
`intelligence/learning-state/learning-context.json`

The first fail occurred in Preflight before Proposal generation. Fail-closed behavior worked: no Proposal generated-state publish, no wallet/capital/code execution, and seed `proposal-queue.json` remained untouched.

A second latent issue was found during the repair review: `proposal-policy.json` also contained the wrong Learning path. Additionally, the initial `proposal-release.json` hashes/byte sizes described the original local package while several static files actually merged to GitHub had evolved contents. Therefore merely replacing one string would still leave release coherence broken.

## Important rerun lesson

Do not use an old `workflow_run` rerun as a substitute for a fresh dispatch when its original head is stale.

A previous rerun of Learning was anchored to old Cognitive head `1facc9f...` while `main` had advanced. Learning itself rebuilt successfully, but publish rebasing encountered generated-state conflicts and correctly aborted with `Learning publish conflict; fail closed.` Downstream Proposal skipped because upstream Learning did not conclude successfully.

## Proposal Work Queue v0.1.1 repair — authorized and prepared

User explicitly authorized `грузи` on 2026-08-14 ~09:40 (+03).

Repair branch:
`ai/proposal-work-queue-v0.1.1-20260814`

The repair is intentionally stronger than a one-line path change.

v0.1.1 changes:
1. correct every Proposal Learning source path to `intelligence/learning-state/learning-context.json`;
2. update Proposal policy source authority contract;
3. bump deterministic engine identity to `0.1.1-deterministic-proposal-engine`;
4. strengthen engine validation of policy, Learning readiness, Learning/Cognitive chain, Brain byte binding and active-case count;
5. strengthen Independent Proposal Reviewer to independently verify Learning bytes, Brain bytes, Cognitive chain, queue integrity hash, proposal source chain and all no-execution boundaries;
6. bind the Proposal workflow itself into the exact-byte static release manifest;
7. create release `0.1.1-proposal-release` / `0.1.1-proposal-work-queue-path-coherence-repair`;
8. enforce exact expected static-file set in the release guard;
9. prevent manual Proposal execution from non-`main` refs;
10. require successful upstream Learning on `main` for automatic Proposal runs;
11. after every rebase before publish, rebuild Proposal state against the newest exact Learning/Cognitive bytes, rerun reviewer, restage and amend before push — preventing stale pre-rebase Proposal state from being published;
12. generated-state staging remains strictly limited to `proposal-queue.json`, `proposal-brief.md`, and `proposal-eval.json`.

Local validation completed before GitHub upload:
- all Proposal `.mjs` passed `node --check`;
- all JSON parsed;
- workflow YAML parsed;
- every workflow `run:` shell block passed `bash -n`;
- static release guard PASS;
- functional mock build produced 2 deterministic PROPOSED items and Independent Reviewer PASS;
- tampered static file was rejected by the release guard;
- mismatched Learning/Cognitive chain was rejected fail-closed.

No execution authority was added.

## Roadmap after Proposal becomes production GREEN

Do not jump ahead until Proposal v0.1.1 passes a fresh real production run and generated artifacts are independently inspected.

Planned sequence:
1. Proposal / Work Queue;
2. Human Decision / Approval Bridge;
3. stronger independent Proposal verification contracts;
4. Action / Release Gate;
5. Source Mesh health/provenance registry;
6. Self-Improvement Proposal Engine;
7. Builder Sandbox producing candidate patches only;
8. deterministic Guardian capability/policy gate;
9. eventually bounded executor under explicit mandate/allowlists/risk limits;
10. capital execution much later.

Canonical self-improvement principle:

`Observe → Remember → Reason → Learn → Propose → Review → Build Candidate → Verify → Guardian → Human / bounded action`

“System writes itself” must mean evidence-backed candidate changes validated in a sandbox, never unrestricted autonomous production mutation.

## Current next action

After this repair PR is reviewed and the user explicitly says `мерджи`, merge it. Then the user should run one **fresh** `The Holding Brain · Proposal Work Queue` manual run on `main`. After that, `чекай раны` means independently inspect the exact Proposal run, generated queue/eval/brief, publish commit, Security Sentinel and Repository Integrity before declaring GREEN.
