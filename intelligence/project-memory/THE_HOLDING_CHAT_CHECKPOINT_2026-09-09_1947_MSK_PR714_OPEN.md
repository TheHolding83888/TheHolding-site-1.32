# The Holding — PR714 Open Checkpoint
## 2026-09-09 19:47 MSK

Draft PR opened: **#714 · WIP · Site balance finalization and public polish**
Branch: `fix/site-balance-finalization-20260909`
PR head before this checkpoint: `24d2440eac6885a7e67f1f040490e0cf6b27a15e`

Purpose: make WIP visible to GitHub CI/Actions and preserve the active chat's implementation state.

Owner clarification now canonical for this WIP:
- Defitea Fund and `defitea.eth` are the same economic entity.
- Their TVL must be identical by construction.
- That TVL includes two constituent companies.
- The two constituent companies must be identified from current canonical repo evidence before modifying aggregation; no guessing.
- Additional balance updates to defitea.eth are also Fund balance updates.
- Avoid double counting when the company network and fund ecosystem are displayed together.

Next continuation order:
1. inspect PR714 CI;
2. resolve exact Defitea constituent aggregation;
3. finish owner quantity updates (Singul + Defitea veFRAX 4456);
4. remove direct browser CoinGecko from 05081966/YieldRing and clean old Singul price loop;
5. validate Substantia silver route;
6. get capital/TVL layer green;
7. package #2 copy/nav/footer;
8. package #3 Yield Reports mobile/Graph/pyramid;
9. full final re-audit and checkpoint.

See the full 19:45 checkpoint for all details:
`intelligence/project-memory/THE_HOLDING_CHAT_CHECKPOINT_2026-09-09_1945_MSK_SITE_BALANCE_AND_POLISH_WIP.md`
