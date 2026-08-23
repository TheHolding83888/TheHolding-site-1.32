# THE HOLDING — PROJECT MEMORY ROUTING INDEX
## 2026-08-18 · task-aware retrieval map · updated 2026-08-23

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

# 7. REWARDS / ACCRUED REWARDS DRAWER / UNCLAIMED / COMPOUNDED / VLCVX

For generic Rewards read:
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
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

For f(x) / veFXN / FXN Locker specifically also inspect:
- `productivity/fxn-locker-apr-guard.mjs`;
- live `companies/productivity-source-report.json`;
- live `companies/productivity-data.json`;
- Aug 22 final stabilization continuity.

Laws:
- Reference APR/APY != realised income;
- unsupported/missing rate = Pending, not 0;
- fee tier/nominal parameter != yield;
- rate must have reproducible source and explicit metric semantics;
- **official domain identity alone may be insufficient when one page contains several rates; exact semantic block/metric authority may be required.**

Current f(x) durable source contract from Aug 22:
- exact official page: `https://fx.aladdin.club/v2/lock`;
- exact source authority: `FXN Locker block`;
- source metric: `veFXN Locker APR`;
- historical snapshots are not retroactively rewritten by the exact-source guard.

Do not answer the current APR from prose memory. Fetch live Productivity state.

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
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
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

# 11A. REPORTING / DEFITEA CASH FLOW / YIELD REPORTS / VOTEMARKET

Trigger examples:
- Defitea daily/monthly cash flow
- annualized cash-flow APR
- current live-month APR
- year APR
- YieldRing/05081966 income contribution
- VoteMarket veCRV / veFXN income
- Union scrvUSD reconciliation
- `reporting-data.json`
- `defitea-income-ledger.json`

Read:
1. latest master continuity;
2. **`THE_HOLDING_REPORTING_REFERENCE_MODEL_CANON_2026-08-22.md`**;
3. live `intelligence/reporting-data.json`;
4. live `reporting/defitea-income-ledger.json`;
5. live canonical Defitea state, Productivity and Market Data when recalculation/provenance matters;
6. current Reporting workflow/validator for writer or materialization questions.

Hard laws:
- Defitea automated Reporting uses the canonical 11-position inventory;
- Reporting consumes canonical selected Market Data and does not independently discover spot prices;
- base Reference APR model != realised wallet income;
- associated-company income from YieldRing.eth and 05081966.eth may enter the **cash-flow numerator**, never Defitea TVL;
- VoteMarket veCRV/veFXN income enters through append-only deduplicated entitlement events, not by repeatedly adding current claimable balances;
- Union/vlCVX settlement is reconciliation/disclosure and must not double-count Votium economics already represented in `convex_vlcvx` Reference APR;
- first tracking month must not fabricate pre-tracking days;
- live-month annualized APR uses only observed sample days;
- year `annualizedCashFlowAprPct` includes the live provisional month when present;
- `bestMonth` remains closed-month only;
- Reporting code merge is not physical production proof; verify canonical writer output.

Do not answer current annualized values from prose continuity. Fetch live Reporting JSON.

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
- **`THE_HOLDING_PRODUCTION_RECOVERY_FAIL_CLOSED_HANDOFF_CANON_2026-08-22.md` when release/recovery/handoff/freshness is involved**
- live subsystem states
- Historical Operating Knowledge when architecture history matters
- Founder DNA only when founder-model alignment matters.

Distinction:
standalone fresh subsystem state may be newer than the exact state bound into a coherent Cognitive Stack packet. Preserve coherent-chain provenance.

Current recovery law after the Aug 23 real-use governance repair:
`post-change Security freshness → release guard → Cognitive SUCCESS → Learning SUCCESS → Proposal SUCCESS → Downstream Continuity (Builder → Guardian → CURRENT) SUCCESS → Project Memory SUCCESS → Intelligence Progress SUCCESS`.

This is a recovery control-plane chain using existing canonical writers, not a second reasoning truth plane.

Do not assume a workflow dispatched with repository `GITHUB_TOKEN` will recursively trigger every downstream `workflow_run` event. Critical recovery handoffs explicitly identify and await the exact dispatched run before moving to the next stage.

Proposal source/release changes have their own bounded production materialization contract:
`Proposal source change → Proposal Work Queue → Builder → Guardian → CURRENT`.
Generated Proposal outputs are excluded from the source-change trigger to prevent recursion.

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
- routine low-risk repository changes may proceed through verified PR merge and physical production proof without a separate per-PR confirmation under the owner's bounded standing authorization;
- stop for explicit owner confirmation at material capital, authority, security, methodology, destructive/irreversible or other high-consequence boundaries;
- every routine merge still requires fresh `main`, exact PR head/base/mergeability, exact-head GREEN checks, expected scope, moving-main recheck, expected-head merge and post-merge proof.

Historical note:
on Aug 22 the owner granted a temporary standing merge authorization only for the defined final-stabilization sequence until the fat green check. That historical exception is closed. It has now been superseded for routine low-risk repository work by the owner's broader but still bounded 2026-08-23 working-flow authorization; it does **not** expand capital, execution, methodology or security authority.

---

# 16. SECURITY / PRODUCTION DEPLOYMENT

Read:
- fresh `security/security-intelligence.json`
- Production Incident Postmortem
- latest continuity
- **`THE_HOLDING_PRODUCTION_RECOVERY_FAIL_CLOSED_HANDOFF_CANON_2026-08-22.md` for trigger/recovery/release incidents**
- relevant security policy/state.

Do not use an older Cognitive Stack Security snapshot as current Security if a newer standalone Sentinel artifact exists.

For high-frequency Market Data, remember that pure generated snapshot pushes are intentionally excluded from Security push-trigger noise; code/workflow/policy/registry changes remain checked.

Aug 22 detector lessons:
- Puppeteer `$eval/$$eval` is not JavaScript `eval`;
- shell prose containing `eval` is not automatically an executed shell `eval` command;
- false-positive fixes must include positive fixtures proving real dangerous syntax is still detected;
- generated Security outputs may be ignored to prevent self-loop noise, but Security engine/policy files must still wake Sentinel;
- public telemetry diagnostics must not leak local runner paths.

Current High/Medium counts are changing facts; always fetch live Security.

---

# 16A. PRODUCTION RECOVERY / WORKFLOW HANDOFF / STALE-GREEN / THI

Trigger examples:
- writer did not publish after merge
- PR GREEN but generated artifact old
- workflow dispatched but no downstream run
- Cognitive release guard failure
- stale Cognitive / fresh Security mismatch
- Learning / Proposal did not wake
- Builder / Guardian / CURRENT did not materialize
- Project Memory did not wake
- THI stale or false GREEN/RED
- shell/heredoc publication failure
- exact-byte manifest coverage

Read:
1. latest master continuity;
2. **`THE_HOLDING_PRODUCTION_RECOVERY_FAIL_CLOSED_HANDOFF_CANON_2026-08-22.md`**;
3. current canonical workflow(s);
4. live generated state for every linked subsystem;
5. exact workflow run/job/step logs when failure location matters;
6. release manifests/guards when release coherence matters.

Diagnostic order:
`run exists? → exact failed step? → collection? → validation? → local commit? → rebase/publish? → downstream handoff? → artifact actually changed?`

Hard laws:
- one canonical writer per truth plane;
- recovery dispatches canonical writers rather than writing duplicate truth;
- wakeup != publication;
- PR CI GREEN != production writer GREEN;
- merged source != materialized production state;
- fail-closed release drift is repaired by rebinding intended bytes, not weakening guards;
- freshness ordering matters: post-change Security must precede Cognitive recovery;
- queued workflow checkout may become stale while waiting; refetch/reset before exact-byte gates;
- `GITHUB_TOKEN` dispatched workflows may not recursively create expected downstream events;
- public observability output is itself a privacy surface;
- THI current integrity comes from live canonical guards, not persisted old booleans;
- shell summary/post-step RED must be separated from actual writer publication failure.

---

# 16B. REAL USE / EXPERIENCE ACTIVATION / PROSPECTIVE PATTERNS / ASK EPISTEMIC DRIFT

Trigger examples:
- first genuine owner economic decision / pre-commitment / outcome review
- “what should we build next globally?”
- prospective pattern support / counterevidence / no-signal
- Ask gives the wrong intent, false UNKNOWN, false MEASURED or stale evidence
- Ask cannot answer a real owner question despite canonical evidence existing
- Graph/owner context/world experience usefulness in a real question

Read:
1. latest master continuity;
2. `THE_HOLDING_AUTONOMOUS_OBSERVATIONAL_WORLD_LEARNING_v0.1_PRODUCTION_CANON_2026-08-23.md`;
3. `THE_HOLDING_OWNER_INITIATED_ECONOMIC_DECISION_EXPERIENCE_v0.1_2026-08-15.md` when a genuine owner decision/outcome is involved;
4. `THE_HOLDING_ASK_ANSWER_CONTRACT_CANON_2026-08-14.md` when Ask semantics/confidence/source binding is involved;
5. live `intelligence/observational-learning/observational-experience.json`;
6. live `intelligence/learning-state/owner-outcome-experience.json`;
7. current Ask Experience artifacts/workflow evidence for Ask regressions;
8. live THI only as telemetry, never as a roadmap target.

Current development mode:
`BUILD THE BRAIN → USE THE BRAIN → FIND WHERE IT FAILS → THEN BUILD`.

Hard laws:
- candidate observational pattern != learned truth, prediction, causal claim, policy or allocation instruction;
- retrospective candidates must remain frozen while later evidence is scored prospectively;
- support and counterevidence are symmetric evidence classes;
- machine observational experience != owner decision experience;
- machine episode volume cannot compensate for 0 settled owner outcomes;
- no retroactive pre-decision backfill merely to populate Experience;
- a new global intelligence layer requires measured real-use friction;
- Graph growth is utility-gated by a concrete query/reasoning improvement, not connectivity aesthetics;
- THI is telemetry, not “brain readiness %” and not an optimization target;
- Ask must control both false-MEASURED and false-UNKNOWN;
- entity/intent matching must use semantic boundaries rather than incidental substring overlap (`ONDO` inside `1milliondollar` is the canonical regression lesson);
- frozen regression expectations may be updated only when fresh production evidence proves the underlying semantics changed;
- current execution authority remains none.

First Experience Activation milestone:
`FIRST GENUINE OWNER ECONOMIC DECISION → SETTLED OUTCOME → REVIEWED LESSON`.

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
3. Known Mechanism Reuse + `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`;
4. Market Data/onchain authority canon because ICP current pricing/propagation matters;
5. live Company #011 + Market Data/Public Capital artifacts.

Do not start Chainlink/ICP research from zero if the canonical route is already production-proven.

Example: “Cognitive is stale after a workflow change.”

Read:
1. core bootstrap;
2. latest continuity;
3. Production Recovery & Fail-Closed Handoff canon;
4. live Security/Cognitive/Learning/Proposal/Builder/Guardian/Project Memory/THI artifacts;
5. current release manifests and exact run logs.

Do not create another writer merely because the existing writer failed to materialize.

Example: “What should The Holding build next?”

Read:
1. core bootstrap;
2. latest continuity;
3. Real Use / Experience Activation block above;
4. live Ask/Experience/observational evidence;
5. only then choose an engineering objective from demonstrated friction.

Do not preselect a new Brain/Learning/Graph layer merely because the previous architecture phase is closed.

---

# 20. MEMORY WRITE-BACK RULE

After material work:
- changing numeric/state fact → canonical machine-readable artifact;
- durable architecture/engineering lesson → relevant canon;
- major milestone/resume state → new master continuity;
- retrieval improvement → Routing Index/README;
- owner decision/pre-commitment → Owner Economic Experience / Decision Memory under the applicable contract;
- owner outcome/review → append-only outcome review path under its contract;
- observational event → Observer/Memory Vault;
- prospective pattern evidence → existing observational prospective-evaluation state;
- trivial run noise → logs only.

Do not stuff everything into CURRENT. CURRENT is a bootstrap, not the archive.

The Aug 22 stabilization checklist and the Aug 23 Claude-review repair cycle are **closed milestones**, not standing backlogs. Reopen a closed item only when fresh live evidence demonstrates regression.

---

# 21. COMPACT ROUTING LAW

**Load the core, route to the relevant block, then verify against live state.**

`CURRENT → continuity → router → task canon → live artifact → exact evidence`

The model can change. **The memory must remain The Holding's.**
