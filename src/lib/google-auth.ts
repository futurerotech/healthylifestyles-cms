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

/** Parse + validate the service-account JSON from the environment. */
export function loadGoogleCredentials(): GoogleServiceAccount {
  const raw = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!raw) throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS is not set');
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.client_email || !parsed.private_key || !parsed.project_id) {
      throw new Error('Incomplete service account JSON');
    }
    return parsed as GoogleServiceAccount;
  } catch (e) {
    // Never echo `raw` — it contains the private key.
    throw new ConfigError('GOOGLE_INDEXING_CREDENTIALS contains invalid JSON', e);
  }
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
