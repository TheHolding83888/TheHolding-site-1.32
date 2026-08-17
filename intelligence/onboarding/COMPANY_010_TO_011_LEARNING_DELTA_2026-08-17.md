# THE HOLDING · COMPANY #010 → #011 LEARNING DELTA
## 2026-08-17 · Cypher onboarding lessons

## Objective
Preserve the proof bar that made Cypher trustworthy while removing avoidable repetition from the next company admission.

## What must remain mandatory
- Live GitHub `main` is source of truth before every production candidate.
- `unknown != zero` and `partial != total` are hard economic invariants.
- New mechanisms require evidence; known mechanisms reuse existing adapters.
- Reference APR, claimable rewards and realised cash flow remain separate concepts.
- Every writer must fail closed on stale source contracts.
- Workflow GREEN is not publication proof; generated artifacts must be physically verified in `main`.
- Public UI may reveal only what canonical substrate can prove.
- `executionAuthority = none` remains the default authority boundary.

## Cypher failure classes that should not recur
1. **Stale-head churn** – autonomous writers advanced `main` while admission branches were open.
2. **Publication shell defect** – a nested heredoc passed review but failed only in the writer publication shell.
3. **Implicit downstream trigger assumption** – a `GITHUB_TOKEN` writer push did not wake the next `push` workflow.
4. **Too many micro-merge cycles** – research, publication and orchestration repairs were split more than necessary.
5. **Monolithic public page friction** – direct edits to a large Companies HTML surface create unnecessary delivery risk.

## #011 default onboarding contract
1. **Fresh-main preflight** – bind exact base SHA and inspect current canonical manifests/workflows.
2. **Identity and owner inputs once** – persist owner-declared facts so they are never re-requested.
3. **Mechanism classification** – partition positions into:
   - known adapter reuse;
   - new bounded resolver;
   - unresolved / warming.
4. **Economic closure** – produce a machine-readable current-state artifact with explicit completeness flags.
5. **One writer preflight** – syntax-check every shell/Node path and exercise publication logic before merge.
6. **Explicit DAG** – downstream jobs use `workflow_run`/declared orchestration rather than accidental token-trigger behavior.
7. **One coherent admission candidate** – backend + verifier + bounded public manifest/integrator where practical.
8. **Post-merge proof** – verify writer success, then fetch the generated artifact from physical `main`.
9. **Public admission compiler** – patch the current Companies surface from a small company-specific adapter/manifest instead of manually rewriting the monolith.
10. **Index fail-closed gate** – a company can be Registry-live before it is index-comparable; no weight until required capital/performance inputs are complete.

## Cypher-specific reusable precedent
Cypher demonstrated that The Holding can admit a company in stages:

`discovered → resolved → economically closed → partial canonical capital → Registry live → Index pending → complete/index eligible`

This is a feature, not an error state. It allows the system to surface verified knowledge early without manufacturing missing data.

## Public admission seam introduced by #010
Company #010 uses a small canonical public adapter sourced from `companies/company-010-production-state.json` plus a fail-closed admission integrator. The integrator validates exact HTML anchors, updates registry metadata and installs the loader while deliberately refusing to insert Registry #010 into weighted `INDEX_STATE` while Fluid total capital remains incomplete.

Future companies should generalize this seam rather than add another bespoke monolithic edit path.

## Performance target for the next complex company
The quality bar stays the same, but the normal path should require materially fewer owner interventions and production merges. A complex company should ideally converge through one research/closure tranche and one coherent production admission tranche, with exceptions only for genuinely new protocol mechanics or failed evidence.
