# THE HOLDING — MASTER CONTINUITY
## 2026-08-17 18:30 (+03) · COMPANY #010 CYPHER · PR #120 / #121 PRODUCTION CLOSE

> **Canonical priority:** fresh GitHub `main` → fresh generated production JSON / exact workflow evidence → current machine-readable subsystem state → this continuity checkpoint → older memory.
>
> This checkpoint is intentionally conservative. It records what is already production-proven and separately records what still requires physical/public verification. Do not promote candidate evidence into production fact, and do not interpret incomplete Rewards or Performance as zero.

---

# 1. PRIMARY MISSION

Global Brain / Orchestrator expansion remains paused until Company #010 Cypher is fully closed on the public production surface.

Current objective:

**Finish Company #010 end-to-end, verify all generated artifacts physically in `main`, verify the public Passport / Graph / Index behavior, let the owner visually accept the result, then return to global Brain/Orchestrator work.**

Company #010 capital is now complete under the owner-defined economic boundary. Fluid is explicitly outside that boundary and is not a blocker.

Remaining close sequence from this checkpoint:
1. physically inspect latest `companies/productivity-data.json` and `companies/productivity-source-report.json` after successful Productivity v1.16 run;
2. let fresh Rewards run #37 settle and physically inspect `companies/rewards-data.json`;
3. re-fetch latest Company #010 state, reconciliation and Capital State from `main`;
4. audit General Index semantics so missing Performance is never silently treated as `0%`;
5. verify deployed public `/companies/` Company #010 card + native Passport + Graph + Index presentation;
6. owner performs visual acceptance;
7. only then declare Company #010 fully closed;
8. then resume the global Brain / Orchestrator roadmap.

Do **not** call #010 fully closed before the physical file checks and public page acceptance are complete.

---

# 2. MERGE GOVERNANCE — STILL ACTIVE

General instructions such as `делай`, `продолжай`, `finish it` authorize implementation, branches and PR creation, but **do not authorize production PR merge**.

Every production PR requires a fresh explicit owner authorization.

Consumed explicit authorizations relevant to this close:
- PR #119 — explicitly authorized earlier with `мерджи 119` and merged;
- PR #120 — explicitly authorized with `мерджи 120` and merged;
- PR #121 — owner said `чекай и если ок то мерджи 121`; exact-head CI was GREEN, PR was mergeable, and it was merged under that authorization.

**No future PR is authorized to merge.** Any #122+ requires a new explicit owner authorization.

Direct Project Memory update in this checkpoint is performed because the owner explicitly requested that the current progress be saved before moving to a new chat.

---

# 3. COMPANY #010 ECONOMIC / EPISTEMIC CANON

Company:
- Registry: `010`
- Name: `Cypher`
- Architecture: `The Holding Standard`

Core invariants:
- `unknown != zero`
- `partial != total`
- `out-of-scope != zero`
- capital completeness != Performance completeness
- Reference APR != realised cash flow
- claimable rewards != realised cash flow
- claimable rewards != TVL
- wrapper / LP / vault decomposition must not double-count economic capital
- `executionAuthority = none`

Owner entry-price canon — do not ask again:
- ETH `2476`
- BTC `73482`
- HYPE `38.62`
- CVX `1.84`
- CRV `0.2280`
- AERO `0.60`
- LDO `0.8408`
- VELO `0.04762`

Performance remains legitimately incomplete because complete acquisition / contribution basis for all composite/wrapper strategies has not been proven. Therefore:
- Company capital can be complete;
- `performance.complete = false`;
- Performance status remains `partial-cost-basis`;
- public Passport must show Performance as Pending / incomplete rather than `0%`;
- General Index may use complete capital / TVL weighting, but must not fabricate a zero Performance factor.

---

# 4. FLUID — FINAL OWNER POLICY

The owner explicitly clarified that Fluid and anything held through Fluid must not be counted as part of Company #010.

Canonical interpretation:
- Fluid protocol is outside Company #010 scope;
- Fluid positions are outside Company #010 capital scope;
- no Fluid balance-sheet row;
- no Fluid protocol membership in Company #010 Passport;
- no Fluid node in Company #010 Graph;
- Fluid does not create a gap;
- Fluid does not block `totalCapitalComplete`;
- this is an owner-defined economic boundary, not unresolved technical ignorance.

Reusable lesson:

**discoverable wallet universe != company accounting boundary**.

A technically discoverable asset/protocol may still be intentionally excluded from the company scope by owner methodology.

---

# 5. STAKE DAO BASE 4POOL — REUSABLE MECHANISM NOW LEARNED

Company #010 Wallet 2:
`0x64688f4adc3f72cdb44d07e4879c724cd7025696`

Strategy:
`Stake DAO / Curve 4pool · Base · USDC / USDbC / axlUSDC / crvUSD`

Exact Curve Base pool:
`0xf6C5F01C7F3148891ad0e19DF78743D31E390D1f`

Stake DAO RewardVault:
`0x6f6533b7e0730d150e617001e331ff2faa41fde4`

Verified Accountant:
`0x8f872cE018898ae7f218E5a3cE6Fe267206697F8`

Verified gauge:
`0x79edc58C471Acf2244B8f93d6f425fD06A439407`

Production accounting rule:
- count the Stake DAO vault strategy exactly once as economic principal;
- USDC / USDbC / axlUSDC / crvUSD are underlying decomposition only;
- never add the decomposed stables again to Company TVL;
- claimable CRV is Rewards only, not capital;
- screenshots supplied by owner are control/reference evidence only, not production source.

Yield rule:
- bounded current Reference APY is Curve Base trading/base APY;
- boosted Stake DAO CRV reward APR remains separate/warming until exact annualisation is independently proven;
- current verified bounded APY in recent production runs: `0.04%`;
- unknown reward APR must never become `0%` merely because annualisation is unresolved.

Reward accounting rule:
- use verified Stake DAO Accountant integral state;
- effective structure: stored pending + positive vault/account integral delta × user balance / scaling factor;
- current measured claimable in recent runs: `6.12858432174 CRV`.

This discovery is reusable onboarding knowledge for future companies using the same Stake DAO mechanism.

---

# 6. WSTETH / ETH WRAPPER PRESENTATION RULE

Company #010 includes Aave Arbitrum wstETH exposure.

Canonical UI/accounting behavior:
- company-level economic aggregation may express ETH-equivalent exposure;
- Passport must also disclose that the exposure is held through `wstETH` and show the actual wrapper quantity;
- do not visually pretend wstETH is plain native ETH;
- wrapper quantity and ETH-equivalent are two descriptions of one economic exposure, not two additive capital rows.

Recent verified readings were approximately:
- Aave wstETH: `~0.98145627 wstETH`
- Aave ETH-equivalent: `~1.21885527 ETH`
- aggregate Company ETH-equivalent: `~1.22341125 ETH`

This wrapper-aware display pattern is reusable for future companies.

---

# 7. PR #119 — COMPANY #010 FUNCTIONAL CLOSE BASE

PR:
`#119 · Company #010 · complete capital, Stake DAO and global intelligence v0.7`

Exact reviewed head:
`3a72edb115776c30279faa9611ba3235c476200f`

Merge SHA:
`78be41c8a253267890989d25bba71b0025f0a309`

PR #119 delivered the functional integration substrate:
- canonical Company #010 production state v0.3;
- Stake DAO Base 4pool capital/yield/reward discovery;
- Fluid owner-policy exclusion;
- wstETH wrapper-aware public presentation;
- explicit GMX labels `GMX · ETH-USDC` and `GMX · BTC-USDC`;
- common/native Company Passport integration;
- Graph / protocol membership adjustments;
- complete-capital Capital State logic for 10/10 companies;
- global Productivity v1.16 admission code;
- global Rewards v0.3.10 admission code;
- stronger null/missing guards;
- Performance kept separately incomplete.

Exact-head Production Integration before merge had already proven the live logic, but owner policy requires post-merge physical proof as well.

---

# 8. INITIAL POST-#119 PRODUCTIVITY FAILURE — ROOT CAUSE LEARNED

First post-merge Productivity rollout started from the same PR #119 merge push **in parallel** with the Company #010 state writer.

The Productivity overlay correctly required complete canonical Cypher state, but `main` still contained the previous incomplete Company state because the asynchronous Company writer had not published yet.

Observed failure:
`Error: complete Cypher production state required`

This was not a collector/economic failure. It was a workflow DAG race.

Reusable lesson:

**writer dependency must be encoded as an explicit workflow DAG; a shared merge/push event is not evidence that the upstream writer has completed.**

---

# 9. PR #120 — PRODUCTIVITY DAG RACE FIX — MERGED / PRODUCTION-PROVEN

PR #120 purpose:
make global Productivity wait for successful Company #010 state publication rather than race it.

Merge SHA:
`ff0db55ae7857b28b95a641e936dfeb58e003b81`

The fix added the correct `workflow_run` dependency:

`Update Company #010 · Cypher Production State SUCCESS`
→ `Update The Holding Productivity Data`

Normal weekly Productivity cadence remains.

Pre-merge exact-head CI was GREEN.

Most importantly, the DAG is now **production-proven**, not merely designed:

Fresh upstream Company #010 production run after PR #121:
- run ID `32042231485`
- run number `5`
- event `push`
- initial head SHA `eb5d8e2b9fb7c2ad4948a9edbdf082ccc6763fce`
- result: **SUCCESS**

Generated Company state bot commit:
`dfed3db1206642ea1e74f8f99b50eb126692bb60`

Commit message:
`companies: refresh complete Cypher state`

Timestamp:
`2026-08-17T15:27:34Z`

This successful Company run then triggered Productivity through the new DAG:
- workflow: `Update The Holding Productivity Data`
- run ID `32042395515`
- run number `26`
- event `workflow_run`
- triggering head SHA `dfed3db1206642ea1e74f8f99b50eb126692bb60`
- result: **SUCCESS**
- completed: `2026-08-17T15:30:38Z`

Productivity writer bot commit observed immediately after:
`bb0c38c8ddf8ed7b3588e627677fbe3360ab70c1`

Commit message:
`data: update weekly productivity snapshot`

Author:
`The Holding Data Engine`

Therefore the PR #120 orchestration fix is now proven in the actual production chain.

Physical file-content verification is still required before final close:
- `companies/productivity-data.json` expected version `1.16`;
- Cypher must be present;
- `companies/productivity-source-report.json` must carry Cypher diagnostics;
- unknown Project X / Concentrator APRs must remain unknown/warming, not zero.

Expected Cypher v1.16 semantics from exact-head verification:
- Reference APR approximately `20.5155%` over APR-covered productive capital;
- productive capital approximately `$2,286.75` at that verification snapshot;
- APR-covered productive capital approximately `$1,831.10`;
- coverage approximately `80.07%`;
- unresolved/warming productivity engines:
  - `projectx_hype`
  - `concentrator_sdcrv`

Interpretation:
this is a covered-capital Reference APR, **not** whole-company realised yield.

---

# 10. RECOVERY RERUN FAILURE AFTER PR #120 — SECOND ORCHESTRATION LESSON

To force an immediate post-#120 production proof, an older successful Company #010 workflow run was manually rerun.

Historical run:
`32040048608`

Attempt 2 fresh onchain rebuild itself was healthy and validated approximately:
- total capital `$5,295.58`;
- Stake DAO `$588.92`;
- claimable `6.12858432174 CRV`;
- Stake DAO bounded base APY `0.04%`;
- Fluid `out-of-scope`;
- `totalCapitalComplete = true`;
- Performance `partial-cost-basis`.

The failure happened only at publication.

Root cause:
GitHub Actions rerunning a historical event checked out the **original event SHA** (`78be41c...`, PR #119 merge) rather than fresh `main`. The generated Company JSON was therefore based in a stale checkout and rebasing it onto modern `main` produced content conflicts in:
- `companies/company-010-production-state.json`
- `companies/company-010-reconciliation.json`

This was not an economic / Stake DAO / collector failure.

Reusable lesson:

**manual/historical workflow recovery must explicitly bind checkout to fresh `main` when the workflow’s purpose is to regenerate current production state.**

---

# 11. PR #121 — COMPANY WRITER FRESH-MAIN RECOVERY FIX — MERGED / PRODUCTION-PROVEN

PR:
`#121 · Fix · Company #010 writer recovery checkout`

Exact head:
`c1366a98d433931806a098176924387103b00a81`

Change size:
- one workflow file;
- one functional line added: checkout `ref: main`;
- existing `fetch-depth: 0` retained;
- no collector, methodology, capital, UI, Rewards, Productivity, Performance or authority changes.

Exact-head CI before merge:
- Commit Identity / Security check #113: SUCCESS
- Company #010 Production Integration #43: SUCCESS
- PR mergeable: true

Owner authorization:
`чекай и если ок то мерджи 121`

Merge SHA:
`eb5d8e2b9fb7c2ad4948a9edbdf082ccc6763fce`

Post-merge proof:
- fresh Company #010 production run #5 `32042231485` started from the PR #121 merge on current `main`;
- run completed **SUCCESS**;
- all collection / validation / fingerprint / publish steps succeeded;
- physical generated bot commit `dfed3db1206642ea1e74f8f99b50eb126692bb60` reached `main`.

Therefore PR #121 is **production-proven**, not only merged.

---

# 12. CAPITAL STATE — FRESH POST-#121 PROOF

Fresh Company #010 bot commit:
`dfed3db1206642ea1e74f8f99b50eb126692bb60`

Triggered downstream Capital State workflow:
- workflow: `The Holding Intelligence · Capital State`
- run ID `32042395570`
- run number `14`
- event `workflow_run`
- triggering head SHA `dfed3db...`
- result: **SUCCESS**

This proves that the latest complete Company #010 state is again accepted by the network-level Capital State after the recovery hardening.

Prior physical Capital State already established:
- registry company count `10`;
- measured company count `10`;
- complete-capital company count `10`;
- total capital coverage `1`;
- exact Network TVL restored.

The exact latest numeric Network TVL must be re-read from the fresh physical `intelligence/capital-state/capital-state.json` before final owner acceptance because market prices moved during repeated live refreshes.

---

# 13. GLOBAL REWARDS v0.3.10 — FRESH RUN STILL IN PROGRESS AT THIS CHECKPOINT

Fresh downstream Rewards run:
- workflow: `Update Company Rewards`
- run ID `32042395558`
- run number `37`
- event `workflow_run`
- triggering head SHA `dfed3db1206642ea1e74f8f99b50eb126692bb60`
- status at 2026-08-17 18:30 (+03): **in_progress**

Earlier v0.3.10 publication had already been demonstrated after PR #119, but final #010 close requires inspecting this fresh post-#121 run and the physical `companies/rewards-data.json`.

Expected Rewards semantics:
- global version `0.3.10`;
- Stake DAO CRV route measured;
- approximately `6.12858432174 CRV` claimable at the current Company-state observation;
- `totalUsdIsComplete = false` for Cypher;
- one currently complete measured route plus three known unresolved/warming routes:
  - `aerodrome-ve`
  - `velodrome-ve-direct`
  - `votium-union`

Important:
- unresolved reward route != zero reward;
- known route readiness != measured claimable amount;
- do not claim all Cypher Rewards are complete;
- accrued rewards do not increase Company TVL.

Future Rewards work after public #010 acceptance may bind the mature Aerodrome / Velodrome / Votium mechanisms directly to Cypher where reproducible member-level claimable can be proven.

---

# 14. PRODUCTION DEPLOYMENT SMOKE

Post-PR #121 merge deployment smoke:
- workflow: `The Holding Production Deployment Smoke`
- run ID `32042231482`
- run number `314`
- result: **SUCCESS**

Repository integrity and broader security sentinel on the merge also completed successfully.

A separate `Commit Identity Privacy Guard` run on the merge commit failed because the public GitHub merge attribution contains the repository owner handle. The owner explicitly reviewed this topic and decided to **pause privacy hardening** because the GitHub repository is intentionally public under that namespace for now.

Do not derail Company #010 production close over that paused identity-hardening item unless it becomes a real deployment/security blocker. Personal email remains protected through GitHub noreply behavior.

---

# 15. PUBLIC COMPANY #010 PASSPORT CONTRACT TO VERIFY

After all generated writers settle, public Company #010 must use the same common native Company Passport system as earlier companies — no bespoke Cypher family.

Expected public behavior:
- Company #010 card present in Collection;
- native Passport opens through the common mechanism;
- Architecture: `The Holding Standard`;
- exact Company TVL because total scoped capital is complete;
- no `≥` floor marker once complete;
- exact Network TVL because registry capital coverage is 10/10;
- ETH exposure is wrapper-aware, including actual wstETH disclosure;
- GMX strategy labels:
  - `GMX · ETH-USDC`
  - `GMX · BTC-USDC`;
- Stake DAO appears as one economic Balance Sheet row;
- Stake DAO underlying decomposition shows:
  - USDC
  - USDbC
  - axlUSDC
  - crvUSD;
- Stake DAO protocol membership appears in Passport and Graph;
- Fluid is absent from Cypher protocol list / Balance Sheet / Graph;
- Accrued Rewards section is visible;
- Productivity shows honest Reference APR coverage and does not turn unknown Project X / Concentrator APR into zero;
- Performance remains Pending / partial-cost-basis;
- Rewards remain explicitly partial while unresolved mature routes are not directly bound;
- no autonomous execution authority.

Owner acceptance criterion:
only after this is physically visible on the production site should we say:

**`страница обновлена, можешь заходить смотреть`**

and ask the owner to perform the final visual acceptance.

---

# 16. GENERAL INDEX / PERFORMANCE WARNING — MUST AUDIT BEFORE FINAL CLOSE

Company #010 is now valid for quantitative capital / TVL weighting because total scoped capital is complete.

However Performance is not complete.

The common UI / Index path must therefore be checked for this dangerous failure mode:
- `performancePending = true`
- a legacy `pct = 0` placeholder or missing numeric field
- renderer mistakenly treating missing Performance as real `0%`

Required invariant:

**unknown / pending Performance must be excluded or explicitly pending, never converted into a real zero performance observation.**

Capital completeness is sufficient for TVL/size weighting; it is not sufficient to fabricate Performance comparability.

---

# 17. COMPANY #010 → #011 REUSABLE LEARNING DELTA

The Company #010 onboarding cycle materially strengthened the reusable onboarding library.

Carry these lessons into #011+:

1. Start from the native Company UI contract from day one; avoid bespoke Passport families.
2. New company admission must enumerate every shared runtime scope — card, Passport, Graph, Index, Productivity, Rewards, Capital State — not only a company JSON.
3. `Number(null) === 0` is unsafe in epistemic financial UI/data logic; null/missing must be guarded explicitly.
4. Generated writer dependencies need explicit `workflow_run` DAGs.
5. A successful PR exact-head verifier is necessary but not sufficient; verify generated artifacts physically in remote `main`.
6. Historical reruns intended to rebuild current production state must explicitly checkout fresh `main`.
7. Owner economic boundary is methodology; an excluded protocol is not a zero or unresolved capital position.
8. LP/vault/wrapper receipt + underlying decomposition represent one economic capital position unless a separate additive exposure is proven.
9. Screenshot balances are controls, not production data sources.
10. Claimable reward is separate from principal and from realised cash flow.
11. Reference APY/APR must have exact provenance and scope; incomplete reward APR does not become zero.
12. Complete capital and complete Performance/cost-basis are independent axes.
13. Wrapper display should show economic equivalent plus wrapper disclosure without double counting.
14. Protocol-owned market tokens should use clear parent-protocol labels in public UI (e.g. GMX market rows).
15. State-backed overlays are a safe way to extend mature global collectors without destabilising the entire monolith.
16. Version compatibility gates must be broadened before rollout so the producer and consumer can coexist during transition.
17. New mechanism discovery work should become reusable adapters/knowledge rather than a Company #010-only patch.

---

# 18. CURRENT AUTHORITY / SAFETY BOUNDARY

All new Company #010 collectors and intelligence remain read-only.

`executionAuthority = none`

No wallet signing.
No transaction execution.
No autonomous capital movement.
No autonomous claim.
No production PR auto-merge.
No methodology mutation without governance.
No conversion of uncertainty into zero.

---

# 19. EXACT NEXT ACTIONS FOR THE NEXT CHAT

When a new chat starts, begin from this file through generated `intelligence/project-memory/CURRENT.md`, then immediately fresh-fetch GitHub `main` because bot writers may have moved the head after this checkpoint.

Do not restart discovery from scratch.

Immediate operational sequence:

1. Fetch fresh `main` head.
2. Verify `companies/productivity-data.json` physically:
   - version expected `1.16`;
   - Cypher present;
   - honest covered-capital Reference APR;
   - Project X + Concentrator remain warming/unknown.
3. Verify `companies/productivity-source-report.json` physically.
4. Check Rewards run `32042395558` to completion.
5. Fetch `companies/rewards-data.json` and verify v0.3.10 Cypher semantics.
6. Fetch latest:
   - `companies/company-010-production-state.json`
   - `companies/company-010-reconciliation.json`
   - `intelligence/capital-state/capital-state.json`
   and record exact fresh numbers.
7. Audit General Index / Performance-pending behavior so no missing Performance becomes zero.
8. Determine / confirm production deploy path from repo and verify live public `/companies/` page.
9. Check Company #010 card + Passport + Balance Sheet + Productivity + Rewards + Graph + Index presentation.
10. If all correct, tell owner: `страница обновлена, можешь заходить смотреть` and let owner visually accept.
11. If a real defect exists, create a narrowly scoped new branch/PR, but **do not merge without fresh explicit authorization**.
12. After owner acceptance, write final Company #010 CLOSED continuity / #010→#011 learning delta and then resume global Brain/Orchestrator work.

---

# 20. KEY IDS / SHAS FOR FAST RECOVERY

PR #119 merge:
`78be41c8a253267890989d25bba71b0025f0a309`

PR #120 merge:
`ff0db55ae7857b28b95a641e936dfeb58e003b81`

PR #121 exact head:
`c1366a98d433931806a098176924387103b00a81`

PR #121 merge:
`eb5d8e2b9fb7c2ad4948a9edbdf082ccc6763fce`

Fresh Company #010 run #5:
`32042231485` — SUCCESS

Fresh Company generated commit:
`dfed3db1206642ea1e74f8f99b50eb126692bb60`

Fresh Capital State run #14:
`32042395570` — SUCCESS

Fresh Productivity run #26:
`32042395515` — SUCCESS

Fresh Productivity writer commit:
`bb0c38c8ddf8ed7b3588e627677fbe3360ab70c1`

Fresh Rewards run #37:
`32042395558` — IN PROGRESS at this checkpoint

Post-PR #121 Production Deployment Smoke:
`32042231482` — SUCCESS

---

# 21. STATUS LINE

**Company #010 Cypher backend capital + downstream Capital State + corrected Productivity DAG are production GREEN. Productivity run #26 is GREEN and published a new snapshot commit. Fresh Rewards #37 is still running. Final physical JSON verification + General Index semantic audit + public Passport visual acceptance remain before Company #010 can be marked CLOSED.**
