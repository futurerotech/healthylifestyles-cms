import { describe, expect, it } from 'vitest';
import { Articles } from './Articles';
import { trackPendingChange } from '../hooks/trackPendingChange';
import { afterPublishPushHook } from '../lib/push';

describe('article publication hook ordering', () => {
  it('queues the published revision before performing an external push', () => {
    const hooks = Articles.hooks?.afterChange ?? [];
    expect(hooks.indexOf(trackPendingChange)).toBeGreaterThanOrEqual(0);
    expect(hooks.indexOf(afterPublishPushHook)).toBeGreaterThan(hooks.indexOf(trackPendingChange));
  });
});
