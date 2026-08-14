# The Holding Guardian v0.1

Guardian is the deterministic capability gate between Builder candidate work and any future sandbox mutation authority.

v0.1 is deliberately non-executing. It can classify an exact, independently reviewed Builder candidate as `RESEARCH_ONLY` or `BLOCKED`, explain why, and persist the gate decision with byte-level provenance.

It cannot edit repository code, create branches or pull requests, merge, release, sign, transact, access wallets, change capital, or weaken upstream policy.

Current flow:

`Owner Decision → Decision-bound Proposal → Builder Candidate → Guardian Capability Gate`

A later Guardian version may define a narrowly bounded sandbox-build capability, but only after the current research-only gate is production-proven. Production mutation and capital execution remain outside this layer.
