import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolvePreparedResumeRun } from './resolve-prepared-resume';

const withMockFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  run: () => Promise<void>,
) => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    return handler(url, init);
  }) as typeof fetch;

  return run().finally(() => {
    globalThis.fetch = originalFetch;
  });
};

const parsedStages = [
  {
    lines: '{\nconst a = 1;\n}',
    sourceStartLine: 1,
    spec: { logic: 'const a = 1;' },
    type: 'plain' as const,
  },
  {
    lines: '{\nconst b = 2;\n}',
    sourceStartLine: 2,
    spec: {
      askUser: [{ id: '1', question: 'pick?' }],
      logic: 'const b = 2;',
    },
    type: 'plain' as const,
  },
];

const sessionPayload = {
  parsedStages,
  resultContextKey: 'result',
  runInput: {},
  sessionId: 'sess-1',
  taskId: 'test',
  taskSkills: [],
  taskYahl: 'name: test\nstages: []',
};

const askUserCheckpoint = {
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
  parsedStageSnapshot: {
    lines: parsedStages[1]!.lines,
    sourceStartLine: 2,
    type: 'plain' as const,
  },
  questionId: 'q-1',
  requestId: 'req-ask',
  stage: {
    askUser: [{ id: '1', question: 'pick?' }],
    logic: 'const b = 2;',
  },
  stageIndex: 1,
  status: 'answered' as const,
  storageSnapshot: { context: { fromAskUser: true }, types: {} },
  toolCallId: 'tool-ask-1',
};

const stageDetailWithActivity = {
  context: {},
  modelResponses: [{
    durationMs: 10,
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
  }],
  stage: askUserCheckpoint.stage,
  toolCalls: [{
    tools: [{
      arguments: { batchId: 'round1' },
      id: 'tool-ask-1',
      name: 'ask_user',
    }],
  }],
};

describe('resolvePreparedResumeRun user-pause', () => {
  it('delegates mid-ask-user pause to ask-user prepare with pause storage overlay', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-1')) {
          return Response.json({
            pauseId: 'pause-1',
            requestId: 'req-ask',
            stage: askUserCheckpoint.stage,
            stageIndex: 1,
            status: 'pending',
            storageSnapshot: { context: { fromPause: true, fresher: 1 }, types: {} },
            parsedStageSnapshot: askUserCheckpoint.parsedStageSnapshot,
          });
        }

        if (url.endsWith('/sessions/sess-1') || url.includes('/sessions/sess-1?')) {
          return Response.json(sessionPayload);
        }

        if (url.includes('/ask-user/questions?status=answered')) {
          return Response.json([
            { questionId: 'q-1', requestId: 'req-ask', status: 'answered' },
          ]);
        }

        if (url.includes('/ask-user/questions/q-1')) {
          return Response.json(askUserCheckpoint);
        }

        if (url.includes('/stages/req-ask')) {
          return Response.json(stageDetailWithActivity);
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const prepared = await resolvePreparedResumeRun('sess-1', 'pause-1', 'user-pause');

        assert.equal(prepared.cursor.kind, 'pipeline');
        assert.equal(prepared.cursor.stageIndex, 1);
        assert.ok(prepared.cursor.resumeStage?.resumeFrom);
        assert.equal(prepared.cursor.resumeStage?.resumeFrom?.pendingToolCallId, 'tool-ask-1');
        assert.equal(prepared.cursor.resumeStage?.requestId, 'req-ask');
        assert.equal(prepared.storage.context.get('fromPause'), true);
        assert.equal(prepared.storage.context.get('fresher'), 1);
        assert.equal(prepared.storage.context.get('fromAskUser'), undefined);
      },
    );
  });

  it('uses generic user-pause prepare when no answered ask-user on requestId', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-plain')) {
          return Response.json({
            pauseId: 'pause-plain',
            requestId: 'req-plain',
            stage: { logic: 'const a = 1;' },
            stageIndex: 0,
            status: 'pending',
            storageSnapshot: { context: { plain: true }, types: {} },
            parsedStageSnapshot: {
              lines: parsedStages[0]!.lines,
              sourceStartLine: 1,
              type: 'plain',
            },
          });
        }

        if (url.endsWith('/sessions/sess-1') || url.includes('/sessions/sess-1?')) {
          return Response.json(sessionPayload);
        }

        if (url.includes('/ask-user/questions?status=answered')) {
          return Response.json([]);
        }

        if (url.includes('/stages/req-plain')) {
          return Response.json({
            context: {},
            modelResponses: [],
            stage: { logic: 'const a = 1;' },
            toolCalls: [],
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const prepared = await resolvePreparedResumeRun('sess-1', 'pause-plain', 'user-pause');

        assert.equal(prepared.cursor.kind, 'pipeline');
        assert.equal(prepared.cursor.stageIndex, 0);
        assert.equal(prepared.cursor.resumeStage?.resumeFrom, undefined);
        assert.equal(prepared.cursor.resumeStage?.requestId, 'req-plain');
        assert.equal(prepared.storage.context.get('plain'), true);
      },
    );
  });

  it('attaches mid-turn resumeFrom for warm-up user-pause with activity', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    const whileStage = {
      lines: '{\nc += 1;\n}',
      sourceStartLine: 10,
      spec: {
        logic: 'c += 1;',
        warmUp: 'c += 1;',
        whileSetup: 'context.context.c < 20',
      },
      type: 'while' as const,
    };

    const whileSession = {
      ...sessionPayload,
      parsedStages: [parsedStages[0]!, whileStage],
    };

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-warmup')) {
          return Response.json({
            loopMeta: {
              arraySnapshot: [],
              index: 0,
              kind: 'warmup',
              remainingBashCalls: 24,
              remainingTurns: 8,
              value: null,
            },
            pauseId: 'pause-warmup',
            requestId: 'req-warmup',
            stage: whileStage.spec,
            stageIndex: 1,
            status: 'pending',
            storageSnapshot: { context: { c: 77 }, types: {} },
            parsedStageSnapshot: {
              lines: whileStage.lines,
              sourceStartLine: 10,
              type: 'while',
            },
          });
        }

        if (url.endsWith('/sessions/sess-1') || url.includes('/sessions/sess-1?')) {
          return Response.json(whileSession);
        }

        if (url.includes('/ask-user/questions?status=answered')) {
          return Response.json([]);
        }

        if (url.includes('/stages/req-warmup')) {
          return Response.json({
            context: { c: 77 },
            modelResponses: [{
              durationMs: 10,
              response: {
                choices: [{
                  message: {
                    content: 'bump c',
                    tool_calls: [{
                      function: { arguments: '{"key":"c","value":78}', name: 'set_context' },
                      id: 'tool-set-1',
                      type: 'function',
                    }],
                  },
                }],
                id: 'cmpl-w',
                model: 'gpt-test',
              },
            }],
            stage: whileStage.spec,
            toolCalls: [{
              tools: [{
                arguments: { key: 'c', value: 78 },
                id: 'tool-set-1',
                name: 'set_context',
              }],
            }],
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const prepared = await resolvePreparedResumeRun('sess-1', 'pause-warmup', 'user-pause');

        assert.equal(prepared.cursor.loopContinueOnly, undefined);
        assert.equal(prepared.cursor.loopMeta?.kind, 'warmup');
        assert.ok(prepared.cursor.resumeStage?.resumeFrom);
        assert.equal(prepared.cursor.resumeStage?.resumeFrom?.pendingToolCallId, '');
        assert.equal(prepared.cursor.resumeStage?.resumeFrom?.batchAnswers.length, 0);
        assert.equal(prepared.cursor.resumeStage?.requestId, 'req-warmup');
        assert.equal(prepared.storage.context.get('c'), 77);
      },
    );
  });

  it('prepares loop-continue-only when warm-up requestId is already finished', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    const whileStage = {
      lines: '{\nc += 1;\n}',
      sourceStartLine: 10,
      spec: {
        logic: 'c += 1;',
        warmUp: 'c += 1;',
        whileSetup: 'context.context.c < 20',
      },
      type: 'while' as const,
    };

    const whileSession = {
      ...sessionPayload,
      parsedStages: [parsedStages[0]!, whileStage],
    };

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-done')) {
          return Response.json({
            loopMeta: {
              arraySnapshot: [],
              index: 0,
              kind: 'warmup',
              remainingBashCalls: 24,
              remainingTurns: 7,
              value: null,
            },
            pauseId: 'pause-done',
            requestId: 'req-warmup-done',
            stage: whileStage.spec,
            stageIndex: 1,
            status: 'pending',
            storageSnapshot: { context: { c: 78 }, types: {} },
            parsedStageSnapshot: {
              lines: whileStage.lines,
              sourceStartLine: 10,
              type: 'while',
            },
          });
        }

        if (url.endsWith('/sessions/sess-1') || url.includes('/sessions/sess-1?')) {
          return Response.json(whileSession);
        }

        if (url.includes('/ask-user/questions?status=answered')) {
          return Response.json([]);
        }

        if (url.includes('/stages/req-warmup-done')) {
          return Response.json({
            context: { c: 78 },
            finishedAt: '2026-08-24T21:19:49.032Z',
            modelResponses: [],
            stage: whileStage.spec,
            toolCalls: [],
          });
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const prepared = await resolvePreparedResumeRun('sess-1', 'pause-done', 'user-pause');

        assert.equal(prepared.cursor.loopContinueOnly, true);
        assert.equal(prepared.cursor.completedRequestId, 'req-warmup-done');
        assert.equal(prepared.cursor.loopMeta?.kind, 'warmup');
        assert.equal(prepared.cursor.stageIndex, 1);
        assert.equal(prepared.cursor.resumeStage, undefined);
      },
    );
  });

  it('keeps repair user-pause path without ask-user delegation', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    await withMockFetch(
      (url) => {
        if (url.includes('/user-pause-checkpoints/pause-repair')) {
          return Response.json({
            pauseId: 'pause-repair',
            repairInstruction: 'fix the bug',
            requestId: 'req-repair',
            stage: { logic: 'const a = 1;' },
            stageIndex: 0,
            status: 'pending',
            storageSnapshot: { context: {}, types: {} },
          });
        }

        if (url.endsWith('/sessions/sess-1') || url.includes('/sessions/sess-1?')) {
          return Response.json(sessionPayload);
        }

        throw new Error(`unexpected fetch: ${url}`);
      },
      async () => {
        const prepared = await resolvePreparedResumeRun('sess-1', 'pause-repair', 'user-pause');

        assert.equal(prepared.cursor.kind, 'repair');
        assert.equal(prepared.cursor.repairInstruction, 'fix the bug');
        assert.ok(prepared.systemAppend?.includes('fix the bug'));
      },
    );
  });
});
