# THE HOLDING — MASTER CONTINUITY CHECKPOINT
## 2026-08-21 17:54 (+03)
## MARKET DATA / ONCHAIN AUTHORITY PRODUCTION GREEN · AUG 19–21 CONTINUITY CLOSE

> This is the new primary deep resume checkpoint after the 2026-08-19 through 2026-08-21 production work. It supersedes the 2026-08-18 Project X + HyperLend checkpoint as the first human-readable continuity file for new sessions, while preserving all earlier durable laws and task-specific canons.
>
> It is intentionally detailed. Changing production facts, current prices, current workflow states and current Security counts must always be re-fetched from live GitHub `main` and fresh generated artifacts. This document preserves architecture, proven invariants, failure lessons, production milestones and exact resume semantics — not a frozen price feed.

---

# 1. NEW-CHAT RESUME CONTRACT

Repository:
`TheHolding83888/TheHolding-site-1.32`

Default branch:
`main`

Canonical retrieval path:

`CURRENT → latest continuity → Memory Routing Index → task-specific canon/context → live artifact → exact evidence`

Mandatory order for a substantive new The Holding chat:

1. Fetch live `intelligence/project-memory/CURRENT.md` from fresh `main`.
2. Read the latest `THE_HOLDING_MASTER_CONTINUITY_*.md` linked by CURRENT — after this memory upgrade, that should be this file.
3. Read `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`.
4. Read `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`.
5. Read `THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md` and select only the durable blocks relevant to the task.
6. For Market Data / prices / Public Capital / TVL propagation, read `THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md` plus the live generated artifacts.
7. Fetch fresh workflow/commit evidence where physical production completion matters.

Do not mechanically read every historical checkpoint. The Routing Index exists to avoid both memory loss and context pollution.

Fresh `main` observed immediately before this memory branch was created:
`f3cbc00cd971662be2d874f3f3f3dffd2ac33538`
message:
`memory: refresh current project bootstrap`

Its parent is the post-#233 shared Market Data heartbeat that physically materialized the final truthful-provenance snapshot. This SHA is a time-stamped anchor only; autonomous writers can move `main` after this checkpoint.

---

# 2. PROJECT IDENTITY / AUTHORITY BOUNDARY

The Holding is a:

**Capital Operating System + persistent intelligence, memory and governance layer for sovereign onchain companies and funds.**

Canonical long-loop:

`OBSERVE → REMEMBER → UNDERSTAND → REPORT → RECOMMEND → ACT → MEASURE → LEARN`

Current authority boundary remains:

`executionAuthority = none`

No current autonomous layer may:
- sign a wallet transaction;
- execute a blockchain transaction;
- move capital;
- claim/harvest/reinvest automatically;
- merge or release production code automatically;
- mutate financial methodology automatically;
- mutate security policy automatically;
- convert inferred owner intent into production authority.

Build law:
- capability must grow faster than complexity;
- authority must grow slower than intelligence;
- one canonical truth plane per economic fact;
- systemic reusable fixes are preferred to one-off patches;
- production proof outranks architecture theatre.

---

# 3. CORE EPISTEMIC / ACCOUNTING LAWS — PRESERVE

These remain hard system laws:

1. **unknown != zero**
2. **partial != total**
3. **Reference APR/APY != realised income**
4. **claimable reward != realised cash flow**
5. **embedded/Compounded income != claimable reward**
6. **wrapper/LP decomposition != additive capital**
7. **owner context != market fact**
8. **hypothesis != causality**
9. **proposal != decision**
10. **decision != successful outcome**
11. **fresh production evidence outranks prose memory**
12. **GREEN workflow != physically materialized production artifact**
13. **generic implementation permission != merge permission**
14. **resolver completeness != promotion completeness**
15. **enumerable object inventory != economic strategy inventory**
16. **rate parameter != yield**
17. **source-lane health telemetry != production authority unless the selector contract says so**
18. **a fallback source that is too old is not a usable price**
19. **canonical provenance must describe the selected production plane, not merely the fallback source lane from which the object was seeded**
20. **one subsystem must not silently rewrite another subsystem's canonical artifact**

---

# 4. MERGE / PRODUCTION GOVERNANCE

Normal merge governance is active.

`делай / продолжай / ок делай / работай` authorizes implementation, branch and PR preparation only. It does **not** authorize merging a new PR.

Every production PR requires:
1. fresh `main`;
2. fresh PR metadata;
3. exact current head SHA;
4. exact-head CI evidence;
5. intended file/scope inspection;
6. fresh explicit owner merge command naming that PR;
7. merge with `expected_head_sha`;
8. post-merge verification;
9. where generated artifacts matter, physical materialization in `main`.

The old task-scoped onchain-shadow completion campaign exception is closed. Per-PR authorization is the current rule.

Open canary PR #37 remains a `never merge` proof artifact and must never be merged.

---

# 5. 2026-08-18 CONTINUITY PRESERVED: PROJECT X + HYPERLEND CLOSED

The previous deep checkpoint remains valid historical/durable context. The following must not be lost:

## Project X

Project X · WHYPE-USDC is one economic strategy built from an enumerable concentrated-liquidity NFT set.

Permanent law:
`enumerable NFT inventory != economic strategy inventory`.

Admission remains economic, not merely enumerable:
- exact intended pair;
- nonzero liquidity;
- measured principal;
- NAV >= $1;
- relevant nonzero-liquidity unresolved principal fails closed;
- zero-liquidity/dust/other-pair objects remain diagnostics only.

PR #226 removed the stale assumption that the active set is permanently exactly two NFTs. The active set is now dynamic. Strategy NAV and WHYPE + USDC collectible fee legs aggregate the current admitted set once.

PR #229 made Project X Reference APR active-set aware:
- any nonempty economically active set is valid input;
- fingerprint includes active token IDs, liquidity and ticks;
- membership/count/position changes reset the observation window;
- minimum stable observation window remains 24h;
- trailing window remains bounded to 7d;
- collectible-fee decrease resets/warm-starts;
- fee tier is never treated as APR.

## HyperLend

Durable semantic sentence preserved exactly:

**HyperLend base lending interest = Compounded / Embedded.**

Receipt-token balance/index growth is already inside the economic position and is not separately claimable or additive TVL. External incentives are a separate RewardsController lane. A controller existing does not prove active incentives; `rewardAssetCount = 0` means no separate incentive row, not a fabricated zero-value reward.

---

# 6. VLCVX / DELEGATION ROUTING — FULL-REGISTRY KNOWLEDGE

PRs #146–#149 promoted vlCVX from a flat reward label into a reusable route graph.

Canonical route concept:

`vlCVX principal → current delegation/management route → forwarding/settlement → payout assets`

Historical residuals are separately modeled:

`historical route → still-unclaimed rewards → legacy-residual`

Durable current route precedents established in the full-registry audit:
- #002 YieldRing.eth → `Votium + Union · vlCVX` → Union settlement into scrvUSD;
- #004 Defitea → current `Votium + Union · vlCVX` plus separately preserved direct Votium residuals;
- #007 Rook's portfolio → Convex Finance vlCVX; current settlement may remain Pending while historical Votium residuals remain visible;
- #010 Cypher → `Stake DAO · vlCVX` with read-only current entitlement proof.

The Union scrvUSD route is not valued by pretending one share = $1. The specialized distributor receives crvUSD and pays scrvUSD vault shares; valuation uses ERC-4626 conversion into crvUSD plus dynamic crvUSD pricing.

A Merkle claim proves claim inventory, not current delegation identity. Current route identity requires current delegation + forwarding/settlement evidence.

Dedicated durable canon remains:
`THE_HOLDING_VLCVX_ROUTE_GRAPH_CANON_2026-08-18.md`.

---

# 7. PASSPORT / REWARDS PRESENTATION PARITY

PRs #150–#158 closed a broad class of public-presentation drift.

Durable naming contract:

`Protocol · productive asset / strategy`

Examples include:
- Aerodrome · veAERO
- Velodrome · veVELO
- Curve · veCRV
- Frax · veFRAX
- Yield Basis · veYB
- Pendle · sPENDLE
- Venice · sVVV
- Resupply · staked RSUP

The public adapter must not downgrade a known productive identity to a generic protocol label when canonical Rewards/Balance Sheet data already knows the productive mechanism.

`THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md` makes this a future Company #011+ inheritance rule.

PR #158 added the Public Surface Privacy Guard so browser-facing text assets are checked for repository-owner/developer identity leakage, private local paths and non-allowlisted emails. This is defensive presentation/privacy scope, not economic methodology.

---

# 8. YIELDRING / UNIFIED CAPITAL / DEFITEA COHERENCE

## YieldRing

PR #159 added current YieldRing capital lots and veAERO Maxi relay metadata. Durable quantities at that owner-update checkpoint:
- BTC 0.0334
- AERO 678

Two managed Aerodrome locks remain one economic veAERO position for aggregation.

PRs #160–#162 exposed a workflow lesson: a correct source update is not production-complete until all downstream generated artifacts physically materialize. Productivity overlay ordering also matters.

Proven compatible chain at that time:
`base collector v1.15 → Company #010 compatibility v1.16 → YieldRing overlay`.

## Unified Capital

PR #163 replaced the fragile internal Projector → Productivity → Capital State workflow domino with one coherent capital refresh orchestrator reusing existing engines. Legacy standalone flows remain recovery paths, not a second normal orchestration graph.

Later, PR #227 further narrowed authority: Unified Capital is a **consumer of canonical Market Data**, never a canonical Market Data writer.

## Defitea

PR #164 established the owner-supplied 11-position canonical productive inventory update including:
- veAERO 2632; new lot +192 @ $0.42; total AERO basis $1,121.30;
- veFXN 64.81; new lot +5 @ $16.50; total FXN basis $983.2386.

Do not treat these prose values as live prices; they are durable quantity/cost-basis inputs from that capital update.

---

# 9. SHARED MARKET DATA / PUBLIC CAPITAL FOUNDATION

PR #165 introduced the central shared Market Data / Public Capital architecture.

The key architectural goal was to stop individual public surfaces and backend consumers from independently discovering the same market prices.

Canonical surfaces:
- `intelligence/market-data/market-data.json` — selected canonical market-price state;
- `intelligence/market-data/market-data-coingecko.json` — isolated CoinGecko source/fallback lane;
- `intelligence/market-data/onchain-price-shadow.json` — onchain observation evidence;
- `intelligence/market-data/public-capital-state.json` — current shared public capital projection.

The public browser client loads local canonical snapshots and intercepts legacy simple-price/CoinGecko-compatible requests locally. Browser external market-price authority is disabled.

Public Capital is the fast current market-priced projection plane. Reporting remains historical/cash-flow authority, not current valuation authority. Stable/wrapper/protocol NAV remains upstream where market repricing would be economically wrong.

Durable owner corrections included in the shared-capital migration:
- Fructus ONDO = 542;
- Singul ELIZA = 80,808;
- DBCon and COPXon excluded from Fructus calculations.

---

# 10. ONCHAIN MARKET DATA CAMPAIGN — SHADOW TO 27 LIVE OBSERVATIONS

PR #168 began the zero-paid-data onchain shadow migration with a provider-agnostic resolver and public-RPC failover.

The campaign deliberately separated **observation quality** from **production authority**. Shadow routes were proven before promotion.

Final observation universe:
- 26 canonical market assets;
- + physical silver as a special reference-only onchain observation;
- total 27 observation targets.

Reusable route families proven during the campaign:
- direct Chainlink v3 USD feeds;
- relative Chainlink composition such as CVX/ETH × same-cycle ETH/USD;
- Velodrome V2 protocol-native observation TWAP;
- Uniswap V3 block-pinned `observe()` TWAP relative routes;
- Curve `price_oracle()` EMA relative routes;
- Uniswap V2 historical cumulative-price TWAP relative routes;
- DEX TWAP × independently validated Chainlink quote routes;
- bounded route overrides for replacing a weaker historical source without mutating the entire base registry.

Permanent safety constraints:
- no DEX spot-price authority;
- no hardcoded stablecoin $1 peg where a quote feed is required;
- public RPC / no paid API requirement;
- no signing or transaction submission;
- block-coherent reads where multi-phase route discovery/observation is used;
- same-cycle quote dependencies for relative routes.

Important resilience lessons:
- HTTP 200 does not mean JSON-RPC success; retryable per-call rate-limit/upstream errors must fail over the entire endpoint attempt;
- contract-specific/non-retryable errors should remain isolated to the affected route;
- Uniswap V3 `OLD` means the requested historical observation window is unavailable, not permission to fall back to spot pricing;
- route-specific historical limitations can justify a safer bounded window or a different proven oracle mechanism;
- MODE was moved away from stale Pyth stored state to Velodrome TWAP;
- FXN moved from flaky V3 history to Curve EMA;
- YB moved to Curve EMA + crvUSD Chainlink quote;
- OLAS uses historical V2 cumulative TWAP;
- BEAM uses a live-proven V3 route;
- ELIZA uses adaptive Pancake V3 TWAP with a hard safety floor and Chainlink USDC/USD quote.

By #198 the full read-only observation layer was physically production-proven across all 27 targets.

---

# 11. PER-ASSET PRODUCTION AUTHORITY — 26/26 ONCHAIN PRIMARY

PR #199 created a dry-run authority framework.
PR #200 separated the CoinGecko source lane from canonical selected Market Data.
PRs #201–#215 progressively promoted proven routes.

Final explicit onchain-primary canonical universe = 26 assets:

BTC, ETH, XAUT, AERO, CVX, CRV, PENDLE, FXN, ICP, YB, FXS, VELO, VVV, LQTY, RSUP, MANA, SAND, OVR, OLAS, VIRTUAL, BEAM, MODE, ELIZA, ONDO, ZK, cvxCRV.

Physical silver remains reference-only and is not silently promoted into the canonical asset registry.

The policy remains per-asset and bounded. Automatic cohort expansion/policy self-mutation is forbidden.

Production selector order is conceptually:

`requested onchain primary → eligible onchain route → bounded CoinGecko failback → unknown`

Unknown is terminal truth when no eligible lane exists; it is never converted to zero.

---

# 12. CADENCE — 30-MINUTE ONCHAIN + DAILY COINGECKO

The owner explicitly selected the operational cadence:

Onchain shared Market Data heartbeat:
`7,37 * * * *`

Dedicated automatic CoinGecko baseline:
`12 3 * * *`
= 03:12 UTC daily.

PR #214 separated the two schedules.
PR #216 hardened the engine itself so CoinGecko external discovery occurs only when `MARKET_DATA_DAILY_REFRESH=true`.

Therefore normal scheduled Shared Refresh, source-change push refresh and manual Shared Refresh reuse the last daily CoinGecko source snapshot with **zero external CoinGecko price requests**.

The daily CoinGecko workflow performs one batch request for the canonical 26 assets and remains fallback/sanity input.

GitHub Actions cron is best-effort; `:07/:37` is the intended cadence, not a hard real-time SLA.

Automatic architecture is once-daily CoinGecko. A privileged operator manually dispatching the dedicated daily workflow is a separate control-plane action and should not be confused with automatic cadence.

---

# 13. CONTROL-PLANE NOISE SUPPRESSION

A 30-minute Git writer can create up to 48 generated-state commits/day. That must not wake expensive/unnecessary control-plane observers on every pure snapshot update.

PR #217 added push-ignore hygiene for these generated files:
- `intelligence/market-data/market-data-coingecko.json`
- `intelligence/market-data/market-data.json`
- `intelligence/market-data/onchain-price-shadow.json`
- `intelligence/market-data/public-capital-state.json`

Project Memory keeps its hourly backstop at minute 17.
Security keeps its independent backstop.

Important boundary: Market Data **code, workflow, policy and registry changes remain observable**. Only generated snapshot-only churn is suppressed.

---

# 14. PUBLIC SURFACE / COMPANY METRICS COHERENCE

PR #218 removed hardcoded Monetra homepage values and bound homepage Monetra capital to canonical Stable Capital state.

PR #225 fixed `/companies/` summary semantics:
- **Combined TVL** = all 10 registered companies from fresh shared Public Capital;
- **General Index · Network Value** = 9 General Index companies;
- Monetra remains a separate Stable Capital universe;
- Company #010 must not overwrite fast public metrics from slower Capital State;
- current full-registry Protocols & Assets union stabilized at 29 at that checkpoint.

These are semantic universes, not two aliases for the same number.

---

# 15. THE PARANOID AUDIT — WHY IT MATTERED

The owner explicitly requested a final unusually deep audit rather than accepting green CI at face value. That audit was materially useful and found multiple hidden failure classes after the first apparent success.

## PR #227 — second writer discovered

Root cause:
Unified Capital still executed a legacy Market Data writer and could overwrite a correct 26-asset onchain snapshot with an older CoinGecko mirror.

Fix:
- Unified Capital became Market Data consumer-only;
- it cannot stage/commit canonical `market-data.json`;
- it requires a 26/26 onchain-selected canonical snapshot before rebuilding downstream capital;
- CI proves Market Data bytes are preserved;
- ICP parity for #005/#006 became an explicit runtime guard.

Durable lesson:
**artifact ownership must be exclusive; downstream consumers must not regenerate upstream truth.**

## PR #228 — manual recovery writer/call paths

Deep audit then found residual recovery paths:
- Productivity recovery could still write Market Data;
- Capital recovery could still make a direct CoinGecko price request.

Fix:
- recovery paths consume canonical Market Data only;
- compatibility shim serves legacy calls from local canonical data;
- recovery fails closed unless canonical Market Data is 26/26 onchain-selected;
- General Company Balance Sheet reads canonical Market Data with truthful provenance.

Durable lesson:
**normal-path architecture is not complete until recovery paths obey the same authority boundary.**

## PR #230 — false failback from stale daily sanity reference

The first physically restored heartbeat after #228/#229 was only 24/26 onchain. BTC and VVV fell back because their fresh onchain prices had materially moved from the older daily CoinGecko snapshot.

This was not route failure. It was stale cross-source comparison being treated as health authority.

Fix:
- cross-source divergence remains visible telemetry;
- a structurally valid fresh onchain route does not lose production authority solely because it diverges from the older daily CoinGecko reference;
- real stale/invalid/RPC/source/quote/dependency failures still fail back.

Durable lesson:
**sanity divergence is evidence, not automatically failure.**

## PR #231 — materializer preempted selector

After #230, production still exposed a mismatch: materializer treated dynamic `dependencyStatus` as immutable route identity and could crash the whole cycle before the selector applied the new health semantics.

Fix:
- materializer validates static route identity;
- selector owns dynamic route health/failback;
- divergence keeps onchain authority;
- genuine dependency failure performs bounded per-asset failback instead of crashing the full cycle.

Live verifier was aligned to allow only bounded divergence warnings with finite positive onchain values; RPC/invalid/unavailable remains failure.

Durable lesson:
**dynamic health belongs in the authority selector, not static identity validation.**

## PR #232 — stale fallback age hole

Further deep audit found a rare compound failure mode: if the daily CoinGecko refresh stopped and an onchain route later genuinely failed, an old CoinGecko price could theoretically remain eligible too long.

Fix:
- CoinGecko failback is usable only while source age <= 30 hours;
- exactly 30h is accepted by deterministic boundary proof;
- >30h becomes `unknown` / fail-closed;
- no extra CoinGecko request is triggered.

Durable lesson:
**fallback availability must include freshness, not merely a positive numeric value.**

## PR #233 — truthful canonical provenance

Final deep audit found a metadata-only but real semantic defect. Prices were already 26/26 onchain, but top-level canonical JSON inherited CoinGecko source-lane fields such as provider identity and stale source timestamps.

Fix:
- top-level canonical provider = `per-asset-authority`;
- canonical requestedAt/observedAt bind to the current onchain Shadow observation;
- `coinGeckoExternalRequestCountThisMaterialization = 0` on non-daily canonical materialization;
- daily CoinGecko provenance remains honestly preserved under `sourceState` for auditing/failback.

Durable lesson:
**provenance is part of correctness. A correct price with misleading authority metadata is still an integrity defect.**

---

# 16. FINAL MARKET DATA / ONCHAIN PRODUCTION ACCEPTANCE

Targeted Market Data/onchain block is now **PRODUCTION GREEN** after post-#233 physical materialization.

Final post-#233 physical heartbeat:
- shared snapshot commit message: `market data: refresh shared public snapshot`;
- generatedAt: `2026-08-21T14:44:47.387Z`;
- Shadow observation timestamp: `2026-08-21T14:44:44.200Z`.

The final canonical snapshot physically proved:
- version `1.2-market-data-truthful-canonical-provenance`;
- status `ok`;
- provider `per-asset-authority`;
- canonical requestedAt/observedAt bound to current Shadow time;
- 26 requested assets;
- 26 fresh assets;
- staleFallbackCount 0;
- unknownCount 0;
- freshCoverage 1;
- usableCoverage 1;
- non-daily CoinGecko external request count 0;
- every canonical asset remains requested onchain-primary;
- current canonical rows are selected onchain with finite positive prices;
- execution authority remains none.

Multiple independent post-#232 heartbeats before #233 had already demonstrated stable 26/26 onchain authority and zero selected CoinGecko/fallback/unknown. #233 closed the last provenance defect and the post-merge heartbeat proved the fix physically.

Therefore the correct targeted conclusion is:

**Market Data / onchain tracking: fat check ✅**

Do not generalize this into “the entire repository can never have another bug”. Broader Security and other subsystems retain their own current states and must be assessed from fresh artifacts.

---

# 17. ICP / COMPANY #005 / COMPANY #006 INVARIANT

ICP canonical market route is onchain Chainlink v3 on BNB Smart Chain (chainId 56).

Durable quantities:
- Company #005: 1363 ICP;
- Company #006: 1296 ICP.

Both companies must use the **same current canonical ICP price** from shared Market Data. Unified Capital/recovery guards explicitly verify this parity.

Do not store a prose ICP price as a permanent fact; fetch the live canonical value. At the final #233 heartbeat the canonical ICP row was again onchain and fresh, proving the lane remained healthy.

---

# 18. CANONICAL MARKET DATA AUTHORITY CONTRACT

For future work, the short version is:

1. One canonical selected Market Data artifact.
2. Exactly 26 canonical market assets, all explicitly reviewed onchain-primary.
3. Physical silver is special reference-only.
4. One canonical Market Data writer plane.
5. Capital, Productivity recovery and other downstream systems are consumers, not second writers.
6. Onchain heartbeat: `7,37 * * * *`.
7. Automatic CoinGecko baseline: `12 3 * * *`.
8. Normal heartbeat does not externally fetch CoinGecko.
9. CoinGecko is sanity/failback, not normal price authority.
10. Cross-source divergence alone is telemetry when the onchain route is otherwise healthy.
11. Real route health failures may fail back per asset.
12. CoinGecko failback older than 30h is forbidden; use unknown/fail-closed.
13. Canonical top-level provenance describes selected per-asset authority; source-lane provenance lives under source state.
14. Browser does not own external market-price discovery.
15. High-frequency generated snapshots do not wake Project Memory/Security push-trigger noise.
16. GREEN CI is not final proof until the generated artifact physically materializes.
17. `unknown != zero`.
18. `executionAuthority = none`.

Full durable canon:
`THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md`.

---

# 19. CURRENT PROJECT MEMORY ARCHITECTURE

The Holding project memory remains layered rather than one giant file.

## Tier 1 — Current operational memory
- `intelligence/system-memory.json`
- `intelligence/change-intelligence.json`
- `intelligence/change-history.json`

## Tier 2 — Permanent Memory Vault
- `intelligence/memory-vault/YYYY/MM/*.json`
- manifest
- corrections ledger

Append-only factual Observer history.

## Tier 3 — Cognitive / experience memory
- Brain history
- ChatGPT Bridge history
- Decision Ledger
- Learning state
- Proposal / Builder / Guardian states

## Tier 4 — Human continuity / canons
- `CURRENT.md`
- latest master continuity — this file after merge
- Owner Collaboration canon
- Build Discipline canon
- Memory Routing Index
- Known Mechanism Reuse canon
- Passport inheritance/responsive canons
- Rewards canon
- vlCVX route canon
- new Market Data/onchain authority canon
- historical operating knowledge
- owner operating context / founder decision DNA
- production incident/security canons.

Canonical retrieval remains selective:

`CURRENT → continuity → router → relevant canon → live artifact → exact evidence`

CURRENT should remain compact. Deep continuity belongs here; task law belongs in specialized canons; changing numbers belong in machine-readable state.

---

# 20. MEMORY / SECURITY GENERATED-NOISE RULE

The high-frequency Market Data generated files are intentionally ignored by Project Memory and Security push triggers. This does **not** mean Market Data changes are invisible.

Pure generated-state heartbeat commits are suppressed from control-plane wakeups.

Market Data engine/workflow/policy/registry changes still trigger normal review, while Project Memory retains an hourly backstop.

This is an important operational distinction for future models: do not “fix” the quiet push behavior by reintroducing up to 48 redundant memory/security wakeups per day.

---

# 21. WHAT A FUTURE CHAT SHOULD DO FOR MARKET DATA QUESTIONS

If asked:
- “все активы onchain?”
- “почему CoinGecko?”
- “что с 30-минутным трекингом?”
- “почему TVL не совпадает?”
- “какая сейчас цена ICP/BTC/VVV?”
- “не откатился ли writer?”

Read:
1. CURRENT;
2. this continuity;
3. Market Data/onchain canon;
4. live:
   - `market-data.json`
   - `onchain-price-shadow.json`
   - `market-data-coingecko.json`
   - `public-capital-state.json`;
5. relevant Market Data/Capital workflows and exact recent heartbeat commits.

Never answer current price/runtime status from this prose checkpoint alone.

---

# 22. REMAINING BROADER PROJECT BOUNDARIES

The Market Data/onchain block is green, but The Holding as a whole remains an evolving system.

Security Sentinel has its own current WATCH state and should be read fresh. Known noncritical/high/medium watch items elsewhere in the repository are not erased by this Market Data close.

Likewise Company Productivity, Rewards, Learning, Proposal, Builder, Guardian and public UI have separate acceptance states and histories.

Do not use “Market Data production green” as evidence that every unrelated subsystem is perfect.

---

# 23. EXACT RESUME POINT AFTER THIS MEMORY UPGRADE

At memory-branch creation:
- PR #233 had merged successfully;
- final post-#233 Market Data heartbeat had physically materialized;
- target Market Data/onchain production acceptance was green;
- current project memory bootstrap still linked the 2026-08-18 deep continuity, creating the gap this update is intended to close.

The memory-upgrade branch is:
`memory/project-continuity-2026-08-21-onchain-green`

This checkpoint must not be assumed production until its memory PR is explicitly merged by the owner and CURRENT is verified on fresh `main` afterward.

After merge, the next new-chat warm-up should be able to recover:
- the Aug 18 Project X/HyperLend base;
- vlCVX routing and Passport inheritance;
- YieldRing/Unified Capital/Defitea production coherence;
- the full shared Market Data architecture;
- the complete onchain route/promotion campaign;
- the cadence split and control-plane noise rules;
- the full #227–#233 paranoid-audit failure chain;
- the final 26/26 truthful-provenance production-green contract;
- the remaining no-execution and per-PR merge boundaries.

The model can change. **The memory must remain The Holding's.**
