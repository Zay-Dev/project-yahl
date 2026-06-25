import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveStageStatus } from './stage-read.js';

describe('resolveStageStatus', () => {
  it('returns finished when finishedAt is set', () => {
    assert.equal(resolveStageStatus({ finishedAt: '2026-06-07T09:53:06.630Z' }), 'finished');
  });

  it('returns verifying when verifyingAt is set and stage is open', () => {
    assert.equal(resolveStageStatus({ verifyingAt: '2026-06-23T18:37:55.000Z' }), 'verifying');
  });

  it('returns running when neither finished nor verifying', () => {
    assert.equal(resolveStageStatus({}), 'running');
  });

  it('prefers finished over verifying', () => {
    assert.equal(resolveStageStatus({
      finishedAt: '2026-06-07T09:53:06.630Z',
      verifyingAt: '2026-06-23T18:37:55.000Z',
    }), 'finished');
  });
});
