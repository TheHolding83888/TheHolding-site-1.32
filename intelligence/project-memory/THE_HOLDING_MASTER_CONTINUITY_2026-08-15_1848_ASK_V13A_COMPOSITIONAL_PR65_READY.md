# THE HOLDING — MASTER CONTINUITY
## 2026-08-15 18:48 (+03)
## ASK v1.3A COMPOSITIONAL UNDERSTANDING / PR #65 PRE-MERGE READY

## 0. STATUS

Production remains:

**Ask v1.2B · Intent Contract Firewall = PRODUCTION GREEN**

Production merge SHA:

`c9c8697af934bea16acb3d2869ebe0ced9d6c2fd`

The next capability, **Ask v1.3A · Compositional Understanding Foundation**, has reached a clean, proven PR candidate after absorbing the external Claude architecture review.

PR:

`#65 · Ask v1.3A · Compositional Understanding Foundation`

Current pre-memory-refresh PR head at this checkpoint:

`2ea193655a6d5883d1ee3af9a9264dc87957aa33`

Important: writing this checkpoint to `main` and the automatic Project Memory Bootstrap will advance `main`. Therefore **do not merge the above head blindly after this checkpoint**. Rebuild/freshen the same five durable v1.3A blobs on the new exact `main`, rerun exact-head proof and PR checks, then require a NEW explicit owner MERGE command.

Hard authority remains:

- model answer authority = `none`
- executionAuthority = `none`
- no signing
- no transaction execution
- no autonomous capital movement
- no automatic allocation
- no methodology/security-policy mutation

Visible product maturity remains:

**Synthesizing**

---

## 1. WHY v1.3A EXISTS

The hard external Claude review identified the highest-value architecture risk after v1.2B:

> A fixed enum Intent Contract can make a model excellent at translating arbitrary language into the existing router menu while leaving the product capability ceiling unchanged.

This critique was accepted.

The immediate objective changed from:

`natural language → choose existing enum intent`

to:

`natural language → compositional question understanding → bounded domain primitives → missing-primitive resolution → deterministic evidence plane`

The model is still not allowed to answer, choose source truth, set confidence or execute.

The architecture goal is to let the understanding layer represent **what a question requires**, including compound questions and missing concepts, without leaking answer authority into that layer.

---

## 2. v1.3A COMPOSITIONAL CONTRACT DELTA

Durable production candidate file:

`agents/console/intent-contract.js`

For browser compatibility with existing production boot checks, the exported version string remains:

`0.1-intent-contract-firewall`

The semantic role is expanded to:

`compositional-question-understanding-firewall-only`

### New bounded intents

- `composite`
- `unsupported-decomposed`

### New question-plane fields

- `operation`
- `scope`
- `decomposition[]`
- `missingPrimitives[]`

Existing fields remain:

- version
- intent
- entities
- timeframe
- comparison
- requestedMetric

### Allowed operations

- none
- get
- compare
- summarize
- explain
- rank
- assess

### Allowed scopes

- unspecified
- system
- company
- cross-company
- protocol

### Initial bounded domain primitive vocabulary

- company-identity
- company-purpose
- current-strategy-book
- productivity
- rewards
- embedded-yield
- strategy-entry
- change-intelligence
- security-state
- learning-state
- proposal-state
- concentration
- realised-cash-flow
- maturity-reputation
- protocol-state
- navigation
- authority-boundary
- unmodeled

### Initial missing-primitive vocabulary

Deliberately small:

- company-purpose
- realised-cash-flow
- maturity-reputation
- unmodeled

`unmodeled` may include a short bounded concept label as diagnostic demand evidence only. It is not a source, fact, methodology or authority object.

---

## 3. COMPOSITIONAL VALIDATION RULES

The contract is intentionally strict.

### `composite`

Requires at least two decomposition items.

It cannot declare missing primitives. This represents a question whose requested components are known/requestable primitives.

### `unsupported-decomposed`

Requires:

- at least one decomposition item; and
- at least one explicit missing primitive.

Every declared missing primitive must also appear in the decomposition.

This allows structurally informative UNKNOWN/PARTIAL semantics:

> The question requires A + B. A exists. B is not yet modeled canonically.

### Nested decomposition objects

Only bounded fields are accepted:

- object
- entity
- operation
- concept

Maximum decomposition length: 6.

### Still forbidden everywhere

- answer / response text
- source / sourceArtifacts / sourcePreference
- evidence / citations
- confidence / grounded claims
- execution / action / transaction / tx
- signature / sign
- wallet / private key / seed phrase
- authority / permissions / mandate
- methodology / policy / mutation

Nested decomposition objects are checked against the same trust boundary.

Capability metadata remains:

- `canAnswer = false`
- `canSetConfidence = false`
- `canSelectSourcesAsTruth = false`
- `canExecute = false`
- `canDecomposeQuestion = true`
- `canReportMissingPrimitive = true`
- `executionAuthority = none`

---

## 4. CONTRACT PROOF

Permanent test:

`verification/ask-experience/intent-contract-test-v0.1.mjs`

Expanded compositional strict suite:

**44 / 44 PASS**

Test version:

`0.2-compositional-intent-contract-test`

It proves valid:

- legacy/simple known queries;
- two-known-primitive composite questions;
- purpose + current-strategy decomposition with explicit missing company-purpose;
- bounded unmodeled concept decomposition.

It rejects classes including:

- answer/response fields;
- confidence;
- sourceArtifacts;
- sourcePreference;
- execution/transaction/wallet/private key;
- authority/permissions;
- methodology/policy mutation;
- invalid operation/scope;
- decomposition attached to a simple intent;
- one-part composite;
- composite declaring missing primitives;
- unsupported-decomposed without decomposition;
- unsupported-decomposed without a missing primitive;
- missing primitive absent from decomposition;
- nested answer/source fields;
- unmodeled without concept;
- arbitrary concept attached to a known primitive.

---

## 5. TWO-SIDED EPISTEMIC EVALUATION

Existing permanent evaluator:

`verification/ask-experience/evaluator-v0.1.mjs`

was extended instead of creating a second evaluator.

New evaluator version:

`0.3-origin-scoped-two-sided-epistemic-evaluator`

Existing metric:

`false-MEASURED`

protects against claiming knowledge the system lacks.

New mirror metric:

`false-UNKNOWN`

measures cases where the annotated capability/evidence is answerable but Ask incorrectly returns UNKNOWN.

This directly addresses the new risk after Semantic Safety hardening: over-refusal.

Metrics remain origin-scoped. Do not collapse Safety/Core/Mutation/live-human into a single vanity score.

Target principle:

> The OS must prove both that it does not falsely claim knowledge and that it does not falsely discard knowledge it already has.

---

## 6. COMPOSITIONAL / MULTI-TURN PRESSURE CORPUS

New durable discovery corpus:

`verification/ask-experience/corpus-compositional-pressure-v0.1.json`

Version:

`0.1-compositional-pressure-corpus`

Origin:

`synthetic-compositional-pressure`

Release-gate eligible:

`false`

Ten pressure cases cover:

1. Monetra vs Defitea + recent material change;
2. RU concentration + recent change;
3. purpose + current strategy (known + missing);
4. realised cash flow + productivity (known + missing);
5. multi-turn company compare + change;
6. three-turn Yield Basis → companies → productivity comparison;
7. mixed RU/EN compound question;
8. factual APY + forbidden execution command;
9. maturity + evidence breadth;
10. security findings + exact future hack probability.

A transient development workflow was used only to collect this evidence and was deleted before the final candidate:

`.github/workflows/ask-compositional-pressure-candidate.yml`

It must NOT reappear as a permanent parallel orchestration loop.

---

## 7. PRESSURE RUN — WHAT IT ACTUALLY FOUND

Transient pressure run:

`31893047155`

Job:

`95032080715`

Head:

`1b3248dfcf01adb7ba287dff5358ff8ea1cbe4d7`

Artifact:

`9249055187`

Digest:

`sha256:a87b3cc1c94c9843433757a1fbf65a0c374f2aa7d83f088b3045952a77580864`

Confidence distribution across the 10 discovery cases:

- measured: 4
- partial: 4
- unknown: 2

The important result is not the count. The current deterministic router frequently loses subquestions.

Observed classes:

- compare + change → comparison answered, change omitted;
- concentration + change → concentration answered, change omitted;
- purpose + strategy → current strategy answered MEASURED, missing purpose omitted;
- realised cash flow + productivity → productivity answered MEASURED while the cash-flow primitive is not structurally represented;
- multi-turn compare + change → compare answered, change omitted;
- three-turn protocol → companies → productivity → generic UNKNOWN/fallback behavior;
- mixed RU/EN compound → one company metric answered, other components lost;
- factual APY + execute → authority boundary correctly dominates execution request;
- maturity + evidence breadth → safe UNKNOWN on maturity but answerable breadth subpart omitted;
- security + exact future probability → weak partial behavior rather than explicit known-security + unsupported-probability decomposition.

This strongly validates the Claude critique: the language/router layer can produce an apparently correct MEASURED/PARTIAL response while silently dropping part of a compound question.

Do NOT repair these ten strings individually.

They are durable pressure evidence for v1.3B model-assisted compositional understanding.

---

## 8. IMPORTANT ISOLATED PATCH RED / RECOVERY

During v1.3A development, a connector-level full-file patch mistake occurred on the isolated development branch only.

Attempting to edit the browser boot invariant via `update_file` replaced full `agents/console/app.js` with an incomplete fragment.

Bad isolated commit:

`58649e3a35f249cba1ea1d4fbe89d7a9ddebeb42`

The diff showed roughly 14 additions and 1862 deletions.

This **never reached main / production**.

Recovery was immediate and fail-closed using the exact original production blob rather than manual reconstruction.

Exact restored `app.js` blob:

`8f9a14715da6627968957dfc641d4bdf8e87819c`

Recovery tree:

`7c1b8ada1d303b497e12e7c34f959728f0638e34`

Recovery commit:

`a05fe1506c55ff0e83e225b18562bf2a29341af3`

The final architecture then avoided a browser `app.js` delta entirely: v1.3A remains backward-compatible with existing boot checks by retaining the production contract version string.

Permanent engineering lesson:

> For large connector-managed files, prefer exact blob/tree overlays or full verified replacements. Do not use a partial fragment as the content of `update_file`.

Final PR #65 has **no `app.js` change**.

---

## 9. CLEAN FINAL CANDIDATE DISCIPLINE

Autonomous Project Memory / Security writes advanced `main` while development was in progress.

Rather than merge stale branch history, a fresh final branch was built directly on current main with only the intended durable blobs:

`agents/ask-compositional-understanding-v1.3a-final-20260815`

Pre-checkpoint exact clean candidate:

`2ea193655a6d5883d1ee3af9a9264dc87957aa33`

Base:

`ec85cc42ae1e5594500d60ad89835220aed76776`

At PR creation:

- ahead: 1
- behind: 0
- commits: 1
- changed files: 5
- additions: 382
- deletions: 67
- mergeable: true after GitHub async mergeability calculation

Exactly five durable files:

1. `agents/console/intent-contract.js`
2. `verification/ask-experience/intent-contract-test-v0.1.mjs`
3. `verification/ask-experience/evaluator-v0.1.mjs`
4. `verification/ask-experience/compositional-understanding-policy-v0.1.md`
5. `verification/ask-experience/corpus-compositional-pressure-v0.1.json`

No transient workflow.
No `app.js` diff.
No Project Memory regression.

---

## 10. EXACT ALL-MODE PROOF — PRE-CHECKPOINT HEAD

Canonical all-mode run on candidate `2ea193...`:

Run:

`31893414033`

Job:

`95032956683`

Conclusion:

**SUCCESS**

Mutation seed:

`2026-08-31893414033-1`

Steps GREEN:

- Direct final-output safety guard;
- Compositional Intent Contract 44/44;
- Frozen Safety;
- Frozen Semantic Substitution Safety;
- Annotated Core;
- fresh Seeded Mutation;
- Owner Unknown discovery;
- selected release gates;
- provenance/evidence artifact upload.

Artifact:

`9249127646`

Digest:

`sha256:7d58cf81581e3e93d4235ad4db44581813c1e00767b13b86ff9b51c9bc5bc264`

Observed answer distributions remained consistent with the proven v1.2B baseline:

Safety:
- 8/8 final answers
- measured 5 / unknown 3

Semantic Safety:
- 26/26
- unknown 26

Core:
- 22/22
- measured 14
- unknown 3
- warming 1
- partial 4

Fresh Mutation:
- 7/7
- measured 6
- unknown 1

Owner Unknown:
- 12/12
- unknown 3
- partial 7
- measured 2

The new evaluator reports `false-UNKNOWN`; earlier exact proof on the same durable blobs confirmed Core / Safety / Semantic / Mutation all had falseUnknownCount = 0, while falseMeasuredCount remained 0.

---

## 11. PR #65 CHECKS — PRE-CHECKPOINT HEAD

PR-specific runs on head `2ea193...` include:

### Ask Experience PR/core

Run:

`31893546788`

Conclusion:

**SUCCESS**

Expected PR/core behavior:

- Output Guard GREEN
- Compositional Contract GREEN
- Semantic Safety GREEN
- Core GREEN
- Safety / Mutation / Owner Unknown skipped by PR/core mode because all-mode proof exists on exact same head
- selected release gates GREEN

### Production Boundary

Run:

`31893546957`

Conclusion:

**SUCCESS**

### Production Deployment Smoke / PR target

Run:

`31893547003`

Conclusion:

**SUCCESS**

This PR does not change the user-facing app.js or production routing surface; it establishes the compositional understanding contract and evaluation substrate.

---

## 12. COPILOT FREE — NOW LIVE AND PROVEN

The owner activated **GitHub Copilot Free** on personal account `TheHolding83888`.

No payment / Pro upgrade was required.

After activation, the previously policy-blocked Copilot CLI shadow probe was rerun.

Run:

`31890001432`

Rerun job:

`95030847599`

Result:

**SUCCESS**

Live proof:

- `copilot-requests: write` granted;
- Copilot CLI installed;
- model inference completed;
- selectedCases = 1;
- attempted = 1;
- acceptedByFirewall = 1;
- inferenceOrParseErrors = 0;
- infrastructureFailure = null;
- strictPassed = 1;
- forbiddenFieldLeakCount = 0;
- answerAuthority = `deterministic-ask-only`;
- executionAuthority = `none`;
- Shadow authority boundary PASS.

Therefore Copilot Free is now available as a replaceable zero-cost development model transport.

It is NOT a source of truth and The Holding architecture does not depend on it.

GitHub Models remains permanently rejected because retired.

---

## 13. NEXT AFTER v1.3A — v1.3B MODEL-ASSISTED COMPOSITIONAL SHADOW

Do not return to optimizing the old narrow enum-intent benchmark.

After v1.3A is production GREEN, the next isolated objective is:

**model-assisted compositional understanding in shadow mode.**

Target:

`raw owner language`
→ `untrusted model decomposition candidate`
→ `production compositional firewall`
→ `compare against annotated question structure`
→ `deterministic Ask remains sole live answer authority`

Use Copilot Free initially because it is now proven available and costs the owner nothing.

The model should be evaluated especially on the classes where current deterministic routing failed:

- compound questions;
- multi-turn entity/context carryover;
- known + missing primitive combinations;
- noisy RU;
- noisy EN;
- mixed RU/EN;
- causal/explanation requests;
- Owner Unknown / unmodeled concepts.

Do not give the model repository tools for pure question-understanding evaluation.

Do not allow it to answer, choose sources, set factual confidence or execute.

---

## 14. DETERMINISTIC ROUTER FREEZE CRITERION

Do not freeze the current parser merely because a model exists.

Freeze ordinary language-patch growth only after fresh evidence shows that model-assisted compositional understanding:

- materially beats deterministic routing on unseen hard/failing classes;
- preserves false-MEASURED = 0;
- preserves false-UNKNOWN = 0 on annotated answerable cases;
- preserves Semantic Safety;
- preserves authority boundaries;
- does not introduce forbidden-field leakage.

At that point the deterministic parser should become:

- fallback;
- baseline;
- safety reference;
- known-command path.

Future engineering should then grow domain capability rather than maintain two equally ambitious natural-language parsers.

---

## 15. DOMAIN PRIMITIVES REMAINING

Exactly three conceptual Owner Unknown gaps remain:

### Company Purpose / Purpose Drift

Requires an owner-declared canonical CompanyPurpose / success-criteria object. Do not infer purpose from current portfolio composition.

### Realised Cash Flow

Potentially reconstructible, but must use a real boundary-flow / realised-income ledger. Do NOT define it as `claims + withdrawals`.

Must distinguish principal/internal moves from income/distribution.

### Maturity / Reputation

Still no canonical methodology. Evidence breadth/freshness are descriptive abstractions, not maturity.

Do not create a fake score.

---

## 16. IMMEDIATE RESUME / MERGE DISCIPLINE

Because this checkpoint itself advances `main`, the next chat/assistant must NOT merge PR #65 at head `2ea193...` merely because its current proofs are green.

Exact next procedure:

1. let Project Memory Bootstrap refresh live `CURRENT.md` to this checkpoint;
2. fetch the resulting new `main` SHA;
3. rebuild/freshen final v1.3A candidate from that exact `main` using only the same five durable blobs;
4. update PR #65 head;
5. verify diff remains exactly five intended files and one clean commit relative to latest main;
6. run fresh exact-head all-mode Experience;
7. verify 44/44 contract, Safety/Semantic/Core/Mutation, falseMeasured 0, falseUnknown 0, Owner Unknown 3/12, artifact digest;
8. verify PR Experience + Production Boundary + deployment/preview gates on that exact head;
9. require a NEW explicit owner MERGE command;
10. merge with exact-head guard only after that command;
11. perform post-merge production proof;
12. write v1.3A PRODUCTION GREEN Project Memory checkpoint;
13. then start v1.3B compositional model shadow autonomously.

No prior merge authorization applies to PR #65.

---

## 17. SHORT CANONICAL STATE

- v1.2B production = GREEN.
- Claude fixed-enum-ceiling critique = accepted.
- v1.3A compositional contract = built and proven.
- decomposition + missing primitive semantics = bounded and authority-free.
- strict contract = 44/44 GREEN.
- false-UNKNOWN added to canonical evaluator alongside false-MEASURED.
- compound/multi-turn pressure corpus = durable discovery evidence.
- current router demonstrably drops compound subquestions; do not phrase-patch them.
- transient pressure workflow removed.
- isolated app.js patch RED fully recovered; no final app.js delta.
- clean PR #65 = exactly five durable files.
- exact all-mode pre-checkpoint head proof = GREEN.
- PR Experience / Production Boundary / smoke = GREEN.
- Copilot Free = activated and live inference probe GREEN.
- model answer authority = none.
- executionAuthority = none.
- next action = memory refresh → one final fresh-head rebuild/proof → explicit owner MERGE boundary.
