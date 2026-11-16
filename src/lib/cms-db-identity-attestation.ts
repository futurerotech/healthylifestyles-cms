/**
 * Opt-in read-only role attestation through Payload's EXISTING Postgres adapter.
 * OFF unless CMS_DB_IDENTITY_AUDIT=1. Never logs URI, DB name, login name,
 * host, credentials, driver error text, or any application data.
 */
export const CMS_DB_IDENTITY_SQL = [
  'SELECT current_user::text AS active_role,',
  '       session_user::text AS login_role,',
  '       current_database()::text AS database_name,',
  '       r.rolbypassrls AS can_bypass_rls,',
  '       r.rolsuper AS is_superuser,',
  '       (SELECT count(*)::int FROM pg_catalog.pg_class AS c',
  '         JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace',
  "         WHERE n.nspname = 'public' AND c.relkind IN ('r','p')) AS public_tables,",
  '       (SELECT count(*)::int FROM pg_catalog.pg_class AS c',
  '         JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace',
  "         WHERE n.nspname = 'public' AND c.relkind IN ('r','p')",
  '           AND NOT pg_catalog.row_security_active(c.oid)) AS inactive_public_rls_tables',
  '  FROM pg_catalog.pg_roles AS r',
  ' WHERE r.rolname = current_user',
].join('\n');

export type CmsDbIdentityStatus =
  | 'DISABLED' | 'CONFIG_INVALID' | 'QUERY_FAILED' | 'EVIDENCE_INVALID'
  | 'IDENTITY_MISMATCH' | 'RLS_BYPASS' | 'RLS_NOT_ACTIVE_FOR_ROLE' | 'RLS_ACTIVE_FOR_ROLE';

interface Options {
  enabled: boolean;
  connectionString?: string;
  query: (staticReadOnlySql: string) => Promise<unknown>;
  log: (sanitizedEvent: string) => void;
}
interface IdentityRow {
  active_role: string;
  login_role: string;
  database_name: string;
  can_bypass_rls: boolean;
  is_superuser: boolean;
  public_tables: number;
  inactive_public_rls_tables: number;
}

function isIdentityRow(value: unknown): value is IdentityRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.active_role === 'string' && row.active_role.length > 0 &&
    typeof row.login_role === 'string' && row.login_role.length > 0 &&
    typeof row.database_name === 'string' && row.database_name.length > 0 &&
    typeof row.can_bypass_rls === 'boolean' && typeof row.is_superuser === 'boolean' &&
    Number.isInteger(row.public_tables) && Number(row.public_tables) >= 0 &&
    Number.isInteger(row.inactive_public_rls_tables) && Number(row.inactive_public_rls_tables) >= 0 &&
    Number(row.inactive_public_rls_tables) <= Number(row.public_tables);
}
function getRows(result: unknown): unknown[] | null {
  if (Array.isArray(result)) return result;
  if (result && typeof result === 'object' && 'rows' in result &&
      Array.isArray((result as { rows: unknown }).rows)) {
    return (result as { rows: unknown[] }).rows;
  }
  return null;
}

/**
 * Never connects by itself: caller provides a query against the existing
 * Payload Drizzle adapter. No SQL or logging occurs when the flag is disabled.
 * Does NOT prove RLS policy correctness or every session in a connection pool.
 * Query or diagnostic logger failures never interrupt CMS startup.
 */
export async function auditCmsDbIdentity(options: Options): Promise<CmsDbIdentityStatus> {
  if (!options.enabled) return 'DISABLED';
  const emit = (status: CmsDbIdentityStatus): CmsDbIdentityStatus => {
    try { options.log('CMS_DB_IDENTITY_ATTESTATION=' + status); } catch {
      // This optional diagnostic must never interrupt CMS startup.
    }
    return status;
  };
  let expectedRole: string;
  let expectedDatabase: string;
  try {
    const url = new URL(options.connectionString || '');
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname ||
        url.hash || !url.username || url.pathname.length < 2) return emit('CONFIG_INVALID');
    expectedRole = decodeURIComponent(url.username);
    expectedDatabase = decodeURIComponent(url.pathname.slice(1));
    if (!expectedRole || !expectedDatabase || expectedDatabase.includes('/')) return emit('CONFIG_INVALID');
  } catch {
    return emit('CONFIG_INVALID');
  }
  let evidence: unknown;
  try {
    evidence = await options.query(CMS_DB_IDENTITY_SQL);
  } catch {
    // Driver exceptions can contain DSN/host details: do NOT relay them.
    return emit('QUERY_FAILED');
  }
  const rows = getRows(evidence);
  if (!rows || rows.length !== 1 || !isIdentityRow(rows[0])) return emit('EVIDENCE_INVALID');
  const row = rows[0];
  if (row.active_role !== expectedRole || row.login_role !== expectedRole ||
      row.database_name !== expectedDatabase) return emit('IDENTITY_MISMATCH');
  if (row.can_bypass_rls || row.is_superuser) return emit('RLS_BYPASS');
  if (row.public_tables === 0 || row.inactive_public_rls_tables !== 0) return emit('RLS_NOT_ACTIVE_FOR_ROLE');
  return emit('RLS_ACTIVE_FOR_ROLE');
}
