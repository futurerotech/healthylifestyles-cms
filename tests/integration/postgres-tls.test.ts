import { readFile } from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { Client } from 'pg';
import { beforeAll, describe, expect, it } from 'vitest';
import { postgresPoolOptions } from '../../src/lib/postgres-connection';

const source = new URL(process.env.DATABASE_URI || 'postgres://invalid/invalid');
if (process.env.GITHUB_ACTIONS !== 'true' || process.env.RUN_DATABASE_TESTS !== '1' ||
    process.env.CI_POSTGRES_TLS_READY !== '1' ||
    !['localhost', '127.0.0.1'].includes(source.hostname) || source.pathname !== '/mock' || source.username !== 'mock') {
  throw new Error('TLS integration tests require the disposable CI loopback mock service and generated test CA.');
}

describe('real PostgreSQL TLS handshakes using the production pool options', () => {
  let ca: string;
  const uri = (host = 'neon-ci.example.invalid', flags = 'sslmode=require&channel_binding=require') =>
    `postgres://mock:mock@${host}:${source.port || 5432}/mock?${flags}`;
  const connect = async (url: string, certificate?: string) => {
    const client = new Client({ ...postgresPoolOptions(url, certificate), connectionTimeoutMillis: 5000 });
    try {
      await client.connect();
      return await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
    } finally { await client.end(); }
  };
  beforeAll(async () => {
    for (const host of ['neon-ci.example.invalid', 'mismatched-ci.example.invalid']) {
      expect((await lookup(host)).address).toBe('127.0.0.1');
    }
    ca = await readFile(process.env.CI_POSTGRES_CA_FILE!, 'utf8');
  });

  it('executes a real encrypted query and negotiates SCRAM channel binding', async () => {
    const client = new Client({ ...postgresPoolOptions(uri(), ca), connectionTimeoutMillis: 5000 });
    let mechanism: string | undefined;
    (client as any).connection.on('authenticationSASLContinue', () => { mechanism = (client as any).saslSession?.mechanism; });
    try {
      await client.connect();
      const { rows } = await client.query('SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()');
      expect(rows[0].ssl).toBe(true);
      expect(['TLSv1.2', 'TLSv1.3']).toContain(rows[0].version);
      expect(mechanism).toBe('SCRAM-SHA-256-PLUS');
    } finally { await client.end(); }
  });
  it.each(['sslmode=disable', 'sslmode=no-verify&uselibpqcompat=true'])('URI %s cannot downgrade the actual TLS session', async flags => {
    const result = await connect(uri(undefined, flags), ca);
    expect(result.rows[0].ssl).toBe(true);
  });
  it('rejects a CA that is not trusted by Node instead of retrying without verification', async () => {
    await expect(connect(uri())).rejects.toMatchObject({ code: expect.stringMatching(/CERT|ISSUER|SELF_SIGNED|VERIFY_LEAF_SIGNATURE/) });
  });
  it('rejects an incorrect certificate hostname even with the trusted test CA', async () => {
    await expect(connect(uri('mismatched-ci.example.invalid'), ca)).rejects.toMatchObject({ code: 'ERR_TLS_CERT_ALTNAME_INVALID' });
  });
});
