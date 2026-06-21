import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isStageFinished } from '../-stage-status';
import { isSessionRunActive, toVerifyCheckpointResponse } from './verify-write';

describe('toVerifyCheckpointResponse', () => {
  it('returns resume fields needed by orchestrator', () => {
    const response = toVerifyCheckpointResponse({
      askUserQuestion: {
        options: [{ id: '50', label: '50' }],
        title: 'metric?',
      },
      askUserRef: 'target_metric',
      feedback: 'metric missing',
      kind: 'verify',
      parsedStageSnapshot: {
        lines: '{\nconst report = {};\n}',
        sourceStartLine: 24,
        type: 'plain',
      },
      requestId: 'req-1',
      resumeAction: 'edit_answer',
      score: 0,
      stage: {
        askUser: [{ id: 'target_metric', question: 'metric?' }],
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
    assert.equal(response.resumeAction, 'edit_answer');
    assert.equal(response.askUserRef, 'target_metric');
    assert.deepEqual(response.askUserQuestion, {
      options: [{ id: '50', label: '50' }],
      title: 'metric?',
    });
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

describe('isSessionRunActive', () => {
  it('returns true when liveViewVncPort is set', () => {
    assert.equal(isSessionRunActive({ liveViewVncPort: 5901 }), true);
  });

  it('returns false when liveViewVncPort is null or absent', () => {
    assert.equal(isSessionRunActive({ liveViewVncPort: null }), false);
    assert.equal(isSessionRunActive({}), false);
  });
});
