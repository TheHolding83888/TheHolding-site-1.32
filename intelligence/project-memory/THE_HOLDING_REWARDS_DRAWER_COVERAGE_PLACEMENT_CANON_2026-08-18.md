# The Holding · Rewards Drawer Coverage Placement Canon

Date: 2026-08-18
Status: canonical presentation law
Scope: all Company Passports using the shared Rewards Drawer

## Law

Route-level coverage uncertainty is not row-level economic uncertainty.

A reward row that has a measured economic state and amount must present only that row's economics:

`Protocol · state`
`Token · Chain · mechanism`
`quantity`
`USD value when priced`

Examples for known managed ve mechanisms:

- `Aerodrome` · `COMPOUNDED` → `AERO · Base · Rebase`
- `Velodrome` · `COMPOUNDED` → `VELO · Optimism · Rebase`

Do not append route-level phrases such as `+ route not fully closed` / `+ маршрут ещё не закрыт` to a measured reward row.

## Coverage disclosure

If a collector route remains `partial`, incomplete, warming, or otherwise not fully closed, that truth must remain visible at the aggregate layer:

- incomplete measured total may retain `+`;
- the Rewards Drawer footer / aggregate note may state that one or more routes are not fully closed;
- canonical source status and diagnostics remain unchanged.

Presentation cleanup must never convert `partial` to `ok`, fabricate completeness, alter quantities, alter USD valuation, alter claimability, or change TVL.

## Reason

The route may be operationally incomplete while a specific sub-mechanism is already measured exactly. Attaching route uncertainty to the first row visually misstates the epistemic status of that row and creates inconsistent Passport presentation across companies.

## Reuse rule

Known mechanisms reuse the full presentation contract across every company. A newly onboarded company with the same mechanism must inherit the same state vocabulary, mechanism subtitle, quantity/USD presentation, accounting boundary, and coverage-placement rule instead of inventing company-specific copy.

## Current audit

The generic Passport renderer can encounter partial Aerodrome/Velodrome routes in existing companies such as Company #005 and aerocvxyb.eth. Company #010 already uses the clean canonical `AERO/VELO · chain · Rebase` presentation. The global runtime parity guard removes only misplaced row-level route-coverage suffixes while preserving aggregate/footer disclosure.

Authority remains `none`. This canon grants no execution authority and changes no economic methodology.
