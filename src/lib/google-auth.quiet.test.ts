import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadGoogleCredentials } from './google-auth';

const oldRaw = process.env.GOOGLE_INDEXING_CREDENTIALS;
const oldB64 = process.env.GOOGLE_INDEXING_CREDENTIALS_B64;
const fixture = JSON.stringify({
  client_email: 'example@not-a-real-account.invalid',
  private_key: 'MOCK_KEY_NOT_VALID',
  project_id: 'fixture-project',
});

afterEach(() => {
  if (oldRaw === undefined) delete process.env.GOOGLE_INDEXING_CREDENTIALS;
  else process.env.GOOGLE_INDEXING_CREDENTIALS = oldRaw;
  if (oldB64 === undefined) delete process.env.GOOGLE_INDEXING_CREDENTIALS_B64;
  else process.env.GOOGLE_INDEXING_CREDENTIALS_B64 = oldB64;
  vi.restoreAllMocks();
});

describe('GSC silent credential loading', () => {
  it('does not log fake account identity or project on successful quiet load', () => {
    process.env.GOOGLE_INDEXING_CREDENTIALS = fixture;
    delete process.env.GOOGLE_INDEXING_CREDENTIALS_B64;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(loadGoogleCredentials({quiet:true})).toMatchObject({
      client_email:'example@not-a-real-account.invalid',
      project_id:'fixture-project',
    });
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it('does not write to console on missing or malformed quiet configuration', () => {
    delete process.env.GOOGLE_INDEXING_CREDENTIALS;
    process.env.GOOGLE_INDEXING_CREDENTIALS_B64 = 'not-valid-base64';
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => loadGoogleCredentials({quiet:true})).toThrow();
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
  it('preserves existing default logging behavior for unrelated indexing callers', () => {
    process.env.GOOGLE_INDEXING_CREDENTIALS = fixture;
    delete process.env.GOOGLE_INDEXING_CREDENTIALS_B64;
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    loadGoogleCredentials();
    expect(log).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledTimes(1);
  });
});
