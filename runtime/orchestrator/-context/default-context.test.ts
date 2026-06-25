import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStorage } from '@/orchestrator/-tools/set_context';
import { seedDefaultContext } from './default-context';

describe('seedDefaultContext', () => {
  it('seeds today and now_iso on createStorage', () => {
    const storage = createStorage();

    assert.match(String(storage.context.get('today')), /^\d{4}-\d{2}-\d{2}$/);
    assert.match(String(storage.context.get('now_iso')), /^\d{4}-\d{2}-\d{2}T/);
  });

  it('refreshes platform keys on re-seed', () => {
    const storage = createStorage();

    storage.context.set('today', '1970-01-01');
    seedDefaultContext(storage);

    assert.notEqual(storage.context.get('today'), '1970-01-01');
  });
});
