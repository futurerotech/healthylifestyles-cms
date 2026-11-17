import { describe, it, expect } from 'vitest';
import { parseStagingImportArgs, summarizeReport } from './staging-import-cli';

describe('staging import CLI arguments', () => {
  const id = '11111111-2222-4333-8444-555555555555';
  it('accepts exactly one explicit action', () => {
    expect(parseStagingImportArgs(['--list'])).toEqual({ action: 'list' });
    expect(parseStagingImportArgs(['--verify', 'bundle.json'])).toEqual({ action: 'verify', bundlePath: 'bundle.json' });
    expect(parseStagingImportArgs(['--import', '/tmp/b.json'])).toEqual({ action: 'import', bundlePath: '/tmp/b.json' });
    expect(parseStagingImportArgs(['--cleanup', id])).toEqual({ action: 'cleanup', importId: id });
  });
  it('refuses no action, combined actions, bad ids and non-JSON inputs', () => {
    for (const bad of [[], ['--import'], ['--import', 'b.txt'], ['--import', '--cleanup'], ['--cleanup', 'x'], ['--cleanup', "1' OR 1=1"],
      ['--list', 'x'], ['--import', 'a.json', '--cleanup', id], ['--delete-all']]) expect(() => parseStagingImportArgs(bad)).toThrow();
  });
  it('summaries carry counts and the import id only', () => {
    const s = summarizeReport({ created: [{ collection: 'articles', id: 5, title: 'secret title' }], skipped: [], journal: { importId: id } as any });
    expect(s).toEqual({ importId: id, created: 1, skipped: 0 });
    expect(JSON.stringify(s)).not.toContain('secret');
  });
});
