import { Client } from 'pg';
import { postgresPoolOptions } from '../src/lib/postgres-connection.ts';

if (process.env.NODE_ENV === 'production' || process.env.ALLOW_LOCAL_MIGRATION_MARKER_CLEANUP !== 'true') {
  throw new Error('Migration-marker cleanup is disabled in production and requires explicit local opt-in.');
}
const uri = process.env.DATABASE_URI || process.env.POSTGRES_URL;
if (!uri) throw new Error('An explicit local database is required; there is no default target.');
const options = postgresPoolOptions(uri);
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(options.connectionString).hostname)) {
  throw new Error('Migration-marker cleanup is restricted to a local database.');
}

const client = new Client({ ...options, connectionTimeoutMillis: 5000 });
try {
  await client.connect();
  const r = await client.query("DELETE FROM payload_migrations WHERE batch = -1");
  console.log(`[local maintenance] Removed ${r.rowCount} dev migration marker(s).`);
} catch (err) {
  throw new Error('Local migration-marker cleanup failed; no insecure connection retry is allowed.');
} finally {
  await client.end();
}
