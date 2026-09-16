# THE HOLDING — TAKEOVER HANDOFF
## 2026-09-16 · P9 after PR #845

Status: **ACTIVE TAKEOVER HANDOFF**  
Purpose: let another chat/model resume the current public-phase work without repeating the investigation.  
Authority: continuity / engineering handoff only.  
`executionAuthority = none` remains unchanged.

---

## 0. FIRST RULE ON RESUME

Do **not** treat this file as live truth for changing repository state.

Always resume in this order:

`LIVE main → intelligence/project-memory/CURRENT.md → latest continuity → Router → this handoff → fresh artifacts/evidence → exact workflow runs`

This handoff was created from a branch based on live `main` head:

`d4f2d7a6a8fa25b73b7ec42dcd40407dcdc21d69`

At the moment this handoff was written, that commit was:

`data: update historical accounting completeness map`

Main is highly active because production workflows materialize bot-generated artifacts. Therefore **re-read main before every merge/closure decision**.

---

## 1. OWNER INTENT / OPERATING MODE

The owner explicitly asked to continue the active roadmap autonomously inside existing authorization boundaries and to avoid overengineering.

Working rules:

- one primary objective at a time;
- systemic reusable fixes over one-off patches;
- no duplicate truth;
- `UNKNOWN != 0`;
- GREEN workflow != physical production materialization;
- no wallet signing / claiming / capital execution;
- no methodology or authority expansion without explicit owner approval;
- do not reopen already closed packages without a new concrete production defect;
- do not build large speculative layers before their roadmap stage;
- avoid polishing legacy Aerodrome/Velodrome for its own sake because Aero / MetaDEX03 is coming; preserve reusable primitives instead.

The owner and previous chat explicitly agreed on a stop-rule mindset:

`prove real blocker → fix minimally → materialize → mark package GREEN → move on`

---

## 2. ROADMAP POSITION

Public-phase roadmap ordering remains authoritative:

- P5 universal historical reward-token valuation
- P6 new reward-token reuse proof
- P7 heavy workflow profiling
- P8 performance/reliability optimization only if measured
- **P9 bounded existing Economic Graph / sensor closure ← ACTIVE FRONTIER**
- P10 system-wide production acceptance
- P11 cosmetics/current-state only after P1–P10 GREEN
- P12 pre-private cleanup/freeze
- P13 pre-private checks
- P14 final public checkpoint
- P15 verified backup
- P16 visibility change only with explicit OWNER CONFIRMATION
- P17 post-private audit

Do not jump into private-only layers yet.

---

## 3. CLOSED PACKAGES — DO NOT REOPEN WITHOUT NEW EVIDENCE

### P5 — CLOSED

P5 was closed through merged PR #842.

Key law preserved:

- unresolved historical prices remain honest `UNKNOWN`;
- no current-price backfill;
- no unjustified $1 stablecoin assumption;
- no APR-derived factual income;
- historical provenance and exact boundary requirements remain fail-closed.

Do **not** restart WETH / Aerodrome historical route archaeology unless a new live blocker proves a real reusable gap.

### P6 — CLOSED

PR #843 proved reuse against live non-base rewards and was merged.

Important acceptance result from the live proof:

- 39 live non-base rewards discovered;
- 30 matched canonical history;
- 4 had factual historical USD valuation;
- 26 correctly remained `UNKNOWN`;
- no reward-token-specific bespoke economic shortcut was needed for acceptance.

Do not reopen P6 just to improve coverage percentages.

### P7 — CLOSED BY MEASUREMENT

P7 profiling found a real repeated bottleneck in the historical Aerodrome managed strategy / Voter enrichment path.

Observed production failure family:

- public historical Base providers repeatedly returned `413 / 403 / 429`;
- one run spent ~31s checking out a very large branch set, then additional time cycling RPC providers;
- the real material blocker was historical `eth_getLogs` range/provider reliability, not accounting logic.

The bottleneck was concrete and repeated, so P8 was justified.

### P8 — CLOSED + PHYSICALLY MATERIALIZED

PR #844 implemented the bounded reliability fix.

Design principles:

- preserve existing semantics;
- improve historical range splitting / failover behavior;
- do not bypass workflow-control rules;
- use the existing production-shaped workflow as the canary rather than inventing duplicate test machinery.

Important live-canary result:

- the same historical scan that previously failed completed successfully;
- `99,136` historical events recovered;
- `950` transactions reconstructed;
- final state reached `exact-current-state-parity`;
- historical segment took about 3m09s, total job about 5m;
- this was accepted as reliable enough and far below the 20m timeout, so no speculative checkpoint/cache subsystem was added.

PR #844 was merged.

Production acceptance was then completed correctly:

- main triggered the real Aerodrome production workflow;
- a fresh physical `aerodrome-managed-pulse.json` was written to main by bot materialization;
- therefore P8 is genuinely closed, not just PR-green.

Do not add incremental caching/checkpointing unless fresh measurements show a new material bottleneck.

---

## 4. ACTIVE P9 — WHAT WAS FOUND

P9 is **bounded closure of already-active Economic Graph / sensor factual/reliability tails**.

No new architecture should be opened here.

The first real P9 failure was:

`Curve gauge flow lost exact round-flow SHA-256 binding`

Investigation showed the upstream artifacts had refreshed while `curve-gauge-flow` was stale.

The important timeline was:

- `round-flow` refreshed;
- `snapshot-proof` refreshed shortly after;
- old `curve-gauge-flow` remained from 12 September;
- downstream Economic Graph therefore saw a real SHA-chain mismatch.

The producer workflow was **not dead**. It did run automatically.

Exact production failure was more specific:

1. fresh historical RPC read attempted against public provider;
2. provider returned archive/history restriction (`403 Archive requests require a personal token`);
3. existing retained-history fallback correctly recovered `79/79` gauges;
4. verifier then blocked publish with:

`Retained historical RPC provenance missing`

So the real bug was not the fallback data itself and not the SHA guard.

It was a narrow retained→retained provenance inheritance bug.

---

## 5. PR #845 — P9 FIX ALREADY MERGED

Branch used:

`fix/p9-vlcvx-retained-rpc-provenance-20260916`

PR #845 title/context:

P9 retained historical RPC provenance preservation.

Change size was deliberately tiny:

- 1 production file;
- +7 / -2 lines;
- verifier / SHA guard / authority laws were not weakened.

Root cause in code:

The fallback only inherited provenance from the prior fresh field:

`prior.observation.historicalLogRpcEndpointClassesUsed`

But the previous canonical artifact was itself already retained-mode. In that state, the actual historical provenance lived in:

`retainedHistoricalLogRpcEndpointClasses`

So a retained→retained fallback lost provenance even though the proof physically existed.

Fix behavior:

- inherit existing retained historical RPC provenance first;
- otherwise use the prior fresh historical endpoint-class field;
- if neither exists, remain fail-closed;
- verifier stays strict.

### #845 production-shaped acceptance

The PR reproduced the same real `403` scenario and then succeeded:

- retained fallback restored `79/79` gauges;
- verifier GREEN;
- retained historical RPC provenance preserved correctly;
- observed retained class included `eth.drpc.org`;
- Gauge Flow GREEN;
- Economic Graph GREEN in PR-shaped validation;
- live dual-cohort GREEN;
- security GREEN;
- hygiene GREEN.

Two Explanatory Context checks were RED before merge, but investigation showed they were reading the **old physical Gauge Flow artifact from the branch**, not a regression in the fix. That was expected pre-materialization behavior.

PR #845 was merged.

Merge commit recorded in the automatic continuity around this work:

`a6a32649e637549724126b97791f59b61af13fd1`

Commit message:

`P9: preserve vlCVX retained historical RPC provenance`

---

## 6. POST-#845 PHYSICAL MATERIALIZATION — IMPORTANT

After merge, do not assume closure from the PR alone.

The automatic production cascade **did fire**.

Observed fresh bot commits after #845 include:

- `83b8d1ac...` — `intelligence: refresh vlcvx votium curve gauge flow`
- later downstream refreshes including Economic Graph and Explanatory Context

Observed downstream commits in the live main history during this session included:

- `6dcfc2f6...` — `intelligence: refresh economic graph`
- `aa43bc95...` — `intelligence: refresh explanatory context`
- additional bot materializations followed afterward.

This is strong evidence that the repaired Gauge Flow was physically published and the cascade resumed.

However, **P9 has NOT yet been formally declared GREEN in this handoff**.

The next chat must re-read current main and exact current workflow status because main moved repeatedly after those commits.

---

## 7. EXACT NEXT TASK — DO THIS FIRST

The current objective is still P9.

Do this in order:

1. Read live `main` head.
2. Read live `CURRENT.md` and latest continuity.
3. Inspect the newest physical artifacts in the repaired chain:
   - vlCVX/Votium round flow;
   - snapshot proof;
   - curve gauge flow;
   - curve pool context;
   - Economic Graph;
   - Explanatory Context.
4. Verify their SHA/provenance chain is coherent after #845 materialization.
5. Inspect newest production runs for:
   - Gauge Flow;
   - Curve Pool Context;
   - Economic Graph;
   - Explanatory Context;
   - any P9 recovery/resume wrapper.
6. If those are GREEN and no other real current sensor/Graph failure exists, mark **P9 GREEN**.
7. If one current RED remains, inspect its exact failed step and repair **only that concrete tail**.
8. Do not create a broad "P9 cleanup" project.
9. Once P9 is physically clean, move immediately to **P10 system-wide production acceptance**.

---

## 8. P9 STOP RULE

P9 is done when:

- existing active sensor/Graph chain is physically coherent on main;
- no current production RED remains that is attributable to an existing factual/reliability tail in P9 scope;
- current graph/context artifacts bind to their real upstream artifacts;
- recovery paths are working rather than silently stale;
- no manual-only replay is required for normal operation.

P9 is **not** a mandate to:

- add new protocols;
- add new sensor architecture;
- redesign Economic Graph semantics;
- expand authority;
- add speculative predictive layers;
- perfect legacy Aerodrome internals;
- begin Aero / MetaDEX03 integration early.

---

## 9. AERO / METADEx03 STRATEGIC CONTEXT — KEEP, DO NOT DISTRACT P9

The owner supplied an important strategic direction during this work:

Aerodrome and Velodrome are expected to converge/evolve into the new Aero / MetaDEX03 stack.

Public research done earlier in this conversation indicates the future stack is strategically relevant because it may expose richer onchain observability, including concepts like Pool Tape / richer historical volume-fee-swap-liquidity data.

Operating conclusion:

- keep legacy Aerodrome/Velodrome historical support because immutable historical accounting remains relevant;
- do **not** over-polish legacy-specific machinery beyond real live blockers;
- design reusable semantics and adapters rather than hardcoding future Aero assumptions prematurely;
- future conceptual family should look like:

`common MetaDEX-family semantics → legacy Aerodrome/Velodrome adapters → Aero/MetaDEX03 adapter`

Reusable primitives already worth preserving:

- canonical ledger;
- exact-block / historical boundary discipline;
- pool discovery;
- historical valuation provenance;
- fail-closed `UNKNOWN`;
- chain-aware quote routes;
- factual materialization;
- sensor/Economic Graph lineage.

Do not mutate the current public roadmap merely because Aero is coming.

---

## 10. ACCOUNTING / AUTHORITY INVARIANTS — NEVER BREAK THESE

- Canonical Income Ledger is the sole factual earned-income recognition authority.
- Reference APR/APY is not factual income.
- Opening balance is baseline, not current-period income.
- Settlement must not double-recognize already-earned income.
- `UNKNOWN != 0`.
- Missing historical evidence remains partial/null.
- No current-price historical backfill.
- No unproven stablecoin peg shortcut.
- Provenance and exact boundary constraints stay fail-closed.
- GREEN workflow != physical artifact.
- No wallet signing / claim / execution / capital movement.
- No silent methodology mutation.
- `executionAuthority = none`.

---

## 11. RELEVANT LIVE MEMORY STATE AT HANDOFF CREATION

At handoff creation, `CURRENT.md` pointed to automatic continuity:

`THE_HOLDING_MASTER_CONTINUITY_2026-09-16_151851_AUTO_608c23ff.md`

That continuity recorded the #845 trigger boundary and warned that some accounting artifacts predated the trigger boundary, meaning they must be re-read before claiming physical completion.

Snapshot values in that continuity included:

- Security Sentinel: WATCH; Critical 0 / High 2 / Medium 73;
- accounting mechanisms: 29;
- reusable coverage gaps: 0;
- canonical ledger observed events: 1540;
- companies in monthly reports: 10.

These are resume hints only. Re-read live values.

---

## 12. LAST KNOWN LIVE MAIN BOUNDARY BEFORE THIS FILE

Immediately before creating the handoff branch, live main was:

`d4f2d7a6a8fa25b73b7ec42dcd40407dcdc21d69`

`data: update historical accounting completeness map`

This handoff branch was created exactly from that main head.

If main has advanced — it probably has — **main wins**.

---

## 13. TAKEOVER SUMMARY IN ONE SCREEN

- P5 CLOSED — do not reopen.
- P6 CLOSED — reuse proof done.
- P7 CLOSED — measured real Aerodrome historical-RPC bottleneck.
- P8 CLOSED — #844 reliability fix + live recovery + physical Aerodrome materialization.
- P9 ACTIVE but near closure.
- P9 real blocker was stale vlCVX/Votium Gauge Flow caused by retained-history provenance loss.
- #845 fixed retained→retained provenance without weakening verifier.
- #845 merged.
- fresh Gauge Flow physically materialized.
- downstream Economic Graph and Explanatory Context subsequently refreshed.
- **next exact action:** verify latest main chain/runs are now coherent; if yes P9 GREEN → P10.
- do not open new architecture or over-polish legacy Aerodrome.
- keep future Aero/MetaDEX03 compatibility as a design constraint, not a current distraction.

The next chat should be able to continue from here without repeating the P5/P6/P7/P8 investigations or the #845 root-cause analysis.
