/**
 * HealthyLifeStyles draft-only MCP application.
 * OAuth: Workers OAuth Provider v1, GitHub sign-in with ID allowlist and consent.
 * Downstream: one purpose-built, secret-authenticated Payload draft endpoint.
 * NO CMS admin credentials, passwords, cookies or general Payload API keys.
 */
import { env } from 'cloudflare:workers';
import {
  AuthorizationError,
  OAuthProvider,
  type AuthRequest,
  type OAuthHelpers,
} from '@cloudflare/workers-oauth-provider';
import { createMcpHandler, getMcpAuthContext } from 'agents/mcp/server';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';

interface Environment {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ALLOWED_GITHUB_ID: string;
  PAYLOAD_BRIDGE_TOKEN: string;
  MCP_ISSUER: string;
  MCP_RESOURCE_URL: string;
  CMS_BASE_URL: string;
}
interface SessionProps {
  githubId: string;
  githubLogin: string;
  scopes: string[];
}
const READ = 'articles:read';
const CREATE = 'articles:draft:create';
const ALLOWED_SCOPES = new Set([READ, CREATE]);
const CODE_MAX = 180_000;
const TTL = 600;

function cfg(): Environment {
  const e = env as unknown as Environment;
  if (
    !e.MCP_ISSUER || !e.MCP_RESOURCE_URL ||
    !/^https:\/\/[^/]+$/.test(e.MCP_ISSUER) ||
    e.MCP_RESOURCE_URL !== e.MCP_ISSUER + '/mcp' ||
    e.CMS_BASE_URL !== 'https://cms.healthylifesstyles.com' ||
    !e.PAYLOAD_BRIDGE_TOKEN || e.PAYLOAD_BRIDGE_TOKEN.length < 43 ||
    !/^\d+$/.test(e.ALLOWED_GITHUB_ID || '')
  ) throw new Error('Draft connector is not securely configured.');
  return e;
}

function auth(scope: string): SessionProps {
  const props = getMcpAuthContext()?.props as SessionProps | undefined;
  const e = cfg();
  if (!props || props.githubId !== e.ALLOWED_GITHUB_ID ||
      !Array.isArray(props.scopes) || !props.scopes.includes(scope)) {
    throw new Error('Not authorized for ' + scope + '. Reconnect with the permitted account and scope.');
  }
  return props;
}

async function payloadApi(method: 'GET' | 'POST', path: string, article?: string): Promise<Record<string, unknown>> {
  const e = cfg();
  if (!(/^\/api\/chatgpt-drafts\?(kind=references|kind=article&slug=[a-z0-9-]+)$/.test(path) || path === '/api/chatgpt-drafts')) {
    throw new Error('Unsupported API route.');
  }
  if (method === 'POST' && (!article || article.length > CODE_MAX)) throw new Error('Draft JSON must be nonempty and <=180KB.');
  const res = await fetch(e.CMS_BASE_URL + path, {
    method,
    redirect: 'error',
    headers: {
      Authorization: 'Bearer ' + e.PAYLOAD_BRIDGE_TOKEN,
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? article : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  // Downstream may return an HTML block page; never echo response bodies blindly.
  if (!(res.headers.get('content-type') || '').includes('application/json')) {
    throw new Error('CMS returned non-JSON (HTTP ' + res.status + '); check Hostinger security policy.');
  }
  const data = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = typeof data.error === 'string' ? data.error : 'CMS request rejected.';
    const details = Array.isArray(data.details) ? data.details.filter(v => typeof v === 'string').slice(0, 12).join('; ') : '';
    throw new Error('CMS HTTP ' + res.status + ': ' + msg + (details ? ' ' + details : ''));
  }
  return data;
}

const answer = (value: unknown) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
});
const reject = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: (error instanceof Error ? error.message : 'Request failed.') }],
});

function createServer() {
  const server = new McpServer({ name: 'HealthyLifeStyles Editorial Drafts', version: '1.0.0' });
  server.registerTool('whoami', {
    title: 'Connected HealthyLifeStyles editor',
    description: 'Returns the authenticated editor identity and allowed scopes; never returns secrets.',
    inputSchema: z.object({}), securitySchemes: [{ type: 'oauth2', scopes: [READ] }],
  }, async () => {
    try {
      const p = auth(READ);
      return answer({ id: 'hls-github-' + p.githubId, name: p.githubLogin, scopes: p.scopes });
    } catch (error) { return reject(error); }
  });
  server.registerTool('list_article_references', {
    title: 'List verified editorial reference IDs',
    description: 'Read existing published article/tool IDs, categories, authors and tags for safe draft relationships. No changes.',
    inputSchema: z.object({}), securitySchemes: [{ type: 'oauth2', scopes: [READ] }],
  }, async () => {
    try { auth(READ); return answer(await payloadApi('GET', '/api/chatgpt-drafts?kind=references')); }
    catch (error) { return reject(error); }
  });
  server.registerTool('find_article_by_slug', {
    title: 'Check existing article before drafting',
    description: 'Read whether an article slug exists, including unpublished drafts, to avoid duplicates. No changes.',
    inputSchema: z.object({ slug: z.string().min(1).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) }),
    securitySchemes: [{ type: 'oauth2', scopes: [READ] }],
  }, async ({ slug }) => {
    try { auth(READ); return answer(await payloadApi('GET', '/api/chatgpt-drafts?kind=article&slug=' + slug)); }
    catch (error) { return reject(error); }
  });
  server.registerTool('create_article_draft', {
    title: 'Create one unpublished HealthyLifeStyles article draft',
    description: 'Creates exactly ONE new DRAFT after validation and duplicate checks. Requires user approval. NEVER publishes, updates, deletes, deploys or uploads media. Pass the full checked article JSON object serialized as a string.',
    inputSchema: z.object({ article_json: z.string().min(100).max(CODE_MAX) }),
    securitySchemes: [{ type: 'oauth2', scopes: [CREATE] }],
  }, async ({ article_json }) => {
    try {
      auth(CREATE);
      const parsed = JSON.parse(article_json);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Article must be a JSON object.');
      return answer(await payloadApi('POST', '/api/chatgpt-drafts', JSON.stringify(parsed)));
    } catch (error) { return reject(error); }
  });
  return server;
}

const special = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'": '&#39;' }[c] || c));
function token(): string {
  const b = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
}
function getCookie(req: Request, name: string): string | null {
  const cookies = req.headers.get('cookie') || '';
  const value = cookies.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return value ? value.slice(name.length + 1) : null;
}
function sameNonce(a: string | null, b: string | null): boolean {
  if (!a || !b || a.length !== 64 || b.length !== 64) return false;
  let diff = 0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function cookie(name: string, value: string, maxAge=TTL): string {
  return `__Host-${name}=${value}; Secure; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
function respond(body: string, status=200, extra?: HeadersInit): Response {
  return new Response(body, {status, headers: {'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'", ...(extra||{})}});
}
async function authorize(req: Request, e: Environment): Promise<Response> {
  let oauth: AuthRequest;
  try { oauth = await e.OAUTH_PROVIDER.parseAuthRequest(req); }
  catch (error) {
    // Never redirect a malformed client or unvalidated redirect URI.
    return respond(error instanceof AuthorizationError ? special(error.description) : 'Invalid OAuth request.', 400);
  }
  cfg();
  const client = await e.OAUTH_PROVIDER.lookupClient(oauth.clientId);
  if (!client) return respond('Unknown OAuth client.', 400);
  const nonce = token();
  await e.OAUTH_KV.put('consent:' + nonce, JSON.stringify(oauth), { expirationTtl: TTL });
  const requested = oauth.scope.filter(s => ALLOWED_SCOPES.has(s));
  if (!requested.length) return respond('Required editorial scope was not requested.', 400);
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><title>Connect HealthyLifeStyles</title><style>body{font:16px system-ui;max-width:650px;margin:7vh auto;padding:30px;line-height:1.6;color:#132238}button{background:#15803d;color:white;padding:12px 24px;border:0;border-radius:8px;font-size:16px}h1{color:#064e3b}code{font-size:14px}</style><h1>Authorize HealthyLifeStyles draft access</h1><p>Requested by <strong>${special(client.clientName || 'an MCP client')}</strong>.</p><p>After you sign in with GitHub, the connection may only: <strong>${requested.map(special).join(', ')}</strong>.</p><p>It cannot publish, edit existing articles, delete content, change settings, or access your CMS credentials. Draft creation is subject to a separate confirmation in ChatGPT.</p><form method="post" action="/consent"><input type="hidden" name="nonce" value="${nonce}"><button name="accept" value="yes" type="submit">Continue with GitHub</button></form></html>`;
  return respond(html, 200, { 'Set-Cookie': cookie('HLS-CONSENT', nonce) });
}
async function consent(req: Request, e: Environment): Promise<Response> {
  cfg();
  if (req.headers.get('origin') !== e.MCP_ISSUER) return respond('Invalid origin.',403);
  if (!(req.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) return respond('Invalid form.',415);
  const form = await req.formData();
  const nonce = form.get('nonce');
  if (form.get('accept') !== 'yes' || typeof nonce !== 'string' || !sameNonce(nonce, getCookie(req, '__Host-HLS-CONSENT'))) return respond('Consent was not confirmed.',403);
  const saved = await e.OAUTH_KV.get('consent:' + nonce);
  if (!saved) return respond('Consent expired.',400);
  await e.OAUTH_KV.delete('consent:' + nonce);
  const oauth = JSON.parse(saved) as AuthRequest;
  const state = token();
  await e.OAUTH_KV.put('github-state:' + state, JSON.stringify(oauth), { expirationTtl: TTL });
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', e.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', e.MCP_ISSUER + '/callback');
  url.searchParams.set('scope', 'read:user');
  url.searchParams.set('state', state);
  return new Response(null, {status:302, headers: {
    Location: url.toString(),
    'Set-Cookie': cookie('HLS-GITHUB-STATE', state),
    'Cache-Control':'no-store',
  }});
}
async function callback(req: Request, e: Environment): Promise<Response> {
  cfg();
  const u = new URL(req.url);
  if (u.searchParams.has('error')) return respond('GitHub authorization denied.',403);
  const state = u.searchParams.get('state');
  const code = u.searchParams.get('code');
  if (!sameNonce(state, getCookie(req, '__Host-HLS-GITHUB-STATE')) || !code || code.length > 512) return respond('Invalid OAuth state.', 403);
  const saved = await e.OAUTH_KV.get('github-state:' + state);
  if (!saved) return respond('OAuth request expired.',400);
  await e.OAUTH_KV.delete('github-state:' + state);
  const oauth = JSON.parse(saved) as AuthRequest;
  const exchange = await fetch('https://github.com/login/oauth/access_token', {
    method:'POST',redirect:'error',headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({client_id:e.GITHUB_CLIENT_ID,client_secret:e.GITHUB_CLIENT_SECRET,code,redirect_uri:e.MCP_ISSUER+'/callback'}),
    signal: AbortSignal.timeout(15000),
  });
  if (!exchange.ok) return respond('GitHub token exchange failed.',502);
  const tokens = await exchange.json() as {access_token?:string;error?:string};
  if (!tokens.access_token || tokens.error) return respond('GitHub authorization unsuccessful.',403);
  const identity = await fetch('https://api.github.com/user', {
    headers:{Authorization:'Bearer '+tokens.access_token,Accept:'application/vnd.github+json','User-Agent':'HealthyLifeStyles-MCP'},
    redirect:'error',signal: AbortSignal.timeout(15000),
  });
  if (!identity.ok) return respond('GitHub identity verification failed.',403);
  const user = await identity.json() as {id?:number;login?:string};
  if (!user.id || String(user.id) !== e.ALLOWED_GITHUB_ID) return respond('This GitHub account has not been authorized for HealthyLifeStyles.',403);
  const scopes = oauth.scope.filter(s => ALLOWED_SCOPES.has(s));
  if (!scopes.length) return respond('No approved scope.',403);
  const { redirectTo } = await e.OAUTH_PROVIDER.completeAuthorization({
    request: oauth,
    userId: String(user.id),
    scope: scopes,
    metadata: { clientName: 'HealthyLifeStyles editorial drafts' },
    props: { githubId:String(user.id), githubLogin:user.login || '', scopes } satisfies SessionProps,
  });
  return new Response(null, { status:302, headers:{Location:redirectTo,'Cache-Control':'no-store',
    'Set-Cookie': cookie('HLS-GITHUB-STATE','',0) }});
}

const defaultHandler: ExportedHandler<Environment> = {
  async fetch(req: Request, e: Environment): Promise<Response> {
    const url = new URL(req.url);
    if (url.origin !== e.MCP_ISSUER) return respond('Invalid host.',403);
    if (url.pathname === '/health' && req.method === 'GET') return Response.json({ok:true,service:'draft-only-mcp'}, { headers: {'Cache-Control':'no-store'} });
    if (url.pathname === '/authorize' && req.method === 'GET') return authorize(req,e);
    if (url.pathname === '/consent' && req.method === 'POST') return consent(req,e);
    if (url.pathname === '/callback' && req.method === 'GET') return callback(req,e);
    return respond('Not found.',404);
  },
};

// The provider owns OAuth 2.1 token issuance, validation, PKCE, CIMD/DCR,
// issuer identification, metadata and refresh/revocation.
// OAuth metadata needs only public Worker URL bindings.
// Secrets are checked at request time, not at first-worker provisioning.
const e = env as unknown as Environment;
export default new OAuthProvider<Environment>({
  apiRoute: '/mcp',
  apiHandler: createMcpHandler(createServer),
  defaultHandler,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  scopesSupported: [READ, CREATE],
  clientIdMetadataDocumentEnabled: true,
  requiredScopes: [READ, CREATE],
  resourceMetadata: {
    resource: e.MCP_RESOURCE_URL,
    authorization_servers: [e.MCP_ISSUER],
    scopes_supported: [READ, CREATE],
    resource_name: 'HealthyLifeStyles Editorial Drafts',
  },
});
