import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getHealthStatus, isPollFresh, markPollSucceeded } from './-health/server.js';

describe('worker poll health', () => {
  it('marks poll success as fresh', () => {
    markPollSucceeded();
    assert.equal(isPollFresh(), true);
  });

  it('reports health status shape', () => {
    markPollSucceeded();
    const status = getHealthStatus();

    assert.equal(typeof status.ok, 'boolean');
    assert.equal(status.pollFresh, true);
    assert.equal(typeof status.whatsappEnabled, 'boolean');
    assert.equal(typeof status.whatsappReady, 'boolean');
  });
});
