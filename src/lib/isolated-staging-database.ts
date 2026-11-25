/**
 * Fail closed when the opted-in Hostinger staging CMS could accidentally
 * connect to the known live Neon compute endpoint.
 *
 * These operator-supplied hostnames are a configuration cross-check, NOT
 * evidence that a separate staging database/branch actually exists.
 * Release acceptance still requires inspecting the Neon branch identity
 * and an independently tested rollback.
 *
 * Never log DATABASE_URI or any credentials.
 */
export interface StagingDatabaseIdentity {
  databaseUri: string;
  stagingHost?: string;
  productionHost?: string;
  ciMockRuntime?: boolean;
}

const CI_DATABASE_URI = 'postgres://mock:mock@localhost:5432/mock';

function hostnameOnly(value: unknown): string | null {
  if (typeof value !== 'string' || value.length < 4 || value.length > 253 ||
      value !== value.trim() || value.endsWith('.') ||
      !/^[a-z0-9.-]+$/.test(value)) return null;
  try {
    const parsed = new URL('https://' + value);
    if (parsed.hostname !== value || parsed.port || parsed.username ||
        parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash ||
        !parsed.hostname.includes('.')) return null;
    return parsed.hostname;
  } catch {
    return null;
  }
}

/** Neon direct and -pooler hosts can refer to the SAME compute/branch. */
function computeIdentity(host: string): string {
  return host.replace(/-pooler(?=\.)/g, '');
}

export function assertIsolatedStagingDatabase(input: StagingDatabaseIdentity): void {
  if (input.ciMockRuntime === true && input.databaseUri === CI_DATABASE_URI) return;

  let actual: URL;
  try {
    actual = new URL(input.databaseUri);
  } catch {
    throw new Error('Staging database configuration is invalid; startup refused.');
  }
  if (!['postgres:', 'postgresql:'].includes(actual.protocol) ||
      !actual.username || !actual.password ||
      actual.hostname.endsWith('.') || actual.hash ||
      !hostnameOnly(actual.hostname)) {
    throw new Error('Staging database configuration is invalid; startup refused.');
  }
  const staging = hostnameOnly(input.stagingHost);
  const production = hostnameOnly(input.productionHost);
  if (!staging || !production ||
      computeIdentity(staging) === computeIdentity(production) ||
      computeIdentity(actual.hostname) !== computeIdentity(staging)) {
    throw new Error('Isolated staging database host is not independently verified; startup refused.');
  }
}
