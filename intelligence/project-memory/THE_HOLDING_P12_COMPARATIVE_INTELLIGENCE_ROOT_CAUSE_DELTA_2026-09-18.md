# THE HOLDING — P12 COMPARATIVE INTELLIGENCE ROOT-CAUSE DELTA
## 2026-09-18 · preparation only · do not merge before P10 acceptance

Authority: observation / cleanup planning only  
`executionAuthority = none`

This delta reviews Runtime Reliability issue #726 without changing production code, workflow authority, capital methodology, or `main`.

---

## Incident

Issue: `#726 [Runtime Reliability] repeated-failure · update-comparative-intelligence`

Original observer classification:
- repeated production failures;
- root cause `UNKNOWN_UNTIL_REVIEWED`.

Post-review classification:

**RESOLVED CAPITAL-COHERENCE INCIDENT / STRONG CLOSE CANDIDATE AFTER FINAL LIVE RECURRENCE CHECK**

---

## Exact failed run

Workflow:
`The Holding · Comparative Intelligence`

Representative failed run:
- run id: `34440696480`
- run number: `107`
- event: `workflow_run`
- head SHA: `a3b3a6edb44ff20995e30d82e5c9f65a7101e5d0`
- created: `2026-09-10T05:20:47Z`
- conclusion: failure

The Comparative builder itself completed successfully and reported:

`Comparative Intelligence built { companies: 10, leaders: 5, risks: 1, opportunities: 3, transitions: 1 }`

Publication was then rejected by validation with the exact error:

`Error: Capital ranking diverges from Network TVL`

This proves the incident was not a generic Comparative runtime crash. The fail-closed capital-coherence guard rejected a ranking generated from inputs whose company-capital aggregate did not match the authoritative Network TVL boundary.

---

## Recovery chain

The failed Comparative head `a3b3a6ed...` is also the base of PR #725:

`Restore final public TVL and company capital coherence`

PR #725 established the authoritative public capital contract around **unique company capital** and Network TVL, including:
- public Network TVL derived from canonical company capital;
- no double counting of nested / related-company structures in authoritative network capital;
- removal of stale authoritative fallback behavior;
- Capital State / Public TVL parity proof;
- explicit company network contribution semantics.

PR #725 merged as:

`acb3a2f82c606356cc7fc13f2d1ebb23dac5150e`

A subsequent boundary repair, PR #728 / merge commit:

`145cc9c29f39f9e6df5c9b07900e3e294b5d2bc9`

restored the Defitea own-capital boundary:

> Defitea Fund and defitea.eth publish only Defitea-owned capital; related company capital remains separate.

After these coherence repairs, canonical capital physically rematerialized as:

`c3dfd4f6dd4ffe073f2cd8deb48a99c52b131dbe`

commit message:

`capital: refresh coherent production snapshot`

Then Comparative executed naturally from that coherent capital head:

- run id: `34446892435`
- run number: `108`
- event: `workflow_run`
- head SHA: `c3dfd4f6dd4ffe073f2cd8deb48a99c52b131dbe`
- created: `2026-09-10T06:48:31Z`
- completed: `2026-09-10T06:48:59Z`
- conclusion: **success**

The evidence therefore supports a repair chain rather than attributing closure to one isolated commit:

`incoherent company/network capital boundary → #725 canonical unique-capital contract → #728 Defitea own-capital correction → fresh coherent capital snapshot → Comparative GREEN`

---

## Root cause

> **Comparative Intelligence consumed a capital generation whose authoritative company-capital aggregate and Network TVL were not coherent under the same ownership / uniqueness boundary. The validator correctly refused to publish a ranking that did not reconcile to Network TVL.**

The failure was therefore a capital-source coherence incident, not a reason to weaken Comparative validation.

---

## Durable lesson

Comparative analytics may rank companies only from a capital generation that shares one canonical accounting boundary with public Network TVL.

Preventive invariant:

`sum(authoritative unique company capital) == Network TVL used by Comparative generation`

Nested / related-company capital may be shown as context, but must not be double-counted into authoritative network capital.

A successful builder followed by a coherence-validation failure should be diagnosed as an input-generation / authority-boundary mismatch before modifying ranking logic.

---

## P12 closure condition for #726

Before closing issue #726 during active P12:

1. fresh-check that no recurrence of the same Comparative repeated-failure fingerprint exists after the coherent-capital recovery;
2. reference failed run #107 and its exact `Capital ranking diverges from Network TVL` validation error;
3. reference the #725 + #728 coherence repair chain and physical capital snapshot `c3dfd4f6...`;
4. reference natural Comparative run #108 GREEN on that coherent snapshot;
5. close as a resolved historical capital-coherence incident.

No new Comparative production code repair is currently justified for this fingerprint.

---

## Status consequence

#726 moves from:

`HEALTHY TODAY / ROOT CAUSE INCOMPLETE`

to:

`RESOLVED_EVIDENCE / STRONG CLOSE CANDIDATE AFTER FINAL LIVE RECURRENCE CHECK`

The fail-closed reconciliation guard should remain intact.