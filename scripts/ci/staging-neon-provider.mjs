/** Read-only control-plane identity check. It never connects to PostgreSQL. */
import { screenStagingMigrationTarget } from './staging-migration-identity.mjs';

const PROJECT = 'small-hall-15225012';
const BRANCH = 'br-wandering-poetry-bcxj8s3v';
const HOST = 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech';
const BASE = 'https://console.neon.tech/api/v2/projects/' + PROJECT;

export async function verifyStagingNeonProvider(input, apiKey, fetcher = fetch) {
  screenStagingMigrationTarget(input);
  if (typeof apiKey !== 'string' || !apiKey.trim() || apiKey !== apiKey.trim()) {
    throw new Error('Neon control-plane authorization is required.');
  }
  async function get(path) {
    let response;
    try {
      response = await fetcher(BASE + path, {
        method: 'GET', redirect: 'error', cache: 'no-store',
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok || response.redirected) throw new Error('not ok');
      const length = response.headers.get('content-length');
      if (length !== null && (!/^\d+$/.test(length) || Number(length) > 131072)) throw new Error('oversized');
      const text = await response.text();
      if (Buffer.byteLength(text) > 131072) throw new Error('oversized');
      return JSON.parse(text);
    } catch {
      throw new Error('Neon staging identity verification failed; no database connection attempted.');
    }
  }
  const project = await get('');
  const branch = await get('/branches/' + BRANCH);
  const endpoints = await get('/endpoints');
  if (project?.project?.id !== PROJECT || branch?.branch?.id !== BRANCH ||
      branch.branch.project_id !== PROJECT || !Array.isArray(endpoints?.endpoints) ||
      endpoints.endpoints.filter(e => e?.host === HOST && e?.branch_id === BRANCH &&
        e?.project_id === PROJECT && e?.type === 'read_write').length !== 1) {
    throw new Error('Neon staging identity mismatch; no database connection attempted.');
  }
  return Object.freeze({ providerIdentityVerified: true, databaseRoleVerified: false,
    tlsVerified: false, migrationAuthorized: false });
}
