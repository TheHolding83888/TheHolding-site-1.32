# THE HOLDING — URGENT CHAT CHECKPOINT
## 2026-09-08 09:52 MSK · Passport Accounting / Confirmed vs Estimated / Defitea follow-up

Status: **MANUAL HIGH-DETAIL RESUME CHECKPOINT**  
Authority: **continuity / implementation context only**  
executionAuthority: **none**

> This file preserves the current chat frontier so work can resume safely if model/chat context ends. It is not a source of changing production truth. At resume time, re-read live `main`, CURRENT, latest continuity, routed canon, machine artifacts and exact workflow evidence.

## 1. OWNER INSTRUCTION / WORKING MODE

The owner explicitly authorized continuing the current Passport/accounting work and asked the assistant to decide implementation order and wording when useful, while preserving the long-term architecture. Immediate owner request before this checkpoint:

- finish the current work as judged technically appropriate;
- make the second monthly-report metric **Estimated** understandable to a normal company owner;
- keep the explanation short and clear;
- preserve the larger The Holding accounting / reporting / capital architecture;
- now create an urgent detailed checkpoint because chat/model memory may end soon.

Do not lose the established production principles: systemic reusable fixes, provenance, fail-closed accounting, no patches that create a second source of truth, `UNKNOWN != 0`, and `GREEN workflow != physically materialized artifact`.

## 2. LIVE SOURCE BOUNDARY AT CHECKPOINT

- Repository: `TheHolding83888/TheHolding-site-1.32`
- Live `main` checked at checkpoint: `72273837984542eeaa39645c7af488d9406ee4fa`
- Main head time: `2026-09-08T05:19:12Z` / `08:19:12 MSK`
- Main head message: `market data: refresh shared public snapshot`
- Latest CURRENT observed before this checkpoint points to: `THE_HOLDING_MASTER_CONTINUITY_2026-09-08_044048_AUTO_69e11347.md`
- That automatic continuity already captured the Passport Confirmed/Estimated PR boundary after merge.

Current branch created solely for this checkpoint:
`memory/urgent-passport-accounting-checkpoint-20260908-0952`

## 3. WHAT WAS COMPLETED IN THIS CHAT

### A. Passport monthly-report architecture reviewed

The current monthly report architecture was re-read from live repository code and reporting artifacts. The intended owner-facing model is now explicitly two-lane:

1. **Confirmed** — factual/accounting income only, backed by Canonical Income Ledger recognition.
2. **Estimated** — analytical/reference estimate for the same period, based on the existing APR/reference model, never added to Confirmed and never allowed to close factual accounting coverage.

Tracking/coverage remains a third informational layer explaining whether mechanisms are factually tracked and whether period events have been observed.

### B. Important semantic distinction preserved

Three things must not be conflated:

- factual tracking capability for a mechanism;
- confirmed period income events for that mechanism;
- reference/estimated economics based on APR/productive capital.

A mechanism may be fully tracked but have no event yet in the selected month. That is not a coverage gap and not zero income. The UI must explain this state instead of looking empty or complete.

### C. Owner-facing wording improved and implemented

The weak wording:

`Dynamic estimate for the same period. It is not added to confirmed income.`

was replaced with a clearer description of what the metric actually is:

**EN**  
`APR-based estimate for the same period — a reference, not confirmed income.`

**RU**  
`Оценка по APR за тот же период — ориентир, а не подтверждённый доход.`

Reason: this tells the owner immediately that the second number is calculated from an APR-based model and is an orientation/reference value rather than a second accounting total.

### D. Passport hierarchy patch shipped

PR **#685**: `Passport: clarify Confirmed vs Estimated monthly report hierarchy`

Merged commit:
`7e4b39a8b85de9461446f781b32ec5559ec994d3`

Main file after merge:
`companies/company-passport-priority-adapter.js` → **v0.7.0**

The patch:

- keeps factual **Confirmed** as primary;
- keeps factual/accounting **Tracking** adjacent to Confirmed;
- places **Estimated** as a clearly secondary APR-based reference lane;
- removes the owner-facing associated-company implementation-scope sentence while preserving backend ownership/scope contracts;
- keeps Estimated non-additive to Confirmed;
- preserves no-browser-income-calculation rule;
- preserves all existing accounting authority boundaries;
- keeps `tracking-active / no period event` visibility support;
- retains bounded data refresh behavior so an already-open Passport can converge to new backend artifacts.

The adapter explicitly declares:

- `browserCalculatesEstimatedIncome: false`
- `confirmedPlusEstimatedIsValidTotal: false`
- `associatedCompanyCapitalIncluded: false`
- `associatedCompanyScopeVisible: false`
- `trackingNoEventVisible: true`
- `trackingPresentedWithConfirmed: true`

### E. PR verification performed before merge

Observed checks on the PR head included successful:

- Verify Company Monthly Reports
- Repository Hygiene Guard
- Commit Identity Privacy Guard
- Public Surface Privacy Guard
- Cloudflare Workers build

The production homepage smoke check was **skipped**, not failed. Therefore code/CI closure is green, while final human live-site visual acceptance is still a separate step.

## 4. CURRENT REPORTING / ACCOUNTING MACHINE STATE OBSERVED

### Accounting Coverage

File: `reporting/accounting-coverage.json`

Observed live artifact:

- version: `0.10-explicit-settlement-link-accounting-mechanism-coverage-registry`
- generatedAt: `2026-09-08T04:21:33.475Z`
- status: `diagnostic-no-completion-authority`
- current month: `2026-09`
- companies: 10
- mechanism instances: 50
- unique mechanisms: 29
- classified instances: 50
- unclassified instances: 0
- reusable coverage gaps: 0
- canonical ledger event count: 780
- settlement-linked canonical event count: 5
- unmatched canonical event count: 32
- factual tracking proof count: 2540

Critical semantics in the artifact remain:

- Canonical Ledger is sole factual income authority.
- Reference metric is not earned income.
- Current reward state is not period income.
- Factual tracking proof is not period income.
- Zero period event does not imply a coverage gap.
- Coverage gap means missing factual tracking capability.
- Partial evidence does not close month.
- `unknownIsNotZero: true`.

### Company Monthly Reports

File: `reporting/company-monthly-reports.json`

Observed live artifact:

- version: `0.5-company-monthly-confirmed-estimated-view`
- methodology: `0.4-canonical-ledger-sole-income-recognition-authority`
- generatedAt: `2026-09-08T04:40:44.848Z`
- Income Ledger status remains `partial`
- reference formula is explicitly:
  `coveredProductiveCapitalUsd * companyReferenceAprPct / 100 / 365`
- reference income has `earnedIncomeAuthority: false`
- Confirmed and Estimated are side-by-side but non-additive.

The new `incomeView` contract preserves:

- Confirmed factual recognized amount;
- Estimated `basis: existing-reference-model`;
- `earnedIncomeAuthority: false` for Estimated;
- `factualIncomeAuthority: false` for Estimated;
- `canCloseAccountingCoverage: false`;
- `canReplaceUnknown: false`;
- `confirmedPlusEstimatedIsValidTotal: false`.

## 5. DEFITEA ACCOUNTING CONTEXT THAT MUST SURVIVE

The earlier chat analysis established an important correction:

- August Defitea was never truly “90–95% money-complete.” That number mistakenly conflated mechanism coverage with period/money completeness.
- August factual recognized income remained materially incomplete versus reference economics.
- Reference model is useful as an orientation and anomaly detector, but it must never backfill factual income.

At the earlier validated frontier, Defitea September had factual tracking capability across all 11 active mechanisms, but only part of those mechanisms had current-period canonical events. This is exactly why the Passport must distinguish:

**Tracking active** vs **Confirmed event observed** vs **Reference estimate**.

Do not assume old event counts remain current. Re-read fresh Coverage + Ledger + Monthly Reports after resume.

## 6. WORK THAT WAS IN PROGRESS WHEN CHECKPOINT WAS REQUESTED

After shipping the Passport hierarchy/copy fix, the assistant began a deeper read of `rewards/company-rewards-engine.mjs` and related live reward/accounting machinery to understand the remaining Defitea September completeness frontier rather than patching the UI blindly.

Read-only investigation covered:

- Aerodrome / Velodrome veNFT current reward discovery;
- managed vs direct veNFT state;
- historical Voted-event discovery and cached tail scanning;
- bounded recent reward discovery;
- 40 Acres holder discovery for Defitea veVELO;
- VoteMarket proof + onchain claimed-state reconstruction for veCRV / veFXN;
- Frax, Yield Basis, Votium/Union and related current reward routes.

Important: **no reward-engine code was changed during this investigation yet.**

The purpose of the read was to answer the next production question correctly:

> For every Defitea mechanism that has tracking but no selected-month event, is that a normal cadence / no-event-yet state, an evidence-boundary issue, or an actual missing tracker/reconciliation defect?

## 7. NEXT IMPLEMENTATION ORDER

Resume in this order unless fresh live evidence changes the priority.

### 1. Production Passport acceptance

Verify live production Company Passport visually and behaviorally after merged PR #685:

- Confirmed is primary;
- Tracking is clearly attached to factual accounting;
- Estimated is visually secondary;
- EN/RU copy is correct;
- no old associated-company scope copy remains;
- selected-month interaction refreshes backend data as intended;
- mobile and desktop remain readable without redesign regression.

Do not call it physically closed from CI alone.

### 2. Fresh September accounting reconciliation

Re-read fresh artifacts after current Rewards/Reporting materialization:

- `companies/rewards-data.json`
- `reporting/income-ledger.json`
- `reporting/accounting-coverage.json`
- `reporting/company-monthly-reports.json`
- exact workflow runs producing them.

For Defitea, classify every active mechanism into:

- **Confirmed period event(s)**
- **Tracking active / no event yet**
- **Evidence/boundary unresolved**
- **Actual tracking gap**

Do not equate the last three.

### 3. Make the Passport self-explanatory for every incomplete month

Acceptance target:

A company owner opening any month should understand, without asking ChatGPT:

- how much income is factually Confirmed;
- what the APR-based Estimated reference is;
- whether all mechanisms are being tracked;
- which mechanisms are simply awaiting a period event;
- which mechanisms are genuinely unresolved or unsupported.

Keep the surface compact. Do not turn it into a technical audit log.

### 4. Reference estimate as reconciliation/anomaly lane

Use Estimated as a diagnostic/control signal, not accounting authority.

If reference economics and Confirmed diverge materially, surface a WATCH/reconciliation condition so missing evidence gets investigated. Never force Confirmed toward Estimated.

Potential later acceptance logic should use both relative and absolute thresholds, chosen only after observing real monthly behavior across multiple companies.

### 5. Defitea August historical closure remains separate

Continue mechanism-by-mechanism historical reconstruction and classify missing history as:

1. exact reconstruction possible;
2. partial reconstruction possible;
3. exact reconstruction impossible.

If exact proof is impossible, history remains explicit UNKNOWN/partial forever. Never overwrite with APR-based expectations.

### 6. Reusable all-company rollout

Any final Passport/accounting transparency logic must apply to all 10 companies through common contracts. No Defitea-only UI fork unless the underlying mechanism is genuinely unique.

### 7. Long-term roadmap remains unchanged

After current-company factual accounting / history / Passport clarity is stable:

- complete historical coverage;
- capital flows / lifecycle semantics;
- discovery / lifecycle layer;
- then arbitrary-wallet Capital Scan / Index funnel.

Do not jump to public arbitrary-wallet scanning while current-company accounting truth is still materially unresolved.

## 8. UI / COPY CANON FOR THIS FRONT

Preferred owner-facing hierarchy:

**Confirmed income**  
Main accounting number.

**Tracking**  
Compact factual coverage/event state next to Confirmed.

**Estimated**  
Secondary analytical value.

Preferred helper copy:

EN: `APR-based estimate for the same period — a reference, not confirmed income.`  
RU: `Оценка по APR за тот же период — ориентир, а не подтверждённый доход.`

Do not add many explanatory lines unless testing proves users still misunderstand it.

## 9. NON-NEGOTIABLE LAWS

- Canonical Income Ledger remains sole factual earned-income authority.
- Reference APR / Estimated never becomes factual income automatically.
- Confirmed + Estimated must never be summed.
- Current claimable is not automatically period income.
- Current state is not automatically historical income.
- `UNKNOWN != 0`.
- Mechanism tracking coverage != money completeness.
- Tracking active + zero current-period event can be a legitimate state.
- Accounting Coverage is diagnostic and has no month-closing authority.
- No wallet signing, claims, capital movement or execution authority.
- No browser-side income generation.
- Canonical company ownership and reporting scope must remain preserved.
- `GREEN workflow != physically materialized artifact`.

## 10. STATUS AT CHECKPOINT

🟢 **Completed**

- dual Confirmed / Estimated model established;
- APR-based Estimated explanation chosen;
- Passport v0.7 hierarchy/copy patch merged through PR #685;
- core CI / privacy / reporting guards green;
- automatic continuity captured the merge boundary;
- current live code on main contains v0.7.0.

🟡 **In progress**

- live production visual/interaction acceptance of the merged Passport surface;
- fresh Defitea September mechanism-by-mechanism reconciliation;
- read-only investigation of reward routes and event cadence to distinguish normal no-event states from defects;
- deciding whether any backend change is actually needed after fresh evidence.

⚪ **Next**

- close any real September tracking/evidence defects;
- add/strengthen reconciliation WATCH if factual vs reference divergence proves materially useful;
- continue August historical reconstruction;
- verify behavior across all companies;
- then resume the broader Capital Scan / history roadmap.

## 11. RESUME ORDER FOR A NEW CHAT / MODEL

1. Read live `intelligence/project-memory/CURRENT.md`.
2. Read the latest automatic MASTER_CONTINUITY pointed to by CURRENT.
3. Read this file because it contains the exact active Passport/accounting chat frontier.
4. Follow `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md` only for relevant task canons.
5. Re-read live `main` head and all changed commits since this checkpoint.
6. Re-read the four live accounting/reward artifacts listed in section 7.
7. Re-check exact workflow evidence.
8. Continue from **Production Passport acceptance → fresh Defitea September reconciliation**.

The model can change. **The memory must remain The Holding's.**
