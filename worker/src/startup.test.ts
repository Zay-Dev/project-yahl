import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isPollFresh, markPollSucceeded } from './-health/server.js';

describe('worker poll health', () => {
  it('marks poll success as fresh', () => {
    markPollSucceeded();
    assert.equal(isPollFresh(), true);
  });
});
