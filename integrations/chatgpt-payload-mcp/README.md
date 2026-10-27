# HealthyLifeStyles private ChatGPT <-> Payload draft connector

This is a **proposed, non-deployed** OAuth 2.1 MCP integration. It gives the specifically allowlisted GitHub account two capabilities: **read limited editorial references** and **create new unpublished article drafts**. It does not grant ChatGPT a Payload login, a general editor API key, or direct database access.

## Architecture and trust boundaries

```
ChatGPT (workspace custom MCP plugin)
    -- OAuth 2.1 + PKCE --> Cloudflare Worker (/mcp)
                                 | GitHub OAuth, explicit consent, owner ID allowlist
                                 | private server-to-server bearer key
                                 v
https://cms.healthylifesstyles.com/api/chatgpt-drafts
    -- one-purpose Next.js handler --> Payload Local API
                                         (create drafts only)
```

The server-side `CHATGPT_DRAFT_BRIDGE_TOKEN` is **not a Payload API key**. It is a high-entropy secret accepted ONLY by the new `/api/chatgpt-drafts` route; an attacker holding it cannot call general Payload admin, publish, edit, delete, deploy, or access other REST endpoints. The remote Worker keeps the key as an encrypted Cloudflare secret. The local CMS keeps a second copy as a Hostinger server environment secret. GitHub sign-in grants the Worker no repository write permissions (`read:user` only).

## Exact capabilities

- `whoami`: read authenticated identity and limited scope.
- `list_article_references`: read IDs/slugs for published tools/articles, section categories, existing tags and editorial organization authors.
- `find_article_by_slug`: inspect whether a slug already exists, including drafts.
- `create_article_draft`: validate an entire article and create **one** draft. The backend always forces `_status: 'draft'`, `featured: false`, `reviewedByHuman: false`, `reviewer: null`, `heroImage: null`, no publish date. No write tool for existing articles.

The backend deliberately has no `PUT`, `PATCH`, or `DELETE` handlers. It permits only whitelisted article fields/blocks, and has duplicate checks. Its slug field is not currently unique in the database: concurrent creation from two unrelated clients can theoretically race. This implementation does not promise atomic deduplication. Never blindly retry after ambiguous network errors; recheck the slug.

## Requirements before first use (owner-controlled)

1. **Review the pull request** and run its CMS CI/security suite against a disposable database. Never run the new endpoint on production before reviewing the code and the specific secrets boundary.
2. After approval, deploy the CMS patch through your normal Hostinger process (do not alter hosting protections, secrets, database, redirects, migrations, or other config). Add a fresh 256-bit+ random value to the **server-only** CMS environment as `CHATGPT_DRAFT_BRIDGE_TOKEN` (e.g. generate with `openssl rand -hex 32`). Restart/redeploy the app through your standard approved process. Do **not** send the value in chat or commit it to GitHub.
3. Create a GitHub OAuth App for **only your account** from GitHub Settings > Developer settings > OAuth Apps. Application homepage: your own Cloudflare Worker URL; callback URL: `https://YOUR_WORKER_HOST/callback`. Leave repository permissions alone; the app requests only `read:user`.
4. On your own Cloudflare account, create a Workers KV namespace (`npx wrangler kv namespace create OAUTH_KV`), put the returned ID in `wrangler.jsonc`, and replace `MCP_ISSUER` and `MCP_RESOURCE_URL` with the exact worker HTTPS origin and `${origin}/mcp` respectively. Set the secrets through `wrangler secret put` for: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `ALLOWED_GITHUB_ID` (your **numeric immutable GitHub user ID**), and `PAYLOAD_BRIDGE_TOKEN` (exact same random secret configured in CMS). Do not share them with ChatGPT. All placeholders intentionally fail closed until configured.
5. Run `npm install` in this **isolated** folder, then `npm run check` and `npm test`. Deploy this Worker with `npm run deploy` only after successful validation. Verify `GET /health` returns JSON and unauthed `POST /mcp` returns OAuth authorization discovery, never data.
6. As a **ChatGPT Business workspace admin/owner**, go to Plugins > + > Add custom MCP server. Enter `https://YOUR_WORKER_HOST/mcp`, select OAuth, review the risk warning, and create the plugin. Use the GitHub identity allowlisted in step 4 and approve the two displayed scopes. Test read-only reference listing, then create one draft. Set ChatGPT permission mode to *ask before writes*.
7. Verify the resulting CMS article ID, `Draft` status, relations/embedded calculator and SEO. Keep publishing and hero-image uploads manual. Revoke anytime by deleting the plugin, rotating either secret, deleting the Worker, or revoking the GitHub OAuth app grant.

### Why not just use Payload's editor API key?

`Users.auth.useAPIKey` exists, but its keys inherit the entire editor account's permissions; the current editor role can update/delete content. Also, ChatGPT custom MCP does not directly accept an arbitrary static third-party API key for user OAuth linking. Exposing that key through a generic MCP would violate least privilege. This gateway avoids both problems by putting a separate, draft-only backend route in front of the Payload Local API and using GitHub-backed OAuth 2.1 with individual consent for the ChatGPT connection.

### Operational safeguards

- HTTPS everywhere; fixed CMS host, no user-supplied API URLs and no redirect following.
- OAuth 2.1 handled by the Cloudflare provider library, PKCE/CIMD, with an owner GitHub ID allowlist and explicit anti-CSRF consent.
- Cloudflare Worker never stores GitHub access tokens in ChatGPT; it only stores the allowed GitHub account identity in OAuth grant props.
- The CMS token is unavailable to the browser, returned content, source control and ChatGPT. No credential passthrough.
- No live changes occur by merging a PR alone. Do not merge automatically or deploy without reviewing the Hostinger configuration.
- Rate limiting / WAF: preserve Hostinger protections. If Cloudflare Worker receives HTTP 429, ask the host operator to allow its *specific* authenticated server-to-server route; never disable all anti-bot rules globally.
- Logging: log only abstract success/failure and article IDs, never tokens, article bodies or patient data.
- Use only public, general medical-editorial content; never send private patient health records or personal medical information to this service.

## Validation status

Unit tests for the shared article draft policy run locally with:

```sh
node --experimental-strip-types --test tests/chatgptDraftPolicy.node-tests.mjs
```

The worker needs its own package install + Cloudflare API/identity configuration before it can undergo integration/OAuth flow tests. A local unit test passing is **not** proof of live site access or of the OAuth handshake. Do not mark this integration as 'connected' until the actual ChatGPT plugin appears in the workspace and has successfully read and written an authorized draft.

## References

- ChatGPT custom MCP: https://help.openai.com/en/articles/12584461-connecting-custom-mcp-servers-in-chatgpt
- ChatGPT OAuth: https://developers.openai.com/plugins/build/auth
- Cloudflare Workers OAuth Provider v1: https://github.com/cloudflare/workers-oauth-provider
- Cloudflare stateless MCP: https://developers.cloudflare.com/agents/model-context-protocol/protocol/transport/
- Payload draft REST semantics: https://payloadcms.com/docs/versions/drafts
