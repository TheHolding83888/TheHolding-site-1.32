# THE HOLDING — CHAT HANDOFF CHECKPOINT · 2026-09-06

Status: **temporary resume handoff only**  
Authority: observation / continuity only  
executionAuthority: **none**

> This file is not live truth. A new chat MUST start from live `intelligence/project-memory/CURRENT.md` on `main`, then latest continuity → Router → fresh artifacts / exact Actions evidence.

## Active objective

1. Finish PR #653 — Defitea native income ownership.
2. Then finish the independent Learning public-metadata privacy repair.

## Fresh branch state at checkpoint

- live `main`: `d3376b93ea7f383a1910f9979fd71a9f339c19a5`
- PR #653 branch `fix/defitea-native-income-ownership-20260906`: `7e1e2935c0bef7bee8bfc94af30ac5ef6790d28a`
- privacy branch `fix/learning-public-metadata-redaction-20260906`: `1dae18d3feccb692abbaf3d59f509c02f8224953`

These SHAs are resume hints only. Re-fetch all three before acting.

## PR #653

Intent: canonical income belongs only to the company named by the canonical row/event (`row.company === target company`). YieldRing / 05081966 Productivity income may remain reference context but must not enter Defitea cash flow / Generated or Defitea TVL.

Important invariants:
- Canonical Income Ledger remains sole factual earned-income authority.
- Reference APR stays non-authoritative.
- `UNKNOWN != 0`.
- no wallet/capital execution.

Earlier blockers already fixed:
- monthly/reporting version drift;
- Defitea runtime ledger schema must remain `0.1-defitea-income-composition`, while composition semantics may be v0.2.

Before merge: inspect exact-head checks on the CURRENT #653 head, especially Reporting Layer full writer/integration; compare against fresh `main`; merge only if clean/mergeable.

## Learning privacy repair

Root cause: engineering lesson adapter verified git subjects correctly but published raw commit subjects into `engineering-lesson-candidates.json`; one merge subject contained repository-owner metadata and Public Surface Privacy Guard correctly rejected it.

Correct direction:
- keep subject verification internal;
- publish only sanitized evidence diagnostics (short SHA + marker matched/mismatch);
- do NOT weaken Public Surface Privacy Guard;
- generated `engineering-lesson-candidates.json` must exactly match adapter semantics and have a valid recomputed integrity hash;
- verify independent engineering reviewer + Public Surface Privacy Guard before merge.

Current privacy branch contains the adapter redaction work and a sanitized generated output, but verify that adapter output strings and committed generated output are exactly deterministic before opening/merging its PR.

## Resume order

1. live CURRENT
2. latest continuity linked by CURRENT
3. Router
4. fresh `main`
5. exact PR #653 head/checks/diff → finish/merge/prove
6. exact privacy branch diff/checks → finish/open PR/merge/prove
7. refresh normal continuity after material completion
