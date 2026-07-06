/**
 * Google service-account bootstrap for the Search Console + Indexing APIs.
 *
 * SECURITY: the credential is read ONLY from the GOOGLE_INDEXING_CREDENTIALS_B64
 * environment variable (the whole service-account JSON, base64-encoded to one
 * line). It is never written to disk, never committed, and never logged —
 * error messages are deliberately generic and never include the key,
 * private_key, or client_email.
 *
 * WHY BASE64: pasting raw JSON into host env UIs corrupts the private_key's
 * "\n" escapes (real newlines, smart quotes, truncation) → "invalid JSON".
 * Base64 is newline-proof, so the old sanitization/repair logic is gone.
 *
 * Encode the (freshly rotated!) key file once:
 *   Linux/macOS:  base64 -w0 service-account.json
 *   PowerShell:   [Convert]::ToBase64String([IO.File]::ReadAllBytes("service-account.json"))
 * Store the single-line output as GOOGLE_INDEXING_CREDENTIALS_B64 (no quotes).
 */

/** Thrown when configuration (env vars) is missing or malformed. */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ConfigError';
  }
}

export interface GoogleServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
}

/**
 * Load + validate the service-account JSON from GOOGLE_INDEXING_CREDENTIALS_B64.
 *
 * Health check: every failure logs WHICH stage failed — missing / decode /
 * parse / fields — so nobody has to guess again. Key material is never logged.
 */
export function loadGoogleCredentials(): GoogleServiceAccount {
  const b64 = process.env.GOOGLE_INDEXING_CREDENTIALS_B64;

  if (!b64) {
    // Migration hint if the old (retired) variable is still around.
    if (process.env.GOOGLE_INDEXING_CREDENTIALS) {
      console.error('[google-auth] HEALTH: GOOGLE_INDEXING_CREDENTIALS_B64 missing, but legacy GOOGLE_INDEXING_CREDENTIALS is set — base64-encode the (rotated) key file and set the _B64 variable; the legacy raw-JSON variable is no longer read.');
      throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS_B64 is not set (legacy GOOGLE_INDEXING_CREDENTIALS is ignored — migrate to the base64 variable).');
    }
    console.error('[google-auth] HEALTH: FAILED at env stage — GOOGLE_INDEXING_CREDENTIALS_B64 is not set.');
    throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS_B64 is not set.');
  }

  // Stage 1: base64 decode.
  let json: string;
  try {
    json = Buffer.from(b64.trim(), 'base64').toString('utf8');
    if (!json.trim().startsWith('{')) throw new Error('decoded value is not JSON-shaped');
  } catch (e) {
    console.error('[google-auth] HEALTH: FAILED at DECODE stage — GOOGLE_INDEXING_CREDENTIALS_B64 is not valid base64 (re-encode the key file in one line, no quotes).');
    throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS_B64 failed base64 decoding.', e);
  }

  // Stage 2: JSON parse.
  let creds: GoogleServiceAccount;
  try {
    creds = JSON.parse(json) as GoogleServiceAccount;
  } catch (e) {
    console.error('[google-auth] HEALTH: FAILED at PARSE stage — decoded value is not valid JSON (was the correct file encoded?).');
    throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS_B64 decoded but is not valid JSON.', e);
  }

  // Stage 3: required fields.
  if (!creds || !creds.client_email || !creds.private_key || !creds.project_id) {
    console.error('[google-auth] HEALTH: FAILED at FIELDS stage — JSON parsed but is missing client_email / private_key / project_id (is this the service-account key file?).');
    throw new ConfigError('Service-account JSON is missing required fields (client_email, private_key, project_id).');
  }

  return creds;
}

const SCOPES = [
  'https://www.googleapis.com/auth/indexing',
  'https://www.googleapis.com/auth/webmasters.readonly',
];

/**
 * Build the GoogleAuth instance. `googleapis` is imported lazily so it never
 * bloats the edge/build graph and only loads at request time. Pass THIS to
 * `google.searchconsole({ auth })` / `google.indexing({ auth })` — the API
 * clients accept a GoogleAuth instance directly.
 */
export async function getGoogleAuth() {
  const { google } = await import('googleapis');
  const creds = loadGoogleCredentials();
  return new google.auth.GoogleAuth({
    credentials: { client_email: creds.client_email, private_key: creds.private_key },
    projectId: creds.project_id,
    scopes: SCOPES,
  });
}

/** Resolve a concrete auth client (per the indexing-engine spec). */
export async function getAuthClient() {
  const auth = await getGoogleAuth();
  return auth.getClient();
}
