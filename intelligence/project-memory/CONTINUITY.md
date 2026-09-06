# THE HOLDING — CONTINUITY ROOT

This file is the deterministic pointer between live `CURRENT.md` and immutable master continuity checkpoints.

Latest immutable checkpoint: [THE_HOLDING_MASTER_CONTINUITY_2026-09-06_114718_AUTO_46efb8ef.md](./THE_HOLDING_MASTER_CONTINUITY_2026-09-06_114718_AUTO_46efb8ef.md)
Checkpoint source head: **46efb8efc599b9365aaad59d218e1e1a366f4307**
Checkpoint source time: **2026-09-06T11:47:18Z**

Rules:
- `CURRENT.md` is generated and must resolve its latest-continuity slot through this root when present.
- immutable `THE_HOLDING_MASTER_CONTINUITY_*.md` files are never rewritten by the automatic checkpoint writer;
- changing facts still come from live `main` + fresh machine artifacts + exact evidence;
- the automatic writer has continuity-file authority only; `executionAuthority = none`;
- checkpoint snapshots explicitly expose whether key machine artifacts predate their trigger boundary;
- `UNKNOWN != 0`; Reference APR/APY is never factual income authority;
- `GREEN workflow != physically materialized production artifact`.
