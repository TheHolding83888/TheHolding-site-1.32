# The Holding Proposal / Work Queue v0.1.1

The Proposal Work Queue is the downstream planning organ after Decision & Outcome Learning.

Canonical flow:

`Observer / Memory -> Security Sentinel -> Grounded Brain -> ChatGPT Bridge -> Cognitive Stack -> Decision Outcome Learning -> Proposal Work Queue`

## Source contract

- facts: `intelligence/brain-intelligence.json`
- cognitive coherence: `intelligence/cognitive-stack-state.json`
- case lifecycle and experience: `intelligence/learning-state/learning-context.json`
- policy: `intelligence/proposals/proposal-policy.json`

The queue is rebuilt only from a Learning context whose cognitive chain hash matches the current Cognitive Stack. The engine also checks the Brain byte binding when the stack exposes it.

## What it can do

- create deterministic `PROPOSED` work items from active Learning cases;
- rank them by domain, risk, confidence and persistence;
- bind every proposal to its case key, Brain snapshot and Cognitive chain hash;
- preserve prior human-controlled lifecycle state;
- supersede only untouched `PROPOSED` items whose source case disappeared;
- independently verify provenance, integrity and the no-execution boundary before publication.

## What it cannot do

It cannot approve a proposal, edit production code, execute a transaction, sign, touch wallets, or call a paid model API. Human approval remains mandatory for every mutation.

Lifecycle:

`PROPOSED -> APPROVED -> IN_PROGRESS -> VERIFYING -> RELEASE_READY -> RELEASED`

with `REJECTED` and `SUPERSEDED` alternate terminal states.

v0.1.1 repairs the Learning-state path contract, exact-byte release coherence and post-rebase freshness verification. Execution authority remains `none`.
