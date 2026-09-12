# THE HOLDING — URGENT ARCHITECTURE HANDOFF CHECKPOINT
## 2026-09-12 08:54 MSK · manual owner-requested emergency handoff

Status: **URGENT MANUAL CONTINUITY CHECKPOINT / ACTIVE ARCHITECTURE TAIL**  
Purpose: **allow a parallel/replacement chat to resume immediately without redoing already-proven work**  
Authority: **observation, architecture continuity and implementation guidance only**  
`executionAuthority = none`

> Owner instruction at checkpoint creation: current chat is becoming unreliable / hanging. Create a very detailed checkpoint in a branch immediately so a parallel chat can take over. The replacement chat should continue from live truth, not from this document alone.

---

# 0. NON-NEGOTIABLE RESUME LAW

Always restore current truth in this order:

`LIVE main → CURRENT.md → latest immutable continuity → Router / Memory Routing Index → task-specific canon/context → exact artifact bytes → exact workflow/run evidence`

This checkpoint is a **handoff aid**, not a replacement for live truth.

If `main`, CURRENT, continuity, workflow runs, artifacts or PRs advanced after this checkpoint was created, the newer live evidence wins.

Do not blindly resume old branches/PRs merely because they are named below.

---

# 1. EXACT LIVE BOUNDARY AT CHECKPOINT CREATION

Repository:

`TheHolding83888/TheHolding-site-1.32`

Checkpoint branch:

`checkpoint/urgent-architecture-handoff-20260912-0854-msk`

Branch base / live `main` at checkpoint creation:

`8e16926cc3c282fae8f6ae8356f3dcd3b961b6e1`

Commit message:

`intelligence: refresh vlcvx votium voting provenance`

This commit was produced by the production Votium Voting Provenance workflow and is the physical downstream result of the latest Votium Round Flow materialization.

Immediate parent production commit:

`d387ffc17263a969b618e77b40749dad548633fb`

Commit message:

`intelligence: refresh vlcvx votium round flow`

Important: the Round Flow writer first hit a single atomic-publish/CAS race, then a clean rerun succeeded. No retry-code change was made because the rerun proved it was a transient write race rather than a systematic writer defect.

---

# 2. PROJECT / AUTHORITY CANON THAT MUST NOT REGRESS

The Holding is an onchain Capital Operating System / investment holding architecture with persistent intelligence, memory, governance and company/fund tracking.

Lifecycle:

`BUILD → REGISTER → OPERATE → MEASURE → MATURE → DISCOVER → TRADE (optional)`

Cognitive cycle:

`OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → ACT → MEASURE → LEARN`

Hard authority boundary:

`executionAuthority = none`

Therefore:
- no wallet signing;
- no autonomous transactions;
- no autonomous capital movement;
- no claiming/approval/voting execution;
- no autonomous methodology mutation;
- no hidden expansion of repository/workflow authority just to obtain GREEN;
- production capital execution remains impossible.

Epistemic laws:
- `UNKNOWN != 0`;
- partial != total;
- Reference APR/APY != factual earned-income authority;
- Canonical Income Ledger remains sole factual earned-income recognition authority;
- opening balance != current-period income;
- historical evidence != current income;
- correlation != causation;
- GREEN workflow != physically materialized production artifact;
- fail closed unless provenance and authority are proven.

---

# 3. ARCHITECTURE PROGRAM — WHAT IS ALREADY CLOSED

## Phase 1 — Capital / Presentation / orchestration separation

This bounded phase is complete and should **not be reopened absent a genuine regression**.

Already merged:
- #753 retire legacy Collection → Passport router;
- #754 make Presentation/public-site polish explicit instead of hidden import side effects;
- #755 separate Capital orchestration from Presentation materialization;
- #756 align Unified Capital proof with the boundary;
- #757 shrink Unified Capital writer surface;
- #758 decouple Presentation-only PRs from heavy Capital validation;
- #759 reduce false Productivity fan-out;
- #760 remove stale Capital → Presentation compatibility dependency;
- #761 retire duplicate Productivity recovery writer;
- #762 retire duplicate Capital State recovery writer;
- #763 split Market Data writers by canonical ownership;
- #764 retire duplicate YieldRing recovery writer;
- #765 retire duplicate Cypher public-admission writer;
- #766 canonicalize Company #010 Project X writer;
- #767 repair Unified Capital setup-node reliability tail.

Architecture principle retained:

**ONE ARTIFACT → ONE CANONICAL WRITER**

Do not create a new meta-orchestrator or giant god-workflow.

---

# 4. PHASE 2 — CANONICAL WRITER OWNERSHIP STATUS

The duplicate-writer cleanup has effectively reached the intended structural target.

Completed ownership work includes:
- HyperLend state/rewards ownership split (#768);
- ICP/NNS rewards ownership split (#769);
- Decision Ledger canonical writer (#770 and follow-up proof work);
- ICP/NNS → Rewards physical handoff repair;
- Rewards `workflow_run` production-main boundary hardening (#773).

Latest observed Workflow Control Plane production state before this checkpoint was **GREEN** with the following important structural results:

- duplicate candidate writer paths: **0**;
- unresolved topology edges: **0**;
- cycles: **0**;
- repository writers without concurrency: **0**;
- broad `git add` debt: **0**;
- structural no-new-debt: PASS;
- fan-out debt below frozen baseline;
- authority boundary remains read-only / non-execution for the relevant intelligence paths.

Interpretation:

The central architecture-cleanup target is no longer duplicate writers. The remaining work is a **production reliability/evidence tail**, not a reason to reopen broad architecture refactoring.

---

# 5. RECENT PRs THAT ARE DEFINITIVELY MERGED — DO NOT REDO

## PR #773 — Rewards workflow_run production boundary

Title:

`Fail closed Rewards workflow_run handoffs to production main`

Merged commit:

`2a21bb25474211f9d72ee68ba968281a500d2000`

What it fixed:
- a successful ICP/NNS validation run on a PR had been capable of waking the production `Update Company Rewards` writer via `workflow_run`;
- trusted default-branch code was still checked out, so PR code itself did not receive write authority, but PR validation must not wake a production contents-writer or consume production runtime/secrets.

Final boundary:
- `workflow_run` scoped to `branches: [main]`;
- job fails closed unless upstream is successful, on main, from canonical repository, and not PR/PR-target;
- no new writer;
- no scheduler change;
- no dispatch authority expansion;
- `executionAuthority = none`.

## PR #774 — vlCVX Rewards archive-history resilience

Title:

`Keep canonical Rewards live when vlCVX archive history is unavailable`

Merged commit:

`36a541cde2f0b2fd927d1e375b2bae57813537df`

What it fixed:
- canonical `Update Company Rewards` could reach the vlCVX finalizer but fail the entire aggregate when historical `RewardAdded` providers returned RPC/Blockscout 400/403/429;
- unrelated ICP/HyperLend/etc. projections were then blocked by an external archive-provider outage.

Final semantics:
- fresh full history remains preferred;
- on fresh-history failure, only a previously canonical validated last-verified inventory may be admitted;
- current distribution identity and current claimable state are re-read for retained tokens;
- component becomes explicit `partial` / `unknown-current-inventory`;
- no fabricated zero/completeness;
- prior scan provenance retained;
- this path has no period-income authority;
- `UNKNOWN != 0`;
- `executionAuthority = none`.

## PR #775 — Votium temporal transition proof hardening

Title:

`Retain Votium transition evidence beside rolling round flow`

Merged commit:

`e9b734ad4bb9be2736a7ae058323dd7bbe4bac57`

Why it was needed:
- canonical weekly Votium Round Flow advanced to 128–130;
- Voting Provenance had incorrectly assumed the latest three rounds would forever remain 127–129;
- the historical 127→128 source transition remained true, but the temporal assumption broke the SHA-bound downstream proof.

Final design:
- canonical Round Flow permanently retains a source-native historical transition anchor `[127,128,129]`;
- current rolling window continues independently;
- non-consecutive anchor↔rolling comparisons are marked non-comparable rather than implying continuity;
- Voting Provenance selects the transition anchor by identity, not `slice(-3)`;
- exact current Round Flow bytes and current `lastRoundProcessed` remain bound;
- anchor is historical evidence only, never current income;
- no new workflow/orchestrator;
- `executionAuthority = none`.

---

# 6. PHYSICAL PRODUCTION EVIDENCE AFTER #775

This is critical because GREEN PR checks were not accepted as sufficient.

## 6.1 Round Flow physically materialized

Production commit:

`d387ffc17263a969b618e77b40749dad548633fb`

Commit message:

`intelligence: refresh vlcvx votium round flow`

Artifact:

`intelligence/economic-graph/vlcvx-votium-round-flow.json`

Fresh physical state observed:
- `generatedAt = 2026-09-12T05:25:02.513Z`;
- `status = shadow-measured-not-promoted`;
- `activeRound = 131`;
- `lastRoundProcessed = 130`;
- rolling depth = 3;
- rolling first round = 128;
- rolling last round = 130;
- `transitionAnchorRounds = [127,128,129]`;
- `transitionAnchorComplete = true`;
- measured completed rounds = 4;
- first round = 127;
- last round = 130;
- latest processed round included = true;
- `executionAuthority = none`.

A first publish attempt hit an atomic write race / CAS conflict. A rerun succeeded without code changes, proving a one-off writer race rather than a deterministic defect. Do not add retry complexity unless this becomes recurrent.

## 6.2 Voting Provenance physically materialized

Production commit:

`8e16926cc3c282fae8f6ae8356f3dcd3b961b6e1`

Commit message:

`intelligence: refresh vlcvx votium voting provenance`

Workflow:

`The Holding · Votium vlCVX Voting Provenance`

Observed production run:

`34675536078`

Result: **SUCCESS**

Important successful steps:
- build live voting provenance proof;
- verify source/mapping/epistemic boundaries;
- publish generated voting provenance atomically;
- prove physical state on main.

Previously dedicated proof also demonstrated:
- transition `127 → 128`;
- transition anchor `[127,128,129]`;
- current `lastRoundProcessed = 130`;
- exact post-migration gauges `79/79`;
- `executionAuthority = none`.

Therefore the temporal-proof issue itself is closed.

---

# 7. CURRENT SINGLE REMAINING PRODUCTION BLOCKER

## Votium → Curve Gauge Flow archive-RPC reconstruction

Workflow:

`The Holding · Votium → Curve Gauge Flow`

Workflow file:

`.github/workflows/update-vlcvx-votium-curve-gauge-flow.yml`

Generator:

`intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.mjs`

Verifier:

`scripts/verify-vlcvx-votium-curve-gauge-flow.mjs`

Latest workflow_run triggered by the fresh Voting Provenance commit:

Run ID:

`34675565555`

It failed, was rerun once, and failed again in the same build stage.

Failure stage:

`Build live Votium → Curve gauge flow`

It fails **before verification/publish**, so downstream artifacts are not yet refreshed.

Exact live failure observed on one lane:

`ethereum-rpc.publicnode.com` → HTTP 403

Provider body:

`Archive requests require a personal token`

The historical scan also did not complete through the other configured public historical lanes during the rerun, so the final surfaced exception remained the archive 403.

This is not evidence that the economic logic is wrong.

It is a production reliability problem in repeated reconstruction of historical `GaugeVoteExecuted` logs.

---

# 8. IMPORTANT CURRENT GAUGE-FLOW ARCHITECTURE

The generator intentionally separates:

1. current state RPC lane;
2. historical log RPC lane.

Current-state provider candidates include publicnode / llama / 1rpc / drpc.

Historical candidates include 1rpc / drpc / llama / publicnode.

Current-state reads are used for:
- current/persistent finalized proposal state;
- current GaugeVotePlatform state;
- current Curve executor state;
- current `gaugeTotal` proof for event-only zero gauges.

Historical scan is used for immutable `GaugeVoteExecuted` events.

The artifact's epistemic contract already says:
- current finalized state is read live;
- historical state reads are not required;
- historical execution evidence is event logs;
- event-only gauges are valid only if live `gaugeTotal = 0` and emitted BPS = 0;
- incentive→vote is correlation only;
- vote→executed Curve weight is attributed/execution-confirmed;
- executed gauge weight != pool revenue;
- protocol flow != realised company income.

Do not weaken any of those semantics.

---

# 9. EXISTING LAST-VERIFIED GAUGE-FLOW EVIDENCE

The repository already contains an older fully proven canonical artifact:

`intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json`

Observed old canonical state:
- `version = 0.1-vlcvx-votium-curve-gauge-flow`;
- `engineVersion = 0.1-votium-convex-curve-execution-bridge`;
- `status = shadow-cross-protocol-flow-proven`;
- generated 2026-08-26;
- current contracts match present canonical contracts;
- historical log RPC used `eth.drpc.org`;
- historical scan completed early once exact execution completeness was proven;
- exact execution events for the immutable target proposals were already reconstructed and verified.

That artifact is **stale as a full current artifact** because its source SHA bindings point to older Round Flow / Voting Provenance bytes.

However, the underlying historical `GaugeVoteExecuted` event-set for the same finalized proposal IDs is immutable evidence and can potentially be reused safely if the new implementation validates it strictly.

Do not simply copy the old artifact as “fresh”.

---

# 10. RECOMMENDED FIX FOR THE GAUGE FLOW — VERY IMPORTANT

The next chat should implement a **bounded retained historical evidence fallback**, not a fake-success shortcut.

Preferred model:

`fresh immutable event reconstruction if available → otherwise validated retained event-set → fresh current-state revalidation → new artifact with fresh source bindings`

### Fresh path

Keep current behavior:
- try fresh historical `GaugeVoteExecuted` reconstruction through available archive/log RPC lanes;
- if successful, use that evidence and publish normally.

### Retained historical fallback path

Only admit previously canonical event evidence if ALL of the following are true:

1. prior artifact has expected version/engine;
2. prior artifact status is fully proven, not partial;
3. contracts exactly match current canonical:
   - Curve GaugeVotePlatform;
   - CurveGaugeExecutor;
4. Convex pinned source commit still matches expected source authority;
5. current target proposal IDs exactly match the proposal IDs represented in retained evidence;
6. retained execution events contain valid tx hashes + block numbers;
7. no positive-weight event-only gauge exists;
8. retained event-set reconstructs the same expected execution partition;
9. current live proposal state is still finalized;
10. current executor still reports done;
11. current submitted gauge count / BPS remain complete;
12. every event-only gauge is **re-proven live** with current `gaugeTotal = 0`;
13. the new artifact clearly records historical evidence mode, e.g. `retained-last-verified-canonical-events`;
14. archive refresh failure is recorded explicitly in provenance;
15. the new artifact gets **fresh current Round Flow SHA and fresh current Voting Provenance SHA**, never the old SHA bindings;
16. verifier explicitly accepts retained historical evidence only under this strict admission contract.

### What must NOT happen

Do not:
- call stale old artifact fresh;
- preserve old upstream SHAs;
- fabricate an empty log set;
- fabricate zero;
- skip fresh current-state checks;
- suppress archive errors without provenance;
- add wallet/capital execution;
- add a new global orchestrator;
- reduce verifier depth simply to make CI green.

### Why this design is sound

`GaugeVoteExecuted` events for already finalized historical proposals are immutable chain history.

Repeatedly depending on a free archive provider to rediscover the exact same immutable event-set is an availability dependency, not a truth requirement, provided the retained evidence itself was previously canonical and is admitted under exact identity checks.

Fresh current state should still be re-read to prove that the finalized proposal/executor/gauge semantics remain coherent.

This mirrors the correct reliability principle already used in #774 for vlCVX archive-history resilience, while keeping the stronger Gauge-specific event semantics.

---

# 11. EXPECTED DOWNSTREAM CHAIN AFTER GAUGE FLOW IS FIXED

The production chain to verify physically is:

`Votium Round Flow`
→ `Votium Voting Provenance`
→ `Votium → Curve Gauge Flow`
→ `Curve Pool Context`
→ `Economic Graph`
→ `Explanatory / Brain context`

Do not claim architecture completion until the relevant downstream production chain is materially coherent.

A GREEN workflow alone is insufficient.

For each writer layer, verify either:
- a new physical commit/artifact was created; or
- the workflow proves an intentional no-op because generated bytes equal canonical bytes.

---

# 12. EXISTING HANDOFF CANARY / ORCHESTRATION PROOF

The Gauge workflow static phase currently runs:

`scripts/verify-vlcvx-votium-evidence-handoff.mjs`

Latest production logs showed this canary PASS with:

- chain = `Round Flow -> Voting Provenance -> Curve Gauge Flow -> Curve Pool Context`;
- `rootCadenceOnly = true`;
- `prUpstreamRebuildBoundToDownstreamProof = true`;
- pool independent freshness = `6h-preserved`;
- orchestration-only PR network calls = false;
- production live evidence builds = true;
- workflow dispatch authority = none.

Therefore the orchestration wiring is not the current problem.

The current problem is archive-event retrieval availability inside Gauge Flow.

---

# 13. COINGECKO / MARKET DATA TAIL IS PHYSICALLY CLOSED

This was an older architecture/reliability concern and should no longer be treated as open unless new evidence regresses.

Latest observed:

`intelligence/market-data/market-data-coingecko.json`

- `generatedAt = 2026-09-12T04:19:19.246Z`;
- `status = ok`;
- requested asset count = 26;
- fresh count = 26;
- stale fallback count = 0;
- one external request per refresh = true;
- daily source-lane separation remains explicit;
- `UNKNOWN != 0` retained.

Therefore the previously stale Daily CoinGecko lane is physically fresh now.

Do not reopen the old CoinGecko reliability branch unless a fresh live regression appears.

---

# 14. PUBLIC CAPITAL / MARKET COHERENCE OBSERVED HEALTHY

Latest observed:

`intelligence/market-data/public-capital-state.json`

- `generatedAt = 2026-09-12T05:02:09.334Z`;
- `status = ok`;
- market data fresh;
- Defitea canonical state bound;
- Productivity fresh;
- semantics still include:
  - `unknownIsNotZero = true`;
  - `partialIsNotTotal = true`;
  - `oneEconomicPositionOnce = true`;
  - Defitea fund/company TVL parity requirement;
  - nested company capital excluded from Defitea own displayed TVL;
  - related company income rollup separate from capital.

Observed totals at that instant:
- fund ecosystem TVL ≈ `$27,724.199036`;
- company network TVL ≈ `$71,165.016317`.

These are snapshot values, not immutable canon. Fresh-check before quoting publicly.

---

# 15. CONTROL PLANE / ARCHITECTURE STOP CONDITION

The architecture program was intentionally supposed to stop after:

1. writer ownership singular;
2. duplicate conflicts materially zero;
3. unnecessary fan-out materially reduced;
4. writer concurrency controlled;
5. no broad git add;
6. no unresolved cycles;
7. no unproven authority expansion;
8. Market Data/26-asset fallback cadence healthy;
9. Unified Capital coherent;
10. deployment/public smoke healthy;
11. `executionAuthority = none`.

Most of these are now satisfied.

The current Gauge Flow archive reliability tail should be treated as the **last bounded production-evidence closure**, not an excuse for broad refactoring.

After that tail and downstream materialization are green:

**STOP ARCHITECTURE REFACTORING.**

Do not invent another cleanup program.

---

# 16. FINAL GREEN CRITERIA FOR THIS ARCHITECTURE TAIL

Before declaring final GREEN, verify all of the following from fresh live evidence:

### Structural
- Control Plane GREEN;
- duplicate writer path count = 0;
- unresolved edges = 0;
- cycles = 0;
- repository writer without concurrency = 0;
- broad git add = 0;
- fan-out still under frozen baseline;
- protected global checks survive.

### Votium evidence chain
- Round Flow fresh and physically materialized;
- historical transition anchor `[127,128,129]` retained;
- rolling current rounds continue independently;
- Voting Provenance fresh and exact-SHA-bound;
- Gauge Flow fresh and exact-SHA-bound;
- Gauge Flow historical evidence mode explicitly records fresh-scan vs retained-canonical fallback;
- current finalized proposal/executor state live-checked;
- event-only zero gauges re-proven live;
- Curve Pool Context rebuilt/no-op-proven;
- Economic Graph rebuilt/no-op-proven;
- Explanatory/Brain context rebuilt/no-op-proven where relevant;
- `executionAuthority = none` throughout.

### Other tails
- CoinGecko 26/26 fresh or valid bounded fallback, not stale-called-fresh;
- public capital state coherent;
- no unrelated writer regression.

Only then write:

`ARCHITECTURE GREEN — STOP ARCHITECTURE REFACTORING`

---

# 17. MEMORY / CURRENT UPDATE AFTER GREEN

The owner explicitly requested that when work is finished, memory/current/auxiliary files be updated in detail.

Do **not** prematurely write final GREEN into CURRENT while Gauge Flow/downstream is still unresolved.

After final physical closure:

1. create a detailed final immutable architecture continuity/checkpoint;
2. update CURRENT through the project’s canonical memory-generation path;
3. update Router / relevant task pointers only where needed;
4. preserve exact final `main` SHA and important production run IDs;
5. record the final Control Plane metrics;
6. explicitly mark architecture refactoring STOPPED;
7. route next focus back to the pre-private/product roadmap;
8. preserve this urgent checkpoint as historical handoff evidence rather than rewriting it.

---

# 18. NEXT PRODUCT / PRE-PRIVATE ROADMAP AFTER ARCHITECTURE GREEN

North Star:

**«Вот адрес. Трекай.»**

Desired product path:

`Free Scan → Company Preview → Verify → Register → Index → Companion/API/Data/Protocol identity`

Arbitrary-wallet vision:
1. input wallet;
2. discover assets/protocols/mechanisms/history;
3. separate capital from income;
4. incremental tracking;
5. reports / Passport / Unknown Queue / evidence / provenance;
6. owner consent → Verify/Register/Index.

Before private migration, canonical sequence remains broadly:
- Foundation consolidation;
- bounded owner current-state + cosmetic refresh;
- final cleanup/freeze;
- exact-state preflight;
- final public-state checkpoint;
- final backup;
- public→private only with explicit owner participation;
- post-private audit.

Private-only deeper layers remain outside the current public-phase tail.

---

# 19. COSMETIC / PUBLIC-SURFACE WORK THAT SHOULD COME AFTER ARCHITECTURE, NOT BEFORE

Known remaining public-surface cleanup themes include:
- homepage footer phrase removal if still present;
- one canonical source for fund TVL surfaces;
- total Holding TVL = five funds under one methodology;
- Defitea Fund = defitea.eth own TVL under same source;
- remove page-local/parallel TVL formulas;
- audit Graph APR vs canonical Productivity/Stable Index/company rates;
- prefer exact canonical engine rates over local medians where appropriate;
- only genuinely stale Companies copy;
- counters / metadata / SEO audit;
- EN/RU sync;
- desktop + mobile verification of homepage / Companies / Index / Graph / Passports / side panels.

Do not start these until the current Gauge production-evidence tail is closed or explicitly deferred by owner instruction.

---

# 20. IMPORTANT DO-NOT-DO LIST FOR TAKEOVER CHAT

Do not:
- reopen already-completed Capital/Presentation separation;
- recreate duplicate-writer cleanup already proven by Control Plane;
- merge stale historical branches blindly;
- create a new meta-orchestrator;
- create a giant all-in-one workflow;
- weaken fail-closed proofs;
- remove provenance for simplicity;
- call stale fallback fresh;
- treat GREEN CI as physical production completion;
- fabricate zero from missing data;
- convert historical evidence into current income;
- broaden workflow/token authority;
- introduce wallet/capital execution;
- mutate methodology just to satisfy tests;
- continue architecture polishing after final bounded closure.

---

# 21. EXACT RECOMMENDED RESUME ORDER FOR PARALLEL CHAT

## Step 1 — fresh read-only live check

Immediately inspect:
- `main` SHA;
- CURRENT.md;
- latest continuity;
- open/recent PRs;
- latest workflow runs;
- `workflow-control-plane.yml` result;
- Round Flow artifact;
- Voting Provenance artifact;
- Gauge Flow workflow run `34675565555` and any newer rerun/replacement;
- Pool Context;
- Economic Graph;
- Explanatory context.

If any newer chat already created a Gauge reliability PR, inspect it before writing anything.

## Step 2 — confirm current blocker still exists

If Gauge Flow is now green naturally, do not implement unnecessary fallback code. Instead verify physical artifact and continue downstream checks.

If it is still failing because historical archive/log RPC is unavailable, proceed with the retained historical-event evidence design above.

## Step 3 — implement one small Gauge reliability atom

Suggested fresh branch name, if no newer branch exists:

`fix/votium-curve-historical-event-resilience-20260912`

Likely files:
- `intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.mjs`;
- `scripts/verify-vlcvx-votium-curve-gauge-flow.mjs`;
- possibly paired workflow-definition/integration proof only if necessary.

Avoid touching unrelated architecture.

## Step 4 — PR proof

Require:
- static syntax;
- exact upstream binding;
- retained evidence admission proof;
- authority proof;
- Control Plane GREEN;
- no new writer/fan-out debt.

## Step 5 — merge only after proof

Then verify production cascade physically:

Round Flow / Voting Provenance should already be current.

Need to prove:
- Gauge Flow publish/no-op proof;
- Pool Context downstream wake + materialization/no-op;
- Economic Graph downstream wake + materialization/no-op;
- Explanatory/Brain downstream coherence.

## Step 6 — final architecture audit

Re-run Control Plane and capture exact final numbers.

## Step 7 — final memory closure

Create final detailed continuity/checkpoint + CURRENT/Router updates via canonical memory path.

Then record:

`ARCHITECTURE GREEN — STOP ARCHITECTURE REFACTORING`

and return focus to product/pre-private roadmap.

---

# 22. OWNER COMMUNICATION PREFERENCE FOR TAKEOVER

Alexander prefers concise progress reports while work is underway.

For status/tracking use:
- 🟢 done;
- 🟡 in progress + rough percentage;
- ⚪ next / queue.

Simple Russian explanation preferred.

When user says **«трекай»**, perform fresh live read-only GitHub check of:
- main;
- relevant branches/PRs;
- Actions/workflows/runs;
- generated artifacts/evidence;
- continuity/checkpoints;
- Router/current resume context;
- physical downstream materialization.

Do not answer from memory alone.

---

# 23. SUMMARY FOR IMMEDIATE TAKEOVER

At the instant of this checkpoint:

🟢 **Writer-ownership architecture cleanup is structurally complete.**  
🟢 **Control Plane was fully green with duplicate writer paths at zero.**  
🟢 **Rewards workflow_run production-main boundary is hardened (#773).**  
🟢 **vlCVX Rewards archive outage no longer blocks unrelated Rewards (#774).**  
🟢 **Votium historical transition is now source-native and time-resilient (#775).**  
🟢 **Fresh Round Flow physically exists on main (`d387ffc1…`).**  
🟢 **Fresh Voting Provenance physically exists on main (`8e16926c…`).**  
🟢 **CoinGecko source lane is fresh 26/26, fallback 0.**  
🟢 **Public Capital state is healthy.**  

🟡 **One bounded production tail remains:** `Votium → Curve Gauge Flow` cannot currently re-fetch already-proven historical execution logs reliably from public archive RPCs. Two attempts of production run `34675565555` failed in the historical build path.  
🟡 **Recommended fix:** strict retained-canonical immutable historical-event fallback + fresh live executor/gauge revalidation + fresh upstream SHA bindings + explicit provenance.  
⚪ **Then:** Pool Context → Economic Graph → Explanatory physical closure → final Control Plane audit → final memory/CURRENT update → `ARCHITECTURE GREEN — STOP ARCHITECTURE REFACTORING`.

This is the exact handoff point.
