# THE HOLDING — MASTER CONTINUITY
## Ask v1.3A PRODUCTION GREEN + v1.3B Compositional Model Shadow Start

**Checkpoint:** 2026-08-15 ~20:05 (+03)

## 1. Executive state

**Ask v1.3A · Compositional Understanding Foundation = PRODUCTION GREEN.**

The fixed-intent ceiling has been removed at the understanding-contract layer without granting the language/model plane answer, evidence, confidence, source-truth, methodology, policy, transaction, signing, wallet, or execution authority.

Canonical understanding path is now:

`natural language → bounded question decomposition → understanding firewall → capability / missing-primitive resolution → deterministic evidence plane`

Visible Ask maturity remains **Synthesizing**. Execution authority remains **none**.

## 2. Owner authorization and merge discipline

The owner explicitly issued a fresh **“мерджи”** command for PR #65. That authorization was consumed for PR #65 only and must not be reused for a later capability merge.

Before merge, exact-head guard detected that `main` had moved after the earlier proof:
- old proven PR head: `ce06cb5c288b8c1e1aa5e5f2088ef37a98a5d0c0`
- then-live `main`: `8d81c31c92f2951efaef70df101e7572b8914995`
- compare showed the only intervening delta was `intelligence/project-memory/CURRENT.md`

The stale head was **not** merged blindly.

Instead, the same five durable v1.3A blobs were rebuilt exactly over fresh `main`.

Fresh merge candidate:
- head `1bdce2384a85fced6625d7fa9a01eb9c5f7048c7`
- tree `56735dcd0aeb14b182000882d9bbcaee2397b075`
- base `8d81c31c92f2951efaef70df101e7572b8914995`
- ahead 1 / behind 0
- exactly five intended files

Exact-head merge guard used:
`expected_head_sha = 1bdce2384a85fced6625d7fa9a01eb9c5f7048c7`

PR #65 merged successfully.

**Merge SHA:** `b7ac8283385b384ac56e06ffaf902b28147f561c`

## 3. Durable capability delta

Exactly five durable files:

1. `agents/console/intent-contract.js`
2. `verification/ask-experience/intent-contract-test-v0.1.mjs`
3. `verification/ask-experience/evaluator-v0.1.mjs`
4. `verification/ask-experience/compositional-understanding-policy-v0.1.md`
5. `verification/ask-experience/corpus-compositional-pressure-v0.1.json`

No production `agents/console/app.js` change survived v1.3A.
No transient workflow survived.

## 4. Compositional contract semantics

New bounded understanding forms:
- `intent = composite`
- `intent = unsupported-decomposed`
- `operation`
- `scope`
- `decomposition[]`
- `missingPrimitives[]`

Current missing-primitive allow-list:
- `company-purpose`
- `realised-cash-flow`
- `maturity-reputation`
- `unmodeled`

The contract can describe what a question requires but cannot provide the answer.

Still forbidden at top-level and inside decomposition objects:
- answer / response text
- source selection / source preference
- evidence / citations
- confidence / grounded claims
- transactions / signatures / wallets / secrets
- authority / permissions / mandates
- methodology / policy mutation

Capability metadata remains:
- `canAnswer = false`
- `canSetConfidence = false`
- `canSelectSourcesAsTruth = false`
- `canExecute = false`
- `executionAuthority = none`

## 5. Two-sided epistemic quality

Existing hard trust target remains:

`false-MEASURED = 0`

v1.3A adds the mirror metric:

`false-UNKNOWN`

A false UNKNOWN occurs when a case is answerable by current capability/evidence but Ask returns UNKNOWN.

Do not collapse false-MEASURED and false-UNKNOWN into one vanity score. The system must prove both:
1. it does not claim knowledge it lacks;
2. it does not discard knowledge it already has.

## 6. Compound / multi-turn pressure evidence

Transient discovery run:
`31893047155`

Ten compound/multi-turn questions exposed the current deterministic router ceiling. Representative failure classes:
- purpose + current strategy → current strategy answered while purpose omitted;
- realised cash flow + productivity → productivity answered while cash-flow requirement omitted;
- compare + change → only one requested subpart represented;
- security + exact future probability → weak adjacent/public-knowledge partial rather than correct decomposition and unsupported boundary.

The fix was deliberately **not** ten phrase patches. The pressure corpus is durable evidence for a class-level v1.3B model/decomposition test.

## 7. v1.3A final exact candidate proof

Fresh pre-merge head after final memory/security-safe rebuild:
`1bdce2384a85fced6625d7fa9a01eb9c5f7048c7`

PR-specific proof on that exact head:
- Ask Experience run `31897026991`, job `95041796380` — SUCCESS
- Cloudflare preview build gate — SUCCESS
- Cloudflare Workers preview build — SUCCESS
  - Build ID `84eaf4b2-b65a-442d-837a-a2346935da73`
  - Version ID `a51862ec-2672-49c0-bfb2-d0353ca99ad0`
- PR mergeable true

Earlier full all-mode proof of identical five durable blobs:
- run `31893793795`
- job `95033879618`
- artifact `9249259571`
- digest `sha256:921b23c07765fac3b410e60d460c5b683333c9a868924fd8b470ea66ce7d56eb`
- Intent Contract 44/44 PASS
- Safety 8/8 PASS
- Semantic Safety 26/26 PASS
- Core 22/22 PASS
- Mutation 7/7 PASS
- Owner Unknown exactly 3
- selected release gates PASS
- executionAuthority none

## 8. Post-merge production proof

Exact merge SHA:
`b7ac8283385b384ac56e06ffaf902b28147f561c`

Post-merge production evidence on that exact SHA:

### Ask Experience
- run `31897130509`
- check/job `95042043740`
- conclusion **SUCCESS**

### Production Boundary
- run `31897130466`
- job/check `95042043715`
- conclusion **SUCCESS**

### Production Deployment Smoke
- run `31897130379`
- workflow conclusion **SUCCESS**

### Repository Integrity
- run `31897130361`
- check `95042043489` · `Observe repository integrity`
- conclusion **SUCCESS**

### Project Memory Bootstrap
- run `31897130338`
- conclusion **SUCCESS**

### Cloudflare production
- check `95042126410`
- conclusion **SUCCESS**
- Build ID `acb95e92-7d8d-4e4c-bd98-54b24e959d77`
- Version ID `f6abc213-9175-4a40-9c70-597c7adc3090`

Therefore v1.3A is not merely merged; it is production-proven.

## 9. Security state after merge

Security Sentinel correctly appended fresh machine state after the merge and advanced `main` without modifying v1.3A capability files.

Security commit:
`3e55b51100c94b29751ff9eb009096ae2ad069e7`

Parent:
`b7ac8283385b384ac56e06ffaf902b28147f561c`

Security snapshot:
- generatedAt `2026-08-15T17:01:30.224Z`
- Security Vault runCount `206`
- status `watch`
- 6 high-signal watch items
- 0 critical
- no new findings
- no resolved findings
- latest record `security/security-vault/2026/08/2026-08-15T17-01-30-224Z-e60c42ea0d.json`
- record hash `e95b13b492884839ac45dc539766bcd30b0a63074c1d7c524763896e5a99bd98`

This machine-state write must be preserved by all subsequent branches/rebuilds.

## 10. Development incident / permanent lesson

During isolated v1.3A development, an attempted partial contents-API edit accidentally replaced `agents/console/app.js` with an incomplete fragment on the isolated branch.

It never reached production. It was detected immediately and restored from the exact production blob.

Permanent lesson:
- contents API replaces whole files;
- for large production files, prefer exact blob/tree overlays or full verified replacement;
- never assume a snippet-style update is a patch;
- keep browser/runtime behavior unchanged while a new understanding foundation is still under proof.

## 11. Remaining Owner Unknown

Exactly three canonical Owner Unknown cases remain:
1. `owner-purpose-drift`
2. `owner-productivity-vs-cashflow`
3. `owner-maturity`

These remain UNKNOWN until canonical source objects exist. Do not solve them through semantic substitution.

## 12. Capital OS stage

Ask progression is now:

`Source-bound → Change/Salience → Owner Brief → Exposure Synthesis → Company Understanding → Semantic Trust Boundary → Intent Contract Firewall → Compositional Understanding`

Ask is now a materially deeper conversational intelligence surface over the Capital OS evidence plane, but the whole OS is not complete.

Maturity remains **Synthesizing**.
No Companion-ready or autonomous claim is justified yet.

## 13. NEXT PRIMARY OBJECTIVE — v1.3B Model-Assisted Compositional Shadow

Start isolated development immediately after this checkpoint.

Target architecture:

`natural language → model candidate (UNTRUSTED) → v1.3A Intent Contract firewall → compare with deterministic router / expected decomposition → NO answer authority`

The model is an understanding candidate generator only.

### Required v1.3B investigation first
Before choosing a provider, inspect live `main` for:
- GitHub Copilot / GitHub Models usage
- Workers AI
- OpenAI adapters
- existing provider abstractions
- existing secret names / environment wiring
- ChatGPT Bridge meaning and invariants
- Workers code and route boundaries

Do not hardcode secrets. Do not silently change the existing ChatGPT Bridge meaning if it still advertises no model call / no API requirement.

### Shadow-mode invariants
- raw human question may go to the model;
- model returns only a compositional understanding candidate allowed by v1.3A contract;
- candidate must pass firewall validation;
- model output is ephemeral evaluation evidence, not durable truth;
- deterministic Ask remains final answer path initially;
- model cannot answer;
- model cannot choose source truth;
- model cannot set confidence;
- model cannot grant authority;
- model cannot execute;
- unsupported semantic cases must remain `unsupported-decomposed` / UNKNOWN when required primitives do not exist;
- authority commands must remain authority-boundary;
- visible UI maturity remains Synthesizing until shadow proof demonstrates real capability gain.

### Shadow evaluation targets
Measure separately:
- decomposition coverage;
- omitted-subpart rate;
- unsupported/missing-primitive detection;
- over-decomposition rate;
- entity/scope/operation quality;
- false-MEASURED remains 0;
- false-UNKNOWN movement;
- deterministic-vs-model delta on noisy, compound and multi-turn human language.

The durable v1.3A compound pressure corpus is the first required pressure set.

## 14. Merge boundary for v1.3B

The owner’s PR #65 merge authorization has been consumed.

Develop/test v1.3B autonomously on isolated branches. Do not merge a future capability PR to `main` without a new explicit owner **MERGE** command.

## 15. New-chat resume procedure

A new chat/model must:
1. read live `intelligence/project-memory/CURRENT.md` from GitHub `main`;
2. read this checkpoint;
3. verify current live `main` because autonomous Security/Project Memory writes may have advanced it;
4. treat v1.3A as PRODUCTION GREEN;
5. resume primary work at **v1.3B Model-Assisted Compositional Shadow**;
6. inspect provider/model infrastructure before implementation;
7. preserve `executionAuthority = none` and all model-plane authority boundaries;
8. continue autonomously until a real RED, production/authority decision, or future MERGE boundary.
