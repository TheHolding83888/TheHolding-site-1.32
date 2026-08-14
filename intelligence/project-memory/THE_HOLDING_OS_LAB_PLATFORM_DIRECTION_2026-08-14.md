# THE HOLDING OS LAB — PLATFORM DIRECTION CHECKPOINT
## 2026-08-14

## Product milestone

The canonical `/agents/` OS Lab now includes a compact platform-direction map directly after the live Ask The Holding surface and before the Observer / Cognitive Stack internals:

`The Holding OS → Ask The Holding → Company Companions → Agent Economy`

Public meaning:

- **The Holding OS** — shared memory, security and intelligence substrate.
- **Ask The Holding** — the live general conversational interface into the OS.
- **Company Companions** — future company-specific intelligence/curator layer grounded in each company’s own verified state and memory.
- **Agent Economy** — long-term human + authorised AI-agent participation layer.

Canonical clarification displayed on the page:

> Brain · Memory · Security · Learning are organs of one OS — not separate products.

The block links to `/manifesto` so the full platform vision is read from the beginning rather than entering mid-roadmap.

## Placement

Canonical surface order now begins:

`Hero → Ask The Holding → Platform Direction → Observer → Cognitive Stack → Specialist Agents → Dialogue Preview → Infrastructure`

This deliberately lets a visitor first experience the conversational interface, then understand the larger product trajectory, and only then inspect the technical organs beneath it.

## Delivery / safety

Production patch commit:

`f4deb3abc675d10d2ecf243e6f088d13120be055`

Commit message:

`agents: add compact OS platform direction`

The one-time patcher validated before publication:

- exactly one `platform-direction` surface;
- placement after `ask-the-holding` and before `observer`;
- Ask The Holding v0.5 asset remains `/agents/console/app.js?v=0.5`;
- safety asset remains `/agents/console/safety.js?v=0.1`;
- Observer, Cognitive Stack and Agents markers remain present;
- `git diff --check` passes;
- temporary patch workflow self-removes after publication.

No new API, model call, wallet permission, capital authority, methodology mutation or execution authority was introduced.

## Product canon

This visual map is not a promise that all future layers already exist. It distinguishes:

- OS + Ask: live/current;
- Company Companions: next product direction;
- Agent Economy: long-term direction.

Authority remains explicitly bounded. Company Companion intelligence does not imply ownership, signing rights or autonomous capital control.
