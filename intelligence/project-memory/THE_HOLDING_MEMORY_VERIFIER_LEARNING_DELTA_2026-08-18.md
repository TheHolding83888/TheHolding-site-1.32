# THE HOLDING — PROJECT MEMORY VERIFIER LEARNING DELTA
## 2026-08-18 · memory-system upgrade integration lessons

## Why this delta exists

While upgrading GitHub-owned Project Memory after Company #010 Project X + HyperLend, the new memory content itself was coherent, but CI exposed several older verifier assumptions that had become stale.

This is worth preserving because it is a reusable systems lesson: **a verifier is part of the operating contract, but a verifier can itself become legacy when the canonical contract deliberately evolves.** The correct response is not to disable the guard and not to revert useful architecture merely to satisfy an incidental old sentinel. The guard must be upgraded to verify the new semantic invariant while preserving the original safety intent.

---

## 1. Project Memory Bootstrap verifier drift

Old verifier assumed:
- exactly 5 Resume items;
- Resume section ended immediately before Owner Collaboration;
- item 4 was README;
- item 5 instructed direct live-artifact reading.

The memory-system upgrade intentionally introduced a first-class Routing Index and a dedicated `Task-aware retrieval` section, changing the canonical bootstrap to 6 items:

1. latest master continuity;
2. Owner Collaboration canon;
3. Build Discipline canon;
4. Memory Routing Index;
5. Project Memory README;
6. follow router to task-specific durable blocks + live artifacts.

The old verifier therefore RED even though the new architecture was stronger.

Correct fix:
- update the verifier to require the new six-step semantic contract;
- separately verify the Task-aware retrieval section;
- preserve the deterministic `CURRENT.md` generation and CURRENT-only mutation boundary.

Lesson:
**Do not encode an intentionally evolvable architecture as an incidental fixed count without also updating the guard when the canonical topology changes.**

---

## 2. Known Mechanism canon phrase drift

Old verifier required one exact historical substring:

`Solved mechanism = reusable end-to-end capability`

The canon was deliberately strengthened to:

`Solved mechanism = reusable end-to-end economic capability, not a remembered reader or code snippet.`

The new formulation is stricter and now also covers:
- multi-leg promotion parity;
- economic vs enumerable inventory;
- nonzero-active unresolved measurement fail-closed behavior;
- rate lifecycle parity;
- Aave-like embedded-interest vs external-incentive semantics.

Correct fix:
- retain the original semantic prefix `Solved mechanism = reusable end-to-end`;
- add checks for the new substantive laws;
- avoid using one exact prose sentence as the entire proof that the canon remains valid.

Lesson:
**Durable canons should be verified by semantic coverage, not frozen wording when wording can become more precise without changing the invariant.**

---

## 3. Company #010 ve Rewards capability marker drift

Before Project X full parity, the Rewards overlay capability marker used:

`crv-and-ve-reward-semantics-0.4-measured-earned-presentation-parity`

After Project X full multi-leg integration, the current canonical Project-X-enabled state correctly uses:

`crv-ve-and-projectx-reward-semantics-0.5-multileg-parity`

The existing ve Rewards verifier still required only the older 0.4 marker. The live ve mechanism itself remained correct and measured; the failure was the stale admission sentinel.

Correct fix:
- accept the legacy 0.4 capability where an intentionally pre-Project-X compatible staged snapshot is used;
- accept the current 0.5 capability when Project X is present;
- continue to verify the actual ve economic invariants: managed/direct custody, Compounded/Claimable classification, USD valuation parity, embedded exclusion from claimable total, Votium unresolved boundary and no execution authority.

Lesson:
**A capability version gate must distinguish compatible staged schemas from actual semantic regression. Do not force the current system back to an older capability marker simply to make a verifier green.**

---

## 4. General verifier evolution law

When a mature guard turns RED after an intentional architecture upgrade, classify the failure before changing anything:

1. **real semantic regression** → fix production/candidate behavior;
2. **stale verifier topology/version/wording** → upgrade guard while preserving its safety intent;
3. **ambiguous case** → fail closed and inspect exact evidence.

Never respond by:
- deleting the guard;
- weakening it to a generic “file exists” check;
- reverting a stronger canonical architecture solely to satisfy old incidental syntax;
- hardcoding current output to fool the check.

Prefer:
- semantic invariants;
- explicit compatibility sets for staged schema versions;
- exact economic/accounting assertions;
- deterministic generated-output checks;
- fail-closed unknown handling.

---

## 5. Memory-specific law

Project memory is not only prose. Its builders, routers, verifiers and refresh workflows are part of the memory system.

Therefore a memory upgrade is complete only when:

`content → routing → bootstrap generation → bootstrap verification → production refresh topology`

all agree on the same current contract.

A future model should treat a RED memory verifier as evidence to investigate, not as a reason to bypass GitHub-owned continuity.

---

## Compact rule

**Guard the invariant, not the accident of its old formatting or version label.**
