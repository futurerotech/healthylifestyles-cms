/**
 * Stop opted-in Hostinger staging from writing to the configured live R2
 * bucket or accidentally rendering media URLs on the production CDN.
 *
 * Host/bucket declarations are defense in depth, not proof of Cloudflare
 * account permissions. The release operator must verify dedicated staging
 * credentials have access ONLY to the dedicated staging bucket.
 *
 * Do not log access keys, secrets, connection details or public media data.
 */
export interface IsolatedStagingMediaConfig {
  bucket?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  publicUrl?: string;
  stagingBucket?: string;
  productionBucket?: string;
  stagingPublicUrl?: string;
  productionPublicUrl?: string;
  ciMockRuntime?: boolean;
}

const BUCKET_NAME = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

function validBucket(value: unknown): value is string {
  return typeof value === 'string' && BUCKET_NAME.test(value) &&
    !value.includes('..') && !value.startsWith('xn--');
}

function r2Endpoint(input: unknown): string | null {
  if (typeof input !== 'string' || !input || input !== input.trim()) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.origin !== input ||
        url.pathname !== '/' || url.username || url.password ||
        url.search || url.hash || url.port ||
        !/^[a-z0-9-]+\.r2\.cloudflarestorage\.com$/.test(url.hostname)) {
      return null;
    }
    return url.hostname;
  } catch {
    return null;
  }
}

function publicMediaOrigin(input: unknown): string | null {
  if (typeof input !== 'string' || !input || input !== input.trim()) return null;
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || url.username || url.password ||
        url.search || url.hash || url.port || url.hostname.endsWith('.') ||
        !/^[a-z0-9.-]+$/.test(url.hostname)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function assertIsolatedStagingMedia(input: IsolatedStagingMediaConfig): void {
  // Only the exact isolated GitHub CI runtime, with NO configured remote
  // storage fields, can run without an R2 bucket. No network writes occur.
  if (input.ciMockRuntime === true) {
    if ([input.bucket, input.endpoint, input.accessKeyId,
      input.secretAccessKey, input.publicUrl].every(value => !value)) return;
    throw new Error('Isolated CI staging storage must be disconnected; startup refused.');
  }

  if (!validBucket(input.bucket) ||
      !validBucket(input.stagingBucket) ||
      !validBucket(input.productionBucket) ||
      input.bucket !== input.stagingBucket ||
      input.bucket === input.productionBucket ||
      !r2Endpoint(input.endpoint) ||
      !input.accessKeyId?.trim() ||
      !input.secretAccessKey?.trim()) {
    throw new Error('Isolated staging requires dedicated R2 bucket and credentials; startup refused.');
  }

  // A public CDN URL is optional on staging. If present it must be explicitly
  // identified as staging and must NOT share the production media hostname.
  if (input.publicUrl) {
    const stage = publicMediaOrigin(input.stagingPublicUrl);
    const prod = publicMediaOrigin(input.productionPublicUrl);
    const current = publicMediaOrigin(input.publicUrl);
    if (!stage || !prod || !current ||
        current !== stage || current === prod || stage === prod) {
      throw new Error('Isolated staging media URL is not distinct from production; startup refused.');
    }
  } else if (input.stagingPublicUrl) {
    throw new Error('Isolated staging public media URL is inconsistent; startup refused.');
  }
}
