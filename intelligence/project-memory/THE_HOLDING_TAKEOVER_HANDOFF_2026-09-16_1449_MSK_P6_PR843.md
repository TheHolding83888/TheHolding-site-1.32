# THE HOLDING — EMERGENCY TAKEOVER HANDOFF

**Created:** 2026-09-16 14:49 MSK / 2026-09-16 11:49 UTC  
**Purpose:** urgent continuity handoff because the active ChatGPT context is near exhaustion.  
**Repository:** `TheHolding83888/TheHolding-site-1.32`  
**Active workstream at handoff:** P6 — supported-mechanism / new-reward-token reuse proof.  
**Execution authority:** `none` for wallet/capital/methodology mutation. Routine Git/CI work remains bounded by repository/project governance.  

---

## 0. TAKEOVER IN ONE SENTENCE

**P5 is CLOSED and materialized; do not reopen it. The active task is PR #843, a proof-first P6 verification candidate. Confirm its live end-to-end non-base reward-token proof on exact head, refresh against current `main` if necessary, then merge only if the proof is genuinely live/reusable and no token-specific accounting logic was introduced.**

---

## 1. CANONICAL RESUME ORDER

Do not resume from chat memory alone. Recover in this order:

1. `intelligence/project-memory/CURRENT.md`
2. this handoff file
3. latest continuity file referenced by `CURRENT.md`
4. `THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`
5. `THE_HOLDING_PUBLIC_GREEN_TO_PRIVATE_ROADMAP_2026-09-13.md`
6. fresh live `main`
7. PR #843 exact head + exact-head checks/logs
8. current generated accounting/reporting artifacts if any P5/P6 claim depends on them

Core truth rule remains:

`CURRENT -> latest continuity -> Router -> task-specific canon -> live artifact -> exact evidence`

Never treat a historical PR body, chat statement, stale generated file, or GREEN CI alone as production truth.

---

## 2. FRESH LIVE STATE AT HANDOFF

### Current `main`

At 2026-09-16 11:49 UTC the fresh `main` head is:

`163933705123f02e84b99dde66a4d334add06d6e`

Commit message:

`intelligence: refresh vlcvx votium curve pool context`

Commit time:

`2026-09-16T11:47:33Z` / `14:47:33 MSK`

This is a generated intelligence/context refresh, not a P6 accounting change.

### Active P6 PR

PR **#843**  
Title: `P6: prove supported mechanism new reward-token reuse end to end`  
Branch: `verify/p6-supported-mechanism-new-reward-reuse-20260916`  
Head at handoff: `daf2b65acb7298521e3c18e7d48c2d02bcce8091`  
State at handoff: **OPEN**  
GitHub mergeability at handoff: **mergeable = true**  
PR creation: `2026-09-16T11:38:52Z`  
Files: 2  
Commits: 2 before this handoff commit.

PR #843 base snapshot was:

`353c5ae98f25686c8459bdb8143cd3d9f0387da0`

Current `main` has advanced since that base.

A fresh compare at handoff showed the branch/main are diverged only by:

- PR branch: 2 unique commits relative to merge base;
- current main: 1 unique commit relative to merge base;
- the current-main-only changed file reported by compare is:
  `intelligence/economic-graph/vlcvx-votium-curve-pool-context.json`

Therefore there is **no currently proven overlapping P6 code change from the latest main refresh**, but the takeover chat must still re-fetch `main` and compare before merge because generated state may continue moving.

---

## 3. P5 IS CLOSED — DO NOT REOPEN IT

### Final P5 closure

PR **#842**  
Title: `Accounting: close P5 with fail-closed valuation pending semantics`  
Merged: **YES**  
Merged at: `2026-09-16T11:25:41Z`  
Merge commit: `408a714a8af3ce824a6f92269c3a21d59f4b3dfe`

What #842 did:

- admitted already-proven generic discovered Aerodrome / Velodrome historical valuation families into the Canonical Earned Income View;
- preserved `canonical-event-usd-valuation-incomplete` as explicit fail-closed `UNKNOWN` when historical USD proof is unavailable;
- classified unresolved price evidence as parked historical-valuation-evidence-pending rather than a fake engineering defect;
- validated that `UNKNOWN` cannot silently become zero or income;
- did **not** add current-price backfill;
- did **not** assume stablecoins are always $1;
- did **not** infer earned income from APR/APY;
- did **not** mutate economic events;
- did **not** change wallet/capital/methodology/execution authority.

The P5 closure evidence recorded after production materialization was:

- `engineeringActionableCount = 0`
- `valuationEvidencePendingCount = 1`
- `reusableCoverageGapCount = 0`
- unresolved events remain explicit `UNKNOWN`
- `executionAuthority = none`

Earlier production Reporting after #840 had already materially improved historical valuation resolution from **44 -> 49**, while unresolved values remained fail-closed rather than fabricated.

### PR #841

PR **#841** is CLOSED, not merged, and explicitly superseded by merged #842.

Its final body records that #842 preserved the canonical consumer admission, passed Final Audit, and physically materialized the P5 closure state above.

### Important stop-rule

**Do not continue “improving” P5.**

Do not reopen old P5 PRs merely because some historical rewards remain unvalued. P5 canon explicitly allows:

`prove historical USD when possible -> UNKNOWN otherwise`

The remaining UNKNOWN state is legitimate unless a new live reusable gap is actually demonstrated.

The previous investigation already rejected several unnecessary ideas:

- AERO detour/fallback did not reduce real blockers;
- WETH fallback did not reduce real blockers;
- no new factory/tickSpacing route was needed;
- the major real issue discovered was historical RPC reliability, which was handled before final P5 closure;
- do not rebuild token-specific pricing/accounting paths.

Treat older P5 experimental/superseded branches and PRs as history unless fresh production evidence proves a regression.

---

## 4. WHAT P6 IS ACTUALLY TRYING TO PROVE

Roadmap P6 is **not** “add support for one more named token.”

It is:

> prove that a mechanism the system already supports can ingest a newly encountered / non-base reward token end-to-end **without creating a token-specific accounting engine**.

The current PR #843 is intentionally **verification-first**, not a new production accounting layer.

### PR #843 proof contract

The validation should dynamically find live non-base Aerodrome/Velodrome reward tokens through the already-supported ve33 mechanism and prove the whole chain:

1. dynamically enumerate reward tokens from supported reward contracts (`FeesVotingReward.earned` / `IncentiveVotingReward.earned` path);
2. identify at least one live reward token that is not merely the base/common reward token case;
3. match it to a canonical historical Income Ledger event by reusable identity:
   - mechanism
   - token
   - veNFT tokenId
   - rewardContract
4. prove exact `amountRaw` preservation;
5. prove a unique canonical `eventKey` exists / is recognized;
6. keep current `Unclaimed` state separate from period-income recognition authority;
7. if historical USD proof exists, consume only factual historical evidence;
8. if historical USD cannot be proved, remain explicit fail-closed `UNKNOWN` / `unvalued-fail-closed`;
9. require `reusableCoverageGapCount = 0`;
10. require `executionAuthority = none`.

No token name such as TAROT / OP / msUSD / etc. may become a hardcoded accounting special case. A token may appear as live evidence, but not as the architecture.

---

## 5. CURRENT #843 CI STATE AT HANDOFF

Exact branch head checked:

`daf2b65acb7298521e3c18e7d48c2d02bcce8091`

The GitHub check-runs snapshot returned **9 checks** at handoff.

Important observations:

- no `failure` conclusion was found in the exact-head check-runs snapshot;
- no `in_progress` status was found;
- no `cancelled` or `skipped` conclusion was found in the queried snapshot;
- visible checks included successful:
  - Production Deployment Smoke
  - audit
  - security/reliability guards
  - Cloudflare worker build

However, **do not merge based only on “all checks look green.”**

The takeover chat must inspect the actual P6 reuse-parity proof output/log and confirm it proves at least one **live qualifying non-base reward token** end-to-end. A synthetic-only pass does not satisfy P6.

This is the most important next verification.

---

## 6. IMMEDIATE NEXT ACTIONS FOR TAKEOVER CHAT

Execute these in order:

### A. Re-warm from live state

1. fetch fresh `main` again;
2. fetch `CURRENT.md` because main/generated memory may have moved after this handoff;
3. fetch PR #843 metadata and exact head;
4. compare current main to PR #843 head/base;
5. fetch exact-head workflow/check runs.

### B. Inspect the actual P6 proof

Find the dedicated P6 validation workflow/check added by #843 and inspect its job/log/output.

Acceptance is **not** merely exit code 0.

You need positive factual evidence similar to:

- a dynamically discovered live non-base reward token exists;
- its mechanism/rewardContract/veNFT identity matches a canonical ledger event;
- exact `amountRaw` matches;
- canonical event key is unique/recognized;
- current unclaimed representation is not treated as fresh period income;
- valuation is factual historical USD when proven, otherwise explicit UNKNOWN;
- `reusableCoverageGapCount = 0`;
- no token-specific branch in production accounting;
- `executionAuthority = none`.

If the workflow does not expose enough evidence to prove these conditions, improve only the **verification evidence** first. Do not add production accounting logic unless the live proof demonstrates a real reusable gap.

### C. Fresh-main decision

Because main moved after the PR base, determine whether a fresh replay/rebase is needed.

At this handoff, the only current-main-only compare file was the generated vlCVX/Votium/Curve economic-graph context, so there was no demonstrated overlap with P6 verification code. If that remains true and exact-head CI/proof is trustworthy, do not create another PR merely for ceremony.

If main has materially changed relevant P6/accounting/reward files, replay the verification candidate on fresh main and rerun exact-head proof.

### D. Merge rule

Merge #843 only if:

- the proof is live, not synthetic-only;
- at least one qualifying non-base/new reward token is proven end-to-end;
- no token-specific accounting engine was introduced;
- all identity/amount/eventKey semantics remain canonical;
- valuation stays evidence-based / UNKNOWN otherwise;
- reusable coverage gap is zero for the demonstrated case;
- exact-head checks are GREEN;
- current main comparison shows no relevant hidden conflict;
- authority remains unchanged (`executionAuthority = none`).

If those conditions are met, **merge and stop P6**. Do not search for extra P6 “improvements.” Move to P7.

If they are not met, fix only the smallest reusable gap exposed by the live proof.

---

## 7. WHAT NOT TO DO

1. **Do not reopen P5** just because unresolved historical valuation remains UNKNOWN.
2. Do not convert UNKNOWN to zero.
3. Do not use current token price to backfill historical earned income.
4. Do not silently assume a stablecoin is $1.
5. Do not infer factual earned income from reference APR/APY.
6. Do not count claim/reset/withdrawal as new income if economic income was already recognized.
7. Do not hardcode a named reward token into an accounting path merely to make P6 pass.
8. Do not treat GREEN CI as sufficient if no live proof is visible.
9. Do not call a PR “production complete” before merge/materialization when materialization is part of its acceptance.
10. Do not create new architecture/layers without a demonstrated reusable gap.
11. Do not change wallet/capital/methodology/execution authority.
12. Do not perform transactions or signing. `executionAuthority = none`.

---

## 8. ACCOUNTING INVARIANTS THAT MUST SURVIVE TAKEOVER

- Canonical Income Ledger is the sole factual earned-income recognition authority.
- Reference APR/APY is not realised/earned period income.
- Opening balance is not current-period income.
- `UNKNOWN != 0`.
- Settlement is not second recognition of the same income.
- Historical pricing must be exact/block-grounded where required.
- No current-price historical backfill.
- No silent stablecoin peg assumption.
- No token-specific special accounting engine when generic mechanism identity is sufficient.
- Unclaimed/current claimable state and recognised period income are distinct concepts.
- Green workflow != physically materialized production artifact.

---

## 9. PROJECT GOVERNANCE / WORKING STYLE

Keep the current discipline:

- one primary objective at a time;
- no new layer without a real gap;
- close/prove current capability before expanding;
- reuse and simplify before adding architecture;
- avoid duplicate truth/orchestration loops;
- capability should grow faster than complexity;
- authority should grow slower than intelligence.

User preference for status reports:

- 🟢 done
- 🟡 in progress + rough % if useful
- ⚪ next

Keep user-facing explanations short, plain, business-level unless detail is requested.

When user says `трекай`, perform a fresh read-only live check of:

- current `main`
- active/relevant branches and PRs
- workflows / Actions / exact-head runs
- fresh generated artifacts/evidence
- latest continuity/checkpoints
- Router-resume context

---

## 10. ROADMAP AFTER P6

Do not skip ahead, but preserve ordering:

- **P6** supported-mechanism / new-reward-token reuse proof — ACTIVE NOW
- **P7** heavy workflow profiling
- **P8** reliability/performance simplification only if P7 proves a bottleneck
- **P9** bounded Economic Graph / sensor closure
- **P10** system-wide production acceptance
- **P11** cosmetics only after P1-P10 are green
- **P12** pre-private cleanup/freeze
- **P13** real pre-private checks
- **P14** final public-state checkpoint / migration readiness
- **P15** verified backup/export
- **P16** public -> private visibility change only with explicit owner confirmation
- **P17** post-private audit

Private-only sequence comes later and must not be pulled forward casually.

---

## 11. FINAL TAKEOVER DECISION TREE

### If #843 live proof is genuinely positive

`confirm exact evidence -> fresh-main compatibility -> merge #843 -> verify merge/main -> P6 GREEN -> move to P7`

### If #843 is green but proof is synthetic/weak

`do not merge as P6 closure -> improve evidence only -> rerun`

### If #843 exposes a real generic gap

`fix smallest reusable mechanism-level gap -> no named-token special case -> rerun exact live proof`

### If historical USD is unavailable for the chosen live token

That is acceptable **if** the event is correctly preserved and explicitly fail-closed UNKNOWN. P6 is about reusable ingestion/accounting semantics, not fabricating a price.

---

## 12. LAST KNOWN AUTHORITATIVE SNAPSHOT

At handoff creation:

- `main`: `163933705123f02e84b99dde66a4d334add06d6e`
- P5 final merge: PR #842 / `408a714a8af3ce824a6f92269c3a21d59f4b3dfe`
- PR #841: closed/superseded, not merged
- P6 active PR: #843
- P6 branch: `verify/p6-supported-mechanism-new-reward-reuse-20260916`
- P6 head before this handoff commit: `daf2b65acb7298521e3c18e7d48c2d02bcce8091`
- exact-head checks snapshot: no failure/in-progress observed
- current-main-only compare delta vs PR merge base: generated `intelligence/economic-graph/vlcvx-votium-curve-pool-context.json`
- `executionAuthority = none`

**Important:** this handoff commit itself advances the PR branch head. The takeover chat MUST fetch the new branch/PR head and use that exact SHA for all subsequent checks. Do not keep using `daf2b65...` as current after this file is committed.

---

## 13. SUCCESS CRITERION FOR THE NEXT CHAT

A correct takeover does **not** repeat the P5 investigation. It starts at P6, reads this handoff, refreshes live state, verifies PR #843's real proof, and either:

1. safely closes P6 and moves to P7, or
2. identifies one concrete reusable P6 gap and fixes only that.

Everything else is secondary.
