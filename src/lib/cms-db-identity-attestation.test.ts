import { describe, expect, it, vi } from 'vitest';
import { auditCmsDbIdentity, CMS_DB_IDENTITY_SQL } from './cms-db-identity-attestation';

const uri = 'postgresql://neondb_owner:TEST_SECRET_NEVER_LOG@localhost:5432/neondb?sslmode=require';
const role = {
  active_role: 'neondb_owner', login_role: 'neondb_owner', database_name: 'neondb',
  can_bypass_rls: true, is_superuser: false,
  public_tables: 157, inactive_public_rls_tables: 157,
};
describe('optional runtime DB principal evidence', () => {
  it('does nothing at all unless explicitly enabled', async () => {
    const query = vi.fn(); const log = vi.fn();
    expect(await auditCmsDbIdentity({ enabled: false, connectionString: uri, query, log })).toBe('DISABLED');
    expect(query).not.toHaveBeenCalled(); expect(log).not.toHaveBeenCalled();
  });
  it('uses only one static SELECT through the Payload adapter', async () => {
    const query = vi.fn(async () => ({ rows: [role] })); const log = vi.fn();
    expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri, query, log })).toBe('RLS_BYPASS');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(CMS_DB_IDENTITY_SQL);
    expect(CMS_DB_IDENTITY_SQL.trim().startsWith('SELECT ')).toBe(true);
    expect(CMS_DB_IDENTITY_SQL).not.toMatch(/\b(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP)\b/i);
    expect(log.mock.calls).toEqual([['CMS_DB_IDENTITY_ATTESTATION=RLS_BYPASS']]);
  });
  it('classifies a matching non-bypass role without claiming policy validity', async () => {
    const log = vi.fn();
    expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri,
      query: async () => [{ ...role, can_bypass_rls: false, inactive_public_rls_tables: 0 }], log })).toBe('RLS_ACTIVE_FOR_ROLE');
    expect(log).toHaveBeenCalledWith('CMS_DB_IDENTITY_ATTESTATION=RLS_ACTIVE_FOR_ROLE');
  });
  it('never confuses a non-bypass role with effective RLS if some tables are inactive', async () => {
    const log = vi.fn();
    expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri,
      query: async () => ({ rows: [{ ...role, can_bypass_rls: false, inactive_public_rls_tables: 13 }] }),
      log })).toBe('RLS_NOT_ACTIVE_FOR_ROLE');
    expect(log).toHaveBeenCalledWith('CMS_DB_IDENTITY_ATTESTATION=RLS_NOT_ACTIVE_FOR_ROLE');
  });
  it('rejects role or database mismatch without leaking the names', async () => {
    for (const changed of [
      { active_role: 'another_user' }, { login_role: 'another_user' }, { database_name: 'other_db' },
    ]) {
      const log = vi.fn();
      expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri,
        query: async () => ({ rows: [{ ...role, ...changed }] }), log })).toBe('IDENTITY_MISMATCH');
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/neondb_owner|TEST_SECRET_NEVER_LOG|another_user|other_db/);
    }
  });
  it('refuses incomplete URIs and malformed SQL evidence', async () => {
    for (const input of ['postgresql://neondb_owner','postgresql://host','not a url',
      'postgres://u:p@host/','https://u:p@host/db','postgres://u:p@host/db#fragment']) {
      const query = vi.fn();
      expect(await auditCmsDbIdentity({ enabled: true, connectionString: input,
        query, log: vi.fn() })).toBe('CONFIG_INVALID');
      expect(query).not.toHaveBeenCalled();
    }
    expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri,
      query: async () => ({ rows: [{ ...role, can_bypass_rls: 't' }] }), log: vi.fn() })).toBe('EVIDENCE_INVALID');
  });
  it('redacts driver errors and cannot interrupt startup on a logger failure', async () => {
    const log = vi.fn();
    expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri,
      query: async () => { throw new Error('connection failure ' + uri); }, log })).toBe('QUERY_FAILED');
    expect(log.mock.calls).toEqual([['CMS_DB_IDENTITY_ATTESTATION=QUERY_FAILED']]);
    expect(JSON.stringify(log.mock.calls)).not.toContain('TEST_SECRET_NEVER_LOG');
    expect(await auditCmsDbIdentity({ enabled: true, connectionString: uri,
      query: async () => ({ rows: [role] }),
      log: () => { throw new Error('logger down'); } })).toBe('RLS_BYPASS');
  });
});
