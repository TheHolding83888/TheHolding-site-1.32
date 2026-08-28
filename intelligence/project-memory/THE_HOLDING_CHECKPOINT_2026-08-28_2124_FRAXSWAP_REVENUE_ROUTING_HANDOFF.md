# THE HOLDING — CHECKPOINT / NEXT-CHAT HANDOFF

Prepared: **2026-08-28 21:24 +03**  
Purpose: fast continuity checkpoint before chat-context exhaustion.  
Status: **handoff checkpoint, not canonical mutable truth**. New chat must re-resolve live state first.

## 0. IRON RESUME RULE

On takeover, do **not** trust SHAs/run numbers/numeric snapshots in this file as current merely because they are newer than older continuity. Resolve in this order:

`LIVE main → intelligence/project-memory/CURRENT.md → latest continuity named by CURRENT → Memory Routing Index → task-specific live artifacts → exact workflow evidence`.

Changing facts always come from live generated artifacts and GitHub evidence.

## 1. Fresh GitHub anchor at checkpoint creation

Repository: `TheHolding83888/TheHolding-site-1.32`  
Checkpoint branch: `checkpoint/fraxswap-revenue-routing-handoff-20260828-2124`

Fresh `main` observed immediately before this checkpoint:

- SHA: `3922e791e16d9733f532bc71a957d100c2448cc5`
- commit message: `intelligence: refresh progress telemetry`
- commit time: `2026-08-28T18:05:22Z`
- parent: `411205fb434df18358c3f59a8cffbec7bc85b310`

Live `CURRENT.md` at that moment represented canonical source state `2026-08-28T18:04:29.043Z` and still routed through:

- `THE_HOLDING_MASTER_CONTINUITY_2026-08-28_ORCHESTRATION_CURRENTNESS_FREEZE.md`
- `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`

Current machine state recorded by CURRENT at that moment:

- System Memory generatedAt: `2026-08-28T18:02:38.431Z`
- Permanent Memory Vault: 26 Observer records / 262 material events
- Cognitive Stack: WATCH; readyForManualInterpretation = true
- Security Sentinel: WATCH; Critical 0 / High 2 / Medium 20
- Grounded Brain: WATCH
- ChatGPT Bridge: WATCH; cases 11; evidence 26; `noExecution=true`
- Learning: READY; active cases 11; remembered cases 198; Brain observations 39; owner decisions 2; settled outcomes 0; lessons 0
- execution authority remains **none**

## 2. Control-plane / orchestration chapter remains CLOSED / FREEZE

Do **not** reopen generic orchestration work absent fresh evidence of a real defect.

Already closed before this checkpoint:

- canonical writer/currentness repairs;
- duplicate-writer problem;
- public currentness truthfulness repair;
- scoped recovery path;
- broad fan-out/control-plane redesign as a milestone requirement.

Do not add another scheduler, writer, watchdog, orchestrator, generic material gate, or broad cancellation authority merely to polish architecture.

Reopen only for fresh evidence of data corruption, repeated material reliability loss, unsafe authority behavior, repeated truthfulness failure, or material operational cost.

## 3. Strategic direction now

The project is intentionally moving from infrastructure work toward **economic observation depth**.

Long-term ladder:

`OBSERVE → CONNECT → REMEMBER → EXPLAIN → TEST → LEARN → MAP → CONVERSE`

Core doctrine: the system may be incomplete, but it must never pretend.

Protocol priority remains centered on the connected Frax/Curve/f(x)/Convex/Votium/Pendle/Yield Basis neighborhood. Aerodrome/Velodrome remain postponed pending Aero.xyz transition clarity.

## 4. Frax deep-sensor history already CLOSED before the latest atom

### sfrxUSD pilot

Earlier Frax sensor pilot was closed end-to-end:

- PR #437 — `intelligence: measure Frax sfrxUSD share price onchain`
- exact-block Ethereum ERC20/ERC4626 read-only state
- deterministic share-price reproduction from normalized `totalAssets / totalSupply`
- first checkpoint WARMING; no APY/history fabrication
- existing canonical Economic Graph writer only
- fail-closed UNKNOWN on source failure

Depth-aware compatibility repairs:

- PR #438 — recovery contract made depth-aware
- PR #439 — Explanatory inherits actual Frax depth
- PR #440 — Brain inherits actual Frax depth

Those atoms are CLOSED unless live regression is found.

## 5. Latest CLOSED atom — Fraxswap protocol-fee routing sensor

The newest completed work expanded Frax Economic Graph depth and then repaired a production-only serialization failure.

### Production sensor semantics

The sensor is deliberately mechanical and pair-local:

- reads Fraxswap Factory topology;
- reads current `feeTo`;
- distinguishes BAMM vs non-BAMM pair set where provable;
- observes protocol-fee LP mint proof events;
- keeps heterogeneous LP units pair-local rather than aggregating incompatible LP units;
- does **not** call `feeTo` a treasury, veFRAX distributor, revenue recipient in USD, or owner cash flow without further proof;
- no causal promotion;
- no execution authority.

### Physical production evidence after recovery

Fresh production Economic Graph after the hotfix was GREEN and physically materialized approximately:

- Fraxswap Factory pair count: **428**
- BAMM pairs: **220**
- non-BAMM pairs: **208**
- observed `feeTo`: **`0xd333…e65b`** (keep abbreviated here; resolve exact address from live artifact)
- in the published observation interval: **1 protocol-fee LP mint event / 1 pair** was observed
- Frax coverage moved to **4/9 MEASURED, 5/9 UNKNOWN**

Do not treat these numbers as timeless; verify live artifact on takeover.

### PR #448 — production serialization hotfix

PR: **#448**  
Title: `fix: serialize Fraxswap protocol fee proof events`  
Merged: `2026-08-28T17:59:39Z`  
Merge commit: `dbf04e371a73dae94bc5ff3ef9faca2fc3d6e8d7`

Root cause:

- internal protocol-fee event accounting correctly used `BigInt`/uint256 arithmetic;
- persisted event objects still contained BigInt values;
- production JSON serialization failed even though the economic methodology itself was valid.

Fix:

- preserve internal BigInt arithmetic;
- persist protocol-fee proof-event amount as canonical decimal string `valueRaw`;
- assert `JSON.stringify(measurement)` and full Graph-state serialization in the bounded Frax canary;
- no methodology/routing/authority/valuation/epistemic change.

After merge, automatic scoped recovery completed through the full downstream chain and **Intelligence Progress succeeded**.

## 6. Downstream inheritance proof is CLOSED

The post-#448 production chain was not accepted merely because workflows were green. Content inheritance was checked:

- Economic Graph: Frax **4/9 MEASURED / 5/9 UNKNOWN**
- Explanatory Context inherited the same depth and preserved causal/execution boundaries
- Brain inherited the same Frax depth
- Learning was exact-chain-bound to the new Brain state
- recovery then completed through Memory / Bridge / Learning / Proposal / continuity / project-memory / progress telemetry

Therefore the Fraxswap topology + fee-recipient/protocol-fee LP-mint atom is **CLOSED end-to-end**. Do not reopen it absent a fresh regression.

## 7. CURRENT ACTIVE OBJECTIVE AT HANDOFF

### Next atom: deepen `revenue-routing` mechanically from `feeTo`

The next step is **not** to jump to another protocol and not to label `feeTo` semantically from guesswork.

The live 9-surface Frax matrix still had five UNKNOWN directions visible at this checkpoint:

- Flox / FXTL
- FraxNet
- FXB
- FX-liquidity
- revenue-routing

Because `_mintFee → feeTo` is now physically observed, the smallest natural next atom is to continue the **revenue-routing** path.

### Exact audit question

Establish what happens to the LP units that are mechanically minted to `feeTo`.

Read-only target:

1. resolve exact live `feeTo` address from the production artifact;
2. inspect account/contract identity only from canonical/trusted evidence;
3. inspect pair-local LP balances at `feeTo`;
4. inspect LP transfers/outflows from `feeTo`;
5. inspect burns/redemptions or other mechanically provable realization events;
6. preserve exact chain/block/tx/log provenance;
7. separate accrued LP units from any later token redemption/value realization;
8. keep unexplained residual/state as UNKNOWN.

### Critical semantic guard

Do **not** call `feeTo` any of the following without direct evidence:

- treasury;
- protocol revenue wallet;
- veFRAX distributor;
- staker distributor;
- owner/company cash flow destination.

Official Frax material checked in the previous chat confirmed the Fraxswap Factory surface, but did **not** by itself provide a sufficiently strong public semantic label for the current `feeTo` address. Therefore the next atom must remain mechanical until identity/routing is proven.

### Implementation boundary at checkpoint

At this exact handoff boundary, the next revenue-routing atom is still in **read-only audit/design**. No new implementation PR after #448 had been created in this chat.

Preferred implementation only if the audit proves the smallest lawful measurement:

- reuse the existing Economic Graph workflow/writer;
- no new workflow/cron/orchestrator;
- exact block / exact logs where possible;
- deterministic canary;
- pair-local units;
- physical production artifact proof;
- downstream Explanatory → Brain → Learning proof if Frax depth changes.

## 8. Epistemic / methodology rules that must survive takeover

Keep these classes distinct:

- OBSERVED / MEASURED
- DERIVED / MECHANICAL
- ATTRIBUTED
- ASSOCIATED / CORRELATED
- PATTERN CANDIDATE
- PROSPECTIVE SUPPORT
- PROSPECTIVE COUNTEREVIDENCE
- FORWARD SIGNAL only where canon permits

Never silently promote:

- correlation → cause;
- pattern → prediction;
- measurement → recommendation;
- protocol revenue → owner cash flow;
- borrow rate → realized lender yield;
- LP-fee accrual → realized USD revenue;
- prospective support → policy.

`UNKNOWN != 0`. WARMING is valid. Do not fabricate historical backfill. Repeated snapshots are not independent periods.

## 9. Sensor engineering doctrine

For each new sensor atom:

1. reuse existing canonical writer where lawful;
2. reuse RPC/API/source infrastructure;
3. prefer deterministic read-only onchain state;
4. exact block/period identity where possible;
5. preserve provenance;
6. respect native cadence;
7. fail closed to UNKNOWN;
8. do not manufacture history from current state;
9. do not create protocol-wide metrics from market/pair-scoped facts;
10. do not expand authority.

Economic depth must grow faster than infrastructure complexity.

## 10. Exact resume order for the next chat

When the owner says to continue:

1. Read live `intelligence/project-memory/CURRENT.md`.
2. Fetch fresh `main` and compare with checkpoint SHA `3922e791...` only as a historical anchor.
3. Load the latest continuity named by CURRENT and the Memory Routing Index.
4. Confirm orchestration/currentness remains CLOSED/FREEZE absent fresh regression.
5. Confirm PR #448 remains merged and no rollback/newer Frax work supersedes this checkpoint.
6. Inspect the freshest Economic Graph artifact and resolve the exact current Frax 9-surface matrix.
7. Confirm latest Fraxswap Factory pair count, BAMM split, exact `feeTo`, protocol-fee LP-mint evidence, and publication interval.
8. Confirm Explanatory → Brain → Learning still inherit the fresh Graph state.
9. If a later checkpoint/PR already advanced revenue-routing, defer to live state and do not duplicate.
10. Otherwise resume the **feeTo LP holdings/outflow/redemption read-only audit**.
11. Choose the smallest mechanically provable atom.
12. Implement only through the existing Economic Graph writer if methodology expansion is not required.
13. Run bounded static/live/canary checks.
14. Require physical production artifact proof.
15. Require downstream inheritance proof if semantic depth changes.
16. Close that atom before widening scope.

## 11. Things NOT to do on takeover

- Do not restart generic orchestration/control-plane work.
- Do not create another Economic Graph writer.
- Do not create another scheduler/watchdog.
- Do not work Aero/Velodrome now.
- Do not build a new forecasting subsystem.
- Do not infer `feeTo` semantics from address appearance alone.
- Do not aggregate heterogeneous Fraxswap LP units into a fake global revenue number.
- Do not annualize or price flows without canonical methodology.
- Do not fabricate history.
- Do not weaken guards merely to make CI green.

## 12. Owner intent / working style relevant to this handoff

Default language: Russian.  
Work one primary objective at a time.  
Prefer systemic production-grade reusable solutions over patches.  
The owner explicitly wants deeper sensors and connected capital-flow understanding, but without turning the system into a pile of workflows or speculative narratives.

The target is increasingly a truthful economic map: where capital is, where it moves, who paid whom, what changed, what can be mechanically explained, what remains UNKNOWN, and later what patterns survive prospective testing.

---

**Checkpoint boundary:** Fraxswap protocol-fee routing atom CLOSED end-to-end; next active atom is mechanical `feeTo` revenue-routing audit. Re-resolve all live facts before changing anything.