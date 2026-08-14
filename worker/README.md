# The Holding Conversation Learning Worker

This Worker is intentionally isolated from the static website.

Production scope:
- Worker name: `theholding-learning-intake`
- Route: `theholding.ai/api/*`
- Static site `/` and `/agents/*` are not Worker assets and must remain on the existing site deployment.

Deploy explicitly with the non-default config:

```bash
npx wrangler deploy -c worker/wrangler.learning.jsonc
```

Do not restore a repository-root `wrangler.jsonc` for this Worker. A root Wrangler config can be auto-detected by Cloudflare Git deployment and may unintentionally replace the website deployment surface.

Conversation intake remains fail-closed until the privacy/controller variables and `LEARNING_INTAKE_ENABLED=true` are deliberately configured.
