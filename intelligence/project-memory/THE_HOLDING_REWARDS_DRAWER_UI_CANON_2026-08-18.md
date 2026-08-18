# THE HOLDING — REWARDS DRAWER UI CANON
## 2026-08-18 · unified strategy/reward-state presentation

## Purpose

This canon preserves the reusable public Company Passport rule established while closing Company #010 Cypher reward presentation. It exists so future companies and newly discovered reward mechanisms enter one coherent Rewards Drawer instead of creating protocol-specific duplicate sections.

This is a presentation contract. Canonical economic truth remains in the relevant backend state (`rewards`, `embeddedIncome`, `sources`, Productivity, company state, realised cash-flow state). The UI must never invent economic values or reclassify one economic lane as another.

---

## 1. One drawer, one ledger

A Company Passport has **one primary Accrued Rewards / strategy-income drawer**.

Do not append separate protocol-specific ledgers such as:
- `CRV · strategy income`;
- `veAERO / veVELO · income`;
- another duplicate strategy block underneath the same native reward rows.

Each economically distinct strategy/reward state should appear as one row in the same ledger.

If the native drawer already contains a strategy because it has a claimable/unclaimed reward row, an addon must **not render the same strategy again** merely to show additional status text.

Canonical dedupe rule:
**native measured row wins; addon rows fill only missing embedded/compounded/pending strategy states.**

---

## 2. Economic state vocabulary

### Unclaimed
Use for a separately claimable reward amount measured inside a protocol but not yet realised/harvested.

Examples:
- Stake DAO claimable CRV;
- Convex staked cvxCRV claimable crvUSD/reward tokens;
- a future ve route with a genuinely separately claimable free/distributor reward.

`Unclaimed` is not principal and not realised cash flow.

### Compounded
Use when yield/reward remains embedded, reinvested, locked or compounded inside the productive position rather than being freely claimable.

Examples:
- Concentrator asdCRV/sdCRV auto-compounding yield;
- managed veAERO locked reward;
- managed veVELO locked reward.

A Compounded amount must not be added to `Accrued Rewards` claimable USD totals unless backend methodology explicitly defines a separate compatible aggregate. It remains economically distinct from freely claimable income.

### Pending / Warming
Use when a route/mechanism is known but exact current measurement is incomplete, unavailable, or still being bound.

Unknown is not zero.
Do not render `$0`, `0 tokens`, `0%`, or an empty success state simply because the mechanism has not yet been measured.

The row should remain visible when that visibility communicates a known expected route, and its state should update automatically when canonical backend evidence becomes available.

---

## 3. Canonical data lanes

The unified drawer should consume backend semantics rather than protocol-name heuristics:

- `rewards` — separately accrued / unclaimed reward rows;
- `embeddedIncome` — compounded/embedded strategy income;
- `sources` — route measurement state, provenance and Pending/Warming status.

Future mechanisms should be admitted by these semantic lanes where possible rather than by creating a new standalone UI section.

The public drawer may combine these lanes visually, but must preserve their economic distinction.

---

## 4. Automatic update contract

The public row is a projection of current canonical backend state.

As collectors/readers observe new blockchain state:
- Pending may become Compounded;
- Pending may become Unclaimed;
- a measured amount may increase/decrease;
- a currently empty claimable route may later acquire an amount;
- a Reference APR/APY may move from Pending to a numeric value.

The UI should update from refreshed canonical JSON without requiring a new strategy-specific visual redesign.

This is the preferred lifecycle:

`known mechanism → backend route/state → unified drawer row → automatic data refresh`

not:

`known mechanism → custom protocol section → manual visual patch every time state changes`.

---

## 5. Rate vs reward-state separation

APR/APY and reward state answer different questions.

- APR/APY = reference productivity/rate metric.
- Unclaimed / Compounded / Pending = current income/reward disposition or measurement state.

Do not use `Pending` APR to imply rewards are absent.
Do not use a positive claimable reward to fabricate a Reference APR.

For productive Balance Sheet positions, rate capsules remain governed by the Passport Responsive UI canon.

If a canonical Reference APR is currently null, show `APR Pending`; when the canonical Productivity row becomes finite, the capsule should automatically show the numeric rate.

---

## 6. Company #010 reference implementation

The Company #010 Cypher drawer establishes the reference behavior:

- Stake DAO claimable CRV — native `Unclaimed` row;
- Convex · staked cvxCRV claimable reward — native `Unclaimed` row;
- Concentrator · sdCRV — one `Compounded` row because yield is embedded/auto-reinvested;
- Aerodrome · veAERO — one row driven by current backend route state; managed route currently maps to `Compounded`;
- Velodrome · veVELO — one row driven by current backend route state; managed route currently maps to `Compounded`;
- Votium / other known unresolved routes — remain Pending/Warming, unknown != zero.

There must not also be a second `CRV · strategy income` section repeating Convex or a separate `veAERO / veVELO · income` subsection.

---

## 7. Presentation hierarchy

Rows should reuse the native Rewards Drawer visual vocabulary:
- protocol/strategy label left;
- small soft status capsule beside the label (`Unclaimed`, `Compounded`, `Pending`);
- chain/mechanism/context in muted metadata;
- amount/value on the right when measured;
- `—` or clear state wording when no amount is currently admissible.

Do not make protocol-specific addon rows visually louder than native claimable rows.

Mobile and desktop should use the same semantic ordering. Responsive geometry may change, but economic state and row identity must not.

---

## 8. Double-counting guards

Never:
- count embedded/compounded income as freely claimable rewards;
- add claimable rewards to principal TVL before settlement/reinvestment methodology says so;
- render one claimable reward twice through both native `rewards` and an addon strategy row;
- convert wrapper decomposition into additional capital;
- use a Rewards Drawer row as evidence of realised cash flow.

The drawer is a state/reporting surface, not an accounting mutation surface.

---

## 9. Future-company rule

When onboarding a new company or strategy, ask in this order:

1. Is there separately claimable current income? → `rewards` / Unclaimed.
2. Is income embedded or automatically compounded? → `embeddedIncome` / Compounded.
3. Is the mechanism known but exact state unresolved? → `sources` / Pending or Warming.
4. Does an existing native row already represent the strategy? → enrich/dedupe; do not duplicate.
5. Is there a truly new economic state that cannot fit these lanes? → only then consider extending the canonical schema/UI vocabulary.

Do not create a new visual section merely because the protocol is new.

---

## 10. Durable design principle

**The Rewards Drawer is a unified state ledger, not a stack of protocol-specific mini-windows.**

New blockchain information should change row state/data, not require the owner to redesign the drawer for every mechanism.
