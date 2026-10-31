import { describe, expect, it } from 'vitest';
import { assertIsolatedStagingMedia as check } from './isolated-staging-media';

const safe = {
  bucket: 'hls-stage-media',
  stagingBucket: 'hls-stage-media',
  productionBucket: 'hls-live-media',
  endpoint: 'https://example123.r2.cloudflarestorage.com',
  accessKeyId: 'synthetic-key',
  secretAccessKey: 'synthetic-secret',
};
describe('isolated Hostinger media guard', () => {
  it('accepts isolated R2 configuration without a public CDN URL', () => {
    expect(() => check(safe)).not.toThrow();
  });
  it('rejects live bucket, missing credentials and wrong endpoint', () => {
    for (const bad of [
      { ...safe, bucket: safe.productionBucket },
      { ...safe, productionBucket: safe.bucket },
      { ...safe, stagingBucket: undefined },
      { ...safe, secretAccessKey: undefined },
      { ...safe, endpoint: 'http://example123.r2.cloudflarestorage.com' },
      { ...safe, endpoint: 'https://example123.r2.cloudflarestorage.com.evil.test' },
      { ...safe, endpoint: 'https://example123.r2.cloudflarestorage.com/path' },
    ]) expect(() => check(bad)).toThrow(/refused/);
  });
  it('requires a separate staging CDN if public media URLs are configured', () => {
    const urls = {
      publicUrl: 'https://staging-media.example.com',
      stagingPublicUrl: 'https://staging-media.example.com',
      productionPublicUrl: 'https://media.example.com',
    };
    expect(() => check({ ...safe, ...urls })).not.toThrow();
    expect(() => check({ ...safe, ...urls, publicUrl: urls.productionPublicUrl })).toThrow(/refused/);
    expect(() => check({ ...safe, ...urls, stagingPublicUrl: urls.productionPublicUrl })).toThrow(/refused/);
    expect(() => check({ ...safe, ...urls, publicUrl: 'https://staging-media.example.com/other' })).toThrow(/refused/);
    expect(() => check({ ...safe, ...urls, stagingPublicUrl: 'https://media.example.com/staging' })).toThrow(/refused/);
    expect(() => check({ ...safe, ...urls, publicUrl: 'https://staging-media.example.com/%2e%2e/' })).toThrow(/refused/);
    expect(() => check({ ...safe, ...urls, publicUrl: 'https://staging-media.example.com//other' })).toThrow(/refused/);
    expect(() => check({ ...safe, ...urls, publicUrl: 'https://staging-media.example.com', stagingPublicUrl: 'https://staging-media.example.com/staging' })).toThrow(/refused/);
  });
  it('allows CI-only disconnected storage and rejects configured mock storage', () => {
    expect(() => check({ ciMockRuntime: true })).not.toThrow();
    expect(() => check({ ciMockRuntime: true, bucket: 'hls-live-media' })).toThrow(/refused/);
  });
});
