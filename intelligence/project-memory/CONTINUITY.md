# THE HOLDING — CONTINUITY ROOT

This file is the deterministic pointer between live `CURRENT.md` and immutable master continuity checkpoints.

Latest immutable checkpoint: [THE_HOLDING_MASTER_CONTINUITY_2026-09-09_110606_AUTO_3fd8428d.md](./THE_HOLDING_MASTER_CONTINUITY_2026-09-09_110606_AUTO_3fd8428d.md)
Checkpoint source head: **3fd8428d283ab2c8b8cc0ff1cdd67d59d86db8c8**
Checkpoint source time: **2026-09-09T14:06:06+03:00**

Rules:
- `CURRENT.md` is generated and must resolve its latest-continuity slot through this root when present.
- immutable `THE_HOLDING_MASTER_CONTINUITY_*.md` files are never rewritten by the automatic checkpoint writer;
- changing facts still come from live `main` + fresh machine artifacts + exact evidence;
- the automatic writer has continuity-file authority only; `executionAuthority = none`;
- checkpoint snapshots explicitly expose whether key machine artifacts predate their trigger boundary;
- `UNKNOWN != 0`; Reference APR/APY is never factual income authority;
- `GREEN workflow != physically materialized production artifact`.
