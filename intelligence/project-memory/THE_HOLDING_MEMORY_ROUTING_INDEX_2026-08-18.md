# THE HOLDING — PROJECT MEMORY ROUTING INDEX
## 2026-08-18 · task-aware retrieval map

> Purpose: give every new chat/model a deterministic answer to **“what project memory should I read for this exact kind of work?”** without forcing it to load every historical file.
>
> This file is routing metadata, not a source of changing production truth. Fresh `main`, fresh generated artifacts and exact workflow evidence always outrank prose memory.

---

# 1. THE MEMORY MODEL

The Holding does not rely on one giant memory document. The canonical continuity system is layered:

1. **`CURRENT.md`** — compact bootstrap and fresh subsystem summary.
2. **Latest `THE_HOLDING_MASTER_CONTINUITY_*.md`** — deep current-state checkpoint and exact resume point.
3. **Task-specific canons / context blocks** — durable knowledge loaded only when relevant.
4. **Machine-readable subsystem state** — current economic/security/cognitive truth for the actual task.
5. **Permanent Memory Vault + Git history** — append-only factual/history evidence when archaeology is necessary.

This routing index sits between steps 2 and 3. It tells a future model which durable blocks to load for a task.

The intended flow is:

`CURRENT → latest continuity → ROUTING INDEX → relevant memory blocks → relevant live artifacts → work`

Do not replace this with “read everything”. Selective retrieval is a feature: it keeps context high-signal while preserving deep memory when needed.

---

# 2. ALWAYS-READ CORE

For every substantive The Holding task, read in this order:

1. `intelligence/project-memory/CURRENT.md`
2. latest `intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_*.md` referenced by `CURRENT.md`
3. `intelligence/project-memory/THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`
4. `intelligence/project-memory/THE_HOLDING_BUILD_DISCIPLINE_CANON_2026-08-14.md`
5. this routing index

Then choose only the blocks below that match the work.

---

# 3. COMPANY ONBOARDING / NEW COMPANY / NEW WALLET

Trigger examples:
- “добавляем компанию #011”
- discovery / resolve / closure / reconciliation
- new wallet or ENS added to an existing company
- mechanism inventory for a company

Read:
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`
- latest company-specific continuity if one exists
- onboarding playbook(s) present in repository
- live canonical company artifacts and current Productivity/Rewards adapters

Hard rule:
**fingerprint known mechanisms before writing new protocol code.** Reuse the strongest proven end-to-end capability and resolve only the true delta.

---

# 4. COMPANY #010 / CYPHER

Trigger examples:
- Cypher Passport
- Company #010 TVL / capital / Performance
- Project X, HyperLend, GMX, Stake DAO, Concentrator, Convex, veAERO, veVELO, Votium for Cypher

Read:
- latest master continuity first — it contains the current Company #010 map
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md` for reward/income presentation
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md` for Passport geometry
- live `companies/company-010-production-state.json`
- live `companies/rewards-data.json`
- live `intelligence/productivity-data.json` when rate behavior matters
- `companies/company-010-projectx-rate-history.json` for Project X APR lifecycle

Current important Company #010 laws are also summarized in the latest master continuity; do not substitute old #010 checkpoints for fresh state.

---

# 5. PROJECT X / NFT LP / MULTI-LEG STRATEGIES

Trigger examples:
- Project X · WHYPE-USDC
- concentrated-liquidity NFT positions
- one resolver finds multiple token legs
- active vs empty/dust NFT filtering
- collectible LP fees
- Project X Reference APR

Read:
- latest master continuity, Project X sections
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md`
- live `companies/company-010-production-state.json`
- live `companies/company-010-projectx-rate-history.json`
- source files:
  - `onboarding/company-010-deep-resolve.mjs`
  - `onboarding/company-010-projectx-strategy-overlay.mjs`
  - `onboarding/company-010-projectx-reference-apr.mjs`

Permanent lessons:
- enumerable NFT inventory != economic strategy inventory;
- zero-liquidity / dust / other-pair NFTs may remain diagnostics but do not belong in strategy TVL/Rewards;
- nonzero-liquidity position with unresolved principal must fail closed;
- every in-scope economic principal/reward leg must be promoted or explicitly preserved as unknown — silent leg loss is a regression;
- fee tier is not yield;
- `collect.staticCall` collectible fees are rewards, not strategy principal;
- observed-fee APR needs a stable time window and fingerprint continuity.

---

# 6. HYPERLEND / AAVE-LIKE LENDING / hTOKEN OR aTOKEN INCOME

Trigger examples:
- HyperLend · kHYPE
- lending supply APY/APR
- whether lending rewards are Claimable or Compounded
- Aave-compatible scaled-balance receipt tokens
- incentives controllers

Read:
- latest master continuity, HyperLend sections
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md`
- live Company state + Rewards state
- `onboarding/company-010-hyperlend-income-overlay.mjs`

Canonical distinction:
- **base lending interest** from scaled balance + reserve liquidity index = **Embedded / Compounded**, already inside receipt-token balance/NAV, never separately claimable and never additive capital;
- **external incentives** are a separate lane through RewardsController; only configured, measured user rewards become `Unclaimed`;
- a controller existing does not prove an active incentive; `rewardAssetCount = 0` means no separate incentive row, not a fabricated zero-value reward;
- Reference APR is a rate, not realised earned USD.

---

# 7. REWARDS / ACCRUED REWARDS DRAWER / UNCLAIMED / COMPOUNDED

Trigger examples:
- “что показывать в Rewards?”
- Claimable / Unclaimed
- Compounded / Embedded
- Pending / Warming
- measured earned total
- adding a new reward route

Read:
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
- `THE_HOLDING_KNOWN_MECHANISM_REUSE_AND_PROMOTION_CANON_2026-08-18.md`
- latest master continuity
- live `companies/rewards-data.json`

Hard semantic lanes:
- **Unclaimed** = currently accrued and separately claimable from protocol;
- **Compounded / Embedded** = already remains inside strategy/locked/wrapper economics; may be measured/valued for earned presentation but does not enter claimable settlement total;
- **Pending / Warming** = known mechanism with incomplete current measurement; never convert to zero;
- claimable reward != principal;
- embedded earned USD != claimable USD;
- Reference APR/APY != realised income.

Use one unified Rewards Drawer. Do not create protocol-specific secondary mini-ledgers when the canonical row model can express the state.

---

# 8. PRODUCTIVITY / APR / APY / REFERENCE RATE

Trigger examples:
- APR/APY badge
- Pending rate
- “почему APR такой высокий?”
- Reference APR source
- rate collector / history

Read:
- latest master continuity
- live `intelligence/productivity-data.json`
- source-specific state / history
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md` for presentation
- mechanism reuse canon for source/field parity

Core laws:
- Reference APR/APY is not realised income;
- missing/unsupported rate = `Pending`, not `0`;
- protocol fee tier / nominal parameter is not automatically yield;
- rate must have explicit metric semantics and reproducible source;
- observed realised-fee annualisation must declare window, reset rules, pricing method and exclusions.

---

# 9. PERFORMANCE / COST BASIS / INVESTED / RETURNS

Trigger examples:
- Performance percentage
- cost basis
- invested capital
- contribution/distribution history

Read:
- latest continuity for the company
- owner operating context only when owner-declared cost-basis/strategy intent matters
- live performance ledger/artifacts for that company
- historical contribution ledgers where present

Hard rules:
- partial cost basis != complete performance;
- unknown entry price != zero cost;
- realised income != claimable rewards;
- wrapper conversion/internal movement is not a contribution/distribution unless evidence says boundary flow.

---

# 10. PASSPORT UI / MOBILE / DESKTOP

Trigger examples:
- Company Passport layout
- Balance Sheet · Strategies
- APR/APY capsule placement
- desktop vs mobile
- strategy row/card rendering

Read:
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md`
- `THE_HOLDING_COMPANY_PASSPORT_INHERITANCE_CANON_2026-08-19.md`
- latest master continuity
- Rewards Drawer canon if drawer is touched
- current public adapter / `companies/index.html`

Hard product rules:
- accepted desktop/laptop geometry is preserved during mobile-only fixes unless owner requests otherwise;
- mobile productive rows use the reusable two-row composition;
- no per-label pixel hacks when a reusable structural layout solves the class;
- economic state belongs in canonical data; public adapter should project it, not invent a second truth.

---

# 11. STABLE CAPITAL / MONETRA / STABLE INDEX

Trigger examples:
- Monetra
- Stable Companies Index
- stable strategy book
- stable APY / performance

Read:
- latest master continuity
- historical operating knowledge if mechanism reuse is needed
- Stable/Monetra artifacts and current Stable Intelligence outputs
- owner operating context if discussing strategy philosophy rather than measurement

Preserve Monetra tracking provenance and do not backfill earlier income without explicit evidence/methodology.

---

# 12. COGNITIVE STACK / BRAIN / OBSERVER / MEMORY / LEARNING

Trigger examples:
- “насколько мощные мозги?”
- Observer / System Memory
- Memory Vault
- Grounded Brain
- ChatGPT Bridge
- Decision & Outcome Learning
- Proposal / Builder / Guardian
- autonomous cognitive cycle

Read:
- `CURRENT.md`
- latest master continuity
- Build Discipline canon
- live subsystem machine-readable states
- Historical Operating Knowledge when architecture history matters
- Founder Decision DNA canon when founder-model alignment is part of the question

Critical distinction:
- standalone fresh subsystem state may be newer than the exact snapshot bound into a coherent Cognitive Stack packet;
- do not overwrite coherent-chain provenance with a newer unrelated snapshot;
- current authority remains `none` unless a future explicit governance upgrade changes it.

---

# 13. OWNER STRATEGY / CAPITAL PHILOSOPHY / COMPANY CURATOR

Trigger examples:
- what owner would choose
- capital allocation philosophy
- stable reserves
- diversification / leverage / Health Factor
- future Company Curator

Read:
- `THE_HOLDING_OWNER_OPERATING_CONTEXT_2026-08-16.md`
- latest `THE_HOLDING_OWNER_OPERATING_CONTEXT_TRANCHE_*`
- `intelligence/owner-context/owner-operating-profile.json`
- latest additive owner profile tranches
- `THE_HOLDING_FOUNDER_DECISION_DNA_CANON_2026-08-14.md` if modelling durable decision patterns

Boundary:
owner context is context, not market fact and not execution authority.

---

# 14. OWNER COLLABORATION / HOW TO WORK IN CHAT

Trigger examples:
- new session warm-up
- ambiguous voice dictation
- merge authorization
- sequence of work
- whether to ask owner to repeat details

Read:
- `THE_HOLDING_OWNER_COLLABORATION_OPERATING_STYLE_2026-08-18.md`

Key rules:
- Russian default;
- infer obvious dictation intent from project context;
- one primary objective at a time;
- active expert orchestration, not passive paraphrase;
- do not ask for already-known wallets/prices/accepted decisions;
- generic “делай/ок” is implementation authorization, not merge authorization;
- every PR merge requires fresh explicit command such as `мерджи 144`.

---

# 15. SECURITY / PRODUCTION DEPLOYMENT

Trigger examples:
- Security Sentinel
- Cloudflare / Worker / Wrangler
- production routing / homepage ownership
- DOM/XSS/security headers
- privileged workflows

Read:
- fresh `security/security-intelligence.json`
- `THE_HOLDING_PRODUCTION_INCIDENT_POSTMORTEM_2026-08-14.md`
- latest master continuity
- security policy/state artifacts

Do not infer current Security counts from an older Cognitive Stack snapshot when a newer standalone Security artifact exists.

---

# 16. PUBLIC CONVERSATION / LEARNING FROM USERS

Trigger examples:
- public AI console
- learning from visitors
- owner teaching via public surface
- prompt injection / trust boundaries

Read:
- `THE_HOLDING_CONVERSATION_LEARNING_CANON_2026-08-14.md`
- Security artifacts
- owner collaboration canon if owner-authenticated control is discussed

Untrusted public dialogue cannot directly mutate facts, methodology, code, security policy, project memory or capital authority.

---

# 17. HISTORICAL ARCHAEOLOGY / “HOW DID WE GET HERE?”

Trigger examples:
- old failure root cause
- why a current law exists
- past company mechanism precedent
- reconstruct prior production state

Read only as needed:
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md`
- older `THE_HOLDING_MASTER_CONTINUITY_*`
- Git history / merged PR bodies / exact workflow logs
- Memory Vault records

Do not use historical prose to override fresh state.

---

# 18. ROUTING PRECEDENCE

When multiple blocks apply, read the smallest useful union.

Example: “Add the same HyperLend kHYPE mechanism to Company #011 and show it in Rewards on mobile.”

Correct retrieval set:
1. core bootstrap files;
2. latest continuity;
3. Known Mechanism Reuse canon;
4. this HyperLend section / live Company #010 implementation as precedent;
5. Rewards Drawer canon;
6. Passport Responsive canon;
7. live Company #011 artifacts.

Do **not** start protocol research from zero and do **not** load unrelated Founder DNA or Stable Capital context.

---

# 19. MEMORY WRITE-BACK RULE

After material work, decide where the new knowledge belongs:

- changing numeric/state fact → machine-readable canonical subsystem artifact;
- durable architectural/engineering lesson → relevant canon;
- major milestone/resume state → new master continuity checkpoint;
- task discovery/routing improvement → this routing index / README;
- owner decision → Decision Memory when a real decision is captured under its contract;
- observational event → Observer / Memory Vault;
- trivial run noise → logs only.

Do not stuff everything into `CURRENT.md`. `CURRENT` is a bootstrap, not the archive.

---

# 20. COMPACT ROUTING LAW

**Load the core, route to the relevant block, then verify against live state.**

`CURRENT → continuity → router → task canon → live artifact → exact evidence`

The model can change. **The memory must remain The Holding's.**
