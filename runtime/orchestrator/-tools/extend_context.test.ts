import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStorage, extendContext, resolveExtendValue } from '@/orchestrator/-tools/set_context';

describe('extendContext', () => {
  it('appends one item onto an existing array', async () => {
    const storage = createStorage();
    storage.context.set('items', [{ id: 1 }]);

    await extendContext(storage, {
      scope: 'global',
      key: 'items',
      value: { id: 2 },
    });

    assert.deepEqual(storage.context.get('items'), [{ id: 1 }, { id: 2 }]);
  });

  it('spreads an array value onto an existing array', async () => {
    const storage = createStorage();
    storage.context.set('items', [{ id: 1 }]);

    await extendContext(storage, {
      scope: 'global',
      key: 'items',
      value: [{ id: 2 }, { id: 3 }],
    });

    assert.deepEqual(storage.context.get('items'), [{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('starts a missing key as a one-item array', async () => {
    const storage = createStorage();

    await extendContext(storage, {
      scope: 'global',
      key: 'dispatched',
      value: { canonical: 'topic-a' },
    });

    assert.deepEqual(storage.context.get('dispatched'), [{ canonical: 'topic-a' }]);
  });

  it('pairs non-array current with the new value', async () => {
    const storage = createStorage();
    storage.context.set('flag', 'old');

    await extendContext(storage, {
      scope: 'global',
      key: 'flag',
      value: 'new',
    });

    assert.deepEqual(storage.context.get('flag'), ['old', 'new']);
  });
});

describe('resolveExtendValue', () => {
  it('matches extendContext behavior for arrays', () => {
    assert.deepEqual(resolveExtendValue([{ id: 1 }], { id: 2 }), [{ id: 1 }, { id: 2 }]);
  });
});
