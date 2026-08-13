# The Holding — Cognitive Stack Reliability v0.2.1

This release fixes two production-grade reliability issues found during the first
integrated run.

1. **Partial release skew**: the new v0.2 workflow/policy was live, but the repository
   still contained the old Bridge engine. A static release manifest + coherence guard
   now makes this class of partial manual upload fail immediately before stateful work.

2. **Self-invalidating Sentinel trigger loop**: Security Sentinel previously ran on
   Brain/Bridge generated-output commits. That creates:
   Sentinel -> Brain commit -> Sentinel again -> stale Brain.
   Sentinel now ignores only deterministic generated cognitive artifacts. Static
   engines, policies, schemas, workflows and application code remain scanned.

The integrated workflow also no longer runs Bridge self-test before it refreshes
Security and Grounded Brain. Bridge self-test now runs only after a fresh Brain exists.

Canonical manual path:
Security Sentinel -> Grounded Brain -> exact-upstream Bridge -> Cognitive Stack State.
