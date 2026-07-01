import { Client } from 'pg';
import { readFileSync, existsSync } from 'fs';

const uri = process.env.DATABASE_URI
  || process.env.POSTGRES_URL
  || 'postgres://localhost:5432/postgres';

const ssl =
  uri.includes('localhost') || uri.includes('127.0.0.1') ? false : { rejectUnauthorized: false };

const client = new Client({ connectionString: uri, ssl });
try {
  await client.connect();
  const r = await client.query("DELETE FROM payload_migrations WHERE batch = -1");
  console.log(`[prebuild] Removed ${r.rowCount} dev migration marker(s) — prompt avoided`);
} catch (err) {
  console.warn('[prebuild] Could not clean dev migration markers:', err.message);
} finally {
  await client.end();
}
