import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SessionEventTrackerError, createSessionEventTracker, truncateToolResult } from './session-event-tracker';

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

describe('createSessionEventTracker', () => {
  it('surfaces HTTP failures from patchStage via flush', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'PATCH' && url.includes('/stages/stage-req-1')) {
          return new Response('payload too large', { status: 413, statusText: 'Payload Too Large' });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.patchStage('sess-1', {
          contextAfter: { context: { intel: [] }, types: {} },
          requestId: 'stage-req-1',
        });

        await assert.rejects(
          tracker.flush(),
          (error: unknown) => {
            assert.ok(error instanceof SessionEventTrackerError);
            assert.equal(error.status, 413);
            assert.match(error.message, /413 Payload Too Large/);

            return true;
          },
        );
      },
    );
  });

  it('surfaces HTTP failures from patchLiveViewVncPort via flush', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'PATCH' && url.endsWith('/api/sessions/sess-vnc')) {
          return new Response('not found', { status: 404, statusText: 'Not Found' });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.patchLiveViewVncPort('sess-vnc', 5901);

        await assert.rejects(
          tracker.flush(),
          (error: unknown) => {
            assert.ok(error instanceof SessionEventTrackerError);
            assert.equal(error.status, 404);

            return true;
          },
        );
      },
    );
  });

  it('PATCHes liveViewVncPort on flush', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();
    let patchedBody: unknown;

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'PATCH' && url.endsWith('/api/sessions/sess-vnc-ok')) {
          patchedBody = JSON.parse(String(init.body));

          return new Response(JSON.stringify({ ok: true }), { status: 202 });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.patchLiveViewVncPort('sess-vnc-ok', 5902);
        await tracker.flush();

        assert.deepEqual(patchedBody, { liveViewVncPort: 5902 });
      },
    );
  });

  it('surfaces HTTP failures from createStage via flush', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'POST' && url.endsWith('/stages')) {
          return new Response('not found', { status: 404, statusText: 'Not Found' });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.createStage('sess-missing-stage', {
          context: { context: {}, types: {} },
          requestId: 'stage-req-missing',
          stage: { logic: 'goals logic' },
        });

        await assert.rejects(
          tracker.flush(),
          (error: unknown) => {
            assert.ok(error instanceof SessionEventTrackerError);
            assert.equal(error.status, 404);

            return true;
          },
        );
      },
    );
  });

  it('POSTs parsedStageIndex and sourceStartLine on createStage', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();
    let createdBody: unknown;

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'POST' && url.endsWith('/stages')) {
          createdBody = JSON.parse(String(init.body));

          return new Response(JSON.stringify({ ok: true }), { status: 202 });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.createStage('sess-audit', {
          context: { context: {}, types: {} },
          parsedStageIndex: 2,
          requestId: 'stage-req-audit',
          sourceStartLine: 42,
          stage: { logic: 'goals logic' },
        });

        await tracker.flush();

        assert.deepEqual(createdBody, {
          context: { context: {}, types: {} },
          parsedStageIndex: 2,
          requestId: 'stage-req-audit',
          sourceStartLine: 42,
          stage: { logic: 'goals logic' },
        });
      },
    );
  });

  it('logs but continues the queue when non-critical POST fails', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();
    let toolCallAttempts = 0;

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'POST' && url.includes('/tool-calls')) {
          toolCallAttempts += 1;

          return new Response('bad request', { status: 400, statusText: 'Bad Request' });
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.appendToolCall('sess-1', {
          requestId: 'stage-req-2',
          toolCalls: [{ function: { arguments: '{}', name: 'set_context' }, id: '1', type: 'function' }],
        });

        tracker.patchStage('sess-2', {
          contextAfter: { context: {}, types: {} },
          requestId: 'stage-req-3',
        });

        await tracker.flush();

        assert.equal(toolCallAttempts, 1);
      },
    );
  });

  it('posts truncated tool results', async () => {
    process.env.SESSION_API_BASE_URL = 'http://localhost:4000';

    const tracker = createSessionEventTracker();
    let posted: unknown;

    await withMockFetch(
      (url, init) => {
        if (init?.method === 'POST' && url.includes('/tool-call-results')) {
          posted = JSON.parse(String(init.body ?? '{}'));
        }

        return new Response(JSON.stringify({ ok: true }), { status: 202 });
      },
      async () => {
        tracker.appendToolResult('sess-1', {
          requestId: 'stage-req-4',
          result: 'skill body',
          toolCallId: 'call-1',
        });

        await tracker.flush();

        assert.deepEqual(posted, {
          results: [{ content: 'skill body', id: 'call-1' }],
        });
      },
    );
  });
});

describe('truncateToolResult', () => {
  it('leaves short results unchanged', () => {
    assert.equal(truncateToolResult('ok'), 'ok');
  });

  it('caps long stdout', () => {
    const truncated = truncateToolResult('x'.repeat(24_001));

    assert.ok(truncated.endsWith('\n…[truncated]'));
    assert.equal(truncated.length, 24_000 + '\n…[truncated]'.length);
  });
});
