import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_STAGE_WAIT_MAX_MS,
  resolveStageWaitMaxMs,
  StageWaitTimeoutError,
} from './stage-wait-timeout';

describe('resolveStageWaitMaxMs', () => {
  it('defaults to 3 hours', () => {
    assert.equal(resolveStageWaitMaxMs({}), DEFAULT_STAGE_WAIT_MAX_MS);
  });

  it('disables when set to 0', () => {
    assert.equal(resolveStageWaitMaxMs({ YAHL_STAGE_WAIT_MAX_MS: '0' }), null);
  });

  it('parses positive env override', () => {
    assert.equal(resolveStageWaitMaxMs({ YAHL_STAGE_WAIT_MAX_MS: '60000' }), 60_000);
  });

  it('falls back on invalid env', () => {
    assert.equal(resolveStageWaitMaxMs({ YAHL_STAGE_WAIT_MAX_MS: 'nope' }), DEFAULT_STAGE_WAIT_MAX_MS);
  });
});

describe('StageWaitTimeoutError', () => {
  it('exposes requestId and maxMs', () => {
    const error = new StageWaitTimeoutError('req-1', 1_000);

    assert.equal(error.name, 'StageWaitTimeoutError');
    assert.equal(error.requestId, 'req-1');
    assert.equal(error.maxMs, 1_000);
    assert.match(error.message, /timed out after 1000ms/);
  });
});
