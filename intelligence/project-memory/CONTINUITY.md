# THE HOLDING — CONTINUITY ROOT

This file is the deterministic pointer between live `CURRENT.md` and immutable master continuity checkpoints.

Latest immutable checkpoint: [THE_HOLDING_MASTER_CONTINUITY_2026-09-09_210016_AUTO_35ec8cd9.md](./THE_HOLDING_MASTER_CONTINUITY_2026-09-09_210016_AUTO_35ec8cd9.md)
Checkpoint source head: **35ec8cd98c6e0bf47b609bfe3a025d1ce33d7a75**
Checkpoint source time: **2026-09-09T21:00:16Z**

Rules:
- `CURRENT.md` is generated and must resolve its latest-continuity slot through this root when present.
- immutable `THE_HOLDING_MASTER_CONTINUITY_*.md` files are never rewritten by the automatic checkpoint writer;
- changing facts still come from live `main` + fresh machine artifacts + exact evidence;
- the automatic writer has continuity-file authority only; `executionAuthority = none`;
- checkpoint snapshots explicitly expose whether key machine artifacts predate their trigger boundary;
- `UNKNOWN != 0`; Reference APR/APY is never factual income authority;
- `GREEN workflow != physically materialized production artifact`.
