# The Holding — Emergency Checkpoint

Timestamp: 2026-09-06 11:21 +03:00 (Europe/Riga / Moscow-aligned project time)

## Canonical live boundary at checkpoint
- Repository: `TheHolding83888/TheHolding-site-1.32`
- Fresh `main` observed at checkpoint: `15db2305fd5ca60e3daf15f572f9c6bd2b1403d8`
- Latest visible main commit message: `market data: refresh daily CoinGecko baseline`
- PR #651 merge commit is present in ancestry: `09cdfa7a4a872b262fa2dd671d175fc5a166de87`
- PR #651 title: `Learning: add verified engineering lesson candidates`

## What #651 intended
Extend the existing Decision Outcome Learning Loop with an evidence-bound engineering-experience lane, without creating a second Learning system and without upgrading engineering associations into formal Lessons.

Expected production state after #651:
- `intelligence/learning-state/engineering-lesson-candidates.json` physically materialized on `main`;
- 2 verified engineering lesson candidates;
- 0 pending evidence;
- 0 formal Lessons created by this lane;
- execution authority remains `none`;
- causal claim authority remains `none`.

## Physical verification result
At this checkpoint, `intelligence/learning-state/engineering-lesson-candidates.json` is NOT present in the fresh `main` learning-state directory.

Therefore #651 is NOT considered physically closed even though the PR was merged and its CI path was green.

## Root-cause direction already identified
The current `.github/workflows/update-learning-loop.yml` runs `Build verified engineering lesson candidates` only when:

`steps.build.outputs.skip != 'true'`

But `steps.build.outputs.skip` is produced by the core owner-decision learning build when the current Cognitive Stack is not coherent/ready. The engineering adapter itself is evidence-bound to repository/incident proof and is not inherently dependent on Cognitive Stack coherence.

This creates accidental coupling: a safe-skip in the core Decision/Outcome lane can suppress materialization of the independent engineering-candidate lane.

Important: do NOT weaken Cognitive Stack guards just to make the file appear. First verify whether the canonical Cognitive refresh chain has already caught up and can naturally allow the Learning workflow to publish. If not, fix only the unnecessary coupling while preserving all authority and provenance boundaries.

## Workflow / system observations
- Fresh main advanced beyond the #651 merge via autonomous system commits, including continuity/project-memory/intelligence-progress and daily CoinGecko refresh.
- `update-learning-loop.yml` includes the new engineering ledger, adapter, reviewer, release guard binding, verification checks and safe publisher allowlist.
- The expected engineering candidate output is still absent physically from `main` at checkpoint time.

## Required next action — priority 1
1. Re-read fresh `main` before any write.
2. Inspect the latest `The Holding Brain · Refresh Cognitive Stack` and `The Holding Brain · Decision Outcome Learning Loop` runs after #651.
3. Determine whether a newer coherent Cognitive Stack should naturally retrigger Learning.
4. If natural recovery exists, let the existing chain close and verify the physical artifact.
5. If not, make the smallest systemic fix so the engineering lane is not blocked by unrelated core-learning safe-skip semantics, while keeping all existing guards and authority boundaries.
6. Require production proof on fresh `main`: engineering candidate file physically present, reviewer PASS, 2 verified / 0 pending / 0 formal Lessons (if evidence still matches).

## Required next action — priority 2: Defitea accounting
After Learning physical closure, continue with Defitea as the primary accounting front:

1. Audit the exact live Defitea ownership/source graph and wallets; do not assume remembered wallet count.
2. Remove cross-company earned-income attribution from Defitea. Historical composition evidence showed `05081966.eth` and `YieldRing.eth` being included as associated-company reference income; those companies must retain their own income, but Defitea performance must include only Defitea-native economic mechanisms.
3. Prevent double counting through universal ownership/attribution rules rather than a Defitea-only hardcoded exclusion.
4. Restore August factual income from `2026-08-01` as far as evidence permits.
5. Do not treat the old `2026-08-09` reporting start as an economic-history boundary; it is only an earlier observation/reporting boundary.
6. Feed only proven exact events/state into the Canonical Income Ledger. `UNKNOWN != 0`; reference APR/modelled income must not silently become factual Generated.
7. Passport behavior should remain: show all proven observed income even when coverage is incomplete, with only a compact dynamic unresolved-source note.
8. Once Defitea backfill is verified, generalize the same historical-evidence recovery path to the other companies.

## ICP follow-up after Defitea
Use the existing 41 NNS neuron IDs and owner-provided baseline only. No further owner actions should be requested. Add a read-only opportunistic exact public maturity probe first; if unavailable, maintain a separate month-specific estimated ICP income layer. Estimated ICP income must never silently enter factual `Generated` without explicit methodology approval.

## Authority / safety boundaries
- No wallet signing, claims, transactions, or capital movement.
- No automatic methodology mutation.
- No direct push to `main` for manual development work.
- Branch → PR → tests → merge → fresh-main physical proof.
- No formal Lesson promotion merely to improve dashboard numbers.
- Provenance and fail-closed behavior remain mandatory.

## Resume order from this checkpoint
Fresh CURRENT → latest continuity → Router task-specific blocks → fresh main head → latest workflow runs/artifacts → close #651 physical materialization → Defitea native-income isolation → Defitea August factual backfill → generalize backfill → ICP estimated/exact layer → later Lessons UI/observability refinements if still needed.
