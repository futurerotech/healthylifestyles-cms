// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import { Client } from 'pg';
import { rootCertificates } from 'node:tls';
import { X509Certificate } from 'node:crypto';
import { postgresPoolOptions } from './postgres-connection';

const sslOf = (client: Client) => (client as any).connectionParameters.ssl;
afterEach(() => vi.unstubAllEnvs());

describe('Neon-compatible PostgreSQL TLS', () => {
  it('has the public ISRG Root X1 used by Neon in this Node runtime', () => {
    expect(rootCertificates.some(pem => new X509Certificate(pem).subject.includes('ISRG Root X1'))).toBe(true);
  });
  it.each(['disable', 'no-verify', 'require', 'prefer', 'verify-ca', 'verify-full'])('does not let sslmode=%s weaken the real driver', mode => {
    const options = postgresPoolOptions(`postgres://mock:mock@neon.example.invalid/mock?sslmode=${mode}&channel_binding=require&application_name=hls`);
    const client = new Client(options);
    expect(sslOf(client)).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    expect((client as any).enableChannelBinding).toBe(true);
    expect(new URL(options.connectionString).searchParams.get('application_name')).toBe('hls');
    expect(new URL(options.connectionString).searchParams.get('channel_binding')).toBe('require');
  });
  it('uses Node public roots by default, even when libpq or environment flags request weaker TLS', () => {
    vi.stubEnv('PGSSLMODE', 'no-verify');
    const client = new Client(postgresPoolOptions('postgres://mock:mock@neon.example.invalid/mock?uselibpqcompat=true&sslmode=require&sslrootcert=invalid&ssl=false'));
    expect(sslOf(client)).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2' });
    expect(sslOf(client)).not.toHaveProperty('checkServerIdentity');
  });
  it('supports an explicit CA without changing the verification rules', () => {
    const options = postgresPoolOptions('postgres://mock:mock@neon.example.invalid/mock?sslcert=invalid&sslkey=invalid', 'test\\nCA');
    expect(sslOf(new Client(options))).toEqual({ rejectUnauthorized: true, minVersion: 'TLSv1.2', ca: 'test\nCA' });
  });
  it.each(['localhost', '127.0.0.1', '[::1]'])('supports the disposable plaintext loopback database on %s only', host => {
    const options = postgresPoolOptions(`postgres://mock:mock@${host}/mock?sslmode=require`);
    expect(sslOf(new Client(options))).toBe(false);
    expect(options.enableChannelBinding).toBe(false);
    expect(postgresPoolOptions(`postgres://mock:mock@${host}/mock`, 'test CA').ssl).toMatchObject({ rejectUnauthorized: true });
  });
  it.each(['host', 'hostaddr', 'port', 'user', 'password', 'database', 'dbname', 'HOST'])('rejects query %s target overrides before choosing loopback policy', key => {
    expect(() => postgresPoolOptions(`postgres://mock:mock@localhost/mock?${key}=remote.example.invalid`)).toThrow(/authority\/path/);
  });
  it.each(['invalid-secret', 'https://mock:private@db.example.invalid/mock', 'postgres:///mock', 'postgres://db.example.invalid', 'postgres://db.example.invalid/mock#secret'])('rejects invalid URLs without echoing credentials', uri => {
    expect(() => postgresPoolOptions(uri)).toThrow(/DATABASE_URI/);
    try { postgresPoolOptions(uri); } catch (error) { expect(String(error)).not.toContain(uri); }
  });
});
