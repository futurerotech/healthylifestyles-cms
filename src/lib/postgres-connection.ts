/** Enforce verified TLS remotely, independent of SSL flags embedded in the URI. */
export function postgresPoolOptions(connectionString: string, certificate?: string) {
  let url: URL;
  try { url = new URL(connectionString); } catch { throw new Error('DATABASE_URI must be a valid PostgreSQL connection URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URI must use PostgreSQL.');
  const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  // pg parses these after the explicit pool options and could otherwise replace
  // verified TLS with sslmode=no-verify or sslmode=disable from the URI.
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('ssl') || key.toLowerCase() === 'uselibpqcompat') url.searchParams.delete(key);
  }
  const ca = certificate?.replace(/\\n/g, '\n').trim();
  return {
    connectionString: url.toString(),
    ssl: local ? false as const : { rejectUnauthorized: true as const, ...(ca ? { ca } : {}) },
  };
}
