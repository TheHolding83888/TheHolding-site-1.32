# THE HOLDING — ROOT ROUTING GUARD
## 2026-08-14 — Static homepage must never be replaced by auxiliary Worker assets

Production incident lesson:

A repository-root `wrangler.jsonc` introduced for Safe Conversation Learning declared `agents/console` as Worker static assets. If Cloudflare Git deployment auto-detects that root Wrangler project on the primary domain, `/` can be served from the Console asset bundle instead of the canonical homepage.

Permanent guard:
- `https://theholding.ai/` belongs to the canonical static homepage.
- Conversation Learning is an auxiliary API capability only.
- Conversation Learning Worker route is limited to `theholding.ai/api/*`.
- The learning Worker must not own `/`, `/agents/*`, `/companies/*`, fund pages, or other public site paths.
- Do not keep the learning Worker configuration as repository-root `wrangler.jsonc`.
- Use the explicit non-default config `worker/wrangler.learning.jsonc`.
- Do not bundle the Console or any main-site pages as learning Worker assets.
- Any future Worker attached to the main hostname must use the smallest explicit route and must not become the origin for unrelated paths.

This is a deployment-plane regression guard, not a new architecture layer.
