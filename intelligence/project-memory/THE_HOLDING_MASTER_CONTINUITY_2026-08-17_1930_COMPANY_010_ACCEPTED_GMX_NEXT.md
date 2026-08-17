# THE HOLDING — MASTER CONTINUITY
## 2026-08-17 19:30 (+03) · COMPANY #010 ACCEPTED · GMX NEXT

## Company #010 acceptance

Owner visually inspected the live Company #010 Cypher public page after PR #124 and explicitly said: `посмотрел - все ок`.

Company #010 current accepted baseline:
- capital status: `complete-total-capital`
- `totalCapitalComplete = true`
- `knownButUnboundCapitalMayExist = false`
- Fluid remains owner-policy out of scope
- Performance remains Pending, never observed 0%
- executionAuthority remains `none`

Final public-surface PRs:
- #122 Performance Pending semantics — merge `f5cb8b86095955f11adc5862990b79e0106b27f9`
- #123 public writer complete-boundary fix — merge `47c350381b74b673b9c5cf768dacd937cb2a2659`
- #124 owner acceptance polish — merge `74c46ada632427dcb8fb9ba5369a44c7d682342f`

PR #124 accepted UI canon:
- Stake DAO public Balance Sheet row: `Stake DAO · 4pool stables` + total USD; full USDC / USDbC / axlUSDC / crvUSD decomposition stays in canonical state only.
- GMX ETH-USDC and BTC-USDC are visually combined into one Passport window with combined USD; backend positions remain separate.
- top Combined TVL and Index Network Value use the same canonical Capital State `networkTvlUsd`.
- General Index uses ten distinct dark-to-light green shades.

## Productivity coverage at acceptance

Cypher productive capital ≈ $2,293.01; APR-covered ≈ $1,838.59; coverage ≈ 80.18%.
Only current Reference APR gaps:
- Project X HYPE ≈ $182.60
- Concentrator sdCRV ≈ $271.82
Unknown APR remains excluded, never treated as 0%.

## New primary objective — GMX strategy deep review

Work strategy-by-strategy; GMX first, do not jump ahead.

Targets:
- `GMX · ETH-USDC`
- `GMX · BTC-USDC`

Required review:
1. Prove exact GMX V2 market-token economics and dynamic long/stable pool composition.
2. Verify whether GMX underlying ETH/BTC is currently double-counted in Company #010 aggregate reserve BTC/ETH. If yes, remove; if no, prove current standalone-strategy accounting.
3. Treat GM market tokens as standalone productive strategy positions, not direct reserve BTC/ETH custody.
4. Track full GM-token current USD value via official GMX Reader, not a stable-only component.
5. Determine exact yield sources and official Reference APY/APR semantics.
6. Determine income mode: embedded in GM NAV, separately claimable, or mixed.
7. Map correctly into Passport Balance Sheet, Productivity and Rewards/Embedded Yield with no double count.
8. Make the resulting adapter reusable for future company onboarding.

Current pre-review Company #010 GMX state:
- `gmx-gm-eth-usdc` ~ $87.63, recent Reference APR ~10.758412%
- `gmx-gm-btc-usdc` ~ $107.58, recent Reference APR ~5.139956%
- both valued by official GMX Reader market-token valuation
- both are separate `productiveDividend` positions

Current aggregate Company #010 BTC row is sourced from reviewed/Aave WBTC and ETH row from reviewed/Aave wstETH-equivalent. Existing state language says these were independently reconciled without duplication, but the GMX review must verify the code/collector rather than rely on prose.

Operating invariants:
- unknown != zero
- wrapper/LP/underlying decomposition is not additive capital
- market-token receipt value is one economic position; underlying pool composition is exposure/decomposition only
- Reference APR != realised cash flow
- embedded NAV growth != separately claimable rewards
- no production merge without new explicit owner authorization
