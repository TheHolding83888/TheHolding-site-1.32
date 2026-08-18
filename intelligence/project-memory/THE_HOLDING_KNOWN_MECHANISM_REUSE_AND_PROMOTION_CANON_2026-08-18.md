# THE HOLDING — KNOWN MECHANISM REUSE & PROMOTION CANON
## 2026-08-18 · capability parity / anti-relearning contract

## Purpose

The Holding is designed to become cheaper, faster and safer with every company onboarded and every mechanism solved. A mechanism that has already been proven in production must become **operating knowledge**, not merely remembered prose.

This canon defines what “reuse” actually means and closes a concrete failure discovered during Company #010 Cypher: the system correctly reused the veAERO/veVELO blockchain measurement and reward classification, but initially failed to reuse the already-proven USD valuation projection used by earlier companies.

That failure class is named:

**reuse regression / promotion gap**

It means a known production capability was only partially copied into a new company path, so the new implementation exposed less information or weaker guarantees than the already-proven mechanism.

---

## 1. Core law

**Known mechanisms must never trigger research or implementation from zero.**

The preferred sequence is:

`fingerprint → find precedent → extract full capability contract → reuse → isolate true unknown → verify parity → promote new delta`

A new company is not a blank project. It is a new composition of already-known and genuinely-new mechanisms.

---

## 2. Reuse means full capability parity, not “some code was reused”

A mechanism is not fully reused merely because its blockchain reader is shared or copied.

For a previously solved mechanism, inspect the entire proven path:

1. **identity / fingerprint** — protocol, chain, route, custody mode, wrapper type, principal semantics;
2. **source read** — contract/API/state source and evidence boundary;
3. **classification** — principal / Unclaimed / Compounded / embedded / realised / Pending;
4. **quantity** — token/share/current amount and precision;
5. **pricing** — current price source or explicit pricing methodology;
6. **USD valuation** — `priceUsd`, `usdValue`, provenance/method when admissible;
7. **completion/null semantics** — unknown != zero, partial/warming rules;
8. **aggregation boundary** — what totals the value may and may not enter;
9. **public projection** — Passport/Rewards/Performance representation;
10. **automatic refresh** — how current data changes without UI redesign;
11. **verifier contract** — invariants that prevent later regression;
12. **memory/promotion** — reusable mechanism documented so the next company can discover it.

If the old mechanism already proves fields 1–11 and a new implementation preserves only 1–4, that is **partial reuse** and must be treated as a regression unless the difference is explicitly justified by different semantics.

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
- same public state meaning.

Only the matching capability is reused. Differences are isolated as the **unknown delta**.

This preserves safety while avoiding repetitive research.

---

## 4. Company onboarding parity gate

For every new company, onboarding should produce a **mechanism inventory** before custom resolver work.

For each detected mechanism:

### A. Fingerprint
Identify a stable route/mechanism ID.

### B. Search precedents
Search working code, generated production artifacts, Git history and project-memory canons for the same mechanism.

### C. Build a capability matrix
At minimum compare:
- principal/capital support;
- Productivity APR/APY support;
- Rewards support;
- Compounded/embedded income support;
- pricing support;
- public UI support;
- history support;
- verification support.

### D. Reuse first
Bind the company to existing adapters/readers/pricing/UI semantics before writing a new resolver.

### E. Resolve only the delta
New code should target only evidence that the existing capability truly cannot supply.

### F. Parity verification
CI should prove that a known mechanism in the new company has not silently lost fields or guarantees already present in precedent implementations.

### G. Promote the delta
If the new company teaches the system something genuinely new, promote it back into reusable mechanism knowledge and update the relevant verifier/canon.

---

## 5. Minimal machine-readable parity principle

When a known mechanism produces a measured economic amount, the canonical state should preserve every already-proven economically meaningful field that is available under the same evidence boundary.

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
- a managed veAERO reward may have a current token amount and current USD valuation;
- because it is `Compounded`, its USD value is informational valuation of embedded income;
- it must **not** be added to freely claimable `Accrued Rewards` totals merely because a dollar value exists.

Therefore every reuse check must validate both:

**field completeness** and **aggregation correctness**.

More information is not permission to double count.

---

## 7. 2026-08-18 Company #010 failure lesson

### Existing solved precedent
The generic Company Rewards engine already supported managed veAERO/veVELO for earlier companies such as `0x5860...83CA8.eth` and `aerocvxyb.eth`.

The proven path was:

`VotingEscrow / LockedManagedReward.earned`
→ `classification = compounded-locked`
→ common Rewards pricing layer
→ `priceUsd`
→ `usdValue`
→ public Compounded presentation.

### Company #010 initial implementation
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

The public Rewards Drawer consequently showed token quantity plus generic `Embedded income`, while precedent companies displayed token quantity **and** current USD valuation.

### Classification
This is not a new-protocol research gap.
It is a **reuse regression / promotion gap**.

### Permanent correction
For Company #010 managed veAERO/veVELO:
- current token amount remains sourced from the exact Company #010 reader;
- current AERO/VELO price comes from canonical Company #010 current capital state;
- embedded rows carry `priceUsd`, `usdValue`, `priceMethod` when price exists;
- the public unified Rewards Drawer renders token amount + current USD value;
- embedded USD remains excluded from claimable totals;
- unknown price remains null, never `$0`.

---

## 8. CI rule: known-mechanism parity

A known-mechanism verifier should fail when a new company-specific path silently drops an already-supported field or semantic guarantee.

For the managed veAERO/veVELO reference case, CI must verify:

1. generic engine still contains the known `compounded-locked` ve mechanism and common pricing layer;
2. Company #010 overlay emits the same economically relevant valuation fields for measured embedded AERO/VELO;
3. `usdValue ≈ amount × priceUsd` within rounding tolerance;
4. `claimableApplicable === false` for the embedded Compounded row;
5. embedded USD is explicitly excluded from claimable totals;
6. public UI reads `usdValue` and shows it when finite;
7. missing USD is omitted/Pending-like, never rendered as `$0.00`;
8. all existing Company #010 Rewards/Passport contracts remain intact.

The purpose is not to hard-code Company #010 forever. The purpose is to establish a reusable **mechanism parity test pattern** for future companies.

---

## 9. Definition of done for a newly solved mechanism

A mechanism is not “learned” merely because one company renders it correctly.

Promotion is complete when:

- source/evidence path is reproducible;
- accounting classification is explicit;
- pricing/valuation behavior is explicit where relevant;
- aggregation boundaries are explicit;
- public projection is reusable;
- refresh behavior is automatic;
- unknown semantics are fail-closed;
- verifier protects the contract;
- GitHub-owned memory points future sessions/onboardings to the mechanism;
- the next company can reuse the mechanism without asking the owner to teach it again.

---

## 10. New-company operating rule

Before implementing any strategy/reward/productivity mechanism for Company #011 and beyond:

> **First prove whether The Holding already knows this mechanism. If it does, start from the strongest current production implementation and preserve its full capability contract. Only investigate the delta.**

If a new company has an identical mechanism but a weaker output than an older company, treat that as a regression to explain or fix — not as normal onboarding variance.

---

## 11. Relationship to other canons

Use together with:
- `THE_HOLDING_HISTORICAL_OPERATING_KNOWLEDGE_v1_2026-08-14.md` — known mechanisms must not trigger research from zero;
- `THE_HOLDING_COMPANY_ONBOARDING_INTELLIGENCE_PLAYBOOK*` — company onboarding process;
- `THE_HOLDING_REWARDS_DRAWER_UI_CANON_2026-08-18.md` — one unified reward-state ledger;
- `THE_HOLDING_PASSPORT_RESPONSIVE_UI_CANON_2026-08-18.md` — reusable responsive presentation;
- Build Discipline — reuse/simplification before new parallel machinery.

This canon strengthens those rules by defining **full capability parity** as the standard for reuse.

---

## Compact rule

**Solved mechanism = reusable end-to-end capability, not a remembered snippet.**

Every company should make The Holding smarter. No company should force the owner to rediscover an already-solved mechanism by hand.