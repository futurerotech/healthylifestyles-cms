/**
 * Argument parsing for scripts/staging/import-bundle.ts, kept pure so it is unit-tested.
 * Exactly one action per run. Every action except "list" names its input explicitly.
 * The runtime and connected-database guard is enforced again inside the library.
 */
export type StagingImportAction =
  | { action: 'verify'; bundlePath: string }
  | { action: 'import'; bundlePath: string }
  | { action: 'cleanup'; importId: string }
  | { action: 'list' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseStagingImportArgs(argv: readonly string[]): StagingImportAction {
  const [flag, value, ...rest] = argv;
  if (rest.length) throw new Error('Refusing: exactly one action per run.');
  if (flag === '--list' && value === undefined) return { action: 'list' };
  if ((flag === '--verify' || flag === '--import') && typeof value === 'string' && /\.json$/.test(value) && !value.startsWith('-')) {
    return { action: flag === '--verify' ? 'verify' : 'import', bundlePath: value };
  }
  if (flag === '--cleanup' && typeof value === 'string' && UUID.test(value)) return { action: 'cleanup', importId: value };
  throw new Error('Usage: --verify <bundle.json> | --import <bundle.json> | --cleanup <import-uuid> | --list');
}

/** What the CLI prints after an import: counts and the import id, never record content. */
export function summarizeReport(report: { created: unknown[]; skipped: unknown[]; journal?: { importId: string } }) {
  return { importId: report.journal?.importId ?? null, created: report.created.length, skipped: report.skipped.length };
}
