import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SET_CONTEXT_EXTEND_RETIRED,
  createStorage,
  setContext,
} from '@/orchestrator/-tools/set_context';

const call = (args: Record<string, unknown>) => ({
  type: 'function' as const,
  id: 'tc-1',
  function: {
    name: 'set_context',
    arguments: JSON.stringify(args),
  },
});

describe('setContext', () => {
  it('overwrites on set', async () => {
    const storage = createStorage();
    storage.context.set('fetches', [{ id: 1 }]);

    await setContext(storage, call({
      scope: 'global',
      key: 'fetches',
      value: [{ id: 9 }],
    }));

    assert.deepEqual(storage.context.get('fetches'), [{ id: 9 }]);
  });

  it('rejects operation extend', async () => {
    const storage = createStorage();

    await assert.rejects(
      () => setContext(storage, call({
        scope: 'global',
        key: 'fetches',
        operation: 'extend',
        value: { id: 1 },
      })),
      (error: Error) => error.message === SET_CONTEXT_EXTEND_RETIRED,
    );
  });

  it('unwraps double-encoded JSON strings', async () => {
    const storage = createStorage();

    await setContext(storage, call({
      scope: 'global',
      key: 'notifyChannel',
      value: '"whatsapp"',
    }));

    assert.equal(storage.context.get('notifyChannel'), 'whatsapp');
  });

  it('increments verify_rebuttal_count when verify_rebuttal is set', async () => {
    const storage = createStorage();

    await setContext(storage, call({
      scope: 'global',
      key: 'verify_rebuttal',
      value: { checkId: 'routes', evidence: 'x', claim: 'y' },
    }));

    assert.equal(storage.context.get('verify_rebuttal_count'), 1);
  });
});
