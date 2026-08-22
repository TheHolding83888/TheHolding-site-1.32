# THE HOLDING — PRODUCTION RECOVERY & FAIL-CLOSED HANDOFF CANON
## 2026-08-22 · durable workflow recovery law after final stabilization

## Purpose

This canon preserves the expensive operational lessons learned while closing the Aug 22 production stabilization chain across Unified Capital, Security, Cognitive Stack, Learning, Project Memory and Intelligence Progress (THI).

It is not a frozen runbook for one incident. It defines reusable laws for diagnosing and repairing autonomous GitHub Actions pipelines without creating duplicate writers, weakening safety guards, or mistaking CI success for production success.

Changing workflow/run IDs and current state must always be fetched live.

---

# 1. CORE LAW — ONE WRITER, MANY SAFE WAKEUPS

For every canonical truth plane, prefer:

`one canonical writer + bounded dispatch/recovery paths`

over
`multiple writers that can race or diverge`.

Recovery helpers may:
- verify prerequisites;
- wait for freshness gates;
- dispatch the existing canonical writer;
- identify the exact dispatched run;
- await SUCCESS;
- dispatch the next canonical stage when GitHub event recursion is not reliable.

Recovery helpers must not:
- become a second economic/state writer;
- silently rewrite another subsystem's canonical artifact;
- bypass the canonical validator/release guard;
- expand execution/capital authority.

---

# 2. FOUR DISTINCT STATES — NEVER COLLAPSE THEM

A production change can be in four materially different states:

1. **Implementation exists** — code is on a branch.
2. **PR CI GREEN** — the proposed bytes pass pre-merge validation.
3. **Merged** — bytes exist in `main`.
4. **Physically materialized production state** — the canonical writer ran successfully and the expected generated artifact/commit is present in `main`.

Do not call state 1, 2 or 3 “production complete” when the task requires state 4.

Permanent sentence:

**GREEN workflow != physically materialized production artifact.**

Likewise:

**wakeup dispatched != canonical writer published.**

---

# 3. EXACT FAILURE-LOCALIZATION ORDER

When a writer does not materialize after a relevant merge, diagnose in this order before changing economic logic:

1. Did the expected workflow run exist?
2. Was it queued, running, skipped, cancelled or failed?
3. Which exact job/step failed?
4. Did collection complete?
5. Did deterministic validation complete?
6. Was a local commit created?
7. Did fetch/rebase/publish fail?
8. Did a downstream workflow fail after publication?
9. Did the artifact actually change, or was the writer legitimately a no-op?

Only change economic/resolver logic if evidence points to economic/resolver failure.

Aug 22 Unified Capital precedent:
- exact f(x) collection worked;
- validation worked;
- local production snapshot commit was created;
- publish failed only because of malformed shell/heredoc syntax.

Changing APR math in that situation would have been the wrong repair.

---

# 4. RELEASE GUARDS — FAIL CLOSED, THEN REBIND

If an exact-byte release guard fails because a release-critical file changed:

Correct response:
1. identify the changed release-critical bytes;
2. verify the change is intended;
3. update the exact release manifest binding;
4. strengthen manifest coverage if the incident exposed an omitted executable/policy surface;
5. run permanent release-coherence CI;
6. only then resume canonical production writer.

Wrong responses:
- weaken/remove the guard;
- treat stale release metadata as harmless;
- allow writer publication against unbound executable bytes;
- manually force generated state around the guard.

Aug 22 Cognitive precedent:
- Security workflow changed;
- Cognitive release manifest still bound old bytes;
- release guard correctly failed;
- repair was to rebind and later expand the manifest from 10 to 13 critical surfaces.

Current release-critical Cognitive set at that checkpoint includes:
- Brain upstream guard;
- Brain ChatGPT bridge;
- Bridge policy/schema;
- Cognitive verifier;
- release guard;
- standalone Brain workflow;
- standalone Bridge workflow;
- integrated Cognitive refresh workflow;
- Security workflow;
- `intelligence/brain-reasoning-engine.mjs`;
- `intelligence/brain-policy.json`;
- `security/security-sentinel.mjs`;
- the remaining previously bound release surface(s) in the canonical 13-file manifest.

Do not trust this prose count instead of the live manifest; fetch `intelligence/cognitive-stack-release.json`.

---

# 5. FRESHNESS ORDERING — SECURITY BEFORE COGNITIVE RECOVERY

A recovery dispatch triggered by a release/security-relevant change must not race the Security writer.

Canonical recovery gate:

1. record triggering push timestamp;
2. wait until standalone Security state exists with `security.generatedAt >= triggering push timestamp`;
3. refuse Critical Security state;
4. fetch/reset checkout to fresh `origin/main`;
5. require fresh Observer source health;
6. run exact Cognitive release guard;
7. only then dispatch canonical integrated Cognitive refresh.

Why:
without this gate, Cognitive can bind the pre-change Security snapshot while a newer Security writer is still running, producing stale or failed coherence.

Fresh standalone Security and Cognitive-bound Security are different concepts:
- standalone Security = current independent Security truth;
- Cognitive-bound Security = exact Security snapshot embedded in that coherent Cognitive packet.

Do not overwrite one meaning with the other.

---

# 6. GITHUB_TOKEN RECURSION LAW

GitHub Actions event topology is not fully recursive when workflows are programmatically dispatched using the repository `GITHUB_TOKEN`.

A successful workflow dispatched by another workflow may **not** produce the same downstream `workflow_run` / push-trigger chain that a normal independent run would produce.

Therefore, for critical recovery paths:

**do not assume event recursion.**

Use explicit handoff:

`dispatch stage A → identify exact new run → await SUCCESS → dispatch stage B → identify exact run → await SUCCESS → ...`

Aug 22 canonical release-recovery chain became:

`post-change Security freshness gate`
`→ integrated Cognitive Stack SUCCESS`
`→ Decision Outcome Learning SUCCESS`
`→ Project Memory Bootstrap SUCCESS`
`→ Intelligence Progress SUCCESS`

This explicit chain exists for **release recovery**. It does not mean all normal scheduled topology must be rewritten into one giant orchestration workflow.

---

# 7. EXACT RUN IDENTIFICATION

A recovery dispatcher must not merely call `gh workflow run ...` and then inspect “latest run” without disambiguation.

Safer pattern:
1. capture previous/latest workflow-dispatch run ID before dispatch;
2. record dispatch timestamp;
3. dispatch canonical workflow on `main`;
4. list recent `workflow_dispatch` runs;
5. select a run whose ID differs from the previous run and whose `createdAt >= dispatched_at`;
6. persist that exact run ID in step output;
7. `gh run watch <exact-id> --exit-status`.

This avoids waiting for the wrong concurrent/manual run.

---

# 8. CHECKOUT / MOVING MAIN LAW

The Holding has many autonomous writers, so `main` moves frequently.

Before a recovery gate or publication:
- `git fetch origin main`;
- reset/rebase onto fresh `origin/main` as intended by the workflow contract;
- rerun deterministic checks whose truth depends on exact current bytes.

A queued workflow's initial checkout can become stale while it waits. Recovery code must not assume “checked out at job start” remains current after waiting for another writer.

For fail-closed writers:
- rebase conflicts should fail visibly;
- do not silently overwrite newer generated state.

---

# 9. SHELL / HEREDOC ROBUSTNESS

Two Aug 22 failures came from fragile heredoc usage rather than business logic:
- Unified Capital publish retry shell;
- THI workflow summary.

Rules:
- heredoc delimiters inside YAML `run: |` and nested loops/functions are indentation-sensitive;
- if a short Node expression can be written safely with `node -e`, prefer that over a fragile nested heredoc;
- a summary/reporting-only step should not turn a successfully published workflow RED because of avoidable formatting shell syntax;
- still fail the workflow for real writer/validator failures.

When a writer published but workflow conclusion is RED, inspect late summary/post steps before assuming production failed.

---

# 10. SECURITY DETECTOR PRECISION LAW

Security scanners must be strict **and semantically precise**.

False-positive cleanup must not become detector blindness.

Required regression shape:
- negative fixture(s): known safe syntax must not match;
- positive fixture(s): real dangerous syntax must still match.

Aug 22 examples:

JavaScript:
- safe Puppeteer `page.$eval(` / `page.$$eval(` must not be classified as JavaScript `eval(`;
- real dangerous `eval(` remains detectable.

Shell:
- arbitrary prose containing the word `eval` must not be classified as shell execution;
- real `eval "$value"` command remains detectable.

Avoid embedding the dangerous positive fixture literally in the verifier source if the scanner also scans that source; construct fixture text dynamically where needed.

---

# 11. PUBLIC DIAGNOSTIC PRIVACY LAW

Machine diagnostics that are committed into browser-accessible/public JSON are public surfaces.

Do not persist raw error stacks that expose:
- `/home/runner/...`;
- local filesystem layout;
- `file:///...` runner paths;
- developer-local paths;
- private emails/identifiers outside allowlist.

Preserve useful reason/category information while sanitizing environment-specific path detail.

Public Surface Privacy Guard should remain strict. Fix the diagnostic producer, not the guard, when real local-path leakage is detected.

---

# 12. FAIL-HONEST TELEMETRY LAW

A telemetry layer must not derive current integrity from a historically coherent but now stale snapshot if live guards exist.

THI precedent:
- old behavior read persisted `release.exactByteMatch` / evaluation state;
- release drift could therefore look green;
- new behavior executes canonical live release guard and current-stack verifier every refresh.

Correct telemetry principles:
- stale must be allowed to look stale;
- degraded must be allowed to look degraded;
- unknown must not become green;
- a new upstream state can temporarily make a downstream coherent packet stale, and telemetry should show that until the downstream refresh completes.

A red/warn state caused by real freshness mismatch is not a telemetry bug.

---

# 13. TRIGGER DESIGN — GENERATED OUTPUT VS ENGINE/POLICY

Broad `paths-ignore` patterns can accidentally suppress meaningful code changes.

Aug 22 Security precedent:
- ignoring all `security/**` prevented self-loop noise;
- but it also risked ignoring `security/security-sentinel.mjs` and policy changes.

Correct design:
- ignore generated Security state/history/vault outputs that the writer itself creates;
- do **not** ignore executable engine/policy changes that should trigger a new Security scan.

General rule:
**ignore generated outputs narrowly; never silence the code/policy that defines the writer itself merely because it shares the same directory.**

---

# 14. DIRECT CANONICAL TRIGGERS BEFORE AUXILIARY WAKEUPS

If a source/guard file materially changes the output of a canonical writer, add it to the canonical writer's own trigger paths when appropriate.

Use auxiliary recovery dispatchers only when needed for bounded recovery/event-topology reasons.

Aug 22 f(x) precedent:
`productivity/fxn-locker-apr-guard.mjs` was added directly to Unified Capital push paths so exact-source authority changes wake the canonical writer directly.

Avoid building permanent chains of helper-on-helper wakeups when one direct canonical trigger is sufficient.

---

# 15. PRODUCTION ACCEPTANCE EVIDENCE

For generated-state changes, acceptable proof usually requires the following union:

- merge commit on current `main`;
- canonical workflow run SUCCESS;
- exact critical steps SUCCESS, especially publish;
- fresh generated artifact timestamp after the relevant merge/change;
- expected new machine-readable fields/values/provenance;
- no unintended historical rewrite;
- no authority expansion;
- downstream coherence where the task requires it.

Example exact f(x) final proof:
- source official exact Locker block;
- generic pre-authority APR captured separately;
- exact APR selected into production;
- diagnostics present;
- historical snapshots not rewritten;
- Unified Capital writer publish SUCCESS.

---

# 16. RECOVERY WORKFLOW BOUNDARY

The release-recovery dispatcher is a control-plane coordinator only.

It may have `actions: write` so it can dispatch canonical workflows.
It should otherwise remain minimal and read-only with respect to canonical economic artifacts.

No wallet/capital authority is implied by GitHub Actions dispatch authority.

Keep distinction explicit:
- **workflow dispatch authority** = ability to ask an existing canonical read/write data workflow to run;
- **economic execution authority** = ability to move/claim/reinvest capital.

The second remains `none`.

---

# 17. WHEN TO STOP DEBUGGING

A stabilization incident is closed when:
- the original failure is physically repaired;
- downstream linked state is current;
- no stale-green masks remain;
- exact release guards pass;
- Security findings are explainable;
- temporary diagnostic PRs/workflows are closed or removed;
- no real incident-tail PR remains open;
- the remaining watch debt is clearly classified as future work, not part of the incident.

Do **not** continue creating speculative cleanup simply because more theoretical improvements are possible.

After Aug 22, the final stabilization cycle was declared closed only after:

`Security → Cognitive → Learning → Project Memory → THI`

all completed successfully and the final THI showed live integrity PASS.

---

# 18. TEMPORARY DIAGNOSTICS

Read-only diagnostic PRs/workflows can be valuable when connector/API visibility is limited.

Rules:
- minimum permissions (`contents: read`, `actions: read`) where possible;
- no production writer logic;
- never merge diagnostic branches;
- close them after evidence capture;
- do not leave temporary diagnostics as permanent architecture unless intentionally promoted.

Aug 22 diagnostic PR #257 was repeatedly reused for read-only Actions inspection and finally closed unmerged after the final proof.

---

# 19. COMPACT RECOVERY ALGORITHM

When a production writer appears stuck:

`fresh main`
`→ identify expected canonical writer`
`→ prove whether run exists`
`→ inspect exact failed/no-op step`
`→ repair smallest canonical boundary`
`→ PR exact-head CI`
`→ merge with fresh proof`
`→ verify actual writer SUCCESS`
`→ verify generated artifact`
`→ verify downstream handoff/freshness`
`→ close temporary diagnostics`
`→ write durable lesson to memory`

For release-recovery specifically:

`post-change Security`
`→ Observer freshness`
`→ exact release guard`
`→ Cognitive SUCCESS`
`→ Learning SUCCESS`
`→ Project Memory SUCCESS`
`→ THI SUCCESS`

---

# 20. FINAL LAW

**Recovery must restore canonical writers and canonical evidence — never bypass them.**

The safest system is not one that never turns red. It is one where red means something, the exact broken boundary can be identified, the repair is minimal, and the final green state is physically proven end to end.
