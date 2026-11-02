// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  blockedBacklinkAddress, fetchSafeBacklink, selectPublicDnsAddress,
  validatePublicBacklinkUrl, type BacklinkPage, type BacklinkTransport,
} from './backlink-safe-request';

const opts = { signal: new AbortController().signal, userAgent: 'HLS-test' };
function page(status: number, html = '<html>public</html>', location?: string): BacklinkPage {
  return {
    status,
    location,
    contentType: 'text/html; charset=utf-8',
    body: (async function* () { yield Buffer.from(html); })(),
    close: vi.fn(),
  };
}

describe('public-only backlink HTTP policy', () => {
  it('blocks internal URL literals and non-web/credential/port schemes', () => {
    for (const value of [
      'http://127.0.0.1/', 'http://0177.0.0.1/', 'http://0x7f000001/',
      'http://169.254.169.254/latest/meta-data', 'http://10.0.0.1/',
      'http://[::1]/', 'http://[fc00::1]/',
      'http://localhost/', 'https://metadata.google.internal/',
      'http://private.local/', 'file:///etc/passwd',
      'https://user:password@example.com/', 'http://public.example:8080/',
    ]) expect(() => validatePublicBacklinkUrl(value)).toThrow();
    expect(validatePublicBacklinkUrl('https://public.example/path').hostname).toBe('public.example');
  });

  it('rejects private DNS answers and mixed public/private replies', () => {
    expect(blockedBacklinkAddress('127.0.0.1')).toBe(true);
    expect(blockedBacklinkAddress('169.254.169.254')).toBe(true);
    expect(blockedBacklinkAddress('::1')).toBe(true);
    expect(blockedBacklinkAddress('8.8.8.8')).toBe(false);
    expect(() => selectPublicDnsAddress([{address:'8.8.8.8',family:4},{address:'10.0.0.2',family:4}])).toThrow();
    expect(() => selectPublicDnsAddress([{address:'fc00::1',family:6}])).toThrow();
    expect(selectPublicDnsAddress([{address:'2606:4700:4700::1111',family:6},{address:'8.8.8.8',family:4}]))
      .toMatchObject({address:'8.8.8.8',family:4});
  });

  it('denies a public redirect to metadata/loopback before making the second request', async () => {
    const transport: BacklinkTransport = vi.fn(async () => page(302, '', 'http://169.254.169.254/latest/meta-data/'));
    await expect(fetchSafeBacklink('https://public.example/redirect', opts, transport))
      .rejects.toThrow(/public destination/);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('follows bounded public redirects with validated destination, keeping the response', async () => {
    const transport: BacklinkTransport = vi.fn()
      .mockResolvedValueOnce(page(301, '', 'https://other-public.example/link'))
      .mockResolvedValueOnce(page(200, '<html><a href="https://www.healthylifesstyles.com/tools/bmi-calculator">ok</a></html>'));
    const result = await fetchSafeBacklink('http://referrer.example/old', opts, transport);
    expect(transport).toHaveBeenCalledTimes(2);
    expect(result.ok).toBe(true);
    expect(await result.text()).toContain('/tools/bmi-calculator');
  });

  it('bounds redirects and HTML body size without marking a link lost', async () => {
    const redirector: BacklinkTransport = vi.fn(async () => page(302, '', '/again'));
    await expect(fetchSafeBacklink('https://public.example/again', opts, redirector))
      .rejects.toThrow(/redirect limit/);
    expect(redirector).toHaveBeenCalledTimes(4);
    const tooLarge: BacklinkTransport = vi.fn(async () => page(200, 'x'.repeat(1024 * 1024 + 1)));
    await expect(fetchSafeBacklink('https://public.example/large', opts, tooLarge))
      .rejects.toThrow(/size limit/);
  });

  it('treats non-HTML success as inconclusive and preserves actual 404 status', async () => {
    const nonHtml: BacklinkTransport = vi.fn(async () => ({...page(200), contentType: 'application/json'}));
    const result = await fetchSafeBacklink('https://public.example/data', opts, nonHtml);
    expect(result.status).toBe(200);
    expect(result.ok).toBe(false);
    const missing: BacklinkTransport = vi.fn(async () => page(404));
    const notFound = await fetchSafeBacklink('https://public.example/missing', opts, missing);
    expect(notFound.status).toBe(404);
    expect(notFound.ok).toBe(false);
  });
});
