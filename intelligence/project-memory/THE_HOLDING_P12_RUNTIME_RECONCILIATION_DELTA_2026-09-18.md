# THE HOLDING — P12 RUNTIME RECONCILIATION DELTA
## 2026-09-18 · preparation only · do not merge before P10 acceptance

Parent preparation manifest: `THE_HOLDING_P12_CLEANUP_PREP_2026-09-18.md`  
Authority: observation / future cleanup planning only  
`executionAuthority = none`

## Newly reviewed items

### #447 — repeated-failure · unified-capital-refresh
Classification: **RESOLVED_EVIDENCE / STRONG CLOSE CANDIDATE**

Reviewed evidence:
- last runtime recurrence in the issue: `2026-09-11T18:25:23Z`;
- later same-day production repair #767 / commit `133dbe6ef0e03a9af25948907a355dab8e61a04a` explicitly records the concrete failure class: production run #202 exposed a malformed `setup-node` action SHA;
- #767 restored the established valid pin and extended paired proof to reject the known-bad pin;
- after that repair, canonical Unified Capital repeatedly physically materialized `capital: refresh coherent production snapshot` with no newer same-fingerprint issue recurrence found;
- fresh examples include `a025514aab47ff4fe6f5886fc6734fadc1e4289d` on 2026-09-18 and multiple 2026-09-17 snapshots.

Durable lesson:
Pinned third-party Action identity is executable workflow infrastructure. A malformed pin must fail closed and the paired definition proof must reject the known-bad identity.

P12 closure condition:
Fresh-check no newer recurrence, reference #767 + a later successful physical Unified Capital snapshot, then close #447 as resolved historical incident.

### #456 — critical-handoff-miss · unified-capital-refresh → update-economic-graph
Classification: **CURRENT CHAIN HEALTHY / NEEDS ROOT-CAUSE REVIEW BEFORE CLOSURE**

Evidence:
- historical issue says Unified Capital succeeded but Economic Graph did not materialize within 60m;
- the issue stopped recurring by 2026-09-06;
- current production shows fresh Unified Capital materialization followed by fresh Economic Graph and Explanatory Context materializations;
- therefore this is not evidence of a current broken chain.

Do not close solely because later runs are healthy. Before closure either bind the historical miss to a reviewed recovery/fix or document why the old fingerprint became structurally impossible under the current topology, then prove the current handoff contract.

### #726 — repeated-failure · update-comparative-intelligence
Classification: **CURRENTLY HEALTHY / NEEDS ROOT-CAUSE REVIEW**

Evidence:
- incident created 2026-09-10 with 7 consecutive failures;
- no recurrence comments were recorded on the issue;
- Comparative Intelligence has physically materialized repeatedly since then;
- fresh examples on 2026-09-18 include `f2997f5349e95790292203a427b13802d33ac486` and `a269488f015a24df7ee3f10d8ebc14de29912449` (`intelligence: refresh comparative state`).

Conclusion: no current outage is evidenced, but the original root cause remains undocumented. Keep in review queue rather than closing by success-count alone.

### #659 — repeated-failure · update-learning-loop
Classification: **LIKELY HISTORICAL / NEEDS ROOT-CAUSE MAPPING**

Evidence:
- issue was created 2026-09-06 with 3 consecutive failures and has no recurrence comments;
- later Learning reliability work includes #720 release-coherence restoration, #814 canonical Decision-writer release coherence, and #816 safe-skip semantics for stale Learning/Cognitive inputs;
- current project bootstrap reports Learning `READY` with active/remembered cases present.

Do not guess which later repair resolves the old fingerprint. Before closure map the incident to exact historical evidence or retain it as reviewed-but-unattributed operational history.

### #792 — repeated-failure · verify-ve33-accounting
Classification: **KEEP / NEEDS REVIEW**

Evidence:
- 11–12 consecutive failures were observed on 2026-09-12, followed by another 3-failure recurrence on 2026-09-13;
- significant ve33 accounting repairs were merged around the same period, including #791, #789 and #804;
- the later recurrence means #804 alone cannot safely be declared the closing fix without exact run evidence.

Do not close until a root cause and post-fix same-verifier proof are identified.

### #778 — repeated-failure · resume-economic-graph-after-code-change
Classification: **KEEP / NEEDS REVIEW**

Evidence:
- recurrences were still observed on 2026-09-16;
- fresh Economic Graph production data proves the canonical graph writer can currently materialize, but does not itself prove this dedicated recovery entrypoint is healthy.

Do not conflate ordinary Economic Graph success with recovery-workflow acceptance.

### #432 — repeated-failure · production-deployment-smoke
Classification: **SECURITY-SENSITIVE KEEP / REVIEW SEPARATELY**

Evidence:
- historical recurrence ended in late August;
- the workflow belongs to a production/deployment boundary and the Control Plane also flags its `pull_request_target` authority as a high-context finding;
- changing or retiring it merely for cleanup/fan-out reduction could weaken the deployment trust boundary.

P12 rule: no modification or closure-by-assumption. Require exact current smoke evidence and security-boundary review. This item is excluded from casual fan-out optimization.

## Old benign canary PR #37

PR #37: `CANARY – final benign Production Boundary Guard proof`

Classification: **STRONG CLOSE CANDIDATE, NEVER MERGE**

Evidence:
- PR body explicitly says `This PR must never be merged`;
- it was created 2026-08-14 as a one-file benign proof surface;
- code search found no default-branch reference to PR #37 or its canary branch name;
- current Production Boundary / deployment architecture has materially evolved since this canary.

Remaining pre-close check:
Confirm no current repository rule/procedure outside code search intentionally requires an open benign canary PR. If none is found, close the PR while preserving Git history; do not delete its branch in the same batch.

## Consolidated runtime buckets for P12 activation

### Strong close candidates after one final live recurrence check
- #822 HyperLend — fixed/proven by #855 + natural post-merge success.
- #369 Rewards — fixed/proven by #853 + physical Rewards/Accounting closure.
- #447 Unified Capital — malformed action-pin root cause fixed by #767 + repeated later physical publication.

### P10-dependent close candidates
- #379 Cognitive repeated failure.
- #564 Explanatory → Cognitive handoff miss.

Both must be validated only **after** Stable Capital restores the three stale canonical sources; do not weaken Cognitive global freshness.

### Healthy today but historical lesson incomplete
- #815 Aerodrome Managed Pulse.
- #799 / #727 Reporting.
- #565 Monthly Reports.
- #370 Economic Graph.
- #383 Economic Graph → Explanatory handoff.
- #716 Market Data.
- #726 Comparative Intelligence.
- #659 Learning Loop.
- #456 Unified Capital → Economic Graph handoff.

### Keep for deeper exact-run review
- #778 Economic Graph code-change recovery.
- #792 ve33 accounting verifier.
- #432 Production Deployment Smoke (security-sensitive).

## Operating conclusion

The open Runtime Reliability list is a mixture of:
1. genuinely resolved historical incidents whose issues were never reconciled;
2. downstream symptoms of the single still-open P10 Stable Capital freshness gate;
3. healthy-current workflows whose historical root cause was never formally reviewed;
4. a small residual set that still merits exact-run investigation.

P12 should therefore reconcile evidence first and close metadata second. It must not turn `fewer open issues` into a substitute for `fewer real failure classes`.