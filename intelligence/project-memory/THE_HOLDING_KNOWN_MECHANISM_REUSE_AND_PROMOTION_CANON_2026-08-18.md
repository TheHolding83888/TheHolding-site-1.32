# THE HOLDING — KNOWN MECHANISM REUSE & PROMOTION CANON
## 2026-08-18 · capability parity / anti-relearning contract

## Purpose

The Holding is designed to become cheaper, faster and safer with every company onboarded and every mechanism solved. A mechanism that has already been proven in production must become **operating knowledge**, not merely remembered prose.

This canon originally closed a Company #010 Cypher failure in which the system correctly reused veAERO/veVELO blockchain measurement and reward classification but initially failed to reuse the already-proven USD valuation projection used by earlier companies.

Later Company #010 work expanded the same failure family through Project X and HyperLend. The canon therefore now covers three durable classes:

1. **reuse regression / promotion gap** — a known capability is reused only partially;
2. **multi-leg promotion gap** — a resolver proves multiple economic legs but downstream state silently loses one or more of them;
3. **semantic lane collapse** — distinct economic states such as embedded lending interest and external claimable incentives are incorrectly merged into one generic reward concept.

---

## 1. Core law

**Known mechanisms must never trigger research or implementation from zero.**

Preferred sequence:

`fingerprint → find precedent → extract full capability contract → reuse → isolate true unknown → verify parity → promote new delta`

A new company is not a blank project. It is a new composition of already-known and genuinely-new mechanisms.

---

## 2. Reuse means full capability parity, not “some code was reused”

A mechanism is not fully reused merely because its blockchain reader is shared or copied.

For a previously solved mechanism, inspect the entire proven path:

1. **identity / fingerprint** — protocol, chain, route, custody mode, wrapper type, principal semantics;
2. **source read** — contract/API/state source and evidence boundary;
3. **economic scope** — which enumerated objects/positions are actually in-scope capital and which are empty/dust/diagnostic/out-of-scope;
4. **classification** — principal / Unclaimed / Compounded / embedded / realised / Pending;
5. **quantity / all economic legs** — token/share/current amounts and precision;
6. **pricing** — current price source or explicit pricing methodology;
7. **USD valuation** — `priceUsd`, `usdValue`, provenance/method when admissible;
8. **completion/null semantics** — unknown != zero, partial/warming rules;
9. **aggregation boundary** — what totals the value may and may not enter;
10. **public projection** — Passport/Rewards/Performance representation;
11. **automatic refresh** — how current data changes without UI redesign;
12. **history / lifecycle** — whether a time-dependent metric needs canonical observations, reset rules or fingerprint continuity;
13. **verifier contract** — invariants that prevent later regression;
14. **memory/promotion** — reusable mechanism documented so the next company can discover it.

If the old mechanism already proves fields 1–13 and a new implementation preserves only 1–4, that is **partial reuse** and must be treated as a regression unless the difference is explicitly justified by different semantics.

---

## 3. Precedent is evidence, not a blind template

Reuse does not mean assuming every company is identical.

Before adopting a precedent, compare:
- same protocol deployment / chain;
- same token or wrapper semantics;
- direct vs managed custody;
- same claimability/compounding behavior;
- same pricing asset;
- same accounting boundary;
- same public state meaning;
- same economic object scope;
- same rate metric/lifecycle where relevant.

Only the matching capability is reused. Differences are isolated as the **unknown delta**.

This preserves safety while avoiding repetitive research.

---

## 4. Company onboarding parity gate

For every new company, onboarding should produce a **mechanism inventory** before custom resolver work.

For each detected mechanism:

### A. Fingerprint
Identify a stable route/mechanism ID and the relevant deployment/custody semantics.

### B. Search precedents
Search working code, generated production artifacts, Git history and project-memory canons for the same mechanism family.

### C. Build a capability matrix
At minimum compare:
- principal/capital support;
- multi-leg decomposition;
- active/inactive object scoping;
- Productivity APR/APY support;
- Rewards support;
- Compounded/embedded income support;
- external incentives support;
- pricing support;
- public UI support;
- history/lifecycle support;
- verification support.

### D. Reuse first
Bind the company to existing adapters/readers/pricing/UI semantics before writing a new resolver.

### E. Resolve only the delta
New code should target only evidence that the existing capability truly cannot supply.

### F. Parity verification
CI should prove that a known mechanism in the new company has not silently lost fields, legs or guarantees already present in precedent implementations.

### G. Promote the delta
If the new company teaches the system something genuinely new, promote it back into reusable mechanism knowledge and update the relevant verifier/canon.

---

## 5. Minimal machine-readable parity principle

When a known mechanism produces a measured economic amount, canonical state should preserve every already-proven economically meaningful field available under the same evidence boundary.

For a priced token amount this normally includes:
- `amount`;
- `symbol`;
- classification/state;
- `priceUsd` when admissible;
- `usdValue` when admissible;
- `priceMethod` / pricing provenance;
- claimability / compounding semantics;
- whether the USD value is included in any aggregate total.

If price is unavailable:
- `priceUsd = null`;
- `usdValue = null`;
- never fabricate `$0`.

A missing price is a pricing gap, not a zero-value economic state.

---

## 6. Aggregate-boundary rule

Full field parity does **not** mean collapsing economic lanes.

Example:
- a managed veAERO reward may have current token amount and current USD valuation;
- because it is `Compounded`, its USD value is informational valuation of embedded income;
- it must **not** be added to freely claimable `Accrued Rewards` totals merely because a dollar value exists.

Therefore every reuse check must validate both:

**field completeness** and **aggregation correctness**.

More information is not permission to double count.

---

## 7. Company #010 lesson A — veAERO/veVELO valuation reuse regression

### Existing solved precedent
The generic Company Rewards engine already supported managed veAERO/veVELO for earlier companies such as `0x5860...83CA8.eth` and `aerocvxyb.eth`.

Proven path:

`VotingEscrow / LockedManagedReward.earned`
→ `classification = compounded-locked`
→ common Rewards pricing layer
→ `priceUsd`
→ `usdValue`
→ public Compounded presentation.

### Initial Company #010 implementation
Company #010 correctly reused:
- exact veNFT discovery;
- managed/direct custody distinction;
- Compounded classification;
- AERO/VELO token amounts;
- claimable-vs-embedded separation.

But its company-specific overlay initially placed managed rewards into `embeddedIncome` with token amount only and omitted:
- `priceUsd`;
- `usdValue`;
- `priceMethod`.

This was not a new-protocol research gap. It was a **reuse regression / promotion gap**.

### Permanent correction
For matching managed ve mechanisms:
- measured token amount keeps its exact source;
- canonical current token price is reused when admissible;
- embedded rows preserve `priceUsd`, `usdValue`, `priceMethod`;
- public unified Rewards Drawer may render amount + USD valuation;
- embedded USD remains excluded from claimable totals and TVL;
- unknown price remains null, never `$0`.

---

## 8. Company #010 lesson B — Project X multi-leg promotion gap

### Root cause
The Project X deep resolver already measured NFT principal state, but downstream production initially promoted only aggregate WHYPE into generic HYPE. The USDC principal leg and collectible fee legs were not fully promoted.

This demonstrated:

**resolver completeness != promotion completeness.**

### Permanent multi-leg law
If a resolver establishes a mechanism with N in-scope economic principal/reward legs, downstream admission is incomplete unless every leg is either:
- promoted with correct classification, quantity, valuation and aggregation boundary; or
- explicitly preserved as unknown/partial with provenance.

Silent omission is forbidden.

Canonical sequence:

`resolver legs → economic scope → classification → amount → valuation → aggregate boundary → rewards boundary → public projection → refresh → verifier`

For Project X this means:
- WHYPE principal and USDC principal both belong to strategy NAV;
- strategy NAV is counted once;
- Project X WHYPE is removed from generic HYPE;
- collectible WHYPE and USDC fees are separate `Unclaimed` rewards;
- collectible fees are not principal;
- machine state preserves per-NFT decomposition even if public UI aggregates to one strategy row.

This pattern applies to future multi-token vaults, LPs, NFT positions and wrappers.

---

## 9. Economic inventory != enumerable inventory

Project X exposed another reusable failure class.

A contract can enumerate objects that are:
- active capital;
- zero-liquidity;
- dust/pennies;
- different token pairs;
- legacy objects;
- diagnostics only.

Therefore:

**enumerable object inventory is not automatically production economic inventory.**

Production admission needs an explicit economic scope.

For the Company #010 Project X precedent:
- exact target pair required;
- zero-liquidity NFTs are empty and may be excluded;
- bounded dust threshold excludes immaterial objects;
- nonzero-liquidity position with missing principal must fail closed;
- current expected active count is exactly two under current owner-approved strategy scope;
- do not hardcode screenshot IDs as economic truth merely to force the count.

The general principle is more important than the current NFT IDs.

---

## 10. Nonzero economic state with missing measurement must fail closed

A missing measurement is not always safely ignorable.

For an enumerable position:
- `liquidity == 0` can establish an empty position under the mechanism contract;
- `liquidity > 0` with unresolved principal is a potentially material unknown.

The second case must fail closed rather than being silently classified as dust/zero.

Generalized law:

**objective proof of economic emptiness may justify exclusion; failed measurement of potentially active capital may not.**

---

## 11. Rate lifecycle parity — parameter is not yield

Known mechanism reuse must preserve not only numeric rate output but the **meaning and lifecycle of the metric**.

Project X precedent:
- fee tier is not APR;
- one collectible-fee snapshot is not an annualized realised-fee rate;
- a valid observed-fee Reference APR needs elapsed stable time, strategy fingerprint continuity, explicit pricing/NAV methodology and reset rules;
- strategy change or claim/reset returns the metric to Pending rather than splicing incompatible windows.

Therefore when reusing a rate mechanism, compare:
- metric definition;
- source;
- window;
- annualization;
- reset conditions;
- exclusions;
- Pending semantics;
- automatic promotion path.

A copied percentage without these semantics is not rate parity.

---

## 12. Company #010 lesson C — HyperLend / Aave-like lending semantic lanes

HyperLend established a reusable precedent for Aave-compatible lending receipt tokens.

### Base lending interest
An hToken/aToken-style position uses scaled balance plus reserve liquidity index. Interest accrues inside the receipt-token/current supplied balance.

Canonical classification:

**Embedded / Compounded lending interest**

Properties:
- already inside current position/NAV;
- not separately claimable;
- not additive capital;
- may be measured/valued as earned presentation;
- Reference APR is a rate, not current realised/claimable amount.

### External incentives
The receipt token may independently point to a RewardsController.

Canonical classification:
- enumerate reward assets for the actual receipt token;
- measure actual user rewards only for configured reward assets;
- configured/measured external rewards may be `Unclaimed`;
- controller existence alone does not establish an active reward;
- zero configured reward assets means no separate incentive row, not a fabricated zero-value reward.

### Permanent split

`base reserve index growth → Compounded / Embedded`

`RewardsController configured user reward → Unclaimed`

Never collapse these into one generic “HyperLend rewards” lane.

This precedent should be checked first for future Aave-like lending mechanisms before new research is started.

---

## 13. APR does not define earned amount or claimability

HyperLend reinforces a general rule:

A measured `59% APR`-like current rate does not imply:
- 59% has already been earned;
- `principal × APR` is a current reward balance;
- the amount is claimable;
- a separate incentive exists.

The system must separately prove:
- reference rate;
- current embedded earned amount if measurable;
- external claimable incentives;
- aggregation treatment.

These fields can legitimately have different states at the same time.

---

## 14. CI rule: known-mechanism parity

A known-mechanism verifier should fail when a new company-specific path silently drops an already-supported field, leg or semantic guarantee.

For managed ve precedent, CI should verify:
- known Compounded classification;
- pricing/valuation parity;
- `usdValue ≈ amount × priceUsd` when priced;
- embedded exclusion from claimable total;
- correct public projection.

For multi-leg precedent, CI should verify:
- all in-scope principal legs survive;
- all in-scope reward legs survive;
- no leg leaks into a generic row and strategy row simultaneously;
- economic scope excludes proven empty/out-of-scope objects;
- unresolved potentially active objects fail closed.

For Aave-like lending precedent, CI should verify:
- base index interest is Compounded/Embedded;
- embedded interest does not change TVL by addition;
- embedded interest does not enter claimable total;
- incentives controller is queried separately;
- absent configured reward assets do not fabricate an Unclaimed row;
- configured/measured incentive reward is projected separately if it appears.

The purpose is not to hard-code Company #010 forever. It is to make the mechanism family reusable.

---

## 15. Public projection parity

Mechanism reuse is incomplete if backend truth is correct but public presentation becomes weaker or semantically different without justification.

Check:
- canonical label;
- amount/value semantics;
- APR vs APY vocabulary;
- Pending behavior;
- Unclaimed vs Compounded state;
- mobile/desktop layout contracts;
- whether a strategy should be one aggregated row or decomposed rows;
- whether a public total is claimable-only or measured-earned.

UI should project canonical economic state, not create a second economic model.

---

## 16. Refresh/materialization parity

A mechanism is not fully promoted when source code exists but canonical generated state cannot automatically refresh.

Definition of done includes:
- producer trigger after relevant source/state change;
- no writer self-loop;
- safe concurrency/rebase behavior;
- generated state physically reaching `main` when production contract requires it;
- verifier covering the materialization topology.

This lesson was already exposed by Company #010 Rewards post-merge work and remains mandatory for Project X / HyperLend-style overlays.

---

## 17. Definition of done for a newly solved mechanism

A mechanism is not “learned” merely because one company renders it correctly.

Promotion is complete when:
- source/evidence path is reproducible;
- economic scope is explicit;
- all in-scope legs are preserved;
- accounting classification is explicit;
- pricing/valuation behavior is explicit where relevant;
- aggregation boundaries are explicit;
- claimable vs embedded semantics are explicit;
- rate semantics/lifecycle are explicit where relevant;
- public projection is reusable;
- refresh behavior is automatic;
- unknown semantics are fail-closed;
- verifier protects the full contract;
- GitHub-owned memory points future sessions/onboardings to the mechanism;
- the next company can reuse the mechanism without asking the owner to teach it again.

---

## 18. New-company operating rule

Before implementing any strategy/reward/productivity mechanism for Company #011 and beyond:

> **First prove whether The Holding already knows this mechanism or mechanism family. If it does, start from the strongest current production implementation and preserve its full capability contract. Only investigate the delta.**

Particular precedents now include:
- managed veAERO/veVELO → Compounded + price/valuation parity;
- Project X-style multi-leg NFT LP → explicit economic scope + all-leg promotion + separate collectible rewards + observed-rate lifecycle;
- HyperLend/Aave-like receipt token → embedded reserve-index interest + independently enumerated external incentives.

If a new company has an equivalent mechanism but weaker output than an older company, treat that as a regression to explain or fix — not as normal onboarding variance.

---

## 19. Relationship to other memory blocks

Use together with:
- `THE_HOLDING_MEMORY_ROUTING_INDEX_2026-08-18.md` — choose which project memory applies to the task;
- latest `THE_HOLDING_MASTER_CONTINUITY_*.md` — current implementation/resume state;
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md` — known mechanisms must not trigger research from zero;
- Company Onboarding playbook(s) — onboarding process;
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md` — one unified reward-state ledger;
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md` — reusable responsive presentation;
- Build Discipline — reuse/simplification before new parallel machinery.

---

## Compact rule

**Solved mechanism = reusable end-to-end economic capability, not a remembered reader or code snippet.**

Every company should make The Holding smarter. No company should force the owner to rediscover an already-solved mechanism by hand.
