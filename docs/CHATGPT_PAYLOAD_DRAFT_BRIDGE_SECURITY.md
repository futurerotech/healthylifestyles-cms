# HealthyLifeStyles draft-only ChatGPT integration - security and release gates

**Status: PROPOSED / NOT LIVE.** This design intentionally requires an operator-controlled approval and deployment. It does not request owner passwords, browser cookies, full editor API keys, database URIs or repo secrets.

## Threat model

1. **Malicious MCP client or prompt injection**: The Cloudflare OAuth provider validates the client redirect, PKCE, tokens, issuer and audience; the sign-in is restricted to the explicitly allowlisted numeric GitHub user ID. Only two narrow scopes are granted. Tool arguments can never select arbitrary downstream API endpoints.
2. **Stolen MCP bearer token**: OAuth revocation/expiry and scopes limit tool exposure. The backend additionally validates all inputs and enforces drafts regardless of requested fields. Rotate GitHub OAuth and Cloudflare secrets on suspicion.
3. **Leaked downstream bridge key**: The key is exclusively accepted by a new server-side Next.js route; it cannot authenticate to general Payload REST APIs. Rotate both ends immediately. Body size is capped at 180 KB.
4. **Unintentional publication**: The route has no update/delete/publish method, forces unpublished fields, and leaves hero-media attachment for manual review. The existing CMS publish gate remains untouched.
5. **Duplicate drafts / network retries**: Slug checks on draft and published records; no automatic retry. Existing slug index is not unique; concurrent writers can still race. A uniqueness migration would require separate design/review, not this PR.
6. **Provider outage / anti-bot**: If Hostinger blocks Worker-to-CMS requests, fail closed. Do not disable global WAF or reveal keys to workaround. Operator can approve a narrow allowlist or dedicated authenticated route.
7. **Dependency drift**: The integration pins dependency versions. Verify against the current API and run Worker build/type-check and OAuth integration tests before deployment; no production deploy triggered by this PR.
8. **Authorization consent**: Only the allowed GitHub identity can complete the flow. Anti-CSRF state is bound to secure HttpOnly cookies and expires after 10 minutes. The owner approves scopes via the explicit consent page.

## Release gate

- [ ] Security review of `src/lib/chatgptDraftPolicy.ts` and `src/app/api/chatgpt-drafts/route.ts`
- [ ] `npm test`, `npm run security:check`, `npx tsc --noEmit`, production CI with mock database
- [ ] Validate Worker dependencies with `npm install`, `npm run check` and `npm test`
- [ ] Test unauthorized/invalid Origin/missing token and unpublished non-write behavior in an isolated environment
- [ ] Test all four MCP operations using a disposable CMS clone, including OAuth denial/revocation
- [ ] Confirm no secrets in PR diff, GitHub logs, media, or CMS responses
- [ ] Hostinger owner deploys CMS patch and supplies server-side bridge secret only via approved secret store
- [ ] Cloudflare/GitHub owner provisions GitHub OAuth and Worker server secrets only via approved secret store
- [ ] ChatGPT workspace admin installs custom MCP app and selects ask-before-writes
- [ ] Independently verify a real **draft** ID, never a published article

If any check fails, do not enable the connector; no changes should be made to Hostinger anti-bot rules without a targeted security review.
