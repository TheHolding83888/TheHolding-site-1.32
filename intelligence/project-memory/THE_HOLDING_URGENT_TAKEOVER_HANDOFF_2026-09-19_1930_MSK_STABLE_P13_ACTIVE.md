# THE HOLDING — URGENT TAKEOVER HANDOFF

**Timestamp:** 2026-09-19 19:30 MSK  
**Purpose:** hand off the live work from the current chat to a parallel/new chat after takeover work was interrupted.  
**Checkpoint branch:** `checkpoint/urgent-handoff-20260919-1930-msk-stable-p13-takeover`  
**Branch base / exact live `main` observed before writing this handoff:** `b3b3051ab1afad86ed992d90d50710d0cba943ee`  
**Observed main commit time:** 2026-09-19T15:57:23Z = **18:57:23 MSK**  
**Observed main message:** `intelligence: refresh vlcvx votium curve pool context`

> IMPORTANT: this checkpoint branch is recovery/memory only. Do **not** merge it into `main` as product code. Re-read fresh `main` before doing any implementation because automatic workflows keep moving `main`.

---

## 1. CANONICAL RECOVERY ORDER

Always recover current truth in this order:

`live main → CURRENT.md → latest continuity → Router → task-specific canon → fresh machine artifacts → exact workflow/run evidence → older handoffs`

Do not trust this prose over newer machine evidence.

Current `CURRENT.md` on `main` at handoff time says canonical state represented there is `2026-09-19T15:47:40.409Z` and points to:

`intelligence/project-memory/THE_HOLDING_MASTER_CONTINUITY_2026-09-19_154742_AUTO_8d1e87e7.md`

Then load:

`intelligence/project-memory/THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`

Core execution discipline remains:

`DIAGNOSE != REPAIR != PROVE != CLOSE`

One primary failure class at a time. Green workflow alone is not closure; physical generated artifacts and production UI acceptance matter.

---

## 2. OWNER INSTRUCTION / CURRENT PRIORITY

The owner has explicitly handed active work to the next chat and wants it to **continue fixing**, not merely track.

There is an active user-visible production regression on the Stable Index page:

- `Curve · scrvUSD` → `0.00%`
- `f(x) Protocol · fxSAVE` → `0.00%`
- `Inverse · sDOLA` → `0.00%`
- `Aave · sGHO` → `0.00%`

Owner screenshot at approximately **19:16 MSK** still showed all four as `0.00%` on `theholding.ai/companies/` → Stable Index.

Owner requirement is explicit: **the percentages should display; dashes/pending as the end-state are not acceptable if the rates can be recovered correctly.**

Do not fake values. Restore the real numeric data path first. UI must also stop converting unknown/null into economic zero.

---

## 3. WHAT HAPPENED BEFORE THIS TAKEOVER

### 3.1 Stable regression origin

Before the regression, Stable rate adapters had been working. A later performance/reliability change parallelized rate collection to fit the bounded workflow runtime. Four Ethereum historical/archive strategies then began failing together.

The common failure observed in physical `companies/stable-capital-data.json` is:

`https://eth.blockscout.com/api/eth-rpc` → `exceeded maximum retry limit`

Those four strategies share the heavy Ethereum historical/archive-read class. Other strategies still return numeric rates.

The artifact itself correctly stores those four as `annualYieldPct: null`, not zero. The UI path has been observed converting a nullable value through JavaScript `Number(...)`, where `Number(null) === 0`, producing a false `0.00%` display.

Therefore there are two separate failure classes:

1. **data-path failure** — four historical-rate reads are unavailable;
2. **renderer semantics failure** — unknown/null is displayed as `0.00%`.

The owner’s desired end state requires fixing both, while prioritizing real data recovery.

---

## 4. PR #869 — IMPORTANT BUT NOT SUFFICIENTLY CLOSED BY PHYSICAL OUTCOME

PR **#869** was merged:

- title: `Stable: capability-aware historical RPC transport`
- merged at: `2026-09-19T11:47:37Z` = **14:47:37 MSK**
- merge commit: `ec2573990507f8244b808cdd3db3babb219eadcc`
- head branch: `fix/stable-historical-rpc-truth-20260919`
- head SHA: `782fd4792e27754aeec2c167f482b3f01e83e993`

Its intended architecture is correct and bounded:

- one shared Ethereum historical RPC capability selector for the existing canonical Stable writer;
- admit an endpoint only after a real historical `eth_call`;
- preserve `UNKNOWN != 0` and fail-closed semantics;
- no second Stable writer;
- no methodology/accounting/security/capital authority expansion;
- no protocol-specific hardcoded fixes;
- no new writer workflow/fan-out.

The PR body itself defines the production exit proof as:

> canonical `Update Stable Capital` writer must self-run, materialize fresh Stable artifacts plus `intelligence/reliability/stable-rpc-capability.json`, and preserve null/UNKNOWN wherever historical state capability is not proven.

### Critical current observation

Despite #869 being merged, the latest `companies/stable-capital-data.json` read during this handoff is still:

- generatedAt: `2026-09-19T11:54:41.346Z` = **14:54:41 MSK**
- Curve scrvUSD: `annualYieldPct: null`, status `warming-archive-unavailable`
- f(x) fxSAVE: `annualYieldPct: null`, status `warming-fxsave-archive-unavailable`
- Inverse sDOLA: `annualYieldPct: null`, status `warming-archive-unavailable`
- Aave sGHO: `annualYieldPct: null`, status `warming-archive-unavailable`
- each still shows the Blockscout endpoint retry failure.

And the live site screenshot around **19:16 MSK** still renders all four as `0.00%`.

**Conclusion:** do NOT classify the owner-visible Stable issue as closed merely because #869 merged or a capability canary was green. Physical production state is still wrong for the owner’s acceptance criterion.

Possible reasons to test, not assume:

- the four strategy adapters may still bypass the shared capability-aware transport and call Blockscout directly;
- the selector may prove an endpoint in one path but the actual strategy historical calls still use a different helper/path;
- the post-merge writer may not have rematerialized the affected rates from the intended transport;
- the site may be reading a stale artifact, though current artifact inspection already confirms the four nulls, so this is not only a front-end-cache issue.

Do not choose a repair until the exact path is proven from fresh code + run logs.

---

## 5. RECOMMENDED NEXT BOUNDED PACKET — STABLE FIRST

This should be the first active objective for the next chat because it is a visible production defect explicitly raised by the owner.

### DIAGNOSE

1. Re-read fresh `main` SHA.
2. Inspect current versions of:
   - `stable-capital/stable-capital-engine.mjs`
   - the shared historical/capability RPC helper introduced by #869
   - `.github/workflows/...` for canonical `Update Stable Capital`
   - `companies/stable-capital-data.json`
   - `companies/stable-index-data.json`
   - `intelligence/reliability/stable-rpc-capability.json`
   - Stable Index renderer in `companies/index.html`
3. Find the latest canonical Stable writer run **after #869 merge**. Inspect exact jobs/steps/logs/artifacts.
4. Prove whether each of the four adapters uses the shared capability-selected endpoint or still reaches `eth.blockscout.com/api/eth-rpc` directly.
5. Separate data transport failure from renderer bug; do not mix causal conclusions.

### REPAIR — only after proof

Preferred system rule:

- one canonical Stable truth/writer path;
- one shared historical RPC transport/capability layer;
- bounded concurrency for heavy historical Ethereum reads if the host/provider cannot sustain concurrent requests;
- no second writer;
- no four protocol-specific hardcodes;
- no arbitrary stale value pretending to be current;
- `UNKNOWN != 0` everywhere.

If the transport already has a proven alternate archive endpoint, make the four adapters consume that common transport correctly. If the issue is concurrency/rate-limiting, limit only the shared heavy historical class rather than serializing all ten unrelated rate adapters.

### UI invariant

Regardless of backend outcome, the renderer must never do this semantically:

`null → Number(null) → 0 → 0.00%`

A genuine onchain/protocol `0%` must still be allowed to render as `0.00%` when the raw source is actually finite zero.

The owner wants a numeric percentage end state for these strategies, so renderer fallback is only a safety layer. The production acceptance target is fresh/reliably obtained numeric rates.

### PROVE / CLOSE

Do not close until all are true on a fresh exact-head / merged production state:

- canonical Stable writer completes;
- physical Stable artifacts are freshly generated;
- all four affected strategies have finite numeric `annualYieldPct` again, unless a protocol itself truly reports zero;
- no second writer / no methodology change / no authority expansion;
- the public Stable Index shows the correct numeric percentages and no false zero;
- screenshot/live acceptance confirms the site state.

If the external archive ecosystem truly cannot provide historical state after bounded retries across approved capability endpoints, record `WAITING_EXTERNAL_PROOF`; do not invent APR.

---

## 6. P13 TAKEOVER WORK ALREADY DONE IN THIS CHAT

The previous detailed handoff said P10 was closed, P11 was effectively N/A, P12 closed, and the active roadmap stage was **P13 pre-private checks**.

During this takeover, the first explicit P13 primary gate was re-reviewed:

### PR #870

- title: `P13: classify current Security High watch items`
- branch: `review/p13-security-highs-20260919`
- reviewed base: `38bf508cd23476aeda220285d61060e2741654a1`
- merged at: `2026-09-19T15:46:51Z` = **18:46:51 MSK**
- merge commit: `551208719fbdfde398fb2c970884188199dd4174`

What #870 established:

- current Security Intelligence: **Critical 0 / High 2 / Medium 73**;
- both High findings are current `pull_request_target`-class findings;
- both remained visible, reviewed and bounded;
- they were classified as non-blocking for P13 under current permissions/execution boundaries;
- drift conditions were documented to reopen review;
- no Sentinel suppression, sensitivity reduction, authority/capital/security expansion or workflow mutation;
- **#870 explicitly did NOT claim full P13 closure.**

Current `CURRENT.md` after #870 says:

- canonical snapshot represented: `2026-09-19T15:47:40.409Z`;
- Security Sentinel: WATCH, Critical 0 / High 2 / Medium 73;
- execution authority: none;
- Cognitive Stack: WATCH, readyForManualInterpretation true;
- Grounded Brain / ChatGPT Bridge: WATCH;
- Proposal / Builder / Guardian remain non-production-authoritative.

---

## 7. P13 REMAINING GATES — NOT CLOSED HERE

Do not claim P13 closed yet. The #870 PR body itself preserves these remaining operational gates:

1. Workflow Control Plane / no-new-debt
2. repository/privacy hygiene
3. production/currentness
4. accounting/lifecycle consistency
5. active/queued Actions classification
6. project-memory recovery path

During this chat I began reviewing recent run history, including `Reporting` and `Intelligence Progress`, but the workflow-run audit was interrupted before a complete exact-current closure packet was produced.

Important nuance discovered:

- some older Reporting runs were cancelled and appeared consistent with concurrency/supersession rather than an independent production defect;
- this was **not** fully closed with exact newest-run evidence before the interruption;
- main kept moving automatically during the review, so all run conclusions must be rechecked against fresh `main`.

Therefore the next chat should **not** resume from an old red run ID. It should list the newest runs by exact workflow path and compare chronology + head SHA + physical output.

After the owner-visible Stable regression is fixed, resume P13 from these remaining gates and produce one bounded closure packet only when fresh evidence supports it.

---

## 8. MAIN DRIFT / CURRENT LIVE STATE AT CHECKPOINT CREATION

The exact live `main` checked immediately before this handoff branch was created:

`b3b3051ab1afad86ed992d90d50710d0cba943ee`

Time:

`2026-09-19T15:57:23Z` = **18:57:23 MSK**

Message:

`intelligence: refresh vlcvx votium curve pool context`

Parent:

`2ff5ae7244ea5340cb222d31ddfca8320d1c8ed0`

This demonstrates active bot-generated drift after #870. Always rebaseline before implementation and before merge.

---

## 9. PREVIOUS IMPORTANT HANDOFF

Earlier emergency handoff exists:

Branch:

`checkpoint/urgent-handoff-20260919-1814-msk-post869-p13-active`

File:

`intelligence/project-memory/THE_HOLDING_URGENT_TAKEOVER_HANDOFF_2026-09-19_1814_MSK_POST869_P13_ACTIVE.md`

It contains the broader P10–P13 history and #869 production context. Use it as historical recovery only after loading fresh `CURRENT` and live evidence.

This 19:30 handoff supersedes it specifically for the immediate **Stable 4-zero regression + P13 takeover state**.

---

## 10. DO NOT DO

- Do not create a second Stable writer.
- Do not hardcode four protocol APRs just to make the UI look green.
- Do not treat `null` as `0`.
- Do not silently treat stale APR as fresh current APR.
- Do not change Stable accounting methodology, capital semantics, wallet/security authority or protocol universe unless separately authorized and proven necessary.
- Do not reopen already proven P10/P11/P12 architecture without fresh evidence of a regression.
- Do not close P13 from old prose or green workflow names alone.
- Do not switch public → private or enter any P16/private visibility boundary without explicit owner confirmation if the roadmap still defines that as a confirmation boundary.

---

## 11. TAKEOVER SEQUENCE FOR THE NEXT CHAT

Use this exact sequence:

1. `git/live main` fresh read.
2. `CURRENT.md` → latest continuity → Router.
3. Read this handoff and prior 18:14 handoff.
4. Check open PRs/active branches.
5. Check canonical Stable workflow + latest runs/jobs/logs/artifacts after #869.
6. Diagnose why the four strategies still materialize `null` despite #869.
7. Repair **one common data-path failure class**.
8. Prove exact-head → merge → production materialization.
9. Fix/verify Stable Index null-render invariant (`UNKNOWN != 0`).
10. Verify live site numeric percentages for all four affected strategies.
11. Only then resume remaining P13 pre-private gates.
12. Write a new detailed checkpoint after material work or before context limit.

---

## 12. CURRENT STATUS SUMMARY

### GREEN / established

- P10/P11/P12 were previously handed off as closed/bounded; verify only if fresh evidence contradicts.
- #869 merged: capability-aware Stable historical RPC transport exists in architecture.
- #870 merged: two Security High watch items freshly classified and non-blocking under current boundaries.
- Security Critical = 0.
- execution authority remains none.
- no permission to mutate capital/wallet execution or public/private visibility was granted here.

### YELLOW / active

- **Stable Index 4-strategy numeric rate regression remains visibly unresolved.**
- #869 architectural repair has not yet produced the owner-required physical end state for those four rates.
- UI still visibly maps the current unknown state to `0.00%` on the owner’s screenshot.
- P13 is partially reviewed, not closed.

### NEXT PRIMARY OBJECTIVE

**Restore real finite numeric rates for Curve scrvUSD, f(x) fxSAVE, Inverse sDOLA and Aave sGHO through the canonical Stable truth path, prove the production materialization, then ensure the renderer can never misstate unknown as zero.**

After that, continue P13 pre-private closure gates.
