# THE HOLDING — MASTER CONTINUITY · MANUAL ARCHITECTURE HANDOFF
## 2026-09-11 21:22 MSK · architecture / workflow ownership / canonical writers

Status: **MANUAL RESUME CHECKPOINT**  
Authority: **continuity / architecture handoff only**  
executionAuthority: **none**

> This checkpoint exists so a fresh chat/model can resume the architecture cleanup without reconstructing intent from conversational memory. Live `main` always wins over this file. Re-read current `main`, open PRs, Actions/checks, generated artifacts and the latest automatic continuity before changing anything.

---

## 1. EXACT RECOVERY ORDER

Resume in this order:

`live main -> CURRENT.md -> latest automatic continuity -> this manual architecture checkpoint -> Routing Index -> open PRs/branches -> exact workflow/source evidence`

At checkpoint creation:

- repository: `TheHolding83888/TheHolding-site-1.32`
- live main: `5e8f8ba1a2b5aa9bc1fe07b5df2868a1da9ece93`
- main commit: `memory: refresh current project bootstrap`
- main time: `2026-09-11T18:49:06Z`
- CURRENT points to automatic continuity: `THE_HOLDING_MASTER_CONTINUITY_2026-09-11_184847_AUTO_0a8f6adc.md`
- latest automatic continuity trigger: merged PR #764, `Retire duplicate YieldRing recovery writer`
- Security standalone at that continuity: WATCH, Critical 0 / High 2 / Medium 74
- non-negotiable authority boundary: `executionAuthority = none`

Do not infer current completion from these SHAs after resume. Fresh live evidence wins.

---

## 2. WHY THIS ARCHITECTURE PHASE EXISTS

The system had become safe but unnecessarily complex because multiple workflows could still mutate the same generated artifacts. Existing guards, concurrency and fail-closed proofs prevented most corruption, but duplicate writers created unnecessary races, fan-out, service commits and debugging surface.

The guiding rule for this phase is:

**ONE ARTIFACT -> ONE CANONICAL WRITER**

Other workflows may collect inputs, validate, replay diagnostics or verify invariants, but they should not retain a second production mutation path to the same canonical artifact unless there is a demonstrated operational reason.

Important: do **not** create a new orchestrator/layer for this cleanup. Reuse existing canonical writers and the existing Workflow Control Plane. Narrow authority; do not broaden it.

---

## 3. PARALLEL-CHAT ARCHITECTURE WORK ALREADY COMPLETED

These PRs were completed before this chat took over:

### #753 — Retire legacy Collection -> Passport router at source
- removed obsolete competing navigation authority at source;
- preserved direct Passport hash behavior and canonical Collection -> Index behavior;
- no economic or authority change.

### #754 — Make public-site polish explicit instead of import-driven
- removed hidden Presentation side effect on import;
- Presentation materialization became explicit;
- no wallet/capital authority change.

### #755 — Separate Capital orchestration from Presentation materialization
- Unified Capital stopped executing pure Presentation materialization.

### #756 — Align Unified Capital proof with Capital/Presentation boundary
- deterministic proof updated to match the new boundary instead of requiring retired coupling.

### #757 — Shrink Unified Capital writer to Capital-owned surfaces
- homepage and Yield Reports removed from Capital publication surface;
- pure Presentation changes stopped waking the Capital writer;
- shared economic company surfaces stayed Capital-owned where still materially projected.

### #758 — Decouple Presentation-only PRs from heavy Capital validation
- pure UI/Presentation work stopped paying the full Unified Capital E2E cost.

### #759 — Reduce false Productivity diagnostic fan-out
- removed one false wake edge from `Diagnose Productivity Recovery` to generic Unified Capital source;
- retained real tested dependencies;
- added bounded domain contract instead of bypassing Control Plane.

Result: **Capital <-> Presentation separation is considered structurally complete enough for the next phase.**

---

## 4. THIS CHAT: WORK COMPLETED AFTER TAKEOVER

### #760 — Remove stale Capital -> Presentation compatibility dependency
Status: merged.

Purpose:
- removed final no-op `public-site-polish-projection.mjs` compatibility dependency from the Capital owner projection;
- deterministic proof now forbids the dependency from returning.

No capital/accounting/reward/Market Data/Index methodology/wallet/execution change.

### #761 — Retire duplicate Productivity recovery writer
Status: merged.

Purpose:
- legacy manual Productivity recovery workflow downgraded from repository writer to read-only diagnostic replay;
- removed commit/rebase/push publication behavior;
- Unified Capital remains canonical production publisher for the affected Productivity/Public Capital surfaces;
- manual recovery capability remains diagnostic rather than mutating.

### #762 — Retire duplicate Capital State recovery writer
Status: merged.

Purpose:
- legacy manual Capital State recovery workflow downgraded from writer to read-only diagnostic replay;
- removed publication authority for `general-company-balance-sheet.json` and `capital-state.json`;
- Unified Capital remains canonical writer and retains manual dispatch.

### #763 — Split Market Data writers by canonical ownership
Status: merged.

Target ownership chain:

`Daily CoinGecko source lane -> Shared canonical Market Data -> Unified Capital/Public Capital`

Result:
- `Daily CoinGecko Baseline` publishes only `intelligence/market-data/market-data-coingecko.json`;
- daily canonical authority materialization is ephemeral validation only;
- daily workflow no longer publishes `market-data.json` or `public-capital-state.json`;
- Shared Refresh no longer writes the CoinGecko source-lane file;
- Shared Refresh is canonical writer for `market-data.json` and `onchain-price-shadow.json`;
- Public Capital remains downstream of Unified Capital;
- no schedule/methodology/26-asset-policy/execution authority expansion.

Important diagnostic note discovered during this work:
- the physical CoinGecko daily source file on main still showed `generatedAt: 2026-09-09T08:04:32.527Z` during investigation;
- however canonical `market-data.json` was fresh on 2026-09-11 and had 26/26 usable assets with current onchain-primary authority;
- therefore stale daily failback source must remain visible and must not be papered over. Fresh onchain authority and stale fallback source are distinct facts.
- if continuing Market Data diagnosis, check current daily workflow Actions first before modifying code; do not weaken stale/fail-closed semantics just to make checks green.

### #764 — Retire duplicate YieldRing recovery writer
Status: merged.

Purpose:
- legacy YieldRing recovery workflow downgraded from `contents: write` to read-only diagnostic replay;
- removed second publication path to `companies/index.html`, `yieldring/index.html`, and General Company Balance Sheet code surface;
- Unified Capital remains canonical production writer;
- no capital quantities/accounting/rewards/UI semantics/wallet/onchain execution change.

---

## 5. WORK IN PROGRESS AT THIS CHECKPOINT

### PR #765 — Retire duplicate Cypher public admission writer
Status at checkpoint: **OPEN, mergeable=true**  
Branch: `refactor/retire-company010-public-admission-writer-20260911`  
Head: `7a4eb5cf35d16ccd8689c0ac0617b0336cafcd0d`

Intent:
- Company #010 / Cypher is already admitted to canonical Companies surface;
- `The Holding Capital · Unified Refresh` is the ongoing canonical publisher of `companies/index.html`;
- old admission workflow still retained a second production write path to the same monolithic artifact.

PR #765 changes:
- downgrade `Admit Company #010 · Cypher Public Surface` from `contents: write` to `contents: read`;
- remove direct `--write` materialization and git commit/rebase/push publication;
- keep exact admission generator as temporary-preview diagnostic;
- require generated preview to byte-match current canonical `companies/index.html`, fail closed on drift;
- preserve Cypher capital/epistemic/authority checks;
- add paired deterministic workflow-definition proof that Unified Capital remains canonical Companies-surface writer;
- no capital quantity/accounting/reward/methodology/public semantics/wallet/execution change;
- no new workflow/orchestrator;
- `executionAuthority = none`.

**Resume action #1:** re-check PR #765 checks and current mergeability. Merge only if exact checks are green and no newer main change invalidates the proof. If it has already merged, move to the next duplicate-writer candidate.

---

## 6. FROZEN CONTROL-PLANE BASELINE — HOW TO INTERPRET IT

`intelligence/reliability/workflow-control-plane-baseline.json` is a **debt ceiling, not current desired topology**. It was observed at an older head and still lists historical duplicate candidate writers. Do not treat its count as proof that cleanup PRs failed to reduce live ownership.

Historical baseline recorded 7 candidate duplicate artifact paths:

1. `companies/index.html`
   - `admit-company-010-public`
   - `project-yieldring-capital-state`
2. `intelligence/learning/decision-ledger.json`
   - `record-brain-decision`
   - `record-owner-economic-decision`
3. `intelligence/market-data/market-data-coingecko.json`
   - `market-data-coingecko-daily`
   - `market-data-refresh`
4. `intelligence/market-data/market-data.json`
   - same Market Data workflows
5. `intelligence/market-data/public-capital-state.json`
   - same Market Data workflows
6. `companies/company-010-production-state.json`
   - `update-company-010-hyperlend-income`
   - `update-company-010-projectx-reference-apr`
   - `update-company-010-state`
7. `companies/rewards-data.json`
   - `update-company-010-hyperlend-income`
   - `update-company-rewards`
   - `update-icp-nns-rewards`

Since #761-#764 and active #765, some live duplicate ownership has already been reduced even if the frozen baseline still names it. Fresh source topology must be inspected before every next atom.

---

## 7. PLANNED NEXT ARCHITECTURE WORK AFTER #765

Continue **ONE ARTIFACT -> ONE CANONICAL WRITER** in small, independently provable atoms.

Recommended priority after #765:

### A. Re-measure live writer topology
Before changing another workflow:
- inspect current workflows on live main;
- identify which historical duplicate candidates still have real production mutation authority;
- distinguish source providers / diagnostics from actual repository writers;
- preserve any recovery path as read-only replay where useful;
- do not mechanically chase the old baseline count.

### B. `company-010-production-state.json`
Historical duplicate candidates:
- `update-company-010-hyperlend-income`
- `update-company-010-projectx-reference-apr`
- `update-company-010-state`

Goal:
- determine canonical Company #010 state writer;
- make Hyperlend/ProjectX jobs input collectors or diagnostic providers if they do not need canonical repository mutation;
- ensure one writer owns the final production-state artifact;
- preserve factual-vs-reference APR semantics and `UNKNOWN != 0`.

### C. `companies/rewards-data.json`
Historical duplicate candidates:
- `update-company-010-hyperlend-income`
- `update-company-rewards`
- `update-icp-nns-rewards`

Goal:
- identify canonical rewards writer;
- protocol-specific workflows should ideally supply/validate source evidence while one canonical aggregation writer publishes final rewards state;
- preserve Canonical Income Ledger as sole factual earned-income recognition authority;
- do not turn reference APR or estimates into factual income.

### D. `intelligence/learning/decision-ledger.json`
Historical duplicate candidates:
- `record-brain-decision`
- `record-owner-economic-decision`

This is sensitive because owner decisions and brain-derived records can have different provenance/authority semantics. Do **not** merge writers merely for aesthetic simplicity. First prove whether they truly write the same authority domain. If their distinct provenance requires separate append paths, prefer an explicit append/aggregation contract rather than deleting a legitimate authority boundary.

### E. Workflow fan-out reduction after writer cleanup
Only remove wake edges proven false by exact source execution/dependency analysis.

Preserve protected global checks and real cross-domain validation. Do not optimize away security/reliability proof just to reduce Actions count.

---

## 8. STOP CONDITION FOR ARCHITECTURE REFACTORING

Do not refactor indefinitely.

Stop this architecture phase when:
- each important generated artifact has one clear canonical production writer or a documented justified exception;
- duplicate mutation paths are removed or converted to read-only diagnostics/source providers;
- no unresolved workflow cycles are introduced;
- Control Plane remains fail-closed and no-new-debt;
- no security boundary is weakened;
- the system is materially easier to reason about than before.

Then return to the product roadmap instead of continuing cosmetic architecture work.

The purpose is **less complexity**, not architectural perfection.

---

## 9. HARD SAFETY / GOVERNANCE BOUNDARIES

Preserve all of these throughout future work:

- `executionAuthority = none`;
- no wallet signing;
- no autonomous onchain transactions or capital movement;
- no autonomous policy/methodology mutation;
- no new write authority merely to simplify orchestration;
- no disabling/faking stale-data checks;
- no converting UNKNOWN to zero;
- no treating Reference APR/APY as factual realized income;
- no broad `git add` reintroduction;
- no security detector suppression to improve status;
- no new orchestrator unless there is a demonstrated need that cannot be solved by narrowing existing ownership;
- use branch/PR + deterministic proof + exact runtime/check evidence for each atom;
- live `main` and exact artifacts always outrank conversational memory/checkpoints.

---

## 10. OWNER INTENT TO PRESERVE

Alexander explicitly asked for this sequence:

1. finish the residual architecture cleanup inherited from the parallel chat;
2. continue the additional architecture modernization proposed in this chat;
3. preserve all work and future intent in GitHub so another chat can resume without loss;
4. favor meaningful simplification only — no change for change's sake;
5. do not reduce security or create more architectural layers;
6. after this architecture phase, return to the broader The Holding roadmap/product work.

The proposed modernization from this chat is specifically:

**ONE ARTIFACT -> ONE CANONICAL WRITER**, followed by bounded, evidence-based fan-out reduction using the existing Control Plane.

---

## 11. IMMEDIATE RESUME CHECKLIST

A fresh chat should do exactly this:

1. Read live `intelligence/project-memory/CURRENT.md` on `main`.
2. Read latest automatic continuity named by CURRENT.
3. Read this manual checkpoint.
4. Check live main SHA and recent commits.
5. Check PR #765 and its checks / merge state.
6. Check whether any newer PR has already continued writer-ownership cleanup.
7. If #765 is green and still relevant, complete it.
8. Re-measure actual duplicate writers on live source; do not rely only on frozen baseline.
9. Take next highest-confidence writer-ownership atom.
10. Keep changes narrow, reversible, deterministic and fail-closed.
11. After each successful atom, verify exact artifact ownership and downstream runtime evidence.
12. Before context exhaustion, create another manual checkpoint of equal or greater detail.

---

## 12. CURRENT VERDICT

No evidence at this checkpoint suggests the parallel-chat cleanup broke the system or expanded dangerous authority. The architecture direction remains conservative: remove hidden execution edges, reduce duplicate writers, preserve diagnostics, preserve fail-closed proofs, and narrow write authority.

The active work is no longer merely "closing tails" from the parallel chat. Since #761 the project is already inside the next planned phase: **canonical writer ownership cleanup**.

Next concrete work item: finish/verify #765, then continue live duplicate-writer measurement and the next proven ownership atom.
