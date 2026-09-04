# THE HOLDING — WORKING CHECKPOINT · CONVEX ACCOUNTING FRONTIER

Status: **branch-only intermediate checkpoint**  
Purpose: preserve the live discovery state before deeper Convex/vlCVX accounting work.  
Authority: observation / engineering continuity only.  
executionAuthority: **none**.

## Branch boundary

- Working branch: `work/convex-accounting-frontier-2026-09-04`
- Branched from live `main`: `7ff39713225aacf722674fc86ed2f1bba2d1c303`
- This file is intentionally **not** a replacement for the automatic `CURRENT → CONTINUITY → immutable master checkpoint` chain.

## Production boundary already closed before this branch

- Rewards run #98 (`33834548191`) completed **SUCCESS** on merge head `591eb57af05f663ff82d3b753fdbb527c5779649`.
- PR #603 merged and the canonical Reporting writer physically materialized `reporting/accounting-coverage.json` on `main`.
- Live Accounting Coverage v0.3 proves:
  - `aerodrome_veaero`: factual tracking **8/8**, reusableCoverageGap=false;
  - `velodrome_vevelo`: factual tracking **4/4**, reusableCoverageGap=false.
- PR #604 merged and automatic continuity is production-materialized:
  - `intelligence/project-memory/CONTINUITY.md` points to `THE_HOLDING_MASTER_CONTINUITY_2026-09-04_050859_AUTO_3a69adc0.md`;
  - `CURRENT.md` resolves the same automatic checkpoint.

## Convex frontier discovered

Accounting Coverage currently ranks `convex_vlcvx` as a reusable factual-tracking gap:

- active companies: **4**;
- factual tracking: **2/4**;
- already factual: `YieldRing.eth`, `defitea.eth`;
- state-only gaps: `Cypher`, `Rook's portfolio`;
- known productive value: about **$4,888.51** at the current coverage snapshot;
- `convex_staked_cvxcrv`: **0/1** factual tracking, Cypher state-only, also a separate reusable gap.

Do **not** collapse `vlCVX`, Votium/Union settlement, and staked `cvxCRV` into one additive income lane. Existing accounting law remains: settlement/reconciliation evidence may overlap economic entitlement; no double counting; Reference APR/APY is never factual period income authority.

## Existing reusable Convex/vlCVX infrastructure located

The repository already contains a substantial live/shadow vlCVX/Votium intelligence stack. Relevant existing mechanisms include:

- `intelligence/economic-graph/vlcvx-votium-candidate.mjs`
- `intelligence/economic-graph/vlcvx-votium-snapshot-proof.mjs`
- `intelligence/economic-graph/vlcvx-votium-snapshot-proof.json`
- `intelligence/economic-graph/vlcvx-votium-round-flow.mjs`
- `intelligence/economic-graph/vlcvx-votium-round-flow.json`
- `intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.mjs`
- `intelligence/economic-graph/vlcvx-votium-curve-gauge-flow.json`
- `intelligence/economic-graph/vlcvx-votium-deep-evidence.mjs`
- `intelligence/economic-graph/vlcvx-votium-curve-pool-context.mjs`
- `intelligence/economic-graph/vlcvx-votium-curve-pool-context.json`

The recurring `vlcvx votium curve pool context` writer is already active on `main`; this is evidence that the protocol was not starting from zero.

## Exact next engineering question

Before writing a new Convex accounting engine, audit the existing Rewards / Votium / Union / vlCVX route data and the two already-factual companies to identify the strongest production precedent and the exact missing capability contract for Cypher + Rook.

Target architecture:

`existing Convex/vlCVX state + settlement evidence → reusable factual accounting evidence → Canonical Income Ledger → monthly reports → Accounting Coverage`

The first implementation must be generic by mechanism, not company-specific. It must preserve:

- `UNKNOWN != 0`;
- opening/baseline balance != current-period income;
- claim/withdraw/settlement may be settlement, not a second earning event;
- no cross-family sum unless non-overlap is proven;
- Canonical Income Ledger remains sole earned-income authority;
- no new writer/scheduler if an existing canonical writer can host the capability;
- `GREEN workflow != physically materialized production artifact`.

## Resume instruction

Continue from this checkpoint by inspecting the exact existing Convex/vlCVX Rewards and Reporting precedents, then isolate the smallest reusable factual-tracking delta for the two state-only companies. Do not restart broad protocol research unless live evidence reveals a genuine missing semantic dependency.
