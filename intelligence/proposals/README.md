# The Holding Proposal / Work Queue v0.1

This is the next downstream organ after Decision Outcome Learning. It converts active grounded cases into a persistent, machine-readable work queue.

Canonical flow after installation:

`Observer / Memory -> Security Sentinel -> Grounded Brain -> ChatGPT Bridge -> Cognitive Stack -> Decision Outcome Learning -> Proposal Work Queue`

## What it can do

- create deterministic PROPOSED work items from active Learning cases;
- rank them by domain, risk, confidence and persistence;
- bind every proposal to caseKey, Brain snapshot and Cognitive chain hash;
- preserve prior human-controlled lifecycle state;
- supersede only untouched PROPOSED items whose source case disappeared;
- independently review the generated queue before publication.

## What it cannot do

It cannot approve a proposal, edit production code, execute a transaction, sign, touch wallets, or call a paid model API. Human approval remains mandatory for every mutation.

## Lifecycle

`PROPOSED -> APPROVED -> IN_PROGRESS -> VERIFYING -> RELEASE_READY -> RELEASED`

with `REJECTED` and `SUPERSEDED` terminal/alternate states. v0.1 engine itself may only create `PROPOSED` and automatically mark an untouched disappeared proposal `SUPERSEDED`.
