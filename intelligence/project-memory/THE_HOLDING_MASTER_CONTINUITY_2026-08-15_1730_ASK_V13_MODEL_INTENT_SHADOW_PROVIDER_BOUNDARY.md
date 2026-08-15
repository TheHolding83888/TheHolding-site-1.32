# THE HOLDING — MASTER CONTINUITY
## 2026-08-15 17:30 (+03)
## Ask v1.3 MODEL-ASSISTED INTENT SHADOW — PROVIDER BOUNDARY / OWNER ACTION REQUIRED

## 0. STATUS

Ask v1.2B · Intent Contract Firewall remains **PRODUCTION GREEN**.

Production merge SHA:

`c9c8697af934bea16acb3d2869ebe0ced9d6c2fd`

Post-merge production proof and Cloudflare deployment are recorded in:

`THE_HOLDING_MASTER_CONTINUITY_2026-08-15_1720_ASK_V12B_PRODUCTION_GREEN_MODEL_SHADOW_START.md`

The next primary objective, **Ask v1.3 model-assisted intent shadow mode**, has begun on an isolated branch and has reached a real external provider/account boundary.

No model output has entered the live Ask answer path.

Hard authority remains:

**executionAuthority = none**

---

## 1. v1.3 OBJECTIVE

Target architecture:

`raw natural language`
→ `untrusted model intent candidate`
→ `production Intent Contract Firewall`
→ `shadow evaluation / comparison`
→ `deterministic Ask remains sole answer authority`

The model is being evaluated only for language understanding:

- paraphrases;
- noisy RU/EN;
- typo tolerance;
- intent classification;
- entity extraction;
- timeframe / comparison / metric extraction.

The model is NOT allowed to:

- answer the user;
- invent facts;
- select source truth;
- assign factual confidence;
- create execution authority;
- create/sign transactions;
- mutate production/methodology/security policy;
- bypass Semantic Safety, Intent Contract, Answer Contract or Output Guard.

Visible maturity remains **Synthesizing**.

---

## 2. ISOLATED DEVELOPMENT BRANCH

Branch:

`agents/ask-model-intent-shadow-v1.3-20260815`

Original base:

`05dda47a37fb67ea31e0ba3488fa7e5a144e0cd7`

This branch is development-only. No PR is ready and no merge should occur until a live shadow provider is actually proven and the full benchmark is reviewed.

Current branch head at this checkpoint:

`3bd251dd3b4e57055f6f5fd80852e47c129e97bb`

---

## 3. DURABLE v1.3 DEVELOPMENT FILES PREPARED

### 3.1 Shadow corpus

`verification/ask-experience/corpus-model-intent-shadow-v0.1.json`

26 synthetic cases covering:

- owner brief EN/RU;
- change salience / noisy language;
- concentration EN/RU;
- company understanding;
- company productivity;
- protocol APR;
- Rewards;
- Embedded Yield;
- Strategy Entry;
- Learning;
- Proposal / Governance;
- navigation typo;
- execution/authority requests;
- purpose drift;
- realised cash flow;
- maturity;
- guaranteed future APY;
- exact future hack probability;
- pre-tracking income;
- noisy RU productivity;
- noisy EN rewards;
- mixed RU/EN change request.

Origin:

`synthetic-model-shadow`

Properties:

- releaseGateEligible: false
- generated/model strings are not Capital OS truth
- unsupported semantic cases must remain `unknown`
- authority cases must remain `authority-boundary`

### 3.2 Provider-neutral shadow evaluator

`verification/ask-experience/model-intent-shadow-v0.1.mjs`

Current evaluator version:

`0.2-model-intent-shadow-evaluation`

Properties:

- imports the production Intent Contract;
- model/provider is untrusted;
- candidate is parsed then validated through the production firewall;
- compares intent / metric / timeframe / comparison / entities against expected shadow semantics;
- detects forbidden field leakage;
- records answerAuthority = `deterministic-ask-only`;
- records executionAuthority = `none`;
- supports a bounded case limit for low-cost transport probes;
- fail-fast after first infrastructure transport failure;
- sanitizes/bounds transport errors before logs;
- distinguishes transport RED from model-quality miss;
- current transport adapter = `copilot-cli`;
- model setting defaults to `auto` so provider/model selection is replaceable.

### 3.3 Shadow policy

`verification/ask-experience/model-intent-shadow-policy-v0.1.md`

Canonical policy now explicitly says:

- provider is replaceable;
- no provider is source truth;
- existing deterministic ChatGPT Bridge is NOT repurposed;
- no long-lived model API secret should be introduced silently;
- no paid external provider should be enabled without owner authorization;
- provider/account failures fail closed;
- model does not control live retrieval or answers;
- UI maturity does not advance during shadow evaluation.

### 3.4 Transient candidate workflow

`.github/workflows/ask-model-intent-shadow-candidate.yml`

This workflow is deliberately development/transient and must not survive as a duplicate permanent validation loop if v1.3 graduates.

Current permissions are narrowly scoped:

- `contents: read`
- `copilot-requests: write`

It:

1. checks out exact branch revision;
2. re-proves production Intent Contract;
3. installs current GitHub Copilot CLI;
4. runs one or N no-tools shadow cases;
5. verifies no answer/execution authority if inference succeeds.

The model receives no repository tools in the classification call (`--available-tools=`).

---

## 4. PROVIDER DISCOVERY — EXISTING THE HOLDING INFRASTRUCTURE

### Existing deterministic ChatGPT Bridge

`intelligence/brain-chatgpt-bridge-README.md` explicitly describes the current bridge as:

- no OpenAI API;
- no API key;
- no model call;
- no network dependency;
- deterministic public handoff for manually triggered ChatGPT interpretation.

Therefore v1.3 must not silently mutate that organ's meaning.

### Cloudflare runtime

Current `wrangler.jsonc` has no Workers AI binding.

The existing worker surface contains Learning Intake / site runtime logic but no existing AI inference provider.

Therefore there was no already-configured production model provider to reuse without making a new provider/billing/runtime decision.

---

## 5. FIRST PROVIDER ATTEMPT — GITHUB MODELS — REJECTED AS DURABLE PATH

GitHub Models was initially attractive because Actions historically supported model calls with short-lived workflow auth and no extra repository API secret.

First live workflow:

`Ask The Holding · Model Intent Shadow Candidate`

Run:

`31889767457`

Job:

`95024209503`

Head:

`29dcf0c0d1435cf8f9c04f7c9a5a258ad01dd901`

Production Intent Contract re-proof:

- 28/28 PASS
- executionAuthority none

Initial evaluator attempted all 26 calls before transport diagnosis and returned:

- acceptedByFirewall: 0
- inferenceOrParseErrors: 26

This exposed a diagnostic weakness: an infrastructure-class failure should not generate 26 wasted requests.

### Class-level diagnostic fix

Evaluator was changed to:

- fail fast after first transport error;
- log only sanitized/bounded transport error information;
- distinguish infrastructure failure from model-quality failure.

Fresh diagnostic run:

`31889840763`

Job:

`95024384402`

Head:

`e8933dbb7af680b576c5d86457e7f6de00035348`

Exact provider response on first case:

- HTTP 410
- error code: `github_models_retirement_brownout`
- message stated GitHub Models was unavailable as part of scheduled retirement/brownout behavior.

Official GitHub retirement information then confirmed that GitHub Models was being fully retired and therefore must not be selected as the durable v1.3 dependency.

Architecture decision:

**GitHub Models is rejected as the durable v1.3 provider.**

Do not revive it simply because a temporary endpoint later responds.

---

## 6. SECOND PROVIDER PATH — GITHUB COPILOT CLI

Official current GitHub architecture supports Copilot CLI programmatically in GitHub Actions and allows short-lived `GITHUB_TOKEN` authentication with a dedicated `copilot-requests: write` permission, subject to Copilot access/policy/billing eligibility.

This is materially preferable to adding a long-lived external API key for the first shadow proof.

A single-case no-tools probe was created before attempting the full 26-case corpus.

### Probe run

Run:

`31889889977`

Job:

`95024497731`

Head:

`9d9521cf78cb456b4ae58c900dce6c361b2cf683`

Verified by runner:

- Contents: read
- CopilotRequests: write
- Metadata: read
- Copilot CLI package installation: SUCCESS
- production Intent Contract: 28/28 PASS

The actual Copilot model request returned:

**`Access denied by policy settings`**

The response explained that Copilot CLI policy/subscription/administrator access may be preventing the request.

Thus the transport wiring itself reached GitHub Copilot correctly, but model access is blocked outside repository code.

---

## 7. FINAL FAIL-CLOSED HARNESS PROOF AT OWNER BOUNDARY

The ad-hoc probe was then replaced by the provider-neutral evaluator itself.

Current branch head:

`3bd251dd3b4e57055f6f5fd80852e47c129e97bb`

Run:

**`31890001432`**

Job:

**`95024762529`**

Exact properties confirmed:

- `copilot-requests: write` granted;
- Copilot CLI installs successfully;
- production Intent Contract 28/28 PASS;
- shadow selectedCases = 1;
- model transport = `copilot-cli`;
- model = `auto`;
- answerAuthority = `deterministic-ask-only`;
- executionAuthority = `none`;
- forbiddenFieldLeakCount = 0;
- evaluator fails after exactly one transport attempt;
- error is sanitized and classified as:
  - `transport:policy-denied`
  - underlying GitHub message: `Access denied by policy settings`.

No model candidate was accepted because the provider request was denied before inference.

This is a clean, intentional fail-closed state.

---

## 8. CURRENT EXTERNAL OWNER BLOCKER

Repository code cannot enable the required GitHub account / Copilot entitlement or policy.

Current external requirement is one of:

1. the GitHub account needs active Copilot access that includes Copilot CLI; and/or
2. the relevant GitHub Copilot CLI policy must be enabled for the account/organization path used by Actions.

The current error itself directs the owner to GitHub Copilot settings.

Do NOT work around this by:

- inventing a secret;
- committing a PAT;
- weakening workflow permissions;
- enabling a paid OpenAI/Anthropic/Foundry provider without owner approval;
- letting a model bypass the firewall;
- using a retired GitHub Models endpoint.

This is now a legitimate owner/product-cost/account boundary, not an engineering RED that can be autonomously repaired inside the repository.

---

## 9. EXACT RESUME AFTER OWNER ENABLES COPILOT ACCESS

Once owner confirms GitHub Copilot / Copilot CLI access is enabled:

1. re-run the current transient v1.3 shadow workflow at branch head or latest safe rebased head;
2. first run with limit = 1;
3. require:
   - Copilot request succeeds;
   - candidate JSON parses;
   - production Intent Contract accepts/rejects correctly;
   - no forbidden field leakage;
   - answerAuthority remains deterministic-only;
   - executionAuthority remains none;
4. then run a bounded 6-case cross-language/safety probe;
5. if GREEN, run all 26 cases;
6. review misses by class, not string-by-string;
7. build deterministic-router baseline on the same semantic groups and compare improvement;
8. preserve unsupported UNKNOWN and authority boundary;
9. remove the transient candidate workflow before final PR;
10. integrate any justified shadow verification into the canonical Ask Experience workflow rather than creating a second permanent orchestration loop;
11. fresh all-mode Safety/Semantic/Core/Mutation proof;
12. only then prepare v1.3 capability PR and stop at the next explicit production merge boundary.

No future merge authorization is implied by the earlier `мерджи и делай далее` used for PR #64.

---

## 10. OWNER UNKNOWN REMAINS UNCHANGED

Exactly three conceptual gaps remain unsupported regardless of model language skill:

1. purpose drift
2. productivity vs realised cash flow
3. maturity/reputation

Model assistance must not fabricate these missing canonical objects.

---

## 11. SHORT CANONICAL STATE

- Ask v1.2B Intent Contract = PRODUCTION GREEN.
- v1.3 model intent shadow architecture/harness = PREPARED on isolated branch.
- GitHub Models = rejected because retired.
- Copilot CLI = technically wired with no tools and short-lived GitHub Actions auth.
- Copilot inference = currently BLOCKED by external GitHub policy/subscription state.
- production Intent Contract remains GREEN.
- live deterministic Ask remains unchanged.
- model answer authority = none.
- executionAuthority = none.
- next required event = owner enables/obtains Copilot CLI access, then assistant reruns shadow automatically and continues the v1.3 cycle.
