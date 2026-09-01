# THE HOLDING REALTY — VISUAL ASSET DELIVERY CANON
## v1.3 · STABLE HARDENED OPERATING CONTRACT · 2026-09-01
### Exact consumer · exact bytes · direct-first transport · fail-closed execution · zero-loop policy · production proof

> **STATUS — CANONICAL FOR ALL REALTY IMAGE / BINARY DELIVERY TASKS**
>
> v1.3 preserves every production-proven law from the 2026-08-31 v1.1 recovery and every useful state-machine law from v1.2, then closes the failure-gate and transport-integrity gaps exposed by the clean-room v1.2 live test on 2026-09-01.
>
> **v1.3 is the stable operating contract.** Future ordinary incidents should be recorded as continuity/addenda, not trigger a new version. A new canon version is justified only if the underlying transport architecture, repository model, or proof contract materially changes.

---

# 0. RECOVERY / PRECEDENCE

For any Realty visual/image/binary task restore in this order:

`LIVE CURRENT.md → latest continuity → Memory Routing Index → this v1.3 canon → exact live /realty consumer/assets/CSS/runtime → exact evidence`

Priority when facts conflict:

1. live GitHub `main`;
2. exact current tool schemas + exact live consumer/assets/CSS/runtime;
3. latest continuity;
4. this v1.3 canon;
5. older Realty/image canons;
6. historical branches/chat prose.

**v1.3 supersedes v1.2 for new execution.** v1.1/v1.2 remain historical evidence and must not be deleted.

---

# 1. CORE LAW — FINITE STATE MACHINE, NOT OPEN-ENDED REASONING

An image task is a finite evidence pipeline:

`RESTORE → CONSUMER LOCK → SOURCE LOCK → PRODUCTION-ASSET LOCK → TRANSPORT GATE → EXECUTION CONTRACT → ROUTE LOCK → EXECUTE → VERIFY → BOUNDED PRODUCT DIFF → EXACT-HEAD CHECKS → MERGE/DEPLOY → DIRECT ASSET PROOF → VISUAL PRODUCTION PROOF → GREEN`

After `ROUTE LOCK` there are only three legal outcomes:

1. `EXECUTE → VERIFY → NEXT`;
2. `EXECUTE/VERIFY → FAILURE GATE → ONE BOUNDED REPAIR → VERIFY → NEXT`;
3. `EXECUTE/VERIFY → BLOCKED → STOP`.

Forbidden:

`LOCKED → DISCOVERY`

A route is never reopened because of curiosity, optimization, convenience, waiting time, another available branch, another format, another workflow idea, or “one last check”.

---

# 2. WHAT THE 2026-09-01 LIVE TEST PROVED

The v1.2 clean-room test improved behavior but was not strict enough.

Observed facts:

- the executor eventually displayed an Execution Contract and `ROUTE LOCKED`;
- it selected Lane B and created transport branch `transport/realty-hero-bright-v12-20260901-1ac3d6fe`;
- the branch accumulated 12 Base64 chunks and multiple materializer/diagnostic workflow changes;
- six failed GitHub Actions runs were recorded on that branch during the test window;
- the materializer reached the exact byte-size guard but failed the SHA-256 guard;
- expected production SHA-256 was `1ac3d6fedc41982fbb194f1f7ba3d9f67a82da2d2795fb7f95bfd9455643fcce`;
- reconstructed bytes produced SHA-256 `0b54d627d44dfeb61509b1082d21043b59090ca533c29cfe83cdb48b22118b10`;
- therefore **payload length was correct while payload content was wrong**;
- after a RED materialization, execution continued into more workflow/diagnostic writes instead of entering a hard failure gate.

Durable conclusions:

> **Correct total Base64 length does not prove correct payload bytes.**

> **Manual/model-mediated large Base64 chunk transcription is not a canonical transport mechanism.**

> **A RED Action is a state transition, not an invitation to keep writing.**

---

# 3. EXACT CONSUMER LOCK

Before preparing repository bytes, identify once:

- route;
- exact DOM slot (`<img>`, `<source>`, `<picture>`, CSS background);
- target breakpoint/device class;
- current asset URL(s);
- responsive overrides;
- `object-fit` / `object-position` / background positioning;
- filter / overlay / opacity / brightness;
- JS/runtime replacement;
- semantic role.

**Semantic role comes from the live consumer, not the filename.**

Do not reopen consumer discovery after lock unless a later verification proves the chosen consumer was wrong.

---

# 4. SOURCE LOCK AND PRODUCTION-ASSET LOCK

If the owner supplied a specific approved image, that file is the sole source candidate unless the owner explicitly changes it.

Record source proof:

- dimensions;
- byte size;
- SHA-256;
- decode validity.

Prepare one production candidate and freeze:

- format;
- dimensions/aspect;
- focal composition/crop;
- byte size;
- SHA-256;
- magic/container;
- successful decode;
- immutable content-addressed path.

If the source is re-encoded/resized:

`source SHA-256 != production SHA-256`

That is normal.

After Production-Asset Lock:

- no AVIF/WebP/JPEG/PNG switching for transport convenience;
- no CRF/quality experimentation unless the locked asset fails an objective quality/size requirement;
- no alternate old asset search;
- no “better existing blob” archaeology.

---

# 5. IDENTITIES — NEVER CONFUSE THEM

Keep four identities separate:

1. **source identity** — owner/source file hash;
2. **production identity** — final encoded browser asset SHA-256;
3. **Git object identity** — Git blob SHA;
4. **deployed identity** — bytes served by immutable production URL.

`Git blob SHA != content SHA-256`.

`file exists != correct bytes`.

A binary asset is accepted only when exact size + SHA-256 + format/magic + decode + dimensions match the frozen production manifest.

---

# 6. TRANSPORT GATE — DIRECT FIRST, ONLY TWO LANES

There is **Lane A** and **Lane B**. There is no Lane C.

## Lane A — native direct blob path — DEFAULT

If the active GitHub tool schema exposes a binary/base64-safe blob creation primitive such as `create_blob(content, encoding=base64)`, Lane A is **presumed available**.

The executor may not reject Lane A merely because:

- the file is large;
- the Base64 string is long;
- passing the payload “might” be inconvenient;
- a staging workflow already exists;
- an older transport branch exists.

### Mandatory Lane A rule

Before selecting Lane B, perform **one actual complete Lane A submission** of the locked production payload unless the tool contract explicitly documents a hard payload limit below the locked payload size.

Possible outcomes:

- success → verify created blob/repository bytes and continue;
- explicit tool rejection / documented size limit / verified truncation → record exact failure and only then Lane B may be considered.

**Speculation is not Lane A failure.**

If Lane A succeeds, Lane B is forbidden.

## Lane B — deterministic temporary assembler — EXCEPTION

Lane B is allowed only after concrete Lane A unavailability/failure for the exact locked payload.

Lane B must use:

- one transport branch;
- one workflow/materializer path;
- one precomputed manifest;
- deterministic machine-generated chunks only;
- per-chunk integrity verification before materialization;
- one final materialization.

### Absolute prohibition

> **Do not manually copy/transcribe/reconstruct large Base64 chunks through model reasoning or ad-hoc chat text.**

If the environment cannot deterministically transfer exact chunks and verify them, report `BLOCKED` instead of improvising.

---

# 7. VISIBLE PRE-WRITE HANDSHAKE — NO WRITE BEFORE THIS

Before the first repository write, the assistant must visibly output this contract:

```text
STATE: READY_TO_EXECUTE
OBJECTIVE: <one visual objective>
CONSUMER: <exact route + DOM slot + breakpoint>
SOURCE: <format + dimensions + size + SHA-256>
PRODUCTION ASSET: <format + dimensions + size + SHA-256 + immutable path>
TRANSPORT: Lane A or Lane B
LANE EVIDENCE: <why this lane is legal; Lane B must cite actual Lane A failure>
EXPECTED FINAL PRODUCT DIFF: <exact allowed product files/categories>
CSS: NONE or <one scoped change + reason>
BRANCH BUDGET: <1 product; +1 transport only if B>
ACTION BUDGET: <declared finite budget>
```

Then explicitly output:

`ROUTE LOCKED`

Only after that may repository writes begin.

If the visible contract was not emitted, any write is a protocol violation.

---

# 8. ACTION BUDGET — FINITE BY CONSTRUCTION

Normal single-image replacement budget:

- warm-up/recovery: 1 pass;
- consumer inspection: 1 pass;
- source proof: 1 pass;
- production encode: 1 candidate;
- optional encode repair: 1 only if objective quality/size guard fails;
- transport capability decision: 1 pass;
- Lane A create attempt: 1;
- product branch: 1;
- transport branch: 0 or 1;
- materializer workflow path: 0 or 1;
- historical branch search after source/asset lock: 0;
- web search for ordinary image upload: 0;
- alternative format search after asset lock: 0;
- new lane after route lock: 0;
- unexplained repeated verification of locked facts: 0.

A budget is a ceiling, not a target.

---

# 9. LANE B MANIFEST — VERIFY EACH CHUNK BEFORE MATERIALIZER

If Lane B is legally selected, freeze before first chunk write:

```text
PRODUCTION_SIZE
PRODUCTION_SHA256
BASE64_TOTAL_LENGTH
CHUNK_COUNT
for each chunk:
  filename
  exact character length
  SHA-256 of chunk text bytes
  ordinal/order
ASSEMBLY_COMMAND
OUTPUT_PATH
ONE_WORKFLOW_PATH
```

Mandatory sequence:

1. generate chunks deterministically from the locked production asset;
2. write chunk 00;
3. fetch/read it back from the exact branch;
4. verify exact length + expected chunk SHA-256;
5. repeat for each predetermined chunk;
6. **only after every chunk is independently verified**, create/enable the single materializer;
7. materialize;
8. verify final size + production SHA-256 + magic + decode + dimensions;
9. if valid, move only the binary result into the clean product branch/final diff;
10. remove/exclude all transport artifacts from product PR.

A total-length check alone is insufficient.

If any chunk fails its individual hash:

`STATE = PAYLOAD_INTEGRITY_FAILURE`

Replace only that exact chunk with the deterministic source chunk, verify it, then continue. Do not redesign transport.

---

# 10. FAILURE GATE — RED MEANS FREEZE WRITES

The instant any required GitHub Action/check becomes RED after route lock:

`STATE = FAILURE_GATE`

Immediately:

- stop all new repository writes;
- do not add another workflow;
- do not create another branch;
- do not change asset/format/lane;
- do not rerun blindly;
- fetch the failed run, failed job, failed step and logs;
- identify the exact failure class.

Before any repair, visibly report:

```text
STATE: FAILURE_GATE
FAILED RUN: <id>
FAILED STEP: <exact step>
ERROR/EVIDENCE: <specific evidence>
FAILURE CLASS: <payload / workflow syntax / permissions / environment / product / unknown>
LOCKED FACTS STILL VALID: <list>
PROPOSED REPAIR: <one mechanical repair>
NEW ROUTE: false
```

### Repair law

One repair is allowed only when the mechanical cause is known.

Examples:

- workflow syntax/config error → edit the **same workflow path** once;
- one chunk hash mismatch → replace only that proven bad chunk;
- permissions error with known missing permission → one scoped permission repair.

### Second-RED law

> **A second RED in the same transport/materialization stage = automatic `BLOCKED`.**

After second RED:

- no more writes;
- no new workflow;
- no new branch;
- no new lane;
- no third attempt;
- report blocker to owner.

This rule exists specifically to prevent multi-hour loops.

---

# 11. FAILURE CLASSIFICATION

A. Consumer failure — wrong slot/breakpoint.

B. Mapping failure — wrong semantic asset.

C. Source failure — wrong owner input/source bytes.

D. Production-asset failure — wrong encoding/size/quality/magic/decode.

E. Lane A failure — actual direct blob submission rejected/truncated.

F. Lane B chunk-integrity failure — one or more staged chunks differ from manifest.

G. Materializer/workflow failure — syntax/config/runtime unrelated to payload content.

H. Repository proof failure — materialized file differs from production manifest.

I. Diff failure — final PR contains transport/unrelated files.

J. Deployment failure — Git correct, production not updated.

K. CSS/runtime failure — correct asset altered/replaced visually.

L. Process-drift failure — illegal return to discovery or new architecture.

M. Memory-routing failure — new chat routed to stale image canon.

Repair only the proven class.

---

# 12. BRANCH / WORKFLOW BUDGET

Normal task:

- **1 clean product branch**;
- **+1 temporary transport branch only if Lane B is legally required**.

Lane B:

- **1 materializer workflow path maximum**.

A repair edits the same workflow path. Creating a second materializer workflow file is a protocol violation.

Historical transport branches are forensic evidence, not reusable working state.

Never blindly continue a branch from a previous failed attempt.

---

# 13. PRODUCT DIFF CONTRACT

A final visual asset PR should be boring.

Preferred product scope:

- new immutable asset(s);
- exact consumer reference(s);
- scoped CSS only if independently proven necessary;
- 0 `.tmp` files;
- 0 Base64 chunks;
- 0 transport workflows;
- 0 materializer/staging scripts;
- 0 unrelated JS/data/routes/memory files.

Memory/process hardening belongs in a separate memory change from the product image PR.

If final diff exceeds the frozen contract, stop before PR.

---

# 14. CSS IS NOT A DEFAULT IMAGE FIX

Do not change CSS simply because a new image differs visually.

First distinguish:

- source bytes;
- production bytes;
- responsive consumer;
- crop/focal point;
- filter/overlay/opacity;
- cache identity;
- runtime mutation.

Touch CSS only if live evidence proves the CSS itself conflicts with the owner objective.

Any CSS change must be consumer-specific, minimal and declared in the Execution Contract.

---

# 15. MOVING MAIN / EXACT-HEAD LAW

Autonomous writers may advance `main` while an image branch exists.

At material gates check once:

1. exact product head;
2. fresh main head;
3. changes since merge base;
4. whether they overlap the image scope;
5. exact-head required checks.

Do not repeatedly rebase merely because unrelated generated data advanced `main`.

`behind` is not automatically a defect; overlap is the question.

---

# 16. PROOF LADDER — GREEN ONLY AT THE END

Before PR:

- exact production manifest proven;
- repository bytes proven;
- exact consumer proven;
- final diff matches contract;
- transport machinery absent;
- exact head known;
- fresh main overlap assessed;
- required checks green.

After merge:

1. merge commit exists;
2. fresh main contains exact consumer/path;
3. deployment succeeds;
4. direct immutable asset URL serves expected binary bytes;
5. target production route loads;
6. target breakpoint uses intended asset;
7. crop/brightness/composition match objective;
8. out-of-scope breakpoint remains correct;
9. visual acceptance is recorded.

Only then:

`PRODUCTION-PROVEN GREEN`

`CI GREEN != production visual truth`.

---

# 17. SELF-OBSERVER — BEFORE EVERY POST-LOCK ACTION

Ask internally:

1. What exact state am I in?
2. What is the single next legal state?
3. Does this action directly advance it?
4. Am I rechecking a locked fact?
5. Am I creating a new asset/format/branch/lane/workflow?
6. Has a concrete failure legally allowed this repair?
7. Have I already consumed the one-repair budget?

If the action does not directly advance the next legal state: do not perform it.

Warning phrases after lock:

- “one last check”;
- “one more bounded inventory”;
- “another opportunity”;
- “maybe reuse an old blob”;
- “try another workflow”;
- “different format may be easier”;
- “let’s create a second materializer”;
- “rerun once more”.

These are process-drift indicators.

---

# 18. OWNER-FACING STATUS CONTRACT

During execution, status must be one of:

- `EXECUTING — <exact next state>`;
- `VERIFYING — <exact artifact/proof>`;
- `FAILURE_GATE — <failed run/step>`;
- `REPAIR_READY — <one mechanical repair>`;
- `BLOCKED — <exact blocker>`;
- `PRODUCTION-PROVEN GREEN`.

Do not say “still working under the hood” if no tool/action is actually running.

Do not hide RED Actions behind optimistic status text.

---

# 19. MEMORY ROUTING LAW

A correct document that is not on the live recovery path is not operationally reliable.

Mandatory route for Realty visual/image tasks:

`CURRENT → latest continuity → Memory Routing Index → Realty Visual Asset Delivery Canon v1.3 → exact live consumer/evidence`

The Router must point to v1.3. The latest continuity must name v1.3 as authoritative for new image execution.

The owner should not need to remember which hidden file to attach.

---

# 20. STABLE-VERSION LAW — STOP VERSION CHURN

v1.3 is intended to be the stable protocol baseline.

Do **not** create v1.4 merely because:

- one provider/tool returns an error;
- one image differs in size/format;
- a single workflow needs a normal mechanical repair;
- a new incident adds an example of an already-covered failure class.

Record ordinary lessons in continuity or an append-only addendum.

Create a new canon version only if a durable invariant materially changes, for example:

- GitHub transport architecture changes;
- repository release model changes;
- proof ladder changes;
- authority/governance boundary changes.

This prevents the methodology itself from becoming another loop.

---

# 21. RESUME CONTRACT AFTER THE FAILED v1.2 TEST

The stopped v1.2 live test is forensic evidence only.

Known failed transport branch:

`transport/realty-hero-bright-v12-20260901-1ac3d6fe`

It contains temporary chunks/workflows and produced repeated RED Actions. Do not continue it for the next image attempt.

For the next attempt:

1. start from fresh live `main`;
2. restore v1.3;
3. use the owner-approved source;
4. resolve exact current consumer;
5. freeze one production asset;
6. inspect current tool schema;
7. if `create_blob(base64)` exists, actually attempt complete Lane A before any Lane B;
8. emit visible Execution Contract;
9. `ROUTE LOCKED`;
10. execute forward only;
11. first RED → Failure Gate;
12. second RED in same stage → BLOCKED.

---

# 22. SHORT FORM — 20 IRON RULES

1. One visual objective.
2. Exact consumer before bytes.
3. Owner-approved source is the sole source candidate.
4. Source hash and production hash are separate after transformation.
5. Freeze one production asset before transport.
6. New material bytes → immutable content-addressed path by default.
7. `create_blob(base64)` present → actual Lane A attempt required before Lane B.
8. Speculation about payload size is not Lane A failure.
9. Lane B only after concrete Lane A failure; no Lane C.
10. Manual/model-mediated large Base64 chunk transcription is forbidden.
11. Lane B requires per-chunk size + SHA-256 verification before materializer.
12. One product branch; one transport branch max if needed.
13. One materializer workflow path max.
14. Visible Execution Contract before first write.
15. Route Lock ends discovery.
16. First RED freezes writes and requires log-based failure classification.
17. One mechanical repair max for a known cause.
18. Second RED in the same stage = BLOCKED, stop.
19. Final product PR contains zero transport machinery.
20. GREEN requires repo bytes + exact-head checks + deploy + direct asset proof + visual production proof.

---

# END

v1.1 proved the evidence chain.

v1.2 introduced route locking.

v1.3 closes the remaining two failure classes: **unverified transport payloads** and **continued writing after RED**.

> **Direct first. Exact bytes. One route. One repair. Second RED stops the task. Production proof closes it.**
