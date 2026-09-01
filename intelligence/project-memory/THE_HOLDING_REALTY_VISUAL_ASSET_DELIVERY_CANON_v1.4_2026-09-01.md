# THE HOLDING REALTY — VISUAL ASSET DELIVERY CANON
## v1.4 · FAST-PATH PRODUCTION OPERATING CONTRACT · 2026-09-01
### Exact owner source · exact consumer · capability-truth transport · presentation/transport separation · zero-loop execution · visual production proof

> **STATUS — CANONICAL FOR ALL REALTY IMAGE / BINARY DELIVERY TASKS**
>
> v1.4 supersedes v1.3 for new Realty image execution.
>
> v1.3 remains preserved as historical evidence and as the hardened failure-gate baseline. v1.4 exists because the 2026-09-01 production sequence proved a durable additional invariant: **image delivery is not one problem. It is four separate problems — source identity, binary transport, consumer mapping, and visual presentation — and they must never be collapsed into one another.**
>
> v1.4 also absorbs the former companion execution prompt. For an ordinary Realty image replacement, the owner should be able to attach **this one file + the intended image** and give the visual instruction. No second methodology file is required.

---

# 0. NEW-CHAT BOOT CONTRACT — ONE FILE, ONE IMAGE, ONE OBJECTIVE

If this file is attached in a new chat together with an image and the owner asks to put that image on The Holding Realty site, interpret the request as an **execution task**, not as a request to generate another image or merely explain how to upload one.

Default recovery path:

`LIVE CURRENT.md → latest continuity → Memory Routing Index → this v1.4 canon → exact live Realty consumer/CSS/runtime → exact GitHub/deployment evidence`

Mutable truth priority:

1. live GitHub `main`;
2. exact current tool schemas and permissions;
3. exact live Realty HTML/CSS/runtime/assets;
4. latest continuity;
5. this v1.4 canon;
6. older canons/branches/chat history.

For a bounded Realty image task, **do not load the whole project archive**. Read only the hot route and exact consumer evidence needed to execute.

If GitHub is connected and the owner has already authorized the bounded change, execute through PR/checks/merge/deploy without asking the owner to repeat the authorization.

---

# 1. CORE LAW — FOUR PLANES, NEVER CONFUSE THEM

Every image task has four independent planes:

1. **SOURCE** — the exact owner-approved input image;
2. **TRANSPORT** — how exact binary bytes reach GitHub safely;
3. **CONSUMER** — which exact HTML/CSS/runtime slot loads the asset at the target breakpoint;
4. **PRESENTATION** — crop, focal point, overlay, filter, opacity, brightness, theme and cache behavior.

A failure in one plane is **not evidence** that another plane failed.

Examples:

- correct file in GitHub + wrong-looking page → inspect presentation before retransmitting bytes;
- correct consumer path + old visual → inspect deployment/cache before re-uploading;
- tool lacks a local-file parameter → this does **not** mean “no GitHub access”;
- dark image on live site → this does **not** prove the source image is dark;
- owner uploaded a specific photo → this does **not** authorize generating a visually similar substitute.

This separation is the main v1.4 invariant.

---

# 2. SOURCE IDENTITY LAW — THE OWNER'S ATTACHMENT IS SACRED

If the owner says “use this image”, “upload this photo”, “put the attached photo into the banner”, or equivalent:

> **That exact attachment becomes SOURCE LOCK.**

Do not substitute:

- a generated image;
- an earlier generated variation;
- a visually similar repository asset;
- a stock image;
- a previous attachment;
- an image inferred from filename/history.

Do **not** invoke image generation/editing merely because an image is present. Image generation/editing is legal only if the owner explicitly asks to change/generate the pixels.

If the owner asks to deploy the provided photo to the site, **do not answer by returning a newly generated image into chat**.

Latest explicit owner instruction wins. Example:

- owner: “make it 10% darker”;
- later owner: “do not make it darker”;
- final locked instruction: **no darkening**.

Source proof should record, when practical:

- source file identity;
- dimensions;
- byte size;
- SHA-256;
- successful decode.

If the source is re-encoded for browser delivery, preserve the visual composition unless the owner explicitly approves a transform.

---

# 3. FAST PATH — NORMAL IMAGE REPLACEMENT SHOULD BE BORING

Default path for one Realty image replacement:

`RESTORE → CONSUMER LOCK → SOURCE LOCK → PRESENTATION INTENT → PRODUCTION-ASSET LOCK → TRANSPORT GATE → EXECUTION CONTRACT → ROUTE LOCK → EXECUTE → VERIFY → PR → CHECKS → MERGE → DEPLOY → VISUAL PROOF → GREEN`

Normal expected product diff:

- one new immutable image asset;
- one exact consumer reference **or** one scoped CSS consumer override;
- optional small CSS presentation adjustment only when needed;
- no transport artifacts;
- no unrelated files.

The task is not a research project. Once consumer, source, asset and route are locked, move forward.

After `ROUTE LOCKED`:

> **Discovery is closed.**

No old-branch archaeology, alternate formats, additional workflows, second transport designs, “one more check”, or speculative optimization unless a concrete execution failure legally opens the Failure Gate.

---

# 4. CONSUMER LOCK — FIND THE REAL SLOT ONCE

Before preparing repository bytes, identify the exact live consumer:

- route;
- DOM slot: `<img>`, `<source>`, `<picture>`, CSS `background`, CSS `content:url(...)`, or runtime replacement;
- target breakpoint/device class;
- current asset URL;
- responsive overrides;
- `object-fit` / `object-position` / background positioning;
- relevant filter/overlay/opacity/brightness;
- theme-specific rules;
- JS/runtime mutation if any.

**Semantic role comes from the live consumer, not the filename.**

A file named `physical`, `digital`, `hero`, or `real-world` is not proof of where it is actually rendered.

Once locked, do not rediscover the consumer unless later verification proves it was wrong.

---

# 5. PRESENTATION INTENT — DEFINE THE VISUAL GOAL BEFORE BYTES

Before encoding/uploading, freeze what the owner actually wants:

- preserve source brightness, or intentionally brighten/darken;
- preserve full composition, or allow bounded crop;
- focal side/subject that must remain visible;
- target device class;
- whether existing text overlay must remain readable.

### Crop law

If the owner wants minimal crop, **do not destructively crop source bytes by default**.

Prefer, in order:

1. keep the source composition;
2. use `object-position` / background positioning to choose which edge absorbs unavoidable `cover` crop;
3. adjust container behavior only if necessary and bounded;
4. re-crop/recompose source pixels only when explicitly requested or objectively required.

For a subject that should remain visible on the right, a right-biased focal position may let unavoidable crop fall mostly on the left.

### Brightness law

Do not bake brightness changes into source pixels unless requested. For card/hero balancing, non-destructive scoped CSS may be preferable because it is reversible and consumer-specific.

---

# 6. PRODUCTION-ASSET LOCK — ONE BROWSER ASSET, THEN STOP EXPERIMENTING

Prepare one production candidate and freeze:

- browser format;
- dimensions/aspect;
- focal composition;
- byte size;
- SHA-256;
- magic/container;
- successful decode;
- immutable content-addressed path.

If re-encoded/resized:

`SOURCE SHA-256 != PRODUCTION SHA-256`

That is normal.

Keep identities separate:

1. source identity;
2. production content SHA-256;
3. Git blob SHA;
4. deployed immutable URL bytes.

`Git blob SHA != content SHA-256`.

`file exists != correct bytes`.

After Production-Asset Lock:

- no format switching for transport convenience;
- no quality experimentation without an objective failure;
- no search for “maybe an old blob is easier”, except when the exact production bytes are already known to exist as a verified Git object.

---

# 7. GITHUB CAPABILITY TRUTH — NEVER SAY “NO ACCESS” WITHOUT CHECKING

Before claiming GitHub is unavailable, inspect the **current connector/tool capability**.

Distinguish these facts:

- repository read access;
- repository write/push access;
- branch/PR/merge access;
- Git object creation capability;
- local binary-file upload capability.

These are not the same thing.

> **“This connector action cannot accept a local binary path” does not mean “I have no GitHub access.”**

If the connector is present, check actual repository permissions/tool schemas once and report the exact limitation, not a generic access failure.

Never tell the owner to do the GitHub work manually merely because one convenient binary primitive is absent if another already-proven exact-safe repository route exists.

Do not promise a write that the current toolset cannot perform. If no exact-safe route exists, fail closed as `BLOCKED` rather than inventing one.

---

# 8. TRANSPORT GATE — DIRECT, EXACT, NO BASE64 THEATER

The transport goal is simple:

> **Move the locked production bytes into the repository exactly once, with byte identity preserved.**

## Route A1 — native local-file binary upload

If the active connector exposes a file parameter that accepts the local mounted source/production asset, use it.

## Route A2 — native Git blob creation

If the connector exposes `create_blob(content, encoding=base64)` or equivalent, it is a valid direct route **only when the Base64 payload is generated deterministically from the local bytes and submitted as one exact payload**.

Do not manually transcribe, reconstruct or reason over the Base64 text.

## Route A3 — verified existing Git object reuse

If the exact locked production bytes already exist as a verified Git blob, reuse that object in a fresh-main tree rather than retransmitting the binary.

This is a first-class direct route, not a workaround.

## Exceptional deterministic assembler

A temporary assembler/materializer is legal only if all direct exact-safe routes are concretely unavailable or fail for the locked payload.

It must remain deterministic and bounded.

### Absolute prohibition

> **Manual/model-mediated large Base64 chunk transport is forbidden.**

Do not split a large Base64 string into chat-authored chunks, repeatedly patch chunks, create multiple materializers, or use workflow churn to simulate a missing binary upload primitive.

If exact bytes cannot be transferred safely in the current environment:

`BLOCKED — exact binary transport unavailable`

Stop. Do not create architecture just to appear active.

---

# 9. EXECUTION CONTRACT — VISIBLE BEFORE FIRST PRODUCT WRITE

Before the first repository write for an image task, visibly emit:

```text
STATE: READY_TO_EXECUTE
OBJECTIVE: <one visual objective>
CONSUMER: <route + exact slot + breakpoint>
SOURCE: <exact owner attachment + proof>
PRESENTATION INTENT: <brightness/crop/focal requirements>
PRODUCTION ASSET: <format + dimensions + size + SHA-256 + immutable path>
TRANSPORT: <A1 / A2 / A3 / exceptional assembler>
TRANSPORT EVIDENCE: <why this exact route is supported>
EXPECTED PRODUCT DIFF: <exact allowed files/categories>
CSS: NONE or <one scoped reason>
BRANCH BUDGET: 1 product branch; temporary transport branch only if truly required
```

Then output:

`ROUTE LOCKED`

After this point, only actions that directly advance the next state are legal.

---

# 10. CSS / PRESENTATION TRIAGE — CORRECT BYTES CAN STILL LOOK WRONG

This was production-proven on 2026-09-01: the new hero binary reached the repository and the consumer referenced it correctly, yet the live page still looked too dark because desktop CSS applied both an image brightness filter and a strong overlay.

Therefore, when visual output is wrong after byte/consumer proof, inspect in this order:

1. target breakpoint;
2. `object-fit` / `object-position`;
3. image `filter`;
4. overlay pseudo-elements (`:before` / `:after`);
5. opacity/blend/background layers;
6. theme-specific overrides;
7. hover/focus overrides;
8. stylesheet cache identity / headers;
9. JS/runtime replacement.

### CSS is not the default fix

Do not change CSS just because an image differs visually. First prove which presentation rule conflicts with the owner objective.

When CSS is the proven cause:

- make the change consumer-specific;
- keep it small;
- do not touch mobile when the objective is desktop-only;
- do not touch neighboring banners unless asked;
- preserve text readability;
- prefer a tiny scoped override over retransmitting/reformatting the image.

A small wrapper stylesheet that imports a stable base and adds explicit scoped overrides is acceptable when it reduces risky retransmission and remains easy to understand.

---

# 11. CACHE LAW — DO NOT RE-UPLOAD A CORRECT IMAGE TO FIX STALE CSS

If GitHub and consumer are correct but live output looks stale:

1. confirm deployment completed;
2. inspect asset/CSS cache headers;
3. inspect stylesheet version/query identity when applicable;
4. hard refresh only as a verification aid;
5. do not retransmit the binary unless byte proof actually fails.

Immutable image assets should use content-addressed paths by default.

Text assets such as CSS may use controlled version/query changes when required by the existing deployment/cache model.

---

# 12. PRODUCT DIFF / BRANCH BUDGET — BORING IS GOOD

Normal image task:

- **one clean product branch**;
- **one PR**;
- **one coherent commit or minimal commit sequence**;
- temporary transport branch only if concretely required by an exceptional deterministic assembler.

Preferred final diff:

- new immutable asset;
- exact consumer mapping;
- scoped CSS only if needed;
- zero `.tmp` files;
- zero Base64 chunks;
- zero temporary workflow/materializer files;
- zero unrelated JS/data/memory changes.

Memory/canon hardening belongs in a separate documentation PR from the product image PR.

If the final diff exceeds the frozen contract, stop before PR and remove the out-of-scope changes.

---

# 13. MOVING MAIN / EXACT-HEAD LAW

The Holding has autonomous writers that may advance `main` during a task.

At material gates check once:

1. exact product head;
2. fresh `main` head;
3. merge-base overlap with the image scope;
4. required checks on the exact head.

Do not repeatedly rebase because unrelated project-memory/generated data advanced `main`.

`behind != broken`.

Overlap is the question.

Merge with expected-head protection when available.

---

# 14. FAILURE GATE — ONE PROVEN REPAIR, THEN STOP

The first required RED after Route Lock means:

`STATE: FAILURE_GATE`

Immediately:

- stop new writes;
- read exact failed run/job/step/logs;
- classify the failure plane;
- preserve all locked facts not disproven;
- propose one mechanical repair only.

Required status:

```text
STATE: FAILURE_GATE
FAILED RUN/OPERATION: <exact id/action>
FAILED STEP: <exact step>
ERROR/EVIDENCE: <specific evidence>
FAILURE PLANE: SOURCE / TRANSPORT / CONSUMER / PRESENTATION / DEPLOYMENT / UNKNOWN
LOCKED FACTS STILL VALID: <list>
PROPOSED REPAIR: <one bounded repair>
NEW ROUTE: false
```

One repair is allowed for a known mechanical cause.

A second RED in the same stage means:

`BLOCKED`

No third attempt. No new lane. No new workflow. No branch multiplication. No hidden continuation.

---

# 15. PROOF LADDER — GREEN MEANS THE USER CAN SEE IT

Before PR/merge:

- source identity is correct;
- production manifest is proven;
- repository bytes are exact;
- consumer mapping is exact;
- presentation scope matches objective;
- bounded diff matches contract;
- exact-head checks pass.

After merge:

1. merge commit exists;
2. fresh `main` contains intended asset/consumer/presentation rules;
3. deployment succeeds;
4. direct immutable asset serves intended bytes when applicable;
5. target production route loads;
6. target breakpoint renders intended source;
7. crop/focal composition matches owner intent;
8. brightness/overlay matches owner intent;
9. out-of-scope breakpoints/surfaces remain correct;
10. visual acceptance is recorded.

Only then:

`PRODUCTION-PROVEN GREEN`

`CI GREEN != visual production truth`.

If the owner explicitly says they can see the correct change on the live site, that is valid visual acceptance evidence.

---

# 16. OWNER-FACING STATUS CONTRACT

Use short, truthful statuses:

- `EXECUTING — <next state>`;
- `VERIFYING — <exact proof>`;
- `FAILURE_GATE — <failed operation>`;
- `REPAIR_READY — <one mechanical repair>`;
- `BLOCKED — <exact blocker>`;
- `PRODUCTION-PROVEN GREEN`.

Do not say “still working” when no tool/action is running.

Do not say “no GitHub access” unless current capability evidence actually proves that.

Do not say “done” merely because a PR merged if deployment/visual proof is still pending.

---

# 17. SELF-OBSERVER — ANTI-LOOP GUARD

After `ROUTE LOCKED`, before every substantial action ask:

1. What exact state am I in?
2. What is the single next legal state?
3. Does this action directly advance it?
4. Am I rechecking a locked fact?
5. Am I creating a new branch/format/workflow/lane without a proven failure?
6. Am I confusing transport failure with presentation failure?
7. Am I confusing missing binary-upload primitive with missing GitHub access?
8. Am I about to substitute another image for the owner's source?
9. Has the owner issued a newer instruction that supersedes an older one?

If drift is detected:

`PROCESS DRIFT DETECTED — returning to the locked next state.`

Then continue only on the legal route.

---

# 18. PRODUCTION-PROVEN 2026-09-01 REFERENCE

The following sequence is historical evidence for the v1.4 laws; it is **not** a template of SHAs to reuse blindly.

## A. Upper desktop/laptop hero — transport succeeded, presentation initially failed

- The bright hero asset was successfully placed in the repository and referenced by the desktop/laptop hero consumer.
- The live page still looked too dark.
- Root cause was CSS presentation: image brightness filtering plus a strong dark overlay.
- Subsequent bounded CSS-only repairs brightened the hero without retransmitting the binary.

Durable lesson:

> **Correct bytes + correct consumer + wrong visual = presentation investigation, not transport restart.**

## B. Right second-row `VIRTUAL REALTY` banner

A scoped dark-theme CSS correction raised image brightness and softened the dark violet overlay without changing the image or mobile surface.

Durable lesson:

> **When the source is right, visual parity can be a small consumer-specific presentation change.**

## C. Left second-row `REAL-WORLD REALTY` banner

The owner supplied a specific waterfront-villa photo and explicitly required that exact photo, not an AI-generated substitute. The final production change:

- added a new immutable owner asset;
- kept the owner photo undarkened;
- used right-biased framing so unavoidable cover crop fell mainly on the left;
- applied the new asset through the exact physical-card desktop consumer/presentation rule;
- preserved mobile;
- reached production and received explicit owner visual acceptance.

Durable lesson:

> **Owner attachment identity and focal composition are first-class requirements.**

---

# 19. MEMORY ROUTING / PRECEDENCE

For future Realty image/media tasks, live project memory should route:

`CURRENT → latest continuity → Memory Routing Index → Realty Visual Asset Delivery Canon v1.4 → exact live consumer/evidence`

v1.4 supersedes v1.3 for new execution.

Keep v1.3, v1.2 and older canons as historical evidence. Do not delete them.

Do not create v1.5 for ordinary image peculiarities or normal implementation repairs. A future canon version requires another durable change to the architecture, authority boundary, transport capability model, or proof contract.

---

# 20. SHORT FORM — 25 IRON RULES

1. One image objective at a time.
2. Owner-provided attachment is the source lock.
3. Never substitute a generated image unless explicitly asked.
4. Site-deployment request means deploy; do not answer with an image-generation result.
5. Latest explicit owner instruction wins.
6. Separate SOURCE / TRANSPORT / CONSUMER / PRESENTATION.
7. Exact live consumer before repository bytes.
8. Freeze crop/focal/brightness intent before execution.
9. Preserve composition; prefer focal positioning over destructive crop.
10. Freeze one production asset.
11. Source SHA, production SHA, Git blob SHA and deployed bytes are separate identities.
12. New material bytes use immutable content-addressed paths by default.
13. Check actual GitHub capabilities before claiming no access.
14. Missing local binary-file primitive != missing GitHub access.
15. Prefer native local-file upload, native exact blob creation, or verified existing Git-object reuse.
16. Manual/model-mediated large Base64 chunks are forbidden.
17. If exact-safe binary transport is unavailable, BLOCKED beats improvisation.
18. Visible Execution Contract before first product write.
19. `ROUTE LOCKED` ends discovery.
20. Correct bytes but wrong-looking page → inspect CSS/presentation before transport.
21. Correct deploy but stale-looking page → inspect cache before retransmission.
22. One product branch / one PR; no branch or workflow multiplication.
23. First RED freezes writes; one known mechanical repair maximum.
24. Second RED same stage = BLOCKED.
25. GREEN requires deployment + target-breakpoint visual acceptance, not merely CI.

---

# END

> **Use the exact owner image. Find the exact consumer. Move exact bytes once. Treat CSS as presentation, not transport. Check capabilities instead of guessing. Lock the route. Make a boring diff. Prove what the owner can actually see.**
