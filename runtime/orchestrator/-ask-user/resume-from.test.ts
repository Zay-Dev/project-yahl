import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildMidTurnResumeFrom, buildResumeFrom } from './resume-from';
import type { TAskUserCheckpoint, TStageDetailForResume } from './session-api';

const checkpoint = (overrides: Partial<TAskUserCheckpoint> = {}): TAskUserCheckpoint => ({
  batch: {
    batchId: 'round1',
    questions: [{
      kind: 'multipleChoice',
      options: [{ id: '3', label: 'three' }],
      questionRef: '1',
      title: 'pick',
    }],
    title: 'Pick one',
    version: 'askUserBatch.v1',
  },
  batchAnswers: [{
    answerValue: '3',
    optionIds: ['3'],
    questionRef: '1',
  }],
  batchId: 'round1',
  contextSnapshot: {},
  questionId: 'q-1',
  requestId: 'req-1',
  stage: {},
  stageIndex: 4,
  status: 'answered',
  storageSnapshot: {},
  toolCallId: 'tool-ask-1',
  ...overrides,
});

const stageDetail = (overrides: Partial<TStageDetailForResume> = {}): TStageDetailForResume => ({
  context: {},
  modelResponses: [
    {
      durationMs: 120,
      response: {
        choices: [{
          message: {
            content: 'asking',
            tool_calls: [{
              function: { arguments: '{}', name: 'ask_user' },
              id: 'tool-ask-1',
              type: 'function',
            }],
          },
        }],
        id: 'cmpl-1',
        model: 'gpt-test',
      },
      thinkingMode: false,
    },
  ],
  stage: {},
  toolCalls: [{
    tools: [{
      arguments: { batchId: 'round1' },
      id: 'tool-ask-1',
      name: 'ask_user',
    }],
  }],
  ...overrides,
});

describe('buildResumeFrom', () => {
  it('builds resume payload from checkpoint and stage detail', () => {
    const result = buildResumeFrom(checkpoint(), stageDetail());

    assert.equal(result.pendingToolCallId, 'tool-ask-1');
    assert.equal(result.batchAnswers[0]?.questionRef, '1');
    assert.deepEqual(result.batchAnswers[0]?.selectedOptionIds, ['3']);
    assert.equal(result.batch.batchId, 'round1');
    assert.equal(result.modelResponses.length, 1);
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0]?.id, 'tool-ask-1');
  });

  it('uses freeText answer when present', () => {
    const result = buildResumeFrom(
      checkpoint({
        batchAnswers: [{
          answerValue: 'custom',
          freeText: 'custom',
          questionRef: '1',
        }],
      }),
      stageDetail(),
    );

    assert.equal(result.batchAnswers[0]?.freeText, 'custom');
    assert.deepEqual(result.batchAnswers[0]?.selectedOptionIds, undefined);
  });
});

describe('buildMidTurnResumeFrom', () => {
  it('builds transcript resume without ask-user batch', () => {
    const result = buildMidTurnResumeFrom(stageDetail({
      modelResponses: [{
        durationMs: 5,
        response: {
          choices: [{
            message: {
              content: 'set c',
              tool_calls: [{
                function: { arguments: '{"key":"c"}', name: 'set_context' },
                id: 'tool-set-1',
                type: 'function',
              }],
            },
          }],
          id: 'cmpl-2',
          model: 'gpt-test',
        },
      }],
      toolCalls: [{
        tools: [{
          arguments: { key: 'c' },
          id: 'tool-set-1',
          name: 'set_context',
        }],
      }],
    }));

    assert.equal(result.batchAnswers.length, 0);
    assert.equal(result.batch.questions.length, 0);
    assert.equal(result.pendingToolCallId, '');
    assert.equal(result.toolCalls[0]?.function.name, 'set_context');
    assert.equal(result.modelResponses.length, 1);
  });
});
