import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchMastermindRequestStatus } from './mastermind-client.js';

const originalFetch = globalThis.fetch;

describe('mastermind-client request-status', () => {
  it('returns failed request payload from request-status endpoint', async () => {
    process.env.MASTERMIND_API_URL = 'http://mastermind.test';

    globalThis.fetch = async () => new Response(JSON.stringify({
      agent: 'ready',
      error: 'SDK stall',
      ok: false,
      queueDepth: 1,
      request: {
        error: 'SDK stall',
        kind: 'verify',
        requestId: 'req-1',
        sessionId: 'session-1',
        startedAt: '2026-06-23T00:00:00.000Z',
        status: 'failed',
        unavailable: true,
        updatedAt: '2026-06-23T00:00:01.000Z',
      },
      unavailable: true,
    }), { status: 200 });

    const status = await fetchMastermindRequestStatus({
      requestId: 'req-1',
      sessionId: 'session-1',
    });

    assert.equal(status.ok, false);
    assert.equal(status.request?.status, 'failed');

    globalThis.fetch = originalFetch;
  });
});
