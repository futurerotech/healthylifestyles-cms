/** Offline ACL regression: draft-enabled Pages must select the published-only access guard. */
import { describe, expect, it } from 'vitest';
import { Pages } from './Pages';
import { publishedPublicRead } from '../access/roles';

describe('Pages published-content access', () => {
  it('wires the actual Pages.read policy to the shared published-only guard', () => {
    expect(Pages.access?.read).toBe(publishedPublicRead);
    expect(Pages.versions).toMatchObject({ drafts: expect.any(Object) });
  });

  it('anonymous readers get only published documents; authenticated editors retain access', () => {
    const anonymous = publishedPublicRead({ req: { user: null } } as never);
    const editor = publishedPublicRead({ req: { user: { role: 'editor' } } } as never);
    expect(anonymous).toEqual({ _status: { equals: 'published' } });
    expect(editor).toBe(true);
  });
});
