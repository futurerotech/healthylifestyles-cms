import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APPROVED_GSC_DOMAIN,
  GSC_READONLY_SCOPE,
  GSC_SINGLE_READ_OPTIONS,
  createGoogleAdapter,
} from '../../scripts/seo/gsc-isolated-property-probe.mjs';

// The Google SDK is fully mocked. No key file is read, no OAuth token is
// acquired, and no Search Console or other network request is made.
const sdk = vi.hoisted(() => ({
  authOptions: [] as unknown[],
  serviceOptions: [] as unknown[],
  credentials: vi.fn(),
  siteGet: vi.fn(),
}));

vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: class {
        constructor(options: unknown) { sdk.authOptions.push(options); }
        getCredentials = sdk.credentials;
      },
    },
    searchconsole: (options: unknown) => {
      sdk.serviceOptions.push(options);
      return {sites: {get: sdk.siteGet}};
    },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  sdk.authOptions.length = 0;
  sdk.serviceOptions.length = 0;
  sdk.credentials.mockResolvedValue({
    client_email: 'fake@isolated-fixture.iam.gserviceaccount.com',
  });
  sdk.siteGet.mockResolvedValue({
    data: {siteUrl: APPROVED_GSC_DOMAIN, permissionLevel: 'siteRestrictedUser'},
  });
});

describe('one-shot GSC real adapter request options (SDK mocked)', () => {
  it('uses a dedicated key file and the readonly OAuth scope only', async () => {
    const adapter = await createGoogleAdapter({
      keyFile: '/isolated/fictional-service-account.json',
      scope: GSC_READONLY_SCOPE,
    });
    expect(sdk.authOptions).toEqual([{
      keyFile: '/isolated/fictional-service-account.json',
      scopes: [GSC_READONLY_SCOPE],
    }]);
    expect(sdk.serviceOptions).toHaveLength(1);
    expect(sdk.serviceOptions[0]).toMatchObject({version: 'v1'});
    expect(await adapter.getIdentity())
      .toBe('fake@isolated-fixture.iam.gserviceaccount.com');
    expect(sdk.credentials).toHaveBeenCalledTimes(1);
    expect(sdk.siteGet).not.toHaveBeenCalled();
  });

  it('sends one exact-site GET with bounded timeout and no retries', async () => {
    const adapter = await createGoogleAdapter({
      keyFile: '/isolated/fictional-service-account.json',
      scope: GSC_READONLY_SCOPE,
    });
    expect(await adapter.getSite(APPROVED_GSC_DOMAIN)).toEqual({
      siteUrl: APPROVED_GSC_DOMAIN,
      permissionLevel: 'siteRestrictedUser',
    });
    expect(sdk.siteGet).toHaveBeenCalledTimes(1);
    expect(sdk.siteGet).toHaveBeenCalledWith(
      {siteUrl: APPROVED_GSC_DOMAIN},
      {timeout: 10_000, retry: false, retryConfig: {retry: 0, noResponseRetries: 0}},
    );
    expect(GSC_SINGLE_READ_OPTIONS).toMatchObject({
      timeout: 10_000,
      retry: false,
      retryConfig: {retry: 0, noResponseRetries: 0},
    });
  });

  it('does not retry a failed site request within the adapter', async () => {
    const adapter = await createGoogleAdapter({
      keyFile: '/isolated/fictional-service-account.json',
      scope: GSC_READONLY_SCOPE,
    });
    sdk.siteGet.mockRejectedValueOnce(new Error('FICTIONAL_PROVIDER_SECRET'));
    await expect(adapter.getSite(APPROVED_GSC_DOMAIN))
      .rejects.toThrow('FICTIONAL_PROVIDER_SECRET');
    expect(sdk.siteGet).toHaveBeenCalledTimes(1);
    // The CLI owns sanitized error handling; adapter never sends a second GET.
  });
});
