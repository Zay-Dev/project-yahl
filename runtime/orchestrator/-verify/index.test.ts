import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { ParsedStage } from '@/orchestrator/-utils/yahl/types';

import { runVerifyGate } from '@/orchestrator/-verify';
import { VerifyFailedError } from '@/orchestrator/-verify/errors';

const verifyStage = {
  lines: '{\nconst report = { metric: 1 };\n}',
  sourceStartLine: 1,
  spec: {
    logic: 'const report = { metric: 1 };',
    verify: true,
    verifyMinScore: 0.75,
    verifyRubric: 'metric must be set',
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

  it('returns when mastermind verify passes', async () => {
    process.env.MASTERMIND_API_URL = 'http://mastermind.test';
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    let verifyPassBody: Record<string, unknown> | undefined;

    await withMockFetch(
      (url, init) => {
        if (url.endsWith('/v1/verify')) {
          return Response.json({ feedback: 'ok', pass: true, score: 1 });
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
      },
    );
  });

  it('throws VerifyFailedError when mastermind verify fails', async () => {
    process.env.MASTERMIND_API_URL = 'http://mastermind.test';
    process.env.SESSION_API_BASE_URL = 'http://session.test';

    let checkpointBody: Record<string, unknown> | undefined;

    await withMockFetch(
      (url, init) => {
        if (url.endsWith('/v1/verify')) {
          return Response.json({
            askUserRef: 'target_metric',
            feedback: 'metric missing',
            pass: false,
            resumeAction: 'edit_answer',
            score: 0,
          });
        }

        if (url.includes('/verify-checkpoints') && init?.method === 'POST') {
          checkpointBody = JSON.parse(String(init.body)) as Record<string, unknown>;

          return Response.json({ data: { verifyId: 'verify-1' } }, { status: 201 });
        }

        throw new Error(`unexpected fetch: ${url} ${init?.method ?? 'GET'}`);
      },
      async () => {
        await assert.rejects(
          () => runVerifyGate({
            agentName: 'agent-test-no-docker',
            pipelineStageIndex: 2,
            requestId: 'req-verify-fail',
            sessionId: 'sess-verify-fail',
            stage: verifyStage,
            storage,
          }),
          (error: unknown) => {
            assert.ok(error instanceof VerifyFailedError);
            assert.equal(error.verifyId, 'verify-1');
            assert.equal(error.score, 0);

            return true;
          },
        );

        assert.equal(checkpointBody?.resumeAction, 'edit_answer');
        assert.equal(checkpointBody?.askUserRef, 'target_metric');
      },
    );
  });
});
