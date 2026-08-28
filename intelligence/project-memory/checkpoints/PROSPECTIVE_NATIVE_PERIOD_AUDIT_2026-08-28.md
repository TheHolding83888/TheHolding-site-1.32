# Prospective / Native-Period Audit Checkpoint — 2026-08-28

Status: RESEARCH CHECKPOINT — NO PRODUCTION LOGIC CHANGE

## Objective
Determine whether The Holding can extend the existing prospective/observational learning path with native-period observations from economic/protocol sources without creating a new forecasting layer, weakening UNKNOWN/fail-closed semantics, or falsely manufacturing longitudinal depth.

## Live findings preserved

1. Economic Graph is a real machine layer, not only documentation. Live repository inspection shows protocol/economic machine artifacts including Frax lifecycle/sensor material and Curve/Votium flow material.

2. The existing Productivity history for Curve contains overlapping rolling-window snapshots. Those snapshots must NOT be treated as independent native periods. Doing so would violate the existing longitudinal-depth law: repeated/overlapping snapshots do not create independent evidence periods.

3. The current Curve engine contains separate weekly observations beneath the rolling aggregate. These are a potential bounded pilot source because they may represent genuinely distinct observation windows. Their exact identity/provenance still requires final verification before any implementation.

4. Frax weekly snapshots are not yet sufficient to assert independent epoch/native-period identity from the inspected evidence. In the current material, periodStart can be null; therefore no synthetic period identity may be inferred.

5. A prospective machine mechanism already exists inside the current Observational Learning stack. Relevant live artifacts include an observational prospective baseline and evaluator. Therefore a new forecasting/prospective subsystem should NOT be added.

6. The current prospective contract is intentionally narrow: it consumes canonical Change History events / event-triggered observations and does not authorize prediction, causality, lesson promotion, or execution authority from prospective support alone.

7. Because that contract is methodological, it must not be silently broadened. A safe implementation is possible only if a native-period observation can enter through an already-authorized canonical observation/change-history semantic path with deterministic identity and exact provenance. Otherwise this becomes a methodology boundary and must stop for explicit design approval.

## Current safe hypothesis
The best candidate for a first bounded pilot is Curve weekly observation data, provided all of the following can be proven from live files:
- each weekly item has deterministic non-overlapping period identity;
- the source writer is canonical and reproducible;
- the observation can be represented as an existing observation/change-history event rather than a new forecast primitive;
- duplicate/replayed periods are idempotently rejected;
- UNKNOWN remains null/unknown, never zero;
- no new workflow is required;
- no prediction/causality/lesson/authority semantics are added.

Frax should remain out of the first pilot until exact native-period identity is evidenced rather than inferred.

## Remaining work
1. Identify exact live file paths and writer functions for Curve weekly observations and verify period boundaries/IDs/provenance.
2. Trace the canonical Change History event schema and determine whether a native-period observation already has a lawful event type/shape.
3. Trace the prospective evaluator input contract end-to-end and verify idempotency/dedup behavior for repeated events/periods.
4. Verify downstream consumers so no hidden consumer interprets prospective support as prediction, causal evidence, or promoted lesson.
5. If all checks pass, implement the smallest bounded Curve-only hook in existing machinery, with no new workflow/layer and exact tests.
6. If any step requires a new event semantic, new scoring/methodology, or inferred period identity, STOP and classify as methodology boundary rather than patching around it.

## Non-negotiable laws
- UNKNOWN != 0.
- Repeated/overlapping snapshots do not create longitudinal depth.
- Prospective support != prediction, causality, lesson, policy, or execution authority.
- No new layer without a real gap.
- Prefer one bounded extension to existing machinery over parallel orchestration.
- GREEN workflow != physically materialized production evidence.
- No moving finish line.

## Production impact
None. This checkpoint only preserves research state. No production workflow, methodology, authority, collector, writer, or public artifact behavior is changed by this checkpoint branch.
