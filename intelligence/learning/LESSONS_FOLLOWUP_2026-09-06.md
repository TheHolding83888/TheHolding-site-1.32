# THE HOLDING — LESSONS FOLLOW-UP
## 2026-09-06

Status: durable roadmap / resume context only  
Authority: observation / architecture guidance only  
executionAuthority: none

## Why this exists

The top-level Learning brief currently reports `lessons = 0`, while the wider Learning system already contains substantial remembered experience and observations. This is not evidence that The Holding is not learning. It reflects a deliberately narrow formal Lesson lane: current formal lessons require an evidence-bound settled outcome, and the existing owner Decision → Outcome records have not reached that state.

Do **not** inflate the lesson count by converting remembered cases or observations into lessons without proof.

## Agreed sequence

1. Finish factual accounting and Company Passport reporting first.
2. Prove August / September owner-facing reporting on live production from canonical evidence.
3. Then improve the existing Learning Loop; do not build a second Learning organ.

## Required Lessons extension

Reuse the existing Decision & Outcome Learning architecture and add one bounded normal source for verified engineering / reliability experience:

`incident → root cause → fix → production verification → lesson candidate`

A candidate may become a formal Lesson only when the result is actually proven. Repeated evidence may strengthen promotion, but accumulation alone grants no causal, policy, repository, wallet, capital or execution authority.

## Canonical evidence contract for engineering lesson candidates

A candidate should carry, at minimum:

- stable incident / case identity;
- observed failure or limitation;
- root-cause evidence;
- exact fix PR / commit;
- exact verification workflow, artifact or live-production proof;
- observed outcome;
- settlement / verification status and time;
- provenance for every material claim.

Unresolved or unverified incidents remain candidates, never settled lessons. `UNKNOWN != 0` applies here too.

## First high-quality historical candidates

These are candidates, not automatically promoted lessons:

1. **Routine workflow launch reliability**
   - problem: chat could no longer directly launch arbitrary fresh `workflow_dispatch` runs through the available connector surface;
   - fix: bounded Operator Command Bridge expansion in PR #639;
   - proof path: real bridge command → Bridge success → `github-actions[bot]` Unified Capital Refresh → downstream Reporting / Monthly chain.

2. **Company #007 current-state vs historical-state separation**
   - problem: redeemed Yield Basis LP history could remain in current productive inventory;
   - fix: current-state downstream binding in PR #640;
   - required lesson proof: corrected current inventory plus preserved history plus downstream accounting/reporting materialization.

3. **Accounting reconciliation closure**
   - problem: factual mechanism coverage and settlement linkage were incomplete;
   - fixes include the systemic accounting coverage work culminating in PR #644;
   - proof: current Accounting Coverage Registry has zero reusable gaps and zero unmatched canonical events, while Canonical Income Ledger remains sole factual income authority.

4. **Owner-facing partial-period factual reporting**
   - problem: Canonical Ledger contained recognized factual income, but Company Passports showed `—` whenever whole-period completeness was still false;
   - fix: PR #645 displays only already-recognized `observedEarnedIncomeUsd` as explicitly partial / observed income, while unknown no-evidence rows remain `—` and no missing period is estimated;
   - promote only after live-site verification confirms correct August / September behavior.

## UI / observability follow-up

The Learning surface should eventually distinguish at least:

- remembered experience;
- coherent observations;
- verified engineering lesson candidates;
- settled formal lessons.

Avoid presenting `Lessons: 0` in a way that implies the system has zero accumulated learning.

## Non-negotiable boundaries

- no second source of truth for Learning;
- no automatic code or policy mutation from a Lesson;
- no autonomous production merge or release authority;
- no wallet signing, claiming or capital execution;
- no lesson promotion merely to improve a dashboard number;
- preserve provenance and fail closed.

This file is durable resume context. Changing production facts must still be re-read from live `main`, generated artifacts and exact workflow evidence before acting.
