import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isStageFinished } from '../-stage-status';
import { toVerifyCheckpointResponse } from './verify-write';

describe('toVerifyCheckpointResponse', () => {
  it('returns resume fields needed by orchestrator', () => {
    const response = toVerifyCheckpointResponse({
      feedback: 'metric missing',
      kind: 'verify',
      parsedStageSnapshot: {
        lines: '{\nconst report = {};\n}',
        sourceStartLine: 24,
        type: 'plain',
      },
      requestId: 'req-1',
      score: 0,
      stage: {
        logic: 'const report = {};',
        verify: true,
      },
      stageIndex: 2,
      status: 'pending',
      storageSnapshot: {
        context: { report: { metric: null } },
      },
      verifyId: 'verify-1',
    });

    assert.equal(response.verifyId, 'verify-1');
    assert.equal(response.requestId, 'req-1');
    assert.equal(response.stageIndex, 2);
    assert.equal(response.status, 'pending');
    assert.deepEqual(response.storageSnapshot, { context: { report: { metric: null } } });
    assert.equal(response.parsedStageSnapshot?.sourceStartLine, 24);
    assert.equal(response.stage.verify, true);
  });
});

describe('verify resume stage gate', () => {
  it('treats finishedAt as finished until resume reopens the stage', () => {
    assert.equal(isStageFinished({ finishedAt: '2026-06-20T19:35:48.753Z' }), true);
    assert.equal(isStageFinished({ finishedAt: null }), false);
  });
});
