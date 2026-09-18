# THE HOLDING — P12 CLEANUP/FREEZE PREPARATION
## 2026-09-18 · evidence inventory only · DO NOT MERGE BEFORE P10 ACCEPTANCE

Status: **PREPARATION / READ-ONLY DECISION MANIFEST**  
Base `main`: `d9018a5468634d48e2b3166b317738720ae84ff2`  
Authority: repository observation and future cleanup planning only  
`executionAuthority = none`

## 1. Purpose and boundary

This manifest uses the waiting window before the final P10 Stable Capital natural-schedule proof to prepare P12 cleanup/freeze work without contaminating P10 acceptance.

Until P10 is physically closed:
- do not merge this branch;
- do not alter Stable Capital workflow/data paths;
- do not retire or edit production workflows merely to reduce Actions volume;
- do not delete branches;
- do not close reliability issues merely because a later run happened to succeed;
- do not weaken security, accounting, workflow-control or evidence guards;
- do not mutate methodology, wallet/capital authority or execution authority.

P12 activation sequence after P10 closure:
1. fresh-read `main`, CURRENT, latest continuity and live Actions;
2. refresh this manifest against live evidence;
3. close only objectively superseded PR surfaces;
4. resolve runtime issues only when root-cause/lesson/preventive evidence is sufficient;
5. run a fresh workflow-fanout audit;
6. apply only bounded fan-out reductions whose safety/domain coverage is proven;
7. exact-head checks → merge → post-merge production proof.

## 2. Open pull-request inventory

Fresh inventory found **6 open PRs**.

### #852 — `Handoff: urgent P10 takeover checkpoint 2026-09-17 16:24 MSK`
Classification: **SUPERSEDED / CLOSE CANDIDATE**

Evidence:
- body explicitly says it is a handoff surface, not a production change;
- P10 subsequently advanced through merged #853 and #855;
- CURRENT now points to a newer automatic continuity checkpoint on 2026-09-18.

P12 action after refresh: close as superseded continuity surface; never merge.

### #730 — `Memory: fresh regression/BTC/UI/Pendle handoff checkpoint`
Classification: **SUPERSEDED / CLOSE CANDIDATE**

Evidence:
- historical Sep 10 continuity/handoff surface;
- current canonical continuity is materially newer.

P12 action after refresh: close as superseded handoff; never merge as production work.

### #729 — `Memory: detailed BTC/Pendle pre-private chat handoff`
Classification: **SUPERSEDED / CLOSE CANDIDATE**

Evidence:
- explicitly superseded by #730 in the later handoff chain;
- current continuity is newer again.

P12 action after refresh: close as superseded handoff.

### #717 — `Fix Market Data validated snapshot publish retry`
Classification: **SUPERSEDED BY MAIN / STRONG CLOSE CANDIDATE**

Original intent:
- preserve a validated Market Data snapshot across unrelated `main` churn;
- compare only relevant Market Data inputs against `validated_base`;
- refuse publish if a relevant input moved;
- do not rerun live RPC solely because unrelated `main` changed.

Fresh `main` evidence:
- `.github/workflows/market-data-refresh.yml` already contains `validated_base`, `market_input_paths`, relevant-input diffing, explicit supersession on changed inputs, unrelated-main-churn preservation and bounded rebase/push retry semantics;
- recent production history contains repeated `market data: refresh canonical price snapshot` materializations, including fresh 2026-09-18 activity.

Conclusion: the useful fix is already in canonical main; keeping the stale PR open adds ambiguity but no capability.

P12 action after final refresh: close as superseded; do not merge stale head.

### #433 — `Checkpoint · Market Data / TVL scheduler handoff`
Classification: **SUPERSEDED / CLOSE CANDIDATE**

Evidence:
- body identifies it as a durable handoff/checkpoint and explicitly does not claim a production fix;
- newer continuity and Market Data architecture now exist.

P12 action after refresh: close as historical checkpoint.

### #37 — `CANARY – final benign Production Boundary Guard proof`
Classification: **INTENTIONAL CANARY / CLOSE CANDIDATE PENDING DEPENDENCY CHECK**

Evidence:
- PR body explicitly says `This PR must never be merged.`
- it is an old benign canary surface, not production work.

Before closing: prove no current verifier, branch-protection expectation or human recovery procedure still depends on this PR remaining open. If no dependency exists, close; otherwise retain with explicit KEEP reason.

## 3. Runtime Reliability issue inventory

Fresh search found **18 open runtime-reliability issues**. Historical RED issue state is not current production truth by itself. The required closure contract remains:

`Incident → Root Cause (reviewed) → Durable Lesson → Preventive Invariant → Canary / production proof`

### Strong resolved-evidence candidates

#### #822 — repeated-failure · `update-company-010-hyperlend-income`
Classification: **RESOLVED_EVIDENCE / CLOSE CANDIDATE**

Evidence:
- P10 root cause was reviewed: diagnostic dependency install left transient `node_modules/` residue in checkout;
- #855 implemented bounded cleanup while preserving the strict final clean-repository assertion;
- #855 merged;
- post-merge natural push run `Update Company #010 · HyperLend Income` #138 completed successfully on merge commit `1dda44c7...`;
- accounting coverage subsequently remained 29 mechanisms / 0 reusable gaps.

Before issue closure: attach/reference #855 and the successful post-merge run; confirm no newer recurrence of the same fingerprint.

#### #369 — repeated-failure · `update-company-rewards`
Classification: **RESOLVED_EVIDENCE / CLOSE CANDIDATE**

Evidence:
- P10 root cause was reviewed: stale token-strip parity required AERO even when no actual AERO economic row existed;
- #853 aligned token requirements with materialized economic rows without fabricating zero income;
- #853 merged and the full Rewards path physically materialized fresh `companies/rewards-data.json`;
- downstream HyperLend projection and Accounting Coverage reached reusable gap 0.

Before issue closure: confirm no newer recurrence of the same fingerprint and link #853 + physical Rewards evidence.

### Healthy-later-production but lesson still needs review

These incidents have fresh evidence that the subject or downstream chain later materialized successfully, but their issue bodies still say `Root cause: UNKNOWN_UNTIL_REVIEWED`. Therefore a later success alone is insufficient for automatic closure.

- **#815** `update-aerodrome-managed-pulse` — recent physical commit `0fc68c046116e422d5ede66bbb4a8ae40ba3961b` (`intelligence: refresh aerodrome managed pulse`) on 2026-09-18. Classification: **NEEDS REVIEW, likely stale operational RED**.
- **#799** `update-reporting` running-too-long — fresh reporting/ledger materializations `370487f393feee158ff4761bef9f638d459e73a8` and later monthly-report cascade. Classification: **NEEDS REVIEW**.
- **#727** `update-reporting` repeated-failure — same fresh production evidence; classification: **NEEDS REVIEW**.
- **#565** `update-company-monthly-reports` — fresh physical commit `6f47971cc8bafbfaf44e88d1364da3e4d1e2cd7f` on 2026-09-18. Classification: **NEEDS REVIEW**.
- **#370** `update-economic-graph` repeated-failure — recent physical commit `d81f0a3f0475e2006964f02ebe7aae7c5a8935b6` (`intelligence: refresh economic graph`). Classification: **NEEDS REVIEW**.
- **#383** critical handoff `update-economic-graph → update-explanatory-context` — economic graph was followed by fresh explanatory-context materialization (`ca72347e...` / `9d3ff22b...`). Classification: **NEEDS REVIEW, chain appears recovered**.
- **#716** `market-data-refresh` — current main already contains the validated-snapshot retry design and recent canonical Market Data materializations are present. Classification: **NEEDS REVIEW, likely resolved architecture**.

### Requires exact current-run investigation before classification

Do not close these in bulk. They need exact workflow/handoff evidence and, where appropriate, a durable lesson/canary mapping:

- **#564** critical handoff miss `update-explanatory-context → refresh-cognitive-stack`
- **#379** repeated-failure `refresh-cognitive-stack`
- **#778** repeated-failure `resume-economic-graph-after-code-change`
- **#792** repeated-failure `verify-ve33-accounting`
- **#447** repeated-failure `unified-capital-refresh`
- **#456** critical handoff miss `unified-capital-refresh → update-economic-graph`
- **#726** repeated-failure `update-comparative-intelligence`
- **#659** repeated-failure `update-learning-loop`
- **#432** repeated-failure `production-deployment-smoke`

Classification: **KEEP / NEEDS REVIEW** until fresh exact evidence proves otherwise.

## 4. Workflow fan-out preparation

Canonical existing machinery already exists and must be reused:
- `intelligence/reliability/workflow-fanout-policy.json`
- `intelligence/reliability/workflow-fanout-baseline.json`
- `intelligence/reliability/workflow-fanout-audit.mjs`
- Workflow Control Plane and its enforcement/canaries
- PR Run Supersession Controller

Do **not** create another orchestration or fan-out subsystem.

Current frozen baseline is a safety ceiling, not current fleet truth and not an optimization target. It records historical measurements including:
- workflow fleet wakes: 76;
- protected global wakes: 4;
- reduction candidates: 72;
- unbounded PR workflows: 3;
- protected IDs: commit identity privacy, public surface privacy, repository hygiene, workflow control plane.

A newer live Control Plane observation during P10 showed a larger total workflow fleet than the old frozen baseline. Therefore P12 must run the existing audit freshly before selecting a reduction batch; never infer current workflow count from the historical baseline.

Reduction law:
- never remove a domain check merely to lower run count;
- preserve real source-change wakeups;
- do not grant privileged writers/controllers new PR authority;
- do not touch `pull_request_target` security-sensitive workflows casually;
- preserve protected global workflow-change checks;
- prefer removing only proven redundant/self-definition/global wakes;
- every batch needs exact-head Control Plane + domain verification + post-merge production proof.

## 5. Proposed P12 batches after P10

### Batch A — metadata hygiene
Low semantic risk:
- close superseded handoff/checkpoint PRs after one final live refresh;
- close #717 as superseded if main still contains the proven Market Data logic;
- decide #37 only after dependency check;
- do not delete associated branches in the same batch.

### Batch B — reliability issue reconciliation
- close only issues with reviewed root cause + durable fix/proof and no recurrence;
- start with #822 and #369;
- convert healthy-but-unreviewed issues into an explicit review queue instead of silently closing them;
- preserve incident history; issue closure is metadata cleanup, not deletion of lessons.

### Batch C — bounded Actions fan-out reduction
- run fresh existing fan-out audit on exact `main`;
- rank candidates by pure redundant wake cost and safety isolation;
- take the smallest high-confidence batch;
- no domain verifier removal, no security relaxation, no methodology/authority changes;
- exact-head proof and post-merge production acceptance required.

### Batch D — branch hygiene (separate confirmation boundary)
Branch deletion is destructive repository cleanup. Inventory can be prepared during P12, but deletion should remain separate and require explicit owner confirmation unless a later durable owner directive specifically authorizes it.

## 6. Current decision

**Do not wait idle for Stable Capital, but do not contaminate P10 either.**

This branch is intentionally a preparation surface. It converts the waiting window into verified P12 readiness while leaving canonical `main`, Stable Capital acceptance and production workflow topology unchanged.