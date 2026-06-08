import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isStageFinished } from '@/shared/stage-status';

describe('isStageFinished', () => {
  it('returns false when finishedAt is null or undefined', () => {
    assert.equal(isStageFinished({ finishedAt: null }), false);
    assert.equal(isStageFinished({ finishedAt: undefined }), false);
    assert.equal(isStageFinished({}), false);
  });

  it('ignores contextAfter when finishedAt is absent', () => {
    const withEmptyContextAfter = { finishedAt: null, contextAfter: {} };
    const withSnapshot = {
      contextAfter: { context: { c: 13.5 }, types: {} },
      finishedAt: null,
    };

    assert.equal(isStageFinished(withEmptyContextAfter), false);
    assert.equal(isStageFinished(withSnapshot), false);
  });

  it('returns true when finishedAt is set', () => {
    assert.equal(isStageFinished({ finishedAt: '2026-06-07T09:53:06.630Z' }), true);
  });
});
