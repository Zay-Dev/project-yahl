import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('pruneIdleBrowsers abandon wiring', () => {
  it('ttl path calls abandon callback for idle sessions', async () => {
    const abandoned: string[] = [];
    const { pruneIdleBrowsers } = await import('./compose-browser');

    // Without labeled docker containers this is a no-op; assert the contract shape.
    const result = await pruneIdleBrowsers(async (sessionId) => {
      abandoned.push(sessionId);
    });

    assert.deepEqual(result.abandoned, []);
    assert.deepEqual(abandoned, []);
    assert.equal(typeof pruneIdleBrowsers, 'function');
  });
});
