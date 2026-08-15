# THE HOLDING — MASTER CONTINUITY
## 2026-08-15 16:42 (+03)
## Ask v1.2A PRODUCTION GREEN / v1.2B INTENT CONTRACT START

## 1. STATUS

**Ask v1.2A · Semantic Substitution Safety Boundary = PRODUCTION GREEN.**

PR #63 was merged to `main` with exact-head guard.

- PR: `#63 Ask v1.2A · Semantic Substitution Safety Boundary`
- exact candidate head: `e70c09befe967756c38f0c19e114a92b3c26ef97`
- merge SHA: `9a3c06ee4f6db4930b321935e9fec4a372717fd3`
- merge result: success

Post-merge production proof on exact merge SHA:

- Cloudflare production build: GREEN
- Cloudflare Build ID: `3a600187-1804-456c-9008-ebc0de3b7b05`
- Cloudflare Version ID: `b50870d2-97aa-431c-9090-177e886f0ae0`
- Production Boundary: GREEN
- Observe repository integrity: GREEN
- Production homepage smoke: GREEN
  - workflow run `31887762304`
  - job `95019450214`
- Ask The Holding · Experience: GREEN
  - workflow run `31887762205`
  - job `95019449840`
  - exact head SHA `9a3c06ee4f6db4930b321935e9fec4a372717fd3`
  - semantic substitution boundary: PASS
  - Core: PASS
  - selected release gates: PASS

## 2. WHAT v1.2A CHANGED

The first 150-question Capital OS broad sweep exposed a class-level trust failure: unsupported semantics could be routed to adjacent measured capabilities and receive a confident but semantically substituted answer.

Representative invalid substitutions:

- realised / received company cash flow → current APR/APY or accrued Rewards;
- founding purpose / purpose drift → company definition, APR, TVL or Performance;
- company maturity / reputation → evidence breadth or productivity;
- guaranteed future APR/APY → current Reference APR/APY;
- exact future hack probability → current Security findings/severity;
- pre-tracking historical income → current earning capacity / Rewards / current value.

v1.2A introduced a deterministic pre-router `semanticUnsupportedBoundary` and a frozen semantic safety corpus.

Durable production files:

- `.github/workflows/ask-experience.yml`
- `agents/console/app.js`
- `verification/ask-experience/corpus-semantic-safety-v0.1.json`
- `verification/ask-experience/semantic-safety-policy-v0.1.md`

The semantic corpus is integrated into the single canonical Experience workflow. No parallel validation loop remains.

## 3. FINAL v1.2A CANDIDATE PROOF

Exact candidate proof before merge:

- Experience run `31884574344`
- artifact `9246923461`
- artifact SHA-256 `2968946df2241ef8ce7f905bb03369db753abed1dc5a7c11a4323179a122c8aa`
- Safety 8/8 strict PASS
- Semantic Safety 26/26 strict PASS
- Core 22/22 strict PASS
- fresh Mutation 7/7 strict PASS
- false-MEASURED = 0 in every gated origin
- source fit = 100%
- confidence fit = 100%
- answer-pattern fit = 100%

Owner Unknown remained intentionally non-release-gated and honest at 3/12:

1. `owner-purpose-drift`
2. `owner-productivity-vs-cashflow`
3. `owner-maturity`

These remain UNKNOWN because canonical company purpose/success criteria, unified company-level Realised Cash Flow, and maturity/reputation methodology do not yet exist.

## 4. IMPORTANT FAILURE / RECOVERY LESSONS

### 4.1 Semantic safety must preserve older safety contracts

The first full regression after the new boundary caught a compatibility issue: the new pre-tracking answer said `predates verified tracking`, while the older frozen Safety corpus required the canonical phrase `predates tracking`.

Resolution:
- preserve the older frozen safety contract;
- adjust production copy rather than weakening the old gate.

### 4.2 Frozen evaluator must distinguish rejection explanation from substitution

An UNKNOWN answer may explicitly name APR/APY to explain why APR/APY cannot substitute for realised cash flow or future guaranteed yield.

Merely mentioning an adjacent metric in a rejection is not semantic substitution.

### 4.3 Seeded Mutation continues to earn its place

Fresh mutation found two language-generalization gaps:

- RU truncated `компани` failed protocol→companies routing;
- EN transposition `bgein` failed navigation.

Class-level fixes only:
- bounded RU company stem normalization;
- `begin` added to the conservative known lexeme list;
- no global fuzzy matching.

## 5. CAPITAL OS STAGE AFTER v1.2A

Ask is now more than a deterministic question router. It has accumulated the following reasoning properties:

`Source-bound → Change + Salience → Owner Brief → Exposure Synthesis → Company Understanding → Semantic Substitution Safety`

Visible maturity should still remain **Synthesizing**. v1.2A is a trust/safety hardening capability, not a user-visible intelligence-level promotion.

Permanent Interface Evolution Law remains:

> UI maturity advances only after capability is proven. The visible dialogue surface should become smarter as earned intelligence grows, but never before proof.

## 6. v1.2B — NEXT PRIMARY OBJECTIVE

New branch started from the exact v1.2A production merge SHA:

`agents/ask-intent-contract-v1.2b-20260815`

Primary objective:

**Intent Contract Firewall v0.1 — create the safe interface required before model-assisted natural-language understanding can be introduced.**

The current deterministic ceiling is increasingly visible: `agents/console/app.js` simultaneously understands free-form language and executes intent routing, causing lexeme/router patch growth as language variety expands.

The next justified architecture is Option D in bounded form:

`natural language → structured intent candidate → deterministic intent validator/firewall → existing deterministic evidence-bound answer layer`

The model, when introduced later, must be replaceable and constrained to producing structured understanding only.

### Allowed future model responsibility

Only propose a bounded structured envelope such as:

- `intent`
- `entities`
- `timeframe`
- `comparison`
- `requestedMetric`

### Explicitly forbidden model responsibility

The model must NOT:

- invent or return facts;
- assign answer confidence;
- select source artifacts as truth;
- perform calculations that bypass deterministic source logic;
- create wallet or capital authority;
- sign or execute transactions;
- mutate methodology/security policy;
- bypass Semantic Safety or Output Guard.

The deterministic layer remains responsible for source binding, answer construction, confidence class, safety and authority.

## 7. v1.2B DELIVERY DISCIPLINE

Do not connect a free-form model before the contract itself is proven.

First implementation target:

1. browser-safe Intent Contract module;
2. strict allow-list schema / validator;
3. reject unknown keys, invalid intents, invalid entity shapes, unsupported timeframes and any authority-like fields;
4. deterministic structured-intent routing into existing answer functions;
5. frozen contract tests including malicious / over-authoritative candidates;
6. integrate the contract test into the existing canonical Experience workflow;
7. no user-visible maturity promotion until model-assisted understanding is actually proven better than deterministic routing.

No second Brain, no second source of truth, no execution authority.

## 8. OWNER OPERATING DIRECTIVE

Owner authorized merge of PR #63 and instructed: `ок мерджи и делай далее`.

Interpretation under existing operating rules:
- production merge #63 explicitly authorized and completed;
- continue ordinary v1.2B development autonomously through diagnose → branch → patch → tests → PR;
- stop again only at the next meaningful production merge / authority boundary.

Current authority remains:

**executionAuthority = none**
