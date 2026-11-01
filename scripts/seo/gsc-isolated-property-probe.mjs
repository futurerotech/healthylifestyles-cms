/**
 * One-shot, standalone Google Search Console property-only permission probe.
 *
 * No CMS route, Payload session, database, Search Analytics, indexing request,
 * output file, or storage. --check is the DEFAULT and never loads credentials
 * or imports the Google client. --execute requires independent approval.
 *
 * This is a capability for a reviewed, physically isolated operator process,
 * NOT evidence that a CI runner or host is itself isolated.
 */
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const APPROVED_GSC_DOMAIN = 'sc-domain:healthylifesstyles.com';
export const GSC_READONLY_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';
// This is a one-shot permission check, not a repeated polling workflow.
// Bound the Search Console HTTP call and explicitly disable Gaxios GET retries.
export const GSC_SINGLE_READ_OPTIONS = Object.freeze({
  timeout: 10_000,
  retry: false,
  retryConfig: Object.freeze({retry: 0, noResponseRetries: 0}),
});
const PERMISSIONS = new Set(['siteOwner', 'siteFullUser', 'siteRestrictedUser']);

function deny(message) {
  throw new Error(message);
}

export function assertIsolatedOperatorGate(env = process.env) {
  if (!env || typeof env !== 'object' ||
      env.HLS_ISOLATED_STAGING !== 'true' ||
      env.HLS_GSC_PROPERTY_PROBE_ENABLED !== 'true' ||
      env.HLS_GSC_ISOLATED_PROPERTY_PROBE_APPROVED !== 'true' ||
      env.HLS_GSC_OPERATOR_ONE_SHOT_APPROVED !== 'true' ||
      (env.HLS_GSC_READONLY_ENABLED !== undefined &&
       env.HLS_GSC_READONLY_ENABLED !== 'false')) {
    deny('Isolated GSC property-only execution is not approved.');
  }
  if (env.GSC_SITE_URL !== undefined &&
      env.GSC_SITE_URL !== APPROVED_GSC_DOMAIN) {
    deny('The configured property is not the approved Domain property.');
  }

  // Required dedicated, mounted service-account credential. GoogleAuth must
  // never silently fall back to a user session or the indexing subsystem.
  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (typeof keyFile !== 'string' || keyFile.length === 0 ||
      keyFile.length > 4096 ||
      !(path.isAbsolute(keyFile) || path.win32.isAbsolute(keyFile))) {
    deny('A dedicated absolute service-account credential mount is required.');
  }
  const expectedEmail = env.HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL;
  if (typeof expectedEmail !== 'string' || expectedEmail.length > 320 ||
      !/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.iam\.gserviceaccount\.com$/.test(expectedEmail)) {
    deny('An independently verified expected service-account identity is required.');
  }
  return true;
}

export function assertExactPropertyPermission(property) {
  if (!property || typeof property !== 'object' || Array.isArray(property) ||
      Object.hasOwn(property, 'error') ||
      property.siteUrl !== APPROVED_GSC_DOMAIN ||
      !PERMISSIONS.has(property.permissionLevel)) {
    deny('The approved Search Console Domain property access was not verified.');
  }
}

/**
 * Injectable for mock-only tests. Never return provider errors, the account
 * email, a raw site object, token or credential in the sanitized receipt.
 */
export async function runIsolatedOperatorProbe({
  env = process.env,
  createAdapter = createGoogleAdapter,
} = {}) {
  // Fail before filesystem/credentials/client/provider access.
  assertIsolatedOperatorGate(env);

  let adapter;
  try {
    adapter = await createAdapter({
      keyFile: env.GOOGLE_APPLICATION_CREDENTIALS,
      scope: GSC_READONLY_SCOPE,
    });
  } catch {
    deny('Read-only Search Console provider initialization failed.');
  }
  if (!adapter || typeof adapter.getIdentity !== 'function' ||
      typeof adapter.getSite !== 'function') {
    deny('Read-only Search Console provider is unavailable.');
  }

  let accountEmail;
  try {
    accountEmail = await adapter.getIdentity();
  } catch {
    deny('Search Console service-account identity verification failed.');
  }
  if (accountEmail !== env.HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL) {
    deny('The credential is not the independently approved service account.');
  }

  let property;
  try {
    property = await adapter.getSite(APPROVED_GSC_DOMAIN);
  } catch {
    deny('The Search Console property-only request failed.');
  }
  assertExactPropertyPermission(property);

  return Object.freeze({
    kind: 'isolated-gsc-exact-domain-property-only',
    exactPropertyReadPermissionVerified: true,
    expectedServiceAccountIdentityVerified: true,
    oauthScope: GSC_READONLY_SCOPE,
    searchAnalyticsRequests: 0,
    indexingSubmissions: 0,
    cmsReads: 0,
    cmsWrites: 0,
    publicationAuthorized: false,
  });
}

/**
 * The real adapter is loaded only during --execute after the operator gate.
 * The only Google request in this script is sites.get({siteUrl}).
 */
export async function createGoogleAdapter({keyFile, scope}) {
  const { google } = await import('googleapis');
  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: [scope],
  });
  const api = google.searchconsole({version:'v1', auth});
  return {
    getIdentity: async () => {
      const credentials = await auth.getCredentials();
      return credentials.client_email;
    },
    getSite: async (siteUrl) => (await api.sites.get(
      {siteUrl}, GSC_SINGLE_READ_OPTIONS,
    )).data,
  };
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 0 || (args.length === 1 && args[0] === '--check')) {
    // No environment, credential, file or network access on dry-run.
    process.stdout.write('CHECK_ONLY: one-shot GSC Domain property runner is inert; --execute requires independently approved isolated execution.\n');
    return 0;
  }
  if (args.length !== 1 || args[0] !== '--execute') {
    deny('Only --check or --execute is supported.');
  }
  const receipt = await runIsolatedOperatorProbe();
  process.stdout.write(JSON.stringify(receipt) + '\n');
  return 0;
}

if (process.argv[1] &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    // Deliberately never emit any provider error, credential, project ID,
    // account email or raw GSC response.
    process.stderr.write('GSC_PROPERTY_PROBE_BLOCKED_OR_FAILED\n');
    process.exitCode = 1;
  });
}
