# Ask The Holding · Owner Brief v0.9 Contract

Purpose: test a bounded cross-source owner-attention synthesis without creating a new source of truth or expanding execution authority.

Canonical inputs:
- `security/security-intelligence.json` for the freshest current security counts/findings;
- `intelligence/learning-state/learning-context.json` for decision-worthy experience state;
- `intelligence/proposals/proposal-queue.json` for governance state;
- `intelligence/change-intelligence.json` for current economic/data watch conditions and the latest material delta.

Rules:
1. Security, Learning and Proposal are correlated views of an evidence → review → proposal chain. Their counts must never be added as independent problems.
2. Fresh Security state outranks an older Cognitive/Learning snapshot for current security counts.
3. Cross-domain priority is tiered, not a fake single numeric score. Security/decision review and economic/data watch remain distinct categories.
4. The brief may identify owner-attention priorities, evidence and uncertainty. It must not issue personalized buy/sell/allocation commands or imply execution authority.
5. `whatChanged` salience continues to respect economic magnitude and verified source semantics.
6. Owner Unknown remains discovery evidence. A GREEN release gate does not replace manual semantic review of the resulting brief.

Desired answer shape:

`Priority tier → evidence → why it matters → freshness/uncertainty → what remains owner decision`

The objective is not to sound more intelligent. The objective is to produce a more coherent, source-grounded operating picture of the OS.
