# THE HOLDING — ARCHITECTURE / CANONICAL-WRITER HANDOFF CHECKPOINT
## 2026-09-12 06:06 MSK · manual owner-requested handoff

Status: **MANUAL RESUME CHECKPOINT / ARCHITECTURE HANDOFF**  
Authority: **observation, architecture plan and continuity only**  
`executionAuthority = none`

> Owner intent: the current chat is handing this work to a parallel/replacement chat. Resume from fresh live evidence, do not redo already-proven atoms, and continue the architecture simplification until the remaining duplicate-writer debt is safely removed. After that, continue only with additional simplification that has a proven step-change benefit; do not refactor for aesthetics.

---

## 1. LIVE SOURCE BOUNDARY AT CHECKPOINT CREATION

Checkpoint branch:

`checkpoint/architecture-canonical-writer-handoff-20260912-0606`

Branch base / live `main` at creation:

`55d96f9ef1db68fa13c93e0b191437d8f237fa4e`

Latest `main` commit at that moment:

`memory: checkpoint continuity at a82367cc`

Latest automatic immutable continuity referenced by `main`:

`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-12_002520_AUTO_a82367cc.md`

Its source head is:

`a82367cc17799f83e1f2d9611533ebb8a390b8c2`

Canonical resume law remains:

`CURRENT.md → latest continuity → Routing Index → task-specific canon/context → live artifact → exact workflow/check evidence`

This manual checkpoint is a task-specific handoff. It does **not** supersede live `main`, generated `CURRENT.md`, automatic continuity, or exact Actions evidence.

---

## 2. OWNER GOAL FOR THIS ARCHITECTURE PHASE

The requested architecture improvement is deliberately narrow and practical:

**ONE ARTIFACT → ONE CANONICAL WRITER**

Meaning:
- every generated repository artifact/state should have one production repository writer;
- other workflows may observe, validate, collect source data, or replay diagnostics;
- they should not independently publish the same canonical artifact;
- no new meta-orchestrator should be invented merely to accomplish this;
- use the existing Workflow Control Plane and existing domain workflows;
- keep fail-closed guards, concurrency, safe-rebase/supersession rules, privacy/security checks, and exact domain proofs;
- reduce authority rather than broaden it.

Simple operating rule: one official clerk writes each ledger; everyone else supplies evidence or checks the ledger.

---

## 3. NON-NEGOTIABLE SAFETY / AUTHORITY LAWS

Preserve all of these throughout the remaining cleanup:

1. `executionAuthority = none`.
2. No wallet signing, claiming, approvals, voting, transaction execution, or capital movement.
3. No autonomous methodology/policy mutation.
4. `UNKNOWN != 0`.
5. Reference APR/APY is analytics, not factual earned-income authority.
6. Canonical Income Ledger remains sole factual earned-income recognition authority.
7. Green workflow does not equal physical production completion; verify live artifact/materialization after merge when relevant.
8. Never weaken a guard just to obtain GREEN. If a proof rejects a change, understand the real dependency and redesign the atom.
9. Do not expand `pull_request_target`, secrets access, `actions: write`, repository mutation authority, or workflow-dispatch authority as part of this cleanup.
10. Prefer small reversible PR atoms with paired deterministic workflow-definition proofs.

---

## 4. ARCHITECTURE CLEANUP ALREADY COMPLETED — DO NOT REDO

### #753 — Retire legacy Collection → Passport router at source
Merged. Removed the obsolete competing Collection navigation authority while preserving direct Passport hash behavior and canonical Collection → Index v3 navigation.

### #754 — Make public-site polish explicit instead of import-driven
Merged. Removed hidden Presentation side effects from imports; introduced explicit Presentation materialization boundary.

### #755 — Separate Capital orchestration from Presentation materialization
Merged. Unified Capital stopped executing pure Presentation materialization.

### #756 — Align Unified Capital proof with Capital/Presentation boundary
Merged. Deterministic proof updated to validate the new boundary rather than require the retired coupling.

### #757 — Shrink Unified Capital writer to Capital-owned surfaces
Merged. Homepage and Yield Reports were removed from Capital writer ownership; pure Presentation sources no longer wake the production Capital writer.

### #758 — Decouple Presentation-only PRs from heavy Capital validation
Merged. Pure UI/Presentation changes no longer pay the heavy Unified Capital E2E cost; Capital E2E remains for real economic/capital changes.

### #759 — Reduce false Productivity diagnostic fan-out
Merged. Removed the false `Diagnose Productivity Recovery → generic Capital orchestrator` wake. The diagnostic now proves its own bounded domain contract. Real Project X and YieldRing dependencies were intentionally retained.

### #760 — Remove stale Capital → Presentation compatibility dependency
Merged. Removed the last no-op Presentation coordinator dependency from Capital owner projection and made the deterministic proof forbid its return.

### #761 — Retire duplicate Productivity recovery writer
Merged. Legacy Productivity recovery workflow is now read-only diagnostic replay; Unified Capital owns production publication of the affected Productivity/Public Capital surfaces.

### #762 — Retire duplicate Capital State recovery writer
Merged. Legacy Capital State recovery workflow is now read-only diagnostic replay; Unified Capital owns production publication of General Balance / Capital State surfaces.

### #763 — Split Market Data writers by canonical ownership
Merged. Production ownership was made explicit:

`Daily CoinGecko source lane → Shared canonical Market Data → Unified Capital/Public Capital`

Result:
- Daily CoinGecko publishes only `intelligence/market-data/market-data-coingecko.json`;
- Shared Refresh publishes canonical `market-data.json` + `onchain-price-shadow.json`;
- Daily canonical materialization is validation-only;
- Daily no longer publishes Public Capital;
- Shared Refresh no longer stages/writes the daily CoinGecko source-lane artifact.

### #764 — Retire duplicate YieldRing recovery writer
Merged. Legacy YieldRing recovery workflow became read-only diagnostic replay. Unified Capital owns the affected production surfaces.

### #765 — Retire duplicate Cypher public admission writer
Merged. Legacy Company #010 public-admission workflow no longer writes `companies/index.html`; it performs diagnostic preview/parity only. Unified Capital is the canonical Companies-surface publisher.

### #766 — Make Cypher state writer own Project X APR materialization
Merged. `Update Company #010 · Cypher Production State` became canonical publisher of Project X observed-fee Reference APR state/history. The old Project X APR workflow became read-only diagnostic replay.

Important: this atom intentionally left HyperLend separate because HyperLend currently mutates **two canonical artifacts** and therefore needs a cross-artifact ownership split, not a mechanical permission downgrade.

### #767 — Repair Unified Capital setup-node action pin
Merged. A malformed `actions/setup-node` SHA exposed by post-merge proof was replaced with the established valid v4 pin. Paired proof now rejects the known-bad pin. This was a reliability repair, not an architecture-methodology change.

---

## 5. POST-MERGE PRODUCTION HEALTH OBSERVED AFTER THE CLEANUP

After the writer-ownership atoms, `main` continued producing normal automated state:

- canonical Market Data refresh commits;
- coherent Capital production snapshots;
- comparative-intelligence refreshes;
- explanatory-context refreshes;
- automatic project-memory / continuity checkpoints.

Recent examples before checkpoint creation included:

- `93b8d3a57a3613fe91c33cda85a29d2afd0279f` — `market data: refresh canonical price snapshot`;
- `cc6e62647f68b3ae531e45e5ee8b1ba3b5375408` — `capital: refresh coherent production snapshot`;
- `7394a38cd43da4c1820757514f8bda739e677dbc` — `intelligence: refresh comparative state`;
- `a82367cc17799f83e1f2d9611533ebb8a390b8c2` — `intelligence: refresh explanatory context`;
- `55d96f9ef1db68fa13c93e0b191437d8f237fa4e` — automatic continuity checkpoint.

This is important evidence that the simplification did not stop the normal production chain.

---

## 6. CONTROL-PLANE BASELINES: IMPORTANT INTERPRETATION

Current checked-in frozen Workflow Control Plane baseline still records the old debt ceiling:

- `duplicateCandidateWriterPathCount: 7`;
- old candidate duplicate paths include Companies surface, Market Data paths, Company #010 state, Rewards, and Decision Ledger.

Do **not** treat the frozen baseline as current live debt truth.

Its own epistemic contract says:
- topology is measured from exact workflow source;
- writer-path detection is heuristic;
- baseline is a **debt ceiling, not desired end state**;
- debt reduction is always allowed;
- baseline expansion requires explicit maintenance.

Several of those seven candidate paths have already been structurally resolved by #761–#766. Therefore the handoff chat must re-measure exact live workflow source before declaring the remaining duplicate count.

Expected remaining high-confidence duplicate artifact families after completed atoms are approximately:

1. `companies/company-010-production-state.json` — canonical Company #010 writer + HyperLend writer still overlap.
2. `companies/rewards-data.json` — generic Rewards writer + HyperLend writer + ICP NNS writer overlap.
3. `intelligence/learning/decision-ledger.json` — Brain decision workflow + Owner Economic Decision workflow overlap.

The old baseline may still list already-resolved paths because it is intentionally frozen as a ceiling.

**Do not tighten/rewrite the baseline mid-atom merely to make numbers look better.** First complete and prove the real ownership reductions. Then perform an explicit final baseline-tightening atom so the new lower debt state becomes the future fail-closed ceiling.

Fan-out baseline is also frozen as a ceiling. Protected global workflow-change checks that must survive are:

- `commit-identity-privacy-guard`;
- `public-surface-privacy-guard`;
- `repository-hygiene-guard`;
- `workflow-control-plane`.

#759 proved the correct method for fan-out reduction: remove a wake only after exact evidence shows the workflow neither reads nor executes the source; add/keep a bounded domain contract where necessary.

---

## 7. CURRENT NEXT ARCHITECTURE FRONTIER — HYPERLEND CROSS-ARTIFACT OWNERSHIP

This is the next major atom and should be analyzed before mutation.

Current live workflow:

`.github/workflows/update-company-010-hyperlend-income.yml`

still has:

`permissions: contents: write`

and publishes both:

- `companies/company-010-production-state.json`
- `companies/rewards-data.json`

The HyperLend overlay currently verifies:
- Company #010 HyperLend strategy state;
- Compounded embedded-income semantics;
- non-claimable / non-additive-capital boundary;
- Rewards Drawer embedded-income projection;
- source projection;
- `executionAuthority = none`.

The problem is architectural ownership, **not** the HyperLend economic semantics.

Target end state should preserve all semantics while making ownership singular:

### Company #010 production state
Canonical repository writer should remain:

`Update Company #010 · Cypher Production State`

Therefore HyperLend state materialization should ultimately be incorporated into the canonical Company #010 pipeline, or transformed into a source/ephemeral observation that the canonical Company #010 writer consumes.

The HyperLend workflow should not remain an independent repository publisher of `company-010-production-state.json`.

### Rewards data
Canonical repository writer should converge toward:

`Update Company Rewards`

Therefore HyperLend reward/embedded-income contribution should ultimately be consumed/materialized through the canonical Rewards pipeline rather than independently committing `companies/rewards-data.json`.

**Do not simply move both files into one of the two workflows.** That would merely transfer the cross-artifact coupling. The right solution is to separate source observation/domain logic from final canonical artifact publication.

Preferred pattern:

`domain observation / deterministic overlay → canonical domain writer → canonical artifact`

Possible implementation approaches, to be chosen only after exact source inspection:
- make HyperLend collector produce an ephemeral/source-state artifact and let Company #010 + Rewards canonical writers consume it;
- or expose side-effect-bounded reusable functions so each canonical writer materializes only its own artifact;
- or split the current HyperLend overlay into explicit state-projection and rewards-projection helpers, while preserving one shared observation/proof source.

Avoid duplicated RPC observation if one source state can be safely reused, but do not create a new global orchestrator merely for this.

---

## 8. NEXT REWARDS WRITER CLEANUP AFTER HYPERLEND

Current canonical Rewards workflow:

`.github/workflows/update-company-rewards.yml`

is already a broad aggregation pipeline and writes `companies/rewards-data.json`.

The frozen Control Plane baseline also identifies:

- `update-company-010-hyperlend-income`
- `update-company-rewards`
- `update-icp-nns-rewards`

as candidate writers of the same `companies/rewards-data.json` artifact.

After HyperLend is removed as a second writer, inspect `update-icp-nns-rewards` and move toward the same ownership law:

**one canonical `rewards-data.json` writer**.

Likely desired shape:
- ICP/NNS workflow measures or emits domain-specific source state/diagnostic evidence;
- `Update Company Rewards` owns the final aggregate file;
- or the generic Rewards pipeline invokes the exact ICP/NNS projection in a bounded manner;
- preserve existing ICP epistemic rules, exact reward recognition semantics, and no-execution boundary.

Do not change accounting recognition methodology just to consolidate writers.

---

## 9. DECISION LEDGER WRITER CLEANUP

Frozen baseline identifies two repository writers for:

`intelligence/learning/decision-ledger.json`

- `record-brain-decision`
- `record-owner-economic-decision`

This is a later atom after capital/rewards ownership is stabilized.

Target law is again one repository writer, but preserve the semantic distinction between:
- Brain/system decision observations;
- owner-authorized economic decisions.

Do not collapse authority semantics. A shared canonical ledger writer may accept typed domain events, while separate producer workflows remain validation/input channels. One shared helper library is **not sufficient** if two workflows still independently commit the same ledger file.

This atom is governance-sensitive. Keep owner-economic authority provenance explicit and fail closed.

---

## 10. MARKET DATA FOLLOW-UP / STALE DAILY COINGECKO SOURCE LANE

Important unresolved reliability observation from this chat:

At the time the Market Data writer split was being analyzed, live:

`intelligence/market-data/market-data-coingecko.json`

still showed:

`generatedAt: 2026-09-09T08:04:32.527Z`

while canonical:

`intelligence/market-data/market-data.json`

was continuing to refresh from onchain-primary observations and had later fresh timestamps.

This means the **canonical Market Data engine can remain fresh while the daily CoinGecko fallback/sanity lane is stale**.

#763 correctly fixed writer ownership but does not by itself prove the daily scheduled CoinGecko source-lane refresh is currently healthy.

Before using CoinGecko fallback freshness as proof, the replacement chat should:

1. inspect exact Actions history for `The Holding Market Data · Daily CoinGecko Baseline`;
2. verify whether natural schedule runs resumed after 2026-09-09;
3. inspect the exact failed/skipped step if not;
4. preserve `staleFallbackMaxAgeHours = 30` and fail-closed behavior;
5. do not fake freshness by rewriting timestamps;
6. do not make Shared Refresh a second writer again;
7. if a fix is needed, keep Daily CoinGecko as the sole writer of the source-lane artifact and Shared Refresh as sole canonical Market Data writer.

Historical stale PR #717 exists around older Market Data publish-retry work. **Do not resume or merge it blindly.** Its branch is old and current `main` has materially evolved. Re-read current implementation first and only port a still-needed idea as a fresh small atom.

---

## 11. RECOMMENDED RESUME ORDER FOR THE PARALLEL / REPLACEMENT CHAT

At takeover, do this in order:

### Step A — fresh read-only verification
- live `main` SHA;
- live `CURRENT.md`;
- latest immutable continuity;
- open/recent PRs;
- active/relevant branches;
- Workflow Control Plane evidence;
- latest Unified Capital / Market Data / Rewards / Company #010 runs;
- exact generated artifacts.

Do not mutate during this first verification pass.

### Step B — confirm no in-flight newer architecture atom
This checkpoint was created from `main` `55d96f9e...`. If another chat has produced newer architecture commits/PRs, those win. Avoid duplicate work.

### Step C — resolve HyperLend cross-artifact ownership
Goal:
- Company #010 state → one canonical writer;
- Rewards aggregate → one canonical writer;
- HyperLend semantics preserved exactly;
- HyperLend workflow becomes diagnostic/source producer rather than dual repository writer.

Use a small PR with paired deterministic proof(s).

### Step D — resolve ICP NNS duplicate Rewards writer
Goal:
- `companies/rewards-data.json` has exactly one canonical repository writer.

### Step E — resolve Decision Ledger duplicate writer
Goal:
- `intelligence/learning/decision-ledger.json` has exactly one repository writer while preserving owner-vs-brain semantic authority boundaries.

### Step F — re-measure live duplicate-writer topology
Do not infer from frozen baseline. Measure exact current workflow source.

Target: `duplicate writer paths → 0` if all candidate overlaps are genuinely removable without semantic regression.

If a path is intentionally multi-writer for a provable reason, document the reason rather than forcing zero cosmetically.

### Step G — tighten the Control Plane baseline
Only after the cleanup is proven in production, lower the frozen debt ceiling to the achieved state so future regressions cannot silently grow back into the old allowance.

### Step H — second-pass fan-out reduction
Use the #759 evidence standard:
- remove only false dependencies;
- retain true source readers/executors;
- preserve four protected global checks;
- no broad suppression.

### Step I — stop architecture refactoring when marginal benefit disappears
Once duplicate writer ownership is eliminated/tightly justified and obvious false fan-out is removed, return to the product/roadmap. Do not keep refactoring simply because more abstraction is possible.

---

## 12. PER-ATOM SAFE WORKFLOW

For every remaining architecture atom:

1. Read exact current source and workflow topology.
2. State the ownership problem in one sentence.
3. Identify the intended canonical writer.
4. Preserve the old workflow as read-only diagnostic where useful instead of deleting valuable proof.
5. Add/update a paired deterministic workflow-definition proof.
6. Keep `contents: read` on diagnostic workflows where repository mutation is no longer needed.
7. Do not add a new workflow unless there is no existing canonical owner capable of the job.
8. Run/observe Control Plane + domain-specific checks + privacy/hygiene/security checks.
9. Merge only after exact proof is green.
10. Verify post-merge production materialization from live `main` and downstream workflow evidence.
11. Then move to the next atom.

If any guard catches a real dependency, do not bypass it; redesign the atom.

---

## 13. IMPORTANT HISTORICAL / OPEN PR HYGIENE

At checkpoint time there are old open PRs/checkpoints in the repository, including historical checkpoint/canary/Market Data work. Examples include #730, #729, #717, #433 and #37.

They are **not** the current architecture frontier and must not be treated as active work merely because they are open.

Current architecture work through #767 is already merged into `main`.

Use live source and recent merged PRs as truth.

---

## 14. WHAT NOT TO DO

Do not:
- restore Presentation execution inside Capital;
- restore legacy duplicate recovery writers;
- make Market Data Daily and Shared Refresh co-write canonical files again;
- let Project X diagnostic regain Company #010 publication authority;
- weaken stale-data limits to make Market Data green;
- broaden wallet/execution/capital authority;
- collapse owner-economic decision semantics into generic Brain observations;
- update frozen baselines upward to accommodate new debt;
- remove true workflow dependencies just to reduce fan-out counts;
- create a new orchestration layer when an existing canonical writer can absorb the responsibility;
- merge stale historical PRs without re-deriving the need from current `main`.

---

## 15. END-STATE DEFINITION FOR THIS PHASE

This architecture phase is complete when fresh live evidence proves:

- Capital and Presentation remain cleanly decoupled;
- one canonical writer per generated artifact, or every exception is explicitly justified and protected;
- Company #010 state has one writer;
- Rewards aggregate has one writer;
- Decision Ledger has one writer;
- Market Data source/canonical/Public Capital ownership remains cleanly separated;
- no hidden import side effects reappear;
- no false fan-out remains where exact evidence proves irrelevance;
- frozen Control Plane / fan-out ceilings are tightened to the new proven lower-debt state;
- all safety, accounting, privacy, provenance, and authority boundaries remain intact;
- production automation continues generating coherent snapshots after the simplification;
- `executionAuthority = none` remains unchanged.

Then stop architecture cleanup and resume the product roadmap.

---

## 16. FINAL TAKEOVER NOTE

The previous chat did not identify evidence of a dangerous architecture regression from the #753–#767 sequence. The work so far has consistently **reduced** mutation authority and hidden coupling while keeping diagnostic proof.

The main unresolved architecture problem is no longer Capital ↔ Presentation. That phase is closed.

The main unresolved structural frontier is now:

**cross-artifact / multi-writer ownership around Company #010 HyperLend + Rewards, followed by Rewards ICP/NNS and Decision Ledger.**

Resume there after a fresh live verification pass.

The model can change. **The memory and authority boundaries must remain The Holding's.**
