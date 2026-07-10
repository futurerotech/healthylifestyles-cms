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

/** The service account expected on the GSC property (drift detection only). */
const EXPECTED_CLIENT_EMAIL = 'healthylifestyles@healthylifestyles-index.iam.gserviceaccount.com';

const parseJson = (s: string): GoogleServiceAccount | null => {
  try {
    const v = JSON.parse(s) as GoogleServiceAccount;
    return v && typeof v === 'object' ? v : null;
  } catch {
    return null;
  }
};

const parseB64Json = (s: string): GoogleServiceAccount | null => {
  try {
    const decoded = Buffer.from(s.trim(), 'base64').toString('utf8');
    return decoded.trim().startsWith('{') ? parseJson(decoded) : null;
  } catch {
    return null;
  }
};

/**
 * Load + validate the service-account credentials (Phase 14 hotfix contract).
 *
 * Resolution order (first that parses wins):
 *   1. GOOGLE_INDEXING_CREDENTIALS      as raw JSON
 *   2. GOOGLE_INDEXING_CREDENTIALS      as base64 → JSON   (the "b64 pasted
 *      into the plain var" trap — previously an unexplained hard failure)
 *   3. GOOGLE_INDEXING_CREDENTIALS_B64  as base64 → JSON   (canonical)
 *
 * FAIL LOUD: if nothing resolves, throws ConfigError with remediation — there
 * is deliberately NO fallback to an unauthenticated client, ever. Health log
 * names the winning source (or every failed stage); key material, raw env
 * values, and decoded JSON are never logged. Drift detection: warns when
 * client_email differs from the expected service account.
 */
export function loadGoogleCredentials(): GoogleServiceAccount {
  const plain = process.env.GOOGLE_INDEXING_CREDENTIALS;
  const b64 = process.env.GOOGLE_INDEXING_CREDENTIALS_B64;

  let creds: GoogleServiceAccount | null = null;
  let source = '';
  if (plain) {
    creds = parseJson(plain);
    source = 'GOOGLE_INDEXING_CREDENTIALS (raw JSON)';
    if (!creds) {
      creds = parseB64Json(plain);
      source = 'GOOGLE_INDEXING_CREDENTIALS (base64)';
    }
  }
  if (!creds && b64) {
    creds = parseB64Json(b64);
    source = 'GOOGLE_INDEXING_CREDENTIALS_B64 (base64)';
  }

  if (!creds) {
    console.error(
      `[google-auth] HEALTH: FAILED to resolve credentials — tried GOOGLE_INDEXING_CREDENTIALS as JSON${plain ? ' (set, unparseable)' : ' (unset)'}, as base64, and GOOGLE_INDEXING_CREDENTIALS_B64${b64 ? ' (set, unparseable)' : ' (unset)'}. Re-encode the (rotated) key file: base64 -w0 service-account.json → set GOOGLE_INDEXING_CREDENTIALS_B64.`,
    );
    throw new ConfigError(
      'Google service-account credentials could not be resolved from GOOGLE_INDEXING_CREDENTIALS (JSON or base64) or GOOGLE_INDEXING_CREDENTIALS_B64 (base64). Encode the key file to one base64 line and set GOOGLE_INDEXING_CREDENTIALS_B64.',
    );
  }

  if (!creds.client_email || !creds.private_key || !creds.project_id) {
    console.error(`[google-auth] HEALTH: FAILED at FIELDS stage — ${source} parsed but is missing client_email / private_key / project_id (is this the service-account key file?).`);
    throw new ConfigError('Service-account JSON is missing required fields (client_email, private_key, project_id).');
  }

  // Wrong-key drift detection (client_email + project_id are safe to log).
  if (creds.client_email !== EXPECTED_CLIENT_EMAIL) {
    console.error(`[google-auth] WARNING: client_email drift — credentials are for "${creds.client_email}" but the GSC property owner is expected to be "${EXPECTED_CLIENT_EMAIL}". If inspections fail with "Permission denied", this is why.`);
  }

  console.log(`[google-auth] credentials resolved from ${source} — client_email=${creds.client_email} project_id=${creds.project_id}`);
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
