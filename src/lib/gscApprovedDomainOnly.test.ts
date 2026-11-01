import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Payload, PayloadRequest } from 'payload';

const sdk = vi.hoisted(() => ({
  credentials: vi.fn(),
  sites: vi.fn(),
  searchAnalytics: vi.fn(),
  service: vi.fn(),
}));

// A real-looking URL-prefix property may be registered in Search Console,
// but it is NOT the approved Domain property for this operator workflow.
vi.mock('./site-config', () => ({
  GSC_SITE_URL: 'https://www.healthylifesstyles.com/',
  APPROVED_GSC_DOMAIN_PROPERTY: 'sc-domain:healthylifesstyles.com',
}));
vi.mock('./google-auth', () => ({
  loadGoogleCredentials: sdk.credentials,
}));
vi.mock('googleapis', () => ({
  google: {
    auth: { GoogleAuth: class {} },
    searchconsole: sdk.service,
  },
}));

import {
  probeStaffGoogleReadOnlyProperty,
  collectStaffGoogleReadOnlyReport,
  collectStaffGoogleReadOnlyEditorialQueue,
} from './gscAuthorizedReadOnlyAnalytics';

const staff = { user: { id: 1, role: 'editor' } } as PayloadRequest;
const periods = {
  previous: { startDate: '2026-08-01', endDate: '2026-08-28' },
  current: { startDate: '2026-08-29', endDate: '2026-09-25' },
};
const envNames = [
  'HLS_ISOLATED_STAGING',
  'HLS_GSC_PROPERTY_PROBE_ENABLED',
  'HLS_GSC_ISOLATED_PROPERTY_PROBE_APPROVED',
  'HLS_GSC_READONLY_ENABLED',
] as const;
const envBefore = Object.fromEntries(envNames.map(name => [name, process.env[name]]));

describe('configured URL-prefix must never substitute for approved GSC Domain property', () => {
  beforeEach(() => {
    sdk.credentials.mockClear();
    sdk.service.mockClear();
    sdk.sites.mockClear();
    sdk.searchAnalytics.mockClear();
  });
  afterEach(() => {
    for (const name of envNames) {
      const original = envBefore[name];
      if (original === undefined) delete process.env[name];
      else process.env[name] = original;
    }
  });

  it('blocks isolated property-only inspection before loading a service-account key', async () => {
    process.env.HLS_ISOLATED_STAGING = 'true';
    process.env.HLS_GSC_PROPERTY_PROBE_ENABLED = 'true';
    process.env.HLS_GSC_ISOLATED_PROPERTY_PROBE_APPROVED = 'true';
    delete process.env.HLS_GSC_READONLY_ENABLED;

    await expect(probeStaffGoogleReadOnlyProperty(staff))
      .rejects.toThrow('Configured Search Console property is not the approved Domain property.');
    expect(sdk.credentials).not.toHaveBeenCalled();
    expect(sdk.service).not.toHaveBeenCalled();
  });

  it('blocks the real Search Analytics path before creating Google auth', async () => {
    delete process.env.HLS_ISOLATED_STAGING;
    process.env.HLS_GSC_READONLY_ENABLED = 'true';

    await expect(collectStaffGoogleReadOnlyReport(staff, periods))
      .rejects.toThrow('Configured Search Console property is not the approved Domain property.');
    expect(sdk.credentials).not.toHaveBeenCalled();
    expect(sdk.service).not.toHaveBeenCalled();
  });

  it('blocks combined editorial queue before reading CMS or contacting Google', async () => {
    delete process.env.HLS_ISOLATED_STAGING;
    process.env.HLS_GSC_READONLY_ENABLED = 'true';
    const cms = { find: vi.fn() };

    await expect(collectStaffGoogleReadOnlyEditorialQueue(
      staff, periods, cms as unknown as Pick<Payload, 'find'>,
    )).rejects.toThrow('Configured Search Console property is not the approved Domain property.');
    expect(cms.find).not.toHaveBeenCalled();
    expect(sdk.credentials).not.toHaveBeenCalled();
    expect(sdk.service).not.toHaveBeenCalled();
  });
});
