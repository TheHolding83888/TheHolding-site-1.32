# THE HOLDING — MASTER CONTINUITY / ASK THE HOLDING v0.5 PRODUCTION GREEN
## Snapshot: 2026-08-14 ~22:55 (+03)
## Priority: CURRENT PRODUCT CONTINUITY DELTA

> Conflict rule: for changing facts, live GitHub `main`, fresh generated production JSON and exact workflow evidence outrank this prose checkpoint.

# 0. EXECUTIVE STATE

Ask The Holding v0.5 is now production GREEN.

The product direction remains deliberately conservative:
- Ask is a read-only conversational interface into The Holding OS;
- no LLM/model backend was added;
- no wallet/signing/transaction/capital authority was added;
- no automatic approval or execution was added;
- persistent Conversation Learning remains OFF;
- Answer Contract remains source-bound and fail-closed.

The important shift in v0.5 is not “more chatbot features”. The shift is that Ask now talks to the real governance/intelligence chain of The Holding OS instead of deriving pseudo-proposals from raw Brain cases.

# 1. PRECEDING PRODUCTION BOUNDARY CLOSURE

Before v0.5, the unified OS Lab production proof was closed.

Canonical live UI topology:
- `/` = normal The Holding homepage;
- `/agents/` = unified The Holding OS Lab;
- `/agents/console/` = legacy redirect into `/agents/#ask-the-holding`.

A false RED production smoke was traced to stale-SHA coupling: the smoke waited for Cloudflare build evidence on an exact merge SHA, while automatic Project Memory/Security commits could advance `main` before Cloudflare completed.

The repair changed the proof contract so a later successful production build can satisfy the smoke only when GitHub proves the deployed `main` is a descendant containing the merge under test. This preserves release integrity while avoiding false negatives from legitimate autonomous descendant commits.

A second latent invariant issue was also repaired: Production Boundary had hard-coded `app.js?v=0.4`, which would have made every future legitimate Ask version look like a boundary violation. The corrected invariant requires the canonical Ask asset path with versioned cache-busting, while allowing the version to evolve.

The unified OS Lab final GREEN continuity was already preserved separately in:
`THE_HOLDING_MASTER_CONTINUITY_2026-08-14_2227_UNIFIED_OS_LAB_FINAL_GREEN.md`

# 2. ASK v0.5 — WHY IT WAS JUSTIFIED

After the Claude-review absorption work, the OS already had a real downstream governance chain:

`Brain → Learning → Proposal → Builder → Guardian`

Fresh canonical machine state around this release:
- observed active Learning cases: 21;
- decision-worthy: 3;
- data-hygiene: 18;
- active Proposal items: 3;
- APPROVED Proposal items: 0;
- Builder candidates: 0;
- productionMutationAuthorizedCount: 0;
- Guardian research-only: 0;
- Guardian sandbox-build authorized: 0;
- Guardian production-mutation authorized: 0;
- executionAuthority: `none`.

Before v0.5, Ask could read Brain/Learning but the question “what does the system propose?” still effectively came from raw Brain cases rather than the actual decision-eligible Proposal queue.

That created a product/OS mismatch:
- the machine intelligence correctly filtered 21 observations into 3 decision-worthy items;
- the conversational interface did not yet expose that filtering correctly.

v0.5 closes that gap.

# 3. PR #53 — ASK THE HOLDING v0.5

Pull request:
`#53 — Ask The Holding v0.5: synthesize OS governance`

Merge SHA:
`0b4bc459f3ced23e995fa6a0b8c161051c155246`

Final production diff contained exactly two product files:
- `agents/console/app.js`
- `agents/index.html`

No temporary integrator/workflow/snippet files were present in the final PR.

# 4. WHAT v0.5 ADDED

## 4.1 Real governance source binding

Ask now loads and reasons from the canonical:
- Proposal Work Queue;
- Builder Candidate Queue;
- Guardian state.

It checks governance coherence before presenting Proposal/authority facts.

Questions such as:
- “Что система предлагает?”
- “Почему только 3 proposal?”
- “Что уже одобрено?”
- “Есть ли Builder candidates?”
- “Что разрешает Guardian?”
- “Может ли система что-то выполнить?”

now use the actual OS governance chain rather than synthetic interpretations of raw Brain observations.

## 4.2 Decision-quality explanation

Ask can explain the live filtering logic:

`21 observed → 18 data-hygiene → 3 decision-worthy`

This directly reflects the Experience Quality Gate introduced after the external architecture review.

The product principle is therefore visible to the user:

**The system can observe broadly while asking the owner to decide narrowly.**

## 4.3 Authority explanation

Ask can expose the current authority boundary from machine state:
- no owner-approved active Proposal;
- no Builder candidate;
- no Guardian production mutation capability;
- no execution authority.

It must not imply autonomy merely because Proposal/Builder/Guardian exist.

## 4.4 Grounded company comparison

v0.5 adds deterministic comparison of two explicitly named companies using current validated Reference APR / coverage where available.

The answer must frame this as a comparison of current productive capacity / Reference APR, not realised historical investment performance.

## 4.5 Better company follow-up context

Once a company is in conversation context, short follow-ups can route naturally into existing grounded data surfaces, including questions about:
- Rewards;
- Embedded Yield;
- entry / Strategy Entry;
- historical/current Productivity context where available.

This improves conversational continuity without adding a general-purpose model.

## 4.6 OS Lab quick prompts

The unified `/agents/` OS Lab quick prompts were refreshed around real OS questions, including company comparison, Proposal filtering and execution authority.

# 5. ANSWER CONTRACT / PRIVACY / LEARNING BOUNDARIES PRESERVED

v0.5 does not weaken the v0.4 Answer Contract.

Canonical Answer Contract remains:
- `version`;
- `language`;
- `confidenceClass`;
- `sourceArtifacts[]`;
- optional source `generatedAt`;
- `topic`;
- `grounded`.

Confidence classes remain:
- `measured`;
- `partial`;
- `warming`;
- `unknown`.

Fail-closed law remains:
if an answer would look factual but cannot map to a known source artifact, Ask must return explicit uncertainty/unknown rather than invent a fact.

Local answer-quality measurement remains bounded:
- rolling 30 days;
- maximum 500 non-content events;
- no raw question/answer content in the quality-event schema;
- repeated unknowns represented by local salted fingerprint + coarse topic/language/count.

Persistent public Conversation Learning remains OFF:
`LEARNING_INTAKE_ENABLED=false`

No new `/api` call was added by v0.5.

# 6. DELIVERY / VALIDATION EVIDENCE

A temporary fail-closed candidate integrator was used to validate the generated product candidate.

Successful candidate run:
`31834286877`

It verified:
- integrator syntax;
- generated `app.js` syntax;
- governance/source/privacy contracts;
- Production Boundary;
- publish allowlist limited to the two intended product files.

Important engineering discipline:
several earlier candidate runs failed safely before final GREEN. Failures included generator syntax/anchor/verifier assumptions. No failed candidate was merged merely because later syntax became valid.

After candidate GREEN, the final branch was rebuilt cleanly from fresh `main` using only the two validated product blobs.

PR #53 pre-merge proof:
- Production Boundary: SUCCESS;
- Cloudflare preview build gate: SUCCESS;
- external Workers Build: SUCCESS;
- Cloudflare PR Version ID: `2f957b67-156f-437e-8c60-524431df08ee`.

Post-merge production proof:
- merge SHA: `0b4bc459f3ced23e995fa6a0b8c161051c155246`;
- Cloudflare production build: SUCCESS;
- production Version ID: `eb1b070e-1974-4792-b11a-2a86ecc2eff9`;
- Production homepage smoke: SUCCESS.

The post-merge smoke validates the live production topology after the exact v0.5 release.

# 7. CURRENT MACHINE STATE AROUND THIS CHECKPOINT

Project Memory `CURRENT.md` refreshed after the release and currently represents machine state around `2026-08-14T19:46:40.543Z`.

Current cognitive/governance summary at that point:
- Cognitive Stack: WATCH;
- Security: WATCH, Critical 0 / High 2 / Medium 1;
- Grounded Brain: WATCH;
- ChatGPT Bridge: WATCH, 21 cases / 23 evidence / noExecution true;
- Learning: READY, 21 active cases, 2 owner decisions, 0 settled outcomes, 0 lessons;
- Proposal: WATCH, 3 active, 0 APPROVED, 21 SUPERSEDED;
- Builder: READY, 0 candidates;
- Guardian: READY, 0 research-only / 0 sandbox-build / 0 production-mutation authorizations.

Do not freeze these counts forever. For later sessions, live machine artifacts outrank this checkpoint.

# 8. PRODUCT DIRECTION AFTER v0.5

The next Ask milestone should NOT be “add another batch of deterministic phrases” by default.

The correct next loop is:

`use Ask as a real user`
→ `observe MEASURED / PARTIAL / WARMING / UNKNOWN`
→ `identify repeated unresolved questions and broken follow-ups`
→ `separate routing gaps from knowledge/data gaps`
→ `improve the smallest justified capability`
→ `measure again`

The existing 30-day local answer-quality window exists specifically to make this decision evidence-driven.

A future LLM/RAG/retrieval/backend capability should be justified by measured conversation friction, not by architecture fashion.

Likewise, do not activate persistent Conversation Learning merely to make Ask feel “more AI”. The safety/privacy activation gates remain valid.

# 9. NEXT PRIMARY OBJECTIVE

Primary product objective after v0.5:

**Deep real-use testing of Ask The Holding as the conversational interface to The Holding OS.**

Focus areas to probe with real questions:
- natural entity resolution;
- ambiguous company/protocol names;
- multi-turn follow-up continuity;
- cross-source synthesis;
- “why / what changed / what matters now” questions;
- comparisons;
- Proposal/Builder/Guardian explanation;
- current-vs-historical metric distinction;
- UNKNOWN/PARTIAL behavior;
- confidence/source clarity.

Only real recurring gaps should justify v0.6 architecture.

# 10. HARD BOUNDARIES TO PRESERVE

Until explicitly changed by a separate owner-approved architecture decision:
- executionAuthority = none;
- no wallet signing;
- no transaction execution;
- no autonomous capital movement;
- no automatic production merge/release;
- no automatic methodology/policy mutation;
- no persistent public Conversation Learning activation;
- no public-user trust promotion into canonical truth;
- no personalized buy/sell/hold/allocation advice;
- no silent conversion of unknowns into zeros;
- no duplicate Proposal path outside the canonical decision-eligible queue.

Canonical product principle after this release:

**Ask The Holding should increasingly feel like a conversation with The Holding OS – but every increase in conversational power must remain grounded in verified state, measured friction and explicit authority boundaries.**
