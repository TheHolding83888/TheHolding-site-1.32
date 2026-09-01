# THE HOLDING REALTY — VISUAL ASSET DELIVERY CANON
## v1.2 · 2026-09-01
### Exact consumer · exact bytes · deterministic transport · route lock · anti-drift · production proof

> **STATUS — HARDENED OPERATING CANON**
>
> This v1.2 preserves the production-proven image/binary laws from Realty v1.1 and adds a stricter execution state machine derived from the 2026-09-01 repeated image-delivery incident.
>
> The v1.1 production-proven chain remains valid:
>
> `exact consumer → exact bytes → immutable URL → binary-safe transport → bounded diff → exact-head checks → deployment → direct asset proof → visual production proof`
>
> v1.2 adds one missing property: **after route lock, discovery is closed**. No “one last check”, alternative asset, old-branch search, new transport lane, staging idea or format change is allowed unless a concrete execution operation fails.
>
> **Evidence boundary:** v1.1 base rules are production-proven. The v1.2 anti-drift delta is incident-derived, owner-adopted and mandatory now; it should be marked production-reference proven only after the next successful image deployment executed under this protocol.

---

# 0. RECOVERY / PRECEDENCE

For any Realty visual/image task restore in this order:

`LIVE CURRENT.md → latest continuity → Memory Routing Index → this v1.2 visual canon → exact live /realty consumer/assets/CSS → exact evidence`

Priority when facts conflict:

1. live GitHub `main`;
2. exact live consumer/assets/CSS + current tool schemas;
3. latest continuity;
4. this canon;
5. older handoffs/chat prose.

The model/connector can change. The evidence requirements and state machine remain.

---

# 1. CORE LAW

> **An image task is a finite evidence pipeline, not an open-ended search problem.**

Normal path:

`RESTORE → CONSUMER LOCK → SOURCE LOCK → PRODUCTION-ASSET LOCK → TRANSPORT GATE → ROUTE LOCK → EXECUTE → REPO PROOF → BOUNDED DIFF → EXACT-HEAD CHECKS → MERGE/DEPLOY → DIRECT ASSET PROOF → VISUAL PRODUCTION PROOF → GREEN`

Forbidden after route lock:

`LOCKED → DISCOVERY`

Allowed after route lock:

`LOCKED → EXECUTE → VERIFY → NEXT`

or

`EXECUTE/VERIFY → BLOCKED`

Unlock requires a **specific execution failure**, not curiosity, convenience or optimization.

---

# 2. WHY v1.2 EXISTS — 2026-09-01 FAILURE CLASS

The incident showed that correct methodology can still loop when decisions are not irreversible.

Observed drift included:

- exact consumer already known, but repeatedly re-investigated;
- canonical bytes repeatedly re-verified;
- a lane verbally selected, then old branches/blobs searched again;
- WebP/AVIF alternatives reconsidered after canonical production bytes were chosen;
- staging/Base64/materializer ideas reopened after route lock;
- partial/incomplete Git materializations that could be mistaken for success;
- repeated “one last check / one more inventory” transitions back into discovery;
- a second executor also started temporary transport machinery before mechanically freezing the route.

Durable conclusion:

> **Correct rules without hard state transitions are not sufficient.**

---

# 3. EVIDENCE IDENTITIES — KEEP THEM SEPARATE

## Source proof

Record the owner/source file:

- dimensions;
- byte size;
- SHA-256;
- decode validity.

## Production-asset proof

Record the final browser bytes:

- format;
- dimensions;
- byte size;
- SHA-256;
- magic/container;
- successful decode;
- immutable filename/path.

If source is resized/cropped/re-encoded:

`source SHA-256 != production SHA-256`

This is normal.

## Repository proof

Prove the bytes physically stored in the exact branch/commit match the production manifest.

## Deployed proof

Prove the immutable production URL serves the intended binary, not HTML/fallback/stale bytes.

## Consumer proof

Prove the actual target breakpoint/DOM consumer uses that asset and is not overridden by a responsive `<source>` or runtime JS.

**Git blob SHA != content SHA-256.** Do not compare them as one hash system.

---

# 4. EXACT CONSUMER LOCK

Before preparing/uploading bytes, record once:

- route;
- DOM section;
- exact `<img>` / `<source>` / `<picture>` / background consumer;
- desktop/mobile breakpoint;
- current asset URL(s);
- CSS geometry, `object-fit`, `object-position`, filter, overlay, opacity;
- JS/runtime mutation;
- semantic role.

> **Semantic role comes from the live consumer, not the filename.**

Historical filenames may be misleading. Do not guess by name.

---

# 5. SOURCE LOCK / PRODUCTION-ASSET LOCK

If the owner supplied a specific approved image, it is the sole source candidate unless the owner explicitly changes it.

Before route lock, prepare the final browser asset and freeze:

- final format;
- target dimensions/aspect;
- focal composition;
- byte size;
- SHA-256;
- magic/decode;
- immutable content-addressed filename.

After Production-Asset Lock:

> **Do not change AVIF/WebP/JPEG/PNG merely to make transport easier.**

Transport adapts to the asset. The asset does not mutate for transport convenience.

Preserved v1.1 laws:

- extension is not proof; verify magic/container;
- nonzero size is not proof; verify decode;
- Git commit success is not image validity;
- new material bytes → new immutable browser-visible path by default;
- do not create multi-generation fallback ladders;
- do not destroy quality to fit connector limits;
- prepare for actual rendered geometry with healthy pixel-density reserve;
- distinguish baked labels from HTML/CSS copy;
- use deliberate cache policy: immutable paths for binary imagery; controlled revisions for shared CSS/JS where needed.

---

# 6. TRANSPORT GATE — ONLY TWO LANES

There is **Lane A** and **Lane B**. There is no Lane C.

## Lane A — native end-to-end binary-safe path

Lane A is READY only when all are true:

1. tool/API explicitly supports binary-safe or base64 content;
2. the current execution environment can produce the **complete** locked payload without transcoding/truncation;
3. the complete payload fits the active tool/connector contract;
4. repository bytes can be verified after materialization.

Tool presence alone is not enough. End-to-end readiness is the criterion.

If one capability fact is genuinely unknown, perform **one bounded capability check before route lock**. Do not create product/staging branches or search historical assets during that check.

If Lane A is READY:

> **Lane B is forbidden.**

## Lane B — temporary branch-scoped assembler

Lane B is allowed only when Lane A is concretely unavailable for the locked asset.

Valid reasons:

- complete payload rejected;
- documented/request-size limit below payload;
- local-to-tool payload cannot be transferred without corruption/truncation;
- native binary endpoint unavailable.

Invalid reasons:

- “Lane B might be easier”;
- “an old staging branch exists”;
- “there is already a WebP blob”;
- “I want to avoid a large base64 argument” without a real limit;
- “one last inventory check”.

The exact Lane B reason must be written into the Execution Contract.

---

# 7. EXECUTION CONTRACT — REQUIRED BEFORE FIRST WRITE

Freeze exactly this before the first product/transport write:

```text
OBJECTIVE: <one visual objective>
CONSUMER: <exact route + DOM slot + breakpoint>
SOURCE: <dimensions + size + SHA-256>
PRODUCTION ASSET: <format + dimensions + size + SHA-256 + immutable path>
TRANSPORT: <Lane A/B + exact reason>
EXPECTED FINAL DIFF: <exact allowed product files/categories>
CSS: <NONE or one declared scoped change + proven reason>
```

After this contract exists, every tool action must answer:

> **Does this directly advance the next locked state?**

If no, do not perform it.

---

# 8. LANE A HARD RULES

When Lane A is locked:

1. submit the locked production bytes;
2. create/bind the exact blob/tree/commit on the clean product branch;
3. verify repository bytes;
4. continue forward.

Do not:

- search old branches for equivalent blobs;
- change format;
- create staging chunks;
- create an assembler/materializer;
- re-check source quality after production asset is already locked.

A lane change requires a concrete Lane A execution error/evidence.

---

# 9. LANE B HARD RULES

Before first Lane B write, precompute/freeze:

- production SHA-256 and size;
- encoded/base64 total length;
- exact chunk count/names/order if chunks are required;
- assembler command;
- output path;
- expected final product diff.

Then:

1. create **one** temporary transport branch;
2. create **one** temporary assembler/workflow/script;
3. stage the predetermined complete payload;
4. materialize exact bytes;
5. fail closed on size/hash/magic/decode mismatch;
6. verify final binary;
7. move/rebuild only the verified binary onto the clean product branch, or remove all transport machinery before PR;
8. prove final PR contains no `.tmp`, `.b64`, chunks, assembler or transport workflow.

Attempt budget:

- one planned materialization;
- if it fails, one diagnosis;
- one repair only if the exact mechanical cause is known and asset/lane/route do not change;
- otherwise stop as `BLOCKED`.

Do not invent another transport architecture inside the task.

---

# 10. BRANCH / SEARCH BUDGET

Normal image task:

- **1 clean product branch**;
- **+ 1 temporary transport branch only if Lane B is required**.

No additional experimental branches after route lock.

Historical branches are forensic evidence, not an asset catalog.

### Existing-blob reuse

Do not search historical branches after Production-Asset Lock.

Reuse an existing blob only if its exact production SHA-256 identity is already known from the bounded initial evidence set and can be proven byte-identical without reopening discovery.

Otherwise materialize the locked bytes.

---

# 11. `FILE EXISTS != CORRECT BYTES`

A Git path is accepted only when all production-manifest fields match:

- exact byte size;
- exact SHA-256;
- correct format/magic;
- successful decode;
- expected dimensions.

A partial/incomplete file in Git is a failure even if the commit is green.

---

# 12. CSS IS A SEPARATE DECISION

Do not modify CSS just because a new image looks different.

Classify first:

- bytes;
- consumer;
- mapping;
- crop;
- cache;
- responsive source;
- runtime;
- actual CSS filter/overlay/layout.

Touch CSS only when the layout/filter itself is proven to conflict with the owner’s visual objective.

If CSS is required:

- make it consumer-specific;
- make it minimal;
- declare it in the Execution Contract;
- verify out-of-scope breakpoints.

“Bounded HTML/CSS diff” does not imply both HTML and CSS must change.

---

# 13. FINAL DIFF CONTRACT

A visual asset PR should be boring.

Preferred final scope:

- new immutable asset(s);
- exact consumer reference(s);
- scoped CSS only if independently proven necessary;
- **0 workflow files**;
- **0 Base64/chunk/temp files**;
- **0 staging scripts**;
- **0 unrelated JS/data/routes/memory changes**.

Memory/process hardening belongs in a separate memory change from the product image PR.

If final diff exceeds the frozen contract, stop before PR.

---

# 14. EXACT-HEAD / MOVING-MAIN LAW

Autonomous writers may advance `main`.

Do not repeatedly rebase/check simply because unrelated generated data changed.

At material gates answer once:

1. exact product head?
2. fresh main?
3. what changed since base?
4. does it overlap the image scope?
5. which required checks bind to exact head?

If no overlap, proceed through normal mergeability/check rules.

---

# 15. PROOF LADDER

Before PR:

- binary manifest verified;
- exact consumer verified;
- final diff matches contract;
- transport machinery absent;
- exact head known;
- fresh main compared;
- required checks green.

After merge:

1. merge commit exists;
2. fresh main contains exact consumer/path;
3. deployment succeeds;
4. direct immutable asset URL serves the expected binary;
5. production route loads;
6. target breakpoint uses intended asset;
7. crop/brightness/composition are correct;
8. out-of-scope breakpoint did not regress;
9. owner/model visual acceptance recorded.

Only then:

> **production-proven GREEN**

CI GREEN alone is insufficient.

---

# 16. SELF-OBSERVER / ANTI-LOOP GUARD

After ROUTE LOCK and before each nontrivial tool/GitHub action, internally ask:

1. What state am I in?
2. What is the single next allowed state?
3. Does this action directly advance it?
4. Am I re-checking a fact already locked?
5. Am I introducing a new asset, format, branch, lane, assembler or architecture?
6. Has a concrete execution failure occurred that legally unlocks the route?

If #3 is **no**: do not perform the action.

If #4/#5 is **yes** and #6 is **no**: classify **PROCESS DRIFT** and return to the locked next action.

Warning phrases after route lock:

- “one last check”;
- “one more bounded inventory”;
- “another opportunity”;
- “maybe reuse the old blob”;
- “inspect another branch first”;
- “different format may be easier”;
- “add a small staging mechanism”.

These are forbidden after lock without a concrete blocker.

---

# 17. BLOCKER CONTRACT — STOP INSTEAD OF LOOPING

A valid blocker report is:

```text
STATE: <exact state>
LOCKED ROUTE: <asset + lane + branch contract>
FAILED OPERATION: <exact operation>
ERROR/EVIDENCE: <specific error/result>
WHAT IS STILL PROVEN: <facts that remain valid>
NO NEW ROUTE CREATED: true
NEXT DECISION NEEDED: <one bounded need>
```

Do not hide a blocker behind continued exploration.

Do not claim hidden/background continuation when no tool action is running.

---

# 18. FAILURE TAXONOMY

A. Consumer failure — wrong DOM slot/path/breakpoint.

B. Mapping failure — semantic role swapped.

C. Byte failure — truncated/corrupt/wrong content.

D. Format failure — extension/container mismatch.

E. Decode failure — container exists but cannot render.

F. Geometry failure — correct image, wrong crop/aspect/focus.

G. Cache identity failure — changed bytes hidden behind old URL.

H. Deployment failure — Git correct, production not updated.

I. CSS/runtime failure — correct asset hidden/filtered/replaced.

J. Rights/governance failure — display rights not established.

K. **Process-drift failure** — route locked, executor returned to discovery without execution blocker.

L. **Memory-routing failure** — current image canon exists but CURRENT/Router sends a new chat to older task memory.

Repair only the proven class.

---

# 19. MEMORY ROUTING LAW

A correct document that is not on the live recovery path is not enough.

Required route for Realty image work:

`CURRENT → latest continuity → Memory Routing Index → Realty product canon + this Visual Asset Delivery Canon v1.2 → exact live consumer/evidence`

After a material incident:

- continuity = incident/resume state;
- canon = durable laws;
- Router = retrieval change;
- CURRENT = minimal pointer/guard making the route unavoidable.

Do not rely on the owner remembering to attach a hidden newer file.

---

# 20. 2026-09-01 INCIDENT SNAPSHOT — PAUSED, NOT GREEN

Owner paused the desktop/laptop Realty hero upload to harden the process first.

Known state:

- target: upper desktop/laptop Realty hero;
- repeated route drift occurred across two executor attempts;
- old branch/blob searches and transport exploration recurred after verbal locks;
- a clean product branch and a separate temporary transport branch were created during the second attempt;
- temporary transport branch contains staging/materializer artifacts and is forensic/temporary only;
- no production GREEN may be inferred from those branches;
- no image PR from the paused second attempt is considered completed production work;
- resume only under this v1.2 state machine from fresh live main.

When resuming, do not blindly continue the old transport branch. Re-read fresh main, exact consumer and owner-approved source, then create a new Execution Contract.

---

# 21. NEXT-CHAT PROMPT

> **Прогрев The Holding Realty image task. Start from LIVE `intelligence/project-memory/CURRENT.md` → latest continuity → Router → Visual Asset Delivery Canon v1.2 → exact live Realty consumer/assets/evidence. Do not write during warm-up. Before any write, output the Execution Contract and lock the route. After route lock, discovery is closed: no historical blob search, alternate format, new lane/branch/assembler unless a concrete execution operation fails. Use only EXECUTE → VERIFY transitions. If blocked, stop and report the exact blocker instead of inventing another route. Do not call GREEN until repo bytes, exact-head checks, deployment, direct immutable asset and visual production proof all pass.**

---

# 22. v1.2 VALIDATION

After the next successful image deployment under this protocol, record:

- exact consumer;
- source manifest;
- production manifest;
- chosen lane + reason;
- branch count;
- any unlock + exact blocker;
- final bounded diff;
- exact-head checks;
- merge/deploy proof;
- direct asset proof;
- visual production proof;
- whether any process drift occurred after route lock.

If the path succeeds without drift, mark the v1.2 anti-drift delta **production-reference proven** in the next closure/version.

---

# 23. HARD RULES — SHORT FORM

1. One visual objective.
2. Exact consumer before bytes.
3. Source hash and production hash are separate after transformation.
4. New bytes → new immutable identity by default.
5. Production asset freezes before transport.
6. Lane A only if end-to-end ready; Lane B only on concrete Lane A unavailability; no Lane C.
7. Route lock ends discovery.
8. No historical branch archaeology after asset lock.
9. No format change for transport convenience.
10. `file exists != correct bytes`.
11. One product branch; one temp transport branch only if Lane B is required.
12. Final PR contains no transport machinery.
13. CSS is not a default image fix.
14. Every post-lock tool action must advance the next state.
15. Concrete blocker → stop/report, not new invention.
16. CI/exact-head checks do not replace direct asset + visual production proof.
17. Memory routing is part of the engineering fix.
18. Never call paused/partial materialization GREEN.

---

# END

v1.1 proved that image delivery is a chain of evidence.

v1.2 adds that the chain must be a **finite state machine with irreversible locks**.

> **Correct consumer + correct bytes + deterministic transport + bounded diff + irreversible route discipline + production proof.**

The model can change. The connector can change. The discipline must remain The Holding’s.
