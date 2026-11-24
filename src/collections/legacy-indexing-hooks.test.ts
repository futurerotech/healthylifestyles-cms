import { describe, expect, it } from 'vitest';
import { Articles } from './Articles';
import { Categories } from './Categories';
import { Pages } from './Pages';
import { Tools } from './Tools';
import { trackPendingChange } from '../hooks/trackPendingChange';
import { afterChangeIndexingHook } from '../lib/indexing';

// Publication saves must only enqueue revisions for the post-deploy
// reconciler. The legacy hook pinged IndexNow and Google's restricted
// Indexing API before deployment and built non-canonical URLs.
describe('collections do not register the legacy direct indexing hook', () => {
  for (const [name, collection] of Object.entries({ Articles, Categories, Pages, Tools })) {
    it(`${name} queues changes without the legacy provider hook`, () => {
      const hooks = collection.hooks?.afterChange ?? [];
      expect(hooks).not.toContain(afterChangeIndexingHook);
      expect(hooks).toContain(trackPendingChange);
    });
  }
});
