import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildResumeFrom } from './resume-from';
import type { TAskUserCheckpoint, TStageDetailForResume } from './session-api';

const checkpoint = (overrides: Partial<TAskUserCheckpoint> = {}): TAskUserCheckpoint => ({
  answerIds: ['3'],
  answerLabels: ['three'],
  askUserId: '1',
  contextSnapshot: {},
  question: {
    kind: 'multipleChoice',
    options: [{ id: '3', label: 'three' }],
    questionRef: '1',
    title: 'pick',
    version: 'askUser.v1',
  },
  questionId: 'q-1',
  questionRef: '1',
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
      arguments: { questionRef: '1' },
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
    assert.deepEqual(result.answer.selectedOptionIds, ['3']);
    assert.deepEqual(result.answer.selectedLabels, ['three']);
    assert.equal(result.modelResponses.length, 1);
    assert.equal(result.toolCalls.length, 1);
    assert.equal(result.toolCalls[0]?.id, 'tool-ask-1');
  });

  it('uses freeText answer when present', () => {
    const result = buildResumeFrom(
      checkpoint({ answerIds: undefined, freeText: 'custom' }),
      stageDetail(),
    );

    assert.equal(result.answer.freeText, 'custom');
    assert.deepEqual(result.answer.selectedOptionIds, []);
  });
});
