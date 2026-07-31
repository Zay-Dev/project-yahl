import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStorage, setContext } from '@/orchestrator/-tools/set_context';

const call = (args: Record<string, unknown>) => ({
  type: 'function' as const,
  id: 'tc-1',
  function: {
    name: 'set_context',
    arguments: JSON.stringify(args),
  },
});

describe('setContext extend', () => {
  it('appends one item onto an existing array', async () => {
    const storage = createStorage();
    storage.context.set('fetches', [{ id: 1 }]);

    await setContext(storage, call({
      scope: 'global',
      key: 'fetches',
      operation: 'extend',
      value: { id: 2 },
    }));

    assert.deepEqual(storage.context.get('fetches'), [{ id: 1 }, { id: 2 }]);
  });

  it('spreads an array value onto an existing array', async () => {
    const storage = createStorage();
    storage.context.set('fetches', [{ id: 1 }]);

    await setContext(storage, call({
      scope: 'global',
      key: 'fetches',
      operation: 'extend',
      value: [{ id: 2 }, { id: 3 }],
    }));

    assert.deepEqual(storage.context.get('fetches'), [{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('starts a missing key as a one-item array', async () => {
    const storage = createStorage();

    await setContext(storage, call({
      scope: 'global',
      key: 'dispatched',
      operation: 'extend',
      value: { canonical: 'topic-a' },
    }));

    assert.deepEqual(storage.context.get('dispatched'), [{ canonical: 'topic-a' }]);
  });

  it('pairs non-array current with the new value', async () => {
    const storage = createStorage();
    storage.context.set('flag', 'old');

    await setContext(storage, call({
      scope: 'global',
      key: 'flag',
      operation: 'extend',
      value: 'new',
    }));

    assert.deepEqual(storage.context.get('flag'), ['old', 'new']);
  });

  it('overwrites on set', async () => {
    const storage = createStorage();
    storage.context.set('fetches', [{ id: 1 }]);

    await setContext(storage, call({
      scope: 'global',
      key: 'fetches',
      operation: 'set',
      value: [{ id: 9 }],
    }));

    assert.deepEqual(storage.context.get('fetches'), [{ id: 9 }]);
  });

  it('unwraps double-encoded JSON strings', async () => {
    const storage = createStorage();

    await setContext(storage, call({
      scope: 'global',
      key: 'notifyChannel',
      operation: 'set',
      value: '"whatsapp"',
    }));

    assert.equal(storage.context.get('notifyChannel'), 'whatsapp');
  });

  it('increments verify_rebuttal_count when verify_rebuttal is set', async () => {
    const storage = createStorage();

    await setContext(storage, call({
      scope: 'global',
      key: 'verify_rebuttal',
      operation: 'set',
      value: { checkId: 'routes', evidence: 'x', claim: 'y' },
    }));

    assert.equal(storage.context.get('verify_rebuttal_count'), 1);
  });
});
