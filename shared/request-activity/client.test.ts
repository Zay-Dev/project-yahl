import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ActivityRequestFailedError,
  fetchRequestStatus,
  formatActivityFetchError,
  postWithActivityRecovery,
  waitForTerminalActivity,
} from './client.js';

const originalFetch = globalThis.fetch;
const baseUrl = 'http://activity.test';

describe('request-activity-client', () => {
  it('fetchRequestStatus returns payload from GET /v1/request-status', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input);

      assert.match(url, /\/v1\/request-status\?/);

      return new Response(JSON.stringify({
        agent: 'ready',
        ok: true,
        queueDepth: 0,
        request: {
          kind: 'skill',
          requestId: 'req-1',
          sessionId: 'session-1',
          startedAt: '2026-06-23T00:00:00.000Z',
          status: 'running',
          updatedAt: '2026-06-23T00:00:01.000Z',
        },
      }), { status: 200 });
    };

    const status = await fetchRequestStatus(baseUrl, {
      requestId: 'req-1',
      sessionId: 'session-1',
    });

    assert.equal(status.request?.status, 'running');

    globalThis.fetch = originalFetch;
  });

  it('formatActivityFetchError classifies still_running when last status is running', () => {
    const message = formatActivityFetchError(
      new Error('fetch failed'),
      {
        kind: 'skill',
        requestId: 'req-1',
        sessionId: 'session-1',
        startedAt: '2026-06-23T00:00:00.000Z',
        status: 'running',
        updatedAt: '2026-06-23T00:00:01.000Z',
      },
      'mastermind',
    );

    assert.equal(message, 'mastermind_request_still_running: fetch failed');
  });

  it('waitForTerminalActivity returns succeeded status with resultData', async () => {
    let calls = 0;

    globalThis.fetch = async () => {
      calls += 1;

      if (calls === 1) {
        return new Response(JSON.stringify({
          agent: 'ready',
          ok: true,
          queueDepth: 0,
          request: {
            kind: 'skill',
            requestId: 'req-1',
            sessionId: 'session-1',
            startedAt: '2026-06-23T00:00:00.000Z',
            status: 'running',
            updatedAt: '2026-06-23T00:00:01.000Z',
          },
        }), { status: 200 });
      }

      return new Response(JSON.stringify({
        agent: 'ready',
        ok: true,
        queueDepth: 0,
        request: {
          kind: 'skill',
          requestId: 'req-1',
          resultData: '# research output',
          sessionId: 'session-1',
          startedAt: '2026-06-23T00:00:00.000Z',
          status: 'succeeded',
          updatedAt: '2026-06-23T00:00:02.000Z',
        },
      }), { status: 200 });
    };

    const status = await waitForTerminalActivity(
      baseUrl,
      {
        invocationId: 'inv-1',
        requestId: 'req-1',
        sessionId: 'session-1',
      },
      Date.now() + 15_000,
      {
        errorPrefix: 'mastermind',
        pollMs: 10,
      },
    );

    assert.equal(status.request?.status, 'succeeded');
    assert.equal(status.request?.resultData, '# research output');
    assert.ok(calls >= 2);

    globalThis.fetch = originalFetch;
  });

  it('postWithActivityRecovery waits after POST disconnect while still running', async () => {
    let postCalls = 0;
    let statusCalls = 0;

    const runningPayload = {
      agent: 'ready',
      ok: true,
      queueDepth: 1,
      request: {
        invocationId: 'inv-1',
        kind: 'skill',
        requestId: 'req-1',
        sessionId: 'session-1',
        startedAt: '2026-06-23T00:00:00.000Z',
        status: 'running',
        updatedAt: '2026-06-23T00:00:01.000Z',
      },
    };

    const succeededPayload = {
      agent: 'ready',
      ok: true,
      queueDepth: 0,
      request: {
        invocationId: 'inv-1',
        kind: 'skill',
        requestId: 'req-1',
        resultData: 'recovered markdown',
        sessionId: 'session-1',
        startedAt: '2026-06-23T00:00:00.000Z',
        status: 'succeeded',
        updatedAt: '2026-06-23T00:00:02.000Z',
      },
    };

    globalThis.fetch = async (input, init) => {
      if (init?.method === 'POST') {
        postCalls += 1;
        throw new Error('fetch failed');
      }

      statusCalls += 1;

      if (postCalls === 0 || statusCalls <= postCalls + 1) {
        return new Response(JSON.stringify(runningPayload), { status: 200 });
      }

      return new Response(JSON.stringify(succeededPayload), { status: 200 });
    };

    const result = await postWithActivityRecovery(
      baseUrl,
      `${baseUrl}/v1/skills/research`,
      { args: {}, caller: 'stage-agent' },
      {
        invocationId: 'inv-1',
        requestId: 'req-1',
        sessionId: 'session-1',
      },
      {
        errorPrefix: 'mastermind',
        pollMs: 10,
      },
    );

    assert.equal(postCalls, 1);
    assert.ok(statusCalls >= 2);
    assert.equal(result.recovered, true);

    const body = await result.response.json() as { data?: string; ok: boolean };

    assert.equal(body.ok, true);
    assert.equal(body.data, 'recovered markdown');

    globalThis.fetch = originalFetch;
  });

  it('postWithActivityRecovery throws ActivityRequestFailedError when status is failed', async () => {
    globalThis.fetch = async (input, init) => {
      if (init?.method === 'POST') {
        await new Promise((resolve) => {
          setTimeout(resolve, 25);
        });
        throw new Error('fetch failed');
      }

      return new Response(JSON.stringify({
        agent: 'ready',
        error: 'SDK stall',
        ok: false,
        queueDepth: 0,
        request: {
          invocationId: 'inv-1',
          error: 'SDK stall',
          kind: 'skill',
          requestId: 'req-1',
          sessionId: 'session-1',
          startedAt: '2026-06-23T00:00:00.000Z',
          status: 'failed',
          unavailable: true,
          updatedAt: '2026-06-23T00:00:02.000Z',
        },
        unavailable: true,
      }), { status: 200 });
    };

    await assert.rejects(
      () => postWithActivityRecovery(
        baseUrl,
        `${baseUrl}/v1/skills/research`,
        { args: {}, caller: 'stage-agent' },
        {
          invocationId: 'inv-1',
          requestId: 'req-1',
          sessionId: 'session-1',
        },
        {
          errorPrefix: 'mastermind',
          pollMs: 10,
        },
      ),
      (error: unknown) => error instanceof ActivityRequestFailedError && error.message === 'SDK stall',
    );

    globalThis.fetch = originalFetch;
  });
});
