# THE HOLDING — CHAT HANDOFF CHECKPOINT · 2026-09-06

Status: **temporary resume handoff only**  
Authority: observation / continuity only  
executionAuthority: **none**

> This file exists only so a new chat can recover the active work if the current chat loses context. It is NOT a source of live truth. On resume, always re-read `intelligence/project-memory/CURRENT.md` from live `main`, then the latest continuity, Router, fresh artifacts and exact Actions/PR evidence.

## Active objective

Finish the Defitea native-income ownership repair and then close the independent Learning privacy regression.

## PR #653 — Defitea native income ownership

- PR: `#653` — `Defitea: enforce native income ownership`
- head branch: `fix/defitea-native-income-ownership-20260906`
- checkpoint head observed: `049dd1a7f33e3d8e6aed4e04a40385bb7b63b142`
- live `main` had already advanced to `4785c5f77e49ec1209437b00f46fa8c67f7a323b` from automated Monetra publication, so PR branch is diverged and must be revalidated against fresh `main` before merge.
- changed files in #653 are limited to:
  - `reporting/company-monthly-earned-income.mjs`
  - `reporting/defitea-income-composition-validation.mjs`
  - `reporting/defitea-income-composition.mjs`
  - `reporting/income-ledger-policy.json`
  - `reporting/income-ownership.mjs`
- intended invariant: canonical income belongs only to the company named by the canonical event/row; foreign-company reference productivity may remain audit/context but cannot enter Defitea earned cash flow or Defitea TVL.
- `UNKNOWN != 0`, Reference APR remains non-authoritative, no wallet/capital authority.
- checks already observed green on the last exact candidate before main advanced: Company Monthly Reports, Company #009 Beefy, Project X Income Accounting, Repository Hygiene, Commit Identity Privacy Guard.
- Reporting Layer static/semantic validation had been repaired; the last long integration run was still being observed when this checkpoint was written.
- Public Surface Privacy Guard failure is independent of the Defitea diff and comes from a pre-existing Learning generated output.

## Independent privacy regression

- working branch: `fix/learning-public-metadata-redaction-20260906`
- root cause proven: `intelligence/learning/engineering-lesson-candidate-adapter.mjs` writes raw git commit subjects into `evidenceChecks[].detail`.
- current `intelligence/learning-state/engineering-lesson-candidates.json` therefore contains repository-owner metadata from a merge commit subject and is rejected by `security/public-surface-privacy-guard.mjs`.
- Privacy Guard itself is behaving correctly; do not weaken/exclude Learning state from the guard as the first fix.
- correct fix direction: keep the commit-subject check internally, but emit a sanitized diagnostic detail (for example `subject marker matched` / `subject marker mismatch`) rather than the raw subject; regenerate the candidate output and its integrity hash; verify the independent engineering reviewer and Public Surface Privacy Guard.
- no policy/authority expansion.

## Resume order

1. Read live `CURRENT.md` from `main`.
2. Read latest continuity referenced by CURRENT.
3. Read Router.
4. Re-read PR #653 exact head, live main and exact checks; do not trust the SHAs above if they moved.
5. If #653 is clean/mergeable after current-main revalidation, merge it under the existing bounded owner authorization and prove the resulting live artifacts/checks.
6. Complete the Learning privacy fix on its separate branch; regenerate sanitized `engineering-lesson-candidates.json`; run/inspect reviewer + Public Surface Privacy Guard; open/merge separate PR only when clean.
7. After material work, refresh continuity/checkpoint through the canonical project-memory mechanism; this handoff file can remain historical.
