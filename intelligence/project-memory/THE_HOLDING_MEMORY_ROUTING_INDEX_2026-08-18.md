# THE HOLDING — PROJECT MEMORY ROUTING INDEX
## 2026-08-18 · task-aware retrieval map · updated 2026-08-21

> Purpose: give every new chat/model a deterministic answer to **“what project memory should I read for this exact kind of work?”** without forcing it to load every historical file.
>
> This file is routing metadata, not a source of changing production truth. Fresh `main`, fresh generated artifacts and exact workflow evidence always outrank prose memory.

---

# 1. THE MEMORY MODEL

The Holding continuity system is layered:

1. **`CURRENT.md`** — compact bootstrap and fresh subsystem summary.
2. **Latest `THE_HOLDING_MASTER_CONTINUITY_*.md`** — deep current-state checkpoint and exact resume point.
3. **Task-specific canons / context blocks** — durable knowledge loaded only when relevant.
4. **Machine-readable subsystem state** — current economic/security/cognitive truth.
5. **Permanent Memory Vault + Git history** — factual/history evidence for archaeology.

Canonical flow:

`CURRENT → latest continuity → ROUTING INDEX → relevant memory blocks → relevant live artifacts → exact evidence → work`

Selective retrieval is a feature. Do not replace it with “read everything”.

---

# 2. ALWAYS-READ CORE

For every substantive The Holding task, read:

1. `intelligence/project-memory/CURRENT.md`
2. latest `THE_HOLDING_MASTER_CONTINUITY_*.md` referenced by CURRENT
3. `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`
4. `THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`
5. this Routing Index

Then choose only the blocks below that match the work.

---

# 3. COMPANY ONBOARDING / NEW COMPANY / NEW WALLET

Trigger examples:
- “добавляем компанию #011”
- discovery / resolve / closure / reconciliation
- new wallet or ENS
- mechanism inventory

Read:
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`
- latest company-specific continuity if present
- onboarding playbooks
- live company/Productivity/Rewards state

Hard rule: **fingerprint known mechanisms before writing new protocol code.** Reuse the strongest proven end-to-end capability and resolve only the true delta.

---

# 4. COMPANY #010 / CYPHER

Trigger examples:
- Cypher Passport
- Company #010 TVL/capital/Performance
- Project X, HyperLend, GMX, Stake DAO, Concentrator, Convex, veAERO, veVELO, vlCVX

Read:
- latest master continuity
- Known Mechanism Reuse canon
- Rewards Drawer canon
- Passport Responsive canon
- live `companies/company-010-production-state.json`
- live `companies/rewards-data.json`
- live Productivity state
- `companies/company-010-projectx-rate-history.json`

Do not substitute old Company #010 checkpoints for fresh state.

---

# 5. PROJECT X / NFT LP / MULTI-LEG STRATEGIES

Trigger examples:
- Project X · WHYPE-USDC
- concentrated-liquidity NFTs
- dynamic active NFT set
- collectible fees
- Project X Reference APR

Read:
- latest continuity, Project X sections
- Known Mechanism Reuse canon
- Rewards Drawer canon
- live Company #010 state
- Project X rate history
- current Project X resolver/overlay/rate sources

Permanent lessons:
- enumerable NFT inventory != economic strategy inventory;
- zero-liquidity/dust/other-pair NFTs may stay diagnostic but are not strategy TVL/Rewards;
- nonzero-liquidity unresolved principal fails closed;
- all in-scope economic legs must be promoted or explicitly unknown;
- fee tier is not yield;
- collectible fees are rewards, not principal;
- observed-fee APR requires stable fingerprint continuity;
- active-set membership/liquidity/tick change resets the observed-fee window.

---

# 6. HYPERLEND / AAVE-LIKE LENDING

Read:
- latest continuity, HyperLend section
- Known Mechanism Reuse canon
- Rewards Drawer canon
- live Company/Rewards state
- `onboarding/company-010-hyperlend-income-overlay.mjs`

Canonical distinction:
- **base lending interest** from scaled balance + reserve liquidity index = **Embedded / Compounded**;
- **external incentives** are separate RewardsController state;
- controller existence does not prove active rewards;
- `rewardAssetCount = 0` means no separate incentive row, not fake zero;
- Reference APR is a rate, not realised earned USD.

---

# 7. REWARDS / VLCVX / ACCRUED REWARDS DRAWER

For generic Rewards read:
- Rewards Drawer canon
- Passport Inheritance canon
- Known Mechanism Reuse canon
- latest continuity
- live `companies/rewards-data.json`

For vlCVX routing additionally read:
- `THE_HOLDING_VLCVX_ROUTE_GRAPH_CANON_2026-08-18.md`
- fresh delegation/forwarding/settlement evidence when current route identity matters.

Hard lanes:
- Unclaimed = separately claimable current accrual;
- Compounded/Embedded = remains inside strategy economics and is not claimable total;
- Pending/Warming = known mechanism not currently closed;
- legacy-residual route != current delegation route;
- Merkle entitlement != proof of current delegation identity.

---

# 8. PRODUCTIVITY / APR / APY / REFERENCE RATE

Read:
- latest continuity
- live Productivity state
- source-specific history
- Passport Responsive canon
- Known Mechanism Reuse canon

Laws:
- Reference APR/APY != realised income;
- unsupported/missing rate = Pending, not 0;
- fee tier/nominal parameter != yield;
- rate must have reproducible source and explicit metric semantics.

---

# 9. PERFORMANCE / COST BASIS / INVESTED / RETURNS

Read:
- latest company continuity
- live company performance ledger
- contribution/distribution histories
- owner context only where owner-declared basis/intent is relevant.

Hard rules:
- partial cost basis != complete performance;
- unknown entry != zero cost;
- internal wrapper/LP movement is not automatically contribution/distribution.

---

# 10. PASSPORT UI / MOBILE / DESKTOP

Read:
- Passport Responsive canon
- Company Passport Inheritance canon
- latest continuity
- Rewards Drawer canon if touched
- current public adapter / `companies/index.html`

Hard rules:
- preserve accepted desktop during mobile-only fixes unless asked otherwise;
- productive identity uses the strongest canonical `Protocol · productive asset/strategy` language;
- public adapter projects canonical economic state, not a second truth.

---

# 11. STABLE CAPITAL / MONETRA / STABLE INDEX

Read:
- latest continuity
- live Stable/Monetra artifacts
- Historical Operating Knowledge when mechanism reuse matters
- owner context only for strategy philosophy.

Preserve Monetra tracking provenance. Do not backfill earlier income without explicit evidence/methodology.

---

# 12. MARKET DATA / ONCHAIN PRICING / PUBLIC CAPITAL / COINGECKO FALLBACK

Trigger examples:
- “все активы onchain?”
- BTC / ICP / VVV / XAUT current price source
- CoinGecko fallback / why CoinGecko appears
- 30-minute price refresh
- Market Data heartbeat RED/GREEN
- Public Capital / company TVL price propagation
- second writer / stale snapshot / provenance
- `market-data.json`, `onchain-price-shadow.json`, `public-capital-state.json`

Read:
1. latest master continuity, especially the Aug 19–21 Market Data sections;
2. **`THE_HOLDING_MARKET_DATA_ONCHAIN_AUTHORITY_CANON_2026-08-21.md`**;
3. live:
   - `intelligence/market-data/market-data.json`
   - `intelligence/market-data/onchain-price-shadow.json`
   - `intelligence/market-data/market-data-coingecko.json`
   - `intelligence/market-data/public-capital-state.json`;
4. current authority policy/source registries when route identity matters;
5. current Shared Refresh / daily CoinGecko / Unified Capital / recovery workflows when writer or cadence matters;
6. fresh heartbeat commits and exact workflow logs for production acceptance.

Canonical production laws:
- exactly 26 canonical market assets are explicitly reviewed onchain-primary;
- physical silver is reference-only, outside the canonical 26;
- one canonical Market Data writer plane;
- downstream Capital/Productivity/recovery paths are consumers, not alternate writers;
- onchain heartbeat = `7,37 * * * *`;
- automatic CoinGecko baseline = `12 3 * * *`;
- normal Shared Refresh performs zero external CoinGecko discovery and reuses the daily source lane;
- CoinGecko is fallback/sanity, not normal authority;
- cross-source divergence against the daily CoinGecko snapshot is telemetry only when the onchain route is otherwise healthy;
- real RPC/stale/invalid/source/quote/dependency failures remain failback conditions;
- CoinGecko failback is eligible only while age **<= 30 hours**; older means unknown/fail-closed;
- canonical top-level provenance must describe `per-asset-authority`, while CoinGecko provenance belongs under source state;
- browser external price authority is disabled;
- `unknown != zero`;
- `GREEN workflow != physically materialized production artifact`.

For ICP specifically, verify Company #005 (1363 ICP) and #006 (1296 ICP) use the exact same current canonical onchain price.

Do not answer a current price from prose memory. Fetch the live artifact.

---

# 13. COGNITIVE STACK / BRAIN / OBSERVER / MEMORY / LEARNING

Read:
- CURRENT
- latest continuity
- Build Discipline canon
- live subsystem states
- Historical Operating Knowledge when architecture history matters
- Founder DNA only when founder-model alignment matters.

Distinction:
standalone fresh subsystem state may be newer than the exact state bound into a coherent Cognitive Stack packet. Preserve coherent-chain provenance.

---

# 14. OWNER STRATEGY / CAPITAL PHILOSOPHY

Read:
- Owner Operating Context
- latest owner context tranche
- structured owner profile
- Founder Decision DNA when durable decision patterns are relevant.

Owner context is context, not market fact or execution authority.

---

# 15. OWNER COLLABORATION / HOW TO WORK IN CHAT

Read:
`THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`

Rules:
- Russian default;
- infer obvious voice-dictation intent from live project context;
- one primary objective at a time;
- do not ask owner to repeat already-known data;
- systemic reusable fix > one-off patch;
- `делай/ок` = implementation authorization, not merge authorization;
- each PR merge needs fresh explicit owner command.

---

# 16. SECURITY / PRODUCTION DEPLOYMENT

Read:
- fresh `security/security-intelligence.json`
- Production Incident Postmortem
- latest continuity
- relevant security policy/state.

Do not use an older Cognitive Stack Security snapshot as current Security if a newer standalone Sentinel artifact exists.

For high-frequency Market Data, remember that pure generated snapshot pushes are intentionally excluded from Security push-trigger noise; code/workflow/policy/registry changes remain checked.

---

# 17. PUBLIC CONVERSATION / LEARNING FROM USERS

Read:
- Conversation Learning canon
- Security artifacts
- Owner Collaboration canon when authenticated owner control matters.

Untrusted public dialogue cannot directly mutate facts, code, methodology, project memory, security policy or capital authority.

---

# 18. HISTORICAL ARCHAEOLOGY

Read only as needed:
- Historical Operating Knowledge
- older master continuities
- Git history / merged PR bodies / exact logs
- Memory Vault.

Historical prose never overrides fresh state.

---

# 19. ROUTING PRECEDENCE

Use the smallest useful union.

Example: “Company #011 has ICP and I want its live TVL + Passport.”

Read:
1. core bootstrap;
2. latest continuity;
3. Known Mechanism Reuse + Passport Inheritance;
4. Market Data/onchain authority canon because ICP current pricing/propagation matters;
5. live Company #011 + Market Data/Public Capital artifacts.

Do not start Chainlink/ICP research from zero if the canonical route is already production-proven.

---

# 20. MEMORY WRITE-BACK RULE

After material work:
- changing numeric/state fact → canonical machine-readable artifact;
- durable architecture/engineering lesson → relevant canon;
- major milestone/resume state → new master continuity;
- retrieval improvement → Routing Index/README;
- owner decision → Decision Memory under its contract;
- observational event → Observer/Memory Vault;
- trivial run noise → logs only.

Do not stuff everything into CURRENT. CURRENT is a bootstrap, not the archive.

---

# 21. COMPACT ROUTING LAW

**Load the core, route to the relevant block, then verify against live state.**

`CURRENT → continuity → router → task canon → live artifact → exact evidence`

The model can change. **The memory must remain The Holding's.**
