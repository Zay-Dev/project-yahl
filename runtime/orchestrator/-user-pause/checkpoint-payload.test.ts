import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildUserPauseCheckpointPayload } from './checkpoint-payload';
import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

const askUserStage: ParsedStage = {
  contextKeys: ['c'],
  lines: '{\nc += /ask-user(1);\n}',
  sourceStartLine: 48,
  spec: {
    askUser: [{ id: '1', question: 'pick' }],
    contextKeys: ['c'],
    logic: 'c += /ask-user(1);',
    updateContextKeys: ['c'],
  },
  type: 'plain',
  updateContextKeys: ['c'],
};

const whileStage: ParsedStage = {
  contextKeys: ['c'],
  lines: '{\nc += 1;\n}',
  sourceStartLine: 56,
  spec: {
    contextKeys: ['c'],
    logic: 'c += 1;',
    maxTurns: 8,
    updateContextKeys: ['c'],
    warmUp: 'c += 1;',
    whileSetup: 'context.context.c < 20',
  },
  type: 'while',
  updateContextKeys: ['c'],
};

const plainStage: ParsedStage = {
  lines: 'x',
  sourceStartLine: 10,
  spec: { logic: 'x' },
  type: 'plain',
};

describe('buildUserPauseCheckpointPayload', () => {
  it('uses outer while stage and pipeline index when resumeStage is active', () => {
    const payload = buildUserPauseCheckpointPayload({
      activeStage: askUserStage,
      boundParsedStageIndex: 0,
      pipelineStageIndex: 6,
      recoveryStages: [
        plainStage,
        plainStage,
        plainStage,
        plainStage,
        plainStage,
        plainStage,
        whileStage,
      ],
      requestId: 'while-req',
      resumeStage: {
        loopMeta: {
          arraySnapshot: [],
          index: 2,
          kind: 'while',
          remainingBashCalls: 8,
          remainingTurns: 8,
          value: 2,
        },
        requestId: 'while-req',
        stage: askUserStage,
      },
    });

    assert.equal(payload.stageIndex, 6);
    assert.equal(payload.stage.type, 'while');
    assert.equal(payload.stage.lines, whileStage.lines);
    assert.equal(payload.requestId, 'while-req');
    assert.equal(payload.loopMeta?.kind, 'while');
    assert.equal(payload.loopMeta?.index, 2);
  });

  it('keeps active stage and bound index when resumeStage is absent', () => {
    const payload = buildUserPauseCheckpointPayload({
      activeStage: plainStage,
      boundParsedStageIndex: 3,
      pipelineStageIndex: 3,
      requestId: 'plain-req',
    });

    assert.equal(payload.stageIndex, 3);
    assert.equal(payload.stage, plainStage);
    assert.equal(payload.requestId, 'plain-req');
    assert.equal(payload.loopMeta, undefined);
  });

  it('passes loopMeta through for plain pause without resumeStage', () => {
    const loopMeta = {
      arraySnapshot: [1, 2, 3],
      index: 1,
      indexName: 'i',
      value: 2,
    };

    const payload = buildUserPauseCheckpointPayload({
      activeStage: plainStage,
      boundParsedStageIndex: 2,
      loopMeta,
      pipelineStageIndex: 2,
      requestId: 'loop-req',
    });

    assert.deepEqual(payload.loopMeta, loopMeta);
    assert.equal(payload.stageIndex, 2);
  });
});
