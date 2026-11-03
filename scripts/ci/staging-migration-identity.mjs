/** Offline target screening only: this does not authorize or run migrations. */
const TARGET = Object.freeze({
  project: 'small-hall-15225012',
  branch: 'br-wandering-poetry-bcxj8s3v',
  host: 'ep-plain-forest-bca0vqud.c-16.us-east-1.aws.neon.tech',
  database: 'neondb',
});

export function screenStagingMigrationTarget(input) {
  const deny = () => { throw new Error('Staging migration target rejected; no database connection attempted.'); };
  if (!input || typeof input !== 'object' || input.enable !== 'true' ||
      input.project !== TARGET.project || input.branch !== TARGET.branch ||
      !/^[a-f0-9]{40}$/.test(input.reviewedSha || '') ||
      input.checkedOutSha !== input.reviewedSha ||
      typeof input.role !== 'string' || !/^[a-z_][a-z0-9_]{0,62}$/.test(input.role)) deny();
  let uri;
  try { uri = new URL(input.databaseUri); } catch { return deny(); }
  if (!['postgres:', 'postgresql:'].includes(uri.protocol) ||
      uri.hostname !== TARGET.host || uri.port && uri.port !== '5432' ||
      uri.pathname !== '/' + TARGET.database || uri.hash || !uri.password ||
      uri.username !== input.role) deny();
  // Reject all URI query options: pg can otherwise override host, user, or TLS.
  // A future executor must use an explicitly verified TLS configuration.
  if ([...uri.searchParams].length) deny();
  return Object.freeze({ targetScreened: true, providerIdentityVerified: false,
    databaseRoleVerified: false, tlsVerified: false, migrationAuthorized: false });
}
