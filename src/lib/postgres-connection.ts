/** Verified remote TLS for pg/Payload; Neon uses Node's public CA roots. */
export function postgresPoolOptions(connectionString: string, certificate?: string) {
  let url: URL;
  try { url = new URL(connectionString); }
  catch { throw new Error('DATABASE_URI must be a valid PostgreSQL URL.'); }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname || url.pathname.length < 2 || url.hash) {
    throw new Error('DATABASE_URI must identify a PostgreSQL host and database.');
  }
  // pg applies query parameters after parsing the authority. A query-host could
  // otherwise disguise a remote destination as a plaintext loopback connection.
  const targetOverrides = new Set(['host', 'hostaddr', 'port', 'user', 'password', 'database', 'dbname']);
  for (const key of [...url.searchParams.keys()]) {
    const lower = key.toLowerCase();
    if (targetOverrides.has(lower)) throw new Error('DATABASE_URI must define its target in the URL authority/path, not query parameters.');
    // URI SSL flags replace pg's explicit ssl object (including its CA/checks).
    if (lower.startsWith('ssl') || lower === 'uselibpqcompat') url.searchParams.delete(key);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  const ca = certificate?.replace(/\\n/g, '\n').trim();
  const plaintextLoopback = local && !ca;
  return {
    connectionString: url.toString(),
    ssl: plaintextLoopback ? false as const : {
      rejectUnauthorized: true as const,
      minVersion: 'TLSv1.2' as const,
      ...(ca ? { ca } : {}),
    },
    // Prefer SCRAM-SHA-256-PLUS when the server offers it. Certificate and
    // hostname verification remain mandatory independently of channel binding.
    enableChannelBinding: !plaintextLoopback,
  };
}
