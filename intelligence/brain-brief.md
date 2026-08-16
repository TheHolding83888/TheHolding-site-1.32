# The Holding Brain — Grounded Reasoning Brief

Generated: 2026-08-16T07:50:28.452Z
Mode: delta
Status: watch

## 25 evidence-bound reasoning case(s) are active across economic and security memory.

### What changed
Current canonical inputs contain 20 material Observer change(s), 0 new security finding event(s), and 1 resolved security finding event(s).

### Why it matters / What follows / What should be done

#### 1. verification/ask-experience/runner-v0.1.mjs
- Signal: JavaScript eval usage detected.
- Why it matters: Eval can execute attacker-controlled strings if data boundaries are ever breached.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings/0

#### 2. verification/ask-experience/runner-v0.1.mjs
- Signal: JavaScript eval usage detected.
- Why it matters: Eval can execute attacker-controlled strings if data boundaries are ever breached.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings/1

#### 3. verification/ask-experience/runner-v0.1.mjs
- Signal: JavaScript eval usage detected.
- Why it matters: Eval can execute attacker-controlled strings if data boundaries are ever breached.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings/2

#### 4. verification/ask-experience/runner-v0.1.mjs
- Signal: JavaScript eval usage detected.
- Why it matters: Eval can execute attacker-controlled strings if data boundaries are ever breached.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings/3

#### 5. .github/workflows/production-boundary-guard.yml
- Signal: Workflow uses pull_request_target.
- Why it matters: This trigger runs in a privileged base-repository context and requires special care around untrusted pull-request code.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings/4

#### 6. .github/workflows/production-deployment-smoke.yml
- Signal: Workflow uses pull_request_target.
- Why it matters: This trigger runs in a privileged base-repository context and requires special care around untrusted pull-request code.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings/5

#### 7. 19 current findings
- Signal: 19 current medium security finding(s) in category dom-innerhtml.
- Why it matters: If any assigned value later becomes user-controlled or external data, this can become a DOM-XSS sink.
- What follows: A DOM execution sink exists. Risk depends on whether external or user-controlled values can reach it.
- Proposed next step: Classify the sink by provenance first. Replace with textContent or safe DOM construction only where untrusted/dynamic data can reach the sink; avoid blind bulk rewrites.
- Action mode: proposal-only
- Evidence: security/security-intelligence.json/currentFindings

#### 8. 0x5860...83CA8.eth
- Signal: 0x5860...83CA8.eth Rewards needs attention: status=partial, pendingRoutes=1, unpricedRewards=0.
- Why it matters: Unresolved reward routes reduce the completeness of earned-value memory.
- What follows: Pending reward routes make earned-value memory incomplete even when currently measured routes are correct.
- Proposed next step: Resolve only the pending reward route(s) with bounded current-state reads and claimed-state checks. Preserve solved routes and never treat pending as zero.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/watchNext/0

#### 9. aerocvxyb.eth
- Signal: aerocvxyb.eth Rewards needs attention: status=partial, pendingRoutes=2, unpricedRewards=0.
- Why it matters: Unresolved reward routes reduce the completeness of earned-value memory.
- What follows: Pending reward routes make earned-value memory incomplete even when currently measured routes are correct.
- Proposed next step: Resolve only the pending reward route(s) with bounded current-state reads and claimed-state checks. Preserve solved routes and never treat pending as zero.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/watchNext/1

#### 10. defitea.eth
- Signal: defitea.eth Rewards needs attention: status=partial, pendingRoutes=2, unpricedRewards=0.
- Why it matters: Unresolved reward routes reduce the completeness of earned-value memory.
- What follows: Pending reward routes make earned-value memory incomplete even when currently measured routes are correct.
- Proposed next step: Resolve only the pending reward route(s) with bounded current-state reads and claimed-state checks. Preserve solved routes and never treat pending as zero.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/watchNext/2

#### 11. Stable Companies Index
- Signal: Stable Index coverage state changed: current-full-coverage/true → last-full-coverage/false.
- Why it matters: Stable Reference APY is fail-closed; coverage state determines whether the current rate is fully observed or the latest full observation is being carried forward.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/4

#### 12. Stable Companies Index
- Signal: Stable Capital current coverage is not full; display APY is last-full-coverage.
- Why it matters: The Stable layer intentionally carries the last full observation rather than inventing a current full rate.
- What follows: The current Stable Capital rate is not fully observed, so replacing the last verified full-coverage rate would overstate certainty.
- Proposed next step: Preserve last-full-coverage display semantics and resolve the current warming stable position before promoting a new full-current APY.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/watchNext/3

#### 13. liquity_lqty
- Signal: Liquity adapter liquity_lqty changed warming → ok.
- Why it matters: A previously unresolved mechanism is now reproducibly measurable and becomes reusable intelligence.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/0

#### 14. pendle_spendle
- Signal: Pendle adapter pendle_spendle changed warming → ok.
- Why it matters: A previously unresolved mechanism is now reproducibly measurable and becomes reusable intelligence.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/1

#### 15. defitea.eth
- Signal: defitea.eth Productivity status changed partial → ok.
- Why it matters: Status changes alter how much of the company’s productive capital is currently reproducibly measured.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/2

#### 16. defitea.eth
- Signal: defitea.eth Productivity coverage moved 89.8% → 100.0%.
- Why it matters: Coverage tells us how much productive capital is currently understood rather than guessed or treated as zero.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/3

#### 17. 0x5860...83CA8.eth
- Signal: 0x5860...83CA8.eth Reference APR moved 15.82% → 15.58% (-0.24 pp).
- Why it matters: Meaningful changes in productive capacity are part of the company’s operating history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/5

#### 18. 1milliondollar.eth
- Signal: 1milliondollar.eth Reference APR moved 7.08% → 6.80% (-0.29 pp).
- Why it matters: Meaningful changes in productive capacity are part of the company’s operating history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/6

#### 19. aerocvxyb.eth
- Signal: aerocvxyb.eth Reference APR moved 16.13% → 15.85% (-0.27 pp).
- Why it matters: Meaningful changes in productive capacity are part of the company’s operating history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/7

#### 20. defitea.eth
- Signal: defitea.eth Reference APR moved 13.47% → 12.49% (-0.98 pp).
- Why it matters: Meaningful changes in productive capacity are part of the company’s operating history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/8

#### 21. YieldRing.eth
- Signal: YieldRing.eth Reference APR moved 14.34% → 15.00% (+0.66 pp).
- Why it matters: Meaningful changes in productive capacity are part of the company’s operating history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/9

#### 22. defitea.eth
- Signal: defitea.eth recorded a new daily reporting observation for 2026-08-16.
- Why it matters: Every new daily observation extends the operating memory used by future analytics and decision support.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/10

#### 23. defitea.eth
- Signal: defitea.eth current-month cash-flow/reference-income counter moved $23.10 → $26.25.
- Why it matters: Autonomous reporting is turning recurring observations into a continuously growing economic history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/11

#### 24. Monetra.eth
- Signal: Monetra.eth recorded a new daily reporting observation for 2026-08-16.
- Why it matters: Every new daily observation extends the operating memory used by future analytics and decision support.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/12

#### 25. Monetra.eth
- Signal: Monetra.eth current-month cash-flow/reference-income counter moved $0.04 → $0.05.
- Why it matters: Autonomous reporting is turning recurring observations into a continuously growing economic history.
- What follows: The signal is real, but the current deterministic policy has no category-specific consequence beyond continued observation.
- Proposed next step: Inspect the cited evidence before proposing any change. Do not invent a remediation path that is not supported by canonical data.
- Action mode: proposal-only
- Evidence: intelligence/change-intelligence.json/whatChanged/13

---

This layer does not execute capital actions, mutate methodology, rewrite source data, or modify the workflow plane.
Every reasoning case is evidence-bound and proposal-only.
