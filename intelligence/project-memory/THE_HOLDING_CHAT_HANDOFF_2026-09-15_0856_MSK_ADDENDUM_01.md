# THE HOLDING — URGENT HANDOFF ADDENDUM 01

Timestamp: 2026-09-15, immediately after checkpoint `THE_HOLDING_CHAT_HANDOFF_2026-09-15_0856_MSK.md`.
Branch: `checkpoint/chat-handoff-20260915-0856-msk`
Purpose: replace the checkpoint's remaining hypothesis about PR #828 canary #335 with exact post-checkpoint GitHub Actions evidence.

## Exact Actions log retrieval
The GitHub connector supports decoded job logs through `GitHub.fetch_workflow_job_logs`.
For the failing ve33 canary:
- workflow run: `34929302544`
- run number: `335`
- job: `104253965022`
- PR head: `0f0e854f6a4f3980cda69578e29270cd2202eec5`

## Exact evidence-builder result
`node reporting/ve33-accounting-evidence.mjs` completed before the later diagnostic crash and printed:

- status: `partial`
- checkpoints: `2007`
- events: `96`
- lanes: `290`
- accepted: `0`
- reconciliations: `22`
- settlementQueryFailures: `16`
- historicalPriceResolved: `0`
- historicalPriceUnresolved: `0`
- boundaryFailures: `2`
- currentStateFailures: `0`
- historicalBoundarySkippedLaneReads: `119`
- runtimeMs: **`793918`** (~13m14s)
- executionAuthority: `none`

History compaction in the same build:
- inputCheckpointCount: `2128`
- retainedCheckpointCount: `1717`
- droppedRedundantCheckpointCount: `411`
- retainedMonthBoundaryCount: `1105`
- retainedEventProofCheckpointCount: `189`
- retainedLatestLaneCheckpointCount: `576`

This is independently outside the canary's explicit runtime budget. The workflow assertion is:
`runtimeMs <= 450000` (7.5 minutes).
The assertion itself was never reached because a subsequent diagnostic process crashed first.

Therefore #828 has TWO independent blockers, not one:
1. main evidence builder runtime/correctness: 793918 ms, 16 settlement query failures, 22 reconciliation gaps;
2. unresolved-settlement diagnostic provider failover: selected Base publicnode later returned 403 and the diagnostic crashed instead of trying the next provider.

Do NOT solve this by increasing the timeout. The production-shaped builder itself is too slow and incomplete.

## Exact terminal diagnostic failure
After the evidence builder, the workflow runs:
1. `reporting/ve33-settlement-query-diagnostic.mjs`
2. `reporting/ve33-unresolved-settlement-diagnostic.mjs`
3. only then the inline acceptance assertions.

The terminal crash was:
- URL: `https://base-rpc.publicnode.com`
- HTTP: `403 Forbidden`
- JSON-RPC body: `{"jsonrpc":"2.0","error":{"code":-32602,"message":"Request blocked"},"id":2}`
- ethers shortMessage: `server response 403 Forbidden`

So `providerFor()` startup health is insufficient. Publicnode can pass `getBlockNumber` and some recent/small `getLogs`, then block a historical request. The unresolved diagnostic needs operation-level failover, not just startup selection.

## Settlement-query diagnostic evidence before terminal crash
Aerodrome small-window rebase query:
- `base-rpc.publicnode.com`: `query-ok`
- `mainnet.base.org`: query failed with `eth_getLogs is limited to a 2,000 range`

Aerodrome small-window voting-reward query:
- `base-rpc.publicnode.com`: `query-ok`
- `mainnet.base.org`: same 2,000-range failure

Velodrome small-window queries:
- `gateway.tenderly.co/public/optimism`: query-ok
- `optimism-rpc.publicnode.com`: query-ok
- `mainnet.optimism.io`: query-ok

This proves the Base publicnode failure is operation/history dependent rather than a globally dead endpoint.

## Runtime design clue
Active #828 code still has an OUTER fixed settlement loop with `MAX_LOG_BLOCKS=9500` in both `rewardClaimSettlements()` and `rebaseSettlements()`, while `settlementRouterFor()` performs its own provider-specific range splitting again.

For constrained `mainnet.base.org` (known 2,000-block limit), a 9,500 logical chunk becomes multiple 2,000-block requests. Across long Aug→Sep→current histories, many lanes/groups and a 200ms pacing gate, this can produce a very large request count.

Router cache key is exact:
`settlement-group-${group.index}|fromBlock|toBlock`
so differently shaped lane checkpoint intervals do not share cached work unless the block boundaries are identical.

The physical build retained 1717 checkpoints across 290 lanes. Exact interval fragmentation may therefore be a major source of repeated network scans.

This is a working performance hypothesis, NOT yet the final root cause. The next step is to get actual `settlementRpc` telemetry from the builder:
- queryAttempts
- cacheHits / cacheEntries
- pooledSettlementAddressCount / groupCount
- proactive/adaptive splits
- range limits learned
- rate-limit retries
- failovers
- provider disable count
- provider success/failure counts
- failure samples
- per-protocol runtimeMs

## Required next actions
1. Preserve this evidence; do not merge #828.
2. Obtain actual per-protocol settlement-router telemetry from a production-shaped build. Prefer permanent canary observability or an isolated diagnostic that prints `/tmp/ve33-accounting-evidence.json` diagnostics.
3. Fix `ve33-unresolved-settlement-diagnostic.mjs` to fail over on operation-level provider errors, while preserving range splitting and fail-closed semantics.
4. Use telemetry to prove why the main builder still has 16 settlement query failures and ~794s runtime.
5. If duplicate interval scans are confirmed, optimize generically at protocol/network settlement-window level; do not reduce factual coverage.
6. Re-run exact-head live Base+Optimism canary and require:
   - runtime <= explicit budget or a separately justified measured budget change (do not simply raise it),
   - settlementQueryFailureCount = 0,
   - unresolvedSettlementCount = 0,
   - reconciliationCount = 0,
   - all authority/identity/UNKNOWN laws preserved.
7. Only after exact-head GREEN, sync to latest live main again if main advanced, rerun fresh CI, then merge with expected head SHA.

END ADDENDUM 01.
