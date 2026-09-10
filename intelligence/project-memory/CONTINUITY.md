# THE HOLDING — CONTINUITY ROOT

This file is the deterministic pointer between live `CURRENT.md` and immutable master continuity checkpoints.

Latest immutable checkpoint: [THE_HOLDING_MASTER_CONTINUITY_2026-09-10_050019_AUTO_eac05184.md](./THE_HOLDING_MASTER_CONTINUITY_2026-09-10_050019_AUTO_eac05184.md)
Checkpoint source head: **eac0518420bfc65417a2d01a51fed9d505b27aa6**
Checkpoint source time: **2026-09-10T05:00:19Z**

Rules:
- `CURRENT.md` is generated and must resolve its latest-continuity slot through this root when present.
- immutable `THE_HOLDING_MASTER_CONTINUITY_*.md` files are never rewritten by the automatic checkpoint writer;
- changing facts still come from live `main` + fresh machine artifacts + exact evidence;
- the automatic writer has continuity-file authority only; `executionAuthority = none`;
- checkpoint snapshots explicitly expose whether key machine artifacts predate their trigger boundary;
- `UNKNOWN != 0`; Reference APR/APY is never factual income authority;
- `GREEN workflow != physically materialized production artifact`.
