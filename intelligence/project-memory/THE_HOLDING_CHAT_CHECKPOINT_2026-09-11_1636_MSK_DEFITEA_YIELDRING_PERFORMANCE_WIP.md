# The Holding · Chat Checkpoint
## 2026-09-11 16:36 MSK · Defitea + YieldRing Performance completion WIP

## 1. Primary objective
Finish the public Company Passport Performance work for exactly two onchain companies so the owner can open the live site and accept the result:

- Registry 004 · `defitea.eth`
- Registry 002 · `YieldRing.eth`

Acceptance target from the owner:

1. Performance must be a concrete numeric figure, not `—`, UNKNOWN, partial-basis messaging, or an internal reconciliation warning.
2. Historical invested/cost basis comes from the owner-provided screenshots and must be preserved exactly.
3. Current Performance remains a normal live metric: current canonical market value versus the complete historical cost basis. The screenshot is the acquisition-basis evidence, not a frozen market-price feed.
4. Any fact that independent blockchain-native reconstruction is still incomplete may remain internally in canonical state/provenance, but MUST NOT be shown as a warning in the public Company Passport.
5. No changes to execution authority, custody, factual-income authority, Index methodology, or wallet actions.

## 2. Owner screenshot evidence locked into canonical state
### Defitea · registry 004
Canonical screenshot reconciliation:

- current-position historical invested basis: **$9,724.36**
- screenshot market value: **$12,814.37**
- screenshot unrealized PnL: **+$3,090.01**
- screenshot reconciliation Performance: **+31.7759729175%** (~**+31.8%**)
- current capital positions covered by basis: **11 / 11**
- basis status: **complete**

Canonical state: `companies/defitea-canonical-state.json` version `0.2-defitea-canonical-state`.

Important exact current quantities include:

- AERO `2632.61`
- CVX `1333.8`
- PENDLE `501.74`
- FRAX `4456.96`
- FXN `64.81`

The full 11-position current inventory has explicit cost basis. Total basis = `$9,724.36`.

### YieldRing · registry 002
Canonical screenshot reconciliation:

- current-position historical invested basis: **$2,984.60**
- screenshot market value: **$3,713.20**
- screenshot unrealized PnL: **+$728.60**
- screenshot reconciliation Performance: **+24.4119815051%** (~**+24.4%**)
- current capital positions covered by basis: **4 / 4**
- basis status: **complete**

Canonical state: `companies/yieldring-canonical-state.json` version `0.2-yieldring-canonical-state`.

Exact current positions / basis:

- BTC `0.0334` · cost basis `$2,123.11`
- AERO `678` · cost basis `$274.72`
- CVX `240` · cost basis `$307.20`
- FRAX `1032` · cost basis `$279.57`

Total basis = `$2,984.60`.

YieldRing internal wallet provenance deliberately remains `pending-independent-reproduction`; this is an internal provenance fact only. It must not become public Passport warning/copy and it must not be misrepresented as blockchain-confirmed evidence.

## 3. PR / branch
Open PR:

- **PR #751** · `Complete Defitea and YieldRing historical performance basis`
- branch: `fix/complete-company-performance-basis-20260911`
- base: `main`

The PR changes canonical states, public capital projectors, General Balance bindings, Productivity compatibility, validation workflows, and Unified Capital acceptance checks.

## 4. Critical root cause discovered in this chat
The visible site was not updating even though canonical states and several validators looked correct.

Root cause was a systemic projection bug in `companies/company-capital-state-contract.mjs`:

`replaceCompanyBookBlock(html, companyName, renderedBlock)` searched the entire HTML for the first marker such as:

```text
'YieldRing.eth': [
```

But `companies/index.html` contains that company name before the actual `COMPANY_BOOK`, inside `COMPANY_PROTOCOLS`.

Therefore the projector could replace the WRONG array (the protocol map) and then pass its weak `html.includes(rendered)` check, while the real active `COMPANY_BOOK` still contained the old partial basis. This explains the exact symptom the owner reported: code/state looked completed while the visible Performance stayed stale/partial.

The same class of bug could affect Defitea because `defitea.eth` also appears before `COMPANY_BOOK`.

This is the important continuity fact: **the problem was not merely cache or delayed deployment; the projector was not structurally scoped to the canonical Company Book object.**

## 5. Systemic fix applied
### Commit `1348fd2a93cf58b8439388af4de144428996e7f1`
`fix: scope Company Book replacements to canonical object`

`companies/company-capital-state-contract.mjs` now:

- locates exactly one `const COMPANY_BOOK = {` declaration;
- parses the balanced Company Book object boundary;
- searches the company row only inside that canonical object;
- requires exactly one matching company row inside `COMPANY_BOOK`;
- parses the company array boundary safely;
- exports `extractCompanyBookBlock(...)`;
- makes `replaceCompanyBookBlock(...)` structurally scoped and idempotent.

This is the reusable production-grade fix. Do not revert to global string search.

### Commit `2ebf586ca2ec5119363382a74d57bddab17bef1b`
`fix: verify Defitea basis in active Company Book`

`companies/defitea-public-capital-projection.mjs` now verifies the exact rendered block through `extractCompanyBookBlock('defitea.eth')` and checks basis tokens only in the active Company Book row.

### Commit `a2d17d2385b5b281a94ac5e20aa7ce7c797851bf`
`fix: verify YieldRing basis in active Company Book`

`companies/yieldring-public-capital-projection.mjs` now verifies the exact rendered block through `extractCompanyBookBlock('YieldRing.eth')`, checks all basis tokens in the active row, and fails closed if `knownCostBasisUsd` or `costBasisStatus: 'partial'` survives there.

### Earlier validation repair in same PR
Commit `f1e5a7af7817f3dbb6570cb6d611f28f316e8701` fixed a syntax error in the YieldRing validation predicate. After that repair, `Validate YieldRing Capital + veAERO Relay` became GREEN.

## 6. Current validation state at checkpoint creation
For head `a2d17d2385b5b281a94ac5e20aa7ce7c797851bf`:

Already GREEN at checkpoint time:

- `Validate YieldRing Capital + veAERO Relay`
- `Validate General Balance · Per-Asset Market Data Consumer`
- `Validate Package 2 · Defitea Index Coherence`
- `Verify Company #010 · Project X Reference APR`

Still running at checkpoint time:

- `Validate Unified Capital Refresh` run `34605936328`
- `Validate YieldRing Production Cascade`
- `Validate Productivity Overlay Order`
- `Diagnose Productivity Recovery`
- security/reliability guards and Economic Graph

Previous Unified run on head `f1e5a7af...` failed at the final physical check with:

```text
Error: retired YieldRing partial known-basis evidence survived
```

That failure was valuable: it exposed the structural Company Book targeting bug described above.

## 7. What must happen next
Do not tell the owner this is done until ALL of the following are true:

1. Latest PR #751 checks are GREEN, especially `Validate Unified Capital Refresh`.
2. PR #751 is squash-merged to `main`.
3. The canonical production writer / Unified Capital refresh on `main` completes successfully.
4. A physical `main` artifact check proves `companies/index.html` contains, inside the actual `const COMPANY_BOOK = { ... }` object:
   - Defitea complete 11-position basis;
   - YieldRing complete 4-position basis;
   - YieldRing FRAX `qty: 1032` + `costBasisUsd: 279.57`;
   - no YieldRing active-row `knownCostBasisUsd` / partial-basis state.
5. Physical/public capital output exposes complete Performance basis for registries 004 and 002.
6. Public Passport does not surface `pending-independent-reproduction`, “blockchain not learned”, “partial basis”, or similar internal caveat for these two companies.
7. Production deployment/smoke is GREEN.
8. Then the owner can open `https://theholding.ai/companies/` and accept the two Performance cards.

## 8. Intended public Performance semantics
Do NOT freeze the Passport forever at the screenshot market values.

Correct model:

```text
Performance = current canonical market value / complete historical cost basis - 1
```

The owner screenshots provide the authoritative historical acquisition/cost basis and a reconciliation snapshot. Current market value can move normally after deployment.

Therefore the screenshot-time reconciliation values are:

- Defitea: +31.7759729175%
- YieldRing: +24.4119815051%

but the live Passport may move as canonical prices move. What must stay exact is the historical basis and current quantities.

## 9. Public/private provenance boundary
Public Passport:

- concrete Performance number;
- no internal “pending independent reproduction” caveat;
- no partial-basis wording once basis is complete.

Internal canonical state:

- retain honest provenance;
- do not falsely claim owner screenshot evidence is independently blockchain-confirmed;
- `executionAuthority = none`;
- no wallet action / capital execution.

## 10. Adjacent surface warning
The current public Collection navigation has newer `v3` behavior that sends Collection cards into The Holding Index surface. This is outside the Performance-basis objective. Do not casually rework Collection navigation while finishing PR #751.

## 11. Owner communication preference for handoff
When reporting completion, be simple and concrete:

- say whether it is physically on `main` and deployed;
- give the two screenshot reconciliation percentages for orientation;
- explain in one sentence that live Performance may move with prices while invested basis is fixed from screenshots;
- do not expose internal provenance/reconciliation caveats in the public-facing explanation unless specifically asked;
- if not yet materialized, say exactly what is still running instead of claiming “done”.

## 12. Recovery instruction for the next chat
Start from live truth, not this checkpoint alone:

1. fetch current `main` SHA;
2. read `intelligence/project-memory/CURRENT.md`;
3. inspect PR #751 state/head if still open;
4. inspect latest Unified Capital / production writer / smoke runs;
5. inspect physical `companies/index.html` on current `main` and verify the actual `COMPANY_BOOK` rows for registries 002 and 004;
6. only then continue or report acceptance status.

This checkpoint records the reasoning/root cause so the next chat does not repeat the stale “code is correct but site is unchanged” loop.
