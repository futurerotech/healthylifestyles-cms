import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../src/index.mts', import.meta.url), 'utf8');
test('OAuth 2.1 protected MCP exposes draft-only write tool', () => {
  assert.match(source, /new OAuthProvider<Environment>/);
  assert.match(source, /clientIdMetadataDocumentEnabled: true/);
  assert.match(source, /ALLOWED_GITHUB_ID/);
  assert.match(source, /registerTool\('create_article_draft'/);
  assert.ok(!/registerTool\('(?:publish|delete|update|deploy)/.test(source));
});
test('downstream targets only the fixed CMS and scoped bridge endpoint', () => {
  assert.match(source, /e\.CMS_BASE_URL !== 'https:\/\/cms\.healthylifesstyles\.com'/);
  assert.match(source, /\/api\/chatgpt-drafts/);
  assert.ok(!source.includes('/api/users/login'));
  assert.ok(!source.includes('/api/articles?draft=true'));
});
test('no secret values committed in code or Worker config', () => {
  const config=readFileSync(new URL('../wrangler.jsonc', import.meta.url),'utf8');
  for(const secret of ['PAYLOAD_BRIDGE_TOKEN','GITHUB_CLIENT_SECRET','ALLOWED_GITHUB_ID']) {
    assert.ok(!new RegExp('"'+secret+'"\\s*:', 'i').test(config));
  }
  assert.match(config,/REPLACE_WITH_YOUR_WORKER_HOST/);
});
