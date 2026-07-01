import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isStageFinished, isStageVerifying } from './-stage-status';

describe('isStageFinished', () => {
  it('returns false when finishedAt is null or undefined', () => {
    assert.equal(isStageFinished({ finishedAt: null }), false);
    assert.equal(isStageFinished({ finishedAt: undefined }), false);
    assert.equal(isStageFinished({}), false);
  });

  it('ignores contextAfter when finishedAt is absent', () => {
    const withEmptyContextAfter = { contextAfter: {}, finishedAt: null };
    const withSnapshot = {
      contextAfter: { context: { c: 13.5 }, types: {} },
      finishedAt: null,
    };

    assert.equal(isStageFinished(withEmptyContextAfter), false);
    assert.equal(isStageFinished(withSnapshot), false);
  });

  it('returns true when finishedAt is set', () => {
    assert.equal(isStageFinished({ finishedAt: '2026-06-07T09:53:06.630Z' }), true);
    assert.equal(isStageFinished({
      finishedAt: new Date('2026-06-07T09:53:06.630Z'),
    }), true);
  });
});

describe('isStageVerifying', () => {
  it('returns false when finished or not verifying', () => {
    assert.equal(isStageVerifying({ finishedAt: '2026-06-07T09:53:06.630Z' }), false);
    assert.equal(isStageVerifying({}), false);
    assert.equal(isStageVerifying({ verifyingAt: null }), false);
  });

  it('returns true when verifyingAt is set and stage is not finished', () => {
    assert.equal(isStageVerifying({ verifyingAt: '2026-06-23T18:37:55.000Z' }), true);
  });
});
