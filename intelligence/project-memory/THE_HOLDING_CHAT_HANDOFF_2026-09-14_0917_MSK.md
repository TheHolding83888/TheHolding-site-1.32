# THE HOLDING — CHAT HANDOFF CHECKPOINT

**Generated:** 2026-09-14 09:17 MSK (+03:00)
**Purpose:** manual continuity checkpoint before possible chat context rollover.
**Branch:** `checkpoint/chat-handoff-20260914-0917-msk`
**Fresh main anchor at checkpoint creation:** `63263fb9f0e09135c21dc020b90be89c9f4e676f`
**Main anchor message:** `data: update company monthly earned-income reports`
**Main anchor timestamp:** 2026-09-14T05:57:13Z / 08:57:13 MSK

This checkpoint is an operational handoff, not a replacement for live truth. A new chat must always recover current state from `intelligence/project-memory/CURRENT.md` → latest continuity → Router → fresh GitHub evidence before mutating anything.

---

## 1. Current strategic state

The architecture/reporting redesign phase is **CLOSED GREEN**. Do not reopen it without a concrete production defect. The current frontier is factual completeness, historical accounting truth, Economic Graph/data reliability, sensors, and the AI cognition/learning/proposal chain.

Core engineering rule remains:

> Solve a mechanism once in a shared/general layer, then reuse it across all existing and future onchain companies. Avoid local patches, duplicate business logic, parallel sources of truth, orchestration loops, and complexity for its own sake.

Key invariants:
- `UNKNOWN != 0`.
- Green workflow is not proof unless the expected physical artifact/evidence materializes.
- Reports are projections of durable ledger/accounting truth; they are not a second accounting source of truth.
- Claiming or compounding must never erase earned-income history or double-count it.
- Current Passport rewards represent current claimable/unclaimed state only.
- Current spot price must never rewrite closed historical income.
- If a historical price cannot be proven, token amount remains factual and USD remains `UNKNOWN`/null.
- Price should come after history, not replace history.
- Resilience should be a property of existing contours, not an excuse to create another large layer.

---

## 2. Accounting / reporting status

The current set of mechanisms already used by tracked onchain companies is architecturally covered by the accounting registry. At the last verified audit before this checkpoint:
- 10 companies;
- 50 mechanism instances;
- 29 unique mechanisms;
- 50/50 classified;
- unclassified mechanism instances: 0;
- reusable coverage gaps: 0.

This means a new company using an already-supported mechanism should not require a new accounting engine. A truly new mechanism/protocol still needs a factual adapter before the system can claim coverage.

The architecture/reporting closure remains authoritative. Do not re-open the accounting fabric merely because current evidence for a period is partial.

---

## 3. Mandatory historical reward-token valuation workstream

This is a required non-cosmetic workstream and must not be dropped during takeover.

Goal: for already-supported reward mechanisms, historical reward valuation should become generic and evidence-driven rather than token-by-token special casing.

Target resolver cascade, where safely provable:
1. canonical historical price;
2. Chainlink historical boundary observation;
3. proven onchain TWAP route to USDC/ETH + historical USD conversion;
4. otherwise amount remains known but USD remains `UNKNOWN`.

Important rule: historical valuation resolution should remain an identity-bound, non-economic sidecar/annotation. Do **not** mutate immutable earned-income event economics with later/current spot prices.

### LAPTOP reference case
Token:
- symbol `LAPTOP`
- Base contract `0xB095274743941e953c746F9C228DA9c18Bb6ec29`

The LAPTOP case proved the intended generic pattern:
- exact historical Aerodrome Slipstream LAPTOP/USDC TWAP;
- exact same-boundary Base USDC/USD Chainlink;
- no current-price backfill;
- missing proof fails closed.

For company `0x5860...83CA8.eth`, 67.615020175016 LAPTOP was historically resolved at about `$71.63887726` using unit price about `$1.059511290162` at the earning/closing boundary. Current claimable later becoming zero does not erase this income.

LAPTOP should be treated as a **test/example of the generic resolver**, not as a permanent special-case branch.

At takeover, refresh the current unresolved historical valuation inventory before quoting counts. Any older unresolved/resolved counts are historical anchors only.

---

## 4. Reward lifecycle canon

Canonical lifecycle:
- factual reward entitlement/earned-income evidence is recognized at the mechanism-specific economic boundary;
- current claimable state is a current-state surface only;
- claim is settlement of prior entitlement, not a second income event;
- after claim, current Passport reward can go to zero while historical income persists;
- embedded/compounded strategies use their own interval/checkpoint evidence rather than pretending everything is claimable;
- historical USD valuation uses evidence-aligned historical boundaries, not current price.

Relevant permanent policy concepts already exist in the income-ledger policy:
- `claimOrWalletMovementDoesNotErasePriorIncome`
- `claimedRewardLeavesCurrentClaimableStateButNotIncomeHistory`
- `passportCurrentRewardsMustRepresentCurrentClaimableStateOnly`
- `historicalIncomeValuationMustUseEvidenceAlignedTimestamp`
- `priceObservedAfterEconomicBoundaryCannotValuePriorIncome`
- `currentSpotPriceCannotRewriteClosedHistoricalIncome`

---

## 5. Reliability / antifragility canon

The correct architecture is:

> multiple transport paths → one canonical semantic decoder/business truth.

Example already proven in Aerodrome vote-history recovery:
- Base RPC remains primary;
- Blockscout indexed logs are a bounded transport fallback;
- both feed the same event semantics and same decoder;
- fallback pages/splits ranges to prove completeness;
- malformed/truncated evidence fails closed;
- no second accounting/business-logic brain was introduced.

Workflow Control Plane and Runtime Reliability Observer enforce bounded authority and no-new-debt behavior. Anti-fragility must not self-rewrite production. It should turn failures into explicit incidents, tests, guards, and stronger invariants while keeping authority isolated.

Watch **semantic/business-logic duplication**, not raw workflow/file count.

---

## 6. Cognitive → Learning → Proposal chain — active work at checkpoint

The working objective immediately before this checkpoint was to finish proof of the normal chain:

`fresh explanatory/cognitive evidence → Cognitive Stack → Learning → Proposal`

Recent important production work:

### Cognitive freshness / wakeup
Historical PRs #324/#325 established and proved the intended canonical wake path from successful Explanatory Context completion into `The Holding Brain · Refresh Cognitive Stack` without adding a second Brain path.

### Learning release-coherence failure
A previous Learning run failed for a correct fail-closed reason: `.github/workflows/record-brain-decision.yml` had changed while the corresponding hash in the Learning release manifest was stale. This was release-coherence protection, not a failure of the learning logic itself.

The branch `fix/learning-release-coherence-record-decision-20260913` is now an ancestor of live `main`; therefore that repair has already landed. Do not recreate it.

### Proposal stale-input reliability — PR #816
PR #816 `Reliability: safe-skip Proposal on stale Learning snapshots` is merged.
Merge commit: `18a2853355f531d6c95ec7c4cb606a08ef032878`.

What it fixed:
- successful Learning can legitimately finish `SKIPPED SAFELY` when Cognitive/Security truth has moved;
- Proposal no longer treats every successful Learning run as actionable;
- Proposal first checks Learning/Cognitive/Decision coherence;
- stale input exits green with explicit safe-skip and publishes nothing;
- coherent input retains exact fail-closed release/build/publication guards;
- Proposal remains non-executable;
- no new workflow/layer or production authority was added.

This is reliability cleanup, not methodology expansion.

### Exact current next proof
Do not infer completion from merged code alone. The next active step is to prove with fresh production runs that:
1. canonical Cognitive refresh materializes coherent Brain/Bridge/Stack artifacts;
2. Learning consumes the current coherent stack and either materializes fresh Learning state or skips safely for an explicitly valid reason;
3. Proposal consumes only coherent Learning input, materializes when eligible, and safe-skips stale input without red noise;
4. physical artifacts and hashes align, not just workflow conclusions.

If this chain is already proven by fresh runs after this checkpoint anchor, verify it and mark green rather than rerunning gratuitously.

---

## 7. Fresh live anchors visible at checkpoint creation

Fresh live `main` at manual checkpoint creation:
- SHA `63263fb9f0e09135c21dc020b90be89c9f4e676f`
- message `data: update company monthly earned-income reports`
- timestamp 2026-09-14T05:57:13Z / 08:57:13 MSK.

Recent automatic continuity materialization exists after the earlier 2026-09-13 checkpoint series, including:
- `THE_HOLDING_MASTER_CONTINUITY_2026-09-14_003514_AUTO_3038355c.md`

A new chat should still inspect `CURRENT.md` live because generated writers may have moved `main` after this checkpoint branch was created.

---

## 8. Heavy workflow / performance context

The long Aerodrome + Velodrome factual accrual evidence step has historically taken about 30 minutes while most reporting steps take seconds/minutes. This is an isolated historical-chain-data bottleneck, not evidence that the whole system is spaghetti.

Current runner already has bounded timeouts and safe evidence reuse in generated-data publication context.

If performance work is later justified by fresh profiling, prefer one fundamental optimization of the historical data pipeline:
- retain proven history and scan only blocks after the last proven checkpoint;
- parallelize independent chains where safe;
- use stronger archive/indexed transports;
- preserve one canonical decoder and fail-closed semantics.

Do not start a broad performance rewrite merely to make workflows look shorter.

---

## 9. Takeover priority order — NON-COSMETIC

When a new chat takes over, first do a fresh read-only live audit. Then combine the work into one coherent plan. Do **not** merely finish the last visible task and stop.

Priority:
1. Close any unfinished production/factual tails actually still open on fresh `main`.
2. Complete fresh production proof of Cognitive → Learning → Proposal coherence if not already proven.
3. Continue the existing fundamental non-cosmetic roadmap already present in live continuity/router.
4. Audit all current `UNKNOWN` historical reward-token USD valuations and group them by reusable resolution pattern.
5. Generalize the historical pricing resolver rather than patching tokens individually.
6. Close remaining partial current observations if they still exist.
7. Run a system-wide proof matrix across current companies × supported mechanisms × reward/claim/embedded-income lifecycle × historical USD valuation.
8. Only after the above, consider performance optimization if fresh profiling still shows a material bottleneck.

Explicitly postponed for now: cosmetic/UI polish packages unless they become necessary to expose a factual production defect.

---

## 10. User operating protocol

When Alexander writes **`трекай`**, perform a fresh read-only GitHub audit:
- live `main`;
- relevant active branches/PRs;
- Actions/workflow runs;
- generated/materialized artifacts/evidence;
- `CURRENT.md` → latest continuity/checkpoint → Router/resume context.

Report briefly:
- 🟢 done/proven/materialized;
- 🟡 in progress + approximate %;
- ⚪ next/queued;
- risks only when useful.

If asked for latest automatic checkpoint time, convert to MSK (+03:00) and explain its topic in simple language.

Percentages are practical engineering estimates, not canonical project KPIs.

---

## 11. What NOT to do after handoff

- Do not reopen architecture/reporting just because it can be further polished.
- Do not add a new layer where an existing shared layer can be extended.
- Do not treat green workflows as proof without checking physical artifacts.
- Do not interpret unknown valuation as zero.
- Do not backfill historical accounting with current prices.
- Do not build token-specific pricing hacks when a reusable route can be generalized.
- Do not add automation authority to observers/reviewers/proposal machinery.
- Do not let a new company fork mechanism logic that is already solved in a reusable layer.
- Do not prioritize cosmetics before factual completeness / historical valuation / active production proof.

---

## 12. Immediate resume instruction

On resume from this checkpoint:
1. Read live `intelligence/project-memory/CURRENT.md`.
2. Read latest continuity selected by CURRENT.
3. Read Router blocks relevant to cognition/learning/proposals, reporting/accounting, production recovery, and current factual gaps.
4. Compare live `main` to checkpoint anchor `63263fb9f0e09135c21dc020b90be89c9f4e676f` to discover everything that happened after 09:17 MSK checkpoint creation.
5. Inspect fresh runs/artifacts for Cognitive → Learning → Proposal.
6. If chain proof is complete, mark it green and move immediately to the next non-cosmetic factual roadmap item.
7. If not complete, fix the root shared cause, prove materialization, then continue.

**End of manual handoff checkpoint.**