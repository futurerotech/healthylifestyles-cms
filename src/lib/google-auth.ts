/**
 * Google service-account bootstrap for the Search Console + Indexing APIs.
 *
 * SECURITY: the credential is read ONLY from the GOOGLE_INDEXING_CREDENTIALS
 * environment variable (a minified JSON string). It is never written to disk,
 * never committed, and never logged — error messages here are deliberately
 * generic and never include the key, private_key, or client_email.
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
 * Robustly parse the service-account JSON from a host environment variable.
 *
 * Handles the common ways hosts (Hostinger, shells, dashboards) mangle the
 * value, in order:
 *   1. Trim and unwrap an accidental outer quote pair.
 *   2. Try a direct JSON.parse (the correct case — escaped "\n" inside the
 *      private key are valid JSON and become real newlines).
 *   3. If that throws, the host likely turned escaped newlines/tabs into REAL
 *      control characters inside string values (invalid JSON) — re-escape and
 *      retry. (We do NOT re-escape before a successful parse, which would
 *      corrupt a correctly-formatted value.)
 *   4. After parsing, normalize a double-escaped private key (literal "\\n"
 *      → newline). No-op when the key already has real newlines.
 *
 * Never logs `raw` or the key.
 */
function parseServiceAccount(raw: string): GoogleServiceAccount {
  let s = raw.trim();
  if (s.length >= 2) {
    const first = s[0];
    const last = s[s.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      const inner = s.slice(1, -1).trim();
      if (inner.startsWith('{')) s = inner;
    }
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(s);
  } catch {
    // Fallback: re-escape real control chars the host injected into strings.
    const reEscaped = s.replace(/\r\n/g, '\\n').replace(/\n/g, '\\n').replace(/\r/g, '\\n').replace(/\t/g, '\\t');
    parsed = JSON.parse(reEscaped); // may throw → handled by loadGoogleCredentials
  }

  if (parsed && typeof parsed.private_key === 'string') {
    // Convert any remaining literal "\n" / "\r\n" (double-escaped) into real newlines.
    parsed.private_key = parsed.private_key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }

  return parsed as unknown as GoogleServiceAccount;
}

/** Parse + validate the service-account JSON from the environment. */
export function loadGoogleCredentials(): GoogleServiceAccount {
  const raw = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!raw) throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS is not set');

  let creds: GoogleServiceAccount;
  try {
    creds = parseServiceAccount(raw);
  } catch (e) {
    // Never echo `raw` — it contains the private key.
    throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS contains invalid JSON after sanitization attempt.', e);
  }

  if (!creds || !creds.client_email || !creds.private_key || !creds.project_id) {
    throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS is missing required fields (client_email, private_key, project_id).');
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
