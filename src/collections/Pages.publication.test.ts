/** Offline ACL regression: a drafts-enabled CMS Pages collection must not be publicRead. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { publishedPublicRead } from '../access/roles';

describe('Pages published-content access', () => {
  it('wires Pages.read to the published-only public access control', () => {
    const source = readFileSync(new URL('./Pages.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/access:\s*\{\s*read:\s*publishedPublicRead\b/);
    expect(source).not.toMatch(/read:\s*publicRead\b/);
  });

  it('anonymous readers get only published documents; authenticated editors retain access', () => {
    const anonymous = publishedPublicRead({ req: { user: null } } as never);
    const editor = publishedPublicRead({ req: { user: { role: 'editor' } } } as never);
    expect(anonymous).toEqual({ _status: { equals: 'published' } });
    expect(editor).toBe(true);
  });
});
