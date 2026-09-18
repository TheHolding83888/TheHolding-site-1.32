# THE HOLDING — URGENT TAKEOVER HANDOFF

**Timestamp:** 2026-09-18 10:33 MSK
**Purpose:** emergency continuity handoff because the active chat is near context exhaustion.
**Branch:** `checkpoint/p10-stable-live-takeover-20260918-1033-msk`
**Main policy:** this branch is continuity-only. Do **not** merge this checkpoint into `main` unless there is an explicit reason. `main` was not intentionally modified by this handoff.

---

## 1. Live objective at takeover

Primary objective remains **P10 system-wide production acceptance**, currently approximately **98–99%**.

The remaining live gate is **Stable Capital scheduled materialization** for Monetra / Company #008:

- the active scheduled workflow must receive a real `schedule` event;
- it must execute the Stable Capital production writer successfully;
- it must physically update the three canonical production files in `main`;
- only then can this P10 gate be called GREEN.

Do not broaden scope before resolving/proving this gate.

---

## 2. Canonical Stable workflow state proven at takeover

### Active workflow

Path:

`.github/workflows/update-stable-capital-scheduled.yml`

Name:

`Update Stable Capital`

Current intended triggers:

- `workflow_dispatch`
- `schedule`
- cron: `41 5 * * *` = **08:41 MSK daily**

Important properties already verified from live `main`:

- `permissions: contents: write`
- concurrency group `update-stable-capital`
- one writer path only
- preflight checks Stable resolver + prior production files + Company #008 strategy entry ledger
- executes:
  - `stable-capital/stable-capital-engine.mjs`
  - `stable-capital/embedded-yield-interval-history.mjs`
  - `stable-capital/stable-index-bridge.mjs`
- validates output
- publishes exactly these three production files:
  - `companies/stable-capital-data.json`
  - `companies/embedded-yield-ledger.json`
  - `companies/stable-index-data.json`

### Retired workflow

Path:

`.github/workflows/update-stable-capital.yml`

This is intentionally retained only as a registration tombstone / manual-safe retired identity.

Verified intended properties:

- no active schedule
- read-only authority
- no production writer surface
- no duplicate cron
- no duplicate Stable production writer

### Proof

Path:

`intelligence/reliability/update-stable-capital-scheduler-proof.mjs`

The proof explicitly enforces:

- fresh scheduled workflow exists
- retired workflow exists
- exactly one cron on the active writer
- retired workflow has no cron and no write authority
- no duplicate production writer
- accounting semantics unchanged
- execution authority remains `none`

This means the **configuration-level migration itself is strongly bounded and architecturally clean**.

---

## 3. Most important correction discovered after the 09:42 MSK handoff

Do **not** blindly accept the earlier statement that the absence of a Stable run shortly after 08:41 MSK proves scheduler failure.

A crucial historical fact was recovered:

- on **2026-09-06**, the old Stable workflow was scheduled for approximately **08:37 MSK**;
- the successful natural Stable materialization did not publish until approximately **12:42 MSK** (`Publish Monetra verified Stable Performance`, commit `4785c5f77e49ec1209437b00f46fa8c67f7a323b` at `2026-09-06T09:42:28Z`);
- therefore this workflow has demonstrated a historical delay of roughly **4 hours** from nominal cron to physical publication.

Consequently:

> Missing a natural run at +1 to +2 hours is not, by itself, enough evidence to repair GitHub Actions registration.

This materially weakens the earlier “registration definitely broken” diagnosis.

The correct approach is to distinguish:

1. **no `schedule` event ever created**;
2. `schedule` event created but queued/delayed;
3. run started but failed;
4. run succeeded but generated no diff;
5. run succeeded and published the three files.

Do not repair until this distinction is actually proven.

---

## 4. Current live evidence at 10:33 MSK

### GREEN

- GitHub Actions as a whole is alive today.
- Other automation has materialized fresh commits into `main` today.
- Live examples seen during the takeover investigation include market-data refresh commits after the morning P10 work.
- Stable configuration in `main` is present and syntactically/architecturally coherent.
- The Stable production logic previously worked and physically published data.
- The last proven Stable materialization is still the 6 September publication.

### YELLOW

At approximately **10:33 MSK on 18 September**, no fresh Stable production materialization had yet been proven.

The production file:

`companies/stable-capital-data.json`

still showed:

`generatedAt: 2026-09-06T09:42:27.811Z`

Therefore the production truth-plane is still stale regardless of whether the scheduler is merely delayed or broken.

The same P10 gate therefore remains open.

### RED / not yet proven

It is **not yet proven** that GitHub failed to register the new workflow object.

Earlier wording in the previous chat got too strong on this point. The evidence supports:

- no fresh Stable materialization yet;
- possible scheduler/registration delay or failure;
- but not yet a definitive root-cause verdict.

---

## 5. Historical Stable materialization evidence

Known successful Stable bot publications include:

- `4785c5f77e49ec1209437b00f46fa8c67f7a323b` — 2026-09-06 09:42:28 UTC / 12:42:28 MSK
- `3092292fd00af4fc8cec1c310a79c181a984b3c4` — 2026-09-05 09:20:23 UTC / 12:20:23 MSK
- `6e031ccd706266999276dd791510c05e387d9829` — 2026-09-04 09:56:11 UTC / 12:56:11 MSK
- `d632dee068897577453511beb421292e895828a8` — 2026-09-03 10:05:10 UTC / 13:05:10 MSK

These commits strongly suggest Stable has historically materialized around **12:20–13:05 MSK**, despite morning cron intent.

That historical behavior is a major reason to avoid premature repair before the equivalent delay window expires.

---

## 6. Immediate next-step sequence for the next chat

Follow this order strictly.

### Step A — fresh live read

Check:

1. current `main` HEAD;
2. current time in MSK;
3. workflow/runs for `Update Stable Capital`;
4. events specifically with `event = schedule`;
5. jobs/conclusion if a run exists;
6. latest commits touching the three Stable production files;
7. physical `generatedAt` / provenance inside those files.

### Step B — wait for historically reasonable boundary if necessary

The meaningful comparison window is around **12:20–13:05 MSK**, not 09:00–10:00 MSK.

If the natural run appears before/within that historical window:

- inspect jobs and logs;
- verify the writer ran;
- verify the three production files changed physically in `main`;
- verify semantic invariants;
- mark P10 Stable gate GREEN only after production evidence exists.

### Step C — if still no natural run after historical delay window

Only then promote this to a strong scheduler/registration incident.

Before writing a repair, prove which layer failed:

- workflow registration/object visibility;
- cron event creation;
- Actions queue;
- workflow dispatchability;
- permissions / disabled state;
- concurrency starvation;
- repository-level workflow state.

Avoid touching Stable accounting semantics, protocol adapters, Company #008 data model or canonical ledger unless evidence unexpectedly points there.

### Step D — minimal repair principle

If repair becomes justified:

- repair only Actions registration/scheduler layer;
- one active writer only;
- no duplicate cron;
- no duplicate materialization;
- no change to accounting semantics;
- use separate branch + PR;
- require proof before merge;
- after merge, require a new **natural schedule** run as acceptance evidence.

Manual success alone is not enough to close the natural-scheduler gate.

---

## 7. Exact P10 GREEN criteria

P10 Stable gate becomes GREEN only when all are true:

1. an actual GitHub Actions run exists with `event = schedule` for the active Stable workflow;
2. run is successful;
3. Stable engine / interval history / stable index bridge executed successfully;
4. these files are physically refreshed in `main`:
   - `companies/stable-capital-data.json`
   - `companies/embedded-yield-ledger.json`
   - `companies/stable-index-data.json`
5. generated timestamps/provenance are fresh;
6. one-writer invariant remains intact;
7. no accounting semantics regressed;
8. P10 acceptance evidence is preserved in continuity/current state.

Until then, P10 remains approximately **98–99%**.

---

## 8. P12 context inherited from earlier takeover

A separate P12 preparation/forensics thread already exists and must remain secondary while P10 is the primary objective.

Previously identified P12 work includes:

- Aerodrome reliability: provider may look live but fail historical/archive reads; improve capability-based RPC selection rather than generic liveness only.
- Reporting fan-out/performance: some `main` movements can trigger expensive report rebuilding when changes are unrelated; reduce unnecessary rebuild scope without weakening correctness.
- Economic Graph / issue #456: historical incident needs final evidence whether post-6-September Unified Refresh → Economic Graph natural chains recovered; two mitigations were already identified (longer Graph timeout and removal of redundant rebuild).
- ve33 / Comparative / Learning Loop diagnostics were being reviewed as cleanup/reliability scope.
- stale PR/issues/workflow cleanup candidates exist.

Important: do not let P12 cleanup contaminate or delay the narrow P10 Stable acceptance gate.

---

## 9. Safety / authority invariants

- `executionAuthority = none` unless explicitly changed by owner-approved future architecture.
- No custody or transaction execution changes.
- No accounting-semantic changes without evidence and explicit need.
- Prefer reusable capability fixes over company-specific patches.
- `GREEN workflow != production materialized`.
- `UNKNOWN != 0`.
- One primary objective at a time.
- Never claim success from YAML presence alone.
- Never claim scheduler failure from a short delay alone when historical evidence shows multi-hour delay.

---

## 10. Human-readable takeover summary

Simple version:

> The factory machinery is configured correctly, and the old duplicate starter has been safely retired. The only unfinished P10 test is whether the Stable Capital line starts by itself and writes fresh production records. Earlier we almost declared the starter broken too early. Historical evidence now shows this exact line has previously started 4+ hours late, often around 12:20–13:05 MSK. So the next chat should first watch the real historical window, then inspect the exact schedule run. Only if no natural run exists after that window should it repair GitHub Actions registration/scheduling. Do not touch Stable accounting itself unless direct evidence points there.

---

## 11. Takeover command

**Resume from P10 Stable natural-schedule proof. Fresh live evidence wins over this document. Check current `main`, current MSK time, exact Stable workflow runs/events/jobs, and the three production files. Do not repeat stale diagnosis. Close the gate only on physical production materialization.**
