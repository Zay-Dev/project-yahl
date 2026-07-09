import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildResumeFrom } from '@/orchestrator/-ask-user/resume-from';
import type { TAskUserCheckpoint, TStageDetailForResume } from '@/orchestrator/-ask-user/session-api';
import type { ChatApiMessage } from '@/shared/stage-tools';

import { buildResumeStageMessages } from './resume-messages';

const checkpoint = (overrides: Partial<TAskUserCheckpoint> = {}): TAskUserCheckpoint => ({
  batch: {
    batchId: 'round1',
    questions: [{
      kind: 'multipleChoice',
      options: [{ id: 'hko', label: 'HK Observatory (HKO)' }],
      questionRef: 'hk_region',
      title: '你想查詢哪個香港地區的天氣？',
    }],
    title: 'Region',
    version: 'askUserBatch.v1',
  },
  batchAnswers: [{
    answerValue: 'hko',
    optionIds: ['hko'],
    questionRef: 'hk_region',
  }],
  batchId: 'round1',
  contextSnapshot: {},
  questionId: 'q-1',
  requestId: 'req-1',
  stage: {},
  stageIndex: 2,
  status: 'answered',
  storageSnapshot: {},
  toolCallId: 'tool-ask-1',
  ...overrides,
});

const singleTurnStageDetail = (): TStageDetailForResume => ({
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
});

const multiTurnStageDetail = (): TStageDetailForResume => ({
  context: {},
  modelResponses: [
    {
      durationMs: 100,
      response: {
        choices: [{
          message: {
            content: 'read skill',
            tool_calls: [{
              function: { arguments: '{"command":"cat skill.md"}', name: 'run_bash' },
              id: 'tool-bash-1',
              type: 'function',
            }],
          },
        }],
        id: 'cmpl-1',
        model: 'gpt-test',
      },
      thinkingMode: false,
    },
    {
      durationMs: 110,
      response: {
        choices: [{
          message: {
            content: 'extract knowledge',
            tool_calls: [{
              function: {
                arguments: '{"skill":"get-knowledge","args":{}}',
                name: 'mastermind',
              },
              id: 'tool-mastermind-1',
              type: 'function',
            }],
          },
        }],
        id: 'cmpl-2',
        model: 'gpt-test',
      },
      thinkingMode: false,
    },
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
        id: 'cmpl-3',
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
});

const isAssistantWithToolCalls = (message: ChatApiMessage) =>
  message.role === 'assistant'
  && 'tool_calls' in message
  && Array.isArray(message.tool_calls)
  && message.tool_calls.length > 0;

const assertValidToolCallOrdering = (messages: ChatApiMessage[]) => {
  for (let index = 0; index < messages.length - 1; index += 1) {
    const current = messages[index];
    const next = messages[index + 1];

    if (isAssistantWithToolCalls(current)) {
      assert.notEqual(next.role, 'assistant', `assistant with tool_calls at ${index} must not be followed by assistant`);
    }
  }
};

describe('buildResumeStageMessages', () => {
  it('single-turn ask_user emits assistant then answer tool message', () => {
    const resumeFrom = buildResumeFrom(checkpoint(), singleTurnStageDetail());
    const messages = buildResumeStageMessages(resumeFrom);

    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.role, 'assistant');
    assert.equal(messages[1]?.role, 'tool');
    assert.equal((messages[1] as { tool_call_id: string }).tool_call_id, 'tool-ask-1');
    assert.deepEqual(JSON.parse(messages[1]?.content as string), {
      answers: [{ optionIds: ['hko'], questionRef: 'hk_region' }],
      batchId: 'round1',
      ok: true,
    });
    assertValidToolCallOrdering(messages);
  });

  it('multi-turn resume interleaves assistant and tool messages', () => {
    const resumeFrom = buildResumeFrom(checkpoint(), multiTurnStageDetail());
    const messages = buildResumeStageMessages(resumeFrom);

    assert.equal(messages.length, 6);
    assert.deepEqual(messages.map((message) => message.role), [
      'assistant',
      'tool',
      'assistant',
      'tool',
      'assistant',
      'tool',
    ]);
    assert.equal(JSON.parse(messages[1]?.content as string).ok, true);
    assert.equal(JSON.parse(messages[3]?.content as string).ok, true);
    assert.deepEqual(JSON.parse(messages[5]?.content as string), {
      answers: [{ optionIds: ['hko'], questionRef: 'hk_region' }],
      batchId: 'round1',
      ok: true,
    });
    assert.equal((messages[5] as { tool_call_id: string }).tool_call_id, 'tool-ask-1');
    assertValidToolCallOrdering(messages);
  });

  it('uses freeText answer payload for pending tool call', () => {
    const resumeFrom = buildResumeFrom(
      checkpoint({
        batchAnswers: [{
          answerValue: 'custom region',
          freeText: 'custom region',
          questionRef: 'hk_region',
        }],
      }),
      singleTurnStageDetail(),
    );
    const messages = buildResumeStageMessages(resumeFrom);
    const toolMessage = messages.find((message) => message.role === 'tool');

    assert.deepEqual(JSON.parse(toolMessage?.content as string), {
      answers: [{ freeText: 'custom region', questionRef: 'hk_region' }],
      batchId: 'round1',
      ok: true,
    });
  });
});
