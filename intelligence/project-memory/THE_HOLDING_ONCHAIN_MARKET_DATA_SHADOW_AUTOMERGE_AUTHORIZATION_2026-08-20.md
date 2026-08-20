# THE HOLDING — TEMPORARY ONCHAIN MARKET DATA SHADOW AUTOMERGE AUTHORIZATION
## 2026-08-20

Owner directive: during the current bounded campaign to complete onchain tracking for the remaining canonical Market Data assets, the assistant may merge qualifying onchain Market Data shadow PRs without asking for a fresh per-PR merge command each time.

## Scope

This temporary authorization applies only to PRs whose primary purpose is completing or hardening read-only onchain Market Data shadow tracking for the current canonical asset universe, including reusable price-source adapters, source registry routes, deterministic validation, CI guards, RPC failover/hardening, and replacing a failed/stale shadow route with a better read-only onchain source.

The priority order currently requested by the owner is:
1. YB
2. FXN
3. LQTY
4. RSUP
5. cvxCRV
6. VIRTUAL
7. ONDO
8. ZK
9. OLAS
10. OVR
11. BEAM
12. ELIZA
13. MODE replacement/closure if still not production-green

Mechanism-compatible assets may be grouped into cohorts when that produces a cleaner reusable adapter without changing the owner priority intent.

## Mandatory guardrails before every authorized merge

A PR may be merged under this temporary authorization only when all of the following remain true:

- `mode = shadow` / equivalent shadow-only semantics;
- `productionPriceAuthority = false`;
- no Public Capital or public UI valuation authority change;
- CoinGecko/current canonical production price path remains unchanged except for explicit shadow comparison/fallback semantics already in force;
- no paid RPC/data-service dependency is introduced;
- no API key/secret requirement is introduced;
- no signing, transaction submission, wallet authority, capital movement, methodology mutation, security-policy mutation, or broader execution authority is introduced;
- change is bounded to onchain Market Data tracking/hardening and directly necessary validation/memory updates;
- exact-source addresses/routes are proven; unknown values are never guessed or converted to zero;
- all GitHub checks assigned to the exact PR head are GREEN;
- fresh `main` / exact-head / mergeability / behind-ahead / changed-file scope is rechecked immediately before merge;
- after merge, generated writer output is physically verified in `main` and the new route is not considered closed until its live shadow observation is acceptable under the route's own quality rules.

## Stop-and-ask conditions

The assistant must stop and ask the owner for fresh explicit authorization if a proposed change would:

- promote any onchain route to production price authority;
- change public valuation/accounting methodology or UI behavior;
- introduce a paid vendor, credential, new privileged secret, or material recurring infrastructure cost;
- expand authority beyond read-only observation;
- touch unrelated project subsystems beyond what is necessary to validate the Market Data change;
- weaken existing security/CI/epistemic guards;
- require a materially risky architectural decision rather than a bounded reusable adapter/hardening step.

## Termination

This is a temporary task-scoped exception to the normal rule that every PR needs a fresh explicit merge command. It expires when the current canonical onchain Market Data completion campaign is closed, or immediately when the owner revokes/changes it.

After expiration, the normal per-PR merge authorization rule resumes automatically.

General The Holding authority remains `executionAuthority = none`.
