# THE HOLDING — MARKET DATA / ONCHAIN AUTHORITY CANON
## 2026-08-21

> Durable engineering and semantic contract for The Holding Market Data, onchain pricing authority, CoinGecko fallback and Public Capital propagation.
>
> This canon is not a frozen price snapshot. Current prices, route health, generatedAt values and workflow outcomes must always be fetched from live GitHub `main` and fresh generated artifacts.

---

# 1. ONE CANONICAL PRICE PLANE

The Holding has one canonical selected Market Data plane:

`intelligence/market-data/market-data.json`

Downstream fund/company valuation consumers must reuse this state rather than rediscovering spot prices independently.

Supporting lanes are evidence/fallback inputs, not competing canonical truth:
- `market-data-coingecko.json` — daily CoinGecko source/fallback/sanity lane;
- `onchain-price-shadow.json` — live read-only onchain observation plane;
- `public-capital-state.json` — downstream shared current capital projection.

**One subsystem must not silently rewrite another subsystem's canonical artifact.**

Unified Capital, Productivity recovery, Capital recovery, company balance-sheet builders and browser compatibility shims are consumers of canonical Market Data. They are not alternate Market Data writers.

---

# 2. CANONICAL UNIVERSE

Canonical Market Data universe = exactly 26 explicitly reviewed assets:

BTC, ETH, XAUT, AERO, CVX, CRV, PENDLE, FXN, ICP, YB, FXS, VELO, VVV, LQTY, RSUP, MANA, SAND, OVR, OLAS, VIRTUAL, BEAM, MODE, ELIZA, ONDO, ZK, cvxCRV.

All 26 are requested **onchain-primary** under the current production authority policy.

Physical silver is a separate onchain **reference-only** observation and is not silently promoted into the canonical market registry.

Automatic cohort expansion is forbidden. A new asset/route must be explicitly reviewed and promoted under the normal owner-gated production process.

---

# 3. AUTHORITY SELECTION

Per-asset authority is selected by policy and runtime health.

Conceptual order for an onchain-primary canonical asset:

`eligible onchain observation → bounded CoinGecko failback → unknown`

Required principles:
- finite positive price;
- fresh observation/snapshot;
- exact expected source/route/quote/dependency identity;
- no execution authority;
- route health evaluated by the authority selector;
- static route identity validated separately from dynamic runtime health.

`unknown != zero`.

If no eligible lane exists, publish unknown/partial semantics. Never fabricate zero merely to make the site numerically complete.

---

# 4. DIVERGENCE IS TELEMETRY, NOT AUTOMATIC FAILURE

CoinGecko is refreshed once daily while onchain prices update much more frequently. Therefore normal market movement can create material cross-source divergence.

A fresh structurally valid onchain route must **not** lose authority solely because it differs from an older daily CoinGecko reference.

Allowed bounded telemetry states include:
- direct observation `status = divergent`;
- dependency-aware observation whose only warning is dependency divergence.

When all other health checks pass, the canonical lane remains onchain.

Divergence must remain machine-visible in Shadow/selector telemetry. It is not hidden; it simply does not masquerade as route failure.

Real failures remain failures, including:
- stale onchain snapshot;
- invalid/missing/nonpositive price;
- RPC unavailable/failure;
- wrong route source;
- wrong quote/dependency identity;
- dependency failure beyond cross-source divergence;
- other explicit route-health failure.

---

# 5. DYNAMIC HEALTH BELONGS IN THE SELECTOR

`dependencyStatus`, RPC state and similar runtime conditions are health evidence, not immutable route identity.

The materializer must validate static route identity and then delegate runtime authority/failback decisions to the selector.

This prevents two bad behaviors:
1. healthy divergence causing a workflow crash before selection;
2. a genuine single-route dependency failure crashing the entire Market Data cycle instead of performing bounded per-asset failback.

---

# 6. COINGECKO IS DAILY FALLBACK / SANITY ONLY

Automatic onchain heartbeat schedule:

`7,37 * * * *`

Automatic CoinGecko baseline schedule:

`12 3 * * *`

= 03:12 UTC daily.

The Market Data engine hard-gates external CoinGecko discovery behind:

`MARKET_DATA_DAILY_REFRESH=true`

Normal scheduled Shared Refresh, source-change push refresh and manual Shared Refresh must reuse the latest daily CoinGecko source lane with **zero external CoinGecko price requests**.

The dedicated daily path may perform the single canonical batch request for all 26 assets.

This is the automatic architecture. A privileged operator manually dispatching the dedicated daily workflow is an explicit control-plane action and is not evidence that the normal 30-minute heartbeat performs CoinGecko discovery.

---

# 7. BOUNDED FALLBACK FRESHNESS

A positive CoinGecko number is not automatically a usable fallback.

Current failback maximum age:

**30 hours**.

Boundary semantics:
- source age <= 30h → eligible as bounded emergency failback if the onchain route is genuinely ineligible;
- source age > 30h → CoinGecko lane ineligible;
- if onchain is also ineligible → `unknown` / fail-closed.

The system must never publish an indefinitely stale CoinGecko value merely because it is finite and positive.

No extra external request is triggered to rescue an expired fallback outside the dedicated daily lane.

---

# 8. TRUTHFUL CANONICAL PROVENANCE

Canonical `market-data.json` describes the selected production authority plane, not the historical object from which data structures were seeded.

Top-level canonical provenance must therefore identify:
- provider/authority = `per-asset-authority`;
- canonical observation timestamp = current selected/onchain Shadow cycle;
- external CoinGecko requests in a normal materialization = 0.

CoinGecko provenance is still preserved, but under `sourceState` as the fallback/sanity source lane.

Do not reintroduce the old pattern where a 26/26 onchain canonical snapshot says at top level that its provider is CoinGecko or exposes stale CoinGecko requestedAt/observedAt as though those were current canonical observation times.

**Provenance is part of correctness.**

---

# 9. ROUTE QUALITY / NO SPOT AUTHORITY

The onchain observation layer uses exact-source read-only mechanisms such as:
- Chainlink v3 direct USD feeds;
- relative Chainlink composition;
- block-pinned Uniswap V3 `observe()` TWAP;
- Velodrome V2 protocol observation TWAP;
- Curve `price_oracle()` EMA;
- historical Uniswap V2 cumulative-price TWAP;
- TWAP × independently validated Chainlink quote composition.

Safety rules:
- no raw DEX spot/slot0 authority;
- no hardcoded stablecoin peg when an independent quote feed is required;
- public/no-key RPC architecture;
- retryable JSON-RPC endpoint failures trigger failover;
- contract-specific failures remain route-local;
- multi-phase reads should remain block coherent;
- relative routes reuse same-cycle quote observations where designed.

An `OLD` historical-observation error is evidence that a requested TWAP history is unavailable. It is not permission to silently switch to spot pricing.

---

# 10. PUBLIC CAPITAL / CONSUMER COHERENCE

`public-capital-state.json` must be rebuilt from the current canonical Market Data snapshot and canonical upstream protocol/company state.

Where `sourceState.marketDataGeneratedAt` exists, it should bind to the actual canonical Market Data generation used for the projection.

Public semantics:
- Combined TVL = all registered companies in the registry universe;
- General Index Network Value = General Index constituents only;
- Monetra/Stable Capital remains its separate universe;
- Stable/wrapper/protocol NAV remains upstream when direct market repricing is not the canonical economic method.

Current pricing and historical Reporting must not be conflated.

---

# 11. ICP CROSS-COMPANY PARITY

ICP is a canonical onchain-primary asset using the reviewed Chainlink v3 route on BNB Smart Chain.

Durable company quantities:
- Company #005 = 1363 ICP;
- Company #006 = 1296 ICP.

Both must consume exactly the same current canonical ICP price.

A downstream writer that gives the two companies different ICP price observations or reverts either one to stale CoinGecko provenance is a production regression.

---

# 12. BROWSER AUTHORITY BOUNDARY

Browser-facing public pages do not own external price discovery.

The shared client loads local canonical Market Data/Public Capital and locally intercepts legacy CoinGecko/simple-price compatibility requests.

Contract:
- browser external CoinGecko price requests = disabled;
- no public CoinGecko credential;
- legacy compatibility semantics resolve from local canonical snapshot;
- source/runtime pages may contain compatibility strings, but they must not become a second live external price authority.

---

# 13. ONE WRITER — RECOVERY PATHS INCLUDED

A production architecture is not complete if only the normal path obeys it.

The following failure class is explicitly forbidden:
- a downstream/recovery workflow reruns legacy price discovery and overwrites canonical Market Data.

Current contract:
- Shared Market Data workflow owns canonical price materialization;
- Unified Capital consumes it;
- Productivity recovery consumes it;
- Capital recovery consumes it;
- General Company Balance Sheet consumes it;
- compatibility shims consume it.

Recovery workflows should fail closed when the required canonical Market Data contract is absent or unhealthy rather than quietly becoming alternate writers.

---

# 14. HIGH-FREQUENCY GIT NOISE BOUNDARY

The 30-minute heartbeat is generated state and may commit frequently.

Snapshot-only pushes for these files are intentionally ignored by Project Memory and Security push triggers:
- `market-data-coingecko.json`
- `market-data.json`
- `onchain-price-shadow.json`
- `public-capital-state.json`

This prevents up to ~48 redundant control-plane wakeups/day.

Do not confuse this with blind spots:
- engine code changes remain checked;
- workflow changes remain checked;
- policy changes remain checked;
- source/route registry changes remain checked;
- Project Memory retains an hourly backstop;
- Security retains its own backstop.

Do not “fix” generated-state quietness by reintroducing high-frequency Memory/Security churn.

---

# 15. PRODUCTION ACCEPTANCE STANDARD

A green PR or workflow is necessary but not sufficient when the feature is defined by generated production state.

Market Data acceptance requires **physical materialization** in live `main`.

For a full healthy canonical heartbeat, verify at minimum:
- canonical asset count = 26;
- `perAssetAuthoritySelectionApplied = true`;
- onchainSelectedAssetCount = 26;
- coingeckoSelectedAssetCount = 0;
- fallbackCount = 0;
- unknownCount = 0;
- each row requestedPrimary = onchain;
- each row selectedLane = onchain;
- each row fallbackUsed = false;
- finite positive USD;
- source begins with onchain provenance;
- Public Capital binds to the same snapshot;
- no later writer rolls it back.

A cross-source divergence warning may remain acceptable when it is telemetry-only and all real onchain health checks pass.

**GREEN workflow != physically materialized production artifact.**

---

# 16. 2026-08-21 PRODUCTION-GREEN CHECKPOINT

The final targeted production close was physically proven after PR #233.

Post-#233 canonical snapshot:
- version `1.2-market-data-truthful-canonical-provenance`;
- status `ok`;
- provider `per-asset-authority`;
- 26 requested / 26 fresh;
- stale fallback 0;
- unknown 0;
- canonical observation bound to the live Shadow cycle;
- CoinGecko external request count for that normal materialization = 0.

Previous independent post-#232 heartbeats had already proven stable 26/26 selected onchain authority. PR #233 closed only the remaining top-level provenance leak, then the post-merge heartbeat physically verified it.

Target status at this checkpoint:

**Market Data / onchain authority = PRODUCTION GREEN ✅**

This statement is scoped. It does not imply every unrelated The Holding subsystem is free of future defects or that current Security WATCH items disappeared.

---

# 17. THE PARANOID-AUDIT LESSON

The final deep audit found several issues *after* earlier apparent green states:
- second writer in Unified Capital;
- residual recovery price/writer paths;
- false fallback from daily cross-source divergence;
- materializer/selector runtime-health mismatch;
- unbounded stale fallback edge case;
- misleading canonical provenance metadata.

Therefore the reusable method is:

`CI → physical artifact → downstream propagation → competing writer audit → fallback/recovery audit → provenance audit → repeated independent heartbeat`

Use this pattern for future critical production closes where hidden authority/writer interactions are plausible.

---

# 18. AUTHORITY / GOVERNANCE

This Market Data architecture is read-only economic observation and valuation support.

It does not grant:
- wallet signing;
- transaction execution;
- capital movement;
- automated claiming;
- automated allocation;
- automatic route/policy expansion;
- automatic production merge.

`executionAuthority = none` remains canonical.

The model can change. **The memory must remain The Holding's.**
