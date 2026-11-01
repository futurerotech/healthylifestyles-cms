import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  APPROVED_GSC_DOMAIN,
  GSC_READONLY_SCOPE,
  assertIsolatedOperatorGate,
  assertExactPropertyPermission,
  runIsolatedOperatorProbe,
  main,
} from '../../scripts/seo/gsc-isolated-property-probe.mjs';

const expectedEmail = 'demo@isolated-fixture.iam.gserviceaccount.com';
const env = () => ({
  HLS_ISOLATED_STAGING: 'true',
  HLS_GSC_PROPERTY_PROBE_ENABLED: 'true',
  HLS_GSC_ISOLATED_PROPERTY_PROBE_APPROVED: 'true',
  HLS_GSC_OPERATOR_ONE_SHOT_APPROVED: 'true',
  HLS_GSC_READONLY_ENABLED: 'false',
  GSC_SITE_URL: APPROVED_GSC_DOMAIN,
  GOOGLE_APPLICATION_CREDENTIALS: '/isolated/mounted/fictional-account.json',
  HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL: expectedEmail,
});
const makeAdapter = () => ({
  getIdentity: vi.fn(async () => expectedEmail),
  getSite: vi.fn(async () => ({
    siteUrl: APPROVED_GSC_DOMAIN,
    permissionLevel: 'siteRestrictedUser',
  })),
});
afterEach(() => vi.restoreAllMocks());

describe('one-shot isolated GSC property-only operator runner', () => {
  it('defaults to a completely inert, explicitly labeled check mode', async () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    expect(await main([])).toBe(0);
    expect(await main(['--check'])).toBe(0);
    expect(out).toHaveBeenCalledTimes(2);
    expect(out.mock.calls[0][0]).toContain('CHECK_ONLY');
    await expect(main(['--all-properties'])).rejects.toThrow(/Only --check/);
  });

  it('verifies only an exact site with readonly scope and returns sanitized receipt', async () => {
    const adapter = makeAdapter();
    const createAdapter = vi.fn(async () => adapter);
    const result = await runIsolatedOperatorProbe({env:env(), createAdapter});
    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(createAdapter).toHaveBeenCalledWith({
      keyFile: '/isolated/mounted/fictional-account.json',
      scope: GSC_READONLY_SCOPE,
    });
    expect(adapter.getIdentity).toHaveBeenCalledTimes(1);
    expect(adapter.getSite).toHaveBeenCalledTimes(1);
    expect(adapter.getSite).toHaveBeenCalledWith(APPROVED_GSC_DOMAIN);
    expect(result).toMatchObject({
      exactPropertyReadPermissionVerified: true,
      expectedServiceAccountIdentityVerified: true,
      searchAnalyticsRequests: 0, indexingSubmissions: 0,
      cmsReads: 0, cmsWrites: 0, publicationAuthorized: false,
    });
    const exposed = JSON.stringify(result);
    expect(exposed).not.toContain(expectedEmail);
    expect(exposed).not.toContain('fictional-account');
    expect(exposed).not.toContain('permissionLevel');
  });

  it.each([
    {field:'HLS_ISOLATED_STAGING',value:undefined},
    {field:'HLS_ISOLATED_STAGING',value:'false'},
    {field:'HLS_GSC_PROPERTY_PROBE_ENABLED',value:undefined},
    {field:'HLS_GSC_ISOLATED_PROPERTY_PROBE_APPROVED',value:undefined},
    {field:'HLS_GSC_OPERATOR_ONE_SHOT_APPROVED',value:undefined},
    {field:'HLS_GSC_READONLY_ENABLED',value:'true'},
    {field:'HLS_GSC_READONLY_ENABLED',value:'enabled'},
    {field:'GSC_SITE_URL',value:'https://www.healthylifesstyles.com/'},
    {field:'GSC_SITE_URL',value:'sc-domain:another-domain.example'},
    {field:'GOOGLE_APPLICATION_CREDENTIALS',value:'./local-credential.json'},
    {field:'GOOGLE_APPLICATION_CREDENTIALS',value:undefined},
    {field:'HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL',value:undefined},
    {field:'HLS_GSC_EXPECTED_SERVICE_ACCOUNT_EMAIL',value:'someone@gmail.com'},
  ])('blocks invalid $field=$value before any credential/provider work', async ({field,value}) => {
    const e: Record<string,string|undefined> = env();
    e[field] = value;
    const createAdapter = vi.fn();
    expect(() => assertIsolatedOperatorGate(e)).toThrow();
    await expect(runIsolatedOperatorProbe({env:e,createAdapter}))
      .rejects.toThrow();
    expect(createAdapter).not.toHaveBeenCalled();
  });

  it('rejects wrong account before Google property I/O without exposing the identity', async () => {
    const adapter = makeAdapter();
    adapter.getIdentity.mockResolvedValueOnce('wrong@another.iam.gserviceaccount.com');
    await expect(runIsolatedOperatorProbe({env:env(),createAdapter:async()=>adapter}))
      .rejects.toThrow('The credential is not the independently approved service account.');
    expect(adapter.getSite).not.toHaveBeenCalled();
  });

  it('does not leak provider exception text or authorize a fake property', async () => {
    const adapter = makeAdapter();
    adapter.getSite.mockRejectedValueOnce(new Error('PRIVATE_API_RESPONSE_TOKEN'));
    await expect(runIsolatedOperatorProbe({env:env(),createAdapter:async()=>adapter}))
      .rejects.toThrow('The Search Console property-only request failed.');
    expect(adapter.getSite).toHaveBeenCalledTimes(1);
    for (const result of [
      {siteUrl:'https://www.healthylifesstyles.com/',permissionLevel:'siteOwner'},
      {siteUrl:APPROVED_GSC_DOMAIN,permissionLevel:'siteUnverifiedUser'},
      {siteUrl:APPROVED_GSC_DOMAIN,permissionLevel:'siteOwner',error:{message:'private'}},
      {siteUrl:APPROVED_GSC_DOMAIN},
      {siteUrl:APPROVED_GSC_DOMAIN,permissionLevel:'siteOwner', siteEntry:[]},
    ]) {
      if ('siteEntry' in result) {
        // Unknown provider decoration alone isn't a privilege claim;
        // it must not be included in the receipt.
        expect(() => assertExactPropertyPermission(result)).not.toThrow();
      } else {
        expect(() => assertExactPropertyPermission(result)).toThrow();
      }
    }
  });

  it('rejects initialization and identity failures with sanitized errors', async () => {
    await expect(runIsolatedOperatorProbe({
      env:env(),createAdapter:async()=>{throw new Error('MY_PRIVATE_FILE_PATH');},
    })).rejects.toThrow('Read-only Search Console provider initialization failed.');
    const adapter = makeAdapter();
    adapter.getIdentity.mockRejectedValueOnce(new Error('SHOULD_NEVER_LOG'));
    await expect(runIsolatedOperatorProbe({env:env(),createAdapter:async()=>adapter}))
      .rejects.toThrow('Search Console service-account identity verification failed.');
    expect(adapter.getSite).not.toHaveBeenCalled();
  });
});
