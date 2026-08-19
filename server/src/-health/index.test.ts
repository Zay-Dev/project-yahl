import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildServerHealth } from './index.js';

describe('server health', () => {
  it('buildServerHealth reports mongo-only ok', async () => {
    const result = await buildServerHealth();

    assert.equal(result.service, 'server');
    assert.equal(typeof result.mongo.readyState, 'number');
    assert.equal(typeof result.ok, 'boolean');
  });
});
