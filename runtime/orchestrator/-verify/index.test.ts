import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { runVerifyGate } from '@/orchestrator/-verify';
import { VerifyUnavailableError } from '@/orchestrator/-verify/errors';
import { nixeryVerifyApi, runNixeryVerifyImpl } from '@/orchestrator/-verify/nixery-verify';

const verifyStage = {
  lines: '{\nconst report = { metric: 1 };\n}',
  sourceStartLine: 1,
  spec: {
    logic: 'const report = { metric: 1 };',
    verify: {
      defId: 'stage-verify',
      minScore: 0.75,
      rubric: 'metric must be set',
    },
  },
  type: 'plain',
} as ParsedStage;

const plainStage = {
  lines: '{\na = 1;\n}',
  sourceStartLine: 1,
  spec: { logic: 'a = 1;' },
  type: 'plain',
} as ParsedStage;

const storage = {
  context: new Map([['report', { metric: 1 }]]),
  types: new Map(),
};

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

const withNixeryVerify = <T>(
  impl: typeof runNixeryVerifyImpl,
  run: () => Promise<T>,
) => {
  const previous = nixeryVerifyApi.run;
  nixeryVerifyApi.run = impl;

  return run().finally(() => {
    nixeryVerifyApi.run = previous;
  });
};

describe('runVerifyGate', () => {
  it('skips when stage has no verify flag', async () => {
    await runVerifyGate({
      agentName: 'agent-test',
      pipelineStageIndex: 0,
      requestId: 'req-1',
      sessionId: 'sess-1',
      stage: plainStage,
      storage,
    });
  });

  it('returns when nixery verify passes', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    let verifyPassBody: Record<string, unknown> | undefined;
    let verifyCalls = 0;

    await withNixeryVerify(
      async () => {
        verifyCalls += 1;

        return { feedback: 'ok', pass: true, score: 1 };
      },
      () => withMockFetch(
        (url, init) => {
          if (url.includes('/verify-start') && init?.method === 'POST') {
            return Response.json({ data: { ok: true } });
          }

          if (url.includes('/verify-pass') && init?.method === 'POST') {
            verifyPassBody = JSON.parse(String(init.body)) as Record<string, unknown>;

            return Response.json({ data: { ok: true } });
          }

          throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
        },
        async () => {
          await runVerifyGate({
            agentName: 'agent-test',
            pipelineStageIndex: 2,
            requestId: 'req-verify',
            sessionId: 'sess-verify',
            stage: verifyStage,
            storage,
          });

          assert.deepEqual(verifyPassBody, { feedback: 'ok', score: 1 });
          assert.equal(verifyCalls, 1);
        },
      ),
    );
  });

  it('fast-forwards verify without nixery when verifyFastForward is set', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    let verifyPassBody: Record<string, unknown> | undefined;
    let verifyStartCalls = 0;
    let verifyCalls = 0;

    await withNixeryVerify(
      async () => {
        verifyCalls += 1;
        throw new Error('nixery should not be called');
      },
      () => withMockFetch(
        (url, init) => {
          if (url.includes('/verify-start') && init?.method === 'POST') {
            verifyStartCalls += 1;
            return Response.json({ data: { ok: true } });
          }

          if (url.includes('/verify-pass') && init?.method === 'POST') {
            verifyPassBody = JSON.parse(String(init.body)) as Record<string, unknown>;

            return Response.json({ data: { ok: true } });
          }

          throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
        },
        async () => {
          const result = await runVerifyGate({
            agentName: 'agent-test',
            pipelineStageIndex: 0,
            requestId: 'req-ff',
            sessionId: 'sess-ff',
            stage: verifyStage,
            storage,
            verifyFastForward: { feedback: 'trusted from source', score: 0.95 },
          });

          assert.equal(result.pass, true);
          assert.equal(result.feedback, 'trusted from source');
          assert.equal(verifyCalls, 0);
          assert.equal(verifyStartCalls, 0);
          assert.deepEqual(verifyPassBody, { feedback: 'trusted from source', score: 0.95 });
        },
      ),
    );
  });

  it('throws VerifyUnavailableError when nixery verify is unavailable', async () => {
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    let verifyCalls = 0;
    let checkpointBody: Record<string, unknown> | undefined;

    await withNixeryVerify(
      async () => {
        verifyCalls += 1;

        return {
          feedback: 'Agent agent-abc already has active run',
          pass: false,
          score: 0,
          unavailable: true,
        };
      },
      () => withMockFetch(
        (url, init) => {
          if (url.includes('/verify-start') && init?.method === 'POST') {
            return Response.json({ data: { ok: true } });
          }

          if (url.includes('/verify-checkpoints') && init?.method === 'POST') {
            checkpointBody = JSON.parse(String(init.body)) as Record<string, unknown>;

            return Response.json({ data: { verifyId: 'verify-unavailable' } }, { status: 201 });
          }

          throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
        },
        async () => {
          await assert.rejects(
            () => runVerifyGate({
              agentName: 'agent-test-no-docker',
              pipelineStageIndex: 2,
              requestId: 'req-verify-unavailable',
              sessionId: 'sess-verify-unavailable',
              stage: verifyStage,
              storage,
              shutdownOnFail: false,
              throwOnFail: false,
            }),
            (error: unknown) => {
              assert.ok(error instanceof VerifyUnavailableError);
              assert.match(error.feedback, /already has active run/);
              assert.equal(error.verifyId, 'verify-unavailable');

              return true;
            },
          );

          assert.equal(verifyCalls, 2);
          assert.equal(checkpointBody?.unavailable, true);
          assert.equal(checkpointBody?.score, 0);
        },
      ),
    );
  });
});
