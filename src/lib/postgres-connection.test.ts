// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { postgresPoolOptions } from './postgres-connection';

describe('PostgreSQL transport verification', () => {
  it.each(['disable', 'no-verify', 'require', 'prefer', 'verify-full'])('cannot disable verification through sslmode=%s', (mode) => {
    const options = postgresPoolOptions(`postgres://review:mock@db.example.invalid/content?sslmode=${mode}&application_name=review`);
    // Inspect the real driver's final configuration without making a connection.
    const client = new Client(options);
    const actual = client as unknown as { connectionParameters: { ssl: unknown } };
    expect(actual.connectionParameters.ssl).toEqual({ rejectUnauthorized: true });
    expect(new URL(options.connectionString).searchParams.get('application_name')).toBe('review');
  });
  it('uses a provider CA without exposing the URI or disabling verification', () => {
    expect(postgresPoolOptions('postgres://review:mock@db.example.invalid/content?sslrootcert=untrusted', 'provider\\ncertificate').ssl)
      .toEqual({ rejectUnauthorized: true, ca: 'provider\ncertificate' });
  });
  it.each(['localhost', '127.0.0.1', '[::1]'])('supports isolated local PostgreSQL on %s', (host) => {
    expect(postgresPoolOptions(`postgres://mock:mock@${host}/mock?sslmode=require`).ssl).toBe(false);
  });
  it.each(['invalid', 'https://db.example.invalid'])('rejects invalid database configuration without echoing it', (uri) => {
    expect(() => postgresPoolOptions(uri)).toThrow(/DATABASE_URI/);
  });
});
