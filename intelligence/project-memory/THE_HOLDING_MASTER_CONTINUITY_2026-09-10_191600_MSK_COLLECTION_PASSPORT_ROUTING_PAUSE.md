# THE HOLDING — MASTER CONTINUITY CHECKPOINT

**Timestamp:** 2026-09-10 19:16 MSK (16:16 UTC)  
**Type:** manual chat handoff / pause checkpoint  
**Repository:** `TheHolding83888/TheHolding-site-1.32`  
**Working branch:** `fix/collection-company-passport-routing-20260910`  
**Branch head before this checkpoint commit:** `25cb812ba46a88d9c500938f90683873404fe4b9`  
**Branch base / current main observed immediately before branch work:** `a2497473c557532323bd86f3cea5f9a2cebd25f9`  
**Execution authority:** none. This work is public-site navigation / UX only. No capital execution authority is introduced or changed.

---

## 0. Why this checkpoint exists

The current chat is being intentionally paused because the working context became very long and the assistant started slowing down. The owner explicitly requested a **very detailed checkpoint in the working branch** and will continue in a **new chat**.

This document is therefore a branch-local handoff. It is deliberately detailed enough that the next chat can recover not only *what changed*, but also *why*, *what is already proven*, *what remains unproven*, and *what must not be accidentally changed while finishing this atom*.

**Important recovery rule for the next chat:** this checkpoint is not a substitute for live truth. On resume, first restore current truth using the normal The Holding protocol:

1. Read live `intelligence/project-memory/CURRENT.md` from `main`.
2. Follow its latest continuity pointer.
3. Read the Memory Router / relevant accepted artifacts.
4. Inspect fresh `main`, active branches, PRs and Actions.
5. Then inspect this branch and this checkpoint.
6. Compare the branch to the then-current `main` before editing or merging.

Do not assume the SHAs in this file are still current when the new chat begins.

---

# 1. Immediate project state at pause

## 1.1 Current branch

The active branch is:

`fix/collection-company-passport-routing-20260910`

Before writing this checkpoint, its code head was:

`25cb812ba46a88d9c500938f90683873404fe4b9`

Commit message:

`feat: route Collection cards into Company Passports`

That commit was based directly on:

`a2497473c557532323bd86f3cea5f9a2cebd25f9`

At the moment of the compare, the branch was **ahead of main by 1 commit and behind by 0**. The only code file changed at that moment was:

`companies/public-site-polish-projection.mjs`

with approximately **+30 logical source lines / no deletions** in the compact projector source because the injected browser bridge itself is encoded as a template string.

No PR for this branch had been created in this chat before the pause.

---

# 2. What was completed immediately before this branch

This is important because the next chat must not redo already accepted atoms.

## 2.1 Homepage footer wording — CLOSED

The homepage footer was already changed from the older wording:

`Funds · Index · Onchain Companies · Real Estate`

to:

`Capital Architecture · Onchain Companies · Real Estate`

The physical `index.html` on the fresh production/main snapshot was checked, not just the projector.

Therefore this item is **done** and should not be reopened unless the owner explicitly requests another wording change.

## 2.2 Mobile hamburger / short-viewport overflow — CLOSED

PR **#738** was merged.

The fix is systemic, not a one-off pixel nudge. It makes the expanded mobile navigation a viewport-safe scroll container. The canonical public-site projector now injects the marker:

`/* The Holding · viewport-safe mobile navigation */`

and the mobile menu contains, among other things:

- `justify-content: flex-start`
- `overflow-y: auto`
- `overscroll-behavior-y: contain`
- `-webkit-overflow-scrolling: touch`
- safe-area aware top/bottom padding
- 44px minimum link target height
- a compact short-viewport profile for `max-height: 700px`
- fixed close control with safe-area offsets

This was then propagated through **The Holding Capital · Unified Refresh #158**, whose admission and refresh jobs completed **successfully**, including:

- validate unified orchestrator and existing engines
- VoteMarket overlay deterministic safety proof
- canonical per-asset Market Data requirement
- coherent capital surface refresh
- public capital projection rebuild
- final coherent snapshot validation
- safe publication

The orchestrator published coherent production snapshot commit:

`e952cdc206df94ed3e1b100f6844a5aefe57d290`

Then intelligence refresh commits advanced `main`, ending at the observed base:

`a2497473c557532323bd86f3cea5f9a2cebd25f9`

The physical homepage file was fetched after materialization and the viewport-safe marker plus `overflow-y: auto` were confirmed in `index.html`.

**Conclusion:** hamburger work is fully closed. Do not touch it while finishing Collection → Passport routing unless a fresh regression is observed.

---

# 3. Current atom: Collection → Company Passport

## 3.1 Product intent

The Collection already tells the reader:

> “Browse the network, compare operating capital and productivity, then open a Company Passport for the detail behind each company.”

However the Collection cards historically behaved inconsistently:

- some whole cards opened standalone company pages;
- some opened DeBank;
- some cards had no navigation;
- the detailed Company Passports already existed elsewhere inside the same `/companies/` product surface, mainly under the General Index and Stable Index.

The desired UX atom is therefore:

**Click/tap the body of a company card in Collection → open that company’s existing Company Passport inside the existing Registry Observatory.**

This must **reuse** the already-built Passport components and surface switcher. It must not create a second Passport implementation, a second data model, or a duplicate router.

External actions such as **Explore Company** and **View on DeBank** must remain separate affordances and must keep opening their intended external/standalone destination.

---

# 4. Existing architecture that must be reused

The next chat should preserve the architecture discovered in the live `companies/index.html`.

## 4.1 Registry Observatory already has three surface modes

The `/companies/` page already has one shared mode switcher with:

- `collection`
- `index`
- `stable`

Buttons use `data-capital-mode-btn` and panels use `data-capital-panel`.

The main surface controller already owns the transition logic, hidden state, tab state, session storage and URL hash for the standard three modes.

The branch change exposes this existing selector as:

`window.thSelectCapitalMode = selectMode`

so the Collection bridge can ask the canonical controller to switch modes instead of duplicating its behavior.

## 4.2 General Company Passports already exist

General Passports are dynamically built inside:

`#idxBoard`

Each company creates:

`.ib-item[data-nm="..."]`

with a clickable `.ib-row` and expandable `.ib-passport`.

The existing Passport code already handles:

- open / close state
- `aria-expanded`
- live economic metrics
- balance sheet / rewards data where applicable
- protocol disclosures
- reward overlays
- Company Passport close button
- scroll behavior
- sessionStorage preservation of open Passports
- reload restoration

This work must continue to use that mechanism.

## 4.3 Stable Passport already exists separately

Monetra (Registry 008) has its existing Stable Company Passport:

`#stablePassportMonetra`

with the canonical controller:

`window.stablePassportSet(open, scroll)`

The branch bridge intentionally routes Registry 008 to the `stable` Observatory surface and calls this existing controller.

Do not try to force Monetra into the General Passport family.

---

# 5. Exact code change currently in the branch

All implementation changes currently live in:

`companies/public-site-polish-projection.mjs`

The projector was extended from homepage + Yield Reports projection to also read/write:

`companies/index.html`

through:

`const COMPANIES='companies/index.html';`

The branch code does **not** directly hand-edit the generated public file. The intended durable source remains the canonical public-site projector so future production materialization can reproduce the behavior.

## 5.1 First-paint deep-link routing

The existing early bootstrap originally recognized only:

- `#collection`
- `#index`
- `#stable-index`

The branch modifies it to recognize:

`#passport-XXX`

where `XXX` is a three-digit Registry ID.

First-paint routing logic:

- Registry `008` → `stable`
- every other `#passport-XXX` → `index`

This matters because deep links/reloads should paint the correct Observatory panel immediately rather than flashing Collection first.

## 5.2 Canonical Observatory selector exposure

The existing internal `selectMode()` function is exposed as:

`window.thSelectCapitalMode = selectMode;`

This is a narrow bridge only. The new code does not reimplement the existing surface state machine.

## 5.3 Injected Collection Passport routing addon

The projector injects an isolated addon marked with:

`data-th-collection-passport-routing`

and a small companion style marker:

`data-th-collection-passport-routing-style`

The addon currently contains a Registry → canonical company-name map:

- `001` → `05081966.eth`
- `002` → `YieldRing.eth`
- `003` → `dinaz.eth`
- `004` → `defitea.eth`
- `005` → `0x5860...83CA8.eth`
- `006` → `aerocvxyb.eth`
- `007` → `Rook's portfolio`
- `008` → `Monetra.eth`
- `009` → `1milliondollar.eth`
- `010` → `Cypher`

The mapping uses canonical internal names because the General Index joins on `data-nm` / canonical company identity. Display names remain presentation-only.

## 5.4 Card identification

At boot, the addon scans:

`#companiesGrid .company-card:not(.placeholder)`

It derives the Registry number from `.cc-regnum`, supporting both English `Registry` and Russian `Реестр` text.

Recognized cards receive:

- `.th-passport-entry`
- `data-th-passport-registry`
- `data-th-passport-company`
- an accessibility label
- for non-anchor cards only: `role="button"` and `tabindex="0"`

Linked `<a>` cards retain their native anchor semantics so their nested external affordances are not destroyed.

## 5.5 Collection card body behavior

A delegated click handler watches Collection cards.

If the click is on the body of a mapped company card:

1. prevent the card’s old whole-card navigation;
2. switch to the correct existing Observatory surface;
3. locate/open the existing Company Passport;
4. write a Registry-specific URL hash.

Target hash form:

`#passport-001` … `#passport-010`

For General companies, the code waits briefly for dynamic Index rendering, finds the matching:

`.ib-item[data-nm="canonical-name"]`

then uses the existing `.ib-row` click behavior to open the Passport rather than setting all internal Passport state manually.

For Monetra, it switches to Stable Index and calls `window.stablePassportSet(true, true)`.

## 5.6 External affordances deliberately stay external

The bridge has an `isExternalAffordance()` guard.

If the click originates within a non-static `.cc-extlink`, the bridge returns without intercepting the card.

Therefore the intended split is:

- **card body** → Company Passport
- **Explore Company / View on DeBank** → original destination
- **static “DeBank · Tracking” footer** is not treated as an external clickable affordance

This is particularly important for cards that are themselves `<a>` elements and for Monetra’s dual footer affordance.

## 5.7 Keyboard behavior

Non-anchor Collection cards receive keyboard activation for:

- Enter
- Space

Anchor cards keep native focus/keyboard semantics; the document click handler performs routing for non-footer activation.

## 5.8 URL / history intent

The branch currently writes a Passport-specific history entry using:

`history.pushState({thPassportRegistry:reg},'', '#passport-XXX')`

with an effort to preserve `#collection` as the previous state when opening from Collection.

On deep-link boot or hash-driven restore, the bridge can open a Passport without creating another history entry.

This is intended to make:

- direct links deterministic;
- reload restore deterministic;
- browser Back return to Collection;
- Forward reopen the Passport.

However **Back/Forward has not yet been browser-proven**. See open issues below.

---

# 6. Important known incomplete / unproven points

This is the most important section for the new chat. Do not merge the branch yet simply because the projector contains a routing bridge.

## 6.1 Known URL-sync bug: closing General Passport via row/chevron

The bridge currently synchronizes the Passport hash back to `#index` when the **bottom Passport close button** (`.ipx-passport-close`) closes the General Passport.

But the General Passport can also be closed by clicking its **row / chevron** because the existing `.ib-row` is the native toggle.

At pause time, that path is **not yet synchronized by the bridge**.

Possible failure state:

- URL remains `#passport-004`
- Passport has been collapsed by row/chevron

That mismatch must be fixed before merge.

Preferred solution: integrate hash synchronization with the existing canonical General Passport open/close state, or add a narrowly scoped delegated observer/handler that does not duplicate Passport state logic. Do not hack individual companies.

## 6.2 Back / Forward is intended but not yet proven

The projector’s current final assertion logs:

`collectionPassportBackForward:true`

but that is only a projector contract flag, **not proof of real browser behavior**.

The addon listens to `hashchange`, but it does not yet explicitly bind `popstate`.

Because Passport history uses `history.pushState`, the next chat must browser-test Back/Forward carefully and decide whether an explicit `popstate` handler is needed for deterministic same-document traversal.

Do not call Back/Forward “done” until tested in a real browser/runtime.

## 6.3 Projector has not yet been materialized/tested on this branch

At pause time, only the canonical projector source was committed.

The branch has **not yet** gone through the full PR/CI/materialization cycle for this atom.

Therefore the following remain required:

- execute/validate the projector against a fresh checkout or through the repo’s accepted workflow path;
- inspect the resulting `companies/index.html` markers;
- confirm no unrelated generated drift;
- run repository checks / PR checks;
- inspect diff and Actions;
- browser-test desktop + mobile behavior;
- only then merge.

## 6.4 No duplicate-opens / render-race proof yet

General Passports are dynamically rendered after live data loads. The bridge uses a retry window:

- retry interval: 80 ms
- retry window: 6000 ms

This is intentionally bounded and avoids inventing another data lifecycle.

Still, it must be tested under:

- cold load
- cached load
- slow data load
- direct `#passport-XXX` load
- language EN / RU
- mobile / desktop

Confirm the bridge opens exactly one intended Passport and does not fight `restoreOpenPassports()` / reload restoration.

## 6.5 Existing multiple-open session state needs attention

The pre-existing General Passport system can remember multiple open `.ib-item.open` entries in sessionStorage.

The new bridge currently closes other open General Passport rows before opening the target Passport.

That behavior is sensible for card-to-Passport navigation, but verify that:

- remembered open-state is updated coherently;
- browser Back to Collection does not leave hidden/open stale Passport state that produces a surprise on later General Index entry;
- direct deep-link does not reopen multiple historical Passports after async restoration.

## 6.6 Registry 010 / Cypher Collection presence is not yet validated

The canonical data / structured ItemList and index protocol map include Registry 010 `Cypher`.

The inspected Collection markup visibly contained cards 001 through 009 plus the “Next Company” placeholder; no `company-card-010` marker was found during this pass.

The bridge map includes `010 → Cypher` so a future/current card can route without changing the map, and a direct Passport hash can theoretically target its General Index record.

But the next chat should **not infer that Cypher is currently visible as a Collection card** without a fresh inspection. This is a separate content/state fact, not a reason to alter routing blindly.

## 6.7 Accessibility copy is EN-only in the injected aria-label

The injected card `aria-label` currently begins:

`Open Company Passport · ...`

This does not yet switch to Russian when the UI language is RU.

This is a small polish/accessibility item. Decide whether it should be fixed in this atom before merge. If touched, keep it minimal and do not entangle it with the larger queued editorial rewrite.

---

# 7. What must NOT be changed while closing this atom

The following boundaries are intentional.

## 7.1 Do not redesign Company Passports

The Passports already contain substantial accepted mechanics:

- Company TVL / Performance / Operating History
- Registry / Founded / Index Weight / TVL Weight
- Architecture / Protocols / APR
- live balance sheets and rewards where available
- Composite decomposition
- Stable Strategy Book / Monetra accounting
- reward disclosure behavior
- mobile overlays
- close behavior / reload behavior

This branch is navigation glue only.

## 7.2 Do not combine Stable and General universes

Registry 008 must remain on the Stable Index / Stable Company Passport path.

Do not insert Monetra into the General Composite merely to simplify routing.

## 7.3 Do not change capital calculations or data authority

No changes are intended to:

- Market Data
- Public Capital
- network contribution
- accounting
- productivity formulas
- rewards formulas
- Defitea own-capital boundary
- Company TVLs
- Index math
- execution authority

If any generated diff changes those areas, treat it as drift and stop.

## 7.4 Do not reopen homepage hamburger/footer atoms

They are already accepted and physically materialized.

## 7.5 Do not mix this atom with the larger Companies-page editorial rewrite

A separate queued scope still exists for:

- Companies landing-page narrative review
- right-side informational / Index Framework drawer copy review
- Russian translation parity / more natural premium Russian

Those are broader editorial tasks and were not implemented by the earlier public-site polish projector.

Collection → Passport routing should be finished and validated as its own atomic UX change before mixing in that copy work.

---

# 8. Recommended exact resume sequence in the new chat

The next chat should proceed in this order.

## Phase A — restore live truth, read-only

1. Fetch live `main` branch head.
2. Fetch `intelligence/project-memory/CURRENT.md` from `main`.
3. Fetch the latest continuity it points to.
4. Read Router / relevant accepted public-site state.
5. List active relevant branches / PRs / Actions.
6. Fetch this branch head.
7. Fetch this checkpoint.
8. Compare this branch against fresh `main`.

If `main` advanced materially since `a2497473...`, rebase/recreate carefully before new edits; do not assume conflict-free state.

## Phase B — inspect current branch code

1. Fetch full `companies/public-site-polish-projection.mjs` from this branch.
2. Confirm the branch still contains:
   - `const COMPANIES='companies/index.html'`
   - Passport first-paint hash recognition
   - `window.thSelectCapitalMode = selectMode`
   - `data-th-collection-passport-routing`
   - Registry map 001–010
   - external-affordance guard
   - history hash logic
3. Inspect whether any automated/background commit changed the branch after this checkpoint.

## Phase C — fix the known state/hash gaps before PR

Minimum required:

1. Synchronize General Passport row/chevron close with URL state.
2. Explicitly verify and, if necessary, harden `popstate` for browser Back/Forward.
3. Decide/fix RU accessibility label if staying within this atom.
4. Make sure these fixes remain generic, not company-specific.

## Phase D — validate locally / deterministically

Run the accepted projector validation path and confirm:

- projector is idempotent;
- `companies/index.html` gets exactly one routing addon;
- no duplicate markers on second run;
- first-paint bootstrap recognizes Passport hashes;
- existing homepage polish remains present;
- existing Defitea Yield Reports mobile fix remains present;
- no unrelated content/capital changes occur.

## Phase E — browser/runtime test matrix

At minimum test:

### Desktop
- Collection 001 card body → correct General Passport
- Collection 004 Defitea → correct General Passport
- Collection 007 non-anchor card → correct Passport
- Collection 008 → Stable Index + Monetra Passport
- Collection 009 body → Passport; footer → DeBank
- Explore Company remains external / standalone where present
- View on DeBank remains DeBank
- Passport bottom close updates URL coherently
- Passport row/chevron close updates URL coherently
- Back → Collection
- Forward → same Passport
- reload on `#passport-XXX` → correct surface + Passport

### Mobile
Repeat the critical cases above, especially:
- card tap body
- external footer tap
- no horizontal jump
- correct scroll target after open
- close without page jump
- Back restores Collection in a calm state

### Language
- EN
- RU

Verify Registry parsing still works after text translation.

## Phase F — PR discipline

Only after the above:

1. compare branch with fresh main;
2. open one atomic PR for Collection → Company Passport routing;
3. describe exactly that scope;
4. inspect changed filenames and patch;
5. wait for checks;
6. if all green, merge;
7. wait for any production/public materialization workflow;
8. fetch physical `companies/index.html` from fresh `main` and confirm the routing marker exists;
9. then mark the atom closed.

---

# 9. Suggested acceptance contract for this atom

Treat the change as complete only when all of the following are true:

- [ ] Collection card body opens the existing correct Company Passport.
- [ ] Registry 008 opens existing Stable Passport, not General Passport.
- [ ] Existing `Explore Company` links remain intact.
- [ ] Existing `View on DeBank` links remain intact.
- [ ] Non-clickable tracking footers stay non-clickable.
- [ ] Deep links `#passport-XXX` resolve after cold load.
- [ ] Reload on Passport deep link restores the intended Passport.
- [ ] General bottom close produces coherent non-Passport URL.
- [ ] General row/chevron close produces coherent non-Passport URL.
- [ ] Stable close produces coherent non-Passport URL.
- [ ] Browser Back returns to Collection without stale Passport UI.
- [ ] Browser Forward reopens the same Passport.
- [ ] EN and RU card registry parsing work.
- [ ] Keyboard activation works for non-anchor cards.
- [ ] No duplicate router / duplicate Passport component introduced.
- [ ] No capital/data/accounting/index formula changes.
- [ ] Projector remains idempotent.
- [ ] PR diff contains only intended public UX projection changes / expected generated materialization.
- [ ] CI / workflow checks green.
- [ ] Physical post-merge `companies/index.html` on `main` contains the routing marker.

---

# 10. Wider queued cosmetic/public-site work after this atom

Do not lose these tails, but do not mix them into the current routing PR unless explicitly requested.

## 10.1 Companies landing-page copy

Still queued from the earlier public-site polish checkpoint:

- review `/companies/` landing copy against the evolved product reality;
- keep changes meaningful but non-radical without owner confirmation;
- preserve the product framing around sovereign onchain companies, live measurement, Index, operating history and non-custodial architecture.

## 10.2 Right-side informational drawer / Index Framework copy

Still queued:

- review current explanatory content;
- remove stale/redundant wording if found;
- ensure it reflects current methodology and architecture;
- keep factual methodology aligned with live implementation.

## 10.3 Russian parity

Still queued:

- improve Russian translation parity and natural premium Russian;
- avoid mechanical mixed-language phrasing where it harms readability;
- do not silently change economic meaning while polishing language.

These editorial items were **not** completed by the earlier homepage cosmetic package.

---

# 11. Relevant durable product truth to preserve

These are architecture boundaries that matter to the page and Passports.

- The Holding is a capital operating architecture / OS, not a conventional custodial portfolio product.
- Companies remain independently owned and self-custodied.
- The Holding measures, normalizes, records and indexes what can be verified; it does not invent unavailable values.
- Company Passports are the operational detail layer behind registry/index entries.
- General Index and Stable Index are distinct measurement universes.
- Price should come after history, not replace history.
- Measurement/history are part of the company lifecycle, not cosmetic add-ons.
- Public copy should avoid implying custody or autonomous capital execution.
- `executionAuthority=none` remains the hard boundary for this UI work.

For Defitea specifically, preserve the accepted capital identity boundary from the earlier owner correction:

- Defitea Fund / `defitea.eth` TVL = Defitea-owned capital only.
- Related companies 001 / 002 remain separate capital.
- Related-company income roll-up is distinct from TVL ownership.
- Do not reintroduce nested company capital into Defitea TVL.

This routing branch should not touch any of that logic.

---

# 12. Short status at handoff

### 🟢 Closed before pause

- Homepage footer wording → `Capital Architecture · Onchain Companies · Real Estate`.
- Mobile hamburger short-viewport overflow fix.
- PR #738 merged.
- Unified Refresh #158 GREEN through safe publication.
- Physical homepage production materialization verified.

### 🟡 Current branch / approximately 60–70% of this navigation atom

- Collection → Passport architecture chosen correctly: reuse existing Observatory + existing Passport families.
- Canonical projector extended to project Collection Passport routing.
- First-paint Passport hash routing implemented.
- Existing Observatory selector exposed narrowly.
- Registry map 001–010 added.
- Card body / external affordance split implemented.
- General and Stable Passport opening paths implemented.
- Deep-link/history mechanism drafted.
- Code committed to branch at `25cb812...` before this checkpoint.
- **Not yet PR/CI/browser validated.**
- **Known row/chevron close hash-sync gap remains.**
- **Back/Forward still requires explicit runtime proof / possible popstate hardening.**

### ⚪ Next exact action

Resume from fresh live truth, inspect this branch/checkpoint, fix the two history/state gaps, validate projector + browser behavior, then open an atomic PR.

---

# 13. Owner instruction at pause

Owner instruction on 2026-09-10 19:16 MSK:

> Make a very detailed checkpoint in the branch, pause work here, and continue in a new chat.

Accordingly, **do not continue implementation in this chat after this checkpoint**. The next chat should pick up from this branch after performing the live-truth recovery sequence above.
