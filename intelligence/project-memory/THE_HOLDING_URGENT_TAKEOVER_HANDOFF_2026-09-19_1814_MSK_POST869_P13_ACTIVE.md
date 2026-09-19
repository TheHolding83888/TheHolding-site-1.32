# THE HOLDING — URGENT TAKEOVER HANDOFF
## 2026-09-19 18:14 MSK · POST-#869 PRODUCTION PROOF · P13 ACTIVE

Status: **URGENT PARALLEL-CHAT TAKEOVER CHECKPOINT**  
Authority: continuity / recovery / sequencing only  
`executionAuthority = none`

> This file is a frozen handoff snapshot, not a new production source of truth. At resume time always fresh-check live `main`, Actions and machine artifacts before acting.

---

## 0. CANONICAL RECOVERY ORDER

Use this order when this handoff is picked up:

1. live GitHub `main`;
2. fresh generated production JSON / exact workflow evidence;
3. current subsystem machine-readable state;
4. live `intelligence/project-memory/CURRENT.md` → latest continuity;
5. `intelligence/project-memory/THE_HOLDING_MEMORY_ROUTING_INDEX_v2_2026-08-26.md`;
6. active roadmap/canon;
7. this handoff;
8. older checkpoints/history.

Canonical roadmap:

`intelligence/project-memory/THE_HOLDING_PUBLIC_GREEN_TO_PRIVATE_ROADMAP_2026-09-13.md`

Do **not** treat old prose percentages as live truth.

---

## 1. FROZEN SOURCE BOUNDARY

Checkpoint branch:

`checkpoint/urgent-handoff-20260919-1814-msk-post869-p13-active`

Frozen base `main` at handoff creation:

`67d3ade5cbc3c7e847f279114294319270211af4`

Commit message at that head:

`intelligence: refresh aerodrome managed pulse`

Commit time:

`2026-09-19T14:58:13Z` = `17:58:13 MSK`

Important: `main` is automation-active and may move after this checkpoint. Re-read before any mutation.

Live CURRENT observed before checkpoint:

`intelligence/project-memory/CURRENT.md`

CURRENT represented source state:

`2026-09-19T12:34:17.090Z`

CURRENT pointed to:

`THE_HOLDING_MASTER_CONTINUITY_2026-09-19_114826_AUTO_78305e9f.md`

That continuity is useful resume context but predates later post-#869 production activity and the frozen `main` above. Live evidence outranks it.

---

## 2. ROADMAP STATUS — DO NOT REOPEN GREEN PACKAGES WITHOUT CONTRADICTORY EVIDENCE

Fresh recent-PR review established:

### P10 — CLOSED / GREEN

Canonical closure PR:

`#864 P10: close system-wide production acceptance`

Merged 2026-09-19.

P10 acceptance already covered Stable materialization, Observer/System Memory + Memory Vault, Cognitive exact-upstream binding/eval, downstream propagation and invariants.

### P11 — N/A / no material package

Canonical PR:

`#866 P11: record no material cosmetic package`

Merged 2026-09-19.

Do not invent redesign/cosmetic work merely to populate P11.

### P12 — CLOSED / GREEN

Canonical closure PR:

`#868 P12: close pre-private cleanup and freeze`

Merged 2026-09-19.

P12 closed the bounded pre-private cleanup/freeze and Actions hygiene package. Historical retained incidents remain forensic memory unless fresh evidence makes them actionable.

### Current ordered roadmap position

**P13 — Real pre-private checks** is the next actual roadmap package after the additional #869 hardening below is production-proven.

Then:

`P14 final public-state checkpoint → P15 verified backup/export → P16 public→private visibility change (EXPLICIT OWNER CONFIRMATION REQUIRED) → P17 post-private audit`

Do not begin private-only architecture before P16/P17 completion.

---

## 3. ADDITIONAL POST-P12 HARDENING — PR #869

PR:

`#869 Stable: capability-aware historical RPC transport`

Final PR head before merge:

`782fd4792e27754aeec2c167f482b3f01e83e993`

Merged into `main` with merge commit:

`ec2573990507f8244b808cdd3db3babb219eadcc`

This is **additional bounded reliability hardening**, not a reopening of P10 or P12.

### What #869 changed

Exactly three production files in the final PR:

1. `.github/workflows/update-stable-capital-scheduled.yml`
2. `intelligence/reliability/update-stable-capital-scheduler-proof.mjs`
3. `stable-capital/rpc-capability-selector.mjs`

Core contract:

- one shared Ethereum historical RPC capability selector;
- endpoint admitted only after a real historical contract-state `eth_call` succeeds;
- endpoint/header liveness alone is insufficient;
- selected transport is reused by the **existing single canonical Stable writer**;
- `UNKNOWN != 0` remains mandatory;
- if historical capability cannot be proved, values remain null/UNKNOWN/fail-closed;
- no new accounting methodology;
- no new Stable writer;
- no new scheduled/PR workflow;
- no new PR fan-out;
- no capital/wallet/security authority expansion;
- `executionAuthority = none`.

### Important forensic path during review

An early live canary/proof pass exposed two review-only issues before merge:

1. the paired proof initially expected the wrong parameter name (`historicalBlockDistance` vs the selector/canary's `historyBlockDistance` in an intermediate proof path); this was corrected;
2. an attempted separate diagnostic workflow created +1 workflow/fan-out debt and was rejected by the existing Workflow Control Plane. That new workflow was removed entirely before final merge.

Final architecture therefore kept **0 new workflows / 0 new PR fan-out**.

Final exact-head checks on `782fd479…` were GREEN:

- Workflow Control Plane;
- Repository Hygiene Guard;
- Public Surface Privacy Guard;
- Commit Identity Privacy Guard.

Do not recreate the discarded extra workflow.

---

## 4. #869 PRODUCTION SELF-PROOF — GREEN

Canonical writer:

`Update Stable Capital`

Production run after merge:

- run id: `35441079054`
- run number: `#6`
- event: `push`
- head SHA: `ec2573990507f8244b808cdd3db3babb219eadcc`
- started: `2026-09-19T11:47:39Z`
- completed: `2026-09-19T11:54:46Z`
- conclusion: **success**

All meaningful steps completed successfully:

- Checkout
- Setup Node.js
- Preflight
- Install dependencies
- **Select Ethereum historical RPC by proven capability**
- Collect recurring Stable Capital reference yield + ledger checkpoint
- Build canonical Embedded Yield interval history
- Build Stable Companies Index + verified Performance
- Validate generated data
- Publish Stable Capital + Stable Companies Index

Production publication step completed successfully and verified the files on `origin/main`.

### Capability artifact physically materialized

`intelligence/reliability/stable-rpc-capability.json`

Observed state:

- version: `0.1-stable-rpc-capability`
- generatedAt: `2026-09-19T11:48:32.451Z`
- chain: Ethereum / chainId 1
- capability: `historical-contract-state-read`
- status: **ready**
- selected provider: `eth.blockscout.com`
- latestBlock: `26011364`
- historicalBlock: `25961364`
- probe distance: `50,000` blocks
- probe: USDC `decimals()` historical `eth_call`
- returned decimals: `6`
- selector latency for selected provider: `785 ms`

Failed candidate attempts stayed visible:

- `ethereum-rpc.publicnode.com` → 403
- `eth.llamarpc.com` → 403
- `eth.blockscout.com` → success

Artifact invariants explicitly say:

- strategy-agnostic transport = true;
- endpoint liveness != historical capability = true;
- unknown never zero = true;
- fail closed = true;
- second Stable writer created = false;
- executionAuthority = none.

### Stable production files physically refreshed

`companies/stable-capital-data.json`

- generatedAt: `2026-09-19T11:54:41.346Z`
- version: `0.4.1-monetra-recurring-stable-index-semantics`
- 10 current positions preserved.

`companies/embedded-yield-ledger.json`

- generatedAt: `2026-09-19T11:54:41.346Z`
- version: `0.4-flow-aware-recurring-checkpoints`
- canonical interval-history accounting preserved.

`companies/stable-index-data.json`

- generatedAt: `2026-09-19T11:54:41.470Z`
- version: `0.2-stable-companies-index-strategy-performance`
- Stable universe remains separate from general Composite.

Current Stable Index snapshot at that run:

- stableCapitalUsd: `100.483636`
- currentCapitalUsd: `100.57366507`
- investedUsd: `99.99833671`
- strategyPerformanceUsd: `0.79188118`
- strategyPerformancePct: `0.79189435%`
- accruedClaimableUsd: `0.09002907`
- embeddedIncomeSinceTrackingUsd: `0.12509444`
- stablePriceEffectUsd: `-0.21655282`
- netMarketPnlUsd: `0.57532835`
- netMarketPnlPct: `0.57533792%`
- strategyPerformanceStatus: `verified-since-inception`

### Important semantic nuance — do not misclassify as stale/failure

Current Stable reference-yield coverage is **partial**, not stale:

- currentFullCoverage = false
- currentReferenceApyPct = null
- displayed Reference APY = last full-coverage observation `5.486762%`
- status = `last-full-coverage`

Several Ethereum historical adapter reads still report warming/archive-unavailable or retry-limit exhaustion even though the selector has proved the endpoint has historical contract-state capability.

That means:

- capability selection is working;
- specific historical calls can still be rate/retry constrained;
- those references correctly remain null/UNKNOWN;
- **do not convert them to zero or fabricate a current APY**;
- do not reopen #869 solely because full Reference APY coverage is not currently 10/10.

Fresh contradictory production evidence would be required to reopen the transport hardening.

---

## 5. SYSTEM / COGNITIVE STATE RELEVANT TO TAKEOVER

Live CURRENT observed before this checkpoint reported:

- System Memory generatedAt `2026-09-19T11:18:54.414Z`;
- Permanent Memory Vault: 78 Observer records / 600 material events;
- Cognitive Stack = WATCH but `readyForManualInterpretation = true`;
- Security Sentinel = WATCH;
- Grounded Brain = WATCH;
- ChatGPT Bridge = WATCH;
- noExecution = true.

Earlier direct physical Cognitive proof on 2026-09-19 showed:

- `intelligence/cognitive-stack-eval.json` status = **pass**;
- `staticReleaseCoherent = true`;
- `securityMemoryLinked = true`;
- `groundedBrainExactUpstream = true`;
- `bridgeExactBrain = true`;
- `bridgeExactUpstream = true`;
- `bridgeEvalPass = true`;
- `noApiRequired = true`;
- `noModelCall = true`;
- `noExecution = true`;
- `executionAuthorityNone = true`.

WATCH is therefore not equivalent to a broken cognitive chain; security watch items remain intentionally visible.

Always fresh-check the current files before using these numbers.

---

## 6. ACCOUNTING / REPORTING BASELINE

Latest automatic continuity available at checkpoint preparation:

`THE_HOLDING_MASTER_CONTINUITY_2026-09-19_114826_AUTO_78305e9f.md`

It recorded, at its own source boundary:

- Security: WATCH; Critical 0 / High 2 / Medium 74;
- Accounting Coverage generatedAt `2026-09-19T10:46:16.016Z`;
- supported mechanisms: `29`;
- reusable gaps: `0`;
- Canonical Income Ledger generatedAt `2026-09-19T10:46:16.016Z`;
- observed income events: `1981`;
- Company Monthly Reports generatedAt `2026-09-19T10:25:04.263Z`;
- companies: `10`.

These numbers are resume context only; they predate later automation and must be re-read live for P13/P14.

Non-negotiable laws:

- Canonical Income Ledger is sole factual earned-income authority;
- Reference APR/APY != factual income;
- principal / reference productivity / embedded yield / accrued rewards / realised cash flow / performance / stable price effect remain distinct;
- opening balance is baseline, not current-period income;
- claims/withdrawals settle already-recognized income where applicable and must not double count;
- `UNKNOWN != 0`;
- `GREEN workflow != physically materialized artifact`.

---

## 7. SECURITY STATE — PRIMARY P13 REVIEW GATE

Fresh security artifact observed after #869 merge:

`security/security-intelligence.json`

At `2026-09-19T11:48:24.295Z` it reported:

- status: WATCH
- Critical: `0`
- High: `2`
- Medium: `74`

The two High findings are both existing privileged-trigger watches:

1. `.github/workflows/production-boundary-guard.yml` uses `pull_request_target`;
2. `.github/workflows/production-deployment-smoke.yml` uses `pull_request_target`.

They are not new #869 findings.

Durable prior human/security review exists:

`security/SECURITY_TRUST_REVIEW_2026-08-26.md`

That review explicitly classified both High findings as intentional bounded watch items:

- current permissions read-only;
- boundary guard uses trusted base checkout and treats candidate code as data;
- deployment smoke PR-target path inspects GitHub metadata/check-runs and does not execute candidate repository code;
- no suppression;
- no Sentinel weakening;
- Critical = 0 at reviewed baseline;
- both High items intentionally remain visible for future drift review.

### P13 rule

Roadmap P13 requires:

`Critical = 0; every current High reviewed/fixed/classified with evidence.`

Therefore the correct P13 action is **not** automatically to remove/suppress the two Highs. Instead:

1. fresh-read the current two workflow definitions;
2. verify the August review assumptions still hold on current blobs/permissions/checkout behavior;
3. if unchanged and bounded, create/update explicit current evidence that the two Highs remain reviewed/classified;
4. if drift changed the risk model, repair narrowly before declaring P13 GREEN.

Do not reduce the Sentinel count cosmetically.

Also note current Security artifact may contain Medium DOM trust-review invalidations after public HTML changes; P13 should classify whether any of these are current blockers under the actual Private Migration Gate, rather than equating every Medium with a release blocker.

---

## 8. REAL NEXT PACKAGE — P13 PRE-PRIVATE CHECKS

P13 acceptance from the owner-approved roadmap must be executed against **fresh exact state**:

1. exact current `main` + relevant CI / Workflow Control Plane;
2. Repository Hygiene / public-surface privacy;
3. production deployment / currentness;
4. accounting / lifecycle invariants;
5. Security: Critical 0 and every current High reviewed/fixed/classified with current evidence;
6. active/queued workflow classification;
7. project-memory recovery path.

### Recommended resume sequence

A takeover chat should do this in order:

1. **Fresh rebaseline**
   - read current `main` SHA;
   - read live CURRENT + latest continuity + Router;
   - list fresh Actions/runs around current main;
   - verify no new red production blocker appeared after this handoff.

2. **Confirm #869 remains production-stable**
   - do not rerun merely for appearance;
   - verify latest Stable writer state/artifacts;
   - only reopen if fresh contradictory evidence exists.

3. **P13 Security High review**
   - current `production-boundary-guard.yml`;
   - current `production-deployment-smoke.yml`;
   - current permissions, PR-target behavior, candidate checkout semantics;
   - bind result to evidence/current SHA.

4. **P13 operational gates**
   - Workflow Control Plane / no-new-debt;
   - repo hygiene/privacy;
   - production/deployment/currentness;
   - accounting coverage / Income Ledger / monthly report rollover;
   - active/queued Actions classification;
   - project-memory recovery path.

5. **If all P13 gates are physically GREEN**
   - create one bounded P13 closure artifact/PR;
   - exact conclusion: `P13 CLOSED / GREEN`;
   - no P14 inventory mixed into P13 unless repo canon explicitly requires a combined gate.

6. **Then P14**
   - create final public-state inventory with exact final SHA/time;
   - include PR/issue/branch/workflow/security/deployment/accounting state;
   - include accepted Partial/UNKNOWN tails;
   - include cleanup disposition + exact next-step contract;
   - only then state:
     `PUBLIC PHASE FINALIZATION — GREEN. READY FOR FINAL BACKUP / PRIVATE MIGRATION.`

7. **P15**
   - full verified backup/export from exact P14 state;
   - verify backup, not merely initiation.

8. **STOP BEFORE P16**
   - public → private visibility change requires explicit owner confirmation at that moment;
   - do not perform it under routine Flow Mode.

---

## 9. DO NOT DO

- Do not reopen P10/P11/P12 without fresh contradictory evidence.
- Do not create another Stable writer.
- Do not add another PR/scheduled workflow for historical RPC diagnostics.
- Do not weaken Control Plane / fan-out debt gates to make a PR pass.
- Do not suppress the two Security Highs just to get a green badge.
- Do not convert Stable warming/null rates to 0.
- Do not equate last-full-coverage Reference APY with a current fully-covered APY.
- Do not rewrite accounting methodology in P13.
- Do not begin private-only Capital Flow Semantics / Position Lifecycle / Wallet Discovery before private migration.
- Do not change repository visibility without explicit owner confirmation.

---

## 10. OWNER WORKING CONTRACT

Alexander has explicitly authorized normal low-risk GitHub work in the active package without asking for confirmation at every step.

Flow Mode:

`diagnose → implement → exact-head verify → merge → physical proof → bounded cleanup`

Stop/ask only at real high-consequence boundaries, including:

- wallet signing / transactions / capital movement;
- secrets;
- material security/trust-policy weakening or expansion;
- accounting/methodology policy mutation;
- destructive/irreversible operations;
- major new architecture/authority;
- repository public→private visibility change;
- any platform permission/consent gate.

When Alexander says **«трекай»**, do a fresh read-only live check of:

- `main`;
- active/relevant branches and PRs;
- Actions/workflows/runs/jobs;
- fresh generated artifacts/evidence;
- latest automatic continuity/checkpoints;
- Router/resume context.

Report simply in Russian:

- 🟢 сделано;
- 🟡 делается + approximate %;
- ⚪ дальше/очередь.

---

## 11. ONE-SENTENCE TAKEOVER STATE

**P10 GREEN, P11 N/A, P12 GREEN; post-P12 Stable historical-RPC hardening #869 is merged and physically production-proven GREEN; do not reopen it for partial Reference APY coverage; the next real package is P13 exact-state pre-private checks, with current re-review/classification of the two privileged-trigger Security Highs as the first explicit gate.**
